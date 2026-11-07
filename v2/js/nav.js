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
  this.places={home:null,work:null,favs:[]};try{const P=JSON.parse(localStorage.getItem('tn2_places')||'null');if(P) this.places=Object.assign(this.places,P);}catch(e){}
};
/* ---------- screen ---------- */
TN.Nav.prototype.build=function(){
  const st=document.createElement('style');
  st.textContent=
   '#tn-search{right:82px;top:16px;width:min(40vw,520px);padding:0;display:flex;align-items:center;background:rgb(var(--tn-panel-rgb) / .97)}'+
   '#status{max-width:calc(100vw - min(40vw,520px) - 130px)!important}'+
   '#tn-search input{flex:1;min-width:0;background:transparent;border:0;outline:0;color:var(--tn-text);font:18px system-ui,sans-serif;padding:14px 16px 14px 6px}'+
   '#tn-res .tiles{display:flex;gap:8px;overflow-x:auto;padding:12px 12px 6px;scrollbar-width:none;-webkit-overflow-scrolling:touch}#tn-res .tiles::-webkit-scrollbar{display:none}'+
   '#tn-res .tile{position:relative;flex:0 0 auto;width:132px;min-height:76px;box-sizing:border-box;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.07);cursor:pointer;display:flex;flex-direction:column;gap:3px}'+
   '#tn-res .tile b{font:600 15px system-ui,sans-serif;color:var(--tn-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#tn-res .tile small{font-size:13px;color:var(--tn-sub,#9fb3c8)}#tn-res .tile small.eta{color:#5dcaa5}'+
   '#tn-res .tile.unset{background:transparent;border:1px dashed rgba(255,255,255,.18)}#tn-res .tile.tedit{width:auto;min-width:76px;align-items:center;justify-content:center;background:transparent}#tn-res .tile:active{opacity:.7}'+
   '#tn-res .tile .tx{position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:50%;background:#ef4444;display:flex;align-items:center;justify-content:center}'+
   '#tn-search .tz{display:flex;align-items:center;gap:6px;flex-shrink:0;align-self:stretch;padding:0 14px;border-left:1px solid var(--tn-line,rgba(255,255,255,.1));cursor:pointer}#tn-search .tz b{font:600 14px system-ui,sans-serif;color:var(--tn-sub,#b9b6ae)}#tn-search .tz:active{opacity:.6}'+
   '#tn-search .i{padding-left:16px;flex-shrink:0}#tn-search .x{padding:0 14px;cursor:pointer;display:none;flex-shrink:0;align-items:center}'+
   '#tn-res{right:82px;top:76px;width:min(40vw,520px);padding:6px;display:none;max-height:56vh;overflow:auto;z-index:9}#tn-search{z-index:9}'+   /* (above the Record / Trips buttons) */
   '#tn-res .r{display:flex;align-items:center;gap:12px;padding:14px 12px;border-radius:12px;cursor:pointer;font-size:17px}'+
   '#tn-res .r:active,#tn-res .r:hover{background:var(--tn-line)}#tn-res .r small{display:block;color:var(--tn-sub);font-size:13px;margin-top:2px}'+
   '#tn-res .d{margin-left:auto;color:var(--tn-sub);font-size:14px;white-space:nowrap}#tn-res .msg{padding:12px;color:var(--tn-sub)}'+
   '#tn-res .hd{font-size:12px;letter-spacing:.06em;color:#7d8da3;padding:10px 12px 2px}#tn-res .del{display:flex;padding:8px;margin:-8px -4px -8px 4px;border-radius:8px}#tn-res .del:active{background:rgba(255,255,255,.1)}'+
   '#tn-ov .save{background:var(--tn-btn);color:var(--tn-joke);display:inline-flex;align-items:center;gap:6px}'+
   '#tn-savemenu{position:fixed;z-index:12;padding:6px;min-width:230px}#tn-savemenu .r{display:flex;align-items:center;gap:12px;padding:12px;border-radius:10px;cursor:pointer;font-size:16px}#tn-savemenu .r:active{background:var(--tn-line)}'+
   '#tn-ov{left:50%;bottom:24px;transform:translateX(-50%);display:none;align-items:center;gap:18px;padding:14px 18px;font-size:16px}'+
   '#tn-ov small{color:var(--tn-sub);font-size:14px}#tn-ov button,#tn-end{border:0;border-radius:12px;padding:12px 22px;font:600 17px system-ui,sans-serif;cursor:pointer}'+
   '#tn-ov .go{background:var(--tn-accent);color:var(--tn-on-accent)}#tn-ov .cancel,#tn-ov .stop{background:var(--tn-btn);color:var(--tn-text)}'+
   '#tn-ov{flex-wrap:wrap;max-width:min(94vw,640px)}#tn-ov .btns{display:flex;gap:10px;align-items:center}#tn-ov.tripbox{flex-direction:column;align-items:stretch}'+
   '#tn-ov .trip{margin-top:8px;display:flex;flex-direction:column;gap:4px}#tn-ov .row{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.05);border-radius:10px;padding:4px 6px}'+
   '#tn-ov .row .num{width:26px;height:26px;border-radius:50%;background:#f59e0b;color:#111;font:700 13px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;flex-shrink:0}#tn-ov .row .num.fin{background:transparent;font-size:18px}'+
   '#tn-ov .row .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:15px}'+
   '#tn-ov .row button{display:flex;align-items:center;justify-content:center;border:0;border-radius:8px;padding:7px 10px;font:600 15px system-ui,sans-serif;background:var(--tn-btn);color:var(--tn-text);cursor:pointer}#tn-ov .row button:disabled{opacity:.3}'+
   '#tn-bar{left:16px;right:82px;top:16px;display:none;align-items:center;gap:16px;padding:12px 18px}'+
   '#tn-bar .a{width:44px;display:flex;justify-content:center}#tn-bar.jvon .a{width:116px;height:116px;flex-shrink:0;border-radius:10px;overflow:hidden;border:2px solid #378ADD}'+
   '#tn-bar .t{flex:1;min-width:0}#tn-bar .dist{font:600 26px system-ui,sans-serif}'+
   '#tn-bar .ins{font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
   '#tn-bar{padding-bottom:22px!important}#tn-bar .then{font-size:13px;color:var(--tn-sub);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#tn-bar .then:empty{display:none}'+
   '#tn-bar .dline{display:flex;align-items:center;gap:14px}#tn-bar .lanes{display:flex;gap:3px}#tn-bar .lanes:empty{display:none}#tn-bar .lanes span{display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:5px;background:var(--tn-line)}#tn-bar .lanes span.on{background:rgba(59,130,246,.35)}'+
   '#tn-bar .pb{position:absolute;left:18px;right:18px;bottom:9px;height:6px;border-radius:3px;background:#2a3444}'+
   '#tn-bar .pb .car{position:absolute;top:50%;left:0;width:13px;height:13px;border-radius:50%;background:#fff;border:3px solid #3b82f6;transform:translate(-50%,-50%);box-sizing:border-box}'+
   '#tn-bar .etabox{display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;max-width:40%}'+
   '#tn-bar .dst{border:1px solid rgba(252,211,77,.55);background:rgba(252,211,77,.12);color:var(--tn-joke);border-radius:999px;padding:5px 12px;font:600 14px system-ui,sans-serif;cursor:pointer;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
   '#tn-bar .exit{display:inline-block;background:#0b6b3a;color:#fff;border:2px solid #fff;border-radius:6px;padding:1px 8px;margin-right:10px;font:700 15px system-ui,sans-serif;letter-spacing:.04em;vertical-align:1px}#tn-bar .eta{text-align:right;color:var(--tn-text);font-size:14px}#tn-bar .eta b{font-size:20px;display:block;color:var(--tn-text)}'+
   '#tn-end{right:16px;bottom:228px;display:none;background:rgb(var(--tn-panel-rgb) / .88);color:var(--tn-danger)}'+
   '#tn-mute{right:16px;top:76px;width:50px;height:50px;padding:0;border:0;display:none;align-items:center;justify-content:center;cursor:pointer}body.tn-routing #tn-mute{display:flex}'+
   '#tn-stopbtn{right:16px;bottom:292px;display:none;border:0;border-radius:12px;padding:12px 22px;font:600 17px system-ui,sans-serif;cursor:pointer;background:rgb(var(--tn-panel-rgb) / .88);color:var(--tn-joke)}body.tn-routing #tn-stopbtn{display:none}'+
   'body.tn-routing #trips{display:none!important}body.tn-routing #rec:not(.on){display:none!important}'+
   'body.tn-routing.tn-addstop #tn-search{display:flex}body.tn-routing.tn-addstop #tn-bar{display:none!important}'+
   '#tn-roadname{left:16px;bottom:96px;display:none;font-size:15px;color:var(--tn-sub)}'+
   '#tn-limit{left:168px;bottom:24px;display:none;flex-direction:column;align-items:center;justify-content:center;width:58px;height:70px;padding:0;background:#fff;color:#111;border:3px solid #111;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.35)}'+
   '#tn-limit small{font:700 10px system-ui,sans-serif;letter-spacing:.05em}#tn-limit b{font:800 28px system-ui,sans-serif;line-height:1}'+
   '#tn-limit.over{border-color:#e11d1d;background:#ffe9e9;animation:tnpulse 1s infinite}@keyframes tnpulse{50%{transform:scale(1.07)}}'+
   '@media (max-width:760px){#tn-search{top:72px;left:16px;right:16px;width:auto;transform:none}#tn-res{top:132px;left:16px;right:16px;width:auto;transform:none}'+
     '#status{max-width:calc(100vw - 100px)!important}#rec{top:132px}#trips{top:132px}#tn-bar{right:16px;top:72px}#tn-ov{left:16px;right:16px;transform:none;flex-wrap:wrap}}'+
   'body.tn-routing #status,body.tn-routing #tn-search{display:none}body.tn-routing #rec{top:auto;bottom:228px;left:16px}body.tn-routing #trips{top:auto;bottom:228px;left:132px}';
  document.head.appendChild(st);
  const el=(id,cls,html,tag)=>{const e=document.createElement(tag||'div');e.id=id;e.className='hud'+(cls?' '+cls:'');if(html) e.innerHTML=html;document.body.appendChild(e);return e;};
  this.box=el('tn-search','','<span class="i">'+TN.ICON('search',22,'#9fb3c8')+'</span><input type="text" placeholder="Search a place or address" autocomplete="off" spellcheck="false"><span class="x">'+TN.ICON('x',22,'#9fb3c8')+'</span>'+(TN.tesla?'<span class="tz" title="Sync with Tessy">'+TN.TESLA_T(20)+'<b>Sync</b></span>':''));
  {const tz=this.box.querySelector('.tz');if(tz) tz.onclick=ev=>{ev.stopPropagation();this.closeSearch&&this.closeSearch();if(TN.tesla.connected()) TN.tesla.getTrip(this);else TN.tesla.signIn();};}
  this.res=el('tn-res');this.ov=el('tn-ov');this.bar=el('tn-bar','','<div class="a"></div><div class="t"><div class="dline"><div class="dist"></div><div class="lanes"></div></div><div class="ins"></div><div class="then"></div></div><div class="etabox"><div class="eta"></div><button class="dst"></button></div><div class="pb"><div class="car"></div></div>');
  {const tt=this.bar.querySelector('.t');if(tt){tt.style.cursor='pointer';tt.onclick=ev=>{ev.stopPropagation();if(this.route) this.details();};}}
  this.endBtn=el('tn-end','','End route','button');
  this.stopBtn=el('tn-stopbtn','','+ Stop','button');this.stopBtn.onclick=()=>this.addStop();
  this.muteBtn=el('tn-mute','','','button');
  const muteDraw=()=>{const on=!(TN.settings&&TN.settings.voice===false);this.muteBtn.innerHTML='<svg width="24" height="24" viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#e8f1fa"/>'+
    (on?'<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>':'<path d="M16 9l5 6M21 9l-5 6" stroke="#ff8a80" stroke-width="2.2" stroke-linecap="round"/>')+'</svg>';};
  muteDraw();this.muteBtn.onclick=()=>{const on=!(TN.settings&&TN.settings.voice===false);TN.settings.voice=!on;try{const st=JSON.parse(localStorage.getItem('tn2_settings')||'{}');st.voice=!on;localStorage.setItem('tn2_settings',JSON.stringify(st));}catch(e){}
    if(on&&TN.voice) TN.voice.stop();else if(TN.voice) TN.voice.say('Voice on',true);muteDraw();};this.roadName=el('tn-roadname');
  this.limit=el('tn-limit','','<small>MAX</small><b></b>');
  const inp=this.input=this.box.querySelector('input'),x=this.box.querySelector('.x');
  let tmr=null;
  inp.addEventListener('focus',()=>{if(!inp.value) this.showRecent();});
  inp.addEventListener('input',()=>{x.style.display=inp.value?'flex':'none';clearTimeout(tmr);
    if(inp.value.trim().length<2){this.showRecent();return;}tmr=setTimeout(()=>this.search(inp.value.trim()),300);});
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'&&this.results&&this.results[0]) this.pick(this.results[0]);if(e.key==='Escape'){if(this.addingStop) this.cancelAddStop();else this.closeSearch();}});
  x.onclick=()=>{inp.value='';x.style.display='none';this.showRecent();inp.focus();};
  this.endBtn.onclick=()=>this.end();
  this.bar.querySelector('.dst').onclick=ev=>{ev.stopPropagation();this.openTrip();};
  document.addEventListener('pointerdown',e=>{if(!this.box.contains(e.target)&&!this.res.contains(e.target)){this.res.style.display='none';
    /* (tapping outside while adding a stop: back to the route, nothing added) */
    if(this.addingStop&&!(this.stopBtn&&this.stopBtn.contains(e.target))&&!(this.ov&&this.ov.contains(e.target))) this.cancelAddStop();
    if(this.setting){this.setting=null;this.input.placeholder='Search a place or address';}}},true);
};
TN.Nav.prototype.closeSearch=function(){this.res.style.display='none';this.input.blur();this.syncX();if(!this.addingStop) this.input.placeholder='Search a place or address';};
TN.Nav.prototype.syncX=function(){const x=this.box&&this.box.querySelector('.x');if(x) x.style.display=this.input.value?'flex':'none';};
TN.Nav.prototype.here=function(){const c=this.api.getCar();if(c&&c.x!=null) return TN.fromLocal(c.x,c.z);const m=this.api.map.getCenter();return [m.lng,m.lat];};
const fmtDist=m=>m<950?(m<100?Math.max(10,Math.round(m/10)*10):Math.round(m/50)*50)+' m':(m/1000).toFixed(m<9500?1:0)+' km';
TN.Nav.prototype.list=function(items,msg){
  this.results=items;const R=this.res;R.style.display='block';
  const q=(this.input&&this.input.value||'').trim();
  const allRow=q.length>=3&&!(items[0]&&items[0].recent)?'<div class="r all" style="color:var(--tn-link)">'+TN.ICON('pin',24)+'<div>Show all nearby on map<small>Every \u201c'+TN.esc(q)+'\u201d around you</small></div></div>':'';
  if(!items.length){R.innerHTML=(this.addingStop?'<div class="r cancelstop" style="color:var(--tn-danger)">'+TN.ICON('x',22,'#ff8a80')+'<div>Cancel adding a stop<small>Back to your route</small></div></div>':'')+allRow+'<div class="msg">'+(msg||'No results')+'</div>';
    const tz=R.querySelector('.r.tesla');if(tz) tz.onclick=ev=>{ev.stopPropagation();this.closeSearch();if(TN.tesla.connected()) TN.tesla.getTrip(this);else TN.tesla.signIn();};
  const cs=R.querySelector('.cancelstop');if(cs) cs.onclick=ev=>{ev.stopPropagation();this.cancelAddStop();};
    const ar=R.querySelector('.all');if(ar) ar.onclick=()=>this.showAll(q);return;}
  const h=this.here();
  R.innerHTML=items.map((it,i)=>{const d=it.lng!=null?TN.distLL(h,[it.lng,it.lat]):(it.dist||0);
    return '<div class="r" data-i="'+i+'"><span>'+(it.recent?TN.ICON('recent',22,'#9fb3c8'):TN.ICON('pin',24))+'</span><div>'+TN.esc(it.name)+'<small>'+TN.esc(it.sub||'')+'</small></div><span class="d">'+fmtDist(d)+'</span></div>';}).join('');
  if(allRow) R.innerHTML=allRow+R.innerHTML;
  if(this.addingStop){R.innerHTML='<div class="r cancelstop" style="color:var(--tn-danger)">'+TN.ICON('x',22,'#ff8a80')+'<div>Cancel adding a stop<small>Back to your route</small></div></div>'+R.innerHTML;
    R.querySelector('.cancelstop').onclick=ev=>{ev.stopPropagation();this.cancelAddStop();};}
  R.querySelectorAll('.r[data-i]').forEach(r=>r.onclick=()=>this.pick(items[+r.dataset.i]));
  const ar=R.querySelector('.all');if(ar) ar.onclick=()=>this.showAll(q);
};
/* icons as small drawings (some car browsers lack symbol fonts) */
TN.ICON=(name,size,color)=>{const c=color||'currentColor',z=size||22,P={
  search:'<circle cx="10" cy="10" r="6.5" fill="none" stroke="'+c+'" stroke-width="2.4"/><path d="M15 15l5.5 5.5" stroke="'+c+'" stroke-width="2.6" stroke-linecap="round"/>',
  x:'<path d="M6 6l12 12M18 6L6 18" stroke="'+c+'" stroke-width="2.6" stroke-linecap="round"/>',
  pin:'<path d="M12 22s7-7.2 7-12.2A7 7 0 0 0 5 9.8C5 14.8 12 22 12 22z" fill="#ff5a4f"/><circle cx="12" cy="9.8" r="2.6" fill="#fff"/>',
  home:'<path d="M3 11.5L12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" fill="'+c+'"/>',
  work:'<rect x="3" y="8" width="18" height="12" rx="2" fill="'+c+'"/><path d="M9 8V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V8" fill="none" stroke="'+c+'" stroke-width="2"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" stroke="'+c+'" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5" stroke="'+c+'" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  star:'<path d="M12 2.8l2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 17l-5.8 3.3 1.4-6.4L2.7 9.5l6.5-.7z" fill="'+c+'"/>',
  staro:'<path d="M12 2.8l2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 17l-5.8 3.3 1.4-6.4L2.7 9.5l6.5-.7z" fill="none" stroke="'+c+'" stroke-width="2" stroke-linejoin="round"/>',
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
TN.Nav.prototype.showRecent=function(){this.showStart();};
TN.Nav.prototype.savePlaces=function(){try{localStorage.setItem('tn2_places',JSON.stringify(this.places));}catch(e){}};
TN.Nav.prototype.slim=it=>({name:it.name,sub:it.sub||'',lng:it.lng,lat:it.lat,rlng:it.rlng,rlat:it.rlat,ub:it.ub});
/* the list before typing: Home and Work (with the time to get there now), Favorites, Recent */
TN.Nav.prototype.showStart=function(){
  const R=this.res,P=this.places,h=this.here(),items=[];let html='';
  const row=(cls,icon,name,sub,right,extra)=>'<div class="r '+cls+'"'+(extra||'')+'><span>'+icon+'</span><div>'+TN.esc(name)+'<small>'+TN.esc(sub||'')+'</small></div>'+right+'</div>';
  if(this.addingStop) html+='<div class="r cancelstop" style="color:var(--tn-danger)">'+TN.ICON('x',22,'#ff8a80')+'<div>Cancel adding a stop<small>Back to your route</small></div></div>';
  if(this.setting) html+='<div class="r cancelset" style="color:var(--tn-danger)">'+TN.ICON('x',22,'#ff8a80')+'<div>Cancel<small>Keep '+(this.setting==='home'?'Home':'Work')+' as it is</small></div></div>';
  else{
    /* Home, Work and favorites as a row of tiles (one tap to go); Edit shows a remove/change button on each */
    const ed=!!this.tileEdit;let t='';
    for(const k of ['home','work']){const pl=P[k],lab=k==='home'?'Home':'Work',col=k==='home'?'#60a5fa':'#f59e0b';
      if(pl){const tm=this.etaFor(k);items.push(pl);
        t+='<div class="tile" data-i="'+(items.length-1)+'">'+TN.ICON(k,22,col)+'<b>'+lab+'</b><small class="'+(tm?'eta':'')+'">'+(tm?tm+' min':fmtDist(TN.distLL(h,[pl.lng,pl.lat])))+'</small>'+(ed?'<i class="tx" data-del="'+k+'" title="Change">'+TN.ICON('x',14,'#ffffff')+'</i>':'')+'</div>';}
      else t+='<div class="tile unset" data-set="'+k+'">'+TN.ICON(k,22,col)+'<b>'+lab+'</b><small>Tap to set</small></div>';}
    P.favs.forEach((f,fi)=>{items.push(f);
      t+='<div class="tile" data-i="'+(items.length-1)+'">'+TN.ICON('star',22,'#fcd34d')+'<b>'+TN.esc(f.name)+'</b><small>'+fmtDist(TN.distLL(h,[f.lng,f.lat]))+'</small>'+(ed?'<i class="tx" data-fav="'+fi+'" title="Remove">'+TN.ICON('x',14,'#ffffff')+'</i>':'')+'</div>';});
    /* Montreal's bridges and tunnels (when you're within about 70 km of them) */
    if(TN.bridges&&!ed&&TN.bridges.near()) t+='<div class="tile tbr"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5dcaa5" stroke-width="2" stroke-linecap="round"><path d="M2 16h20M4 16V9M20 16V9M4 9c3 3 13 3 16 0M8 16v-4.6M12 16v-4M16 16v-4.6"/></svg><b>Bridges</b><small>Live status</small></div>';
    if(P.home||P.work||P.favs.length) t+='<div class="tile tedit">'+TN.ICON(ed?'check':'edit',20,'#9fb3c8')+'<b>'+(ed?'Done':'Edit')+'</b></div>';
    html+='<div class="tiles">'+t+'</div>';}
  if(this.recent.length){html+='<div class="hd">RECENT</div>';
    this.recent.forEach(r=>{items.push(r);html+=row('rec','',r.name,r.sub,'<span class="d">'+fmtDist(TN.distLL(h,[r.lng,r.lat]))+'</span>',' data-i="'+(items.length-1)+'"').replace('<span></span>','<span>'+TN.ICON('recent',22,'#9fb3c8')+'</span>');});}
  if(!html){R.style.display='none';return;}
  this.results=items;R.innerHTML=html;R.style.display='block';
  R.querySelectorAll('[data-i]').forEach(r=>r.onclick=ev=>{if(ev.target.closest('.tx')) return;this.pick(items[+r.dataset.i]);});
  R.querySelectorAll('.tile[data-set]').forEach(r=>r.onclick=()=>this.startSetting(r.dataset.set));
  R.querySelectorAll('[data-del]').forEach(b=>b.onclick=ev=>{ev.stopPropagation();this.tileEdit=false;this.startSetting(b.dataset.del);});
  R.querySelectorAll('[data-fav]').forEach(b=>b.onclick=ev=>{ev.stopPropagation();const f=P.favs[+b.dataset.fav];P.favs.splice(+b.dataset.fav,1);this.savePlaces();this.toast((f?f.name:'Favorite')+' removed');this.showStart();});
  const tb=R.querySelector('.tile.tbr');if(tb) tb.onclick=ev=>{ev.stopPropagation();this.closeSearch&&this.closeSearch();TN.bridges.open();};
  const te=R.querySelector('.tedit');if(te) te.onclick=ev=>{ev.stopPropagation();this.tileEdit=!this.tileEdit;this.showStart();};
  const cs=R.querySelector('.cancelstop');if(cs) cs.onclick=ev=>{ev.stopPropagation();this.cancelAddStop();};
  const ct=R.querySelector('.cancelset');if(ct) ct.onclick=ev=>{ev.stopPropagation();this.setting=null;this.input.placeholder='Search a place or address';this.showStart();};
};
/* setting Home or Work: the next place picked is saved there */
TN.Nav.prototype.startSetting=function(k){
  this.setting=k;this.input.value='';this.input.placeholder=k==='home'?'Search your home address':'Search your work address';this.syncX();this.input.focus();this.showStart();
};
/* the time to get Home / to Work right now (live traffic), refreshed every 3 minutes */
TN.Nav.prototype.etaFor=function(k){
  const pl=this.places[k];if(!pl||!TN.MBX) return null;this.etaC=this.etaC||{};const c=this.etaC[k],now=Date.now(),h=this.here();
  if(c&&c.key===pl.lng+','+pl.lat&&now-c.t<180000&&TN.distLL(h,c.from)<500) return c.min;
  if(!c||now-c.t>15000){this.etaC[k]={t:now,key:pl.lng+','+pl.lat,from:h,min:c&&c.key===pl.lng+','+pl.lat?c.min:null};
    const to=TN.routeTo(pl);
    fetch('https://api.mapbox.com/directions/v5/mapbox/driving-traffic/'+h[0].toFixed(6)+','+h[1].toFixed(6)+';'+to[0].toFixed(6)+','+to[1].toFixed(6)+'?overview=false&access_token='+TN.MBX)
      .then(r=>r.ok?r.json():null).then(j=>{if(j&&j.routes&&j.routes[0]){this.etaC[k].min=Math.max(1,Math.round(j.routes[0].duration/60));
        if(this.res.style.display!=='none'&&!this.input.value) this.showStart();}}).catch(()=>{});}
  return c&&c.key===pl.lng+','+pl.lat?c.min:null;
};
TN.Nav.prototype.search=async function(q){
  const h=this.here(),my=++this.qn;this.qn=my;
  if(TN.MBX){try{
    if(!this.sess) this.sess=Math.random().toString(36).slice(2)+Date.now().toString(36);
    const u='https://api.mapbox.com/search/searchbox/v1/suggest?q='+encodeURIComponent(q)+'&language='+(TN.LANG||'en')+'&country=ca,us&limit=8&proximity='+h[0].toFixed(5)+','+h[1].toFixed(5)+
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
      const j=await r.json(),f=j.features&&j.features[0];if(f){it.lng=f.geometry.coordinates[0];it.lat=f.geometry.coordinates[1];
        /* where cars actually reach the place (an entrance or drop-off point), when Mapbox knows it */
        const rp=f.properties&&f.properties.coordinates&&f.properties.coordinates.routable_points;
        if(rp&&rp.length){const d=rp.find(p=>p.name==='default')||rp[0];if(d&&d.latitude!=null){it.rlng=d.longitude;it.rlat=d.latitude;}}}}catch(e){}
    this.sess=null;   /* a new search session next time */
    if(it.lng==null){this.ov.style.display='flex';this.ov.innerHTML='<div>Could not open that place</div><button class="cancel">Close</button>';this.ov.querySelector('.cancel').onclick=()=>{this.ov.style.display='none';};return;}
  }
  {const old=this.recent.find(r=>r.name===it.name&&Math.abs(r.lat-it.lat)<1e-4);if(old&&old.ub&&it.ub==null) it.ub=true;}   /* (your choice for this place, remembered) */
  this.recent=[{name:it.name,sub:it.sub,lng:it.lng,lat:it.lat,rlng:it.rlng,rlat:it.rlat,ub:it.ub}].concat(this.recent.filter(r=>r.name!==it.name||Math.abs(r.lat-it.lat)>1e-4)).slice(0,6);
  try{localStorage.setItem('tn2_recent',JSON.stringify(this.recent));}catch(e){}
  if(this.setting){const k=this.setting;this.setting=null;this.places[k]=this.slim(it);this.savePlaces();
    this.input.value='';this.input.placeholder='Search a place or address';this.syncX();this.res.style.display='none';this.input.blur();
    this.toast((k==='home'?'Home':'Work')+' saved: '+it.name);if(this.etaC) delete this.etaC[k];return;}
  if(this.addingStop){this.addingStop=false;document.body.classList.remove('tn-addstop');
    this.stops.push({name:it.name,sub:it.sub,lng:it.lng,lat:it.lat,rlng:it.rlng,rlat:it.rlat});this.stopPins();
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
TN.Nav.prototype.cancelAddStop=function(){
  if(!this.addingStop) return;
  this.addingStop=false;document.body.classList.remove('tn-addstop');
  this.input.value='';this.input.placeholder='Search a place or address';this.res.style.display='none';this.input.blur();this.syncX();
  if(!this.active&&this.route&&this.dest) this.overview();   /* (before Go: the route overview again) */
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
    const u='https://api.mapbox.com/search/searchbox/v1/forward?q='+encodeURIComponent(q)+'&types=poi&limit=10&language='+(TN.LANG||'en')+'&proximity='+h[0].toFixed(5)+','+h[1].toFixed(5)+'&access_token='+TN.MBX;
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
        /* (some tiles being refused is common while others load fine: warn only if none load at all, below) */
        if(st===401||st===403) this.tRefused=st;}});
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
        if(st.ok===0&&n<=0&&this.tRefused&&!this.tKeyTold){this.tKeyTold=true;this.toast('Live traffic: the map key was refused ('+this.tRefused+')');}
        },8000);}
  }catch(e){this.note('traffic error',{msg:String(e&&e.message||e)},false);}
};
/* ---------- route ---------- */
/* route preferences (settings): roads to avoid, for the next route asked */
TN.avoidList=function(){const S=TN.settings||{},a=[];if(S.avoidToll) a.push('toll');if(S.avoidHwy) a.push('motorway');if(S.avoidFerry) a.push('ferry');if(S.avoidUnpaved) a.push('unpaved');return a;};
TN.avoidParam=function(){const a=TN.avoidList();return a.length?'&exclude='+a.join(','):'';};
/* where to route to: the place's routable point when known, otherwise the place itself */
TN.routeTo=p=>p.rlng!=null&&!p.ub?[p.rlng,p.rlat]:[p.lng,p.lat];   /* (ub: you chose the building over the car access point) */
TN.llDist=(a,b)=>{const k=111320,dx=(a[0]-b[0])*k*Math.cos(a[1]*Math.PI/180),dy=(a[1]-b[1])*k;return Math.hypot(dx,dy);};
/* does this route end badly? arriving on a highway, or passing close to the destination, going away and coming back */
TN.badEnding=function(rt,to){
  const C=rt.geometry&&rt.geometry.coordinates;if(!C||C.length<2) return null;
  const lg=rt.legs&&rt.legs[rt.legs.length-1],st=lg&&lg.steps||[];
  let hwy=false;for(let i=Math.max(0,st.length-3);i<st.length;i++){const its=st[i].intersections||[];
    if(its.slice(-2).some(x=>(x.classes||[]).indexOf('motorway')>=0)) hwy=true;}
  let first=-1;for(let i=0;i<C.length;i++){if(TN.llDist(C[i],to)<120){first=i;break;}}
  let after=0;if(first>=0) for(let i=first;i<C.length-1;i++) after+=TN.llDist(C[i],C[i+1]);
  const loop=first>=0&&after>600;
  return hwy||loop?{hwy:hwy,loop:loop,after:Math.round(after)}:null;
};
/* the nearest point on a local street (not a highway or its ramps) around a place: from our road data if that
   area is loaded, otherwise asked from OpenStreetMap */
