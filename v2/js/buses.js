/* MapKoon v2 — buses.js (v2, Nov 20: buses ride their route's real road path, and bus stops are shown; v1: a first look)
   Switched on in Settings → 3D details → STM live buses.
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
  /* (v3, Nov 21: a more realistic city bus: a 12 m low-floor bus, white with a blue skirt and a thin light-blue line,
     a dark window band with white pillars, a big windscreen, mirrors, two doors on the right, a roof unit, a rear
     engine grille and tail lights, wheels with hubs and a soft shadow. Still cheap: every part is shared by all buses
     and the parts of one colour are merged into one piece, so a bus is about 10 draws. No STM logo) */
  if(this.geo) return;
  const W=1.275,L=6.1;   /* half width / half length (2.55 m × 12.2 m); front at -z, right side at +x */
  const box=(x0,x1,y0,y1,z0,z1)=>{const g=new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0);g.translate((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);return g.toNonIndexed();};
  const cyl=(r,h,x,y,z)=>{const g=new THREE.CylinderGeometry(r,r,h,14);g.rotateZ(Math.PI/2);g.translate(x,y,z);return g.toNonIndexed();};
  const merge=(list)=>{let n=0;for(const g of list) n+=g.attributes.position.count;const P=new Float32Array(n*3),N=new Float32Array(n*3);let o=0;
    for(const g of list){P.set(g.attributes.position.array,o*3);N.set(g.attributes.normal.array,o*3);o+=g.attributes.position.count;g.dispose();}
    const m=new THREE.BufferGeometry();m.setAttribute('position',new THREE.BufferAttribute(P,3));m.setAttribute('normal',new THREE.BufferAttribute(N,3));return m;};
  const white=[box(-W,W,0.95,2.98,-L,L),box(-W+0.1,W-0.1,2.98,3.08,-L+0.15,L-0.1)];
  /* white pillars over the window band, both sides */
  for(const sx of [-1,1]) for(const z of [-3.2,-1.0,1.2,3.4,5.2]) white.push(box(sx>0?W:-W-0.03,sx>0?W+0.03:-W,1.3,2.45,z-0.09,z+0.09));
  const blue=[box(-W-0.01,W+0.01,0.32,0.95,-L-0.01,L+0.01)];
  const light=[];for(const sx of [-1,1]) light.push(box(sx>0?W:-W-0.02,sx>0?W+0.02:-W,1.02,1.1,-L+0.4,L-0.3));
  const side=[];for(const sx of [-1,1]) side.push(box(sx>0?W:-W-0.02,sx>0?W+0.02:-W,1.3,2.45,-L+2.0,L-0.4));
  const glass=[box(-W+0.12,W-0.12,1.05,2.72,-L-0.03,-L),   /* windscreen */
    box(-W+0.25,W-0.25,1.9,2.6,L,L+0.03),                  /* rear window */
    box(W,W+0.03,0.42,2.5,-L+0.55,-L+1.75),                /* front door */
    box(W,W+0.03,0.42,2.5,0.1,1.35)];                      /* middle door */
  const dark=[box(-W-0.02,W+0.02,0.25,0.55,-L-0.08,-L+0.3),  /* front bumper */
    box(-W-0.02,W+0.02,0.25,0.55,L-0.3,L+0.08),               /* rear bumper */
    box(-W+0.3,W-0.3,0.65,1.45,L,L+0.04),                     /* engine grille */
    box(-0.12,0.12,1.85,2.3,-L-0.05,-L+0.25)];               /* (mirror arm base) */
  for(const sx of [-1,1]) dark.push(box(sx*(W+0.05)-0.04,sx*(W+0.05)+0.04,1.85,2.55,-L+0.2,-L+0.4),box(sx*(W+0.12)-0.1,sx*(W+0.12)+0.1,1.75,2.25,-L+0.25,-L+0.35));   /* mirrors */
  const roof=[box(-0.8,0.8,3.08,3.42,-1.2,2.4)];             /* roof unit */
  const head=[];for(const sx of [-1,1]) head.push(box(sx*0.95-0.22,sx*0.95+0.22,0.62,0.82,-L-0.05,-L));
  const tail=[];for(const sx of [-1,1]) tail.push(box(sx*1.05-0.14,sx*1.05+0.14,0.7,1.5,L,L+0.05));
  const tyre=[],hub=[];for(const z of [-3.55,2.9]) for(const sx of [-1,1]){tyre.push(cyl(0.5,0.32,sx*(W-0.16),0.5,z));hub.push(cyl(0.28,0.34,sx*(W-0.15),0.5,z));}
  const sh=new THREE.PlaneGeometry(3.1,12.9);sh.rotateX(-Math.PI/2);sh.translate(0,0.03,0);
  this.geo={white:merge(white),blue:merge(blue),light:merge(light),side:merge(side),glass:merge(glass),dark:merge(dark),roof:merge(roof),head:merge(head),tail:merge(tail),tyre:merge(tyre),hub:merge(hub),shadow:sh};
  this.mats={white:new THREE.MeshLambertMaterial({color:0xf2f4f6}),blue:new THREE.MeshLambertMaterial({color:0x0a4fb5}),light:new THREE.MeshLambertMaterial({color:0x3fa9f5}),
    win:new THREE.MeshLambertMaterial({color:0x17212b}),winLit:new THREE.MeshBasicMaterial({color:0xffe6a0}),glass:new THREE.MeshLambertMaterial({color:0x1d2834}),
    dark:new THREE.MeshLambertMaterial({color:0x22262b}),roof:new THREE.MeshLambertMaterial({color:0xdfe3e7}),
    head:new THREE.MeshBasicMaterial({color:0xfff6d8}),tail:new THREE.MeshBasicMaterial({color:0xff2b2b}),
    tyre:new THREE.MeshLambertMaterial({color:0x151515}),hub:new THREE.MeshLambertMaterial({color:0xb8bec6}),
    shadow:new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.28,depthWrite:false})};
};
/* the route number: lit amber signs above the windscreen and on the back (planes on the bus: sprites don't work in
   the map's 3D layer) */
