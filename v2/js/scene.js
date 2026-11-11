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
      const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(-0.4,1,0.3);scene.add(sun);S.sunLight=sun;S.hemiLight=scene.children.find(o=>o.isHemisphereLight)||null;
      const renderer=new THREE.WebGLRenderer({canvas:m.getCanvas(),context:gl,antialias:true});
      renderer.autoClear=false;
      const mc=maplibregl.MercatorCoordinate.fromLngLat(TN.ORIGIN,0),msc=mc.meterInMercatorCoordinateUnits();
      const model=new THREE.Matrix4().makeTranslation(mc.x,mc.y,mc.z).scale(new THREE.Vector3(msc,-msc,msc)).multiply(new THREE.Matrix4().makeRotationX(Math.PI/2));
      S.three={scene:scene,camera:camera,renderer:renderer,model:model};
      try{S.addSky();}catch(e){}
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
        S.updateSky(TN.CUTU.cutCam.value);
        const c=S.car3d;
        if(c&&c.visible!==false&&S.cutOn!==false){TN.CUTU.cutCar.value.set(c.position.x,c.position.y+1.2,c.position.z);TN.CUTU.cutR.value=4.5;
          TN.CUTU.cutBub.value+=((TN.carOffRoad?24:(TN.tunnel&&TN.tunnel.k>0.3?60:0))-TN.CUTU.cutBub.value)*0.06;}   /* (in a tunnel: the buildings above fade away, 60 m around) */   /* (the bubble grows and shrinks smoothly) */
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
    if(TN.snowPatch) TN.snowPatch(m,0.6);   /* (snow on the ground: lots turn white) */
    this.tintMat(k,m);this.mats[k]=m;return m;
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
  if(k==='mark') this.beamPatch(m);   /* lane markings light up in the headlights */
  TN.cutPatch(m,{high:true});   /* a bridge or overpass right above the car is cut away so the car stays visible */
  if(k==='road') TN.texPatch(m,k);   /* slightly darker asphalt with soft patches; markings stay crisp */
  if(TN.snowPatch&&(k==='road'||k==='curb')) TN.snowPatch(m,k==='road'?0.3:0.85);   /* (snow on the ground: sidewalks white, roads lighter) */
  this.tintMat(k,m);this.mats[k]=m;return m;
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
    if(k==='glow'){mesh.tnGlow=true;mesh.visible=(this.glowOp||0)>0.01;}
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
    if(!ch.length){/* (no tile changed: the road areas stay as they are) */}
    /* every road is stored in every tile it passes through, so a new (or dropped) tile can only change the areas
       inside it or right along its border (a road ending at the edge, a junction there): only those are rebuilt */
    else for(const [k,e] of this.cells){const [x,y]=k.split(',').map(Number);
      if(ch.some(c=>{const [a,b]=c.split('_').map(Number);return x>=a*P-1&&x<=a*P+P&&y>=b*P-1&&y<=b*P+P;})) e.old=true;}
  }
  for(const k of [...this.cells.keys()]){const [x,y]=k.split(',').map(Number);if(Math.abs(x-cx)>3||Math.abs(y-cy)>3) this.freeCell(k);}
  /* pools of light under the street lamps: only at night, and only in the areas next to the car (farther away they're
     tiny dots that still cost drawing time; during the day they're invisible but were still drawn) */
  {const lit=(this.glowOp||0)>0.01,key=(lit?1:0)+'|'+cx+','+cy;
   if(key!==this.glowKey||this.cells.size!==this.glowN){this.glowKey=key;this.glowN=this.cells.size;
     for(const [k,e] of this.cells){if(!e.grp) continue;const [x,y]=k.split(',').map(Number),near=Math.abs(x-cx)<=1&&Math.abs(y-cy)<=1;
       for(const m of e.grp.children) if(m.tnGlow) m.visible=lit&&near;}}}
  const t0=performance.now();
  /* keep building the current area, a few milliseconds per frame (no stutter) */
  /* an area being built by the background road builder: when it's back, it becomes 3D shapes (a slice per frame);
     if it doesn't come back (the background builder stopped), the area is built here as before */
  if(this.job&&this.job.wait){
    const J=this.job;
    if(J.res){this.job=null;const L=J.res;this.fin={k:J.k,L:L,ver:J.ver,layers:['lot','curb','road','mark','glow'].filter(q=>L[q]&&L[q].n),li:0,st:0,off:0,arr:null,grp:new THREE.Group()};}
    else if(J.fail||performance.now()-J.t>10000){if(!J.fail&&TN.RW){if(TN.RWfail) TN.RWfail();else{TN.RW.failed=true;net.mirror=false;}}this.job={k:J.k,g:net.buildCellJob(J.x,J.y)};}
    return;
  }
  if(this.job){
    const bud=Math.min(5,TN.workLeft?TN.workLeft():5);if(bud<0.5) return;   /* this frame's budget is used up */
    let r;net._sg=this.job.sg||null;
    do{r=this.job.g.next();}while(!r.done&&performance.now()-t0<bud);
    net._sg=null;
    if(r.done){
      /* turning the finished area into 3D shapes is done a slice per frame too (it was done all at once: a quarter
         of a second for a big area, a visible stutter) */
      const J=this.job;this.job=null;this.fin={k:J.k,L:r.value,layers:['lot','curb','road','mark','glow'].filter(q=>r.value[q]&&r.value[q].n),li:0,st:0,off:0,arr:null,grp:new THREE.Group()};
    }
    TN.prof('roads',performance.now()-t0);
    return;
  }
  if(this.fin){
    const bud=Math.min(5,TN.workLeft?TN.workLeft():5);if(bud<0.5) return;
    const F=this.fin,SL=40000;
    while(F.li<F.layers.length&&performance.now()-t0<bud){
      const k=F.layers[F.li],G=F.L[k];
      if(F.st===0&&G.p instanceof Float32Array){F.typed={0:G.p,1:G.c,2:G.i};F.st=3;}   /* (from the background builder: already number arrays) */
      const src=F.st===0?G.p:F.st===1?G.c:G.i;
      if(F.st<3){
        if(!F.arr) F.arr=F.st===2?(G.p.length/3>65535?new Uint32Array(src.length):new Uint16Array(src.length)):new Float32Array(src.length);
        const end=Math.min(src.length,F.off+SL);for(let q=F.off;q<end;q++) F.arr[q]=src[q];F.off=end;
        if(F.off>=src.length){(F.typed=F.typed||{})[F.st]=F.arr;F.arr=null;F.off=0;F.st++;}
        continue;
      }
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.BufferAttribute(F.typed[0],3));g.setAttribute('color',new THREE.BufferAttribute(F.typed[1],3));
      g.setIndex(new THREE.BufferAttribute(F.typed[2],1));
      const mesh=new THREE.Mesh(g,this.mat(k));mesh.frustumCulled=false;mesh.renderOrder={lot:0,curb:1,road:2,mark:3,glow:4}[k];
      if(k==='glow'){mesh.tnGlow=true;mesh.visible=(this.glowOp||0)>0.01;}
      F.grp.add(mesh);F.li++;F.st=0;F.typed=null;
    }
    if(F.li>=F.layers.length){
      this.fin=null;const grp=F.grp.children.length?F.grp:null;this.freeCell(F.k);
      if(grp) this.three.scene.add(grp);
      /* (built from an older map than the one now loaded: shown, and rebuilt again soon) */
      this.cells.set(F.k,{grp:grp,lamps:F.L.lamps||[],old:F.ver!=null&&F.ver!==net.ver});this.glowKey=null;   /* (refresh which light pools are shown) */
    }
    TN.prof('roads',performance.now()-t0);
    return;
  }
  /* nearest area that is missing or out of date */
  let best=null;
  for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++){
    const k=(cx+dx)+','+(cy+dy),e=this.cells.get(k);
    if(e&&!e.old) continue;
    /* the areas ahead of the car come first (along the route or the road you're driving), the ones behind last */
    let d=dx*dx+dy*dy;const A=TN.aheadDir;if(A&&(dx||dy)){const dl=Math.sqrt(dx*dx+dy*dy),dot=(dx*A[0]+dy*A[1])/dl;d-=1.6*dot*dl;}
    if(!best||d<best.d) best={k:k,x:cx+dx,y:cy+dy,d:d};
  }
  if(!best||!net.ways.size) return;
  const e=this.cells.get(best.k);if(e) e.old=false;   /* (an old area stays visible until its new version is ready) */
  if(e) e.old=false;
  /* built in the background when the background road builder is running and up to date with the network; it waits
     a moment while it catches up; built here as before when there's none (or it stopped) */
  const RW=TN.RW;
  if(RW&&!RW.failed){
    if(!RW.ready){if(performance.now()-RW.t0>6000){if(TN.RWfail) TN.RWfail();else{RW.failed=true;net.mirror=false;}}else return;}
    /* (it no longer waits until the background builder has caught up with every new piece of map: while it was busy
       working out new heights, the areas around the car waited and the roads near the car stayed blank. An area built
       with a slightly older map is rebuilt by itself once the newer one is in.) */
    else if(RW.ver<0) return;
    else{const id=++RW.id,J={k:best.k,wait:true,t:performance.now(),x:best.x,y:best.y};this.job=J;
      RW.pend.set(id,(L,err,ver)=>{if(err||!L) J.fail=true;else{J.res=L;J.ver=ver;}});
      try{RW.w.postMessage({t:'cell',x:best.x,y:best.y,k:best.k,id:id});}catch(e){J.fail=true;}
      TN.prof('roads',performance.now()-t0);return;}
  }
  this.job={k:best.k,g:net.buildCellJob(best.x,best.y)};
  TN.prof('roads',performance.now()-t0);
};
TN.Scene.prototype.setNight=function(nt){
  this.night=nt;
  for(const k in this.mats) if(k!=='glow') this.tintMat(k,this.mats[k]);
  this.glowOp=Math.max(0,Math.min(1,(nt-0.45)/0.35));   /* street lights only once it is really getting dark */if(this.mats.glow) this.mats.glow.opacity=this.lightsOff?0:this.glowOp;
  if(this.headMat) this.headMat.opacity=this.glowOp;   /* headlamps on the car */
  if(this.skyStars) this.skyStars.material.opacity=this.glowOp;
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
  if(name==='paint'){const m=new THREE.MeshStandardMaterial({color:0x60656c,metalness:0.5,roughness:0.34,side:THREE.DoubleSide});
    TN.paintMat=m;setTimeout(()=>{try{TN.applyCar&&TN.applyCar();}catch(e){}},0);return m;}   /* (the connected Tesla's real colour, when known) */
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
TN.CUTU={cutCam:{value:new THREE.Vector3()},cutCar:{value:new THREE.Vector3(0,-1e6,0)},cutR:{value:0},cutBub:{value:0}};
TN.CUTGLSL=[
  'uniform vec3 cutCam;uniform vec3 cutCar;uniform float cutR;uniform float cutBub;varying vec3 vCutW;',
  /* how much of this point to fade (0 = keep, 1 = gone): a soft cone from the camera to the car */
  'float tnCutK(){',
  '  if(cutR<=0.0) return 0.0;',
  '#ifndef TN_HIGH',
  /* the x-ray bubble: the car isn't on a road (at home, in a garage): buildings around it fade away */
  '  if(cutBub>0.5){float hb=length(vCutW.xz-cutCar.xz);if(hb<cutBub) return 1.0-smoothstep(cutBub*0.7,cutBub,hb);}',
  '#endif',
  '#ifdef TN_HIGH',
  /* roads and bridges: only what is above the car (a bridge or overpass it drives under) */
  '  if(vCutW.y<cutCar.y+2.5) return 0.0;',
  '#endif',
  '  vec3 d=cutCar-cutCam;float dd=dot(d,d);if(dd<1.0) return 0.0;',
  '  if(length(vCutW-cutCam)<7.0) return 1.0;',
  '  float t=dot(vCutW-cutCam,d)/dd;',
  '  if(t<=0.0||t>1.0-2.5/sqrt(dd)) return 0.0;',
  '  float r=length(vCutW-(cutCam+d*t));',
  '  float rad=cutR*t;',
  '  return 1.0-smoothstep(rad*0.35,rad*1.15,r);',
  '}',
  'bool tnCut(){return tnCutK()>0.5;}'].join('\n');
TN.CUTVERT='\n#ifdef USE_INSTANCING\nvCutW=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz;\n#else\nvCutW=(modelMatrix*vec4(transformed,1.0)).xyz;\n#endif\n';
/* add the circle to a built-in material (trees) */
/* asphalt: slightly darker roads (the white markings and the blue route line stand out more) with soft lighter and
   darker patches a metre or two wide, big enough to see from the car; one 512 px picture covering 24 m, painted onto
   the roads by their position in the world, fading to the plain colour in the distance so it never shimmers */
TN.asphaltCanvas=function(doc){
  const S=512,cv=doc.createElement('canvas');cv.width=S;cv.height=S;const g=cv.getContext('2d');
  let a=11;const rnd=()=>{a^=a<<13;a>>>=0;a^=a>>17;a^=a<<5;a>>>=0;return a/4294967296;};
  g.fillStyle='rgb(200,0,0)';g.fillRect(0,0,S,S);
  const blob=(x,y,r,c,al)=>{for(const ox of [-S,0,S])for(const oy of [-S,0,S]){const gr=g.createRadialGradient(x+ox,y+oy,0,x+ox,y+oy,r);gr.addColorStop(0,'rgba('+c+',0,0,'+al+')');gr.addColorStop(1,'rgba('+c+',0,0,0)');g.fillStyle=gr;g.fillRect(x+ox-r,y+oy-r,2*r,2*r);}};
  for(let k=0;k<22;k++) blob(rnd()*S,rnd()*S,25+rnd()*60,rnd()<0.5?165:221,0.55);
  const im=g.getImageData(0,0,S,S),D=im.data;for(let i=0;i<D.length;i+=4) D[i]=Math.max(0,Math.min(255,D[i]+(rnd()-0.5)*16));
  g.putImageData(im,0,0);return cv;
};
TN.asphaltTex=null;
TN.texPatch=function(mat,kind){
  if(typeof document==='undefined'||kind!=='road') return;
  try{if(!TN.asphaltTex){const t=new THREE.CanvasTexture(TN.asphaltCanvas(document));t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;TN.asphaltTex=t;}}catch(e){return;}
  const prev=mat.onBeforeCompile,pk=mat.customProgramCacheKey?mat.customProgramCacheKey.bind(mat):null;
  mat.onBeforeCompile=(sh,r)=>{if(prev) prev(sh,r);sh.uniforms.tnAsph={value:TN.asphaltTex};
    sh.fragmentShader='uniform sampler2D tnAsph;\n'+sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+
      '  {float tnD=distance(cameraPosition.xz,vCutW.xz),tnF=1.0-smoothstep(90.0,220.0,tnD);\n'+
      '   float tnL=texture2D(tnAsph,vCutW.xz/24.0).r/0.784;diffuseColor.rgb*=0.82*mix(1.0,tnL,tnF);}\n');};
  mat.customProgramCacheKey=()=>(pk?pk():'')+'|asph2';mat.needsUpdate=true;
};
TN.cutPatch=function(mat,opts){
  opts=opts||{};const prev=mat.onBeforeCompile;
  mat.onBeforeCompile=(sh,r)=>{if(prev) prev(sh,r);Object.assign(sh.uniforms,TN.CUTU);
    sh.vertexShader='varying vec3 vCutW;\n'+sh.vertexShader.replace('#include <project_vertex>','#include <project_vertex>'+TN.CUTVERT);
    let f=(opts.high?'#define TN_HIGH\n':'')+TN.CUTGLSL+'\n'+sh.fragmentShader;
    if(opts.fade){
      /* real transparency: fades smoothly (no dots) */
      f=f.replace('void main() {','void main() {\n  float tnK=tnCutK();if(tnK>0.97) discard;');
      f=f.replace(/}\s*$/,'  gl_FragColor.a*=1.0-tnK;\n}');
    }else f=f.replace('void main() {','void main() {\n  if(tnCutK()>0.5) discard;');
    sh.fragmentShader=f;};
  if(opts.fade) mat.transparent=true;
  mat.customProgramCacheKey=()=>'cut'+(opts.high?'h':'')+(opts.fade?'f':'')+(prev?'p':'');
  mat.needsUpdate=true;
};/* a soft red glow behind each tail light, and on the road behind the car, shown while braking */
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
    const gm=new THREE.MeshBasicMaterial({map:tex,color:0xff1e1e,transparent:true,opacity:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-6,polygonOffsetUnits:-12});   /* over road and curb, without drawing over the car */
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(3.0,3.2),gm);plane.rotation.x=-Math.PI/2;plane.position.set(c.x,0.24,c.z+back*1.8);   /* above sidewalks: no flicker */
    body.add(plane);this.glows.push(gm);this.glowGround=gm;
    /* the headlamps themselves glow at night (the light on the road is the beam, see updateBeam) */
    const full=new THREE.Box3().setFromObject(body),fz=back>0?full.min.z:full.max.z;
    const cw=document.createElement('canvas');cw.width=cw.height=64;const gw=cw.getContext('2d');
    const gg=gw.createRadialGradient(32,32,0,32,32,32);gg.addColorStop(0,'rgba(255,255,255,1)');gg.addColorStop(0.3,'rgba(240,246,255,0.6)');gg.addColorStop(1,'rgba(255,255,255,0)');
    gw.fillStyle=gg;gw.fillRect(0,0,64,64);const wt=new THREE.CanvasTexture(cw);
    this.headMat=new THREE.SpriteMaterial({map:wt,transparent:true,opacity:this.glowOp||0,depthWrite:false,blending:THREE.AdditiveBlending});
    for(const sx of [-1,1]){const sp=new THREE.Sprite(this.headMat);sp.scale.set(0.8,0.5,1);sp.position.set(c.x+sx*size.x*0.5,c.y-0.2,fz-back*0.05);body.add(sp);}
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
  this.dayPaint=[];
  for(const l of map.getStyle().layers){
    const id=l.id.toLowerCase();
    try{
      if(l.type==='background'){map.setPaintProperty(l.id,'background-color','#c2c3b6');this.dayPaint.push([l.id,'background-color','#c2c3b6','#3a3f48']);}
      else if(l.type==='fill'){
        let c=null;
        if(/water|ocean|river|lake|basin|reservoir/.test(id)) c='#2f9fd6';
        else if(/wood|forest/.test(id)) c='#3f9a3a';
        else if(/park|garden|playground|nature|cemetery/.test(id)) c='#5dbb44';
        else if(/grass|meadow|scrub|farmland|landcover|pitch|golf|village_green|recreation/.test(id)) c='#6cc24a';
        else if(/sand|beach/.test(id)) c='#e6d39b';
        else if(/residential|commercial|industrial|retail|school|hospital|railway|airport|parking|landuse/.test(id)) c='#c8c7bb';
        if(c){map.setPaintProperty(l.id,'fill-color',c);solid(l.id,'fill-opacity');try{map.setPaintProperty(l.id,'fill-outline-color',c);}catch(e){}
          this.dayPaint.push([l.id,'fill-color',c,TN.NIGHTCOL[c]||TN.mix(c,'#1a2030',0.8)]);
          /* grass, parks and woods: a natural texture instead of one flat green (lighter and darker patches, a little
             dry grass and soil showing through), like Codriver */
          if(TN.GRASS[c]){const name=this.grassImg(c,c);if(name){try{map.setPaintProperty(l.id,'fill-pattern',name);this.texLayers=this.texLayers||[];this.texLayers.push([l.id,c]);}catch(e){}}}}
      }else if(l.type==='line'&&/water|river|stream|canal/.test(id)){map.setPaintProperty(l.id,'line-color','#2f9fd6');solid(l.id,'line-opacity');
        this.dayPaint.push([l.id,'line-color','#2f9fd6','#0e2a44']);}
    }catch(e){}
  }
  this.lastNt=null;if(this.wxNt!=null) this.applyGround(this.wxNt);
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
/* ground, grass and water: day colours blend into their night colours */
/* night shade of a road material: applied the moment it is created, so nothing starts in daytime colours at night */
TN.Scene.prototype.tintMat=function(k,m){
  const nt=this.night||0;m.color.set(TN.mix('#ffffff',k==='mark'?'#c9d0de':'#6f7686',nt));
};
TN.Scene.prototype.applyGround=function(nt){
  if(!this.dayPaint||Math.abs((this.lastNt==null?-1:this.lastNt)-nt)<=0.01) return;this.lastNt=nt;
  /* snow on the ground: the land turns white (water stays water) */
  const sg=this.snowG||0;
  for(const [id,prop,d,n] of this.dayPaint){const wat=d==='#2f9fd6';
    const dd=sg>0&&!wat?TN.mix(d,'#eef2f5',0.9*sg):d,nn=sg>0&&!wat?TN.mix(n,'#394150',0.8*sg):n;
    try{this.map.setPaintProperty(id,prop,TN.mix(dd,nn,nt));}catch(e){}}
  /* the grass texture follows the same day/night and snow colours (redrawn only when the colour really changes) */
  for(const [id,c] of (this.texLayers||[])){const n=TN.NIGHTCOL[c]||TN.mix(c,'#1a2030',0.8);
    const dd=sg>0?TN.mix(c,'#eef2f5',0.9*sg):c,nn=sg>0?TN.mix(n,'#394150',0.8*sg):n;this.grassImg(c,TN.mix(dd,nn,nt),sg);}
};
/* grass texture: one seamless 256 px tile per kind of green (grass, park, wood), drawn from fixed noise so it never
   shimmers; only its colours change with night and snow */
