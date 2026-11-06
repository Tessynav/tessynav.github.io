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
/* Firebase (driver reports). These web settings are meant to be public; the database rules decide what is allowed. */
TN.FB={apiKey:'AIzaSyCBRR9gPPRnhNALC2V5uHmbtr7pR0R7EA8',projectId:'tessynav-958f3'};

/* ---------- Rocco ---------- */
TN.ROCCO_KIND={6:'jam',1:'accident',2:'fog',3:'hazard',4:'rain',5:'ice',7:'lane',8:'closed',9:'works',10:'wind',11:'flood',14:'breakdown'};
TN.ROCCO_TITLE={jam:'Heavy traffic',pothole:'Pothole',accident:'Accident',fog:'Fog',hazard:'Danger on the road',rain:'Heavy rain',ice:'Ice',lane:'Lane closed',closed:'Road closed',works:'Road works',
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
  jam:['Rocco brought snacks.','Perfect time for a podcast.','Bumper to bumper. Breathe.','Rocco is counting cars. He\u2019s at 300.'],
  pothole:['Hi! Mind my house.','Rocco\u2019s swimming pool. Go around.','Montreal\u2019s famous craters.'],
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
    case 'jam':face='<path d="M-24 -5 q7 -5 14 0 M10 -5 q7 -5 14 0" stroke="#111" stroke-width="4" fill="none" stroke-linecap="round"/>'+frown;
      extra='<path d="M36 -30 q6 10 0 16 q-6 -6 0 -16z" fill="#7fb2e5"/><rect x="-74" y="34" width="34" height="14" rx="4" fill="#e5352b"/><rect x="-68" y="27" width="20" height="10" rx="3" fill="#e5352b"/><circle cx="-66" cy="49" r="4" fill="#111"/><circle cx="-48" cy="49" r="4" fill="#111"/>'+
        '<rect x="40" y="34" width="34" height="14" rx="4" fill="#f2c21c"/><rect x="46" y="27" width="20" height="10" rx="3" fill="#f2c21c"/><circle cx="48" cy="49" r="4" fill="#111"/><circle cx="66" cy="49" r="4" fill="#111"/>';break;
    case 'pothole':return '<svg width="'+z+'" height="'+z+'" viewBox="-80 -80 160 160" aria-hidden="true"><ellipse cx="0" cy="40" rx="74" ry="24" fill="#45494f"/><ellipse cx="0" cy="40" rx="60" ry="16" fill="#17191c"/>'+
      '<g transform="translate(0,6) scale(.8)">'+head+eyes+smile+'</g><path d="M-74 40 Q0 74 74 40 L74 80 L-74 80Z" fill="#45494f"/></svg>';
    case 'hazard':face=wide+oh;extra='<path d="M50 34 L62 6 L74 34Z" fill="#f2c21c" stroke="#111" stroke-width="3" stroke-linejoin="round"/><path d="M62 15 v9 M62 28 v1" stroke="#111" stroke-width="3" stroke-linecap="round"/>';break;
  }
  return '<svg width="'+z+'" height="'+z+'" viewBox="-80 -80 160 160" aria-hidden="true">'+head+face+extra+'</svg>';
};

