/* TessyNav buildings: real 3D buildings with windows, shadows and lit windows at night */
const BC=0.005;
const bCells=new Map(),bMeshes=new Map(),bDirty=new Set();
const bNight={value:0};
let bMat=null,bReady=false,bFailed=false,bThreeOn=false,bLast=0;
const B_COLORS=[[0,'#e3d5c1'],[10,'#d9c7b0'],[20,'#cfd3d6'],[60,'#b9c3cc']];
const bRoofCol=new THREE.Color('#8f8b84');
function bColor(h){let c=B_COLORS[0][1];for(const [k,v] of B_COLORS) if(h>=k) c=v;return new THREE.Color(c);}

function makeBuildingMaterial(){
  const m=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
  m.onBeforeCompile=sh=>{
    sh.uniforms.uNight=bNight;
    sh.vertexShader='attribute float top;\nattribute float seed;\nvarying vec3 vWPos;\nvarying vec3 vWN;\nvarying float vTop;\nvarying float vSeed;\n'+
      sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWPos=position;\nvWN=normal;\nvTop=top;\nvSeed=seed;');
    sh.fragmentShader='uniform float uNight;\nvarying vec3 vWPos;\nvarying vec3 vWN;\nvarying float vTop;\nvarying float vSeed;\n'+
      sh.fragmentShader
      .replace('#include <color_fragment>',[
        '#include <color_fragment>',
        'float isWall=1.0-step(0.5,abs(vWN.y));',
        'vec2 tg=vec2(-vWN.z,vWN.x);',
        'float uu=dot(vWPos.xz,tg);',
        'float wx=fract(uu/2.8);',
        'float wy=fract(vWPos.y/3.0);',
        'float win=step(0.28,wx)*step(wx,0.72)*step(0.3,wy)*step(wy,0.78)*isWall*step(1.0,vWPos.y)*step(vWPos.y,vTop-0.6);',
        'diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.16,0.2,0.27),win*0.85);',
        'float hh=fract(sin(dot(vec3(floor(uu/2.8),floor(vWPos.y/3.0),vSeed),vec3(12.9898,78.233,37.719)))*43758.5453);',
        'float lit=win*step(0.55,hh)*uNight;'
      ].join('\n'))
      .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=lit*vec3(1.0,0.75,0.42)*1.3;');
  };
  return m;
}

function collectBuildings(cx,cy){
  const feats=map.querySourceFeatures('openmaptiles',{sourceLayer:'building'});
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
      const gx=Math.floor(sx/o.length/BC),gy=Math.floor(sy/o.length/BC);
      if(Math.abs(gx-cx)>2||Math.abs(gy-cy)>2) continue;
      const ck=gx+','+gy;
      const key=o.length+'|'+o[0][0].toFixed(6)+','+o[0][1].toFixed(6)+'|'+o[1][0].toFixed(6)+','+o[1][1].toFixed(6)+'|'+h+'|'+b0;
      let cell=bCells.get(ck); if(!cell){cell=new Map();bCells.set(ck,cell);}
      if(!cell.has(key)){cell.set(key,{rings:poly,h:h,b:b0,s:Math.random()*100});bDirty.add(ck);}
    }
  }
}

function buildBuildingMesh(cell){
  const pos=[],nor=[],col=[],top=[],seed=[],idx=[];let base=0;
  function vtx(x,y,z,nx,ny,nz,c,t,s){pos.push(x,y,z);nor.push(nx,ny,nz);col.push(c.r,c.g,c.b);top.push(t);seed.push(s);}
  for(const rec of cell.values()){
    const h=rec.h,b0=rec.b,c=bColor(h),s=rec.s;
    const rings=rec.rings.map(r=>r.map(p=>toLocal(p[0],p[1])));
    rings.forEach((pts,ri)=>{
      let A=0;for(let i=0;i<pts.length-1;i++)A+=pts[i][0]*pts[i+1][1]-pts[i+1][0]*pts[i][1];
      const sg=(A>0?1:-1)*(ri===0?1:-1);
      for(let i=0;i<pts.length-1;i++){
        const a=pts[i],q=pts[i+1],dx=q[0]-a[0],dz=q[1]-a[1],len=Math.hypot(dx,dz);
        if(len<0.05) continue;
        const nx=sg*dz/len,nz=-sg*dx/len;
        vtx(a[0],b0,a[1],nx,0,nz,c,h,s);vtx(q[0],b0,q[1],nx,0,nz,c,h,s);
        vtx(q[0],h,q[1],nx,0,nz,c,h,s);vtx(a[0],h,a[1],nx,0,nz,c,h,s);
        idx.push(base,base+1,base+2,base,base+2,base+3);base+=4;
      }
    });
    try{
      const toV=r=>r.slice(0,r.length-1).map(p=>new THREE.Vector2(p[0],p[1]));
      const contour=toV(rings[0]),holes=rings.slice(1).map(toV);
      const tris=THREE.ShapeUtils.triangulateShape(contour,holes);
      const all=contour.concat(...holes);
      for(const p of all) vtx(p.x,h,p.y,0,1,0,bRoofCol,h,s);
      for(const t of tris) idx.push(base+t[0],base+t[1],base+t[2]);
      base+=all.length;
    }catch(e){}
  }
  if(!pos.length) return null;
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  g.setAttribute('top',new THREE.Float32BufferAttribute(top,1));
  g.setAttribute('seed',new THREE.Float32BufferAttribute(seed,1));
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
    const c=map.getCenter(),cx=Math.floor(c.lng/BC),cy=Math.floor(c.lat/BC);
    const s=sunPos(nowForSun(),c.lat,c.lng);
    bNight.value=Math.min(1,Math.max(0,(6-s.alt/R)/12));
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
