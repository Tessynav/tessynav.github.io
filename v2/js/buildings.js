/* TessyNav v2 — buildings.js
   Detailed buildings near the car (about 1 km around), on top of the map's plain buildings further away:
   - houses and small buildings get a pitched (hip) roof; larger buildings a flat roof with a low parapet
   - colours by type: brick for houses and plexes, concrete/beige for mid-rise, glassy grey-blue for towers
   - windows drawn by a small graphics program (no images to download), in rows and floors
   - at night about a third of the windows light up warm yellow (always the same ones per building)
   Built to stay light: each area is ONE drawing job, built a few hundred buildings per frame, kept while near.
   ?buildings=0 in the address switches the detailed buildings off. Nothing here touches the car or the roads. */
var TN=globalThis.TN||{};globalThis.TN=TN;

TN.Buildings=function(scene,net){
  this.scene=scene;this.net=net||null;this.on=!(typeof location!=='undefined'&&/[?&]buildings=0/.test(location.search));
  this.cells=new Map();this.job=null;this.mat=null;this.night=0;this.slowT=0;this.range=1;
};
TN.Buildings.prototype.material=function(){
  if(this.mat) return this.mat;
  this.mat=new THREE.ShaderMaterial({
    uniforms:Object.assign({night:{value:this.night}},TN.CUTU||{}),
    vertexColors:true,side:THREE.DoubleSide,
    vertexShader:[
      'attribute vec3 wuv;',
      'varying vec3 vCol;varying vec3 vUv;varying float vShade;varying vec3 vCutW;',
      'void main(){vCol=color;vUv=wuv;vCutW=(modelMatrix*vec4(position,1.0)).xyz;',
      '  vec3 n=normalize(normal);vShade=0.80+0.20*abs(n.x)+0.10*max(n.y,0.0);',
      '  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}'].join('\n'),
    fragmentShader:[
      (TN.CUTGLSL||'varying vec3 vCutW;bool tnCut(){return false;}'),
      'uniform float night;varying vec3 vCol;varying vec3 vUv;varying float vShade;',
      'float hh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
      'void main(){',
      '  if(tnCut()) discard;',
      '  vec3 wall=vCol*vShade*(1.0-0.62*night);',
      '  if(vUv.z<0.0){gl_FragColor=vec4(wall,1.0);return;}',
      '  vec2 cell=vec2(floor(vUv.x/3.2),floor(vUv.y/3.0));vec2 f=vec2(fract(vUv.x/3.2),fract(vUv.y/3.0));',
      '  float win=step(0.22,f.x)*step(f.x,0.78)*step(0.28,f.y)*step(f.y,0.80)*step(1.0,vUv.y);',
      '  float lit=step(hh(cell+vec2(vUv.z,vUv.z*1.7)),0.33);',
      '  vec3 day=vec3(0.30,0.37,0.45);vec3 dark=vec3(0.07,0.08,0.11);vec3 warm=vec3(1.0,0.80,0.45);',
      '  vec3 wc=mix(day,mix(dark,warm,lit),night);',
      '  gl_FragColor=vec4(mix(wall,wc,win),1.0);}'].join('\n')
  });
  return this.mat;
};
TN.Buildings.prototype.setNight=function(nt){this.night=nt;if(this.mat) this.mat.uniforms.night.value=nt;};
/* building shapes of one area, from the map tiles already loaded */
TN.Buildings.prototype.collect=function(ck){
  const map=this.scene.map;if(!map||typeof map.querySourceFeatures!=='function') return [];
  const [cx,cy]=ck.split(',').map(Number);
  const out=[],seen=new Set();
  let fs=[];try{fs=map.querySourceFeatures('openmaptiles',{sourceLayer:'building'});}catch(e){return [];}
  for(const f of fs){
    const g=f.geometry;if(!g) continue;
    const list=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
    const pr=f.properties||{},H=+pr.render_height||8,B=+pr.render_min_height||0;
    for(const rings of list){
      const r=rings[0];if(!r||r.length<4) continue;
      let sx=0,sy=0;for(const p of r){sx+=p[0];sy+=p[1];}sx/=r.length;sy/=r.length;
      /* each building belongs to the area its middle is in (no doubles) */
      if(Math.floor(sx/TN.CELL)!==cx||Math.floor(sy/TN.CELL)!==cy) continue;
      const key=r[0][0].toFixed(6)+','+r[0][1].toFixed(6)+','+H;if(seen.has(key)) continue;seen.add(key);
      const ring=r.slice(0,-1).map(p=>TN.toLocal(p[0],p[1]));let Bx=B;
      /* a building whose footprint crosses a street (a skybridge, a building over a road): there must be room to
         drive underneath, so it starts high up, also in the map's own building layer further away */
      if(this.crossesRoad(ring)){Bx=Math.max(B,H>=8?5.5:H*0.55);
        if(f.id!=null&&B<Bx){try{map.setFeatureState({source:'openmaptiles',sourceLayer:'building',id:f.id},{lift:Bx});}catch(e){}}}
      out.push({ring:ring,H:Math.max(H,Bx+2),B:Bx});
    }
  }
  return out;
};
TN.segX=function(a,b,c,d){const cr=(o,p,q)=>(p[0]-o[0])*(q[1]-o[1])-(p[1]-o[1])*(q[0]-o[0]);
  const d1=cr(c,d,a),d2=cr(c,d,b),d3=cr(a,b,c),d4=cr(a,b,d);return ((d1>0)!==(d2>0))&&((d3>0)!==(d4>0));};
