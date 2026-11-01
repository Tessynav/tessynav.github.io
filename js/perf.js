/* TessyNav performance v22: motion system (no matching past road ends, free-flowing turns, tuned filter) + decision log */
let quality=cacheGet('quality')||'standard';
const qBtn=document.createElement('button');
qBtn.className='hud';
qBtn.style.cssText='top:202px;left:12px;font-size:13px;border:0;cursor:pointer';
document.body.appendChild(qBtn);
function showQuality(){qBtn.textContent='Quality: '+quality.charAt(0).toUpperCase()+quality.slice(1);}
showQuality();

let viewMode=cacheGet('viewMode')||'street';
const vBtn=document.createElement('button');
vBtn.className='hud';
vBtn.style.cssText='top:248px;left:12px;font-size:13px;border:0;cursor:pointer';
document.body.appendChild(vBtn);
function showView(){vBtn.textContent='View: '+(viewMode==='street'?'Street':'Map');}
showView();

/* ---------- Builders run at most once per interval (with one catch-up call) ---------- */
function rateLimit(name,ms){
  const orig=window[name];
  if(typeof orig!=='function') return;
  let lastT=0,timer=null,lastArgs=null;
  window[name]=function(){
    lastArgs=arguments;
    const now=performance.now(),wait=ms-(now-lastT);
    if(wait<=0){lastT=now;return orig.apply(null,lastArgs);}
    if(!timer) timer=setTimeout(()=>{timer=null;lastT=performance.now();orig.apply(null,lastArgs);},wait);
  };
}
rateLimit('updateBuildings',1500);
rateLimit('updateBridges',2500);
rateLimit('updateLights',1800);
rateLimit('updateSigns',1600);
rateLimit('updateTrees',1000);
rateLimit('parkTrees',3000);
rateLimit('loadAround',2000);
rateLimit('updateSkyObjects',150);

/* ---------- Roads keep their real width at very close zoom ---------- */
function rw22(z13,z20){
  const m=v=>['match',['get','class'],['motorway','trunk','primary'],v[0],['secondary','tertiary'],v[1],'minor',v[2],v[3]];
  return ['interpolate',['exponential',2],['zoom'],13,m(z13),20,m(z20),22,m(z20.map(v=>v*4))];
}
function fixRoadWidths(){
  for(const l of map.getStyle().layers){
    if(l.type!=='line'||l['source-layer']!=='transportation') continue;
    try{
      if(/rail|ferry|aerialway|pier/i.test(l.id)) continue;
      if(/path|pedestrian|footway/i.test(l.id)){
        map.setPaintProperty(l.id,'line-width',['interpolate',['exponential',2],['zoom'],15,1,20,18,22,72]);
      }else if(/casing/i.test(l.id)){
        map.setPaintProperty(l.id,'line-width',rw22([3,2.5,1.5,0.8],[136,104,82,44]));
      }else if(l.id!=='lane-lines'){
        map.setPaintProperty(l.id,'line-width',rw22([2,1.5,1,0.5],[120,90,70,35]));
      }
    }catch(e){}
  }
  try{if(map.getLayer('lane-lines')) map.setPaintProperty('lane-lines','line-width',['interpolate',['exponential',2],['zoom'],16,0.6,19,2,22,8]);}catch(e){}
}

