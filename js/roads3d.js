/* TessyNav roads3d v2 — (v2: no flicker, markings not drawn across other roads, car height from the road it is on, buildings over roads lifted)
   TessyNav roads3d v1 — step 1 of the 3D road rebuild (test mode: add &test3d=1 to the address)

   Roads are drawn as real 3D surfaces with their own height, the way codriver does it:
   - built once per road area (0.005 deg) from our own road tiles, and kept; areas far behind are deleted
   - no lighting to compute: colors are baked (unlit), so roads look the same day or night, no flicker
   - bridges are part of the road surface: the bridge deck sits at its height, and the ground roads that lead
     onto it rise smoothly along their own length (about 5% slope), so there are no grass ramps at all
   - small bridges that cross nothing are drawn as normal flat road
   - the old flat 2D roads are switched off in test mode; REM / train bridges still come from objects.js
   The car rides on these surfaces (its height comes from them). */

const R3D_ON=/[?&]test3d=1\b/.test(location.search);
const R3D={cells:new Map(),wc:new Map(),ver:0,sig:'',H:null,building:false,lastTick:0,
  KEEP:3,BUILD:2,PER_TICK:1,
  COL:{road:'#c9cad1',curb:'#eeeef0',white:'#ffffff',yellow:'#e2b93b',side:'#b9b5ac',barrier:'#d4d1ca',pier:'#aaa69d'}};

function r3dHex(h){const c=new THREE.Color(h);return [c.r,c.g,c.b];}
const R3DC={};for(const k in R3D.COL) R3DC[k]=r3dHex(R3D.COL[k]);

/* ---------- height model: bridges at their height, approach roads ramp up to them ---------- */
function r3dSmooth(t){t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);}
function r3dRampLen(H){return Math.max(60,Math.min(350,H*20));}

function r3dCollect(){
  /* unique ground ways (from road tiles) and road bridges (from packs), with local points and length */
  const ways=new Map(),brs=new Map();
  for(const t of r3Tiles.values()) for(const w of t.w){
    if(ways.has(w[0])) continue;
    /* v2: converted shapes are cached per road (only new roads are converted) */
    let cc=R3D.wc.get(w[0]);
    if(!cc){
      const pts=[];for(let i=0;i<w[8].length;i+=2) pts.push(toLocal(w[8][i],w[8][i+1]));
      const cum=[0];for(let i=1;i<pts.length;i++) cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
      cc={pts:pts,cum:cum};R3D.wc.set(w[0],cc);
    }
    cc.seen=R3D.ver;
    const pts=cc.pts,cum=cc.cum;
    if(pts.length<2) continue;
    ways.set(w[0],{id:w[0],cls:w[1],ow:w[2],w:w[3],lanes:w[7]||0,n0:w[5],n1:w[6],pts:pts,cum:cum,L:cum[cum.length-1],br:false});
  }
  if(typeof TNT!=='undefined') for(const P of TNT.packs.values()){
    if(!P||!P.b) continue;
    for(const b of P.b){
      if(brs.has(b[0])||b[12]!=='b'||b[1]==='rail'||b[1]==='transit') continue;
      const pts=[];for(let i=0;i<b[8].length;i+=2) pts.push(toLocal(b[8][i],b[8][i+1]));
      if(pts.length<2) continue;
      const cum=[0];for(let i=1;i<pts.length;i++) cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
      brs.set(b[0],{id:b[0],cls:b[1],ow:b[2],w:b[3],lanes:b[7]||0,n0:b[5],n1:b[6],layer:b[9]||0,pts:pts,cum:cum,L:cum[cum.length-1],br:true,flat:b[8]});
    }
  }
  return {ways:ways,brs:brs};
}

function r3dCrossesSomething(b){
  /* does the bridge pass over a road or a track (away from its ends)? */
  for(let s=8;s<b.L-8;s+=6){
    let i=0;while(i<b.pts.length-2&&b.cum[i+1]<s) i++;
    const seg=b.cum[i+1]-b.cum[i]||1,t=(s-b.cum[i])/seg;
    const x=b.pts[i][0]+(b.pts[i+1][0]-b.pts[i][0])*t,z=b.pts[i][1]+(b.pts[i+1][1]-b.pts[i][1])*t;
    if(typeof tnoRoadHit==='function'&&tnoRoadHit(x,z,0)) return true;
    if(typeof tnoNearRail==='function'&&tnoNearRail(x,z,3)) return true;
  }
  return false;
}

