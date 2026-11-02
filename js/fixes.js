/* TessyNav fixes v6: hidden map roads under detailed roads, lamps off medians, highway exits (match by road edge),
   lighter road rebuilds, car on bridges, NO look-ahead (0.7 s smooth delay), replay panel at top, clean replay jumps */

/* ---------- Map's own roads disappear where our detailed roads are loaded ---------- */
function r3SetNarrow(narrow){
  if(r3Narrow===narrow) return;
  r3Narrow=narrow;
  for(const id of r3TileRoads){try{map.setPaintProperty(id,'line-width',narrow?roadPxN(roadMeters(0),0):roadPx(roadMeters(0)));}catch(e){}}
  for(const id of r3TileCasings){try{map.setPaintProperty(id,'line-width',narrow?roadPxN(roadMeters(0),0):roadPx(roadMeters(0.7)));}catch(e){}}
}

/* ---------- Detailed roads: rebuilt at most every 4 s, off above ~70 km/h ---------- */
let r3LastBuildT=0,r3Shown=true;
function r3Visible(on){
  if(r3Shown===on) return;
  r3Shown=on;
  for(const id of ['r3-curb','r3-road','r3-paint','r3-center','r3-lane','r3-arrow']){
    try{if(map.getLayer(id)) map.setLayoutProperty(id,'visibility',on?'visible':'none');}catch(e){}
  }
}
function r3Want(){
  if(!r3Ready) return;
  const now=performance.now();
  if(now-r3LastWant<1200) return;
  r3LastWant=now;
  const fast=typeof gT!=='undefined'&&gT&&gT.spd>19;
  if(map.getZoom()<15||fast){r3SetNarrow(false);r3Visible(false);return;}
  r3Visible(true);
  const c=map.getCenter(),tx=Math.floor(c.lng/R3T),ty=Math.floor(c.lat/R3T);
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
    const k=(tx+dx)+','+(ty+dy);
    if(r3Tiles.has(k)||r3Wanted.has(k)) continue;
    const cached=r3CacheGet(k);
    if(cached){r3Tiles.set(k,cached);r3Schedule();}
    else{r3Wanted.add(k);r3Queue.push([tx+dx,ty+dy]);}
  }
  for(const k of [...r3Tiles.keys()]){
    const [x,y]=k.split(',').map(Number);
    if(Math.abs(x-tx)>2||Math.abs(y-ty)>2) r3Tiles.delete(k);
  }
  r3Pump();
  r3SetNarrow(r3Tiles.has(tx+','+ty));
  if(tx+','+ty!==r3LastCenter&&now-r3LastBuildT>4000){r3LastCenter=tx+','+ty;r3LastBuildT=now;r3Schedule();}
}

