/* TessyNav v2 — season.js
   Seasonal effects around the car: autumn leaves (mid-September to November) drifting down in a light breeze,
   swaying and turning; snow (December to March) falling slowly. More leaves under trees, fewer on open roads.
   Built to stay light: one batch of small pieces kept around the car; fewer if the screen slows down.
   ?leaves=0 switches it off; ?leaves=snow or ?leaves=autumn shows a season for testing. */
var TN=globalThis.TN||{};globalThis.TN=TN;

TN.Season=function(scene,trees){
  this.scene=scene;this.trees=trees||null;this.mesh=null;this.parts=[];this.dens=1;this.densT=0;this.slowT=0;this.max=220;
  const q=typeof location!=='undefined'?location.search:'';
  const m=new Date().getMonth()+1,d=new Date().getDate();
  this.mode=/[?&]leaves=0/.test(q)?null:/[?&]leaves=snow/.test(q)?'snow':/[?&]leaves=autumn/.test(q)?'leaves':
    ((m===9&&d>=15)||m===10||m===11)?'leaves':(m===12||m<=3)?'snow':null;
  this.calMode=this.mode;this.t=0;this.night=0;
};
/* Canadian maple leaves: each falling leaf is the same single flat piece as before, now cut to a maple leaf's shape by a
   small picture (drawn once), so it costs the same */
