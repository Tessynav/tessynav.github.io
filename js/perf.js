/* TessyNav performance v13: quality, shadows, culling, builders, road snapping, Street view, 3D car, real road widths */
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

/* ---------- 3D car model for Tessy ---------- */
let car3d=null;
function makeCar3D(){
  const g=new THREE.Group();
  const paint=new THREE.MeshLambertMaterial({color:0xf2f2f0});
  const dark=new THREE.MeshLambertMaterial({color:0x14181d});
  const glass=new THREE.MeshLambertMaterial({color:0x1d2630});
  const tire=new THREE.MeshLambertMaterial({color:0x111111});
  const tail=new THREE.MeshBasicMaterial({color:0xd8202a});
  const head=new THREE.MeshBasicMaterial({color:0xfff6dc});
  const add=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.userData.noCull=true;g.add(m);return m;};
  const blobC=document.createElement('canvas');blobC.width=blobC.height=64;
  const bx=blobC.getContext('2d'),bg=bx.createRadialGradient(32,32,4,32,32,32);
  bg.addColorStop(0,'rgba(0,0,0,0.75)');bg.addColorStop(0.6,'rgba(0,0,0,0.4)');bg.addColorStop(1,'rgba(0,0,0,0)');
  bx.fillStyle=bg;bx.fillRect(0,0,64,64);
  const blob=new THREE.Mesh(new THREE.PlaneGeometry(2.8,5.6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(blobC),transparent:true,depthWrite:false}));
  blob.rotation.x=-Math.PI/2;blob.position.y=0.04;blob.userData.noCull=true;g.add(blob);
  add(new THREE.BoxGeometry(1.86,0.55,4.7),paint,0,0.6,0);
  add(new THREE.BoxGeometry(1.8,0.2,4.5),dark,0,0.28,0);
  const cab=new THREE.BoxGeometry(1.66,0.55,2.5);
  const cp=cab.attributes.position;
  for(let i=0;i<cp.count;i++){if(cp.getY(i)>0){cp.setX(i,cp.getX(i)*0.86);cp.setZ(i,cp.getZ(i)*0.7+0.1);}}
  cab.computeVertexNormals();
  add(cab,glass,0,1.15,0.25);
  add(new THREE.BoxGeometry(1.5,0.08,0.05),tail,0,0.76,2.36);
  add(new THREE.BoxGeometry(0.5,0.07,0.05),head,-0.6,0.7,-2.36);
  add(new THREE.BoxGeometry(0.5,0.07,0.05),head,0.6,0.7,-2.36);
  const wg=new THREE.CylinderGeometry(0.34,0.34,0.26,16);wg.rotateZ(Math.PI/2);
  for(const x of [-0.88,0.88])for(const z of [-1.45,1.45]) add(wg,tire,x,0.34,z);
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

/* ---------- Road snapping: use the roads drawn under the car, and hold it when stopped ---------- */
const SNAP_W={motorway:11,trunk:10,primary:10,secondary:9,tertiary:8,minor:7.5,service:5};
let snapOff=[0,0],snapHd=null,snapLast=0,roadLayerIds=null,snapOk=false,gpsAcc=null,snapAbs=null,heldRaw=null,snapCls='';
function getRoadLayers(){
  if(roadLayerIds) return roadLayerIds;
  roadLayerIds=map.getStyle().layers.filter(l=>l.type==='line'&&l['source-layer']==='transportation'&&
    !/casing|rail|path|ferry|aerialway|pier|pedestrian|footway|bridge|tunnel|lane-lines/i.test(l.id)).map(l=>l.id);
  return roadLayerIds;
}
function showGpsStatus(){
  if(gpsAcc===null) return;
  const mv=Math.round(Math.hypot(snapOff[0],snapOff[1]));
  status.textContent='GPS '+Math.round(gpsAcc)+' m · '+(snapOk?('on road · moved '+mv+' m'+(snapCls?' ('+snapCls+')':'')):'finding road');
}
function updateSnap(pos,hd,spd){
  snapLast=performance.now();
  const [x,z]=toLocal(pos[0],pos[1]);
  if(spd<1.2){
    if(snapOk&&snapAbs){
      if(!heldRaw) heldRaw=[x,z];
      if(Math.hypot(x-heldRaw[0],z-heldRaw[1])<20){
        snapOff=[snapAbs[0]-x,snapAbs[1]-z];showGpsStatus();return;
      }
    }
    snapOff=[0,0];snapHd=null;snapOk=false;snapAbs=null;heldRaw=null;showGpsStatus();return;
  }
  heldRaw=null;
  let feats=[];
  try{
    const pt=map.project(pos);
    feats=map.queryRenderedFeatures([[pt.x-260,pt.y-260],[pt.x+260,pt.y+260]],{layers:getRoadLayers()});
  }catch(e){}
  const fx=Math.sin(hd*R),fz=-Math.cos(hd*R);
  const trustHd=spd>3;
  let best=null;
  for(const f of feats){
    const pr=f.properties||{},W=SNAP_W[pr.class];
    if(!W) continue;
    const g=f.geometry;
    const lines=g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[];
    for(const ln of lines){
      for(let i=0;i<ln.length-1;i++){
        const a=toLocal(ln[i][0],ln[i][1]),b=toLocal(ln[i+1][0],ln[i+1][1]);
        const dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz;
        if(l2<0.01) continue;
        const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/l2));
        const qx=a[0]+dx*t,qz=a[1]+dz*t,d=Math.hypot(qx-x,qz-z);
        if(d>18) continue;
        const l=Math.sqrt(l2),tx=dx/l,tz=dz/l,align=tx*fx+tz*fz;
        if(trustHd&&Math.abs(align)<0.5) continue;
        const score=d-(trustHd?Math.abs(align)*4:0);
        if(!best||score<best.score) best={score:score,qx:qx,qz:qz,tx:tx,tz:tz,align:align,W:W,oneway:+pr.oneway||0,cls:pr.class};
      }
    }
  }
  if(!best){snapOff=[0,0];snapHd=null;snapOk=false;snapAbs=null;showGpsStatus();return;}
  const dsg=best.align>=0?1:-1,tx=best.tx*dsg,tz=best.tz*dsg,rx=-tz,rz=tx;
  const lane=best.oneway?0:best.W/4;
  snapAbs=[best.qx+rx*lane,best.qz+rz*lane];
  snapOff=[snapAbs[0]-x,snapAbs[1]-z];
  snapHd=(Math.atan2(tx,-tz)/R+360)%360;
  snapCls=best.cls||'';
  snapOk=true;showGpsStatus();
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
touchArea.addEventListener('touchstar
