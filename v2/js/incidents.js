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
TN.ROCCO_TITLE={rail:'Railway crossing',camera:'Speed camera',speedred:'Speed and red-light camera',redlight:'Red-light camera',mobile:'Mobile radar zone',stand:'Standstill',jam:'Heavy traffic',pothole:'Pothole',accident:'Accident',fog:'Fog',hazard:'Danger on the road',rain:'Heavy rain',ice:'Ice',lane:'Lane closed',closed:'Road closed',works:'Road works',
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
  rail:['Look both ways. Trains don\u2019t brake for raccoons.','Choo choo! Rocco is listening for trains.','Tracks ahead. Slow down, look, listen.'],
  camera:['Smile! Rocco checked your speed.','Say cheese at the speed limit.','Flash photography ahead.'],
  speedred:['Speed and red lights: Rocco sees both.','Green means go, red means photo.'],
  redlight:['Red means stop. Rocco means it.','Yellow is not a dare.','Camera loves a full stop.'],
  mobile:['Rocco spotted a radar hideout.','Mobile radar zone. Easy on the pedal.','The radar might be home today.'],
  stand:['Rocco fell asleep. Nobody\u2019s moving.','Parking lot mode: on.','Time to learn some French verbs.'],
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
    case 'rail':face=wide+smile;extra='<path d="M58 -30 V48" stroke="#9aa3ab" stroke-width="5"/><path d="M40 -28 L76 2 M76 -28 L40 2" stroke="#fff" stroke-width="9" stroke-linecap="round"/><path d="M40 -28 L76 2 M76 -28 L40 2" stroke="#e5352b" stroke-width="5" stroke-linecap="round"/>'+
      '<circle cx="50" cy="16" r="5" fill="#e5352b"/><circle cx="66" cy="16" r="5" fill="#e5352b"/><path d="M-76 50 H-20 M-76 42 H-20" stroke="#6b5a4c" stroke-width="3"/><path d="M-70 38 v16 M-58 38 v16 M-46 38 v16 M-34 38 v16" stroke="#8a7a6b" stroke-width="3"/>';break;
    case 'camera':case 'speedred':extra='<rect x="40" y="-6" width="34" height="24" rx="4" fill="#3a3f47"/><circle cx="57" cy="6" r="8" fill="#9fb3c8" stroke="#1d2024" stroke-width="3"/><rect x="62" y="-12" width="10" height="6" rx="2" fill="#3a3f47"/>'+
      '<path d="M66 -24 l6 -8 M74 -18 l9 -4 M58 -26 l1 -9" stroke="#fcd34d" stroke-width="3" stroke-linecap="round"/>'+(kind==='speedred'?'<circle cx="-58" cy="20" r="9" fill="#e5352b"/><rect x="-68" y="8" width="20" height="40" rx="5" fill="none" stroke="#3a3f47" stroke-width="4"/>':'');break;
    case 'redlight':face=wide+smile;extra='<rect x="44" y="-30" width="24" height="62" rx="7" fill="#3a3f47"/><circle cx="56" cy="-17" r="7" fill="#e5352b"/><circle cx="56" cy="1" r="7" fill="#5f5a2a"/><circle cx="56" cy="19" r="7" fill="#2a4a2f"/><path d="M56 32 v18" stroke="#3a3f47" stroke-width="5"/>';break;
    case 'mobile':face='<circle cx="-16" cy="-4" r="3.5" fill="#111"/><circle cx="18" cy="-4" r="3.5" fill="#111"/><path d="M-24 -14 l12 3 M24 -14 l-12 3" stroke="#111" stroke-width="4" stroke-linecap="round"/>'+smile;
      extra='<rect x="42" y="-8" width="30" height="20" rx="4" fill="#3a3f47"/><circle cx="57" cy="2" r="6" fill="#9fb3c8"/><path d="M57 12 l-12 38 M57 12 v38 M57 12 l12 38" stroke="#6b7280" stroke-width="3"/>';break;
    case 'stand':face='<path d="M-24 -4 q7 4 14 0 M10 -4 q7 4 14 0" stroke="#111" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse cx="0" cy="25" rx="5" ry="4" fill="#5a1f1f"/>';
      extra='<text x="40" y="-38" font-size="22" font-weight="700" fill="#7fb2e5" font-family="system-ui,sans-serif">Z</text><text x="58" y="-54" font-size="15" font-weight="700" fill="#7fb2e5" font-family="system-ui,sans-serif">z</text>'+
        '<rect x="-60" y="34" width="34" height="14" rx="4" fill="#e5352b"/><rect x="-54" y="27" width="20" height="10" rx="3" fill="#e5352b"/><circle cx="-52" cy="49" r="4" fill="#111"/><circle cx="-34" cy="49" r="4" fill="#111"/>'+
        '<rect x="-24" y="34" width="34" height="14" rx="4" fill="#f2c21c"/><rect x="-18" y="27" width="20" height="10" rx="3" fill="#f2c21c"/><circle cx="-16" cy="49" r="4" fill="#111"/><circle cx="2" cy="49" r="4" fill="#111"/>'+
        '<rect x="12" y="34" width="34" height="14" rx="4" fill="#3b82f6"/><rect x="18" y="27" width="20" height="10" rx="3" fill="#3b82f6"/><circle cx="20" cy="49" r="4" fill="#111"/><circle cx="38" cy="49" r="4" fill="#111"/>';break;
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
    '.tn-inc.rail{border-color:#e5352b}.tn-inc.camera,.tn-inc.speedred,.tn-inc.redlight,.tn-inc.mobile{border-color:#1f3a66}.tn-inc.jam{border-color:#f28c1c}.tn-inc.jam.stand{border-color:#b91c1c}.tn-inc.works,.tn-inc.lane{border-color:#f28c1c}.tn-inc.ice,.tn-inc.fog,.tn-inc.flood,.tn-inc.rain,.tn-inc.wind{border-color:#3b82f6}'+
    '#tn-alert{left:50%;bottom:24px;transform:translateX(-50%);display:none;align-items:center;gap:10px;padding:6px 14px 6px 8px;max-width:min(80vw,520px);z-index:8}'+
    '#tn-alert b{font-size:19px;display:block}#tn-alert small{color:#9fb3c8;font-size:13px;display:block;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#tn-alert .joke{color:#fcd34d}'+
    'body.tn-routing #tn-alert{bottom:96px}'+
    '#tn-alert .v{border:0;border-radius:10px;padding:10px 14px;font:600 15px system-ui,sans-serif;cursor:pointer;margin-left:6px}#tn-alert .up{background:#1fa596;color:#fff}#tn-alert .down{background:#3a4352;color:#e8f1fa}'+
    '.tn-inc.user{border-style:dashed}'+
    '#tn-report{right:16px;bottom:356px;display:flex;align-items:center;gap:6px;padding:6px 14px 6px 8px;border:0;font:600 16px system-ui,sans-serif;color:#fcd34d;cursor:pointer}'+
    '#tn-repgrid{left:50%;top:50%;transform:translate(-50%,-50%);display:none;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:12px;z-index:10;width:min(94vw,560px)}'+
    '#tn-repgrid{background:rgba(10,18,32,.98)!important}body.tn-reporting #tn-report{display:none!important}'+
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
TN.Incidents.prototype.merge=function(){this.list=this.tt.concat(this.reports.list,(TN.settings&&TN.settings.cameras===false)?[]:(this.cams||[]),(TN.settings&&TN.settings.rail===false)?[]:(this.rails||[]));this.drawMarkers();};
/* railway crossings (level crossings) within about 1.5 km, from the road tiles */
TN.Incidents.prototype.findRails=function(car){
  const net=this.api.net;if(!net||!net.marks||!car||car.x==null) return;
  const out=[],seen=new Set();
  const pub={motorway:1,trunk:1,primary:1,secondary:1,tertiary:1,minor:1};
  for(const m of net.marks.values()){if(m.kind!=='r') continue;const d=Math.hypot(m.x-car.x,m.z-car.z);if(d>1500) continue;
    /* only crossings on public roads (not service roads inside rail yards and industrial sites) */
    let road=null;net.near(m.x,m.z,5,(w,k)=>{if(road||!pub[w.cls]) return;if(TN.seg(w,k,m.x,m.z).d<5) road=w;});if(!road) continue;
    /* crossings within 150 m of each other (double tracks, several tracks side by side) count as one */
    if(out.some(o=>Math.hypot(o.pts[0][0]-m.x,o.pts[0][1]-m.z)<150)) continue;
    out.push({id:'rail'+m.key,kind:'rail',pts:[[m.x,m.z]],ll:TN.fromLocal(m.x,m.z),desc:'',from:'',to:'',road:road.name||'',rail:true});}
  const sig=out.map(o=>o.id).join('|');if(sig!==this.railSig){this.railSig=sig;this.rails=out;this.merge();}
};
/* speed and red-light cameras (Transports Quebec's open data, refreshed weekly with the road tiles) */
TN.Incidents.prototype.loadCams=async function(){
  if(this.camsLoading||this.cams) return;this.camsLoading=true;
  try{let j=null;try{const c=JSON.parse(localStorage.getItem('tn2_cams')||'null');if(c&&Date.now()-c.t<86400000) j=c.j;}catch(e){}
    if(!j){const r=await fetch((this.api.roadsBase||'https://tessynav.github.io/tessynav-roads/')+'radars.json?d='+new Date().toISOString().slice(0,10));if(!r.ok) throw 0;j=await r.json();
      try{localStorage.setItem('tn2_cams',JSON.stringify({t:Date.now(),j:j}));}catch(e){}}
    const K={f:'camera',r:'redlight',fr:'speedred',m:'mobile'};
    this.cams=(j.r||[]).map(e=>{const lng=e[0],lat=e[1];let dir=e[3];
      /* on the island of Montreal and in Laval, "north" follows the street grid, about 35 degrees west of true north */
      if(dir>=0&&lat>45.40&&lat<45.72&&lng>-73.98&&lng<-73.47) dir=(dir-35+360)%360;
      return {id:'cam'+(e[4]||lng+','+lat),kind:K[e[2]]||'camera',pts:[TN.toLocal(lng,lat)],ll:[lng,lat],dir:dir,desc:e[5]||'',from:'',to:'',road:'',cam:true};});
    this.merge();
  }catch(e){this.camsTried=Date.now();}
  this.camsLoading=false;
};
TN.Incidents.prototype.nearest=function(max){
  const c=this.api.getCar&&this.api.getCar();if(!c||c.x==null||this.list.length<=max) return this.list;
  return this.list.slice().sort((a,b)=>Math.hypot(a.pts[0][0]-c.x,a.pts[0][1]-c.z)-Math.hypot(b.pts[0][0]-c.x,b.pts[0][1]-c.z)).slice(0,max);};
TN.Incidents.prototype.drawMarkers=function(){
  if(typeof maplibregl==='undefined') return;
  const c=this.api.getCar&&this.api.getCar(),follow=this.api.following?this.api.following():true;
  const vis=i=>{if(i.kind==='jam'&&i.sev<2) return false;if(!c||c.x==null) return true;
    const dx=i.pts[0][0]-c.x,dz=i.pts[0][1]-c.z,d=Math.hypot(dx,dz);if(d>(i.rail?800:3000)) return false;
    if(follow&&d>150){const h=(c.hd||0)*Math.PI/180;if((dx*Math.sin(h)-dz*Math.cos(h))/d<0.2) return false;}return true;};
  const shown=[];for(const i of this.nearest(40).filter(vis)){
    if(shown.some(o=>o.kind===i.kind&&Math.hypot(o.pts[0][0]-i.pts[0][0],o.pts[0][1]-i.pts[0][1])<40)) continue;shown.push(i);}
  const keep=new Set(shown.map(i=>i.id));
  for(const [id,m] of this.markers) if(!keep.has(id)){try{m.remove();}catch(e){}this.markers.delete(id);}
  const night=(this.api.scene&&this.api.scene.night||0)>0.45;
  for(const it of shown){if(this.markers.has(it.id)) continue;
    const el=document.createElement('div');el.className='tn-inc '+it.kind+(it.user?' user':'')+(it.sev===3?' stand':'');el.innerHTML=TN.ROCCO(it.sev===3?'stand':it.kind,40,night);
    el.title=it.title||TN.ROCCO_TITLE[it.kind];el.onclick=e=>{e.stopPropagation();this.show(it,null,true);};
    this.markers.set(it.id,new maplibregl.Marker({element:el}).setLngLat(it.ll).addTo(this.api.map));}
};
TN.Incidents.prototype.clear=function(){for(const m of this.markers.values()){try{m.remove();}catch(e){}}this.markers.clear();this.hide();};
/* distance from the car to an incident, along the route if there is one, otherwise straight ahead */
/* the stretch of road ahead of you, as a line with distances: the route (when navigating), otherwise the road you're on
   followed through the road network (at each junction the most natural continuation, preferring the same street) */
TN.Incidents.prototype.wayAhead=function(car,maxL){
  const nav=this.api.nav,R=nav&&nav.active?nav.route:null,pts=[],cum=[];
  if(R){const i0=nav.idx||0,s0=R.cum[i0]||0;for(let i=i0;i<R.pts.length&&R.cum[i]-s0<=maxL+50;i++){pts.push(R.pts[i]);cum.push(R.cum[i]-s0);}return pts.length>1?{pts,cum}:null;}
  const T=(this.api.getCar&&this.api.getCar())||car,net=this.api.net;let w=T.w||car.w,dir=T.dir||car.dir||1,s=T.w?T.s:car.s;
  if(!net||!w||!w.pts||s==null){
    /* (no road known right now, e.g. in the middle of a turn: a straight line ahead in your direction) */
    const hr=(car.hd||0)*Math.PI/180,fx=Math.sin(hr),fz=-Math.cos(hr);
    for(let d=0;d<=maxL;d+=10){pts.push([car.x+fx*d,car.z+fz*d]);cum.push(d);}return {pts,cum};}
  let acc=0,prev=[car.x,car.z];pts.push(prev);cum.push(0);
  const add=q=>{acc+=Math.hypot(q[0]-prev[0],q[1]-prev[1]);pts.push(q);cum.push(acc);prev=q;};
  for(let hop=0;hop<10&&acc<maxL;hop++){
    let endI;
    if(dir>0){for(let i=0;i<w.pts.length&&acc<maxL;i++) if(w.cum[i]>s+0.5) add(w.pts[i]);endI=w.pts.length-1;}
    else{for(let i=w.pts.length-1;i>=0&&acc<maxL;i--) if(w.cum[i]<s-0.5) add(w.pts[i]);endI=0;}
    if(acc>=maxL) break;
    const a=w.pts[dir>0?Math.max(0,endI-1):Math.min(w.pts.length-1,endI+1)],b=w.pts[endI];let hx=b[0]-a[0],hz=b[1]-a[1];const hl=Math.hypot(hx,hz)||1;hx/=hl;hz/=hl;
    const lst=(net.keys&&net.keys.get(w.keys[endI]))||[];let best=null;
    for(const [v,i] of lst){if(v===w||v.tun===undefined&&!v.pts) continue;
      for(const d of [1,-1]){
        if(d>0&&i>=v.pts.length-1) continue;if(d<0&&i<=0) continue;if(d<0&&v.ow) continue;
        const q=v.pts[i+d];let vx=q[0]-v.pts[i][0],vz=q[1]-v.pts[i][1];const vl=Math.hypot(vx,vz)||1;vx/=vl;vz/=vl;
        const cos=vx*hx+vz*hz;if(cos<0.5) continue;   /* (no sharp turns: more than 60 degrees is not "straight on") */
        const sc=cos+(v.name&&v.name===w.name?0.3:0);if(!best||sc>best.sc) best={v,d,i,sc};}}
    if(!best) break;
    w=best.v;dir=best.d;s=w.cum[best.i];}
  return pts.length>1?{pts,cum}:null;
};
/* the closest incident on your way: within 12 m of the way ahead, and (for those that follow a road: traffic,
   closures, works) going in your direction; first alert at about 1.5 km at highway speed, 600 m in the city */
TN.Incidents.prototype.ahead=function(car,moderate){
  const now=Date.now();
  if(car.v!=null&&(car.v||0)<2&&!(this.api.nav&&this.api.nav.active)) return null;   /* (no route and parked: no alerts) */
  const maxD=(car.v||0)>19.5?1500:600;
  if(!this.wayC||now-this.wayC.t>500||Math.hypot(car.x-this.wayC.x,car.z-this.wayC.z)>15){this.wayC={t:now,x:car.x,z:car.z,way:this.wayAhead(car,maxD)};}
  const W=this.wayC.way;if(!W) return null;
  const P=W.pts,C=W.cum;let best=null;
  for(const it of this.list){
    if(it.mine) continue;   /* (your own reports: on the map, but no alert) */
    if(it.cam&&it.dir>=0&&Math.abs((((car.hd||0)-it.dir)+540)%360-180)>75) continue;   /* (camera facing the other way) */
    if((it.kind==='jam'&&it.sev<2)!==!!moderate) continue;   /* (moderate traffic is checked on its own: said, not shown) */
    if(it.kind==='jam'&&it.pts.some(p=>Math.hypot(p[0]-car.x,p[1]-car.z)<40)) continue;   /* (already in that jam) */
    /* (quick skip: nothing of it near the way ahead) */
    const p0=it.pts[0];if(Math.hypot(p0[0]-car.x,p0[1]-car.z)>maxD+3000) continue;
    const follows=it.pts.length>=2&&!it.rail&&!it.cam&&!it.user;
    let d=null;
    for(let k=0;k<it.pts.length;k++){const p=it.pts[k];
      let ix=0,iz=0;if(follows){const q=it.pts[Math.min(it.pts.length-1,k+1)],o=it.pts[Math.max(0,k-1)];ix=q[0]-o[0];iz=q[1]-o[1];const l=Math.hypot(ix,iz)||1;ix/=l;iz/=l;}
      for(let i=0;i<P.length-1;i++){const a=P[i],b=P[i+1],sx=b[0]-a[0],sz=b[1]-a[1],l2=sx*sx+sz*sz||1;
        const u=Math.max(0,Math.min(1,((p[0]-a[0])*sx+(p[1]-a[1])*sz)/l2)),qx=a[0]+sx*u,qz=a[1]+sz*u;
        if(Math.hypot(p[0]-qx,p[1]-qz)>12) continue;
        if(follows){const l=Math.sqrt(l2);if((ix*sx+iz*sz)/l<0.7) continue;}   /* (cross street or the other direction) */
        const dd=C[i]+(C[i+1]-C[i])*u;if(dd>=0&&dd<=maxD&&(d==null||dd<d)) d=dd;break;}
      if(d!=null&&d<50) break;}
    if(d!=null&&(!best||d<best.d)) best={it:it,d:d};
  }
  return best;
};
TN.Incidents.prototype.fun=function(){return !(TN.settings&&TN.settings.fun===false);};
TN.Incidents.prototype.show=function(it,d,tapped){
  const key=it.id+':'+(d==null?'':Math.round(d/50))+':'+this.fun();if(this.cardKey===key&&this.card.style.display==='flex') return;this.cardKey=key;
  const night=(this.api.scene&&this.api.scene.night||0)>0.45;
  if(this.alertFor!==it.id){this.joke=(TN.ROCCO_JOKES[it.sev===3?'stand':it.kind]||TN.ROCCO_JOKES.unknown);this.joke=this.joke[Math.floor(Math.random()*this.joke.length)];this.alertFor=it.id;
    /* said once per incident, when it first comes up ahead */
    if(!tapped&&TN.voice&&d!=null&&!(this.spoken||(this.spoken=new Set())).has(it.id)){this.spoken.add(it.id);
      TN.voice.say((it.user?(it.title||TN.ROCCO_TITLE[it.kind])+' reported':(it.title||TN.ROCCO_TITLE[it.kind]))+' ahead, '+(d<950?Math.round(d/50)*50+' metres':(d/1000).toFixed(1)+' kilometres'));}}
  const dist=d==null?'':' \u00b7 '+(d<950?Math.round(d/50)*50+' m':(d/1000).toFixed(1)+' km');
  const jamInfo=it.kind==='jam'?[(it.delay>=60?'+'+Math.round(it.delay/60)+' min':''),(it.len?(it.len<950?Math.round(it.len/50)*50+' m':(it.len/1000).toFixed(1)+' km')+' long':'')].filter(Boolean).join(' \u00b7 '):'';
  const detail=[jamInfo,it.kind==='jam'?'':it.desc,it.road,it.from&&it.to?it.from+' \u2192 '+it.to:it.from].filter(Boolean).join(' \u00b7 ');
  const who=it.user?'Reported by a driver \u00b7 '+Math.max(1,Math.round((Date.now()-it.t)/60000))+' min ago'+(it.up?' \u00b7 '+it.up+' confirmed':''):'';
  const canVote=it.user&&!it.mine&&!this.reports.voted.has(it.id)&&(d==null||d<500);
  this.card.innerHTML=(this.fun()?TN.ROCCO(it.sev===3?'stand':it.kind,50,night):'')+'<div style="min-width:0;flex:1"><b>'+TN.esc((it.title||TN.ROCCO_TITLE[it.kind])+dist)+'</b>'+
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
  const g=this.grid;g.style.display='grid';document.body.classList.add('tn-reporting');
  g.innerHTML=TN.REPORT_KINDS.map(k=>'<button data-k="'+k+'">'+TN.ROCCO(k,52)+'<span>'+TN.ROCCO_TITLE[k]+'</span></button>').join('')+'<button class="x" data-k="">Cancel</button>';
  g.querySelectorAll('button').forEach(b=>b.onclick=async()=>{g.style.display='none';document.body.classList.remove('tn-reporting');const k=b.dataset.k;if(!k) return;
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
  if(!this.cams&&!this.camsLoading&&now-(this.camsTried||0)>300000) this.loadCams();
  if(now-(this.railT||0)>2000){this.railT=now;this.findRails(car);}
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
TN.REPORT_KINDS=['police','accident','jam','stand','closed','lane','works','breakdown','pothole','hazard','ice','fog','flood','rain','wind'];
TN.REPORT_LIFE={police:60,accident:120,jam:30,stand:30,breakdown:60,fog:120,rain:120,wind:120,flood:180};   /* minutes (traffic changes quickly) */   /* minutes a report stays up (default 4 h) */
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
      /* driver traffic reports become jams: heavy traffic, or a standstill */
      const isJam=kind==='jam'||kind==='stand';
      out.push({id:d.name.split('/').pop(),kind:isJam?'jam':kind,sev:isJam?(kind==='stand'?3:2):0,title:isJam?TN.ROCCO_TITLE[kind]:null,
        pts:[TN.toLocal(rn,rl)],ll:[rn,rl],desc:'',from:'',to:'',road:'',user:true,t:t,up:up,down:down,mine:g('uid')===(this.me||'')});}
    this.list=out;this.err=null;
  }catch(e){this.err='net';}
};
