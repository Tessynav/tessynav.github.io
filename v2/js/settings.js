/* TessyNav v2 — settings.js (v2: test update for the update dot)
   The settings menu (gear button): switch looks on and off, choose the time of day (auto, day, night), set how dark
   night gets, the opening animation, the Record button, and the version/update check.
   Choices are remembered in this browser and apply instantly. Address switches like ?trees=0 still work. */
var TN=globalThis.TN||{};globalThis.TN=TN;

TN.SETDEF={trees:true,leaves:true,water:true,buildings:true,lights:true,rem:true,cut:true,time:'auto',nightLevel:0.5,intro:true,record:true};
TN.loadSettings=function(){let s={};try{s=JSON.parse(localStorage.getItem('tn2_settings')||'{}')||{};}catch(e){}return Object.assign({},TN.SETDEF,s);};
TN.settings=TN.loadSettings();

TN.Settings=function(m){
  this.m=m;this.s=TN.settings;this.panel=null;
};
TN.Settings.prototype.save=function(){try{localStorage.setItem('tn2_settings',JSON.stringify(this.s));}catch(e){}};
TN.Settings.prototype.set=function(k,v){this.s[k]=v;TN.settings=this.s;this.save();this.apply(k);};
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
    if(k==='record'){const b=document.getElementById('rec');if(b) b.style.display=s.record?'':'none';}
    if(k==='time'||k==='nightLevel'){if(m.night) m.night();}
  }catch(e){}
};
TN.Settings.prototype.applyAll=function(){for(const k in TN.SETDEF) this.apply(k);};
/* the gear button and the panel */
TN.Settings.prototype.build=function(){
  const st=document.createElement('style');
  st.textContent='#tn-gear{right:16px;top:16px;width:50px;height:50px;padding:0;font-size:26px;display:flex;align-items:center;justify-content:center}'+
  '#tn-set{position:absolute;right:16px;top:72px;width:310px;max-height:calc(100% - 140px);overflow:auto;background:rgba(10,18,32,.95);border-radius:14px;padding:8px 16px 12px;color:#e8f1fa;font:15px sans-serif;z-index:7;display:none}'+
  '#tn-set .h{font-size:11px;letter-spacing:.07em;color:#9fb3c8;margin:12px 0 2px}#tn-set .r{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.08)}'+
  '#tn-set .sub{font-size:12px;color:#9fb3c8}#tn-set .t{width:46px;height:28px;border-radius:14px;background:#1fa596;position:relative;flex-shrink:0;cursor:pointer}'+
  '#tn-set .t:after{content:"";position:absolute;top:4px;left:22px;width:20px;height:20px;border-radius:50%;background:#fff;transition:left .2s}#tn-set .t.off{background:#4a5260}#tn-set .t.off:after{left:4px}'+
  '#tn-set .seg{display:flex;border-radius:8px;overflow:hidden;border:1px solid #4a5260}#tn-set .seg span{padding:6px 11px;font-size:13px;cursor:pointer}#tn-set .seg span.on{background:#1fa596}'+
  '#tn-set input[type=range]{width:100%;accent-color:#1fa596}#tn-set .lbls{display:flex;justify-content:space-between;font-size:11px;color:#9fb3c8}#tn-set .lnk{cursor:pointer;color:#7fd3c8}';
  document.head.appendChild(st);
  const g=document.createElement('button');g.id='tn-gear';g.className='hud';g.setAttribute('aria-label','Settings');g.textContent='\u2699';document.body.appendChild(g);
  const p=document.createElement('div');p.id='tn-set';document.body.appendChild(p);this.panel=p;
  const tog=(k,label,sub)=>'<div class="r"><div>'+label+(sub?'<div class="sub">'+sub+'</div>':'')+'</div><div class="t'+(this.s[k]?'':' off')+'" data-k="'+k+'"></div></div>';
  p.innerHTML='<div class="h">LOOK</div>'+tog('trees','Trees')+tog('leaves','Falling leaves / snow')+tog('water','Animated water')+tog('buildings','Detailed buildings')+
    tog('lights','Street light glow','At night')+tog('rem','REM trains and labels')+tog('cut','See-through around Tessy','Fade what hides the car')+
    '<div class="h">TIME OF DAY</div><div class="r"><div>Light</div><div class="seg" data-k="time"><span data-v="auto">Auto</span><span data-v="day">Day</span><span data-v="night">Night</span></div></div>'+
    '<div class="r" style="display:block"><div>Night brightness</div><input type="range" min="0" max="100" step="1" data-k="nightLevel" value="'+Math.round(this.s.nightLevel*100)+'"><div class="lbls"><span>Softer</span><span>Darker</span></div></div>'+
    '<div class="h">APP</div>'+tog('intro','Opening animation')+tog('record','Record button','For test drives')+
    '<div class="r"><div>Version and updates</div><div class="lnk" id="tn-setver">Check \u203a</div></div>';
  const seg=p.querySelector('.seg');const mark=()=>seg.querySelectorAll('span').forEach(x=>x.classList.toggle('on',x.dataset.v===this.s.time));mark();
  seg.querySelectorAll('span').forEach(x=>x.onclick=()=>{this.set('time',x.dataset.v);mark();});
  p.querySelectorAll('.t').forEach(t=>t.onclick=()=>{const k=t.dataset.k,v=!this.s[k];t.classList.toggle('off',!v);this.set(k,v);});
  const rg=p.querySelector('input[type=range]');rg.oninput=()=>this.set('nightLevel',rg.value/100);
  p.querySelector('#tn-setver').onclick=()=>{p.style.display='none';const v=document.getElementById('ver');if(v) v.click();};
  g.onclick=()=>{p.style.display=p.style.display==='block'?'none':'block';};
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
