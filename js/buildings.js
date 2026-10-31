/* TessyNav buildings v3: smart styles, windows, shadows, lit windows, fixed roof facing */
const BC=0.005;
const bCells=new Map(),bMeshes=new Map(),bDirty=new Set();
const bNight={value:0};
let bMat=null,bReady=false,bFailed=false,bThreeOn=false,bLast=0,bAmb=null;

const PAL={
  plex:['#9c4a35','#8a4a3a','#b0624a','#7d5a48','#a8876a','#c2b39a','#94503c'],
  house:['#d8d2c4','#c9b99a','#b9c2c8','#e1dccf','#a8573f','#c8c0b0'],
  shop:['#cbbfae','#b8a48c','#d6d0c4','#9e8e7e','#c4b6a0'],
  tower:['#7f8f9c','#8a99a6','#6f7f8c','#9aa6ae'],
  industry:['#a3a7ab','#8e9499','#b5b1a6']
};
const ROOF={flat:'#a29e96',tower:'#6e7276',house:['#4a4a4f','#5a4a42','#3f4448','#6b4e3d']};
const KIND={plex:0,shop:1,tower:2,industry:3,house:4};

function makeBuildingMaterial(){
  const m=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
  m.onBeforeCompile=sh=>{
    sh.uniforms.uNight=bNight;
    sh.vertexShader='attribute float top;\nattribute float seed;\nattribute float kind;\nvarying vec3 vWPos;\nvarying vec3 vWN;\nvarying float vTop;\nvarying float vSeed;\nvarying float vKind;\n'+
      sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWPos=position;\nvWN=normal;\nvTop=top;\nvSeed=seed;\nvKind=kind;');
    sh.fragmentShader='uniform float uNight;\nvarying vec3 vWPos;\nvarying vec3 vWN;\nvarying float vTop;\nvarying float vSeed;\nvarying float vKind;\n'+
      sh.fragmentShader
      .replace('#include <color_fragment>',[
        '#include <color_fragment>',
        'float isWall=1.0-step(0.5,abs(vWN.y));',
        'vec2 tg=vec2(-vWN.z,vWN.x);',
        'float uu=dot(vWPos.xz,tg);',
        'float yy=vWPos.y;',
        'int kk=int(vKind+0.5);',
        'float colW=2.8,flH=3.0,wx0=0.28,wx1=0.72,wy0=0.3,wy1=0.78,litP=0.45;',
        'vec3 glass=vec3(0.16,0.2,0.27);',
        'vec3 litCol=vec3(1.0,0.75,0.42);',
        'if(kk==2){colW=1.6;flH=3.4;wx0=0.08;wx1=0.92;wy0=0.15;wy1=0.85;glass=vec3(0.30,0.40,0.50);litP=0.5;litCol=vec3(0.95,0.92,0.8);}',
        'else if(kk==4){colW=3.4;flH=2.8;wx0=0.3;wx1=0.7;wy0=0.35;wy1=0.8;litP=0.4;}',
        'float wx=fract(uu/colW);',
        'float wy=fract(yy/flH);',
        'float win=step(wx0,wx)*step(wx,wx1)*step(wy0,wy)*step(wy,wy1)*isWall*step(1.0,yy)*step(yy,vTop-0.6);',
        'if(kk==3){win=step(0.1,fract(uu/4.0))*step(fract(uu/4.0),0.9)*step(vTop-2.6,yy)*step(yy,vTop-1.3)*isWall;litP=0.2;}',
        'if(kk==1&&yy<3.6){float sx=fract(uu/4.0);win=step(0.06,sx)*step(sx,0.94)*step(0.35,yy)*step(yy,3.0)*isWall;glass=vec3(0.22,0.28,0.32);litP=0.85;litCol=vec3(1.0,0.88,0.65);}',
        'diffuseColor.rgb=mix(diffuseColor.rgb,glass,win*0.88);',
        'float hh=fract(sin(dot(vec3(floor(uu/colW),floor(yy/flH),vSeed),vec3(12.9898,78.233,37.719)))*43758.5453);',
        'float lit=win*step(1.0-litP,hh)*uNight;'
      ].join('\n'))
      .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=lit*litCol*1.3;');
  };
  return m;
}

