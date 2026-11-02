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
