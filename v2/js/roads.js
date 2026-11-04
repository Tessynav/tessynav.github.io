/* TessyNav v2 — roads.js
   One road network for everything: drawing, the car's road matching and the car's height all use the same data
   (our own road tiles, from OpenStreetMap). No map-tile roads, no patches.
   - TN.net: roads and bridges with their real width/lanes, joined at every shared point (junctions)
   - heights: bridges at their height, the roads leading onto them rise smoothly, side-by-side lanes rise together
   - meshes: each road area (0.005 deg) is built once as plain geometry arrays (scene.js turns them into 3D) */
var TN=globalThis.TN||{};globalThis.TN=TN;

TN.R=Math.PI/180;
/* local meters (x east, z south) around a fixed origin, with the same projection as the map */
TN.ORIGIN=[-73.568,45.459];
TN.mercX=lng=>(180+lng)/360;
TN.mercY=lat=>(180-(180/Math.PI)*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360)))/360;
TN.OMX=TN.mercX(TN.ORIGIN[0]);TN.OMY=TN.mercY(TN.ORIGIN[1]);
TN.OMS=1/(2*Math.PI*6371008.8*Math.cos(TN.ORIGIN[1]*Math.PI/180));
TN.toLocal=(lng,lat)=>[(TN.mercX(lng)-TN.OMX)/TN.OMS,(TN.mercY(lat)-TN.OMY)/TN.OMS];
TN.fromLocal=(x,z)=>{const mx=TN.OMX+x*TN.OMS,my=TN.OMY+z*TN.OMS;return [mx*360-180,360/Math.PI*Math.atan(Math.exp((180-my*360)*Math.PI/180))-90];};
TN.CELL=0.005;
TN.ROAD_W1={motorway:10.5,trunk:9.5,primary:8,secondary:7.5,tertiary:6.5,minor:5.5,service:4};
TN.ROAD_W2={motorway:11,trunk:10,primary:13,secondary:12,tertiary:11,minor:9.5,service:5.5};
/* Codriver-like palette: dark asphalt, light concrete edges, crisp bright markings */
TN.COL={road:'#45494f',curb:'#9a9ea3',white:'#f4f4f2',yellow:'#efc23a',side:'#a7abb0',barrier:'#c9ccd0',pier:'#b0b4b8'};

/* ---------------- network ---------------- */
TN.Net=function(){
  this.ways=new Map();      /* id -> way */
  this.packs=new Map();     /* pack key -> {ids:Set, bids:Set} */
  this.keys=new Map();      /* vertex key "lng,lat" -> [[way, vertex index], ...] */
  this.idx=new Map();       /* 100 m cell -> [ways] */
  this.ver=0;
};
TN.vkey=function(lng,lat){return lng.toFixed(6)+','+lat.toFixed(6);};
TN.Net.prototype.makeWay=function(r,isBridge){
  const flat=r[8],pts=[],keys=[];
  for(let i=0;i<flat.length;i+=2){pts.push(TN.toLocal(flat[i],flat[i+1]));keys.push(TN.vkey(flat[i],flat[i+1]));}
  if(pts.length<2) return null;
  const cum=[0];for(let i=1;i<pts.length;i++) cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  const w={id:r[0],cls:r[1],ow:r[2]||0,w:r[3]||7,lanes:r[7]||0,name:r[4]||'',pts:pts,keys:keys,cum:cum,L:cum[cum.length-1],
    br:false,tun:false,layer:0,H:0,hs:null};
  if(isBridge){w.layer=r[9]||0;w.ramp=!!r[10];if(r[12]==='t') w.tun=true;else w.br=true;}
  else w.ramp=!!r[9];
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const p of pts){if(p[0]<x0)x0=p[0];if(p[0]>x1)x1=p[0];if(p[1]<z0)z0=p[1];if(p[1]>z1)z1=p[1];}
  const pad=w.w/2+3;w.bb=[x0-pad,x1+pad,z0-pad,z1+pad];
  return w;
};
/* add one road pack (returns true if something new was added) */
TN.Net.prototype.addPack=function(key,P,later){
  if(this.packs.has(key)) return false;
  const rec={ids:new Set()};
  for(const r of P.w||[]){rec.ids.add(r[0]);if(!this.ways.has(r[0])){const w=this.makeWay(r,false);if(w) this.ways.set(w.id,w);}}
  for(const r of P.b||[]){
    if(r[1]==='rail'||r[1]==='transit') continue;
    rec.ids.add(r[0]);if(!this.ways.has(r[0])){const w=this.makeWay(r,true);if(w) this.ways.set(w.id,w);}
  }
  this.packs.set(key,rec);
  if(!later) this.rebuildIndex();
  return true;
};
TN.Net.prototype.dropPack=function(key,later){
  const rec=this.packs.get(key);if(!rec) return;
  this.packs.delete(key);
  const keep=new Set();for(const r of this.packs.values()) for(const id of r.ids) keep.add(id);
  for(const id of rec.ids) if(!keep.has(id)) this.ways.delete(id);
  if(!later) this.rebuildIndex();
};
/* the network is rebuilt in small steps (a few ms per frame) so driving never freezes; the new index and heights
   take effect all at once when ready. rebuildIndex() runs it to the end in one go (tests). */