/* ---------- Road matching by distance to the road's EDGE (highway exits) ---------- */
function findCandidates(feats,lng,lat,x,z,fx,fz){
  const pad=0.00025;
  let best=null,cont=null,n=0;
  for(const f of feats){
    const pr=f.properties||{};
    if(!SNAP_W[pr.class]) continue;
    const oneway=+pr.oneway||0,ramp=+pr.ramp===1;
    const fullW=roadWidthM(pr.class,oneway,ramp),hw=fullW/2;
    const g=f.geometry;
    const lines=g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[];
    for(const ln of lines){
      for(let i=0;i<ln.length-1;i++){
        const p0=ln[i],p1=ln[i+1];
        if(lng<Math.min(p0[0],p1[0])-pad||lng>Math.max(p0[0],p1[0])+pad||lat<Math.min(p0[1],p1[1])-pad||lat>Math.max(p0[1],p1[1])+pad) continue;
        const a=toLocal(p0[0],p0[1]),b=toLocal(p1[0],p1[1]);
        const dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz;
        if(l2<0.01) continue;
        const l=Math.sqrt(l2);
        const traw=((x-a[0])*dx+(z-a[1])*dz)/l2;
        if(traw<0&&-traw*l>1.5) continue;
        if(traw>1&&(traw-1)*l>1.5) continue;
        const t=Math.max(0,Math.min(1,traw));
        const qx=a[0]+dx*t,qz=a[1]+dz*t,d=Math.hypot(qx-x,qz-z);
        if(d>14) continue;
        let tx=dx/l,tz=dz/l;
        const align=tx*fx+tz*fz;
        if(Math.abs(align)<SNAP_ALIGN) continue;
        if((oneway===1&&align<0)||(oneway===-1&&align>0)) continue;
        if(align<0){tx=-tx;tz=-tz;}
        n++;
        const de=Math.max(0,d-(hw-1));
        const c={d:d,de:de,qx:qx,qz:qz,tx:tx,tz:tz,lane:oneway?0:fullW/4,cls:pr.class,oneway:oneway,bridge:pr.brunnel==='bridge',seg:[p0,p1]};
        if(!best||de<best.de||(de===best.de&&d<best.d)) best=c;
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
function matchRoad(x,z,spd){
  const info={why:'',src:'',n:0,best:null,cont:null,pick:null};
  lastMatchInfo=info;
  if(spd<1.0){
    info.why='slow';
    if(curRoad){const s=onCurRoad(x,z);if(Math.hypot(s[0]-x,s[1]-z)<=SNAP_MAX+4){info.why='slow-onroad';return {x:s[0],z:s[1],tx:curRoad.tx,tz:curRoad.tz};}}
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
    if(cont.de>1.5&&best.de<cont.de-2){
      if(cont.de>4){pick=best;switchVotes=0;info.why='switch-now';}
      else{switchVotes++;pick=switchVotes>=2?best:cont;info.why=switchVotes>=2?'switch-voted':'stay-voting';if(switchVotes>=2) switchVotes=0;}
    }else{pick=cont;switchVotes=0;info.why='stay';}
  }else if(cont){pick=cont;switchVotes=0;info.why='stay';}
  else if(best){pick=best;info.why='new';}
  if(!pick){info.why='none';lostCount++;if(lostCount>=2) curRoad=null;return null;}
  info.pick=segInfo(pick);
  const sx=pick.qx-pick.tz*pick.lane,sz=pick.qz+pick.tx*pick.lane;
  if(Math.hypot(sx-x,sz-z)>SNAP_MAX+4){info.why='too-far';lostCount++;if(lostCount>=2) curRoad=null;return null;}
  lostCount=0;curRoad=pick;
  return {x:sx,z:sz,tx:pick.tx,tz:pick.tz};
}

/* ---------- The car follows the surface under it: ground, ramps, bridge decks ---------- */
let carY=0,carPitch=0,brLastT=0,brTarget=0,brLastXZ=null;
const brRay=new THREE.Raycaster(),brDown=new THREE.Vector3(0,-1,0),brOrigin=new THREE.Vector3();
function bridgeSurfaces(x,z){
  const ys=[0];
  if(typeof brMeshes==='undefined'||!brMeshes.size) return ys;
  const objs=[];
  for(const v of brMeshes.values()){
    const o=v&&v.isObject3D?v:(v&&(v.group||v.mesh));
    if(o&&o.visible!==false) objs.push(o);
  }
  if(!objs.length) return ys;
  brOrigin.set(x,60,z);brRay.set(brOrigin,brDown);brRay.far=80;
  for(const h of brRay.intersectObjects(objs,true)){
    if(h.face&&h.face.normal.y<0.3) continue;
    ys.push(h.point.y);
  }
  return ys;
}
function updateCar3D(cx,cz,hd,steer){
  if(!treeScene) return;
  if(!car3d){
    car3d=makeCar3D();car3d.rotation.order='YXZ';treeScene.add(car3d);
    try{car.getElement().style.display='none';}catch(e){}
  }
  const now=performance.now();
  if(now-brLastT>100){
    brLastT=now;
    let best=null;
    for(const y of bridgeSurfaces(cx,cz)){
      if(y>carY-1.6&&y<carY+1.0&&(best===null||y>best)) best=y;
    }
    brTarget=best!==null?best:Math.max(0,carY-0.5);
    if(brLastXZ){
      const ds=Math.hypot(cx-brLastXZ[0],cz-brLastXZ[1]);
      if(ds>0.3){carPitch+=(Math.atan2(brTarget-carY,ds)-carPitch)*0.3;brLastXZ=[cx,cz];}
    }else brLastXZ=[cx,cz];
  }
  carY+=(brTarget-carY)*0.15;
  if(Math.abs(brTarget-carY)<0.05) carPitch*=0.9;
  car3d.position.set(cx,carY,cz);
  car3d.rotation.y=-hd*R;
  car3d.rotation.x=Math.max(-0.25,Math.min(0.25,carPitch));
  for(const w of carFrontWheels) w.rotation.y=-steer;
  const nt=typeof nightNow==='number'?nightNow:0;
  carBeam.material.opacity=0.45*nt;
  carTail.color.setHex(nt>0.3?0xff2a33:0xb0141c);
}

/* ---------- Drawing: the smooth path, 0.7 s behind, no prediction ---------- */
const DRAW_DELAY=700;
function glideFrame(){
  requestAnimationFrame(glideFrame);
  const now=performance.now(),fdt=Math.min(0.1,lastFrameT?(now-lastFrameT)/1000:0.016);
  lastFrameT=now;
  if(watchId===null||!pts.length) return;
  const p=pathAt(now-DRAW_DELAY);
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

/* ---------- Street lamps and traffic lights, lamps kept off medians ---------- */
function buildLightCell(ck){
  const [gx,gy]=ck.split(',').map(Number);
  const cell=lCells.get(ck)||new Map();
  const poles=lightAcc(true),heads=lightAcc(false),pools=lightAcc(false),lenses=lightAcc(true);
  const glow=[],sigGlow=[],sigGlowCol=[];
  const occ=new Set();
  const near=[];
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
    const c2=lCells.get((gx+dx)+','+(gy+dy));
    if(c2) for(const r0 of c2.values()){const r=localRoad(r0);if(r) near.push(r);}
  }
  for(const r0 of cell.values()){
    const r=localRoad(r0); if(!r) continue;
    const [spacing,W,both,ph]=r.spec,pts2=r.pts,cum=r.cum,n=pts2.length;
    let outer=0;
    if(r.oneway&&n>1){
      const mi=Math.floor((n-1)/2),a=pts2[mi],b=pts2[Math.min(n-1,mi+1)];
      const dl=Math.hypot(b[0]-a[0],b[1]-a[1])||1,tx=(b[0]-a[0])/dl,tz=(b[1]-a[1])/dl;
      for(const o of near){
        if(o.pts===r.pts) continue;
        const q=closestOn(o,a[0],a[1],35);
        if(!q||q.d<4) continue;
        if(Math.abs(q.tx*tx+q.tz*tz)<0.9) continue;
        const side=tx*(q.pz-a[1])-tz*(q.px-a[0]);
        outer=side>0?-1:1;
        break;
      }
    }
    let k=0;
    for(let s=spacing/2;s<r.L;s+=spacing,k++){
      let i=0;while(i<n-2&&cum[i+1]<s) i++;
      const seg=cum[i+1]-cum[i]||1,t=(s-cum[i])/seg;
      const x=pts2[i][0]+(pts2[i+1][0]-pts2[i][0])*t,z=pts2[i][1]+(pts2[i+1][1]-pts2[i][1])*t;
      const tx=(pts2[i+1][0]-pts2[i][0])/seg,tz=(pts2[i+1][1]-pts2[i][1])/seg;
      const nx=-tz,nz=tx;
      const sides=outer?[outer]:(both?[1,-1]:[k%2?1:-1]);
      for(const sd of sides){
        const off=W/2+1.2,px=x+nx*off*sd,pz=z+nz*off*sd;
        const ok=Math.round(px/8)+','+Math.round(pz/8);
        if(occ.has(ok)) continue; occ.add(ok);
        poles.box(px,pz,tx,tz,0.22,0.22,0,ph,LCOL.pole);
        const ax=-nx*sd,az=-nz*sd;
        poles.box(px+ax*1.0,pz+az*1.0,ax,az,2.0,0.12,ph-0.12,ph,LCOL.pole);
        const hx=px+ax*1.9,hz=pz+az*1.9;
        heads.box(hx,hz,ax,az,0.7,0.3,ph-0.35,ph-0.1);
        glow.push(hx,ph-0.4,hz);
        const cxp=px+ax*3.2,czp=pz+az*3.2,r1=9;
        pools.quad([[cxp-r1,0.25,czp-r1],[cxp+r1,0.25,czp-r1],[cxp+r1,0.25,czp+r1],[cxp-r1,0.25,czp+r1]],[0,1,0],null,[[0,0],[1,0],[1,1],[0,1]]);
      }
    }
  }
  const sigs=sigCells.get(ck)||[];
  for(const sg of sigs){
    const [sx,sz]=toLocal(sg[0],sg[1]);
    const sigOcc=new Set();
    for(const r of near){
      const best=closestOn(r,sx,sz,28);
      if(!best) continue;
      for(const dsg of travelDirs(r,best,near)){
        if(dsg===1&&best.s<9) continue;
        if(dsg===-1&&best.s>r.L-9) continue;
        const fx=best.tx*dsg,fz=best.tz*dsg;
        const rx=-fz,rz=fx;
        const stx=best.px-fx*9,stz=best.pz-fz*9,o=r.W/2+1.5;
        const px=stx+rx*o,pz=stz+rz*o;
        const ok=Math.round(px/5)+','+Math.round(pz/5);
        if(sigOcc.has(ok)) continue; sigOcc.add(ok);
        poles.box(px,pz,fx,fz,0.28,0.28,0,6.2,LCOL.pole);
        const ax=-rx,az=-rz,reach=Math.min(r.W*0.75,7);
        poles.box(px+ax*reach/2,pz+az*reach/2,ax,az,reach,0.16,6.0,6.2,LCOL.pole);
        const hx=px+ax*(reach-0.3),hz=pz+az*(reach-0.3);
        poles.box(hx,hz,fx,fz,0.42,0.5,4.75,6.0,LCOL.sigBox);
        const lx=hx-fx*0.24,lz=hz-fz*0.24;
        const lens=[[LCOL.red,5.62,5.92],[LCOL.amber,5.23,5.53],[LCOL.green,4.84,5.14]];
        for(const [colr,y0,y1] of lens){
          lenses.box(lx,lz,fx,fz,0.06,0.32,y0,y1,colr);
          sigGlow.push(lx-fx*0.1,(y0+y1)/2,lz-fz*0.1);
          sigGlowCol.push(colr.r,colr.g,colr.b);
        }
      }
    }
  }
  const group=new THREE.Group();
  const pg=lightGeom(poles);
  if(pg){const m=new THREE.Mesh(pg,lMatPole);m.castShadow=true;m.frustumCulled=false;group.add(m);}
  const hg=lightGeom(heads);
  if(hg){const m=new THREE.Mesh(hg,lMatHead);m.frustumCulled=false;group.add(m);}
  const lg=lightGeom(lenses);
  if(lg){const m=new THREE.Mesh(lg,lMatLens);m.frustumCulled=false;group.add(m);}
  const qg=lightGeom(pools);
  if(qg){const m=new THREE.Mesh(qg,lMatPool);m.frustumCulled=false;m.renderOrder=2;group.add(m);}
  if(glow.length){
    const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.Float32BufferAttribute(glow,3));
    const p=new THREE.Points(gg,lMatGlow);p.frustumCulled=false;group.add(p);
  }
  if(sigGlow.length){
    const sg=new THREE.BufferGeometry();
    sg.setAttribute('position',new THREE.Float32BufferAttribute(sigGlow,3));
    sg.setAttribute('color',new THREE.Float32BufferAttribute(sigGlowCol,3));
    const p=new THREE.Points(sg,lMatSigGlow);p.frustumCulled=false;group.add(p);
  }
  return group;
}

if(typeof lDirtyAll!=='undefined') lDirtyAll=true;
map.on('load',()=>{lDirtyAll=true;});

/* ---------- Replay panel at the top, tap the time text to collapse it ---------- */
setInterval(()=>{
  if(typeof rpUi==='undefined'||!rpUi||rpUi.dataset.moved) return;
  rpUi.dataset.moved='1';
  rpUi.style.bottom='';
  rpUi.style.top='64px';
  rpUi.style.padding='6px 12px';
  const row=rpUi.lastChild;
  if(rpTxt&&row){
    rpTxt.style.cursor='pointer';
    rpTxt.addEventListener('click',()=>{row.style.display=row.style.display==='none'?'flex':'none';});
  }
},500);

/* ---------- Replay jumps (±30 s): reset the motion memory so the car teleports cleanly ---------- */
if(typeof rpSeek==='function'){
  const baseRpSeek=rpSeek;
  rpSeek=function(t){
    kfX=null;kfZ=null;pts=[];corr=[0,0];lastOff=[0,0];
    curRoad=null;switchVotes=0;lostCount=0;preTurn=null;turning=false;prevFixHd=null;
    lastPathHd=null;steerNow=0;
    carY=0;brTarget=0;brLastXZ=null;carPitch=0;
    baseRpSeek(t);
  };
}

/* ===== fixes v7: built for Tessy's 10-per-second GPS, adaptive delay, lighter autosave, profiler ===== */

/* Road matching at most every 0.4 s; in between, slide along the current road. Turning measured over ~1 s */
let mrLastT=0,hdHist=[];
matchRoad=(function(full){return function(x,z,spd){
  const now=performance.now();
  if(lastHd!==null){
    hdHist.push([now,lastHd]);
    while(hdHist.length&&now-hdHist[0][0]>1200) hdHist.shift();
    if(hdHist.length>1&&now-hdHist[0][0]>600){
      const dh=Math.abs(((lastHd-hdHist[0][1]+540)%360)-180);
      turning=spd>1.5&&dh/((now-hdHist[0][0])/1000)>TURN_RATE;
    }
  }
  if(now-mrLastT<400&&curRoad&&!turning&&spd>=1){
    const s=onCurRoad(x,z);
    if(Math.hypot(s[0]-x,s[1]-z)<=SNAP_MAX+4){lastMatchInfo={why:'between'};return {x:s[0],z:s[1],tx:curRoad.tx,tz:curRoad.tz};}
  }
  mrLastT=now;
  return full(x,z,spd);
};})(matchRoad);

/* Drawing delay adapts to the GPS rate: ~0.25 s with Tessy's fast GPS, ~1 s with a phone */
let drawDelay=700;
glideFrame=function(){
  requestAnimationFrame(glideFrame);
  const now=performance.now(),fdt=Math.min(0.1,lastFrameT?(now-lastFrameT)/1000:0.016);
  lastFrameT=now;
  if(watchId===null||!pts.length) return;
  if(pts.length>3){
    const iv=[];
    for(let i=Math.max(1,pts.length-8);i<pts.length;i++) iv.push(pts[i].t-pts[i-1].t);
    iv.sort((a,b)=>a-b);
    const want=Math.max(250,Math.min(1050,iv[Math.floor(iv.length/2)]*2.2));
    drawDelay+=(want-drawDelay)*Math.min(1,fdt*0.5);
  }
  const p=pathAt(now-drawDelay);
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
};

/* Profiler: time spent in each part of TessyNav, saved into recordings */
const PROF={};
function profWrap(name){
  const f=window[name];
  if(typeof f!=='function') return;
  window[name]=function(){
    const t0=performance.now();
    try{return f.apply(this,arguments);}
    finally{PROF[name]=(PROF[name]||0)+performance.now()-t0;}
  };
}
['r3Rebuild','r3Want','buildLightCell','buildSignCell','buildMesh','updateBuildings','updateBridges','updateTrees',
 'updateLights','updateSigns','parkTrees','loadAround','matchRoad','onPos','checkAlerts','updateSkyObjects','applyQuality'].forEach(profWrap);

/* Recording: lighter autosave (every 60 s) and profiler numbers every second */
recTick=function(){
  if(!rec) return;
  recTicks++;
  if(gPos){
    const mv=Math.hypot(snapOff[0],snapOff[1]);
    rec.f.push([recT(),r1(gPos[1],7),r1(gPos[0],7),r1(gHd,1),snapOk?1:0,snapCls||'',r1(mv,1),follow?1:0,r1(map.getZoom(),2)]);
  }
  if(recTicks%2===0){
    rec.p.push([recT(),recFrames,Math.round(recMaxGap)]);recFrames=0;recMaxGap=0;
    const snap={};
    for(const k in PROF){if(PROF[k]>=1) snap[k]=Math.round(PROF[k]);PROF[k]=0;}
    if(!rec.x) rec.x=[];
    rec.x.push([recT(),snap]);
    recLabel();
  }
  if(recTicks%120===0){rec.dur=recT();try{localStorage.setItem('rec:current',JSON.stringify(rec));}catch(e){}}
};

/* ===== Realistic 2024 Model 3 (Highland) in Stealth Grey, sculpted from smooth cross-sections ===== */
const M3_PAINT='#5a5e64';
function m3Interp(keys,z){
  if(z<=keys[0][0]) return keys[0][1];
  for(let i=1;i<keys.length;i++){
    if(z<=keys[i][0]){const a=keys[i-1],b=keys[i],t=(z-a[0])/(b[0]-a[0]),s=t*t*(3-2*t);return a[1]+(b[1]-a[1])*s;}
  }
  return keys[keys.length-1][1];
}
function m3Loft(zs,ring,closed){
  const pos=[],idx=[];let M=0;
  zs.forEach(z=>{const r=ring(z);M=r.length;for(const p of r) pos.push(p[0],p[1],z);});
  const segs=closed?M:M-1;
  for(let i=0;i<zs.length-1;i++)for(let j=0;j<segs;j++){
    const a=i*M+j,b=i*M+(j+1)%M,c=(i+1)*M+(j+1)%M,d=(i+1)*M+j;
    idx.push(a,b,d,b,c,d);
  }
  const cap=(zi,front)=>{
    const r=ring(zs[zi]),base=pos.length/3;
    let cx=0,cy=0;for(const p of r){cx+=p[0];cy+=p[1];}cx/=r.length;cy/=r.length;
    pos.push(cx,cy,zs[zi]);
    for(const p of r) pos.push(p[0],p[1],zs[zi]);
    for(let j=0;j<segs;j++){
      const p1=base+1+j,p2=base+1+(j+1)%r.length;
      if(front) idx.push(base,p2,p1); else idx.push(base,p1,p2);
    }
  };
  cap(0,true);cap(zs.length-1,false);
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setIndex(idx);g.computeVertexNormals();
  return g;
}
const M3_TOP=[[-2.36,0.58],[-2.26,0.68],[-1.9,0.79],[-0.9,0.92],[1.5,0.99],[2.05,0.98],[2.3,0.87],[2.36,0.76]];
const M3_BOT=[[-2.36,0.34],[-2.15,0.20],[2.15,0.20],[2.36,0.36]];
const M3_HW=[[-2.36,0.6],[-2.2,0.82],[-1.7,0.91],[0,0.925],[1.7,0.91],[2.2,0.84],[2.36,0.7]];
const M3_ROOF=[[-0.95,0.92],[-0.25,1.38],[0.3,1.44],[0.9,1.40],[1.5,1.17],[1.95,0.99]];
function m3BodyRing(z){
  const w=m3Interp(M3_HW,z),y1=m3Interp(M3_TOP,z),y0=m3Interp(M3_BOT,z),cy=(y0+y1)/2,h=(y1-y0)/2,N=28,e=0.62,out=[];
  for(let k=0;k<N;k++){
    const t=k/N*Math.PI*2,c=Math.cos(t),s=Math.sin(t);
    let x=w*Math.sign(c)*Math.pow(Math.abs(c),e);
    const y=cy+h*Math.sign(s)*Math.pow(Math.abs(s),e);
    if(y>cy) x*=1-0.1*((y-cy)/h);
    out.push([x,y]);
  }
  return out;
}
function m3CabinRing(z){
  const belt=m3Interp(M3_TOP,z)-0.03,roof=Math.max(belt+0.002,m3Interp(M3_ROOF,z)),hgt=roof-belt;
  const wb=m3Interp(M3_HW,z)*0.86,wr=wb*0.72,N=16,out=[];
  for(let k=0;k<=N;k++){
    const t=k/N*Math.PI,c=Math.cos(t),s=Math.sin(t);
    out.push([Math.sign(c)*Math.pow(Math.abs(c),0.7)*(wb*(1-s)+wr*s),belt+hgt*Math.pow(s,0.6)]);
  }
  return out;
}
function makeCar3D(){
  const g=new THREE.Group();
  const paint=new THREE.MeshPhongMaterial({color:M3_PAINT,shininess:90,specular:0x9a9a9a,emissive:0x111316,side:THREE.DoubleSide});
  const glass=new THREE.MeshPhongMaterial({color:0x0b0d10,shininess:120,specular:0xb8b8b8,emissive:0x050608,side:THREE.DoubleSide});
  const trim=new THREE.MeshLambertMaterial({color:0x101214});
  const tire=new THREE.MeshLambertMaterial({color:0x0d0d0d});
  const rim=new THREE.MeshPhongMaterial({color:0x2e3135,shininess:50});
  const head=new THREE.MeshBasicMaterial({color:0xf4f8ff});
  carTail=new THREE.MeshBasicMaterial({color:0xb0141c});
  const add=(geo,mat,x,y,z,shadow)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=shadow!==false;m.userData.noCull=true;g.add(m);return m;};
  /* soft contact shadow */
  const bc=document.createElement('canvas');bc.width=bc.height=64;
  const bx=bc.getContext('2d'),bg=bx.createRadialGradient(32,32,4,32,32,32);
  bg.addColorStop(0,'rgba(0,0,0,0.75)');bg.addColorStop(0.6,'rgba(0,0,0,0.4)');bg.addColorStop(1,'rgba(0,0,0,0)');
  bx.fillStyle=bg;bx.fillRect(0,0,64,64);
  const blob=new THREE.Mesh(new THREE.PlaneGeometry(2.6,5.5),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(bc),transparent:true,depthWrite:false}));
  blob.rotation.x=-Math.PI/2;blob.position.y=0.04;blob.userData.noCull=true;g.add(blob);
  /* headlight beam on the road at night */
  const hc=document.createElement('canvas');hc.width=64;hc.height=128;
  const hx=hc.getContext('2d'),hg=hx.createLinearGradient(0,128,0,0);
  hg.addColorStop(0,'rgba(255,245,215,0.9)');hg.addColorStop(1,'rgba(255,245,215,0)');
  hx.fillStyle=hg;hx.beginPath();hx.moveTo(22,128);hx.lineTo(42,128);hx.lineTo(64,0);hx.lineTo(0,0);hx.closePath();hx.fill();
  carBeam=new THREE.Mesh(new THREE.PlaneGeometry(4.2,12),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(hc),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0}));
  carBeam.rotation.x=-Math.PI/2;carBeam.position.set(0,0.05,-8.3);carBeam.userData.noCull=true;g.add(carBeam);
  /* body and glass cabin */
  const zs=[];for(let i=0;i<=30;i++) zs.push(-2.36*Math.cos(Math.PI*i/30));
  add(m3Loft(zs,m3BodyRing,true),paint,0,0,0);
  const cz=[];for(let i=0;i<=18;i++) cz.push(-0.95+2.9*i/18);
  add(m3Loft(cz,m3CabinRing,false),glass,0,0,0);
  /* front: slim headlights wrapping the corners, black lower intake */
  for(const s of [-1,1]){
    const hl=add(new THREE.BoxGeometry(0.4,0.045,0.05),head,s*0.56,0.665,-2.24,false);hl.rotation.y=s*0.42;
  }
  add(new THREE.BoxGeometry(0.95,0.06,0.05),trim,0,0.36,-2.32,false);
  /* rear: C-shaped taillights and dark diffuser */
  for(const s of [-1,1]){
    add(new THREE.BoxGeometry(0.3,0.05,0.05),carTail,s*0.55,0.9,2.31,false);
    add(new THREE.BoxGeometry(0.05,0.13,0.05),carTail,s*0.72,0.845,2.29,false);
    add(new THREE.BoxGeometry(0.14,0.045,0.05),carTail,s*0.64,0.79,2.3,false);
  }
  add(new THREE.BoxGeometry(1.2,0.12,0.06),trim,0,0.32,2.33,false);
  /* side mirrors */
  const mg=new THREE.SphereGeometry(0.1,12,8);
  for(const s of [-1,1]){const m=add(mg,paint,s*0.98,0.99,-0.6);m.scale.set(1,0.6,1.5);}
  /* wheels in dark arches, front wheels steer */
  const wg=new THREE.CylinderGeometry(0.335,0.335,0.22,22);wg.rotateZ(Math.PI/2);
  const rg=new THREE.CylinderGeometry(0.24,0.24,0.23,22);rg.rotateZ(Math.PI/2);
  const archG=new THREE.CircleGeometry(0.42,24);
  carFrontWheels=[];
  for(const x of [-0.83,0.83])for(const z of [-REAR_AXLE,REAR_AXLE]){
    const arch=new THREE.Mesh(archG,trim);arch.position.set(x>0?0.925:-0.925,0.36,z);arch.rotation.y=x>0?Math.PI/2:-Math.PI/2;arch.userData.noCull=true;g.add(arch);
    const w=new THREE.Group();w.position.set(x,0.335,z);
    const t=new THREE.Mesh(wg,tire);t.castShadow=true;t.userData.noCull=true;w.add(t);
    const r=new THREE.Mesh(rg,rim);r.position.x=x>0?0.005:-0.005;r.userData.noCull=true;w.add(r);
    g.add(w);
    if(z<0) carFrontWheels.push(w);
  }
  return g;
}
if(typeof car3d!=='undefined'&&car3d&&treeScene){treeScene.remove(car3d);car3d=null;}