/* ---------- Skip drawing what is off-screen ---------- */
let cullLast=0;
function enableCulling(scene){
  scene.traverse(o=>{
    if((o.isMesh||o.isPoints)&&o!==shadowPlane&&!o.userData.noCull&&!o.frustumCulled){
      if(o.geometry&&!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      o.frustumCulled=true;
    }
  });
}

/* ---------- Tessy: 2024 Model 3 in Stealth Grey, with steering front wheels ---------- */
const CAR_COLOR='#4b4e53',WHEELBASE=2.875,REAR_AXLE=1.44;
let car3d=null,carTail=null,carBeam=null,carFrontWheels=[];
function sideShape(pts,w){
  const s=new THREE.Shape();
  pts.forEach((p,i)=>i?s.lineTo(p[0],p[1]):s.moveTo(p[0],p[1]));
  const geo=new THREE.ExtrudeGeometry(s,{depth:w,bevelEnabled:true,bevelThickness:0.06,bevelSize:0.05,bevelSegments:2,curveSegments:6});
  geo.translate(0,0,-w/2);geo.rotateY(-Math.PI/2);geo.computeVertexNormals();
  return geo;
}
function makeCar3D(){
  const g=new THREE.Group();
  const paint=new THREE.MeshPhongMaterial({color:CAR_COLOR,shininess:70,specular:0x666666});
  const glass=new THREE.MeshPhongMaterial({color:0x0c0f12,shininess:100,specular:0x888888});
  const trim=new THREE.MeshLambertMaterial({color:0x101214});
  const tire=new THREE.MeshLambertMaterial({color:0x0d0d0d});
  const rim=new THREE.MeshPhongMaterial({color:0x2c2f33,shininess:40});
  const head=new THREE.MeshBasicMaterial({color:0xf4f8ff});
  carTail=new THREE.MeshBasicMaterial({color:0xb0141c});
  const add=(geo,mat,x,y,z,shadow)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=shadow!==false;m.userData.noCull=true;g.add(m);return m;};
  const bc=document.createElement('canvas');bc.width=bc.height=64;
  const bx=bc.getContext('2d'),bg=bx.createRadialGradient(32,32,4,32,32,32);
  bg.addColorStop(0,'rgba(0,0,0,0.75)');bg.addColorStop(0.6,'rgba(0,0,0,0.4)');bg.addColorStop(1,'rgba(0,0,0,0)');
  bx.fillStyle=bg;bx.fillRect(0,0,64,64);
  const blob=new THREE.Mesh(new THREE.PlaneGeometry(2.7,5.6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(bc),transparent:true,depthWrite:false}));
  blob.rotation.x=-Math.PI/2;blob.position.y=0.04;blob.userData.noCull=true;g.add(blob);
  const hc=document.createElement('canvas');hc.width=64;hc.height=128;
  const hx=hc.getContext('2d'),hg=hx.createLinearGradient(0,128,0,0);
  hg.addColorStop(0,'rgba(255,245,215,0.9)');hg.addColorStop(1,'rgba(255,245,215,0)');
  hx.fillStyle=hg;hx.beginPath();hx.moveTo(22,128);hx.lineTo(42,128);hx.lineTo(64,0);hx.lineTo(0,0);hx.closePath();hx.fill();
  carBeam=new THREE.Mesh(new THREE.PlaneGeometry(4.2,12),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(hc),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0}));
  carBeam.rotation.x=-Math.PI/2;carBeam.position.set(0,0.05,-8.3);carBeam.userData.noCull=true;g.add(carBeam);
  add(sideShape([[-2.3,0.32],[2.3,0.32],[2.34,0.55],[2.3,0.86],[1.9,0.98],[1.2,1.0],[-0.6,0.98],[-1.5,0.88],[-2.2,0.74],[-2.34,0.55]],1.75),paint,0,0,0);
  add(sideShape([[-0.75,0.96],[1.75,0.98],[1.15,1.36],[0.35,1.42],[-0.2,1.38]],1.42),glass,0,0,0);
  add(new THREE.BoxGeometry(1.8,0.12,4.4),trim,0,0.34,0);
  add(new THREE.BoxGeometry(0.2,0.1,0.22),paint,-0.99,0.98,-0.55);
  add(new THREE.BoxGeometry(0.2,0.1,0.22),paint,0.99,0.98,-0.55);
  for(const s of [-1,1]){
    const hl=add(new THREE.BoxGeometry(0.44,0.05,0.06),head,s*0.6,0.76,-2.33,false);hl.rotation.y=s*0.18;
    const tl=add(new THREE.BoxGeometry(0.42,0.08,0.05),carTail,s*0.58,0.88,2.33,false);tl.rotation.y=-s*0.12;
  }
  const wg=new THREE.CylinderGeometry(0.34,0.34,0.24,18);wg.rotateZ(Math.PI/2);
  const hg2=new THREE.CylinderGeometry(0.25,0.25,0.25,18);hg2.rotateZ(Math.PI/2);
  carFrontWheels=[];
  for(const x of [-0.84,0.84])for(const z of [-REAR_AXLE,REAR_AXLE]){
    const w=new THREE.Group();w.position.set(x,0.34,z);
    const t=new THREE.Mesh(wg,tire);t.castShadow=true;t.userData.noCull=true;w.add(t);
    const r=new THREE.Mesh(hg2,rim);r.position.x=x>0?0.01:-0.01;r.userData.noCull=true;w.add(r);
    g.add(w);
    if(z<0) carFrontWheels.push(w);
  }
  return g;
}
function updateCar3D(cx,cz,hd,steer){
  if(!treeScene) return;
  if(!car3d){
    car3d=makeCar3D();treeScene.add(car3d);
    try{car.getElement().style.display='none';}catch(e){}
  }
  car3d.position.set(cx,0,cz);
  car3d.rotation.y=-hd*R;
  for(const w of carFrontWheels) w.rotation.y=-steer;
  const nt=typeof nightNow==='number'?nightNow:0;
  carBeam.material.opacity=0.45*nt;
  carTail.color.setHex(nt>0.3?0xff2a33:0xb0141c);
}

