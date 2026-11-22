/* MapKoon v2 — layout.js (v1, Nov 22 2026: the cleaner main screen, "style 1")
   Everything you need while driving in clear places, in the same look as the settings:
   - one bar across the bottom: your speed and the limit on the left, the music in the middle, and while navigating
     the arrival time, "Faster?" and "End" on the right;
   - the next turn as a compact card in the top left (no longer a full-width banner);
   - the map buttons (3D, compass, my position, Report, mute) in one neat column on the right, under Rocco.
   Only the positions and the look change: every button works as before. Car and computer screens only (760 px and
   wider); phones keep their layout. ?layout=classic, or Settings → Map and view → Classic layout, brings the old one back. */
var TN=globalThis.TN||{};globalThis.TN=TN;

TN.Layout=function(){
  this.on=!(typeof location!=='undefined'&&/[?&]layout=classic/.test(location.search))&&!(TN.settings&&TN.settings.layout==='classic');
  if(!this.on||typeof document==='undefined') return;
  document.body.classList.add('tn-l1');
  const st=document.createElement('style');st.id='tn-l1css';
  const W='@media (min-width:760px){',P='rgb(var(--tn-panel-rgb) / .96)';
  st.textContent=W+
  /* the bottom bar */
  '#tn-bbar{position:absolute;left:0;right:0;bottom:0;height:88px;background:'+P+';z-index:4;box-shadow:0 -2px 14px rgba(0,0,0,.22);pointer-events:none}'+
  'body.tn-intro #tn-bbar{opacity:0}'+
  'body.tn-l1 #speed{left:16px!important;bottom:14px!important;background:transparent!important;box-shadow:none!important;border:0!important;padding:8px 6px!important;min-width:86px;text-align:left}'+
  'body.tn-l1 #tn-limit{left:112px!important;bottom:13px!important;width:50px!important;height:62px!important;box-shadow:none!important}'+
  'body.tn-l1 #tn-mus{left:196px!important;bottom:12px!important;background:transparent!important;box-shadow:none!important;border:0!important;max-width:min(560px,calc(100vw - 260px))!important}'+
  'body.tn-l1.tn-routing #tn-mus{max-width:calc(100vw - 640px)!important}'+
  'body.tn-l1 #tn-mus::before{content:"";position:absolute;left:-12px;top:10px;bottom:10px;width:1px;background:var(--tn-line)}'+
  /* right side of the bar while navigating */
  '#tn-beta{position:absolute;right:226px;bottom:14px;height:60px;z-index:5;display:none;flex-direction:column;align-items:flex-end;justify-content:center;color:var(--tn-text);font:14px system-ui,sans-serif;max-width:260px;cursor:pointer}'+
  'body.tn-routing #tn-beta{display:flex}#tn-beta b{font-size:22px;line-height:1.1}#tn-beta .d{font-size:12px;color:var(--tn-joke);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px}'+
  '#tn-beta::before{content:"";position:absolute;left:-14px;top:4px;bottom:4px;width:1px;background:var(--tn-line)}'+
  'body.tn-l1 #tn-alt{bottom:20px!important;top:auto!important;left:auto!important;padding:0 14px!important;height:48px;font-size:15px!important;background:var(--tn-btn)!important;box-shadow:none!important;border-radius:12px!important}'+
  'body.tn-l1 #tn-end{right:16px!important;bottom:20px!important;height:48px;padding:0 18px!important;font-size:15px!important;font-weight:700!important;background:rgba(198,40,40,.22)!important;box-shadow:none!important;border-radius:12px!important}'+
  /* the turn card */
  'body.tn-l1 #tn-bar{right:auto!important;width:min(460px,calc(100vw - 150px));box-sizing:border-box;border-radius:18px!important;background:'+P+'!important}'+
  'body.tn-l1 #tn-bar .etabox{display:none!important}'+
  'body.tn-l1 #tn-bar .a{width:64px!important;height:64px;border-radius:14px;background:#2f8cff;align-items:center;flex:none}body.tn-l1 #tn-bar.jvon .a{background:none;width:116px!important;height:116px}'+
  'body.tn-l1 #tn-bar .a svg{width:40px;height:40px}body.tn-l1 #tn-bar .a svg *{stroke:#fff}'+
  'body.tn-l1 #tn-bar .dist{font-size:28px}body.tn-l1 #tn-bar .ins{font-size:16px;font-weight:600}'+
  'body.tn-l1.tn-routing #status{display:none!important}'+
  /* the right column */
  '#tn-rcol{position:absolute;right:16px;top:84px;width:68px;border-radius:18px;background:'+P+';z-index:4;display:none;box-shadow:0 2px 10px rgba(0,0,0,.25);pointer-events:none}'+
  'body.tn-intro #tn-rcol{opacity:0}'+
  'body.tn-l1 .tn-incol{right:22px!important;left:auto!important;bottom:auto!important;width:56px!important;height:56px!important;min-width:0!important;padding:0!important;border-radius:14px!important;background:transparent!important;box-shadow:none!important;border:0!important;margin:0!important;transform:none!important}'+
  'body.tn-l1 .tn-incol[data-lbl]{padding-bottom:12px!important;box-sizing:border-box}'+
  'body.tn-l1 .tn-incol[data-lbl]::after{content:attr(data-lbl);position:absolute;left:0;right:0;bottom:3px;text-align:center;font:600 10px system-ui,sans-serif;color:var(--tn-sub);text-shadow:none;letter-spacing:0}'+
  'body.tn-l1 #tn-fbbtn.tn-incol{font-size:10px!important;gap:0!important}'+
  'body.tn-l1 #tn-compass.tn-incol b{bottom:2px!important;font-size:10px!important;color:var(--tn-sub)!important;text-shadow:none!important}body.tn-l1 #tn-compass.tn-incol svg{width:34px;height:34px;margin-top:-8px}'+
  'body.tn-l1 #tn-report.tn-incol{font-size:0!important;color:var(--tn-joke)!important;justify-content:center!important}body.tn-l1 #tn-report.tn-incol svg,body.tn-l1 #tn-report.tn-incol img{width:30px;height:30px}'+
  'body.tn-l1 :is(#tn-updbar,#tn-updpill){bottom:100px!important}'+
  'body.tn-l1 .maplibregl-ctrl-bottom-right,body.tn-l1 .maplibregl-ctrl-bottom-left{bottom:88px!important}'+   /* (the map credits stay visible, above the bar) */
  '}'+
  'body.tn-film.tnh-ui :is(#tn-bbar,#tn-rcol,#tn-beta){visibility:hidden!important}';
  document.head.appendChild(st);
  const mk=(id)=>{let e=document.getElementById(id);if(!e){e=document.createElement('div');e.id=id;document.body.appendChild(e);}return e;};
  this.bbar=mk('tn-bbar');this.rcol=mk('tn-rcol');this.beta=mk('tn-beta');
  this.beta.onclick=()=>{const d=document.querySelector('#tn-bar .dst');if(d) d.click();};   /* (the destination: opens the route overview, as before) */
  this.tick();setInterval(()=>this.tick(),700);
};
/* the right column: the map buttons that are showing right now, one under the other */
TN.Layout.COL=[['tn-viewbtn',''],['tn-compass',''],['btn','Me'],['tn-mute',''],['tn-report','Alert'],['tn-fbbtn','']];
TN.Layout.prototype.tick=function(){
  if(!this.on) return;
  const wide=innerWidth>=760;
  /* the arrival time, copied from the turn banner (which keeps doing the work) */
  try{const e=document.querySelector('#tn-bar .eta'),d=document.querySelector('#tn-bar .dst');
    const h=(e?e.innerHTML:'')+(d&&d.textContent?'<div class="d">'+TN.esc(d.textContent)+'</div>':'');if(h!==this.lastEta){this.lastEta=h;this.beta.innerHTML=h;}}catch(e){}
  /* the right end of the bar: the arrival time sits just left of "Faster?" and "End", the music ends before it */
  /* "Faster?" just left of "End" */
  if(wide){const en=document.getElementById('tn-end'),al=document.getElementById('tn-alt'),k0=window.TN_UIK||1;
    if(en&&al){const r=en.getBoundingClientRect(),on=getComputedStyle(en).display!=='none'&&r.width;al.style.setProperty('right',(on?(innerWidth-r.left)/k0+10:16)+'px','important');}}
  if(wide){let minL=innerWidth;for(const id of ['tn-alt','tn-end']){const b=document.getElementById(id);if(!b) continue;const cs=getComputedStyle(b);if(cs.display==='none') continue;const r=b.getBoundingClientRect();if(r.width&&r.top>innerHeight-120) minL=Math.min(minL,r.left);}
    const k=window.TN_UIK||1;this.beta.style.right=((innerWidth-minL)/k+18)+'px';
    const bl=this.beta.getBoundingClientRect(),mus=document.getElementById('tn-mus');
    if(mus) mus.style.setProperty('max-width',Math.max(160,((document.body.classList.contains('tn-routing')&&bl.width?bl.left:innerWidth-24)/k)-196-44)+'px','important');}
  let y=84+6,n=0;
  for(const [id,lbl] of TN.Layout.COL){const b=document.getElementById(id);if(!b) continue;
    const cs=getComputedStyle(b),shown=cs.display!=='none'&&cs.visibility!=='hidden'&&!b.hidden;
    if(!wide){if(b.classList.contains('tn-incol')){b.classList.remove('tn-incol');b.style.top='';b.removeAttribute('data-lbl');}continue;}
    if(!shown){continue;}
    b.classList.add('tn-incol');if(lbl) b.setAttribute('data-lbl',lbl);b.style.top=y+'px';y+=60;n++;}
  this.rcol.style.display=wide&&n?'block':'none';this.rcol.style.height=(n*60+12)+'px';
  this.bbar.style.display=wide?'block':'none';
};
/* starts once the app has set itself up (its buttons exist) */
(function(){if(typeof document==='undefined') return;let n=0;const go=()=>{if(document.body&&document.body.classList.contains('tn-app')){if(!TN.layout) TN.layout=new TN.Layout();return;}if(++n<200) setTimeout(go,150);};go();})();