/* Neighborhood type (commercial, retail, industrial) around each building */
function getLanduse(){
  const out=[];
  for(const f of map.querySourceFeatures('openmaptiles',{sourceLayer:'landuse'})){
    const cl=f.properties&&f.properties.class;
    if(cl!=='commercial'&&cl!=='retail'&&cl!=='industrial') continue;
    const g=f.geometry;
    const polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
    for(const poly of polys){
      const rg=poly[0];if(!rg||rg.length<4) continue;
      let minX=180,minY=90,maxX=-180,maxY=-90;
      for(const p of rg){minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);}
      out.push({cl:cl,rg:rg,minX:minX,minY:minY,maxX:maxX,maxY:maxY});
    }
  }
  return out;
}
function landuseAt(lng,lat,lus){
  for(const l of lus){
    if(lng<l.minX||lng>l.maxX||lat<l.minY||lat>l.maxY) continue;
    if(inside([lng,lat],l.rg)) return l.cl;
  }
  return '';
}

function classify(poly,h,lng,lat,colour,s,getLus){
  const o=poly[0].map(p=>toLocal(p[0],p[1]));
  let A=0;for(let i=0;i<o.length-1;i++)A+=o[i][0]*o[i+1][1]-o[i+1][0]*o[i][1];
  const area=Math.abs(A)/2;
  const lu=landuseAt(lng,lat,getLus());
  let type='plex';
  if(h>=25) type='tower';
  else if(lu==='industrial') type='industry';
  else if(lu==='commercial'||lu==='retail') type='shop';
  else if(h<=9.5&&area<260) type='house';
  const pick=arr=>arr[Math.floor(s)%arr.length];
  const wall=(colour&&/^#[0-9a-f]{6}$/i.test(colour))?colour:pick(PAL[type]);
  const roof=type==='house'?pick(ROOF.house):type==='tower'?ROOF.tower:ROOF.flat;
  return {kind:KIND[type],type:type,wall:new THREE.Color(wall),roof:new THREE.Color(roof)};
}

function collectBuildings(cx,cy){
  const feats=map.querySourceFeatures('openmaptiles',{sourceLayer:'building'});
  let lus=null;const getLus=()=>lus||(lus=getLanduse());
  for(const f of feats){
    const pr=f.properties||{};
    if(pr.hide_3d) continue;
    const h=Math.max(3,+pr.render_height||8),b0=Math.max(0,+pr.render_min_height||0);
    if(h<=b0) continue;
    const g=f.geometry;
    const polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
    for(const poly of polys){
      const o=poly[0]; if(!o||o.length<4) continue;
      let sx=0,sy=0; for(const p of o){sx+=p[0];sy+=p[1];}
      const clng=sx/o.length,clat=sy/o.length;
      const gx=Math.floor(clng/BC),gy=Math.floor(clat/BC);
      if(Math.abs(gx-cx)>2||Math.abs(gy-cy)>2) continue;
      const ck=gx+','+gy;
      const key=o.length+'|'+o[0][0].toFixed(6)+','+o[0][1].toFixed(6)+'|'+o[1][0].toFixed(6)+','+o[1][1].toFixed(6)+'|'+h+'|'+b0;
      let cell=bCells.get(ck); if(!cell){cell=new Map();bCells.set(ck,cell);}
      if(cell.has(key)) continue;
      const s=Math.random()*100;
      const st=classify(poly,h,clng,clat,pr.colour,s,getLus);
      cell.set(key,{rings:poly,h:h,b:b0,s:s,kind:st.kind,type:st.type,wall:st.wall,roof:st.roof});
      bDirty.add(ck);
    }
  }
}

function buildBuildingMesh(cell){
  const pos=[],nor=[],col=[],top=[],seed=[],kind=[],idx=[];let base=0;
  function vtx(x,y,z,nx,ny,nz,c,t,s,k){pos.push(x,y,z);nor.push(nx,ny,nz);col.push(c.r,c.g,c.b);top.push(t);seed.push(s);kind.push(k);}
  function face(vs,c,t,s,k,ref){
    const a=vs[0],b=vs[1],d=vs[2];
    let nx=(b[1]-a[1])*(d[2]-a[2])-(b[2]-a[2])*(d[1]-a[1]);
    let ny=(b[2]-a[2])*(d[0]-a[0])-(b[0]-a[0])*(d[2]-a[2]);
    let nz=(b[0]-a[0])*(d[1]-a[1])-(b[1]-a[1])*(d[0]-a[0]);
    const ln=Math.hypot(nx,ny,nz)||1;nx/=ln;ny/=ln;nz/=ln;
    if(nx*ref[0]+ny*ref[1]+nz*ref[2]<0){nx=-nx;ny=-ny;nz=-nz;}
    for(const v of vs) vtx(v[0],v[1],v[2],nx,ny,nz,c,t,s,k);
    idx.push(base,base+1,base+2); if(vs.length===4) idx.push(base,base+2,base+3);
    base+=vs.length;
  }
  function walls(rings,b0,H,c,s,k){
    rings.forEach((pts,ri)=>{
      let A=0;for(let i=0;i<pts.length-1;i++)A+=pts[i][0]*pts[i+1][1]-pts[i+1][0]*pts[i][1];
      const sg=(A>0?1:-1)*(ri===0?1:-1);
      for(let i=0;i<pts.length-1;i++){
        const a=pts[i],q=pts[i+1],dx=q[0]-a[0],dz=q[1]-a[1],len=Math.hypot(dx,dz);
        if(len<0.05) continue;
        const nx=sg*dz/len,nz=-sg*dx/len;
        vtx(a[0],b0,a[1],nx,0,nz,c,H,s,k);vtx(q[0],b0,q[1],nx,0,nz,c,H,s,k);
        vtx(q[0],H,q[1],nx,0,nz,c,H,s,k);vtx(a[0],H,a[1],nx,0,nz,c,H,s,k);
        idx.push(base,base+1,base+2,base,base+2,base+3);base+=4;
      }
    });
  }
  function flatRoof(rings,H,c,s,k){
    try{
      const toV=r=>r.slice(0,r.length-1).map(p=>new THREE.Vector2(p[0],p[1]));
      const contour=toV(rings[0]),holes=rings.slice(1).map(toV);
      const tris=THREE.ShapeUtils.triangulateShape(contour,holes);
      const all=contour.concat(...holes);
      for(const p of all) vtx(p.x,H,p.y,0,1,0,c,H,s,k);
      for(const t of tris) idx.push(base+t[0],base+t[1],base+t[2]);
      base+=all.length;
    }catch(e){}
  }
  for(const rec of cell.values()){
    const rings=rec.rings.map(r=>r.map(p=>toLocal(p[0],p[1])));
    const s=rec.s,k=rec.kind;
    const canGable=rec.type==='house'&&rings.length===1&&rings[0].length===5;
    if(canGable){
      const L=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
      let p=rings[0].slice(0,4);
      if(L(p[0],p[1])+L(p[2],p[3])<L(p[1],p[2])+L(p[3],p[0])) p=[p[1],p[2],p[3],p[0]];
      const short=Math.min(L(p[1],p[2]),L(p[3],p[0]));
      const roofH=Math.max(1,Math.min(3.5,rec.h*0.35,short*0.45));
      const eave=rec.h-roofH,ridge=rec.h;
      walls(rings,rec.b,eave,rec.wall,s,k);
      const m12=[(p[1][0]+p[2][0])/2,(p[1][1]+p[2][1])/2],m30=[(p[3][0]+p[0][0])/2,(p[3][1]+p[0][1])/2];
      const cxl=(p[0][0]+p[1][0]+p[2][0]+p[3][0])/4,czl=(p[0][1]+p[1][1]+p[2][1]+p[3][1])/4;
      face([[p[1][0],eave,p[1][1]],[p[2][0],eave,p[2][1]],[m12[0],ridge,m12[1]]],rec.wall,eave,s,k,[m12[0]-cxl,0,m12[1]-czl]);
      face([[p[3][0],eave,p[3][1]],[p[0][0],eave,p[0][1]],[m30[0],ridge,m30[1]]],rec.wall,eave,s,k,[m30[0]-cxl,0,m30[1]-czl]);
      face([[p[0][0],eave,p[0][1]],[p[1][0],eave,p[1][1]],[m12[0],ridge,m12[1]],[m30[0],ridge,m30[1]]],rec.roof,eave,s,k,[0,1,0]);
      face([[p[2][0],eave,p[2][1]],[p[3][0],eave,p[3][1]],[m30[0],ridge,m30[1]],[m12[0],ridge,m12[1]]],rec.roof,eave,s,k,[0,1,0]);
    }else{
      walls(rings,rec.b,rec.h,rec.wall,s,k);
      flatRoof(rings,rec.h,rec.roof,s,k);
    }
  }
  if(!pos.length) return null;
  /* Make every triangle face the same way as its normal (fixes black roofs) */
  for(let i=0;i<idx.length;i+=3){
    const a=idx[i]*3,b=idx[i+1]*3,c=idx[i+2]*3;
    const ux=pos[b]-pos[a],uy=pos[b+1]-pos[a+1],uz=pos[b+2]-pos[a+2];
    const vx=pos[c]-pos[a],vy=pos[c+1]-pos[a+1],vz=pos[c+2]-pos[a+2];
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    if(nx*nor[a]+ny*nor[a+1]+nz*nor[a+2]<0){const t=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=t;}
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  g.setAttribute('top',new THREE.Float32BufferAttribute(top,1));
  g.setAttribute('seed',new THREE.Float32BufferAttribute(seed,1));
  g.setAttribute('kind',new THREE.Float32BufferAttribute(kind,1));
  g.setIndex(idx);
  const mesh=new THREE.Mesh(g,bMat);
  mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;
  return mesh;
}

function setThreeMode(on){
  if(on===bThreeOn) return;
  bThreeOn=on;
  for(const m of bMeshes.values()) m.visible=on;
  for(const id of ['building-3d','roofs']) if(map.getLayer(id)) map.setLayoutProperty(id,'visibility',on?'none':'visible');
  map.triggerRepaint();
}

function updateBuildings(force){
  if(bFailed||!treeScene) return;
  const now=performance.now();
  if(!force&&now-bLast<800) return;
  bLast=now;
  try{
    if(!bMat) bMat=makeBuildingMaterial();
    if(!bAmb){bAmb=new THREE.AmbientLight(0x8a9ac0,0);treeScene.add(bAmb);}
    const c=map.getCenter(),cx=Math.floor(c.lng/BC),cy=Math.floor(c.lat/BC);
    const s=sunPos(nowForSun(),c.lat,c.lng);
    bNight.value=Math.min(1,Math.max(0,(6-s.alt/R)/12));
    bAmb.intensity=0.6*bNight.value;
    if(map.getZoom()<15.5){setThreeMode(false);return;}
    collectBuildings(cx,cy);
    for(const [ck,mesh] of bMeshes){
      const [x,y]=ck.split(',').map(Number);
      if(Math.abs(x-cx)>2||Math.abs(y-cy)>2){treeScene.remove(mesh);mesh.geometry.dispose();bMeshes.delete(ck);}
    }
    for(const ck of [...bCells.keys()]){
      const [x,y]=ck.split(',').map(Number);
      if(Math.abs(x-cx)>3||Math.abs(y-cy)>3){bCells.delete(ck);bDirty.delete(ck);}
    }
    let built=false;
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
      const ck=(cx+dx)+','+(cy+dy),cell=bCells.get(ck);
      if(!cell) continue;
      if(bMeshes.has(ck)&&!bDirty.has(ck)) continue;
      const old=bMeshes.get(ck);
      if(old){treeScene.remove(old);old.geometry.dispose();bMeshes.delete(ck);}
      const mesh=buildBuildingMesh(cell);
      if(mesh){mesh.visible=bThreeOn||!bReady;treeScene.add(mesh);bMeshes.set(ck,mesh);built=true;}
      bDirty.delete(ck);
    }
    if(built&&!bReady) bReady=true;
    if(bReady) setThreeMode(true);
    map.triggerRepaint();
  }catch(e){
    bFailed=true;console.warn('3D buildings failed',e);
    for(const m of bMeshes.values()) treeScene.remove(m);
    for(const id of ['building-3d','roofs']) if(map.getLayer(id)) map.setLayoutProperty(id,'visibility','visible');
  }
}

map.on('load',()=>{
  updateBuildings(true);
  map.on('idle',()=>updateBuildings(false));
  map.on('moveend',()=>updateBuildings(true));
  setInterval(()=>updateBuildings(true),30000);
});