/* ---------- the incidents ---------- */
TN.Incidents=function(api){
  this.api=api;this.list=[];this.tt=[];this.reports=new TN.Reports(this);this.repFetch=0;this.markers=new Map();this.lastFetch=0;this.lastPos=null;this.alertFor=null;this.on=true;
};
TN.Incidents.prototype.build=function(){
  const st=document.createElement('style');
  st.textContent='.tn-inc{width:34px;height:34px;border-radius:50%;background:#fff;border:3px solid #e5352b;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:pointer}'+
    '.tn-inc.jam{border-color:#f28c1c}.tn-inc.jam.stand{border-color:#b91c1c}.tn-inc.works,.tn-inc.lane{border-color:#f28c1c}.tn-inc.ice,.tn-inc.fog,.tn-inc.flood,.tn-inc.rain,.tn-inc.wind{border-color:#3b82f6}'+
    '#tn-alert{left:50%;bottom:24px;transform:translateX(-50%);display:none;align-items:center;gap:10px;padding:6px 14px 6px 8px;max-width:min(80vw,520px);z-index:8}'+
    '#tn-alert b{font-size:19px;display:block}#tn-alert small{color:#9fb3c8;font-size:13px;display:block;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#tn-alert .joke{color:#fcd34d}'+
    'body.tn-routing #tn-alert{bottom:96px}'+
    '#tn-alert .v{border:0;border-radius:10px;padding:10px 14px;font:600 15px system-ui,sans-serif;cursor:pointer;margin-left:6px}#tn-alert .up{background:#1fa596;color:#fff}#tn-alert .down{background:#3a4352;color:#e8f1fa}'+
    '.tn-inc.user{border-style:dashed}'+
    '#tn-report{right:16px;bottom:356px;display:flex;align-items:center;gap:6px;padding:6px 14px 6px 8px;border:0;font:600 16px system-ui,sans-serif;color:#fcd34d;cursor:pointer}'+
    '#tn-repgrid{left:50%;top:50%;transform:translate(-50%,-50%);display:none;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:12px;z-index:10;width:min(92vw,460px)}'+
    '#tn-repgrid button{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 4px;border:0;border-radius:12px;background:rgba(255,255,255,.06);color:#e8f1fa;font:600 14px system-ui,sans-serif;cursor:pointer}'+
    '#tn-repgrid button.x{justify-content:center;color:#9fb3c8}';
  document.head.appendChild(st);
  this.card=document.createElement('div');this.card.id='tn-alert';this.card.className='hud';document.body.appendChild(this.card);
  this.btn=document.createElement('button');this.btn.id='tn-report';this.btn.className='hud';this.btn.innerHTML=TN.ROCCO('hazard',30)+'<span>Report</span>';document.body.appendChild(this.btn);
  this.btn.onclick=()=>this.openReport();
  this.grid=document.createElement('div');this.grid.id='tn-repgrid';this.grid.className='hud';document.body.appendChild(this.grid);
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
      const p=f.properties||{},kind=TN.ROCCO_KIND[p.iconCategory];if(!kind) continue;
      /* traffic jams: moderate, heavy or standstill (minor slowdowns are left to the traffic colours) */
      let sev=0;if(kind==='jam'){const ds=((p.events||[]).map(e=>e.description).join(' ')).toLowerCase();
        sev=/stationary|standstill|stopped/.test(ds)?3:/queu|heavy/.test(ds)?2:(p.magnitudeOfDelay>=3?2:p.magnitudeOfDelay===2?1:0);
        if(!sev) continue;}
      const g=f.geometry||{},c=g.type==='Point'?[g.coordinates]:g.type==='LineString'?g.coordinates:[];if(!c.length) continue;
      const pts=c.map(q=>TN.toLocal(q[0],q[1]));
      out.push({id:p.id||(kind+c[0].join(',')),kind:kind,pts:pts,ll:c[0],desc:(p.events&&p.events[0]&&p.events[0].description)||'',
        from:p.from||'',to:p.to||'',road:(p.roadNumbers||[]).join(', '),mag:p.magnitudeOfDelay||0,delay:p.delay||0,len:p.length||0,sev:sev,
        title:sev?['','Moderate traffic','Heavy traffic','Standstill'][sev]:null});
    }
    this.tt=out;this.err=null;this.merge();
    if(this.api.note) this.api.note('incidents',{n:out.length});
  }catch(e){this.err='net';}
};
TN.Incidents.prototype.merge=function(){this.list=this.tt.concat(this.reports.list);this.drawMarkers();};
TN.Incidents.prototype.nearest=function(max){
  const c=this.api.getCar&&this.api.getCar();if(!c||c.x==null||this.list.length<=max) return this.list;
  return this.list.slice().sort((a,b)=>Math.hypot(a.pts[0][0]-c.x,a.pts[0][1]-c.z)-Math.hypot(b.pts[0][0]-c.x,b.pts[0][1]-c.z)).slice(0,max);};
