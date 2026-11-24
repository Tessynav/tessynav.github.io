/* MapKoon v2 — layout.js (v9 Nov 24: weather without GPS; v8: weather no longer hidden by the music's empty space; v7: Home/Work/weather when idle, scrolling song names; v1, Nov 22 2026: the cleaner main screen, "style 1")
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
  '#tn-quick .wx{cursor:default;padding:0 14px;font-size:22px;font-weight:600;gap:6px}#tn-quick .wx i{font-style:normal;font-size:24px}#tn-quick.c1 .wx,#tn-quick.c2 .wk,#tn-quick.c0 .unset{display:none}#tn-quick.c3{gap:6px}#tn-quick.c3>div{padding:0 10px;gap:6px}'+
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
    else if(nv) h+='<div class="unset '+(k==='home'?'hm':'wk')+'" data-set="'+k+'">'+TN.ICON(k,24,col)+'<span><b>'+lab+'</b><small class="n">'+tr('Tap to set')+'</small></span></div>';}
  const w=TN.wx;
  /* no temperature yet (no GPS at start, underground): ask using the same position Home/Work use, at most once a minute */
  if(w&&w.temp==null&&nv&&nv.here&&w.check&&!w.test&&Date.now()-(this.wxT||0)>60000){this.wxT=Date.now();try{const p=nv.here();if(p&&p[1]) w.check(p[1],p[0]);}catch(e){}}
  if(w&&w.temp!=null){const hr=new Date().getHours(),nt=hr<7||hr>=17,k=w.kind,
      ic=k==='snow'?'\u2744\ufe0f':k==='rain'?'\ud83c\udf27\ufe0f':k==='fog'?'\ud83c\udf2b\ufe0f':k==='overcast'?'\u2601\ufe0f':k==='cloudy'?(nt?'\u2601\ufe0f':'\u26c5'):(nt?'\ud83c\udf19':'\u2600\ufe0f');
    h+='<div class="wx"><i>'+ic+'</i>'+Math.round(w.temp)+'\u00b0</div>';}
  if(h!==this.lastQ){this.lastQ=h;this.quick.innerHTML=h;}
  /* too narrow: the weather goes first, then Work; never over the music */
  const q=this.quick,mus=document.getElementById('tn-mus');q.classList.remove('c1','c2');
  const musR=()=>{let r=0;if(mus) for(const c of mus.children){const b=c.getBoundingClientRect();if(b.width&&getComputedStyle(c).display!=='none') r=Math.max(r,b.right);}return r;};
  const hit=()=>{const r=musR(),b=q.getBoundingClientRect();return r&&b.width&&r>b.left-14;};
  /* not enough room: first a "Tap to set" button, then tighter buttons, then Work, then the weather */
  for(const c of ['c0','c3']) q.classList.remove(c);
  if(hit()) q.classList.add('c0');if(hit()) q.classList.add('c3');if(hit()) q.classList.add('c2');if(hit()) q.classList.add('c1');
};
TN.Layout.prototype.quickTap=function(ev){
  const d=ev.target.closest('[data-go],[data-set]'),nv=TN.nav;if(!d||!nv) return;
  if(d.dataset.set){if(nv.openSearch) nv.openSearch();nv.startSetting(d.dataset.set);return;}
  const pl=nv.places[d.dataset.go];if(pl) nv.pick(Object.assign({},pl));
};
/* starts once the app has set itself up (its buttons exist) */
(function(){if(typeof document==='undefined') return;let n=0;const go=()=>{if(document.body&&document.body.classList.contains('tn-app')){if(!TN.layout) TN.layout=new TN.Layout();return;}if(++n<200) setTimeout(go,150);};go();})();
