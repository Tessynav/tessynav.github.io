/* TessyNav v2 — settings.js (v2: test update for the update dot)
   The settings menu (gear button): switch looks on and off, choose the time of day (auto, day, night), set how dark
   night gets, the opening animation, the Record button, and the version/update check.
   Choices are remembered in this browser and apply instantly. Address switches like ?trees=0 still work. */
var TN=globalThis.TN||{};globalThis.TN=TN;

TN.SETDEF={voice:true,glueRoute:false,glueTurns:true,wideLanes:false,avoidToll:false,avoidHwy:false,avoidFerry:false,avoidUnpaved:false,rainbow:false,shadows:true,trees:true,leaves:true,weather:true,traffic:true,limits:true,incidents:true,cameras:true,rail:true,fun:true,water:true,buildings:true,lights:true,rem:true,cut:true,time:'auto',nightLevel:0.5,intro:true,record:true,zoombtns:false,birdseye:false};
TN.loadSettings=function(){let s={};try{s=JSON.parse(localStorage.getItem('tn2_settings')||'{}')||{};}catch(e){}return Object.assign({},TN.SETDEF,s);};
TN.settings=TN.loadSettings();

TN.Settings=function(m){
  this.m=m;this.s=TN.settings;this.panel=null;
};
TN.Settings.prototype.save=function(){try{localStorage.setItem('tn2_settings',JSON.stringify(this.s));}catch(e){}};
TN.Settings.prototype.set=function(k,v){this.s[k]=v;TN.settings=this.s;this.save();this.apply(k);
  /* while recording, every setting change is noted with its time (to compare before and after) */
  try{if(TN.recorder&&TN.recorder.rec) TN.recorder.note('setting',{k:k,v:v});}catch(e){}};