TN.Incidents.prototype.drawMarkers=function(){
  if(typeof maplibregl==='undefined') return;
  const c=this.api.getCar&&this.api.getCar(),follow=this.api.following?this.api.following():true;
  const vis=i=>{if(i.kind==='jam'&&i.sev<2) return false;if(!c||c.x==null) return true;
    const dx=i.pts[0][0]-c.x,dz=i.pts[0][1]-c.z,d=Math.hypot(dx,dz);if(d>3000) return false;
    if(follow&&d>150){const h=(c.hd||0)*Math.PI/180;if((dx*Math.sin(h)-dz*Math.cos(h))/d<0.2) return false;}return true;};
  const shown=[];for(const i of this.nearest(40).filter(vis)){
    if(shown.some(o=>o.kind===i.kind&&Math.hypot(o.pts[0][0]-i.pts[0][0],o.pts[0][1]-i.pts[0][1])<40)) continue;shown.push(i);}
  const keep=new Set(shown.map(i=>i.id));
  for(const [id,m] of this.markers) if(!keep.has(id)){try{m.remove();}catch(e){}this.markers.delete(id);}
  const night=(this.api.scene&&this.api.scene.night||0)>0.45;
  for(const it of shown){if(this.markers.has(it.id)) continue;
    const el=document.createElement('div');el.className='tn-inc '+it.kind+(it.user?' user':'')+(it.sev===3?' stand':'');el.innerHTML=TN.ROCCO(it.kind,40,night);
    el.title=it.title||TN.ROCCO_TITLE[it.kind];el.onclick=e=>{e.stopPropagation();this.show(it,null,true);};
    this.markers.set(it.id,new maplibregl.Marker({element:el}).setLngLat(it.ll).addTo(this.api.map));}
};
TN.Incidents.prototype.clear=function(){for(const m of this.markers.values()){try{m.remove();}catch(e){}}this.markers.clear();this.hide();};
/* distance from the car to an incident, along the route if there is one, otherwise straight ahead */
TN.Incidents.prototype.ahead=function(car,moderate){
  const nav=this.api.nav,R=nav&&nav.active?nav.route:null;let best=null;
  for(const it of this.list){
    if(it.mine) continue;   /* (your own reports: on the map, but no alert) */
    if((it.kind==='jam'&&it.sev<2)!==!!moderate) continue;   /* (moderate traffic is checked on its own: said, not shown) */
    if(it.kind==='jam'&&it.pts.some(p=>Math.hypot(p[0]-car.x,p[1]-car.z)<40)) continue;   /* (already in that jam) */
    let d=null;
    if(R){/* on the route: the incident is within 25 m of the route line, ahead of the car */
      const s0=R.cum[nav.idx]||0;
      for(const p of it.pts){for(let i=nav.idx;i<R.pts.length&&R.cum[i]-s0<3000;i+=3){const q=R.pts[i];if(Math.hypot(q[0]-p[0],q[1]-p[1])<25){const dd=R.cum[i]-s0;if(dd>=0&&(d==null||dd<d)) d=dd;break;}}}}
    else{/* no route: within about 30 degrees of straight ahead, closer than 1.2 km (only while driving) */
      if((car.v||0)<2) continue;
      const hr=car.hd*Math.PI/180,fx=Math.sin(hr),fz=-Math.cos(hr);
      for(const p of it.pts){const vx=p[0]-car.x,vz=p[1]-car.z,dist=Math.hypot(vx,vz);if(dist<20||dist>1200) continue;
        if((vx*fx+vz*fz)/dist>0.87&&(d==null||dist<d)) d=dist;}}
    if(d!=null&&d<(R?3000:1200)&&(!best||d<best.d)) best={it:it,d:d};
  }
  return best;
};
TN.Incidents.prototype.fun=function(){return !(TN.settings&&TN.settings.fun===false);};
TN.Incidents.prototype.show=function(it,d,tapped){
  const key=it.id+':'+(d==null?'':Math.round(d/50))+':'+this.fun();if(this.cardKey===key&&this.card.style.display==='flex') return;this.cardKey=key;
  const night=(this.api.scene&&this.api.scene.night||0)>0.45;
  if(this.alertFor!==it.id){this.joke=(TN.ROCCO_JOKES[it.kind]||TN.ROCCO_JOKES.unknown);this.joke=this.joke[Math.floor(Math.random()*this.joke.length)];this.alertFor=it.id;
    /* said once per incident, when it first comes up ahead */
    if(!tapped&&TN.voice&&d!=null&&!(this.spoken||(this.spoken=new Set())).has(it.id)){this.spoken.add(it.id);
      TN.voice.say((it.user?(TN.ROCCO_TITLE[it.kind])+' reported':(it.title||TN.ROCCO_TITLE[it.kind]))+' ahead, '+(d<950?Math.round(d/50)*50+' metres':(d/1000).toFixed(1)+' kilometres'));}}
  const dist=d==null?'':' \u00b7 '+(d<950?Math.round(d/50)*50+' m':(d/1000).toFixed(1)+' km');
  const jamInfo=it.kind==='jam'?[(it.delay>=60?'+'+Math.round(it.delay/60)+' min':''),(it.len?(it.len<950?Math.round(it.len/50)*50+' m':(it.len/1000).toFixed(1)+' km')+' long':'')].filter(Boolean).join(' \u00b7 '):'';
  const detail=[jamInfo,it.kind==='jam'?'':it.desc,it.road,it.from&&it.to?it.from+' \u2192 '+it.to:it.from].filter(Boolean).join(' \u00b7 ');
  const who=it.user?'Reported by a driver \u00b7 '+Math.max(1,Math.round((Date.now()-it.t)/60000))+' min ago'+(it.up?' \u00b7 '+it.up+' confirmed':''):'';
  const canVote=it.user&&!it.mine&&!this.reports.voted.has(it.id)&&(d==null||d<500);
  this.card.innerHTML=(this.fun()?TN.ROCCO(it.kind,50,night):'')+'<div style="min-width:0;flex:1"><b>'+TN.esc((it.title||TN.ROCCO_TITLE[it.kind])+dist)+'</b>'+
    (detail?'<small>'+TN.esc(detail)+'</small>':'')+(who?'<small>'+TN.esc(who)+'</small>':'')+(this.fun()?'<small class="joke">'+TN.esc(this.joke)+'</small>':'')+'</div>'+
    (canVote?'<button class="v up">Still there</button><button class="v down">Gone</button>':'');
  if(canVote){this.card.querySelector('.up').onclick=()=>{this.reports.vote(it.id,true);this.toast('Thanks! Rocco updated it.');this.hide();};
    this.card.querySelector('.down').onclick=()=>{this.reports.vote(it.id,false);this.toast('Thanks! Rocco crossed it out.');this.hide();};}
  this.card.style.display='flex';this.shownAt=Date.now();this.tapped=!!tapped;
};
TN.Incidents.prototype.hide=function(){if(this.card) this.card.style.display='none';this.alertFor=null;this.cardKey=null;};
TN.Incidents.prototype.toast=function(msg){const t=document.createElement('div');t.className='hud';t.style.cssText='left:50%;top:84px;transform:translateX(-50%);z-index:9;font-size:15px;padding:10px 16px';
  t.textContent=msg;document.body.appendChild(t);setTimeout(()=>{try{t.parentNode&&t.parentNode.removeChild(t);}catch(e){}},3500);};
