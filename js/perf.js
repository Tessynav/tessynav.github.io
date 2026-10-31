/* TessyNav performance v18: quality, shadows, culling, builders, snapping (forks, one-ways, bridges), Street view, Model 3 car */
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

/* ---------- Tessy: 2024 Model 3 in Stealth Grey ---------- */
const CAR_COLOR='#4b4e53';
let car3d=null,carTail=null,carBeam=null;
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
  for(const x of [-0.84,0.84])for(const z of [-1.44,1.44]){add(wg,tire,x,0.34,z);add(hg2,rim,x*1.01,0.34,z);}
  return g;
}
function updateCar3D(){
  if(!treeScene||!gPos) return;
  if(!car3d){
    car3d=makeCar3D();treeScene.add(car3d);
    try{car.getElement().style.display='none';}catch(e){}
  }
  const [x,z]=toLocal(gPos[0],gPos[1]);
  car3d.position.set(x,0,z);
  car3d.rotation.y=-gHd*R;
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

/* ---------- Road snapping: reads road data directly (bridges included), sticky, fork- and one-way-aware ---------- */
const SNAP_W={motorway:11,trunk:10,primary:10,secondary:9,tertiary:8,minor:7.5,service:5};
const SNAP_CLASSES=['motorway','trunk','primary','secondary','tertiary','minor','service'];
const SNAP_MAX=8,SNAP_ALIGN=0.8;
let snapOff=[0,0],snapHd=null,snapLast=0,roadLayerIds=null,snapOk=false,gpsAcc=null,snapCls='',snapBridge=false;
let stableHd=null,turnRate=0,lastHdV=null,lastHdT=0,curRoad=null,switchVotes=0,lastSnapOkT=0,slowMode=false;
function getRoadLayers(){
  if(roadLayerIds) return roadLayerIds;
  roadLayerIds=map.getStyle().layers.filter(l=>l.type==='line'&&l['source-layer']==='transportation'&&
    !/casing|rail|path|ferry|aerialway|pier|pedestrian|footway|lane-lines/i.test(l.id)).map(l=>l.id);
  return roadLayerIds;
}
function roadFeaturesNear(pos){
  let feats=[];
  try{
    if(map.getSource('openmaptiles')){
      feats=map.querySourceFeatures('openmaptiles',{sourceLayer:'transportation',
        filter:['in',['get','class'],['literal',SNAP_CLASSES]]});
    }
  }catch(e){feats=[];}
  if(!feats.length){
    try{
      const pt=map.project(pos);
      feats=map.queryRenderedFeatures([[pt.x-260,pt.y-260],[pt.x+260,pt.y+260]],{layers:getRoadLayers()});
    }catch(e){}
  }
  return feats;
}
function showGpsStatus(){
  if(gpsAcc===null) return;
  const mv=Math.round(Math.hypot(snapOff[0],snapOff[1]));
  status.textContent='GPS '+Math.round(gpsAcc)+' m · '+(snapOk?('on road · moved '+mv+' m'+(snapCls?' ('+snapCls+(snapBridge?', bridge':'')+')':'')):'finding road');
}
function snapRelease(){snapOff=[0,0];snapHd=null;snapOk=false;curRoad=null;switchVotes=0;snapBridge=false;}
function snapFail(){
  if(snapOk&&performance.now()-lastSnapOkT<1000){
    snapOff=[snapOff[0]*0.6,snapOff[1]*0.6];showGpsStatus();return;
  }
  snapRelease();showGpsStatus();
}
function onCurRoad(x,z){
  const r=curRoad,t=(x-r.qx)*r.tx+(z-r.qz)*r.tz;
  const px=r.qx+r.tx*t,pz=r.qz+r.tz*t;
  return [px-r.tz*r.lane,pz+r.tx*r.lane,px,pz];
}
function updateSnap(pos,spd,hd){
  snapLast=performance.now();
  const [x,z]=toLocal(pos[0],pos[1]);
  slowMode=slowMode?spd<1.8:spd<0.8;
  if(slowMode){
    if(snapOk&&curRoad){
      const s=onCurRoad(x,z),ox=s[0]-x,oz=s[1]-z;
      if(Math.hypot(ox,oz)<=SNAP_MAX){snapOff=[ox,oz];showGpsStatus();return;}
    }
    snapRelease();showGpsStatus();return;
  }
  if(hd===null){snapFail();return;}
  const feats=roadFeaturesNear(pos);
  const fx=Math.sin(hd*R),fz=-Math.cos(hd*R);
  const lng=pos[0],lat=pos[1],pad=0.00025;
  let best=null,cont=null;
  for(const f of feats){
    const pr=f.properties||{},W=SNAP_W[pr.class];
    if(!W) continue;
    const oneway=+pr.oneway||0;
    const g=f.geometry;
    const lines=g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[];
    for(const ln of lines){
      for(let i=0;i<ln.length-1;i++){
        const p0=ln[i],p1=ln[i+1];
        if(lng<Math.min(p0[0],p1[0])-pad||lng>Math.max(p0[0],p1[0])+pad||lat<Math.min(p0[1],p1[1])-pad||lat>Math.max(p0[1],p1[1])+pad) continue;
        const a=toLocal(p0[0],p0[1]),b=toLocal(p1[0],p1[1]);
        const dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz;
        if(l2<0.01) continue;
        const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/l2));
        const qx=a[0]+dx*t,qz=a[1]+dz*t,d=Math.hypot(qx-x,qz-z);
        if(d>12) continue;
        const l=Math.sqrt(l2);
        let tx=dx/l,tz=dz/l;
        const align=tx*fx+tz*fz;
        if(Math.abs(align)<SNAP_ALIGN) continue;
        if((oneway===1&&align<0)||(oneway===-1&&align>0)) continue;
        if(align<0){tx=-tx;tz=-tz;}
        const c={d:d,qx:qx,qz:qz,tx:tx,tz:tz,W:W,oneway:oneway,lane:oneway?0:W/4,cls:pr.class,bridge:pr.brunnel==='bridge'};
        if(!best||d<best.d) best=c;
        if(curRoad){
          const ang=curRoad.tx*tx+curRoad.tz*tz;
          const off=Math.abs((qx-curRoad.qx)*curRoad.tz-(qz-curRoad.qz)*curRoad.tx);
          if(ang>0.9&&off<3&&(!cont||d<cont.d)) cont=c;
        }
      }
    }
  }
  let pick=null;
  if(cont&&best&&best!==cont){
    if(cont.d>5&&best.d<cont.d-2){pick=best;switchVotes=0;}
    else if(best.d<cont.d-3){switchVotes++;pick=switchVotes>=2?best:cont;if(switchVotes>=2) switchVotes=0;}
    else{pick=cont;switchVotes=0;}
  }else if(cont){pick=cont;switchVotes=0;}
  else pick=best;
  if(!pick){snapFail();return;}
  const sx=pick.qx-pick.tz*pick.lane,sz=pick.qz+pick.tx*pick.lane;
  const ox=sx-x,oz=sz-z;
  if(Math.hypot(ox,oz)>SNAP_MAX){snapFail();return;}
  curRoad=pick;snapOff=[ox,oz];
  snapHd=(Math.atan2(pick.tx,-pick.tz)/R+360)%360;
  snapCls=pick.cls||'';snapBridge=!!pick.bridge;
  snapOk=true;lastSnapOkT=performance.now();showGpsStatus();
}