/* ===== 2024 Model 3 rebuilt from measured reference views (side, top, front) ===== */
const M3B_PAINT='#3d4046';
const M3B_TOP=[[-2.36,0.56],[-2.3,0.66],[-2.12,0.74],[-1.9,0.83],[-1.6,0.89],[-1.4,0.93],[-1.18,0.955],[0,0.97],[1.6,1.0],[2.05,1.04],[2.24,1.02],[2.33,0.92],[2.36,0.8]];
const M3B_BOT=[[-2.36,0.3],[-2.25,0.17],[2.2,0.18],[2.36,0.32]];
const M3B_HW=[[-2.36,0.52],[-2.17,0.79],[-1.98,0.889],[-1.79,0.918],[-1.51,0.925],[-1.04,0.903],[0,0.9],[0.85,0.9],[1.32,0.925],[1.6,0.91],[1.79,0.867],[1.98,0.806],[2.17,0.66],[2.36,0.5]];
const M3B_ROOF=[[-1.18,0.955],[-0.944,1.075],[-0.708,1.19],[-0.472,1.286],[-0.236,1.358],[0,1.406],[0.236,1.43],[0.472,1.442],[0.708,1.43],[0.944,1.4],[1.18,1.358],[1.416,1.298],[1.652,1.226],[1.888,1.136],[2.03,1.045]];
function m3bBodyRing(z){
  const w=m3Interp(M3B_HW,z),y1=m3Interp(M3B_TOP,z),y0=m3Interp(M3B_BOT,z),cy=(y0+y1)/2,h=(y1-y0)/2,N=30,e=0.6,out=[];
  for(let k=0;k<N;k++){
    const t=k/N*Math.PI*2,c=Math.cos(t),s=Math.sin(t);
    let x=w*Math.sign(c)*Math.pow(Math.abs(c),e);
    const y=cy+h*Math.sign(s)*Math.pow(Math.abs(s),e);
    if(y>cy) x*=1-0.08*((y-cy)/h);
    out.push([x,y]);
  }
  return out;
}
function m3bCabinRing(z){
  const belt=m3Interp(M3B_TOP,z)-0.03,roof=Math.max(belt+0.002,m3Interp(M3B_ROOF,z)),hgt=roof-belt;
  const wb=m3Interp(M3B_HW,z)*0.82,wr=m3Interp(M3B_HW,z)*0.6,N=18,out=[];
  for(let k=0;k<=N;k++){
    const t=k/N*Math.PI,c=Math.cos(t),s=Math.sin(t);
    out.push([Math.sign(c)*Math.pow(Math.abs(c),0.75)*(wb*(1-s)+wr*s),belt+hgt*Math.pow(s,0.55)]);
  }
  return out;
}
function makeCar3D(){
  const g=new THREE.Group();
  const paint=new THREE.MeshPhongMaterial({color:M3B_PAINT,shininess:110,specular:0xa8a8a8,emissive:0x0e1013,side:THREE.DoubleSide});
  const glass=new THREE.MeshPhongMaterial({color:0x090b0e,shininess:140,specular:0xc0c0c0,emissive:0x040506,side:THREE.DoubleSide});
  const trim=new THREE.MeshLambertMaterial({color:0x0e1012});
  const tire=new THREE.MeshLambertMaterial({color:0x0c0c0c});
  const rim=new THREE.MeshPhongMaterial({color:0x26292d,shininess:60});
  const head=new THREE.MeshBasicMaterial({color:0xf4f8ff});
  carTail=new THREE.MeshBasicMaterial({color:0xb0141c});
  /* shadow and night headlight beam stay centered on the car */
  const bc=document.createElement('canvas');bc.width=bc.height=64;
  const bx=bc.getContext('2d'),bg=bx.createRadialGradient(32,32,4,32,32,32);
  bg.addColorStop(0,'rgba(0,0,0,0.75)');bg.addColorStop(0.6,'rgba(0,0,0,0.4)');bg.addColorStop(1,'rgba(0,0,0,0)');
  bx.fillStyle=bg;bx.fillRect(0,0,64,64);
  const blob=new THREE.Mesh(new THREE.PlaneGeometry(2.5,5.4),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(bc),transparent:true,depthWrite:false}));
  blob.rotation.x=-Math.PI/2;blob.position.y=0.04;blob.userData.noCull=true;g.add(blob);
  const hc=document.createElement('canvas');hc.width=64;hc.height=128;
  const hx=hc.getContext('2d'),hg=hx.createLinearGradient(0,128,0,0);
  hg.addColorStop(0,'rgba(255,245,215,0.9)');hg.addColorStop(1,'rgba(255,245,215,0)');
  hx.fillStyle=hg;hx.beginPath();hx.moveTo(22,128);hx.lineTo(42,128);hx.lineTo(64,0);hx.lineTo(0,0);hx.closePath();hx.fill();
  carBeam=new THREE.Mesh(new THREE.PlaneGeometry(4.2,12),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(hc),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0}));
  carBeam.rotation.x=-Math.PI/2;carBeam.position.set(0,0.05,-8.3);carBeam.userData.noCull=true;g.add(carBeam);
  /* the car itself, shifted so its real rear axle sits where the motion system expects it */
  const body=new THREE.Group();body.position.z=REAR_AXLE-1.355;g.add(body);
  const add=(geo,mat,x,y,z,shadow)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=shadow!==false;m.userData.noCull=true;body.add(m);return m;};
  const zs=[];for(let i=0;i<=34;i++) zs.push(-2.36*Math.cos(Math.PI*i/34));
  add(m3Loft(zs,m3bBodyRing,true),paint,0,0,0);
  const cz=[];for(let i=0;i<=22;i++) cz.push(-1.18+3.21*i/22);
  add(m3Loft(cz,m3bCabinRing,false),glass,0,0,0);
  /* slim headlights wrapping the front corners, black lower intake */
  for(const s of [-1,1]){
    const hl=add(new THREE.BoxGeometry(0.42,0.04,0.05),head,s*0.6,0.71,-2.1,false);hl.rotation.y=s*0.5;
  }
  add(new THREE.BoxGeometry(1.0,0.07,0.05),trim,0,0.3,-2.3,false);
  /* C-shaped taillights, low red reflectors, dark diffuser */
  for(const s of [-1,1]){
    add(new THREE.BoxGeometry(0.34,0.05,0.05),carTail,s*0.52,0.95,2.31,false);
    add(new THREE.BoxGeometry(0.05,0.12,0.05),carTail,s*0.71,0.9,2.27,false);
    add(new THREE.BoxGeometry(0.16,0.04,0.05),carTail,s*0.62,0.85,2.29,false);
    add(new THREE.BoxGeometry(0.18,0.03,0.04),carTail,s*0.42,0.42,2.35,false);
  }
  add(new THREE.BoxGeometry(1.1,0.12,0.06),trim,0,0.3,2.33,false);
  /* side mirrors */
  const mg=new THREE.SphereGeometry(0.1,12,8);
  for(const s of [-1,1]){const m=add(mg,paint,s*0.97,0.99,-0.95);m.scale.set(1,0.6,1.5);}
  /* wheels at their real positions, in dark arches; front wheels steer */
  const wg=new THREE.CylinderGeometry(0.34,0.34,0.235,24);wg.rotateZ(Math.PI/2);
  const rg=new THREE.CylinderGeometry(0.25,0.25,0.245,24);rg.rotateZ(Math.PI/2);
  const archG=new THREE.CircleGeometry(0.41,24);
  carFrontWheels=[];
  for(const x of [-0.815,0.815])for(const z of [-1.52,1.355]){
    const arch=new THREE.Mesh(archG,trim);arch.position.set(x>0?0.928:-0.928,0.37,z);arch.rotation.y=x>0?Math.PI/2:-Math.PI/2;arch.userData.noCull=true;body.add(arch);
    const w=new THREE.Group();w.position.set(x,0.34,z);
    const t=new THREE.Mesh(wg,tire);t.castShadow=true;t.userData.noCull=true;w.add(t);
    const r=new THREE.Mesh(rg,rim);r.position.x=x>0?0.005:-0.005;r.userData.noCull=true;w.add(r);
    body.add(w);
    if(z<0) carFrontWheels.push(w);
  }
  return g;
}
if(typeof car3d!=='undefined'&&car3d&&treeScene){treeScene.remove(car3d);car3d=null;}

/* Night: keep Tessy readable (soft paint lift + a gentle light above the car) */
let carNightLight=null;
updateCar3D=(function(base){return function(cx,cz,hd,steer){
  base(cx,cz,hd,steer);
  if(!car3d) return;
  const nt=typeof nightNow==='number'?nightNow:0;
  if(!carNightLight){
    carNightLight=new THREE.PointLight(0xdfe6ff,0,14,2);
    treeScene.add(carNightLight);
  }
  carNightLight.position.set(cx,4.5+(typeof carY==='number'?carY:0),cz);
  carNightLight.intensity=1.6*nt;
  car3d.traverse(o=>{
    if(o.isMesh&&o.material&&o.material.isMeshPhongMaterial&&o.material.color.getHexString()===M3B_PAINT.slice(1)){
      o.material.emissive.setRGB(0.055+0.07*nt,0.06+0.075*nt,0.07+0.085*nt);
    }
  });
};})(updateCar3D);

