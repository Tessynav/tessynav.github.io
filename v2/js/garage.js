/* TessyNav v2 — garage.js (v1)
   Underground parking. GPS stops working underground, so when you drive down into a garage TessyNav:
   - notices it: you were on a garage ramp or parking lane (a service road the map marks as a tunnel or parking
     aisle) at parking speed, then the GPS went quiet or very rough for 6 s
   - keeps the car where the GPS was last good (no drifting or jumping around on the streets above)
   - shows a simple garage around it: dark concrete floor, painted bays, pillars, light strips, low walls
   - says so in the status pill ("Underground parking · GPS paused")
   - goes back to normal by itself once the GPS is good again (3 good positions in a row), or when you tap the card
   Nothing is downloaded and nothing runs while you're outside. ?garage=0 turns it off. */
var TN=globalThis.TN||{};globalThis.TN=TN;
TN.Garage=function(o){
  this.api=o;this.on=false;this.pose=null;this.good=null;this.candT=0;this.lastFixT=Date.now();this.roughSince=0;this.goodRun=0;this.grp=null;
  this.off=typeof location!=='undefined'&&/[?&]garage=0/.test(location.search);
};
/* every GPS position (from the app) */
TN.Garage.prototype.fix=function(acc,speed){
  const now=Date.now();this.lastFixT=now;
  if(acc>35){if(!this.roughSince) this.roughSince=now;this.goodRun=0;}
  else{this.roughSince=0;this.goodRun++;}
  if(this.on&&this.goodRun>=3) this.leave('gps back');
};
/* every frame: car = what the tracking shows. Returns the car to draw (the held one while underground) */
TN.Garage.prototype.frame=function(car,v){
  if(this.off) return car;
  const now=Date.now();
  if(this.on) return this.pose?Object.assign({},car||{},this.pose):car;
  if(!car||car.x==null) return car;
  /* on a garage ramp or parking lane, slowly: remember it (for 20 s) and the last good spot */
  const w=car.w;
  if(w&&w.cls==='service'&&(w.tun||w.pa||(w.layer||0)<0)&&(v||0)<9) this.candT=now;
  if(!this.roughSince&&now-this.lastFixT<2500) this.good={x:car.x,z:car.z,y:car.y||0,hd:car.hd,w:car.w,cls:car.cls,snapped:car.snapped};
  const quiet=now-this.lastFixT>6000,rough=this.roughSince&&now-this.roughSince>6000;
  if((quiet||rough)&&now-this.candT<20000&&this.good) this.enter();
  return car;
};
TN.Garage.prototype.enter=function(){
  this.on=true;this.pose=Object.assign({},this.good);this.goodRun=0;TN.inGarage=true;
  try{this.api.note&&this.api.note('garage',{on:true});}catch(e){}
  try{this.build();}catch(e){}
  try{this.card(true);}catch(e){}
  try{document.getElementById('status').innerHTML='Underground parking <span class="g">· GPS paused</span>';}catch(e){}
};
TN.Garage.prototype.leave=function(why){
  if(!this.on) return;this.on=false;TN.inGarage=false;this.candT=0;
  try{this.api.note&&this.api.note('garage',{on:false,why:why});}catch(e){}
  if(this.grp){const sc=this.api.scene.three.scene;sc.remove(this.grp);this.grp.traverse(o=>{if(o.geometry) o.geometry.dispose();});this.grp=null;}
  try{this.card(false);}catch(e){}
};
/* the garage around the held car, lined up with it */
TN.Garage.prototype.build=function(){
  const S=this.api.scene;if(!S||!S.three||!this.pose) return;
  const p=this.pose,hr=(p.hd||0)*TN.R,fx=Math.sin(hr),fz=-Math.cos(hr),rx=-fz,rz=fx,y0=(p.y||0)+0.12;
  const pos=[],col=[];
  const P=(a,b,y)=>[p.x+rx*a+fx*b,y,p.z+rz*a+fz*b];   /* a: to the right, b: ahead */
  const quad=(A,B,C,D,k)=>{for(const q of [A,B,C,A,C,D]){pos.push(q[0],q[1],q[2]);col.push(k[0],k[1],k[2]);}};
  const flat=(a0,a1,b0,b1,y,k)=>quad(P(a0,b0,y),P(a1,b0,y),P(a1,b1,y),P(a0,b1,y),k);
  const box=(a0,a1,b0,b1,h,k)=>{const s=[k[0]*0.8,k[1]*0.8,k[2]*0.8];flat(a0,a1,b0,b1,y0+h,k);
    quad(P(a0,b0,y0),P(a1,b0,y0),P(a1,b0,y0+h),P(a0,b0,y0+h),s);quad(P(a0,b1,y0),P(a1,b1,y0),P(a1,b1,y0+h),P(a0,b1,y0+h),s);
    quad(P(a0,b0,y0),P(a0,b1,y0),P(a0,b1,y0+h),P(a0,b0,y0+h),k);quad(P(a1,b0,y0),P(a1,b1,y0),P(a1,b1,y0+h),P(a1,b0,y0+h),k);};
  const R=55,FL=[0.23,0.24,0.25],LN=[0.85,0.85,0.80],PIL=[0.55,0.55,0.53],WALL=[0.30,0.31,0.32],LIT=[1,0.98,0.88],YEL=[0.85,0.70,0.15];
  flat(-R,R,-R,R,y0,FL);
  /* the driving lane the car is in, then rows of bays on both sides (2.6 m wide, 5.2 m deep), pillars every 3 bays */
  for(const side of [-1,1]){const a0=side*3.2,a1=side*(3.2+5.2);
    for(let b=-R+2;b<R-2;b+=2.6){flat(Math.min(a0,a1),Math.max(a0,a1),b-0.06,b+0.06,y0+0.01,LN);}
    for(let b=-R+2;b<R-2;b+=7.8) box(side*8.6-0.35,side*8.6+0.35,b-0.35,b+0.35,2.6,PIL);
    /* a second lane and row further out */
    const c0=side*14.6,c1=side*19.8;for(let b=-R+2;b<R-2;b+=2.6) flat(Math.min(c0,c1),Math.max(c0,c1),b-0.06,b+0.06,y0+0.01,LN);
    for(let b=-R+2;b<R-2;b+=7.8) box(side*20.2-0.35,side*20.2+0.35,b-0.35,b+0.35,2.6,PIL);}
  /* yellow arrows down the lane, and light strips above it */
  for(let b=-R+6;b<R-6;b+=14){quad(P(-0.5,b,y0+0.02),P(0.5,b,y0+0.02),P(0,b+1.6,y0+0.02),P(0,b+1.6,y0+0.02),YEL);
    flat(-0.12,0.12,b-0.5,b+0.5,y0+0.02,YEL);}
  for(let b=-R+4;b<R-4;b+=6) for(const a of [-11.5,0,11.5]) flat(a-0.15,a+0.15,b-1.2,b+1.2,y0+2.75,LIT);
  /* low walls all around (they hide the streets above, far away) */
  for(const [a0,a1,b0,b1] of [[-R,R,-R,-R+0.4],[-R,R,R-0.4,R],[-R,-R+0.4,-R,R],[R-0.4,R,-R,R]]) box(a0,a1,b0,b1,3.2,WALL);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4}));
  m.renderOrder=2;m.frustumCulled=false;this.grp=new THREE.Group();this.grp.add(m);S.three.scene.add(this.grp);
};
/* the small card at the top: what's happening, and a tap to go back to normal */
TN.Garage.prototype.card=function(show){
  if(typeof document==='undefined') return;let el=document.getElementById('tn-garage');
  if(!show){if(el) el.remove();return;}
  if(!el){el=document.createElement('div');el.id='tn-garage';el.className='hud notr';document.body.appendChild(el);
    el.style.cssText='position:absolute;left:50%;top:84px;transform:translateX(-50%);z-index:9;display:flex;align-items:center;gap:12px;padding:10px 16px;border-radius:14px;font:15px/1.35 system-ui,sans-serif;max-width:min(520px,calc(100vw - 32px));cursor:pointer';}
  el.innerHTML='<span style="flex:none;width:34px;height:34px;border-radius:9px;background:#2f6fe4;color:#fff;display:flex;align-items:center;justify-content:center;font:800 20px system-ui">P</span>'+
    '<div><b>Underground parking</b><br><small style="opacity:.75">GPS paused: your car stays where the signal was lost. Back to normal outside. Tap to close.</small></div>';
  el.onclick=()=>this.leave('tapped');
};