/* ---------- Camera: Street or Map view, speed-based, plus your pinch adjustment ---------- */
let userZoomDelta=+(cacheGet('zoomDelta3_'+viewMode)||0),lastUserZoom=0,lastDrag=0,lastTouch=0;
let gPos=null,gHd=0,gT=null,gZoom=19,gPitch=60,gOff=[0,0];
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

/* ---------- Touch: one finger takes control instantly, two fingers just zoom ---------- */
const touchArea=map.getCanvasContainer();
touchArea.addEventListener('touchstart',e=>{
  lastTouch=performance.now();
  if(e.touches&&e.touches.length>=2){lastUserZoom=lastTouch;}
  else{follow=false;lastDrag=lastTouch;}
},{passive:true});
touchArea.addEventListener('mousedown',()=>{lastTouch=performance.now();follow=false;lastDrag=lastTouch;});
touchArea.addEventListener('wheel',()=>{lastUserZoom=performance.now();},{passive:true});

/* ---------- Smooth gliding, following curves ---------- */
const baseOnPos=onPos,baseView=view;
onPos=function(p){
  baseOnPos(p);
  gpsAcc=p.coords.accuracy;
  const spd=p.coords.speed||0,now=performance.now();
  if(spd>2){
    if(lastHdV!==null){
      const d=((heading-lastHdV+540)%360)-180,dts=(now-lastHdT)/1000;
      if(dts>0.3&&dts<3) turnRate=turnRate*0.4+Math.max(-35,Math.min(35,d/dts))*0.6;
    }
    lastHdV=heading;lastHdT=now;stableHd=heading;
  }else{turnRate=0;}
  gT={pos:[p.coords.longitude,p.coords.latitude],hd:heading,spd:spd,t:now};
  showGpsStatus();
};
view=function(pos,ms){
  if(watchId!==null&&gT){follow=true;return;}
  baseView(pos,ms);
};
function glideFrame(){
  requestAnimationFrame(glideFrame);
  if(!gT||watchId===null) return;
  const now=performance.now(),dt=Math.min(1.0,(now-gT.t)/1000);
  const baseHd=stableHd!==null?stableHd:gT.hd;
  const rate=gT.spd>2?turnRate:0;
  const midHd=baseHd+rate*dt/2,predHd=(baseHd+rate*dt+360)%360;
  const m=gT.spd*dt*0.9,h=midHd*R;
  const pred=[gT.pos[0]+(m*Math.sin(h))/(111320*Math.cos(gT.pos[1]*R)),gT.pos[1]+(m*Math.cos(h))/111320];
  if(now-snapLast>200) updateSnap(pred,gT.spd,stableHd!==null?predHd:null);
  gOff[0]+=(snapOff[0]-gOff[0])*0.1;gOff[1]+=(snapOff[1]-gOff[1])*0.1;
  const [px,pz]=toLocal(pred[0],pred[1]);
  const target=fromLocal(px+gOff[0],pz+gOff[1]);
  if(!gPos) gPos=target.slice();
  gPos[0]+=(target[0]-gPos[0])*0.2;gPos[1]+=(target[1]-gPos[1])*0.2;
  let wantHd=gHd;
  if(gT.spd>1&&stableHd!==null){
    wantHd=predHd;
    if(snapHd!==null&&Math.abs(rate)<4){const df=Math.abs(((snapHd-predHd+540)%360)-180);if(df<20) wantHd=snapHd;}
  }
  const dh=((wantHd-gHd+540)%360)-180;gHd=(gHd+dh*0.12+360)%360;
  car.setLngLat(gPos).setRotation(gHd);
  updateCar3D();
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

/* ---------- Follow resumes automatically after a touch, once driving ---------- */
setInterval(()=>{
  if(follow||watchId===null||!gT) return;
  if(performance.now()-lastDrag>10000&&gT.spd>2){follow=true;btn.textContent='Recenter';}
},2000);

map.on('load',()=>{
  fixRoadWidths();
  applyQuality();
  setTimeout(applyQuality,4000);
});