/* ===== Real 3D model of Tessy (model3.glb in the website's main folder), with reflective paint ===== */
let m3Env=null,m3EnvPending=false,m3Mats=[],m3Tail=null;
function m3EnvScene(){
  const sc=new THREE.Scene();
  const geo=new THREE.SphereGeometry(50,32,16),p=geo.attributes.position,cols=[];
  const top=new THREE.Color('#8fb4e6'),hor=new THREE.Color('#e6ebf0'),gnd=new THREE.Color('#5c5e60');
  for(let i=0;i<p.count;i++){
    const y=p.getY(i)/50;
    const c=y>0?hor.clone().lerp(top,Math.pow(y,0.6)):hor.clone().lerp(gnd,Math.min(1,-y*3));
    cols.push(c.r,c.g,c.b);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));
  sc.add(new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide})));
  const sun=new THREE.Mesh(new THREE.SphereGeometry(6,12,8),new THREE.MeshBasicMaterial({color:0xffffff}));
  sun.position.set(20,30,10);sc.add(sun);
  return sc;
}
const m3BaseRender=treeLayer.render;
treeLayer.render=function(gl,matrix){
  if(m3EnvPending&&this.renderer){
    m3EnvPending=false;
    try{
      const pm=new THREE.PMREMGenerator(this.renderer);
      m3Env=pm.fromScene(m3EnvScene(),0.02).texture;pm.dispose();
      for(const m of m3Mats){m.envMap=m3Env;m.needsUpdate=true;}
    }catch(e){console.warn('car reflections',e);}
  }
  return m3BaseRender.call(this,gl,matrix);
};
function m3Material(md){
  const pbr=md.pbrMetallicRoughness||{},c=pbr.baseColorFactor||[0.5,0.5,0.5,1],name=md.name||'';
  let m;
  if(name==='paint') m=new THREE.MeshPhysicalMaterial({color:new THREE.Color('#3a3d42'),metalness:0.6,roughness:0.3,clearcoat:1,clearcoatRoughness:0.05,side:THREE.DoubleSide});
  else if(name==='glass') m=new THREE.MeshPhysicalMaterial({color:0x0b0d10,metalness:0.1,roughness:0.04,side:THREE.DoubleSide});
  else if(name==='tail'){m=new THREE.MeshStandardMaterial({color:0x7a0d10,emissive:0x5a0000,roughness:0.3});m3Tail=m;}
  else m=new THREE.MeshStandardMaterial({color:new THREE.Color(c[0],c[1],c[2]),metalness:pbr.metallicFactor!=null?pbr.metallicFactor:0.2,
    roughness:pbr.roughnessFactor!=null?pbr.roughnessFactor:0.6,side:THREE.DoubleSide});
  if(m3Env) m.envMap=m3Env;
  m3Mats.push(m);
  return m;
}
async function m3Load(){
  const r=await fetch('model3.glb');
  if(!r.ok) throw new Error('model3.glb not found');
  const buf=await r.arrayBuffer(),dv=new DataView(buf);
  if(dv.getUint32(0,true)!==0x46546C67) throw new Error('not a GLB file');
  let off=12,j=null,bin=null;
  while(off+8<=buf.byteLength){
    const len=dv.getUint32(off,true),type=dv.getUint32(off+4,true),st=off+8;
    if(type===0x4E4F534A) j=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,st,len)));
    else if(type===0x004E4942) bin=buf.slice(st,st+len);
    off=st+len;
  }
  const acc=i=>{
    const a=j.accessors[i],bv=j.bufferViews[a.bufferView];
    const n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
    const T={5126:Float32Array,5125:Uint32Array,5123:Uint16Array,5121:Uint8Array}[a.componentType];
    const o=(bv.byteOffset||0)+(a.byteOffset||0);
    return new T(bin.slice(o,o+a.count*n*T.BYTES_PER_ELEMENT));
  };
  const root=new THREE.Group(),wheels={};
  for(const ni of j.scenes[j.scene||0].nodes){
    const nd=j.nodes[ni];
    if(nd.mesh==null) continue;
    const M=new THREE.Matrix4();
    if(nd.matrix) M.fromArray(nd.matrix);
    else if(nd.translation) M.makeTranslation(nd.translation[0],nd.translation[1],nd.translation[2]);
    for(const pr of j.meshes[nd.mesh].primitives){
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.BufferAttribute(acc(pr.attributes.POSITION),3));
      if(pr.attributes.NORMAL!=null) g.setAttribute('normal',new THREE.BufferAttribute(acc(pr.attributes.NORMAL),3));
      if(pr.indices!=null) g.setIndex(new THREE.BufferAttribute(acc(pr.indices),1));
      if(pr.attributes.NORMAL==null) g.computeVertexNormals();
      const md=(j.materials&&pr.material!=null)?j.materials[pr.material]:{};
      const mesh=new THREE.Mesh(g,m3Material(md));
      mesh.castShadow=true;mesh.frustumCulled=false;mesh.userData.noCull=true;
      const wk=(nd.name||'').match(/^(Wheel[FR][LR])_/);
      if(wk){
        let w=wheels[wk[1]];
        if(!w){w=new THREE.Group();w.position.setFromMatrixPosition(M);wheels[wk[1]]=w;root.add(w);}
        w.add(mesh);
      }else{mesh.applyMatrix4(M);root.add(mesh);}
    }
  }
  return {root:root,front:Object.keys(wheels).filter(k=>k[5]==='F').map(k=>wheels[k])};
}
makeCar3D=(function(base){return function(){
  const g=base();
  if(!m3Env) m3EnvPending=true;
  m3Load().then(res=>{
    const body=g.children.find(c=>c.isGroup);
    if(body) g.remove(body);
    g.add(res.root);
    if(res.front.length) carFrontWheels=res.front;
    if(m3Tail) carTail=m3Tail;
  }).catch(e=>console.warn('Real car model not loaded, using the built-in car:',e.message));
  return g;
};})(makeCar3D);
updateCar3D=(function(base){return function(cx,cz,hd,steer){
  base(cx,cz,hd,steer);
  const nt=typeof nightNow==='number'?nightNow:0;
  for(const m of m3Mats) m.envMapIntensity=1-0.75*nt;
};})(updateCar3D);
if(typeof car3d!=='undefined'&&car3d&&treeScene){treeScene.remove(car3d);car3d=null;}

/* Car look: crisp faceted shading (like Codriver) and a color choice: ?carcolor=white|grey|silver|black|blue|red */
const M3_COLORS={grey:'#3a3d42',white:'#e9eaec',silver:'#8d9196',black:'#0d0e10',blue:'#1d3d78',red:'#8c0f14'};
(function(){
  const q=new URLSearchParams(location.search).get('carcolor');
  if(q&&M3_COLORS[q]) cacheSet('carColor',q);
})();
setInterval(()=>{
  const want=M3_COLORS[cacheGet('carColor')||'grey'];
  for(const m of m3Mats){
    if(!m.flatShading){m.flatShading=true;m.needsUpdate=true;}
    if(m.isMeshPhysicalMaterial&&m.clearcoat>0&&m.userData.col!==want){m.color.set(want);m.userData.col=want;}
  }
},1000);

/* Car rendering v2: shading from the model, outside surfaces only (no flicker), realistic reflections */
let m3Mats2=[];
function m3Material(md){
  const pbr=md.pbrMetallicRoughness||{},c=pbr.baseColorFactor||[0.5,0.5,0.5,1],name=md.name||'';
  const col=M3_COLORS[cacheGet('carColor')||'grey'];
  const wheel=(name==='tire'||name==='rim'||name==='brake');
  let m;
  if(name==='paint') m=new THREE.MeshPhysicalMaterial({color:new THREE.Color(col),metalness:0.45,roughness:0.35,clearcoat:0.8,clearcoatRoughness:0.12});
  else if(name==='glass') m=new THREE.MeshPhysicalMaterial({color:0x101317,metalness:0,roughness:0.08});
  else if(name==='tail'){m=new THREE.MeshStandardMaterial({color:0x7a0d10,emissive:0x5a0000,roughness:0.3});m3Tail=m;}
  else m=new THREE.MeshStandardMaterial({color:new THREE.Color(c[0],c[1],c[2]),
    metalness:Math.min(0.6,pbr.metallicFactor!=null?pbr.metallicFactor:0.2),
    roughness:Math.max(0.35,pbr.roughnessFactor!=null?pbr.roughnessFactor:0.6),
    side:wheel?THREE.DoubleSide:THREE.FrontSide});
  m.envMap=m3Env||null;m.envMapIntensity=0.8;
  m3Mats2.push(m);
  return m;
}
setInterval(()=>{
  const col=M3_COLORS[cacheGet('carColor')||'grey'];
  for(const m of m3Mats2){
    if(m3Env&&m.envMap!==m3Env){m.envMap=m3Env;m.needsUpdate=true;}
    if(m.isMeshPhysicalMaterial&&m.clearcoat>0&&m.userData.col!==col){m.color.set(col);m.userData.col=col;}
  }
},1000);
updateCar3D=(function(base){return function(cx,cz,hd,steer){
  base(cx,cz,hd,steer);
  const nt=typeof nightNow==='number'?nightNow:0;
  for(const m of m3Mats2) m.envMapIntensity=0.8*(1-0.75*nt);
};})(updateCar3D);
if(typeof car3d!=='undefined'&&car3d&&treeScene){treeScene.remove(car3d);car3d=null;}

/* Car rendering v3: no see-through (both sides drawn), solid Stealth Grey paint, calmer reflections */
function m3Material(md){
  const pbr=md.pbrMetallicRoughness||{},c=pbr.baseColorFactor||[0.5,0.5,0.5,1],name=md.name||'';
  const col=M3_COLORS[cacheGet('carColor')||'grey'];
  let m;
  if(name==='paint') m=new THREE.MeshPhysicalMaterial({color:new THREE.Color(col),metalness:0.25,roughness:0.4,clearcoat:0.6,clearcoatRoughness:0.15,side:THREE.DoubleSide});
  else if(name==='glass') m=new THREE.MeshPhysicalMaterial({color:0x101317,metalness:0,roughness:0.08,side:THREE.DoubleSide});
  else if(name==='tail'){m=new THREE.MeshStandardMaterial({color:0x7a0d10,emissive:0x5a0000,roughness:0.3,side:THREE.DoubleSide});m3Tail=m;}
  else m=new THREE.MeshStandardMaterial({color:new THREE.Color(c[0],c[1],c[2]),
    metalness:Math.min(0.5,pbr.metallicFactor!=null?pbr.metallicFactor:0.2),
    roughness:Math.max(0.4,pbr.roughnessFactor!=null?pbr.roughnessFactor:0.6),side:THREE.DoubleSide});
  m.envMap=m3Env||null;m.envMapIntensity=0.55;
  m3Mats2.push(m);
  return m;
}
updateCar3D=(function(base){return function(cx,cz,hd,steer){
  base(cx,cz,hd,steer);
  const nt=typeof nightNow==='number'?nightNow:0;
  for(const m of m3Mats2) m.envMapIntensity=0.55*(1-0.7*nt);
};})(updateCar3D);
if(typeof car3d!=='undefined'&&car3d&&treeScene){treeScene.remove(car3d);car3d=null;}

/* Night: keep the paint solid and even (fade reflections, soft even glow in the car's own color) */
updateCar3D=(function(base){return function(cx,cz,hd,steer){
  base(cx,cz,hd,steer);
  const nt=typeof nightNow==='number'?nightNow:0;
  for(const m of m3Mats2){
    m.envMapIntensity=0.55*(1-0.9*nt);
    if(m.isMeshPhysicalMaterial&&m.clearcoat>0){
      m.emissive.copy(m.color).multiplyScalar(0.35*nt);
      m.clearcoatRoughness=0.15+0.35*nt;
    }
  }
};})(updateCar3D);
/* ===== v18: no spinning (direction held at low speed, real-car turning limit), lighter road matching, bridge info in recordings ===== */
function renderedRoads(pos){
  try{
    const pt=map.project(pos);
    return map.queryRenderedFeatures([[pt.x-150,pt.y-150],[pt.x+150,pt.y+150]],{layers:getRoadLayers()});
  }catch(e){return [];}
}
let mr2LastT=0;
matchRoad=(function(full){return function(x,z,spd){
  const now=performance.now();
  if(now-mr2LastT<700&&curRoad&&!turning&&spd>=1){
    const s=onCurRoad(x,z);
    if(Math.hypot(s[0]-x,s[1]-z)<=SNAP_MAX+4){lastMatchInfo={why:'between'};return {x:s[0],z:s[1],tx:curRoad.tx,tz:curRoad.tz};}
  }
  mr2LastT=now;
  return full(x,z,spd);
};})(matchRoad);

