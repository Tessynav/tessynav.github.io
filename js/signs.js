/* TessyNav signs v5: city signs, OpenStreetMap backup with whole-intersection placement, safety alerts */
const SC=0.005,ST=0.05,SG=8,SCELL=128,OSM_T=0.01;
const sCells=new Map(),sMeshes=new Map(),sLoaded=new Set(),sDone=new Set(),cityCells=new Set();
const oLoaded=new Set(),oQueue=[];
let sIndex=null,sFailed=false,sLast=0,sDirtyAll=false,oBusy=false;
let sMat=null,sBackMat=null;
const SCOL={pole:new THREE.Color('#8a8d90')};
const SSIZE={s:[0.95,0.95],a:[0.75,0.38],y:[1.0,0.9],v:[0.75,0.95],o:[1.0,1.0],x:[0.75,0.75],e:[0.88,0.88],p:[0.88,0.88]};
const SDEF=[0.75,0.75];
const ALERT_LABELS={e:'School zone',p:'Pedestrian crossing',k:'Playground ahead',w:'Stop ahead',x:'No entry'};

/* ---------- Sign artwork, drawn once into a texture atlas ---------- */
const sAtlasCanvas=document.createElement('canvas');sAtlasCanvas.width=sAtlasCanvas.height=SG*SCELL;
const sAtlasCtx=sAtlasCanvas.getContext('2d');
const sAtlasTex=new THREE.CanvasTexture(sAtlasCanvas);sAtlasTex.colorSpace=THREE.SRGBColorSpace;sAtlasTex.anisotropy=4;
const sCellMap=new Map();let sNext=0;

