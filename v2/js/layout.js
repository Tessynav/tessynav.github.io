/* MapKoon v2 — layout.js (v11 Nov 24: Rocco weather tip, smaller Set Work; v10: weather card (today / 7 days), music shrinks for Home/Work/weather; v9: weather without GPS; v8: weather no longer hidden by the music's empty space; v7: Home/Work/weather when idle, scrolling song names; v1, Nov 22 2026: the cleaner main screen, "style 1")
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
  '#tn-mus .t b,#tn-mus .t span{text-overflow:clip!important}#tn-mus i.mq{display:inline-block;font-style:normal;white-space:nowrap;will-change:transform;animation:tnmq 12s linear infinite}#tn-mus i.mq.r{animation-name:tnmqr;direction:rtl}'+
  '@keyframes tnmq{0%,12%{transform:translateX(0)}100%{transform:translateX(-50%)}}@keyframes tnmqr{0%,12%{transform:translateX(0)}100%{transform:translateX(50%)}}'+
  'body.tn-l1 #tn-mus::before{content:"";position:absolute;left:-12px;top:10px;bottom:10px;width:1px;background:var(--tn-line)}'+
  /* right side of the bar while navigating */
  '#tn-beta{position:absolute;right:226px;bottom:14px;height:60px;z-index:5;display:none;flex-direction:column;align-items:flex-end;justify-content:center;color:var(--tn-text);font:14px system-ui,sans-serif;max-width:260px;cursor:pointer}'+
  'body.tn-routing #tn-beta{display:flex}#tn-beta b{font-size:22px;line-height:1.1}#tn-beta .d{font-size:12px;color:var(--tn-joke);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px}'+
  '#tn-quick{position:absolute;right:18px;bottom:14px;height:60px;z-index:5;display:none;gap:10px;align-items:center;font:14px system-ui,sans-serif;color:var(--tn-text)}'+
  'body.tn-l1:not(.tn-routing):not(.tn-intro) #tn-quick{display:flex}#tn-quick>div{display:flex;align-items:center;gap:9px;height:52px;padding:0 16px 0 12px;border-radius:14px;background:rgba(127,140,160,.13);cursor:pointer;white-space:nowrap}'+
  '#tn-quick>div:active{transform:scale(.96)}#tn-quick b{display:block;font-size:15px;line-height:1.15}#tn-quick small{display:block;font-size:13px;font-weight:600;color:#16a34a}#tn-quick small.o{color:#ea8a0c}#tn-quick small.r{color:#dc2626}#tn-quick small.n{color:var(--tn-joke);font-weight:400}'+
  '#tn-quick .wx{cursor:pointer;padding:0 14px;font-size:22px;font-weight:600;gap:6px}#tn-quick .wx i{font-style:normal;font-size:24px}#tn-quick.c1 .wx,#tn-quick.c2 .wk,#tn-quick.c0 .unset{display:none}#tn-quick.c3{gap:6px}#tn-quick.c3>div{padding:0 10px;gap:6px}#tn-quick .unset{padding:0 12px 0 10px}#tn-quick .unset svg{opacity:.75}'+
  '#tn-wxc{position:absolute;right:18px;bottom:100px;width:min(460px,calc(100vw - 120px));z-index:30;background:'+P+';color:var(--tn-text);border-radius:20px;box-shadow:0 10px 34px rgba(0,0,0,.3);font:14px system-ui,sans-serif;padding:16px 18px 18px;display:none}'+
  '#tn-wxc.on{display:block}#tn-wxc .hd{display:flex;align-items:center;gap:12px}#tn-wxc .big{font-size:44px;font-weight:700;line-height:1}#tn-wxc .ic{font-size:44px}#tn-wxc .cd{flex:1}#tn-wxc .cd b{display:block;font-size:17px}#tn-wxc .cd small{color:var(--tn-joke)}'+
  '#tn-wxc .rk{display:flex;align-items:center;gap:10px;margin-top:12px;padding:8px 12px 8px 8px;border-radius:14px;background:rgba(245,158,11,.13);font-size:14px;line-height:1.3}#tn-wxc .rk svg{flex:none}'+
  '#tn-wxc .x{width:40px;height:40px;border-radius:50%;border:0;background:rgba(127,140,160,.15);color:inherit;font-size:20px;cursor:pointer}'+
  '#tn-wxc .tb{display:flex;gap:6px;margin:14px 0 10px;background:rgba(127,140,160,.13);border-radius:12px;padding:4px}#tn-wxc .tb button{flex:1;height:40px;border:0;border-radius:9px;background:none;color:inherit;font:600 15px system-ui,sans-serif;cursor:pointer}#tn-wxc .tb button.on{background:'+P+';box-shadow:0 1px 4px rgba(0,0,0,.15)}'+
  '#tn-wxc .hr{display:flex;gap:4px;overflow-x:auto;padding-bottom:4px}#tn-wxc .hr div{flex:none;width:58px;text-align:center;padding:8px 0;border-radius:12px}#tn-wxc .hr div.nw{background:rgba(96,165,250,.16)}#tn-wxc .hr i{display:block;font-style:normal;font-size:24px;margin:4px 0}#tn-wxc .hr b{font-size:16px}#tn-wxc .hr small,#tn-wxc .dy small{display:block;font-size:12px;color:#3b82f6;min-height:15px}'+
  '#tn-wxc .dy div{display:flex;align-items:center;gap:10px;height:44px;border-top:1px solid var(--tn-line)}#tn-wxc .dy div:first-child{border-top:0}#tn-wxc .dy .n{width:70px;font-weight:600}#tn-wxc .dy i{font-style:normal;font-size:22px;width:30px}#tn-wxc .dy small{width:40px}#tn-wxc .dy .lo{width:34px;text-align:right;color:var(--tn-joke)}#tn-wxc .dy .hi{width:34px;font-weight:700}'+
  '#tn-wxc .bar{flex:1;height:6px;border-radius:3px;background:rgba(127,140,160,.18);position:relative}#tn-wxc .bar span{position:absolute;top:0;bottom:0;border-radius:3px;background:linear-gradient(90deg,#60a5fa,#fbbf24,#f97316)}'+
  '#tn-beta::before{content:"";position:absolute;left:-14px;top:4px;bottom:4px;width:1px;background:var(--tn-line)}'+
  'body.tn-l1 #tn-alt{bottom:20px!important;top:auto!important;left:auto!important;padding:0 14px!important;height:48px;font-size:15px!important;background:var(--tn-btn)!important;box-shadow:none!important;border-radius:12px!important}'+
  'body.tn-l1 #tn-end{right:16px!important;bottom:20px!important;height:48px;padding:0 18px!important;font-size:15px!important;font-weight:700!important;background:rgba(198,40,40,.22)!important;box-shadow:none!important;border-radius:12px!important}'+
  /* the turn card */
  'body.tn-l1 #tn-bar{right:auto!important;width:min(430px,calc(100vw - 150px));box-sizing:border-box;border-radius:18px!important;background:'+P+'!important}'+
  'body.tn-l1 #tn-bar .etabox{display:none!important}'+
  'body.tn-l1 #tn-bar:not(.jvon) .a{width:64px!important;height:64px;border-radius:14px;background:#2f8cff;align-items:center;flex:none}'+
  /* (Nov 22: the junction drawing keeps its own colours and full size; the white-arrow style was turning it into a small
     black-and-white square) */
  'body.tn-l1 #tn-bar.jvon .a{width:96px!important;height:96px;border-radius:12px;flex:none}body.tn-l1 #tn-bar.jvon .a svg{width:100%;height:100%}'+
  'body.tn-l1 #tn-bar:not(.jvon) .a svg{width:40px;height:40px}body.tn-l1 #tn-bar:not(.jvon) .a svg *{stroke:#fff}'+
  'body.tn-l1 #tn-bar .dist{font-size:28px}body.tn-l1 #tn-bar .ins{font-size:16px;font-weight:600}'+
  'body.tn-l1.tn-routing #status{display:none!important}'+
  /* the right column */
  '#tn-rcol{position:absolute;right:16px;top:84px;width:68px;border-radius:18px;background:'+P+';z-index:4;display:none;box-shadow:0 2px 10px rgba(0,0,0,.25);pointer-events:none}'+
  'body.tn-intro #tn-rcol{opacity:0}'+
  'body.tn-l1 .tn-incol{right:22px!important;left:auto!important;bottom:auto!important;width:56px!important;height:56px!important;min-width:0!important;padding:0!important;border-radius:14px!important;background:transparent!important;box-shadow:none!important;border:0!important;margin:0!important;transform:none!important}'+
  'body.tn-l1 .tn-incol[data-lbl]{padding-bottom:12px!important;box-sizing:border-box}'+
  'body.tn-l1 .tn-incol[data-lbl]::after{content:attr(data-lbl);position:absolute;left:0;right:0;bottom:3px;text-align:center;font:600 10px system-ui,sans-serif;color:var(--tn-sub);text-shadow:none;letter-spacing:0}'+
  'body.tn-l1 #tn-fbbtn.tn-incol{font-size:10px!important;gap:0!important}'+
  'body.tn-l1 #tn-mute.tn-incol{color:var(--tn-text)!important}'+
  'body.tn-l1 #tn-compass.tn-incol b{bottom:2px!important;font-size:10px!important;color:var(--tn-sub)!important;text-shadow:none!important}body.tn-l1 #tn-compass.tn-incol svg{width:34px;height:34px;margin-top:-8px}'+
  'body.tn-l1 #tn-report.tn-incol{font-size:0!important;color:var(--tn-joke)!important;justify-content:center!important}body.tn-l1 #tn-report.tn-incol svg,body.tn-l1 #tn-report.tn-incol img{width:30px;height:30px}'+
  'body.tn-l1 :is(#tn-updbar,#tn-updpill){bottom:100px!important}'+
  'body.tn-l1t1 #tn-mus img,body.tn-l1t1 #tn-mus .art,body.tn-l1t1 #tn-mus .t{display:none!important}body.tn-l1t1 #tn-beta .d{display:none}'+
  'body.tn-l1t2 #tn-mus .prev,body.tn-l1t2 #tn-mus [aria-label=Previous]{display:none!important}'+
  'body.tn-l1 .maplibregl-ctrl-bottom-right,body.tn-l1 .maplibregl-ctrl-bottom-left{bottom:88px!important}'+   /* (the map credits stay visible, above the bar) */
  '}'+
  'body.tn-film.tnh-ui :is(#tn-bbar,#tn-rcol,#tn-beta){visibility:hidden!important}';
  document.head.appendChild(st);
  const mk=(id)=>{let e=document.getElementById(id);if(!e){e=document.createElement('div');e.id=id;document.body.appendChild(e);}return e;};
  this.bbar=mk('tn-bbar');this.rcol=mk('tn-rcol');this.beta=mk('tn-beta');this.quick=mk('tn-quick');this.quick.onclick=ev=>this.quickTap(ev);
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
  /* the speed limit right after the speed (76 km/h is wider than 0 km/h), the music after them */
  if(wide){const k1=window.TN_UIK||1,sp=document.getElementById('speed'),lim=document.getElementById('tn-limit'),mus=document.getElementById('tn-mus');
    let x=sp?sp.getBoundingClientRect().right/k1+10:112;if(lim){lim.style.setProperty('left',x+'px','important');if(getComputedStyle(lim).display!=='none') x=lim.getBoundingClientRect().right/k1;}
    if(mus) mus.style.setProperty('left',(x+26)+'px','important');}
  /* "Faster?" just left of "End" */
  if(wide){const en=document.getElementById('tn-end'),al=document.getElementById('tn-alt'),k0=window.TN_UIK||1;
    if(en&&al){const r=en.getBoundingClientRect(),on=getComputedStyle(en).display!=='none'&&r.width;al.style.setProperty('right',(on?(innerWidth-r.left)/k0+10:16)+'px','important');}}
  if(wide){let minL=innerWidth;for(const id of ['tn-alt','tn-end']){const b=document.getElementById(id);if(!b) continue;const cs=getComputedStyle(b);if(cs.display==='none') continue;const r=b.getBoundingClientRect();if(r.width&&r.top>innerHeight-120) minL=Math.min(minL,r.left);}
    const k=window.TN_UIK||1;this.beta.style.right=((innerWidth-minL)/k+18)+'px';
    const bl=this.beta.getBoundingClientRect(),mus=document.getElementById('tn-mus');
    if(mus) mus.style.setProperty('max-width',Math.max(160,((document.body.classList.contains('tn-routing')&&bl.width?bl.left:Math.min(innerWidth-24,(196+44+460)*k))/k)-196-44)+'px','important');}
  /* not enough room (the car's browser beside the Tesla's own screen): the album cover, then the "previous" button and the
     destination name are left out, so the music never covers the arrival time */
  if(wide){const mus=document.getElementById('tn-mus'),B=document.body;
    const over=()=>{if(!mus||!B.classList.contains('tn-routing')) return false;const a=mus.getBoundingClientRect(),b=this.beta.getBoundingClientRect();return a.width&&b.width&&a.right>b.left-8;};
    B.classList.remove('tn-l1t1','tn-l1t2');if(over()){B.classList.add('tn-l1t1');if(over()) B.classList.add('tn-l1t2');}}
  /* long song names: the name (and the artist) slowly scroll instead of being cut off; Arabic/Hebrew scroll the other way */
  try{document.querySelectorAll('#tn-mus .t b,#tn-mus .t span').forEach(el=>{
    const w=el.querySelector('i.mq');
    if(w){if(w.offsetWidth/2<=el.clientWidth-4){el.textContent=el.dataset.mq;el.style.direction='';delete el.dataset.mq;}return;}
    if(el.scrollWidth<=el.clientWidth+2) return;
    const t=el.textContent,rtl=/[\u0590-\u08ff]/.test(t),gap='\u00a0\u00a0\u00a0\u2022\u00a0\u00a0\u00a0';
    el.dataset.mq=t;el.textContent='';const i=document.createElement('i');i.className='mq'+(rtl?' r':'');el.style.direction=rtl?'rtl':'';i.textContent=t+gap+t+gap;el.appendChild(i);
    i.style.animationDuration=Math.max(8,i.offsetWidth/2/35)+'s';});}catch(e){}
  /* when not navigating: Home and Work (live drive time, green / orange / red with traffic) and the weather outside */
  if(wide&&!document.body.classList.contains('tn-routing')) try{this.quickFill();}catch(e){}
  let y=84+6,n=0;
  for(const [id,lbl] of TN.Layout.COL){const b=document.getElementById(id);if(!b) continue;
    const cs=getComputedStyle(b),shown=cs.display!=='none'&&cs.visibility!=='hidden'&&!b.hidden;
    if(!wide){if(b.classList.contains('tn-incol')){b.classList.remove('tn-incol');b.style.top='';b.removeAttribute('data-lbl');}continue;}
    if(!shown){continue;}
    b.classList.add('tn-incol');if(lbl) b.setAttribute('data-lbl',lbl);b.style.top=y+'px';y+=60;n++;}
  this.rcol.style.display=wide&&n?'block':'none';this.rcol.style.height=(n*60+12)+'px';
  this.bbar.style.display=wide?'block':'none';
};
TN.Layout.prototype.quickFill=function(){
  const nv=TN.nav,tr=x=>TN.tr?TN.tr(x):x;let h='';
  for(const k of ['home','work']){const pl=nv&&nv.places&&nv.places[k],col=k==='home'?'#60a5fa':'#f59e0b',lab=tr(k==='home'?'Home':'Work');
    if(pl){const m=nv.etaFor(k),c=nv.etaC&&nv.etaC[k],r=c&&c.ratio||1;
      h+='<div class="'+(k==='home'?'hm':'wk')+'" data-go="'+k+'">'+TN.ICON(k,24,col)+'<span><b>'+lab+'</b><small class="'+(m?(r>1.5?'r':r>1.2?'o':''):'n')+'">'+(m?m+' min':'\u2026')+'</small></span></div>';}
    else if(nv) h+='<div class="unset '+(k==='home'?'hm':'wk')+'" data-set="'+k+'">'+TN.ICON(k,24,col)+'<span><b>'+lab+'</b><small class="n">+ '+tr('Set')+'</small></span></div>';}
  const w=TN.wx;
  /* no temperature yet (no GPS at start, underground): ask using the same position Home/Work use, at most once a minute */
  if(w&&w.temp==null&&nv&&nv.here&&w.check&&!w.test&&Date.now()-(this.wxT||0)>60000){this.wxT=Date.now();try{const p=nv.here();if(p&&p[1]) w.check(p[1],p[0]);}catch(e){}}
  if(w&&w.temp!=null){const hr=new Date().getHours(),nt=hr<7||hr>=17,k=w.kind,
      ic=k==='snow'?'\u2744\ufe0f':k==='rain'?'\ud83c\udf27\ufe0f':k==='fog'?'\ud83c\udf2b\ufe0f':k==='overcast'?'\u2601\ufe0f':k==='cloudy'?(nt?'\u2601\ufe0f':'\u26c5'):(nt?'\ud83c\udf19':'\u2600\ufe0f');
    h+='<div class="wx"><i>'+ic+'</i>'+Math.round(w.temp)+'\u00b0</div>';}
  if(h!==this.lastQ){this.lastQ=h;this.quick.innerHTML=h;}
  /* too narrow: the weather goes first, then Work; never over the music */
  const q=this.quick,mus=document.getElementById('tn-mus'),B0=document.body;q.classList.remove('c0','c1','c2','c3');
  /* the buttons come first: the music gets narrower (its title scrolls) to leave them room, down to a minimum */
  if(mus&&!B0.classList.contains('tn-routing')){const k=window.TN_UIK||1,ml=mus.getBoundingClientRect().left,ql=q.getBoundingClientRect().left;
    if(ml&&ql) mus.style.setProperty('max-width',Math.max(300,(ql-ml)/k-22)+'px','important');}
  const musR=()=>{let r=0;if(mus) for(const c of mus.children){const b=c.getBoundingClientRect();if(b.width&&getComputedStyle(c).display!=='none') r=Math.max(r,b.right);}return r;};
  const hit=()=>{const r=musR(),b=q.getBoundingClientRect();return r&&b.width&&r>b.left-14;};
  /* not enough room: first a "Tap to set" button, then tighter buttons, then Work, then the weather */
  if(hit()) q.classList.add('c3');if(hit()) q.classList.add('c0');if(hit()) q.classList.add('c2');if(hit()) q.classList.add('c1');
};
TN.Layout.prototype.quickTap=function(ev){
  if(ev.target.closest('.wx')){this.wxCard();return;}
  const d=ev.target.closest('[data-go],[data-set]'),nv=TN.nav;if(!d||!nv) return;
  if(d.dataset.set){if(nv.openSearch) nv.openSearch();nv.startSetting(d.dataset.set);return;}
  const pl=nv.places[d.dataset.go];if(pl) nv.pick(Object.assign({},pl));
};
/* the weather card: now, today hour by hour, and the next 7 days (Open-Meteo, the same free service as the map's weather) */
TN.Layout.wxIcon=function(c,night){c=+c;return c>=95?'⛈️':(c>=71&&c<=77)||c===85||c===86?'❄️':(c>=51&&c<=67)||(c>=80&&c<=82)?'🌧️':c===45||c===48?'🌫️':c===3?'☁️':c===2||c===1?(night?'☁️':'⛅'):(night?'🌙':'☀️');};
TN.Layout.wxName=function(c){c=+c;return c>=95?'Thunderstorm':(c>=71&&c<=77)||c===85||c===86?'Snow':(c>=51&&c<=57)?'Drizzle':(c>=61&&c<=67)||(c>=80&&c<=82)?'Rain':c===45||c===48?'Fog':c===3?'Overcast':c===2?'Partly cloudy':c===1?'Mostly clear':'Clear';};
TN.Layout.prototype.wxCard=function(){
  const tr=x=>TN.tr?TN.tr(x):x,fr=tr('Home')!=='Home',loc=fr?'fr-CA':'en-CA';
  let c=document.getElementById('tn-wxc');
  if(!c){c=document.createElement('div');c.id='tn-wxc';document.body.appendChild(c);
    c.onclick=ev=>{ev.stopPropagation();const t=ev.target.closest('[data-t]');if(t){this.wxTab=t.dataset.t;this.wxDraw();}if(ev.target.closest('.x')) c.classList.remove('on');};
    document.addEventListener('pointerdown',ev=>{if(c.classList.contains('on')&&!c.contains(ev.target)&&!ev.target.closest('#tn-quick .wx')) c.classList.remove('on');},true);}
  if(c.classList.contains('on')){c.classList.remove('on');return;}
  c.classList.add('on');this.wxTab=this.wxTab||'h';
  if(this.wxData&&Date.now()-this.wxData.t<900000){this.wxDraw();return;}
  c.innerHTML='<div class="hd"><div class="cd"><b>'+tr('Loading')+'…</b></div><button class="x">✕</button></div>';
  let p=null;try{p=TN.nav&&TN.nav.here();}catch(e){}if(!p) return;
  fetch('https://api.open-meteo.com/v1/forecast?latitude='+p[1].toFixed(3)+'&longitude='+p[0].toFixed(3)+'&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day&hourly=temperature_2m,weather_code,precipitation_probability,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=7&timezone=auto')
    .then(r=>r.ok?r.json():null).then(j=>{if(!j) throw 0;this.wxData={t:Date.now(),j:j};if(c.classList.contains('on')) this.wxDraw();})
    .catch(()=>{c.innerHTML='<div class="hd"><div class="cd"><b>'+tr('Weather unavailable')+'</b></div><button class="x">✕</button></div>';});
};
/* Rocco's one-line tip, only when the weather changes how you drive (otherwise he stays quiet) */
TN.Layout.wxTip=function(j,fr){
  const cu=j.current||{},H=j.hourly||{},T=H.time||[],now=(cu.time||'').slice(0,13);let i0=Math.max(0,T.findIndex(t=>t.slice(0,13)===now));
  const snowC=c=>(c>=71&&c<=77)||c===85||c===86,wetC=c=>(c>=51&&c<=67)||(c>=80&&c<=82)||c>=95,hh=i=>Math.round(+T[i].slice(11,13))+(fr?' h':':00');
  const t=cu.temperature_2m,c=+cu.weather_code;
  if(snowC(c)) return fr?'Il neige : garde tes distances et freine en douceur.':'It’s snowing: keep your distance and brake gently.';
  if(wetC(c)&&t<=1) return fr?'Pluie et 0° : routes glissantes possibles, doucement sur les freins.':'Rain near 0°: roads may be icy, easy on the brakes.';
  for(let i=i0+1;i<Math.min(T.length,i0+12);i++){if(snowC(H.weather_code[i])) return fr?'Neige vers '+hh(i)+' : pars un peu plus tôt.':'Snow around '+hh(i)+': maybe leave a little earlier.';}
  if(c===45||c===48) return fr?'Brouillard : allume tes feux de croisement.':'Foggy: low beams on.';
  if(wetC(c)) return fr?'Il pleut : la route est mouillée, garde de l’espace.':'It’s raining: wet roads, leave some extra space.';
  for(let i=i0+1;i<Math.min(T.length,i0+4);i++){if(wetC(H.weather_code[i])||(H.precipitation_probability&&H.precipitation_probability[i]>=60)) return fr?'Pluie vers '+hh(i)+' : essuie-glaces prêts !':'Rain around '+hh(i)+': wipers ready!';}
  if(t<=-15) return fr?'Très froid : ton autonomie va baisser, pense à préchauffer la batterie.':'Very cold: your range will drop, precondition the battery.';
  return '';
};
TN.Layout.prototype.wxDraw=function(){
  const c=document.getElementById('tn-wxc'),j=this.wxData&&this.wxData.j;if(!c||!j) return;
  const tr=x=>TN.tr?TN.tr(x):x,fr=tr('Home')!=='Home',loc=fr?'fr-CA':'en-CA',cu=j.current||{},L=TN.Layout,R=Math.round;
  let h='<div class="hd"><span class="ic">'+L.wxIcon(cu.weather_code,!cu.is_day)+'</span><span class="big">'+R(cu.temperature_2m)+'°</span><div class="cd"><b>'+tr(L.wxName(cu.weather_code))+'</b><small>'+tr('Feels like')+' '+R(cu.apparent_temperature)+'° · '+tr('Wind')+' '+R(cu.wind_speed_10m)+' km/h</small></div><button class="x">✕</button></div>';
  {const tip=L.wxTip(j,fr);if(tip) h+='<div class="rk">'+(TN.roccoSVG?TN.roccoSVG(38):'')+'<span>'+tip+'</span></div>';}
  h+='<div class="tb"><button data-t="h" class="'+(this.wxTab==='h'?'on':'')+'">'+tr('Today')+'</button><button data-t="d" class="'+(this.wxTab==='d'?'on':'')+'">'+tr('7 days')+'</button></div>';
  if(this.wxTab==='h'){const H=j.hourly,now=(cu.time||'').slice(0,13);let i=Math.max(0,H.time.findIndex(t=>t.slice(0,13)===now));h+='<div class="hr">';
    for(let n=0;n<24&&i<H.time.length;n++,i++){const pp=H.precipitation_probability?H.precipitation_probability[i]:0;
      h+='<div class="'+(n?'':'nw')+'">'+(n?R(+H.time[i].slice(11,13))+(fr?' h':''):tr('Now'))+'<i>'+L.wxIcon(H.weather_code[i],!H.is_day[i])+'</i><b>'+R(H.temperature_2m[i])+'°</b><small>'+(pp>=20?pp+'%':'')+'</small></div>';}
    h+='</div>';}
  else{const D=j.daily,lo=Math.min(...D.temperature_2m_min),hi=Math.max(...D.temperature_2m_max),sp=Math.max(1,hi-lo);h+='<div class="dy">';
    D.time.forEach((t,i)=>{const nm=i?new Date(t+'T12:00').toLocaleDateString(loc,{weekday:'short'}):tr('Today'),a=D.temperature_2m_min[i],b=D.temperature_2m_max[i],pp=D.precipitation_probability_max?D.precipitation_probability_max[i]:0;
      h+='<div><span class="n">'+nm+'</span><i>'+L.wxIcon(D.weather_code[i],false)+'</i><small>'+(pp>=20?pp+'%':'')+'</small><span class="lo">'+R(a)+'°</span><span class="bar"><span style="left:'+((a-lo)/sp*100)+'%;right:'+((hi-b)/sp*100)+'%"></span></span><span class="hi">'+R(b)+'°</span></div>';});
    h+='</div>';}
  c.innerHTML=h;
};
/* starts once the app has set itself up (its buttons exist) */
(function(){if(typeof document==='undefined') return;let n=0;const go=()=>{if(document.body&&document.body.classList.contains('tn-app')){if(!TN.layout) TN.layout=new TN.Layout();return;}if(++n<200) setTimeout(go,150);};go();})();