/* ---------- Shadows only update when needed ---------- */
let shCenter=null,shForce=true,shLastT=0;
const shDir=new THREE.Vector3();
treeLayer.render=function(gl,matrix){
  if(treesFailed) return;
  try{
    const c=map.getCenter(),[cx,cz]=toLocal(c.lng,c.lat);
    const useShadows=shadowsOn&&sunUp&&quality!=='low';
    const now=performance.now();
    if(now-cullLast>1000){cullLast=now;enableCulling(this.scene);}
    if(useShadows){
      const moved=!shCenter||Math.hypot(cx-shCenter[0],cz-shCenter[1])>60;
      const turned=shDir.distanceToSquared(sunDir)>1e-5;
      if(moved||turned||shForce||now-shLastT>3000){
        shCenter=[cx,cz];shDir.copy(sunDir);shForce=false;shLastT=now;
        sunLight.target.position.set(cx,0,cz);sunLight.target.updateMatrixWorld();
        sunLight.position.set(cx+sunDir.x*400,sunDir.y*400,cz+sunDir.z*400);
        shadowPlane.position.x=cx;shadowPlane.position.z=cz;
        this.renderer.shadowMap.needsUpdate=true;
      }
    }else{shCenter=null;}
    shadowPlane.visible=useShadows;
    this.renderer.shadowMap.autoUpdate=false;
    this.camera.projectionMatrix=new THREE.Matrix4().fromArray(matrix).multiply(this.model);
    this.renderer.resetState();
    this.renderer.setViewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight);
    this.renderer.render(this.scene,this.camera);
  }catch(e){treesFailed=true;treesEl.textContent='3D trees error: '+e.message;}
};

/* ---------- Fewer trees in Low quality ---------- */
const fullBuildMesh=buildMesh;
buildMesh=function(list){
  if(quality==='low') return fullBuildMesh(list.filter((t,i)=>i%2===0));
  return fullBuildMesh(list);
};

/* ---------- Apply a quality level ---------- */
function applyQuality(){
  const dpr=window.devicePixelRatio||1;
  const ratio=quality==='high'?Math.min(dpr,2):quality==='standard'?1:0.8;
  try{map.setPixelRatio(ratio);}catch(e){}
  if(sunLight){
    const size=quality==='high'?2048:1024;
    if(sunLight.shadow.mapSize.x!==size){
      if(sunLight.shadow.map){sunLight.shadow.map.dispose();sunLight.shadow.map=null;}
      sunLight.shadow.mapSize.set(size,size);
    }
  }
  if(typeof lMatPool!=='undefined'&&lMatPool) lMatPool.visible=quality!=='low';
  if(typeof lMatGlow!=='undefined'&&lMatGlow) lMatGlow.visible=quality!=='low';
  if(typeof lMatSigGlow!=='undefined'&&lMatSigGlow) lMatSigGlow.visible=quality!=='low';
  if(typeof buckets!=='undefined'){for(const ck of buckets.keys()) dirty.add(ck);updateTrees();}
  shForce=true;
  map.triggerRepaint();
}
qBtn.onclick=()=>{
  quality=quality==='high'?'standard':quality==='standard'?'low':'high';
  cacheSet('quality',quality);showQuality();applyQuality();
};