TN.Net.prototype.rebuildJob=function*(){
  const keys=new Map(),idx=new Map();let n=0;
  for(const w of this.ways.values()){
    for(let i=0;i<w.keys.length;i++){let l=keys.get(w.keys[i]);if(!l){l=[];keys.set(w.keys[i],l);}l.push([w,i]);}
    for(let gx=Math.floor(w.bb[0]/100);gx<=Math.floor(w.bb[1]/100);gx++)
      for(let gz=Math.floor(w.bb[2]/100);gz<=Math.floor(w.bb[3]/100);gz++){
        const k=gx*1e6+gz;let l=idx.get(k);if(!l){l=[];idx.set(k,l);}l.push(w);
      }
    if(++n%250===0) yield;
  }
  this.keys=keys;this.idx=idx;
  yield* this.heights();
  for(const w of this.ways.values()){w.br=w._br;w.H=w._H||0;w.W=w._W;w.hs=w._hs;}
  this.ver++;
};
TN.Net.prototype.rebuildIndex=function(){const j=this.rebuildJob();while(!j.next().done);};
TN.Net.prototype.startRebuild=function(){this.job=this.rebuildJob();};
TN.Net.prototype.step=function(ms){
  if(!this.job) return false;
  const t0=Date.now();
  while(Date.now()-t0<ms){if(this.job.next().done){this.job=null;return true;}}
  return false;
};
/* road pieces near a point: fn(way, segment index) */
TN.Net.prototype.near=function(x,z,pad,fn){
  const l=this.idx.get(Math.floor(x/100)*1e6+Math.floor(z/100));if(!l) return;
  for(const w of l){
    const b=w.bb;if(x<b[0]-pad||x>b[1]+pad||z<b[2]-pad||z>b[3]+pad) continue;
    const P=w.pts,pd=w.w/2+pad;
    for(let i=0;i<P.length-1;i++){
      const a=P[i],c=P[i+1];
      if(x<Math.min(a[0],c[0])-pd||x>Math.max(a[0],c[0])+pd||z<Math.min(a[1],c[1])-pd||z>Math.max(a[1],c[1])+pd) continue;
      if(fn(w,i)===true) return;
    }
  }
};
/* closest point of segment i of way w to (x,z) */
TN.seg=function(w,i,x,z){
  const a=w.pts[i],b=w.pts[i+1],dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz;
  if(l2<1e-4) return {u:0,d:Math.hypot(x-a[0],z-a[1]),qx:a[0],qz:a[1],tx:1,tz:0,s:w.cum[i],lat:0};
  const l=Math.sqrt(l2),ur=((x-a[0])*dx+(z-a[1])*dz)/l2,u=Math.max(0,Math.min(1,ur));
  const qx=a[0]+dx*u,qz=a[1]+dz*u,tx=dx/l,tz=dz/l;
  /* lateral: + = right of the drawing direction */
  const lat=(x-qx)*(-tz)+(z-qz)*tx;
  return {u:u,ur:ur,d:Math.hypot(x-qx,z-qz),qx:qx,qz:qz,tx:tx,tz:tz,s:w.cum[i]+l*u,lat:lat};
};
/* height of way w at distance s along it */
TN.heightAt=function(w,s){
  if(w.br) return w.H;
  if(!w.hs) return 0;
  const c=w.cum;let i=0;
  if(s<=0) return w.hs[0];if(s>=w.L) return w.hs[w.hs.length-1];
  let lo=0,hi=c.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(c[m]<=s) lo=m;else hi=m;}i=lo;
  const seg=c[i+1]-c[i]||1;return w.hs[i]+(w.hs[i+1]-w.hs[i])*(s-c[i])/seg;
};
TN.width=function(w){return w.br?(w.W||w.w):w.w;};