/* the Report button and its grid of Rocco buttons */
TN.Incidents.prototype.openReport=function(){
  const g=this.grid;g.style.display='grid';
  g.innerHTML=TN.REPORT_KINDS.map(k=>'<button data-k="'+k+'">'+TN.ROCCO(k,52)+'<span>'+TN.ROCCO_TITLE[k]+'</span></button>').join('')+'<button class="x" data-k="">Cancel</button>';
  g.querySelectorAll('button').forEach(b=>b.onclick=async()=>{g.style.display='none';const k=b.dataset.k;if(!k) return;
    const c=this.api.getCar&&this.api.getCar(),ll=c&&c.x!=null?TN.fromLocal(c.x,c.z):null;if(!ll){this.toast('Waiting for GPS\u2026');return;}
    try{await this.reports.send(k,ll[0],ll[1],c.hd||0);this.toast('Thanks! Rocco will warn other drivers.');this.repFetch=0;
      if(this.api.note) this.api.note('report sent',{kind:k});}
    catch(e){this.toast('Could not send the report right now');if(this.api.note) this.api.note('report failed',{err:String(e.message||e)});}});
};
TN.Incidents.prototype.update=function(car,lng,lat){
  if(TN.settings&&TN.settings.incidents===false){if(this.markers.size) this.clear();return;}
  const now=Date.now();
  const moved=this.lastPos?TN.distLL(this.lastPos,[lng,lat]):1e9;
  if(now-this.lastFetch>120000||moved>3000){this.lastFetch=now;this.lastPos=[lng,lat];this.fetch(lng,lat);}
  if(now-this.repFetch>60000){this.repFetch=now;this.reports.fetch(lng,lat).then(()=>this.merge());}
  if(!car||car.x==null) return;
  /* a tapped badge shows its card for 8 s; otherwise the next incident ahead within reach */
  if(this.tapped&&now-this.shownAt<8000) return;
  /* the trip list or the route overview is open: alerts wait until it's closed */
  {const nv=this.api.nav;if(nv&&nv.ov&&nv.ov.style.display!=='none'){if(this.card.style.display!=='none') this.hide();return;}}
  const a=this.ahead(car),am=this.ahead(car,true);
  const life=this.life||(this.life=new Map());
  let showIt=false;
  if(a){
    const L=life.get(a.it.id)||{first:0,near:0};
    if(!L.first){L.first=now;}
    if(a.d<250&&!L.near) L.near=now;
    life.set(a.it.id,L);
    showIt=now-L.first<8000||(L.near&&now-L.near<6000);}
  if(am&&TN.voice&&!(this.spoken||(this.spoken=new Set())).has(am.it.id)){this.spoken.add(am.it.id);
    TN.voice.say('Moderate traffic ahead, '+(am.d<950?Math.round(am.d/50)*50+' metres':(am.d/1000).toFixed(1)+' kilometres'));}
  if(showIt) this.show(a.it,a.d,false);else if(this.card&&this.card.style.display!=='none') this.hide();
  /* the map badges: every 2 s, the ones within 4 km (and ahead of the car while following it) */
  if(now-(this.mkT||0)>2000){this.mkT=now;this.drawMarkers();}
};

