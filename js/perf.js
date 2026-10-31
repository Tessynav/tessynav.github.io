/* TessyNav performance v5: quality, shadows, culling, rate-limited builders, road snapping, speed zoom, pinch-friendly follow */
let quality=cacheGet('quality')||'standard';
const qBtn=document.createElement('button');
qBtn.className='hud';
qBtn.style.cssText='top:202px;left:12px;font-size:13px;border:0;cursor:pointer';
document.body.appendChild(qBtn);
function showQuality(){qBtn.textContent='Quality: '+quality.charAt(0).toUpperCase()+quality.slice(1);}
showQuality();

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

/* ---------- Skip drawing what is off-screen ---------- */
let cullLast=0;
function enableCulling(scene){
  scene.traverse(o=>{
    if((o.isMesh||o.isPoints)&&o!==shadowPlane&&!o.frustumCulled){
      if(o.geometry&&!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      o.frustumCulled=true;
    }
  });
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

/* ---------- Road snapping: keep the arrow on the road you are driving on ---------- */
function fromLocal(x,z){return [x/(111320*Math.cos(ORIGIN[1]*R))+ORIGIN[0],-z/111320+ORIGIN[1]];}
let snapOff=[0,0],snapHd=null,snapLast=0;
function updateSnap(pos,hd){
  snapLast=performance.now();
  if(typeof lCells==='undefined'||typeof localRoad!=='function'){snapOff=[0,0];snapHd=null;return;}
  const [x,z]=toLocal(pos[0],pos[1]);
  const fx=Math.sin(hd*R),fz=-Math.cos(hd*R);
  const gx=Math.floor(pos[0]/LC),gy=Math.floor(pos[1]/LC);
  let best=null;
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
    const cell=lCells.get((gx+dx)+','+(gy+dy));if(!cell) continue;
    for(const r0 of cell.values()){
      const r=localRoad(r0);if(!r) continue;
      const b=closestOn(r,x,z,14);if(!b) continue;
      const align=b.tx*fx+b.tz*fz;
      if(Math.abs(align)<0.7) continue;
      const score=b.d-Math.abs(align)*3;
      if(!best||score<best.score){best=b;best.score=score;best.road=r;best.align=align;}
    }
  }
  if(!best){snapOff=[0,0];snapHd=null;return;}
  const dsg=best.align>=0?1:-1,tx=best.tx*dsg,tz=best.tz*dsg,rx=-tz,rz=tx;
  const lane=best.road.oneway?0:best.road.W/4;
  const sx=best.px+rx*lane,sz=best.pz+rz*lane;
  snapOff=[sx-x,sz-z];
  snapHd=(Math.atan2(tx,-tz)/R+360)%360;
}

/* ---------- Zoom: speed-based, plus your own pinch adjustment (remembered) ---------- */
let userZoomDelta=+(cacheGet('zoomDelta')||0),lastUserZoom=0,lastDrag=0;
function baseZoom(){
  const kmh=gT?gT.spd*3.6:0;
  return Math.max(18.2,Math.min(19.5,19.5-kmh/55))-(skyOn?0.4:0);
}
map.on('zoom',e=>{if(e.originalEvent) lastUserZoom=performance.now();});
map.on('zoomend',e=>{
  if(!e.originalEvent) return;
  lastUserZoom=performance.now();
  userZoomDelta=Math.max(-3,Math.min(2,map.getZoom()-baseZoom()));
  cacheSet('zoomDelta',userZoomDelta);
  gZoom=map.getZoom();
});
map.on('dragstart',()=>{lastDrag=performance.now();});
map.on('rotatestart',e=>{if(e.originalEvent){follow=false;lastDrag=performance.now();}});
map.on('pitchstart',e=>{if(e.originalEvent){follow=false;lastDrag=performance.now();}});

/* ---------- Smooth gliding ---------- */
let gPos=null,gHd=0,gT=null,gZoom=19;
const baseOnPos=onPos,baseView=view;
onPos=function(p){
  baseOnPos(p);
  gT={pos:[p.coords.longitude,p.coords.latitude],hd:heading,spd:p.coords.speed||0,t:performance.now()};
};
view=function(pos,ms){
  if(watchId!==null&&gT){follow=true;return;}
  baseView(pos,ms);
};
function glideFrame(){
  requestAnimationFrame(glideFrame);
  if(!gT||watchId===null) return;
  const now=performance.now(),dt=Math.min(1.2,(now-gT.t)/1000);
  const h=gT.hd*R,m=gT.spd*dt;
  const pred=[gT.pos[0]+(m*Math.sin(h))/(111320*Math.cos(gT.pos[1]*R)),gT.pos[1]+(m*Math.cos(h))/111320];
  if(now-snapLast>200) updateSnap(pred,gT.hd);
  const [px,pz]=toLocal(pred[0],pred[1]);
  const target=fromLocal(px+snapOff[0],pz+snapOff[1]);
  if(!gPos) gPos=target.slice();
  gPos[0]+=(target[0]-gPos[0])*0.18;gPos[1]+=(target[1]-gPos[1])*0.18;
  const wantHd=(snapHd!==null&&gT.spd>1)?snapHd:gT.hd;
  const dh=((wantHd-gHd+540)%360)-180;gHd=(gHd+dh*0.12+360)%360;
  car.setLngLat(gPos).setRotation(gHd);
  if(now-lastUserZoom<500) return;
  const wantZoom=baseZoom()+userZoomDelta;
  gZoom+=(wantZoom-gZoom)*0.03;
  if(follow){
    map.jumpTo({center:gPos,bearing:gHd,zoom:gZoom,pitch:skyOn?78:60,
      padding:{top:skyOn?480:340,bottom:0,left:0,right:0}});
  }
}
requestAnimationFrame(glideFrame);

/* ---------- Follow resumes automatically after a touch, once driving ---------- */
setInterval(()=>{
  if(follow||watchId===null||!gT) return;
  if(performance.now()-lastDrag>10000&&gT.spd>2){follow=true;btn.textContent='Recenter';}
},2000);

map.on('load',()=>{
  applyQuality();
  setTimeout(applyQuality,4000);
});
