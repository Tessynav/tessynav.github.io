/* TessyNav v2 — parking.js (v2: ?parkdemo preview)
   "Can I park here?" — when you stop for a while (or arrive) on a street the City of Montréal has parking signs for,
   Rocco reads the signs on your side of the street and says whether you can park right now, until when, and what
   comes next (street cleaning, rush-hour no-stopping, permit zones). Test areas: Ville-Marie and Le Sud-Ouest
   (Verdun's data is still mostly missing at the City). Rules are built weekly by parking.py in tessynav-roads.
   From the City's signs, for information: the real sign always wins. ?park=0 switches it off. */
var TN=globalThis.TN||{};globalThis.TN=TN;
TN.PARK_BASE='https://raw.githubusercontent.com/Tessynav/tessynav-roads/main/parking/';
TN.PARK_AREAS=['ville-marie','sud-ouest','verdun'];
TN.Parking=function(o){
  this.getCar=o.getCar;this.getSpeed=o.getSpeed;this.note=o.note||function(){};
  this.on=!(typeof location!=='undefined'&&/[?&]park=0/.test(location.search));
  this.grid=new Map();this.loaded=false;this.stillT=0;this.shownAt=null;this.el=null;
  if(this.on) this.load();
};
/* the rules, once per session (kept by Tessy's storage when it has it) */
TN.Parking.prototype.load=async function(){
  for(const a of TN.PARK_AREAS){
    try{const url=TN.PARK_BASE+a+'.json';
      const r=await fetch(url);if(!r.ok) continue;const j=await r.json();   /* (the browser keeps it a few minutes; the rules change weekly) */
      if(!j||!j.signs) continue;
      for(const s of j.signs){const q=TN.toLocal(s[0],s[1]),k=Math.floor(q[0]/80)+','+Math.floor(q[1]/80);
        let l=this.grid.get(k);if(!l){l=[];this.grid.set(k,l);}l.push({x:q[0],z:q[1],arrow:s[2],r:s[3],txt:s[4],pole:s[5]});}
    }catch(e){}
  }
  this.loaded=this.grid.size>0;
  /* a preview from anywhere (?parkdemo): Rocco reads a real sign in Griffintown / Saint-Henri as if you were
     parked beside it, so the feature can be seen without driving there */
  if(this.loaded&&typeof location!=='undefined'&&/[?&]parkdemo/.test(location.search)) setTimeout(()=>this.demo(),3000);
};
TN.Parking.prototype.demo=function(){
  const all=[];for(const l of this.grid.values()) for(const s of l) all.push(s);
  const kinds=['lim','np','res','ns'],pick=kinds.map(k=>all.find(s=>s.r.k===k&&(k!=='np'||s.r.h))).filter(Boolean);
  this.demoI=this.demoI||0;if(this.demoI>=pick.length){this.demoI=0;return;}   /* (each example once, 9 s each) */
  const s=pick[this.demoI++];if(!s) return;
  for(const hd of [0,90,180,270]){const r=hd*Math.PI/180,car={x:s.x-Math.cos(r)*6,z:s.z-Math.sin(r)*6,hd:hd};
    const near=this.near(car),v=near.length?this.verdict(near,new Date()):null;
    if(v){v.t='[Preview] '+v.t;this.show(v,near);this.shownAt=Date.now();this.demoT=setTimeout(()=>{this.hide();this.demo();},9000);return;}}
};
/* is a rule in force at a time (days 0 = Monday, hours in minutes, season [month, day, month, day]) */
TN.parkActive=function(r,d){
  if(r.s){const md=(d.getMonth()+1)*100+d.getDate(),a=r.s[0]*100+r.s[1],b=r.s[2]*100+r.s[3];if(a<=b?(md<a||md>b):(md<a&&md>b)) return false;}
  const wd=(d.getDay()+6)%7,mins=d.getHours()*60+d.getMinutes();
  const dayOk=x=>!r.d||r.d.includes(x);
  if(!r.h) return dayOk(wd);
  for(const [a,b] of r.h){
    if(a<b){if(dayOk(wd)&&mins>=a&&mins<b) return true;}
    else{/* overnight (18h-09h): the evening part belongs to today, the morning part to yesterday's rule */
      if(dayOk(wd)&&mins>=a) return true;if(dayOk((wd+6)%7)&&mins<b) return true;}
  }
  return false;
};
/* when it next changes (in force <-> not), searching ahead in 15-minute steps up to 3 days; a Date or null */
TN.parkNextChange=function(r,d){
  const now=TN.parkActive(r,d);const t=new Date(d.getTime());t.setSeconds(0,0);t.setMinutes(Math.ceil(t.getMinutes()/15)*15);
  for(let i=0;i<4*24*3;i++){t.setTime(t.getTime()+15*60000);if(TN.parkActive(r,t)!==now) return new Date(t.getTime());}
  return null;
};
/* the signs on your side of the street, near the car: right side (left too on a one-way street), within 45 m along */
TN.Parking.prototype.near=function(car){
  const hd=car.hd*Math.PI/180,fx=Math.sin(hd),fz=-Math.cos(hd),rx=-fz,rz=fx,out=[];
  const gx=Math.floor(car.x/80),gz=Math.floor(car.z/80);
  for(let i=gx-1;i<=gx+1;i++) for(let j=gz-1;j<=gz+1;j++){const l=this.grid.get(i+','+j);if(!l) continue;
    for(const s of l){const dx=s.x-car.x,dz=s.z-car.z,along=dx*fx+dz*fz,side=dx*rx+dz*rz;
      if(Math.abs(along)<45&&side>1.5&&side<16) out.push(Object.assign({along:along,side:side},s));}}
  out.sort((a,b)=>Math.hypot(a.along,a.side*0.5)-Math.hypot(b.along,b.side*0.5));
  /* only the nearest pole's signs: a street has many poles, and mixing them (a corner's "no stopping at any time"
     with the street cleaning sign by your spot) made every spot look forbidden */
  if(!out.length) return out;const pole=out[0].pole;
  return out.filter(x=>x.pole===pole||(!pole&&Math.hypot(x.x-out[0].x,x.z-out[0].z)<1));
};
/* what Rocco says, from the signs around: colour (green / orange / red) and a sentence, plus the signs' texts */
TN.Parking.prototype.verdict=function(signs,d){
  const hm=x=>{const h=x.getHours(),m=x.getMinutes();return TN.LANG==='fr'?h+' h'+(m?' '+String(m).padStart(2,'0'):''):((h%12)||12)+(m?':'+String(m).padStart(2,'0'):'')+(h<12?' am':' pm');};
  const dayN=x=>{const t=new Date();t.setHours(0,0,0,0);const dd=Math.round((new Date(x.getFullYear(),x.getMonth(),x.getDate())-t)/86400000);
    return dd===0?'':dd===1?' tomorrow':' '+['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][x.getDay()];};
  const bans=signs.filter(s=>s.r.k==='np'||s.r.k==='ns'),res=signs.filter(s=>s.r.k==='res'),lim=signs.filter(s=>s.r.k==='lim'),pay=signs.filter(s=>s.r.k==='pay');
  const zoneTxt=s=>s.r.z&&s.r.x?' (except permit '+s.r.z+')':'';
  /* a ban in force now */
  const nowBan=bans.find(s=>TN.parkActive(s.r,d));
  if(nowBan){const end=TN.parkNextChange(nowBan.r,d);
    return {c:'red',t:(nowBan.r.k==='ns'?'No stopping here':'No parking here')+(end?' until '+hm(end)+dayN(end):' at any time')+zoneTxt(nowBan)+'.',s:nowBan};}
  const nowRes=res.find(s=>TN.parkActive(s.r,d));
  if(nowRes){const why={handicap:'disabled parking permits',hotel:'the hotel',delivery:'deliveries',taxi:'taxis',bus:'buses',carshare:'car-sharing',ev:'electric cars charging',dropoff:'drop-off'}[nowRes.r.why]||'reserved use';
    return {c:'red',t:'This spot is reserved for '+why+'.',s:nowRes};}
  /* free now: when does the next ban start? */
  let next=null,nb=null;for(const s of bans){const c=TN.parkNextChange(s.r,d);if(c&&(!next||c<next)){next=c;nb=s;}}
  const limNow=lim.find(s=>TN.parkActive(s.r,d)),payNow=pay.find(s=>TN.parkActive(s.r,d));
  let t='You can park here',c='green';
  if(next&&next-d<24*3600000){t+=' until '+hm(next)+dayN(next);c=next-d<3*3600000?'orange':'green';}
  if(limNow) t+=' \u00b7 '+(limNow.r.m>=60?(limNow.r.m/60)+' h':limNow.r.m+' min')+' max';
  if(payNow) t+=' \u00b7 paid parking';
  t+='.';
  if(nb&&next&&next-d<24*3600000) t+=' Then: '+nb.txt.replace(/^\\[PA]\s*/,m=>m.indexOf('A')>=0?'no stopping ':'no parking ')+'.';
  if(!signs.length) return null;
  return {c:c,t:t,s:nb||limNow||payNow||signs[0]};
};
TN.Parking.prototype.show=function(v,signs){
  if(typeof document==='undefined') return;
  if(!this.el){const st=document.createElement('style');
    st.textContent='#tn-park{position:absolute;left:16px;bottom:120px;z-index:6;max-width:min(440px,calc(100vw - 32px));background:rgb(var(--tn-panel-rgb,24 26 30) / .94);color:var(--tn-text,#fff);border-radius:16px;padding:12px 14px;font:15px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.3);border-left:5px solid #1e9e4a}'+
      '#tn-park.orange{border-left-color:#e08a1a}#tn-park.red{border-left-color:#d93025}#tn-park .hd{display:flex;gap:10px;align-items:center}#tn-park .x{margin-left:auto;cursor:pointer;opacity:.7;padding:4px 8px;font-size:18px}'+
      '#tn-park .sg{margin-top:8px;font-size:12px;opacity:.75;line-height:1.5}#tn-park .src{margin-top:6px;font-size:11px;opacity:.55}';
    document.head.appendChild(st);this.el=document.createElement('div');this.el.id='tn-park';this.el.className='notr';document.body.appendChild(this.el);}
  const uniq=[...new Set(signs.slice(0,8).map(s=>s.txt))].slice(0,4);
  this.el.className='notr '+v.c;this.el.style.display='block';
  this.el.innerHTML='<div class="hd">'+(TN.roccoSVG?'<span style="flex:none">'+TN.roccoSVG(34)+'</span>':'')+'<b style="font-weight:600">'+TN.esc(v.t)+'</b><span class="x" role="button" aria-label="Close">\u2715</span></div>'+
    '<div class="sg">Signs here: '+uniq.map(x=>TN.esc(x)).join(' \u00b7 ')+'</div><div class="src">From the City of Montréal\u2019s parking signs, for information \u2014 the real sign always wins.</div>';
  this.el.querySelector('.x').onclick=()=>{this.hide();this.dismissed=this.key;};
};
TN.Parking.prototype.hide=function(){if(this.el) this.el.style.display='none';this.shownAt=null;};
/* called every frame: after 20 s stopped (or right away when asked), read the signs here once */
TN.Parking.prototype.update=function(dt,force){
  if(!this.on||!this.loaded) return;
  const car=this.getCar(),v=this.getSpeed();if(!car||car.x==null) return;
  if(v>2.5){this.stillT=0;if(this.shownAt) this.hide();this.dismissed=null;return;}
  this.stillT+=dt;
  if(this.shownAt||(!force&&this.stillT<20)) return;
  const key=Math.round(car.x/10)+','+Math.round(car.z/10);if(this.dismissed===key) return;
  const signs=this.near(car),vd=this.verdict(signs,new Date());if(!vd) return;
  this.key=key;this.shownAt=Date.now();this.show(vd,signs);
  try{this.note('parking',{c:vd.c,t:vd.t,n:signs.length});}catch(e){}
  try{if(TN.voice&&TN.voice.say&&(!TN.settings||TN.settings.parkVoice!==false)) TN.voice.say(vd.t,false);}catch(e){}
};
