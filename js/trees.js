/* TessyNav trees: smooth 3D trees, shadows, tree data */
let treeCount=0,treesFailed=false,treeScene=null,treeMat=null;
const C=0.005;
const buckets=new Map(),cellMeshes=new Map(),dirty=new Set(),occ=new Set(),doneAreas=new Set();
const leafCols=['#5b7f3a','#4f7334','#6a8a42','#7d8a3a','#b9772f','#a8552a'].map(c=>new THREE.Color(c));
const trunkCol=new THREE.Color('#5a4030');
const trunkGeo=new THREE.CylinderGeometry(0.18,0.28,3.2,6);
const ballGeo=new THREE.SphereGeometry(1,9,6);

const treeLayer={
  id:'trees3d',type:'custom',renderingMode:'3d',
  onAdd(m,gl){
    try{
      this.camera=new THREE.Camera();
      this.scene=new THREE.Scene();treeScene=this.scene;
      hemiLight=new THREE.HemisphereLight(0xdfeeff,0x4a5a3a,1.2);this.scene.add(hemiLight);
      sunLight=new THREE.DirectionalLight(0xfff4e4,3.0);
      sunLight.castShadow=true;
      sunLight.shadow.mapSize.set(2048,2048);
      const sc=sunLight.shadow.camera;sc.left=-250;sc.right=250;sc.top=250;sc.bottom=-250;sc.near=1;sc.far=900;
      sunLight.shadow.bias=-0.0008;
      this.scene.add(sunLight);this.scene.add(sunLight.target);
      shadowPlane=new THREE.Mesh(new THREE.PlaneGeometry(700,700),new THREE.ShadowMaterial({opacity:0.32,depthWrite:false}));
      shadowPlane.rotation.x=-Math.PI/2;shadowPlane.position.y=0.15;shadowPlane.receiveShadow=true;
      this.scene.add(shadowPlane);
      treeMat=new THREE.MeshLambertMaterial({vertexColors:true});
      this.renderer=new THREE.WebGLRenderer({canvas:m.getCanvas(),context:gl,antialias:true});
      this.renderer.autoClear=false;
      this.renderer.shadowMap.enabled=true;
      this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      const mc=maplibregl.MercatorCoordinate.fromLngLat(ORIGIN,0),msc=mc.meterInMercatorCoordinateUnits();
      this.model=new THREE.Matrix4().makeTranslation(mc.x,mc.y,mc.z).scale(new THREE.Vector3(msc,-msc,msc)).multiply(new THREE.Matrix4().makeRotationX(Math.PI/2));
    }catch(e){treesFailed=true;treesEl.textContent='3D trees error: '+e.message;}
  },
  render(gl,matrix){
    if(treesFailed) return;
    try{
      const c=map.getCenter(),[cx,cz]=toLocal(c.lng,c.lat);
      const useShadows=shadowsOn&&sunUp;
      sunLight.target.position.set(cx,0,cz);sunLight.target.updateMatrixWorld();
      sunLight.position.set(cx+sunDir.x*400,sunDir.y*400,cz+sunDir.z*400);
      shadowPlane.position.x=cx;shadowPlane.position.z=cz;
      shadowPlane.visible=useShadows;
      this.renderer.shadowMap.autoUpdate=useShadows;
      this.camera.projectionMatrix=new THREE.Matrix4().fromArray(matrix).multiply(this.model);
      this.renderer.resetState();
      this.renderer.setViewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight);
      this.renderer.render(this.scene,this.camera);
    }catch(e){treesFailed=true;treesEl.textContent='3D trees error: '+e.message;}
  }
};

function addTree(seed,lng,lat,size){
  if(treesFailed) return false;
  const k=Math.round(lng*9000)+','+Math.round(lat*12000);
  if(occ.has(k)) return false; occ.add(k);
  const ck=Math.floor(lng/C)+','+Math.floor(lat/C);
  let b=buckets.get(ck); if(!b){b=[];buckets.set(ck,b);}
  const [x,z]=toLocal(lng,lat);
  b.push({x:x,z:z,s:size||(0.8+Math.random()*0.45),col:leafCols[Math.abs(seed)%leafCols.length],jx:Math.random()-.5,jz:Math.random()-.5});
  dirty.add(ck); treeCount++; return true;
}

