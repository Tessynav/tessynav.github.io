/* TessyNav v2 — scene.js
   The map (OpenFreeMap) for ground, water, parks and buildings; our own 3D layer for roads, bridges and the car.
   Road areas are built once and kept (one area at a time so nothing freezes); areas far behind are deleted.
   Roads have no lighting to compute: their colors are baked in, with a gentle darkening at night. */
var TN=globalThis.TN||{};globalThis.TN=TN;

TN.Scene=function(map,net){
  this.map=map;this.net=net;
  this.cells=new Map();this.netVer=-1;this.lastBuild=0;
  this.three=null;this.car3d=null;this.wheels=[];this.mats={};
  this.night=0;
};
TN.Scene.prototype.layer=function(){
  const S=this;
  return {
    id:'tn3d',type:'custom',renderingMode:'3d',
    onAdd(m,gl){
      const scene=new THREE.Scene(),camera=new THREE.Camera();
      scene.add(new THREE.HemisphereLight(0xeef4ff,0x50555a,1.6));
      const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(-0.4,1,0.3);scene.add(sun);
      const renderer=new THREE.WebGLRenderer({canvas:m.getCanvas(),context:gl,antialias:true});
      renderer.autoClear=false;
      const mc=maplibregl.MercatorCoordinate.fromLngLat(TN.ORIGIN,0),msc=mc.meterInMercatorCoordinateUnits();
      const model=new THREE.Matrix4().makeTranslation(mc.x,mc.y,mc.z).scale(new THREE.Vector3(msc,-msc,msc)).multiply(new THREE.Matrix4().makeRotationX(Math.PI/2));
      S.three={scene:scene,camera:camera,renderer:renderer,model:model};
      S.loadCar();
    },
    render(gl,arg){
      const T=S.three;if(!T) return;
      /* MapLibre 5 passes an object with the matrix, MapLibre 4 the matrix itself */
      const matrix=arg&&arg.modelViewProjectionMatrix?arg.modelViewProjectionMatrix:arg;
      T.camera.projectionMatrix=new THREE.Matrix4().fromArray(matrix).multiply(T.model);
      try{
        const inv=T.camera.projectionMatrix.clone().invert();
        TN.CUTU.cutCam.value.set(0,0,-1).applyMatrix4(inv);
        const c=S.car3d;
        if(c&&c.visible!==false&&S.cutOn!==false){TN.CUTU.cutCar.value.set(c.position.x,c.position.y+1.2,c.position.z);TN.CUTU.cutR.value=4.5;}
        else TN.CUTU.cutR.value=0;
      }catch(e){}
      T.renderer.resetState();
      T.renderer.render(T.scene,T.camera);
    }
  };
};
/* ---------- road areas ---------- */
TN.Scene.prototype.mat=function(k){
  if(this.mats[k]) return this.mats[k];
  if(k==='lot'){
    /* parking lots: drawn first and not hiding anything, so they never flicker against aisles and curbs */
    const m=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,depthWrite:false});
    this.mats[k]=m;return m;
  }
  if(k==='glow'){
    /* lamps and pools of light: added light, invisible by day, fading in at dusk */
    const m=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,transparent:true,opacity:this.glowOp||0,
      blending:THREE.AdditiveBlending,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-5,polygonOffsetUnits:-10});
    this.mats[k]=m;return m;
  }
  const off={curb:1,road:2,mark:4}[k];
  const m=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,polygonOffset:true,
    polygonOffsetFactor:-off,polygonOffsetUnits:-off*2,depthWrite:k!=='mark'});
  this.mats[k]=m;return m;
};
TN.Scene.prototype.cellMesh=function(tx,ty){return this.meshOf(this.net.buildCell(tx,ty));};
TN.Scene.prototype.meshOf=function(L){
  const grp=new THREE.Group();let any=false;
  for(const k of ['lot','curb','road','mark','glow']){
    const G=L[k];if(!G||!G.n) continue;any=true;
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(G.p,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(G.c,3));
    g.setIndex(G.i);
    const mesh=new THREE.Mesh(g,this.mat(k));mesh.frustumCulled=false;mesh.renderOrder={lot:0,curb:1,road:2,mark:3,glow:4}[k];
    grp.add(mesh);
  }
  return any?grp:null;
};
TN.Scene.prototype.freeCell=function(k){
  const e=this.cells.get(k);if(!e) return;
  if(e.grp){this.three.scene.remove(e.grp);e.grp.traverse(o=>{if(o.geometry) o.geometry.dispose();});}
  this.cells.delete(k);
};
TN.Scene.prototype.update=function(lng,lat){
  if(!this.three) return;
  const cx=Math.floor(lng/TN.CELL),cy=Math.floor(lat/TN.CELL),net=this.net;
  /* new road data: only the areas around the packs that changed are rebuilt (not every area around you) */
  if(net.ver!==this.netVer){
    this.netVer=net.ver;const ch=net.changed||[];net.changed=[];
    const P=net.PACK||4;
    if(!ch.length){for(const e of this.cells.values()) e.old=true;}
    else for(const [k,e] of this.cells){const [x,y]=k.split(',').map(Number),px=Math.floor(x/P),py=Math.floor(y/P);
      if(ch.some(c=>{const [a,b]=c.split('_').map(Number);return Math.abs(a-px)<=1&&Math.abs(b-py)<=1;})) e.old=true;}
  }
  for(const k of [...this.cells.keys()]){const [x,y]=k.split(',').map(Number);if(Math.abs(x-cx)>3||Math.abs(y-cy)>3) this.freeCell(k);}
  const t0=performance.now();
  /* keep building the current area, a few milliseconds per frame (no stutter) */
  if(this.job){
    let r;net._sg=this.job.sg||null;
    do{r=this.job.g.next();}while(!r.done&&performance.now()-t0<5);
    net._sg=null;
    if(r.done){
      const J=this.job;this.job=null;
      const grp=this.meshOf(r.value);this.freeCell(J.k);
      if(grp) this.three.scene.add(grp);
      this.cells.set(J.k,{grp:grp});
    }
    TN.prof('roads',performance.now()-t0);
    return;
  }
  /* nearest area that is missing or out of date */
  let best=null;
  for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++){
    const k=(cx+dx)+','+(cy+dy),e=this.cells.get(k);
    if(e&&!e.old) continue;
    const d=dx*dx+dy*dy;if(!best||d<best.d) best={k:k,x:cx+dx,y:cy+dy,d:d};
  }
  if(!best||!net.ways.size) return;
  const e=this.cells.get(best.k);if(e) e.old=false;   /* (an old area stays visible until its new version is ready) */
  if(e) e.old=false;
  this.job={k:best.k,g:net.buildCellJob(best.x,best.y)};
  TN.prof('roads',performance.now()-t0);
};
TN.Scene.prototype.setNight=function(nt){
  this.night=nt;const c=new THREE.Color(TN.mix('#ffffff','#9aa3b6',nt));
  for(const k in this.mats) if(k!=='glow') this.mats[k].color.copy(c);
  this.glowOp=Math.max(0,Math.min(1,(nt-0.15)/0.5));if(this.mats.glow) this.mats.glow.opacity=this.glowOp;
};
/* ---------- the car (Tessy's real model, model3.glb in the site's main folder) ---------- */
TN.Scene.prototype.loadCar=async function(){
  const root=new THREE.Group();this.car3d=root;this.three.scene.add(root);
  /* simple stand-in until the model has loaded */
  const tmp=new THREE.Mesh(new THREE.BoxGeometry(1.85,1.4,4.7),new THREE.MeshStandardMaterial({color:0x3a3d42,roughness:0.4,metalness:0.5}));
  tmp.position.y=0.7;root.add(tmp);
  try{
    const r=await fetch('../model3.glb');if(!r.ok) throw new Error('model3.glb not found');
    const buf=await r.arrayBuffer(),dv=new DataView(buf);
    let off=12,j=null,bin=null;
    while(off+8<=buf.byteLength){
      const len=dv.getUint32(off,true),type=dv.getUint32(off+4,true),st=off+8;
      if(type===0x4E4F534A) j=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,st,len)));
      else if(type===0x004E4942) bin=buf.slice(st,st+len);
      off=st+len;
    }
    const acc=i=>{const a=j.accessors[i],bv=j.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
      const T={5126:Float32Array,5125:Uint32Array,5123:Uint16Array,5121:Uint8Array}[a.componentType];
      const o=(bv.byteOffset||0)+(a.byteOffset||0);return new T(bin.slice(o,o+a.count*n*T.BYTES_PER_ELEMENT));};
    const body=new THREE.Group();
    for(const ni of j.scenes[j.scene||0].nodes){
      const nd=j.nodes[ni];if(nd.mesh==null) continue;
      const M=new THREE.Matrix4();
      if(nd.matrix) M.fromArray(nd.matrix);else if(nd.translation) M.makeTranslation(nd.translation[0],nd.translation[1],nd.translation[2]);
      for(const pr of j.meshes[nd.mesh].primitives){
        const g=new THREE.BufferGeometry();
        g.setAttribute('position',new THREE.BufferAttribute(acc(pr.attributes.POSITION),3));
        if(pr.attributes.NORMAL!=null) g.setAttribute('normal',new THREE.BufferAttribute(acc(pr.attributes.NORMAL),3));
        if(pr.indices!=null) g.setIndex(new THREE.BufferAttribute(acc(pr.indices),1));
        if(pr.attributes.NORMAL==null) g.computeVertexNormals();
        const md=(j.materials&&pr.material!=null)?j.materials[pr.material]:{};
        const mesh=new THREE.Mesh(g,this.carMat(md));mesh.frustumCulled=false;
        const wk=(nd.name||'').match(/^(Wheel[FR][LR])_/);
        if(wk){let w=this.wheels.find(x=>x.name===wk[1]);if(!w){w=new THREE.Group();w.name=wk[1];w.position.setFromMatrixPosition(M);body.add(w);this.wheels.push(w);}w.add(mesh);}
        else{mesh.applyMatrix4(M);body.add(mesh);}
      }
    }
    root.remove(tmp);root.add(body);
    this.addBrakeGlow(body);
    this.addSilhouette(body);
  }catch(e){console.warn('car model',e.message);}
};
TN.Scene.prototype.carMat=function(md){
  const pbr=md.pbrMetallicRoughness||{},c=pbr.baseColorFactor||[0.5,0.5,0.5,1],name=md.name||'';
  /* Tessy's real colour: Stealth Grey, a medium blue-grey with a soft metallic shine */
  if(name==='paint') return new THREE.MeshStandardMaterial({color:0x60656c,metalness:0.5,roughness:0.34,side:THREE.DoubleSide});
  if(name==='glass') return new THREE.MeshStandardMaterial({color:0x0b0d10,metalness:0.2,roughness:0.08,side:THREE.DoubleSide});
  if(name==='tail'){const m=new THREE.MeshStandardMaterial({color:0x7a0d10,emissive:0x5a0000,roughness:0.3});(this.tails=this.tails||[]).push(m);return m;}
  return new THREE.MeshStandardMaterial({color:new THREE.Color(c[0],c[1],c[2]),metalness:pbr.metallicFactor!=null?pbr.metallicFactor:0.2,
    roughness:pbr.roughnessFactor!=null?pbr.roughnessFactor:0.6,side:THREE.DoubleSide});
};
/* when a building (or anything else) is between the camera and the car, the hidden part of the car is drawn as a
   soft blue-grey silhouette, so you always see where you are. Drawn after the city but before the car itself. */
