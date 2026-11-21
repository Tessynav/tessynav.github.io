/* MapKoon v2 — chg3d.js (v1, Nov 21 2026)
   Fast chargers as small 3D landmarks, beside their map pins: a row of charging posts at painted parking stalls,
   and a tall sign with a lightning bolt, the number of stalls and the power. Red tops for Tesla Superchargers, blue
   for other fast chargers (only those shown on the map). Simple shapes, no logos.
   Uses the chargers the map already has (TN.chargers.list); built within ~700 m, at most 6, each from merged pieces.
   Settings → 3D details → Chargers in 3D. ?chg3d=0 turns them off. */
var TN=globalThis.TN||{};globalThis.TN=TN;

TN.Chg3D=function(scene,net){
  this.scene=scene;this.net=net;this.on=true;this.built=new Map();this.t=0;
  try{const s=JSON.parse(localStorage.getItem('tn2_settings')||'{}')||{};if(s.chg3d===false) this.on=false;
    this.showDC=!!s.chgDC;}catch(e){}
  if(typeof location!=='undefined'&&/[?&]chg3d=0/.test(location.search)) this.on=false;
};
TN.Chg3D.prototype.mats=function(){
  if(this.M) return this.M;
  this.M={pad:new THREE.MeshLambertMaterial({color:0x3b3f45}),line:new THREE.MeshBasicMaterial({color:0xe9ecef}),
    post:new THREE.MeshLambertMaterial({color:0xf3f4f6}),sc:new THREE.MeshLambertMaterial({color:0xd8213b}),
    dc:new THREE.MeshLambertMaterial({color:0x2f6fd6}),pole:new THREE.MeshLambertMaterial({color:0x8e959d}),
    screen:new THREE.MeshBasicMaterial({color:0x1b2733})};
  return this.M;
};
TN.Chg3D.prototype.sign=function(c){
  const cv=document.createElement('canvas');cv.width=256;cv.height=256;const x=cv.getContext('2d');
  x.fillStyle=c.kind==='sc'?'#d8213b':'#2f6fd6';x.beginPath();if(x.roundRect) x.roundRect(8,8,240,240,34);else x.rect(8,8,240,240);x.fill();
  x.fillStyle='#fff';x.beginPath();x.moveTo(140,28);x.lineTo(70,138);x.lineTo(118,138);x.lineTo(104,228);x.lineTo(184,108);x.lineTo(134,108);x.closePath();x.fill();
  x.font='bold 40px sans-serif';x.textAlign='left';x.textBaseline='middle';
  if(c.stalls) x.fillText(String(c.stalls),24,58);
  if(c.kw){x.font='bold 30px sans-serif';x.textAlign='right';x.fillText(Math.round(c.kw)+' kW',236,214);}
  return new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv)});
};
TN.Chg3D.prototype.make=function(c,x,z,hd,h){
  const M=this.mats(),n=Math.max(2,Math.min(12,c.stalls||8)),SW=2.8,D=5.5,len=n*SW;
  const box=(x0,x1,y0,y1,z0,z1)=>{const g=new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0);g.translate((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);return g.toNonIndexed();};
  const merge=(list)=>{let k=0;for(const g of list) k+=g.attributes.position.count;const P=new Float32Array(k*3),N=new Float32Array(k*3);let o=0;
    for(const g of list){P.set(g.attributes.position.array,o*3);N.set(g.attributes.normal.array,o*3);o+=g.attributes.position.count;g.dispose();}
    const m=new THREE.BufferGeometry();m.setAttribute('position',new THREE.BufferAttribute(P,3));m.setAttribute('normal',new THREE.BufferAttribute(N,3));return m;};
  /* the row runs along x; the stalls face +z (cars park toward the posts at z = 0) */
  const L=len/2,pad=[box(-L-1,L+1,0.02,0.07,-0.6,D)],lines=[],posts=[],caps=[],scr=[];
  for(let i=0;i<=n;i++){const lx=-L+i*SW;lines.push(box(lx-0.06,lx+0.06,0.07,0.09,0.2,D-0.3));}
  for(let i=0;i<n;i++){const px=-L+SW*(i+0.5);
    posts.push(box(px-0.2,px+0.2,0.07,1.75,-0.35,-0.05),box(px-0.32,px+0.32,0.07,0.17,-0.45,0.05));   /* post on a small base */
    caps.push(box(px-0.21,px+0.21,1.75,1.95,-0.36,-0.04));                                              /* coloured top */
    scr.push(box(px-0.13,px+0.13,1.25,1.55,-0.04,-0.02));}                                              /* little screen */
  const pole=[box(L+0.4,L+0.6,0.07,4.4,-0.3,-0.1)];
  const g=new THREE.Group(),add=(geo,m)=>{const o=new THREE.Mesh(geo,m);g.add(o);return o;};
  add(merge(pad),M.pad);add(merge(lines),M.line);add(merge(posts),M.post);add(merge(caps),c.kind==='sc'?M.sc:M.dc);add(merge(scr),M.screen);add(merge(pole),M.pole);
  /* the sign on top of the pole, readable from both sides */
  const sm=this.sign(c),sg=new THREE.PlaneGeometry(1.5,1.5);
  const f1=new THREE.Mesh(sg,sm);f1.position.set(L+0.5,4.9,-0.18);g.add(f1);
  const f2=new THREE.Mesh(sg,sm);f2.position.set(L+0.5,4.9,-0.22);f2.rotation.y=Math.PI;g.add(f2);
  g.userData.sm=sm;g.position.set(x,h,z);g.rotation.y=-hd;
  this.scene.three.scene.add(g);return g;
};
TN.Chg3D.prototype.drop=function(id){const g=this.built.get(id);if(!g) return;this.scene.three.scene.remove(g);
  g.traverse(o=>{if(o.geometry) o.geometry.dispose();});try{g.userData.sm.map.dispose();g.userData.sm.dispose();}catch(e){}this.built.delete(id);};