TN.Buses.prototype.sign=function(txt){
  const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d');
  x.fillStyle='#0d0f12';x.fillRect(0,0,256,64);x.fillStyle='#ffb31a';x.font='bold 50px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(txt,128,35);
  const m=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c)}),g=new THREE.Group(),pg=new THREE.PlaneGeometry(2.1,0.55);
  const f=new THREE.Mesh(pg,m);f.position.set(0,2.84,-6.14);f.rotation.y=Math.PI;g.add(f);   /* front (faces -z) */
  const b=new THREE.Mesh(pg,m);b.position.set(0,2.84,6.14);g.add(b);                          /* back (faces +z) */
  for(const sx of [-1,1]){const sd=new THREE.Mesh(new THREE.PlaneGeometry(1.4,0.4),m);sd.position.set(sx*1.31,2.72,-3.9);sd.rotation.y=sx*Math.PI/2;g.add(sd);}
  g.userData.mat=m;return g;
};
TN.Buses.prototype.make=function(route){
  this.build();const G=this.geo,M=this.mats,g=new THREE.Group();
  const add=(geo,m)=>{const o=new THREE.Mesh(geo,m);g.add(o);return o;};
  add(G.shadow,M.shadow).renderOrder=1;
  add(G.white,M.white);add(G.blue,M.blue);add(G.light,M.light);const w=add(G.side,M.win);add(G.glass,M.glass);add(G.dark,M.dark);add(G.roof,M.roof);
  add(G.head,M.head);add(G.tail,M.tail);add(G.tyre,M.tyre);add(G.hub,M.hub);
  g.add(this.sign(route||'?'));g.userData.win=w;
  this.scene.three.scene.add(g);return g;
};
TN.Buses.prototype.free=function(b){if(b.g){this.scene.three.scene.remove(b.g);const sg=b.g.children[b.g.children.length-1];try{const m=sg.userData.mat;m.map.dispose();m.dispose();}catch(e){}}};
TN.Buses.prototype.clear=function(){for(const b of this.buses.values()) this.free(b);this.buses.clear();this.credit(false);this.clearStops&&this.clearStops();};
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
/* ---------- each route's real road path (v2) ----------
   STM's schedule file, turned into small files by our weekly job (tessynav-transit): which path each trip follows,
   and the path itself. A bus with a known path rides exactly on it; without one (not loaded yet, or a bus out of
   service) it is placed on the nearest road as before. */