/* =====================================================================
   MOTION SYSTEM: Kalman filter, road matching, smooth curve, car physics
   ===================================================================== */
const DELAY=1050;
const SNAP_W={motorway:11,trunk:10,primary:10,secondary:9,tertiary:8,minor:7.5,service:5};
const SNAP_CLASSES=['motorway','trunk','primary','secondary','tertiary','minor','service'];
const SNAP_MAX=8,SNAP_ALIGN=0.8,TURN_RATE=18,KF_Q=9;
const MOTION_LOG=new URLSearchParams(location.search).has('replay');
let motionLog=[];
let snapOff=[0,0],snapOk=false,snapCls='',snapBridge=false,gpsAcc=null,roadLayerIds=null;
let curRoad=null,switchVotes=0,lostCount=0,lastHd=null,lastMatchInfo=null,prevFixHd=null,prevFixT=0,turning=false;
let kfX=null,kfZ=null,kfT=0;
let pts=[],corr=[0,0],lastOff=[0,0];
let gPos=null,gHd=0,gT=null,gZoom=19,gPitch=60,lastFrameT=0,steerNow=0,lastPathHd=null;

function kfPredict(a,dt,q){
  a.p+=a.v*dt;
  const P=a.P,dt2=dt*dt,dt3=dt2*dt,dt4=dt3*dt;
  const p00=P[0][0]+dt*(P[1][0]+P[0][1])+dt2*P[1][1],p01=P[0][1]+dt*P[1][1],p10=P[1][0]+dt*P[1][1],p11=P[1][1];
  a.P=[[p00+q*dt4/4,p01+q*dt3/2],[p10+q*dt3/2,p11+q*dt2]];
}
function kfUpdPos(a,z,r){
  const P=a.P,S=P[0][0]+r,k0=P[0][0]/S,k1=P[1][0]/S,y=z-a.p;
  a.p+=k0*y;a.v+=k1*y;
  a.P=[[(1-k0)*P[0][0],(1-k0)*P[0][1]],[P[1][0]-k1*P[0][0],P[1][1]-k1*P[0][1]]];
}
function kfUpdVel(a,z,r){
  const P=a.P,S=P[1][1]+r,k0=P[0][1]/S,k1=P[1][1]/S,y=z-a.v;
  a.p+=k0*y;a.v+=k1*y;
  a.P=[[P[0][0]-k0*P[1][0],P[0][1]-k0*P[1][1]],[(1-k1)*P[1][0],(1-k1)*P[1][1]]];
}

