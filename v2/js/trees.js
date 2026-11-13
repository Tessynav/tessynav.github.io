/* TessyNav v2 — trees.js
   Trees from Montreal's open tree data (the same files the main app uses), drawn Codriver-style: faceted low-poly
   leafy trees mixed with conifers (about 1 in 4), sized from each tree's real trunk diameter, with seasonal
   colours: green in spring and summer, autumn colours from mid-September, bare branches and snowy conifers in
   winter. Parks, woods and lawns also get trees, generated inside the green areas of the map. Built to stay light:
   - all trees of one area are ONE drawing call for crowns and one for trunks (instancing)
   - only the areas around the car are kept (about 1 km), at most 1500 trees per area
   - trees that fall on a road surface are left out
   - if the screen ever gets slow, fewer areas are drawn automatically, and trees switch off below 35 fps
   - ?trees=0 in the address turns them off completely
   Nothing here touches the car, the roads or the recording.
   v9: trees on the grass beside highways and ramps (in loose groups, never in built-up areas), like Codriver. */
var TN=globalThis.TN||{};globalThis.TN=TN;

TN.Trees=function(scene,net){
  this.scene=scene;this.net=net;
  this.on=!(typeof location!=='undefined'&&/[?&]trees=0/.test(location.search));
  this.index=null;this.loading=new Set();this.loaded=new Set();
  this.buckets=new Map();       /* 0.005° cell -> [x,z,size,seed,...] */
  this.cells=new Map();         /* cell -> {grp} */
  this.range=1;this.slowT=0;this.lastBuild=0;this.mats=null;this.geo=null;
  if(this.on) fetch('../trees/index.json').then(r=>r.ok?r.json():null).then(j=>{if(j){this.T=j.tile||0.05;this.index=new Set(j.tiles||[]);}}).catch(()=>{});
};
TN.Trees.prototype.setup=function(){
  if(this.geo) return;
  /* a faceted crown (like Codriver) and a short trunk, shared by every tree */
  const crown=new THREE.IcosahedronGeometry(1,0);crown.translate(0,1,0);
  const cone=new THREE.ConeGeometry(1,1,6);cone.translate(0,0.5,0);
  const trunk=new THREE.CylinderGeometry(0.12,0.16,1,5);trunk.translate(0,0.5,0);
  this.geo={crown:crown,cone:cone,trunk:trunk};
  this.mats={crown:new THREE.MeshLambertMaterial({flatShading:true}),cone:new THREE.MeshLambertMaterial({flatShading:true}),
    trunk:new THREE.MeshLambertMaterial({color:0x5b4636})};
  if(TN.cutPatch) for(const k in this.mats) TN.cutPatch(this.mats[k],{fade:true});
  /* seasons (Montreal): spring Apr-May, summer Jun-mid Sep, autumn mid Sep-Nov, winter Dec-Mar */
  const d=new Date(),m=d.getMonth()+1,day=d.getDate();
  this.season=(m===12||m<=3)?'winter':(m<=5)?'spring':(m<9||(m===9&&day<15))?'summer':'autumn';
  const P={spring:['#8cc152','#a0d468','#7fb347','#b5d97a'],summer:['#4f8a3c','#5f9a42','#3f7a36','#6aa548'],
    autumn:['#4f8a3c','#5f9a42','#c9a227','#d8822a','#c2552b','#9e3b2a','#7aa043','#e0b13a'],winter:['#7d6a5a']};
  this.palette=P[this.season].map(c=>new THREE.Color(c));
  this.conePalette=(this.season==='winter'?['#c9d6d2','#b6c7c2','#d8e2df']:['#2f6b3a','#25582f','#3a7a44']).map(c=>new THREE.Color(c));
};
TN.Trees.prototype.load=function(lng,lat){
  if(!this.index) return;
  const T=this.T,tx=Math.floor(lng/T),ty=Math.floor(lat/T),fx=lng-tx*T,fy=lat-ty*T;
  const xs=[0],ys=[0];if(fx<0.012) xs.push(-1);if(T-fx<0.012) xs.push(1);if(fy<0.009) ys.push(-1);if(T-fy<0.009) ys.push(1);
  for(const dx of xs) for(const dy of ys){
    const k=(tx+dx)+'_'+(ty+dy);
    if(!this.index.has(k)||this.loaded.has(k)||this.loading.has(k)) continue;
    this.loading.add(k);
    fetch('../trees/'+k+'.json').then(r=>r.ok?r.json():null).then(a=>{
      this.loading.delete(k);if(!a) return;this.loaded.add(k);
      const [kx,ky]=k.split('_').map(Number);
      for(let i=0;i<a.length;i+=3){
        const lo=kx*T+a[i]/1e5,la=ky*T+a[i+1]/1e5,d=a[i+2];
        const size=d>0?Math.min(1.6,Math.max(0.55,0.5+d/45)):0.9;
        const ck=Math.floor(lo/TN.CELL)+','+Math.floor(la/TN.CELL);
        let b=this.buckets.get(ck);if(!b){b=[];this.buckets.set(ck,b);}
        const p=TN.toLocal(lo,la);b.push(p[0],p[1],size,(a[i]*7+a[i+1]*13)&1023);
      }
    }).catch(()=>this.loading.delete(k));
  }
};
/* trees inside green areas of the map (woods, parks, grass), so parks are not empty: woods dense, parks medium,
   lawns sparse. The shapes come from the map tiles already loaded on screen. */