TN.Nav.prototype.localStreet=async function(to){
  const bad=/^(motorway|trunk)(_link)?$/,net=this.api.net,q=TN.toLocal(to[0],to[1]);let best=null;
  if(net&&net.near) net.near(q[0],q[1],250,(w,k)=>{if(bad.test(w.cls||'')||w.br||k>=w.pts.length-1) return;
    const r=TN.seg(w,k,q[0],q[1]);if(!best||r.d<best.d) best={d:r.d,x:r.qx,z:r.qz};});
  if(best) return TN.fromLocal(best.x,best.z);
  try{const oq='[out:json][timeout:10];way(around:250,'+to[1]+','+to[0]+')[highway~"^(primary|secondary|tertiary|residential|unclassified|living_street|service|primary_link|secondary_link|tertiary_link)$"];out geom;';
    const r=await fetch('https://overpass-api.de/api/interpreter?data='+encodeURIComponent(oq));if(!r.ok) return null;const j=await r.json();
    let b=null;for(const e of j.elements||[]) for(const g of e.geometry||[]){const d=TN.llDist([g.lon,g.lat],to);if(!b||d<b.d) b={d:d,p:[g.lon,g.lat]};}
    return b?b.p:null;}catch(e){return null;}
};
TN.Nav.prototype.fetchRoute=async function(from,to){
  const rt=await this.fetchRouteOnce(from,to);
  /* a bad ending (like a station beside a highway, reached by crossing a bridge and coming back): ask again with
     the destination on the nearest local street, and keep that route if it's better */
  try{const bad=TN.badEnding(rt,to);
    if(bad){const alt=await this.localStreet(to);
      if(alt&&TN.llDist(alt,to)>3){const rt2=await this.fetchRouteOnce(from,alt);const bad2=TN.badEnding(rt2,alt);
        const better=rt2&&(!bad2||rt2.duration<rt.duration*0.9);
        this.note('route ending check',{hwy:bad.hwy,loop:bad.loop,after:bad.after,alt:!!alt,used:!!better,min:Math.round(rt.duration/60),min2:rt2?Math.round(rt2.duration/60):null},false);
        if(better){rt2.adjusted=true;return rt2;}}}}catch(e){}
  return rt;
};
TN.Nav.prototype.fetchRouteOnce=async function(from,to){
  if(TN.MBX){try{
    const via=(this.stops||[]).map(p=>{const r=TN.routeTo(p);return r[0].toFixed(6)+','+r[1].toFixed(6);});
    const G=this.api.gps?this.api.gps():null,brg=G&&G.v>2&&G.hd!=null?'&bearings='+Math.round(G.hd)+',60'+';'.repeat(via.length+1):'';
    const u='https://api.mapbox.com/directions/v5/mapbox/driving-traffic/'+[from[0].toFixed(6)+','+from[1].toFixed(6)].concat(via,[to[0].toFixed(6)+','+to[1].toFixed(6)]).join(';')+
      '?geometries=geojson&overview=full&steps=true&annotations=congestion,maxspeed&language='+(TN.LANG||'en')+'&voice_instructions=true&voice_units=metric'+brg+TN.avoidParam()+'&access_token='+TN.MBX;
    const r=await fetch(u);if(r.ok){const j=await r.json();if(j.routes&&j.routes[0]){j.routes[0].traffic=true;return j.routes[0];}}
  }catch(e){}}
  return this.fetchRouteFree(from,to);
};
TN.Nav.prototype.fetchRouteFree=async function(from,to){
  const pts=[from].concat((this.stops||[]).map(p=>TN.routeTo(p)),[to]);
  const u='https://router.project-osrm.org/route/v1/driving/'+pts.map(p=>p[0].toFixed(6)+','+p[1].toFixed(6)).join(';')+'?overview=full&geometries=geojson&steps=true';
  const r=await fetch(u);if(!r.ok) throw new Error('route');const j=await r.json();
  if(!j.routes||!j.routes[0]) throw new Error('no route');return j.routes[0];
};
TN.Nav.prototype.plan=async function(reroute){
  const from=this.here(),to=TN.routeTo(this.dest);
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
  /* a new route starts from scratch: where the car is along it, its lane, the release timers (a leftover position
     from a previous route made the car look for itself in the wrong part of the new one, for the whole trip) */
  this.pi=0;this.ps=null;this.latS=null;this.laneI=null;this.latF=null;this.relT=0;this.turnW=0;this.relAt=0;this.fullT=0;
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
  this.route={pts:pts,cum:cum,L:cum[cum.length-1],dur:rt.duration,dist:rt.distance,steps:steps,hy:null,traffic:!!rt.traffic,typ:rt.duration_typical||null};
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
    net.near(p[0],p[1],15,(w,k)=>{if(w.tun) return;const r=TN.seg(w,k,p[0],p[1]);if(r.d>TN.width(w)/2+7) return;
      if(w.ow&&(r.tx*ux+r.tz*uz)<0.3) return;   /* (the other carriageway of a divided road, or a one-way going the other way) */
      const h0=w.hs?w.hs[k]+(w.hs[k+1]-w.hs[k])*r.u:(w.br?w.H:0);
      const sc=r.d+(1-Math.abs(r.tx*ux+r.tz*uz))*20+(prev==null?0:Math.abs(h0-prev)*4);
      if(!best||sc<best.sc) best={sc:sc,h:h0,lane:w.ow?0:Math.max(1.2,TN.width(w)/4),dx:r.qx-p[0],dz:r.qz-p[1],hw:TN.width(w)/2,ow:!!w.ow};});
    /* turning here (direction changes over 20 degrees within about 10 m): keep the arc, no snapping */
    let turnHere=false;{const a=R.pts[Math.max(0,i-15)],b=R.pts[i],c2=R.pts[Math.min(R.pts.length-1,i+15)];
      const h1=Math.atan2(b[0]-a[0],-(b[1]-a[1])),h2=Math.atan2(c2[0]-b[0],-(c2[1]-b[1]));let dh=Math.abs(h2-h1)*180/Math.PI;if(dh>180) dh=360-dh;turnHere=dh>20;}
    if(best&&turnHere){best.dx=0;best.dz=0;}
    const pf=i>0&&R.fit[i-1]&&!turnHere&&R.cum[i]-R.cum[i-1]<25?R.fit[i-1]:null;
    R.fit[i]=best?{h:best.h,lane:best.lane,dx:best.dx,dz:best.dz,hw:best.hw,ow:best.ow,miss:false}:{h:prev!=null?prev:(i>0&&R.fit[i-1]?R.fit[i-1].h:0),lane:pf?pf.lane:0,dx:pf?pf.dx:0,dz:pf?pf.dz:0,miss:true,ver:net.ver};
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
  const pos=[],idx=[],col=[],rd=[],hw=1.3,CL=[];let n=0;const tc=new THREE.Color();
  const a0=Math.max(0,from|0);
  let a1=a0;while(a1<R.pts.length-1&&R.cum[a1]-R.cum[a0]<1500) a1++;
  this.fitRange(Math.max(0,a0-40),a1);this.drawVer=this.api.net.ver;
  for(let i=a0;i<=a1;i++){
    const p=R.pts[i],q=R.pts[Math.min(R.pts.length-1,i+1)],o=R.pts[Math.max(0,i-1)];let ux=q[0]-o[0],uz=q[1]-o[1];const ul=Math.hypot(ux,uz)||1;ux/=ul;uz/=ul;
    const m=R.sm[i]||[0,0,0,0],y=m[3]+0.22;let lo=m[0];
    if(this.latS!=null&&this.ps!=null){const ah=R.cum[i]-this.ps;if(ah<500){const t=Math.max(0,ah-400)/100,k=t*t*(3-2*t);lo=this.latS+(m[0]-this.latS)*k;}}
    const cx=p[0]+m[1]-uz*lo,cz=p[1]+m[2]+ux*lo;
    CL.push([cx,y,cz,R.cum[i]]);
    pos.push(cx-uz*hw,y,cz+ux*hw,cx+uz*hw,y,cz-ux*hw);
    tc.set(TN.TRAFFIC_COL[R.cong?R.cong[i]:'unknown']||'#3b82f6');col.push(tc.r,tc.g,tc.b,tc.r,tc.g,tc.b);
    rd.push(R.cum[i],R.cum[i]);
    if(i>a0) idx.push(n-2,n-1,n+1,n-2,n+1,n);
    n+=2;
  }
  if(this.mesh){S.three.scene.remove(this.mesh);this.mesh.geometry.dispose();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setAttribute('rd',new THREE.Float32BufferAttribute(rd,1));g.setIndex(idx);
  this.mesh=new THREE.Mesh(g,TN.settings&&TN.settings.rainbow?this.rainbowMat():this.mat);this.mesh.frustumCulled=false;this.mesh.renderOrder=4;S.three.scene.add(this.mesh);this.drawn=a0;
  this.drawArrows(CL);
};
/* turn arrows painted on the route line: three chevrons before your next turn, and a bent arrow at the turn whose stem
   follows the route's own curve through the intersection (so it bends the way you'll go) */
TN.Nav.prototype.drawArrows=function(CL){
  const S=this.api.scene,R=this.route;
  if(this.arrows){S.three.scene.remove(this.arrows);this.arrows.geometry.dispose();this.arrows=null;}
  if(!R||!R.steps||CL.length<3||(TN.settings&&TN.settings.arrows===false)) return;
  const s0=CL[0][3],s1=CL[CL.length-1][3];
  /* a point on the line at distance s along the route, with its direction */
  const at=s=>{let lo=0,hi=CL.length-1;if(s<=CL[0][3]||s>=CL[hi][3]) return null;while(hi-lo>1){const m=(lo+hi)>>1;if(CL[m][3]<=s) lo=m;else hi=m;}
    const a=CL[lo],b=CL[hi],t=(s-a[3])/((b[3]-a[3])||1);let ux=b[0]-a[0],uz=b[2]-a[2];const l=Math.hypot(ux,uz)||1;
    return {x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t+0.03,z:a[2]+(b[2]-a[2])*t,ux:ux/l,uz:uz/l};};
  /* the next turn (and the one after it, when it comes within 150 m) */
  const turns=R.steps.filter(st=>st.at>s0+8&&st.at<s1&&st.type!=='depart'&&st.type!=='arrive'&&st.type!=='new name'&&st.type!=='continue'&&!/straight/.test(st.mod||'')&&st.mod);
  const use=turns.slice(0,1);if(turns[1]&&turns[1].at-turns[0].at<150) use.push(turns[1]);
  if(!use.length) return;
  const pos=[],idx=[];let n=0;
  const quad=(a,b,c,d)=>{pos.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2],d[0],d[1],d[2]);idx.push(n,n+1,n+2,n,n+2,n+3);n+=4;};
  const tri=(a,b,c)=>{pos.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2]);idx.push(n,n+1,n+2);n+=3;};
  for(const st of use){
    /* chevrons: a "V" pointing forward, 1.8 m wide */
    for(const back of [60,40,20]){const P=at(st.at-back);if(!P) continue;
      const fx=P.ux,fz=P.uz,rx=-fz,rz=fx,w=0.95,L=1.5,t=0.45,tip=[P.x+fx*L*0.5,P.y,P.z+fz*L*0.5];
      for(const sd of [-1,1]){const out=[P.x-fx*L*0.5+rx*w*sd,P.y,P.z-fz*L*0.5+rz*w*sd];
        const ox=fx*t,oz=fz*t;quad(out,tip,[tip[0]-ox,tip[1],tip[2]-oz],[out[0]-ox,out[1],out[2]-oz]);}}
    /* the bent arrow: a stem along the line from 10 m before the turn to 9 m after, then an arrowhead */
    const pts=[];for(let d=-10;d<=9;d+=1){const P=at(st.at+d);if(P) pts.push(P);}
    if(pts.length>=4){const sw=0.32;
      for(let k=0;k<pts.length-1;k++){const a=pts[k],b=pts[k+1];
        const ra=[-a.uz*sw,a.ux*sw],rb=[-b.uz*sw,b.ux*sw];
        quad([a.x-ra[0],a.y,a.z-ra[1]],[a.x+ra[0],a.y,a.z+ra[1]],[b.x+rb[0],b.y,b.z+rb[1]],[b.x-rb[0],b.y,b.z-rb[1]]);}
      const E=pts[pts.length-1],hw2=0.95,hl=1.9;
      tri([E.x-E.uz*hw2,E.y,E.z+E.ux*hw2],[E.x+E.uz*hw2,E.y,E.z-E.ux*hw2],[E.x+E.ux*hl,E.y,E.z+E.uz*hl]);}
  }
  if(!n) return;
  if(!this.arrowMat) this.arrowMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.95,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);
  this.arrows=new THREE.Mesh(g,this.arrowMat);this.arrows.frustumCulled=false;this.arrows.renderOrder=5;S.three.scene.add(this.arrows);
};
/* the rainbow road material: the colour comes from the distance along the route, shifted a little every frame (the
   graphics card does the colours; the app only moves one number) */