function getRoadLayers(){
  if(roadLayerIds) return roadLayerIds;
  roadLayerIds=map.getStyle().layers.filter(l=>l.type==='line'&&l['source-layer']==='transportation'&&
    !/casing|rail|path|ferry|aerialway|pier|pedestrian|footway|lane-lines/i.test(l.id)).map(l=>l.id);
  return roadLayerIds;
}
function renderedRoads(pos){
  try{
    const pt=map.project(pos);
    return map.queryRenderedFeatures([[pt.x-260,pt.y-260],[pt.x+260,pt.y+260]],{layers:getRoadLayers()});
  }catch(e){return [];}
}
function sourceRoads(){
  try{
    if(!map.getSource('openmaptiles')) return [];
    return map.querySourceFeatures('openmaptiles',{sourceLayer:'transportation',filter:['in',['get','class'],['literal',SNAP_CLASSES]]});
  }catch(e){return [];}
}
function findCandidates(feats,lng,lat,x,z,fx,fz){
  const pad=0.00025;
  let best=null,cont=null,n=0;
  for(const f of feats){
    const pr=f.properties||{},W=SNAP_W[pr.class];
    if(!W) continue;
    const oneway=+pr.oneway||0;
    const g=f.geometry;
    const lines=g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[];
    for(const ln of lines){
      const last=ln.length-2;
      for(let i=0;i<=last;i++){
        const p0=ln[i],p1=ln[i+1];
        if(lng<Math.min(p0[0],p1[0])-pad||lng>Math.max(p0[0],p1[0])+pad||lat<Math.min(p0[1],p1[1])-pad||lat>Math.max(p0[1],p1[1])+pad) continue;
        const a=toLocal(p0[0],p0[1]),b=toLocal(p1[0],p1[1]);
        const dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz;
        if(l2<0.01) continue;
        const l=Math.sqrt(l2);
        const traw=((x-a[0])*dx+(z-a[1])*dz)/l2;
        /* never match beyond the end of a road line: that froze the car and pulled it backwards */
        if(traw<0&&-traw*l>1.5) continue;
        if(traw>1&&(traw-1)*l>1.5) continue;
        const t=Math.max(0,Math.min(1,traw));
        const qx=a[0]+dx*t,qz=a[1]+dz*t,d=Math.hypot(qx-x,qz-z);
        if(d>12) continue;
        let tx=dx/l,tz=dz/l;
        const align=tx*fx+tz*fz;
        if(Math.abs(align)<SNAP_ALIGN) continue;
        if((oneway===1&&align<0)||(oneway===-1&&align>0)) continue;
        if(align<0){tx=-tx;tz=-tz;}
        n++;
        const c={d:d,qx:qx,qz:qz,tx:tx,tz:tz,lane:oneway?0:W/4,cls:pr.class,oneway:oneway,bridge:pr.brunnel==='bridge',seg:[p0,p1]};
        if(!best||d<best.d) best=c;
        if(curRoad){
          const ang=curRoad.tx*tx+curRoad.tz*tz;
          const off=Math.abs((qx-curRoad.qx)*curRoad.tz-(qz-curRoad.qz)*curRoad.tx);
          if(ang>0.9&&off<3&&(!cont||d<cont.d)) cont=c;
        }
      }
    }
  }
  return {best:best,cont:cont,n:n};
}
function onCurRoad(x,z){
  const r=curRoad,t=(x-r.qx)*r.tx+(z-r.qz)*r.tz;
  const px=r.qx+r.tx*t,pz=r.qz+r.tz*t;
  return [px-r.tz*r.lane,pz+r.tx*r.lane];
}
function segInfo(c){return c?{d:Math.round(c.d*10)/10,cls:c.cls,oneway:c.oneway,lane:c.lane,bridge:c.bridge,seg:c.seg}:null;}
function matchRoad(x,z,spd){
  const info={why:'',src:'',n:0,best:null,cont:null,pick:null};
  lastMatchInfo=info;
  if(spd<1.0){
    info.why='slow';
    if(curRoad){const s=onCurRoad(x,z);if(Math.hypot(s[0]-x,s[1]-z)<=SNAP_MAX){info.why='slow-onroad';return {x:s[0],z:s[1],tx:curRoad.tx,tz:curRoad.tz};}}
    return null;
  }
  if(lastHd===null){info.why='no-heading';return null;}
  if(turning){info.why='turning';curRoad=null;switchVotes=0;return null;}
  const fx=Math.sin(lastHd*R),fz=-Math.cos(lastHd*R),ll=fromLocal(x,z);
  let c=findCandidates(renderedRoads(ll),ll[0],ll[1],x,z,fx,fz);info.src='screen';
  if(!c.best){c=findCandidates(sourceRoads(),ll[0],ll[1],x,z,fx,fz);info.src='data';}
  const best=c.best,cont=c.cont;
  info.n=c.n;info.best=segInfo(best);info.cont=segInfo(cont);
  let pick=null;
  if(cont&&best&&best!==cont){
    if(cont.d>5&&best.d<cont.d-2){pick=best;switchVotes=0;info.why='switch-now';}
    else if(best.d<cont.d-3){switchVotes++;pick=switchVotes>=2?best:cont;info.why=switchVotes>=2?'switch-voted':'stay-voting';if(switchVotes>=2) switchVotes=0;}
    else{pick=cont;switchVotes=0;info.why='stay';}
  }else if(cont){pick=cont;switchVotes=0;info.why='stay';}
  else if(best){pick=best;info.why='new';}
  if(!pick){info.why='none';lostCount++;if(lostCount>=2) curRoad=null;return null;}
  info.pick=segInfo(pick);
  const sx=pick.qx-pick.tz*pick.lane,sz=pick.qz+pick.tx*pick.lane;
  if(Math.hypot(sx-x,sz-z)>SNAP_MAX){info.why='too-far';lostCount++;if(lostCount>=2) curRoad=null;return null;}
  lostCount=0;curRoad=pick;
  return {x:sx,z:sz,tx:pick.tx,tz:pick.tz};
}