TN.Scene.prototype.addSilhouette=function(body){ /* replaced by the see-through circle around the car (TN.CUT) */ };
/* ---------- see-through circle around the car (like Codriver) ----------
   Buildings and trees between the camera and the car fade out (fine dither) inside a cone from the camera to the car,
   so Tessy always stays solid and clear; outside the circle everything looks normal. */
TN.CUTU={cutCam:{value:new THREE.Vector3()},cutCar:{value:new THREE.Vector3(0,-1e6,0)},cutR:{value:0}};
TN.CUTGLSL=[
  'uniform vec3 cutCam;uniform vec3 cutCar;uniform float cutR;varying vec3 vCutW;',
  'bool tnCut(){',
  '  if(cutR<=0.0) return false;',
  '  vec3 d=cutCar-cutCam;float dd=dot(d,d);if(dd<1.0) return false;',
  '  float t=dot(vCutW-cutCam,d)/dd;',
  '  if(t<=0.0||t>1.0-2.5/sqrt(dd)) return false;',
  '  float r=length(vCutW-(cutCam+d*t));',
  /* a cone from the camera to the car: only what covers the car on screen fades (nothing beside the car) */
  '  float rad=cutR*t;',
  '  float k=0.85*(1.0-smoothstep(rad*0.6,rad,r));',
  '  if(k<=0.0) return false;',
  '  return fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)<k;',
  '}'].join('\n');