function r3dHeights(D){
  /* 1. bridges joined into whole bridges (shared end nodes), one height per bridge */
  const parent=new Map();for(const b of D.brs.values()) parent.set(b.id,b.id);
  const find=a=>{while(parent.get(a)!==a){parent.set(a,parent.get(parent.get(a)));a=parent.get(a);}return a;};
  const byNode=new Map();
  for(const b of D.brs.values()) for(const n of [b.n0,b.n1]){
    const l=byNode.get(n);if(l) for(const o of l) parent.set(find(o),find(b.id));
    if(l) l.push(b.id);else byNode.set(n,[b.id]);
  }
  const groups=new Map();
  for(const b of D.brs.values()){
    const r=find(b.id);let g=groups.get(r);if(!g){g={L:0,cross:false,layer:0,W:0};groups.set(r,g);}
    g.L+=b.L;g.layer=Math.max(g.layer,b.layer);g.W=Math.max(g.W,b.w||0);
    if(!g.cross&&r3dCrossesSomething(b)) g.cross=true;
  }
  const nodeH=new Map();
  for(const b of D.brs.values()){
    const g=groups.get(find(b.id));
    let H;
    if(g.cross) H=Math.max(6.5*Math.max(1,g.layer),g.L>400?15:0);
    else if(g.L>=120) H=g.L>400?15:5;
    else H=0;
    b.H=H;b.W=Math.max(b.w||7,g.W);
    if(H>0) for(const n of [b.n0,b.n1]) nodeH.set(n,Math.max(nodeH.get(n)||0,H));
  }
  /* 2. ramps: from every raised node, ground roads rise toward it (distance-limited search) */
  const adj=new Map();
  for(const w of D.ways.values()) for(const [n,end] of [[w.n0,0],[w.n1,1]]){
    let l=adj.get(n);if(!l){l=[];adj.set(n,l);}l.push([w,end]);
  }
  const src=new Map(); /* node -> {H, d} best (highest resulting height) */
  const val=(H,d)=>H*r3dSmooth(1-d/r3dRampLen(H));
  for(const [n0,H] of nodeH){
    const R=r3dRampLen(H),best=new Map([[n0,0]]),q=[[n0,0]];
    while(q.length){
      q.sort((a,b)=>a[1]-b[1]);const [n,d]=q.shift();
      if(d>best.get(n)) continue;
      const cur=src.get(n);if(!cur||val(H,d)>val(cur.H,cur.d)) src.set(n,{H:H,d:d});
      for(const [w,end] of (adj.get(n)||[])){
        const m=end===0?w.n1:w.n0,nd=d+w.L;
        if(nd>=R) continue;
        if(!best.has(m)||nd<best.get(m)){best.set(m,nd);q.push([m,nd]);}
      }
    }
  }
  /* 3. per-vertex heights of ground ways */
  for(const w of D.ways.values()){
    const a=src.get(w.n0),b=src.get(w.n1);
    if(!a&&!b){w.hs=null;continue;}
    w.hs=w.cum.map(c=>Math.max(a?val(a.H,a.d+c):0,b?val(b.H,b.d+(w.L-c)):0));
    if(w.hs.every(h=>h<0.05)) w.hs=null;
  }
  for(const b of D.brs.values()) b.hs=b.cum.map(()=>b.H);
  /* v2: coarse index of all roads (100 m cells, by each road's box) for markings and car height */
  const IDX=new Map(),CS=100;
  for(const w of [...D.ways.values(),...D.brs.values()]){
    const W=w.br?(w.W||w.w):w.w,pad=W/2+2;let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;
    for(const p of w.pts){if(p[0]<x0)x0=p[0];if(p[0]>x1)x1=p[0];if(p[1]<z0)z0=p[1];if(p[1]>z1)z1=p[1];}
    w.bb=[x0-pad,x1+pad,z0-pad,z1+pad];
    for(let gx=Math.floor(w.bb[0]/CS);gx<=Math.floor(w.bb[1]/CS);gx++)
      for(let gz=Math.floor(w.bb[2]/CS);gz<=Math.floor(w.bb[3]/CS);gz++){
        const k=gx*1e6+gz;let l=IDX.get(k);if(!l){l=[];IDX.set(k,l);}l.push(w);
      }
  }
  D.idx=IDX;
  return D;
}
/* road pieces near a point: calls fn(way, segment index) */
function r3dNear(D,x,z,fn){
  const l=D.idx&&D.idx.get(Math.floor(x/100)*1e6+Math.floor(z/100));if(!l) return;
  for(const w of l){
    const b=w.bb;if(x<b[0]||x>b[1]||z<b[2]||z>b[3]) continue;
    const P=w.pts,pad=(w.br?(w.W||w.w):w.w)/2+2;
    for(let i=0;i<P.length-1;i++){
      const a=P[i],c=P[i+1];
      if(x<Math.min(a[0],c[0])-pad||x>Math.max(a[0],c[0])+pad||z<Math.min(a[1],c[1])-pad||z>Math.max(a[1],c[1])+pad) continue;
      if(fn(w,i)===true) return;
    }
  }
}
/* the height of road piece i of way w at fraction u, and the closest point */
function r3dSegHit(w,i,x,z){
  const a=w.pts[i],b=w.pts[i+1],dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz;if(l2<0.01) return null;
  const u=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/l2));
  const fx=a[0]+dx*u,fz=a[1]+dz*u,d=Math.hypot(fx-x,fz-z);
  const h=w.hs&&w.H!==0?w.hs[i]+(w.hs[i+1]-w.hs[i])*u:(w.br&&w.H>0?w.H:0);
  const l=Math.sqrt(l2);
  return {d:d,h:h,tx:dx/l,tz:dz/l,W:w.br?(w.W||w.w):w.w};
}
/* is this point on another road at about the same height? (then markings are not drawn there) */
function r3dOnOtherRoad(way,x,z,h){
  const D=R3D.H;if(!D||!D.idx) return false;
  let hit=false;
  r3dNear(D,x,z,(w,i)=>{
    if(w===way) return;
    const r=r3dSegHit(w,i,x,z);
    if(r&&r.d<r.W/2-0.2&&Math.abs(r.h-h)<1){hit=true;return true;}
  });
  return hit;
}
/* v2: the car's height = the height of the road it is driving on (aligned with its direction, closest,
   preferring the level it is already at), instead of whatever surface is under it */