glideFrame=function(){
  requestAnimationFrame(glideFrame);
  const now=performance.now(),fdt=Math.min(0.1,lastFrameT?(now-lastFrameT)/1000:0.016);
  lastFrameT=now;
  if(watchId===null||!pts.length) return;
  if(pts.length>3){
    const iv=[];
    for(let i=Math.max(1,pts.length-8);i<pts.length;i++) iv.push(pts[i].t-pts[i-1].t);
    iv.sort((a,b)=>a-b);
    const want=Math.max(250,Math.min(1050,iv[Math.floor(iv.length/2)]*2.2));
    drawDelay+=(want-drawDelay)*Math.min(1,fdt*0.5);
  }
  const p=pathAt(now-drawDelay);
  if(!p) return;
  const k=Math.exp(-fdt/0.35);corr[0]*=k;corr[1]*=k;
  const rx=p.x+corr[0],rz=p.z+corr[1];
  const v=Math.hypot(p.dx,p.dz);
  let hd=lastPathHd!==null?lastPathHd:(lastHd!==null?lastHd:gHd);
  if(v>2){hd=(Math.atan2(p.dx,-p.dz)/R+360)%360;lastPathHd=hd;}
  else if(curRoad&&snapOk){
    const rh=(Math.atan2(curRoad.tx,-curRoad.tz)/R+360)%360;
    if(Math.abs(((rh-gHd+540)%360)-180)<60) hd=rh;
  }
  const dh=((hd-gHd+540)%360)-180;
  const maxStep=70*fdt*(v>2?1:0.5);
  const step=Math.max(-maxStep,Math.min(maxStep,dh*Math.min(1,fdt*8)));
  const newHd=(gHd+step+360)%360;
  gHd=newHd;
  let wantSteer=0;
  if(v>1){const curv=(step*R)/(v*fdt);wantSteer=Math.max(-0.5,Math.min(0.5,Math.atan(WHEELBASE*curv)));}
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
};

recTick=(function(base){return function(){
  const before=rec?rec.f.length:0;
  base();
  if(rec&&rec.f.length>before){
    const row=rec.f[rec.f.length-1];
    row.push(snapBridge?1:0,typeof carY==='number'?Math.round(carY*10)/10:0);
  }
};})(recTick);
/* Map credits: fold into a small (i) button after a few seconds (tap it to see the full credits) */
map.on('load',()=>{
  try{
    const old=(map._controls||[]).find(c=>c instanceof maplibregl.AttributionControl);
    if(old) map.removeControl(old);
    const ctl=new maplibregl.AttributionControl({compact:true,customAttribution:'Arbres : Ville de Montréal (CC BY 4.0)'});
    map.addControl(ctl,'bottom-right');
    setTimeout(()=>{
      const el=document.querySelector('.maplibregl-ctrl-attrib');
      if(el){el.classList.remove('maplibregl-compact-show');el.removeAttribute('open');}
    },6000);
  }catch(e){console.warn('credits',e);}
});
/* Horizon haze follows the time of day (no more white band under the night sky) */
function applySkyColors(){
  const nt=typeof nightNow==='number'?nightNow:0;
  const warm='#f2b27a';
  const sky=mixHex('#6fa8e8','#0b1633',nt);
  const hor=nt<0.5?mixHex('#d6e6f5',warm,nt*2):mixHex(warm,'#13214a',(nt-0.5)*2);
  const fog=nt<0.5?mixHex('#e4ecf3','#c99a7a',nt*2):mixHex('#c99a7a','#101a36',(nt-0.5)*2);
  try{
    map.setSky({'sky-color':sky,'horizon-color':hor,'fog-color':fog,
      'sky-horizon-blend':0.5,'horizon-fog-blend':0.6,'fog-ground-blend':0.6,'atmosphere-blend':0.6});
  }catch(e){}
}
if(typeof updateSun==='function'){
  updateSun=(function(base){return function(){const r=base.apply(this,arguments);applySkyColors();return r;};})(updateSun);
}
map.on('load',()=>{applySkyColors();setInterval(applySkyColors,5000);});
/* One heavy builder at a time, so their pauses never stack into a freeze */
const jobOrig={},jobArgs={},jobQ=[],jobLast={};
const JOB_GAP={updateBuildings:3000,updateBridges:4000,updateLights:2500,updateSigns:2500,updateTrees:1500,parkTrees:5000,r3Rebuild:0};
for(const name in JOB_GAP){
  const f=window[name];
  if(typeof f!=='function') continue;
  jobOrig[name]=f;
  window[name]=function(){
    jobArgs[name]=arguments;
    if(jobQ.indexOf(name)<0) jobQ.push(name);
  };
}
setInterval(()=>{
  const now=performance.now();
  for(let i=0;i<jobQ.length;i++){
    const n=jobQ[i];
    if(now-(jobLast[n]||0)<JOB_GAP[n]) continue;
    jobQ.splice(i,1);jobLast[n]=now;
    try{jobOrig[n].apply(null,jobArgs[n]||[]);}catch(e){console.warn('job',n,e);}
    break;
  }
},180);
/* The far background follows the horizon color, so there's no white band at any time of day */
function applySkyColors(){
  const nt=typeof nightNow==='number'?nightNow:0;
  const warm='#f2b27a';
  const sky=mixHex('#6fa8e8','#0b1633',nt);
  const hor=nt<0.5?mixHex('#d6e6f5',warm,nt*2):mixHex(warm,'#13214a',(nt-0.5)*2);
  const fog=nt<0.5?mixHex('#dfe8f1','#c99a7a',nt*2):mixHex('#c99a7a','#101a36',(nt-0.5)*2);
  try{
    map.setSky({'sky-color':sky,'horizon-color':hor,'fog-color':fog,
      'sky-horizon-blend':0.5,'horizon-fog-blend':0.8,'fog-ground-blend':0.85,'atmosphere-blend':0.6});
  }catch(e){}
  try{
    const bg=(map.getStyle().layers.find(l=>l.type==='background')||{}).id;
    if(bg) map.setPaintProperty(bg,'background-color',fog);
  }catch(e){}
}
applySkyColors();
/* Behind the map: same color as the horizon, so the gap above the horizon never shows white */
applySkyColors=(function(base){return function(){
  base();
  const nt=typeof nightNow==='number'?nightNow:0;
  const fog=nt<0.5?mixHex('#dfe8f1','#c99a7a',nt*2):mixHex('#c99a7a','#101a36',(nt-0.5)*2);
  try{
    document.body.style.background=fog;
    const el=document.getElementById('map');
    if(el) el.style.background=fog;
  }catch(e){}
};})(applySkyColors);
applySkyColors();
/* ===== v24: build in small pieces (no freezes): instanced trees, one block at a time for buildings, lamps and signs ===== */
const TN_ORDER=[[0,0],[0,1],[1,0],[0,-1],[-1,0],[1,1],[-1,-1],[1,-1],[-1,1]];
const tnCont={};
function tnContinue(name){
  if(tnCont[name]) return;
  tnCont[name]=setTimeout(()=>{
    tnCont[name]=0;
    const f=(typeof jobOrig!=='undefined'&&jobOrig[name])||window[name];
    try{f('cont');}catch(e){console.warn('continue',name,e);}
  },160);
}

/* Trees: instanced drawing (same look, a tiny fraction of the work) */
let treeInstMat=null;
function buildMesh(list){
  if(typeof quality!=='undefined'&&quality==='low') list=list.filter((t,i)=>i%2===0);
  if(!treeInstMat) treeInstMat=new THREE.MeshLambertMaterial({color:0xffffff});
  const n=list.length,g=new THREE.Group();
  const trunks=new THREE.InstancedMesh(trunkGeo,treeInstMat,Math.max(1,n));
  const balls=new THREE.InstancedMesh(ballGeo,treeInstMat,Math.max(1,n*2));
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),p=new THREE.Vector3(),sc=new THREE.Vector3();
  for(let i=0;i<n;i++){
    const t=list[i],s=t.s;
    p.set(t.x,1.6*s,t.z);sc.set(s,s,s);m.compose(p,q,sc);trunks.setMatrixAt(i,m);trunks.setColorAt(i,trunkCol);
    p.set(t.x,4.6*s,t.z);sc.set(2.6*s,2.3*s,2.6*s);m.compose(p,q,sc);balls.setMatrixAt(2*i,m);balls.setColorAt(2*i,t.col);
    p.set(t.x+t.jx*s,6.3*s,t.z+t.jz*s);sc.set(1.7*s,1.6*s,1.7*s);m.compose(p,q,sc);balls.setMatrixAt(2*i+1,m);balls.setColorAt(2*i+1,t.col);
  }
  trunks.count=n;balls.count=n*2;
  for(const im of [trunks,balls]){
    im.instanceMatrix.needsUpdate=true;
    if(im.instanceColor) im.instanceColor.needsUpdate=true;
    im.castShadow=true;im.frustumCulled=false;im.userData.noCull=true;
    g.add(im);
  }
  g.userData.treeGroup=true;
  return g;
}
function tnDisposeTree(mesh){
  if(mesh.userData&&mesh.userData.treeGroup){for(const ch of mesh.children){if(ch.dispose) ch.dispose();}}
  else if(mesh.geometry) mesh.geometry.dispose();
}
function updateTrees(){
  treesEl.textContent='Trees: '+treeCount;
  if(treesFailed||!treeScene) return;
  const c=map.getCenter(),cx=Math.floor(c.lng/C),cy=Math.floor(c.lat/C);
  for(const [ck,mesh] of cellMeshes){
    const [x,y]=ck.split(',').map(Number);
    if(Math.abs(x-cx)>2||Math.abs(y-cy)>2){treeScene.remove(mesh);tnDisposeTree(mesh);cellMeshes.delete(ck);}
  }
  let built=0,pending=false;
  for(const [dx,dy] of TN_ORDER){
    const ck=(cx+dx)+','+(cy+dy),b=buckets.get(ck);
    if(!b) continue;
    if(cellMeshes.has(ck)&&!dirty.has(ck)) continue;
    if(built>=2){pending=true;continue;}
    const old=cellMeshes.get(ck);
    if(old){treeScene.remove(old);tnDisposeTree(old);}
    const mesh=buildMesh(b);treeScene.add(mesh);cellMeshes.set(ck,mesh);dirty.delete(ck);built++;
  }
  if(pending) tnContinue('updateTrees');
  map.triggerRepaint();
}

/* Buildings: re-read the map only when new data arrived or the area changed; build one block at a time */
let bTilesChanged=true,bLastCell='';
map.on('sourcedata',e=>{if(e.sourceId==='openmaptiles'&&e.tile) bTilesChanged=true;});
function updateBuildings(force){
  if(bFailed||!treeScene) return;
  bLast=performance.now();
  try{
    if(!bMat) bMat=makeBuildingMaterial();
    if(!bAmb){bAmb=new THREE.AmbientLight(0x8a9ac0,0);treeScene.add(bAmb);}
    const c=map.getCenter(),cx=Math.floor(c.lng/BC),cy=Math.floor(c.lat/BC);
    const s=sunPos(nowForSun(),c.lat,c.lng);
    bNight.value=Math.min(1,Math.max(0,(6-s.alt/R)/12));
    bAmb.intensity=0.6*bNight.value;
    if(map.getZoom()<15.5){setThreeMode(false);return;}
    const cell=cx+','+cy;
    if(force!=='cont'&&(bTilesChanged||cell!==bLastCell)){bTilesChanged=false;bLastCell=cell;collectBuildings(cx,cy);}
    for(const [ck,mesh] of bMeshes){
      const [x,y]=ck.split(',').map(Number);
      if(Math.abs(x-cx)>2||Math.abs(y-cy)>2){treeScene.remove(mesh);mesh.geometry.dispose();bMeshes.delete(ck);}
    }
    for(const ck of [...bCells.keys()]){
      const [x,y]=ck.split(',').map(Number);
      if(Math.abs(x-cx)>3||Math.abs(y-cy)>3){bCells.delete(ck);bDirty.delete(ck);}
    }
    let built=0,pending=false;
    for(const [dx,dy] of TN_ORDER){
      const ck=(cx+dx)+','+(cy+dy),cl=bCells.get(ck);
      if(!cl) continue;
      if(bMeshes.has(ck)&&!bDirty.has(ck)) continue;
      if(built>=1){pending=true;continue;}
      const old=bMeshes.get(ck);
      if(old){treeScene.remove(old);old.geometry.dispose();bMeshes.delete(ck);}
      const mesh=buildBuildingMesh(cl);
      if(mesh){mesh.visible=bThreeOn||!bReady;treeScene.add(mesh);bMeshes.set(ck,mesh);}
      bDirty.delete(ck);built++;
    }
    if(built&&!bReady) bReady=true;
    if(bReady) setThreeMode(true);
    if(pending) tnContinue('updateBuildings');
    map.triggerRepaint();
  }catch(e){
    bFailed=true;console.warn('3D buildings failed',e);
    for(const m of bMeshes.values()) treeScene.remove(m);
    for(const id of ['building-3d','roofs']) if(map.getLayer(id)) map.setLayoutProperty(id,'visibility','visible');
  }
}