TN.Buildings.prototype.crossesRoad=function(ring){
  const net=this.net;if(!net||ring.length<3) return false;
  let cx=0,cz=0,r=0;for(const p of ring){cx+=p[0];cz+=p[1];}cx/=ring.length;cz/=ring.length;
  for(const p of ring) r=Math.max(r,Math.hypot(p[0]-cx,p[1]-cz));if(r>150) return false;
  let hit=false;
  net.near(cx,cz,r,(w,i)=>{
    if(w.tun||w.br||w.pa) return;
    const a=w.pts[i],b=w.pts[i+1];
    /* the street's line runs through the footprint: it crosses an edge, or its middle lies inside */
    const m=[(a[0]+b[0])/2,(a[1]+b[1])/2];let inside=false;
    for(let k=0,j=ring.length-1;k<ring.length;j=k++){const A=ring[k],B=ring[j];
      if(((A[1]>m[1])!==(B[1]>m[1]))&&(m[0]<(B[0]-A[0])*(m[1]-A[1])/((B[1]-A[1])||1e-9)+A[0])) inside=!inside;}
    if(inside){hit=true;return true;}
    let n=0;for(let k=0;k<ring.length;k++) if(TN.segX(a,b,ring[k],ring[(k+1)%ring.length])) n++;
    if(n>=2){hit=true;return true;}
  });
  return hit;
};
TN.Buildings.prototype.palette=function(H,seed){
  const pick=a=>a[seed%a.length];
  if(H<=13) return pick(['#a65a43','#8e4b3a','#b46b54','#9c5f4a','#c8b08f','#b9a185']);
  if(H<=32) return pick(['#c9c0b0','#bdb5a6','#d3c8b4','#b2aa9c']);
  return pick(['#9fb0bf','#b7c3cd','#8e9eae','#a9b3bb']);
};
TN.Buildings.prototype.addBuilding=function(G,b){
  let ring=b.ring;const n=ring.length;if(n<3) return;
  /* clockwise rings in local x/z (z points south) give outward walls with this winding */
  let area=0;for(let i=0;i<n;i++){const a=ring[i],c=ring[(i+1)%n];area+=a[0]*c[1]-c[0]*a[1];}
  if(area<0) ring=ring.slice().reverse();area=Math.abs(area)/2;
  if(area<12) return;
  const seed=Math.abs(Math.floor(ring[0][0]*7+ring[0][1]*13))%997+1;
  const col=TN.hex(this.palette(b.H,seed));
  const top=b.H,bot=b.B,ex=0.15;   /* slightly outside the map's own building, so it is covered */
  let cx=0,cz=0;for(const p of ring){cx+=p[0];cz+=p[1];}cx/=n;cz/=n;
  const out=ring.map(p=>{const dx=p[0]-cx,dz=p[1]-cz,l=Math.hypot(dx,dz)||1;return [p[0]+dx/l*ex,p[1]+dz/l*ex];});
  const V=(x,y,z,nx,ny,nz,u,v,s,c)=>{G.p.push(x,y,z);G.n.push(nx,ny,nz);G.c.push(c[0],c[1],c[2]);G.w.push(u,v,s);return G.cnt++;};
  const quadWall=(a,c,y0,y1,u0,len,s,cc)=>{
    const nx=(c[1]-a[1])/len,nz=-(c[0]-a[0])/len;
    const i0=V(a[0],y0,a[1],nx,0,nz,u0,y0-bot,s,cc),i1=V(c[0],y0,c[1],nx,0,nz,u0+len,y0-bot,s,cc);
    const i2=V(c[0],y1,c[1],nx,0,nz,u0+len,y1-bot,s,cc),i3=V(a[0],y1,a[1],nx,0,nz,u0,y1-bot,s,cc);
    G.i.push(i0,i2,i1,i0,i3,i2);
  };
  let run=0;
  for(let i=0;i<n;i++){
    const a=out[i],c=out[(i+1)%n],len=Math.hypot(c[0]-a[0],c[1]-a[1]);if(len<0.05) continue;
    quadWall(a,c,bot,top,run,len,seed,col);run+=len;
  }
  const pitched=b.H<=13&&area<260&&n<=10&&bot<1;
  if(pitched){
    /* low-poly hip roof up to the middle */
    const rise=Math.min(3.2,0.32*Math.sqrt(area)),rc=TN.hex(['#4b4542','#5a3f36','#3f4448'][seed%3]);
    for(let i=0;i<n;i++){
      const a=out[i],c=out[(i+1)%n];
      const ux=c[0]-a[0],uz=c[1]-a[1],vx=cx-a[0],vy=rise,vz=cz-a[1];
      /* face normal = u x v */
      let nx=-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy;
      const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;if(ny<0){nx=-nx;ny=-ny;nz=-nz;}
      const i0=V(a[0],top,a[1],nx,ny,nz,0,0,-1,rc),i1=V(c[0],top,c[1],nx,ny,nz,0,0,-1,rc),i2=V(cx,top+rise,cz,nx,ny,nz,0,0,-1,rc);
      G.i.push(i0,i2,i1);
    }
  }else{
    /* flat roof a little above the walls, with a low parapet */
    const rc=TN.hex(['#6e6b66','#5f6266','#76736c'][seed%3]);
    let tri=[];
    try{tri=THREE.ShapeUtils.triangulateShape(out.map(p=>new THREE.Vector2(p[0],p[1])),[]);}catch(e){tri=[];}
    const base=G.cnt;for(const p of out) V(p[0],top+0.05,p[1],0,1,0,0,0,-1,rc);
    for(const t of tri) G.i.push(base+t[0],base+t[2],base+t[1]);
    let r2=0;
    for(let i=0;i<n;i++){const a=out[i],c=out[(i+1)%n],len=Math.hypot(c[0]-a[0],c[1]-a[1]);if(len<0.05) continue;
      quadWall(a,c,top,top+0.5,r2,len,-1,rc);r2+=len;}
  }
};
TN.Buildings.prototype.finish=function(G){
  if(!G.cnt) return null;
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(G.p,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(G.n,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(G.c,3));
  g.setAttribute('wuv',new THREE.Float32BufferAttribute(G.w,3));
  g.setIndex(G.i);
  const m=new THREE.Mesh(g,this.material());m.frustumCulled=false;
  return m;
};
TN.Buildings.prototype.free=function(k){
  const e=this.cells.get(k);if(!e) return;
  if(e.mesh){this.scene.three.scene.remove(e.mesh);e.mesh.geometry.dispose();}
  this.cells.delete(k);
};
TN.Buildings.prototype.update=function(lng,lat,fps){
  if(!this.on||!this.scene.three) return;
  if(fps){
    if(fps<45) this.slowT++;else this.slowT=Math.max(0,this.slowT-1);
    if(this.slowT>300&&this.range>0){this.range=0;this.slowT=0;for(const k of [...this.cells.keys()]) this.free(k);this.job=null;}
    else if(this.slowT>300&&this.range===0&&fps<35){this.on=false;for(const k of [...this.cells.keys()]) this.free(k);this.job=null;return;}
  }
  const cx=Math.floor(lng/TN.CELL),cy=Math.floor(lat/TN.CELL),R=this.range,now=performance.now();
  for(const k of [...this.cells.keys()]){const [x,y]=k.split(',').map(Number);if(Math.abs(x-cx)>R+1||Math.abs(y-cy)>R+1) this.free(k);}
  /* keep building the current area: a few hundred buildings per frame */
  if(this.job){
    const t0=performance.now(),J=this.job;
    while(J.i<J.list.length&&performance.now()-t0<5){this.addBuilding(J.G,J.list[J.i++]);}
    if(J.i>=J.list.length){
      const mesh=this.finish(J.G);if(mesh) this.scene.three.scene.add(mesh);
      this.cells.set(J.k,{mesh:mesh,n:J.list.length,t:now,tries:J.tries});this.job=null;
    }
    TN.prof('buildings',performance.now()-t0);
    return;
  }
  let best=null;
  for(let dx=-R;dx<=R;dx++) for(let dy=-R;dy<=R;dy++){
    const k=(cx+dx)+','+(cy+dy),e=this.cells.get(k),d=dx*dx+dy*dy;
    if(e){if(e.n||e.tries>=3||now-e.t<4000) continue;this.free(k);if(!best||d<best.d) best={k:k,d:d,tries:e.tries+1};continue;}
    if(!best||d<best.d) best={k:k,d:d,tries:0};
  }
  if(!best) return;
  const t0=performance.now(),list=this.collect(best.k);
  this.job={k:best.k,list:list,i:0,tries:best.tries,G:{p:[],n:[],c:[],w:[],i:[],cnt:0}};
  TN.prof('buildings',performance.now()-t0);
};
