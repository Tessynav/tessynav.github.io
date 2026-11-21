/* MapKoon v2 — fuel.js (v1.1, Nov 21 2026)
   Gas stations as simple 3D canopies: landmarks to turn by ("right after the gas station"), not a gas finder
   (MapKoon drivers drive Teslas). No names, prices or logos: a white canopy on pillars, a thin coloured band, pump
   islands underneath, and the underside lit at night like real stations.
   Data: fuel/fuel.json from the weekly OpenStreetMap job (tessynav-roads/fuel.py). When OpenStreetMap draws the canopy,
   it is used (size and direction) and the map's plain block standing in its place is left out; otherwise a standard
   canopy is lined up with the nearest road.
   Light: each canopy is built once from merged pieces (4 drawing jobs), only within ~800 m, at most 10.
   Settings → 3D details → Gas stations. ?fuel=0 turns them off. */
var TN=globalThis.TN||{};globalThis.TN=TN;
/* (read from the repository itself, like the parking rules: the roads site only publishes the road tiles) */
TN.FUEL_URL='https://raw.githubusercontent.com/Tessynav/tessynav-roads/main/fuel/fuel.json';

TN.Fuel=function(scene,net){
  this.scene=scene;this.net=net;this.on=true;this.list=null;this.built=new Map();this.t=0;this.loading=false;
  try{const s=JSON.parse(localStorage.getItem('tn2_settings')||'{}')||{};if(s.fuel===false) this.on=false;}catch(e){}
  if(typeof location!=='undefined'&&/[?&]fuel=0/.test(location.search)) this.on=false;
};
TN.Fuel.prototype.load=function(){
  if(this.list||this.loading) return;this.loading=true;
  fetch(TN.FUEL_URL).then(r=>r.ok?r.json():null).then(j=>{this.list=(j&&j.st)||[];}).catch(()=>{this.list=[];}).finally(()=>{this.loading=false;});
};
TN.Fuel.prototype.mats=function(){
  if(this.M) return this.M;
  this.M={roof:new THREE.MeshLambertMaterial({color:0xf4f6f8}),grey:new THREE.MeshLambertMaterial({color:0x9aa1a9}),
    glow:new THREE.MeshBasicMaterial({color:0xfff4d6}),day:new THREE.MeshLambertMaterial({color:0xe6e9ec}),
    band:[0xd64545,0x2f7d4f,0x2f6fe4,0xe08a1e,0x6b4fc9].map(c=>new THREE.MeshLambertMaterial({color:c}))};
  return this.M;
};
/* the pieces of one canopy, merged by colour */
TN.Fuel.prototype.make=function(st,x,z,hd,h){
  const M=this.mats(),w=st[2]||9,l=st[3]||18,top=5.4,th=0.9;
  const box=(x0,x1,y0,y1,z0,z1)=>{const g=new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0);g.translate((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);return g.toNonIndexed();};
  const merge=(list)=>{let n=0;for(const g of list) n+=g.attributes.position.count;const P=new Float32Array(n*3),N=new Float32Array(n*3);let o=0;
    for(const g of list){P.set(g.attributes.position.array,o*3);N.set(g.attributes.normal.array,o*3);o+=g.attributes.position.count;g.dispose();}
    const m=new THREE.BufferGeometry();m.setAttribute('position',new THREE.BufferAttribute(P,3));m.setAttribute('normal',new THREE.BufferAttribute(N,3));return m;};
  const W=w/2,L=l/2;
  const roof=[box(-W,W,top-th,top,-L,L)];
  const band=[box(-W-0.03,W+0.03,top-0.62,top-0.38,-L-0.03,L+0.03)];
  const under=[box(-W+0.4,W-0.4,top-th-0.02,top-th,-L+0.4,L-0.4)];
  const grey=[];
  const nI=Math.max(1,Math.min(4,Math.round(l/7))),step=l/nI;
  for(let i=0;i<nI;i++){const zc=-L+step*(i+0.5);
    grey.push(box(-0.6,0.6,0,0.2,zc-2.1,zc+2.1));                               /* island curb */
    grey.push(box(-0.35,0.35,0.2,1.7,zc-1.1,zc-0.5),box(-0.35,0.35,0.2,1.7,zc+0.5,zc+1.1));   /* pumps */
    grey.push(box(-0.14,0.14,0.2,top-th,zc-0.14,zc+0.14));                       /* pillar */
  }
  const g=new THREE.Group(),c=Math.abs(Math.round(st[0]*1e4+st[1]*1e4))%M.band.length;
  const add=(geo,m)=>{const o=new THREE.Mesh(geo,m);g.add(o);return o;};
  add(merge(roof),M.roof);add(merge(band),M.band[c]);const u=add(merge(under),M.day);add(merge(grey),M.grey);
  g.userData.under=u;g.position.set(x,h,z);g.rotation.y=-hd;
  this.scene.three.scene.add(g);return g;
};
TN.Fuel.prototype.drop=function(key){const g=this.built.get(key);if(!g) return;this.scene.three.scene.remove(g);g.traverse(o=>{if(o.geometry) o.geometry.dispose();});this.built.delete(key);
  if(TN.landmarkHide) TN.landmarkHide=TN.landmarkHide.filter(h=>h.id!=='fuel:'+key);};