function sPoly(x,pts,fill,stroke,lw){
  x.beginPath();pts.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]));x.closePath();
  x.fillStyle=fill;x.fill();if(stroke){x.lineWidth=lw||6;x.strokeStyle=stroke;x.stroke();}
}
function sText(x,t,y,size,color){x.fillStyle=color;x.font='bold '+size+'px Arial,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(t,64,y);}
function sArrow(x,ang,len,col){
  x.save();x.translate(64,64);x.rotate(ang);x.strokeStyle=col;x.fillStyle=col;x.lineWidth=10;
  x.beginPath();x.moveTo(0,len*0.45);x.lineTo(0,-len*0.25);x.stroke();
  x.beginPath();x.moveTo(-15,-len*0.2);x.lineTo(15,-len*0.2);x.lineTo(0,-len*0.5);x.closePath();x.fill();x.restore();
}
function sPerson(x,cx,cy,s,col){
  x.strokeStyle=col;x.fillStyle=col;x.lineWidth=6*s;x.lineCap='round';
  x.beginPath();x.arc(cx,cy-30*s,8*s,0,7);x.fill();
  x.beginPath();x.moveTo(cx,cy-20*s);x.lineTo(cx,cy+8*s);x.moveTo(cx,cy+8*s);x.lineTo(cx-12*s,cy+30*s);
  x.moveTo(cx,cy+8*s);x.lineTo(cx+12*s,cy+30*s);x.moveTo(cx-14*s,cy-8*s);x.lineTo(cx+14*s,cy-4*s);x.stroke();
}
function drawSign(x,key){
  x.clearRect(0,0,128,128);
  const diamond=f=>sPoly(x,[[64,4],[124,64],[64,124],[4,64]],f,'#111',4);
  const square=()=>{x.fillStyle='#fff';x.fillRect(4,4,120,120);x.strokeStyle='#111';x.lineWidth=3;x.strokeRect(5,5,118,118);};
  if(key==='s'){
    const o=[];for(let i=0;i<8;i++){const a=Math.PI/8+i*Math.PI/4;o.push([64+60*Math.cos(a),64+60*Math.sin(a)]);}
    sPoly(x,o,'#c8102e','#fff',5);sText(x,'ARRÊT',66,30,'#fff');
  }else if(key==='a'){
    x.fillStyle='#c8102e';x.fillRect(2,2,124,124);x.strokeStyle='#fff';x.lineWidth=6;x.strokeRect(7,7,114,114);
    sText(x,'TOUTES',44,28,'#fff');sText(x,'DIRECTIONS',86,19,'#fff');
  }else if(key==='y'){
    sPoly(x,[[6,10],[122,10],[64,120]],'#fff','#c8102e',14);sText(x,'CÉDEZ',40,20,'#c8102e');
  }else if(key==='o'){
    x.fillStyle='#111';x.fillRect(2,34,124,60);x.strokeStyle='#fff';x.lineWidth=4;x.strokeRect(6,38,116,52);sArrow(x,Math.PI/2,96,'#fff');
  }else if(key==='x'){
    x.fillStyle='#c8102e';x.beginPath();x.arc(64,64,60,0,7);x.fill();x.fillStyle='#fff';x.fillRect(22,54,84,20);
  }else if(key==='t'){
    square();sArrow(x,-Math.PI/2,80,'#111');
    x.strokeStyle='#c8102e';x.lineWidth=10;x.beginPath();x.arc(64,64,50,0,7);x.stroke();
    x.beginPath();x.moveTo(29,29);x.lineTo(99,99);x.stroke();
  }else if(key==='p'){
    diamond('#c4e01a');sPerson(x,64,62,1,'#111');
    x.fillStyle='#111';for(let i=0;i<4;i++) x.fillRect(38+i*14,96,8,10);
  }else if(key==='e'){
    sPoly(x,[[64,4],[124,50],[124,124],[4,124],[4,50]],'#c4e01a','#111',4);
    sPerson(x,48,80,0.8,'#111');sPerson(x,80,84,0.7,'#111');
  }else if(key[0]==='v'){
    x.fillStyle='#fff';x.fillRect(14,4,100,120);x.strokeStyle='#111';x.lineWidth=4;x.strokeRect(18,8,92,112);
    sText(x,'MAXIMUM',26,15,'#111');sText(x,key.slice(1),70,50,'#111');sText(x,'km/h',108,16,'#111');
  }else if(key==='b'){
    diamond('#f5c400');x.strokeStyle='#111';x.lineWidth=8;
    x.beginPath();x.moveTo(26,84);x.lineTo(44,84);x.quadraticCurveTo(64,44,84,84);x.lineTo(102,84);x.stroke();
  }else if(key==='r'){
    diamond('#f5c400');x.strokeStyle='#111';x.lineWidth=8;
    x.beginPath();x.moveTo(24,84);x.quadraticCurveTo(44,56,64,84);x.quadraticCurveTo(84,56,104,84);x.stroke();
  }else if(key==='k'){
    diamond('#f5c400');sPerson(x,56,66,0.9,'#111');x.fillStyle='#111';x.beginPath();x.arc(84,88,9,0,7);x.fill();
  }else if(key==='w'){
    diamond('#f5c400');
    const o=[];for(let i=0;i<8;i++){const a=Math.PI/8+i*Math.PI/4;o.push([64+26*Math.cos(a),56+26*Math.sin(a)]);}
    sPoly(x,o,'#c8102e');x.fillStyle='#111';x.fillRect(60,86,8,20);
  }else if(key==='c'){
    square();x.fillStyle='#111';x.fillRect(56,40,16,76);x.fillStyle='#c8102e';x.fillRect(30,24,68,18);
  }else if(key[0]==='m'){
    square();x.strokeStyle='#0a8a3a';x.lineWidth=10;x.beginPath();x.arc(64,64,52,0,7);x.stroke();
    const A={m1:[0],m2:[Math.PI/2],m3:[-Math.PI/2],m4:[0,Math.PI/2],m5:[0,-Math.PI/2],m6:[-Math.PI/2,Math.PI/2]}[key]||[0];
    for(const a of A) sArrow(x,a,70,'#111');
  }else{
    square();sText(x,'?',64,60,'#111');
  }
}
function sUV(key){
  if(sCellMap.has(key)) return sCellMap.get(key);
  if(sNext>=SG*SG) return sUV('s');
  const i=sNext++,cx=i%SG,cy=Math.floor(i/SG);
  sAtlasCtx.save();sAtlasCtx.translate(cx*SCELL,cy*SCELL);drawSign(sAtlasCtx,key);sAtlasCtx.restore();
  sAtlasTex.needsUpdate=true;
  const uv=[cx/SG,1-(cy+1)/SG,(cx+1)/SG,1-cy/SG];
  sCellMap.set(key,uv);return uv;
}
function sQuad(A,cx,cy,cz,nx,nz,w,h,uv){
  const ax=nz,az=-nx,hw=w/2,hh=h/2;
  A.quad([[cx-ax*hw,cy-hh,cz-az*hw],[cx+ax*hw,cy-hh,cz+az*hw],[cx+ax*hw,cy+hh,cz+az*hw],[cx-ax*hw,cy+hh,cz-az*hw]],
    [nx,0,nz],null,[[uv[0],uv[1]],[uv[2],uv[1]],[uv[2],uv[3]],[uv[0],uv[3]]]);
}
function makeSignMaterials(){
  sMat=new THREE.MeshLambertMaterial({map:sAtlasTex,alphaTest:0.5,emissive:0xffffff,emissiveMap:sAtlasTex,emissiveIntensity:0});
  sBackMat=new THREE.MeshLambertMaterial({map:sAtlasTex,alphaTest:0.5});
  sBackMat.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb=vec3(0.5,0.52,0.54);');};
}

/* ---------- City sign data ---------- */
function addPole(lng,lat,types,osm){
  const [x,z]=toLocal(lng,lat);
  const ck=Math.floor(lng/SC)+','+Math.floor(lat/SC);
  if(!sCells.has(ck)) sCells.set(ck,[]);
  sCells.get(ck).push({x:x,z:z,lng:lng,lat:lat,types:types,osm:!!osm});
  if(!osm) cityCells.add(ck);
}
async function loadSignTile(k){
  sLoaded.add(k);
  try{
    const r=await fetch('signs/'+k+'.json');if(!r.ok) throw new Error('missing');
    const a=await r.json();
    const [tx,ty]=k.split('_').map(Number);
    for(const e of a) addPole(tx*ST+e[0]/1e5,ty*ST+e[1]/1e5,e[2].split('|'),false);
    sDone.add(k);
    sDirtyAll=true;updateSigns(true);
  }catch(err){sLoaded.delete(k);}
}
function signsLoadAround(lng,lat){
  if(!sIndex) return;
  const tx=Math.floor(lng/ST),ty=Math.floor(lat/ST),fx=lng-tx*ST,fy=lat-ty*ST;
  const xs=[0],ys=[0];
  if(fx<0.012)xs.push(-1); if(ST-fx<0.012)xs.push(1);
  if(fy<0.009)ys.push(-1); if(ST-fy<0.009)ys.push(1);
  for(const dx of xs)for(const dy of ys){const k=(tx+dx)+'_'+(ty+dy);if(sIndex.has(k)&&!sLoaded.has(k)) loadSignTile(k);}
  osmSignsAround(lng,lat);
}

/* ---------- OpenStreetMap backup: stop and yield signs where the city has no data ---------- */
function cityNear(lng,lat){
  const gx=Math.floor(lng/SC),gy=Math.floor(lat/SC);
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++) if(cityCells.has((gx+dx)+','+(gy+dy))) return true;
  return false;
}
function osmSignsAround(lng,lat){
  if(!sIndex) return;
  const tk=Math.floor(lng/ST)+'_'+Math.floor(lat/ST);
  if(sIndex.has(tk)&&!sDone.has(tk)) return;
  if(cityNear(lng,lat)) return;
  const tx=Math.floor(lng/OSM_T),ty=Math.floor(lat/OSM_T);
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
    const k=(tx+dx)+','+(ty+dy);
    if(oLoaded.has(k)) continue;
    oLoaded.add(k);oQueue.push([tx+dx,ty+dy]);
  }
  pumpOsm();
}
async function pumpOsm(){
  if(oBusy) return; oBusy=true;
  while(oQueue.length){const [tx,ty]=oQueue.shift();await fetchOsmSigns(tx,ty);}
  oBusy=false;
}
async function fetchOsmSigns(tx,ty){
  const key='os:'+tx+','+ty;
  let list=cacheGet(key);
  if(!list){
    const s=(ty*OSM_T).toFixed(4),w=(tx*OSM_T).toFixed(4),n=((ty+1)*OSM_T).toFixed(4),e=((tx+1)*OSM_T).toFixed(4);
    const q='[out:json][timeout:25];node["highway"~"^(stop|give_way)$"]('+s+','+w+','+n+','+e+');out;';
    for(const url of SERVERS){
      try{
        const r=await fetch(url+'?data='+encodeURIComponent(q));
        if(!r.ok) throw new Error('busy');
        const j=await r.json();
        list=j.elements.map(el=>{
          const tg=el.tags||{};
          const t=tg.highway==='stop'?(tg.stop==='all'?'s|a':'s'):'y';
          return [+el.lon.toFixed(6),+el.lat.toFixed(6),t];
        });
        cacheSet(key,list);
        break;
      }catch(err){}
    }
  }
  if(!list){oLoaded.delete(tx+','+ty);return;}
  let added=0;
  for(const it of list){
    const ck=Math.floor(it[0]/SC)+','+Math.floor(it[1]/SC);
    if(cityCells.has(ck)) continue;
    addPole(it[0],it[1],it[2].split('|'),true);added++;
  }
  if(added){sDirtyAll=true;updateSigns(true);}
}