TN.Chg3D.prototype.clear=function(){for(const k of [...this.built.keys()]) this.drop(k);};
/* the nearest road (not a bridge): the row of stalls lines up with it, set back on the side the charger is on */
TN.Chg3D.prototype.road=function(x,z){
  let best=null;this.net.near(x,z,60,(w,k)=>{if(w.tun||w.br) return;const r=TN.seg(w,k,x,z);if(!best||r.d<best.r.d) best={r:r,w:w,k:k};});
  if(!best) return {hd:0,h:0,face:0};const r=best.r,w=best.w,k=best.k;
  /* the row turned so the stalls' open side (+z) faces the road, and runs along it */
  const nx=x-r.qx,nz=z-r.qz,nl=Math.hypot(nx,nz);
  const a=nl>0.5?Math.atan2(nx,-nz):Math.atan2(r.tx,-r.tz)+Math.PI/2;
  return {hd:a,h:w.hs?w.hs[k]+(w.hs[k+1]-w.hs[k])*r.u:0};
};
TN.Chg3D.prototype.update=function(dt,cx,cz){
  const C=TN.chargers;
  if(!this.on||!C||!C.list||!C.list.length||!this.scene.three||typeof THREE==='undefined'){if(this.built.size) this.clear();return;}
  this.t-=dt;if(this.t>0) return;this.t=2;
  let dc=false;try{dc=!!(JSON.parse(localStorage.getItem('tn2_settings')||'{}')||{}).chgDC;}catch(e){}
  const ll=TN.fromLocal(cx,cz),near=[];
  for(const c of C.list){if(c.kind!=='sc'&&!dc) continue;if(Math.abs(c.ll[1]-ll[1])>0.011||Math.abs(c.ll[0]-ll[0])>0.016) continue;
    const q=TN.toLocal(c.ll[0],c.ll[1]),d=Math.hypot(q[0]-cx,q[1]-cz);if(d<700) near.push([d,c,q]);}
  near.sort((a,b)=>a[0]-b[0]);const keep=new Set(near.slice(0,6).map(n=>n[1].id));
  for(const k of [...this.built.keys()]) if(!keep.has(k)) this.drop(k);
  for(const [d,c,q] of near.slice(0,6)) if(!this.built.has(c.id)){const rd=this.road(q[0],q[1]);this.built.set(c.id,this.make(c,q[0],q[1],rd.hd,rd.h));}
};
