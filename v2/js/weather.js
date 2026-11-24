/* TessyNav v2 — weather.js
   The scene follows today's real weather where the car is (Open-Meteo, free, no account; checked every 10 minutes):
   - clear: as before; cloudy / overcast: a greyer, flatter sky
   - rain (and drizzle, showers, thunderstorms): falling rain streaks, a darker sky, wet darker roads
   - snow: the snowfall, switched on by the real weather instead of the calendar
   - fog: a hazy horizon
   Test it with ?weather=rain, ?weather=snow, ?weather=fog or ?weather=cloudy in the address. */
var TN=globalThis.TN||{};globalThis.TN=TN;

TN.Weather=function(scene,season){
  this.scene=scene;this.season=season||null;this.on=true;
  TN.wx=this;this.wind=0;this.windDir=0;this.carV=0;this.carHd=0;
  this.kind='clear';this.cloud=0;this.rain=0;this.snow=0;this.fog=0;this.last=0;this.lines=null;this.t=0;
  const m=typeof location!=='undefined'&&location.search.match(/[?&]weather=(\w+)/);this.test=m?m[1]:null;
};
/* weather codes (WMO) to what we draw */
TN.Weather.prototype.fromCode=function(code,cloud){
  let kind='clear',rain=0,snow=0,fog=0,cl=Math.max(0,Math.min(1,(cloud||0)/100));
  if(code===45||code===48){kind='fog';fog=1;cl=Math.max(cl,0.8);}
  else if((code>=51&&code<=57)){kind='rain';rain=0.35;}
  else if((code>=61&&code<=67)||(code>=80&&code<=82)){kind='rain';rain=code===61||code===80?0.55:code===63||code===81?0.8:1;}
  else if((code>=71&&code<=77)||code===85||code===86){kind='snow';snow=code===71||code===85?0.5:1;}
  else if(code>=95){kind='rain';rain=1;}
  else if(code===3){kind='overcast';}
  else if(code===2){kind='cloudy';}
  if(rain||snow) cl=Math.max(cl,0.85);
  return {kind:kind,cloud:cl,rain:rain,snow:snow,fog:fog};
};
TN.Weather.prototype.check=async function(lat,lng){
  if(this.test){
    const T={rain:[63,90],snow:[73,95],fog:[45,90],cloudy:[3,95],clear:[0,0]}[this.test]||[0,0];
    const w=this.fromCode(T[0],T[1]);w.snowDepth=this.test==='snow'?0.1:0;if(this.test==='rain'||this.test==='snow'){this.wind=6;this.windDir=270;}this.set(w);return;
  }
  try{
    const u='https://api.open-meteo.com/v1/forecast?latitude='+lat.toFixed(3)+'&longitude='+lng.toFixed(3)+'&current=temperature_2m,is_day,weather_code,cloud_cover,snow_depth,wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=auto';
    const r=await fetch(u,{cache:'no-store'});if(!r.ok) return;const j=await r.json();
    if(j&&j.current){const w=this.fromCode(j.current.weather_code,j.current.cloud_cover);w.snowDepth=+j.current.snow_depth||0;this.wind=+j.current.wind_speed_10m||0;this.windDir=+j.current.wind_direction_10m||0;this.temp=j.current.temperature_2m;this.code=j.current.weather_code;this.isDay=j.current.is_day;this.set(w);}
  }catch(e){}
};
TN.Weather.prototype.set=function(w){
  const changed=w.kind!==this.kind||Math.abs(w.cloud-this.cloud)>0.1;
  Object.assign(this,w);
  const S=this.scene;S.weather={cloud:this.on?this.cloud:0,rain:this.on?this.rain:0,fog:this.on?this.fog:0,snowDepth:this.on?(this.snowDepth||0):0};
  if(changed&&S.reapplyNight) S.reapplyNight();
  /* snowfall follows the real weather (the calendar decides only when the weather is not snowy) */
  if(this.season&&this.season.setMode){
    if(this.on&&this.snow>0) this.season.setMode('snow');
    else if(this.season.mode==='snow'&&this.season.calMode!=='snow') this.season.setMode(this.season.calMode);
  }
};
TN.Weather.prototype.setOn=function(on){this.on=on;this.set({kind:this.kind,cloud:this.cloud,rain:this.rain,snow:this.snow,fog:this.fog});if(!on&&this.lines) this.lines.visible=false;};
/* rain: light streaks falling around the car */
TN.Weather.prototype.buildRain=function(){
  const N=900,pos=new Float32Array(N*6);this.drops=[];
  for(let i=0;i<N;i++) this.drops.push({x:(Math.random()-0.5)*70,y:Math.random()*30,z:(Math.random()-0.5)*70,v:11+Math.random()*4});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  this.rmat=new THREE.LineBasicMaterial({color:0xc8d4e0,transparent:true,opacity:0.5,depthWrite:false});
  this.lines=new THREE.LineSegments(g,this.rmat);this.lines.frustumCulled=false;this.lines.renderOrder=6;
  this.scene.three.scene.add(this.lines);
};
TN.Weather.prototype.update=function(dt,lat,lng,cx,cy,cz){
  if(!this.scene.three) return;
  /* (Premium: rain, snow and fog on the map; switched off without it, back on with it if the setting is on) */
  const now=Date.now();
  /* (Nov 24) the 10-minute timer starts only once the car's position is known, so the first check isn't lost at start-up */
  if(lat&&now-this.last>(this.temp==null&&this.last?60000:600000)){this.last=now;this.check(lat,lng);}
  {const pro=!TN.isPro||TN.isPro();if(!pro&&this.on){this.proOff=true;this.setOn(false);}
   else if(pro&&this.proOff){this.proOff=false;this.setOn(!(TN.settings&&TN.settings.weather===false));}
   if(!pro) return;}
  const r=this.on?this.rain:0;
  /* (Nov 22) wet roads: wet within a minute of rain starting, drying slowly (a few minutes) after it stops */
  if(TN.WETU){const wt=this.on?Math.min(1,r*1.3):0,W=TN.WETU.wet;W.value+=(wt-W.value)*Math.min(1,dt*(wt>W.value?0.05:0.008));if(this.test) W.value=wt;
    const nt=this.scene.night||0;TN.WETU.wetSky.value.setRGB(0.6+(0.5-0.6)*nt,0.65+(0.44-0.65)*nt,0.7+(0.36-0.7)*nt);}
  try{this.splash(dt,cx,cy||0,cz);}catch(e){}
  if(r<=0){if(this.lines) this.lines.visible=false;return;}
  if(!this.lines) this.buildRain();
  this.lines.visible=true;
  const P=this.lines.geometry.attributes.position.array,n=Math.floor(this.drops.length*Math.min(1,0.35+r*0.65)),len=1.1;
  /* (Nov 22) the rain slants: blown by the real wind, and coming at you as you drive (like through a windshield).
     The wind blows FROM its direction; the car's own motion makes the rain seem to come from ahead. */
  let wx=0,wz=0;{const wd=(this.windDir||0)*TN.R,ws=Math.min(15,this.wind||0);wx=-Math.sin(wd)*ws;wz=Math.cos(wd)*ws;}
  let rx=wx,rz=wz;{const ch=(this.carHd||0)*TN.R,cv=Math.min(30,this.carV||0);rx-=Math.sin(ch)*cv;rz+=Math.cos(ch)*cv;}
  {const h=Math.hypot(rx,rz);if(h>18){rx*=18/h;rz*=18/h;}}
  const tau=len/13,sx=-rx*tau,sz=-rz*tau;
  this.rmat.opacity=0.5-0.2*(this.scene.night||0);
  for(let i=0;i<this.drops.length;i++){
    const d=this.drops[i],o=i*6;
    if(i>=n){P[o]=P[o+1]=P[o+2]=P[o+3]=P[o+4]=P[o+5]=0;continue;}
    d.y-=d.v*dt;d.x+=wx*dt*0.5;d.z+=wz*dt*0.5;if(d.x>35) d.x-=70;else if(d.x<-35) d.x+=70;if(d.z>35) d.z-=70;else if(d.z<-35) d.z+=70;if(d.y<0){d.y=24+Math.random()*6;d.x=(Math.random()-0.5)*70;d.z=(Math.random()-0.5)*70;}
    const x=cx+d.x,y=(cy||0)+d.y,z=cz+d.z;
    P[o]=x;P[o+1]=y;P[o+2]=z;P[o+3]=x+sx;P[o+4]=y+len;P[o+5]=z+sz;
  }
  this.lines.geometry.attributes.position.needsUpdate=true;
};