function r3dHeightAt(x,z){
  const D=R3D.H;if(!D||!D.idx) return null;
  const hd=typeof lastHd==='number'?lastHd:null,fx=hd!=null?Math.sin(hd*Math.PI/180):0,fz=hd!=null?-Math.cos(hd*Math.PI/180):0;
  const cy=typeof carY==='number'?carY:0;
  let best=null;
  r3dNear(D,x,z,(w,i)=>{
    const r=r3dSegHit(w,i,x,z);if(!r||r.d>r.W/2+1.2) return;
    if(hd!=null&&Math.abs(r.tx*fx+r.tz*fz)<0.55) return;
    const sc=r.d+Math.abs(r.h-cy)*1.5;
    if(!best||sc<best.sc) best={sc:sc,h:r.h};
  });
  return best?best.h:0;
}

/* ---------- geometry ---------- */
function r3dGeo(){return {p:[],c:[],i:[],n:0};}
/* v2: one cell = three layers drawn with depth offsets (curb under road under markings), so overlapping
   roads and markings no longer flicker */
function r3dLayers(){return {curb:r3dGeo(),road:r3dGeo(),mark:r3dGeo()};}
function r3dQuad(G,a,b,c,d,col){
  for(const v of [a,b,c,d]){G.p.push(v[0],v[1],v[2]);G.c.push(col[0],col[1],col[2]);}
  G.i.push(G.n,G.n+1,G.n+2,G.n,G.n+2,G.n+3);G.n+=4;
}
/* left/right offsets of a polyline at vertex i (miter, limited) */
function r3dNormals(pts){
  const N=[];
  for(let i=0;i<pts.length;i++){
    const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];
    let tx=b[0]-a[0],tz=b[1]-a[1];const l=Math.hypot(tx,tz)||1;tx/=l;tz/=l;
    let sc=1;
    if(i>0&&i<pts.length-1){
      const ax=pts[i][0]-pts[i-1][0],az=pts[i][1]-pts[i-1][1],al=Math.hypot(ax,az)||1;
      const cosHalf=Math.abs((ax/al)*tx+(az/al)*tz);sc=1/Math.max(0.6,cosHalf);
    }
    N.push([-tz*sc,tx*sc]);
  }
  return N;
}
/* strip between offsets o1..o2 (meters across, + = left) for segments [a,b), at height h+dy */
function r3dStrip(G,pts,N,hs,a,b,o1,o2,dy,col){
  for(let i=a;i<b;i++){
    const h0=(hs?hs[i]:0)+dy,h1=(hs?hs[i+1]:0)+dy;
    const P=(j,o,h)=>[pts[j][0]+N[j][0]*o,h,pts[j][1]+N[j][1]*o];
    r3dQuad(G,P(i,o1,h0),P(i+1,o1,h1),P(i+1,o2,h1),P(i,o2,h0),col);
  }
}
function r3dWall(G,pts,N,hs,a,b,o,top,bottomFn,col){
  for(let i=a;i<b;i++){
    const t0=(hs?hs[i]:0)+top,t1=(hs?hs[i+1]:0)+top,b0=bottomFn(i),b1=bottomFn(i+1);
    if(t0-b0<0.05&&t1-b1<0.05) continue;
    const P=(j,h)=>[pts[j][0]+N[j][0]*o,h,pts[j][1]+N[j][1]*o];
    r3dQuad(G,P(i,b0),P(i+1,b1),P(i+1,t1),P(i,t0),col);
  }
}
function r3dDashes(G,way,N,a,b,o,dash,gap,dy,col,half){
  const P=way.pts,hs=way.hs;
  for(let i=a;i<b;i++){
    const s0=way.cum[i],s1=way.cum[i+1],L=s1-s0;if(L<0.05) continue;
    let s=Math.ceil(s0/(dash+gap))*(dash+gap)-(dash+gap);
    for(;s<s1;s+=dash+gap){
      const d0=Math.max(s,s0),d1=Math.min(s+dash,s1);if(d1-d0<0.1) continue;
      const u0=(d0-s0)/L,u1=(d1-s0)/L;
      const pt=u=>[P[i][0]+(P[i+1][0]-P[i][0])*u,P[i][1]+(P[i+1][1]-P[i][1])*u];
      const nx=N[i][0],nz=N[i][1],nl=Math.hypot(nx,nz)||1,ux=nx/nl,uz=nz/nl;
      const hh=u=>(hs?hs[i]+(hs[i+1]-hs[i])*u:0)+dy;
      const A=pt(u0),B=pt(u1);
      const mx=(A[0]+B[0])/2+ux*o,mz=(A[1]+B[1])/2+uz*o;
      if(r3dOnOtherRoad(way,mx,mz,hh((u0+u1)/2))) continue;
      r3dQuad(G,[A[0]+ux*(o+half),hh(u0),A[1]+uz*(o+half)],[B[0]+ux*(o+half),hh(u1),B[1]+uz*(o+half)],
              [B[0]+ux*(o-half),hh(u1),B[1]+uz*(o-half)],[A[0]+ux*(o-half),hh(u0),A[1]+uz*(o-half)],col);
    }
  }
}

