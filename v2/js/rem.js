/* TessyNav v2 — rem.js
   REM trains on the elevated guideway (drawn by roads.js): white two-car trains with a teal stripe that glide
   along the line, stop now and then like at a station, and continue; lit windows and headlights at night.
   Stations: found from the map's railway stations that sit right beside the REM line: platforms, a white canopy on
   columns, a stair tower, and a floating name label (always facing you, readable from about 1.5 km).
   Trains stop 10 seconds at each station. The trains themselves run on a made-up rhythm near you.
   Built to stay light: at most 3 trains, only within about 2 km. ?rem=0 switches the trains off.
   v12: trains far away aren't drawn and are placed less often; the work is measured in parts in recordings. */
var TN=globalThis.TN||{};globalThis.TN=TN;

TN.Rem=function(scene,net){
  this.scene=scene;this.net=net;this.trains=[];this.spawnT=0;
  this.on=!(typeof location!=='undefined'&&/[?&]rem=0/.test(location.search));
  this.geo=null;this.matBody=null;this.matWin=null;this.night=0;
  this.stations=new Map();this.stT=0;this.labels=null;
};
TN.Rem.prototype.build=function(){
  if(this.geo) return;
  /* one train = two 19 m cars, 3 m wide, 3.6 m tall; front at -z (heading 0 = north) */
  const body=TN.geo(),win=TN.geo();
  const W=1.5,Hh=3.6,white=TN.hex('#eef0f2'),stripe=TN.hex('#1fa596'),roof=TN.hex('#c9ccd0'),end=TN.hex('#dfe2e5');
  const boxQ=(G,z0,z1,y0,y1,x,col)=>{TN.quad(G,[x,y0,z0],[x,y0,z1],[x,y1,z1],[x,y1,z0],col);};
  for(const [z0,z1] of [[-19.5,-0.25],[0.25,19.5]]){
    for(const x of [W,-W]){boxQ(body,z0,z1,0.3,0.9,x,stripe);boxQ(body,z0,z1,0.9,Hh,x,white);
      boxQ(win,z0+0.8,z1-0.8,1.6,2.6,x*1.004,[1,1,1]);}
    TN.quad(body,[-W,Hh,z0],[W,Hh,z0],[W,Hh,z1],[-W,Hh,z1],roof);
    for(const z of [z0,z1]){TN.quad(body,[-W,0.3,z],[W,0.3,z],[W,Hh,z],[-W,Hh,z],end);}
  }
  /* windscreens and headlights at both ends */
  for(const z of [-19.52,19.52]){TN.quad(win,[-1.1,1.7,z],[1.1,1.7,z],[1.1,2.8,z],[-1.1,2.8,z],[1,1,1]);}
  const mk=G=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(G.p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(G.c,3));g.setIndex(G.i);return g;};
  this.geo={body:mk(body),win:mk(win)};
  this.matBody=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide});
  this.matWin=new THREE.MeshBasicMaterial({color:0x2c3a48,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  this.setNight(this.night);
};
TN.Rem.prototype.setNight=function(nt){
  this.night=nt;
  if(this.matWin) this.matWin.color.set(TN.mix('#2c3a48','#ffe2a6',Math.max(0,Math.min(1,(nt-0.45)/0.35))));
  if(this.matBody) this.matBody.color.set(TN.mix('#ffffff','#8e97aa',nt));
  if(this.stMat) this.stMat.color.set(TN.mix('#ffffff','#7d8494',nt));
};
TN.Rem.prototype.spawn=function(cx,cz){
  const net=this.net,c=[];
  for(const w of net.rem.values()){if(w.L<60) continue;const b=w.bb;if(cx<b[0]-900||cx>b[1]+900||cz<b[2]-900||cz>b[3]+900) continue;c.push(w);}
  if(!c.length) return;
  const w=c[Math.floor(Math.random()*c.length)];
  const g=new THREE.Group();
  g.add(new THREE.Mesh(this.geo.body,this.matBody));g.add(new THREE.Mesh(this.geo.win,this.matWin));
  g.children.forEach(m=>{m.frustumCulled=false;});
  this.scene.three.scene.add(g);
  this.trains.push({w:w,s:Math.random()*w.L,dir:Math.random()<0.5?1:-1,v:19,wait:0,next:900+Math.random()*900,g:g});
};
TN.Rem.prototype.free=function(t){this.scene.three.scene.remove(t.g);};
/* the piece that continues the line at an end point (the straightest one) */
TN.Rem.prototype.nextPiece=function(t){
  const w=t.w,end=t.dir>0?w.pts.length-1:0,links=this.net.remLinks().get(w.keys[end])||[];
  const a=w.pts[t.dir>0?end-1:1],b=w.pts[end];let ux=b[0]-a[0],uz=b[1]-a[1];const l=Math.hypot(ux,uz)||1;ux/=l;uz/=l;
  let best=null,bs=-2;
  for(const [v,j] of links){if(v===w) continue;const k=j===0?1:v.pts.length-2;
    let vx=v.pts[k][0]-v.pts[j][0],vz=v.pts[k][1]-v.pts[j][1];const vl=Math.hypot(vx,vz)||1;const d=(vx*ux+vz*uz)/vl;
    if(d>bs){bs=d;best={w:v,s:j===0?0:v.L,dir:j===0?1:-1};}}
  return bs>0.3?best:null;
};
/* ---------- stations ---------- */
TN.Rem.prototype.stationList=function(){
  if(this.stList) return this.stList;
  try{const c=JSON.parse(localStorage.getItem('tn2_remst')||'null');if(c&&Date.now()-c.t<7*86400000&&c.list&&c.list.length){this.stList=c.list;return this.stList;}}catch(e){}
  if(this.stLoading||Date.now()-(this.stTried||0)<120000) return null;
  this.stLoading=true;this.stTried=Date.now();
  const q='[out:json][timeout:20];(node["railway"="station"]["network"~"REM"](45.2,-74.3,45.9,-73.2);node["public_transport"="station"]["network"~"REM"](45.2,-74.3,45.9,-73.2););out;';
  fetch('https://overpass-api.de/api/interpreter?data='+encodeURIComponent(q)).then(r=>r.ok?r.json():null).then(j=>{
    this.stLoading=false;if(!j||!j.elements) return;const seen=new Set(),list=[];
    for(const e of j.elements){const name=(e.tags&&(e.tags['name:latin']||e.tags.name))||'';if(!name||e.lat==null) continue;
      const k=name+Math.round(e.lat*500)+Math.round(e.lon*500);if(seen.has(k)) continue;seen.add(k);
      /* the same shape the rest of this file reads (like a map feature) */
      list.push({properties:{class:'railway',name:name},geometry:{type:'Point',coordinates:[e.lon,e.lat]}});}
    if(list.length){this.stList=list;try{localStorage.setItem('tn2_remst',JSON.stringify({t:Date.now(),list:list}));}catch(e){}this.stT=0;}
  }).catch(()=>{this.stLoading=false;});
  return null;
};
TN.Rem.prototype.findStations=function(cx,cz){
  const map=this.scene.map,net=this.net;if(!map||typeof map.querySourceFeatures!=='function'||!net.rem) return;
  /* the REM stations come from a small list asked from OpenStreetMap once and kept for a week (no map scanning
     while driving, which was slow); until that list arrives, nothing is scanned */
  const fs=this.stationList();if(!fs) return;
  for(const f of fs){
    const pr=f.properties||{};if(pr.class!=='railway'||!f.geometry||f.geometry.type!=='Point') continue;
    const name=pr['name:latin']||pr.name||'';if(!name) continue;
    const g=f.geometry.coordinates,q=TN.toLocal(g[0],g[1]);if(Math.abs(q[0]-cx)>3000||Math.abs(q[1]-cz)>3000) continue;
    const key=name+'@'+Math.round(q[0]/150)+','+Math.round(q[1]/150);if(this.stations.has(key)) continue;
    /* only stations right beside the REM line */
    let best=null;
    for(const w of net.rem.values()){const b=w.bb;if(q[0]<b[0]-80||q[0]>b[1]+80||q[1]<b[2]-80||q[1]>b[3]+80) continue;
      for(let i=0;i<w.pts.length-1;i++){const a=w.pts[i],c=w.pts[i+1],dx=c[0]-a[0],dz=c[1]-a[1],L2=dx*dx+dz*dz||1;
        const t=Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dz)/L2)),px=a[0]+dx*t,pz=a[1]+dz*t,d=Math.hypot(q[0]-px,q[1]-pz);
        if(d<70&&(!best||d<best.d)) best={w:w,i:i,t:t,d:d,x:px,z:pz};}}
    if(!best) continue;
    /* skip if another station with this name is already close (the map can have several points per station) */
    let dup=false;for(const st of this.stations.values()) if(st.name===name&&Math.hypot(st.x-best.x,st.z-best.z)<250) dup=true;
    if(dup) continue;
    this.stations.set(key,this.buildStation(name,best));
  }
};
TN.Rem.prototype.buildStation=function(name,b){
  const net=this.net,w=b.w,a=w.pts[b.i],c=w.pts[b.i+1];let ux=c[0]-a[0],uz=c[1]-a[1];const ul=Math.hypot(ux,uz)||1;ux/=ul;uz/=ul;
  const nx=-uz,nz=ux,s0=w.cum[b.i]+b.t*(w.cum[b.i+1]-w.cum[b.i]),h=net.remHeights(w)[b.i]||0;
  /* the tracks at the station: their sideways spread decides side platforms or an island platform */
  let lo=0,hi=0;
  for(const v of net.rem.values()){const bb=v.bb;if(b.x<bb[0]-25||b.x>bb[1]+25||b.z<bb[2]-25||b.z>bb[3]+25) continue;
    for(let i=0;i<v.pts.length-1;i++){const p=v.pts[i],q=v.pts[i+1],mx=(p[0]+q[0])/2-b.x,mz=(p[1]+q[1])/2-b.z;
      if(Math.abs(mx*ux+mz*uz)>40) continue;const o=mx*nx+mz*nz;if(Math.abs(o)<20){lo=Math.min(lo,o);hi=Math.max(hi,o);}}}
  const G=TN.geo(),cx=b.x+nx*(lo+hi)/2,cz=b.z+nz*(lo+hi)/2,half=(hi-lo)/2,Lh=40,yp=h+1.0,yc=h+5.2;
  const P=(along,off,y)=>[cx+ux*along+nx*off,y,cz+uz*along+nz*off];
  const slab=(o0,o1,y0,y1,col)=>{TN.quad(G,P(-Lh,o0,y1),P(Lh,o0,y1),P(Lh,o1,y1),P(-Lh,o1,y1),col);
    TN.quad(G,P(-Lh,o0,y0),P(Lh,o0,y0),P(Lh,o0,y1),P(-Lh,o0,y1),col);TN.quad(G,P(-Lh,o1,y0),P(Lh,o1,y0),P(Lh,o1,y1),P(-Lh,o1,y1),col);};
  const plat=TN.hex('#e6e8ea'),edge=TN.hex('#f2c94c'),canopy=TN.hex('#f4f5f6'),col=TN.hex('#9aa3ab'),tower=TN.hex('#d8dbde');
  if(half>4.5){slab(-half+3.2,half-3.2,h,yp,plat);}           /* island platform between the tracks */
  else{slab(-half-6,-half-3,h,yp,plat);slab(half+3,half+6,h,yp,plat);}   /* side platforms */
  const outer=half>4.5?half+1:half+6.5;
  /* white canopy on columns over the platforms and tracks */
  slab(-outer-1,outer+1,yc,yc+0.35,canopy);
  for(let al=-Lh+4;al<=Lh-4;al+=10) for(const o of [-outer,outer]){const p=P(al,o,0);TN.box(G,p[0],p[2],ux,uz,0.3,0.3,yp,yc,col);}
  /* stair and elevator tower down to the street at one end */
  {const p=P(Lh+3,outer+2,0);TN.box(G,p[0],p[2],ux,uz,5,4,0,yc+1.5,tower);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(G.p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(G.c,3));g.setIndex(G.i);
  if(!this.stMat){this.stMat=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide});this.stMat.color.set(TN.mix('#ffffff','#7d8494',this.night));}
  const mesh=new THREE.Mesh(g,this.stMat);mesh.frustumCulled=false;this.scene.three.scene.add(mesh);
  return {name:name,x:cx,z:cz,y:yc,mesh:mesh,w:w,s:s0,ux:ux,uz:uz};
};
/* floating name labels: always facing you, readable from about 1.5 km */
TN.Rem.prototype.updateLabels=function(cx,cz){
  if(typeof document==='undefined') return;
  /* the station name labels are moved 30 times a second, not 60 (each move costs the page some work), and not at
     all when no station is within reach */
  this.lblF=(this.lblF||0)+1;if(this.lblF%2) return;
  /* (and only when the view has moved: parked or stopped at a light, the labels stay where they are) */
  {const cm=this.scene.three&&this.scene.three.camera;if(cm){const e=cm.matrixWorld.elements,key=Math.round(e[12]*2)+','+Math.round(e[13]*2)+','+Math.round(e[14]*2)+','+Math.round(e[8]*200)+','+Math.round(e[10]*200);
    if(key===this.lblCam&&this.lblF%30) return;this.lblCam=key;}}
  if(this.labels&&this.stations.size){let near=false;for(const st of this.stations.values()) if(Math.abs(st.x-cx)<1700&&Math.abs(st.z-cz)<1700){near=true;break;}
    if(!near){if(!this.lblHid){this.lblHid=true;for(const el of this.labels.values()) if(el._k!=='h'){el.style.display='none';el._k='h';}}return;}this.lblHid=false;}
  if(!this.labels){this.labels=new Map();
    const st=document.createElement('style');st.textContent='.tn-rem{position:absolute;left:0;top:0;z-index:3;pointer-events:none;will-change:transform;display:flex;align-items:center;gap:8px;padding:6px 14px 6px 6px;border-radius:999px;background:rgba(255,255,255,.95);color:#1c2430;font:600 18px sans-serif;white-space:nowrap;transform-origin:50% 100%}.tn-rem b{background:#1fa596;color:#fff;font:700 11px sans-serif;padding:4px 7px;border-radius:7px}.tn-rem.n{background:rgba(16,24,38,.92);color:#e8f1fa}';
    document.head.appendChild(st);}
  const M=this.scene.three&&this.scene.three.camera?this.scene.three.camera.projectionMatrix:null;if(!M) return;
  const cv=this.scene.map.getCanvas(),W=cv.clientWidth,H=cv.clientHeight,v=new THREE.Vector4();
  for(const [k,st] of this.stations){
    let el=this.labels.get(k);
    if(!el){el=document.createElement('div');el.className='tn-rem';el.innerHTML='<b>REM</b>'+st.name.replace(/[<>&]/g,'');document.body.appendChild(el);this.labels.set(k,el);}
    const d=Math.hypot(st.x-cx,st.z-cz);
    v.set(st.x,st.y+7,st.z,1).applyMatrix4(M);
    if(d>1500||v.w<=0){if(el._k!=='h'){el.style.display='none';el._k='h';}continue;}
    const x=(v.x/v.w*0.5+0.5)*W,y=(-v.y/v.w*0.5+0.5)*H;
    if(x<-100||x>W+100||y<-60||y>H+60){if(el._k!=='h'){el.style.display='none';el._k='h';}continue;}
    /* only touch the page when something visibly changed (every write costs time) */
    const sc=(0.75+0.3*Math.max(0,1-d/1500)).toFixed(2),key=Math.round(x)+','+Math.round(y)+','+sc;
    if(el._k===key) continue;
    if(el._k==='h'||el._k==null) el.style.display='flex';
    el._k=key;
    /* only moved and zoomed (done by the graphics card); transparency and the night look change rarely */
    el.style.transform='translate('+Math.round(x)+'px,'+Math.round(y)+'px) translate(-50%,-100%) scale('+sc+')';
    const op=Math.min(1,Math.round((1500-d)/200*4)/4);if(el._op!==op){el._op=op;el.style.opacity=String(op);}
    const nt=this.night>0.45;if(el._n!==nt){el._n=nt;el.classList.toggle('n',nt);}
  }
};
TN.Rem.prototype.update=function(dt,cx,cz){
  if(!this.on){if(this.labels) for(const el of this.labels.values()) el.style.display='none';return;}
  /* looking for stations scans all the map's points of interest (slow): only every 15 s, and only after moving
     at least 300 m or when new map data has arrived */
  this.stT-=dt;
  if(this.stT<=0&&this.scene.three&&this.net.rem&&this.net.rem.size){this.stT=15;
    const moved=this.stPos?Math.hypot(cx-this.stPos[0],cz-this.stPos[1]):1e9;
    if(moved>300||this.net.ver!==this.stVer){this.stPos=[cx,cz];this.stVer=this.net.ver;const t0=performance.now();try{this.findStations(cx,cz);}catch(e){}TN.prof&&TN.prof('rem:stations',performance.now()-t0);}}
  {const t0=performance.now();try{this.updateLabels(cx,cz);}catch(e){}TN.prof&&TN.prof('rem:labels',performance.now()-t0);}
  const net=this.net;
  if(!this.on||!this.scene.three||!net.rem||!net.rem.size){for(const t of this.trains) this.free(t);this.trains=[];return;}
  this.build();
  /* keep up to 3 trains around you */
  this.spawnT-=dt;
  if(this.trains.length<4&&this.spawnT<=0){this.spawnT=1.5;this.spawn(cx,cz);}
  for(let k=this.trains.length-1;k>=0;k--){
    const t=this.trains[k];
    if(!net.rem.has(t.w.id)){this.free(t);this.trains.splice(k,1);continue;}
    /* stop now and then (like at a station), otherwise run at about 70 km/h, slowing in and out of stops */
    /* the next station ahead on this piece (if any): the train stops there for 10 seconds */
    if(t.stW!==t.w||t.stD!==t.dir){t.stW=t.w;t.stD=t.dir;t.stAt=null;
      for(const st of this.stations.values()){const P=t.w.pts;
        for(let i=0;i<P.length-1;i++){const a=P[i],c=P[i+1],dx=c[0]-a[0],dz=c[1]-a[1],L2=dx*dx+dz*dz||1;
          const u=Math.max(0,Math.min(1,((st.x-a[0])*dx+(st.z-a[1])*dz)/L2)),d=Math.hypot(st.x-a[0]-dx*u,st.z-a[1]-dz*u);
          if(d<14){const ss=t.w.cum[i]+u*(t.w.cum[i+1]-t.w.cum[i]);if((ss-t.s)*t.dir>2&&(t.stAt==null||Math.abs(ss-t.s)<Math.abs(t.stAt-t.s))) t.stAt=ss;}}}
      if(t.stAt!=null) t.next=Math.abs(t.stAt-t.s);else if(this.stations.size) t.next=1e9;}
    if(t.wait>0){t.wait-=dt;t.v=0;}
    else{
      t.v=Math.min(19,t.v+dt*1.2);if(t.next<60) t.v=Math.max(3,Math.min(t.v,Math.sqrt(2*1.0*Math.max(1,t.next))));
      const ds=t.v*dt;t.s+=t.dir*ds;t.next-=ds;
      if(t.next<=0){t.wait=t.stAt!=null?10:20;t.stAt=null;t.stW=null;t.next=this.stations.size?1e9:1100+Math.random()*900;}
      if(t.s<0||t.s>t.w.L){
        const over=t.s<0?-t.s:t.s-t.w.L,n=this.nextPiece(t);
        if(n){t.w=n.w;t.dir=n.dir;t.s=n.dir>0?over:n.w.L-over;t.stW=null;if(this.stations.size&&t.next>5000) t.next=1e9;}
        else{t.s=Math.max(0,Math.min(t.w.L,t.s));t.dir=-t.dir;t.wait=15;t.next=1100+Math.random()*900;}
      }
    }
    /* a train more than 1.3 km away isn't drawn and is placed only a few times a second (it keeps moving along) */
    const far=Math.abs(t.g.position.x-cx)>1300||Math.abs(t.g.position.z-cz)>1300;
    if(far){t.g.visible=false;t.fc=(t.fc||0)+1;if(t.fc%10) continue;}else if(!t.g.visible) t.g.visible=true;
    const th=performance.now(),hs=net.remHeights(t.w);TN.prof&&TN.prof('rem:heights',performance.now()-th);
    const q=TN.remAt(t.w,hs,Math.max(0,Math.min(t.w.L,t.s)));
    const dx=q.ux*t.dir,dz=q.uz*t.dir,rx=-dz,rz=dx;
    t.g.position.set(q.x,q.y+0.1,q.z);   /* on its own track */
    t.g.rotation.y=-Math.atan2(dx,-dz);
    if(Math.hypot(q.x-cx,q.z-cz)>2500){this.free(t);this.trains.splice(k,1);}
  }
};
