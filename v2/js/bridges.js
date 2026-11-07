/* TessyNav v2 — bridges.js (v1)
   Montreal's bridges and tunnels at a glance: live crossing time (TomTom traffic speed on each carriageway) and
   Transports Québec closures, in each direction ("Leaving Montreal" / "Into Montreal"). Opened from the Bridges tile in
   the search panel; read only when opened (and reused for 2 minutes). When a planned route crosses a bridge that is
   slow or partly closed, Rocco's line in the route overview says so (and names a clear alternative).
   Positions and directions come from TessyNav's own road tiles (OpenStreetMap). */
var TN=globalThis.TN||{};globalThis.TN=TN;
TN.BRIDGES=[{"id": "champlain", "name": "Samuel-De Champlain", "ref": "A-10 / A-15", "g": "south", "len": 3503, "tun": false, "mid": [45.46905, -73.51599], "out": [45.46915, -73.51544], "in": [45.46986, -73.52025], "both": false, "brg": 96}, {"id": "jc", "name": "Jacques-Cartier", "ref": "Route 134", "g": "south", "len": 2861, "tun": false, "mid": [45.52231, -73.53973], "out": [45.52423, -73.55013], "in": [45.52423, -73.55013], "both": true, "brg": null}, {"id": "victoria", "name": "Victoria", "ref": "Route 112", "g": "south", "len": 4131, "tun": false, "mid": [45.49441, -73.52114], "out": [45.48922, -73.53673], "in": [45.48922, -73.53673], "both": true, "brg": null}, {"id": "lafontaine", "name": "Louis-H.-La Fontaine tunnel", "ref": "A-25", "g": "south", "len": 1399, "tun": true, "mid": [45.58368, -73.50044], "out": [45.58184, -73.49194], "in": [45.58552, -73.50894], "both": false, "brg": 107}, {"id": "mercier", "name": "Honoré-Mercier", "ref": "Route 138", "g": "south", "len": 2061, "tun": false, "mid": [45.40927, -73.65895], "out": [45.41261, -73.65732], "in": [45.41378, -73.65659], "both": false, "brg": 200}, {"id": "a15", "name": "Médéric-Martin", "ref": "A-15", "g": "north", "len": 639, "tun": false, "mid": [45.54008, -73.71143], "out": [45.54097, -73.71311], "in": [45.54085, -73.71324], "both": false, "brg": 314}, {"id": "papineau", "name": "Papineau-Leblanc", "ref": "A-19", "g": "north", "len": 446, "tun": false, "mid": [45.57595, -73.66662], "out": [45.57549, -73.66598], "in": [45.57597, -73.66675], "both": false, "brg": 322}, {"id": "pieix", "name": "Pie-IX", "ref": "Route 125", "g": "north", "len": 522, "tun": false, "mid": [45.59954, -73.64736], "out": [45.59793, -73.64485], "in": [45.59785, -73.64497], "both": false, "brg": 313}, {"id": "a25", "name": "Olivier-Charbonneau", "ref": "A-25 (toll)", "g": "north", "len": 1198, "tun": false, "mid": [45.63645, -73.61892], "out": [45.63645, -73.61882], "in": [45.63695, -73.61957], "both": false, "brg": 323}, {"id": "bisson", "name": "Louis-Bisson", "ref": "A-13", "g": "north", "len": 709, "tun": false, "mid": [45.58093, -73.83777], "out": [45.5835, -73.84045], "in": [45.57837, -73.83509], "both": false, "brg": 322}, {"id": "lachapelle", "name": "Lachapelle", "ref": "Route 117", "g": "north", "len": 265, "tun": false, "mid": [45.5329, -73.72808], "out": [45.53388, -73.72904], "in": [45.53192, -73.72711], "both": false, "brg": 320}];
TN.Bridges=function(api){this.api=api;this.cache=new Map();this.dir='out';};
/* the crossing time in one direction: TomTom's live speed on that carriageway, over the bridge's length */
TN.Bridges.prototype.flow=async function(b,dir){
  const key=b.id+':'+(b.both?'x':dir),c=this.cache.get(key);if(c&&Date.now()-c.t<120000) return c.v;
  const p=b[dir==='in'?'in':'out'];let v=null;
  try{const r=await fetch('https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point='+p[0]+','+p[1]+'&unit=KMPH&key='+TN.TT);
    if(r.ok){const j=(await r.json()).flowSegmentData;
      if(j){const cur=Math.max(3,j.currentSpeed||0),ff=Math.max(cur,j.freeFlowSpeed||cur);
        v={now:b.len/1000/cur*60,norm:b.len/1000/ff*60,closed:!!j.roadClosure,ratio:cur/ff};}}}catch(e){}
  this.cache.set(key,{t:Date.now(),v:v});return v;
};
/* Transports Québec events on (or at the ends of) a crossing */
TN.Bridges.prototype.mtq=function(b){
  const inc=TN.incidentsObj;if(!inc||!inc.mtqAll||!TN.toLocal) return null;
  const m=TN.toLocal(b.mid[1],b.mid[0]),R=b.len/2+250;let best=null;
  for(const e of inc.mtqAll){if(!/closed|lane|works/.test(e.kind)) continue;
    if(e.pts.some(q=>Math.hypot(q[0]-m[0],q[1]-m[1])<R)){if(!best||e.kind==='closed') best=e;}}
  return best;
};
TN.Bridges.prototype.status=async function(b,dir){
  const f=await this.flow(b,dir),e=this.mtq(b);
  const s={b:b,mins:f?Math.max(1,Math.round(f.now)):null,delay:f?Math.round(f.now-f.norm):0,ev:e};
  if((f&&f.closed)||(e&&e.kind==='closed')) s.tone='red',s.txt=e&&e.kind==='closed'?'closed (Transports Québec)':'closed';
  else if(e&&e.kind==='lane') s.tone='red',s.txt='lane closed (Transports Québec)';
  else if(s.delay>=5) s.tone='amber',s.txt='slow';
  else if(f) s.tone='green',s.txt=e?'works nearby':'fluid';
  else s.tone='plain',s.txt='no traffic data';
  return s;
};
/* where you are: the car on its road, or else the GPS position (at home or in a lot the car isn't placed yet) */
TN.Bridges.prototype.pos=function(){
  const ok=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);   /* (a car not placed yet can hold "not a number" positions) */
  const c=this.api.getCar&&this.api.getCar();if(ok(c)) return c;
  const g=this.api.gps&&this.api.gps();if(ok(g)) return g;
  /* last resort: the map's centre */
  try{const m=this.api.map&&this.api.map.getCenter();if(m&&TN.toLocal){const q=TN.toLocal(m.lng,m.lat);return {x:q[0],z:q[1]};}}catch(e){}
  return null;
};
TN.Bridges.prototype.near=function(){
  const c=this.pos();if(!c||!TN.toLocal) return null;let best=null,bd=1e12;
  for(const b of TN.BRIDGES){const m=TN.toLocal(b.mid[1],b.mid[0]),d=Math.hypot(m[0]-c.x,m[1]-c.z);if(d<bd){bd=d;best=b;}}
  return bd<70000?{b:best,d:bd}:null;
};
const esc=t=>(TN.esc?TN.esc(t):String(t==null?'':t));
TN.Bridges.prototype.css=function(){
  if(document.getElementById('tn-br-css')) return;const st=document.createElement('style');st.id='tn-br-css';
  st.textContent='#tn-br{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:40;width:min(92vw,560px);max-height:80vh;display:none;flex-direction:column;background:rgb(var(--tn-panel-rgb,43 45 49)/.98);color:var(--tn-text,#f3f1ec);border-radius:18px;box-shadow:0 10px 40px rgba(0,0,0,.5);font:15px system-ui,sans-serif;overflow:hidden}'+
   '#tn-br .hd{display:flex;align-items:center;gap:10px;padding:16px 18px 6px}#tn-br .hd b{font-size:19px}#tn-br .hd small{margin-left:auto;color:var(--tn-sub,#b9b6ae)}#tn-br .x{cursor:pointer;padding:4px}'+
   '#tn-br .dir{display:flex;gap:8px;padding:6px 18px}#tn-br .dir button{flex:1;border:0;border-radius:10px;padding:9px;font:600 14px system-ui,sans-serif;background:rgba(255,255,255,.08);color:var(--tn-text,#f3f1ec)}#tn-br .dir button.on{background:var(--tn-accent,#e8913a);color:#2b1a08}'+
   '#tn-br .list{overflow-y:auto;padding:4px 14px 14px}#tn-br .g{font-size:12px;letter-spacing:.06em;color:var(--tn-sub,#b9b6ae);margin:12px 4px 6px}'+
   '#tn-br .it{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:11px;margin-bottom:6px;background:rgba(255,255,255,.05);cursor:pointer}#tn-br .it .d{width:10px;height:10px;border-radius:50%;flex-shrink:0;background:#888}'+
   '#tn-br .it b{display:block;font-weight:600}#tn-br .it small{color:var(--tn-sub,#b9b6ae)}#tn-br .it .t{margin-left:auto;text-align:right;white-space:nowrap}#tn-br .it .t b{font-size:16px}'+
   '#tn-br .it.green .d{background:#1d9e75}#tn-br .it.amber{background:rgba(245,158,11,.14)}#tn-br .it.amber .d{background:#f59e0b}#tn-br .it.red{background:rgba(239,68,68,.16)}#tn-br .it.red .d{background:#ef4444}#tn-br .it.close{outline:1.5px solid rgba(255,255,255,.35)}'+
   '#tn-br .it.amber small,#tn-br .it.amber .t{color:#fcd34d}#tn-br .it.red small,#tn-br .it.red .t{color:#fca5a5}#tn-br .tn-rline{margin:8px 18px 2px}';
  document.head.appendChild(st);
};
TN.Bridges.prototype.open=async function(){
  this.css();let P=document.getElementById('tn-br');
  if(!P){P=document.createElement('div');P.id='tn-br';document.body.appendChild(P);}
  const fr=TN.LANG==='fr',dir=this.dir,near=this.near();
  P.innerHTML='<div class="hd"><b>Bridges and tunnels</b><small>…</small><span class="x">'+(TN.ICON?TN.ICON('x',22,'#9fb3c8'):'×')+'</span></div>'+
    '<div class="dir"><button class="'+(dir==='out'?'on':'')+'" data-d="out">Leaving Montreal</button><button class="'+(dir==='in'?'on':'')+'" data-d="in">Into Montreal</button></div><div class="rl"></div><div class="list">Loading…</div>';
  P.style.display='flex';
  P.querySelector('.x').onclick=()=>{P.style.display='none';};
  P.querySelectorAll('.dir button').forEach(b=>b.onclick=()=>{this.dir=b.dataset.d;this.open();});
  const sts=await Promise.all(TN.BRIDGES.map(b=>this.status(b,dir)));
  if(P.style.display==='none') return;
  const row=s=>'<div class="it '+s.tone+(near&&near.b===s.b?' close':'')+'" data-id="'+s.b.id+'"><span class="d"></span><div><b>'+esc(s.b.name)+(near&&near.b===s.b?' <small>· closest</small>':'')+'</b><small>'+esc(s.b.ref)+' · '+esc(s.txt)+'</small></div>'+
    '<div class="t"><b>'+(s.mins!=null?s.mins+' min':'—')+'</b><br><small>'+(s.mins==null?'':s.delay>=2?'+'+s.delay+' min':'normal')+'</small></div></div>';
  const G=[['south','SOUTH SHORE'],['north','LAVAL AND NORTH SHORE']];
  P.querySelector('.list').innerHTML=G.map(g=>'<div class="g">'+g[1]+'</div>'+sts.filter(s=>s.b.g===g[0]).map(row).join('')).join('');
  P.querySelector('.hd small').textContent='Updated now';
  /* Rocco: the best crossing toward the side of the closest bridge */
  /* (the closest crossing that is clear: comparing crossing times alone would favour short bridges far away) */
  const dist=b=>{const c=this.pos();if(!c) return 0;const m=TN.toLocal(b.mid[1],b.mid[0]);return Math.hypot(m[0]-c.x,m[1]-c.z);};
  const grp=near?near.b.g:'south',ok=sts.filter(s=>s.b.g===grp&&s.mins!=null&&s.tone==='green'&&s.delay<2).sort((a,b)=>dist(a.b)-dist(b.b))[0];
  if(ok&&!(TN.settings&&TN.settings.fun===false)&&TN.roccoSVG){
    const side=grp==='south'?(fr?(dir==='out'?'la Rive-Sud':'Montréal'):(dir==='out'?'the South Shore':'Montreal')):(fr?(dir==='out'?'Laval':'Montréal'):(dir==='out'?'Laval':'Montreal'));
    P.querySelector('.rl').innerHTML='<div class="tn-rline notr">'+TN.roccoSVG(28)+'<span>'+(fr?(near&&ok.b===near.b?'Le plus proche, '+ok.b.name+', est fluide vers '+side+'.':ok.b.name+' est votre meilleure option vers '+side+' en ce moment.'):(near&&ok.b===near.b?'Your closest, '+ok.b.name+', is clear to '+side+'.':ok.b.name+' is your best bet to '+side+' right now.'))+'</span></div>';}
  P.querySelectorAll('.it').forEach(el=>el.onclick=()=>{const b=TN.BRIDGES.find(x=>x.id===el.dataset.id);P.style.display='none';
    if(b&&this.api.nav) this.api.nav.pick({name:(b.tun?'':'Pont ')+b.name,sub:b.ref,lng:b.mid[1],lat:b.mid[0]});});
};
/* the route crosses a bridge? if it is slow or partly closed, Rocco says so in the overview (and names a clear one) */
TN.Bridges.prototype.checkRoute=async function(nav){
  const R=nav.route;if(!R||!R.pts||!TN.toLocal) return;
  let hit=null;
  for(const b of TN.BRIDGES){const m=TN.toLocal(b.mid[1],b.mid[0]);
    for(let i=1;i<R.pts.length;i++){const p=R.pts[i];if(Math.abs(p[0]-m[0])>b.len/2+60||Math.abs(p[1]-m[1])>b.len/2+60) continue;
      if(Math.hypot(p[0]-m[0],p[1]-m[1])<b.len/2+40){const q=R.pts[i-1],brg=(Math.atan2(p[0]-q[0],-(p[1]-q[1]))*180/Math.PI+360)%360;
        let dir='out';if(b.brg!=null){const dd=Math.abs(((brg-b.brg)%360+540)%360-180);dir=dd<90?'out':'in';}hit={b:b,dir:dir};break;}}
    if(hit) break;}
  if(!hit) return;
  const s=await this.status(hit.b,hit.dir);if(nav.route!==R) return;
  if(!(s.tone==='red'||s.tone==='amber')) return;
  const hm=TN.toLocal(hit.b.mid[1],hit.b.mid[0]),dh=b=>{const m=TN.toLocal(b.mid[1],b.mid[0]);return Math.hypot(m[0]-hm[0],m[1]-hm[1]);};
  const alts=(await Promise.all(TN.BRIDGES.filter(b=>b.g===hit.b.g&&b!==hit.b).map(b=>this.status(b,hit.dir)))).filter(a=>a.tone==='green'&&a.delay<2).sort((a,b)=>dh(a.b)-dh(b.b));   /* (the nearest clear one) */
  const fr=TN.LANG==='fr',alt=alts[0],what=s.tone==='red'?(fr?(s.ev&&s.ev.kind==='closed'?'fermé':'une voie fermée'):(s.ev&&s.ev.kind==='closed'?'closed':'a lane closed')):(fr?'ralenti, +'+s.delay+' min':'slow, +'+s.delay+' min');
  const txt=fr?'Votre trajet passe par '+hit.b.name+' : '+what+'.'+(alt?' '+alt.b.name+' est fluide.':''):'Your route takes '+hit.b.name+': '+what+'.'+(alt?' '+alt.b.name+' is clear.':'');
  R.rocco={tone:s.tone==='red'?'red':'amber',text:txt};
  const el=nav.ov&&nav.ov.querySelector('.tn-rline');
  if(el){el.className='tn-rline notr '+R.rocco.tone;const sp=el.querySelector('span');if(sp) sp.textContent=txt;}
  else if(nav.ov&&!(TN.settings&&TN.settings.fun===false)){const bt=nav.ov.querySelector('.btns'),rl=nav.roccoHtml&&nav.roccoHtml();if(bt&&rl) bt.insertAdjacentHTML('beforebegin',rl);}
};