TN.inRing=function(x,y,r){let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];
  if(((a[1]>y)!==(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/((b[1]-a[1])||1e-12)+a[0])) c=!c;}return c;};
TN.inPoly=function(x,y,rings){if(!TN.inRing(x,y,rings[0])) return false;for(let k=1;k<rings.length;k++) if(TN.inRing(x,y,rings[k])) return false;return true;};
TN.Trees.prototype.greenFor=function(ck){
  const map=this.scene.map;if(!map||typeof map.querySourceFeatures!=='function') return [];
  const [cx,cy]=ck.split(',').map(Number),lo0=cx*TN.CELL,la0=cy*TN.CELL,lo1=lo0+TN.CELL,la1=la0+TN.CELL;
  const polys=[];
  const add=(f,kind)=>{const g=f.geometry;if(!g) return;const list=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
    for(const rings of list){const r=rings[0];let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(const p of r){if(p[0]<x0)x0=p[0];if(p[0]>x1)x1=p[0];if(p[1]<y0)y0=p[1];if(p[1]>y1)y1=p[1];}
      if(x1<lo0||x0>lo1||y1<la0||y0>la1) continue;polys.push({rings:rings,kind:kind,bb:[x0,x1,y0,y1]});}};
  try{
    for(const f of map.querySourceFeatures('openmaptiles',{sourceLayer:'landcover'})){const c=(f.properties||{}).class;
      if(c==='wood'||c==='forest') add(f,'wood');else if(c==='grass') add(f,'grass');}
    for(const f of map.querySourceFeatures('openmaptiles',{sourceLayer:'park'})) add(f,'park');
    for(const f of map.querySourceFeatures('openmaptiles',{sourceLayer:'landuse'})){const c=(f.properties||{}).class;if(c==='cemetery'||c==='park') add(f,'park');}
  }catch(e){return [];}
  if(!polys.length) return [];
  /* spacing (m) and chance per spot */
  const K={wood:[9,0.75],park:[15,0.35],grass:[22,0.12]},out=[];
  const mlat=TN.CELL/(111320),mlng=TN.CELL/(111320*Math.cos(la0*TN.R));
  let h=(cx*73856093)^(cy*19349663);const rnd=()=>{h^=h<<13;h^=h>>>17;h^=h<<5;return ((h>>>0)%10000)/10000;};
  for(const kind of ['wood','park','grass']){
    const [sp,pr]=K[kind],dla=sp/111320,dlo=sp/(111320*Math.cos(la0*TN.R));
    const mine=polys.filter(p=>p.kind===kind);if(!mine.length) continue;
    for(let la=la0+dla/2;la<la1;la+=dla) for(let lo=lo0+dlo/2;lo<lo1;lo+=dlo){
      const jx=lo+(rnd()-0.5)*dlo*0.8,jy=la+(rnd()-0.5)*dla*0.8;if(rnd()>pr) continue;
      for(const p of mine){const b=p.bb;if(jx<b[0]||jx>b[1]||jy<b[2]||jy>b[3]) continue;
        if(TN.inPoly(jx,jy,p.rings)){const q=TN.toLocal(jx,jy);out.push(q[0],q[1],0.7+rnd()*0.7,Math.floor(rnd()*1024));break;}}
      if(out.length>=1200*4) return out;
    }
  }
  return out;
};
/* trees on the grass beside highways and their ramps, like Codriver: in loose groups 9 to 26 m outside the road's
   edge, never on another road, inside a built-up area (the map's residential, commercial or industrial land), on a
   bridge or in a tunnel. At most 160 per area, so it stays light. */
