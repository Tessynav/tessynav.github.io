/* MapKoon v2 — buses.js (v1, Nov 20: a first look, switched on in Settings → The city → STM live buses)
   STM's buses where they really are: every 30 s the app asks our server (/buses on the Worker) for the buses within
   about 1.5 km; the server asks STM at most once every 30 s for everyone and keeps a copy. Each bus is drawn on the
   road it is on (white, blue stripe, its route number on its signs), and between updates it keeps going at its reported speed
   along that road, then glides to the next reported spot. At most 12 buses, the nearest. Route number on lit signs (front, back, sides).
   Data © Société de transport de Montréal (CC BY 4.0), credited on the map while the buses are shown. Unofficial: no STM
   logo. ?bus=1 switches it on for a test, ?bus=0 off. */
var TN=globalThis.TN||{};globalThis.TN=TN;

TN.Buses=function(scene,net){
  this.scene=scene;this.net=net;this.on=false;this.buses=new Map();this.pollT=0;this.busy=false;this.mats=null;this.lastOk=0;
  try{const s=JSON.parse(localStorage.getItem('tn2_settings')||'{}')||{};this.on=!!s.buses;}catch(e){}
  if(typeof location!=='undefined'){if(/[?&]bus=1/.test(location.search)) this.on=true;if(/[?&]bus=0/.test(location.search)) this.on=false;}
};
TN.Buses.prototype.build=function(){
  if(this.geo) return;
  const W=1.28,H=3.15,L=6.1;   /* a 12 m STM bus: 2.55 m wide; front at -z (heading 0 = north) */
  const box=(x0,x1,y0,y1,z0,z1)=>{const g=new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0);g.translate((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);return g;};
  this.geo={body:box(-W,W,0.35,H,-L,L),stripe:box(-W-0.02,W+0.02,0.55,1.05,-L+0.1,L-0.1),win:box(-W-0.03,W+0.03,1.55,2.55,-L+1.2,L-0.6),
    front:box(-W+0.15,W-0.15,1.2,2.75,-L-0.03,-L),head:box(-W+0.2,W-0.2,0.7,0.95,-L-0.04,-L),tail:box(-W+0.15,W-0.15,0.75,1.05,L,L+0.04),
    wheel:new THREE.CylinderGeometry(0.5,0.5,0.35,12)};
  this.mats={body:new THREE.MeshLambertMaterial({color:0xf3f5f7}),stripe:new THREE.MeshLambertMaterial({color:0x0b5ed7}),
    win:new THREE.MeshBasicMaterial({color:0x1d2935}),winLit:new THREE.MeshBasicMaterial({color:0xffe7a3}),
    head:new THREE.MeshBasicMaterial({color:0xfff6d8}),tail:new THREE.MeshBasicMaterial({color:0xff3030}),wheel:new THREE.MeshLambertMaterial({color:0x222222})};
};
/* the route number: lit amber signs above the windscreen and on the back (planes on the bus: sprites don't work in
   the map's 3D layer) */