/* segments of a way that belong to a cell (by segment midpoint), as runs [a,b) */
function r3dRuns(way,tx,ty){
  const runs=[];let a=-1;
  for(let i=0;i<way.pts.length-1;i++){
    const mx=(way.pts[i][0]+way.pts[i+1][0])/2,mz=(way.pts[i][1]+way.pts[i+1][1])/2;
    const ll=fromLocal(mx,mz),inside=Math.floor(ll[0]/R3T)===tx&&Math.floor(ll[1]/R3T)===ty;
    if(inside&&a<0) a=i;
    if(!inside&&a>=0){runs.push([a,i]);a=-1;}
  }
  if(a>=0) runs.push([a,way.pts.length-1]);
  return runs;
}

function r3dDrawWay(LG,way,tx,ty){
  const G=LG.road;
  const runs=r3dRuns(way,tx,ty);if(!runs.length) return;
  const N=r3dNormals(way.pts),W=way.br?way.W:way.w,hw=W/2,hs=way.hs;
  const major=['motorway','trunk','primary','secondary'].indexOf(way.cls)>=0;
  for(const [a,b] of runs){
    /* surface: curb edge (ground roads), asphalt */
    if(!way.br) r3dStrip(LG.curb,way.pts,N,hs,a,b,hw+0.3,-hw-0.3,0.02,R3DC.curb);
    r3dStrip(G,way.pts,N,hs,a,b,hw,-hw,0.04,R3DC.road);
    const M=LG.mark;
    /* markings */
    if(way.ow){
      const L=way.lanes||Math.max(1,Math.round(W/3.4));
      for(let k=1;k<L;k++) r3dDashes(M,way,N,a,b,-hw+k*W/L,3,6,0.06,R3DC.white,0.07);
      if(major){r3dDashes(M,way,N,a,b,hw-0.35,1e6,0.001,0.06,R3DC.white,0.08);r3dDashes(M,way,N,a,b,-hw+0.35,1e6,0.001,0.06,R3DC.yellow,0.08);}
    }else if(way.cls!=='service'){
      r3dDashes(M,way,N,a,b,0,1e6,0.001,0.06,R3DC.yellow,0.08);
      const nh=way.lanes>=4?Math.floor(way.lanes/2):0;
      for(let k=1;k<nh;k++){const lw=hw/nh;r3dDashes(M,way,N,a,b,k*lw,3,6,0.06,R3DC.white,0.07);r3dDashes(M,way,N,a,b,-k*lw,3,6,0.06,R3DC.white,0.07);}
    }
    /* raised road: retaining walls on approaches; deck sides, barriers and piers on bridges */
    const raised=hs&&hs.some((h,j)=>j>=a&&j<=b&&h>0.3);
    if(raised){
      const ground=()=>0;
      const deckBottom=j=>way.br?Math.max(0,hs[j]-1.2):0;
      r3dWall(G,way.pts,N,hs,a,b,hw,0.04,deckBottom,R3DC.side);
      r3dWall(G,way.pts,N,hs,a,b,-hw,0.04,deckBottom,R3DC.side);
      if(way.br){
        r3dWall(G,way.pts,N,hs,a,b,hw,1.0,j=>hs[j]+0.04,R3DC.barrier);
        r3dWall(G,way.pts,N,hs,a,b,-hw,1.0,j=>hs[j]+0.04,R3DC.barrier);
      }else{
        r3dWall(G,way.pts,N,hs,a,b,hw,0.9,j=>hs[j]+0.04,R3DC.barrier);
        r3dWall(G,way.pts,N,hs,a,b,-hw,0.9,j=>hs[j]+0.04,R3DC.barrier);
      }
      void ground;
    }
    if(way.br&&way.H>=3){
      const step=W>=9?36:28;
      for(let s=Math.ceil(way.cum[a]/step)*step+step/2;s<way.cum[b];s+=step){
        let i=0;while(i<way.pts.length-2&&way.cum[i+1]<s) i++;
        const seg=way.cum[i+1]-way.cum[i]||1,t=(s-way.cum[i])/seg;
        const x=way.pts[i][0]+(way.pts[i+1][0]-way.pts[i][0])*t,z=way.pts[i][1]+(way.pts[i+1][1]-way.pts[i][1])*t;
        const ux=(way.pts[i+1][0]-way.pts[i][0])/seg,uz=(way.pts[i+1][1]-way.pts[i][1])/seg,nx=-uz,nz=ux;
        const cols=W>=9?[-W*0.3,W*0.3]:[0];
        if(typeof tnoPierOnRoad==='function'&&cols.some(o=>tnoPierOnRoad(x+nx*o,z+nz*o,ux,uz,1.4))) continue;
        for(const o of cols) r3dBox(G,x+nx*o,z+nz*o,ux,uz,1.3,1.3,0,way.H-1.2,R3DC.pier);
      }
    }
  }
}
function r3dBox(G,x,z,ux,uz,a,c,y0,y1,col){
  const vx=-uz,vz=ux,A=a/2,B=c/2,P=(sa,sb,y)=>[x+ux*A*sa+vx*B*sb,y,z+uz*A*sa+vz*B*sb];
  const dark=[col[0]*0.85,col[1]*0.85,col[2]*0.85];
  r3dQuad(G,P(1,1,y0),P(1,-1,y0),P(1,-1,y1),P(1,1,y1),col);
  r3dQuad(G,P(-1,-1,y0),P(-1,1,y0),P(-1,1,y1),P(-1,-1,y1),col);
  r3dQuad(G,P(-1,1,y0),P(1,1,y0),P(1,1,y1),P(-1,1,y1),dark);
  r3dQuad(G,P(1,-1,y0),P(-1,-1,y0),P(-1,-1,y1),P(1,-1,y1),dark);
}

