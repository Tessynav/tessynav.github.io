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
TN.COL={sigbox:'#1d1f22',sigred:'#b3302a',sigyel:'#c9a227',siggrn:'#2f9a4e',remdeck:'#d4d7da',remside:'#bcc0c4',rail:'#55595e',lamp:'#d9dde2',girder:'#8e9297',cap:'#a3a7ab',tower:'#d3d6d9',cable:'#e6e8ea',glowc:'#ffc477',walk:'#c9c6bf',curbtop:'#a3a6aa',stopred:'#8a0404',signw:'#e9e9e6',post:'#8f9397',park:'#5a5e64',road:'#45494f',curb:'#9a9ea3',white:'#f4f4f2',yellow:'#efc23a',side:'#a7abb0',barrier:'#c9ccd0',pier:'#b0b4b8'};

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
  /* bridges get a point every ~20 m (their deck height changes along them); added points have their own keys so
     they never look like junctions */
  if(isBridge&&r[12]!=='t'){
    const P2=[],K2=[];
    for(let i=0;i<pts.length;i++){
      if(i>0){const a=pts[i-1],b=pts[i],d=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.floor(d/20);
        for(let k=1;k<n;k++){const t=k/n;P2.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);K2.push(r[0]+':'+i+':'+k);}}
      P2.push(pts[i]);K2.push(keys[i]);
    }
    pts.length=0;keys.length=0;for(let i=0;i<P2.length;i++){pts.push(P2[i]);keys.push(K2[i]);}
  }
  const cum=[0];for(let i=1;i<pts.length;i++) cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  const w={id:r[0],cls:r[1],ow:r[2]||0,w:r[3]||7,lanes:r[7]||0,name:r[4]||'',pts:pts,keys:keys,cum:cum,L:cum[cum.length-1],
    br:false,tun:false,layer:0,H:0,hs:null};
  if(isBridge){w.layer=r[9]||0;w.ramp=!!r[10];if(r[12]==='t') w.tun=true;else w.br=true;}
  else{w.ramp=!!r[9];w.pa=!!r[10];}
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
    if(r[1]==='transit'&&/REM/.test(r[4]||'')){
      /* the REM's elevated guideway (kept separately: trains, not cars, use it) */
      rec.rm=rec.rm||new Set();rec.rm.add(r[0]);this.rem=this.rem||new Map();
      if(!this.rem.has(r[0])){const w=this.makeWay(r,true);if(w){w.rem=true;w.br=false;this.rem.set(w.id,w);this.remVer=(this.remVer||0)+1;}}
      continue;
    }
    if(r[1]==='rail'||r[1]==='transit') continue;
    rec.ids.add(r[0]);if(!this.ways.has(r[0])){const w=this.makeWay(r,true);if(w) this.ways.set(w.id,w);}
  }
  /* parking lots (outlines), from road tiles v3 */
  rec.pk=new Set();this.parkings=this.parkings||new Map();
  for(const r of P.pk||[]){
    rec.pk.add(r[0]);if(this.parkings.has(r[0])) continue;
    const f=r[1],pts=[];for(let i=0;i<f.length;i+=2) pts.push(TN.toLocal(f[i],f[i+1]));
    if(pts.length<3) continue;
    let cx=0,cz=0;for(const q of pts){cx+=q[0];cz+=q[1];}
    let bx0=1e9,bx1=-1e9,bz0=1e9,bz1=-1e9;for(const q of pts){if(q[0]<bx0)bx0=q[0];if(q[0]>bx1)bx1=q[0];if(q[1]<bz0)bz0=q[1];if(q[1]>bz1)bz1=q[1];}
    this.parkings.set(r[0],{pts:pts,c:[cx/pts.length,cz/pts.length],bb:[bx0,bx1,bz0,bz1]});
  }
  /* stop signs, yield signs and crosswalks: [lng, lat, kind s/y/c, direction f/b/''] */
  rec.mk=new Set();this.marks=this.marks||new Map();
  for(const m of P.n||[]){const k=m[0]+','+m[1]+','+m[2];rec.mk.add(k);if(this.marks.has(k)) continue;
    const q=TN.toLocal(m[0],m[1]);this.marks.set(k,{x:q[0],z:q[1],kind:m[2],dir:m[3]||'',key:TN.vkey(m[0],m[1])});}
  this.packs.set(key,rec);(this.changed=this.changed||[]).push(key);
  if(!later) this.rebuildIndex();
  return true;
};
TN.Net.prototype.dropPack=function(key,later){
  const rec=this.packs.get(key);if(!rec) return;
  this.packs.delete(key);(this.changed=this.changed||[]).push(key);
  const keep=new Set();for(const r of this.packs.values()) for(const id of r.ids) keep.add(id);
  for(const id of rec.ids) if(!keep.has(id)) this.ways.delete(id);
  if(rec.rm&&this.rem){const kr=new Set();for(const r of this.packs.values()) if(r.rm) for(const id of r.rm) kr.add(id);
    for(const id of rec.rm) if(!kr.has(id)){this.rem.delete(id);this.remVer=(this.remVer||0)+1;}}
  if(rec.mk&&this.marks){const km=new Set();for(const r of this.packs.values()) if(r.mk) for(const k of r.mk) km.add(k);
    for(const k of rec.mk) if(!km.has(k)) this.marks.delete(k);}
  if(rec.pk&&this.parkings){const kp=new Set();for(const r of this.packs.values()) if(r.pk) for(const id of r.pk) kp.add(id);
    for(const id of rec.pk) if(!kp.has(id)) this.parkings.delete(id);}
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
  if(!w.hs) return w.br?w.H:0;
  const c=w.cum;let i=0;
  if(s<=0) return w.hs[0];if(s>=w.L) return w.hs[w.hs.length-1];
  let lo=0,hi=c.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(c[m]<=s) lo=m;else hi=m;}i=lo;
  const seg=c[i+1]-c[i]||1;return w.hs[i]+(w.hs[i+1]-w.hs[i])*(s-c[i])/seg;
};
TN.width=function(w){return w.br?(w.W||w.w):w.w;};