/* ---------------- heights ---------------- */
TN.smooth=function(t){t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
TN.rampLen=function(H){return Math.max(60,Math.min(350,H*20));};
TN.Net.prototype.crossesSomething=function(b){
  for(let s=8;s<b.L-8;s+=6){
    let i=0;while(i<b.pts.length-2&&b.cum[i+1]<s) i++;
    const sg=b.cum[i+1]-b.cum[i]||1,t=(s-b.cum[i])/sg;
    const x=b.pts[i][0]+(b.pts[i+1][0]-b.pts[i][0])*t,z=b.pts[i][1]+(b.pts[i+1][1]-b.pts[i][1])*t;
    let hit=false;
    this.near(x,z,0,(w,k)=>{
      if(w===b||w._br||w.tun) return;
      const r=TN.seg(w,k,x,z);
      if(r.d<w.w/2&&Math.abs(r.tx*(b.pts[i+1][0]-b.pts[i][0])/sg+r.tz*(b.pts[i+1][1]-b.pts[i][1])/sg)<0.9){hit=true;return true;}
    });
    if(hit) return true;
  }
  return false;
};
TN.Net.prototype.heights=function*(){
  const ways=[...this.ways.values()];
  for(const w of ways){if(w.brSrc===undefined) w.brSrc=w.br;w._br=w.brSrc;w._hs=null;w._H=0;w._W=w.w;}
  const brs=ways.filter(w=>w._br);
  /* 1. whole bridges (pieces sharing end points), one height each */
  const parent=new Map();for(const b of brs) parent.set(b,b);
  const find=a=>{while(parent.get(a)!==a){parent.set(a,parent.get(parent.get(a)));a=parent.get(a);}return a;};
  const ends=new Map();
  for(const b of brs) for(const k of [b.keys[0],b.keys[b.keys.length-1]]){
    const l=ends.get(k);if(l) for(const o of l) parent.set(find(o),find(b));
    if(l) l.push(b);else ends.set(k,[b]);
  }
  const groups=new Map();
  let nb=0;
  for(const b of brs){
    const r=find(b);let g=groups.get(r);if(!g){g={L:0,cross:false,layer:0,W:0};groups.set(r,g);}
    g.L+=b.L;g.layer=Math.max(g.layer,b.layer);g.W=Math.max(g.W,b.w);
    if(!g.cross&&this.crossesSomething(b)) g.cross=true;
    if(++nb%10===0) yield;
  }
  const keyH=new Map();
  for(const b of brs){
    const g=groups.get(find(b));let H;
    if(g.cross) H=Math.max(6.5*Math.max(1,g.layer),g.L>400?15:0);
    else if(g.L>=120) H=g.L>400?15:5;
    else H=0;
    b._H=H;b._W=Math.max(b.w,g.W);
    /* a small bridge that crosses nothing is treated as normal road (it takes the height of the roads around it) */
    if(H===0) b._br=false;
    /* only bridge points that a ground road also uses (where the approach roads attach) */
    if(H>0) for(const k of b.keys){
      const l=this.keys.get(k);if(!l||!l.some(e=>!e[0]._br)) continue;
      keyH.set(k,Math.max(keyH.get(k)||0,H));
    }
  }
  let gnd=ways.filter(w=>!w._br);
  /* 2. ramps: from every raised point, ground roads rise toward it (searched along the network, up to the ramp length) */
  const val=(H,d)=>H*TN.smooth(1-d/TN.rampLen(H));
  const best=new Map(); /* way id -> per-vertex height */
  const setH=(w,i,h)=>{let a=best.get(w);if(!a){a=new Float64Array(w.pts.length);best.set(w,a);}if(h>a[i]) a[i]=h;};
  /* the climb follows the road that CONTINUES the bridge (same general direction), not the cross streets at the
     intersection where a bridge ends: those stay at street level */
  const unit=(ax,az)=>{const l=Math.hypot(ax,az)||1;return [ax/l,az/l];};
  const srcDir=new Map();
  for(const b of brs){
    if(!(b._H>0)) continue;const n=b.pts.length;
    srcDir.set(b.keys[0],unit(b.pts[0][0]-b.pts[1][0],b.pts[0][1]-b.pts[1][1]));
    srcDir.set(b.keys[n-1],unit(b.pts[n-1][0]-b.pts[n-2][0],b.pts[n-1][1]-b.pts[n-2][1]));
  }
  let ns=0;
  for(const [k0,H] of keyH){
    if(++ns%15===0) yield;
    const R=TN.rampLen(H),dist=new Map([[k0,0]]),q=[[k0,0,srcDir.get(k0)||null]];
    while(q.length){
      let bi=0;for(let j=1;j<q.length;j++) if(q[j][1]<q[bi][1]) bi=j;
      const [k,d,dv]=q.splice(bi,1)[0];
      if(d>dist.get(k)) continue;
      for(const [w,i] of (this.keys.get(k)||[])){
        if(w._br) continue;
        for(const dir of [1,-1]){
          const j1=i+dir;if(j1<0||j1>=w.pts.length) continue;
          const wd=unit(w.pts[j1][0]-w.pts[i][0],w.pts[j1][1]-w.pts[i][1]);
          if(dv&&wd[0]*dv[0]+wd[1]*dv[1]<0.6) continue;
          let acc=d;setH(w,i,val(H,acc));
          for(let j=j1;j>=0&&j<w.pts.length;j+=dir){
            acc+=Math.abs(w.cum[j]-w.cum[j-dir]);
            if(acc>=R) break;
            setH(w,j,val(H,acc));
            const kj=w.keys[j];
            if(!dist.has(kj)||acc<dist.get(kj)){dist.set(kj,acc);q.push([kj,acc,unit(w.pts[j][0]-w.pts[j-dir][0],w.pts[j][1]-w.pts[j-dir][1])]);}
          }
        }
      }
    }
  }
  for(const [w,a] of best){if(a.some(h=>h>0.05)) w._hs=Array.from(a);}
  /* 2b. an exit/entrance ramp only starts climbing once it has separated from the road it splits from: while it still
     lies on top of that road it stays at that road's height, then rises at most 6% */
  /* (also any narrower road that splits from / merges into a wider one: the main road wins) */
  const rank=v=>(v.ramp?0:1000)+TN.width(v);
  for(const w of ways){
    if(w._br||!w._hs) continue;
    const P=w.pts,n=P.length,cap=new Array(n).fill(Infinity);let any=false;
    for(let j=0;j<n;j++){
      const x=P[j][0],z=P[j][1],a=P[Math.max(0,j-1)],b=P[Math.min(n-1,j+1)];let tx=b[0]-a[0],tz=b[1]-a[1];const tl=Math.hypot(tx,tz)||1;tx/=tl;tz/=tl;
      this.near(x,z,0,(v,k)=>{
        if(v===w||v.tun||v._br||rank(v)<=rank(w)) return;
        const r=TN.seg(v,k,x,z);if(Math.abs(r.tx*tx+r.tz*tz)<0.8) return;
        if(r.d>Math.max(1,(TN.width(v)+TN.width(w))/2-1.5)) return;    /* still overlapping that road */
        const vh=v._hs?v._hs[k]+(v._hs[k+1]-v._hs[k])*r.u:0;
        if(vh<w._hs[j]-0.3&&vh<cap[j]){cap[j]=vh;any=true;}
      });
    }
    if(!any) continue;
    for(let j=1;j<n;j++) cap[j]=Math.min(cap[j],cap[j-1]+0.06*(w.cum[j]-w.cum[j-1]));
    for(let j=n-2;j>=0;j--) cap[j]=Math.min(cap[j],cap[j+1]+0.06*(w.cum[j+1]-w.cum[j]));
    for(let j=0;j<n;j++) if(cap[j]<w._hs[j]) w._hs[j]=cap[j];
  }

  /* a bridge piece that sits on the climb toward a higher bridge (its ends are higher than its own height) becomes
     part of that climb: it slopes like the road around it instead of making a step */
  const keyRamp=k=>{let m=0;for(const [w,i] of (this.keys.get(k)||[])){if(w._br) continue;const a=best.get(w);if(a&&a[i]>m) m=a[i];}return m;};
  for(const b of brs){
    if(!(b._H>0)) continue;
    const hA=keyRamp(b.keys[0]),hB=keyRamp(b.keys[b.keys.length-1]);
    if(Math.max(hA,hB)<=b._H+0.5) continue;
    const A=Math.max(b._H,hA),B=Math.max(b._H,hB);
    b._br=false;b._hs=b.cum.map(c=>A+(B-A)*(c/(b.L||1)));
  }
  gnd=ways.filter(w=>!w._br);
  /* 3. roads side by side rise together (lane joining/leaving, carriageway split in pieces), then slopes are smoothed */
  for(let pass=0;pass<3;pass++){
    const RG=new Map();
    for(const v of gnd){
      if(!v._hs) continue;
      const Q=v.pts,pad=v.w/2+2;
      for(let k=0;k<Q.length-1;k++){
        if(v._hs[k]<0.05&&v._hs[k+1]<0.05) continue;
        const a=Q[k],b=Q[k+1];
        for(let gx=Math.floor((Math.min(a[0],b[0])-pad)/20);gx<=Math.floor((Math.max(a[0],b[0])+pad)/20);gx++)
          for(let gz=Math.floor((Math.min(a[1],b[1])-pad)/20);gz<=Math.floor((Math.max(a[1],b[1])+pad)/20);gz++){
            const key=gx*1e6+gz;let l=RG.get(key);if(!l){l=[];RG.set(key,l);}l.push(v,k);
          }
      }
    }
    let changed=false,nw=0;
    for(const w of gnd){
      if(++nw%150===0) yield;
      const P=w.pts;
      for(let j=0;j<P.length;j++){
        const x=P[j][0],z=P[j][1],l=RG.get(Math.floor(x/20)*1e6+Math.floor(z/20));if(!l) continue;
        const cur=w._hs?w._hs[j]:0;
        const a=P[Math.max(0,j-1)],b=P[Math.min(P.length-1,j+1)];let tx=b[0]-a[0],tz=b[1]-a[1];const tl=Math.hypot(tx,tz)||1;tx/=tl;tz/=tl;
        let bestH=cur;
        for(let n=0;n<l.length;n+=2){
          const v=l[n],k=l[n+1];if(v===w) continue;
          /* only roads that are actually joined to this one (a lane merging in or splitting off shares a point
             with it); a separate road that just runs beside a ramp must not be lifted */
          if(!w._ks) w._ks=new Set(w.keys);
          if(!v.keys.some(q=>w._ks.has(q))) continue;
          /* a highway/street is never pulled up by an exit or entrance ramp that splits from it (the ramp rises,
             the main road stays) */
          if(v.ramp&&!w.ramp) continue;
          const r=TN.seg(v,k,x,z),h=v._hs[k]+(v._hs[k+1]-v._hs[k])*r.u;
          if(h<=bestH+0.05||h>16) continue;
          if(Math.abs(r.tx*tx+r.tz*tz)<0.85) continue;
          if(r.d-(w.w+v.w)/2>1.0) continue;
          bestH=h;
        }
        if(bestH>cur+0.05){if(!w._hs) w._hs=w.cum.map(()=>0);w._hs[j]=bestH;changed=true;}
      }
    }
    for(const w of gnd) if(w._hs) TN.slope(w);
    if(!changed) break;
  }
  /* 4. road pieces that meet at a point have the same height there (no steps between pieces); repeated until
     nothing changes any more, so a change can travel along several connected pieces */
  for(let round=0;round<3;round++){
  for(let pass=0;pass<12;pass++){
    let changed=false;
    let nk=0;
    for(const l of this.keys.values()){
      if(++nk%1500===0) yield;
      if(l.length<2) continue;
      let m=0;for(const [w,i] of l){const h=w._br?w._H:(w._hs?w._hs[i]:0);if(h>m) m=h;}
      if(m<0.05) continue;
      for(const [w,i] of l){
        if(w._br) continue;
        if(!w._hs) w._hs=w.cum.map(()=>0);
        if(w._hs[i]<m-0.05){w._hs[i]=m;changed=true;}
      }
    }
    yield;
    /* no dips between two raised parts less than 200 m apart, also when the dip spans several road pieces */
    for(const w of gnd) if(w._hs&&this.valleyAcross(w)) changed=true;
    for(const w of gnd) if(w._hs) TN.slope(w);
    if(!changed) break;
  }
  /* a bridge whose ends meet roads that ended up higher than the bridge (it sits on a climb): it slopes with them */
  let conv=false;
  const endGround=k=>{let m=0;for(const [w,i] of (this.keys.get(k)||[])){if(w._br||w.tun) continue;if(w._hs&&w._hs[i]>m) m=w._hs[i];}return m;};
  for(const b of ways){
    if(!b._br||!(b._H>0)) continue;
    const gA=endGround(b.keys[0]),gB=endGround(b.keys[b.keys.length-1]);
    if(Math.max(gA,gB)<=b._H+0.3) continue;
    const A=Math.max(b._H,gA),B=Math.max(b._H,gB);
    b._br=false;b._hs=b.cum.map(c=>A+(B-A)*(c/(b.L||1)));conv=true;
  }
  if(!conv) break;
  gnd=ways.filter(w=>!w._br);
  yield;
  }
};
/* highest height within 200 m beyond one end of a road piece, on the pieces that continue it */
TN.Net.prototype.beyond=function(w,atEnd){
  const k=atEnd?w.keys[w.keys.length-1]:w.keys[0],l=this.keys.get(k);if(!l) return 0;
  const P=w.pts,n=P.length,i=atEnd?n-1:0,j=atEnd?n-2:1;
  const tx=(P[i][0]-P[j][0]),tz=(P[i][1]-P[j][1]),tl=Math.hypot(tx,tz)||1;
  let m=0;
  for(const [v,vi] of l){
    if(v===w||v.tun) continue;
    const vn=v.pts.length;if(vi!==0&&vi!==vn-1) continue;
    const vj=vi===0?1:vn-2,ux=v.pts[vj][0]-v.pts[vi][0],uz=v.pts[vj][1]-v.pts[vi][1],ul=Math.hypot(ux,uz)||1;
    if((tx*ux+tz*uz)/(tl*ul)<0.8) continue;   /* only pieces that carry on in the same direction */
    if(v._br){m=Math.max(m,v._H||0);continue;}
    if(!v._hs) continue;
    for(let q=0;q<vn;q++){const d=vi===0?v.cum[q]:v.L-v.cum[q];if(d<200&&v._hs[q]>m) m=v._hs[q];}
  }
  return m;
};
TN.Net.prototype.valleyAcross=function(w){
  const hs=w._hs,c=w.cum,L=w.L,a=this.beyond(w,false),b=this.beyond(w,true);
  if(a<0.3||b<0.3) return false;
  let ch=false;
  for(let j=0;j<hs.length;j++){
    let l=c[j]<200?a:0,r=L-c[j]<200?b:0;
    for(let q=j-1;q>=0&&c[j]-c[q]<200;q--) if(hs[q]>l) l=hs[q];
    for(let q=j+1;q<hs.length&&c[q]-c[j]<200;q++) if(hs[q]>r) r=hs[q];
    const f=Math.min(l,r);if(f>hs[j]+0.05){hs[j]=f;ch=true;}
  }
  return ch;
};
TN.slope=function(w){
  const hs=w._hs,c=w.cum,k=0.06;
  /* no dips between two raised parts less than 200 m apart (the road stays up, like an embankment) */
  for(let j=0;j<hs.length;j++){
    let l=0,r=0;
    for(let a=j-1;a>=0&&c[j]-c[a]<200;a--) if(hs[a]>l) l=hs[a];
    for(let b=j+1;b<hs.length&&c[b]-c[j]<200;b++) if(hs[b]>r) r=hs[b];
    const fill=Math.min(l,r);if(fill>hs[j]) hs[j]=fill;
  }
  for(let j=1;j<hs.length;j++) hs[j]=Math.max(hs[j],hs[j-1]-k*(c[j]-c[j-1]));
  for(let j=hs.length-2;j>=0;j--) hs[j]=Math.max(hs[j],hs[j+1]-k*(c[j+1]-c[j]));
};

/* ---------------- meshes (plain arrays; scene.js makes them 3D) ---------------- */
TN.hex=function(h){return [parseInt(h.substr(1,2),16)/255,parseInt(h.substr(3,2),16)/255,parseInt(h.substr(5,2),16)/255];};
TN.C={};for(const k in TN.COL) TN.C[k]=TN.hex(TN.COL[k]);
TN.geo=function(){return {p:[],c:[],i:[],n:0};};
TN.quad=function(G,a,b,c,d,col){
  for(const v of [a,b,c,d]){G.p.push(v[0],v[1],v[2]);G.c.push(col[0],col[1],col[2]);}
  G.i.push(G.n,G.n+1,G.n+2,G.n,G.n+2,G.n+3);G.n+=4;
};
TN.normals=function(pts){
  const N=[];
  for(let i=0;i<pts.length;i++){
    const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];
    let tx=b[0]-a[0],tz=b[1]-a[1];const l=Math.hypot(tx,tz)||1;tx/=l;tz/=l;
    let sc=1;
    if(i>0&&i<pts.length-1){const ax=pts[i][0]-pts[i-1][0],az=pts[i][1]-pts[i-1][1],al=Math.hypot(ax,az)||1;sc=1/Math.max(0.6,Math.abs((ax/al)*tx+(az/al)*tz));}
    /* left of the drawing direction */
    N.push([tz*sc,-tx*sc]);
  }
  return N;
};
/* is a point on another road at about the same height? (then markings are left out there) */
TN.Net.prototype.onOther=function(way,x,z,h){
  let hit=false;
  this.near(x,z,0,(w,i)=>{
    if(w===way||w.tun) return;
    const r=TN.seg(w,i,x,z),wh=w.br?w.H:(w.hs?w.hs[i]+(w.hs[i+1]-w.hs[i])*r.u:0);
    if(r.d<TN.width(w)/2-0.2&&Math.abs(wh-h)<1){hit=true;return true;}
  });
  return hit;
};
TN.Net.prototype.buildCell=function(tx,ty){
  const L={curb:TN.geo(),road:TN.geo(),mark:TN.geo()};
  const net=this;
  const inCell=(x,z)=>{const ll=TN.fromLocal(x,z);return Math.floor(ll[0]/TN.CELL)===tx&&Math.floor(ll[1]/TN.CELL)===ty;};
  const x0=TN.toLocal(tx*TN.CELL,(ty+1)*TN.CELL),x1=TN.toLocal((tx+1)*TN.CELL,ty*TN.CELL);
  const cb=[Math.min(x0[0],x1[0]),Math.max(x0[0],x1[0]),Math.min(x0[1],x1[1]),Math.max(x0[1],x1[1])];
  for(const w of this.ways.values()){
    if(w.tun) continue;
    if(w.bb[1]<cb[0]||w.bb[0]>cb[1]||w.bb[3]<cb[2]||w.bb[2]>cb[3]) continue;
    const P=w.pts,runs=[];let a=-1;
    for(let i=0;i<P.length-1;i++){
      const ins=inCell((P[i][0]+P[i+1][0])/2,(P[i][1]+P[i+1][1])/2);
      if(ins&&a<0) a=i;if(!ins&&a>=0){runs.push([a,i]);a=-1;}
    }
    if(a>=0) runs.push([a,P.length-1]);
    if(runs.length) this.drawWay(L,w,runs);
  }
  return L;
};
TN.Net.prototype.drawWay=function(L,w,runs){
  const net=this,P=w.pts,N=TN.normals(P),W=TN.width(w),hw=W/2;
  const H=j=>w.br?w.H:(w.hs?w.hs[j]:0);
  /* where this road piece joins the next one and their widths differ (lanes added/dropped), both pieces meet
     at the same width and taper over up to 60 m, so the edges and lane lines flow without a step */
  const WJ=this.widthsAlong(w);
  const hwJ=j=>WJ[j]/2;
  const strip=(G,a,b,o1,o2,dy,col)=>{for(let i=a;i<b;i++){
    const p=(j,o)=>[P[j][0]+N[j][0]*o,H(j)+dy,P[j][1]+N[j][1]*o];
    TN.quad(G,p(i,o1(i)),p(i+1,o1(i+1)),p(i+1,o2(i+1)),p(i,o2(i)),col);}};
  const wall=(G,a,b,o,top,bot,col)=>{for(let i=a;i<b;i++){
    /* walls and barriers only where this part of the road is actually raised (not on its ground-level part) */
    if(Math.max(H(i),H(i+1))<0.5) continue;
    const t0=H(i)+top,t1=H(i+1)+top,b0=bot(i),b1=bot(i+1);if(t0-b0<0.05&&t1-b1<0.05) continue;
    /* where another road is right beside this edge at about the same height (a ramp joining or leaving the
       highway), there is no wall: you can drive across there */
    {const oi=o(i),oj=o(i+1),sg=Math.sign(oi+oj)||1,mx=(P[i][0]+P[i+1][0])/2+(N[i][0]+N[i+1][0])/2*((oi+oj)/2+sg*1.5),
      mz=(P[i][1]+P[i+1][1])/2+(N[i][1]+N[i+1][1])/2*((oi+oj)/2+sg*1.5);
     if(net.onOther(w,mx,mz,(H(i)+H(i+1))/2)) continue;
     /* the edge itself runs across another road at the same height (a street joining the ramp): no wall either */
     const ex=(P[i][0]+P[i+1][0])/2+(N[i][0]+N[i+1][0])/2*(oi+oj)/2,ez=(P[i][1]+P[i+1][1])/2+(N[i][1]+N[i+1][1])/2*(oi+oj)/2;
     if(net.onOther(w,ex,ez,(H(i)+H(i+1))/2)) continue;}
    const p=(j,h)=>[P[j][0]+N[j][0]*o(j),h,P[j][1]+N[j][1]*o(j)];
    TN.quad(G,p(i,b0),p(i+1,b1),p(i+1,t1),p(i,t0),col);}};
  const line=(G,a,b,of,dash,gap,col,half,edgeOut)=>{
    for(let i=a;i<b;i++){
      const s0=w.cum[i],s1=w.cum[i+1],len=s1-s0;if(len<0.05) continue;
      const nx=N[i][0],nz=N[i][1],nl=Math.hypot(nx,nz)||1,ux=nx/nl,uz=nz/nl;
      const oa=of(i),ob=of(i+1),oo=u=>oa+(ob-oa)*u;
      let s=Math.floor(s0/(dash+gap))*(dash+gap);
      for(;s<s1;s+=dash+gap){
        const d0=Math.max(s,s0),d1=Math.min(s+dash,s1);if(d1-d0<0.1) continue;
        const u0=(d0-s0)/len,u1=(d1-s0)/len;
        const pt=u=>[P[i][0]+(P[i+1][0]-P[i][0])*u,P[i][1]+(P[i+1][1]-P[i][1])*u];
        const hh=u=>H(i)+(H(i+1)-H(i))*u+0.06;
        const A=pt(u0),B=pt(u1),um=(u0+u1)/2,o=oo(um),mx=(A[0]+B[0])/2+ux*o,mz=(A[1]+B[1])/2+uz*o;
        if(net.onOther(w,mx,mz,hh(um)-0.06)) continue;
        if(edgeOut&&net.onOther(w,mx+ux*edgeOut,mz+uz*edgeOut,hh(um)-0.06)) continue;
        const o0=oo(u0),o1=oo(u1);
        TN.quad(G,[A[0]+ux*(o0+half),hh(u0),A[1]+uz*(o0+half)],[B[0]+ux*(o1+half),hh(u1),B[1]+uz*(o1+half)],
                  [B[0]+ux*(o1-half),hh(u1),B[1]+uz*(o1-half)],[A[0]+ux*(o0-half),hh(u0),A[1]+uz*(o0-half)],col);
      }
    }
  };
  const major=['motorway','trunk','primary','secondary'].indexOf(w.cls)>=0;
  for(const [a,b] of runs){
    if(!w.br) strip(L.curb,a,b,j=>hwJ(j)+0.3,j=>-hwJ(j)-0.3,0.02,TN.C.curb);
    strip(L.road,a,b,j=>hwJ(j),j=>-hwJ(j),0.04,TN.C.road);
    if(w.ow){
      const n=w.lanes||Math.max(1,Math.round(W/3.4));
      /* drawing direction = driving direction for ow=1; ow=-1 roads are drawn the other way */
      for(let k=1;k<n;k++) line(L.mark,a,b,j=>-hwJ(j)+k*WJ[j]/n,3,6,TN.C.white,0.13);
      if(major){
        const lft=w.ow===-1?-1:1;
        line(L.mark,a,b,j=>-lft*(hwJ(j)-0.35),1e6,0.001,TN.C.white,0.14,-lft*1.5);
        line(L.mark,a,b,j=>lft*(hwJ(j)-0.35),1e6,0.001,TN.C.yellow,0.14,lft*1.5);
      }
    }else if(w.cls!=='service'){
      line(L.mark,a,b,()=>0,1e6,0.001,TN.C.yellow,0.14);
      const nh=w.lanes>=4?Math.floor(w.lanes/2):0;
      for(let k=1;k<nh;k++){line(L.mark,a,b,j=>k*hwJ(j)/nh,3,6,TN.C.white,0.13);line(L.mark,a,b,j=>-k*hwJ(j)/nh,3,6,TN.C.white,0.13);}
    }
    const raised=w.br?w.H>0:(w.hs&&w.hs.some((h,j)=>j>=a&&j<=b&&h>0.3));
    if(raised){
      /* low ramps: solid embankment wall to the ground; higher up: a 1.2 m deck with open space below (so roads
         passing underneath stay visible) */
      const bot=j=>w.br?Math.max(0,H(j)-1.2):Math.min(Math.max(0,H(j)-1.2),Math.max(0,(H(j)-3)*2));
      wall(L.road,a,b,j=>hwJ(j),0.04,bot,TN.C.side);wall(L.road,a,b,j=>-hwJ(j),0.04,bot,TN.C.side);
      wall(L.road,a,b,j=>hwJ(j),1.0,j=>H(j)+0.04,TN.C.barrier);wall(L.road,a,b,j=>-hwJ(j),1.0,j=>H(j)+0.04,TN.C.barrier);
    }
    if(!w.br&&w.hs) this.rampPiers(L,w,a,b);
    if(w.br&&w.H>=3){
      const step=W>=9?36:28;
      for(let s=Math.ceil(w.cum[a]/step)*step+step/2;s<w.cum[b];s+=step){
        let i=0;while(i<P.length-2&&w.cum[i+1]<s) i++;
        const sg=w.cum[i+1]-w.cum[i]||1,t=(s-w.cum[i])/sg;
        const x=P[i][0]+(P[i+1][0]-P[i][0])*t,z=P[i][1]+(P[i+1][1]-P[i][1])*t;
        const ux=(P[i+1][0]-P[i][0])/sg,uz=(P[i+1][1]-P[i][1])/sg,nx=-uz,nz=ux;
        const cols=W>=9?[-W*0.3,W*0.3]:[0];
        let onRoad=false;
        for(const o of cols){const px=x+nx*o,pz=z+nz*o;this.near(px,pz,0,(v,k)=>{if(v.br||v.tun) return;const r=TN.seg(v,k,px,pz);if(r.d<v.w/2+1.2){onRoad=true;return true;}});}
        if(onRoad) continue;
        for(const o of cols) TN.box(L.road,x+nx*o,z+nz*o,ux,uz,1.3,1.3,0,w.H-1.2,TN.C.pier);
      }
    }
  }
};
/* width at every point of a road piece: equal to its neighbour's at a join, tapering over up to 60 m */
TN.Net.prototype.widthsAlong=function(w){
  const W=TN.width(w),P=w.pts,n=P.length,out=new Array(n).fill(W);
  const tan=(v,i,dir)=>{const a=v.pts[i],b=v.pts[Math.max(0,Math.min(v.pts.length-1,i+dir))];const l=Math.hypot(b[0]-a[0],b[1]-a[1])||1;return [(b[0]-a[0])/l,(b[1]-a[1])/l];};
  const joinW=(j,dir)=>{
    /* dir: +1 = the piece leaves this point forward (start), -1 = it arrives (end) */
    const l=this.keys.get(w.keys[j]);if(!l||l.length<2) return W;
    const t=tan(w,j,dir);let best=null,bd=0.85;
    for(const [v,vi] of l){
      if(v===w||v.tun) continue;
      /* the continuation: a piece that ends where this one starts (or the other way), pointing the same way */
      const vd=vi===0?1:(vi===v.pts.length-1?-1:0);if(!vd) continue;
      const tv=tan(v,vi,vd),dot=-(t[0]*tv[0]+t[1]*tv[1]);
      if(dot>bd){bd=dot;best=v;}
    }
    return best?(W+TN.width(best))/2:W;
  };
  const w0=joinW(0,1),w1=joinW(n-1,-1),T=Math.min(60,w.L/2);
  for(let j=0;j<n;j++){
    const s=w.cum[j],e=w.L-s;
    let v=W;
    if(s<T) v+=(w0-W)*(1-s/T);
    if(e<T) v+=(w1-W)*(1-e/T);
    out[j]=v;
  }
  return out;
};
/* piers under the high part of ramps */
TN.Net.prototype.rampPiers=function(L,w,a,b){
  const P=w.pts,W=w.w,step=32;
  for(let s=Math.ceil(w.cum[a]/step)*step+step/2;s<w.cum[b];s+=step){
    let i=0;while(i<P.length-2&&w.cum[i+1]<s) i++;
    const sg=w.cum[i+1]-w.cum[i]||1,t=(s-w.cum[i])/sg,h=w.hs[i]+(w.hs[i+1]-w.hs[i])*t;
    if(h<4.5) continue;
    const x=P[i][0]+(P[i+1][0]-P[i][0])*t,z=P[i][1]+(P[i+1][1]-P[i][1])*t,ux=(P[i+1][0]-P[i][0])/sg,uz=(P[i+1][1]-P[i][1])/sg;
    let onRoad=false;
    this.near(x,z,0,(v,k)=>{if(v===w||v.tun) return;const r=TN.seg(v,k,x,z),vh=v.br?v.H:(v.hs?v.hs[k]:0);if(r.d<TN.width(v)/2+1.2&&vh<h-2){onRoad=true;return true;}});
    if(!onRoad) TN.box(L.road,x,z,ux,uz,1.3,Math.min(W*0.5,6),0,h-1.2,TN.C.pier);
  }
};
TN.box=function(G,x,z,ux,uz,a,c,y0,y1,col){
  const vx=-uz,vz=ux,A=a/2,B=c/2,P=(sa,sb,y)=>[x+ux*A*sa+vx*B*sb,y,z+uz*A*sa+vz*B*sb];
  const dk=[col[0]*0.85,col[1]*0.85,col[2]*0.85];
  TN.quad(G,P(1,1,y0),P(1,-1,y0),P(1,-1,y1),P(1,1,y1),col);
  TN.quad(G,P(-1,-1,y0),P(-1,1,y0),P(-1,1,y1),P(-1,-1,y1),col);
  TN.quad(G,P(-1,1,y0),P(1,1,y0),P(1,1,y1),P(-1,1,y1),dk);
  TN.quad(G,P(1,-1,y0),P(-1,-1,y0),P(-1,-1,y1),P(1,-1,y1),dk);
};
if(typeof module!=='undefined') module.exports=TN;