/* Street lamps and traffic lights: one block at a time, nearest first */
function updateLights(force){
  if(lFailed||!treeScene) return;
  lLast=performance.now();
  try{
    if(!lMatPole) makeLightMaterials();
    updateLightNight();
    const zoomOk=map.getZoom()>=15.5;
    for(const v of lMeshes.values()) v.group.visible=zoomOk;
    if(!zoomOk){map.triggerRepaint();return;}
    const c=map.getCenter(),cx=Math.floor(c.lng/LC),cy=Math.floor(c.lat/LC);
    if(force!=='cont') collectLightRoads(cx,cy);
    for(const ck of [...lCells.keys()]){
      const [x,y]=ck.split(',').map(Number);
      if(Math.abs(x-cx)>2||Math.abs(y-cy)>2) lCells.delete(ck);
    }
    for(const [ck,v] of lMeshes){
      const [x,y]=ck.split(',').map(Number);
      if(lDirtyAll||v.dirty||Math.abs(x-cx)>1||Math.abs(y-cy)>1){treeScene.remove(v.group);disposeGroup(v.group);lMeshes.delete(ck);}
    }
    lDirtyAll=false;
    let built=0,pending=false;
    for(const [dx,dy] of TN_ORDER){
      const ck=(cx+dx)+','+(cy+dy);
      if(lMeshes.has(ck)||(!lCells.has(ck)&&!sigCells.has(ck))) continue;
      if(built>=1){pending=true;continue;}
      const group=buildLightCell(ck);
      treeScene.add(group);lMeshes.set(ck,{group:group,dirty:false});built++;
    }
    if(pending) tnContinue('updateLights');
    map.triggerRepaint();
  }catch(e){
    lFailed=true;console.warn('Street lights failed',e);
    for(const v of lMeshes.values()) treeScene.remove(v.group);
  }
}

/* Road signs: one block at a time, nearest first */
function updateSigns(force){
  if(sFailed||!treeScene||typeof lightAcc!=='function') return;
  sLast=performance.now();
  try{
    if(!sMat) makeSignMaterials();
    if(!lMatPole) return;
    const zoomOk=map.getZoom()>=15.5;
    for(const g of sMeshes.values()) g.visible=zoomOk;
    if(!zoomOk){map.triggerRepaint();return;}
    const c=map.getCenter(),cx=Math.floor(c.lng/SC),cy=Math.floor(c.lat/SC);
    if(force!=='cont') signsLoadAround(c.lng,c.lat);
    for(const [ck,g] of sMeshes){
      const [x,y]=ck.split(',').map(Number);
      if(sDirtyAll||Math.abs(x-cx)>1||Math.abs(y-cy)>1||g.userData.roads!==roadsAround(ck)){
        treeScene.remove(g);disposeSignGroup(g);sMeshes.delete(ck);
      }
    }
    sDirtyAll=false;
    let built=0,pending=false;
    for(const [dx,dy] of TN_ORDER){
      const ck=(cx+dx)+','+(cy+dy);
      if(sMeshes.has(ck)||!sCells.has(ck)) continue;
      if(built>=1){pending=true;continue;}
      const g=buildSignCell(ck);g.userData.roads=roadsAround(ck);
      treeScene.add(g);sMeshes.set(ck,g);built++;
    }
    if(pending) tnContinue('updateSigns');
    signNight();
    map.triggerRepaint();
  }catch(e){
    sFailed=true;console.warn('Signs failed',e);
    for(const g of sMeshes.values()) treeScene.remove(g);
  }
}
/* ===== v25: real lanes: same widths and lane counts as the drawn road; the car sits in an actual lane ===== */
const r3LocalCache=new Map();
function r3LocalWays(){
  const out=[];
  if(typeof r3Tiles==='undefined') return out;
  for(const [k,t] of r3Tiles){
    let arr=r3LocalCache.get(k);
    if(!arr||arr.src!==t){
      arr=t.w.map(w=>{
        const pts=r3Local(w[8]);
        let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;
        for(const p of pts){x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);z0=Math.min(z0,p[1]);z1=Math.max(z1,p[1]);}
        return {cls:w[1],ow:w[2],w:w[3],lanes:w[7],pts:pts,bb:[x0-8,x1+8,z0-8,z1+8]};
      });
      arr.src=t;r3LocalCache.set(k,arr);
    }
    out.push(arr);
  }
  return out;
}
function r3InfoAt(x,z,tx,tz){
  let best=null;
  for(const arr of r3LocalWays()){
    for(const W of arr){
      if(x<W.bb[0]||x>W.bb[1]||z<W.bb[2]||z>W.bb[3]) continue;
      const P=W.pts;
      for(let i=0;i<P.length-1;i++){
        const a=P[i],b=P[i+1],dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz;
        if(l2<0.01) continue;
        const l=Math.sqrt(l2);
        if(Math.abs((dx*tx+dz*tz)/l)<0.85) continue;
        const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/l2));
        const d=Math.hypot(a[0]+dx*t-x,a[1]+dz*t-z);
        if(d<8&&(!best||d<best.d)) best={d:d,w:W.w,lanes:W.lanes,ow:W.ow,cls:W.cls};
      }
    }
  }
  return best;
}
let laneState={n:0,idx:0,pend:-1,pendT:0};
function laneOffset(road,x,z){
  const info=r3InfoAt(road.qx,road.qz,road.tx,road.tz)||{w:roadWidthM(road.cls,road.oneway,false),lanes:0,ow:road.oneway,cls:road.cls};
  const w=info.w,L=info.lanes;
  const lat=(x-road.qx)*(-road.tz)+(z-road.qz)*road.tx;
  const centers=[];
  if(info.ow){
    const n=L>0?L:Math.max(1,Math.round(w/3.5)),lw=w/n;
    for(let i=0;i<n;i++) centers.push(-w/2+lw*(i+0.5));
  }else{
    const nHalf=L>1?Math.max(1,Math.floor(L/2)):(w>=14?2:1);
    const park=L>0?0.3:(info.cls==='minor'?2.0:0.4);
    const usable=Math.max(2.8,w/2-park),lw=usable/nHalf;
    for(let i=0;i<nHalf;i++) centers.push(lw*(i+0.5));
  }
  let near=0;
  for(let i=1;i<centers.length;i++) if(Math.abs(lat-centers[i])<Math.abs(lat-centers[near])) near=i;
  const now=performance.now();
  if(laneState.n!==centers.length){laneState={n:centers.length,idx:near,pend:-1,pendT:0};}
  else if(near!==laneState.idx){
    if(laneState.pend!==near){laneState.pend=near;laneState.pendT=now;}
    else if(now-laneState.pendT>1500&&Math.abs(lat-centers[near])+1.0<Math.abs(lat-centers[laneState.idx])){laneState.idx=near;laneState.pend=-1;}
  }else laneState.pend=-1;
  return centers[Math.min(laneState.idx,centers.length-1)];
}
matchRoad=(function(base){return function(x,z,spd){
  const m=base(x,z,spd);
  if(m&&curRoad&&lastMatchInfo&&lastMatchInfo.why!=='between'&&lastMatchInfo.why!=='slow-onroad'){
    try{
      curRoad.lane=laneOffset(curRoad,x,z);
      const s=onCurRoad(x,z);
      if(Math.hypot(s[0]-x,s[1]-z)<=SNAP_MAX+4) return {x:s[0],z:s[1],tx:curRoad.tx,tz:curRoad.tz};
    }catch(e){console.warn('lanes',e);}
  }
  return m;
};})(matchRoad);
/* ===== v26: bridges re-read the map only when needed; let go of a road in gentle curves ===== */
let brTilesChanged=true,brLastKey='';
map.on('sourcedata',e=>{if(e.sourceId==='openmaptiles'&&e.tile) brTilesChanged=true;});
if(typeof jobOrig!=='undefined'&&jobOrig.updateBridges){
  jobOrig.updateBridges=(function(base){return function(force){
    const c=map.getCenter(),key=Math.floor(c.lng/BRC)+','+Math.floor(c.lat/BRC)+'|'+(map.getZoom()>=15.5?1:0);
    if(!brTilesChanged&&key===brLastKey) return;
    brTilesChanged=false;brLastKey=key;
    return base(force);
  };})(jobOrig.updateBridges);
}
matchRoad=(function(base){return function(x,z,spd){
  const m=base(x,z,spd);
  if(m&&lastHd!==null){
    const d=Math.hypot(m.x-x,m.z-z);
    const rh=(Math.atan2(m.tx,-m.tz)/R+360)%360;
    const diff=Math.abs(((rh-lastHd+540)%360)-180);
    if((d>5&&diff>15)||d>8){
      curRoad=null;switchVotes=0;
      if(lastMatchInfo) lastMatchInfo.why='let-go';
      return null;
    }
  }
  return m;
};})(matchRoad);
/* ===== v27: natural turns (smooth, not block-like) and the car centered on the GPS position ===== */
glideFrame=function(){
  requestAnimationFrame(glideFrame);
  const now=performance.now(),fdt=Math.min(0.1,lastFrameT?(now-lastFrameT)/1000:0.016);
  lastFrameT=now;
  if(watchId===null||!pts.length) return;
  if(pts.length>3){
    const iv=[];
    for(let i=Math.max(1,pts.length-8);i<pts.length;i++) iv.push(pts[i].t-pts[i-1].t);
    iv.sort((a,b)=>a-b);
    const want=Math.max(250,Math.min(1050,iv[Math.floor(iv.length/2)]*2.2));
    drawDelay+=(want-drawDelay)*Math.min(1,fdt*0.5);
  }
  const p=pathAt(now-drawDelay);
  if(!p) return;
  const k=Math.exp(-fdt/0.35);corr[0]*=k;corr[1]*=k;
  const rx=p.x+corr[0],rz=p.z+corr[1];
  const v=Math.hypot(p.dx,p.dz);
  let hd=lastPathHd!==null?lastPathHd:(lastHd!==null?lastHd:gHd);
  if(v>2){hd=(Math.atan2(p.dx,-p.dz)/R+360)%360;lastPathHd=hd;}
  else if(curRoad&&snapOk){
    const rh=(Math.atan2(curRoad.tx,-curRoad.tz)/R+360)%360;
    if(Math.abs(((rh-gHd+540)%360)-180)<60) hd=rh;
  }
  const dh=((hd-gHd+540)%360)-180;
  let step;
  if(v>2){
    step=dh*Math.min(1,fdt*7);
    const cap=150*fdt;
    step=Math.max(-cap,Math.min(cap,step));
  }else{
    const cap=35*fdt;
    step=Math.max(-cap,Math.min(cap,dh*Math.min(1,fdt*4)));
  }
  gHd=(gHd+step+360)%360;
  let wantSteer=0;
  if(v>1){const curv=(step*R)/(v*fdt);wantSteer=Math.max(-0.5,Math.min(0.5,Math.atan(WHEELBASE*curv)));}
  steerNow+=(wantSteer-steerNow)*Math.min(1,fdt*5);
  const cx=rx,cz=rz;
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
};
/* ===== v28: on a bridge road the car rides on the deck; bridges are built sooner ===== */
if(typeof JOB_GAP!=='undefined') JOB_GAP.updateBridges=1500;
let brHoldT=0;
updateCar3D=(function(base){return function(cx,cz,hd,steer){
  const onBridge=typeof snapBridge!=='undefined'&&snapBridge;
  if(onBridge){
    const now=performance.now();
    if(now-brHoldT>150){
      brHoldT=now;
      const ys=bridgeSurfaces(cx,cz);
      let top=null;
      for(const y of ys) if(y>0.5&&(top===null||y>top)) top=y;
      if(top!==null) brTarget=top;
      else if(carY>0.5) brTarget=carY;
    }
  }
  base(cx,cz,hd,steer);
  if(onBridge&&brTarget>carY) carY+=(brTarget-carY)*0.12;
};})(updateCar3D);
/* ===== v29: see-through (anything between the camera and Tessy fades), and trust Tessy's position when it reports a huge accuracy ===== */
const TN_SEE={uCam:{value:new THREE.Vector3()},uCar:{value:new THREE.Vector3()},uOn:{value:0}};
function tnSeeThrough(mat){
  if(!mat||mat.userData.tnSee) return;
  mat.userData.tnSee=true;
  const prev=mat.onBeforeCompile;
  mat.onBeforeCompile=function(sh,r){
    if(prev) prev.call(this,sh,r);
    sh.uniforms.uCam=TN_SEE.uCam;sh.uniforms.uCar=TN_SEE.uCar;sh.uniforms.uOn=TN_SEE.uOn;
    sh.vertexShader=sh.vertexShader
      .replace('#include <common>','#include <common>\nvarying vec3 vTnW;')
      .replace('#include <project_vertex>','#include <project_vertex>\n{vec4 tw=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\ntw=instanceMatrix*tw;\n#endif\nvTnW=(modelMatrix*tw).xyz;}');
    sh.fragmentShader=sh.fragmentShader
      .replace('#include <common>','#include <common>\nvarying vec3 vTnW;uniform vec3 uCam;uniform vec3 uCar;uniform float uOn;')
      .replace('void main() {','void main() {\nif(uOn>0.5){vec3 ab=uCar-uCam;float L2=max(dot(ab,ab),1.0);float t=clamp(dot(vTnW-uCam,ab)/L2,0.0,1.0);vec3 pl=uCam+ab*t;float d=length(vTnW-pl);float rad=mix(2.0,5.5,t);if(t<0.97&&d<rad&&(vTnW.y-pl.y)>-1.2){float dith=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453);float fade=1.0-smoothstep(rad*0.55,rad,d);if(dith<fade*0.85) discard;}}');
  };
  const pk=mat.customProgramCacheKey?mat.customProgramCacheKey.bind(mat):null;
  mat.customProgramCacheKey=()=>(pk?pk():'')+'|tnsee';
  mat.needsUpdate=true;
}
setInterval(()=>{
  for(const m of [typeof brMat!=='undefined'?brMat:null,typeof bMat!=='undefined'?bMat:null,
    typeof treeInstMat!=='undefined'?treeInstMat:null,typeof treeMat!=='undefined'?treeMat:null]) if(m) tnSeeThrough(m);
},1000);
updateCar3D=(function(base){return function(cx,cz,hd,steer){
  base(cx,cz,hd,steer);
  try{
    const cam=map.getFreeCameraOptions().position;
    if(cam){
      const ll=cam.toLngLat(),[x,z]=toLocal(ll.lng,ll.lat);
      TN_SEE.uCam.value.set(x,cam.toAltitude(),z);
      TN_SEE.uCar.value.set(cx,(typeof carY==='number'?carY:0)+1.2,cz);
      TN_SEE.uOn.value=1;
    }
  }catch(e){TN_SEE.uOn.value=0;}
};})(updateCar3D);