function hermite(a,b,tr){
  const T=(b.t-a.t)/1000;
  const u=Math.max(0,Math.min(1,(tr-a.t)/(b.t-a.t))),u2=u*u,u3=u2*u;
  const h00=2*u3-3*u2+1,h10=u3-2*u2+u,h01=-2*u3+3*u2,h11=u3-u2;
  const d00=6*u2-6*u,d10=3*u2-4*u+1,d01=-6*u2+6*u,d11=3*u2-2*u;
  return {
    x:h00*a.x+h10*T*a.vx+h01*b.x+h11*T*b.vx,
    z:h00*a.z+h10*T*a.vz+h01*b.z+h11*T*b.vz,
    dx:(d00*a.x+d10*T*a.vx+d01*b.x+d11*T*b.vx)/T,
    dz:(d00*a.z+d10*T*a.vz+d01*b.z+d11*T*b.vz)/T
  };
}
function pathAt(tr){
  const n=pts.length;
  if(!n) return null;
  if(n===1||tr<=pts[0].t){const a=pts[0];return {x:a.x,z:a.z,dx:a.vx,dz:a.vz};}
  for(let i=0;i<n-1;i++){if(tr<pts[i+1].t) return hermite(pts[i],pts[i+1],tr);}
  const a=pts[n-1],ext=(tr-a.t)/1000;
  if(ext<=1){
    const b={t:a.t+1000,x:a.x+a.vx,z:a.z+a.vz,vx:a.vx,vz:a.vz};
    return hermite(a,b,tr);
  }
  const e=Math.min(ext,2);
  return {x:a.x+a.vx*e,z:a.z+a.vz*e,dx:a.vx,dz:a.vz};
}

