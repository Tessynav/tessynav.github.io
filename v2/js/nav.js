/* TessyNav v2 — nav.js  (navigation, part 1)
   - search: results as you type (Photon, nearest first), recent destinations when the box is empty
   - route: OSRM (fastest by car), overview with time / distance / arrival, then Go or Cancel
   - the route as a blue line laid on the 3D roads (bridges included), trimmed behind the car
   - top bar: turn arrow, distance, instruction and street; arrival time, minutes and kilometres left
   - rerouting when you leave the route, arrival detection, End route
   Services: Photon (photon.komoot.io) and OSRM (router.project-osrm.org) are free public servers for testing. */
var TN=globalThis.TN||{};globalThis.TN=TN;
/* Mapbox (search, traffic-aware routes, live traffic). The key only works on tessynav.github.io. */
TN.MBX='pk.eyJ1IjoibXpud2F0dGFyIiwiYSI6ImNtdzNramNhMDAyaXIyeW9na3FpYnVtN2gifQ.Y9UmNDaEoXj0RRMTJLV-_g';
TN.TRAFFIC_COL={low:'#3b82f6',moderate:'#f59e0b',heavy:'#ef4444',severe:'#991b1b',unknown:'#3b82f6'};

TN.Nav=function(api){
  this.stops=[];
  this.note=(k,d,sh)=>{try{api.note&&api.note(k,d,sh);}catch(e){}};
  this.api=api;this.route=null;this.mesh=null;this.mat=null;this.idx=0;this.offT=0;this.lastReroute=0;this.arriveT=0;
  this.recent=[];try{this.recent=JSON.parse(localStorage.getItem('tn2_recent')||'[]')||[];}catch(e){}
};
/* ---------- screen ---------- */
TN.Nav.prototype.build=function(){
  const st=document.createElement('style');
  st.textContent=
   '#tn-search{right:82px;top:16px;width:min(40vw,520px);padding:0;display:flex;align-items:center}'+
   '#status{max-width:calc(100vw - min(40vw,520px) - 130px)!important}'+
   '#tn-search input{flex:1;min-width:0;background:transparent;border:0;outline:0;color:#e8f1fa;font:18px system-ui,sans-serif;padding:14px 16px 14px 6px}'+
   '#tn-search .i{padding-left:16px;flex-shrink:0}#tn-search .x{padding:0 14px;cursor:pointer;display:none;flex-shrink:0;align-items:center}'+
   '#tn-res{right:82px;top:76px;width:min(40vw,520px);padding:6px;display:none;max-height:56vh;overflow:auto}'+
   '#tn-res .r{display:flex;align-items:center;gap:12px;padding:14px 12px;border-radius:12px;cursor:pointer;font-size:17px}'+
   '#tn-res .r:active,#tn-res .r:hover{background:rgba(255,255,255,.08)}#tn-res .r small{display:block;color:#9fb3c8;font-size:13px;margin-top:2px}'+
   '#tn-res .d{margin-left:auto;color:#9fb3c8;font-size:14px;white-space:nowrap}#tn-res .msg{padding:12px;color:#9fb3c8}'+
   '#tn-ov{left:50%;bottom:24px;transform:translateX(-50%);display:none;align-items:center;gap:18px;padding:14px 18px;font-size:16px}'+
   '#tn-ov small{color:#9fb3c8;font-size:14px}#tn-ov button,#tn-end{border:0;border-radius:12px;padding:12px 22px;font:600 17px system-ui,sans-serif;cursor:pointer}'+
   '#tn-ov .go{background:#1fa596;color:#fff}#tn-ov .cancel,#tn-ov .stop{background:#3a4352;color:#e8f1fa}'+
   '#tn-ov{flex-wrap:wrap;max-width:min(94vw,640px)}#tn-ov .btns{display:flex;gap:10px;align-items:center}#tn-ov.tripbox{flex-direction:column;align-items:stretch}'+
   '#tn-ov .trip{margin-top:8px;display:flex;flex-direction:column;gap:4px}#tn-ov .row{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.05);border-radius:10px;padding:4px 6px}'+
   '#tn-ov .row .num{width:26px;height:26px;border-radius:50%;background:#f59e0b;color:#111;font:700 13px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;flex-shrink:0}#tn-ov .row .num.fin{background:transparent;font-size:18px}'+
   '#tn-ov .row .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:15px}'+
   '#tn-ov .row button{display:flex;align-items:center;justify-content:center;border:0;border-radius:8px;padding:7px 10px;font:600 15px system-ui,sans-serif;background:#3a4352;color:#e8f1fa;cursor:pointer}#tn-ov .row button:disabled{opacity:.3}'+
   '#tn-bar{left:16px;right:82px;top:16px;display:none;align-items:center;gap:16px;padding:12px 18px}'+
   '#tn-bar .a{width:44px;display:flex;justify-content:center}#tn-bar.jvon .a{width:116px;height:116px;flex-shrink:0;border-radius:10px;overflow:hidden;border:2px solid #378ADD}'+
   '#tn-bar .t{flex:1;min-width:0}#tn-bar .dist{font:600 26px system-ui,sans-serif}'+
   '#tn-bar .ins{font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
   '#tn-bar{padding-bottom:22px!important}#tn-bar .then{font-size:13px;color:#9fb3c8;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#tn-bar .then:empty{display:none}'+
   '#tn-bar .dline{display:flex;align-items:center;gap:14px}#tn-bar .lanes{display:flex;gap:3px}#tn-bar .lanes:empty{display:none}#tn-bar .lanes span{display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:5px;background:rgba(255,255,255,.08)}#tn-bar .lanes span.on{background:rgba(59,130,246,.35)}'+
   '#tn-bar .pb{position:absolute;left:18px;right:18px;bottom:9px;height:6px;border-radius:3px;background:#2a3444}'+
   '#tn-bar .pb .car{position:absolute;top:50%;left:0;width:13px;height:13px;border-radius:50%;background:#fff;border:3px solid #3b82f6;transform:translate(-50%,-50%);box-sizing:border-box}'+
   '#tn-bar .etabox{display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;max-width:40%}'+
   '#tn-bar .dst{border:1px solid rgba(252,211,77,.55);background:rgba(252,211,77,.12);color:#fcd34d;border-radius:999px;padding:5px 12px;font:600 14px system-ui,sans-serif;cursor:pointer;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
   '#tn-bar .exit{display:inline-block;background:#0b6b3a;color:#fff;border:2px solid #fff;border-radius:6px;padding:1px 8px;margin-right:10px;font:700 15px system-ui,sans-serif;letter-spacing:.04em;vertical-align:1px}#tn-bar .eta{text-align:right;color:#cfe3f5;font-size:14px}#tn-bar .eta b{font-size:20px;display:block;color:#fff}'+
   '#tn-end{right:16px;bottom:228px;display:none;background:rgba(10,18,32,.88);color:#ff8a80}'+
   '#tn-mute{right:16px;top:76px;width:50px;height:50px;padding:0;border:0;display:none;align-items:center;justify-content:center;cursor:pointer}body.tn-routing #tn-mute{display:flex}'+
   '#tn-stopbtn{right:16px;bottom:292px;display:none;border:0;border-radius:12px;padding:12px 22px;font:600 17px system-ui,sans-serif;cursor:pointer;background:rgba(10,18,32,.88);color:#fcd34d}body.tn-routing #tn-stopbtn{display:none}'+
   'body.tn-routing #trips{display:none!important}body.tn-routing #rec:not(.on){display:none!important}'+
   'body.tn-routing.tn-addstop #tn-search{display:flex}body.tn-routing.tn-addstop #tn-bar{display:none!important}'+
   '#tn-roadname{left:16px;bottom:96px;display:none;font-size:15px;color:#9fb3c8}'+
   '#tn-limit{left:168px;bottom:24px;display:none;flex-direction:column;align-items:center;justify-content:center;width:58px;height:70px;padding:0;background:#fff;color:#111;border:3px solid #111;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.35)}'+
   '#tn-limit small{font:700 10px system-ui,sans-serif;letter-spacing:.05em}#tn-limit b{font:800 28px system-ui,sans-serif;line-height:1}'+
   '#tn-limit.over{border-color:#e11d1d;background:#ffe9e9;animation:tnpulse 1s infinite}@keyframes tnpulse{50%{transform:scale(1.07)}}'+
   '@media (max-width:760px){#tn-search{top:72px;left:16px;right:16px;width:auto;transform:none}#tn-res{top:132px;left:16px;right:16px;width:auto;transform:none}'+
     '#status{max-width:calc(100vw - 100px)!important}#rec{top:132px}#trips{top:132px}#tn-bar{right:16px;top:72px}#tn-ov{left:16px;right:16px;transform:none;flex-wrap:wrap}}'+
   'body.tn-routing #status,body.tn-routing #tn-search{display:none}body.tn-routing #rec{top:auto;bottom:228px;left:16px}body.tn-routing #trips{top:auto;bottom:228px;left:132px}';
  document.head.appendChild(st);
  const el=(id,cls,html,tag)=>{const e=document.createElement(tag||'div');e.id=id;e.className='hud'+(cls?' '+cls:'');if(html) e.innerHTML=html;document.body.appendChild(e);return e;};
  this.box=el('tn-search','','<span class="i">'+TN.ICON('search',22,'#9fb3c8')+'</span><input type="text" placeholder="Search a place or address" autocomplete="off" spellcheck="false"><span class="x">'+TN.ICON('x',22,'#9fb3c8')+'</span>');
  this.res=el('tn-res');this.ov=el('tn-ov');this.bar=el('tn-bar','','<div class="a"></div><div class="t"><div class="dline"><div class="dist"></div><div class="lanes"></div></div><div class="ins"></div><div class="then"></div></div><div class="etabox"><div class="eta"></div><button class="dst"></button></div><div class="pb"><div class="car"></div></div>');
  this.endBtn=el('tn-end','','End route','button');
  this.stopBtn=el('tn-stopbtn','','+ Stop','button');this.stopBtn.onclick=()=>this.addStop();
  this.muteBtn=el('tn-mute','','','button');
  const muteDraw=()=>{const on=!(TN.settings&&TN.settings.voice===false);this.muteBtn.innerHTML='<svg width="24" height="24" viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#e8f1fa"/>'+
    (on?'<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="#e8f1fa" stroke-width="2" fill="none" stroke-linecap="round"/>':'<path d="M16 9l5 6M21 9l-5 6" stroke="#ff8a80" stroke-width="2.2" stroke-linecap="round"/>')+'</svg>';};
  muteDraw();this.muteBtn.onclick=()=>{const on=!(TN.settings&&TN.settings.voice===false);TN.settings.voice=!on;try{const st=JSON.parse(localStorage.getItem('tn2_settings')||'{}');st.voice=!on;localStorage.setItem('tn2_settings',JSON.stringify(st));}catch(e){}
    if(on&&TN.voice) TN.voice.stop();else if(TN.voice) TN.voice.say('Voice on',true);muteDraw();};this.roadName=el('tn-roadname');
  this.limit=el('tn-limit','','<small>MAX</small><b></b>');
  const inp=this.input=this.box.querySelector('input'),x=this.box.querySelector('.x');
  let tmr=null;
  inp.addEventListener('focus',()=>{if(!inp.value) this.showRecent();});
  inp.addEventListener('input',()=>{x.style.display=inp.value?'flex':'none';clearTimeout(tmr);
    if(inp.value.trim().length<2){this.showRecent();return;}tmr=setTimeout(()=>this.search(inp.value.trim()),300);});
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'&&this.results&&this.results[0]) this.pick(this.results[0]);if(e.key==='Escape') this.closeSearch();});
  x.onclick=()=>{inp.value='';x.style.display='none';this.showRecent();inp.focus();};
  this.endBtn.onclick=()=>this.end();
  this.bar.querySelector('.dst').onclick=ev=>{ev.stopPropagation();this.openTrip();};
  document.addEventListener('pointerdown',e=>{if(!this.box.contains(e.target)&&!this.res.contains(e.target)) this.res.style.display='none';},true);
};
TN.Nav.prototype.closeSearch=function(){this.res.style.display='none';this.input.blur();this.syncX();if(!this.addingStop) this.input.placeholder='Search a place or address';};
TN.Nav.prototype.syncX=function(){const x=this.box&&this.box.querySelector('.x');if(x) x.style.display=this.input.value?'flex':'none';};
TN.Nav.prototype.here=function(){const c=this.api.getCar();if(c&&c.x!=null) return TN.fromLocal(c.x,c.z);const m=this.api.map.getCenter();return [m.lng,m.lat];};
const fmtDist=m=>m<950?(m<100?Math.max(10,Math.round(m/10)*10):Math.round(m/50)*50)+' m':(m/1000).toFixed(m<9500?1:0)+' km';
TN.Nav.prototype.list=function(items,msg){
  this.results=items;const R=this.res;R.style.display='block';
  const q=(this.input&&this.input.value||'').trim();
  const allRow=q.length>=3&&!(items[0]&&items[0].recent)?'<div class="r all" style="color:#7fd3c8">'+TN.ICON('pin',24)+'<div>Show all nearby on map<small>Every \u201c'+TN.esc(q)+'\u201d around you</small></div></div>':'';
  if(!items.length){R.innerHTML=allRow+'<div class="msg">'+(msg||'No results')+'</div>';const ar=R.querySelector('.all');if(ar) ar.onclick=()=>this.showAll(q);return;}
  const h=this.here();
  R.innerHTML=items.map((it,i)=>{const d=it.lng!=null?TN.distLL(h,[it.lng,it.lat]):(it.dist||0);
    return '<div class="r" data-i="'+i+'"><span>'+(it.recent?TN.ICON('recent',22,'#9fb3c8'):TN.ICON('pin',24))+'</span><div>'+TN.esc(it.name)+'<small>'+TN.esc(it.sub||'')+'</small></div><span class="d">'+fmtDist(d)+'</span></div>';}).join('');
  if(allRow) R.innerHTML=allRow+R.innerHTML;
  R.querySelectorAll('.r[data-i]').forEach(r=>r.onclick=()=>this.pick(items[+r.dataset.i]));
  const ar=R.querySelector('.all');if(ar) ar.onclick=()=>this.showAll(q);
};
/* icons as small drawings (some car browsers lack symbol fonts) */
TN.ICON=(name,size,color)=>{const c=color||'currentColor',z=size||22,P={
  search:'<circle cx="10" cy="10" r="6.5" fill="none" stroke="'+c+'" stroke-width="2.4"/><path d="M15 15l5.5 5.5" stroke="'+c+'" stroke-width="2.6" stroke-linecap="round"/>',
  x:'<path d="M6 6l12 12M18 6L6 18" stroke="'+c+'" stroke-width="2.6" stroke-linecap="round"/>',
  pin:'<path d="M12 22s7-7.2 7-12.2A7 7 0 0 0 5 9.8C5 14.8 12 22 12 22z" fill="#ff5a4f"/><circle cx="12" cy="9.8" r="2.6" fill="#fff"/>',
  recent:'<circle cx="12" cy="12" r="8.5" fill="none" stroke="'+c+'" stroke-width="2.2"/><path d="M12 7.5V12l3 2" stroke="'+c+'" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
  straight:'<path d="M12 21V4M6 10l6-6 6 6" stroke="'+c+'" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  left:'<path d="M17 21v-7a4 4 0 0 0-4-4H5M10 5L5 10l5 5" stroke="'+c+'" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  right:'<path d="M7 21v-7a4 4 0 0 1 4-4h8M14 5l5 5-5 5" stroke="'+c+'" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  sleft:'<path d="M15 21v-6.5L7 6.5M7 12.5V6.5h6" stroke="'+c+'" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  sright:'<path d="M9 21v-6.5l8-8M11 6.5h6v6" stroke="'+c+'" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  uturn:'<path d="M8 21V9a4 4 0 0 1 8 0v4M12 10l4 4 4-4" stroke="'+c+'" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  round:'<circle cx="12" cy="11" r="5" fill="none" stroke="'+c+'" stroke-width="2.6"/><path d="M12 21v-5M15.5 7.5L19 4M19 4v4.5M19 4h-4.5" stroke="'+c+'" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  flag:'<path d="M6 21V4M6 4h11l-2.5 4L17 12H6" stroke="'+c+'" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
  }[name]||'';return '<svg width="'+z+'" height="'+z+'" viewBox="0 0 24 24" style="display:block">'+P+'</svg>';};
