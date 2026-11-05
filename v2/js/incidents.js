/* TessyNav v2 — incidents.js
   Road incidents with Rocco, TessyNav's raccoon mascot.
   - source: TomTom Traffic Incidents (all roads, city streets included): accidents, closures, road works, lane
     closures, broken-down vehicles, ice, fog, flooding... refreshed every 2 minutes around the car
   - on the map: a small round Rocco badge for each incident
   - ahead of you (on your route, or straight ahead when there is no route): an alert card, the important part big
     ("Road works · 600 m"), Rocco and his one-liner smaller ("Fun mode" in the settings turns the jokes off)
   The key is restricted to tessynav.github.io. */
var TN=globalThis.TN||{};globalThis.TN=TN;
TN.TT='SFsP1S1bN56sxYRuHDYyJpLTgg5Pva1k';

/* ---------- Rocco ---------- */
TN.ROCCO_KIND={1:'accident',2:'fog',3:'hazard',4:'rain',5:'ice',7:'lane',8:'closed',9:'works',10:'wind',11:'flood',14:'breakdown'};
TN.ROCCO_TITLE={accident:'Accident',fog:'Fog',hazard:'Danger on the road',rain:'Heavy rain',ice:'Ice',lane:'Lane closed',closed:'Road closed',works:'Road works',
  wind:'Strong wind',flood:'Flooding',breakdown:'Stopped vehicle',police:'Police',unknown:'Incident'};
TN.ROCCO_JOKES={
  accident:['Oops! Someone kissed a bumper.','Fender-bender ahead. Rocco is taking notes.','Bumper cars, but not the fun kind.'],
  works:['Cone collector at work.','Orange cones: Montreal\u2019s official tree.','Rocco is supervising. Very hard work.'],
  closed:['Nope. Not today.','Road\u2019s taking a nap.','Even Rocco can\u2019t sneak through here.'],
  lane:['One lane down. Squeeze politely.','Zipper merge time!','Lanes are like snacks: someone took one.'],
  breakdown:['Someone needs a hug and a tow.','Car took a coffee break.','Stopped car ahead. Give it some room.'],
  ice:['Ice ice baby. Slow down.','Rocco tried skating here. It didn\u2019t end well.','Slippery! Easy on the brakes.'],
  fog:['Rocco can\u2019t see his own tail.','Pea soup ahead. Lights on.','Mystery fog. Slow and steady.'],
  flood:['Rocco brought his floaties.','Car wash for free. Not recommended.','Water on the road. Go around.'],
  rain:['Wipers on, Rocco\u2019s umbrella out.','Big rain. Bigger following distance.'],
  wind:['Hold on to your tuque!','Windy! Rocco\u2019s tail is everywhere.'],
  hazard:['Something on the road. Eyes open!','Rocco spotted trouble ahead.'],
  police:['Smile, you\u2019re on camera!','Rocco says: speed limit, my friend.'],
  unknown:['Something\u2019s up ahead.']};