TN.Buses.prototype.sign=function(txt){
  const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d');
  x.fillStyle='#0d0f12';x.fillRect(0,0,256,64);x.fillStyle='#ffb31a';x.font='bold 50px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(txt,128,35);
  const m=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c)}),g=new THREE.Group(),pg=new THREE.PlaneGeometry(2.1,0.55);
  const f=new THREE.Mesh(pg,m);f.position.set(0,2.95,-6.14);f.rotation.y=Math.PI;g.add(f);   /* front (faces -z) */
  const b=new THREE.Mesh(pg,m);b.position.set(0,2.95,6.14);g.add(b);                          /* back (faces +z) */
  for(const sx of [-1,1]){const sd=new THREE.Mesh(new THREE.PlaneGeometry(1.4,0.4),m);sd.position.set(sx*1.31,2.85,-4.6);sd.rotation.y=sx*Math.PI/2;g.add(sd);}
  g.userData.mat=m;return g;
};
TN.Buses.prototype.make=function(route){
  this.build();const G=this.geo,M=this.mats,g=new THREE.Group();
  const add=(geo,m)=>{const o=new THREE.Mesh(geo,m);g.add(o);return o;};
  add(G.body,M.body);add(G.stripe,M.stripe);const w=add(G.win,M.win);add(G.front,M.win);add(G.head,M.head);add(G.tail,M.tail);
  for(const [x,z] of [[-1.1,-3.9],[1.1,-3.9],[-1.1,3.6],[1.1,3.6]]){const o=add(G.wheel,M.wheel);o.rotation.z=Math.PI/2;o.position.set(x,0.5,z);}
  g.add(this.sign(route||'?'));g.userData.win=w;
  this.scene.three.scene.add(g);return g;
};
TN.Buses.prototype.free=function(b){if(b.g){this.scene.three.scene.remove(b.g);const sg=b.g.children[b.g.children.length-1];try{const m=sg.userData.mat;m.map.dispose();m.dispose();}catch(e){}}};
TN.Buses.prototype.clear=function(){for(const b of this.buses.values()) this.free(b);this.buses.clear();this.credit(false);};
/* "Bus data: STM" next to the map's other credits, while buses are shown */
TN.Buses.prototype.credit=function(show){
  try{const el=document.querySelector('.maplibregl-ctrl-attrib-inner');if(!el) return;let s=el.querySelector('.tn-stm');
    if(show&&!s){s=document.createElement('span');s.className='tn-stm';s.textContent=' | Bus data: STM (unofficial)';el.appendChild(s);}
    else if(!show&&s) s.remove();}catch(e){}
};
/* the road under a point, going in a direction (buses are kept on the road surface, on their side of it) */
TN.Buses.prototype.snap=function(x,z,hd){
  let best=null;const ux=Math.sin(hd),uz=-Math.cos(hd);
  this.net.near(x,z,25,(w,k)=>{if(w.tun||w.cls==='service'&&!w.name) return;const r=TN.seg(w,k,x,z);
    const dot=r.tx*ux+r.tz*uz,al=Math.abs(dot),sc=r.d+(1-al)*25+(w.ow&&dot<0?30:0);   /* (a one-way going the other way: the other carriageway) */
    if(!best||sc<best.sc) best={sc:sc,r:r,w:w,k:k};});
  if(!best||best.r.d>30) return null;
  const r=best.r,w=best.w,k=best.k;let tx=r.tx,tz=r.tz;if(tx*ux+tz*uz<0){tx=-tx;tz=-tz;}
  const side=w.ow?0:Math.min(3.2,TN.width(w)/4);   /* two-way roads: on the right-hand half */
  const h=w.hs?w.hs[k]+(w.hs[k+1]-w.hs[k])*r.u:(w.br?w.H:0);
  return {x:r.qx-tz*side,z:r.qz+tx*side,hd:Math.atan2(tx,-tz),h:h};
};
TN.Buses.prototype.poll=async function(cx,cz){
  if(this.busy) return;this.busy=true;
  try{const ll=TN.fromLocal(cx,cz);
    const r=await fetch((TN.TESLA_SERVER||'https://tessynav.mznwattar.workers.dev')+'/buses?lat='+ll[1].toFixed(5)+'&lon='+ll[0].toFixed(5)+'&r=1500');
    const j=await r.json();if(!r.ok||!j.buses) throw new Error(j.error||r.status);
    this.lastOk=Date.now();const seen=new Set();let n=0;
    for(const b of j.buses){if(n>=12) break;const [id,route,la,lo,brg,spd,ts]=b;if(!id) continue;
      const q=TN.toLocal(lo,la),hd=(brg==null?0:brg)*Math.PI/180;
      /* how old the position is: it has kept going since (at most 15 s of that is added, in a straight line; if that lands off the roads, the reported spot is used) */
      const age=ts?Math.max(0,Math.min(15,Date.now()/1000-ts)):0,v=Math.max(0,Math.min(25,spd||0));
      let x=q[0]+Math.sin(hd)*v*age,z=q[1]-Math.cos(hd)*v*age;
      if(Math.hypot(x-cx,z-cz)>1600) continue;
      seen.add(id);n++;
      let B=this.buses.get(id);
      if(!this.snap(x,z,hd)){x=q[0];z=q[1];}
      if(!B){const s=this.snap(x,z,hd);if(!s) continue;B={id:id,route:route,x:s.x,z:s.z,hd:s.hd,h:s.h,v:v,g:this.make(route)};this.buses.set(id,B);}
      B.tx=x;B.tz=z;B.thd=hd;B.v=v;B.glide=3;   /* glide to the new spot over 3 s */
    }
    for(const [id,B] of this.buses) if(!seen.has(id)){this.free(B);this.buses.delete(id);}
    this.credit(this.buses.size>0);
    TN.rec&&TN.rec.note&&TN.rec.note('buses',{all:j.n,near:j.buses.length,shown:this.buses.size});
  }catch(e){TN.rec&&TN.rec.note&&TN.rec.note('buses',{error:String(e&&e.message||e).slice(0,80)});}
  this.busy=false;
};
TN.Buses.prototype.update=function(dt,cx,cz){
  if(!this.on||!this.scene.three||typeof THREE==='undefined'){if(this.buses.size) this.clear();return;}
  this.pollT-=dt;if(this.pollT<=0){this.pollT=30;this.poll(cx,cz);}
  const night=(this.scene.night||0)>0.5;
  for(const B of this.buses.values()){
    /* keep going at the reported speed; while gliding, pulled toward the newly reported spot */
    let x=B.x+Math.sin(B.hd)*B.v*dt,z=B.z-Math.cos(B.hd)*B.v*dt;
    if(B.glide>0&&B.tx!=null){const k=Math.min(1,dt/B.glide);x+=(B.tx-x)*k;z+=(B.tz-z)*k;B.tx+=Math.sin(B.thd)*B.v*dt;B.tz-=Math.cos(B.thd)*B.v*dt;B.glide-=dt;}
    /* then pulled onto the road (its own side), turning with the road */
    const s=this.snap(x,z,B.glide>0&&B.thd!=null?B.thd:B.hd);
    if(s){const k=Math.min(1,dt*5);x+=(s.x-x)*k;z+=(s.z-z)*k;B.h=s.h;
      const dh=((s.hd-B.hd+3*Math.PI)%(2*Math.PI))-Math.PI;B.hd+=dh*Math.min(1,dt*3);}
    B.x=x;B.z=z;
    B.g.position.set(B.x,(B.h||0)+0.02,B.z);B.g.rotation.y=-B.hd;
    const wm=night?this.mats.winLit:this.mats.win;if(B.g.userData.win.material!==wm) B.g.userData.win.material=wm;
  }
};