TN.Trees.prototype.sideFor=function(ck){
  const net=this.net,map=this.scene.map;if(!net||!net.ways) return [];
  const [cx,cy]=ck.split(',').map(Number),lo0=cx*TN.CELL,la0=cy*TN.CELL,lo1=lo0+TN.CELL,la1=la0+TN.CELL;
  const A=TN.toLocal(lo0,la0),B=TN.toLocal(lo1,la1),x0=Math.min(A[0],B[0]),x1=Math.max(A[0],B[0]),z0=Math.min(A[1],B[1]),z1=Math.max(A[1],B[1]);
  /* the built-up land (no roadside trees there) */
  const urban=[];try{for(const f of map.querySourceFeatures('openmaptiles',{sourceLayer:'landuse'})){const c=(f.properties||{}).class;
      if(!/residential|commercial|industrial|retail|railway|school|hospital|university|college|stadium/.test(c||'')) continue;
      const g=f.geometry;const list=g&&g.type==='Polygon'?[g.coordinates]:g&&g.type==='MultiPolygon'?g.coordinates:[];
      for(const rings of list){let a0=1e9,a1=-1e9,b0=1e9,b1=-1e9;for(const q of rings[0]){if(q[0]<a0)a0=q[0];if(q[0]>a1)a1=q[0];if(q[1]<b0)b0=q[1];if(q[1]>b1)b1=q[1];}
        if(a1<lo0||a0>lo1||b1<la0||b0>la1) continue;urban.push({rings:rings,bb:[a0,a1,b0,b1]});}}}catch(e){}
  let h=(cx*83492791)^(cy*2971215073);const rnd=()=>{h^=h<<13;h^=h>>>17;h^=h<<5;return ((h>>>0)%10000)/10000;};
  const out=[];
  for(const w of net.ways.values()){
    if(!/^(motorway|trunk)/.test(w.cls||'')||w.tun||w.br||!w.pts||w.pts.length<2) continue;
    if(w.hs&&Math.max(...w.hs)>1) continue;
    const P=w.pts;let inBox=false;for(const q of P){if(q[0]>=x0-30&&q[0]<=x1+30&&q[1]>=z0-30&&q[1]<=z1+30){inBox=true;break;}}if(!inBox) continue;
    const hw=TN.width(w)/2;
    for(let i=0;i<P.length-1;i++){const ax=P[i][0],az=P[i][1],bx=P[i+1][0],bz=P[i+1][1],L=Math.hypot(bx-ax,bz-az);if(L<1) continue;
      const ux=(bx-ax)/L,uz=(bz-az)/L;
      for(let d=rnd()*18;d<L;d+=14+rnd()*16){
        for(const side of [-1,1]){if(rnd()>0.55) continue;
          const off=hw+9+rnd()*17,x=ax+ux*d-uz*off*side,z=az+uz*d+ux*off*side;
          if(x<x0||x>x1||z<z0||z>z1) continue;
          /* clear of every road (with 4 m to spare) */
          let near=false;net.near(x,z,0,(v,k)=>{if(v.tun) return;const r=TN.seg(v,k,x,z);if(r.d<TN.width(v)/2+4){near=true;return true;}});if(near) continue;
          const ll=TN.fromLocal(x,z);let built=false;for(const u of urban){const b=u.bb;if(ll[0]<b[0]||ll[0]>b[1]||ll[1]<b[2]||ll[1]>b[3]) continue;if(TN.inPoly(ll[0],ll[1],u.rings)){built=true;break;}}if(built) continue;
          /* a small group: the tree and sometimes one or two more close by */
          const n=1+(rnd()<0.35?1:0)+(rnd()<0.15?1:0);
          for(let g=0;g<n;g++) out.push(x+(g?(rnd()-0.5)*7:0),z+(g?(rnd()-0.5)*7:0),0.8+rnd()*0.6,Math.floor(rnd()*1024));
          if(out.length>=160*4) return out;}}}}
  return out;
};
TN.Trees.prototype.build=function(ck){
  const green=this.greenFor(ck);this.lastGreen=green.length;
  let side=[];try{if(!(TN.settings&&TN.settings.roadsideTrees===false)) side=this.sideFor(ck);}catch(e){side=[];}
  const street=this.buckets.get(ck)||[],b=street.concat(green,side);if(!b.length) return null;
  const net=this.net,keep=[];
  for(let i=0;i<b.length&&keep.length<2200*4;i+=4){
    const x=b[i],z=b[i+1];let onRoad=false;
    net.near(x,z,0,(v,k)=>{if(v.tun) return;const r=TN.seg(v,k,x,z);if(r.d<TN.width(v)/2+0.6){onRoad=true;return true;}});
    if(!onRoad) keep.push(x,z,b[i+2],b[i+3]);
  }
  const n=keep.length/4;if(!n) return null;
  /* about one tree in four is a conifer; in winter leafy trees are bare (trunk and a thin brown crown) */
  let nc=0;for(let i=0;i<n;i++) if(keep[i*4+3]%4===0) nc++;
  const nd=n-nc,bare=this.season==='winter';
  const crowns=nd?new THREE.InstancedMesh(this.geo.crown,this.mats.crown,nd):null;
  const cones=nc?new THREE.InstancedMesh(this.geo.cone,this.mats.cone,nc):null;
  const trunks=new THREE.InstancedMesh(this.geo.trunk,this.mats.trunk,n);
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),sc=new THREE.Vector3(),pos=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  let id=0,ic=0;const shade=[];
  for(let i=0;i<n;i++){
    const x=keep[i*4],z=keep[i*4+1],s=keep[i*4+2],seed=keep[i*4+3];
    q.setFromAxisAngle(up,(seed%360)*TN.R);
    if(seed%4===0){
      /* conifer: tall faceted cone on a short trunk */
      const r=1.6*s,h=6.5*s;
      pos.set(x,0.8*s,z);sc.set(r,h,r);m.compose(pos,q,sc);cones.setMatrixAt(ic,m);
      cones.setColorAt(ic,this.conePalette[seed%this.conePalette.length]);ic++;
      pos.set(x,0,z);sc.set(s,1.2*s,s);m.compose(pos,q,sc);trunks.setMatrixAt(i,m);
      shade.push({x:x,z:z,r:r*0.9,th:3.5*s});
    }else{
      const r=(bare?1.5:2.2)*s,h=3.2*s;
      pos.set(x,h,z);sc.set(r,r*(bare?1.2:1.05),r);m.compose(pos,q,sc);crowns.setMatrixAt(id,m);
      crowns.setColorAt(id,this.palette[seed%this.palette.length]);id++;
      pos.set(x,0,z);sc.set(s,h+0.3,s);m.compose(pos,q,sc);trunks.setMatrixAt(i,m);
      shade.push({x:x,z:z,r:r*(bare?0.7:1.0),th:h});
    }
  }
  const grp=new THREE.Group();
  for(const o of [trunks,crowns,cones]) if(o){o.frustumCulled=false;grp.add(o);}
  if(TN.shadows&&TN.shadows.treeMesh){try{const sh=TN.shadows.treeMesh(shade);if(sh) grp.add(sh);}catch(e){}}   /* (their shadows) */
  return grp;
};
TN.Trees.prototype.free=function(ck){
  const e=this.cells.get(ck);if(!e) return;
  if(e.grp){this.scene.three.scene.remove(e.grp);for(const c of e.grp.children){c.dispose&&c.dispose();if(c.tnOwnGeo&&c.geometry) c.geometry.dispose();if(TN.shadows) TN.shadows.forget(c);}}
  this.cells.delete(ck);
};
TN.Trees.prototype.update=function(lng,lat,fps){
  if(!this.on||!this.scene.three) return;
  /* trees are small: drawn up to 60% of the buildings' distance */
  try{if(TN.lodApply&&performance.now()-(this.lodT||0)>500){this.lodT=performance.now();TN.lodApply(this.cells,lng,lat,(TN.lodFar||900)*(TN.viewClean?0.45:0.6),e=>e&&e.grp);   /* (Clean view: trees a little less far, a calmer picture) */}}catch(e){}
  this.setup();this.load(lng,lat);
  /* keep the screen smooth: fewer areas if slow, off if very slow */
  if(fps){
    if(fps<45){this.slowT+=1;}else this.slowT=Math.max(0,this.slowT-1);
    if(this.slowT>300&&this.range>0){this.range=0;this.slowT=0;for(const k of [...this.cells.keys()]) this.free(k);}
    else if(this.slowT>300&&this.range===0&&fps<35){this.on=false;for(const k of [...this.cells.keys()]) this.free(k);return;}
  }
  const cx=Math.floor(lng/TN.CELL),cy=Math.floor(lat/TN.CELL),R=this.range;
  for(const k of [...this.cells.keys()]){const [x,y]=k.split(',').map(Number);if(Math.abs(x-cx)>R+1||Math.abs(y-cy)>R+1) this.free(k);}
  const now=performance.now();if(now-this.lastBuild<300) return;
  if(TN.workLeft&&TN.workLeft()<4) return;   /* only with this frame's budget left */
  let best=null;
  for(let dx=-R;dx<=R;dx++) for(let dy=-R;dy<=R;dy++){
    const k=(cx+dx)+','+(cy+dy),e=this.cells.get(k);
    if(e){
      if(e.green||e.tries>=3||now-e.t<4000) continue;
      this.free(k);this.cells.set(k,{grp:null,green:0,t:now,tries:e.tries+1});this.cells.delete(k);
      const d=dx*dx+dy*dy;if(!best||d<best.d) best={k:k,d:d,tries:e.tries+1};continue;
    }
    const d=dx*dx+dy*dy;if(!best||d<best.d) best={k:k,d:d};
  }
  if(!best||!this.net.ways.size||this.net.job) return;
  this.lastBuild=now;
  const t0=performance.now(),grp=this.build(best.k);
  if(grp) this.scene.three.scene.add(grp);
  /* if the map's green shapes for this area were not loaded yet, build it again a little later (up to 3 times) */
  const tries=best.tries||0;
  this.cells.set(best.k,{grp:grp,green:this.lastGreen||0,t:now,tries:tries});
  TN.prof('trees',performance.now()-t0);
};
TN.Trees.prototype.setNight=function(nt){
  if(!this.mats) return;
  const c=new THREE.Color(TN.mix('#ffffff','#7d879c',nt));
  this.mats.crown.color.copy(c);this.mats.cone.color.copy(c);this.mats.trunk.color.copy(new THREE.Color(TN.mix('#5b4636','#2e2a2c',nt)));
};