/* Rocco as a drawing: the head with his mask, plus an accessory for each kind of incident */
TN.ROCCO=function(kind,size,night){
  const z=size||64,fur=night?'#6f7782':'#8f97a2',fur2=night?'#5a616b':'#7d8590',dark='#2b2f36',muz=night?'#cfd3d8':'#eef0f2';
  const head='<ellipse cx="-30" cy="-34" rx="14" ry="16" fill="'+fur2+'"/><ellipse cx="-30" cy="-32" rx="7" ry="9" fill="#3a3f47"/>'+
    '<ellipse cx="30" cy="-34" rx="14" ry="16" fill="'+fur2+'"/><ellipse cx="30" cy="-32" rx="7" ry="9" fill="#3a3f47"/>'+
    '<ellipse cx="0" cy="0" rx="46" ry="40" fill="'+fur+'"/><path d="M-44 -4 Q-24 -22 0 -8 Q24 -22 44 -4 Q30 14 0 6 Q-30 14 -44 -4Z" fill="'+dark+'"/>'+
    '<ellipse cx="0" cy="18" rx="24" ry="18" fill="'+muz+'"/><ellipse cx="0" cy="8" rx="7" ry="5" fill="#1d2024"/>';
  const eyes='<circle cx="-17" cy="-5" r="7" fill="#fff"/><circle cx="17" cy="-5" r="7" fill="#fff"/><circle cx="-16" cy="-4" r="3.5" fill="#111"/><circle cx="18" cy="-4" r="3.5" fill="#111"/>';
  const wide='<circle cx="-17" cy="-6" r="9" fill="#fff"/><circle cx="17" cy="-6" r="9" fill="#fff"/><circle cx="-17" cy="-6" r="3" fill="#111"/><circle cx="17" cy="-6" r="3" fill="#111"/>';
  const smile='<path d="M-12 24 Q0 32 12 24" stroke="#1d2024" stroke-width="3.5" fill="none" stroke-linecap="round"/>';
  const oh='<ellipse cx="0" cy="25" rx="6" ry="8" fill="#5a1f1f"/>';
  const frown='<path d="M-10 28 Q0 21 10 28" stroke="#1d2024" stroke-width="3.5" fill="none" stroke-linecap="round"/>';
  const brows='<path d="M-24 -16 l12 5 M24 -16 l-12 5" stroke="#111" stroke-width="4" stroke-linecap="round"/>';
  let extra='',face=eyes+smile;
  switch(kind){
    case 'police':face='<circle cx="-16" cy="-2" r="3.5" fill="#111"/><circle cx="16" cy="-2" r="3.5" fill="#111"/>'+brows+
      '<path d="M-26 22 Q-14 12 0 18 Q14 12 26 22 Q14 20 0 24 Q-14 20 -26 22Z" fill="#3b2a20"/>';
      extra='<path d="M-44 -30 Q0 -58 44 -30 L40 -20 Q0 -30 -40 -20Z" fill="#1f3a66"/><path d="M-42 -22 Q0 -30 42 -22 L46 -14 Q0 -22 -46 -14Z" fill="#111"/><path d="M-6 -44 l6 -6 l6 6 l-2 8 h-8z" fill="#d8b64a"/>';break;
    case 'accident':face=wide+oh;extra='<path d="M40 30 L58 -2 L76 30Z" fill="none" stroke="#e5352b" stroke-width="6" stroke-linejoin="round"/><path d="M-56 -44 q4 -10 8 0 M56 -44 q-4 -10 -8 0" stroke="#e5352b" stroke-width="3" fill="none"/>';break;
    case 'works':extra='<path d="M-44 -26 Q0 -62 44 -26Z" fill="#f2c21c"/><rect x="-48" y="-28" width="96" height="7" rx="3" fill="#d9a80f"/><path d="M48 44 L60 6 L72 44Z" fill="#f28c1c"/><path d="M53 30 H67" stroke="#fff" stroke-width="4"/>';break;
    case 'closed':face=eyes+frown;extra='<rect x="-62" y="34" width="124" height="14" rx="3" fill="#fff" stroke="#e5352b" stroke-width="3"/><path d="M-50 34 l12 14 M-22 34 l12 14 M6 34 l12 14 M34 34 l12 14" stroke="#e5352b" stroke-width="6"/>';break;
    case 'lane':extra='<path d="M44 44 L56 8 L68 44Z" fill="#f28c1c"/><path d="M-68 44 L-56 8 L-44 44Z" fill="#f28c1c"/>';break;
    case 'breakdown':face=eyes+frown;extra='<path d="M-30 -48 q8 -14 16 0 q8 -14 16 0 q8 -14 16 0" stroke="#9aa3ab" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M50 20 l18 -18 m-6 -6 l10 10" stroke="#9aa3ab" stroke-width="6" stroke-linecap="round"/>';break;
    case 'ice':face=wide+smile;extra='<path d="M-40 -40 Q0 -64 40 -40 L36 -30 Q0 -44 -36 -30Z" fill="#c0392b"/><circle cx="0" cy="-56" r="7" fill="#fff"/><path d="M-42 34 Q-20 44 0 38 Q20 44 42 34" stroke="#c0392b" stroke-width="8" fill="none" stroke-linecap="round"/>';break;
    case 'fog':face='<path d="M-24 -5 h14 M10 -5 h14" stroke="#111" stroke-width="4" stroke-linecap="round"/>'+frown;extra='<path d="M-70 -10 h40 M30 -20 h44 M-60 40 h50 M20 46 h46" stroke="#cfd6dd" stroke-width="7" stroke-linecap="round" opacity=".85"/>';break;
    case 'flood':face=eyes+smile;extra='<ellipse cx="0" cy="44" rx="58" ry="12" fill="#3b82f6" opacity=".8"/><circle cx="-50" cy="36" r="10" fill="none" stroke="#f28c1c" stroke-width="7"/>';break;
    case 'rain':extra='<path d="M-52 -46 Q0 -86 52 -46Z" fill="#1fa596"/><path d="M0 -46 v-14" stroke="#555" stroke-width="3"/><path d="M-60 -20 l-4 10 M60 -20 l4 10 M-48 0 l-4 10 M48 0 l4 10" stroke="#7fb2e5" stroke-width="3"/>';break;
    case 'wind':face=wide+oh;extra='<path d="M-74 -30 Q-50 -36 -40 -26 M-76 -6 Q-56 -12 -46 -2 M46 -24 Q60 -30 74 -22" stroke="#cfd6dd" stroke-width="5" fill="none" stroke-linecap="round"/>';break;
    case 'hazard':face=wide+oh;extra='<path d="M50 34 L62 6 L74 34Z" fill="#f2c21c" stroke="#111" stroke-width="3" stroke-linejoin="round"/><path d="M62 15 v9 M62 28 v1" stroke="#111" stroke-width="3" stroke-linecap="round"/>';break;
  }
  return '<svg width="'+z+'" height="'+z+'" viewBox="-80 -80 160 160" aria-hidden="true">'+head+face+extra+'</svg>';
};