let r3dMat=null;const r3dMats={};
function r3dMaterial(k){
  if(r3dMats[k]) return r3dMats[k];
  const off={curb:1,road:2,mark:4}[k];
  const m=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-off,polygonOffsetUnits:-off*2,depthWrite:k!=='mark'});
  r3dMats[k]=m;if(k==='road') r3dMat=m;return m;
}
function r3dBuildCell(key,D){
  const [tx,ty]=key.split(',').map(Number);
  const LG=r3dLayers();
  for(const w of D.ways.values()) r3dDrawWay(LG,w,tx,ty);
  for(const b of D.brs.values()) if(b.H>0) r3dDrawWay(LG,b,tx,ty);
  for(const b of D.brs.values()) if(b.H===0){b.hs=null;r3dDrawWay(LG,b,tx,ty);}
  const grp=new THREE.Group();grp.userData.r3d=1;let any=false;
  for(const k of ['curb','road','mark']){
    const G=LG[k];if(!G.n) continue;any=true;
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(G.p,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(G.c,3));
    g.setIndex(G.i);
    const m=new THREE.Mesh(g,r3dMaterial(k));m.frustumCulled=false;m.renderOrder={curb:1,road:2,mark:3}[k];
    grp.add(m);
  }
  return any?grp:null;
}
function r3dFree(o){if(!o) return;treeScene.remove(o);o.traverse(c=>{if(c.geometry) c.geometry.dispose();});}
function r3dDispose(key){
  const m=R3D.cells.get(key);if(!m) return;
  r3dFree(m.mesh);
  R3D.cells.delete(key);
}