function buildMesh(list){
  const pos=[],nor=[],col=[],idx=[];let base=0;
  const m=new THREE.Matrix4(),nm=new THREE.Matrix3(),v=new THREE.Vector3(),q=new THREE.Quaternion(),p=new THREE.Vector3(),sc=new THREE.Vector3();
  function add(g,c){
    const P=g.attributes.position,N=g.attributes.normal,I=g.index;
    nm.getNormalMatrix(m);
    for(let i=0;i<P.count;i++){
      v.fromBufferAttribute(P,i).applyMatrix4(m);pos.push(v.x,v.y,v.z);
      v.fromBufferAttribute(N,i).applyMatrix3(nm).normalize();nor.push(v.x,v.y,v.z);
      col.push(c.r,c.g,c.b);
    }
    for(let i=0;i<I.count;i++) idx.push(I.getX(i)+base);
    base+=P.count;
  }
  for(const t of list){
    const s=t.s;
    p.set(t.x,1.6*s,t.z);sc.set(s,s,s);m.compose(p,q,sc);add(trunkGeo,trunkCol);
    p.set(t.x,4.6*s,t.z);sc.set(2.6*s,2.3*s,2.6*s);m.compose(p,q,sc);add(ballGeo,t.col);
    p.set(t.x+t.jx*s,6.3*s,t.z+t.jz*s);sc.set(1.7*s,1.6*s,1.7*s);m.compose(p,q,sc);add(ballGeo,t.col);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  g.setIndex(idx);
  const mesh=new THREE.Mesh(g,treeMat);
  mesh.frustumCulled=false;mesh.castShadow=true;
  return mesh;
}

function updateTrees(){
  treesEl.textContent='Trees: '+treeCount;
  if(treesFailed||!treeScene) return;
  const c=map.getCenter(),cx=Math.floor(c.lng/C),cy=Math.floor(c.lat/C);
  for(const [ck,mesh] of cellMeshes){
    const [x,y]=ck.split(',').map(Number);
    if(Math.abs(x-cx)>2||Math.abs(y-cy)>2){treeScene.remove(mesh);mesh.geometry.dispose();cellMeshes.delete(ck);}
  }
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
    const ck=(cx+dx)+','+(cy+dy),b=buckets.get(ck);
    if(!b) continue;
    if(cellMeshes.has(ck)&&!dirty.has(ck)) continue;
    const old=cellMeshes.get(ck);
    if(old){treeScene.remove(old);old.geometry.dispose();}
    const mesh=buildMesh(b);treeScene.add(mesh);cellMeshes.set(ck,mesh);dirty.delete(ck);
  }
  map.triggerRepaint();
}

/* Our own Montreal tree files first */
const T=0.05;
let treeIndex=null;
const ownLoaded=new Set();
async function loadOwn(k){
  ownLoaded.add(k);
  try{
    const r=await fetch('trees/'+k+'.json');
    if(!r.ok) throw new Error('missing');
    const a=await r.json();
    const [tx,ty]=k.split('_').map(Number);
    for(let i=0;i<a.length;i+=3){
      const lng=tx*T+a[i]/1e5,lat=ty*T+a[i+1]/1e5,d=a[i+2];
      const size=d>0?Math.min(1.6,Math.max(0.55,0.5+d/45)):0;
      addTree(a[i]+a[i+1],lng,lat,size||undefined);
    }
    updateTrees();
  }catch(e){ownLoaded.delete(k);}
}
function loadAround(lng,lat){
  if(!treeIndex) return;
  const tx=Math.floor(lng/T),ty=Math.floor(lat/T);
  const fx=lng-tx*T,fy=lat-ty*T;
  const xs=[0],ys=[0];
  if(fx<0.012)xs.push(-1); if(T-fx<0.012)xs.push(1);
  if(fy<0.009)ys.push(-1); if(T-fy<0.009)ys.push(1);
  for(const dx of xs)for(const dy of ys){
    const k=(tx+dx)+'_'+(ty+dy);
    if(treeIndex.has(k)&&!ownLoaded.has(k)) loadOwn(k);
  }
  if(!treeIndex.has(tx+'_'+ty)) loadAroundOSM(lng,lat);
}