TN.TRANSIT=TN.TRANSIT||'https://app.mapkoon.com/tessynav-transit/data/';
TN.Buses.prototype.getJSON=function(cache,key,url){
  if(!cache.has(key)) cache.set(key,fetch(url).then(r=>r.ok?r.json():null).catch(()=>null));
  return cache.get(key);
};
TN.Buses.prototype.pathFor=async function(route,trip){
  this.tripC=this.tripC||new Map();this.shapeC=this.shapeC||new Map();
  if(!route||!trip) return null;
  const T=await this.getJSON(this.tripC,route,TN.TRANSIT+'trips/'+encodeURIComponent(route)+'.json');
  const t=T&&T[trip];if(!t) return null;
  const key=t[0];
  const P=await this.getJSON(this.shapeC,'s'+key,TN.TRANSIT+'shapes/'+encodeURIComponent(key)+'.json');
  if(!P||P.length<2) return null;
  if(!P.loc){const pts=P.map(c=>TN.toLocal(c[0],c[1])),cum=[0];for(let k=1;k<pts.length;k++) cum.push(cum[k-1]+Math.hypot(pts[k][0]-pts[k-1][0],pts[k][1]-pts[k-1][1]));P.loc={pts:pts,cum:cum,L:cum[cum.length-1],head:t[1]};}
  return P.loc;
};
/* where a point is along a path (searching near s0 first when given) */
TN.Buses.prototype.proj=function(S,x,z,s0){
  let best=1e18,bs=0;const P=S.pts,C=S.cum;
  for(let k=0;k<P.length-1;k++){if(s0!=null&&(C[k+1]<s0-400||C[k]>s0+800)) continue;
    const a=P[k],b=P[k+1],dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz||1;let u=((x-a[0])*dx+(z-a[1])*dz)/l2;u=Math.max(0,Math.min(1,u));
    const d=(a[0]+dx*u-x)**2+(a[1]+dz*u-z)**2;if(d<best){best=d;bs=C[k]+u*(C[k+1]-C[k]);}}
  return {s:bs,d:Math.sqrt(best)};
};
TN.Buses.prototype.along=function(S,s){
  s=Math.max(0,Math.min(S.L,s));const C=S.cum,P=S.pts;let lo=0,hi=C.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(C[m]<=s) lo=m;else hi=m;}
  const a=P[lo],b=P[hi],t=(s-C[lo])/((C[hi]-C[lo])||1);
  /* direction from a little behind to a little ahead (smooth through corners) */
  const p=(d)=>{d=Math.max(0,Math.min(S.L,d));let l=0,h=C.length-1;while(h-l>1){const m=(l+h)>>1;if(C[m]<=d) l=m;else h=m;}const tt=(d-C[l])/((C[h]-C[l])||1);return [P[l][0]+(P[h][0]-P[l][0])*tt,P[l][1]+(P[h][1]-P[l][1])*tt];};
  const p1=p(s-4),p2=p(s+4);
  return {x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t,hd:Math.atan2(p2[0]-p1[0],-(p2[1]-p1[1]))};
};
/* the height and side of the road at a point on the path (two-way roads: the bus keeps to the right-hand half) */
TN.Buses.prototype.road=function(x,z,hd){
  let best=null;const ux=Math.sin(hd),uz=-Math.cos(hd);
  this.net.near(x,z,8,(w,k)=>{if(w.tun) return;const r=TN.seg(w,k,x,z);const dot=r.tx*ux+r.tz*uz,sc=r.d+(1-Math.abs(dot))*20+(w.ow&&dot<0?30:0);if(!best||sc<best.sc) best={sc:sc,w:w,k:k,r:r};});
  if(!best||best.r.d>10) return {h:0,side:1.7};
  const w=best.w,k=best.k,r=best.r;
  return {h:w.hs?w.hs[k]+(w.hs[k+1]-w.hs[k])*r.u:(w.br?w.H:0),side:w.ow?0:Math.min(2.4,TN.width(w)/4)};
};
TN.Buses.prototype.poll=async function(cx,cz){
  if(this.busy) return;this.busy=true;
  try{const ll=TN.fromLocal(cx,cz);
    const r=await fetch((TN.TESLA_SERVER||'https://tessynav.mznwattar.workers.dev')+'/buses?lat='+ll[1].toFixed(5)+'&lon='+ll[0].toFixed(5)+'&r=1500');
    const j=await r.json();if(!r.ok||!j.buses) throw new Error(j.error||r.status);
    this.lastOk=Date.now();const seen=new Set();let n=0,onPath=0;
    for(const b of j.buses){if(n>=12) break;const [id,route,la,lo,brg,spd,ts,dir,trip]=b;if(!id) continue;
      const q=TN.toLocal(lo,la),hd=(brg==null?0:brg)*Math.PI/180;
      const age=ts?Math.max(0,Math.min(45,Date.now()/1000-ts)):0,v=Math.max(0,Math.min(25,spd||0));
      if(Math.hypot(q[0]-cx,q[1]-cz)>1600) continue;
      seen.add(id);n++;
      let B=this.buses.get(id);
      const S=await this.pathFor(route,trip);
      if(S){/* on its route's path: how far along it, plus the distance it has driven since STM's reading */
        const pr=this.proj(S,q[0],q[1],B&&B.S===S?B.s:null);
        if(pr.d<40){const sT=Math.min(S.L,pr.s+v*Math.min(age,30));onPath++;
          if(!B){B={id:id,route:route,S:S,s:sT,v:v,g:this.make(route)};this.buses.set(id,B);}
          else if(B.S!==S){B.S=S;B.s=sT;}
          B.sT=sT;B.v=v;continue;}}
      /* no path: the nearest road, as before */
      let x=q[0]+Math.sin(hd)*v*Math.min(age,15),z=q[1]-Math.cos(hd)*v*Math.min(age,15);
      if(!this.snap(x,z,hd)){x=q[0];z=q[1];}
      if(B&&B.S){B.S=null;}
      if(!B){const s=this.snap(x,z,hd);if(!s) continue;B={id:id,route:route,x:s.x,z:s.z,hd:s.hd,h:s.h,v:v,g:this.make(route)};this.buses.set(id,B);}
      B.tx=x;B.tz=z;B.thd=hd;B.v=v;B.glide=3;
    }
    for(const [id,B] of this.buses) if(!seen.has(id)){this.free(B);this.buses.delete(id);}
    this.credit(this.buses.size>0);
    TN.rec&&TN.rec.note&&TN.rec.note('buses',{all:j.n,near:j.buses.length,shown:this.buses.size,onPath:onPath});
  }catch(e){TN.rec&&TN.rec.note&&TN.rec.note('buses',{error:String(e&&e.message||e).slice(0,80)});}
  this.busy=false;
};
TN.Buses.prototype.update=function(dt,cx,cz){
  if(!this.on||!this.scene.three||typeof THREE==='undefined'){if(this.buses.size) this.clear();if(this.stops&&this.stops.size) this.clearStops();return;}
  this.pollT-=dt;if(this.pollT<=0){this.pollT=30;this.poll(cx,cz);}
  try{this.updateStops(dt,cx,cz);}catch(e){}
  const night=(this.scene.night||0)>0.5;
  for(const B of this.buses.values()){
    if(B.S){
      /* on its path: keeps going at its speed; catches up with (or waits for) the newest reading gently, never backwards */
      const gap=(B.sT!=null?B.sT:B.s)-B.s;let v=B.v;
      if(gap>3) v=B.v+Math.min(8,gap/4);else if(gap<-3) v=Math.max(0,B.v*0.3);
      B.s=Math.min(B.S.L,B.s+v*dt);if(B.sT!=null) B.sT+=B.v*dt;
      const p=this.along(B.S,B.s),rd=this.road(p.x,p.z,p.hd);
      const ux=Math.sin(p.hd),uz=-Math.cos(p.hd);
      const tx=p.x-uz*rd.side,tz=p.z+ux*rd.side;
      if(B.x==null){B.x=tx;B.z=tz;B.hd=p.hd;}
      const k=Math.min(1,dt*6);B.x+=(tx-B.x)*k;B.z+=(tz-B.z)*k;
      const dh=((p.hd-B.hd+3*Math.PI)%(2*Math.PI))-Math.PI;B.hd+=dh*Math.min(1,dt*4);B.h=rd.h;
    }else{
      let x=B.x+Math.sin(B.hd)*B.v*dt,z=B.z-Math.cos(B.hd)*B.v*dt;
      if(B.glide>0&&B.tx!=null){const k=Math.min(1,dt/B.glide);x+=(B.tx-x)*k;z+=(B.tz-z)*k;B.tx+=Math.sin(B.thd)*B.v*dt;B.tz-=Math.cos(B.thd)*B.v*dt;B.glide-=dt;}
      const s=this.snap(x,z,B.glide>0&&B.thd!=null?B.thd:B.hd);
      if(s){const k=Math.min(1,dt*5);x+=(s.x-x)*k;z+=(s.z-z)*k;B.h=s.h;
        const dh=((s.hd-B.hd+3*Math.PI)%(2*Math.PI))-Math.PI;B.hd+=dh*Math.min(1,dt*3);}
      B.x=x;B.z=z;}
    B.g.position.set(B.x,(B.h||0)+0.02,B.z);B.g.rotation.y=-B.hd;
    const wm=night?this.mats.winLit:this.mats.win;if(B.g.userData.win.material!==wm) B.g.userData.win.material=wm;
  }
};
/* ---------- bus stops (v2) ----------
   From the same weekly files: the stops in the ~2 km squares around you; drawn within 450 m (at most 40): a pole with
   a blue sign and the route numbers that stop there. */