TN.GRASS={'#6cc24a':{seed:11,dry:0.9},'#5dbb44':{seed:23,dry:0.6},'#3f9a3a':{seed:37,dry:0.25,dark:1}};
TN.grassNoise=function(seed){
  const S=256,rnd=(()=>{let a=seed*2654435761>>>0;return ()=>{a^=a<<13;a>>>=0;a^=a>>17;a^=a<<5;a>>>=0;return a/4294967296;};})();
  /* smooth noise that repeats every tile (so the tiles join without seams) */
  const layer=P=>{const g=[];for(let i=0;i<P*P;i++) g.push(rnd());const out=new Float32Array(S*S);
    for(let y=0;y<S;y++)for(let x=0;x<S;x++){const fx=x/S*P,fy=y/S*P,ix=Math.floor(fx),iy=Math.floor(fy),tx=fx-ix,ty=fy-iy;
      const sx=tx*tx*(3-2*tx),sy=ty*ty*(3-2*ty),G=(i,j)=>g[((j%P+P)%P)*P+((i%P+P)%P)];
      const a=G(ix,iy)+(G(ix+1,iy)-G(ix,iy))*sx,b=G(ix,iy+1)+(G(ix+1,iy+1)-G(ix,iy+1))*sx;out[y*S+x]=a+(b-a)*sy;}
    return out;};
  const big=layer(3),mid=layer(8),fine=layer(32),spk=new Uint8Array(S*S);
  /* little tufts: specks of dry grass / soil and darker blades, a few pixels each */
  for(let k=0;k<1400;k++){const x=Math.floor(rnd()*S),y=Math.floor(rnd()*S),t=rnd()<0.55?1:2,r=rnd()<0.3?2:1;
    for(let dy=0;dy<r;dy++)for(let dx=0;dx<r+(rnd()<0.5?1:0);dx++) spk[((y+dy)%S)*S+((x+dx)%S)]=t;}
  return {S,big,mid,fine,spk};
};
TN.Scene.prototype.grassImg=function(kind,col,snow){
  const map=this.map,cfg=TN.GRASS[kind];if(!cfg||!map||typeof document==='undefined') return null;
  const name='tn-grass-'+kind.slice(1);this.grassCol=this.grassCol||{};
  if(this.grassCol[name]===col&&map.hasImage&&map.hasImage(name)) return name;
  try{
    this.grassN=this.grassN||{};const N=this.grassN[kind]||(this.grassN[kind]=TN.grassNoise(cfg.seed)),S=N.S;
    const cv=this.grassCv||(this.grassCv=document.createElement('canvas'));cv.width=S;cv.height=S;const g=cv.getContext('2d'),im=g.createImageData(S,S),D=im.data;
    const hx=h=>[1,3,5].map(i=>parseInt(h.substr(i,2),16));
    const base=hx(col),dry=hx(TN.mix(col,'#b9a75a',0.55)),soil=hx(TN.mix(col,'#7b5b36',0.6)),dark=hx(TN.mix(col,'#16401c',0.45));
    const sn=Math.min(1,snow||0),dryK=cfg.dry*(1-sn);
    for(let i=0;i<S*S;i++){
      /* broad lighter/darker patches and a fine grain */
      const b=N.big[i],m=N.mid[i],f=N.fine[i];
      let lum=0.88+0.16*b+0.08*m+0.06*f;
      /* drier, yellower patches in the open grass */
      const dk=Math.max(0,(m-0.55)*2.2)*dryK*0.6;
      let r=base[0]+(dry[0]-base[0])*dk,gg=base[1]+(dry[1]-base[1])*dk,bb=base[2]+(dry[2]-base[2])*dk;
      if(cfg.dark){const w=Math.max(0,(0.45-b)*1.6);r+=(dark[0]-r)*w;gg+=(dark[1]-gg)*w;bb+=(dark[2]-bb)*w;}
      const t=N.spk[i];
      if(t===1&&dryK>0.1){const k=0.7*dryK;r+=(soil[0]-r)*k;gg+=(soil[1]-gg)*k;bb+=(soil[2]-bb)*k;}
      else if(t===2) lum*=0.84;
      D[i*4]=Math.max(0,Math.min(255,r*lum));D[i*4+1]=Math.max(0,Math.min(255,gg*lum));D[i*4+2]=Math.max(0,Math.min(255,bb*lum));D[i*4+3]=255;
    }
    const data={width:S,height:S,data:new Uint8Array(D.buffer.slice(0))};
    if(map.hasImage(name)) map.updateImage(name,data);else map.addImage(name,data,{pixelRatio:1});
    this.grassCol[name]=col;return name;
  }catch(e){return null;}
};
TN.Scene.prototype.reapplyNight=function(){if(this.wxNt!=null) this.applyNight(this.wxNt);};
TN.Scene.prototype.applyNight=function(nt){
  this.wxNt=nt;
  /* during the opening animation only the sky waits (the intro uses it); the ground goes to night right away */
  if(this.introActive){this.pendingNt=nt;this.setNight(nt);this.applyGround(nt);return;}
  /* a sky above the horizon: blue by day, deep night blue at night */
  try{
    /* the real weather: clouds grey the sky, rain darkens it, fog brings the haze in close */
    const W=this.weather||{cloud:0,rain:0,fog:0},cl=Math.min(1,W.cloud*0.85+W.rain*0.3),fg=Math.max(W.fog,W.rain*0.5);
    let sky=TN.mix(TN.mix('#3f7fcf','#9aa4ae',cl),TN.mix('#0d1830','#141920',cl),nt);
    let hor=TN.mix(TN.mix('#b9d3ee','#c3c9cf',cl),TN.mix('#2a3a5c','#232a33',cl),nt);   /* (a light blue haze, not near-white) */
    /* sunrise and sunset: warm orange at the horizon and a violet-blue sky, when the sun is low (less with clouds) */
    const sp=this.sunNow(),gold=sp?Math.max(0,1-Math.abs(sp.el-2)/8)*(1-0.8*cl):0;this.gold=gold;
    if(gold>0.02){sky=TN.mix(sky,'#56609a',gold*0.7);hor=TN.mix(hor,'#ffb07a',gold*0.85);}
    /* the light follows the real sun: direction, warmth at sunrise and sunset, softer under clouds */
    try{const L=this.sunLight;if(L&&sp){const el=Math.max(8,sp.el)*TN.R,az=sp.az*TN.R;L.position.set(Math.sin(az)*Math.cos(el),Math.sin(el),-Math.cos(az)*Math.cos(el));
      L.color.set(TN.mix('#ffffff','#ffc08a',gold));L.intensity=2.2*(1-0.4*cl);}
      if(this.hemiLight) this.hemiLight.intensity=1.6*(1+0.12*cl);}catch(e){}   /* (night darkening stays as before, done elsewhere) */
    const fogc=TN.mix(TN.mix('#dfe8ef','#c9cdd1',cl),TN.mix('#1c2638','#20252c',cl),nt);
    try{this.map.getContainer().style.background=fogc;}catch(e){}   /* (shows near the horizon, beyond what the map draws) */
    if(typeof this.map.setSky==='function') this.map.setSky({'sky-color':sky,'horizon-color':hor,
      'fog-color':fogc,'sky-horizon-blend':0.32+0.3*cl,'horizon-fog-blend':0.5+0.4*fg,'fog-ground-blend':0.85-0.6*fg,'atmosphere-blend':0});
  }catch(e){}
  try{
    this.map.setPaintProperty('tn-night','fill-opacity',this.extraDark||0);   /* the 'darker' end of the night brightness setting */
    this.applyGround(nt);
    {const wet=(this.weather&&this.weather.rain)||0;for(const k of ['road','curb']) if(this.mats[k]){this.tintMat(k,this.mats[k]);if(wet>0) this.mats[k].color.multiplyScalar(1-0.22*Math.min(1,wet+0.3));}}
    this.map.setPaintProperty('tn-buildings','fill-extrusion-color',TN.farBuildingColor(nt));
  }catch(e){}
  this.setNight(nt);
};
/* buildings further away (the map's own): coloured by height like the detailed ones, instead of plain cement */
TN.NIGHTCOL={'#c2c3b6':'#3a3f48','#c8c7bb':'#3d424b','#2f9fd6':'#0e2a44','#3f9a3a':'#173320','#5dbb44':'#1e3d25',
  '#6cc24a':'#21412a','#e6d39b':'#45433a'};
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
/* ---------- headlights: a real low-beam pattern laid along the road ahead ----------
   Bright wide spread just ahead, a brighter area a little to the right, a flat cut-off edge about 40 m ahead.
   It follows the road the car is on (bending with it, continuing onto the next piece), and the lane markings light
   up where it reaches, like reflective paint. Night only. */
