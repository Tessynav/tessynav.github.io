/* TessyNav v2 — shadows.js
   Shadows that follow the real sun:
   - the sun's position from the time of day and your location; how strong the shadows are from the real weather
     (full when clear, faint when partly cloudy, none when overcast, raining or at night)
   - buildings: each building's shadow is a flat shape on the ground built once with the building; when the sun
     moves, the graphics card stretches every shadow in the new direction (nothing is rebuilt)
   - the car: a soft contact shadow under it, always, plus its own sun shadow, both following it every frame
   Overlapping shadows don't get darker (they share the same flat level, so each spot is darkened only once). */
var TN=globalThis.TN||{};globalThis.TN=TN;

/* where the sun is: azimuth (degrees from north, clockwise) and elevation (degrees above the horizon) */
TN.sunPos=function(date,lat,lng){
  const rad=Math.PI/180,d=date.getTime()/86400000+2440587.5-2451545.0;
  const g=(357.529+0.98560028*d)*rad,q=280.459+0.98564736*d;
  const L=(q+1.915*Math.sin(g)+0.020*Math.sin(2*g))*rad,e=(23.439-0.00000036*d)*rad;
  const ra=Math.atan2(Math.cos(e)*Math.sin(L),Math.cos(L)),dec=Math.asin(Math.sin(e)*Math.sin(L));
  const gmst=(18.697374558+24.06570982441908*d)%24,lst=(gmst*15+lng)*rad,H=lst-ra,la=lat*rad;
  const el=Math.asin(Math.sin(la)*Math.sin(dec)+Math.cos(la)*Math.cos(dec)*Math.cos(H));
  const az=Math.atan2(-Math.sin(H),Math.tan(dec)*Math.cos(la)-Math.sin(la)*Math.cos(H));
  return {az:((az/rad)+360)%360,el:el/rad};
};