/* ---------------- heights ---------------- */
TN.smooth=function(t){t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
TN.rampLen=function(H){return Math.max(60,Math.min(350,H*20));};

/* ---------- Codriver-style heights ----------
   Ordinary roads stay at ground level. Each bridge or viaduct (pieces joined end to end) gets one deck height and
   carries its own climb: from ground level where it meets the ground road network, rising smoothly (max ~6%) to
   the deck height. Where a bridge is too short for that climb, the climb continues onto the road that carries
   straight on from it, but never past an intersection and never under another bridge. Pieces that meet always
   get the same height there, because heights come from the distance along the network. */
TN.Net.prototype.heightsCD=function*(){
  const ways=[...this.ways.values()];
  for(const w of ways){if(w.brSrc===undefined) w.brSrc=w.br;w._br=w.brSrc;w._hs=null;w._H=0;w._W=w.w;}
  const brs=ways.filter(w=>w._br);
  /* bridge groups: pieces sharing end points */
  const parent=new Map();for(const b of brs) parent.set(b,b);
  const find=a=>{while(parent.get(a)!==a){parent.set(a,parent.get(parent.get(a)));a=parent.get(a);}return a;};
  const ends=new Map();
  for(const b of brs) for(const k of [b.keys[0],b.keys[b.keys.length-1]]){
    const l=ends.get(k);if(l) for(const o of l) parent.set(find(o),find(b));
    if(l) l.push(b);else ends.set(k,[b]);
  }
  /* bridges also join through their inner points (a ramp landing on a deck) */
  for(const b of brs) for(const k of b.keys){const l=this.keys.get(k);if(l) for(const [v] of l) if(v!==b&&v._br) parent.set(find(v),find(b));}
  const groups=new Map();let nb=0;
  for(const b of brs){
    const r=find(b);let g=groups.get(r);if(!g){g={L:0,cross:false,layer:0,W:0,m:[]};groups.set(r,g);}
    g.m.push(b);g.L+=b.L;g.layer=Math.max(g.layer,b.layer);g.W=Math.max(g.W,b.w);
    if(!g.cross&&this.crossesSomething(b)) g.cross=true;
    if(++nb%10===0) yield;
  }
  const unit=(x,z)=>{const l=Math.hypot(x,z)||1;return [x/l,z/l];};
  const isJunction=k=>{
    /* an intersection: three or more road ends meet, or two roads cross there */
    const l=this.keys.get(k);if(!l) return false;let ends=0;
    for(const [v,i] of l){if(v.tun) continue;ends+=(i===0||i===v.pts.length-1)?1:2;}
    return ends>=3;
  };
  const underDeck=(x,z,me)=>{let hit=false;this.near(x,z,0,(v,k)=>{if(v===me||!v._br||v._grp===me._grp) return;const r=TN.seg(v,k,x,z);if(r.d<TN.width(v)/2){hit=true;return true;}});return hit;};
  for(const g of groups.values()){
    let H;
    if(g.cross) H=Math.max(6.5*Math.max(1,g.layer),g.L>400?15:0);
    else if(g.L>=120) H=g.L>400?15:5;
    else H=0;
    for(const b of g.m){b._H=H;b._W=Math.max(b.w,g.W);b._grp=g;if(H===0) b._br=false;}
    g.H=H;
  }
  let ng=0;
  for(const g of groups.values()){
    if(!(g.H>0)) continue;
    if(++ng%8===0) yield;
    const H=g.H,R=TN.rampLen(H),dist=new Map(),q=[];
    /* exits: where the bridge meets ground roads (or simply ends) */
    for(const b of g.m){
      const n=b.pts.length;
      for(const [i,j] of [[0,1],[n-1,n-2]]){
        const k=b.keys[i],l=this.keys.get(k)||[];
        const others=l.filter(([v])=>v!==b);
        if(others.some(([v])=>v._br&&v._grp===g)) continue;          /* continues as bridge */
        if(!others.some(([v])=>!v._br&&!v.tun)) continue;              /* no ground road here (edge of loaded area) */
        /* walk out along the road that carries straight on, collecting the climb path */
        const out=unit(b.pts[i][0]-b.pts[j][0],b.pts[i][1]-b.pts[j][1]);
        const path=[];let E=0,key=k,dir=out,stop=isJunction(k)&&others.length>1;
        const Emax=Math.max(0,R-g.L/2);
        let guard=0;
        while(!stop&&E<Emax&&guard++<20){
          let best=null,bd=0.8;
          for(const [v,vi] of (this.keys.get(key)||[])){
            if(v._br||v.tun) continue;
            for(const sd of [1,-1]){
              const vj=vi+sd;if(vj<0||vj>=v.pts.length) continue;
              const u=unit(v.pts[vj][0]-v.pts[vi][0],v.pts[vj][1]-v.pts[vi][1]),d=u[0]*dir[0]+u[1]*dir[1];
              if(d>bd){bd=d;best=[v,vi,sd];}
            }
          }
          if(!best) break;
          const [v,vi,sd]=best;let j2=vi,brk=false;
          while(true){
            const jn=j2+sd;if(jn<0||jn>=v.pts.length) break;
            const seg=Math.abs(v.cum[jn]-v.cum[j2]);
            if(underDeck((v.pts[j2][0]+v.pts[jn][0])/2,(v.pts[j2][1]+v.pts[jn][1])/2,b)){brk=true;break;}
            E+=seg;path.push([v,jn,E]);dir=unit(v.pts[jn][0]-v.pts[j2][0],v.pts[jn][1]-v.pts[j2][1]);j2=jn;
            if(E>=Emax) break;
            if(isJunction(v.keys[jn])){brk=true;break;}
          }
          if(brk||E>=Emax) break;
          if(j2!==0&&j2!==v.pts.length-1) break;
          key=v.keys[j2];
        }
        /* ground point G is at the far end of the path; heights along the path count from there */
        (g.paths=g.paths||[]).push([path,E]);
        const d0=E;
        if(!dist.has(k)||d0<dist.get(k)){dist.set(k,d0);q.push([k,d0]);}
      }
    }
    /* distances along the bridge from its exits (the deck climbs with that distance) */
    while(q.length){
      let bi=0;for(let j=1;j<q.length;j++) if(q[j][1]<q[bi][1]) bi=j;
      const [k,d]=q.splice(bi,1)[0];if(d>dist.get(k)) continue;
      for(const [v,i] of (this.keys.get(k)||[])){
        if(v._grp!==g) continue;
        for(const sd of [1,-1]){
          let acc=d;
          for(let j=i+sd;j>=0&&j<v.pts.length;j+=sd){
            acc+=Math.abs(v.cum[j]-v.cum[j-sd]);
            const kj=v.keys[j];
            if(!dist.has(kj)||acc<dist.get(kj)-0.01){dist.set(kj,acc);q.push([kj,acc]);}
            else break;
          }
        }
      }
    }
    /* the deck must be at full height where it passes over another road: if that is closer to an end than the
       normal climb length, the climb is made steeper (a short overpass climbs quickly, like the real ones) */
    let Rg=R;
    const gk=new Set();for(const b of g.m) for(const k of b.keys) gk.add(k);
    for(const b of g.m){
      const P=b.pts;
      for(let i=0;i<P.length-1;i++){
        const sl=b.cum[i+1]-b.cum[i];if(sl<0.5) continue;
        const da=dist.has(b.keys[i])?dist.get(b.keys[i]):R,db=dist.has(b.keys[i+1])?dist.get(b.keys[i+1]):R;
        const ux=(P[i+1][0]-P[i][0])/sl,uz=(P[i+1][1]-P[i][1])/sl;
        for(let t=3;t<sl;t+=6){
          const x=P[i][0]+ux*t,z=P[i][1]+uz*t;let over=false;
          this.near(x,z,0,(v,k)=>{if(v._br||v.tun||v._grp===g) return;if(v.keys.some(q=>gk.has(q))) return;const r=TN.seg(v,k,x,z);
            if(r.d<v.w/2&&Math.abs(r.tx*ux+r.tz*uz)<0.9){over=true;return true;}});
          if(over){const d=Math.min(da+t,db+(sl-t));if(d<Rg) Rg=Math.max(12,d);}
        }
      }
    }
    for(const b of g.m){
      b._hs=b.keys.map(k=>{const d=dist.has(k)?dist.get(k):Rg;return H*TN.smooth(Math.min(1,d/Rg));});
      /* the deck never sinks below where it was set (a bridge with no exits stays at full height) */
      if(!b.keys.some(k=>dist.has(k))) b._hs=b.keys.map(()=>H);
    }
    for(const [path,E] of (g.paths||[])) for(const [v,jn,e] of path){
      const d=E-e;if(!v._hs) v._hs=new Array(v.pts.length).fill(0);
      const h=H*TN.smooth(Math.min(1,d/Rg));if(h>v._hs[jn]) v._hs[jn]=h;
    }
  }
  /* road pieces that meet: the same height there (climb paths of two bridges sharing a road) */
  for(let pass=0;pass<4;pass++){
    let ch=false;
    for(const l of this.keys.values()){
      if(l.length<2) continue;let m=0;for(const [w,i] of l){const h=w._hs?w._hs[i]:0;if(h>m) m=h;}
      if(m<0.05) continue;
      for(const [w,i] of l){if(w.tun) continue;if(!w._hs) w._hs=new Array(w.pts.length).fill(0);if(w._hs[i]<m-0.05){w._hs[i]=m;ch=true;}}
    }
    for(const w of ways) if(w._hs&&!w._br) TN.slope(w);
    if(!ch) break;
    yield;
  }
  for(const w of ways) if(w._hs&&!w._hs.some(h=>h>0.05)) w._hs=null;
};
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
/* height model: 'cd' (Codriver-style, default) or 'old' */
/* the new model is still being tuned: it is only used with ?heights=cd in the address */
TN.HMODE=(typeof location!=='undefined'&&/[?&]heights=cd/.test(location.search))?'cd':'old';
TN.Net.prototype.heights=function*(){if(TN.HMODE==='cd'){yield* this.heightsCD();return;}yield* this.heightsOld();};
TN.Net.prototype.heightsOld=function*(){
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
    /* (bridge decks count too: a ramp joining a bridge deck rises to the deck where it lies on it) */
    for(const v of ways){
      if(v.tun||!(v._br?v._H>0:v._hs)) continue;
      const Q=v.pts,pad=TN.width(v)/2+2;
      for(let k=0;k<Q.length-1;k++){
        if(!v._br&&v._hs[k]<0.05&&v._hs[k+1]<0.05) continue;
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
          const r=TN.seg(v,k,x,z),h=v._br?v._H:v._hs[k]+(v._hs[k+1]-v._hs[k])*r.u;
          if(h<=bestH+0.05||h>16) continue;
          if(Math.abs(r.tx*tx+r.tz*tz)<0.85) continue;
          if(r.d-(w.w+TN.width(v))/2>1.0) continue;
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
  const G=this._sg;
  if(G){
    const gx=Math.floor(x/10),gz=Math.floor(z/10),l=G.get(gx*1e6+gz);if(!l) return false;
    for(const e of l){const w=e[0],i=e[1];if(w===way||w.tun) continue;
      const r=TN.seg(w,i,x,z);if(r.d>=TN.width(w)/2-0.2) continue;
      const wh=w.hs?w.hs[i]+(w.hs[i+1]-w.hs[i])*r.u:(w.br?w.H:0);if(Math.abs(wh-h)<1) return true;}
    return false;
  }
  let hit=false;
  this.near(x,z,0,(w,i)=>{
    if(w===way||w.tun) return;
    const r=TN.seg(w,i,x,z),wh=w.hs?w.hs[i]+(w.hs[i+1]-w.hs[i])*r.u:(w.br?w.H:0);
    if(r.d<TN.width(w)/2-0.2&&Math.abs(wh-h)<1){hit=true;return true;}
  });
  return hit;
};
TN.Net.prototype.buildCell=function(tx,ty){const g=this.buildCellJob(tx,ty);let r;do{r=g.next();}while(!r.done);return r.value;};
TN.Net.prototype.buildCellJob=function*(tx,ty){
  const L={lot:TN.geo(),curb:TN.geo(),road:TN.geo(),mark:TN.geo(),glow:TN.geo()};
  const net=this;let nn=0,SG=null;
  /* pause point: the fast road lookup belongs to this job only, so it is switched off while paused */
  const pause=function*(){net._sg=null;yield;net._sg=SG;};
  const inCell=(x,z)=>{const ll=TN.fromLocal(x,z);return Math.floor(ll[0]/TN.CELL)===tx&&Math.floor(ll[1]/TN.CELL)===ty;};
  const x0=TN.toLocal(tx*TN.CELL,(ty+1)*TN.CELL),x1=TN.toLocal((tx+1)*TN.CELL,ty*TN.CELL);
  const cb=[Math.min(x0[0],x1[0]),Math.max(x0[0],x1[0]),Math.min(x0[1],x1[1]),Math.max(x0[1],x1[1])];
  SG=this.segGrid(cb);this._sg=SG;
  /* parking lots: their own layer, drawn first and never hiding anything (no flicker with the aisles) */
  if(this.parkings) for(const pk of this.parkings.values()){
    if(!inCell(pk.c[0],pk.c[1])) continue;
    const tri=TN.earcut(pk.pts);
    for(const t of tri){const base=L.lot.n;
      for(const k of t){const q=pk.pts[k];L.lot.p.push(q[0],0.01,q[1]);L.lot.c.push(TN.C.park[0],TN.C.park[1],TN.C.park[2]);}
      L.lot.i.push(base,base+1,base+2);L.lot.n+=3;}
    yield* pause();
  }
  for(const w of this.ways.values()){
    if(w.tun) continue;
    if(w.bb[1]<cb[0]||w.bb[0]>cb[1]||w.bb[3]<cb[2]||w.bb[2]>cb[3]) continue;
    const P=w.pts,runs=[];let a=-1;
    for(let i=0;i<P.length-1;i++){
      const ins=inCell((P[i][0]+P[i+1][0])/2,(P[i][1]+P[i+1][1])/2);
      if(ins&&a<0) a=i;if(!ins&&a>=0){runs.push([a,i]);a=-1;}
    }
    if(a>=0) runs.push([a,P.length-1]);
    if(runs.length){this.drawWay(L,w,runs);this.drawWalks(L,w,runs);if(w.pa) this.drawStalls(L,w,runs);this.drawLights(L,w,runs);yield* pause();}
  }
  {const T=TN.toLocal(TN.CHAMPLAIN.lng,TN.CHAMPLAIN.lat);if(inCell(T[0],T[1])) this.champlainTower(L);}
  if(this.rem) for(const w of this.rem.values()){
    if(w.bb[1]<cb[0]||w.bb[0]>cb[1]||w.bb[3]<cb[2]||w.bb[2]>cb[3]) continue;
    const P=w.pts;let a=-1;
    for(let i=0;i<P.length-1;i++){const ins=inCell((P[i][0]+P[i+1][0])/2,(P[i][1]+P[i+1][1])/2);
      if(ins&&a<0) a=i;if(!ins&&a>=0){this.drawRem(L,w,a,i);a=-1;}}
    if(a>=0) this.drawRem(L,w,a,P.length-1);
    yield* pause();
  }
  const sigDone=new Set();
  if(this.marks) for(const m of this.marks.values()){
    if(!inCell(m.x,m.z)) continue;
    if(m.kind==='c') this.drawCrosswalk(L,m);else if(m.kind==='s'||m.kind==='y') this.drawSign(L,m);else if(m.kind==='t') this.drawSignal(L,m,sigDone);
    yield* pause();
  }
  this._sg=null;
  return L;
};
/* ---------- street details: sidewalks, crosswalks, parking spaces, stop and yield signs ---------- */
TN.pip=function(x,z,P){let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i],b=P[j];
  if(((a[1]>z)!==(b[1]>z))&&(x<(b[0]-a[0])*(z-a[1])/((b[1]-a[1])||1e-9)+a[0])) c=!c;}return c;};
/* is (x,z) on (or within pad metres of) a ground road other than this one? */
TN.Net.prototype.nearOther=function(way,x,z,pad){
  const G=this._sg;
  if(G){
    const gx=Math.floor(x/10),gz=Math.floor(z/10);
    for(let ax=gx-1;ax<=gx+1;ax++) for(let az=gz-1;az<=gz+1;az++){
      const l=G.get(ax*1e6+az);if(!l) continue;
      for(const e of l){const w=e[0];if(w===way||w.br) continue;const r=TN.seg(w,e[1],x,z);if(r.d<TN.width(w)/2+pad) return true;}
    }
    return false;
  }
  let hit=false;
  this.near(x,z,pad,(w,i)=>{if(w===way||w.tun||w.br) return;const r=TN.seg(w,i,x,z);if(r.d<TN.width(w)/2+pad){hit=true;return true;}});
  return hit;
};
/* ground road pieces of an area in 10 m buckets (each piece in every bucket its box touches, widened by half its width) */
TN.Net.prototype.segGrid=function(cb){
  const G=new Map(),cand=new Set();
  for(let ix=Math.floor((cb[0]-30)/100);ix<=Math.floor((cb[1]+30)/100);ix++)
    for(let iz=Math.floor((cb[2]-30)/100);iz<=Math.floor((cb[3]+30)/100);iz++){const l=this.idx.get(ix*1e6+iz);if(l) for(const w of l) cand.add(w);}
  for(const w of cand){
    if(w.tun) continue;if(w.bb[1]<cb[0]-30||w.bb[0]>cb[1]+30||w.bb[3]<cb[2]-30||w.bb[2]>cb[3]+30) continue;
    const P=w.pts,h=TN.width(w)/2+2;
    for(let i=0;i<P.length-1;i++){
      const a=P[i],c=P[i+1];
      const x0=Math.floor((Math.min(a[0],c[0])-h)/10),x1=Math.floor((Math.max(a[0],c[0])+h)/10);
      const z0=Math.floor((Math.min(a[1],c[1])-h)/10),z1=Math.floor((Math.max(a[1],c[1])+h)/10);
      if((x1-x0+1)*(z1-z0+1)>400) continue;
      for(let gx=x0;gx<=x1;gx++) for(let gz=z0;gz<=z1;gz++){const k=gx*1e6+gz;let l=G.get(k);if(!l){l=[];G.set(k,l);}l.push([w,i]);}
    }
  }
  return G;
};
TN.WALK={primary:1,secondary:1,tertiary:1,minor:1};
/* sidewalks: a light concrete strip on both sides of city streets, raised 15 cm, with a grey curb;
   they stop before other streets (so they never cover a crossing street) and are left out on highways, ramps,
   bridges, parking aisles and raised roads */
TN.Net.prototype.drawWalks=function(L,w,runs){
  if(!TN.WALK[w.cls]||w.ramp||w.br||w.pa||(w.hs&&w.hs.some(h=>h>0.3))) return;
  const P=w.pts,N=TN.normals(P),WJ=this.widthsAlong(w),y=0.15,ww=2.0;
  for(const [a,b] of runs) for(let i=a;i<b;i++){
    const A=P[i],B=P[i+1],len=Math.hypot(B[0]-A[0],B[1]-A[1]);if(len<0.2) continue;
    const n=Math.max(1,Math.ceil(len/5));
    for(let k=0;k<n;k++){
      const u0=k/n,u1=(k+1)/n,um=(u0+u1)/2;
      const pt=u=>[A[0]+(B[0]-A[0])*u,A[1]+(B[1]-A[1])*u];
      const nn=u=>[N[i][0]+(N[i+1][0]-N[i][0])*u,N[i][1]+(N[i+1][1]-N[i][1])*u];
      const hw=u=>(WJ[i]+(WJ[i+1]-WJ[i])*u)/2+0.3;
      for(const sd of [1,-1]){
        const m=pt(um),q=nn(um),o=sd*(hw(um)+ww/2);
        if(this.nearOther(w,m[0]+q[0]*o,m[1]+q[1]*o,1.3)) continue;
        const v=(u,off,h)=>{const p=pt(u),c=nn(u);return [p[0]+c[0]*sd*off,h,p[1]+c[1]*sd*off];};
        TN.quad(L.curb,v(u0,hw(u0),y),v(u1,hw(u1),y),v(u1,hw(u1)+ww,y),v(u0,hw(u0)+ww,y),TN.C.walk);
        TN.quad(L.curb,v(u0,hw(u0)-0.3,y+0.002),v(u1,hw(u1)-0.3,y+0.002),v(u1,hw(u1),y+0.002),v(u0,hw(u0),y+0.002),TN.C.curbtop);
        TN.quad(L.curb,v(u0,hw(u0)-0.3,0.03),v(u1,hw(u1)-0.3,0.03),v(u1,hw(u1)-0.3,y),v(u0,hw(u0)-0.3,y),TN.C.post);
      }
    }
  }
};
/* painted parking spaces along parking aisles, only where the space lies inside a mapped parking lot */
TN.Net.prototype.drawStalls=function(L,w,runs){
  if(!this.parkings||w.br||w.hs) return;
  const P=w.pts,hw=TN.width(w)/2,lots=[];
  for(const pk of this.parkings.values()){const b=pk.bb;if(b[1]<w.bb[0]||b[0]>w.bb[1]||b[3]<w.bb[2]||b[2]>w.bb[3]) continue;lots.push(pk);}
  if(!lots.length) return;
  const inLot=(x,z)=>lots.some(pk=>x>=pk.bb[0]&&x<=pk.bb[1]&&z>=pk.bb[2]&&z<=pk.bb[3]&&TN.pip(x,z,pk.pts));
  const step=2.7,depth=5,half=0.06,y=0.05;
  for(const [a,b] of runs) for(let i=a;i<b;i++){
    const A=P[i],B=P[i+1],len=Math.hypot(B[0]-A[0],B[1]-A[1]);if(len<step*2) continue;
    const ux=(B[0]-A[0])/len,uz=(B[1]-A[1])/len,nx=uz,nz=-ux;
    /* each space: a line on each side running from the back line towards the aisle (open on the aisle side), and a
       solid back line along the row; rows facing each other meet at their back lines in the middle */
    const o0=hw+0.5,o1=hw+depth;
    const ln=(x0,z0,x1,z1,px,pz)=>TN.quad(L.mark,[x0+px,y,z0+pz],[x1+px,y,z1+pz],[x1-px,y,z1-pz],[x0-px,y,z0-pz],TN.C.white);
    for(const sd of [1,-1]){
      let runA=null,runB=null;
      const flush=()=>{if(runA!=null&&runB>runA){const xa=A[0]+ux*runA+nx*sd*o1,za=A[1]+uz*runA+nz*sd*o1,xb=A[0]+ux*runB+nx*sd*o1,zb=A[1]+uz*runB+nz*sd*o1;
          ln(xa-ux*half,za-uz*half,xb+ux*half,zb+uz*half,nx*half,nz*half);}runA=runB=null;};
      for(let s=step;s<=len-step+0.01;s+=step){
        /* the space between this line and the next one must lie inside the lot and off other roads */
        const sm=s+step/2,mx=A[0]+ux*sm+nx*sd*(hw+depth/2),mz=A[1]+uz*sm+nz*sd*(hw+depth/2);
        const ok=s+step<=len-step+0.01&&inLot(mx,mz)&&!this.nearOther(w,mx,mz,0.5);
        if(!ok){if(runA!=null){const x=A[0]+ux*runB,z=A[1]+uz*runB;}flush();continue;}
        for(const e of (runA==null?[s,s+step]:[s+step])){
          const x=A[0]+ux*e,z=A[1]+uz*e;
          ln(x+nx*sd*o0,z+nz*sd*o0,x+nx*sd*o1,z+nz*sd*o1,ux*half,uz*half);
        }
        if(runA==null) runA=s;runB=s+step;
      }
      flush();
    }
  }
};
/* ---------- REM: elevated guideway ---------- */
/* which REM pieces meet at each point (to follow the line from piece to piece) */
TN.Net.prototype.remLinks=function(){
  if(this._rlv===this.remVer&&this._rl) return this._rl;
  const m=new Map();if(this.rem) for(const w of this.rem.values()){for(const j of [0,w.pts.length-1]){const k=w.keys[j];let l=m.get(k);if(!l){l=[];m.set(k,l);}l.push([w,j]);}}
  this._rl=m;this._rlv=this.remVer;return m;
};
/* guideway height at each point: level with a road bridge it runs beside (the Champlain Bridge carries it in the
   middle), otherwise 9 m; coming down to the ground over 150 m where the elevated part ends */
TN.Net.prototype.remHeights=function(w){
  const v=this.ver+':'+(this.remVer||0);if(w.hv===v&&w.rh) return w.rh;
  const links=this.remLinks(),P=w.pts,hs=[];
  for(let j=0;j<P.length;j++){
    let h=-1;const x=P[j][0],z=P[j][1];
    this.near(x,z,30,(v2,i)=>{if(!v2.br) return;const r=TN.seg(v2,i,x,z);if(r.d<TN.width(v2)/2+30){
      const hh=v2.hs?v2.hs[i]+(v2.hs[i+1]-v2.hs[i])*r.u:v2.H;if(hh>h) h=hh;}});
    hs.push(h>3?h:9);
  }
  const free=j=>(links.get(w.keys[j])||[]).length<2;
  for(const [end,dir] of [[0,1],[P.length-1,-1]]){
    if(!free(end)) continue;
    for(let j=end;j>=0&&j<P.length;j+=dir){const d=Math.abs(w.cum[j]-w.cum[end]);if(d>150) break;hs[j]=Math.min(hs[j],hs[j]*(d/150));}
  }
  w.rh=hs;w.hv=v;return hs;
};
TN.remAt=function(w,hs,s){let i=0;while(i<w.pts.length-2&&w.cum[i+1]<s) i++;const sg=w.cum[i+1]-w.cum[i]||1,t=Math.max(0,Math.min(1,(s-w.cum[i])/sg));
  return {x:w.pts[i][0]+(w.pts[i+1][0]-w.pts[i][0])*t,z:w.pts[i][1]+(w.pts[i+1][1]-w.pts[i][1])*t,y:hs[i]+(hs[i+1]-hs[i])*t,ux:(w.pts[i+1][0]-w.pts[i][0])/sg,uz:(w.pts[i+1][1]-w.pts[i][1])/sg};};
TN.Net.prototype.drawRem=function(L,w,a,b){
  const P=w.pts,N=TN.normals(P),hs=this.remHeights(w),hw=2.5,G=L.road;   /* one track per map line */
  const at=(j,o,y)=>[P[j][0]+N[j][0]*o,y,P[j][1]+N[j][1]*o];
  for(let i=a;i<b;i++){
    const h0=hs[i],h1=hs[i+1];
    TN.quad(G,at(i,-hw,h0),at(i+1,-hw,h1),at(i+1,hw,h1),at(i,hw,h0),TN.C.remdeck);
    for(const o of [hw,-hw]){
      TN.quad(G,at(i,o,Math.max(0,h0-1.6)),at(i+1,o,Math.max(0,h1-1.6)),at(i+1,o,h1+0.6),at(i,o,h0+0.6),TN.C.remside);
    }
    TN.quad(G,at(i,-hw,Math.max(0,h0-1.6)),at(i+1,-hw,Math.max(0,h1-1.6)),at(i+1,hw,Math.max(0,h1-1.6)),at(i,hw,Math.max(0,h0-1.6)),TN.C.girder);
    /* the two rails of this track */
    for(const o of [-0.72,0.72]) TN.quad(L.mark,at(i,o-0.06,h0+0.08),at(i+1,o-0.06,h1+0.08),at(i+1,o+0.06,h1+0.08),at(i,o+0.06,h0+0.08),TN.C.rail);
  }
  /* single-column piers with a cap, every 32 m, where the guideway is high enough and not above a road */
  for(let s=Math.ceil(w.cum[a]/32)*32+16;s<w.cum[b];s+=32){
    const q=TN.remAt(w,hs,s);if(q.y<4) continue;
    if(this.nearOther(null,q.x,q.z,1.0)) continue;
    TN.box(G,q.x,q.z,q.ux,q.uz,2.0,2.0,0,q.y-2.6,TN.C.pier);
    TN.box(G,q.x,q.z,-q.uz,q.ux,4.6,1.8,q.y-2.6,q.y-1.6,TN.C.cap);
  }
};
/* a soft round glow made of rings: brightness k[i] at radius r[i] (0..1 of R). 'flat' lies on the ground (slightly
   longer along the road), 'ball' is three crossed discs so it looks round from every side */
TN.glowDisc=function(G,cx,cy,cz,R,k,r,col,kind,ux,uz){
  const n=16,planes=kind==='ball'?[[1,0,0,0,1,0],[0,0,1,0,1,0],[1,0,0,0,0,1]]:[[ux,0,uz,-uz,0,ux]];
  for(const pl of planes){
    const c0=G.n;G.p.push(cx,cy,cz);G.c.push(col[0]*k[0],col[1]*k[0],col[2]*k[0]);let nv=1;
    for(let ri=1;ri<r.length;ri++){const rr=R*r[ri],kk=k[ri];
      for(let q=0;q<n;q++){const an=q/n*Math.PI*2,a=Math.cos(an)*rr*(kind==='flat'?1.15:1),b=Math.sin(an)*rr*(kind==='flat'?0.9:1);
        G.p.push(cx+pl[0]*a+pl[3]*b,cy+pl[1]*a+pl[4]*b,cz+pl[2]*a+pl[5]*b);G.c.push(col[0]*kk,col[1]*kk,col[2]*kk);nv++;}}
    for(let q=0;q<n;q++) G.i.push(c0,c0+1+q,c0+1+(q+1)%n);
    for(let ri=1;ri<r.length-1;ri++){const a0=c0+1+(ri-1)*n,b0=c0+1+ri*n;
      for(let q=0;q<n;q++){const q1=(q+1)%n;G.i.push(a0+q,b0+q,b0+q1,a0+q,b0+q1,a0+q1);}}
    G.n+=nv;
  }
};
/* street lights: posts with an arm over the road along highways, main streets and bridges, about every 40-50 m.
   At night (glow layer) the lamp heads shine warm yellow and each lamp casts a soft pool of warm light on the road. */
/* is there a road surface (ground, ramp or bridge) at (x,z) within pad metres, at about height y? */
TN.Net.prototype.roadAtHeight=function(x,z,y,pad){
  const hit=(w,i)=>{if(w.tun) return false;const r=TN.seg(w,i,x,z);if(r.d>=TN.width(w)/2+pad) return false;
    const h=w.hs?w.hs[i]+(w.hs[i+1]-w.hs[i])*r.u:(w.br?w.H:0);return Math.abs(h-y)<1.5;};
  const G=this._sg;
  if(G){for(let ax=Math.floor(x/10)-1;ax<=Math.floor(x/10)+1;ax++) for(let az=Math.floor(z/10)-1;az<=Math.floor(z/10)+1;az++){
      const l=G.get(ax*1e6+az);if(l) for(const e of l) if(hit(e[0],e[1])) return true;}
    return false;}
  let f=false;this.near(x,z,pad,(w,i)=>{if(hit(w,i)){f=true;return true;}});return f;
};
TN.LIGHT={motorway:65,trunk:60,primary:52,secondary:55,tertiary:58,minor:70};
/* lamp height: tall on highways and main streets, lower on residential streets */
TN.LAMPH={motorway:9.5,trunk:9,primary:8.5,secondary:8.5,tertiary:7.5,minor:6.5};
TN.Net.prototype.drawLights=function(L,w,runs){
  if(w.tun||w.pa) return;
  const sp=w.br?52:TN.LIGHT[w.cls];if(!sp) return;
  const P=w.pts,N=TN.normals(P),hw=TN.width(w)/2,H=j=>w.hs?w.hs[j]:(w.br?w.H:0);
  for(const [a,b] of runs){
    for(let s=Math.ceil(w.cum[a]/sp)*sp+sp*0.3;s<w.cum[b];s+=sp){
      let i=a;while(i<b-1&&w.cum[i+1]<s) i++;
      const sg=w.cum[i+1]-w.cum[i]||1,t=Math.max(0,Math.min(1,(s-w.cum[i])/sg));
      const x0=P[i][0]+(P[i+1][0]-P[i][0])*t,z0=P[i][1]+(P[i+1][1]-P[i][1])*t,y0=H(i)+(H(i+1)-H(i))*t;
      const ux=(P[i+1][0]-P[i][0])/sg,uz=(P[i+1][1]-P[i][1])/sg;
      /* right side of the driving direction for one-way roads; alternating sides on two-way streets */
      const k=Math.round(s/sp);let side=w.ow===-1?1:-1;if(!w.ow&&k%2&&w.cls!=='minor') side=-side;
      const nx=N[i][0]*side,nz=N[i][1]*side,nl=Math.hypot(nx,nz)||1,ox=nx/nl,oz=nz/nl;
      /* never on a road: checked for every lamp, raised roads included (any road surface at about the same height),
         trying a little further out before leaving the lamp out */
      let x=0,z=0,ok=false;
      for(const extra of [0,1,2]){
        const off=(w.br||y0>0.5?hw+0.25:hw+0.9)+extra;x=x0+ox*off;z=z0+oz*off;
        if(!this.roadAtHeight(x,z,y0,0.6)){ok=true;break;}
        if(w.br||y0>0.5) break;
      }
      if(!ok) continue;
      const rx=-ox,rz=-oz,top=y0+(w.br?8.5:(TN.LAMPH[w.cls]||8));
      TN.box(L.road,x,z,ux,uz,0.18,0.18,y0,top,TN.C.post);
      TN.box(L.road,x+rx*1.1,z+rz*1.1,rx,rz,2.2,0.12,top-0.2,top-0.06,TN.C.post);
      const hx=x+rx*2.2,hz=z+rz*2.2;
      TN.box(L.road,hx,hz,rx,rz,0.6,0.3,top-0.36,top-0.16,TN.C.lamp);
      /* night: the lamp's lit underside and its pool of light (bright in the middle, fading out) */
      const G=L.glow,gc=TN.C.glowc;
      TN.quad(G,[hx-rx*0.28-ux*0.13,top-0.37,hz-rz*0.28-uz*0.13],[hx+rx*0.28-ux*0.13,top-0.37,hz+rz*0.28-uz*0.13],
                [hx+rx*0.28+ux*0.13,top-0.37,hz+rz*0.28+uz*0.13],[hx-rx*0.28+ux*0.13,top-0.37,hz-rz*0.28+uz*0.13],[1,0.88,0.62]);
      /* a wide pool of light (about 13 m) with a smooth fade, so neighbouring lamps blend into a lit street */
      TN.glowDisc(G,x+rx*2.4,y0+0.1,z+rz*2.4,13,[0.46,0.33,0.16,0.05,0],[0,0.25,0.5,0.78,1],gc,'flat',ux,uz);
      /* the lamp itself shines: a soft halo around the head, seen from any side */
      TN.glowDisc(G,hx,top-0.3,hz,1.1,[0.95,0.5,0.12,0],[0,0.25,0.6,1],[1,0.84,0.55],'ball',ux,uz);
    }
  }
};
/* the Samuel-De Champlain Bridge pylon: a twin-leg concrete tower about 168 m tall standing between the two road
   decks, about 1 km from the Brossard end, with harp-pattern cables (parallel lines) down to both decks: the
   240 m main span towards Brossard over the Seaway and the 124 m back span towards Nuns' Island.
   Position estimated from the bridge's published ends and span lengths (within about 100 m). */
TN.CHAMPLAIN={lng:-73.5048,lat:45.4679};
TN.Net.prototype.champlainTower=function(L){
  const T=TN.toLocal(TN.CHAMPLAIN.lng,TN.CHAMPLAIN.lat);
  /* the two road decks nearest the tower point */
  const decks=new Map();
  this.near(T[0],T[1],80,(w,i)=>{if(!w.br||!/champlain/i.test(w.name||'')) return;const r=TN.seg(w,i,T[0],T[1]);
    const k=w.ow===-1?'b':'f',o=decks.get(k);if(!o||r.d<o.d) decks.set(k,{w:w,i:i,u:r.u,d:r.d,x:r.qx,z:r.qz});});
  if(!decks.size) return;
  const D=[...decks.values()];
  let cx=0,cz=0;for(const d of D){cx+=d.x;cz+=d.z;}cx/=D.length;cz/=D.length;
  const w0=D[0].w,p0=w0.pts[D[0].i],p1=w0.pts[D[0].i+1];
  let ax=p1[0]-p0[0],az=p1[1]-p0[1];const al=Math.hypot(ax,az)||1;ax/=al;az/=al;
  /* main span side: the one heading east (towards Brossard) */
  const east=ax>=0?1:-1;
  const nx=-az,nz=ax,deck=TN.heightAt(w0,w0.cum[D[0].i]+D[0].u*(w0.cum[D[0].i+1]-w0.cum[D[0].i]))||15;
  const G=L.road,top=deck+150;
  /* two legs leaning in, joined near the top, with a cross beam under the decks */
  for(const sd of [1,-1]){
    const seg=[[0,deck+30,9,5.5],[deck+30,deck+95,6.5,4.5],[deck+95,top,4,3.4]];
    for(const [y0,y1,off,sz] of seg) TN.box(G,cx+nx*sd*off,cz+nz*sd*off,ax,az,sz,sz*0.8,y0,y1,TN.C.tower);
  }
  TN.box(G,cx,cz,nx,nz,22,4,deck-4,deck-1.5,TN.C.cap);
  TN.box(G,cx,cz,nx,nz,9,3.4,top-12,top-8,TN.C.tower);
  TN.box(G,cx,cz,ax,az,4.5,4.5,top-8,top+4,TN.C.tower);
  /* harp cables: 15 pairs per side, parallel, from the legs to each deck */
  const cc=TN.C.cable;
  for(const d of D){
    const w=d.w,s0=w.cum[d.i]+d.u*(w.cum[d.i+1]-w.cum[d.i]);
    const side=Math.sign((d.x-cx)*nx+(d.z-cz)*nz)||1,lx=cx+nx*side*3.5,lz=cz+nz*side*3.5;
    /* this deck's own drawing direction relative to east */
    const q0=w.pts[d.i],q1=w.pts[d.i+1],dirE=Math.sign((q1[0]-q0[0])*ax*east+(q1[1]-q0[1])*az*east)||1;
    /* harp: every cable on a side has the same slope (parallel lines); anchors climb the tower evenly */
    for(const [span,slope] of [[1,0.62],[-1,1.2]]) for(let k=1;k<=15;k++){
      const rise=20+k*8.5,sa=s0+dirE*span*rise/slope;if(sa<0||sa>w.L) continue;
      let i=0;while(i<w.pts.length-2&&w.cum[i+1]<sa) i++;
      const sg=w.cum[i+1]-w.cum[i]||1,t=Math.max(0,Math.min(1,(sa-w.cum[i])/sg));
      let bx=w.pts[i][0]+(w.pts[i+1][0]-w.pts[i][0])*t,bz=w.pts[i][1]+(w.pts[i+1][1]-w.pts[i][1])*t;const by=TN.heightAt(w,sa)+1.0;
      {const toT=Math.sign((cx-bx)*nx+(cz-bz)*nz)||1,hw2=TN.width(w)/2+0.3;bx+=nx*toT*hw2;bz+=nz*toT*hw2;}
      const ay=deck+rise;
      TN.quad(G,[lx,ay,lz],[bx,by,bz],[bx,by+0.3,bz],[lx,ay+0.3,lz],cc);
    }
  }
};
/* the painted parking space nearest to (x,z), within 3.5 m of its middle: its middle and the heading of a car
   parked in it (nose in or backed in, whichever is closer to the car's current heading) */
TN.Net.prototype.stallNear=function(x,z,hd){
  if(!this.parkings) return null;
  const aisles=new Set();this.near(x,z,12,(w,i)=>{if(w.pa&&!w.br&&!w.hs) aisles.add(w);});
  if(!aisles.size) return null;
  const step=2.7,depth=5;let best=null;
  for(const w of aisles){
    const P=w.pts,hw=TN.width(w)/2;
    const lots=[];for(const pk of this.parkings.values()){const b=pk.bb;if(x<b[0]-15||x>b[1]+15||z<b[2]-15||z>b[3]+15) continue;lots.push(pk);}
    for(let i=0;i<P.length-1;i++){
      const A=P[i],B=P[i+1],len=Math.hypot(B[0]-A[0],B[1]-A[1]);if(len<step*2) continue;
      const ux=(B[0]-A[0])/len,uz=(B[1]-A[1])/len,nx=uz,nz=-ux;
      const along=(x-A[0])*ux+(z-A[1])*uz;if(along<-5||along>len+5) continue;
      const kc=Math.floor((along-step)/step);
      for(const kk of [kc-1,kc,kc+1]){
        const s0=step+kk*step,sm=s0+step/2;if(s0<step-0.01||s0+step>len-step+0.01) continue;
        for(const sd of [1,-1]){
          const mx=A[0]+ux*sm+nx*sd*(hw+depth/2),mz=A[1]+uz*sm+nz*sd*(hw+depth/2),d=Math.hypot(mx-x,mz-z);
          if(d>3.5||(best&&d>=best.d)) continue;
          if(!lots.some(pk=>TN.pip(mx,mz,pk.pts))||this.nearOther(w,mx,mz,0.5)) continue;
          let h1=(Math.atan2(nx*sd,-nz*sd)/TN.R+360)%360;const h2=(h1+180)%360;
          const ad=(a,b)=>{const d2=Math.abs(((a-b)%360+540)%360-180);return d2;};
          best={x:mx,z:mz,d:d,hd:ad(h1,hd)<=ad(h2,hd)?h1:h2};
        }
      }
    }
  }
  return best;
};
/* the ground road a mapped point lies on: by its vertex when it is one of the road's points, otherwise nearest */
TN.Net.prototype.roadAt=function(m){
  const hits=(this.keys.get(m.key)||[]).filter(h=>!h[0].br&&!h[0].tun);
  if(hits.length===1||(hits.length>1&&m.kind==='c')) return {w:hits[0][0],i:hits[0][1],exact:true};
  if(hits.length>1){
    /* a sign on a junction point: the smaller street is the one that stops */
    const rank={motorway:6,trunk:5,primary:4,secondary:3,tertiary:2,minor:1,service:0};
    hits.sort((p,q)=>(rank[p[0].cls]||0)-(rank[q[0].cls]||0));return {w:hits[0][0],i:hits[0][1],exact:true,atJ:true};
  }
  let best=null;
  this.near(m.x,m.z,8,(w,i)=>{if(w.br||w.tun) return;const r=TN.seg(w,i,m.x,m.z);if(r.d<TN.width(w)/2+8&&(!best||r.d<best.d)) best={w:w,i:i,u:r.u,d:r.d};});
  return best;
};
TN.Net.prototype.drawCrosswalk=function(L,m){
  const r=this.roadAt(m);if(!r||r.w.ramp||TN.width(r.w)>30) return;
  const w=r.w,P=w.pts,i=Math.min(r.i,P.length-2),A=P[Math.max(0,i===r.i?i:i)],B=P[i+1];
  const len=Math.hypot(B[0]-A[0],B[1]-A[1])||1,ux=(B[0]-A[0])/len,uz=(B[1]-A[1])/len,nx=uz,nz=-ux;
  const cx=r.exact?P[r.i][0]:m.x,cz=r.exact?P[r.i][1]:m.z,hw=TN.width(w)/2,y=0.07,along=1.5;
  /* zebra stripes: 0.5 m wide, 0.5 m apart, running along the road, across its whole width */
  for(let o=-hw+0.4;o<=hw-0.4;o+=1.0){
    const ox=cx+nx*o,oz=cz+nz*o;
    TN.quad(L.mark,[ox-ux*along,y,oz-uz*along],[ox+ux*along,y,oz+uz*along],[ox+ux*along+nx*0.5,y,oz+uz*along+nz*0.5],[ox-ux*along+nx*0.5,y,oz-uz*along+nz*0.5],TN.C.white);
  }
};
/* where a stop or yield sign goes: at the corner of the junction it belongs to, on the right side of the road for
   the traffic it is meant for, facing that traffic; returns null when no junction is close enough */
TN.Net.prototype.signPlace=function(m){
  const r=this.roadAt(m);if(!r||!r.w) return null;
  const w=r.w,P=w.pts;
  let i0=r.exact?r.i:(r.u>0.5?r.i+1:r.i);
  const deg=j=>(this.keys.get(w.keys[j])||[]).filter(h=>!h[0].tun).length;
  const findJ=dir=>{let d=0;for(let j=i0;j>=0&&j<P.length;j+=dir){
      if(j!==i0) d+=Math.hypot(P[j][0]-P[j-dir][0],P[j][1]-P[j-dir][1]);
      if(d>(m.kind==='y'?90:45)) return null;if(deg(j)>1&&(j!==i0||r.atJ)) return {j:j,d:d};}
    return null;};
  let dir=m.dir==='f'?1:m.dir==='b'?-1:0,J=null;
  if(m.kind==='y'&&w.ramp){
    const k=Math.max(0,Math.min(P.length-2,i0>=P.length-1?P.length-2:i0)),dd=dir||(w.ow===-1?-1:1);
    let dx=(P[k+1][0]-P[k][0])*dd,dz=(P[k+1][1]-P[k][1])*dd;const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;
    const rx=-dz,rz=dx,hw=TN.width(w)/2,bx=r.exact?P[i0][0]:m.x,bz=r.exact?P[i0][1]:m.z;
    for(const [db,ds] of [[0,0],[3,0],[0,1.5],[6,0]]){const x=bx-dx*db+rx*(hw+1.5+ds),z=bz-dz*db+rz*(hw+1.5+ds);
      if(this.nearOther(null,x,z,0.4)) continue;
      return {x:x,z:z,dx:dx,dz:dz,rx:rx,rz:rz,lx:bx,lz:bz,hw:hw,ow:w.ow,way:w};}
    return null;
  }
  if(dir) J=findJ(dir);
  else{const f=findJ(1),b=findJ(-1);if(f&&(!b||f.d<=b.d)){J=f;dir=1;}else if(b){J=b;dir=-1;}}
  if(!J) return null;
  return this.approachPlace(w,J.j,dir);
};
/* the corner spot for traffic arriving at point j of road w, moving in direction dir along it: on the right side,
   just before the junction, never in a road */
TN.Net.prototype.approachPlace=function(w,j,dir){
  const P=w.pts;
  const jp=Math.max(0,Math.min(P.length-1,j-dir));
  let dx=P[j][0]-P[jp][0],dz=P[j][1]-P[jp][1];const dl=Math.hypot(dx,dz)||1;dx/=dl;dz/=dl;
  if(j===jp){return null;}
  /* the widest other road at the junction decides how far back the corner is */
  let ow=0;for(const h of this.keys.get(w.keys[j])||[]) if(h[0]!==w&&!h[0].tun) ow=Math.max(ow,TN.width(h[0])/2);
  const back=ow+2.6,hw=TN.width(w)/2;
  const rx=-dz,rz=dx;                              /* right of the driving direction */
  const inRoad=(x,z)=>this.nearOther(null,x,z,0.4);
  for(const [db,ds] of [[0,0],[2,0],[0,1],[4,0],[2,1],[6,0.5],[-1.5,0.8]]){
    const bk=back+db,sd=hw+1.2+ds,x=P[j][0]-dx*bk+rx*sd,z=P[j][1]-dz*bk+rz*sd;
    if(inRoad(x,z)) continue;
    return {x:x,z:z,dx:dx,dz:dz,rx:rx,rz:rz,lx:P[j][0]-dx*(bk-0.8),lz:P[j][1]-dz*(bk-0.8),hw:hw,ow:w.ow,way:w};
  }
  return null;
};
/* traffic lights: at a mapped light on a junction point, one for every road arriving there; at a light mapped
   before the junction, one for that approach. A pole on the right corner with an arm over the lanes, signal heads
   facing the traffic, a smaller head on the pole, and a stop line. The lamps show their colours equally (none lit:
   the app can't know the real light). */
TN.Net.prototype.signalPlaces=function(m){
  const hits=(this.keys.get(m.key)||[]).filter(h=>!h[0].br&&!h[0].tun&&h[0].cls!=='service');
  const out=[];
  if(hits.length>=2){
    for(const [w,j] of hits){
      if(j>0&&w.ow!==-1){const S=this.approachPlace(w,j,1);if(S) out.push(S);}
      if(j<w.pts.length-1&&w.ow!==1){const S=this.approachPlace(w,j,-1);if(S) out.push(S);}
    }
    return out;
  }
  const S=this.signPlace(m);if(S) out.push(S);
  return out;
};
TN.Net.prototype.drawSignal=function(L,m,done){
  const G=L.road;
  for(const S of this.signalPlaces(m)){
    /* the same approach can be reached from two mapped lights: draw it once */
    const key=Math.round(S.x/3)+','+Math.round(S.z/3);if(done.has(key)) continue;done.add(key);
    const top=6.2,post=TN.C.post;
    TN.box(G,S.x,S.z,S.dx,S.dz,0.22,0.22,0,top+0.2,post);
    /* arm towards the middle of the lanes going into the junction */
    const side=S.hw+1.2,mid=S.ow?0:S.hw/2,reach=Math.max(2,side-mid+1.2);
    const ax=S.x-S.rx*reach/2,az=S.z-S.rz*reach/2;
    TN.box(G,ax,az,-S.rx,-S.rz,reach,0.14,top,top+0.16,post);
    const head=(hx,hz,y0,sz)=>{
      /* housing, then the three lamps in front of it, facing the traffic (-d) */
      TN.box(G,hx,hz,S.rx,S.rz,0.36*sz,0.26*sz,y0,y0+1.0*sz,TN.C.sigbox);
      const fx=hx-S.dx*(0.15*sz),fz=hz-S.dz*(0.15*sz),r=0.11*sz;
      [[TN.C.sigred,0.80],[TN.C.sigyel,0.50],[TN.C.siggrn,0.20]].forEach(([c,v])=>{
        const cy=y0+v*sz,ring=[];for(let k=0;k<8;k++){const a=k/8*Math.PI*2;ring.push([Math.cos(a)*r,Math.sin(a)*r]);}
        for(let k=0;k<8;k++){const p=ring[k],q=ring[(k+1)%8];
          const C=[fx,cy,fz],A=[fx+S.rx*p[0],cy+p[1],fz+S.rz*p[0]],B=[fx+S.rx*q[0],cy+q[1],fz+S.rz*q[0]];
          for(const tri of [[C,A,B],[C,B,A]]){const b=G.n;for(const v2 of tri){G.p.push(v2[0],v2[1],v2[2]);G.c.push(c[0],c[1],c[2]);}G.i.push(b,b+1,b+2);G.n+=3;}}
      });
    };
    const n=S.hw>5&&!S.ow?1:(S.hw>5?2:1);
    for(let k=0;k<n;k++){const o=side-mid-(n===1?0:(k===0?-S.hw*0.35:S.hw*0.35));const hx=S.x-S.rx*o,hz=S.z-S.rz*o;head(hx,hz,top-1.05,1);}
    head(S.x-S.dx*0.2,S.z-S.dz*0.2,2.6,0.8);
    /* stop line across the lanes going into the junction */
    const y=0.075,o0=S.ow?-S.hw:0,o1=S.hw;
    const p=(o,a)=>[S.lx+S.rx*o+S.dx*a,y,S.lz+S.rz*o+S.dz*a];
    TN.quad(L.mark,p(o0,-0.2),p(o1,-0.2),p(o1,0.2),p(o0,0.2),TN.C.white);
  }
};
TN.Net.prototype.drawSign=function(L,m){
  const S=this.signPlace(m);if(!S) return;
  const G=L.road,post=TN.C.post;
  /* post */
  TN.box(G,S.x,S.z,S.dx,S.dz,0.08,0.08,0,m.kind==='s'?1.62:1.5,post);
  /* plate faces the traffic coming towards it (facing -d), both sides drawn */
  const cx=S.x-S.dx*0.06,cz=S.z-S.dz*0.06,cy=2.05;
  const plate=(pts,col)=>{const c=[cx,cy,cz];for(let k=0;k<pts.length;k++){const a=pts[k],b=pts[(k+1)%pts.length];
      const A=[cx+S.rx*a[0],cy+a[1],cz+S.rz*a[0]],B=[cx+S.rx*b[0],cy+b[1],cz+S.rz*b[0]];
      for(const tri of [[c,A,B],[c,B,A]]){const base=G.n;for(const v of tri){G.p.push(v[0],v[1],v[2]);G.c.push(col[0],col[1],col[2]);}G.i.push(base,base+1,base+2);G.n+=3;}}};
  if(m.kind==='s'){
    const oct=[];for(let k=0;k<8;k++){const a=Math.PI/8+k*Math.PI/4;oct.push([Math.cos(a)*0.4,Math.sin(a)*0.4]);}
    /* white border ring, then the red face, then "ARRÊT" in smooth bold strokes */
    /* white border: a ring around the red face (the two never overlap, so they can't flicker) */
    for(let k=0;k<8;k++){const a0=Math.PI/8+k*Math.PI/4,a1=a0+Math.PI/4;
      const o0=[Math.cos(a0)*0.43,Math.sin(a0)*0.43],o1=[Math.cos(a1)*0.43,Math.sin(a1)*0.43],i0=[Math.cos(a0)*0.39,Math.sin(a0)*0.39],i1=[Math.cos(a1)*0.39,Math.sin(a1)*0.39];
      const P3=q=>[cx+S.rx*q[0],cy+q[1],cz+S.rz*q[0]];
      TN.quad(G,P3(o0),P3(o1),P3(i1),P3(i0),TN.C.signw);TN.quad(G,P3(o0),P3(i0),P3(i1),P3(o1),TN.C.signw);}
    {const c0=[cx,cz];const sv={x:cx,z:cz};
     const face=[];for(let k=0;k<8;k++){const a=Math.PI/8+k*Math.PI/4;face.push([Math.cos(a)*0.39,Math.sin(a)*0.39]);}
     const fx=cx,fz=cz;
     for(let k=0;k<8;k++){const a=face[k],b=face[(k+1)%8];
       const A=[fx+S.rx*a[0],cy+a[1],fz+S.rz*a[0]],B=[fx+S.rx*b[0],cy+b[1],fz+S.rz*b[0]],C=[fx,cy,fz],col=TN.C.stopred;
       for(const tri of [[C,A,B],[C,B,A]]){const base=G.n;for(const v of tri){G.p.push(v[0],v[1],v[2]);G.c.push(col[0],col[1],col[2]);}G.i.push(base,base+1,base+2);G.n+=3;}}}
    const LET={A:[[[0,0],[0.5,1.4],[1,0]],[[0.22,0.55],[0.78,0.55]]],
      R:[[[0,0],[0,1.4],[0.68,1.4],[0.95,1.22],[0.95,0.93],[0.68,0.75],[0,0.75]],[[0.42,0.75],[1,0]]],
      E:[[[1,1.4],[0,1.4],[0,0],[1,0]],[[0,0.72],[0.82,0.72]]],
      T:[[[0,1.4],[1,1.4]],[[0.5,1.4],[0.5,0]]]};
    const word='ARRET',lw=0.094,gap=0.034,lh=0.15,th=0.029,u0=-(word.length*lw+(word.length-1)*gap)/2,v0=-lh/2;
    const tx=cx-S.dx*0.03,tz=cz-S.dz*0.03,wc=TN.C.signw;
    const seg=(ua,va,ub,vb)=>{const du=ub-ua,dv=vb-va,l=Math.hypot(du,dv)||1,pu=-dv/l*th/2,pv=du/l*th/2,eu=du/l*th/2,ev=dv/l*th/2;
      const P=(u,v)=>[tx+S.rx*u,cy+v,tz+S.rz*u];
      const A=P(ua-eu+pu,va-ev+pv),B=P(ub+eu+pu,vb+ev+pv),C=P(ub+eu-pu,vb+ev-pv),D=P(ua-eu-pu,va-ev-pv);
      TN.quad(G,A,B,C,D,wc);TN.quad(G,A,D,C,B,wc);};
    for(let c=0;c<word.length;c++){
      const ox=u0+c*(lw+gap);
      for(const line of LET[word[c]]) for(let k=0;k<line.length-1;k++){const a=line[k],b=line[k+1];
        seg(ox+a[0]*lw,v0+a[1]/1.4*lh,ox+b[0]*lw,v0+b[1]/1.4*lh);}
      if(c===3){seg(ox+0.15*lw,v0+lh+0.025,ox+0.5*lw,v0+lh+0.05);seg(ox+0.5*lw,v0+lh+0.05,ox+0.85*lw,v0+lh+0.025);}
    }
    /* stop line across the lanes going into the junction */
    const y=0.075,o0=S.ow?-S.hw:0,o1=S.hw;
    const p=(o,a)=>[S.lx+S.rx*o+S.dx*a,y,S.lz+S.rz*o+S.dz*a];
    TN.quad(L.mark,p(o0,-0.2),p(o1,-0.2),p(o1,0.2),p(o0,0.2),TN.C.white);
  }else{
    plate([[-0.45,0.26],[0.45,0.26],[0,-0.52]],TN.C.stopred);
    const c=[cx-S.dx*0.01,cz-S.dz*0.01];
    const inner=[[-0.3,0.17],[0.3,0.17],[0,-0.35]];
    const G2=G;const col=TN.C.signw;
    for(const tri of [[0,1,2],[0,2,1]]){const base=G2.n;for(const k of tri){const a=inner[k];G2.p.push(c[0]+S.rx*a[0]-S.dx*0.03,cy+a[1],c[1]+S.rz*a[0]-S.dz*0.03);G2.c.push(col[0],col[1],col[2]);}G2.i.push(base,base+1,base+2);G2.n+=3;}
  }
};
TN.Net.prototype.drawWay=function(L,w,runs){
  const net=this,P=w.pts,N=TN.normals(P),W=TN.width(w),hw=W/2;
  const H=j=>w.hs?w.hs[j]:(w.br?w.H:0);
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
        if(edgeOut&&net.onOther(w,mx+ux*edgeOut*2,mz+uz*edgeOut*2,hh(um)-0.06)) continue;
        if(edgeOut&&nearJoin(s0+(d0+d1)/2-s0)) continue;
        const o0=oo(u0),o1=oo(u1);
        TN.quad(G,[A[0]+ux*(o0+half),hh(u0),A[1]+uz*(o0+half)],[B[0]+ux*(o1+half),hh(u1),B[1]+uz*(o1+half)],
                  [B[0]+ux*(o1-half),hh(u1),B[1]+uz*(o1-half)],[A[0]+ux*(o0-half),hh(u0),A[1]+uz*(o0-half)],col);
      }
    }
  };
  const major=['motorway','trunk','primary','secondary'].indexOf(w.cls)>=0;
  /* a ramp's own edge lines stop 35 m before the point where it joins (or leaves) another road, so no white line
     runs across the place where it merges into the highway */
  const joinsAt=j=>(this.keys.get(w.keys[j])||[]).length>1;
  const nearJoin=w.ramp?(s0=>(joinsAt(0)&&s0<35)||(joinsAt(P.length-1)&&s0>w.L-35)):()=>false;
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
    const raised=w.hs?w.hs.some((h,j)=>j>=a&&j<=b&&h>0.3):(w.br&&w.H>0);
    if(raised){
      /* low ramps: solid embankment wall to the ground; higher up: a 1.2 m deck with open space below (so roads
         passing underneath stay visible) */
      const bot=j=>w.br?Math.max(0,H(j)-1.2):Math.min(Math.max(0,H(j)-1.2),Math.max(0,(H(j)-3)*2));
      wall(L.road,a,b,j=>hwJ(j),0.04,bot,TN.C.side);wall(L.road,a,b,j=>-hwJ(j),0.04,bot,TN.C.side);
      wall(L.road,a,b,j=>hwJ(j),1.0,j=>H(j)+0.04,TN.C.barrier);wall(L.road,a,b,j=>-hwJ(j),1.0,j=>H(j)+0.04,TN.C.barrier);
    }
    if(!w.br&&w.hs) this.rampPiers(L,w,a,b);
    /* girders: two beams under the deck of a bridge, seen from the side */
    if(w.br) for(let i=a;i<b;i++){
      if(Math.min(H(i),H(i+1))<3) continue;
      for(const o of [hw*0.55,-hw*0.55]) for(const e of [0.45,-0.45]){
        const p=(j,y)=>[P[j][0]+N[j][0]*(o+e),y,P[j][1]+N[j][1]*(o+e)];
        TN.quad(L.road,p(i,H(i)-1.2),p(i+1,H(i+1)-1.2),p(i+1,H(i+1)-2.0),p(i,H(i)-2.0),TN.C.girder);
      }
      const q=(j,o,y)=>[P[j][0]+N[j][0]*o,y,P[j][1]+N[j][1]*o];
      for(const o of [hw*0.55,-hw*0.55]) TN.quad(L.road,q(i,o-0.45,H(i)-2.0),q(i+1,o-0.45,H(i+1)-2.0),q(i+1,o+0.45,H(i+1)-2.0),q(i,o+0.45,H(i)-2.0),TN.C.girder);
    }

    if(w.br&&(w.hs?Math.max(...w.hs):w.H)>=3){
      const step=W>=9?36:28;
      for(let s=Math.ceil(w.cum[a]/step)*step+step/2;s<w.cum[b];s+=step){
        let i=0;while(i<P.length-2&&w.cum[i+1]<s) i++;
        const sg=w.cum[i+1]-w.cum[i]||1,t=(s-w.cum[i])/sg;
        const dh=TN.heightAt(w,s);if(dh<3) continue;
        const x=P[i][0]+(P[i+1][0]-P[i][0])*t,z=P[i][1]+(P[i+1][1]-P[i][1])*t;
        const ux=(P[i+1][0]-P[i][0])/sg,uz=(P[i+1][1]-P[i][1])/sg,nx=-uz,nz=ux;
        const cols=W>=9?[-W*0.3,W*0.3]:[0];
        let onRoad=false;
        for(const o of cols){const px=x+nx*o,pz=z+nz*o;this.near(px,pz,0,(v,k)=>{if(v.br||v.tun) return;const r=TN.seg(v,k,px,pz);if(r.d<v.w/2+1.2){onRoad=true;return true;}});}
        if(onRoad) continue;
        /* T-shaped piers: column(s) with a cap beam under the deck */
        for(const o of cols) TN.box(L.road,x+nx*o,z+nz*o,ux,uz,1.2,1.2,0,dh-2.1,TN.C.pier);
        TN.box(L.road,x,z,nx,nz,Math.max(3,W*0.82),1.6,dh-2.1,dh-1.2,TN.C.cap);
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
    this.near(x,z,0,(v,k)=>{if(v===w||v.tun) return;const r=TN.seg(v,k,x,z),vh=v.hs?v.hs[k]:(v.br?v.H:0);if(r.d<TN.width(v)/2+1.2&&vh<h-2){onRoad=true;return true;}});
    if(!onRoad) TN.box(L.road,x,z,ux,uz,1.3,Math.min(W*0.5,6),0,h-1.2,TN.C.pier);
  }
};
/* triangles of a simple polygon (ear clipping); returns index triples */
TN.earcut=function(P){
  const n=P.length;if(n<3) return [];
  let a=0;for(let i=0;i<n;i++){const p=P[i],q=P[(i+1)%n];a+=p[0]*q[1]-q[0]*p[1];}
  const idx=[];for(let i=0;i<n;i++) idx.push(a>0?i:n-1-i);
  const out=[],cross=(o,p,q)=>(p[0]-o[0])*(q[1]-o[1])-(p[1]-o[1])*(q[0]-o[0]);
  const inside=(p,a2,b2,c2)=>cross(a2,b2,p)>=0&&cross(b2,c2,p)>=0&&cross(c2,a2,p)>=0;
  let guard=0;
  while(idx.length>3&&guard++<n*n){
    let cut=false;
    for(let i=0;i<idx.length;i++){
      const i0=idx[(i+idx.length-1)%idx.length],i1=idx[i],i2=idx[(i+1)%idx.length],A=P[i0],B=P[i1],C=P[i2];
      if(cross(A,B,C)<=0) continue;
      let ok=true;for(const j of idx){if(j===i0||j===i1||j===i2) continue;if(inside(P[j],A,B,C)){ok=false;break;}}
      if(!ok) continue;
      out.push([i0,i1,i2]);idx.splice(i,1);cut=true;break;
    }
    if(!cut) break;
  }
  if(idx.length===3) out.push([idx[0],idx[1],idx[2]]);
  return out;
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
