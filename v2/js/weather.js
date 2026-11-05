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
    this.set(this.fromCode(T[0],T[1]));return;
  }
  try{
    const u='https://api.open-meteo.com/v1/forecast?latitude='+lat.toFixed(3)+'&longitude='+lng.toFixed(3)+'&current=weather_code,cloud_cover&timezone=auto';
    const r=await fetch(u,{cache:'no-store'});if(!r.ok) return;const j=await r.json();
    if(j&&j.current) this.set(this.fromCode(j.current.weather_code,j.current.cloud_cover));
  }catch(e){}
};
TN.Weather.prototype.set=function(w){
  const changed=w.kind!==this.kind||Math.abs(w.cloud-this.cloud)>0.1;
  Object.assign(this,w);
  const S=this.scene;S.weather={cloud:this.on?this.cloud:0,rain:this.on?this.rain:0,fog:this.on?this.fog:0};
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
  const now=Date.now();
  if(now-this.last>600000||(!this.last&&lat)){this.last=now;if(lat) this.check(lat,lng);}
  const r=this.on?this.rain:0;
  if(r<=0){if(this.lines) this.lines.visible=false;return;}
  if(!this.lines) this.buildRain();
  this.lines.visible=true;
  const P=this.lines.geometry.attributes.position.array,n=Math.floor(this.drops.length*Math.min(1,0.35+r*0.65)),len=1.1,sl=0.12;
  this.rmat.opacity=0.5-0.2*(this.scene.night||0);
  for(let i=0;i<this.drops.length;i++){
    const d=this.drops[i],o=i*6;
    if(i>=n){P[o]=P[o+1]=P[o+2]=P[o+3]=P[o+4]=P[o+5]=0;continue;}
    d.y-=d.v*dt;if(d.y<0){d.y=24+Math.random()*6;d.x=(Math.random()-0.5)*70;d.z=(Math.random()-0.5)*70;}
    const x=cx+d.x,y=(cy||0)+d.y,z=cz+d.z;
    P[o]=x;P[o+1]=y;P[o+2]=z;P[o+3]=x+sl;P[o+4]=y+len;P[o+5]=z;
  }
  this.lines.geometry.attributes.position.needsUpdate=true;
};