TN.CUTVERT='\n#ifdef USE_INSTANCING\nvCutW=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz;\n#else\nvCutW=(modelMatrix*vec4(transformed,1.0)).xyz;\n#endif\n';
/* add the circle to a built-in material (trees) */
TN.cutPatch=function(mat){
  mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,TN.CUTU);
    sh.vertexShader='varying vec3 vCutW;\n'+sh.vertexShader.replace('#include <project_vertex>','#include <project_vertex>'+TN.CUTVERT);
    sh.fragmentShader=TN.CUTGLSL+'\n'+sh.fragmentShader.replace('void main() {','void main() {\n  if(tnCut()) discard;');};
  mat.needsUpdate=true;
};
/* a soft red glow behind each tail light, and on the road behind the car, shown while braking */
TN.Scene.prototype.addBrakeGlow=function(body){
  try{
    const cv=document.createElement('canvas');cv.width=cv.height=64;const g=cv.getContext('2d');
    const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,60,50,1)');gr.addColorStop(0.35,'rgba(255,30,30,0.55)');gr.addColorStop(1,'rgba(255,0,0,0)');
    g.fillStyle=gr;g.fillRect(0,0,64,64);
    const tex=new THREE.CanvasTexture(cv);
    /* where the tail lights are, from the model's own tail-light parts */
    const box=new THREE.Box3();let found=false;
    body.updateMatrixWorld(true);
    body.traverse(o=>{if(o.isMesh&&this.tails&&this.tails.indexOf(o.material)>=0){box.expandByObject(o);found=true;}});
    if(!found) return;
    const c=new THREE.Vector3();box.getCenter(c);const size=new THREE.Vector3();box.getSize(size);
    const back=Math.sign(c.z)||1;
    this.glows=[];
    for(const sx of [-1,1]){
      const m=new THREE.SpriteMaterial({map:tex,color:0xff2a2a,transparent:true,opacity:0,depthWrite:false});
      const sp=new THREE.Sprite(m);sp.scale.set(0.9,0.6,1);sp.position.set(c.x+sx*size.x*0.42,c.y,c.z+back*0.15);body.add(sp);this.glows.push(m);
    }
    const gm=new THREE.MeshBasicMaterial({map:tex,color:0xff1e1e,transparent:true,opacity:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(3.0,3.2),gm);plane.rotation.x=-Math.PI/2;plane.position.set(c.x,0.06,c.z+back*1.8);
    body.add(plane);this.glows.push(gm);this.glowGround=gm;
  }catch(e){}
};
/* brake lights: 0 = normal tail lights, 1 = braking (bright red, with glow) */
TN.Scene.prototype.setBrake=function(k){
  if(!this.tails||this.brakeK===k) return;this.brakeK=k;
  if(this.glows) for(const m of this.glows) m.opacity=(m===this.glowGround?0.6:0.85)*k;
  for(const m of this.tails){m.emissive.setRGB(0.35+0.65*k,0.02*(1-k),0.02*(1-k));m.emissiveIntensity=1+1.6*k;m.color.setRGB(0.48+0.5*k,0.05,0.06);}
};
TN.Scene.prototype.placeCar=function(x,z,y,hd){
  if(!this.car3d) return;
  this.car3d.position.set(x,y,z);this.car3d.rotation.y=-hd*TN.R;
};
/* ---------- map style ---------- */
TN.Scene.prototype.styleMap=function(){
  const map=this.map;
  for(const l of map.getStyle().layers){
    const sl=l['source-layer']||'';
    /* our own roads replace the map's roads (and their bridges/tunnels) */
    if(sl==='transportation'&&(l.type==='line'||l.type==='fill')) map.setLayoutProperty(l.id,'visibility','none');
    /* no text labels: placing them again on every frame (the camera moves every frame) is one of the slowest
       things the map does, and street names are not needed in the driving view */
    if(l.type==='symbol') map.setLayoutProperty(l.id,'visibility','none');
  }
  /* ground colours: bright and saturated (a painted look): vivid blue-teal water, rich greens in several shades
     (parks, grass, woods), light warm city ground so the dark roads stand out. Layers that the map style draws
     half-transparent are made solid, otherwise the colours look washed out. */
  const solid=(id,prop)=>{try{map.setPaintProperty(id,prop,1);}catch(e){}};
  for(const l of map.getStyle().layers){
    const id=l.id.toLowerCase();
    try{
      if(l.type==='background') map.setPaintProperty(l.id,'background-color','#c2c3b6');
      else if(l.type==='fill'){
        let c=null;
        if(/water|ocean|river|lake|basin|reservoir/.test(id)) c='#2f9fd6';
        else if(/wood|forest/.test(id)) c='#3f9a3a';
        else if(/park|garden|playground|nature|cemetery/.test(id)) c='#5dbb44';
        else if(/grass|meadow|scrub|farmland|landcover|pitch|golf|village_green|recreation/.test(id)) c='#6cc24a';
        else if(/sand|beach/.test(id)) c='#e6d39b';
        else if(/residential|commercial|industrial|retail|school|hospital|railway|airport|parking|landuse/.test(id)) c='#c8c7bb';
        if(c){map.setPaintProperty(l.id,'fill-color',c);solid(l.id,'fill-opacity');try{map.setPaintProperty(l.id,'fill-outline-color',c);}catch(e){}}
      }else if(l.type==='line'&&/water|river|stream|canal/.test(id)){map.setPaintProperty(l.id,'line-color','#2f9fd6');solid(l.id,'line-opacity');}
    }catch(e){}
  }
  if(!map.getLayer('tn-buildings')){
    map.addLayer({id:'tn-buildings',type:'fill-extrusion',source:'openmaptiles','source-layer':'building',minzoom:14,
      paint:{'fill-extrusion-color':TN.farBuildingColor(0),'fill-extrusion-height':['case',['boolean',['feature-state','hide'],false],0,['max',['coalesce',['get','render_height'],8],['+',['coalesce',['feature-state','lift'],0],2]]],
        'fill-extrusion-base':['case',['boolean',['feature-state','hide'],false],0,['max',['coalesce',['get','render_min_height'],0],['coalesce',['feature-state','lift'],0]]],'fill-extrusion-opacity':1}});
  }
  for(const l of map.getStyle().layers) if(l.type==='fill-extrusion'&&l.id!=='tn-buildings') map.setLayoutProperty(l.id,'visibility','none');
  map.addSource('tn-night',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]]]}}});
  map.addLayer({id:'tn-night',type:'fill',source:'tn-night',paint:{'fill-color':'#0b1630','fill-opacity':0}},'tn-buildings');
  map.addLayer(this.layer());
};
TN.Scene.prototype.applyNight=function(nt){
  if(this.introActive){this.pendingNt=nt;this.setNight(nt);return;}   /* the intro restores the sky when it ends */
  /* a sky above the horizon: blue by day, deep night blue at night */
  try{
    if(typeof this.map.setSky==='function') this.map.setSky({'sky-color':TN.mix('#5d8fd1','#0d1830',nt),'horizon-color':TN.mix('#cfe0f2','#2a3a5c',nt),
      'fog-color':TN.mix('#dfe8ef','#1c2638',nt),'sky-horizon-blend':0.6,'horizon-fog-blend':0.5,'fog-ground-blend':0.85,'atmosphere-blend':0});
  }catch(e){}
  try{
    this.map.setPaintProperty('tn-night','fill-opacity',0.16*nt);
    this.map.setPaintProperty('tn-buildings','fill-extrusion-color',TN.farBuildingColor(nt));
  }catch(e){}
  this.setNight(nt);
};
/* buildings further away (the map's own): coloured by height like the detailed ones, instead of plain cement */
TN.farBuildingColor=function(nt){
  const d=c=>TN.mix(c,'#4e5463',nt*0.75);
  return ['step',['coalesce',['get','render_height'],8],d('#b47862'),13,d('#cfc6b4'),32,d('#a7b4c1')];
};
TN.mix=function(a,b,t){
  const pa=[1,3,5].map(i=>parseInt(a.substr(i,2),16)),pb=[1,3,5].map(i=>parseInt(b.substr(i,2),16));
  return '#'+pa.map((v,i)=>Math.round(v+(pb[i]-v)*t).toString(16).padStart(2,'0')).join('');
};
/* sun height (degrees) for night mode */
TN.sunAlt=function(date,lat,lng){
  const d=(date.getTime()/86400000)-10957.5,g=(357.529+0.98560028*d)*TN.R,q=280.459+0.98564736*d;
  const L=(q+1.915*Math.sin(g)+0.020*Math.sin(2*g))*TN.R,e=(23.439-0.00000036*d)*TN.R;
  const ra=Math.atan2(Math.cos(e)*Math.sin(L),Math.cos(L)),dec=Math.asin(Math.sin(e)*Math.sin(L));
  const gmst=(18.697374558+24.06570982441908*d)%24,lst=(gmst*15+lng)*TN.R,ha=lst-ra;
  return Math.asin(Math.sin(lat*TN.R)*Math.sin(dec)+Math.cos(lat*TN.R)*Math.cos(dec)*Math.cos(ha))/TN.R;
};
/* timing per part (for recordings) */
TN.PROF={};TN.prof=function(k,ms){TN.PROF[k]=(TN.PROF[k]||0)+ms;};