TN.BEAMN=16;TN.BEAMSTEP=3;
TN.beamLit=function(z,x){
  const xc=z*0.04,spread=1.6+z*0.11+(x>xc?z*0.03:0),lat=Math.max(0,1-Math.abs(x-xc)/spread);
  const along=z<40?Math.max(0,1-z/48):Math.max(0,1-(z-40)/4)*0.2;return lat*along;
};
TN.BEAMU={beamP:{value:[]},beamR:{value:[]},beamOn:{value:0}};
for(let k=0;k<16;k++){TN.BEAMU.beamP.value.push(new THREE.Vector3(0,-1e6,0));TN.BEAMU.beamR.value.push(new THREE.Vector3(1,0,0));}
TN.BEAMGLSL=[
  'uniform vec3 beamP[16];uniform vec3 beamR[16];uniform float beamOn;varying vec3 vBeamW;',
  'float beamLit(float z,float x){float xc=z*0.04;float sp=1.6+z*0.11+(x>xc?z*0.03:0.0);float la=max(0.0,1.0-abs(x-xc)/sp);',
  '  float al=z<40.0?max(0.0,1.0-z/48.0):max(0.0,1.0-(z-40.0)/4.0)*0.2;return la*al;}',
  'float beamAt(){',
  '  if(beamOn<=0.0) return 0.0;float best=0.0;',
  '  for(int k=0;k<15;k++){vec2 a=beamP[k].xz,b=beamP[k+1].xz,d=b-a;float L2=dot(d,d);if(L2<0.01) continue;',
  '    float t=dot(vBeamW.xz-a,d)/L2;if(t<0.0||t>1.0) continue;',
  '    float x=dot(vBeamW.xz-a,beamR[k].xz);if(abs(x)>9.0) continue;',
  '    float z=1.5+(float(k)+t)*3.0;best=max(best,beamLit(z,x));}',
  '  return best*beamOn;}'].join('\n');