/* ---------- Where each sign stands and which way it faces ---------- */
function cityPlacement(p,near){
  let best=null;
  for(const r of near){const b=closestOn(r,p.x,p.z,30);if(b&&(!best||b.d<best.d)) best=b;}
  if(!best) return {px:p.x,pz:p.z,nx:0,nz:1,tx:1,tz:0};
  const tx=best.tx,tz=best.tz,vx=p.x-best.px,vz=p.z-best.pz,s=-tz*vx+tx*vz;
  const fx=s>=0?tx:-tx,fz=s>=0?tz:-tz;
  return {px:p.x,pz:p.z,nx:-fx,nz:-fz,tx:tx,tz:tz};
}
/* All road crossings close to an OpenStreetMap stop dot, merged into one intersection */
function junctionCluster(p,near){
  const roads=near.filter(r=>closestOn(r,p.x,p.z,30));
  const J=[];
  for(let i=0;i<roads.length;i++)for(let j=0;j<roads.length;j++){
    if(i===j) continue;
    const q2=closestOn(roads[j],p.x,p.z,30); if(!q2) continue;
    const q1=closestOn(roads[i],q2.px,q2.pz,4); if(!q1) continue;
    const jx=(q1.px+q2.px)/2,jz=(q1.pz+q2.pz)/2;
    if(J.some(k=>Math.hypot(k[0]-jx,k[1]-jz)<3)) continue;
    J.push([jx,jz]);
  }
  return {roads:roads,J:J};
}
function osmPlacements(p,near){
  let ap=null;
  for(const r of near){const b=closestOn(r,p.x,p.z,20);if(b&&(!ap||b.d<ap.d)){ap=b;ap.road=r;}}
  if(!ap) return [{px:p.x,pz:p.z,nx:0,nz:1,tx:1,tz:0}];
  const cl=junctionCluster(p,near);
  const out=[];
  const placeBefore=(road,jx,jz,dsg,others)=>{
    const b=closestOn(road,jx,jz,6); if(!b) return;
    const s=b.s-7*dsg; if(s<0||s>road.L) return;
    const fx=b.tx*dsg,fz=b.tz*dsg;
    const bx=b.px-fx*7,bz=b.pz-fz*7;
    if(others.some(k=>Math.hypot(k[0]-bx,k[1]-bz)<14)) return;
    const rx=-fz,rz=fx,o=road.W/2+1.5;
    out.push({px:bx+rx*o,pz:bz+rz*o,nx:-fx,nz:-fz,tx:b.tx,tz:b.tz});
  };
  if(cl.J.length&&p.types.indexOf('a')>=0){
    for(const jp of cl.J){
      const others=cl.J.filter(k=>k!==jp);
      for(const r of cl.roads){
        const b=closestOn(r,jp[0],jp[1],5); if(!b) continue;
        for(const dsg of travelDirs(r,b,near)) placeBefore(r,jp[0],jp[1],dsg,others);
      }
    }
  }else if(cl.J.length){
    let J=null;
    for(const jp of cl.J){
      if(!closestOn(ap.road,jp[0],jp[1],5)) continue;
      const d=Math.hypot(jp[0]-ap.px,jp[1]-ap.pz);
      if(!J||d<J.d) J={x:jp[0],z:jp[1],d:d};
    }
    if(J){
      const dsg=((J.x-ap.px)*ap.tx+(J.z-ap.pz)*ap.tz)>=0?1:-1;
      if(J.d<5) placeBefore(ap.road,J.x,J.z,dsg,cl.J.filter(k=>Math.hypot(k[0]-J.x,k[1]-J.z)>3));
      else{
        const fx=ap.tx*dsg,fz=ap.tz*dsg,rx=-fz,rz=fx,o=ap.road.W/2+1.5;
        out.push({px:ap.px+rx*o,pz:ap.pz+rz*o,nx:-fx,nz:-fz,tx:ap.tx,tz:ap.tz});
      }
    }
  }
  if(!out.length){
    const toward=ap.s>ap.road.L/2?1:-1;
    const fx=ap.tx*toward,fz=ap.tz*toward,rx=-fz,rz=fx,o=ap.road.W/2+1.5;
    out.push({px:ap.px+rx*o,pz:ap.pz+rz*o,nx:-fx,nz:-fz,tx:ap.tx,tz:ap.tz});
  }
  return out;
}

