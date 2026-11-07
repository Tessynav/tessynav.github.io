/* TessyNav v2 — chargers.js (v1)
   Tesla Superchargers on the map (and, optionally, other fast chargers), from OpenStreetMap, refreshed weekly by the
   "Chargers" job in tessynav-roads. Red pins with a lightning bolt; tap one for a card with its stalls, power and
   distance, and Go (or "Add as a stop" while a route is on).
   - ⚙ → Map and view → "Superchargers on the map" (on) / "Other fast chargers" (off)
   - TN.chargers.list: every site, for the trip planner [{id, ll:[lng,lat], name, stalls, kw, kind, net}] */
var TN=globalThis.TN||{};globalThis.TN=TN;
TN.CHARGERS_URL='https://raw.githubusercontent.com/Tessynav/tessynav-roads/chargers/chargers.json';
TN.Chargers=function(api){
  this.api=api;this.list=[];this.markers=new Map();this.card=null;this.t=0;
  const st=document.createElement('style');
  st.textContent='.tn-chg{width:30px;height:30px;border-radius:9px;background:#e31937;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative}'+
    '.tn-chg.dc{background:#2f6fd6}.tn-chg b{position:absolute;right:-8px;top:-8px;min-width:16px;height:16px;padding:0 3px;border-radius:8px;background:#fff;color:#222;font:700 10px/16px system-ui,sans-serif;text-align:center}'+
    '#tn-chgcard{position:absolute;left:50%;bottom:92px;transform:translateX(-50%);z-index:30;min-width:260px;max-width:92vw;background:rgb(var(--panel-rgb,43 45 49)/.96);color:var(--text,#f3f1ec);border-radius:16px;padding:14px 16px;box-shadow:0 6px 24px rgba(0,0,0,.45);font:15px system-ui,sans-serif;display:none}'+
    '#tn-chgcard .n{font-weight:700;font-size:17px;margin-bottom:2px}#tn-chgcard .s{color:var(--sub,#b9b6ae);font-size:13px}#tn-chgcard .row{display:flex;gap:8px;margin-top:12px}'+
    '#tn-chgcard button{flex:1;border:0;border-radius:10px;padding:10px;font:600 15px system-ui,sans-serif;background:var(--btn,#45474d);color:var(--text,#f3f1ec)}#tn-chgcard button.go{background:var(--accent,#e8913a);color:var(--on-accent,#2b1a08)}';
  (document.head||document.body).appendChild(st);
  this.load();
};
const esc=t=>(TN.esc?TN.esc(t):String(t==null?'':t).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])));
TN.CHG_SVG='<svg width="16" height="18" viewBox="0 0 16 18"><path d="M9.5 0 1 10.5h5.5L5 18l9-11H8.5z" fill="#fff"/></svg>';
TN.Chargers.prototype.load=async function(){
  let j=null;
  try{const c=JSON.parse(localStorage.getItem('tn2_chargers')||'null');if(c&&c.at&&Date.now()-c.at<24*3600e3) j=c.j;}catch(e){}
  if(!j){try{const r=await fetch(TN.CHARGERS_URL+'?t='+Math.floor(Date.now()/3600e3));if(r.ok){j=await r.json();
      try{localStorage.setItem('tn2_chargers',JSON.stringify({at:Date.now(),j:j}));}catch(e){}}}catch(e){}}
  if(!j||!j.s) return;
  this.list=j.s.map(s=>({id:s[0],ll:[s[2],s[1]],name:s[3],stalls:s[4],kw:s[5],kind:s[6],net:s[7]}));
  this.draw(true);
};
/* which sites to show: in view when browsing the map; within 15 km when following the car */
TN.Chargers.prototype.wanted=function(){
  const S=TN.settings||{},on=S.chargers!==false,dc=!!S.fastdc;if(!on&&!dc) return [];
  const map=this.api.map;if(!map) return [];
  const z=map.getZoom?map.getZoom():14;if(z<8) return [];
  const follow=this.api.following?this.api.following():false,c=map.getCenter();
  const km=(a,b)=>{const dx=(a[0]-b[0])*Math.cos(b[1]*Math.PI/180)*111.32,dy=(a[1]-b[1])*110.57;return Math.hypot(dx,dy);};
  let b=null;try{b=map.getBounds&&map.getBounds();}catch(e){}
  const out=[];
  for(const s of this.list){
    if(s.kind==='sc'?!on:!dc) continue;
    const d=km(s.ll,[c.lng,c.lat]);s._d=d;
    /* (while driving only close ones: in the low street view a far charger sits on the horizon at full size,
       looking as if it were right there, and seems to follow you) */
    if(follow){if(d>1.5) continue;}
    else if(b&&b.contains&&!b.contains(s.ll)) continue;
    out.push(s);}
  out.sort((a,b2)=>a._d-b2._d);
  return out.slice(0,60);
};
TN.Chargers.prototype.draw=function(force){
  if(typeof maplibregl==='undefined'||!this.api.map) return;
  const now=Date.now();if(!force&&now-this.t<2500) return;this.t=now;
  const want=this.wanted(),keep=new Set(want.map(s=>s.id));
  for(const [id,m] of this.markers) if(!keep.has(id)){try{m.remove();}catch(e){}this.markers.delete(id);}
  for(const s of want){if(this.markers.has(s.id)) continue;
    /* (an outer box the map moves, and the pin inside it, which shrinks with distance while driving) */
    const el=document.createElement('div'),pin=document.createElement('div');pin.className='tn-chg'+(s.kind==='dc'?' dc':'');
    pin.innerHTML=TN.CHG_SVG+(s.stalls?'<b>'+s.stalls+'</b>':'');el.appendChild(pin);el.title=s.name;
    el.onclick=e=>{e.stopPropagation();this.show(s);};
    const mk=new maplibregl.Marker({element:el}).setLngLat(s.ll).addTo(this.api.map);mk.pin=pin;mk.site=s;
    this.markers.set(s.id,mk);}
  this.sizes(true);
};
/* while driving, pins shrink with distance: full size within 250 m, about half size at 1.5 km */
TN.Chargers.prototype.sizes=function(force){
  const now=Date.now();if(!force&&now-(this.szT||0)<500) return;this.szT=now;
  const follow=this.api.following?this.api.following():false;
  for(const mk of this.markers.values()){if(!mk.pin) continue;
    let k=1;if(follow){const d=this.distKm(mk.site);if(d!=null) k=Math.max(0.5,Math.min(1,1-(d-0.25)/1.25*0.5));}
    const tf=k>0.99?'':'scale('+k.toFixed(2)+')';if(mk.pin.style.transform!==tf){mk.pin.style.transform=tf;mk.pin.style.transformOrigin='50% 100%';}}
};
TN.Chargers.prototype.distKm=function(s){
  const c=this.api.getCar&&this.api.getCar();if(!c||c.x==null||!TN.toLocal) return null;
  const p=TN.toLocal(s.ll[0],s.ll[1]);return Math.hypot(p[0]-c.x,p[1]-c.z)/1000;
};
TN.Chargers.prototype.show=function(s){
  let c=document.getElementById('tn-chgcard');
  if(!c){c=document.createElement('div');c.id='tn-chgcard';document.body.appendChild(c);}
  const d=this.distKm(s),nav=this.api.nav,routing=!!(nav&&nav.active);
  const info=[s.kind==='sc'?'Tesla Supercharger':(s.net||'Fast charger')];
  if(s.stalls) info.push(s.stalls+' stalls');if(s.kw) info.push('up to '+s.kw+' kW');
  if(d!=null) info.push(d<10?d.toFixed(1)+' km':Math.round(d)+' km');
  c.innerHTML='<div class="n">'+esc(s.name)+'</div><div class="s">'+info.map(esc).join(' \u00b7 ')+'</div>'+
    '<div class="row"><button class="go">'+(routing?'Add as a stop':'Go')+'</button><button class="x">Close</button></div>';
  c.style.display='block';
  c.querySelector('.x').onclick=()=>{c.style.display='none';};
  c.querySelector('.go').onclick=()=>{c.style.display='none';if(!nav) return;
    const it={name:s.name,sub:s.kind==='sc'?'Tesla Supercharger':(s.net||''),lng:s.ll[0],lat:s.ll[1],charger:s.id};
    if(routing){nav.stops.push(it);nav.stopPins&&nav.stopPins();nav.plan(true);}else nav.pick(it);};
};
TN.Chargers.prototype.update=function(){this.draw(false);this.sizes(false);};
TN.Chargers.prototype.clear=function(){for(const m of this.markers.values()){try{m.remove();}catch(e){}}this.markers.clear();this.t=0;};