/* ---------- main loop: build near cells once, delete far ones ---------- */
function r3dTick(){
  if(!treeScene||typeof r3Tiles==='undefined'||!r3Tiles.size) return;
  const c=map.getCenter(),cx=Math.floor(c.lng/R3T),cy=Math.floor(c.lat/R3T);
  /* height model is redone only when the loaded road areas or bridge packs change */
  const sig=[...r3Tiles.keys()].sort().join('|')+'#'+(typeof TNT!=='undefined'?[...TNT.packs.keys()].sort().join('|'):'');
  if(sig!==R3D.sig||!R3D.H){
    R3D.sig=sig;R3D.H=r3dHeights(r3dCollect());
    for(const [k,v] of R3D.wc) if(v.seen!==R3D.ver) R3D.wc.delete(k);
    R3D.ver++;
  }
  for(const k of [...R3D.cells.keys()]){
    const [x,y]=k.split(',').map(Number);
    if(Math.abs(x-cx)>R3D.KEEP||Math.abs(y-cy)>R3D.KEEP) r3dDispose(k);
  }
  /* nearest cells first, a couple per tick so nothing freezes */
  const want=[];
  for(let dx=-R3D.BUILD;dx<=R3D.BUILD;dx++)for(let dy=-R3D.BUILD;dy<=R3D.BUILD;dy++){
    const k=(cx+dx)+','+(cy+dy);if(!r3Tiles.has(k)) continue;
    const e=R3D.cells.get(k);if(e&&e.ver===R3D.ver) continue;
    want.push([dx*dx+dy*dy,k]);
  }
  want.sort((a,b)=>a[0]-b[0]);
  for(let i=0;i<Math.min(R3D.PER_TICK,want.length);i++){
    const k=want[i][1],t0=performance.now();
    const old=R3D.cells.get(k);
    const mesh=r3dBuildCell(k,R3D.H);
    if(old) r3dFree(old.mesh);
    if(mesh) treeScene.add(mesh);
    R3D.cells.set(k,{mesh:mesh,ver:R3D.ver});
    if(typeof PROF!=='undefined') PROF.roads3d=(PROF.roads3d||0)+performance.now()-t0;
  }
  r3dNight();
}
function r3dNight(){
  const nt=typeof nightNow==='number'?nightNow:0,c=mixHex('#ffffff','#7a8196',nt);
  for(const k in r3dMats) r3dMats[k].color.set(c);
}
function r3dHideFlat(){
  for(const id of ['r3-curb','r3-road','r3-paint','r3-center','r3-lane','r3-arrow','tno-gore'])
    if(map.getLayer(id)&&map.getLayoutProperty(id,'visibility')!=='none') map.setLayoutProperty(id,'visibility','none');
  /* the base map's own flat bridge drawings too (bridges are 3D road now) */
  if(!R3D.bridgeHidden){
    R3D.bridgeHidden=true;
    for(const l of map.getStyle().layers) if(/bridge/i.test(l.id)&&l.type!=='symbol') map.setLayoutProperty(l.id,'visibility','none');
  }
}