/* ---------- driver reports (Firebase over the web: anonymous sign-in + the reports database) ---------- */
TN.Reports=function(inc){this.inc=inc;this.list=[];this.lastFetch=0;this.voted=new Set();};
TN.REPORT_KINDS=['police','accident','closed','lane','works','pothole','hazard','ice'];
TN.REPORT_LIFE={police:60,accident:120};   /* minutes a report stays up (default 4 h) */
TN.Reports.prototype.token=async function(){
  /* an anonymous identity for this car, kept between drives; its pass is renewed when it expires (1 hour) */
  let a=null;try{a=JSON.parse(localStorage.getItem('tn2_fb')||'null');}catch(e){}
  if(a&&a.exp>Date.now()+60000) return a;
  let r;
  if(a&&a.refresh){r=await fetch('https://securetoken.googleapis.com/v1/token?key='+TN.FB.apiKey,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=refresh_token&refresh_token='+encodeURIComponent(a.refresh)});
    if(r.ok){const j=await r.json();a={id:j.id_token,refresh:j.refresh_token,uid:j.user_id,exp:Date.now()+(+j.expires_in)*1000};}else a=null;}
  if(!a){r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+TN.FB.apiKey,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({returnSecureToken:true})});
    if(!r.ok) throw new Error('sign-in '+r.status);const j=await r.json();a={id:j.idToken,refresh:j.refreshToken,uid:j.localId,exp:Date.now()+(+j.expiresIn)*1000};}
  try{localStorage.setItem('tn2_fb',JSON.stringify(a));}catch(e){}
  return a;
};
TN.Reports.prototype.base=function(){return 'https://firestore.googleapis.com/v1/projects/'+TN.FB.projectId+'/databases/(default)/documents';};
/* send a report at the car's position (the time is stamped by the server) */
TN.Reports.prototype.send=async function(kind,lng,lat,hd){
  const a=await this.token(),id='r'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  const name='projects/'+TN.FB.projectId+'/databases/(default)/documents/reports/'+id;
  const body={writes:[{update:{name:name,fields:{uid:{stringValue:a.uid},kind:{stringValue:kind},lat:{doubleValue:lat},lng:{doubleValue:lng},hd:{doubleValue:Math.round(hd||0)},up:{integerValue:'0'},down:{integerValue:'0'}}},
    currentDocument:{exists:false},updateTransforms:[{fieldPath:'t',setToServerValue:'REQUEST_TIME'},{fieldPath:'last',setToServerValue:'REQUEST_TIME'}]}]};
  const r=await fetch(this.base()+':commit',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+a.id},body:JSON.stringify(body)});
  if(!r.ok) throw new Error('report '+r.status);
  this.lastFetch=0;return id;
};
/* "Still there" (+1 up) or "Gone" (+1 down) */
TN.Reports.prototype.vote=async function(id,up){
  if(this.voted.has(id)) return;this.voted.add(id);
  const a=await this.token(),name='projects/'+TN.FB.projectId+'/databases/(default)/documents/reports/'+id;
  const body={writes:[{transform:{document:name,fieldTransforms:[{fieldPath:up?'up':'down',increment:{integerValue:'1'}},{fieldPath:'last',setToServerValue:'REQUEST_TIME'}]}}]};
  await fetch(this.base()+':commit',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+a.id},body:JSON.stringify(body)});
  this.lastFetch=0;
};
/* the reports around the car (a band of latitude, then the rest filtered here), every minute */
TN.Reports.prototype.fetch=async function(lng,lat){
  try{
    const a=await this.token();this.me=a.uid;
    const q={structuredQuery:{from:[{collectionId:'reports'}],where:{compositeFilter:{op:'AND',filters:[
      {fieldFilter:{field:{fieldPath:'lat'},op:'GREATER_THAN_OR_EQUAL',value:{doubleValue:lat-0.06}}},
      {fieldFilter:{field:{fieldPath:'lat'},op:'LESS_THAN_OR_EQUAL',value:{doubleValue:lat+0.06}}}]}},limit:300}};
    const r=await fetch(this.base()+':runQuery',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+a.id},body:JSON.stringify(q)});
    if(!r.ok){this.err=r.status;return;}
    const rows=await r.json(),now=Date.now(),out=[];
    for(const row of rows){const d=row.document;if(!d||!d.fields) continue;const f=d.fields;
      const g=k=>f[k]?(f[k].doubleValue!=null?+f[k].doubleValue:f[k].integerValue!=null?+f[k].integerValue:f[k].stringValue!=null?f[k].stringValue:f[k].timestampValue||null):null;
      const kind=g('kind'),t=Date.parse(g('t')||''),last=Date.parse(g('last')||'')||t,up=g('up')||0,down=g('down')||0,rl=g('lat'),rn=g('lng');
      if(!kind||!t||Math.abs(rn-lng)>0.09) continue;
      const life=(TN.REPORT_LIFE[kind]||240)*60000;
      if(now-last>life) continue;            /* expired (a "still there" keeps it alive) */
      if(down>=2&&down>up) continue;         /* drivers said it's gone */
      out.push({id:d.name.split('/').pop(),kind:kind,pts:[TN.toLocal(rn,rl)],ll:[rn,rl],desc:'',from:'',to:'',road:'',user:true,t:t,up:up,down:down,mine:g('uid')===(this.me||'')});}
    this.list=out;this.err=null;
  }catch(e){this.err='net';}
};
