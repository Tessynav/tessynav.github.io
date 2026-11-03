/* TessyNav v2 — track.js
   The car's position, done once, in one place:
   1. GPS filter: smooths the GPS without running ahead of it, settles when stopped
   2. Road matching along the road network: the car follows the road it is on and can only move to a road that is
      connected to it (at a junction, an exit, a merge). Parallel roads, roads under/over a bridge and stacked
      interchange roads can't steal the car. If the GPS is far from every road, it re-finds the road.
   3. The car moves ALONG the matched road (its own speed, softly corrected toward the GPS), so it follows the road's
      shape exactly in curves and never cuts corners
   4. Lane: the car sits in the centre of its lane and changes lane smoothly when you really change lane
   5. Height: always the height of the matched road at that point (no guessing between levels)
   No browser parts here, so recorded drives can be replayed through it for testing. */
var TN=globalThis.TN||{};globalThis.TN=TN;

TN.Track=function(net){
  this.net=net;
  this.kf=null;this.kfT=0;this.hd=null;
  this.hyps=[];this.cur=null;this.lost=0;
  this.car=null;      /* {w, s, lat, v, x, z, h, y, snapped} */
  this.lane={idx:null,t:0};
  this.last=null;
};

/* ---------- 1. GPS filter (two independent 1D Kalman filters, position + speed) ---------- */
TN.kfPredict=function(a,dt,q){a.p+=a.v*dt;const P=a.P,dt2=dt*dt;
  P[0][0]+=dt*(P[1][0]+P[0][1])+dt2*P[1][1]+q*dt2*dt2/4;P[0][1]+=dt*P[1][1]+q*dt2*dt/2;P[1][0]+=dt*P[1][1]+q*dt2*dt/2;P[1][1]+=q*dt2;};
TN.kfPos=function(a,z,r){const P=a.P,S=P[0][0]+r,k0=P[0][0]/S,k1=P[1][0]/S,y=z-a.p;a.p+=k0*y;a.v+=k1*y;
  const p00=P[0][0],p01=P[0][1];P[0][0]-=k0*p00;P[0][1]-=k0*p01;P[1][0]-=k1*p00;P[1][1]-=k1*p01;};
TN.kfVel=function(a,z,r){const P=a.P,S=P[1][1]+r,k0=P[0][1]/S,k1=P[1][1]/S,y=z-a.v;a.p+=k0*y;a.v+=k1*y;
  const p10=P[1][0],p11=P[1][1];P[0][0]-=k0*p10;P[0][1]-=k0*p11;P[1][0]-=k1*p10;P[1][1]-=k1*p11;};
TN.Track.prototype.gps=function(t,lng,lat,acc,speed,heading){
  const [x,z]=TN.toLocal(lng,lat);
  /* a very rough position (the browser's first guesses can be hundreds of metres off) is ignored until the
     real GPS is precise; otherwise the car would be placed on a random road */
  if(acc!=null&&acc>60){
    /* the car's own estimate while the GPS signal is weak (under overpasses, in tunnels) is still good: use it,
       with less trust, as long as we had a precise fix recently */
    if(!this.goodT||t-this.goodT>30000||speed==null){this.rough={t:t,acc:acc};return this.last;}
    acc=15;
  }else this.goodT=t;
  this.rough=null;
  if(!this.kf||t-this.kfT>5000){
    this.kf={x:{p:x,v:0,P:[[25,0],[0,25]]},z:{p:z,v:0,P:[[25,0],[0,25]]}};
  }else{
    const dt=Math.max(0.05,(t-this.kfT)/1000);
    TN.kfPredict(this.kf.x,dt,9);TN.kfPredict(this.kf.z,dt,9);
  }
  this.kfT=t;
  const r=Math.pow(Math.max(2,(acc||5)*0.7),2);
  TN.kfPos(this.kf.x,x,r);TN.kfPos(this.kf.z,z,r);
  const sp=speed==null||isNaN(speed)?null:speed;
  if(sp!=null){
    if(sp<0.3){
      TN.kfVel(this.kf.x,0,0.02);TN.kfVel(this.kf.z,0,0.02);
      /* stopped: settle on the GPS within about a second */
      this.kf.x.p+=(x-this.kf.x.p)*0.3;this.kf.z.p+=(z-this.kf.z.p)*0.3;
      this.kf.x.P[0][0]=Math.max(this.kf.x.P[0][0],1);this.kf.z.P[0][0]=Math.max(this.kf.z.P[0][0],1);
    }else if(heading!=null&&!isNaN(heading)){
      const h=heading*TN.R;
      TN.kfVel(this.kf.x,sp*Math.sin(h),TN.VELR);TN.kfVel(this.kf.z,-sp*Math.cos(h),TN.VELR);
    }
  }
  const fx=this.kf.x.p,fz=this.kf.z.p,v=Math.hypot(this.kf.x.v,this.kf.z.v);
  if(v>1.5) this.hd=(Math.atan2(this.kf.x.v,-this.kf.z.v)/TN.R+360)%360;
  else if(heading!=null&&!isNaN(heading)&&sp>1) this.hd=heading;
  this.last={t:t,x:fx,z:fz,v:sp!=null?sp:v,acc:acc||5,rx:x,rz:z};
  this.match();
  return this.last;
};

