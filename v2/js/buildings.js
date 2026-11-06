/* TessyNav v2 — buildings.js
   Detailed buildings around the car (about 1.1 km each way; steps back to 600 m if the screen gets slow), on top of the map's
   plain buildings further away. A building cut in pieces by the map tiles is styled as the whole building:
   - houses and small buildings get a pitched (hip) roof; larger buildings a flat roof with a low parapet
   - colours by type: brick for houses and plexes, concrete/beige for mid-rise, glassy grey-blue for towers
   - windows drawn by a small graphics program (no images to download), in rows and floors
   - at night about a third of the windows light up (more in office towers), in a mix of warm yellow, soft white,
     cool white and dim orange, each at its own brightness (always the same ones per building)
   Built to stay light: each area is ONE drawing job, built a few hundred buildings per frame, kept while near.
   ?buildings=0 in the address switches the detailed buildings off. Nothing here touches the car or the roads. */
var TN=globalThis.TN||{};globalThis.TN=TN;

TN.Buildings=function(scene,net){
  this.scene=scene;this.net=net||null;this.on=!(typeof location!=='undefined'&&/[?&]buildings=0/.test(location.search));
  this.cells=new Map();this.job=null;this.mat=null;this.night=0;this.slowT=0;this.range=2;
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
      (TN.CUTGLSL||'varying vec3 vCutW;float tnCutK(){return 0.0;}'),
      'uniform float night;varying vec3 vCol;varying vec3 vUv;varying float vShade;',
      'float hh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
      'void main(){',
      '  float tnK=tnCutK();if(tnK>0.97) discard;float al=1.0-tnK;',
      '  vec3 wall=vCol*vShade*(1.0-0.62*night);',
      '  if(vUv.z<0.0){gl_FragColor=vec4(wall,al);return;}',
      '  vec2 cell=vec2(floor(vUv.x/3.2),floor(vUv.y/3.0));vec2 f=vec2(fract(vUv.x/3.2),fract(vUv.y/3.0));',
      '  float win=step(0.22,f.x)*step(f.x,0.78)*step(0.28,f.y)*step(f.y,0.80)*step(1.0,vUv.y);',
      /* night windows: homes mostly warm yellow with soft white, some cool white and a few dim orange; offices (tall
         buildings) more lit windows, whiter and cooler; each window its own brightness. Always the same per window. */
      '  float off=step(999.5,vUv.z);float sd=mod(vUv.z,1000.0);',
      '  float lit=step(hh(cell+vec2(sd,sd*1.7)),mix(0.33,0.55,off));',
      '  float r=hh(cell*1.37+vec2(sd*0.31,sd*2.3));',
      '  vec3 warm=vec3(1.0,0.77,0.36);vec3 soft=vec3(1.0,0.93,0.78);vec3 cool=vec3(0.84,0.90,1.0);vec3 dimo=vec3(0.89,0.55,0.25);',
      '  vec3 lc=off>0.5?(r<0.35?soft:(r<0.75?cool:(r<0.92?warm:dimo))):(r<0.55?warm:(r<0.80?soft:(r<0.92?cool:dimo)));',
      '  lc*=0.7+0.3*hh(cell+vec2(sd*3.1,5.0));',
      '  vec3 day=vec3(0.30,0.37,0.45);vec3 dark=vec3(0.07,0.08,0.11);',
      '  vec3 wc=mix(day,mix(dark,lc,lit),night);',
      '  gl_FragColor=vec4(mix(wall,wc,win),al);}'].join('\n'),transparent:true
  });
  return this.mat;
};
TN.Buildings.prototype.setNight=function(nt){this.night=nt;if(this.mat) this.mat.uniforms.night.value=nt;};
/* building shapes of one area, from the map tiles already loaded */
TN.Buildings.prototype.collect=function(ck){
  const map=this.scene.map;if(!map||typeof map.querySourceFeatures!=='function') return [];
  const [cx,cy]=ck.split(',').map(Number);
  const out=[],seen=new Set();
  /* the map scan is the slow part (every building in every loaded map tile): done once and reused for up to 20 s,
     or until the car has moved 800 m; the pieces are only grouped by building here, their sizes are measured
     later and only for the buildings actually needed */
  const nowT=performance.now(),cp=this.lastCenter||[0,0];
  const moved=this.scan&&this.scan.at?Math.hypot((cp[0]-this.scan.at[0])*78000,(cp[1]-this.scan.at[1])*111000):0;
  if(this.scan&&nowT-this.scan.t<20000&&moved<800){var fs=this.scan.fs,byId=this.scan.byId,whole=this.scan.whole;}
  else{
  var fs=[];try{fs=map.querySourceFeatures('openmaptiles',{sourceLayer:'building'});}catch(e){return [];}
  var byId=new Map(),whole=new Map();
  for(const f of fs){if(f.id==null||!f.geometry) continue;const a=byId.get(f.id);if(a) a.push(f);else byId.set(f.id,[f]);}
  this.scan={t:nowT,fs:fs,byId:byId,whole:whole,at:cp.slice()};}
  /* a building on a tile edge arrives in pieces (same id): its whole size, so each piece is styled as the whole
     building (not as a small house); measured once per building, when first needed */
  const wholeOf=id=>{let o=whole.get(id);if(o) return o;o={a:0,n:0};const seenPiece=new Set();
    for(const f of byId.get(id)||[]){const g=f.geometry,list=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
      for(const rings of list){const r=rings[0];if(!r||r.length<4) continue;const pk=r[0][0].toFixed(6)+','+r[0][1].toFixed(6);if(seenPiece.has(pk)) continue;seenPiece.add(pk);
        let A=0;for(let i=0;i<r.length-1;i++){const p=TN.toLocal(r[i][0],r[i][1]),q=TN.toLocal(r[i+1][0],r[i+1][1]);A+=p[0]*q[1]-q[0]*p[1];}
        o.a+=Math.abs(A)/2;o.n++;}}
    whole.set(id,o);return o;};
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
      const wh=f.id!=null?wholeOf(f.id):null;
      out.push({ring:r.slice(0,-1).map(p=>TN.toLocal(p[0],p[1])),H:H,B:B,id:f.id,wa:wh?wh.a:0,parts:wh?wh.n:1});
      this.idSeen=(this.idSeen||0)+1;if(f.id==null) this.idMissing=(this.idMissing||0)+1;
    }
  }
  /* nothing found in a scan made before this area's map tiles arrived: scan again once */
  if(!out.length&&!this._rescan&&nowT-this.scan.t>3000){this._rescan=true;this.scan=null;try{return this.collect(ck);}finally{this._rescan=false;}}
  return out;
};
TN.segX=function(a,b,c,d){const cr=(o,p,q)=>(p[0]-o[0])*(q[1]-o[1])-(p[1]-o[1])*(q[0]-o[0]);
  const d1=cr(c,d,a),d2=cr(c,d,b),d3=cr(a,b,c),d4=cr(a,b,d);return ((d1>0)!==(d2>0))&&((d3>0)!==(d4>0));};
