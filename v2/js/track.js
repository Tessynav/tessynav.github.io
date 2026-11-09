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
    /* is that estimate consistent? it should move at the speed the car reports (Tesla keeps it going from the wheels
       in a tunnel); a consistent estimate is trusted for as long as it stays consistent, however long the tunnel or the
       traffic jam in it, until a precise GPS fix comes back (it was 30 s, then 5 minutes: in the Ville-Marie tunnel
       after 30 s the car was left behind and crept to a stop, then jumped 550 m when the GPS came back) */
    if(this.rp&&speed!=null){const dt=(t-this.rp.t)/1000,d=Math.hypot(x-this.rp.x,z-this.rp.z),exp=speed*dt;
      if(dt>0.05&&dt<6) this.rpOk=Math.abs(d-exp)<Math.max(6,exp*0.45)?(this.rpOk||0)+1:0;}
    this.rp={t:t,x:x,z:z};
    const lost=this.goodT?t-this.goodT:1e12,trust=lost<30000||(this.rpOk||0)>=3;
    if(!this.goodT||!trust||speed==null){this.rough={t:t,acc:acc};return this.last;}
    /* (trusted almost like a good fix for the first seconds: on a loop ramp under an overpass it follows the curve
       well, and the old 15 m made the car lag outside the loop; a little less after that, for long tunnels) */
    acc=lost<10000?4:lost<20000?8:12;
  }else{this.goodT=t;this.rp=null;this.rpOk=0;}
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
  const hPrev=this.hd,tPrev=this.hdT;
  let hNew=null;
  if(v>1.5) hNew=(Math.atan2(this.kf.x.v,-this.kf.z.v)/TN.R+360)%360;
  else if(heading!=null&&!isNaN(heading)&&sp>1) hNew=heading;
  /* reversing (parallel parking, backing out): at low speed the movement suddenly points the other way from the
     direction you were driving. The car keeps facing forward (otherwise it turned around on screen and, on a
     two-way street, was put in the left half, as if parked on the wrong side) */
  const spd=sp!=null?sp:v;
  if(hNew!=null){
    if(this.fwd!=null&&spd<3&&TN.angDiff(hNew,this.fwd)>135) this.rev=true;
    else if(this.fwd==null||TN.angDiff(hNew,this.fwd)<60||spd>=3) this.rev=false;
    if(!this.rev){this.hd=hNew;if(spd>1.5) this.fwd=hNew;}}
  /* how fast the direction is turning (degrees per second, smoothed): lets the car continue along the curve */
  this.hdT=t;
  if(hPrev!=null&&this.hd!=null&&tPrev&&t>tPrev&&v>1.5){const r=(((this.hd-hPrev+540)%360)-180)/((t-tPrev)/1000);
    this.hdRate=(this.hdRate||0)+(Math.max(-60,Math.min(60,r))-(this.hdRate||0))*0.5;}
  else if(v<=1.5) this.hdRate=0;
  this.last={t:t,x:fx,z:fz,v:sp!=null?sp:v,acc:acc||5,rx:x,rz:z,hd:this.rev?this.hd:(heading!=null&&!isNaN(heading))?heading:null,rev:!!this.rev};
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
  if(this.hd!=null&&L.v>2){
    const a=TN.angDiff(h.hd,this.hd);let he=a>8?((a-8)/20)*((a-8)/20):0;
    /* a road turning off at a junction just ahead: don't punish it for pointing another way before you turn */
    if(h.jx!=null&&Math.hypot(L.x-h.jx,L.z-h.jz)<25) he*=0.05;
    e+=he;
  }
  /* navigating: where a ramp splits off and runs alongside the main road (after the Champlain Bridge toward the
     A-10 loop, both share the same lanes for 100 m), the GPS can't tell them apart. The route can: a road whose next
     30-60 m leave the blue line costs more, so the car takes the route's branch right at the split instead of riding
     the main road first and then cutting over. (Only while the GPS itself is on the route: if you leave it, the GPS
     decides as before.) */
  if(TN.navActive&&TN.routeNear&&L.v>3){
    try{const g=TN.routeNear(L.x,L.z);
      if(g!=null&&g<12){const s=h.r.s!=null?h.r.s:0,d=Math.max(...[30,60].map(a=>{const p=this.pointOn(h.w,s+h.dir*a,0,h.dir);return TN.routeNear(p.x,p.z);}));
        if(d!=null&&d>2.5){const q=Math.min(2,(d-2.5)/3);e+=q*q;}}}catch(err){}
  }
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
        c.cost=h.cost+0.5;c.lastKey=key;c.parent=h;c.jx=w.pts[j][0];c.jz=w.pts[j][1];
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
  /* U-turns: at low speed, always keep a candidate for the same street in the other direction, so the car can turn
     around with you (otherwise only the current direction survives and the car slides backwards) */
  if(this.cur&&L.v<7){const c=this.cur;
    if(!next.some(h=>h.w===c.w&&h.dir===-c.dir)){
      const r=Object.assign({},c,{dir:-c.dir,cost:c.cost+6,parent:c,lastKey:null,born:L.t});r.hd=(c.hd+180)%360;
      r.r=TN.seg(c.w,c.i,L.x,L.z);next.push(r);}}
  for(const h of next){h.cost=h.cost*0.88+this.emit(h);}
  /* one hypothesis per road and direction (the cheaper one) */
  const by=new Map();
  for(const h of next){const k=h.w.id+':'+h.dir,b=by.get(k);if(!b||h.cost<b.cost) by.set(k,h);}
  let hs=[...by.values()].sort((a,b)=>a.cost-b.cost);
  const best=hs[0];
  const nearJ=h=>h.jx!=null&&Math.hypot(L.x-h.jx,L.z-h.jz)<30;
  /* in a tunnel the car's GPS is its own estimate, often 10 m or more off the tunnel's curves: tunnel roads stay
     candidates further from it */
  const tunHold=h=>h&&h.w.tun&&L.acc>4.5;
  hs=hs.filter(h=>(h.cost<best.cost+25||nearJ(h))&&h.r.d<(tunHold(h)?60:35)).slice(0,14);
  this.hyps=hs;
  /* keep the current road unless another clearly fits better for a while */
  const cur=this.cur&&hs.find(h=>h.w===this.cur.w&&h.dir===this.cur.dir);
  if(!cur){
    /* the current road piece just ended: prefer the piece that continues it (same street name, same direction)
       over a side street that happens to fit a little better for a moment */
    const prev=this.cur;let kid=null,ks=1e9;
    if(prev) for(const h of hs){if(h.parent!==prev) continue;
      const sc=(h.w.name&&h.w.name===prev.w.name?0:25)+TN.angDiff(h.hd,this.hd!=null?this.hd:prev.hd);
      if(sc<ks){ks=sc;kid=h;}}
    this.cur=(kid&&kid.cost<best.cost+6)?kid:best;
  }
  /* (in a tunnel, a street above it or beside it has to fit much better: the car stays in the tunnel) */
  else if(best!==cur&&best.cost<cur.cost-(tunHold(cur)&&!best.w.tun?14:2.5)){this.cur=best;}
  else this.cur=cur;
  /* turning at a junction: once the driving direction clearly leaves the current road and another road nearby
     matches it, follow that road right away (no driving on past the corner, then jumping) */
  if(this.cur&&this.hd!=null&&L.v>2&&TN.angDiff(this.cur.hd,this.hd)>35&&!tunHold(this.cur)){
    let alt=null;
    for(const h of hs){if(h===this.cur) continue;const a=TN.angDiff(h.hd,this.hd);
      if(a<25&&(h.side!=null?h.side:h.r.d)<TN.width(h.w)/2+6&&(!alt||a<TN.angDiff(alt.hd,this.hd))) alt=h;}
    if(alt) this.cur=alt;
  }
  /* lost: every road is far away -> look again around the GPS */
  if(!this.cur||this.cur.r.d>TN.width(this.cur.w)/2+(tunHold(this.cur)?40:12)){
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
/* is there another highway branch alongside, going the same way (within 30 m of the GPS)? checked once a second */
TN.Track.prototype.besideBranch=function(w,L){
  const now=L.t||0;if(this._bb&&this._bb.w===w&&now-this._bb.t<1000) return this._bb.v;
  let v=false;const bw=(()=>{const P=w.pts;let best=1e9,b=0;for(let i=0;i<P.length-1;i++){const a=P[i],c=P[i+1],d=Math.hypot((a[0]+c[0])/2-L.x,(a[1]+c[1])/2-L.z);if(d<best){best=d;b=Math.atan2(c[0]-a[0],-(c[1]-a[1]));}}return b;})();
  if(this.net&&this.net.near) this.net.near(L.x,L.z,30,(o,i)=>{if(o===w||!o.ow||!/^(motorway|trunk)/.test(o.cls||'')) return;const a=o.pts[i],c=o.pts[i+1];if(!a||!c) return;
    const ob=Math.atan2(c[0]-a[0],-(c[1]-a[1])),dd=Math.abs(((ob-bw)*180/Math.PI+540)%360-180);if(dd<20){v=true;return true;}});
  this._bb={w:w,t:now,v:v};return v;
};
/* a split at the end of this road piece, within D metres ahead: which sides its branches go off to (-1 / +1, the
   same sideways sign the car's lane uses), or null */
TN.Track.prototype.splitAhead=function(w,dir,s,D){
  const rem=dir>0?w.L-s:s;if(rem>D||rem<-5) return null;
  const key=(this._spk=this._spk||new Map()),ck=w.id+':'+dir;if(key.has(ck)) return key.get(ck);
  const endI=dir>0?w.pts.length-1:0,endKey=w.keys[endI],segI=dir>0?w.pts.length-2:0;let n=0;const sides=new Set();
  for(const [v,vi] of (this.net.keys.get(endKey)||[])){if(v===w||v.tun) continue;
    for(const sd of [1,-1]){if(!((sd>0&&vi===0)||(sd<0&&vi===v.pts.length-1))) continue;if(v.ow===1&&sd<0||v.ow===-1&&sd>0) continue;
      n++;const q=this.pointOn(v,sd>0?Math.min(v.L,40):Math.max(0,v.L-40),0,sd),r=TN.seg(w,segI,q.x,q.z),lat=r.lat*dir;
      if(Math.abs(lat)>2) sides.add(Math.sign(lat));}}
  const out=n>=2&&sides.size?sides:null;key.set(ck,out);if(key.size>400) key.clear();return out;
};
/* the height of the road under a point (the matched road first, else the nearest road piece within its width);
   null when there's none */
TN.Track.prototype.heightNear=function(x,z,h,y0){
  if(h&&h.w&&!h.w.tun){let bj=-1,bd=1e9;const w=h.w,lo=Math.max(0,(h.i||0)-6),hi=Math.min(w.pts.length-2,(h.i||0)+6);
    for(let j=lo;j<=hi;j++){const r=TN.seg(w,j,x,z);if(r.d<bd){bd=r.d;bj=j;}}
    if(bj>=0&&bd<=TN.width(w)/2+3) return TN.heightAt(w,TN.seg(w,bj,x,z).s);}
  let best=null,bd2=1e9;if(this.net&&this.net.near) this.net.near(x,z,10,(v,k)=>{if(v.tun) return;const r=TN.seg(v,k,x,z);if(r.d>=TN.width(v)/2+2) return;const hh=TN.heightAt(v,r.s),sc=r.d+Math.abs(hh-(y0||0))*2;if(sc<bd2){bd2=sc;best=hh;}});
  /* (of the roads there, the one nearest the car's current height: never a bridge overhead or a road below) */
  return best;
};
TN.Track.prototype.frame=function(now,dt){
  const L=this.last;if(!L) return null;
  /* (a quiet GPS, e.g. in a tunnel, keeps the car moving along its road at the last speed, as before) */
  /* parked in a parking space: after 2 s stopped, the car settles between the painted lines of the nearest space */
  if(L.v<0.5){if(!this.stopT) this.stopT=now;}else{this.stopT=0;this.stall=null;}
  if(this.stopT&&now-this.stopT>2000&&this.net.stallNear){
    if(!this.stall||now-(this.stallT||0)>3000){this.stall=this.net.stallNear(L.x,L.z,this.car&&this.car.hd!=null?this.car.hd:(this.hd||0));this.stallT=now;}
    const S=this.stall,c=this.car;
    if(S&&c&&c.x!=null){
      const k=1-Math.exp(-dt*2.5);c.x+=(S.x-c.x)*k;c.z+=(S.z-c.z)*k;
      c.hd=(c.hd+TN.angDiff2(S.hd,c.hd)*Math.min(1,dt*2.5)+360)%360;c.v=0;c.w=null;c.snapped=true;
      return c;
    }
  }
  const h=this.cur;
  const age=Math.min(1,Math.max(0,(now-L.t)/1000));
  /* in a tunnel (the car's own GPS estimate, a few metres to 10+ m off on the curves) the car stays on the tunnel
     road and follows its curves, instead of leaving it to follow the estimate (the Ville-Marie curve: the car swung
     between the road and the GPS, its heading jumping 40 degrees) */
  const inTun=!!h&&h.w.tun&&L.acc>4.5;
  const snapped=!!h&&(h.side!=null?h.side:h.r.d)<=TN.width(h.w)/2+(inTun?30:6);
  let car=this.car;
  /* turning at an intersection: when the car is near a junction and its real direction (filtered GPS) differs
     from the street's by more than 15 degrees, follow the actual path through the corner instead of the street;
     back on the new street, it settles onto it with the usual glide */
  let turning=false;
  if(snapped&&L.v>1.5&&this.hd!=null&&!inTun){
    const w0=h.w,dEnd=h.dir>0?w0.L-h.r.s:h.r.s,dBack=h.dir>0?h.r.s:w0.L-h.r.s;
    const deg=k=>(this.net.keys.get(k)||[]).length;
    const endK=h.dir>0?w0.keys[w0.keys.length-1]:w0.keys[0],backK=h.dir>0?w0.keys[0]:w0.keys[w0.keys.length-1];
    const nearJ=(dEnd<30&&deg(endK)>1)||(dBack<30&&deg(backK)>1);
    const off=TN.angDiff(this.hd,h.hd);
    turning=nearJ&&(off>15||(this.turnMode&&off>8));
  }
  this.wasTurning=this.turnMode;this.turnMode=turning;
  if(!turning) this.turnOff=null;
  if(turning){
    /* follow the curve: from the last reading, keep turning at the current rate (an arc), not a straight line */
    const rate=this.hdRate||0,a1=Math.min(age,1.2),hdNow=this.hd+rate*a1;
    let tx=L.x,tz=L.z;const n=6;for(let i=0;i<n;i++){const hh=(this.hd+rate*a1*(i+0.5)/n)*TN.R;tx+=Math.sin(hh)*L.v*a1/n;tz-=Math.cos(hh)*L.v*a1/n;}
    const hd=(hdNow+360)%360;
    /* entering turn mode: keep the car where it was drawn (its lane) and let that offset fade over ~2 s,
       instead of jumping to the raw GPS position */
    if(!this.wasTurning&&car&&car.x!=null&&Math.hypot(car.x-tx,car.z-tz)<15) this.turnOff=[car.x-tx,car.z-tz];
    if(!this.turnOff) this.turnOff=[0,0];
    const dec=Math.exp(-dt*0.7);this.turnOff[0]*=dec;this.turnOff[1]*=dec;tx+=this.turnOff[0];tz+=this.turnOff[1];
    if(!car||car.x==null||Math.hypot(car.x-tx,car.z-tz)>30) car={x:tx,z:tz,hd:hd,v:L.v,y:car?car.y:0};
    else car={x:car.x,z:car.z,hd:car.hd,v:L.v,y:car.y||0};
    const k=1-Math.exp(-dt*3);car.x+=(tx-car.x)*k;car.z+=(tz-car.z)*k;
    car.hd=(car.hd+TN.angDiff2(hd,car.hd)*Math.min(1,dt*4)+360)%360;
    /* height while turning: the road the car is going onto (on a ramp coming down off a bridge the height was held,
       then dropped in steps when the car got back on a road piece) */
    {const yT=this.heightNear(car.x,car.z,h,car.y);if(yT!=null) car.y+=(yT-car.y)*Math.min(1,dt*4);}
    car.w=null;car.snapped=true;car.turning=true;car.cls=h.w.cls;this.car=car;return car;
  }
  if(!snapped){
    /* off the road network (parking lot, missing road): follow the filtered GPS smoothly */
    const hd=this.hd!=null?this.hd:(car?car.hd:0);
    const tx=L.x+Math.sin(hd*TN.R)*L.v*age,tz=L.z-Math.cos(hd*TN.R)*L.v*age;
    if(!car||Math.hypot(car.x-tx,car.z-tz)>30) car={x:tx,z:tz,hd:hd,v:L.v,y:0};
    const k=1-Math.exp(-dt*4);car.x+=(tx-car.x)*k;car.z+=(tz-car.z)*k;
    car.hd=(car.hd+TN.angDiff2(hd,car.hd)*Math.min(1,dt*3)+360)%360;
    /* off the network: keep the height a few seconds (short gaps at junctions on overpasses), then go down */
    if(!car.offT) car.offT=now;
    {const yT=this.heightNear(car.x,car.z,h,car.y);
     if(yT!=null) car.y+=(yT-car.y)*Math.min(1,dt*4);
     else if(now-car.offT>3000) car.y+=(0-car.y)*Math.min(1,dt*2);}
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
    car={w:w,dir:dir,s:s0,lat:lat0,v:car?car.v:L.v,cv:car&&car.cv||0,x:car?car.x:null,z:car?car.z:null,hd:car?car.hd:h.hd,y:car?car.y:0,gl:lat0,
      ease:{lat0:lat0,s0:s0,len:car&&car.hd!=null&&TN.angDiff(car.hd,h.hd)>45?12:Math.max(35,(L.v||0)*3)}};   /* (about 3 s of driving: at 90 km/h a switch is a lane change, not a 13-degree swerve) */
    this.lane.idx=null;
  }
  /* the car reached the end of its road piece before the matching moved on: continue on the best connected piece */
  if((dir>0&&car.s>w.L)||(dir<0&&car.s<0)){
    const endKey=dir>0?w.keys[w.keys.length-1]:w.keys[0];
    let nx=null;
    /* prefer the piece that continues the street (same name, about the same direction) over a side street */
    let nb=1e9;
    for(const o of this.hyps){if(o.w===w) continue;const k0=o.dir>0?o.w.keys[0]:o.w.keys[o.w.keys.length-1];
      if(k0!==endKey) continue;
      const sc=o.cost+(o.w.name&&o.w.name===w.name?0:4)+TN.angDiff(o.hd,car.hd!=null?car.hd:o.hd)/25;
      if(sc<nb){nb=sc;nx=o;}}
    if(nx){
      const over=dir>0?car.s-w.L:-car.s;
      const ns=nx.dir>0?over:nx.w.L-over;
      /* with "Follow my lane" the car is off-centre: on the new road piece its sideways place is measured from that
         piece's own centre line (not carried over as a number from the old one, which could land on the edge when
         the pieces have different widths or centre lines), and kept at least 1 m inside the edge */
      let lat0=car.lat;
      if(car.laneK!=null&&car.x!=null){const c0=this.pointOn(nx.w,ns,0,nx.dir),c1=this.pointOn(nx.w,ns,1,nx.dir);
        const rx=c1.x-c0.x,rz=c1.z-c0.z,Wn=TN.width(nx.w);lat0=(car.x-c0.x)*rx+(car.z-c0.z)*rz;
        const lim=Math.max(0,Wn/2-1.0);lat0=Math.max(-lim,Math.min(lim,lat0));}
      const nc={w:nx.w,dir:nx.dir,s:ns,lat:lat0,v:car.v,cv:car.cv,x:car.x,z:car.z,hd:car.hd,y:car.y,gl:car.gl,ease:{lat0:lat0,s0:ns},
        laneK:car.laneK,laneW:car.laneW,laneN:car.laneN,laneT:car.laneT};
      this.cur=nx;car=nc;this.car=car;
      /* (at most a few road pieces at once, never an endless loop) */
      this.depth=(this.depth||0)+1;
      const res=this.depth<6?this.frame(now,0):car;
      this.depth=0;
      return res;
    }
  }
  /* along the road: own speed, softly corrected toward the GPS (no running past, no rolling back) */
  const lv=L.rev?-L.v:L.v;          /* (backwards while reversing) */
  car.v+=(lv-car.v)*(1-Math.exp(-dt*(lv<car.v?6:2.5)));
  let err=(sG-car.s)*dir;          /* + = GPS ahead of the car */
  if(Math.abs(err)>40){car.s=sG;err=0;car.cv=0;}
  const wa=2.0;car.cv+=(wa*wa*err-2*wa*car.cv)*dt;
  let ds=(car.v+car.cv)*dt;if(ds<0&&err>-4&&!L.rev) ds=0;
  if(L.v<0.3&&err<0) ds=0;          /* stopped: never roll back */
  car.s+=dir*ds;
  /* lane: smoothed GPS across the road, centred in its lane, with hysteresis */
  const W=TN.width(w),gl=TN.latOf(h,L.x,L.z);
  car.gl=car.gl==null?gl:car.gl+(gl-car.gl)*(1-Math.exp(-dt/1.5));
  /* like Codriver: no lane guessing (the GPS can't tell lanes apart). One-way roads and highways: the car rides in
     the middle of its carriageway. Two-way streets: in the middle of the right half. Steady, no lane jumps. */
  let target=w.ow?0:Math.max(1.2,W/4);
  /* optional (Settings -> Follow my lane on wide roads, off by default): on one-way roads with 3 lanes or more, the
     car takes the lane the GPS has clearly been in, whole lanes only, changing after 2 s near another lane's centre.
     Closer to your real lane on wide highways and bridges, but it moves sideways more than the steady middle. */
  if(TN.settings&&TN.settings.wideLanes&&w.ow&&W>=9.5&&L.v>4){
    const n=Math.max(3,Math.round(W/3.5)),lw=W/n,cen=k=>-W/2+lw*(k+0.5);
    const cand=Math.max(0,Math.min(n-1,Math.round((car.gl+W/2)/lw-0.5)));
    if(car.laneK==null||car.laneK>=n||car.laneW!==w.id&&Math.abs((car.laneN||n)-n)>0){car.laneK=cand;car.laneT=0;}
    else if(cand!==car.laneK&&Math.abs(car.gl-cen(cand))<lw*0.4&&(L.acc||5)<10){car.laneT=(car.laneT||0)+dt;if(car.laneT>2){car.laneK=cand;car.laneT=0;}}
    else car.laneT=0;
    car.laneW=w.id;car.laneN=n;target=Math.max(-(W/2-1.0),Math.min(W/2-1.0,cen(car.laneK)));
  }else{car.laneK=null;}
  /* splits and long merges on highways (the A-10 toward DIX30): two branches separate slowly and you drive between their
     centrelines. When the precise GPS stays clearly beside the centreline at speed, the car follows it sideways, up to
     3 m past the road's edge, instead of riding a branch's centreline 7 m away from you. City streets stay steady. */
  /* (only without a route, and only at a real split: another highway branch alongside, going the same way. With a route,
     the car stays on the blue line, which already follows the right branch: on the Champlain Bridge, following the lane
     put the car beside the line) */
  if(car.laneK==null&&!TN.navActive&&w.ow&&/^(motorway|trunk)/.test(w.cls||'')&&L.v>12&&(L.acc||9)<=6&&Math.abs(car.gl)>W/2*0.75&&this.besideBranch(w,L)){
    const lim=W/2+3;target=Math.sign(car.gl)*Math.min(Math.abs(car.gl),lim);}
  /* splits drawn late (all roads, without a route): the map often puts the split at the end of the painted gore,
     100-150 m after the lanes really part (the Taschereau exit off the A-10). When a split is coming up within 180 m
     and the precise GPS is clearly over on the side of one of its branches, the car moves over with you (up to 8 m past
     the road's edge), so it's already beside the branch when the map splits, instead of riding the middle */
  {const sp=car.laneK==null&&!TN.navActive&&(L.acc||9)<=6&&L.v>3?this.splitAhead(w,dir,car.s,180):null;
   car.gf=car.gf==null?gl:car.gf+(gl-car.gf)*(1-Math.exp(-dt/0.5));
   if(sp&&sp.has(Math.sign(car.gf))&&Math.abs(car.gf)>Math.max(2,W/4)){const lim=W/2+8;target=Math.sign(car.gf)*Math.min(Math.abs(car.gf),lim);}}
  if(car.ease&&car.ease.lat0!=null&&Math.abs(car.ease.lat0)>W/2+3) car.ease.lat0=Math.sign(car.ease.lat0)*(W/2+3);
  if(car.ease){
    /* after moving onto another road piece (a split, a merge, a turn), the car glides to its new place over the
       next 35 m of driving, like steering, instead of sliding sideways on the spot */
    const u=Math.min(1,Math.abs(car.s-car.ease.s0)/(car.ease.len||35)),k=u*u*(3-2*u);
    car.lat=car.ease.lat0+(target-car.ease.lat0)*k;
    if(u>=1) car.ease=null;
  }else car.lat+=(target-car.lat)*(1-Math.exp(-dt/0.9));
  const p=this.pointOn(w,car.s,car.lat,dir);
  car.hd=(car.hd+TN.angDiff2(p.hd,car.hd)*Math.min(1,dt*8)*(1-(car.mw||0))+360)%360;   /* (no pull from the street during a manoeuvre) */
  /* corners of the road drawing (and turns from one road piece onto another) are rounded: the shown car follows
     the road point fully along its direction, and smoothly (about 0.2 s) sideways */
  if(car.x==null||dt===0){car.x=p.x;car.z=p.z;}
  else{
    const ex=p.x-car.x,ez=p.z-car.z,hr=car.hd*TN.R,fx=Math.sin(hr),fz=-Math.cos(hr);
    const al=ex*fx+ez*fz,sd=ex*(-fz)+ez*fx,k=1-Math.exp(-dt/0.2);
    if(Math.hypot(ex,ez)>15){car.x=p.x;car.z=p.z;}
    else{car.x+=fx*al+(-fz)*sd*k;car.z+=fz*al+fx*sd*k;}
  }
  /* slow manoeuvres (a U-turn, a three-point turn, turning into a driveway): when the GPS direction clearly leaves the
     street's direction at walking-to-city speed, the car turns with you and follows your real position, blended in
     smoothly; it goes back to the street once you drive along it again */
  {const L2=this.last,gh=this.hd;let mw=0;
   if(L2&&gh!=null&&L2.v>0.8&&L2.v<5&&now-L2.t<2500){const a=TN.angDiff(gh,p.hd);mw=Math.max(0,Math.min(1,(a-30)/30));}
   else if(L2&&L2.v<=0.8) mw=car.mw||0;   /* (stopped halfway through: stay as it is) */
   car.mw=(car.mw||0)+(mw-(car.mw||0))*Math.min(1,dt*(mw>(car.mw||0)?3:1.5));
   if(car.mw>0.01){const m=car.mw;car.hd=(car.hd+TN.angDiff2(gh!=null?gh:car.hd,car.hd)*Math.min(1,dt*4)*m+360)%360;
     car.x+=(L2.x-car.x)*Math.min(1,dt*3)*m;car.z+=(L2.z-car.z)*Math.min(1,dt*3)*m;}}
  const yT=TN.heightAt(w,car.s);
  car.y+=(yT-car.y)*Math.min(1,dt*8);
  car.snapped=true;car.offT=0;car.cls=w.cls;car.br=w.br;car.wid=w.id;
  this.car=car;
  return car;
};
TN.angDiff2=(a,b)=>((a-b+540)%360)-180;
if(typeof module!=='undefined') module.exports=TN;