TN.Scene.prototype.beamPatch=function(mat){
  mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,TN.BEAMU);
    sh.vertexShader='varying vec3 vBeamW;\n'+sh.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvBeamW=(modelMatrix*vec4(transformed,1.0)).xyz;');
    sh.fragmentShader=TN.BEAMGLSL+'\n'+sh.fragmentShader.replace('#include <dithering_fragment>','#include <dithering_fragment>\n  gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(1.0,0.99,0.96),clamp(beamAt()*1.05,0.0,0.85));');};
  mat.needsUpdate=true;
};
TN.Scene.prototype.beamPath=function(car){
  /* points every 3 m along the road ahead of the car, shifted by the car's own place in its lane */
  const pts=[],N=TN.BEAMN,st=TN.BEAMSTEP,net=this.net;
  const straight=()=>{const h=(car.hd||0)*TN.R,ux=Math.sin(h),uz=-Math.cos(h);
    for(let k=0;k<N;k++){const d=1.5+k*st;pts.push([car.x+ux*d,(car.y||0),car.z+uz*d,uz*-1,ux]);}return pts;};
  if(!car.w||car.s==null) return straight();
  let w=car.w,dir=car.dir||1,s=car.s;
  const at=(w,s)=>{const P=w.pts;let i=0;while(i<P.length-2&&w.cum[i+1]<s) i++;const sg=w.cum[i+1]-w.cum[i]||1,t=Math.max(0,Math.min(1,(s-w.cum[i])/sg));
    return [P[i][0]+(P[i+1][0]-P[i][0])*t,P[i][1]+(P[i+1][1]-P[i][1])*t,(P[i+1][0]-P[i][0])/sg,(P[i+1][1]-P[i][1])/sg,TN.heightAt(w,s)];};
  const q0=at(w,s),rx0=-q0[3]*dir,rz0=q0[2]*dir,off=(car.x-q0[0])*rx0+(car.z-q0[1])*rz0;
  let d=1.5,guard=0;
  for(let k=0;k<N;k++){
    let target=s+dir*(k===0?1.5:st);
    while((target<0||target>w.L)&&guard++<6){
      /* continue onto the piece that carries on from this end (same street name, straightest) */
      const endJ=dir>0?w.pts.length-1:0,links=(net.keys.get(w.keys[endJ])||[]).filter(h=>h[0]!==w&&!h[0].tun);
      const over=target<0?-target:target-w.L;let best=null,bs=-1e9;
      const ex=at(w,dir>0?w.L:0),ux=ex[2]*dir,uz=ex[3]*dir;
      for(const [v,j] of links){if(j!==0&&j!==v.pts.length-1) continue;const vd=j===0?1:-1,q=at(v,j===0?0:v.L);
        const sc=(q[2]*vd*ux+q[3]*vd*uz)+(v.name&&v.name===w.name?0.5:0);if(sc>bs){bs=sc;best={v:v,vd:vd};}}
      if(!best||bs<0.3) break;
      w=best.v;dir=best.vd;target=dir>0?over:w.L-over;
    }
    target=Math.max(0,Math.min(w.L,target));s=target;
    const q=at(w,s),rx=-q[3]*dir,rz=q[2]*dir;
    pts.push([q[0]+rx*off,q[4],q[1]+rz*off,rx,rz]);d+=st;
  }
  return pts;
};
TN.Scene.prototype.updateBeam=function(car){
  if(!this.three) return;
  const on=car&&car.x!=null&&this.glowOp>0;
  TN.BEAMU.beamOn.value=on?this.glowOp:0;
  if(!this.beam){
    /* a grid along the path (16 rows) and across it (-4 m .. +8 m); brightness fixed by the low-beam pattern */
    const N=TN.BEAMN,xs=[];for(let x=-4;x<=8;x+=1) xs.push(x);this.beamXs=xs;
    const pos=new Float32Array(N*xs.length*3),col=[],idx=[];
    for(let k=0;k<N;k++) for(let c=0;c<xs.length;c++){const v=TN.beamLit(1.5+k*TN.BEAMSTEP,xs[c])*0.3;col.push(v,v*0.96,v*0.88);}   /* (0.3, was 0.5: with the lamp pools it saturated to a white patch over the lane lines) */
    for(let k=0;k<N-1;k++) for(let c=0;c<xs.length-1;c++){const a=k*xs.length+c,b=a+xs.length;idx.push(a,b,b+1,a,b+1,a+1);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(idx);
    this.beamMat=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-6,polygonOffsetUnits:-12});
    this.beam=new THREE.Mesh(g,this.beamMat);this.beam.frustumCulled=false;this.beam.renderOrder=4;this.three.scene.add(this.beam);
  }
  this.beamMat.opacity=on?this.glowOp:0;this.beam.visible=on;
  if(!on) return;
  const pts=this.beamPath(car),xs=this.beamXs,pa=this.beam.geometry.attributes.position;
  for(let k=0;k<pts.length;k++){const p=pts[k];
    TN.BEAMU.beamP.value[k].set(p[0],p[1],p[2]);TN.BEAMU.beamR.value[k].set(p[3],0,p[4]);
    for(let c=0;c<xs.length;c++){const o=(k*xs.length+c)*3;pa.array[o]=p[0]+p[3]*xs[c];pa.array[o+1]=p[1]+0.22;pa.array[o+2]=p[2]+p[4]*xs[c];}}
  pa.needsUpdate=true;
};
/* the moon: position and phase (low-precision, good to about a degree) */
TN.moonInfo=function(date,lat,lng){
  const d=(date.getTime()/86400000)-10957.5,R=TN.R;
  const Lm=218.316+13.176396*d,M=(134.963+13.064993*d)*R,F=(93.272+13.229350*d)*R;
  const lon=(Lm+6.289*Math.sin(M))*R,la=5.128*Math.sin(F)*R,e=23.439*R;
  const ra=Math.atan2(Math.sin(lon)*Math.cos(e)-Math.tan(la)*Math.sin(e),Math.cos(lon)),dec=Math.asin(Math.sin(la)*Math.cos(e)+Math.cos(la)*Math.sin(e)*Math.sin(lon));
  const gmst=(18.697374558+24.06570982441908*d)%24,ha=(gmst*15+lng)*R-ra,phi=lat*R;
  const alt=Math.asin(Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos(ha));
  const az=Math.atan2(-Math.sin(ha),Math.tan(dec)*Math.cos(phi)-Math.sin(phi)*Math.cos(ha));
  const g=(357.529+0.98560028*d)*R,sunLon=280.459+0.98564736*d+1.915*Math.sin(g);
  const el=((Lm+6.289*Math.sin(M)-sunLon)%360+360)%360;
  return {alt:alt/R,az:(az/R+360)%360,illum:(1-Math.cos(el*R))/2,waxing:el<180};
};
/* stars and the moon in the night sky: a dome around the camera; fade in with the street lights */
TN.Scene.prototype.addSky=function(){
  try{
    const N=700,pos=[];let sd=12345;const rnd=()=>{sd=(sd*16807)%2147483647;return sd/2147483647;};
    for(let i=0;i<N;i++){const az=rnd()*Math.PI*2,alt=Math.asin(0.06+rnd()*0.94),R=1300;
      pos.push(Math.sin(az)*Math.cos(alt)*R,Math.sin(alt)*R,-Math.cos(az)*Math.cos(alt)*R);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    const m=new THREE.PointsMaterial({color:0xe8eeff,size:2,sizeAttenuation:false,transparent:true,opacity:this.glowOp||0,depthWrite:false});
    this.skyStars=new THREE.Points(g,m);this.skyStars.frustumCulled=false;this.three.scene.add(this.skyStars);
    const cv=document.createElement('canvas');cv.width=cv.height=128;this.moonCv=cv;
    this.moonTex=new THREE.CanvasTexture(cv);
    this.moon=new THREE.Sprite(new THREE.SpriteMaterial({map:this.moonTex,transparent:true,opacity:0,depthWrite:false}));
    this.moon.scale.set(70,70,1);this.three.scene.add(this.moon);this.moonT=0;
    /* the sun: a bright disc with a soft glow, at its real place in the sky */
    {const c2=document.createElement('canvas');c2.width=c2.height=128;const g2=c2.getContext('2d');
     const gr=g2.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(255,255,250,1)');gr.addColorStop(0.08,'rgba(255,252,235,1)');
     gr.addColorStop(0.2,'rgba(255,240,190,.55)');gr.addColorStop(0.5,'rgba(255,225,160,.18)');gr.addColorStop(1,'rgba(255,220,150,0)');g2.fillStyle=gr;g2.fillRect(0,0,128,128);
     this.sunSpr=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c2),transparent:true,opacity:0,depthWrite:false,fog:false}));
     this.sunSpr.scale.set(220,220,1);this.three.scene.add(this.sunSpr);}
    /* clouds: a few soft shapes high in the sky (as many as the real cloud cover), drifting slowly */
    {const c3=document.createElement('canvas');c3.width=256;c3.height=128;const g3=c3.getContext('2d');let s3=99;const r3=()=>{s3=(s3*16807)%2147483647;return s3/2147483647;};
     for(let k=0;k<14;k++){const x=40+r3()*176,y=58+r3()*30-(Math.abs(x-128)<60?14:0),rr=20+r3()*26,gg=g3.createRadialGradient(x,y,0,x,y,rr);
       gg.addColorStop(0,'rgba(255,255,255,.95)');gg.addColorStop(0.6,'rgba(255,255,255,.55)');gg.addColorStop(1,'rgba(255,255,255,0)');g3.fillStyle=gg;g3.fillRect(x-rr,y-rr,2*rr,2*rr);}
     const tex=new THREE.CanvasTexture(c3);this.clouds=[];let sc=7;const rc=()=>{sc=(sc*16807)%2147483647;return sc/2147483647;};
     for(let k=0;k<22;k++){const m=new THREE.SpriteMaterial({map:tex,transparent:true,opacity:0,depthWrite:false,fog:false,color:0xffffff});const sp=new THREE.Sprite(m);
       const w=260+rc()*260;sp.scale.set(w,w*0.42,1);sp.userData={az:rc()*Math.PI*2,el:(7+rc()*24)*TN.R,ord:rc()};sp.visible=false;this.three.scene.add(sp);this.clouds.push(sp);}}
  }catch(e){}
};
/* the sun's place now (once a minute) */
TN.Scene.prototype.sunNow=function(){
  const now=Date.now();if(this.sunI&&now-this.sunT<60000) return this.sunI;
  try{const c=this.map.getCenter();this.sunT=now;this.sunI=TN.sunPos?TN.sunPos(new Date(),c.lat,c.lng):{el:TN.sunAlt(new Date(),c.lat,c.lng),az:180};}catch(e){}
  return this.sunI;
};
TN.Scene.prototype.updateSky=function(cam){
  if(!this.skyStars) return;
  this.skyStars.position.copy(cam);
  const now=Date.now();
  if(now-this.moonT>60000||!this.moonI){this.moonT=now;
    try{const c=this.map.getCenter();this.moonI=TN.moonInfo(new Date(),c.lat,c.lng);this.drawMoon(this.moonI);}catch(e){}}
  const I=this.moonI;if(!I) return;
  const al=I.alt*TN.R,az=I.az*TN.R,R=1200;
  this.moon.position.set(cam.x+Math.sin(az)*Math.cos(al)*R,cam.y+Math.sin(al)*R,cam.z-Math.cos(az)*Math.cos(al)*R);
  this.moon.material.opacity=I.alt>1?Math.min(1,this.glowOp*1.2):0;
  /* the sun and the clouds (kept far away around the camera, like the stars) */
  try{const W=this.weather||{cloud:0,rain:0,fog:0},cl=Math.min(1,(W.cloud||0)+(W.rain||0)*0.3),nt=this.night||0,sp=this.sunNow();
    if(this.sunSpr&&sp){const el=sp.el*TN.R,az=sp.az*TN.R,R=1150;
      this.sunSpr.position.set(cam.x+Math.sin(az)*Math.cos(el)*R,cam.y+Math.sin(el)*R,cam.z-Math.cos(az)*Math.cos(el)*R);
      const low=Math.max(0,1-sp.el/15);this.sunSpr.scale.setScalar(200+160*low);
      this.sunSpr.material.color.set(TN.mix('#ffffff','#ffb070',this.gold||0));
      this.sunSpr.material.opacity=sp.el>-1.5?Math.max(0,(1-0.9*cl)*(1-nt)*Math.min(1,(sp.el+1.5)/3)):0;}
    if(this.clouds){const n=cl<0.08?0:Math.round(3+cl*19),t=now/1000,col=TN.mix(TN.mix('#ffffff','#9ea6ae',Math.max(0,cl-0.5)*2),'#ffc49a',(this.gold||0)*0.7),dark=TN.mix(col,'#2a3242',nt);
      for(let k=0;k<this.clouds.length;k++){const c=this.clouds[k],u=c.userData,on=k<n;c.visible=on;if(!on) continue;
        const az=u.az+t*0.0004*(0.6+u.ord),R=1100;
        c.position.set(cam.x+Math.sin(az)*Math.cos(u.el)*R,cam.y+Math.sin(u.el)*R,cam.z-Math.cos(az)*Math.cos(u.el)*R);
        c.material.color.set(dark);c.material.opacity=(0.55+0.35*cl)*(1-0.6*nt);}}}catch(e){}
};
TN.Scene.prototype.drawMoon=function(I){
  /* the lit part of the moon for its phase */
  const g=this.moonCv.getContext('2d'),r=50,c=64;g.clearRect(0,0,128,128);
  const glow=g.createRadialGradient(c,c,r*0.8,c,c,r*1.25);glow.addColorStop(0,'rgba(220,230,255,0.25)');glow.addColorStop(1,'rgba(220,230,255,0)');
  g.fillStyle=glow;g.beginPath();g.arc(c,c,r*1.25,0,7);g.fill();
  g.fillStyle='rgba(60,66,84,0.55)';g.beginPath();g.arc(c,c,r,0,7);g.fill();
  const k=Math.cos(I.illum*Math.PI),dir=I.waxing?1:-1;
  g.fillStyle='#eef1f8';g.beginPath();
  g.arc(c,c,r,-Math.PI/2,Math.PI/2,dir<0);
  g.ellipse(c,c,Math.abs(k)*r,r,0,Math.PI/2,-Math.PI/2,(k>0)===(dir>0));
  g.fill();this.moonTex.needsUpdate=true;
};
/* timing per part (for recordings) */
TN.PROF={};TN.prof=function(k,ms){TN.PROF[k]=(TN.PROF[k]||0)+ms;};