/* ---------- 2. road matching along the network ---------- */
TN.VELR=16;
TN.angDiff=(a,b)=>Math.abs(((a-b+540)%360)-180);
TN.Track.prototype.hypAt=function(w,i,dir,x,z){
  const r=TN.seg(w,i,x,z);
  /* travel direction tangent */
  const tx=r.tx*dir,tz=r.tz*dir,hd=(Math.atan2(tx,-tz)/TN.R+360)%360;
  return {w:w,i:i,dir:dir,r:r,hd:hd,cost:0,lastKey:null,born:this.last?this.last.t:0};
};
TN.Track.prototype.dirsFor=function(w){return w.ow===1?[1]:w.ow===-1?[-1]:[1,-1];};
TN.Track.prototype.acquire=function(){
  const L=this.last,hs=[];if(!L) return;
  const best=new Map();
  this.net.near(L.x,L.z,25,(w,i)=>{
    const r=TN.seg(w,i,L.x,L.z);if(r.d>25) return;
    for(const dir of this.dirsFor(w)){
      const h=this.hypAt(w,i,dir,L.x,L.z);
      if(this.hd!=null&&L.v>1.5&&TN.angDiff(h.hd,this.hd)>45) continue;
      const k=w.id+':'+dir,b=best.get(k);
      if(!b||h.r.d<b.r.d) best.set(k,h);
    }
  });
  for(const h of best.values()){h.cost=this.emit(h);hs.push(h);}
  hs.sort((a,b)=>a.cost-b.cost);
  this.hyps=hs.slice(0,8);
  this.cur=this.hyps[0]||null;
};
/* how badly a position on road h fits the GPS */
TN.Track.prototype.emit=function(h){
  const L=this.last,hw=TN.width(h.w)/2;
  /* sideways distance from the road line; before the start / past the end of a piece counts gently */
  let side=h.r.d,over=0;
  if(h.r.ur!=null&&(h.r.ur<0||h.r.ur>1)){
    const a=h.w.pts[h.i],b=h.w.pts[h.i+1],sl=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
    side=Math.abs(h.r.lat!=null?((L.x-a[0])*(-(b[1]-a[1])/sl)+(L.z-a[1])*((b[0]-a[0])/sl)):h.r.d);
    over=(h.r.ur<0?-h.r.ur:h.r.ur-1)*sl;
  }
  h.side=side;
  const out=Math.max(0,side-hw*0.7);
  let e=(out/3)*(out/3)+(over/12)*(over/12);
  if(this.hd!=null&&L.v>2){const a=TN.angDiff(h.hd,this.hd);e+=a>8?((a-8)/20)*((a-8)/20):0;}
  return e;
};
/* move a hypothesis along its road to the GPS; spawn the roads that branch off at junctions it passes */
TN.Track.prototype.advance=function(h,out){
  const L=this.last,w=h.w,n=w.pts.length;
  let bi=h.i,br=TN.seg(w,h.i,L.x,L.z);
  for(let k=1;k<=6;k++){
    const j=h.i+k*h.dir;if(j<0||j>n-2) break;
    const r=TN.seg(w,j,L.x,L.z);if(r.d<br.d-0.01){bi=j;br=r;}
  }
  for(let k=1;k<=2;k++){const j=h.i-k*h.dir;if(j<0||j>n-2) break;const r=TN.seg(w,j,L.x,L.z);if(r.d<br.d-0.5){bi=j;br=r;}}
  /* vertices passed since last time: junction check */
  const from=h.i,to=bi;
  const passed=[];
  if(h.dir>0){for(let j=from+1;j<=to;j++) passed.push(j);}
  else{for(let j=from;j>to;j--) passed.push(j);}
  /* also the vertex we are about to reach if we are at the end of this segment */
  const endV=h.dir>0?bi+1:bi;
  if((h.dir>0&&br.ur>0.75)||(h.dir<0&&br.ur<0.25)) passed.push(endV);
  h.i=bi;h.r=br;h.hd=(Math.atan2(br.tx*h.dir,-br.tz*h.dir)/TN.R+360)%360;
  for(const j of passed){
    if(j<0||j>=n) continue;
    const key=w.keys[j];if(key===h.lastKey) continue;
    const l=this.net.keys.get(key);if(!l||l.length<2) continue;
    /* branch only once the GPS is close to the junction (or past it) */
    if(Math.hypot(w.pts[j][0]-L.x,w.pts[j][1]-L.z)>15&&j===endV) continue;
    h.lastKey=key;
    for(const [v,vi] of l){
      if(v===w&&vi===j) continue;
      for(const dir of this.dirsFor(v)){
        const si=dir>0?vi:vi-1;if(si<0||si>v.pts.length-2) continue;
        const c=this.hypAt(v,si,dir,L.x,L.z);
        /* no U-turns at junctions */
        if(TN.angDiff(c.hd,h.hd)>110) continue;
        c.cost=h.cost+0.5;c.lastKey=key;c.parent=h;
        out.push(c);
      }
    }
  }
  /* at the very end of this road, the hypothesis can only live on through its branches */
  const atEnd=(h.dir>0&&bi===n-2&&br.ur>1.2)||(h.dir<0&&bi===0&&br.ur<-0.2);
  return !atEnd;
};
TN.Track.prototype.match=function(){
  const L=this.last;
  if(!this.hyps.length){this.acquire();return;}
  if(L.v<1.0){
    /* stopped / creeping: keep the road, just re-project */
    for(const h of this.hyps){h.r=TN.seg(h.w,h.i,L.x,L.z);}
    return;
  }
  const next=[];
  for(const h of this.hyps){
    if(this.advance(h,next)) next.push(h);
  }
  for(const h of next){h.cost=h.cost*0.88+this.emit(h);}
  /* one hypothesis per road and direction (the cheaper one) */
  const by=new Map();
  for(const h of next){const k=h.w.id+':'+h.dir,b=by.get(k);if(!b||h.cost<b.cost) by.set(k,h);}
  let hs=[...by.values()].sort((a,b)=>a.cost-b.cost);
  const best=hs[0];
  hs=hs.filter(h=>h.cost<best.cost+25&&h.r.d<35).slice(0,10);
  this.hyps=hs;
  /* keep the current road unless another clearly fits better for a while */
  const cur=this.cur&&hs.find(h=>h.w===this.cur.w&&h.dir===this.cur.dir);
  if(!cur){this.cur=best;}
  else if(best!==cur&&best.cost<cur.cost-2.5){this.cur=best;}
  else this.cur=cur;
  /* lost: every road is far away -> look again around the GPS */
  if(!this.cur||this.cur.r.d>TN.width(this.cur.w)/2+12){
    this.lost++;
    if(this.lost>=5){this.lost=0;this.acquire();}
  }else this.lost=0;
};