TN.Buses.prototype.stopSign=function(name,routes){
  /* (v2.1, Nov 20: text shrinks to fit, so route numbers and the stop name are never cut) */
  const c=document.createElement('canvas');c.width=384;c.height=224;const x=c.getContext('2d');
  x.fillStyle='#0b5ed7';x.fillRect(0,0,384,224);x.fillStyle='#ffffff';x.fillRect(6,6,372,4);
  const fit=(t,max,px,bold)=>{let f=px;do{x.font=(bold?'bold ':'')+f+'px sans-serif';f-=2;}while(x.measureText(t).width>max&&f>12);};
  x.textBaseline='middle';x.fillStyle='#fff';
  x.textAlign='left';x.font='56px sans-serif';x.fillText('\u{1F68C}',14,66);
  const R=(routes||[]).slice(0,4).join('  ');x.textAlign='center';fit(R,280,64,true);x.fillText(R,236,68);
  let nm=name||'';const parts=nm.split(' / ');x.textAlign='center';
  if(parts.length===2&&nm.length>24){fit(parts[0],360,32,false);x.fillText(parts[0],192,146);fit(parts[1],360,32,false);x.fillText(parts[1],192,188);}
  else{fit(nm,360,34,false);x.fillText(nm,192,164);}
  return new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c)});
};
TN.Buses.prototype.makeStop=function(st){
  const g=new THREE.Group();
  if(!this.poleGeo){this.poleGeo=new THREE.CylinderGeometry(0.06,0.06,3.1,8);this.poleGeo.translate(0,1.55,0);this.poleMat=new THREE.MeshLambertMaterial({color:0x9aa3ad});this.signGeo=new THREE.PlaneGeometry(1.2,0.7);}
  g.add(new THREE.Mesh(this.poleGeo,this.poleMat));
  /* the sign hangs beside the top of the pole like a flag, toward the street, readable from both directions along it
     (two faces, so the text is never mirrored) */
  const m=this.stopSign(st[1],st[4]),flag=new THREE.Group();
  const f1=new THREE.Mesh(this.signGeo,m);f1.position.set(0.66,0,0.01);flag.add(f1);
  const f2=new THREE.Mesh(this.signGeo,m);f2.position.set(0.66,0,-0.01);f2.rotation.y=Math.PI;flag.add(f2);
  flag.position.y=2.7;g.add(flag);g.userData.mat=m;
  const q=TN.toLocal(st[3],st[2]);
  let best=null;this.net.near(q[0],q[1],20,(w,k)=>{if(w.tun) return;const r=TN.seg(w,k,q[0],q[1]);if(!best||r.d<best.r.d) best={r:r,w:w,k:k};});
  let x=q[0],z=q[1],h=0;
  if(best){const r=best.r,hw=TN.width(best.w)/2+1.0;h=best.w.hs?best.w.hs[best.k]:(best.w.br?best.w.H:0);
    let nx=q[0]-r.qx,nz=q[1]-r.qz,nl=Math.hypot(nx,nz);
    if(nl<0.3){nx=r.tz;nz=-r.tx;nl=1;}   /* (exactly on the road line: put it on the right-hand side) */
    nx/=nl;nz/=nl;x=r.qx+nx*Math.max(hw,nl);z=r.qz+nz*Math.max(hw,nl);
    /* the flag's local +x points from the pole toward the street (−n); its face looks along the street */
    flag.rotation.y=Math.atan2(nz,-nx);}
  g.position.set(x,h,z);this.scene.three.scene.add(g);return g;
};
TN.Buses.prototype.clearStops=function(){if(!this.stops) return;for(const g of this.stops.values()){this.scene.three.scene.remove(g);try{g.userData.mat.map.dispose();g.userData.mat.dispose();}catch(e){}}this.stops.clear();};
TN.Buses.prototype.updateStops=function(dt,cx,cz){
  this.stops=this.stops||new Map();this.stopTileC=this.stopTileC||new Map();this.stopT=(this.stopT||0)-dt;
  if(this.stopT>0) return;this.stopT=2;
  const ll=TN.fromLocal(cx,cz),T=0.02,tx=Math.floor(ll[0]/T),ty=Math.floor(ll[1]/T),want=new Map();
  for(let i=-1;i<=1;i++) for(let j=-1;j<=1;j++){const key=(tx+i)+'_'+(ty+j),L=this.stopTileC.get(key);
    if(L===undefined){this.stopTileC.set(key,null);fetch(TN.TRANSIT+'stops/'+key+'.json').then(r=>r.ok?r.json():[]).then(a=>this.stopTileC.set(key,a||[])).catch(()=>this.stopTileC.set(key,[]));continue;}
    if(!L) continue;
    for(const st of L){const q=TN.toLocal(st[3],st[2]),d=Math.hypot(q[0]-cx,q[1]-cz);if(d<450) want.set(st[0],[d,st]);}}
  const keep=[...want.values()].sort((a,b)=>a[0]-b[0]).slice(0,40),ids=new Set(keep.map(k=>k[1][0]));
  for(const [id,g] of this.stops) if(!ids.has(id)){this.scene.three.scene.remove(g);try{g.userData.mat.map.dispose();g.userData.mat.dispose();}catch(e){}this.stops.delete(id);}
  for(const [d,st] of keep) if(!this.stops.has(st[0])) this.stops.set(st[0],this.makeStop(st));
};
