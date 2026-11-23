/* TessyNav v2 — ground.js (v2, Nov 22: snow and leaves on the car sized from the car itself)
   What lies on the ground and on the car, by season:
   - autumn (mid-September to November): fallen leaves on the roads and sidewalks around the car, more under the
     trees; a few leaves on the car's roof, hood and trunk. One batch of small leaves kept around the car and moved
     ahead as you drive (a few per frame).
   - snow on the ground (from the real weather's snow depth): sidewalks, grass and lots turn white, roads lighter;
     snow on the car's roof, hood and trunk. Only colours change on the ground: nothing new to draw.
   Off with Settings -> Leaves and snow (the same switch as the falling leaves and snow). */
var TN=globalThis.TN||{};globalThis.TN=TN;

/* snowy colours for the road areas (roads a little lighter, sidewalks and lots white) */
TN.SNOWU={snowAmt:{value:0},snowCol:{value:new THREE.Color(0.92,0.94,0.96)},carSnow:{value:0},carSnowCol:{value:new THREE.Color(0.95,0.96,0.97)}};
TN.snowPatch=function(mat,K){
  const prev=mat.onBeforeCompile,pk=mat.customProgramCacheKey?mat.customProgramCacheKey.bind(mat):null;
  mat.onBeforeCompile=(sh,r)=>{if(prev) prev(sh,r);Object.assign(sh.uniforms,TN.SNOWU);
    sh.fragmentShader='uniform float snowAmt;uniform vec3 snowCol;\n'+sh.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\n  diffuseColor.rgb=mix(diffuseColor.rgb,snowCol,snowAmt*'+K.toFixed(2)+');');};
  mat.customProgramCacheKey=()=>(pk?pk():'')+'|snow'+K;
};

TN.Ground=function(scene,net,trees,season){
  this.scene=scene;this.net=net;this.trees=trees;this.season=season;
  this.N=420;this.mesh=null;this.k=0;this.placed=0;this.snow=0;this.snowShown=-1;this.carDeco=null;
  this.cols=['#d9762b','#c9452a','#e2a72c','#a8562a','#b8862f'].map(c=>new THREE.Color(c));
};
TN.Ground.prototype.on=function(){return !(TN.settings&&TN.settings.leaves===false);};
TN.Ground.prototype.isAutumn=function(){const s=this.season;return !!(s&&s.calMode==='leaves');};
/* a flat leaf shape */
TN.Ground.prototype.build=function(){
  if(this.mesh||!this.scene.three) return;
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,-0.14, 0.09,0,0, 0,0,0.13, -0.09,0,0],3));g.setIndex([0,1,2,0,2,3]);
  const m=new THREE.MeshBasicMaterial({side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-6,polygonOffsetUnits:-12});
  this.mat=m;this.mesh=new THREE.InstancedMesh(g,m,this.N);this.mesh.frustumCulled=false;this.mesh.renderOrder=3;
  this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.count=0;this.scene.three.scene.add(this.mesh);
  this.d=new THREE.Object3D();this.pos=new Float32Array(this.N*2);
};
/* a spot for one leaf: under a tree near the car, or on a road or sidewalk; ahead of the car when moving it along */
TN.Ground.prototype.spot=function(car,ahead){
  const T=this.trees,net=this.net;
  for(let tries=0;tries<5;tries++){
    let x,z;
    const a=ahead?(car.hd||0)*Math.PI/180+(Math.random()-0.5)*2.4:Math.random()*Math.PI*2,r=ahead?35+Math.random()*40:6+Math.random()*70;
    x=car.x+Math.sin(a)*r;z=car.z-Math.cos(a)*r;
    if(T&&T.buckets&&Math.random()<0.45){   /* under a tree */
      const ll=TN.fromLocal(x,z),ck=Math.floor(ll[0]/TN.CELL)+','+Math.floor(ll[1]/TN.CELL),b=T.buckets.get(ck);
      if(b&&b.length>=4){const i=4*Math.floor(Math.random()*(b.length/4));const tx=b[i],tz=b[i+1];
        if(Math.hypot(tx-car.x,tz-car.z)<85){const rr=Math.random()*4.5,aa=Math.random()*6.283;return [tx+Math.cos(aa)*rr,tz+Math.sin(aa)*rr];}}}
    let ok=false;net.near(x,z,6,(w,k)=>{if(w.br||w.tun||ok) return;const s=TN.seg(w,k,x,z);if(s.d<TN.width(w)/2+2.5) ok=true;});
    if(ok) return [x,z];
  }
  return null;
};
TN.Ground.prototype.place=function(i,car,ahead){
  const p=this.spot(car,ahead);if(!p) return false;const d=this.d;
  d.position.set(p[0],0.235,p[1]);d.rotation.set(0,Math.random()*6.283,0);const s=0.7+Math.random()*0.7;d.scale.set(s,1,s);d.updateMatrix();
  this.mesh.setMatrixAt(i,d.matrix);this.mesh.setColorAt(i,this.cols[(Math.random()*this.cols.length)|0]);this.pos[i*2]=p[0];this.pos[i*2+1]=p[1];
  return true;
};
TN.Ground.prototype.update=function(car,dt){
  if(!car||car.x==null) return;
  const on=this.on(),S=this.scene,w=S.weather||{};
  /* snow lying on the ground (from the weather's snow depth: full at about 3 cm) */
  const target=on?Math.max(0,Math.min(1,(w.snowDepth||0)/0.03)):0;
  this.snow+=(target-this.snow)*Math.min(1,dt*0.5);
  const nt=S.night||0;TN.SNOWU.snowAmt.value=this.snow;TN.SNOWU.snowCol.value.setRGB(0.92-0.62*nt,0.94-0.62*nt,0.96-0.58*nt);
  /* (tire tracks show through the snow on the roads) */
  {const tm=S.mats&&S.mats.trk;if(tm){tm.visible=this.snow>0.05;tm.opacity=0.85*Math.min(1,this.snow*1.2);tm.color.setRGB(0.2*(1-0.5*nt),0.21*(1-0.5*nt),0.23*(1-0.45*nt));}}
  if(Math.abs(this.snow-this.snowShown)>0.04||(this.snow===0&&this.snowShown!==0)){this.snowShown=this.snow;S.snowG=this.snow;S.lastNt=null;if(S.applyGround&&S.wxNt!=null) S.applyGround(S.wxNt);}
  /* fallen leaves (autumn, and not under snow) */
  const leaves=on&&this.isAutumn()&&this.snow<0.3;
  if(leaves){this.build();if(!this.mesh) return;this.mesh.visible=true;
    this.mat.color.setRGB(1-0.62*nt,1-0.62*nt,1-0.55*nt);
    let changed=false;
    /* fill up a few at a time, then keep moving the ones left far behind to ahead of the car */
    for(let n=0;n<14&&this.placed<this.N;n++){if(this.place(this.placed,car,false)){this.placed++;changed=true;}else break;}
    this.mesh.count=this.placed;
    for(let n=0;n<10&&this.placed;n++){const i=this.k++%this.placed;if(Math.hypot(this.pos[i*2]-car.x,this.pos[i*2+1]-car.z)>85){if(this.place(i,car,true)) changed=true;}}
    if(changed){this.mesh.instanceMatrix.needsUpdate=true;if(this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate=true;}}
  else if(this.mesh) this.mesh.visible=false;
  this.decorateCar(leaves,this.snow>0.3,nt);
};
/* leaves or snow on the car: placed from the car model's own size */
TN.Ground.prototype.decorateCar=function(leaves,snow,nt){
  const c3=this.scene.car3d,body=this.scene.body3d;if(!c3||!body) return;   /* (waits for the real car model) */
  if(!this.carDeco){
    /* (Nov 22) measured from the car's own panels only: the headlamp sprites and the brake glow on the road behind made
       the box several metres too long, so the snow on the car came out as huge grey ovals floating over it */
    const p=c3.position.clone(),r=c3.rotation.y,bx=body.rotation.x,bz=body.rotation.z;
    c3.position.set(0,0,0);c3.rotation.y=0;body.rotation.x=0;body.rotation.z=0;c3.updateMatrixWorld(true);
    const B=new THREE.Box3();
    body.children.forEach(o=>{if(o.isMesh&&!o.isSprite&&!(o.geometry&&o.geometry.type==='PlaneGeometry')) B.expandByObject(o);});
    c3.position.copy(p);c3.rotation.y=r;body.rotation.x=bx;body.rotation.z=bz;c3.updateMatrixWorld(true);
    if(B.isEmpty()||B.max.z-B.min.z>6||B.max.x-B.min.x>2.6) return;
    const top=B.max.y,L=B.max.z-B.min.z,Wd=B.max.x-B.min.x,front=B.min.z,back=B.max.z;   /* (the car's front is towards -z) */
    const lg=new THREE.Group();
    const leafGeo=new THREE.BufferGeometry();leafGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,-0.12, 0.08,0,0, 0,0,0.11, -0.08,0,0],3));leafGeo.setIndex([0,1,2,0,2,3]);
    const spots=[[ -0.25,top+0.01,front+L*0.55,'#c9452a'],[0.3,top+0.01,front+L*0.62,'#e2a72c'],[0.15,top-0.36,front+L*0.12,'#d9762b'],[-0.35,top-0.42,back-L*0.06,'#a8562a'],[0.4,top-0.42,back-L*0.1,'#e2a72c']];
    for(const [x,y,z,col] of spots){const m=new THREE.Mesh(leafGeo,new THREE.MeshBasicMaterial({color:col,side:THREE.DoubleSide}));m.position.set(x*Wd/1.9,y,z);m.rotation.y=Math.random()*6;lg.add(m);}
    /* (Nov 22) snow: no extra shapes any more. The car's own paint and glass turn white where they face the sky (roof,
       hood, trunk, the tops of the mirrors), so the snow follows the car's real shape and leans with the body. */
    const sg=new THREE.Group();
    body.traverse(o=>{if(!o.isMesh||o.isSprite||(o.geometry&&o.geometry.type==='PlaneGeometry')) return;const m=o.material;if(!m||m.userData.snowP||(m.emissive&&m.emissive.getHex()>0)) return;
      m.userData.snowP=true;const prev=m.onBeforeCompile,pk=m.customProgramCacheKey?m.customProgramCacheKey.bind(m):null;
      m.onBeforeCompile=(sh,r)=>{if(prev) prev(sh,r);sh.uniforms.carSnow=TN.SNOWU.carSnow;sh.uniforms.carSnowCol=TN.SNOWU.carSnowCol;
        sh.vertexShader='varying vec3 vSnN;\n'+sh.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\n  vSnN=normalize(mat3(modelMatrix)*objectNormal);');
        sh.fragmentShader='uniform float carSnow;uniform vec3 carSnowCol;varying vec3 vSnN;\n'+sh.fragmentShader.replace('#include <color_fragment>',
          '#include <color_fragment>\n  diffuseColor.rgb=mix(diffuseColor.rgb,carSnowCol,carSnow*smoothstep(0.45,0.8,vSnN.y));');};
      m.customProgramCacheKey=()=>(pk?pk():'')+'|carsnow';m.needsUpdate=true;});
    body.add(lg);body.add(sg);this.carDeco={leaves:lg,snow:sg};   /* (on the body: they lean and dip with it) */
  }
  this.carDeco.leaves.visible=leaves;
  TN.SNOWU.carSnow.value=snow?Math.min(1,(this.snow-0.3)/0.4+0.3):0;TN.SNOWU.carSnowCol.value.setRGB(0.95-0.6*nt,0.96-0.6*nt,0.97-0.56*nt);
};
