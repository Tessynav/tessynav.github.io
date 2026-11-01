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
