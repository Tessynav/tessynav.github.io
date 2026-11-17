/* TessyNav v2 — garage.js (v5: needs 8 s of driving after the GPS weakens, not parked; v4: no false alarms parked outside or stopped under an overpass; v3: also notices a garage from the Tesla's weaker position estimate underground, or from its "unknown" accuracy)
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
  this.api=o;this.mode='hold';this.hist=[];this.dropSince=0;this.on=false;this.pose=null;this.good=null;this.candT=0;this.lastFixT=Date.now();this.roughSince=0;this.goodRun=0;this.grp=null;
  this.off=typeof location!=='undefined'&&/[?&]garage=0/.test(location.search);
};
/* every GPS position (from the app) */
TN.Garage.prototype.fix=function(acc,speed){
  const now=Date.now();this.lastFixT=now;acc=acc==null?99:acc;speed=speed||0;this.lastV=speed;
  /* (the Tesla keeps estimating its position underground from its wheels and motion sensors: the GPS doesn't go
     quiet, its accuracy just drops from about 2 m to 6-8 m. So that is also a sign: at parking speed, accuracy
     suddenly 2.5 times worse than the last minute's (which was good, 3.5 m or better), for 8 s. Checked on your
     recordings: it came on in the DIX30 garage and nowhere else.) */
  if(this.on){
    if(this.mode==='follow'){if(acc<=3.5||speed>11) this.leave('gps back');}
    else{if(acc<=35) this.goodRun++;else this.goodRun=0;if(this.goodRun>=3) this.leave('gps back');}
    return;}
  if(acc>35){if(!this.roughSince) this.roughSince=now;this.goodRun=0;}else{this.roughSince=0;this.goodRun++;}
  /* (and in some garages, like DIX30, the Tesla says it doesn't know its accuracy at all (10000 m), also when the app is
     opened inside the garage. Under an overpass that lasts a second or two at speed; 8 s at parking speed means a
     garage. Checked on your recordings: only the start of your Nov 16 drive out of the DIX30 garage matches.) */
  if(acc>=9999&&speed<6){if(!this.unkSince) this.unkSince=now;else if(now-this.unkSince>=8000&&!this.snooze&&!this.off){this.unkSince=0;this.enter('follow');return;}}
  else this.unkSince=0;
  this.hist=(this.hist||[]).filter(h=>now-h[0]<=60000);
  const base=this.hist.length>10?this.hist.map(h=>h[1]).sort((x,y)=>x-y)[this.hist.length>>1]:null;
  if(this.snooze&&acc<=3.5) this.snooze=false;   /* (closed by hand: not again until the GPS has been good) */
  /* (v4: not on a main street: stopped at a light under the A-10 overpass on Boulevard Leduc, the accuracy also went
     from 2.5 to 9 m and it said "underground" for 12 s. The DIX30 garage was off the streets, so this keeps it.) */
  const onMain=now-(this.mainT||0)<5000;
  const drop=!this.snooze&&!onMain&&base!=null&&base<=3.5&&acc>=6&&acc>=2.5*base&&speed<6;
  /* (v5: the 8 s only count while the car keeps moving, at least 1 m/s: driving into a garage you go on down the ramp
     and along the aisles. Parked outside on Nuns' Island, Nov 17, the accuracy also went from 2.5 to 10 m, but in the
     last 3 s of stopping, and then it said "underground" while you were parked outside. DIX30 garage: 3-4 m/s.) */
  if(drop){const dtm=this.dropLast?Math.min(1000,now-this.dropLast):0;this.dropLast=now;
    if(!this.dropSince){this.dropSince=now;this.dropMove=0;}
    if(speed>=1) this.dropMove=(this.dropMove||0)+dtm;
    if(this.dropMove>=8000&&!this.off) this.enter('follow');}
  else{this.dropSince=0;this.dropMove=0;this.dropLast=0;this.hist.push([now,acc]);}
};
/* every frame: car = what the tracking shows. Returns the car to draw (the held one while underground) */
TN.Garage.prototype.frame=function(car,v){
  if(this.off) return car;
  const now=Date.now();
  if(this.on){
    /* following the car's own estimate underground: the garage moves along when you've driven 25 m from its middle */
    if(this.mode==='follow'){if(this.wantFollow&&car&&car.x!=null){this.wantFollow=false;this.pose={x:car.x,z:car.z,y:car.y||0,hd:car.hd};try{this.build();}catch(e){}}
      if(car&&car.x!=null&&this.pose&&Math.hypot(car.x-this.pose.x,car.z-this.pose.z)>25){this.pose={x:car.x,z:car.z,y:car.y||0,hd:car.hd};this.clearGrp();try{this.build();}catch(e){}}return car;}
    return this.pose?Object.assign({},car||{},this.pose):car;}
  if(!car||car.x==null) return car;
  /* on a garage ramp or parking lane, slowly: remember it (for 20 s) and the last good spot */
  const w=car.w;
  if(w&&/^(motorway|primary|secondary|tertiary)$/.test(w.cls)) this.mainT=now;
  if(w&&w.cls==='service'&&(w.tun||w.pa||(w.layer||0)<0)&&(v||0)<9) this.candT=now;
  if(!this.roughSince&&now-this.lastFixT<2500) this.good={x:car.x,z:car.z,y:car.y||0,hd:car.hd,w:car.w,cls:car.cls,snapped:car.snapped};
  /* (v4: "quiet" only counts if you were still moving when the GPS stopped. The Tesla stops sending positions
     when the car stands still, so parked in an outdoor lot it looked like a garage: Nov 17, end of the drive.) */
  const quiet=now-this.lastFixT>6000&&(this.lastV||0)>=1.5,rough=this.roughSince&&now-this.roughSince>6000;
  if((quiet||rough)&&now-this.candT<20000&&this.good) this.enter('hold');
  return car;
};
TN.Garage.prototype.enter=function(mode){
  this.on=true;this.mode=mode||'hold';this.goodRun=0;this.dropSince=0;TN.inGarage=true;
  try{this.api.note&&this.api.note('garage',{on:true,mode:this.mode});}catch(e){}
  /* hold: the car stays where the GPS was last good; follow: the car keeps moving with the Tesla's own estimate */
  if(this.mode==='hold'){this.pose=Object.assign({},this.good);try{this.build();}catch(e){}}else this.wantFollow=true;
  try{this.card(true);}catch(e){}
  TN.garageMsg='Underground parking <span class="g">· '+(this.mode==='follow'?'GPS estimated':'GPS paused')+'</span>';
  try{document.getElementById('status').innerHTML=TN.garageMsg;}catch(e){}
};
TN.Garage.prototype.leave=function(why){
  if(!this.on) return;this.on=false;TN.inGarage=false;this.candT=0;if(why==='tapped') this.snooze=true;
  try{this.api.note&&this.api.note('garage',{on:false,why:why});}catch(e){}
  this.clearGrp();this.hist=[];
  try{this.card(false);}catch(e){}
};
TN.Garage.prototype.clearGrp=function(){if(this.grp){const sc=this.api.scene.three.scene;sc.remove(this.grp);this.grp.traverse(o=>{if(o.geometry) o.geometry.dispose();});this.grp=null;}};
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
    '<div><b>Underground parking</b><br><small style="opacity:.75">'+(this.mode==='follow'?'GPS is weak here: your car\u2019s position is the Tesla\u2019s own estimate.':'GPS paused: your car stays where the signal was lost.')+' Back to normal outside. Tap to close.</small></div>';
  el.onclick=()=>this.leave('tapped');
};