/* (Nov 22) spray from the wheels: on wet roads, water flies up behind the tyres (more and higher at speed); on snow,
   a little white powder. Small droplets with gravity, at most 400, only while moving. */
TN.Weather.prototype.splash=function(dt,cx,cy,cz){
  const wet=TN.WETU?TN.WETU.wet.value:0,snow=TN.SNOWU?TN.SNOWU.snowAmt.value:0,v=this.carV||0;
  const amt=Math.max(wet,snow*0.8),on=this.on&&amt>0.15&&!(TN.tunnel&&TN.tunnel.k>0.3);
  if(!this.sp){if(!on||v<2) return;
    const N=400,g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(N*3),3));
    /* (small droplets of a fixed size on screen: thin lines were too fine to see from the driving camera) */
    let dot=null;try{const cv=document.createElement('canvas');cv.width=cv.height=16;const gx=cv.getContext('2d'),gr=gx.createRadialGradient(8,8,0,8,8,8);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(0.6,'rgba(255,255,255,0.7)');gr.addColorStop(1,'rgba(255,255,255,0)');gx.fillStyle=gr;gx.fillRect(0,0,16,16);dot=new THREE.CanvasTexture(cv);}catch(e){}
    this.spMat=new THREE.PointsMaterial({map:dot,color:0xe8eef4,size:Math.max(3,Math.round(3.5*(window.devicePixelRatio||1))),sizeAttenuation:false,transparent:true,opacity:0.7,depthWrite:false});
    this.sp=new THREE.Points(g,this.spMat);this.sp.frustumCulled=false;this.sp.renderOrder=6;this.scene.three.scene.add(this.sp);
    this.spP=[];for(let i=0;i<N;i++) this.spP.push({life:0,x:0,y:0,z:0,vx:0,vy:0,vz:0});this.spT=0;}
  const P=this.spP,A=this.sp.geometry.attributes.position.array,hd=(this.carHd||0)*TN.R,fx=Math.sin(hd),fz=-Math.cos(hd),rx=Math.cos(hd),rz=Math.sin(hd);
  const nt=this.scene.night||0,sn=snow*0.8>wet;
  this.spMat.color.setRGB(0.92-0.5*nt,0.94-0.5*nt,0.96-0.45*nt);this.spMat.opacity=sn?0.85:0.7;
  /* new spray: 4 wheels, more at speed */
  if(on&&v>2){this.spT+=dt*Math.min(420,v*22*amt);
    let i=0;while(this.spT>=1){this.spT-=1;while(i<P.length&&P[i].life>0) i++;if(i>=P.length) break;const p=P[i];
      const back=Math.random()<0.7,side=Math.random()<0.5?-1:1,ax=back?-1.35:1.45,sx=side*0.8;
      p.x=cx+fx*ax+rx*sx;p.z=cz+fz*ax+rz*sx;p.y=cy+0.15;
      const up=(sn?1.2:1.8)+Math.random()*(1.5+v*0.1),out=side*(0.6+Math.random()*1.8),fw=v*(0.45+Math.random()*0.35);
      p.vx=fx*fw+rx*out;p.vz=fz*fw+rz*out;p.vy=up;p.life=0.5+Math.random()*0.4;}}
  let any=false;
  for(let i=0;i<P.length;i++){const p=P[i],o3=i*3;
    if(p.life<=0){A[o3]=0;A[o3+1]=-1e4;A[o3+2]=0;continue;}any=true;
    p.life-=dt;p.vy-=9.8*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.y<cy+0.05){p.life=0;}
    A[o3]=p.x;A[o3+1]=p.y;A[o3+2]=p.z;}
  this.sp.visible=any;this.sp.geometry.attributes.position.needsUpdate=true;
};
/* ---------- drops on the screen (Nov 22) ----------
   When it really rains or snows where you are, a few drops land on the screen, as if on the windshield:
   - rain: clear drops that grow, then run down and fade; at speed they slide sideways off the edges
   - snow: soft flakes that land and melt
   Only near the edges and corners of the screen, never over the middle of the road, so the route and the next turn
   always stay easy to see. Not in tunnels. Light: a small 2D layer, at most 28 drops, drawn 30 times a second.
   Settings -> 3D world -> Drops on the screen (on by default). Test: ?weather=rain or ?weather=snow. */