onPos=(function(base){return function(pos){
  const c=pos&&pos.coords;
  if(c&&c.accuracy>50){
    pos={timestamp:pos.timestamp,coords:{latitude:c.latitude,longitude:c.longitude,accuracy:12,
      speed:c.speed,heading:c.heading,altitude:c.altitude,altitudeAccuracy:c.altitudeAccuracy}};
  }
  return base(pos);
};})(onPos);
/* ===== v30: stay on the highway when passing exits; gentler zoom-out at high speed ===== */
matchRoad=(function(base){return function(x,z,spd){
  const prev=curRoad;
  const m=base(x,z,spd);
  if(prev&&prev.cls==='motorway'&&curRoad&&curRoad!==prev&&lastHd!==null){
    const ph=(Math.atan2(prev.tx,-prev.tz)/R+360)%360;
    const hdiff=Math.abs(((ph-lastHd+540)%360)-180);
    const lat=Math.abs((x-prev.qx)*(-prev.tz)+(z-prev.qz)*prev.tx);
    if(hdiff<6&&lat<9){
      curRoad=prev;
      const s=onCurRoad(x,z);
      if(lastMatchInfo) lastMatchInfo.why='stay-highway';
      return {x:s[0],z:s[1],tx:prev.tx,tz:prev.tz};
    }
  }
  return m;
};})(matchRoad);

function camSpec(){
  const kmh=gT?gT.spd*3.6:0,drop=Math.min(0.5,kmh/200);
  if(viewMode==='street') return {zoom:21.6-drop,pitch:72,pad:0.48};
  return {zoom:19.8-drop-(skyOn?0.4:0),pitch:skyOn?78:60,pad:0.32};
}
/* ===== v31: real lanes at every speed (detailed roads stay on), and load the road ahead at highway speed ===== */
function r3Want(){
  if(!r3Ready) return;
  const now=performance.now();
  if(now-r3LastWant<1000) return;
  r3LastWant=now;
  if(map.getZoom()<15){r3SetNarrow(false);r3Visible(false);return;}
  r3Visible(true);
  const c=map.getCenter(),tx=Math.floor(c.lng/R3T),ty=Math.floor(c.lat/R3T);
  const want=[];
  for(const [dx,dy] of [[0,0],[0,1],[1,0],[0,-1],[-1,0],[1,1],[-1,-1],[1,-1],[-1,1]]) want.push([tx+dx,ty+dy]);
  const kmh=(typeof gT!=='undefined'&&gT)?gT.spd*3.6:0;
  if(kmh>45&&lastHd!==null){
    const fx=Math.sin(lastHd*R),fy=Math.cos(lastHd*R);
    for(const s of [1,2,3]){
      const ax=tx+Math.round(fx*s),ay=ty+Math.round(fy*s);
      want.push([ax,ay]);
      if(s<=2){
        if(Math.abs(fy)>=Math.abs(fx)){want.push([ax-1,ay]);want.push([ax+1,ay]);}
        else{want.push([ax,ay-1]);want.push([ax,ay+1]);}
      }
    }
  }
  for(const [x,y] of want){
    const k=x+','+y;
    if(r3Tiles.has(k)||r3Wanted.has(k)) continue;
    const cached=r3CacheGet(k);
    if(cached){r3Tiles.set(k,cached);r3Schedule();}
    else{r3Wanted.add(k);r3Queue.push([x,y]);}
  }
  for(const k of [...r3Tiles.keys()]){
    const [x,y]=k.split(',').map(Number);
    if(Math.abs(x-tx)>4||Math.abs(y-ty)>4) r3Tiles.delete(k);
  }
  r3Pump();
  r3SetNarrow(r3Tiles.has(tx+','+ty));
  if(tx+','+ty!==r3LastCenter&&now-r3LastBuildT>(kmh>45?3000:4000)){r3LastCenter=tx+','+ty;r3LastBuildT=now;r3Schedule();}
}
/* ===== v32: smooth like Waze/Google: placement changes glide, the map rotates calmly behind the car ===== */
let tnOff=[0,0],tnOffT=0;
matchRoad=(function(base){return function(x,z,spd){
  const m=base(x,z,spd);
  const now=performance.now(),dt=Math.min(0.5,tnOffT?(now-tnOffT)/1000:0.1);
  tnOffT=now;
  const tx=m?m.x-x:0,tz=m?m.z-z:0;
  const a=1-Math.exp(-dt/0.7);
  tnOff[0]+=(tx-tnOff[0])*a;tnOff[1]+=(tz-tnOff[1])*a;
  if(m) return {x:x+tnOff[0],z:z+tnOff[1],tx:m.tx,tz:m.tz};
  if(Math.hypot(tnOff[0],tnOff[1])>0.05&&lastHd!==null){
    return {x:x+tnOff[0],z:z+tnOff[1],tx:Math.sin(lastHd*R),tz:-Math.cos(lastHd*R)};
  }
  return null;
};})(matchRoad);