/* Backup: OpenStreetMap trees outside Montreal */
const OT=0.01;
const SERVERS=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
const osmTiles=new Set();
let queue=[],working=false;
function addTreeList(list){for(const t of list) addTree(t[0],t[1],t[2]);}
async function fetchTile(tx,ty){
  const key='tt:'+tx+','+ty;
  if(osmTiles.has(key)) return;
  const s=(ty*OT).toFixed(4),w=(tx*OT).toFixed(4),n=((ty+1)*OT).toFixed(4),e=((tx+1)*OT).toFixed(4);
  const q='[out:json][timeout:25];node["natural"="tree"]('+s+','+w+','+n+','+e+');out;';
  for(const url of SERVERS){
    try{
      const r=await fetch(url+'?data='+encodeURIComponent(q));
      if(!r.ok) throw new Error('busy');
      const j=await r.json();
      const list=j.elements.map(t=>[t.id%1000,+t.lon.toFixed(6),+t.lat.toFixed(6)]);
      cacheSet(key,list);osmTiles.add(key);
      addTreeList(list);updateTrees();
      return;
    }catch(err){}
  }
  treesEl.textContent='Trees: '+treeCount+' (tree server busy)';
}
async function pump(){
  if(working) return; working=true;
  while(queue.length){const [tx,ty]=queue.shift();await fetchTile(tx,ty);}
  working=false;
}
function loadAroundOSM(lng,lat){
  const tx=Math.floor(lng/OT),ty=Math.floor(lat/OT);
  const order=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
  const next=[];let fromCache=false;
  for(const [dx,dy] of order){
    const x=tx+dx,y=ty+dy,key='tt:'+x+','+y;
    if(osmTiles.has(key)) continue;
    const cached=cacheGet(key);
    if(cached){osmTiles.add(key);addTreeList(cached);fromCache=true;}
    else next.push([x,y]);
  }
  if(fromCache) updateTrees();
  queue=next;pump();
}

/* Generated trees in parks and woods */
function inside(pt,rg){let ins=false;for(let i=0,j=rg.length-1;i<rg.length;j=i++){const xi=rg[i][0],yi=rg[i][1],xj=rg[j][0],yj=rg[j][1];if(((yi>pt[1])!==(yj>pt[1]))&&(pt[0]<(xj-xi)*(pt[1]-yi)/(yj-yi)+xi))ins=!ins;}return ins;}
function parkTrees(){
  if(map.getZoom()<15.5||treesFailed||!treeScene)return;
  let added=0;
  const feats=map.querySourceFeatures('openmaptiles',{sourceLayer:'park'})
    .concat(map.querySourceFeatures('openmaptiles',{sourceLayer:'landcover',filter:['==',['get','class'],'wood']}));
  for(const f of feats){
    const g=f.geometry;
    const polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
    for(const poly of polys){
      const rg=poly[0]; if(!rg||rg.length<4) continue;
      const key=rg[0][0].toFixed(5)+','+rg[0][1].toFixed(5)+','+rg.length;
      if(doneAreas.has(key)) continue; doneAreas.add(key);
      let minX=180,minY=90,maxX=-180,maxY=-90;
      for(const p of rg){minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);}
      const area=(maxX-minX)*111320*Math.cos(minY*R)*(maxY-minY)*111320;
      const n=Math.min(60,Math.floor(area/700));
      for(let i=0,tries=0;i<n&&tries<n*4;tries++){
        const pt=[minX+Math.random()*(maxX-minX),minY+Math.random()*(maxY-minY)];
        if(inside(pt,rg)){if(addTree(Math.floor(Math.random()*600),pt[0],pt[1]))added++;i++;}
      }
    }
  }
  if(added) updateTrees();
}

/* Start loading trees right away */
fetch('trees/index.json').then(r=>r.ok?r.json():null)
  .then(j=>{treeIndex=new Set(j?j.tiles:[]);loadAround(startPos[0],startPos[1]);})
  .catch(()=>{treeIndex=new Set();loadAround(startPos[0],startPos[1]);});