TN.Shadows=function(scene){
  this.scene=scene;this.on=!(TN.settings&&TN.settings.shadows===false);
  /* shared by every building shadow: the stretch per metre of height, and the darkness */
  this.u={sun:{value:new THREE.Vector2(0,0)},str:{value:0}};
  this.lenK=0;this.dir=[0,1];this.strength=0;this.sunT=0;this.mat=null;this.car=null;
};
TN.Shadows.prototype.material=function(){
  if(this.mat) return this.mat;
  this.mat=new THREE.ShaderMaterial({uniforms:this.u,transparent:true,depthWrite:true,depthFunc:THREE.LessDepth,
    vertexShader:['attribute float hgt;uniform vec2 sun;',
      'void main(){vec3 p=position;p.xz+=hgt*sun;p.y=0.22;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}'].join('\n'),
    fragmentShader:['uniform float str;','void main(){gl_FragColor=vec4(0.04,0.06,0.10,0.30*str);}'].join('\n')});
  return this.mat;
};
/* a building's shadow shape: its walls stretched away from the sun, and its roof outline moved to where the sun puts it */
TN.Shadows.prototype.addBuilding=function(S,ring,H){
  if(!ring||ring.length<3||!(H>2)) return;
  const n=ring.length,V=(x,z,h)=>{S.p.push(x,0,z);S.h.push(h);return S.cnt++;};
  for(let k=0;k<n;k++){const a=ring[k],b=ring[(k+1)%n];
    const i0=V(a[0],a[1],0),i1=V(b[0],b[1],0),i2=V(b[0],b[1],H),i3=V(a[0],a[1],H);S.i.push(i0,i1,i2,i0,i2,i3);}
  let tri=null;try{tri=THREE.ShapeUtils.triangulateShape(ring.map(p=>new THREE.Vector2(p[0],p[1])),[]);}catch(e){}
  if(tri&&tri.length){const base=S.cnt;for(const p of ring) V(p[0],p[1],H);for(const t of tri) S.i.push(base+t[0],base+t[1],base+t[2]);}
};
TN.Shadows.prototype.mesh=function(S){
  if(!S||!S.cnt) return null;
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(S.p,3));g.setAttribute('hgt',new THREE.Float32BufferAttribute(S.h,1));g.setIndex(S.i);
  const m=new THREE.Mesh(g,this.material());m.frustumCulled=false;m.renderOrder=1;m.visible=this.on&&this.strength>0.08;
  (this.meshes||(this.meshes=new Set())).add(m);
  return m;
};
TN.Shadows.prototype.forget=function(m){if(this.meshes) this.meshes.delete(m);};
/* the car's two shadows: a soft blob texture */
TN.Shadows.prototype.blobTex=function(){
  if(this.tex) return this.tex;
  const c=document.createElement('canvas');c.width=64;c.height=128;const x=c.getContext('2d');
  const g=x.createRadialGradient(32,64,6,32,64,60);g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(0.55,'rgba(0,0,0,0.75)');g.addColorStop(1,'rgba(0,0,0,0)');
  x.save();x.scale(1,2);x.fillStyle=g;x.fillRect(0,0,64,64);x.restore();
  this.tex=new THREE.CanvasTexture(c);return this.tex;
};
TN.Shadows.prototype.buildCar=function(){
  const S=this.scene;if(!S.three||this.car) return;
  const mk=(op)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:this.blobTex(),transparent:true,opacity:op,depthWrite:false,color:0x000000}));
    m.rotation.x=-Math.PI/2;m.renderOrder=2;m.frustumCulled=false;S.three.scene.add(m);return m;};
  this.car={contact:mk(0.45),sun:mk(0)};
};
/* every frame: the car's shadows follow it; every 30 s: the sun and weather are checked again */
TN.Shadows.prototype.update=function(lng,lat,car){
  const now=Date.now();this.on=!(TN.settings&&TN.settings.shadows===false);
  if(now-this.sunT>30000||this.lastOn!==this.on){this.sunT=now;this.lastOn=this.on;
    const sp=TN.sunPos(new Date(now),lat,lng),w=this.scene.weather||{},night=this.scene.night||0;
    const up=Math.max(0,Math.min(1,(sp.el-3)/9));
    this.strength=this.on?up*(1-night)*(1-0.85*(w.cloud||0))*((w.rain||0)>0.2?0.25:1)*((w.fog||0)>0.3?0.35:1):0;
    this.lenK=Math.min(4,1/Math.tan(Math.max(6,sp.el)*Math.PI/180));
    const a=(sp.az+180)*Math.PI/180;this.dir=[Math.sin(a),-Math.cos(a)];   /* (local x is east, z is south) */
    this.u.sun.value.set(this.dir[0]*this.lenK,this.dir[1]*this.lenK);this.u.str.value=this.strength;
    if(this.meshes) for(const m of this.meshes) m.visible=this.strength>0.08;
    this.sun=sp;}
  if(!car||car.x==null) return;
  this.buildCar();if(!this.car) return;
  const C=this.car,y=(car.y||0)+0.24,hr=-(car.hd||0)*Math.PI/180;
  C.contact.visible=this.on;C.contact.position.set(car.x,y,car.z);C.contact.rotation.z=hr;C.contact.scale.set(2.5,5.2,1);
  C.contact.material.opacity=0.42*(1-0.35*(this.scene.night||0));
  const L=1.5*this.lenK;   /* (the car is about 1.5 m tall) */
  C.sun.visible=this.on&&this.strength>0.08&&!car.br;
  if(C.sun.visible){C.sun.position.set(car.x+this.dir[0]*L*0.5,y-0.005,car.z+this.dir[1]*L*0.5);
    /* stretched towards where the sun throws it, as long as the car plus its shadow */
    const ang=Math.atan2(this.dir[0],-this.dir[1]);C.sun.rotation.z=-ang;
    const along=Math.abs(Math.cos(ang+hr)),wide=2.0+2.6*(1-along),len=2.0+2.6*along+L;C.sun.scale.set(wide,len,1);
    C.sun.material.opacity=0.32*this.strength;}
};