/* car height from the 3D road surfaces near the car (plus REM bridges from objects.js) */
const r3dRay=new THREE.Raycaster(),r3dDown=new THREE.Vector3(0,-1,0),r3dO=new THREE.Vector3();
function r3dSurfaces(x,z){
  const h=r3dHeightAt(x,z);
  if(h!==null) return h>0.05?[0,h+0.04]:[0];
  const ys=[0],objs=[];
  const ll=fromLocal(x,z),tx=Math.floor(ll[0]/R3T),ty=Math.floor(ll[1]/R3T);
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const e=R3D.cells.get((tx+dx)+','+(ty+dy));if(e&&e.mesh) objs.push(e.mesh);}
  if(typeof brMeshes!=='undefined') for(const v of brMeshes.values()){const o=v&&v.isObject3D?v:(v&&(v.group||v.mesh));if(o) objs.push(o);}
  if(!objs.length) return ys;
  r3dO.set(x,80,z);r3dRay.set(r3dO,r3dDown);r3dRay.far=100;
  for(const h of r3dRay.intersectObjects(objs,true)){
    const n=h.face&&h.face.normal;if(!n) continue;
    const ny=Math.abs(n.y);if(ny<0.5) continue;
    if(h.point.y>0.3) ys.push(h.point.y-0.04);
  }
  return ys;
}

if(R3D_ON){
  console.log('TessyNav: 3D roads test mode');
  /* the old flat roads and gore fill are not needed */
  if(typeof r3Rebuild==='function') r3Rebuild=function(){r3HideSafe();};
  function r3HideSafe(){try{r3dHideFlat();}catch(e){}}
  /* road bridges are now part of the 3D roads; objects.js keeps only REM / train bridges */
  if(typeof buildBridgeMesh==='function'){
    buildBridgeMesh=(function(base){return function(cell,endInfo,roadIdx,cross){
      const only=new Map();for(const [k,b] of cell) if(b.cls==='rail'||b.cls==='transit') only.set(k,b);
      if(!only.size) return null;
      return base(only,endInfo,roadIdx,cross);
    };})(buildBridgeMesh);
  }
  if(typeof bridgeSurfaces==='function') bridgeSurfaces=r3dSurfaces;
  setInterval(()=>{try{r3dHideFlat();r3dTick();}catch(e){console.warn('roads3d',e);}},700);
}

/* ===== v2 (all modes): buildings standing on a road are lifted =====
   Some buildings in the map data span over a road (a passage or bridge between two buildings, like the Bell
   building on Nuns' Island) but are recorded as starting at the ground, so the car drove through them.
   A building whose middle sits on a drawn road now starts 5 m up, so the road passes underneath. */
if(typeof buildBuildingMesh==='function'){
  buildBuildingMesh=(function(base){return function(cell){
    try{
      for(const e of cell.values()){
        if(e.b>0||e._r3dChecked) continue;
        const Gr=typeof r3GetGrid==='function'?r3GetGrid():null;if(!Gr||!Gr.size) continue;
        e._r3dChecked=1;
        const o=e.rings[0];let sx=0,sy=0;for(const p of o){sx+=p[0];sy+=p[1];}
        const q=toLocal(sx/o.length,sy/o.length);
        if(typeof tnoRoadHit==='function'&&tnoRoadHit(q[0],q[1],-0.5)&&e.h>7) e.b=5;
      }
    }catch(err){}
    return base(cell);
  };})(buildBuildingMesh);
}