/* make one setting take effect right away */
TN.Settings.prototype.apply=function(k){
  const m=this.m,s=this.s,sc=m.scene;
  try{
    if(k==='trees'&&m.trees){const T=m.trees;
      if(!s.trees){T.on=false;for(const c of [...T.cells.keys()]) T.free(c);}
      else{T.on=true;if(!T.index) fetch('../trees/index.json').then(r=>r.ok?r.json():null).then(j=>{if(j){T.T=j.tile||0.05;T.index=new Set(j.tiles||[]);}}).catch(()=>{});}}
    if(k==='buildings'&&m.buildings){const B=m.buildings;
      if(!s.buildings){B.on=false;for(const c of [...B.cells.keys()]) B.free(c);B.job=null;try{sc.map.setLayoutProperty('tn-buildings','visibility','visible');}catch(e){}}
      else{B.on=true;if(B.noIdMode){try{sc.map.setLayoutProperty('tn-buildings','visibility','none');}catch(e){}}}}
    if(k==='water'&&m.water){const W=m.water;if(!s.water){W.on=false;for(const c of [...W.cells.keys()]) W.free(c);}else W.on=true;}
    if(k==='leaves'&&m.season){const S=m.season;if(S.mesh) S.mesh.visible=!!s.leaves;S.off=!s.leaves;}
    if(k==='rem'&&m.rem){const R=m.rem;R.on=!!s.rem;
      for(const st of R.stations.values()) if(st.mesh) st.mesh.visible=!!s.rem;
      if(R.labels) for(const el of R.labels.values()) if(!s.rem) el.style.display='none';
      if(!s.rem){for(const t of R.trains) R.free(t);R.trains=[];}}
    if(k==='lights'){sc.lightsOff=!s.lights;sc.setNight(sc.night||0);}
    if(k==='cut'){sc.cutOn=!!s.cut;}
    if(k==='weather'&&m.weather){m.weather.setOn(!!s.weather);}
    if(k==='record'){for(const id of ['rec','trips']){const b=document.getElementById(id);if(b) b.style.display=s.record?'':'none';}}
    if(k==='zoombtns'){for(const id of ['zin','zout']){const b=document.getElementById(id);if(b) b.style.display=s.zoombtns?'':'none';}}
    if(k==='time'||k==='nightLevel'){if(m.night) m.night();}
  }catch(e){}
};
TN.Settings.prototype.applyAll=function(){for(const k in TN.SETDEF) this.apply(k);};
/* the gear button and the panel */
TN.Settings.prototype.build=function(){
  const st=document.createElement('style');
  st.textContent='#tn-gear{right:16px;top:16px;width:50px;height:50px;padding:0;font-size:26px;display:flex;align-items:center;justify-content:center}'+
  '#tn-set{position:absolute;right:16px;top:72px;width:340px;max-height:calc(100% - 140px);overflow:auto;background:rgba(10,18,32,.95);border-radius:14px;padding:8px 16px 12px;color:#e8f1fa;font:15px sans-serif;z-index:7;display:none}'+
  '#tn-set .h{font-size:11px;letter-spacing:.07em;color:#9fb3c8;margin:12px 0 2px}#tn-set .r{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.08)}'+
  '#tn-set .sub{font-size:12px;color:#9fb3c8}#tn-set .t{width:46px;height:28px;border-radius:14px;background:#1fa596;position:relative;flex-shrink:0;cursor:pointer}'+
  '#tn-set .t:after{content:"";position:absolute;top:4px;left:22px;width:20px;height:20px;border-radius:50%;background:#fff;transition:left .2s}#tn-set .t.off{background:#4a5260}#tn-set .t.off:after{left:4px}'+
  '#tn-set .seg{display:flex;border-radius:8px;overflow:hidden;border:1px solid #4a5260}#tn-set .seg span{padding:6px 11px;font-size:13px;cursor:pointer}#tn-set .seg span.on{background:#1fa596}'+
  '#tn-set .ttl{font-size:18px;font-weight:600;margin:6px 0 4px}#tn-set .cat{display:flex;align-items:center;gap:14px;padding:13px 2px;border-bottom:1px solid rgba(255,255,255,.08);cursor:pointer}#tn-set .cat:active{background:rgba(255,255,255,.06)}'+
  '#tn-set .ct{flex:1;font-size:16px}#tn-set .chev{color:#9fb3c8;font-size:22px}#tn-set .back{font-size:17px;font-weight:600;padding:8px 0 4px;cursor:pointer;color:#7fd3c8}#tn-set .back span{color:#e8f1fa}'+
  '#tn-set input[type=range]{width:100%;accent-color:#1fa596}#tn-set .lbls{display:flex;justify-content:space-between;font-size:11px;color:#9fb3c8}#tn-set .lnk{cursor:pointer;color:#7fd3c8}';
  document.head.appendChild(st);
  const g=document.createElement('button');g.id='tn-gear';g.className='hud';g.setAttribute('aria-label','Settings');g.textContent='\u2699';document.body.appendChild(g);
  const p=document.createElement('div');p.id='tn-set';document.body.appendChild(p);this.panel=p;
  const tog=(k,label,sub)=>'<div class="r"><div>'+label+(sub?'<div class="sub">'+sub+'</div>':'')+'</div><div class="t'+(this.s[k]?'':' off')+'" data-k="'+k+'"></div></div>';
  /* organised like phone settings: a short main page of categories (each with a one-line summary of what's on);
     tapping one opens its page, with a back arrow */
  const I=(d,c)=>'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="'+(c||'#7fd3c8')+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg>';
  const ICN={nav:I('<path d="M12 2l7 19-7-4-7 4z"/>'),car:I('<path d="M5 16l1.5-5h11L19 16"/><rect x="3.5" y="16" width="17" height="4" rx="1.5"/><circle cx="7.5" cy="20" r="1.2"/><circle cx="16.5" cy="20" r="1.2"/>'),
    alert:I('<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17v.5"/>'),map:I('<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>'),
    look:I('<path d="M3 21V10l6-4 6 4v11"/><path d="M15 21V14h6v7"/><path d="M7 21v-5h4v5"/>'),app:I('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>')};
  const S=this.s,on=k=>!!S[k],list=a=>a.filter(Boolean).join(' \u00b7 ')||'Standard';
  const CATS=[
    {id:'nav',t:'Navigation',sum:()=>list([on('voice')?'Voice on':'Voice off',on('avoidToll')&&'no tolls',on('avoidHwy')&&'no highways',on('avoidFerry')&&'no ferries',on('avoidUnpaved')&&'no unpaved']),
     html:()=>'<div class="h">GUIDANCE</div>'+tog('voice','Voice instructions','Spoken turns, arrival and alerts')+tog('birdseye','Bird\u2019s-eye view at exits','The camera rises before exits (instead of the drawing in the bar)')+
       '<div class="h">ROUTE PREFERENCES</div><div class="sub" style="margin-bottom:2px">For your next route</div>'+tog('avoidToll','Avoid toll roads')+tog('avoidHwy','Avoid highways')+tog('avoidFerry','Avoid ferries')+tog('avoidUnpaved','Avoid unpaved roads')},
    {id:'car',t:'Car on the route',sum:()=>on('glueRoute')?'Glued everywhere':list([on('glueTurns')?'Glued in turns':'Normal tracking',on('wideLanes')&&'follows my lane']),
     html:()=>'<div class="sub" style="margin:8px 0 2px">How the car is drawn while you follow a route</div>'+tog('glueTurns','Glue the car in turns','Follows the route\u2019s curve through turns; steady on straight roads (recommended)')+
       tog('glueRoute','Glue the car everywhere','Always on the route line (can drift sideways on straight roads)')+tog('wideLanes','Follow my lane on wide roads','Highways and bridges with 3+ lanes: the car takes your lane (moves sideways more)')},
    {id:'alert',t:'Alerts',sum:()=>{const a=['incidents','cameras','rail','limits'].filter(k=>on(k)).length;return a+' of 4 on'+(on('fun')?' \u00b7 Fun mode':'');},
     html:()=>'<div class="h">ON YOUR WAY</div>'+tog('incidents','Road incidents','Accidents, closures, works and traffic on your way')+tog('cameras','Speed cameras','Fixed, red-light and mobile zones (Quebec)')+tog('rail','Railway crossings','Before level crossings on your way')+
       '<div class="h">ON SCREEN</div>'+tog('limits','Speed limit sign','Turns red when you are over')+tog('fun','Fun mode','Rocco the raccoon and his jokes on alert cards')},
    {id:'map',t:'Map and view',sum:()=>list([({auto:'Light: auto',day:'Always day',night:'Always night'})[S.time]||'Light: auto',on('traffic')&&'live traffic']),
     html:()=>'<div class="h">TIME OF DAY</div><div class="r"><div>Light</div><div class="seg" data-k="time"><span data-v="auto">Auto</span><span data-v="day">Day</span><span data-v="night">Night</span></div></div>'+
       '<div class="r" style="display:block"><div>Night brightness</div><input type="range" min="0" max="100" step="1" data-k="nightLevel" value="'+Math.round(S.nightLevel*100)+'"><div class="lbls"><span>Softer</span><span>Darker</span></div></div>'+
       '<div class="h">MAP</div>'+tog('traffic','Live traffic','Traffic colours when browsing the map')+tog('cut','See-through around Tessy','Bridges and buildings in front of the car fade')+tog('zoombtns','Zoom buttons','Pinching the map works too')},
    {id:'look',t:'3D details',sum:()=>{const k=['buildings','trees','shadows','leaves','weather','water','lights','rem'];return k.filter(on).length+' of '+k.length+' on'+(on('rainbow')?' \u00b7 rainbow road':'');},
     html:()=>'<div class="h">THE CITY</div>'+tog('buildings','Detailed buildings')+tog('trees','Trees')+tog('rem','REM trains and labels')+tog('water','Animated water')+
       '<div class="h">LIGHT AND SEASONS</div>'+tog('shadows','Shadows','Follow the real sun; the car always has a soft shadow')+tog('lights','Street light glow','At night')+tog('weather','Real weather','Rain, snow, fog and clouds from the live weather')+tog('leaves','Leaves and snow','Falling, on the ground and on the car (autumn leaves; snow when there is some)')+
       '<div class="h">FOR FUN</div>'+tog('rainbow','Rainbow road','The route line flows through the colours (hides traffic colours on it)')},
    {id:'app',t:'App',sum:()=>'Version, recording, intro',
     html:()=>tog('intro','Opening animation')+tog('record','Record and Trips buttons','For test drives (hidden while navigating)')+'<div class="r"><div>Version and updates</div><div class="lnk" id="tn-setver">Check \u203a</div></div>'}];
  const show=id=>{
    if(!id){p.innerHTML='<div class="ttl">Settings</div>'+CATS.map(c=>'<div class="cat" data-c="'+c.id+'">'+ICN[c.id]+'<div class="ct"><div>'+c.t+'</div><div class="sub">'+c.sum()+'</div></div><span class="chev">\u203a</span></div>').join('');
      p.querySelectorAll('.cat').forEach(e=>e.onclick=()=>show(e.dataset.c));p.scrollTop=0;return;}
    const c=CATS.find(x=>x.id===id);
    p.innerHTML='<div class="back">\u2039 <span>'+c.t+'</span></div>'+c.html();p.scrollTop=0;
    p.querySelector('.back').onclick=()=>show(null);
    p.querySelectorAll('.t').forEach(t=>t.onclick=()=>{const k=t.dataset.k,v=!this.s[k];t.classList.toggle('off',!v);this.set(k,v);});
    const sg=p.querySelector('.seg');if(sg){const mark=()=>sg.querySelectorAll('span').forEach(x=>x.classList.toggle('on',x.dataset.v===this.s.time));mark();sg.querySelectorAll('span').forEach(x=>x.onclick=()=>{this.set('time',x.dataset.v);mark();});}
    const rg=p.querySelector('input[type=range]');if(rg) rg.oninput=()=>this.set('nightLevel',rg.value/100);
    const vb=p.querySelector('#tn-setver');if(vb) vb.onclick=()=>{p.style.display='none';const v=document.getElementById('ver');if(v) v.click();};
  };
  this.showPage=show;show(null);
  g.onclick=()=>{const open=p.style.display==='block';if(!open) show(null);p.style.display=open?'none':'block';};   /* (opens on the main page) */

  /* the Version button lives in the menu now */
  const v=document.getElementById('ver');if(v) v.style.display='none';
};
/* night level from the time-of-day choice and the brightness slider */
TN.nightFrom=function(ntSun){
  const s=TN.settings;let nt=s.time==='day'?0:s.time==='night'?1:ntSun;
  const v=s.nightLevel==null?0.5:s.nightLevel;
  /* softer: night shades come in only part of the way; darker: an extra dark tint on the ground */
  const ntUse=v<0.5?nt*(0.55+0.9*v):nt;
  const extra=v>0.5?(v-0.5)*0.7*nt:0;
  return {nt:ntUse,extra:extra};
};