TN.Fuel.prototype.clear=function(){for(const k of [...this.built.keys()]) this.drop(k);};
/* the direction and height of the nearest road (a canopy with no shape of its own lines up with it) */
TN.Fuel.prototype.road=function(x,z){
  let best=null;this.net.near(x,z,45,(w,k)=>{if(w.tun||w.br) return;const r=TN.seg(w,k,x,z);if(!best||r.d<best.r.d) best={r:r,w:w,k:k};});
  if(!best) return {hd:0,h:0};const r=best.r,w=best.w,k=best.k;
  return {hd:Math.atan2(r.tx,-r.tz),h:w.hs?w.hs[k]+(w.hs[k+1]-w.hs[k])*r.u:0};
};
TN.Fuel.prototype.update=function(dt,cx,cz){
  if(!this.on||!this.scene.three||typeof THREE==='undefined'){if(this.built.size) this.clear();return;}
  this.t-=dt;if(this.t>0) return;this.t=2;
  if(!this.list){this.load();return;}
  const ll=TN.fromLocal(cx,cz),near=[];
  for(let i=0;i<this.list.length;i++){const s=this.list[i];if(Math.abs(s[0]-ll[1])>0.012||Math.abs(s[1]-ll[0])>0.017) continue;
    const q=TN.toLocal(s[1],s[0]),d=Math.hypot(q[0]-cx,q[1]-cz);if(d<800) near.push([d,i,q]);}
  near.sort((a,b)=>a[0]-b[0]);const keep=new Set(near.slice(0,10).map(n=>n[1]));
  for(const k of [...this.built.keys()]) if(!keep.has(k)) this.drop(k);
  const night=(this.scene.night||0)>0.5,M=this.mats();
  for(const [d,i,q] of near.slice(0,10)){
    if(!this.built.has(i)){const s=this.list[i],rd=this.road(q[0],q[1]);
      const hd=s[4]!=null?s[4]*Math.PI/180:rd.hd;   /* (OSM's canopy direction, or along the road) */
      this.built.set(i,this.make(s,q[0],q[1],hd,rd.h));
      /* the map's plain block where OpenStreetMap draws the canopy: left out */
      if(s[2]&&TN.landmarkHide) TN.landmarkHide.push({id:'fuel:'+i,x:q[0],z:q[1],r:Math.min(s[2],s[3])/2});}
    const g=this.built.get(i),u=g&&g.userData.under,m=night?M.glow:M.day;if(u&&u.material!==m) u.material=m;
  }
};