TN.esc=t=>String(t==null?'':t).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
TN.distLL=(a,b)=>{const R=6371000,p=Math.PI/180,dLa=(b[1]-a[1])*p,dLo=(b[0]-a[0])*p,s=Math.sin(dLa/2)**2+Math.cos(a[1]*p)*Math.cos(b[1]*p)*Math.sin(dLo/2)**2;return 2*R*Math.asin(Math.sqrt(s));};
TN.Nav.prototype.showRecent=function(){
  if(!this.recent.length){this.res.style.display='none';return;}
  this.list(this.recent.map(r=>Object.assign({},r,{recent:true})));
};
TN.Nav.prototype.search=async function(q){
  const h=this.here(),my=++this.qn;this.qn=my;
  if(TN.MBX){try{
    if(!this.sess) this.sess=Math.random().toString(36).slice(2)+Date.now().toString(36);
    const u='https://api.mapbox.com/search/searchbox/v1/suggest?q='+encodeURIComponent(q)+'&language=en&country=ca,us&limit=8&proximity='+h[0].toFixed(5)+','+h[1].toFixed(5)+
      '&origin='+h[0].toFixed(5)+','+h[1].toFixed(5)+'&session_token='+this.sess+'&access_token='+TN.MBX;
    const r=await fetch(u);if(!r.ok) throw 0;const j=await r.json();if(my!==this.qn) return;
    const items=(j.suggestions||[]).filter(sg=>sg.feature_type!=='category'&&sg.mapbox_id).map(sg=>({name:sg.name,sub:sg.full_address||sg.place_formatted||'',mbid:sg.mapbox_id,dist:sg.distance}));
    if(items.length){items.sort((a,b)=>(a.dist==null?1e9:a.dist)-(b.dist==null?1e9:b.dist));this.list(items);return;}
  }catch(e){}}
  try{
    const u='https://photon.komoot.io/api/?q='+encodeURIComponent(q)+'&lat='+h[1].toFixed(4)+'&lon='+h[0].toFixed(4)+'&limit=7&lang=en';
    const r=await fetch(u);if(!r.ok) throw 0;const j=await r.json();if(my!==this.qn) return;
    const items=(j.features||[]).map(f=>{const p=f.properties||{},c=f.geometry.coordinates;
      const name=p.name||[p.housenumber,p.street].filter(Boolean).join(' ')||p.city||'Place';
      const sub=[p.name&&p.street?[p.housenumber,p.street].filter(Boolean).join(' '):'',p.city||p.county||'',p.state&&p.state!=='Quebec'&&p.state!=='Québec'?p.state:''].filter(Boolean).join(' \u00b7 ');
      return {name:name,sub:sub,lng:c[0],lat:c[1]};});
    items.sort((a,b)=>TN.distLL(h,[a.lng,a.lat])-TN.distLL(h,[b.lng,b.lat]));
    this.list(items);
  }catch(e){if(my===this.qn) this.list([],'Search is not available right now');}
};
TN.Nav.prototype.qn=0;
TN.Nav.prototype.pick=async function(it){
  this.closeSearch();this.input.value=it.name;
  if(it.lng==null&&it.mbid){
    try{const r=await fetch('https://api.mapbox.com/search/searchbox/v1/retrieve/'+encodeURIComponent(it.mbid)+'?session_token='+this.sess+'&access_token='+TN.MBX);
      const j=await r.json(),f=j.features&&j.features[0];if(f){it.lng=f.geometry.coordinates[0];it.lat=f.geometry.coordinates[1];}}catch(e){}
    this.sess=null;   /* a new search session next time */
    if(it.lng==null){this.ov.style.display='flex';this.ov.innerHTML='<div>Could not open that place</div><button class="cancel">Close</button>';this.ov.querySelector('.cancel').onclick=()=>{this.ov.style.display='none';};return;}
  }
  this.recent=[{name:it.name,sub:it.sub,lng:it.lng,lat:it.lat}].concat(this.recent.filter(r=>r.name!==it.name||Math.abs(r.lat-it.lat)>1e-4)).slice(0,6);
  try{localStorage.setItem('tn2_recent',JSON.stringify(this.recent));}catch(e){}
  if(this.addingStop){this.addingStop=false;document.body.classList.remove('tn-addstop');
    this.stops.push({name:it.name,sub:it.sub,lng:it.lng,lat:it.lat});this.stopPins();
    this.plan(this.active);   /* while driving: the route changes at once; before Go: a new overview */
    return;}
  this.stops=[];this.stopPins();
  this.dest=it;this.plan(false);
};
/* add a stop: the search box opens (also while driving), the next place picked becomes a stop on the way */
TN.Nav.prototype.addStop=function(){
  this.addingStop=true;document.body.classList.add('tn-addstop');
  if(!this.active) this.ov.style.display='none';
  this.input.value='';this.input.placeholder='Add a stop on the way';this.syncX();this.input.focus();this.showRecent();
};
/* small numbered pins for the stops */
TN.Nav.prototype.stopPins=function(){
  if(this.sPins) for(const m of this.sPins){try{m.remove();}catch(e){}}this.sPins=[];
  if(typeof maplibregl==='undefined') return;
  this.stops.forEach((p,i)=>{const el=document.createElement('div');
    el.innerHTML='<div style="width:26px;height:26px;border-radius:50%;background:#f59e0b;color:#111;font:700 14px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)">'+(i+1)+'</div>';
    this.sPins.push(new maplibregl.Marker({element:el}).setLngLat([p.lng,p.lat]).addTo(this.api.map));});
};
/* ---------- every nearby place with a name (McDonald's, Tim Hortons...) as pins on the map ---------- */
TN.Nav.prototype.showAll=async function(q){
  this.closeSearch();this.clearPins();
  const h=this.here(),api=this.api,my=(this.allN=(this.allN||0)+1);
  this.ov.style.display='flex';this.ov.innerHTML='<div>Looking for \u201c'+TN.esc(q)+'\u201d nearby\u2026</div>';
  let items=[];
  /* 1. Mapbox: the nearest places, in about a second */
  if(TN.MBX){try{
    const u='https://api.mapbox.com/search/searchbox/v1/forward?q='+encodeURIComponent(q)+'&types=poi&limit=10&language=en&proximity='+h[0].toFixed(5)+','+h[1].toFixed(5)+'&access_token='+TN.MBX;
    const r=await fetch(u);if(r.ok){const j=await r.json();
      items=(j.features||[]).map(f=>({name:f.properties.name||q,sub:f.properties.full_address||f.properties.place_formatted||'',lng:f.geometry.coordinates[0],lat:f.geometry.coordinates[1]}));}
  }catch(e){}}
  /* if Mapbox had nothing, the other services (each given at most 6 s) */
  if(!items.length) items=await this.moreNearby(q,h,6000);
  if(my!==this.allN) return;
  if(!items.length) items=await this.photonNearby(q,h);
  if(my!==this.allN) return;
  if(!items.length){this.ov.innerHTML='<div>Nothing called \u201c'+TN.esc(q)+'\u201d nearby</div><button class="cancel">Close</button>';this.ov.querySelector('.cancel').onclick=()=>{this.ov.style.display='none';};return;}
  this.placeAll(items,q,h,true);
  /* 2. more of them further away, added in the background if the open map service answers quickly */
  if(TN.MBX){const more=await this.moreNearby(q,h,6000);if(my!==this.allN||!this.pins) return;
    const add=more.filter(m=>!this.allItems.some(it=>TN.distLL([it.lng,it.lat],[m.lng,m.lat])<80));
    if(add.length) this.placeAll(this.allItems.concat(add),q,h,false);}
};
/* the open map service (OpenStreetMap): every place with that name or brand around, with a time limit */
TN.Nav.prototype.moreNearby=async function(q,h,ms){
  const items=[];
  try{
    const ctl=typeof AbortController!=='undefined'?new AbortController():null,tm=ctl?setTimeout(()=>ctl.abort(),ms):null;
    const rx=q.replace(/[.*+?^${}()|[\]\\"]/g,'.').replace(/['\u2019]/g,'.?');
    const ql='[out:json][timeout:8];(nwr["name"~"'+rx+'",i](around:12000,'+h[1].toFixed(5)+','+h[0].toFixed(5)+');nwr["brand"~"'+rx+'",i](around:12000,'+h[1].toFixed(5)+','+h[0].toFixed(5)+'););out center 80;';
    const r=await fetch('https://overpass-api.de/api/interpreter?data='+encodeURIComponent(ql),ctl?{signal:ctl.signal}:{});if(tm) clearTimeout(tm);
    if(r.ok){const j=await r.json();const seen=new Set();
      for(const e of j.elements||[]){const lat=e.lat||(e.center&&e.center.lat),lng=e.lon||(e.center&&e.center.lon);if(lat==null) continue;
        const t=e.tags||{},key=lat.toFixed(4)+','+lng.toFixed(4);if(seen.has(key)) continue;seen.add(key);
        items.push({name:t.name||t.brand||q,sub:[[t['addr:housenumber'],t['addr:street']].filter(Boolean).join(' '),t['addr:city']].filter(Boolean).join(' \u00b7 '),lng:lng,lat:lat});}}
  }catch(e){}
  return items;
};
TN.Nav.prototype.photonNearby=async function(q,h){
  try{const r=await fetch('https://photon.komoot.io/api/?q='+encodeURIComponent(q)+'&lat='+h[1].toFixed(4)+'&lon='+h[0].toFixed(4)+'&limit=30&lang=en');
    if(r.ok){const j=await r.json();return (j.features||[]).map(f=>({name:f.properties.name||q,sub:[f.properties.street,f.properties.city].filter(Boolean).join(' \u00b7 '),lng:f.geometry.coordinates[0],lat:f.geometry.coordinates[1]})).filter(it=>TN.distLL(h,[it.lng,it.lat])<30000);}}catch(e){}
  return [];
};
/* pins for a list of places; the first time also the view and the card */
TN.Nav.prototype.placeAll=function(items,q,h,first){
  const api=this.api;
  items.sort((a,b)=>TN.distLL(h,[a.lng,a.lat])-TN.distLL(h,[b.lng,b.lat]));items=items.slice(0,40);this.allItems=items;
  if(this.pins) for(const m of this.pins){try{m.remove();}catch(e){}}
  this.pins=[];
  for(const it of items){const el=document.createElement('div');el.innerHTML=TN.ICON('pin',34);el.style.cursor='pointer';el.style.transform='translateY(-14px)';
    el.onclick=ev=>{ev.stopPropagation();this.pinCard(it,this.allItems.length,q);};
    if(typeof maplibregl!=='undefined') this.pins.push(new maplibregl.Marker({element:el,anchor:'bottom'}).setLngLat([it.lng,it.lat]).addTo(api.map));}
  const card=()=>{this.ov.innerHTML='<div><b>'+this.allItems.length+' \u00d7 \u201c'+TN.esc(q)+'\u201d</b><br><small>Tap a pin to choose</small></div><button class="cancel">Close</button>';
    this.ov.querySelector('.cancel').onclick=()=>{this.clearPins();this.ov.style.display='none';api.setFollow(true);};};
  /* where you are, as a blue dot, so you can pick the closest */
  if(typeof maplibregl!=='undefined'){if(this.meDot){try{this.meDot.remove();}catch(e){}}
    const me=document.createElement('div');me.innerHTML='<div style="width:20px;height:20px;border-radius:50%;background:#3b82f6;border:4px solid #fff;box-shadow:0 0 0 6px rgba(59,130,246,.3)"></div>';
    this.meDot=new maplibregl.Marker({element:me}).setLngLat(h).addTo(api.map);}
  if(first){api.setFollow(false);
    const near=items.slice(0,Math.min(items.length,12)).concat([{lng:h[0],lat:h[1]}]);this.fitView(near.map(it=>[it.lng,it.lat]));card();}
  else if(this.ov.textContent.indexOf('Tap a pin')>=0) card();
};
TN.Nav.prototype.pinCard=function(it,count,q){
  const d=TN.distLL(this.here(),[it.lng,it.lat]);
  this.ov.style.display='flex';
  this.ov.innerHTML='<div><b>'+TN.esc(it.name)+'</b><br><small>'+(it.sub?TN.esc(it.sub)+' \u00b7 ':'')+fmtDist(d)+' away</small></div><button class="go">Go</button>'+(count?'<button class="cancel">Back</button>':'<button class="cancel">Cancel</button>');
  this.ov.querySelector('.go').onclick=()=>{this.clearPins();this.pick(it);};   /* (as the destination, or as a stop when adding one) */
  this.ov.querySelector('.cancel').onclick=()=>{if(count){count=this.allItems?this.allItems.length:count;this.ov.innerHTML='<div><b>'+count+' \u00d7 \u201c'+TN.esc(q)+'\u201d</b><br><small>Tap a pin to choose</small></div><button class="cancel">Close</button>';
      this.ov.querySelector('.cancel').onclick=()=>{this.clearPins();this.ov.style.display='none';this.api.setFollow(true);};}
    else{this.clearPins();this.ov.style.display='none';this.api.setFollow(true);}};
};
TN.Nav.prototype.clearPins=function(){this.allN=(this.allN||0)+1;this.allItems=null;if(this.meDot){try{this.meDot.remove();}catch(e){}this.meDot=null;}if(this.pins) for(const m of this.pins){try{m.remove();}catch(e){}}this.pins=null;if(this.dropPin){try{this.dropPin.remove();}catch(e){}this.dropPin=null;}};
/* a view showing a set of points from above (also used by the route overview) */
TN.Nav.prototype.fitView=function(pts){
  const api=this.api;let a=[1e9,1e9],b=[-1e9,-1e9];for(const p of pts){a=[Math.min(a[0],p[0]),Math.min(a[1],p[1])];b=[Math.max(b[0],p[0]),Math.max(b[1],p[1])];}
  try{const cv=api.map.getCanvas(),W=Math.max(300,cv.clientWidth-160),H=Math.max(200,cv.clientHeight-260);
    const midLat=(a[1]+b[1])/2,mx=(b[0]-a[0])*111320*Math.cos(midLat*Math.PI/180),my=(b[1]-a[1])*111320,mpp=Math.max(mx/W,my/H,0.5);
    let z=Math.log2(156543.03*Math.cos(midLat*Math.PI/180)/mpp)-1;z=Math.max(10,Math.min(17,z-0.2));
    api.map.easeTo({center:[(a[0]+b[0])/2,(a[1]+b[1])/2],zoom:z,pitch:0,bearing:0,padding:{top:0,bottom:0,left:0,right:0},offset:[0,-30],duration:900});}catch(e){}
};
/* long-press anywhere on the map: drop a pin there, then Go */
TN.Nav.prototype.dropAt=async function(lng,lat){
  if(this.active) return;this.clearPins();
  const el=document.createElement('div');el.innerHTML=TN.ICON('pin',40);el.style.transform='translateY(-18px)';
  if(typeof maplibregl!=='undefined') this.dropPin=new maplibregl.Marker({element:el,anchor:'bottom'}).setLngLat([lng,lat]).addTo(this.api.map);
  const it={name:'Dropped pin',sub:'',lng:lng,lat:lat};this.pinCard(it,0,'');
  try{const r=await fetch('https://photon.komoot.io/reverse?lat='+lat.toFixed(6)+'&lon='+lng.toFixed(6)+'&lang=en');
    if(r.ok){const j=await r.json(),p=(j.features&&j.features[0]&&j.features[0].properties)||{};
      it.name=p.name||[p.housenumber,p.street].filter(Boolean).join(' ')||'Dropped pin';it.sub=[p.name?[p.housenumber,p.street].filter(Boolean).join(' '):'',p.city].filter(Boolean).join(' \u00b7 ');
      if(this.dropPin) this.pinCard(it,0,'');}}catch(e){}
};
/* ---------- live traffic around you (Mapbox traffic) ---------- */
TN.Nav.prototype.toast=function(msg){
  const t=document.createElement('div');t.className='hud';t.style.cssText='left:50%;top:84px;transform:translateX(-50%);z-index:9;font-size:15px;padding:10px 16px';
  t.textContent=msg;document.body.appendChild(t);setTimeout(()=>{t.style.opacity='0';setTimeout(()=>{try{t.parentNode&&t.parentNode.removeChild(t);}catch(e){}},700);},8000);
};
TN.Nav.prototype.traffic=function(show){
  const map=this.api.map;if(!TN.MBX||!map||!map.getStyle) return;
  if(TN.settings&&TN.settings.traffic===false) show=false;
  try{
    if(!map.getSource('tn-traffic')){
      if(!show) return;
      /* the traffic tiles are fetched by the page itself (not the map's background helper), so the request carries
         this site's address and the key's site restriction accepts it */
      let url='https://api.mapbox.com/v4/mapbox.mapbox-traffic-v1/{z}/{x}/{y}.vector.pbf?access_token='+TN.MBX;
      if(typeof maplibregl!=='undefined'&&maplibregl.addProtocol&&!TN.tnTrafficProto){
        try{maplibregl.addProtocol('tntraffic',async(params,abort)=>{
          const r=await fetch(params.url.replace('tntraffic://','https://'),{signal:abort&&abort.signal,referrerPolicy:'strict-origin-when-cross-origin'});
          if(!r.ok){const e=new Error('HTTP '+r.status);e.status=r.status;throw e;}
          return {data:await r.arrayBuffer()};});TN.tnTrafficProto=true;}catch(e){}}
      if(TN.tnTrafficProto) url=url.replace('https://','tntraffic://');
      map.addSource('tn-traffic',{type:'vector',tiles:[url],maxzoom:16});
      map.addLayer({id:'tn-traffic',type:'line',source:'tn-traffic','source-layer':'traffic',minzoom:9,
        filter:['in',['get','congestion'],['literal',['low','moderate','heavy','severe']]],
        layout:{'line-join':'round','line-cap':'round'},
        paint:{'line-color':['match',['get','congestion'],'low','#22c55e','moderate',TN.TRAFFIC_COL.moderate,'heavy',TN.TRAFFIC_COL.heavy,'severe',TN.TRAFFIC_COL.severe,'#999'],
          'line-width':['interpolate',['linear'],['zoom'],10,['match',['get','congestion'],'low',1,1.8],16,['match',['get','congestion'],'low',3,5]],'line-opacity':0.9}});
      /* if the traffic data can't load (a key or network problem), say so once instead of silently showing nothing */
      map.on('error',e=>{if(e&&e.sourceId==='tn-traffic'&&!this.trafficErr){this.trafficErr=true;
        let st=e.error&&e.error.status;if(!st&&e.error&&e.error.message){const m=String(e.error.message).match(/\b(40[0-9]|5\d\d)\b/);if(m) st=+m[1];}
        this.note('traffic error',{status:st||null,msg:e.error&&String(e.error.message||'')},false);
        /* only a refused key is worth telling (once); a tile cancelled while the map moves, or one that didn't load,
           is normal and only goes into the recording */
        if((st===401||st===403)&&!this.tKeyTold){this.tKeyTold=true;this.toast(st===401?'Live traffic: the map key was refused (401)':'Live traffic: the map key was refused (403: not allowed from this site)');}}});
    }
    map.setLayoutProperty('tn-traffic','visibility',show?'visible':'none');
    /* a check that says what happened, about 6 s after the traffic is first shown */
    if(!this.tStat){this.tStat={ok:0,bad:0,status:null};
      map.on('sourcedata',e=>{if(e&&e.sourceId==='tn-traffic'&&e.tile&&e.isSourceLoaded!==undefined) this.tStat.ok++;});
      map.on('error',e=>{if(e&&e.sourceId==='tn-traffic'){const m=String(e.error&&(e.error.name||e.error.message)||'');if(/abort/i.test(m)) return;this.tStat.bad++;this.tStat.status=(e.error&&(e.error.status||e.error.message))||'?';}});}
    if(show&&!this.tChecked){this.tChecked=true;
      setTimeout(()=>{let n=0;try{n=map.querySourceFeatures('tn-traffic',{sourceLayer:'traffic'}).length;}catch(e){n=-1;}
        let vis='?';try{vis=map.getLayoutProperty('tn-traffic','visibility');}catch(e){}
        const st=this.tStat;this.note('traffic check',{roads:n,tiles:st.ok,failed:st.bad,status:st.status,vis:vis},false);
        },6000);}
  }catch(e){this.note('traffic error',{msg:String(e&&e.message||e)},false);}
};
/* ---------- route ---------- */
TN.Nav.prototype.fetchRoute=async function(from,to){
  if(TN.MBX){try{
    const via=(this.stops||[]).map(p=>p.lng.toFixed(6)+','+p.lat.toFixed(6));
    const G=this.api.gps?this.api.gps():null,brg=G&&G.v>2&&G.hd!=null?'&bearings='+Math.round(G.hd)+',60'+';'.repeat(via.length+1):'';
    const u='https://api.mapbox.com/directions/v5/mapbox/driving-traffic/'+[from[0].toFixed(6)+','+from[1].toFixed(6)].concat(via,[to[0].toFixed(6)+','+to[1].toFixed(6)]).join(';')+
      '?geometries=geojson&overview=full&steps=true&annotations=congestion,maxspeed&language=en&voice_instructions=true&voice_units=metric'+brg+'&access_token='+TN.MBX;
    const r=await fetch(u);if(r.ok){const j=await r.json();if(j.routes&&j.routes[0]){j.routes[0].traffic=true;return j.routes[0];}}
  }catch(e){}}
  return this.fetchRouteFree(from,to);
};
TN.Nav.prototype.fetchRouteFree=async function(from,to){
  const pts=[from].concat((this.stops||[]).map(p=>[p.lng,p.lat]),[to]);
  const u='https://router.project-osrm.org/route/v1/driving/'+pts.map(p=>p[0].toFixed(6)+','+p[1].toFixed(6)).join(';')+'?overview=full&geometries=geojson&steps=true';
  const r=await fetch(u);if(!r.ok) throw new Error('route');const j=await r.json();
  if(!j.routes||!j.routes[0]) throw new Error('no route');return j.routes[0];
};
TN.Nav.prototype.plan=async function(reroute){
  const from=this.here(),to=[this.dest.lng,this.dest.lat];
  if(!reroute){this.ov.style.display='flex';this.ov.innerHTML='<div>Calculating the route\u2026</div>';}
  try{
    const rt=await this.fetchRoute(from,to);this.setRoute(rt);
    if(!reroute) this.overview();
  }catch(e){
    this.note('route failed',{reroute:!!reroute,err:String(e&&e.message||e)},true);
    if(!reroute){this.ov.innerHTML='<div>Could not find a route</div><button class="cancel">Close</button>';this.ov.querySelector('.cancel').onclick=()=>{this.ov.style.display='none';};}
  }
};
TN.Nav.prototype.setRoute=function(rt){
  /* the route line in local metres, densified to about every 5 m, with distances along it */
  const C=rt.geometry.coordinates,pts=[];
  /* each corner of the route becomes a real arc, about as wide as a car drives (up to 12 m radius, tighter
     where the streets between corners are short) */
  const raw=C.map(c=>TN.toLocal(c[0],c[1])),rnd=[raw[0]];
  for(let i=1;i<raw.length-1;i++){const A=rnd[rnd.length-1],B=raw[i],D=raw[i+1];
    const ax=B[0]-A[0],az=B[1]-A[1],bx=D[0]-B[0],bz=D[1]-B[1],la=Math.hypot(ax,az),lb=Math.hypot(bx,bz);
    if(la<0.5||lb<0.5){continue;}
    const th=Math.acos(Math.max(-1,Math.min(1,(ax*bx+az*bz)/(la*lb))));
    if(th<0.17){rnd.push(B);continue;}   /* under 10 degrees: keep the point */
    let tl=12*Math.tan(th/2);tl=Math.min(tl,la*0.45,lb*0.45);const Rr=tl/Math.tan(th/2);
    const s0=[B[0]-ax/la*tl,B[1]-az/la*tl],s1=[B[0]+bx/lb*tl,B[1]+bz/lb*tl];
    /* a true circular arc from s0 to s1 (radius Rr), turning to the side of the corner */
    const ux=ax/la,uz=az/la,side=Math.sign(ux*bz-uz*bx)||1;
    const nx=-uz*side,nz=ux*side,cx=s0[0]+nx*Rr,cz=s0[1]+nz*Rr;
    const a0=Math.atan2(s0[0]-cx,s0[1]-cz),n=Math.max(2,Math.ceil(Rr*th/2));
    for(let k=0;k<=n;k++){const ang=a0-side*th*k/n;rnd.push([cx+Math.sin(ang)*Rr,cz+Math.cos(ang)*Rr]);}
  }
  rnd.push(raw[raw.length-1]);
  for(let i=0;i<rnd.length;i++){const q=rnd[i];
    if(i){const p=pts[pts.length-1],d=Math.hypot(q[0]-p[0],q[1]-p[1]),n=Math.floor(d/5);for(let k=1;k<n;k++) pts.push([p[0]+(q[0]-p[0])*k/n,p[1]+(q[1]-p[1])*k/n]);}
    pts.push(q);}
  /* round the corners like a real turn (two smoothing passes; the ends stay put) */
  for(let pass=0;pass<1;pass++){if(pts.length<3) break;const q=[pts[0]];
    for(let i=0;i<pts.length-1;i++){const A=pts[i],B=pts[i+1];q.push([A[0]*0.75+B[0]*0.25,A[1]*0.75+B[1]*0.25],[A[0]*0.25+B[0]*0.75,A[1]*0.25+B[1]*0.75]);}
    q.push(pts[pts.length-1]);pts.length=0;for(const p of q) pts.push(p);}
  const cum=[0];for(let i=1;i<pts.length;i++) cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  const steps=[];let legN=0;const legCount=rt.legs.length;let annPrev=null;for(const lg of rt.legs){legN++;for(const s of lg.steps){const q=TN.toLocal(s.maneuver.location[0],s.maneuver.location[1]);
    let bi=0,bd=1e18;for(let i=0;i<pts.length;i++){const d=(pts[i][0]-q[0])**2+(pts[i][1]-q[1])**2;if(d<bd){bd=d;bi=i;}}
    steps.push({at:cum[bi],type:s.maneuver.type,mod:s.maneuver.modifier||'',exit:s.maneuver.exit,name:s.name||'',ref:s.ref||'',dest:s.destinations||'',exits:s.exits||'',lanes:(s.intersections&&s.intersections[0]&&s.intersections[0].lanes)||null,stop:s.maneuver.type==='arrive'&&legN<legCount?legN:0,
      ann:annPrev});
    annPrev=(s.voiceInstructions||[]).map(v=>({d:v.distanceAlongGeometry,text:v.announcement})).sort((a,b)=>b.d-a.d);}}
  this.said=new Set();
  this.route={pts:pts,cum:cum,L:cum[cum.length-1],dur:rt.duration,dist:rt.distance,steps:steps,hy:null,traffic:!!rt.traffic};
  /* traffic per stretch (from the route's congestion levels), placed along the line by distance */
  {const cong=[];for(const lg of rt.legs||[]) if(lg.annotation&&lg.annotation.congestion) cong.push(...lg.annotation.congestion);
   const C=rt.geometry.coordinates,D=[0];for(let i=1;i<C.length;i++) D.push(D[i-1]+TN.distLL(C[i-1],C[i]));
   const R0=this.route,lv=[];
   if(cong.length===C.length-1&&D[D.length-1]>0){let k=0;for(let i=0;i<R0.pts.length;i++){const d=R0.cum[i]/R0.L*D[D.length-1];while(k<cong.length-1&&D[k+1]<d) k++;lv.push(cong[k]||'unknown');}}
   R0.cong=lv.length?lv:null;R0.congRaw=cong.length===C.length-1?cong:null;}
  /* speed limits along the route (km/h), placed by distance */
  {const ms=[];for(const lg of rt.legs||[]) if(lg.annotation&&lg.annotation.maxspeed) ms.push(...lg.annotation.maxspeed);
   const C=rt.geometry.coordinates,R0=this.route;R0.lim=null;
   if(ms.length===C.length-1){const D=[0];for(let i=1;i<C.length;i++) D.push(D[i-1]+TN.distLL(C[i-1],C[i]));
     const kmh=m=>m&&m.speed?(m.unit==='mph'?Math.round(m.speed*1.609):m.speed):null;
     const lim=[];let k=0;for(let i=0;i<R0.pts.length;i++){const d=R0.cum[i]/R0.L*D[D.length-1];while(k<ms.length-1&&D[k+1]<d) k++;lim.push(kmh(ms[k]));}
     if(lim.some(v=>v)) R0.lim=lim;}}
  this.idx=0;this.offT=0;this.drawn=-1;this.draw(0);
  this.mapLine(rt.geometry.coordinates);
};
/* height of the route at each point: the road it runs on (bridges and ramps included) */
/* fitting the route onto OUR roads, worked out as you approach (the roads ahead are only loaded when near):
   for each point, the road under it (same level as the point before, never a road passing underneath), its height,
   the shift that puts the line exactly on that road, and the lane offset. Points with no road loaded yet are tried
   again once more roads have loaded. */
TN.Nav.prototype.fitRange=function(i0,i1){
  const R=this.route,net=this.api.net;if(!R.fit) R.fit=new Array(R.pts.length).fill(null);
  for(let i=i0;i<=i1;i++){
    const f0=R.fit[i];if(f0&&(!f0.miss||f0.ver===net.ver)) continue;
    const p=R.pts[i],q=R.pts[Math.min(R.pts.length-1,i+1)],o=R.pts[Math.max(0,i-1)];let ux=q[0]-o[0],uz=q[1]-o[1];const ul=Math.hypot(ux,uz)||1;ux/=ul;uz/=ul;
    const prev=i>0&&R.fit[i-1]&&!R.fit[i-1].miss?R.fit[i-1].h:null;
    let best=null;
    net.near(p[0],p[1],12,(w,k)=>{if(w.tun) return;const r=TN.seg(w,k,p[0],p[1]);if(r.d>TN.width(w)/2+6) return;
      const h0=w.hs?w.hs[k]+(w.hs[k+1]-w.hs[k])*r.u:(w.br?w.H:0);
      const sc=r.d+(1-Math.abs(r.tx*ux+r.tz*uz))*20+(prev==null?0:Math.abs(h0-prev)*4);
      if(!best||sc<best.sc) best={sc:sc,h:h0,lane:w.ow?0:TN.width(w)/4,dx:r.qx-p[0],dz:r.qz-p[1],hw:TN.width(w)/2,ow:!!w.ow};});
    /* turning here (direction changes over 20 degrees within about 10 m): keep the arc, no snapping */
    let turnHere=false;{const a=R.pts[Math.max(0,i-15)],b=R.pts[i],c2=R.pts[Math.min(R.pts.length-1,i+15)];
      const h1=Math.atan2(b[0]-a[0],-(b[1]-a[1])),h2=Math.atan2(c2[0]-b[0],-(c2[1]-b[1]));let dh=Math.abs(h2-h1)*180/Math.PI;if(dh>180) dh=360-dh;turnHere=dh>20;}
    if(best&&turnHere){best.dx=0;best.dz=0;}
    R.fit[i]=best?{h:best.h,lane:best.lane,dx:best.dx,dz:best.dz,hw:best.hw,ow:best.ow,miss:false}:{h:prev!=null?prev:(i>0&&R.fit[i-1]?R.fit[i-1].h:0),lane:0,dx:0,dz:0,miss:true,ver:net.ver};
  }
  /* smoothed values for drawing and placing the car (lane and shift change gradually, over about 40 m) */
  R.sm=R.sm||{};const sm=R.sm;
  for(let i=i0;i<=i1;i++){let ln=0,dx=0,dz=0,n=0;
    for(let k=i;k>=i0&&R.cum[i]-R.cum[k]<40;k--){const f=R.fit[k];ln+=f.lane;dx+=f.dx;dz+=f.dz;n++;}
    for(let k=i+1;k<=i1&&R.cum[k]-R.cum[i]<40;k++){const f=R.fit[k];ln+=f.lane;dx+=f.dx;dz+=f.dz;n++;}
    sm[i]=[ln/n,dx/n,dz/n,R.fit[i].h];}
};
TN.Nav.prototype.heights=function(){};
TN.Nav.prototype.draw=function(from){
  const R=this.route;if(!R) return;
  const S=this.api.scene;if(!S.three) return;
  /* (lifted 0.22 m above the road with only a light "on top" setting: a strong one made it draw over the car's
     lower body on bridges, so the car looked sunk) */
  if(!this.mat){this.mat=new THREE.MeshBasicMaterial({color:0xffffff,vertexColors:true,transparent:true,opacity:0.85,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2});}
  const pos=[],idx=[],col=[],hw=1.3;let n=0;const tc=new THREE.Color();
  const a0=Math.max(0,from|0);
  let a1=a0;while(a1<R.pts.length-1&&R.cum[a1]-R.cum[a0]<1500) a1++;
  this.fitRange(Math.max(0,a0-40),a1);this.drawVer=this.api.net.ver;
  for(let i=a0;i<=a1;i++){
    const p=R.pts[i],q=R.pts[Math.min(R.pts.length-1,i+1)],o=R.pts[Math.max(0,i-1)];let ux=q[0]-o[0],uz=q[1]-o[1];const ul=Math.hypot(ux,uz)||1;ux/=ul;uz/=ul;
    const m=R.sm[i]||[0,0,0,0],y=m[3]+0.22,lo=m[0],cx=p[0]+m[1]-uz*lo,cz=p[1]+m[2]+ux*lo;
    pos.push(cx-uz*hw,y,cz+ux*hw,cx+uz*hw,y,cz-ux*hw);
    tc.set(TN.TRAFFIC_COL[R.cong?R.cong[i]:'unknown']||'#3b82f6');col.push(tc.r,tc.g,tc.b,tc.r,tc.g,tc.b);
    if(i>a0) idx.push(n-2,n-1,n+1,n-2,n+1,n);
    n+=2;
  }
  if(this.mesh){S.three.scene.remove(this.mesh);this.mesh.geometry.dispose();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(idx);
  this.mesh=new THREE.Mesh(g,this.mat);this.mesh.frustumCulled=false;this.mesh.renderOrder=4;S.three.scene.add(this.mesh);this.drawn=a0;
};
/* the route as a map line: stays thick and visible at any zoom (overview, and far ahead beyond the 3D roads) */
TN.Nav.prototype.mapLine=function(coords){
  const map=this.api.map,cg=this.route&&this.route.congRaw;
  /* split into stretches of equal traffic, each with its colour */
  let data;
  if(cg){const fs=[];let cur=null;for(let i=0;i<coords.length-1;i++){const lv=cg[i]||'unknown';
      if(!cur||cur.properties.c!==lv){cur={type:'Feature',properties:{c:lv},geometry:{type:'LineString',coordinates:[coords[i]]}};fs.push(cur);}
      cur.geometry.coordinates.push(coords[i+1]);}
    data={type:'FeatureCollection',features:fs};}
  else data={type:'Feature',properties:{c:'unknown'},geometry:{type:'LineString',coordinates:coords}};
  try{
    if(map.getSource('tn-route')) map.getSource('tn-route').setData(data);
    else{map.addSource('tn-route',{type:'geojson',data:data});
      map.addLayer({id:'tn-route-casing',type:'line',source:'tn-route',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#ffffff','line-width':['interpolate',['linear'],['zoom'],10,6,16,12],'line-opacity':0.9}});
      map.addLayer({id:'tn-route-line',type:'line',source:'tn-route',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':['match',['get','c'],'moderate',TN.TRAFFIC_COL.moderate,'heavy',TN.TRAFFIC_COL.heavy,'severe',TN.TRAFFIC_COL.severe,TN.TRAFFIC_COL.low],'line-width':['interpolate',['linear'],['zoom'],10,4,16,8]}});}
    const end=coords[coords.length-1];
    if(!this.pinEl){this.pinEl=document.createElement('div');this.pinEl.innerHTML=TN.ICON('pin',40);this.pinEl.style.transform='translateY(-18px)';}
    if(!this.pin&&typeof maplibregl!=='undefined') this.pin=new maplibregl.Marker({element:this.pinEl,anchor:'bottom'}).setLngLat(end).addTo(map);
    else if(this.pin) this.pin.setLngLat(end);
  }catch(e){}
};
TN.Nav.prototype.clearMapLine=function(){
  const map=this.api.map;try{if(map.getLayer('tn-route-line')) map.removeLayer('tn-route-line');if(map.getLayer('tn-route-casing')) map.removeLayer('tn-route-casing');if(map.getSource('tn-route')) map.removeSource('tn-route');}catch(e){}
  if(this.pin){try{this.pin.remove();}catch(e){}this.pin=null;}
};
TN.Nav.prototype.overview=function(){
  const R=this.route,api=this.api;api.setFollow(false);
  try{for(const id of ['tn-route-casing','tn-route-line']) if(api.map.getLayer(id)) api.map.setLayoutProperty(id,'visibility','visible');}catch(e){}
  let a=[1e9,1e9],b=[-1e9,-1e9];for(let i=0;i<R.pts.length;i+=4){const ll=TN.fromLocal(R.pts[i][0],R.pts[i][1]);a=[Math.min(a[0],ll[0]),Math.min(a[1],ll[1])];b=[Math.max(b[0],ll[0]),Math.max(b[1],ll[1])];}
  /* the overview position, worked out directly: the middle of the route, and the zoom at which the route fills
     the screen between the top and bottom panels (the map's own fit function gets this wrong with a tilted camera) */
  try{
    const cv=api.map.getCanvas(),W=Math.max(300,cv.clientWidth-160),H=Math.max(200,cv.clientHeight-260);
    const midLat=(a[1]+b[1])/2,mx=(b[0]-a[0])*111320*Math.cos(midLat*Math.PI/180),my=(b[1]-a[1])*111320;
    const mpp=Math.max(mx/W,my/H,0.5);
    let z=Math.log2(156543.03*Math.cos(midLat*Math.PI/180)/mpp)-1;
    z=Math.max(10,Math.min(18,z-0.15));
    /* (clear the following camera's large top margin first, or the route is squeezed into a small strip) */
    api.map.easeTo({center:[(a[0]+b[0])/2,(a[1]+b[1])/2],zoom:z,pitch:0,bearing:0,padding:{top:0,bottom:0,left:0,right:0},offset:[0,-30],duration:900});
  }catch(e){}
  const arr=new Date(Date.now()+R.dur*1000);
  this.ov.style.display='flex';
  this.ov.innerHTML='<div style="min-width:0;flex:1"><b>'+TN.esc(this.dest.name)+'</b><br><small>'+Math.max(1,Math.round(R.dur/60))+' min \u00b7 '+fmtDist(R.dist)+' \u00b7 arrive '+arr.toTimeString().slice(0,5)+(R.traffic?' \u00b7 live traffic':'')+'</small>'+
    (this.stops.length?this.tripList():'')+'</div><div class="btns"><button class="go">Go</button><button class="stop">+ Stop</button><button class="cancel">Cancel</button></div>';
  this.ov.querySelector('.go').onclick=()=>this.go();
  this.ov.querySelector('.stop').onclick=()=>this.addStop();
  this.ov.querySelector('.cancel').onclick=()=>this.end('cancel');
  this.tripButtons(this.ov);
};
/* the trip in order: stops numbered 1, 2, 3..., the destination last; arrows to reorder, x to remove */
TN.Nav.prototype.tripList=function(){
  const all=this.stops.concat([this.dest]),n=all.length;
  return '<div class="trip">'+all.map((p,i)=>'<div class="row"><span class="num'+(i===n-1?' fin':'')+'">'+(i===n-1?TN.ICON('flag',18,'#ffffff'):(i+1))+'</span>'+
    '<span class="nm">'+TN.esc(p.name)+'</span>'+
    '<button data-a="up" data-i="'+i+'"'+(i===0?' disabled':'')+'>'+TN.ICON('straight',16,'#e8f1fa')+'</button><button data-a="down" data-i="'+i+'"'+(i===n-1?' disabled':'')+'><span style="display:block;transform:rotate(180deg)">'+TN.ICON('straight',16,'#e8f1fa')+'</span></button>'+
    (n>1?'<button data-a="del" data-i="'+i+'">'+TN.ICON('x',16,'#ff8a80')+'</button>':'')+'</div>').join('')+'</div>';
};
TN.Nav.prototype.tripButtons=function(box,driving){
  box.querySelectorAll('.trip button').forEach(b=>b.onclick=ev=>{ev.stopPropagation();
    const all=this.stops.concat([this.dest]),i=+b.dataset.i,a=b.dataset.a;
    if(a==='up'&&i>0) [all[i-1],all[i]]=[all[i],all[i-1]];
    else if(a==='down'&&i<all.length-1) [all[i+1],all[i]]=[all[i],all[i+1]];
    else if(a==='del') all.splice(i,1);
    else return;
    this.dest=all.pop();this.stops=all;this.stopPins();
    if(this.pin){try{this.pin.setLngLat([this.dest.lng,this.dest.lat]);}catch(e){}}
    if(driving){this.openTrip();this.plan(true);}   /* redraw the whole panel (all its buttons connected) */
    else this.plan(false);   /* a new overview with the new order */
  });
};
/* while driving: tap the arrival time in the top bar to see and rearrange the stops */
TN.Nav.prototype.tripPanelHtml=function(){return '<b>Your trip</b>'+this.tripList()+'<div class="btns"><button class="stop">+ Stop</button><button class="cancel">Close</button></div>';};
TN.Nav.prototype.openTrip=function(){
  if(!this.active) return;const box=this.ov;box.style.display='flex';box.classList.add('tripbox');
  box.innerHTML=this.tripPanelHtml();this.tripButtons(box,true);
  box.querySelector('.stop').onclick=()=>{this.closeTrip();this.addStop();};
  box.querySelector('.cancel').onclick=()=>this.closeTrip();
};
TN.Nav.prototype.closeTrip=function(){this.ov.style.display='none';this.ov.classList.remove('tripbox');};
/* the junction from above: our roads around it in grey, the route in blue with an arrow, the approach pointing up;
   the exit number on a green sign for highway exits */
TN.Nav.prototype.junctionSvg=function(nx){
  const R=this.route,net=this.api.net;let ia=0;while(ia<R.cum.length-1&&R.cum[ia]<nx.at) ia++;
  const M=R.pts[ia];let ib=ia;while(ib>0&&R.cum[ia]-R.cum[ib]<35) ib--;
  const B=R.pts[ib];let h=Math.atan2(M[0]-B[0],-(M[1]-B[1]));if(ib===ia) h=0;
  const fx=Math.sin(h),fz=-Math.cos(h),rx=Math.cos(h),rz=Math.sin(h),K=48/80;
  const P=p=>{const dx=p[0]-M[0],dz=p[1]-M[1];return [50+(dx*rx+dz*rz)*K,60-(dx*fx+dz*fz)*K];};
  const f1=v=>v.toFixed(1);let roads='';const seen=new Set();
  const wid={motorway:9,trunk:8,primary:7,secondary:6,tertiary:6,motorway_link:5,trunk_link:5,primary_link:5};
  if(net&&net.near) net.near(M[0],M[1],95,(w,k)=>{const key=w.id+':'+k;if(seen.has(key)||k>=w.pts.length-1) return;seen.add(key);
    const a=P(w.pts[k]),b=P(w.pts[k+1]);roads+='<path d="M'+f1(a[0])+' '+f1(a[1])+'L'+f1(b[0])+' '+f1(b[1])+'" stroke="#5f656e" stroke-width="'+(wid[w.cls]||4.5)+'" stroke-linecap="round"/>';});
  /* the route: 80 m before to 70 m after */
  let path='',last=null,prev=null;
  for(let i=Math.max(0,ia-200);i<Math.min(R.pts.length,ia+200);i++){const d=R.cum[i]-R.cum[ia];if(d<-80||d>70) continue;
    const q=P(R.pts[i]);path+=(path?'L':'M')+f1(q[0])+' '+f1(q[1]);prev=last;last=q;}
  if(!path) return '';
  let arrow='';if(last&&prev){const ang=Math.atan2(last[1]-prev[1],last[0]-prev[0]),L=9;
    const a1=[last[0]-L*Math.cos(ang-0.6),last[1]-L*Math.sin(ang-0.6)],a2=[last[0]-L*Math.cos(ang+0.6),last[1]-L*Math.sin(ang+0.6)];
    arrow='<path d="M'+f1(a1[0])+' '+f1(a1[1])+'L'+f1(last[0])+' '+f1(last[1])+'L'+f1(a2[0])+' '+f1(a2[1])+'" stroke="#ffffff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';}
  const ex=(nx.exits||'').split(';')[0];
  const sign=ex?'<rect x="4" y="80" width="'+(10+ex.length*7)+'" height="15" rx="3" fill="#0d7a3d"/><text x="9" y="91.5" fill="#fff" font-size="10" font-weight="700" font-family="system-ui,sans-serif">'+TN.esc(ex)+'</text>':'';
  return '<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true"><rect width="100" height="100" fill="#1b2533"/>'+roads+
    '<path d="'+path+'" stroke="#378ADD" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'+arrow+sign+'</svg>';
};
TN.Nav.prototype.go=function(){
  /* while driving, the 3D line shows the route; the flat map line was only for the overview */
  try{for(const id of ['tn-route-casing','tn-route-line']) if(this.api.map.getLayer(id)) this.api.map.setLayoutProperty(id,'visibility','none');}catch(e){}
  this.ov.style.display='none';this.active=true;this.saidArrive=false;document.body.classList.add('tn-routing');
  if(TN.voice&&this.route){TN.voice.say('Starting route to '+(this.dest?this.dest.name:'your destination'),true);}
  if(this.route) this.note('go',{dest:this.dest&&this.dest.name,km:+(this.route.L/1000).toFixed(2),pts:this.route.pts.length},true);
  this.bar.style.display='flex';this.endBtn.style.display='block';this.roadName.style.display='block';
  this.api.setFollow(true);
};
TN.Nav.prototype.end=function(why){
  this.note('end',{why:typeof why==='string'?why:'button',at:this.route?Math.round(this.route.cum[this.idx]||0):null,left:this.route?Math.round(this.route.L-(this.route.cum[this.idx]||0)):null},true);
  this.active=false;this.route=null;this.bird=0;this.jvStep=null;if(this.bar) this.bar.classList.remove('jvon');document.body.classList.remove('tn-routing','tn-addstop');this.addingStop=false;this.stops=[];this.stopPins();
  this.ov.style.display='none';this.bar.style.display='none';this.endBtn.style.display='none';this.roadName.style.display='none';
  if(this.mesh){this.api.scene.three.scene.remove(this.mesh);this.mesh.geometry.dispose();this.mesh=null;}
  this.clearMapLine();this.input.value='';this.syncX();this.api.setFollow(true);
};
/* ---------- the car on the route (like Google Maps, Waze, Codriver) ----------
   While navigating and near the route, the car is drawn ON the route path (rounded corners): it glides forward at
   the current speed between GPS readings and is gently pulled towards where each reading says it is. Its heading
   is the direction of the path, so a turn is a smooth curve. Off the route (over 25 m), normal following takes over. */
TN.Nav.prototype.place=function(base,L,now,dt){
  const R=this.route;if(!R||!this.active||!L||!base||base.x==null) return null;
  /* where the GPS is along the route (searching around the last place) */
  let bi=this.pi||this.idx||0,bd=1e18;
  for(let i=Math.max(0,bi-60);i<Math.min(R.pts.length,bi+200);i++){const d=(R.pts[i][0]-L.x)**2+(R.pts[i][1]-L.z)**2;if(d<bd){bd=d;bi=i;}}
  const gd=Math.sqrt(bd);
  /* clearly not on the route (missed a turn): show where the car really is, at once.
     Judged from the real GPS direction, not the matched car (which can briefly sit on a wrong street). */
  {const P0=R.pts[Math.max(0,bi-2)],P1=R.pts[Math.min(R.pts.length-1,bi+2)];
   const rh=(Math.atan2(P1[0]-P0[0],-(P1[1]-P0[1]))*180/Math.PI+360)%360;
   /* (the GPS's own heading when it gives one: the smoothed one lags behind in a turn) */
   const gh=L.hd!=null&&L.v>3?L.hd:(this.api.gpsHd?this.api.gpsHd():null),hdUse=gh!=null?gh:base.hd;
   const off=Math.abs(((hdUse-rh+540)%360)-180);
   /* (a different direction must last a moment: during a normal turn the two briefly differ) */
   const fresh=now-L.t<3000;   /* only judge from a recent GPS reading (not one frozen during a pause) */
   if(fresh&&gd>8&&off>55&&L.v>2) this.relT=(this.relT||0)+dt;else this.relT=0;
   if(gd>18||this.relT>0.35||this.rerouting){if(this.ps!=null){this.note('released',{gps:Math.round(gd),dir:Math.round(off)});this.relAt=Date.now();}this.ps=null;return null;}}
  this.pi=bi;
  /* projection on the segment for a precise distance */
  const i0=Math.max(0,Math.min(R.pts.length-2,bi-(bi>0&&bi===R.pts.length-1?1:0)));
  const A=R.pts[i0],B=R.pts[i0+1],dx=B[0]-A[0],dz=B[1]-A[1],l2=dx*dx+dz*dz||1;
  const u=Math.max(0,Math.min(1,((L.x-A[0])*dx+(L.z-A[1])*dz)/l2));
  const age=Math.min(1,Math.max(0,(now-L.t)/1000));
  const sGps=R.cum[i0]+u*Math.sqrt(l2)+L.v*age*0.5;
  if(this.ps==null) this.ps=sGps;
  /* glide at the current speed, and correct a part of the gap each second (never backwards when moving) */
  const v=L.v<0.5?0:L.v;
  let ns=this.ps+v*dt+(sGps-this.ps)*Math.min(1,dt*1.5);
  if(v>0.5&&ns<this.ps) ns=this.ps;
  this.ps=Math.max(0,Math.min(R.L,ns));
  /* point and direction on the path at that distance */
  let j=Math.max(0,Math.min(R.pts.length-2,this.pi));while(j>0&&R.cum[j]>this.ps) j--;while(j<R.pts.length-2&&R.cum[j+1]<this.ps) j++;
  const P=R.pts[j],Q=R.pts[j+1],sg=R.cum[j+1]-R.cum[j]||1,t=(this.ps-R.cum[j])/sg;
  const px=P[0]+(Q[0]-P[0])*t,pz=P[1]+(Q[1]-P[1])*t;
  /* direction from a little behind to a little ahead: smooth through the curve */
  const at=sd=>{let k=j;sd=Math.max(0,Math.min(R.L,sd));while(k>0&&R.cum[k]>sd) k--;while(k<R.pts.length-2&&R.cum[k+1]<sd) k++;
    const a=R.pts[k],b=R.pts[k+1],g=R.cum[k+1]-R.cum[k]||1,tt=(sd-R.cum[k])/g;return [a[0]+(b[0]-a[0])*tt,a[1]+(b[1]-a[1])*tt];};
  const p1=at(this.ps-3),p2=at(this.ps+3);
  const hd=(Math.atan2(p2[0]-p1[0],-(p2[1]-p1[1]))*180/Math.PI+360)%360;
  const m0=(R.sm&&R.sm[j])||[0,0,0,0],m1=(R.sm&&R.sm[j+1])||m0,mi=k=>m0[k]+(m1[k]-m0[k])*t;
  let lo=mi(0);const ux=Math.sin(hd*Math.PI/180),uz=-Math.cos(hd*Math.PI/180);
  /* which lane: the GPS's sideways position from the road's centre line, smoothed over a few seconds and kept on
     the road (on a two-way street, in the right half); the default lane until the GPS has settled */
  {const f=R.fit&&R.fit[j];
   if(f&&!f.miss&&L.v>3&&now-L.t<3000){
     const cx0=px+mi(1),cz0=pz+mi(2),latG=(L.x-cx0)*(-uz)+(L.z-cz0)*ux;
     const lim=Math.max(0.5,f.hw-1.6),lo0=f.ow?-lim:0.5;
     const want=Math.max(lo0,Math.min(lim,latG));
     this.latS=this.latS==null?lo:this.latS+(want-this.latS)*Math.min(1,dt*0.4);}
   else if(this.latS!=null) this.latS+=(lo-this.latS)*Math.min(1,dt*0.2);
   if(this.latS!=null) lo=this.latS;}
  let y=base.y!=null?base.y:mi(3);
  {const ry=mi(3);if(ry-y>0.15&&ry-y<4) y=ry;}   /* the route's road is a little higher (a bridge deck): sit on it */
  return Object.assign({},base,{x:px+mi(1)-uz*lo,z:pz+mi(2)+ux*lo,hd:hd,y:y,onRoute:true});
};
/* the speed limit sign next to your speed (null hides it); red and pulsing when more than 3 km/h over */
TN.Nav.prototype.showLimit=function(lim,kmh){
  const el=this.limit;if(!el) return;
  if(TN.settings&&TN.settings.limits===false) lim=null;
  if(!lim){if(el.style.display!=='none') el.style.display='none';return;}
  el.style.display='flex';const sp=document.getElementById('speed');if(sp) el.style.left=(sp.offsetLeft+sp.offsetWidth+12)+'px';
  const b=el.querySelector('b');if(b.textContent!==String(lim)) b.textContent=lim;
  el.classList.toggle('over',kmh>lim+3);
};
/* ---------- while driving ---------- */
TN.Nav.prototype.instr=function(s){
  const m=s.mod,side=m.indexOf('left')>=0?'left':m.indexOf('right')>=0?'right':'';
  const arrow={'left':'left','right':'right','slight left':'sleft','slight right':'sright','sharp left':'left','sharp right':'right','straight':'straight','uturn':'uturn'}[m]||'straight';
  let t,a=arrow;
  switch(s.type){
    case 'depart':t='Head '+(s.name?'on '+s.name:'out');break;
    case 'arrive':t=s.stop?'Arrive at your stop'+(this.stops[s.stop-1]?' \u00b7 '+this.stops[s.stop-1].name:''):'Arrive at your destination';a='flag';break;
    case 'turn':case 'end of road':t='Turn '+(m||'');break;
    case 'fork':t='Keep '+(side||'straight');break;
    case 'merge':t='Merge'+(side?' '+side:'');break;
    case 'on ramp':t='Take the ramp'+(side?' on the '+side:'');break;
    case 'off ramp':t='Take the exit'+(side?' on the '+side:'');break;
    case 'roundabout':case 'rotary':t='At the roundabout, take exit '+(s.exit||1);a='round';break;
    case 'exit roundabout':case 'exit rotary':t='Exit the roundabout';break;
    case 'new name':case 'continue':t=m&&m!=='straight'?'Keep '+side:'Continue';break;
    default:t=m?'Turn '+m:'Continue';
  }
  const where=s.type==='off ramp'||s.type==='on ramp'?(s.dest||s.ref||s.name):(s.name||s.ref);
  return {a:a,t:t,where:where};
};
/* recalculate from where the car is now: the old line fades, the top bar says so, the new route replaces it */
TN.Nav.prototype.reroute=async function(){
  this.rerouting=true;this.lastReroute=Date.now();this.offT=0;
  this.bar.querySelector('.dist').textContent='Recalculating\u2026';this.bar.querySelector('.ins').textContent='';
  if(this.mat) this.mat.opacity=0.25;
  this.note('reroute',{off:Math.round(this.lastOff||0)},true);
  if(TN.voice) TN.voice.say('Recalculating',true);
  const L0=this.route?this.route.L:0;
  try{await this.plan(true);}catch(e){}
  this.note('rerouted',{ok:!!this.route&&this.route.L!==L0,km:this.route?+(this.route.L/1000).toFixed(2):null});
  if(this.mat) this.mat.opacity=0.85;
  this.rerouting=false;this.pi=0;this.ps=null;this.idx=0;this.latS=null;this.gdH=[];
};
TN.Nav.prototype.update=function(dt){
  if(!this.route||!this.active) return;
  const R=this.route,c=this.api.getCar();if(!c||c.x==null) return;
  /* where the car is along the route: from the real GPS position when there is one (the matched car can
     briefly sit on a wrong street), searching a little ahead of the last place */
  const G=this.api.gps?this.api.gps():null,px=G&&G.x!=null?G.x:c.x,pz=G&&G.x!=null?G.z:c.z;
  let bi=this.idx,bd=1e18;
  for(let i=Math.max(0,this.idx-20);i<Math.min(R.pts.length,this.idx+400);i++){const d=(R.pts[i][0]-px)**2+(R.pts[i][1]-pz)**2;if(d<bd){bd=d;bi=i;}}
  const off=Math.sqrt(bd);this.idx=bi;const s=R.cum[bi],left=R.L-s;this.lastOff=off;
  this.stT=(this.stT||0)+dt;if(this.stT>5){this.stT=0;this.note('status',{at:Math.round(s),left:Math.round(left),off:+off.toFixed(1),onRoute:this.ps!=null,drawn:this.drawn});}
  if(R.cum[bi]-R.cum[Math.max(0,this.drawn)]>100||bi<this.drawn||this.api.net.ver!==this.drawVer) this.draw(Math.max(0,bi-4));
  if(this.rerouting) return;
  /* a stop reached (passed its arrival point): dropped from the list, so a recalculation won't send you back */
  {const st=R.steps.find(q=>q.stop===1);if(st&&s>st.at+30&&this.stops.length){this.stops.shift();this.stopPins();for(const q of R.steps) if(q.stop) q.stop--;}}
  /* next step ahead */
  let nx=null;for(const st of R.steps){if(st.at>s+8){nx=st;break;}}
  if(!nx) nx=R.steps[R.steps.length-1];
  const I=this.instr(nx),dNext=Math.max(0,nx.at-s);
  if(this.jvStep==null&&this.lastIcon!==I.a){this.bar.querySelector('.a').innerHTML=TN.ICON(I.a,42,'#ffffff');this.lastIcon=I.a;}
  this.bar.querySelector('.dist').textContent=nx.type==='arrive'&&dNext<30?'Arriving':fmtDist(dNext);
  /* the exit number as a green highway exit sign (where the map has one) */
  const exn=(nx.type==='off ramp'||nx.type==='fork')&&nx.exits?String(nx.exits).split(';')[0]:'';
  this.bar.querySelector('.ins').innerHTML=(exn?'<span class="exit">EXIT '+TN.esc(exn)+'</span>':'')+TN.esc(I.t+(I.where?' \u00b7 '+I.where:''));
  /* lane arrows for the next turn (where the directions include lanes), from 1 km before it */
  {const le=this.bar.querySelector('.lanes');let html='';
   if(nx.lanes&&nx.lanes.length&&dNext<1000){
     const ic={'straight':'straight','left':'left','right':'right','slight left':'sleft','slight right':'sright','sharp left':'left','sharp right':'right','uturn':'uturn'};
     html=nx.lanes.map(l=>{const ind=(l.indications||['straight']);const pick=l.valid&&l.valid_indication?l.valid_indication:ind.find(x=>x===nx.mod)||ind[0];
       return '<span class="'+(l.valid?'on':'')+'">'+TN.ICON(ic[pick]||'straight',19,l.valid?'#ffffff':'#5d6b80')+'</span>';}).join('');}
   if(le.innerHTML!==html) le.innerHTML=html;}
  /* before highway exits, forks, roundabouts and big junctions: a drawing of the junction from above in the bar
     (in place of the arrow, the bar a little taller); the camera's bird's-eye view only if chosen in settings */
  {const big=['off ramp','fork','roundabout','rotary','merge'].indexOf(nx.type)>=0||(nx.lanes&&nx.lanes.length>=3&&dNext<300);
   const near=big&&dNext<350&&dNext>-40;
   const birdOn=TN.settings&&TN.settings.birdseye===true;
   const want=near&&birdOn?1:0;this.bird=(this.bird||0)+(want-(this.bird||0))*Math.min(1,dt*0.8);
   const k=R.steps.indexOf(nx);
   if(near&&!birdOn){if(this.jvStep!==k){this.jvStep=k;let svg='';try{svg=this.junctionSvg(nx);}catch(e){}
       if(svg){this.bar.querySelector('.a').innerHTML=svg;this.bar.classList.add('jvon');this.lastIcon=null;}}}
   else if(this.jvStep!=null){this.jvStep=null;this.bar.classList.remove('jvon');this.lastIcon=null;}}
  /* spoken instructions: Mapbox's own (timed by distance before the turn), or our own at about 400 m, 150 m and
     just before the turn; each said once */
  if(TN.voice&&nx){const k=R.steps.indexOf(nx);
    let anns=nx.ann&&nx.ann.length?nx.ann:null;
    if(!anns){const I2=this.instr(nx),w=I2.where?' onto '+I2.where:'',t=I2.t.charAt(0).toLowerCase()+I2.t.slice(1);
      anns=nx.type==='arrive'?[{d:300,text:'In 300 metres, '+t}]:
        [{d:400,text:'In 400 metres, '+t+w},{d:150,text:'In 150 metres, '+t+w},{d:30,text:I2.t+w}];}
    let due=null;for(const an of anns){const key=k+':'+an.d;if(this.said.has(key)) continue;if(dNext<=an.d+5){this.said.add(key);due=an;}}
    /* (only the latest one due is spoken, so nothing piles up after a pause) */
    if(due&&dNext>-10&&!(due.d>dNext+250)) TN.voice.say(due.text,true);}
  /* the following turn ("Then: ...") */
  {const k=R.steps.indexOf(nx),n2=k>=0?R.steps[k+1]:null;
   let th='';if(n2&&nx.type!=='arrive'){const I2=this.instr(n2);th='Then: '+(n2.type==='arrive'?'arrive':I2.t.charAt(0).toLowerCase()+I2.t.slice(1))+(I2.where&&n2.type!=='arrive'?' onto '+I2.where:'');}
   const te=this.bar.querySelector('.then');if(te.textContent!==th) te.textContent=th;}
  /* progress: done part grey, the part ahead coloured by traffic (refreshed every few seconds), the car as a dot */
  {const f=Math.max(0,Math.min(1,s/Math.max(1,R.L))),pb=this.bar.querySelector('.pb');
   pb.querySelector('.car').style.left=(f*100).toFixed(2)+'%';
   this.pbT=(this.pbT||0)+dt;
   if(this.pbT>4||this.pbRoute!==R){this.pbT=0;this.pbRoute=R;
     const col=c=>c==='moderate'?'#f59e0b':c==='heavy'?'#ef4444':c==='severe'?'#991b1b':'#22c55e';
     const stops=['#7f8ea3 0%','#7f8ea3 '+(f*100).toFixed(1)+'%'];
     if(R.cong){let cur=null,st=f;const N=R.pts.length;
       for(let i=bi;i<N;i+=Math.max(1,Math.floor(N/300))){const c=col(R.cong[i]),p=R.cum[i]/R.L;
         if(c!==cur){if(cur) stops.push(cur+' '+(st*100).toFixed(1)+'%',cur+' '+(p*100).toFixed(1)+'%');cur=c;st=Math.max(p,f);}}
       if(cur) stops.push(cur+' '+(st*100).toFixed(1)+'%',cur+' 100%');}
     else stops.push('#3b82f6 '+(f*100).toFixed(1)+'%','#3b82f6 100%');
     pb.style.background='linear-gradient(90deg,'+stops.join(',')+')';}}
  /* speed limit here: from the route, otherwise from the road the car is on */
  {const lim=(R.lim&&R.lim[bi])||(c.w&&c.w.lim)||null;this.showLimit(lim,(G&&G.v!=null?G.v:(c.v||0))*3.6);}
  const remain=R.dur*(left/Math.max(1,R.L)),arr=new Date(Date.now()+remain*1000);
  this.bar.querySelector('.eta').innerHTML='<b>'+arr.toTimeString().slice(0,5)+'</b>'+Math.max(1,Math.round(remain/60))+' min \u00b7 '+fmtDist(left);
  /* the destination (and stops) as a button: tap it to see and change the trip */
  {const db=this.bar.querySelector('.dst'),n=this.stops.length;
   /* where you're heading next (the first line of the trip list); without stops, the destination */
   const txt=n?'Next: '+this.stops[0].name+' \u00b7 '+(n+1)+' places':(this.dest?this.dest.name:'Trip');
   if(db.dataset.t!==txt){db.dataset.t=txt;db.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" style="vertical-align:-2px;margin-right:6px"><path d="M4 20l1-5L16 4l4 4L9 19z M14 6l4 4" stroke="#fcd34d" stroke-width="2.4" fill="none" stroke-linejoin="round"/></svg>'+TN.esc(txt);}}
  this.roadName.textContent=c.w&&c.w.name?c.w.name:'';this.roadName.style.display=c.w&&c.w.name?'block':'none';
  /* arrived */
  if(left<30||(nx.type==='arrive'&&dNext<25)){this.arriveT+=dt;if(this.arriveT>3&&!this.saidArrive){this.saidArrive=true;if(TN.voice) TN.voice.say('You have arrived at '+(this.dest?this.dest.name:'your destination'),true);}
    if(this.arriveT>3){this.bar.querySelector('.dist').textContent='You have arrived';this.bar.querySelector('.ins').textContent=TN.esc(this.dest.name);}
    if(this.arriveT>12) this.end('arrived');return;}
  /* left the route: find a new one (at most every 15 s) */
  const v=c.v!=null?c.v:5;
  /* off the route: far from it, or away from it in a clearly different direction */
  const P0=R.pts[Math.max(0,bi-2)],P1=R.pts[Math.min(R.pts.length-1,bi+2)];
  const gh=G&&G.hd!=null?G.hd:c.hd;
  const rh=(Math.atan2(P1[0]-P0[0],-(P1[1]-P0[1]))*180/Math.PI+360)%360,hoff=Math.abs(((gh-rh+540)%360)-180);
  const fresh=!G||G.t==null||Date.now()-G.t<3000;
  const away=fresh&&v>1.5&&(off>22||(off>12&&hoff>50));
  if(away) this.offT+=dt;else this.offT=Math.max(0,this.offT-dt*2);
  const need=off>10&&hoff>50?1.5:2;
  if(this.offT>need&&!this.rerouting&&Date.now()-this.lastReroute>5000){this.reroute();}
};