TN.Nav.prototype.rainbowMat=function(){
  if(this.rmat) return this.rmat;
  this.rmat=new THREE.ShaderMaterial({uniforms:{shift:{value:0},op:{value:0.85}},transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2,
    vertexShader:'attribute float rd;varying float vR;void main(){vR=rd;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'uniform float shift;uniform float op;varying float vR;vec3 hue(float h){vec3 k=vec3(1.0,2.0/3.0,1.0/3.0);vec3 p=abs(fract(vec3(h)+k)*6.0-3.0);return clamp(p-1.0,0.0,1.0);}'+
      'void main(){gl_FragColor=vec4(mix(vec3(1.0),hue(fract(vR/90.0-shift)),0.85),op);}'});
  return this.rmat;
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
  this.ov.innerHTML='<div style="flex:1 1 260px;min-width:220px"><b>'+TN.esc(this.dest.name)+'</b><br><small>'+Math.max(1,Math.round(R.dur/60))+' min \u00b7 '+fmtDist(R.dist)+' \u00b7 arrive '+arr.toTimeString().slice(0,5)+(R.traffic?' \u00b7 live traffic':'')+(TN.avoidList().length?' \u00b7 avoiding '+TN.avoidList().map(x=>({toll:'tolls',motorway:'highways',ferry:'ferries',unpaved:'unpaved roads'})[x]).join(', '):'')+'</small>'+
    (this.stops.length?this.tripList():'')+'</div><div class="btns"><button class="go">Go</button><button class="save">'+(this.isFav(this.dest)?TN.ICON('star',16,'#fcd34d'):TN.ICON('staro',16,'#fcd34d'))+' Save</button><button class="stop">+ Stop</button><button class="det">Details</button>'+(TN.tesla&&TN.tesla.connected()&&!(this.dest&&this.dest.fromTesla)?'<button class="tsend">'+TN.TESLA_T(16)+' Send to Tessy</button>':'')+'<button class="cancel">Cancel</button></div>';
  this.ov.querySelector('.go').onclick=()=>this.go();
  this.ov.querySelector('.save').onclick=ev=>{ev.stopPropagation();this.saveMenu(ev.currentTarget);};
  this.ov.querySelector('.stop').onclick=()=>this.addStop();
  this.ov.querySelector('.cancel').onclick=()=>this.end('cancel');
  this.ov.querySelector('.det').onclick=ev=>{ev.stopPropagation();this.details();};
  /* the car access point (Mapbox's "where cars reach this place") far from the building: offer the building instead */
  {const d=this.dest;if(d&&d.rlng!=null&&TN.distLL([d.lng,d.lat],[d.rlng,d.rlat])>50&&!this.stops.length){
    const bt=this.ov.querySelector('.btns'),fr=TN.LANG==='fr';
    const msg=d.ub?(fr?'Vers le bâtiment.':'Going to the building.'):(fr?'Vers l’accès voiture (stationnement).':'Going to the car access point (parking).');
    const sw=d.ub?(fr?'Aller à l’accès voiture':'Go to the car access point'):(fr?'Aller au bâtiment':'Go to the building instead');
    if(bt){bt.insertAdjacentHTML('beforebegin','<div class="tn-acc notr" style="display:flex;align-items:center;gap:10px;margin:8px 0;font-size:14px;color:var(--tn-sub,#b9b6ae)"><span style="flex:1">'+msg+'</span><button class="acc" style="border:0;border-radius:9px;padding:7px 11px;font:600 13px system-ui,sans-serif;background:var(--tn-btn,#45474d);color:var(--tn-text,#f3f1ec)">'+sw+'</button></div>');
      this.ov.querySelector('.tn-acc .acc').onclick=ev=>{ev.stopPropagation();d.ub=!d.ub;
        const r=this.recent.find(x=>x.name===d.name&&Math.abs(x.lat-d.lat)<1e-4);if(r){r.ub=d.ub;try{localStorage.setItem('tn2_recent',JSON.stringify(this.recent));}catch(e){}}
        this.plan(false);};}}}
  {const ts=this.ov.querySelector('.tsend');if(ts) ts.onclick=async ev=>{ev.stopPropagation();ts.disabled=true;const r=await TN.tesla.send(this.dest,this);ts.disabled=false;
    this.note('tesla send',{ok:!!(r&&r.ok),why:r&&r.why,detail:r&&r.detail?String(r.detail).slice(0,120):undefined},true);};}
  {const bt=this.ov.querySelector('.btns'),rl=this.roccoHtml();if(bt&&rl) bt.insertAdjacentHTML('beforebegin',rl);}
  if(TN.bridges) TN.bridges.checkRoute(this).catch(()=>{});   /* (a slow or partly closed bridge on the route: Rocco says so) */
  this.tripButtons(this.ov);
};
/* trip details, for any route: summary (time, distance, arrival, traffic), what Tessy said (when synced), your stops,
   and every turn with the distance between them; while driving, from your next turn on.
   Opened from the overview (Details) or by tapping the instruction bar while driving. */