function showGpsStatus(){
  if(gpsAcc===null) return;
  const mv=Math.round(Math.hypot(snapOff[0],snapOff[1]));
  status.textContent='GPS '+Math.round(gpsAcc)+' m · '+(snapOk?('on road · moved '+mv+' m'+(snapCls?' ('+snapCls+(snapBridge?', bridge':'')+')':'')):(turning?'turning':'finding road'));
}
const baseOnPos=onPos,baseView=view;
onPos=function(p){
  baseOnPos(p);
  const c=p.coords,now=performance.now();
  gpsAcc=c.accuracy;
  const [x,z]=toLocal(c.longitude,c.latitude);
  if(!kfX||now-kfT>5000){
    kfX={p:x,v:0,P:[[25,0],[0,25]]};kfZ={p:z,v:0,P:[[25,0],[0,25]]};pts=[];corr=[0,0];lastOff=[0,0];
  }else{
    const dt=Math.max(0.05,(now-kfT)/1000);
    kfPredict(kfX,dt,KF_Q);kfPredict(kfZ,dt,KF_Q);
  }
  kfT=now;
  const r=Math.pow(Math.max(2,(c.accuracy||5)*0.7),2);
  kfUpdPos(kfX,x,r);kfUpdPos(kfZ,z,r);
  const spd=c.speed;
  if(spd!=null&&!isNaN(spd)){
    if(spd<0.3){kfUpdVel(kfX,0,0.02);kfUpdVel(kfZ,0,0.02);}
    else if(c.heading!=null&&!isNaN(c.heading)){
      const h=c.heading*R;
      kfUpdVel(kfX,spd*Math.sin(h),0.36);kfUpdVel(kfZ,-spd*Math.cos(h),0.36);
    }
  }
  const fx=kfX.p,fz=kfZ.p,vx=kfX.v,vz=kfZ.v,fs=Math.hypot(vx,vz);
  if(fs>1.5){
    lastHd=(Math.atan2(vx,-vz)/R+360)%360;
    if(prevFixHd!==null){
      const dts=Math.max(0.3,(now-prevFixT)/1000),dh=Math.abs(((lastHd-prevFixHd+540)%360)-180);
      turning=dh/dts>TURN_RATE;
    }
    prevFixHd=lastHd;prevFixT=now;
  }else{turning=false;}
  const m=matchRoad(fx,fz,fs);
 let pvx=vx,pvz=vz;
  const want=m?[m.x-fx,m.z-fz]:[lastOff[0]*0.6,lastOff[1]*0.6];
  let ddx=want[0]-lastOff[0],ddz=want[1]-lastOff[1];
  const dm=Math.hypot(ddx,ddz);
  if(dm>2.5){ddx*=2.5/dm;ddz*=2.5/dm;}
  lastOff=[lastOff[0]+ddx,lastOff[1]+ddz];
  const px=fx+lastOff[0],pz=fz+lastOff[1];
  if(m){
    const along=vx*m.tx+vz*m.tz;pvx=m.tx*along;pvz=m.tz*along;
    snapOk=true;snapCls=curRoad?curRoad.cls:'';snapBridge=!!(curRoad&&curRoad.bridge);
  }else{snapOk=false;snapCls='';snapBridge=false;}
  snapOff=[px-fx,pz-fz];
  const tr=now-DELAY,before=pathAt(tr);
  pts.push({t:now,x:px,z:pz,vx:pvx,vz:pvz});
  if(pts.length>8) pts.shift();
  const after=pathAt(tr);
  if(before&&after){corr[0]+=before.x-after.x;corr[1]+=before.z-after.z;}
  if(MOTION_LOG){
    const fl=fromLocal(fx,fz),pl=fromLocal(px,pz);
    motionLog.push({t:Math.round(now),raw:[c.longitude,c.latitude],acc:c.accuracy,spd:spd,gpsHd:c.heading,
      filt:[Math.round(fl[0]*1e7)/1e7,Math.round(fl[1]*1e7)/1e7],fspd:Math.round(fs*100)/100,hd:lastHd===null?null:Math.round(lastHd),
      turning:turning,out:[Math.round(pl[0]*1e7)/1e7,Math.round(pl[1]*1e7)/1e7],snap:snapOk,info:lastMatchInfo});
    if(motionLog.length>20000) motionLog.shift();
  }
  gT={pos:[c.longitude,c.latitude],spd:spd||0,t:now};
  showGpsStatus();
};
view=function(pos,ms){
  if(watchId!==null&&gT){follow=true;return;}
  baseView(pos,ms);
};