/* ---------- Building the 3D signs ---------- */
function buildSignCell(ck){
  const [gx,gy]=ck.split(',').map(Number);
  const list=sCells.get(ck)||[];
  const near=[];
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
    const c2=lCells.get((gx+dx)+','+(gy+dy));
    if(c2) for(const r0 of c2.values()){const r=localRoad(r0);if(r) near.push(r);}
  }
  const front=lightAcc(false),backs=lightAcc(false),metal=lightAcc(true),names=lightAcc(false);
  const nameIdx=new Map(),nameList=[],nameQuads=[],placed=[];
  for(const p of list){
    const pls=p.osm?osmPlacements(p,near):[cityPlacement(p,near)];
    p.places=[];
    for(const pl of pls){
      if(p.osm){
        if(placed.some(q=>Math.hypot(q.px-pl.px,q.pz-pl.pz)<8&&(q.nx*pl.nx+q.nz*pl.nz)>0.8)) continue;
        placed.push(pl);
      }
      p.places.push([pl.px,pl.pz]);
      const regular=p.types.filter(t=>t.indexOf('n:')!==0);
      const nms=p.types.filter(t=>t.indexOf('n:')===0).map(t=>t.slice(2)).slice(0,2);
      let y=3.2;
      for(const t of regular){
        const sz=SSIZE[t[0]==='v'?'v':t]||SDEF,w=sz[0],h=sz[1];
        const cy=y-h/2,uv=sUV(t);
        sQuad(front,pl.px+pl.nx*0.06,cy,pl.pz+pl.nz*0.06,pl.nx,pl.nz,w,h,uv);
        sQuad(backs,pl.px+pl.nx*0.05,cy,pl.pz+pl.nz*0.05,-pl.nx,-pl.nz,w,h,uv);
        y-=h+0.08;
      }
      const poleH=nms.length?3.45+nms.length*0.32:3.2;
      metal.box(pl.px,pl.pz,1,0,0.09,0.09,0,poleH,SCOL.pole);
      nms.forEach((nm,i)=>{
        if(!nameIdx.has(nm)){if(nameList.length>=64) return;nameIdx.set(nm,nameList.length);nameList.push(nm);}
        const bnx=i%2?pl.tx:-pl.tz,bnz=i%2?pl.tz:pl.tx;
        nameQuads.push([pl.px,3.4+i*0.32,pl.pz,bnx,bnz,nameIdx.get(nm)]);
      });
    }
  }
  const group=new THREE.Group();
  const fg=lightGeom(front);
  if(fg){const m=new THREE.Mesh(fg,sMat);m.frustumCulled=false;m.castShadow=true;group.add(m);}
  const bg=lightGeom(backs);
  if(bg){const m=new THREE.Mesh(bg,sBackMat);m.frustumCulled=false;group.add(m);}
  const mg=lightGeom(metal);
  if(mg){const m=new THREE.Mesh(mg,lMatPole);m.frustumCulled=false;m.castShadow=true;group.add(m);}
  if(nameList.length){
    const n=nameList.length,cv=document.createElement('canvas');cv.width=512;cv.height=64*n;
    const x=cv.getContext('2d');
    nameList.forEach((nm,i)=>{
      x.fillStyle='#1f4e9a';x.fillRect(0,i*64,512,64);
      x.strokeStyle='#fff';x.lineWidth=3;x.strokeRect(4,i*64+4,504,56);
      x.fillStyle='#fff';x.font='bold 34px Arial,sans-serif';x.textAlign='center';x.textBaseline='middle';
      const wdt=x.measureText(nm).width,sc=Math.min(1,470/wdt);
      x.save();x.translate(256,i*64+33);x.scale(sc,1);x.fillText(nm,0,0);x.restore();
    });
    const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;
    for(const q of nameQuads){
      const r=q[5],uv=[0,1-(r+1)/n,1,1-r/n];
      sQuad(names,q[0],q[1],q[2],q[3],q[4],1.8,0.28,uv);
      sQuad(names,q[0],q[1],q[2],-q[3],-q[4],1.8,0.28,uv);
    }
    const ng=lightGeom(names);
    if(ng){
      const mat=new THREE.MeshLambertMaterial({map:tex,emissive:0xffffff,emissiveMap:tex,emissiveIntensity:0});
      const m=new THREE.Mesh(ng,mat);m.frustumCulled=false;m.userData.nameMat=true;group.add(m);
    }
  }
  return group;
}
function disposeSignGroup(g){
  g.traverse(o=>{
    if(o.geometry) o.geometry.dispose();
    if(o.userData&&o.userData.nameMat){o.material.map.dispose();o.material.dispose();}
  });
}
function signNight(){
  const nt=typeof nightNow==='number'?nightNow:0;
  if(sMat) sMat.emissiveIntensity=0.35*nt;
  for(const v of sMeshes.values()) v.traverse(o=>{if(o.userData&&o.userData.nameMat) o.material.emissiveIntensity=0.35*nt;});
}
function roadsAround(ck){
  const [gx,gy]=ck.split(',').map(Number);let n=0;
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const c2=lCells.get((gx+dx)+','+(gy+dy));if(c2) n+=c2.size;}
  return n;
}
function updateSigns(force){
  if(sFailed||!treeScene||typeof lightAcc!=='function') return;
  const now=performance.now();
  if(!force&&now-sLast<900) return;
  sLast=now;
  try{
    if(!sMat) makeSignMaterials();
    if(!lMatPole) return;
    const zoomOk=map.getZoom()>=15.5;
    for(const g of sMeshes.values()) g.visible=zoomOk;
    if(!zoomOk){map.triggerRepaint();return;}
    const c=map.getCenter(),cx=Math.floor(c.lng/SC),cy=Math.floor(c.lat/SC);
    signsLoadAround(c.lng,c.lat);
    for(const [ck,g] of sMeshes){
      const [x,y]=ck.split(',').map(Number);
      if(sDirtyAll||Math.abs(x-cx)>1||Math.abs(y-cy)>1||g.userData.roads!==roadsAround(ck)){
        treeScene.remove(g);disposeSignGroup(g);sMeshes.delete(ck);
      }
    }
    sDirtyAll=false;
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
      const ck=(cx+dx)+','+(cy+dy);
      if(sMeshes.has(ck)||!sCells.has(ck)) continue;
      const g=buildSignCell(ck);g.userData.roads=roadsAround(ck);
      treeScene.add(g);sMeshes.set(ck,g);
    }
    signNight();
    map.triggerRepaint();
  }catch(e){
    sFailed=true;console.warn('Signs failed',e);
    for(const g of sMeshes.values()) treeScene.remove(g);
  }
}