/* ---------- 3-5. the car: along the matched road, lane, height ---------- */
TN.Track.prototype.lanesOf=function(w){
  const W=TN.width(w),n=w.lanes||0;
  if(w.cls==='minor'||w.cls==='service') return null;
  if(w.ow){const L=n||Math.max(1,Math.round(W/3.5));const lw=W/L,c=[];for(let k=0;k<L;k++) c.push(-W/2+lw*(k+0.5));return c;}
  /* two-way: lanes of the right half only, lateral measured to the right of the driving direction */
  const nh=n>=2?Math.floor(n/2):(W>=14?2:1),lw=(W/2)/nh,c=[];for(let k=0;k<nh;k++) c.push(lw*(k+0.5));return c;
};
/* lateral (+ right of driving direction) of GPS on hypothesis h */
TN.latOf=function(h,x,z){const r=TN.seg(h.w,h.i,x,z);return r.lat*h.dir;};
TN.Track.prototype.pointOn=function(w,s,lat,dir){
  /* position on the road at distance s, shifted lat to the right of the driving direction;
     (the direction is taken over 8 m so polyline corners turn smoothly) */
  const P=w.pts,c=w.cum,L=w.L;
  const at=q=>{q=Math.max(0,Math.min(L,q));let lo=0,hi=c.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(c[m]<=q) lo=m;else hi=m;}
    const sg=c[lo+1]-c[lo]||1,t=(q-c[lo])/sg;return [P[lo][0]+(P[lo+1][0]-P[lo][0])*t,P[lo][1]+(P[lo+1][1]-P[lo][1])*t];};
  const p0=at(s),x=p0[0],z=p0[1];
  const a=at(s-4),b=at(s+4);let tx=b[0]-a[0],tz=b[1]-a[1];const tl=Math.hypot(tx,tz)||1;tx/=tl;tz/=tl;
  /* right of driving direction */
  const rx=-tz*dir,rz=tx*dir;
  return {x:x+rx*lat,z:z+rz*lat,hd:(Math.atan2(tx*dir,-tz*dir)/TN.R+360)%360};
};
TN.Track.prototype.frame=function(now,dt){
  const L=this.last;if(!L) return null;
  const h=this.cur;
  const age=Math.min(1,Math.max(0,(now-L.t)/1000));
  const snapped=!!h&&(h.side!=null?h.side:h.r.d)<=TN.width(h.w)/2+6;
  let car=this.car;
  if(!snapped){
    /* off the road network (parking lot, missing road): follow the filtered GPS smoothly */
    const hd=this.hd!=null?this.hd:(car?car.hd:0);
    const tx=L.x+Math.sin(hd*TN.R)*L.v*age,tz=L.z-Math.cos(hd*TN.R)*L.v*age;
    if(!car||Math.hypot(car.x-tx,car.z-tz)>30) car={x:tx,z:tz,hd:hd,v:L.v,y:0};
    const k=1-Math.exp(-dt*4);car.x+=(tx-car.x)*k;car.z+=(tz-car.z)*k;
    car.hd=(car.hd+TN.angDiff2(hd,car.hd)*Math.min(1,dt*3)+360)%360;
    /* off the network: keep the height a few seconds (short gaps at junctions on overpasses), then go down */
    if(!car.offT) car.offT=now;
    if(now-car.offT>3000) car.y+=(0-car.y)*Math.min(1,dt*2);
    car.w=null;car.snapped=false;this.car=car;return car;
  }
  const w=h.w,dir=h.dir;
  /* GPS position along this road, a bit ahead for the GPS age */
  /* (half the GPS age: the GPS position is itself a little behind the speed reading) */
  const sG=h.r.s+dir*L.v*age*0.5;
  if(!car||car.w!==w||car.dir!==dir){
    /* new road (junction, exit, re-found): continue from where the car is drawn, no jump */
    let s0=sG,lat0=TN.latOf(h,L.x,L.z);
    if(car&&car.x!=null){
      let bj=0,bd=1e9;for(let j=0;j<w.pts.length-1;j++){const r=TN.seg(w,j,car.x,car.z);if(r.d<bd){bd=r.d;bj=j;}}
      const r=TN.seg(w,bj,car.x,car.z);
      if(r.d<20){s0=r.s;lat0=r.lat*dir;}
    }
    car={w:w,dir:dir,s:s0,lat:lat0,v:car?car.v:L.v,cv:car&&car.cv||0,x:car?car.x:null,z:car?car.z:null,hd:car?car.hd:h.hd,y:car?car.y:0,gl:lat0};
    this.lane.idx=null;
  }
  /* the car reached the end of its road piece before the matching moved on: continue on the best connected piece */
  if((dir>0&&car.s>w.L)||(dir<0&&car.s<0)){
    const endKey=dir>0?w.keys[w.keys.length-1]:w.keys[0];
    let nx=null;
    for(const o of this.hyps){if(o.w===w) continue;const k0=o.dir>0?o.w.keys[0]:o.w.keys[o.w.keys.length-1];
      if(k0===endKey&&(!nx||o.cost<nx.cost)) nx=o;}
    if(nx){
      const over=dir>0?car.s-w.L:-car.s;
      const nc={w:nx.w,dir:nx.dir,s:nx.dir>0?over:nx.w.L-over,lat:car.lat,v:car.v,cv:car.cv,x:car.x,z:car.z,hd:car.hd,y:car.y,gl:car.gl};
      this.cur=nx;car=nc;this.car=car;
      /* (at most a few road pieces at once, never an endless loop) */
      this.depth=(this.depth||0)+1;
      const res=this.depth<6?this.frame(now,0):car;
      this.depth=0;
      return res;
    }
  }
  /* along the road: own speed, softly corrected toward the GPS (no running past, no rolling back) */
  car.v+=(L.v-car.v)*(1-Math.exp(-dt*(L.v<car.v?6:2.5)));
  let err=(sG-car.s)*dir;          /* + = GPS ahead of the car */
  if(Math.abs(err)>40){car.s=sG;err=0;car.cv=0;}
  const wa=2.0;car.cv+=(wa*wa*err-2*wa*car.cv)*dt;
  let ds=(car.v+car.cv)*dt;if(ds<0&&err>-4) ds=0;
  if(L.v<0.3&&err<0) ds=0;          /* stopped: never roll back */
  car.s+=dir*ds;
  /* lane: smoothed GPS across the road, centred in its lane, with hysteresis */
  const W=TN.width(w),gl=TN.latOf(h,L.x,L.z);
  car.gl=car.gl==null?gl:car.gl+(gl-car.gl)*(1-Math.exp(-dt/1.5));
  const lanes=this.lanesOf(w);
  let target;
  if(lanes){
    const nearest=v=>{let b=0;for(let k=1;k<lanes.length;k++) if(Math.abs(v-lanes[k])<Math.abs(v-lanes[b])) b=k;return b;};
    const want=nearest(car.gl);
    if(this.lane.idx==null||this.lane.idx>=lanes.length) this.lane.idx=nearest(car.lat);
    if(want!==this.lane.idx){
      const lw=lanes.length>1?Math.abs(lanes[1]-lanes[0]):3.4;
      /* change lane only when clearly inside the other lane, for over a second */
      if(Math.abs(car.gl-lanes[want])<lw*0.35){if(!this.lane.t) this.lane.t=now;if(now-this.lane.t>1200){this.lane.idx=want;this.lane.t=0;}}
      else this.lane.t=0;
    }else this.lane.t=0;
    target=lanes[this.lane.idx];
  }else{
    /* two-way streets: stay in the right half, near the middle of it (not on the centre line) */
    const lo=w.ow?-(W/2-1.2):Math.max(1.2,W/4-0.5),hi=Math.max(lo,W/2-1.0);
    target=Math.max(lo,Math.min(hi,car.gl));
  }
  car.lat+=(target-car.lat)*(1-Math.exp(-dt/(Math.abs(target-car.lat)>3?0.35:0.9)));
  const p=this.pointOn(w,car.s,car.lat,dir);
  car.hd=(car.hd+TN.angDiff2(p.hd,car.hd)*Math.min(1,dt*8)+360)%360;
  /* corners of the road drawing (and turns from one road piece onto another) are rounded: the shown car follows
     the road point fully along its direction, and smoothly (about 0.2 s) sideways */
  if(car.x==null||dt===0){car.x=p.x;car.z=p.z;}
  else{
    const ex=p.x-car.x,ez=p.z-car.z,hr=car.hd*TN.R,fx=Math.sin(hr),fz=-Math.cos(hr);
    const al=ex*fx+ez*fz,sd=ex*(-fz)+ez*fx,k=1-Math.exp(-dt/0.2);
    if(Math.hypot(ex,ez)>15){car.x=p.x;car.z=p.z;}
    else{car.x+=fx*al+(-fz)*sd*k;car.z+=fz*al+fx*sd*k;}
  }
  const yT=TN.heightAt(w,car.s);
  car.y+=(yT-car.y)*Math.min(1,dt*8);
  car.snapped=true;car.offT=0;car.cls=w.cls;car.br=w.br;car.wid=w.id;
  this.car=car;
  return car;
};
TN.angDiff2=(a,b)=>((a-b+540)%360)-180;
if(typeof module!=='undefined') module.exports=TN;