TN.Nav.prototype.details=function(){
  const R=this.route;if(!R) return;
  let P=document.getElementById('tn-det');
  if(!P){P=document.createElement('div');P.id='tn-det';document.body.appendChild(P);
    const st=document.createElement('style');
    st.textContent='#tn-det{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:40;width:min(92vw,560px);max-height:78vh;display:none;flex-direction:column;background:rgb(var(--tn-panel-rgb,43 45 49)/.98);color:var(--tn-text,#f3f1ec);border-radius:18px;box-shadow:0 10px 40px rgba(0,0,0,.5);font:16px system-ui,sans-serif;overflow:hidden}'+
      '#tn-det .hd{display:flex;align-items:flex-start;gap:10px;padding:16px 18px 8px}#tn-det .hd b{font-size:19px;display:block}#tn-det .hd small{color:var(--tn-sub,#b9b6ae)}#tn-det .hd .x{margin-left:auto;cursor:pointer;padding:4px}'+
      '#tn-det .sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;padding:6px 18px 12px}#tn-det .tile{background:rgba(255,255,255,.06);border-radius:12px;padding:9px 11px}#tn-det .tile small{display:block;color:var(--tn-sub,#b9b6ae);font-size:12px}#tn-det .tile span{font-size:18px;font-weight:700}'+
      '#tn-det .tile.tsl{border:1px solid rgba(227,25,55,.5)}#tn-det .note{padding:0 18px 10px;color:var(--tn-sub,#b9b6ae);font-size:13px}#tn-det .sec{padding:8px 18px 4px;font-size:12px;letter-spacing:.06em;color:var(--tn-sub,#b9b6ae)}'+
      '#tn-det .list{overflow-y:auto;padding:0 10px 12px;-webkit-overflow-scrolling:touch}#tn-det .st{display:flex;align-items:center;gap:12px;padding:9px 8px;border-bottom:1px solid var(--tn-line,rgba(255,255,255,.08))}#tn-det .st .ic{width:28px;flex-shrink:0;display:flex;justify-content:center;color:var(--tn-accent,#e8913a)}#tn-det .st .tx{flex:1;min-width:0}#tn-det .st .tx small{display:block;color:var(--tn-sub,#b9b6ae)}#tn-det .st .d{color:var(--tn-sub,#b9b6ae);font-size:14px;white-space:nowrap}#tn-det .st.next{background:rgba(255,255,255,.05);border-radius:10px}';
    document.head.appendChild(st);}
  const dest=this.dest||{},now=this.active&&this.ps!=null?this.ps:0;
  const left=Math.max(0,R.L-now),durLeft=R.dur*(R.L>0?left/R.L:1),arr=new Date(Date.now()+durLeft*1000);
  const hm=s2=>{const m=Math.max(1,Math.round(s2/60));return m<60?m+' min':Math.floor(m/60)+' h '+String(m%60).padStart(2,'0');};
  const tiles=[['Time',hm(durLeft)],['Distance',fmtDist(left)],['Arrival',arr.toTimeString().slice(0,5)]];
  if(R.typ&&R.traffic){const dl=Math.round((R.dur-R.typ)/60);tiles.push(['Traffic',dl>=2?'+'+dl+' min':'normal']);}
  let tsl='';
  if(dest.tesla){const t=dest.tesla;if(t.energy!=null) tsl+='<div class="tile tsl"><small>Battery on arrival (Tesla)</small><span>'+Math.round(t.energy)+' %</span></div>';}
  const charging=/supercharg|superchargeur/i.test(dest.name||'');
  let h='<div class="hd"><div><b>'+TN.esc(dest.name||'Trip')+'</b><small>'+TN.esc(charging?'Charging stop':(dest.sub||''))+'</small></div><span class="x">'+TN.ICON('x',22,'#9fb3c8')+'</span></div>';
  {const rl=this.roccoHtml();if(rl) h+='<div style="padding:0 18px">'+rl+'</div>';}
  h+='<div class="sum">'+tiles.map(t=>'<div class="tile"><small>'+t[0]+'</small><span>'+TN.esc(t[1])+'</span></div>').join('')+tsl+'</div>';
  if(dest.fromTesla) h+='<div class="note">'+(charging?'After charging, tap Sync for the next leg':'Synced from Tessy’s navigation')+'</div>';
  if(this.stops&&this.stops.length) h+='<div class="sec">YOUR STOPS</div><div class="list" style="flex:none;max-height:none">'+this.stops.map((s2,i)=>'<div class="st"><div class="ic">'+(i+1)+'</div><div class="tx">'+TN.esc(s2.name)+'<small>'+TN.esc(s2.sub||'')+'</small></div></div>').join('')+'</div>';
  /* the turns, from the next one while driving */
  const steps=R.steps.filter(st=>st.at>=now-5&&st.type!=='depart'||(!this.active&&st.type==='depart'));
  let prev=now,rows='';
  steps.forEach((st,i)=>{const I=this.instr(st),gap=Math.max(0,st.at-prev);prev=st.at;
    const txt=I.t+(I.where&&st.type!=='arrive'&&st.type!=='depart'?' onto '+I.where:'');
    rows+='<div class="st'+(this.active&&i===0?' next':'')+'"><div class="ic">'+TN.ICON(I.a,24,'currentColor')+'</div><div class="tx">'+TN.esc(txt)+(st.exits?'<small>Exit '+TN.esc(st.exits)+'</small>':(st.dest&&st.type!=='arrive'?'<small>'+TN.esc(st.dest)+'</small>':''))+'</div><div class="d">'+(i===0&&this.active?'in ':'')+fmtDist(gap)+'</div></div>';});
  h+='<div class="sec">'+(this.active?'NEXT TURNS':'TURNS')+' \u00b7 '+steps.length+'</div><div class="list">'+rows+'</div>';
  P.innerHTML=h;P.style.display='flex';
  P.querySelector('.x').onclick=ev=>{ev.stopPropagation();P.style.display='none';};
};
TN.Nav.prototype.isFav=function(p){return !!(p&&this.places.favs.some(f=>Math.abs(f.lat-p.lat)<1e-5&&Math.abs(f.lng-p.lng)<1e-5));};
TN.Nav.prototype.saveMenu=function(btn){
  let m=document.getElementById('tn-savemenu');if(m){m.remove();return;}
  m=document.createElement('div');m.id='tn-savemenu';m.className='hud';const fav=this.isFav(this.dest);
  m.innerHTML='<div class="r" data-k="home">'+TN.ICON('home',20,'#60a5fa')+'<span>Set as Home</span></div><div class="r" data-k="work">'+TN.ICON('work',20,'#f59e0b')+'<span>Set as Work</span></div>'+
    '<div class="r" data-k="fav">'+TN.ICON(fav?'star':'staro',20,'#fcd34d')+'<span>'+(fav?'Remove from favorites':'Add to favorites')+'</span></div>';
  const b=btn.getBoundingClientRect();m.style.left=Math.max(8,b.left)+'px';m.style.bottom=(innerHeight-b.top+8)+'px';document.body.appendChild(m);
  m.querySelectorAll('.r').forEach(r=>r.onclick=()=>{const k=r.dataset.k,d=this.dest;m.remove();if(!d) return;
    if(k==='fav'){if(this.isFav(d)){this.places.favs=this.places.favs.filter(f=>!(Math.abs(f.lat-d.lat)<1e-5&&Math.abs(f.lng-d.lng)<1e-5));this.toast(d.name+' removed from favorites');}
      else{this.places.favs.unshift(this.slim(d));this.places.favs=this.places.favs.slice(0,20);this.toast(d.name+' added to favorites');}}
    else{this.places[k]=this.slim(d);if(this.etaC) delete this.etaC[k];this.toast((k==='home'?'Home':'Work')+' saved: '+d.name);}
    this.savePlaces();if(!this.active&&this.route) this.overview();});
  setTimeout(()=>{const off=e=>{if(!m.contains(e.target)){m.remove();document.removeEventListener('pointerdown',off,true);}};document.addEventListener('pointerdown',off,true);},0);
};
/* the trip in order: stops numbered 1, 2, 3..., the destination last; arrows to reorder, x to remove */
TN.Nav.prototype.tripList=function(){
  const all=this.stops.concat([this.dest]),n=all.length;
  return '<div class="trip">'+all.map((p,i)=>'<div class="row"><span class="num'+(i===n-1?' fin':'')+'">'+(i===n-1?TN.ICON('flag',18,'#ffffff'):(i+1))+'</span>'+
    '<span class="nm">'+TN.esc(p.name)+'</span>'+
    '<button data-a="up" data-i="'+i+'"'+(i===0?' disabled':'')+'>'+TN.ICON('straight',16,'currentColor')+'</button><button data-a="down" data-i="'+i+'"'+(i===n-1?' disabled':'')+'><span style="display:block;transform:rotate(180deg)">'+TN.ICON('straight',16,'currentColor')+'</span></button>'+
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
  const k0=R.steps.indexOf(nx),nxt=k0>=0?R.steps[k0+1]:null,after=nxt?Math.max(20,Math.min(70,nxt.at-nx.at-10)):70;
  for(let i=Math.max(0,ia-200);i<Math.min(R.pts.length,ia+200);i++){const d=R.cum[i]-R.cum[ia];if(d<-80||d>after) continue;
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
  this.ov.style.display='none';this.active=true;this.saidArrive=false;this.parkT=0;document.body.classList.add('tn-routing');
  if(TN.voice&&this.route){TN.voice.say('Starting route to '+(this.dest?this.dest.name:'your destination'),true);}
  if(this.route) this.note('go',{dest:this.dest&&this.dest.name,km:+(this.route.L/1000).toFixed(2),pts:this.route.pts.length},true);
  this.bar.style.display='flex';this.endBtn.style.display='block';this.roadName.style.display='block';
  this.api.setFollow(true);
  try{this.roccoGo();}catch(e){}
};
TN.Nav.prototype.end=function(why){
  this.note('end',{why:typeof why==='string'?why:'button',at:this.route?Math.round(this.route.cum[this.idx]||0):null,left:this.route?Math.round(this.route.L-(this.route.cum[this.idx]||0)):null},true);
  this.active=false;this.route=null;this.bird=0;this.jvStep=null;this.pi=0;this.ps=null;this.latS=null;this.relT=0;if(this.input) this.input.placeholder='Search a place or address';if(this.bar) this.bar.classList.remove('jvon');document.body.classList.remove('tn-routing','tn-addstop');this.addingStop=false;this.stops=[];this.stopPins();
  this.ov.style.display='none';this.bar.style.display='none';this.endBtn.style.display='none';this.roadName.style.display='none';
  if(this.mesh){this.api.scene.three.scene.remove(this.mesh);this.mesh.geometry.dispose();this.mesh=null;}
  if(this.arrows){this.api.scene.three.scene.remove(this.arrows);this.arrows.geometry.dispose();this.arrows=null;}
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
  /* not found near where expected (more than 18 m away): look along the whole route, at most once a second */
  if(bd>324&&now-(this.fullT||0)>1000){this.fullT=now;for(let i=0;i<R.pts.length;i++){const d=(R.pts[i][0]-L.x)**2+(R.pts[i][1]-L.z)**2;if(d<bd){bd=d;bi=i;}}}
  if(bi>R.pts.length-1) bi=R.pts.length-1;
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
  /* which lane, held steady (like Google and Tesla): on regular streets the car keeps its standard lane (GPS wobble is
     ignored); on wide one-way roads (3 lanes or more: highways, big boulevards) the app works out which lane you're
     in, changes only once the GPS has clearly been in another lane for 1.5 s, and the car and the whole line move
     to that lane together */
  {const f=R.fit&&R.fit[j];
   /* (lane picking only when the car is glued to the line everywhere: otherwise the car rides in the middle of wide
      roads, and the line must stay in that same middle, not in a lane guessed from the GPS) */
   const wide=f&&!f.miss&&f.ow&&2*f.hw>=9.5&&!!(TN.settings&&TN.settings.glueRoute);
   if(wide&&L.v>3&&now-L.t<3000){
     const cx0=px+mi(1),cz0=pz+mi(2),latG=(L.x-cx0)*(-uz)+(L.z-cz0)*ux;
     this.latF=this.latF==null?latG:this.latF+(latG-this.latF)*Math.min(1,dt*1.0);
     const n=Math.max(1,Math.round(2*f.hw/3.5)),lw=2*f.hw/n,center=k=>-f.hw+lw*(k+0.5);
     const cand=Math.max(0,Math.min(n-1,Math.round((this.latF+f.hw)/lw-0.5)));
     if(this.laneI==null||this.laneI>=n){this.laneI=cand;this.laneT=0;}
     else if(cand!==this.laneI&&Math.abs(this.latF-center(cand))<lw*0.4){this.laneT=(this.laneT||0)+dt;if(this.laneT>1.5){this.laneI=cand;this.laneT=0;}}
     else this.laneT=0;
     const tgt=center(this.laneI);
     if(this.latS==null) this.latS=tgt;else{const d=tgt-this.latS,st=1.2*dt;this.latS+=Math.abs(d)<st?d:Math.sign(d)*st;}}
   else if(!wide&&this.latS!=null){const d=lo-this.latS,st=1.2*dt;this.latS+=Math.abs(d)<st?d:Math.sign(d)*st;if(Math.abs(lo-this.latS)<0.05){this.latS=null;this.laneI=null;this.latF=null;}}
   if(this.latS!=null) lo=this.latS;}
  let y=base.y!=null?base.y:mi(3);
  {const ry=mi(3);if(ry-y>0.15&&ry-y<4) y=ry;}   /* the route's road is a little higher (a bridge deck): sit on it */
  let ox=px+mi(1)-uz*lo,oz=pz+mi(2)+ux*lo,oh=hd;
  /* city turns: the route's corners sit in the middle of the intersection, while a driver starts turning earlier;
     near a turn at city speed, when the real direction clearly differs from the route line's, the car follows the
     real path (the GPS) through the turn, blended in smoothly, and goes back onto the route line after */
  {const gh=L.hd!=null&&L.v>2?L.hd:(this.api.gpsHd?this.api.gpsHd():null);
   let nearTurn=false;if(R.steps&&gh!=null&&L.v<14&&now-L.t<2500){const sNow=R.cum[j]||0;
     for(const st of R.steps){const dd=st.at-sNow;if(dd>-30&&dd<35&&st.type!=='depart'&&st.type!=='arrive'&&!/straight/.test(st.mod||'')){nearTurn=true;break;}}}
   let w=0;if(nearTurn){const dif=Math.abs(((gh-hd+540)%360)-180);w=Math.max(0,Math.min(1,(dif-8)/30));}
   this.turnW=(this.turnW||0)+(w-(this.turnW||0))*Math.min(1,dt*(w>(this.turnW||0)?6:2));
   if(this.turnW>0.01){const tw=this.turnW;ox+=(L.x-ox)*tw;oz+=(L.z-oz)*tw;oh=(oh+(((gh-oh+540)%360)-180)*tw+360)%360;}}
  return Object.assign({},base,{x:ox,z:oz,hd:oh,y:y,onRoute:true});
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
  let where=s.type==='off ramp'||s.type==='on ramp'?(s.dest||s.ref||s.name):(s.name||s.ref);
  /* (highway numbers as the map data writes them, "15; 20", read as "15 / 20") */
  if(where) where=String(where).replace(/\s*;\s*/g,' / ');
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
/* how much the car should follow the route's curve right now (0 on straight roads, 1 in a turn): gluing starts
   70 m before a turn on the route, is full from 30 m before to 25 m after it, and ends 50 m after */
TN.Nav.prototype.turnWeight=function(){
  const R=this.route;if(!R||!R.steps||this.ps==null) return 0;
  let w=0;const s=this.ps;
  for(const st of R.steps){
    if(st.type==='depart'||st.type==='arrive'||st.type==='new name'||st.type==='continue') continue;
    if(st.mod==='straight') continue;
    const d=st.at-s;if(d>70||d<-50) continue;
    const k=d>=0?(d<=30?1:(70-d)/40):(d>=-25?1:(50+d)/25);const sm=k*k*(3-2*k);
    if(sm>w) w=sm;}
  /* also wherever the route line itself curves, with or without an instruction: loop ramps, long highway curves,
     curved bridge approaches (an instruction marks only where they start) */
  if(w<1){const c=this.curveAt(s);if(c>w) w=c;}
  return w;
};
/* how curved the route is around distance s: the change of direction between 25 m before and 25 m after
   (0 below 12°, 1 from 25°, smooth in between) */
TN.Nav.prototype.curveAt=function(s){
  const R=this.route;if(!R||!R.cum||R.pts.length<3) return 0;
  const at=d=>{d=Math.max(0,Math.min(R.L||R.cum[R.cum.length-1],d));let lo=0,hi=R.cum.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(R.cum[m]<=d) lo=m;else hi=m;}
    const a=R.pts[lo],b=R.pts[hi],t=(d-R.cum[lo])/((R.cum[hi]-R.cum[lo])||1);return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];};
  const p0=at(s-25),p1=at(s),p2=at(s+25);
  const h1=Math.atan2(p1[0]-p0[0],-(p1[1]-p0[1])),h2=Math.atan2(p2[0]-p1[0],-(p2[1]-p1[1]));
  let dh=Math.abs(h2-h1)*180/Math.PI;if(dh>180) dh=360-dh;
  if(Math.hypot(p1[0]-p0[0],p1[1]-p0[1])<5||Math.hypot(p2[0]-p1[0],p2[1]-p1[1])<5) return 0;
  const k=Math.max(0,Math.min(1,(dh-12)/13));return k*k*(3-2*k);
};
TN.Nav.prototype.update=function(dt){
  try{this.roccoWatch();}catch(e){}
  if(this.mesh){const rb=!!(TN.settings&&TN.settings.rainbow);
    if(rb){const m=this.rainbowMat();if(this.mesh.material!==m) this.mesh.material=m;m.uniforms.shift.value=(m.uniforms.shift.value+dt*0.35)%1;m.uniforms.op.value=this.mat?this.mat.opacity:0.85;}
    else if(this.mat&&this.mesh.material!==this.mat) this.mesh.material=this.mat;}
  if(!this.route||!this.active) return;
  const R=this.route,c=this.api.getCar();
  /* (the car not on a road yet: parked in a garage or a lot, or a rough location on a computer): the bar shows the
     route's first instruction from its start, instead of staying empty, until the car is placed */
  if(!c||c.x==null){this.idleBar();return;}
  /* where the car is along the route: from the real GPS position when there is one (the matched car can
     briefly sit on a wrong street), searching a little ahead of the last place */
  const G=this.api.gps?this.api.gps():null,px=G&&G.x!=null?G.x:c.x,pz=G&&G.x!=null?G.z:c.z;
  let bi=this.idx,bd=1e18;
  for(let i=Math.max(0,this.idx-20);i<Math.min(R.pts.length,this.idx+400);i++){const d=(R.pts[i][0]-px)**2+(R.pts[i][1]-pz)**2;if(d<bd){bd=d;bi=i;}}
  const off=Math.sqrt(bd);this.idx=bi;const s=R.cum[bi],left=R.L-s;this.lastOff=off;
  this.stT=(this.stT||0)+dt;if(this.stT>5){this.stT=0;this.note('status',{at:Math.round(s),left:Math.round(left),off:+off.toFixed(1),onRoute:this.ps!=null,glued:!!(TN.settings&&TN.settings.glueRoute),drawn:this.drawn});}
  const laneMoved=this.latS!=null&&Math.abs(this.latS-(this.drawLat==null?this.latS:this.drawLat))>0.35;
  if(R.cum[bi]-R.cum[Math.max(0,this.drawn)]>100||bi<this.drawn||this.api.net.ver!==this.drawVer||laneMoved){this.draw(Math.max(0,bi-4));this.drawLat=this.latS;}
  if(this.rerouting) return;
  /* a stop reached (passed its arrival point): dropped from the list, so a recalculation won't send you back */
  {const st=R.steps.find(q=>q.stop===1);if(st&&s>st.at+30&&this.stops.length){this.stops.shift();this.stopPins();for(const q of R.steps) if(q.stop) q.stop--;}}
  /* next step ahead */
  let nx=null;for(const st of R.steps){if(st.at>s+8){nx=st;break;}}
  if(!nx) nx=R.steps[R.steps.length-1];
  const I=this.instr(nx),dNext=Math.max(0,nx.at-s);
  if(this.jvStep==null&&this.lastIcon!==I.a){this.bar.querySelector('.a').innerHTML=TN.ICON(I.a,42,'currentColor');this.lastIcon=I.a;}
  this.bar.querySelector('.dist').textContent=nx.type==='arrive'&&dNext<30?'Arriving':fmtDist(dNext);
  /* the exit number as a green highway exit sign (where the map has one) */
  const exn=(nx.type==='off ramp'||nx.type==='fork')&&nx.exits?String(nx.exits).split(';')[0]:'';
  this.bar.querySelector('.ins').innerHTML=(exn?'<span class="exit">EXIT '+TN.esc(exn)+'</span>':'')+TN.esc(I.t+(I.where?' \u00b7 '+I.where:''));
  /* lane arrows for the next turn (where the directions include lanes), from 1 km before it */
  {const le=this.bar.querySelector('.lanes');let html='';
   if(nx.lanes&&nx.lanes.length&&dNext<1000){
     const ic={'straight':'straight','left':'left','right':'right','slight left':'sleft','slight right':'sright','sharp left':'left','sharp right':'right','uturn':'uturn'};
     html=nx.lanes.map(l=>{const ind=(l.indications||['straight']);const mine=ind.find(x=>x===nx.mod)||ind.find(x=>nx.mod&&x.indexOf(nx.mod.replace('slight ','').replace('sharp ',''))>=0);
       const pick=l.valid&&mine?mine:(l.valid&&l.valid_indication?l.valid_indication:(mine||ind[0]));
       return '<span class="'+(l.valid?'on':'')+'">'+TN.ICON(ic[pick]||'straight',19,l.valid?'currentColor':'#5d6b80')+'</span>';}).join('');}
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
  /* arrived: at the destination, or parked near it (stopped 15 s within 250 m, in the second half of the route:
     a mall's or a building's parking lot is often away from the address point on the map) */
  {const G=this.api.gps&&this.api.gps(),v=G&&G.v!=null?G.v:9;
    if(left<250&&left<R.L*0.5&&v<0.8) this.parkT=(this.parkT||0)+dt;else this.parkT=0;}
  if(left<30||(nx.type==='arrive'&&dNext<25)||this.parkT>15){this.arriveT+=dt;if(this.arriveT>3&&!this.saidArrive){this.saidArrive=true;try{this.roccoArrive();}catch(e){}if(TN.voice) TN.voice.say('You have arrived at '+(this.dest?this.dest.name:'your destination'),true);}
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
/* the bar before the car is placed: the first turn from the route's start */
TN.Nav.prototype.idleBar=function(){
  const R=this.route;if(!R||!this.bar) return;
  const now=Date.now();if(now-(this.idleT||0)<1000) return;this.idleT=now;
  let nx=null;for(const st of R.steps){if(st.type!=='depart'&&st.at>8){nx=st;break;}}
  if(!nx) nx=R.steps[R.steps.length-1];if(!nx) return;
  const I=this.instr(nx);
  if(this.lastIcon!==I.a){this.bar.querySelector('.a').innerHTML=TN.ICON(I.a,42,'currentColor');this.lastIcon=I.a;}
  const dEl=this.bar.querySelector('.dist'),iEl=this.bar.querySelector('.ins'),t=fmtDist(nx.at),txt=I.t+(I.where?' \u00b7 '+I.where:'');
  if(dEl.textContent!==t) dEl.textContent=t;
  if(iEl.textContent!==txt) iEl.textContent=txt;
};
/* ---------- Rocco on trips: one line about this trip (overview and details), and short bubbles while driving: a greeting
   on Go, once if traffic gets much worse, and on arrival. Text only (the voice stays for turns and alerts); hidden when
   Fun mode is off. English and French written here directly. ---------- */
TN.Nav.prototype.roccoFacts=function(){
  const R=this.route,d=this.dest||{};if(!R) return null;
  const short=String(d.name||'').split(',')[0].trim().slice(0,30)||(TN.LANG==='fr'?'destination':'your destination');
  const delay=R.typ&&R.traffic?Math.round((R.dur-R.typ)/60):0,arr=new Date(Date.now()+R.dur*1000);
  return {short:short,delay:delay,min:Math.round(R.dur/60),km:R.L/1000,arrH:arr.getHours(),
    batt:d.tesla&&d.tesla.energy!=null?Math.round(d.tesla.energy):null,charging:/supercharg/i.test(d.name||'')};
};
/* the line for this trip: {tone, text}, the most important fact first; chosen once per route */
TN.Nav.prototype.roccoPlan=function(){
  const R=this.route;if(!R||(TN.settings&&TN.settings.fun===false)) return null;
  if(R.rocco) return R.rocco;
  const f=this.roccoFacts(),fr=TN.LANG==='fr',pick=a=>a[Math.floor(Math.random()*a.length)];
  let r;
  if(f.batt!=null&&f.batt<15) r=['red',fr?f.batt+' % à '+f.short+'. Conduite douce, pas de course.':f.batt+'% at '+f.short+'. Smooth driving, no racing.'];
  else if(f.batt!=null&&f.batt<25) r=['amber',fr?f.batt+' % à l’arrivée. Rocco compte chaque kilomètre.':f.batt+'% on arrival. Rocco’s counting every kilometre.'];
  else if(f.charging) r=['amber',fr?'Arrêt recharge en vue : pause collation!':'Charging stop ahead: snack time!'];
  else if(f.delay>=10) r=['amber',pick(fr?['+'+f.delay+' min de circulation. Rocco a apporté un balado.','+'+f.delay+' min de circulation. Le temps d’une bonne liste de lecture.']:['+'+f.delay+' min of traffic. Rocco brought a podcast.','+'+f.delay+' min of traffic. Good time for a playlist.'])];
  else if(f.delay>=5) r=['amber',fr?'Un peu de circulation : +'+f.delay+' min.':'A little traffic: +'+f.delay+' min.'];
  else if(f.min>=120) r=['amber',fr?'Long trajet! Dégourdissez-vous les jambes en route.':'Long one! Stretch your legs on the way.'];
  else if(f.arrH>=0&&f.arrH<5) r=['amber',fr?'Trajet de nuit. Rocco garde les yeux grands ouverts.':'Night drive. Rocco’s eyes are wide open.'];
  else if(f.min<10) r=['plain',fr?'Facile. Rocco est à peine réveillé.':'Easy one. Rocco barely woke up.'];
  else r=['plain',pick(fr?['Route dégagée. Rocco approuve.','Un trajet tout en douceur.']:['Clear road ahead. Rocco approves.','Smooth trip ahead.'])];
  R.rocco={tone:r[0],text:r[1]};return R.rocco;
};
TN.Nav.prototype.roccoCss=function(){
  if(document.getElementById('tn-rocco-css')) return;
  const st=document.createElement('style');st.id='tn-rocco-css';
  st.textContent='.tn-rline{display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:10px;margin:10px 0;background:rgba(255,255,255,.06);font:15px system-ui,sans-serif;line-height:1.3}'+
    '.tn-rline.amber{background:rgba(245,158,11,.16);color:#fcd34d}.tn-rline.red{background:rgba(239,68,68,.18);color:#fca5a5}.tn-rline.green{background:rgba(34,197,94,.16);color:#86efac}.tn-rline svg{flex-shrink:0}'+
    '#tn-rbub{position:absolute;z-index:35;left:50%;transform:translateX(-50%);max-width:min(88vw,520px);display:none;align-items:flex-start;gap:8px;transition:opacity .4s}'+
    '#tn-rbub .b{background:rgb(var(--tn-panel-rgb,43 45 49)/.97);color:var(--tn-text,#f3f1ec);border-radius:14px;padding:9px 13px;font:15px system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.35)}'+
    '#tn-rbub.amber .b{color:#fcd34d}#tn-rbub.red .b{color:#fca5a5}#tn-rbub.green .b{color:#86efac}';
  document.head.appendChild(st);
};
TN.Nav.prototype.roccoHtml=function(){
  const p=this.roccoPlan();if(!p) return '';this.roccoCss();
  return '<div class="tn-rline notr '+p.tone+'">'+(TN.roccoSVG?TN.roccoSVG(30):'')+'<span>'+TN.esc(p.text)+'</span></div>';
};
/* a short bubble under the instruction bar: 6 s, or until tapped */
TN.Nav.prototype.roccoBubble=function(tone,text){
  if(TN.settings&&TN.settings.fun===false) return;this.roccoCss();
  let b=document.getElementById('tn-rbub');
  if(!b){b=document.createElement('div');b.id='tn-rbub';b.className='notr';document.body.appendChild(b);b.onclick=()=>{b.style.display='none';};}
  const bar=this.bar&&this.bar.getBoundingClientRect?this.bar.getBoundingClientRect():null;
  b.style.top=((bar&&bar.bottom>0?bar.bottom:90)+10)+'px';
  b.className='notr '+(tone||'');b.innerHTML=(TN.roccoSVG?TN.roccoSVG(36):'')+'<div class="b">'+TN.esc(text)+'</div>';
  b.style.display='flex';b.style.opacity='1';
  clearTimeout(this.rbT);clearTimeout(this.rbT2);
  this.rbT=setTimeout(()=>{b.style.opacity='0';this.rbT2=setTimeout(()=>{b.style.display='none';},450);},6000);
};
TN.Nav.prototype.roccoGo=function(){
  if(!this.route||(TN.settings&&TN.settings.fun===false)) return;
  const f=this.roccoFacts(),fr=TN.LANG==='fr',h=new Date().getHours(),pick=a=>a[Math.floor(Math.random()*a.length)];
  const hi=h>=5&&h<11?(fr?'Bonjour!':'Good morning!'):h>=11&&h<17?(fr?'Bon trajet!':'Have a nice trip!'):h>=17&&h<22?(fr?'Bonsoir!':'Good evening!'):(fr?'Trajet de nuit!':'Night drive!');
  const t=f.min<60?f.min+' min':Math.floor(f.min/60)+' h '+String(f.min%60).padStart(2,'0');
  let msg,tone='plain';
  if(f.charging) msg=hi+' '+(fr?'Prochain arrêt : '+f.short+'. Pause collation!':'Next stop: '+f.short+'. Snack time!');
  else msg=hi+' '+(fr?t+' jusqu’à '+f.short+'. ':t+' to '+f.short+'. ')+pick(fr?['Rocco a pris la place du passager.','Rocco a les collations.','Ceinture bouclée, Rocco est prêt.']:['Rocco called shotgun.','Rocco’s got the snacks.','Seatbelt on, Rocco’s ready.']);
  if(f.batt!=null&&f.batt<15){tone='red';msg+=' '+(fr?f.batt+' % à l’arrivée : douceur!':f.batt+'% on arrival: go easy!');}
  this.etaGo=Date.now()+this.route.dur*1000;this.slowSaid=false;
  setTimeout(()=>{if(this.active) this.roccoBubble(tone,msg);},1200);
};
/* once per trip: the arrival time has slipped by 5 min or more since Go (traffic, a jam) */
TN.Nav.prototype.roccoWatch=function(){
  if(!this.active||!this.route||this.slowSaid||!this.etaGo||this.ps==null) return;
  const now=Date.now();if(now-(this.rwT||0)<20000) return;this.rwT=now;
  const R=this.route,left=Math.max(0,R.L-this.ps),eta=now+R.dur*1000*(R.L>0?left/R.L:0);
  const d=Math.round((eta-this.etaGo)/60000);
  if(d>=5&&left>1500){this.slowSaid=true;const t=new Date(eta).toTimeString().slice(0,5),fr=TN.LANG==='fr';
    this.roccoBubble('amber',fr?'Ça ralentit : +'+d+' min. Nouvelle arrivée '+t+'.':'Things just slowed down: +'+d+' min. New arrival '+t+'.');}
};
TN.Nav.prototype.roccoArrive=function(){
  /* arrival: Rocco rises from the bottom edge with a little bounce, says his line, then sinks back (about 6 s).
     At a charger he holds a charging plug (sparks, a battery filling up in his bubble); elsewhere he waves, with a
     burst of confetti. Fun mode off: nothing here (the bar already says "You have arrived"). */
  if(TN.settings&&TN.settings.fun===false) return;
  const f=this.roccoFacts();if(!f) return;
  const d=this.dest||{},fr=TN.LANG==='fr',pick=a=>a[Math.floor(Math.random()*a.length)];
  const charging=f.charging||!!d.charger||/supercharg|borne|charging|recharge/i.test((d.name||'')+' '+(d.sub||''));
  const text=charging?pick(fr?['Place à la recharge! Je m’occupe des collations.','On se branche et on relaxe. Pause collation!']:['Charging time! I’ll grab the snacks.','Plug in and relax. Snack break!'])
    :pick(fr?['Vous êtes arrivé à '+f.short+'! 🎉',f.short+'! Bien joué.','Nous y voilà : '+f.short+'. Rocco est fier.']:['You made it to '+f.short+'! 🎉',f.short+'! Nicely done.','Here we are: '+f.short+'. Rocco is proud.']);
  this.roccoArriveShow(text,charging);
};
TN.Nav.prototype.roccoArriveShow=function(text,charging){
  if(!document.getElementById('tn-rarr-css')){const st=document.createElement('style');st.id='tn-rarr-css';
    st.textContent='#tn-rarr{position:absolute;left:50%;bottom:0;width:min(46vw,380px);height:min(60vh,460px);transform:translateX(-50%);z-index:31;pointer-events:auto;overflow:visible}'+
      '#tn-rarr .rc{position:absolute;left:0;right:0;bottom:-110%;animation:tnRise 9s ease-in-out forwards}'+
      '@keyframes tnRise{0%{bottom:-110%}9%{bottom:-6%}12%{bottom:-14%}14%{bottom:-9%}85%{bottom:-9%}96%{bottom:-110%}100%{bottom:-110%}}'+
      '#tn-rarr .arm{transform-box:fill-box;transform-origin:20% 90%}#tn-rarr .wv{animation:tnWave .5s ease-in-out 1.3s 6 alternate}#tn-rarr .lf{animation:tnLift .6s ease-in-out 1.2s 5 alternate}'+
      '@keyframes tnWave{from{transform:rotate(-10deg)}to{transform:rotate(16deg)}}@keyframes tnLift{from{transform:rotate(-4deg)}to{transform:rotate(9deg)}}'+
      '#tn-rarr .sp{opacity:0;transform-box:fill-box;transform-origin:center;animation:tnSpark .45s ease-out infinite}#tn-rarr .sp2{animation-delay:.15s}#tn-rarr .sp3{animation-delay:.3s}'+
      '@keyframes tnSpark{0%{opacity:0;transform:scale(.5)}30%{opacity:1;transform:scale(1.15)}100%{opacity:0;transform:scale(.7) translate(4px,-6px)}}'+
      '#tn-rarr .bub{position:absolute;left:50%;bottom:62%;transform:translateX(-50%) scale(.6);opacity:0;background:rgb(var(--tn-panel-rgb,30 32 36)/.97);color:var(--tn-text,#f3f1ec);padding:14px 22px;border-radius:18px;font:700 22px system-ui,sans-serif;max-width:min(80vw,560px);white-space:normal;text-align:center;display:flex;align-items:center;gap:12px;box-shadow:0 6px 24px rgba(0,0,0,.4);animation:tnBub 9s ease forwards}'+
      '#tn-rarr .bub:after{content:"";position:absolute;left:50%;bottom:-7px;margin-left:-7px;border:7px solid transparent;border-top-color:rgb(var(--tn-panel-rgb,30 32 36)/.97);border-bottom:0}'+
      '@keyframes tnBub{0%,12%{opacity:0;transform:translateX(-50%) scale(.6)}16%{opacity:1;transform:translateX(-50%) scale(1.05)}18%,85%{opacity:1;transform:translateX(-50%) scale(1)}90%,100%{opacity:0;transform:translateX(-50%) scale(.8)}}'+
      '#tn-rarr .bt{position:relative;width:42px;height:20px;border:2px solid currentColor;border-radius:4px;flex-shrink:0}#tn-rarr .bt:after{content:"";position:absolute;right:-6px;top:4px;width:3px;height:6px;border-radius:0 2px 2px 0;background:currentColor}'+
      '#tn-rarr .bt i{position:absolute;left:2px;top:2px;bottom:2px;width:4px;border-radius:1px;background:#5dcaa5;animation:tnFill 3.4s ease-in-out 1.4s forwards}@keyframes tnFill{to{width:26px}}'+
      '#tn-rarr .cf i{position:absolute;left:50%;bottom:48%;width:8px;height:8px;border-radius:2px;opacity:0;animation:tnConf 1.6s ease-out 1.1s forwards}'+
      '@keyframes tnConf{0%{opacity:1;transform:translate(0,0) rotate(0)}100%{opacity:0;transform:translate(var(--x),var(--y)) rotate(260deg)}}'+
      '@media (prefers-reduced-motion:reduce){#tn-rarr .rc{animation:none;bottom:-9%}#tn-rarr .bub{animation:none;opacity:1;transform:translateX(-50%)}#tn-rarr .arm,#tn-rarr .sp,#tn-rarr .cf i{animation:none}}';
    document.head.appendChild(st);}
  const old=document.getElementById('tn-rarr');if(old) old.remove();
  const el=document.createElement('div');el.id='tn-rarr';el.className='notr';
  const arm=charging
    ?'<path d="M172 150 C 200 170, 206 190, 214 214" stroke="#2c2c2a" stroke-width="6" fill="none" stroke-linecap="round"/><g class="arm lf"><ellipse cx="156" cy="142" rx="13" ry="25" fill="#9a998f" transform="rotate(-24 156 142)"/>'+
      '<rect x="158" y="96" width="30" height="40" rx="10" fill="#e9e9e6" stroke="#5f5e5a" stroke-width="2"/><rect x="164" y="88" width="18" height="12" rx="4" fill="#5f5e5a"/>'+
      '<path d="M176 104 L168 118 L175 118 L170 130 L181 113 L174 113 Z" fill="#E8913A"/><circle cx="168" cy="134" r="9" fill="#5f5e5a"/>'+
      '<path class="sp" d="M170 80 l4 -8 l-1 7 l6 -3 l-6 8 z" fill="#f0c24a"/><path class="sp sp2" d="M182 84 l6 -6 l-3 7 l7 0 l-8 5 z" fill="#f0c24a"/><path class="sp sp3" d="M160 82 l-3 -8 l4 6 l2 -6 l0 9 z" fill="#f0c24a"/></g>'
    :'<g class="arm wv"><ellipse cx="160" cy="140" rx="13" ry="26" fill="#9a998f" transform="rotate(-28 160 140)"/><circle cx="170" cy="118" r="10" fill="#5f5e5a"/></g>';
  const svg='<svg viewBox="0 0 220 210" width="100%" style="display:block;overflow:visible" aria-hidden="true">'+
    '<path d="M46 62 L54 18 L86 50 Z" fill="#888780"/><path d="M154 62 L146 18 L114 50 Z" fill="#888780"/><path d="M52 56 L57 30 L76 49 Z" fill="#d3d1c7"/><path d="M148 56 L143 30 L124 49 Z" fill="#d3d1c7"/>'+
    '<ellipse cx="100" cy="182" rx="64" ry="44" fill="#9a998f"/><ellipse cx="100" cy="188" rx="36" ry="30" fill="#d9d7cd"/>'+arm+
    '<ellipse cx="42" cy="152" rx="12" ry="22" fill="#9a998f" transform="rotate(20 42 152)"/><circle cx="100" cy="92" r="56" fill="#b4b2a9"/>'+
    '<path d="M44 86 Q100 58 156 86 L156 106 Q100 84 44 106 Z" fill="#2c2c2a"/><circle cx="78" cy="94" r="10" fill="#f1efe8"/><circle cx="122" cy="94" r="10" fill="#f1efe8"/>'+
    '<circle cx="'+(charging?81:80)+'" cy="95" r="5" fill="#2c2c2a"/><circle cx="'+(charging?125:120)+'" cy="95" r="5" fill="#2c2c2a"/>'+
    '<ellipse cx="100" cy="122" rx="24" ry="18" fill="#f1efe8"/><ellipse cx="100" cy="114" rx="8" ry="6" fill="#2c2c2a"/><path d="M88 126 Q100 136 112 126" stroke="#2c2c2a" stroke-width="3" fill="none" stroke-linecap="round"/></svg>';
  const conf=charging?'':'<div class="cf">'+[['#E8913A',-90,-70],['#5dcaa5',80,-80],['#f0c24a',-50,-110],['#e24b4a',60,-40],['#85b7eb',-110,-20],['#E8913A',110,-100]].map(c=>'<i style="background:'+c[0]+';--x:'+c[1]+'px;--y:'+c[2]+'px"></i>').join('')+'</div>';
  el.innerHTML=conf+'<div class="bub">'+(charging?'<span class="bt"><i></i></span>':'')+'<span>'+TN.esc(text)+'</span></div><div class="rc">'+svg+'</div>';
  el.onclick=()=>el.remove();
  document.body.appendChild(el);
  clearTimeout(this.rarrT);this.rarrT=setTimeout(()=>{try{el.remove();}catch(e){}},9400);
};