/* ---------- the incidents ---------- */
TN.Incidents=function(api){
  this.api=api;this.list=[];this.markers=new Map();this.lastFetch=0;this.lastPos=null;this.alertFor=null;this.on=true;
};
TN.Incidents.prototype.build=function(){
  const st=document.createElement('style');
  st.textContent='.tn-inc{width:34px;height:34px;border-radius:50%;background:#fff;border:3px solid #e5352b;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:pointer}'+
    '.tn-inc.works,.tn-inc.lane{border-color:#f28c1c}.tn-inc.ice,.tn-inc.fog,.tn-inc.flood,.tn-inc.rain,.tn-inc.wind{border-color:#3b82f6}'+
    '#tn-alert{left:50%;bottom:24px;transform:translateX(-50%);display:none;align-items:center;gap:14px;padding:10px 18px 10px 12px;max-width:min(92vw,620px);z-index:8}'+
    '#tn-alert b{font-size:22px;display:block}#tn-alert small{color:#9fb3c8;font-size:14px;display:block;margin-top:2px}#tn-alert .joke{color:#fcd34d}'+
    'body.tn-routing #tn-alert{bottom:96px}';
  document.head.appendChild(st);
  this.card=document.createElement('div');this.card.id='tn-alert';this.card.className='hud';document.body.appendChild(this.card);
};
/* fetch the incidents around the car (every 2 minutes, or after moving 3 km) */
TN.Incidents.prototype.fetch=async function(lng,lat){
  const dLng=0.07,dLat=0.045,bbox=[lng-dLng,lat-dLat,lng+dLng,lat+dLat].map(v=>v.toFixed(5)).join(',');
  const fields='{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,code},startTime,endTime,from,to,length,delay,roadNumbers}}}';
  const u='https://api.tomtom.com/traffic/services/5/incidentDetails?bbox='+bbox+'&fields='+encodeURIComponent(fields)+'&language=en-GB&timeValidityFilter=present&key='+TN.TT;
  try{
    const r=await fetch(u);if(!r.ok){this.err=r.status;return;}
    const j=await r.json();const out=[];
    for(const f of j.incidents||[]){
      const p=f.properties||{},kind=TN.ROCCO_KIND[p.iconCategory];if(!kind) continue;   /* (plain traffic jams: shown by the traffic colours) */
      const g=f.geometry||{},c=g.type==='Point'?[g.coordinates]:g.type==='LineString'?g.coordinates:[];if(!c.length) continue;
      const pts=c.map(q=>TN.toLocal(q[0],q[1]));
      out.push({id:p.id||(kind+c[0].join(',')),kind:kind,pts:pts,ll:c[0],desc:(p.events&&p.events[0]&&p.events[0].description)||'',
        from:p.from||'',to:p.to||'',road:(p.roadNumbers||[]).join(', '),mag:p.magnitudeOfDelay||0,delay:p.delay||0});
    }
    this.list=out;this.err=null;this.drawMarkers();
    if(this.api.note) this.api.note('incidents',{n:out.length});
  }catch(e){this.err='net';}
};
TN.Incidents.prototype.drawMarkers=function(){
  if(typeof maplibregl==='undefined') return;
  const keep=new Set(this.list.map(i=>i.id));
  for(const [id,m] of this.markers) if(!keep.has(id)){try{m.remove();}catch(e){}this.markers.delete(id);}
  const night=(this.api.scene&&this.api.scene.night||0)>0.45;
  for(const it of this.list){if(this.markers.has(it.id)) continue;
    const el=document.createElement('div');el.className='tn-inc '+it.kind;el.innerHTML=TN.ROCCO(it.kind,40,night);
    el.title=TN.ROCCO_TITLE[it.kind];el.onclick=e=>{e.stopPropagation();this.show(it,null,true);};
    this.markers.set(it.id,new maplibregl.Marker({element:el}).setLngLat(it.ll).addTo(this.api.map));}
};
TN.Incidents.prototype.clear=function(){for(const m of this.markers.values()){try{m.remove();}catch(e){}}this.markers.clear();this.hide();};
/* distance from the car to an incident, along the route if there is one, otherwise straight ahead */
TN.Incidents.prototype.ahead=function(car){
  const nav=this.api.nav,R=nav&&nav.active?nav.route:null;let best=null;
  for(const it of this.list){
    let d=null;
    if(R){/* on the route: the incident is within 25 m of the route line, ahead of the car */
      const s0=R.cum[nav.idx]||0;
      for(const p of it.pts){for(let i=nav.idx;i<R.pts.length&&R.cum[i]-s0<3000;i+=3){const q=R.pts[i];if(Math.hypot(q[0]-p[0],q[1]-p[1])<25){const dd=R.cum[i]-s0;if(dd>=0&&(d==null||dd<d)) d=dd;break;}}}}
    else{/* no route: within about 30 degrees of straight ahead, closer than 1.2 km */
      const hr=car.hd*Math.PI/180,fx=Math.sin(hr),fz=-Math.cos(hr);
      for(const p of it.pts){const vx=p[0]-car.x,vz=p[1]-car.z,dist=Math.hypot(vx,vz);if(dist<15||dist>1200) continue;
        if((vx*fx+vz*fz)/dist>0.87&&(d==null||dist<d)) d=dist;}}
    if(d!=null&&d<(R?3000:1200)&&(!best||d<best.d)) best={it:it,d:d};
  }
  return best;
};
TN.Incidents.prototype.fun=function(){return !(TN.settings&&TN.settings.fun===false);};
TN.Incidents.prototype.show=function(it,d,tapped){
  const night=(this.api.scene&&this.api.scene.night||0)>0.45;
  if(this.alertFor!==it.id){this.joke=(TN.ROCCO_JOKES[it.kind]||TN.ROCCO_JOKES.unknown);this.joke=this.joke[Math.floor(Math.random()*this.joke.length)];this.alertFor=it.id;}
  const dist=d==null?'':' \u00b7 '+(d<950?Math.round(d/50)*50+' m':(d/1000).toFixed(1)+' km');
  const detail=[it.desc,it.road,it.from&&it.to?it.from+' \u2192 '+it.to:it.from].filter(Boolean).join(' \u00b7 ');
  this.card.innerHTML=(this.fun()?TN.ROCCO(it.kind,64,night):'')+'<div style="min-width:0"><b>'+TN.esc(TN.ROCCO_TITLE[it.kind]+dist)+'</b>'+
    (detail?'<small>'+TN.esc(detail)+'</small>':'')+(this.fun()?'<small class="joke">'+TN.esc(this.joke)+'</small>':'')+'</div>';
  this.card.style.display='flex';this.shownAt=Date.now();this.tapped=!!tapped;
};
TN.Incidents.prototype.hide=function(){if(this.card) this.card.style.display='none';this.alertFor=null;};
TN.Incidents.prototype.update=function(car,lng,lat){
  if(TN.settings&&TN.settings.incidents===false){if(this.markers.size) this.clear();return;}
  const now=Date.now();
  const moved=this.lastPos?TN.distLL(this.lastPos,[lng,lat]):1e9;
  if(now-this.lastFetch>120000||moved>3000){this.lastFetch=now;this.lastPos=[lng,lat];this.fetch(lng,lat);}
  if(!car||car.x==null) return;
  /* a tapped badge shows its card for 8 s; otherwise the next incident ahead within reach */
  if(this.tapped&&now-this.shownAt<8000) return;
  const a=this.ahead(car);
  if(a) this.show(a.it,a.d,false);else if(this.card&&this.card.style.display!=='none') this.hide();
};
