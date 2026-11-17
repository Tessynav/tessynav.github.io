/* TessyNav v2 — landmarks.js (v4)
   Well-known places as their own 3D models, in TessyNav's style (simple shapes, flat colours, no photos, no logos):
   - Stade Saputo: the pitch with its markings and goals, stands on four sides (the main stand taller, two tiers),
     roofs over the two long stands, light rows along the roof edges
   - the Olympic Stadium: its oval concrete shell with the 34 ribs, the white roof, and the leaning Montréal Tower
     at the north end, rising and leaning out over the stadium, with the glass lookout at the top
   - the Biosphère: the see-through steel lattice ball on Île Sainte-Hélène, with the museum inside
   - the big orange on Décarie: the orange ball, three storeys high (no name or logo)
   Each model is built only when you come within about 2.5 km and removed again past 3.5 km: one drawing job each.
   The map's plain buildings standing where the model is are left out (see buildings.js). ?landmarks=0 turns them off. */
var TN=globalThis.TN||{};globalThis.TN=TN;
TN.LANDMARKS=[
  {id:'saputo',name:'Stade Saputo',lng:-73.55285,lat:45.56265,bearing:150,kind:'stadium',r:120},
  /* the Olympic Stadium (its middle) and its leaning tower (the tower's foot, at the north end) */
  {id:'olympic',name:'Olympic Stadium',lng:-73.551575,lat:45.557861,tower:[-73.551468,45.558941],kind:'olympic',r:165},
  /* the Biosphère (Expo 67 geodesic dome, 76 m wide, 62 m high) and the big orange on Décarie (12.3 m) */
  {id:'biosphere',name:'Biosphère',lng:-73.531746,lat:45.514164,kind:'dome',r:48},
  {id:'orange',name:'Big orange (Décarie)',lng:-73.6568,lat:45.4957,kind:'orange',r:12}
];
TN.landmarkHide=[];   /* [{x,z,r}]: areas where the map's own buildings are left out */
TN.Landmarks=function(scene){
  this.scene=scene;this.built=new Map();
  this.on=!(typeof location!=='undefined'&&/[?&]landmarks=0/.test(location.search));
  this.mat=null;
};
TN.Landmarks.prototype.material=function(){
  if(!this.mat) this.mat=new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true,side:THREE.DoubleSide});
  return this.mat;
};
TN.Landmarks.prototype.update=function(lng,lat){
  if(!this.on||!this.scene||!this.scene.three) return;
  /* the map's own building boxes where a model stands are hidden directly too (also the far, plain ones, which the
     building code only reaches up close: the Olympic tower showed as a big grey box next to the model), again every
     5 s for map tiles that arrive later */
  if(performance.now()-(this.hideT||0)>5000){this.hideT=performance.now();try{this.hideMap();}catch(e){}}
  for(const L of TN.LANDMARKS){
    const d=TN.distLL([lng,lat],[L.lng,L.lat]),have=this.built.get(L.id);
    if(d<2500&&!have){let grp=null;try{grp=this.build(L);}catch(e){grp=null;}
      this.built.set(L.id,grp||'none');if(grp){this.scene.three.scene.add(grp);try{this.hideMap();}catch(e){}}}
    else if(d>3500&&have){if(have!=='none'){this.scene.three.scene.remove(have);have.traverse(o=>{if(o.geometry) o.geometry.dispose();});}
      this.built.delete(L.id);TN.landmarkHide=TN.landmarkHide.filter(h=>h.id!==L.id);}
  }
};
TN.Landmarks.prototype.hideMap=function(){
  const map=this.scene.map,H=TN.landmarkHide;if(!map||!H.length) return;
  for(const f of TN.srcFeat(map,'building')){if(f.id==null) continue;const g=f.geometry;if(!g) continue;
    const r=g.type==='Polygon'?g.coordinates[0]:g.type==='MultiPolygon'?g.coordinates[0][0]:null;if(!r||!r.length) continue;
    let x=0,y=0;for(const q of r){x+=q[0];y+=q[1];}const c=TN.toLocal(x/r.length,y/r.length);
    if(H.some(h=>Math.hypot(c[0]-h.x,c[1]-h.z)<h.r)) try{map.setFeatureState({source:'openmaptiles',sourceLayer:'building',id:f.id},{hide:true});}catch(e){}}
};
/* the real centre and direction of the pitch, from the map (its largest pitch near the landmark), when the map has it */
TN.Landmarks.prototype.fit=function(L){
  const map=this.scene.map;let best=null;
  try{for(const f of TN.srcFeat(map,'landuse')){
      if((f.properties||{}).class!=='pitch') continue;const g=f.geometry;if(!g||g.type!=='Polygon') continue;
      const r=g.coordinates[0].map(p=>TN.toLocal(p[0],p[1]));let cx=0,cz=0;for(const p of r){cx+=p[0];cz+=p[1];}cx/=r.length;cz/=r.length;
      const c0=TN.toLocal(L.lng,L.lat);if(Math.hypot(cx-c0[0],cz-c0[1])>150) continue;
      /* the longest edge gives the direction */
      let le=0,ang=0,area=0;for(let i=0;i<r.length-1;i++){const dx=r[i+1][0]-r[i][0],dz=r[i+1][1]-r[i][1],l=Math.hypot(dx,dz);area+=r[i][0]*r[i+1][1]-r[i+1][0]*r[i][1];if(l>le){le=l;ang=Math.atan2(dx,-dz);}}
      area=Math.abs(area)/2;if(area>4000&&area<12000&&(!best||area>best.area)) best={x:cx,z:cz,ang:ang,area:area};}}catch(e){}
  return best;
};
/* the stadium's own outline from the map (its biggest building there), for its real middle, direction and size */
TN.Landmarks.prototype.fitBuilding=function(L){
  const map=this.scene.map,c0=TN.toLocal(L.lng,L.lat);let best=null;
  try{for(const f of TN.srcFeat(map,'building')){const g=f.geometry;if(!g||g.type!=='Polygon') continue;
    const r=g.coordinates[0].map(p=>TN.toLocal(p[0],p[1]));let cx=0,cz=0;for(const p of r){cx+=p[0];cz+=p[1];}cx/=r.length;cz/=r.length;
    if(Math.hypot(cx-c0[0],cz-c0[1])>120) continue;
    let A=0;for(let i=0;i<r.length-1;i++) A+=r[i][0]*r[i+1][1]-r[i+1][0]*r[i][1];A=Math.abs(A)/2;
    if(A<25000||(best&&A<best.A)) continue;
    /* main direction from the spread of the outline points */
    let sxx=0,szz=0,sxz=0;for(const p of r){const dx=p[0]-cx,dz=p[1]-cz;sxx+=dx*dx;szz+=dz*dz;sxz+=dx*dz;}
    const th=0.5*Math.atan2(2*sxz,sxx-szz),ux=Math.cos(th),uz=Math.sin(th);
    let a=0,b=0;for(const p of r){const dx=p[0]-cx,dz=p[1]-cz;a=Math.max(a,Math.abs(dx*ux+dz*uz));b=Math.max(b,Math.abs(-dx*uz+dz*ux));}
    best={A:A,x:cx,z:cz,ux:ux,uz:uz,a:a,b:b};}}catch(e){}
  return best&&best.a<220&&best.b<200?best:null;
};
TN.Landmarks.prototype.buildOlympic=function(L){
  const c0=TN.toLocal(L.lng,L.lat),fit=this.fitBuilding(L),T0=TN.toLocal(L.tower[0],L.tower[1]);
  const cx=fit?fit.x:c0[0],cz=fit?fit.z:c0[1];
  /* long axis: from the map's outline, or toward the tower */
  let ux,uz;if(fit){ux=fit.ux;uz=fit.uz;}else{const dx=T0[0]-cx,dz=T0[1]-cz,l=Math.hypot(dx,dz)||1;ux=dx/l;uz=dz/l;}
  const vx=-uz,vz=ux,A=fit?Math.min(150,Math.max(100,fit.a)):135,B=fit?Math.min(130,Math.max(85,fit.b)):115;
  TN.landmarkHide.push({id:L.id,x:cx,z:cz,r:Math.max(A,B)+15},{id:L.id,x:T0[0],z:T0[1],r:80});
  const pos=[],col=[];
  const P=(u,y,v)=>[cx+ux*u+vx*v,y,cz+uz*u+vz*v];
  const tri=(a,b,c,k)=>{for(const p of [a,b,c]){pos.push(p[0],p[1],p[2]);col.push(k[0],k[1],k[2]);}};
  const quad=(a,b,c,d,k)=>{tri(a,b,c,k);tri(a,c,d,k);};
  const CON=[0.80,0.79,0.75],RIB=[0.66,0.65,0.62],ROOF=[0.93,0.93,0.94],ROOF2=[0.84,0.85,0.87],DARK=[0.30,0.32,0.36],PAVE=[0.78,0.77,0.73],GLASS=[0.32,0.42,0.52];
  const N=68,e=(k,s)=>{const t=k/N*Math.PI*2;return [Math.cos(t)*A*s,Math.sin(t)*B*s];};
  /* the paved esplanade around it */
  for(let k=0;k<N;k++){const a=e(k,1.28),b=e(k+1,1.28);tri(P(0,0.04,0),P(a[0],0.04,a[1]),P(b[0],0.04,b[1]),PAVE);}
  /* the shell: from the ground ring up and inward to the roof edge (the ribs curve inward as they rise) */
  const rings=[[1.00,0],[0.99,14],[0.96,28],[0.91,40],[0.85,48]];
  for(let k=0;k<N;k++) for(let j=0;j<rings.length-1;j++){
    const [s0,y0]=rings[j],[s1,y1]=rings[j+1],a0=e(k,s0),b0=e(k+1,s0),a1=e(k,s1),b1=e(k+1,s1);
    quad(P(a0[0],y0,a0[1]),P(b0[0],y0,b0[1]),P(b1[0],y1,b1[1]),P(a1[0],y1,a1[1]),k%2?CON:[CON[0]*0.95,CON[1]*0.95,CON[2]*0.95]);}
  /* the 34 ribs: raised strips on the shell, every other segment */
  for(let k=0;k<N;k+=2) for(let j=0;j<rings.length-1;j++){
    const [s0,y0]=rings[j],[s1,y1]=rings[j+1],m=k+0.5,w=0.18;
    const a0=e(m-w,s0+0.012),b0=e(m+w,s0+0.012),a1=e(m-w,s1+0.012),b1=e(m+w,s1+0.012);
    quad(P(a0[0],y0,a0[1]),P(b0[0],y0,b0[1]),P(b1[0],y1+0.6,b1[1]),P(a1[0],y1+0.6,a1[1]),RIB);}
  /* the roof: white, gently dipping toward the middle, with the darker ring of its edge */
  const rr=[[0.85,48.4],[0.70,46],[0.45,43.5],[0.20,42.5],[0.0,42.3]];
  for(let k=0;k<N;k++) for(let j=0;j<rr.length-1;j++){
    const [s0,y0]=rr[j],[s1,y1]=rr[j+1],a0=e(k,s0),b0=e(k+1,s0),a1=e(k,s1),b1=e(k+1,s1);
    quad(P(a0[0],y0,a0[1]),P(b0[0],y0,b0[1]),P(b1[0],y1,b1[1]),P(a1[0],y1,a1[1]),j===0?ROOF2:ROOF);}
  for(let k=0;k<N;k++){const a=e(k,0.85),b=e(k+1,0.85);quad(P(a[0],47.6,a[1]),P(b[0],47.6,b[1]),P(b[0],49.2,b[1]),P(a[0],49.2,a[1]),DARK);}
  /* the tower: from its foot at the north end, rising and leaning more and more out over the stadium
     (165 m high, 45 degrees at the top), wide at the foot, narrow at the top, with the glass lookout */
  const tu=(T0[0]-cx)*ux+(T0[1]-cz)*uz,tv=(T0[0]-cx)*vx+(T0[1]-cz)*vz,dir=-Math.sign(tu||1);
  const sec=[];const S=10;
  for(let i=0;i<=S;i++){const f=i/S,y=165*f,lean=dir*(78*f*f),wU=26-16*f,wV=34-18*f;sec.push({u:tu+lean,v:tv,y:y,wU:wU,wV:wV});}
  for(let i=0;i<S;i++){const a=sec[i],b=sec[i+1];
    const C=(s,su,sv)=>P(s.u+su*s.wU/2,s.y,s.v+sv*s.wV/2);
    const sides=[[[-1,-1],[1,-1]],[[1,-1],[1,1]],[[1,1],[-1,1]],[[-1,1],[-1,-1]]];
    sides.forEach(([p,q],k)=>quad(C(a,p[0],p[1]),C(a,q[0],q[1]),C(b,q[0],q[1]),C(b,p[0],p[1]),i>=S-2?GLASS:(k%2?CON:RIB)));}
  {const t=sec[S],C=(su,sv)=>P(t.u+su*t.wU/2,t.y,t.v+sv*t.wV/2);quad(C(-1,-1),C(1,-1),C(1,1),C(-1,1),RIB);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();
  const m=new THREE.Mesh(g,this.material());m.name='landmark-'+L.id;const grp=new THREE.Group();grp.add(m);return grp;
};
/* simple meshes for the dome and the orange */
TN.Landmarks.prototype.mesh=function(pos,col,id){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();
  const m=new THREE.Mesh(g,this.material());m.name='landmark-'+id;const grp=new THREE.Group();grp.add(m);return grp;
};
TN.Landmarks.prototype.buildDome=function(L){
  const c=TN.toLocal(L.lng,L.lat),R=38,cy=62-R,pos=[],col=[],STEEL=[0.62,0.64,0.66],HUB=[0.50,0.52,0.55],MUS=[0.86,0.85,0.82],GL=[0.30,0.42,0.50];
  TN.landmarkHide.push({id:L.id,x:c[0],z:c[1],r:L.r});
  const tri=(a,b,d,k)=>{for(const p of [a,b,d]){pos.push(p[0],p[1],p[2]);col.push(k[0],k[1],k[2]);}};
  const quad=(a,b,d,e,k)=>{tri(a,b,d,k);tri(a,d,e,k);};
  /* the lattice: every edge of a finely divided sphere, as a thin steel strip (the sphere is cut off near the ground) */
  const ico=new THREE.IcosahedronGeometry(R,3),pp=ico.attributes.position,seen=new Set();
  const key=(a,b)=>{const k1=a.map(v=>v.toFixed(2)).join(','),k2=b.map(v=>v.toFixed(2)).join(',');return k1<k2?k1+'|'+k2:k2+'|'+k1;};
  for(let i=0;i<pp.count;i+=3){const v=[0,1,2].map(j=>[pp.getX(i+j),pp.getY(i+j),pp.getZ(i+j)]);
    for(const [a,b] of [[v[0],v[1]],[v[1],v[2]],[v[2],v[0]]]){const k=key(a,b);if(seen.has(k)) continue;seen.add(k);
      if(a[1]+cy<1&&b[1]+cy<1) continue;
      const A=[c[0]+a[0],Math.max(0,a[1]+cy),c[1]+a[2]],B=[c[0]+b[0],Math.max(0,b[1]+cy),c[1]+b[2]];
      /* the strip is 0.5 m wide, turned to face out from the middle of the sphere */
      const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,mz=(a[2]+b[2])/2,dx=B[0]-A[0],dy=B[1]-A[1],dz=B[2]-A[2];
      let px=dy*mz-dz*my,py=dz*mx-dx*mz,pz=dx*my-dy*mx;const pl=Math.hypot(px,py,pz)||1;px*=0.25/pl;py*=0.25/pl;pz*=0.25/pl;
      quad([A[0]-px,A[1]-py,A[2]-pz],[B[0]-px,B[1]-py,B[2]-pz],[B[0]+px,B[1]+py,B[2]+pz],[A[0]+px,A[1]+py,A[2]+pz],STEEL);}}
  ico.dispose();
  /* the ring at the bottom, and the museum building inside (a low box with a glass band) */
  const bR=Math.sqrt(R*R-cy*cy),N=48;
  for(let k=0;k<N;k++){const t0=k/N*Math.PI*2,t1=(k+1)/N*Math.PI*2,p=(t,r,y)=>[c[0]+Math.cos(t)*r,y,c[1]+Math.sin(t)*r];
    quad(p(t0,bR,0),p(t1,bR,0),p(t1,bR,2.5),p(t0,bR,2.5),HUB);}
  const box=(x0,x1,z0,z1,y0,y1,k)=>{const P=(x,y,z)=>[c[0]+x,y,c[1]+z];
    quad(P(x0,y1,z0),P(x1,y1,z0),P(x1,y1,z1),P(x0,y1,z1),k);
    for(const [a,b] of [[[x0,z0],[x1,z0]],[[x1,z0],[x1,z1]],[[x1,z1],[x0,z1]],[[x0,z1],[x0,z0]]]) quad(P(a[0],y0,a[1]),P(b[0],y0,b[1]),P(b[0],y1,b[1]),P(a[0],y1,a[1]),k);};
  box(-18,18,-18,18,0,14,MUS);box(-18.2,18.2,-18.2,18.2,6,9,GL);box(-10,10,-10,10,14,22,MUS);
  return this.mesh(pos,col,L.id);
};
TN.Landmarks.prototype.buildOrange=function(L){
  const c=TN.toLocal(L.lng,L.lat),R=6.15,cy=R+1.6,pos=[],col=[],OR=[1.0,0.20,0.0],OR2=[0.85,0.16,0.0],BASE=[0.80,0.80,0.78];
  TN.landmarkHide.push({id:L.id,x:c[0],z:c[1],r:L.r});
  const tri=(a,b,d,k)=>{for(const p of [a,b,d]){pos.push(p[0],p[1],p[2]);col.push(k[0],k[1],k[2]);}};
  /* the orange ball, with faint segment lines like an orange's skin, on a short white base */
  const S=24,T=14,P=(i,j)=>{const th=i/S*Math.PI*2,ph=j/T*Math.PI;return [c[0]+R*Math.sin(ph)*Math.cos(th),cy+R*Math.cos(ph),c[1]+R*Math.sin(ph)*Math.sin(th)];};
  for(let i=0;i<S;i++) for(let j=0;j<T;j++){const k=(i%3===0)?OR2:OR;tri(P(i,j),P(i+1,j),P(i+1,j+1),k);tri(P(i,j),P(i+1,j+1),P(i,j+1),k);}
  const N=20;for(let k=0;k<N;k++){const t0=k/N*Math.PI*2,t1=(k+1)/N*Math.PI*2,q=(t,r,y)=>[c[0]+Math.cos(t)*r,y,c[1]+Math.sin(t)*r];
    tri(q(t0,3.2,0),q(t1,3.2,0),q(t1,3.2,2.2),BASE);tri(q(t0,3.2,0),q(t1,3.2,2.2),q(t0,3.2,2.2),BASE);}
  return this.mesh(pos,col,L.id);
};
TN.Landmarks.prototype.build=function(L){
  if(L.kind==='dome') return this.buildDome(L);
  if(L.kind==='orange') return this.buildOrange(L);
  if(L.kind==='olympic') return this.buildOlympic(L);
  if(L.kind!=='stadium') return null;
  const c0=TN.toLocal(L.lng,L.lat),fit=this.fit(L);
  const cx=fit?fit.x:c0[0],cz=fit?fit.z:c0[1],ang=fit?fit.ang:L.bearing*Math.PI/180;
  TN.landmarkHide.push({id:L.id,x:cx,z:cz,r:L.r});
  const pos=[],col=[];
  /* model frame: u along the pitch (its length), v across, y up; turned to the real direction at the end */
  const ux=Math.sin(ang),uz=-Math.cos(ang),vx=-uz,vz=ux;
  const P=(u,y,v)=>[cx+ux*u+vx*v,y,cz+uz*u+vz*v];
  const tri=(a,b,c,k)=>{for(const p of [a,b,c]){pos.push(p[0],p[1],p[2]);col.push(k[0],k[1],k[2]);}};
  const quad=(a,b,c,d,k)=>{tri(a,b,c,k);tri(a,c,d,k);};
  const flat=(u0,u1,v0,v1,y,k)=>quad(P(u0,y,v0),P(u1,y,v0),P(u1,y,v1),P(u0,y,v1),k);
  const box=(u0,u1,v0,v1,y0,y1,k)=>{const sh=[k[0]*0.85,k[1]*0.85,k[2]*0.85];
    flat(u0,u1,v0,v1,y1,k);
    quad(P(u0,y0,v0),P(u1,y0,v0),P(u1,y1,v0),P(u0,y1,v0),sh);quad(P(u0,y0,v1),P(u1,y0,v1),P(u1,y1,v1),P(u0,y1,v1),sh);
    quad(P(u0,y0,v0),P(u0,y0,v1),P(u0,y1,v1),P(u0,y1,v0),sh);quad(P(u1,y0,v0),P(u1,y0,v1),P(u1,y1,v1),P(u1,y1,v0),sh);};
  const GR=[0.31,0.56,0.27],GR2=[0.28,0.52,0.25],WH=[0.95,0.95,0.95],CON=[0.70,0.70,0.68],SEAT=[0.17,0.25,0.45],SEAT2=[0.21,0.30,0.52],ROOF=[0.88,0.89,0.90],DARK=[0.25,0.26,0.28];
  const y0=0.06,PL=105/2,PW=68/2;
  /* the pitch: mown stripes, then the white markings */
  for(let k=0;k<12;k++){const a=-58+k*116/12;flat(a,a+116/12,-40,40,y0,k%2?GR:GR2);}
  const ln=(u0,v0,u1,v1)=>{const du=u1-u0,dv=v1-v0,l=Math.hypot(du,dv)||1,pu=-dv/l*0.06,pv=du/l*0.06;
    quad(P(u0-pu,y0+0.02,v0-pv),P(u1-pu,y0+0.02,v1-pv),P(u1+pu,y0+0.02,v1+pv),P(u0+pu,y0+0.02,v0+pv),WH);};
  ln(-PL,-PW,PL,-PW);ln(-PL,PW,PL,PW);ln(-PL,-PW,-PL,PW);ln(PL,-PW,PL,PW);ln(0,-PW,0,PW);
  for(let k=0;k<32;k++){const a=k/32*Math.PI*2,b=(k+1)/32*Math.PI*2;ln(Math.cos(a)*9.15,Math.sin(a)*9.15,Math.cos(b)*9.15,Math.sin(b)*9.15);}
  for(const s of [-1,1]){
    ln(s*PL,-20.15,s*(PL-16.5),-20.15);ln(s*PL,20.15,s*(PL-16.5),20.15);ln(s*(PL-16.5),-20.15,s*(PL-16.5),20.15);
    ln(s*PL,-9.16,s*(PL-5.5),-9.16);ln(s*PL,9.16,s*(PL-5.5),9.16);ln(s*(PL-5.5),-9.16,s*(PL-5.5),9.16);
    /* the goal: two posts and the bar */
    const g=s*(PL+0.3);box(g-0.07,g+0.07,-3.73,-3.59,0,2.44,WH);box(g-0.07,g+0.07,3.59,3.73,0,2.44,WH);box(g-0.07,g+0.07,-3.73,3.73,2.37,2.51,WH);}
  /* a stand along one side: rows of seats rising from the front (near the pitch) to the back, a back wall,
     closed ends, and optionally a roof reaching over the seats */
  const stand=(side,along,len,front,depth,h,roof)=>{
    /* side: which edge (+1/-1); along: true = a long side (stand runs along u), false = an end (runs along v) */
    const at=(a,d,y)=>along?P(a,y,side*(front+d)):P(side*(front+d),y,a);
    const rows=Math.max(4,Math.round(depth/0.9));
    for(let r=0;r<rows;r++){const d0=r/rows*depth,d1=(r+1)/rows*depth,yA=1.2+h*r/rows,yB=1.2+h*(r+1)/rows;
      quad(at(-len/2,d0,yA),at(len/2,d0,yA),at(len/2,d0,yB),at(-len/2,d0,yB),r%2?SEAT:SEAT2);   /* riser */
      quad(at(-len/2,d0,yB),at(len/2,d0,yB),at(len/2,d1,yB),at(-len/2,d1,yB),r%2?SEAT2:SEAT);}  /* step */
    quad(at(-len/2,0,0),at(len/2,0,0),at(len/2,0,1.2),at(-len/2,0,1.2),CON);                        /* front wall */
    quad(at(-len/2,depth,0),at(len/2,depth,0),at(len/2,depth,h+1.6),at(-len/2,depth,h+1.6),CON);    /* back wall */
    for(const e of [-len/2,len/2]){tri(at(e,0,0),at(e,depth,0),at(e,depth,h+1.6),CON);tri(at(e,0,0),at(e,depth,h+1.6),at(e,0,1.2),CON);}
    if(roof){const yb=h+6,yf=h+4.5,over=depth*0.85;
      quad(at(-len/2,depth+1,yb),at(len/2,depth+1,yb),at(len/2,depth-over,yf),at(-len/2,depth-over,yf),ROOF);
      quad(at(-len/2,depth+1,yb-0.5),at(len/2,depth+1,yb-0.5),at(len/2,depth-over,yf-0.5),at(-len/2,depth-over,yf-0.5),DARK);
      /* the light row under the front edge, and posts at the back */
      quad(at(-len/2+4,depth-over+0.2,yf-0.55),at(len/2-4,depth-over+0.2,yf-0.55),at(len/2-4,depth-over+0.8,yf-0.55),at(-len/2+4,depth-over+0.8,yf-0.55),[1,1,0.92]);
      for(let a=-len/2;a<=len/2+0.1;a+=len/8){const p=along?a:a;const q0=at(p,depth+0.5,0),q1=at(p,depth+0.5,yb);
        quad([q0[0]-0.3,0,q0[2]],[q0[0]+0.3,0,q0[2]],[q1[0]+0.3,yb,q1[2]],[q1[0]-0.3,yb,q1[2]],DARK);}}
  };
  stand(-1,true,112,PW+6,24,17,true);     /* main stand (two tiers' height), roofed */
  stand(1,true,104,PW+6,18,11,true);      /* the stand across, roofed */
  stand(-1,false,64,PL+7,13,7,false);     /* the two ends */
  stand(1,false,64,PL+7,15,8,false);
  /* the concourse around the stadium (light paving) */
  flat(-PL-26,PL+26,-PW-35,PW+30,0.03,[0.78,0.77,0.73]);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();
  const m=new THREE.Mesh(g,this.material());m.name='landmark-'+L.id;
  const grp=new THREE.Group();grp.add(m);return grp;
};