/* ---------- Alerts ---------- */
const alertBox=document.createElement('div');
alertBox.style.cssText='position:absolute;top:16px;left:50%;transform:translate(-50%,-20px);opacity:0;display:flex;align-items:center;gap:14px;'+
  'background:rgba(10,18,32,.92);color:#e8f1fa;font-family:sans-serif;border-radius:16px;padding:10px 20px 10px 10px;transition:opacity .35s,transform .35s;pointer-events:none;z-index:5';
const alertCv=document.createElement('canvas');alertCv.width=alertCv.height=72;
const alertTxt=document.createElement('div');alertTxt.style.cssText='font-size:20px;line-height:1.3';
alertBox.appendChild(alertCv);alertBox.appendChild(alertTxt);document.body.appendChild(alertBox);
const limitBox=document.createElement('div');
limitBox.style.cssText='position:absolute;bottom:24px;left:180px;display:none;background:#fff;color:#111;font-family:sans-serif;'+
  'border:3px solid #111;border-radius:10px;padding:4px 12px;text-align:center;z-index:4';
document.body.appendChild(limitBox);

let actx=null,sWatch=null,carPos=null,carSpeed=0,curLimit=null,curAlert=null,alertTimer=null;
const alerted=new Map();
function chime(){
  try{
    if(!actx) actx=new (window.AudioContext||window.webkitAudioContext)();
    const t=actx.currentTime;
    [880,660].forEach((f,i)=>{
      const o=actx.createOscillator(),g=actx.createGain(),t0=t+i*0.18;
      o.type='sine';o.frequency.value=f;
      g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(0.18,t0+0.02);g.gain.exponentialRampToValueAtTime(0.001,t0+0.35);
      o.connect(g);g.connect(actx.destination);o.start(t0);o.stop(t0+0.4);
    });
  }catch(e){}
}
function showAlert(a){
  curAlert=a;
  const x=alertCv.getContext('2d');x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,72,72);x.scale(72/128,72/128);drawSign(x,a.kind);
  alertTxt.innerHTML='<b>'+a.label+'</b><br>in '+Math.max(10,Math.round(a.fwd/10)*10)+' m';
  alertBox.style.opacity='1';alertBox.style.transform='translate(-50%,0)';
  chime();
  clearTimeout(alertTimer);alertTimer=setTimeout(hideAlert,10000);
}
function hideAlert(){curAlert=null;alertBox.style.opacity='0';alertBox.style.transform='translate(-50%,-20px)';}
function updateLimitBox(){
  if(curLimit===null){limitBox.style.display='none';return;}
  const over=carSpeed*3.6>curLimit+3;
  limitBox.style.display='block';
  limitBox.style.borderColor=over?'#c8102e':'#111';
  limitBox.innerHTML='<div style="font-size:11px;font-weight:bold">MAXIMUM</div><div style="font-size:30px;font-weight:bold;color:'+(over?'#c8102e':'#111')+'">'+curLimit+'</div><div style="font-size:11px">km/h</div>';
}
function checkAlerts(){
  if(!carPos) return;
  const [cx,cz]=toLocal(carPos[0],carPos[1]);
  const h=(typeof heading==='number'?heading:0)*R,fx=Math.sin(h),fz=-Math.cos(h),rx=-fz,rz=fx;
  const reach=Math.max(70,carSpeed*7);
  const gx=Math.floor(carPos[0]/SC),gy=Math.floor(carPos[1]/SC);
  let best=null;
  for(const [k,v] of alerted){if(Math.hypot(v.x-cx,v.z-cz)>250) alerted.delete(k);}
  const recentSame=(kind,x,z)=>{for(const v of alerted.values()){if(v.kind===kind&&Math.hypot(v.x-x,v.z-z)<60) return true;}return false;};
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
    const list=sCells.get((gx+dx)+','+(gy+dy));if(!list) continue;
    for(const p of list){
      const places=p.places&&p.places.length?p.places:[[p.x,p.z]];
      for(const pl of places){
        const sx=pl[0],sz=pl[1];
        const vx=sx-cx,vz=sz-cz,fwd=vx*fx+vz*fz,lat=vx*rx+vz*rz;
        if(lat<-4||lat>16) continue;
        const sp=p.types.find(t=>t[0]==='v');
        if(sp&&fwd<3&&fwd>-15) curLimit=+sp.slice(1);
        if(fwd<5||fwd>reach||Math.abs(Math.atan2(lat,fwd))>0.6) continue;
        const key=sx.toFixed(1)+','+sz.toFixed(1);
        for(const t of p.types){
          let label=ALERT_LABELS[t]||null;
          if(!label&&t[0]==='v'&&+t.slice(1)!==curLimit) label='Speed limit '+t.slice(1)+' km/h';
          if(!label) continue;
          const kind=t[0]==='v'?'v':t;
          if(alerted.has(key+t)||recentSame(kind,sx,sz)) continue;
          if(!best||fwd<best.fwd) best={fwd:fwd,kind:t,group:kind,label:label,key:key+t,x:sx,z:sz};
        }
      }
    }
  }
  updateLimitBox();
  if(best&&(!curAlert||best.fwd<curAlert.fwd-20)){alerted.set(best.key,{x:best.x,z:best.z,kind:best.group});showAlert(best);}
  else if(curAlert){
    const vx=curAlert.x-cx,vz=curAlert.z-cz,fwd=vx*fx+vz*fz;
    if(fwd<0||fwd>reach*1.6) hideAlert();
    else alertTxt.innerHTML='<b>'+curAlert.label+'</b><br>in '+Math.max(10,Math.round(fwd/10)*10)+' m';
  }
}
function startSignWatch(){
  if(sWatch!==null) return;
  sWatch=navigator.geolocation.watchPosition(p=>{
    carPos=[p.coords.longitude,p.coords.latitude];carSpeed=p.coords.speed||0;
    signsLoadAround(carPos[0],carPos[1]);checkAlerts();
  },()=>{},{enableHighAccuracy:true,maximumAge:0,timeout:15000});
}
btn.addEventListener('click',()=>{
  try{if(!actx) actx=new (window.AudioContext||window.webkitAudioContext)();if(actx.state==='suspended') actx.resume();}catch(e){}
  startSignWatch();
});

map.on('load',()=>{
  for(const l of map.getStyle().layers){
    if(l.type==='symbol'&&/shield/i.test(l.id)){try{map.setLayerZoomRange(l.id,l.minzoom||0,16.5);}catch(e){}}
  }
  fetch('signs/index.json').then(r=>r.ok?r.json():null).then(j=>{
    sIndex=new Set(j?j.tiles:[]);
    const c=map.getCenter();signsLoadAround(c.lng,c.lat);
  }).catch(()=>{sIndex=new Set();});
  map.on('idle',()=>updateSigns(false));
  map.on('moveend',()=>updateSigns(true));
  setInterval(signNight,30000);
});