TN.ScreenDrops=function(){
  if(typeof document==='undefined') return;
  const c=document.createElement('canvas');c.id='tn-drops';
  c.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2';
  (document.getElementById('map')||document.body).parentNode.appendChild(c);
  this.c=c;this.x=c.getContext('2d');this.d=[];this.t=0;this.last=0;
  const loop=(ts)=>{requestAnimationFrame(loop);if(ts-this.last<33) return;const dt=Math.min(0.1,(ts-(this.last||ts))/1000);this.last=ts;try{this.step(dt);}catch(e){}};
  requestAnimationFrame(loop);
};
TN.ScreenDrops.prototype.step=function(dt){
  const w=TN.wx,S=TN.settings||{};
  const pro=!TN.isPro||TN.isPro();
  const inTun=TN.tunnel&&TN.tunnel.k>0.3;
  let rain=0,snow=0;
  if(w&&w.on&&pro&&S.screenDrops!==false&&S.weather!==false&&!inTun){rain=w.rain||0;snow=w.snow||0;}
  const c=this.c,W=c.clientWidth,H=c.clientHeight;
  if(!this.d.length&&!rain&&!snow){if(this.drawn){this.x.clearRect(0,0,c.width,c.height);this.drawn=false;}return;}
  if(c.width!==W||c.height!==H){c.width=W;c.height=H;}
  const v=w?Math.min(30,w.carV||0):0;
  /* new drops: more in heavy rain, a few more when moving */
  const rate=rain?(2+rain*5)*(0.6+Math.min(1,v/20)*0.6):snow?1.5+snow*2.5:0;
  this.t+=rate*dt;
  while(this.t>=1&&this.d.length<28){this.t-=1;
    /* a spot near the edges: outside an oval around the middle of the road */
    let px,py,k=0;do{px=Math.random()*W;py=Math.random()*H;const ex=(px-W*0.5)/(W*0.36),ey=(py-H*0.58)/(H*0.42);k++;if(ex*ex+ey*ey>1) break;}while(k<12);
    if(k>=12) continue;
    this.d.push({x:px,y:py,r:snow&&!rain?3+Math.random()*4:4.5+Math.random()*6,age:0,life:snow&&!rain?2.5+Math.random()*2:3+Math.random()*3,vy:0,snow:!!(snow&&!rain),side:px<W/2?-1:1});}
  if(this.t>1) this.t=1;
  const x=this.x;x.clearRect(0,0,W,H);this.drawn=true;
  const night=(w&&w.scene&&w.scene.night)||0;
  for(let i=this.d.length-1;i>=0;i--){const d=this.d[i];d.age+=dt;
    if(d.age>d.life){this.d.splice(i,1);continue;}
    if(!d.snow){
      /* rain: grows a little, then the bigger ones start to run down; at speed the air pushes them out to the sides */
      if(d.r<12) d.r+=dt*1;
      if(d.r>9||d.age>1.5){d.vy=Math.min(120,d.vy+dt*60);d.y+=d.vy*dt;}
      d.x+=d.side*v*dt*2.2;
    }
    /* (a drop running down into the middle of the road fades away quickly: the middle always stays clear) */
    {const ex=(d.x-W*0.5)/(W*0.36),ey=(d.y-H*0.58)/(H*0.42);if(ex*ex+ey*ey<1&&d.age<d.life-0.4) d.age=d.life-0.4;}
    const f=Math.min(1,d.age/0.15)*Math.max(0,1-Math.max(0,d.age-(d.life-0.8))/0.8);
    if(d.snow){
      const g=x.createRadialGradient(d.x,d.y,0,d.x,d.y,d.r);
      g.addColorStop(0,'rgba(255,255,255,'+(0.85*f)+')');g.addColorStop(1,'rgba(255,255,255,0)');
      x.fillStyle=g;x.beginPath();x.arc(d.x,d.y,d.r,0,6.283);x.fill();
    }else{
      /* a clear drop: a faint dark rim at the bottom, a bright highlight at the top, like light through water */
      const r=d.r,a=f*(0.85-0.2*night);
      if(d.vy>20){x.fillStyle='rgba(200,215,230,'+(a*0.25)+')';x.fillRect(d.x-r*0.25,d.y-r*3,r*0.5,r*3);}   /* the trail it leaves */
      const g=x.createRadialGradient(d.x-r*0.25,d.y-r*0.35,r*0.1,d.x,d.y,r);
      g.addColorStop(0,'rgba(255,255,255,'+(a*0.95)+')');g.addColorStop(0.3,'rgba(225,235,245,'+(a*0.45)+')');g.addColorStop(0.75,'rgba(150,170,190,'+(a*0.25)+')');g.addColorStop(0.92,'rgba(30,40,55,'+(a*0.55)+')');g.addColorStop(1,'rgba(30,40,55,0)');
      x.fillStyle=g;x.beginPath();x.ellipse(d.x,d.y,r*0.9,r,0,0,6.283);x.fill();
    }
    if(d.y>H+20||d.x<-20||d.x>W+20) this.d.splice(i,1);
  }
};