TN.MAPLE=[[0,-1],[0.12,-0.76],[0.27,-0.84],[0.21,-0.42],[0.42,-0.62],[0.47,-0.5],[0.7,-0.55],[0.63,-0.3],[0.75,-0.26],[0.47,-0.02],[0.53,0.12],[0.06,0.06],[0.07,0.48],[-0.07,0.48],[-0.06,0.06],[-0.53,0.12],[-0.47,-0.02],[-0.75,-0.26],[-0.63,-0.3],[-0.7,-0.55],[-0.47,-0.5],[-0.42,-0.62],[-0.21,-0.42],[-0.27,-0.84],[-0.12,-0.76]];
TN.mapleCanvas=function(doc){
  const S=64,cv=doc.createElement('canvas');cv.width=S;cv.height=S;const g=cv.getContext('2d');
  g.clearRect(0,0,S,S);g.fillStyle='#ffffff';g.beginPath();
  TN.MAPLE.forEach((p,i)=>{const x=S/2+p[0]*S*0.46,y=S*0.52+p[1]*S*0.46;if(i) g.lineTo(x,y);else g.moveTo(x,y);});g.closePath();g.fill();
  /* a darker centre vein, so it reads as a leaf */
  g.strokeStyle='rgba(0,0,0,0.18)';g.lineWidth=2;g.beginPath();g.moveTo(S/2,S*0.52+0.48*S*0.46);g.lineTo(S/2,S*0.52-0.8*S*0.46);g.stroke();
  return cv;
};
TN.Season.prototype.build=function(){
  if(this.mesh||!this.mode||!this.scene.three) return;
  const snow=this.mode==='snow',N=this.max;
  const geo=snow?new THREE.PlaneGeometry(0.07,0.07):new THREE.PlaneGeometry(0.2,0.2);
  let map=null;if(!snow&&typeof document!=='undefined'){try{map=new THREE.CanvasTexture(TN.mapleCanvas(document));if(THREE.SRGBColorSpace) map.colorSpace=THREE.SRGBColorSpace;}catch(e){map=null;}}
  this.mat=map?new THREE.MeshBasicMaterial({side:THREE.DoubleSide,color:0xffffff,map:map,alphaTest:0.5})
    :new THREE.MeshBasicMaterial({side:THREE.DoubleSide,color:0xffffff});
  this.mesh=new THREE.InstancedMesh(geo,this.mat,N);this.mesh.frustumCulled=false;
  const cols=snow?['#ffffff','#f2f6fb','#e8eef6']:['#c8301e','#d9622b','#e8a33a','#b8452a','#d4a02a','#9e2a1c','#e07a2a'];
  const c=new THREE.Color();
  for(let i=0;i<N;i++){
    c.set(cols[i%cols.length]);this.mesh.setColorAt(i,c);
    this.parts.push({x:0,y:0,z:0,ph:Math.random()*6.3,sw:0.6+Math.random()*0.9,v:snow?0.5+Math.random()*0.5:0.8+Math.random()*0.9,
      rx:Math.random()*6.3,ry:Math.random()*6.3,rs:(Math.random()-0.5)*4,init:false});
  }
  this.scene.three.scene.add(this.mesh);
  this.o=new THREE.Object3D();
  this.setNight(this.night);   /* start in the right shade at night */
};
/* switch between falling leaves, snow and nothing (the real weather decides snow) */
TN.Season.prototype.setMode=function(mode){
  if(mode===this.mode) return;
  if(this.mesh&&this.scene.three){this.scene.three.scene.remove(this.mesh);this.mesh.geometry.dispose();}
  this.mesh=null;this.parts=[];this.mode=mode;if(mode) this.build();
};
TN.Season.prototype.setNight=function(nt){this.night=nt;if(this.mat) this.mat.color.set(TN.mix('#ffffff','#5a6070',nt*0.85));};
/* how many trees are near: leaves fall mostly where trees are */
TN.Season.prototype.density=function(cx,cz){
  const T=this.trees;if(this.mode==='snow'||!T||!T.buckets) return 1;
  let n=0;const ll=TN.fromLocal(cx,cz),k=Math.floor(ll[0]/TN.CELL)+','+Math.floor(ll[1]/TN.CELL),b=T.buckets.get(k);
  if(b) for(let i=0;i<b.length;i+=4){const dx=b[i]-cx,dz=b[i+1]-cz;if(dx*dx+dz*dz<80*80) n++;}
  return Math.max(0.3,Math.min(1,n/40));
};
TN.Season.prototype.update=function(dt,cx,cy,cz,fps){
  if(!this.mode) return;
  if(this.off){if(this.mesh) this.mesh.visible=false;return;}
  if(this.mesh) this.mesh.visible=true;this.build();if(!this.mesh) return;
  /* fewer pieces if the screen slows down, none if it stays slow */
  if(fps){if(fps<45) this.slowT++;else this.slowT=Math.max(0,this.slowT-1);
    if(this.slowT>300){this.slowT=0;this.max=Math.floor(this.max/2);if(this.max<40){this.scene.three.scene.remove(this.mesh);this.mode=null;return;}}}
  this.t+=dt;this.densT-=dt;if(this.densT<=0){this.densT=2;this.dens=this.density(cx,cz);}
  const snow=this.mode==='snow',R=24,Hh=snow?16:13,n=Math.min(this.max,Math.round(this.max*this.dens));
  /* a light breeze from the west with gentle gusts */
  const wind=snow?0.5:1.3+0.8*Math.sin(this.t*0.4)+0.4*Math.sin(this.t*1.7),wz=0.35*Math.sin(this.t*0.23);
  const o=this.o;
  for(let i=0;i<this.parts.length;i++){
    const p=this.parts[i];
    if(i>=n){o.position.set(0,-1e4,0);o.updateMatrix();this.mesh.setMatrixAt(i,o.matrix);continue;}
    if(!p.init){p.x=cx+(Math.random()*2-1)*R;p.z=cz+(Math.random()*2-1)*R;p.y=cy+Math.random()*Hh;p.init=true;}
    p.ph+=dt*(snow?1.0:2.0);
    p.y-=p.v*dt;p.x+=(wind+Math.sin(p.ph)*p.sw)*dt;p.z+=(wz+Math.cos(p.ph*0.7)*p.sw*0.5)*dt;
    if(!snow){p.rx+=p.rs*dt;p.ry+=p.rs*0.7*dt;}
    /* keep them around the car: what drifts out of the box comes back in on the other side, or from the top */
    if(p.y<cy-0.2){p.y=cy+Hh*(0.6+Math.random()*0.4);p.x=cx+(Math.random()*2-1)*R;p.z=cz+(Math.random()*2-1)*R;}
    if(p.x>cx+R) p.x-=2*R;else if(p.x<cx-R) p.x+=2*R;
    if(p.z>cz+R) p.z-=2*R;else if(p.z<cz-R) p.z+=2*R;
    o.position.set(p.x,p.y,p.z);
    if(snow) o.rotation.set(-Math.PI/2,0,0);else o.rotation.set(p.rx,p.ry,0);
    const sc=snow?1:0.8+0.4*Math.abs(Math.sin(p.ph*0.5));o.scale.set(sc,sc,sc);
    o.updateMatrix();this.mesh.setMatrixAt(i,o.matrix);
  }
  this.mesh.instanceMatrix.needsUpdate=true;
};