TN.Buildings.prototype.crossesRoad=function(ring){
  const net=this.net;if(!net||ring.length<3) return false;
  let cx=0,cz=0,r=0;for(const p of ring){cx+=p[0];cz+=p[1];}cx/=ring.length;cz/=ring.length;
  for(const p of ring) r=Math.max(r,Math.hypot(p[0]-cx,p[1]-cz));if(r>150) return false;
  let hit=false;
  const test=(w,i)=>{
    if(w.tun||w.br||w.pa) return;
    const a=w.pts[i],b=w.pts[i+1];
    /* the street's line runs through the footprint: it crosses an edge, or its middle lies inside */
    const m=[(a[0]+b[0])/2,(a[1]+b[1])/2];let inside=false;
    for(let k=0,j=ring.length-1;k<ring.length;j=k++){const A=ring[k],B=ring[j];
      if(((A[1]>m[1])!==(B[1]>m[1]))&&(m[0]<(B[0]-A[0])*(m[1]-A[1])/((B[1]-A[1])||1e-9)+A[0])) inside=!inside;}
    if(inside){hit=true;return true;}
    let n=0;for(let k=0;k<ring.length;k++) if(TN.segX(a,b,ring[k],ring[(k+1)%ring.length])) n++;
    if(n>=2){hit=true;return true;}
  };
  const G=net._sg;
  if(G){let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const p of ring){if(p[0]<x0)x0=p[0];if(p[0]>x1)x1=p[0];if(p[1]<z0)z0=p[1];if(p[1]>z1)z1=p[1];}
    const seen=new Set();
    for(let gx=Math.floor(x0/10);gx<=Math.floor(x1/10);gx++) for(let gz=Math.floor(z0/10);gz<=Math.floor(z1/10);gz++){
      const l=G.get(gx*1e6+gz);if(!l) continue;
      for(const e of l){const k=e[0].id+':'+e[1];if(seen.has(k)) continue;seen.add(k);if(test(e[0],e[1])) return true;}}
    return false;}
  net.near(cx,cz,r,test);
  return hit;
};
TN.Buildings.prototype.overRem=function(ring){
  const net=this.net;if(!net||!net.rem||!net.rem.size) return false;
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const p of ring){if(p[0]<x0)x0=p[0];if(p[0]>x1)x1=p[0];if(p[1]<z0)z0=p[1];if(p[1]>z1)z1=p[1];}
  const inside=(x,z)=>{let c=false;for(let k=0,j=ring.length-1;k<ring.length;j=k++){const A=ring[k],B=ring[j];
    if(((A[1]>z)!==(B[1]>z))&&(x<(B[0]-A[0])*(z-A[1])/((B[1]-A[1])||1e-9)+A[0])) c=!c;}return c;};
  for(const w of net.rem.values()){const b=w.bb;if(b[1]<x0||b[0]>x1||b[3]<z0||b[2]>z1) continue;
    for(let i=0;i<w.pts.length-1;i++){const a=w.pts[i],c=w.pts[i+1];
      for(const t of [0.25,0.5,0.75]) if(inside(a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t)) return true;}}
  return false;
};
TN.Buildings.prototype.palette=function(H,seed,area){
  const pick=a=>a[seed%a.length];
  /* low but large (a mall, a warehouse, a school): concrete/beige, not house brick */
  if(H<=13&&area>900) return pick(['#c9c0b0','#bdb5a6','#d3c8b4','#b2aa9c']);
  if(H<=13) return pick(['#a65a43','#8e4b3a','#b46b54','#9c5f4a','#c8b08f','#b9a185']);
  if(H<=32) return pick(['#c9c0b0','#bdb5a6','#d3c8b4','#b2aa9c']);
  return pick(['#9fb0bf','#b7c3cd','#8e9eae','#a9b3bb']);
};
TN.Buildings.prototype.addBuilding=function(G,b,J){
  let ring=b.ring;const n=ring.length;if(n<3) return;
  const map=this.scene.map,fs=b.id!=null?{source:'openmaptiles',sourceLayer:'building',id:b.id}:null;
  /* a station roof over the REM tracks, mapped as a solid building: left out (the REM station is drawn instead) */
  if(this.overRem(ring)){if(fs){try{map.setFeatureState(fs,{hide:true});if(J) J.ids.push(b.id);}catch(e){}}return;}
  /* a building whose footprint crosses a street (a skybridge, a building over a road): room to drive underneath */
  if(this.crossesRoad(ring)){const Bx=Math.max(b.B,b.H>=8?5.5:b.H*0.55);b={ring:ring,H:Math.max(b.H,Bx+2),B:Bx,id:b.id};
    if(fs){try{map.setFeatureState(fs,{lift:Bx});}catch(e){}}}
  /* the map's own plain copy of this building is flattened while the detailed one is shown */
  if(fs){try{map.setFeatureState(fs,{hide:true});if(J) J.ids.push(b.id);}catch(e){}}
  /* clockwise rings in local x/z (z points south) give outward walls with this winding */
  let area=0;for(let i=0;i<n;i++){const a=ring[i],c=ring[(i+1)%n];area+=a[0]*c[1]-c[0]*a[1];}
  if(area<0) ring=ring.slice().reverse();area=Math.abs(area)/2;
  if(area<12) return;
  const seed=b.id!=null?(Math.abs(Math.floor(Number(b.id)))%997)+1:Math.abs(Math.floor(ring[0][0]*7+ring[0][1]*13))%997+1;
  const wholeArea=Math.max(area,b.wa||0),pieces=b.parts||1;
  const col=TN.hex(this.palette(b.H,seed,wholeArea));
  const top=b.H,bot=b.B,ex=0.3;   /* slightly outside the map's own building, so it is covered */
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
    quadWall(a,c,bot,top,run,len,seed+(top-bot>=25?1000:0),col);run+=len;   /* (+1000: an office-height building) */
  }
  /* pitched roof only for a whole small house in one piece (a piece of a bigger building gets the flat roof) */
  const pitched=b.H<=13&&wholeArea<260&&pieces===1&&n<=10&&bot<1;
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
  if(e.ids){const map=this.scene.map;for(const id of e.ids){try{map.setFeatureState({source:'openmaptiles',sourceLayer:'building',id:id},{hide:false});}catch(x){}}}
  this.cells.delete(k);
};
TN.Buildings.prototype.update=function(lng,lat,fps){
  if(!this.on||!this.scene.three) return;
  if(fps){
    if(fps<45) this.slowT++;else this.slowT=Math.max(0,this.slowT-1);
    if(this.slowT>300&&this.range>0){this.range--;this.slowT=0;
      const cx0=Math.floor(lng/TN.CELL),cy0=Math.floor(lat/TN.CELL);
      for(const k of [...this.cells.keys()]){const [x,y]=k.split(',').map(Number);if(Math.abs(x-cx0)>this.range||Math.abs(y-cy0)>this.range) this.free(k);}this.job=null;}
    /* never switched off: at the shortest range they keep the area you are in; after a minute of smooth driving
       the range grows back (up to the full 1.1 km) */
    if(fps>=55) this.fastT=(this.fastT||0)+1;else this.fastT=0;
    if(this.fastT>3600&&this.range<2){this.range++;this.fastT=0;}
  }
  this.lastCenter=[lng,lat];
  const cx=Math.floor(lng/TN.CELL),cy=Math.floor(lat/TN.CELL),R=this.range,now=performance.now();
  for(const k of [...this.cells.keys()]){const [x,y]=k.split(',').map(Number);if(Math.abs(x-cx)>R+1||Math.abs(y-cy)>R+1) this.free(k);}
  /* keep building the current area: a few hundred buildings per frame */
  if(this.job){
    const t0=performance.now(),J=this.job;
    this.net&&(this.net._sg=J.sg);
    const bud=Math.min(3,TN.workLeft?TN.workLeft():3);if(bud<0.5) return;
    while(J.i<J.list.length&&performance.now()-t0<bud){this.addBuilding(J.G,J.list[J.i++],J);}
    this.net&&(this.net._sg=null);
    if(J.i>=J.list.length){
      const mesh=this.finish(J.G);if(mesh) this.scene.three.scene.add(mesh);
      this.cells.set(J.k,{mesh:mesh,n:J.list.length,t:now,tries:J.tries,ids:J.ids});this.job=null;
    }
    TN.prof('buildings',performance.now()-t0);
    return;
  }
  if(now-(this.lastStart||0)<400) return;
  if(TN.workLeft&&TN.workLeft()<4) return;   /* starting a new area is the heavy part: only with budget left */
  let best=null;
  for(let dx=-R;dx<=R;dx++) for(let dy=-R;dy<=R;dy++){
    const k=(cx+dx)+','+(cy+dy),e=this.cells.get(k),d=dx*dx+dy*dy;
    /* an area that came out empty (often because its detailed map tiles, the ones with buildings, hadn't loaded
       yet: far away the map only loads simpler tiles) is tried again: every 4, 8, 16, then 30 s, and every 4 s
       once the car is in it or next to it, so it never stays empty by mistake */
    if(e){const wait=d<=1?4000:Math.min(30000,4000*Math.pow(2,Math.min(e.tries,3)));
      if(e.n||now-e.t<wait) continue;this.free(k);if(!best||d<best.d) best={k:k,d:d,tries:e.tries+1};continue;}
    if(!best||d<best.d) best={k:k,d:d,tries:0};
  }
  if(!best) return;
  this.lastStart=now;const t0=performance.now(),list=this.collect(best.k);
  if(!this.noIdMode&&(this.idSeen||0)>200&&(this.idMissing||0)>this.idSeen*0.5){
    this.noIdMode=true;this.range=Math.max(this.range,2);
    try{this.scene.map.setLayoutProperty('tn-buildings','visibility','none');}catch(e){}
  }
  let sg=null;if(this.net&&list.length){const [x,y]=best.k.split(',').map(Number),a=TN.toLocal(x*TN.CELL,(y+1)*TN.CELL),b=TN.toLocal((x+1)*TN.CELL,y*TN.CELL);
    sg=this.net.segGrid([Math.min(a[0],b[0])-20,Math.max(a[0],b[0])+20,Math.min(a[1],b[1])-20,Math.max(a[1],b[1])+20]);}
  this.job={k:best.k,list:list,i:0,tries:best.tries,G:{p:[],n:[],c:[],w:[],i:[],cnt:0},ids:[],sg:sg};
  TN.prof('buildings',performance.now()-t0);
};