/* ---------- Camera: Street or Map view, speed-based, plus your pinch adjustment ---------- */
let userZoomDelta=+(cacheGet('zoomDelta3_'+viewMode)||0),lastUserZoom=0,lastDrag=0,lastTouch=0;
function camSpec(){
  const kmh=gT?gT.spd*3.6:0;
  if(viewMode==='street'){
    return {zoom:Math.max(20.3,Math.min(21.6,21.6-kmh/55)),pitch:72,pad:0.48};
  }
  return {zoom:Math.max(18.4,Math.min(19.8,19.8-kmh/55))-(skyOn?0.4:0),pitch:skyOn?78:60,pad:0.32};
}
vBtn.onclick=()=>{
  viewMode=viewMode==='street'?'map':'street';
  cacheSet('viewMode',viewMode);showView();
  userZoomDelta=+(cacheGet('zoomDelta3_'+viewMode)||0);
  follow=true;btn.textContent='Recenter';
};
map.on('zoom',e=>{if(e.originalEvent) lastUserZoom=performance.now();});
map.on('zoomend',e=>{
  if(!e.originalEvent) return;
  lastUserZoom=performance.now();
  userZoomDelta=Math.max(-3,Math.min(1.5,map.getZoom()-camSpec().zoom));
  cacheSet('zoomDelta3_'+viewMode,userZoomDelta);
  gZoom=map.getZoom();
});
map.on('dragstart',()=>{lastDrag=performance.now();follow=false;});
map.on('rotatestart',e=>{if(e.originalEvent){follow=false;lastDrag=performance.now();}});
map.on('pitchstart',e=>{if(e.originalEvent){follow=false;lastDrag=performance.now();}});
const touchArea=map.getCanvasContainer();
touchArea.addEventListener('touchstart',e=>{
  lastTouch=performance.now();
  if(e.touches&&e.touches.length>=2){lastUserZoom=lastTouch;}
  else{follow=false;lastDrag=lastTouch;}
},{passive:true});
touchArea.addEventListener('mousedown',()=>{lastTouch=performance.now();follow=false;lastDrag=lastTouch;});
touchArea.addEventListener('wheel',()=>{lastUserZoom=performance.now();},{passive:true});

function glideFrame(){
  requestAnimationFrame(glideFrame);
  const now=performance.now(),fdt=Math.min(0.1,lastFrameT?(now-lastFrameT)/1000:0.016);
  lastFrameT=now;
  if(watchId===null||!pts.length) return;
  const p=pathAt(now-DELAY);
  if(!p) return;
  const k=Math.exp(-fdt/0.35);corr[0]*=k;corr[1]*=k;
  const rx=p.x+corr[0],rz=p.z+corr[1];
  const v=Math.hypot(p.dx,p.dz);
  let hd=lastPathHd!==null?lastPathHd:(lastHd!==null?lastHd:gHd);
  if(v>0.7) hd=(Math.atan2(p.dx,-p.dz)/R+360)%360;
  const dh=((hd-gHd+540)%360)-180;
  const newHd=(gHd+dh*Math.min(1,fdt*8)+360)%360;
  const turned=((newHd-gHd+540)%360)-180;
  gHd=newHd;lastPathHd=hd;
  let wantSteer=0;
  if(v>1){const curv=(turned*R)/(v*fdt);wantSteer=Math.max(-0.5,Math.min(0.5,Math.atan(WHEELBASE*curv)));}
  steerNow+=(wantSteer-steerNow)*Math.min(1,fdt*6);
  const fx=Math.sin(gHd*R),fz=-Math.cos(gHd*R);
  const cx=rx+fx*REAR_AXLE,cz=rz+fz*REAR_AXLE;
  gPos=fromLocal(cx,cz);
  car.setLngLat(gPos).setRotation(gHd);
  updateCar3D(cx,cz,gHd,steerNow);
  map.triggerRepaint();
  if(!follow||now-lastUserZoom<500||now-lastTouch<300) return;
  const cs=camSpec();
  gZoom+=(cs.zoom+userZoomDelta-gZoom)*0.04;
  gPitch+=(cs.pitch-gPitch)*0.06;
  const H=map.getContainer().clientHeight||800;
  map.jumpTo({center:gPos,bearing:gHd,zoom:gZoom,pitch:gPitch,
    padding:{top:Math.round(H*cs.pad),bottom:0,left:0,right:0}});
}
requestAnimationFrame(glideFrame);

setInterval(()=>{
  if(follow||watchId===null||!gT) return;
  if(performance.now()-lastDrag>10000&&gT.spd>2){follow=true;btn.textContent='Recenter';}
},2000);

map.on('load',()=>{
  fixRoadWidths();
  applyQuality();
  setTimeout(applyQuality,4000);
});