let camHd=null;
glideFrame=function(){
  requestAnimationFrame(glideFrame);
  const now=performance.now(),fdt=Math.min(0.1,lastFrameT?(now-lastFrameT)/1000:0.016);
  lastFrameT=now;
  if(watchId===null||!pts.length) return;
  if(pts.length>3){
    const iv=[];
    for(let i=Math.max(1,pts.length-8);i<pts.length;i++) iv.push(pts[i].t-pts[i-1].t);
    iv.sort((a,b)=>a-b);
    const want=Math.max(250,Math.min(1050,iv[Math.floor(iv.length/2)]*2.2));
    drawDelay+=(want-drawDelay)*Math.min(1,fdt*0.5);
  }
  const p=pathAt(now-drawDelay);
  if(!p) return;
  const k=Math.exp(-fdt/0.35);corr[0]*=k;corr[1]*=k;
  const rx=p.x+corr[0],rz=p.z+corr[1];
  const v=Math.hypot(p.dx,p.dz);
  let hd=lastPathHd!==null?lastPathHd:(lastHd!==null?lastHd:gHd);
  if(v>2){hd=(Math.atan2(p.dx,-p.dz)/R+360)%360;lastPathHd=hd;}
  else if(curRoad&&snapOk){
    const rh=(Math.atan2(curRoad.tx,-curRoad.tz)/R+360)%360;
    if(Math.abs(((rh-gHd+540)%360)-180)<60) hd=rh;
  }
  const dh=((hd-gHd+540)%360)-180;
  let step;
  if(v>2){step=dh*Math.min(1,fdt*5);const cap=120*fdt;step=Math.max(-cap,Math.min(cap,step));}
  else{const cap=35*fdt;step=Math.max(-cap,Math.min(cap,dh*Math.min(1,fdt*4)));}
  gHd=(gHd+step+360)%360;
  let wantSteer=0;
  if(v>1){const curv=(step*R)/(v*fdt);wantSteer=Math.max(-0.5,Math.min(0.5,Math.atan(WHEELBASE*curv)));}
  steerNow+=(wantSteer-steerNow)*Math.min(1,fdt*5);
  gPos=fromLocal(rx,rz);
  car.setLngLat(gPos).setRotation(gHd);
  updateCar3D(rx,rz,gHd,steerNow);
  map.triggerRepaint();
  if(camHd===null) camHd=gHd;
  const cd=((gHd-camHd+540)%360)-180;
  camHd=(camHd+cd*Math.min(1,fdt*1.6)+360)%360;
  if(!follow||now-lastUserZoom<500||now-lastTouch<300) return;
  const cs=camSpec();
  gZoom+=(cs.zoom+userZoomDelta-gZoom)*0.04;
  gPitch+=(cs.pitch-gPitch)*0.06;
  const H=map.getContainer().clientHeight||800;
  map.jumpTo({center:gPos,bearing:camHd,zoom:gZoom,pitch:gPitch,
    padding:{top:Math.round(H*cs.pad),bottom:0,left:0,right:0}});
};
/* ===== v33: lamps on the sidewalk using each street's real width, and half as many ===== */
const LAMP_SPACING_MUL=2.0;
function buildLightCell(ck){
  const [gx,gy]=ck.split(',').map(Number);
  const cell=lCells.get(ck)||new Map();
  const poles=lightAcc(true),heads=lightAcc(false),pools=lightAcc(false),lenses=lightAcc(true);
  const glow=[],sigGlow=[],sigGlowCol=[];
  const occ=new Set();
  const near=[];
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
    const c2=lCells.get((gx+dx)+','+(gy+dy));
    if(c2) for(const r0 of c2.values()){const r=localRoad(r0);if(r) near.push(r);}
  }
  for(const r0 of cell.values()){
    const r=localRoad(r0); if(!r) continue;
    let [spacing,W,both,ph]=r.spec;
    spacing*=LAMP_SPACING_MUL;
    const pts2=r.pts,cum=r.cum,n=pts2.length;
    if(n<2) continue;
    const mi=Math.floor((n-1)/2),ma=pts2[mi],mb=pts2[Math.min(n-1,mi+1)];
    const ml=Math.hypot(mb[0]-ma[0],mb[1]-ma[1])||1,mtx=(mb[0]-ma[0])/ml,mtz=(mb[1]-ma[1])/ml;
    try{const info=r3InfoAt(ma[0],ma[1],mtx,mtz);if(info&&info.w) W=info.w;}catch(e){}
    let outer=0;
    if(r.oneway){
      for(const o of near){
        if(o.pts===r.pts) continue;
        const q=closestOn(o,ma[0],ma[1],35);
        if(!q||q.d<4) continue;
        if(Math.abs(q.tx*mtx+q.tz*mtz)<0.9) continue;
        const side=mtx*(q.pz-ma[1])-mtz*(q.px-ma[0]);
        outer=side>0?-1:1;
        break;
      }
    }
    let k=0;
    for(let s=spacing/2;s<r.L;s+=spacing,k++){
      let i=0;while(i<n-2&&cum[i+1]<s) i++;
      const seg=cum[i+1]-cum[i]||1,t=(s-cum[i])/seg;
      const x=pts2[i][0]+(pts2[i+1][0]-pts2[i][0])*t,z=pts2[i][1]+(pts2[i+1][1]-pts2[i][1])*t;
      const tx=(pts2[i+1][0]-pts2[i][0])/seg,tz=(pts2[i+1][1]-pts2[i][1])/seg;
      const nx=-tz,nz=tx;
      const sides=outer?[outer]:(both?[1,-1]:[k%2?1:-1]);
      for(const sd of sides){
        const off=W/2+1.6,px=x+nx*off*sd,pz=z+nz*off*sd;
        const ok=Math.round(px/8)+','+Math.round(pz/8);
        if(occ.has(ok)) continue; occ.add(ok);
        poles.box(px,pz,tx,tz,0.22,0.22,0,ph,LCOL.pole);
        const ax=-nx*sd,az=-nz*sd;
        poles.box(px+ax*1.0,pz+az*1.0,ax,az,2.0,0.12,ph-0.12,ph,LCOL.pole);
        const hx=px+ax*1.9,hz=pz+az*1.9;
        heads.box(hx,hz,ax,az,0.7,0.3,ph-0.35,ph-0.1);
        glow.push(hx,ph-0.4,hz);
        const cxp=px+ax*3.2,czp=pz+az*3.2,r1=9;
        pools.quad([[cxp-r1,0.25,czp-r1],[cxp+r1,0.25,czp-r1],[cxp+r1,0.25,czp+r1],[cxp-r1,0.25,czp+r1]],[0,1,0],null,[[0,0],[1,0],[1,1],[0,1]]);
      }
    }
  }
  const sigs=sigCells.get(ck)||[];
  for(const sg of sigs){
    const [sx,sz]=toLocal(sg[0],sg[1]);
    const sigOcc=new Set();
    for(const r of near){
      const best=closestOn(r,sx,sz,28);
      if(!best) continue;
      for(const dsg of travelDirs(r,best,near)){
        if(dsg===1&&best.s<9) continue;
        if(dsg===-1&&best.s>r.L-9) continue;
        const fx=best.tx*dsg,fz=best.tz*dsg;
        const rx=-fz,rz=fx;
        const stx=best.px-fx*9,stz=best.pz-fz*9,o=r.W/2+1.5;
        const px=stx+rx*o,pz=stz+rz*o;
        const ok=Math.round(px/5)+','+Math.round(pz/5);
        if(sigOcc.has(ok)) continue; sigOcc.add(ok);
        poles.box(px,pz,fx,fz,0.28,0.28,0,6.2,LCOL.pole);
        const ax=-rx,az=-rz,reach=Math.min(r.W*0.75,7);
        poles.box(px+ax*reach/2,pz+az*reach/2,ax,az,reach,0.16,6.0,6.2,LCOL.pole);
        const hx=px+ax*(reach-0.3),hz=pz+az*(reach-0.3);
        poles.box(hx,hz,fx,fz,0.42,0.5,4.75,6.0,LCOL.sigBox);
        const lx=hx-fx*0.24,lz=hz-fz*0.24;
        const lens=[[LCOL.red,5.62,5.92],[LCOL.amber,5.23,5.53],[LCOL.green,4.84,5.14]];
        for(const [colr,y0,y1] of lens){
          lenses.box(lx,lz,fx,fz,0.06,0.32,y0,y1,colr);
          sigGlow.push(lx-fx*0.1,(y0+y1)/2,lz-fz*0.1);
          sigGlowCol.push(colr.r,colr.g,colr.b);
        }
      }
    }
  }
  const group=new THREE.Group();
  const pg=lightGeom(poles);
  if(pg){const m=new THREE.Mesh(pg,lMatPole);m.castShadow=true;m.frustumCulled=false;group.add(m);}
  const hg=lightGeom(heads);
  if(hg){const m=new THREE.Mesh(hg,lMatHead);m.frustumCulled=false;group.add(m);}
  const lg=lightGeom(lenses);
  if(lg){const m=new THREE.Mesh(lg,lMatLens);m.frustumCulled=false;group.add(m);}
  const qg=lightGeom(pools);
  if(qg){const m=new THREE.Mesh(qg,lMatPool);m.frustumCulled=false;m.renderOrder=2;group.add(m);}
  if(glow.length){
    const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.Float32BufferAttribute(glow,3));
    const p=new THREE.Points(gg,lMatGlow);p.frustumCulled=false;group.add(p);
  }
  if(sigGlow.length){
    const sg=new THREE.BufferGeometry();
    sg.setAttribute('position',new THREE.Float32BufferAttribute(sigGlow,3));
    sg.setAttribute('color',new THREE.Float32BufferAttribute(sigGlowCol,3));
    const p=new THREE.Points(sg,lMatSigGlow);p.frustumCulled=false;group.add(p);
  }
  return group;
}
if(typeof lDirtyAll!=='undefined') lDirtyAll=true;
/* ===== v34: lamps on the right edge of one-way roadways (never the median); trees moved off the road ===== */
function buildLightCell(ck){
  const [gx,gy]=ck.split(',').map(Number);
  const cell=lCells.get(ck)||new Map();
  const poles=lightAcc(true),heads=lightAcc(false),pools=lightAcc(false),lenses=lightAcc(true);
  const glow=[],sigGlow=[],sigGlowCol=[];
  const occ=new Set();
  const near=[];
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
    const c2=lCells.get((gx+dx)+','+(gy+dy));
    if(c2) for(const r0 of c2.values()){const r=localRoad(r0);if(r) near.push(r);}
  }
  for(const r0 of cell.values()){
    const r=localRoad(r0); if(!r) continue;
    let [spacing,W,both,ph]=r.spec;
    spacing*=LAMP_SPACING_MUL;
    const pts2=r.pts,cum=r.cum,n=pts2.length;
    if(n<2) continue;
    const mi=Math.floor((n-1)/2),ma=pts2[mi],mb=pts2[Math.min(n-1,mi+1)];
    const ml=Math.hypot(mb[0]-ma[0],mb[1]-ma[1])||1;
    try{const info=r3InfoAt(ma[0],ma[1],(mb[0]-ma[0])/ml,(mb[1]-ma[1])/ml);if(info&&info.w) W=info.w;}catch(e){}
    const ow=r.oneway?(r.oneway===-1?-1:1):0;
    let k=0;
    for(let s=spacing/2;s<r.L;s+=spacing,k++){
      let i=0;while(i<n-2&&cum[i+1]<s) i++;
      const seg=cum[i+1]-cum[i]||1,t=(s-cum[i])/seg;
      const x=pts2[i][0]+(pts2[i+1][0]-pts2[i][0])*t,z=pts2[i][1]+(pts2[i+1][1]-pts2[i][1])*t;
      const tx=(pts2[i+1][0]-pts2[i][0])/seg,tz=(pts2[i+1][1]-pts2[i][1])/seg;
      const nx=-tz,nz=tx;
      const sides=ow?[ow]:(both?[1,-1]:[k%2?1:-1]);
      for(const sd of sides){
        const off=W/2+1.6,px=x+nx*off*sd,pz=z+nz*off*sd;
        const ok=Math.round(px/8)+','+Math.round(pz/8);
        if(occ.has(ok)) continue; occ.add(ok);
        poles.box(px,pz,tx,tz,0.22,0.22,0,ph,LCOL.pole);
        const ax=-nx*sd,az=-nz*sd;
        poles.box(px+ax*1.0,pz+az*1.0,ax,az,2.0,0.12,ph-0.12,ph,LCOL.pole);
        const hx=px+ax*1.9,hz=pz+az*1.9;
        heads.box(hx,hz,ax,az,0.7,0.3,ph-0.35,ph-0.1);
        glow.push(hx,ph-0.4,hz);
        const cxp=px+ax*3.2,czp=pz+az*3.2,r1=9;
        pools.quad([[cxp-r1,0.25,czp-r1],[cxp+r1,0.25,czp-r1],[cxp+r1,0.25,czp+r1],[cxp-r1,0.25,czp+r1]],[0,1,0],null,[[0,0],[1,0],[1,1],[0,1]]);
      }
    }
  }
  const sigs=sigCells.get(ck)||[];
  for(const sg of sigs){
    const [sx,sz]=toLocal(sg[0],sg[1]);
    const sigOcc=new Set();
    for(const r of near){
      const best=closestOn(r,sx,sz,28);
      if(!best) continue;
      for(const dsg of travelDirs(r,best,near)){
        if(dsg===1&&best.s<9) continue;
        if(dsg===-1&&best.s>r.L-9) continue;
        const fx=best.tx*dsg,fz=best.tz*dsg;
        const rx=-fz,rz=fx;
        const stx=best.px-fx*9,stz=best.pz-fz*9,o=r.W/2+1.5;
        const px=stx+rx*o,pz=stz+rz*o;
        const ok=Math.round(px/5)+','+Math.round(pz/5);
        if(sigOcc.has(ok)) continue; sigOcc.add(ok);
        poles.box(px,pz,fx,fz,0.28,0.28,0,6.2,LCOL.pole);
        const ax=-rx,az=-rz,reach=Math.min(r.W*0.75,7);
        poles.box(px+ax*reach/2,pz+az*reach/2,ax,az,reach,0.16,6.0,6.2,LCOL.pole);
        const hx=px+ax*(reach-0.3),hz=pz+az*(reach-0.3);
        poles.box(hx,hz,fx,fz,0.42,0.5,4.75,6.0,LCOL.sigBox);
        const lx=hx-fx*0.24,lz=hz-fz*0.24;
        const lens=[[LCOL.red,5.62,5.92],[LCOL.amber,5.23,5.53],[LCOL.green,4.84,5.14]];
        for(const [colr,y0,y1] of lens){
          lenses.box(lx,lz,fx,fz,0.06,0.32,y0,y1,colr);
          sigGlow.push(lx-fx*0.1,(y0+y1)/2,lz-fz*0.1);
          sigGlowCol.push(colr.r,colr.g,colr.b);
        }
      }
    }
  }
  const group=new THREE.Group();
  const pg=lightGeom(poles);
  if(pg){const m=new THREE.Mesh(pg,lMatPole);m.castShadow=true;m.frustumCulled=false;group.add(m);}
  const hg=lightGeom(heads);
  if(hg){const m=new THREE.Mesh(hg,lMatHead);m.frustumCulled=false;group.add(m);}
  const lg=lightGeom(lenses);
  if(lg){const m=new THREE.Mesh(lg,lMatLens);m.frustumCulled=false;group.add(m);}
  const qg=lightGeom(pools);
  if(qg){const m=new THREE.Mesh(qg,lMatPool);m.frustumCulled=false;m.renderOrder=2;group.add(m);}
  if(glow.length){
    const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.Float32BufferAttribute(glow,3));
    const p=new THREE.Points(gg,lMatGlow);p.frustumCulled=false;group.add(p);
  }
  if(sigGlow.length){
    const sg=new THREE.BufferGeometry();
    sg.setAttribute('position',new THREE.Float32BufferAttribute(sigGlow,3));
    sg.setAttribute('color',new THREE.Float32BufferAttribute(sigGlowCol,3));
    const p=new THREE.Points(sg,lMatSigGlow);p.frustumCulled=false;group.add(p);
  }
  return group;
}
if(typeof lDirtyAll!=='undefined') lDirtyAll=true;

/* Trees: anything on the road (or within 1 m of its edge) is moved just past the edge */
let r3Grid=null,r3GridKey='';
function r3GetGrid(){
  if(typeof r3Tiles==='undefined') return null;
  const key=[...r3Tiles.keys()].sort().join('|');
  if(r3Grid&&key===r3GridKey) return r3Grid;
  r3GridKey=key;
  const G=new Map(),CS=25;
  for(const arr of r3LocalWays()) for(const W of arr){
    const P=W.pts,pad=W.w/2+1.5;
    for(let i=0;i<P.length-1;i++){
      const a=P[i],b=P[i+1],s={ax:a[0],az:a[1],bx:b[0],bz:b[1],w:W.w};
      const x0=Math.floor((Math.min(a[0],b[0])-pad)/CS),x1=Math.floor((Math.max(a[0],b[0])+pad)/CS);
      const z0=Math.floor((Math.min(a[1],b[1])-pad)/CS),z1=Math.floor((Math.max(a[1],b[1])+pad)/CS);
      for(let gx=x0;gx<=x1;gx++)for(let gz=z0;gz<=z1;gz++){
        const k=gx+','+gz;let l=G.get(k);if(!l){l=[];G.set(k,l);}l.push(s);
      }
    }
  }
  r3Grid=G;
  if(typeof buckets!=='undefined'){for(const ck of buckets.keys()) dirty.add(ck);tnContinue('updateTrees');}
  return G;
}
function treeOffRoad(t,G){
  const l=G.get(Math.floor(t.x/25)+','+Math.floor(t.z/25));
  if(!l) return;
  for(const s of l){
    const dx=s.bx-s.ax,dz=s.bz-s.az,l2=dx*dx+dz*dz;
    if(l2<0.01) continue;
    const u=Math.max(0,Math.min(1,((t.x-s.ax)*dx+(t.z-s.az)*dz)/l2));
    const px=s.ax+dx*u,pz=s.az+dz*u;
    let ox=t.x-px,oz=t.z-pz,d=Math.hypot(ox,oz);
    const lim=s.w/2+1.0;
    if(d>=lim) continue;
    if(d<0.01){const L=Math.sqrt(l2);ox=-dz/L;oz=dx/L;d=1;}
    t.x=px+ox/d*(lim+0.3);t.z=pz+oz/d*(lim+0.3);
  }
}
buildMesh=(function(base){return function(list){
  const G=r3GetGrid();
  if(G&&G.size) for(const t of list) treeOffRoad(t,G);
  return base(list);
};})(buildMesh);
