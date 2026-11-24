/* MapKoon v2 — layout.js (v16 Nov 24: weather inside the arrival box while navigating; v15: weather while navigating (button, Arrival tab, Rocco rain/snow warnings); v14: 7-day bars coloured by the real temperature; v13: coloured weather icons; v12: tighter fit in the normal (not full-screen) view; v11: Rocco weather tip, smaller Set Work; v10: weather card (today / 7 days), music shrinks for Home/Work/weather; v9: weather without GPS; v8: weather no longer hidden by the music's empty space; v7: Home/Work/weather when idle, scrolling song names; v1, Nov 22 2026: the cleaner main screen, "style 1")
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
  '#tn-quick .wx{cursor:pointer;padding:0 14px;font-size:22px;font-weight:600;gap:6px}#tn-quick .wx i{display:flex}#tn-quick.c1 .wx,#tn-quick.c2 .wk,#tn-quick.c0 .unset{display:none}#tn-quick.c3{gap:6px}#tn-quick.c3>div{padding:0 10px;gap:6px}#tn-quick.c4 b{display:none}#tn-quick.c4 small{font-size:15px}#tn-quick.c4 .unset b{display:block}#tn-quick .unset{padding:0 12px 0 10px}#tn-quick .unset svg{opacity:.75}'+
  '#tn-beta .tw{display:flex;align-items:center;gap:10px}#tn-beta .wxi{display:flex;align-items:center;gap:4px;font-size:17px;font-weight:600;padding:2px 8px 2px 4px;border-radius:10px;background:rgba(127,140,160,.13);cursor:pointer}#tn-beta .wxi.w{box-shadow:inset 0 0 0 2px #f59e0b}'+
  '#tn-wxr{position:absolute;bottom:18px;height:52px;z-index:5;display:none;align-items:center;gap:6px;padding:0 12px 0 10px;border-radius:14px;background:rgba(127,140,160,.13);font:600 20px system-ui,sans-serif;color:var(--tn-text);cursor:pointer;white-space:nowrap}'+
  'body.tn-l1.tn-routing:not(.tn-intro) #tn-wxr.ok{display:flex}#tn-wxr.w{box-shadow:inset 0 0 0 2px #f59e0b}'+
  '#tn-wxa{position:absolute;left:50%;top:150px;transform:translate(-50%,-8px);z-index:40;display:flex;align-items:center;gap:12px;max-width:min(560px,calc(100vw - 140px));padding:12px 18px 12px 12px;border-radius:18px;background:'+P+';color:var(--tn-text);box-shadow:0 8px 28px rgba(0,0,0,.28);font:15px system-ui,sans-serif;line-height:1.3;opacity:0;transition:opacity .35s,transform .35s;pointer-events:none}'+
  '#tn-wxa.on{opacity:1;transform:translate(-50%,0);pointer-events:auto}#tn-wxa b{display:block;font-size:16px}#tn-wxa svg{flex:none}'+
  '#tn-wxc .ar{display:flex;align-items:center;gap:14px;padding:6px 4px}#tn-wxc .ar .t{font-size:40px;font-weight:700}#tn-wxc .ar b{display:block;font-size:17px}#tn-wxc .ar small{color:var(--tn-joke)}#tn-wxc .ar3{display:flex;gap:6px;margin-top:10px}#tn-wxc .ar3 div{flex:1;text-align:center;padding:8px 0;border-radius:12px;background:rgba(127,140,160,.1)}#tn-wxc .ar3 i{display:flex;justify-content:center;margin:4px 0}#tn-wxc .ar3 small{display:block;font-size:12px;color:#3b82f6;min-height:15px}'+
  '#tn-wxc{position:absolute;right:18px;bottom:100px;width:min(460px,calc(100vw - 120px));z-index:30;background:'+P+';color:var(--tn-text);border-radius:20px;box-shadow:0 10px 34px rgba(0,0,0,.3);font:14px system-ui,sans-serif;padding:16px 18px 18px;display:none}'+
  '#tn-wxc.on{display:block}#tn-wxc .hd{display:flex;align-items:center;gap:12px}#tn-wxc .big{font-size:44px;font-weight:700;line-height:1}#tn-wxc .ic{font-size:44px}#tn-wxc .cd{flex:1}#tn-wxc .cd b{display:block;font-size:17px}#tn-wxc .cd small{color:var(--tn-joke)}'+
  '#tn-wxc .rk{display:flex;align-items:center;gap:10px;margin-top:12px;padding:8px 12px 8px 8px;border-radius:14px;background:rgba(245,158,11,.13);font-size:14px;line-height:1.3}#tn-wxc .rk svg{flex:none}'+
  '#tn-wxc .x{display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;border:0;background:rgba(127,140,160,.15);color:inherit;font-size:20px;cursor:pointer}'+
  '#tn-wxc .tb{display:flex;gap:6px;margin:14px 0 10px;background:rgba(127,140,160,.13);border-radius:12px;padding:4px}#tn-wxc .tb button{flex:1;height:40px;border:0;border-radius:9px;background:none;color:inherit;font:600 15px system-ui,sans-serif;cursor:pointer}#tn-wxc .tb button.on{background:'+P+';box-shadow:0 1px 4px rgba(0,0,0,.15)}'+
  '#tn-wxc .hr{display:flex;gap:4px;overflow-x:auto;padding-bottom:4px}#tn-wxc .hr div{flex:none;width:58px;text-align:center;padding:8px 0;border-radius:12px}#tn-wxc .hr div.nw{background:rgba(96,165,250,.16)}#tn-wxc .hr i{display:flex;justify-content:center;margin:6px 0}#tn-wxc .hr b{font-size:16px}#tn-wxc .hr small,#tn-wxc .dy small{display:block;font-size:12px;color:#3b82f6;min-height:15px}'+
  '#tn-wxc .dy div{display:flex;align-items:center;gap:10px;height:44px;border-top:1px solid var(--tn-line)}#tn-wxc .dy div:first-child{border-top:0}#tn-wxc .dy .n{width:70px;font-weight:600}#tn-wxc .dy i{width:32px;display:flex;justify-content:center}#tn-wxc .dy small{width:40px}#tn-wxc .dy .lo{width:34px;text-align:right;color:var(--tn-joke)}#tn-wxc .dy .hi{width:34px;font-weight:700}'+
  '#tn-wxc .bar{flex:1;height:6px;border-radius:3px;background:rgba(127,140,160,.18);position:relative}#tn-wxc .bar span{position:absolute;top:0;bottom:0;border-radius:3px;background:#38bdf8}'+
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
  this.bbar=mk('tn-bbar');this.rcol=mk('tn-rcol');this.beta=mk('tn-beta');this.quick=mk('tn-quick');this.quick.onclick=ev=>this.quickTap(ev);this.wxr=mk('tn-wxr');this.wxr.onclick=ev=>{ev.stopPropagation();this.wxCard();};
  this.beta.onclick=ev=>{if(ev&&ev.target.closest&&ev.target.closest('.wxi')){ev.stopPropagation();this.wxCard();return;}const d=document.querySelector('#tn-bar .dst');if(d) d.click();};   /* (the destination: opens the route overview, as before) */
  this.tick();setInterval(()=>this.tick(),700);
};
/* the right column: the map buttons that are showing right now, one under the other */
TN.Layout.COL=[['tn-viewbtn',''],['tn-compass',''],['btn','Me'],['tn-mute',''],['tn-report','Alert'],['tn-fbbtn','']];
TN.Layout.prototype.tick=function(){
  if(!this.on) return;
  const wide=innerWidth>=760;
  /* the arrival time, copied from the turn banner (which keeps doing the work) */
  try{const e=document.querySelector('#tn-bar .eta'),d=document.querySelector('#tn-bar .dst');
    let eh=e?e.innerHTML:'';
    /* (Nov 24) the weather sits next to the arrival time (it overlapped the music as a separate button) */
    {const w=TN.wx;if(w&&w.temp!=null&&eh.indexOf('</b>')>0){const i=eh.indexOf('</b>')+4,hr=new Date().getHours(),nt=hr<7||hr>=17;
      eh='<div class="tw">'+eh.slice(0,i)+'<span class="wxi'+(this.wxWarn?' w':'')+'">'+TN.Layout.wxIcon(w.code!=null?w.code:0,nt,26)+Math.round(w.temp)+'\u00b0</span></div>'+eh.slice(i);}}
    const h=eh+(d&&d.textContent?'<div class="d">'+TN.esc(d.textContent)+'</div>':'');if(h!==this.lastEta){this.lastEta=h;this.beta.innerHTML=h;}}catch(e){}
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
    /* (Nov 24) while navigating: the weather (icon + temperature) just left of the arrival time; the music ends before it */
    let bl=this.beta.getBoundingClientRect();
    const mus=document.getElementById('tn-mus');
    if(mus) mus.style.setProperty('max-width',Math.max(160,((document.body.classList.contains('tn-routing')&&bl.width?bl.left:Math.min(innerWidth-24,(196+44+460)*k))/k)-196-44)+'px','important');}
  /* not enough room (the car's browser beside the Tesla's own screen): the album cover, then the "previous" button and the
     destination name are left out, so the music never covers the arrival time */
  if(wide){const mus=document.getElementById('tn-mus'),B=document.body;
    const over=()=>{if(!mus||!B.classList.contains('tn-routing')) return false;const a=mus.getBoundingClientRect(),w0=this.wxr&&this.wxr.getBoundingClientRect(),b=w0&&w0.width?w0:this.beta.getBoundingClientRect();return a.width&&b.width&&a.right>b.left-8;};
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
  if(document.body.classList.contains('tn-routing')) try{this.wxDrive();}catch(e){}
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
      ic=TN.Layout.wxIcon(w.code!=null?w.code:({snow:73,rain:63,fog:45,overcast:3,cloudy:2}[k]||0),nt,30);
    h+='<div class="wx"><i>'+ic+'</i>'+Math.round(w.temp)+'\u00b0</div>';}
  if(h!==this.lastQ){this.lastQ=h;this.quick.innerHTML=h;}
  /* too narrow: the weather goes first, then Work; never over the music */
  const q=this.quick,mus=document.getElementById('tn-mus'),B0=document.body;q.classList.remove('c0','c1','c2','c3','c4');
  /* the buttons come first: the music gets narrower (its title scrolls) to leave them room, down to a minimum */
  if(mus&&!B0.classList.contains('tn-routing')){const k=window.TN_UIK||1,ml=mus.getBoundingClientRect().left,ql=q.getBoundingClientRect().left;
    if(ml&&ql) mus.style.setProperty('max-width',Math.max(230,(ql-ml)/k-22)+'px','important');}
  const musR=()=>{let r=0;if(mus) for(const c of mus.children){const b=c.getBoundingClientRect();if(b.width&&getComputedStyle(c).display!=='none') r=Math.max(r,b.right);}return r;};
  const hit=()=>{const r=musR(),b=q.getBoundingClientRect();return r&&b.width&&r>b.left-14;};
  /* not enough room: first a "Tap to set" button, then tighter buttons, then Work, then the weather */
  if(hit()) q.classList.add('c3');if(hit()) q.classList.add('c4');if(hit()) q.classList.add('c0');if(hit()) q.classList.add('c2');if(hit()) q.classList.add('c1');
};
TN.Layout.prototype.quickTap=function(ev){
  if(ev.target.closest('.wx')){this.wxCard();return;}
  const d=ev.target.closest('[data-go],[data-set]'),nv=TN.nav;if(!d||!nv) return;
  if(d.dataset.set){if(nv.openSearch) nv.openSearch();nv.startSetting(d.dataset.set);return;}
  const pl=nv.places[d.dataset.go];if(pl) nv.pick(Object.assign({},pl));
};
/* the weather card: now, today hour by hour, and the next 7 days (Open-Meteo, the same free service as the map's weather) */
/* (Nov 24) our own coloured weather icons: the Tesla browser has no colour emoji (they showed black and white) */
TN.Layout.wxDefs=function(){if(document.getElementById('tn-wxdefs')) return;const d=document.createElementNS('http://www.w3.org/2000/svg','svg');d.id='tn-wxdefs';d.setAttribute('width','0');d.setAttribute('height','0');d.style.cssText='position:absolute;width:0;height:0;overflow:hidden';
  d.innerHTML='<defs><radialGradient id="tnwS" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fff3a0"/><stop offset=".55" stop-color="#ffc928"/><stop offset="1" stop-color="#f59e0b"/></radialGradient>'+
  '<linearGradient id="tnwC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfd8e3"/></linearGradient>'+
  '<linearGradient id="tnwG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c3cddb"/><stop offset="1" stop-color="#8b9bb0"/></linearGradient>'+
  '<linearGradient id="tnwD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7d8aa0"/><stop offset="1" stop-color="#4b566a"/></linearGradient>'+
  '<linearGradient id="tnwM" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff7c2"/><stop offset="1" stop-color="#f2c94c"/></linearGradient></defs>';
  document.body.appendChild(d);};
TN.Layout.wxIcon=function(c,night,z){c=+c;z=z||32;TN.Layout.wxDefs();
  const cloud=(f,x,y,k)=>'<path transform="translate('+x+' '+y+') scale('+k+')" d="M17 46h30a10 10 0 0 0 1.5-19.9A14 14 0 0 0 21.3 22 11 11 0 0 0 17 46z" fill="url(#'+f+')" stroke="rgba(70,85,110,.35)" stroke-width="1.2"/>';
  const sun=(x,y,r)=>{let g='';for(let a=0;a<8;a++){const t=a*Math.PI/4,c1=Math.cos(t),s1=Math.sin(t);g+='<line x1="'+(x+c1*(r+4)).toFixed(1)+'" y1="'+(y+s1*(r+4)).toFixed(1)+'" x2="'+(x+c1*(r+9)).toFixed(1)+'" y2="'+(y+s1*(r+9)).toFixed(1)+'" stroke="#fbbf24" stroke-width="3.2" stroke-linecap="round"/>';}
    return g+'<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="url(#tnwS)"/>';};
  const moon=(x,y,r)=>'<path d="M'+(x+r*.3)+' '+(y-r)+'A'+r+' '+r+' 0 1 0 '+(x+r)+' '+(y+r*.35)+'A'+(r*.82)+' '+(r*.82)+' 0 0 1 '+(x+r*.3)+' '+(y-r)+'z" fill="url(#tnwM)" stroke="rgba(180,140,40,.35)" stroke-width="1"/>';
  const drops=(n,col)=>{let g='';for(let i=0;i<n;i++){const x=n>2?22+i*10:27+i*11;g+='<path d="M'+x+' 47l-3 9" stroke="'+col+'" stroke-width="3.4" stroke-linecap="round"/>';}return g;};
  const flakes=()=>{let g='';for(const [x,y] of [[21,53],[32,58],[43,53]]){g+='<g stroke="#4a9be8" stroke-width="2.3" stroke-linecap="round"><path d="M'+x+' '+(y-4.5)+'v9M'+(x-3.9)+' '+(y-2.2)+'l7.8 4.4M'+(x-3.9)+' '+(y+2.2)+'l7.8-4.4"/></g>';}return g;};
  let b;
  if(c>=95) b=cloud('tnwD',0,-9,1)+'<path d="M34 36l-8 12h6l-4 11 11-15h-6l5-8z" fill="#facc15" stroke="#d97706" stroke-width="1" stroke-linejoin="round"/><path d="M19 43l-2 7M47 43l-2 7" stroke="#3b82f6" stroke-width="3" stroke-linecap="round"/>';
  else if((c>=71&&c<=77)||c===85||c===86) b=cloud('tnwG',0,-9,1)+flakes();
  else if((c>=61&&c<=67)||(c>=80&&c<=82)) b=cloud('tnwG',0,-9,1)+drops(3,'#3b82f6');
  else if(c>=51&&c<=57) b=cloud('tnwG',0,-9,1)+drops(2,'#60a5fa');
  else if(c===45||c===48) b=cloud('tnwG',0,-12,1)+'<g stroke="#94a3b8" stroke-width="3.2" stroke-linecap="round"><path d="M12 44h36M18 51h34M14 58h28"/></g>';
  else if(c===3) b=cloud('tnwG',-6,-7,.82)+cloud('tnwC',5,1,.9);
  else if(c===1||c===2) b=(night?moon(40,20,11):sun(40,21,10))+cloud('tnwC',-5,4,c===1?.78:.9);
  else b=night?moon(30,32,17):sun(32,32,14);
  return '<svg width="'+z+'" height="'+z+'" viewBox="0 0 64 64" style="display:block;overflow:visible">'+b+'</svg>';};
TN.Layout.wxName=function(c){c=+c;return c>=95?'Thunderstorm':(c>=71&&c<=77)||c===85||c===86?'Snow':(c>=51&&c<=57)?'Drizzle':(c>=61&&c<=67)||(c>=80&&c<=82)?'Rain':c===45||c===48?'Fog':c===3?'Overcast':c===2?'Partly cloudy':c===1?'Mostly clear':'Clear';};
TN.Layout.prototype.wxCard=function(){
  const tr=x=>TN.tr?TN.tr(x):x,fr=tr('Home')!=='Home',loc=fr?'fr-CA':'en-CA';
  let c=document.getElementById('tn-wxc');
  if(!c){c=document.createElement('div');c.id='tn-wxc';document.body.appendChild(c);
    c.onclick=ev=>{ev.stopPropagation();const t=ev.target.closest('[data-t]');if(t){this.wxTab=t.dataset.t;this.wxDraw();}if(ev.target.closest('.x')) c.classList.remove('on');};
    document.addEventListener('pointerdown',ev=>{if(c.classList.contains('on')&&!c.contains(ev.target)&&!ev.target.closest('#tn-quick .wx')) c.classList.remove('on');},true);}
  if(c.classList.contains('on')){c.classList.remove('on');return;}
  c.classList.add('on');this.wxTab=this.wxArrival()?'a':(this.wxTab==='a'?'h':this.wxTab||'h');
  if(this.wxData&&Date.now()-this.wxData.t<900000){this.wxDraw();return;}
  c.innerHTML='<div class="hd"><div class="cd"><b>'+tr('Loading')+'…</b></div><button class="x"><svg width="18" height="18" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></button></div>';
  let p=null;try{p=TN.nav&&TN.nav.here();}catch(e){}if(!p) return;
  fetch('https://api.open-meteo.com/v1/forecast?latitude='+p[1].toFixed(3)+'&longitude='+p[0].toFixed(3)+'&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day&hourly=temperature_2m,weather_code,precipitation_probability,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=7&timezone=auto')
    .then(r=>r.ok?r.json():null).then(j=>{if(!j) throw 0;this.wxData={t:Date.now(),j:j};if(c.classList.contains('on')) this.wxDraw();})
    .catch(()=>{c.innerHTML='<div class="hd"><div class="cd"><b>'+tr('Weather unavailable')+'</b></div><button class="x"><svg width="18" height="18" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></button></div>';});
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
/* (Nov 24) a bar's colour follows the real temperature: purple/blue when freezing, green when mild, orange/red only when it's hot */
TN.Layout.tCol=function(t){const S=[[-20,[124,58,237]],[-10,[79,70,229]],[-3,[59,130,246]],[2,[56,189,248]],[8,[52,211,153]],[14,[163,230,53]],[20,[250,204,21]],[26,[251,146,60]],[32,[239,68,68]]];
  if(t<=S[0][0]) return 'rgb('+S[0][1]+')';for(let i=1;i<S.length;i++){if(t<=S[i][0]){const k=(t-S[i-1][0])/(S[i][0]-S[i-1][0]),a=S[i-1][1],b=S[i][1];return 'rgb('+a.map((v,j)=>Math.round(v+(b[j]-v)*k)).join(',')+')';}}
  return 'rgb('+S[S.length-1][1]+')';};
/* the place you're driving to and the time you'll get there (null when not navigating) */
TN.Layout.prototype.wxDest=function(){const nv=TN.nav;if(!nv||!nv.active||!nv.dest||nv.dest.lat==null||!(nv.remainS>0)) return null;
  const d=nv.dest,t=new Date(Date.now()+nv.remainS*1000);return {name:d.name||'',lat:d.lat,lng:d.lng,t:t,key:(+d.lng).toFixed(3)+','+(+d.lat).toFixed(3)};};
/* the weather at the destination for the arrival hour: fetched once per destination, again after 15 minutes */
TN.Layout.prototype.wxArrival=function(){
  const D=this.wxDest();if(!D) return null;const A=this.wxA;
  if(!A||A.key!==D.key||(Date.now()-A.t>900000&&!A.busy)){
    const prev=A&&A.key===D.key?A:null;this.wxA={key:D.key,t:Date.now(),busy:true,j:prev&&prev.j,name:D.name};
    fetch('https://api.open-meteo.com/v1/forecast?latitude='+D.lat.toFixed(3)+'&longitude='+D.lng.toFixed(3)+'&hourly=temperature_2m,weather_code,precipitation_probability,is_day&forecast_days=3&timezone=auto')
      .then(r=>r.ok?r.json():null).then(j=>{const W=this.wxA;if(!W||W.key!==D.key) return;W.busy=false;if(j&&j.hourly){W.j=j;W.off=(j.utc_offset_seconds||0);}
        const c=document.getElementById('tn-wxc');if(c&&c.classList.contains('on')&&this.wxTab==='a') this.wxDraw();}).catch(()=>{if(this.wxA) this.wxA.busy=false;});}
  const W=this.wxA;if(!W.j) return {ok:false,name:D.name};
  /* the forecast hour of the arrival, in the destination's own time */
  const lt=new Date(D.t.getTime()+(W.off||0)*1000),k=lt.toISOString().slice(0,13),T=W.j.hourly.time;let i=T.findIndex(x=>x.slice(0,13)===k);if(i<0) i=0;
  return {ok:true,j:W.j,i:i,name:D.name,at:D.t.toTimeString().slice(0,5)};
};
/* Rocco's tip for one forecast hour (the arrival) */
TN.Layout.wxTipAt=function(j,i,fr){const H=j.hourly,c=+H.weather_code[i],t=H.temperature_2m[i];
  const snowC=x=>(x>=71&&x<=77)||x===85||x===86,wetC=x=>(x>=51&&x<=67)||(x>=80&&x<=82)||x>=95;
  if(snowC(c)) return fr?'Neige \u00e0 l\u2019arriv\u00e9e : rel\u00e2che et garde tes distances.':'Snow when you arrive: take it easy and keep your distance.';
  if(wetC(c)&&t<=1) return fr?'Pluie vers 0\u00b0 \u00e0 l\u2019arriv\u00e9e : attention au verglas.':'Rain near 0\u00b0 when you arrive: watch for ice.';
  if(wetC(c)) return fr?'Il pleuvra \u00e0 l\u2019arriv\u00e9e : un parapluie ?':'It\u2019ll be raining when you get there: umbrella?';
  if(c===45||c===48) return fr?'Brouillard \u00e0 l\u2019arriv\u00e9e : feux de croisement.':'Fog at your destination: low beams on.';
  return '';};
/* while navigating: Rocco says it once when rain or snow is about to start where you are, and once per trip when it will
   be bad at your destination (both also shown as a small banner); checked every 10 minutes at most */
TN.Layout.prototype.wxDrive=function(){
  const now=Date.now(),tr=x=>TN.tr?TN.tr(x):x,fr=tr('Home')!=='Home',nv=TN.nav;
  /* the destination, once per trip, a few seconds after starting */
  const D=this.wxDest();
  if(D&&this.wxSaidDest!==D.key){const A=this.wxArrival();if(A&&A.ok){this.wxSaidDest=D.key;const tip=TN.Layout.wxTipAt(A.j,A.i,fr);
      if(tip){const H=A.j.hourly,c=H.weather_code[A.i];this.wxAlert(tip,(fr?'\u00c0 ':'At ')+(A.name||'')+', '+A.at+(fr?' : ':': ')+Math.round(H.temperature_2m[A.i])+'\u00b0',c);}}}
  /* rain or snow starting soon where you are */
  if(now-(this.wxNowT||0)<600000) return;this.wxNowT=now;
  let p=null;try{p=nv&&nv.here();}catch(e){}if(!p) return;
  fetch('https://api.open-meteo.com/v1/forecast?latitude='+p[1].toFixed(3)+'&longitude='+p[0].toFixed(3)+'&current=precipitation,weather_code&minutely_15=precipitation,weather_code&forecast_minutely_15=4&timezone=auto')
    .then(r=>r.ok?r.json():null).then(j=>{if(!j||!j.minutely_15||!j.current) return;
      const M=j.minutely_15,cur=j.current,snowC=x=>(x>=71&&x<=77)||x===85||x===86;
      if((cur.precipitation||0)>0.05) return;   /* (already raining: nothing to announce) */
      const nowS=(cur.time||'').slice(0,16);let k=-1;
      for(let i=0;i<M.time.length;i++){if(M.time[i].slice(0,16)<=nowS) continue;if((M.precipitation[i]||0)>=0.2){k=i;break;}}
      if(k<0||Date.now()-(this.wxRainSaid||0)<3600000) return;
      const mins=Math.max(5,Math.round((new Date(M.time[k])-new Date(cur.time))/60000)),sn=snowC(+M.weather_code[k]);
      this.wxRainSaid=Date.now();
      this.wxAlert(fr?(sn?'La neige':'La pluie')+' commence dans environ '+mins+' minutes'+(sn?' : garde tes distances.':' : essuie-glaces pr\u00eats !'):(sn?'Snow':'Rain')+' starts in about '+mins+' minutes'+(sn?': keep your distance.':': wipers ready!'),'',sn?73:63);})
    .catch(()=>{});
};
/* the small banner with Rocco (and his voice, if the voice is on) */
TN.Layout.prototype.wxAlert=function(text,head,code){
  {const now=Date.now();if(now<(this.wxaBusy||0)){setTimeout(()=>this.wxAlert(text,head,code),this.wxaBusy-now+600);this.wxaBusy+=10000;return;}this.wxaBusy=now+10000;}   /* (one at a time) */
  let a=document.getElementById('tn-wxa');if(!a){a=document.createElement('div');a.id='tn-wxa';document.body.appendChild(a);a.onclick=()=>a.classList.remove('on');}
  a.innerHTML=(TN.roccoSVG?TN.roccoSVG(46):'')+'<div>'+(head?'<b>'+TN.esc(head)+'</b>':'')+'<span>'+TN.esc(text)+'</span></div>'+(code!=null?TN.Layout.wxIcon(code,false,40):'');
  a.classList.add('on');clearTimeout(this.wxaT);this.wxaT=setTimeout(()=>a.classList.remove('on'),9000);
  this.wxWarn=true;clearTimeout(this.wxWT);this.wxWT=setTimeout(()=>{this.wxWarn=false;},60000);
  try{if(TN.voice&&TN.voice.say&&!(TN.settings&&TN.settings.voice===false)) TN.voice.say(text);}catch(e){}
};
/* the weather button while navigating (left of the arrival time) */
TN.Layout.prototype.wxRoute=function(bl,k){
  const w=TN.wx,el=this.wxr;if(!w||w.temp==null){el.classList.remove('ok');return;}
  const hr=new Date().getHours(),nt=hr<7||hr>=17,h=TN.Layout.wxIcon(w.code!=null?w.code:0,nt,28)+Math.round(w.temp)+'\u00b0';
  if(h!==this.lastWr){this.lastWr=h;el.innerHTML=h;}el.classList.add('ok');
  el.style.right=((innerWidth-bl.left)/k+26)+'px';
};
TN.Layout.prototype.wxDraw=function(){
  const c=document.getElementById('tn-wxc'),j=this.wxData&&this.wxData.j;if(!c||!j) return;
  const tr=x=>TN.tr?TN.tr(x):x,fr=tr('Home')!=='Home',loc=fr?'fr-CA':'en-CA',cu=j.current||{},L=TN.Layout,R=Math.round;
  let h='<div class="hd"><span class="ic">'+L.wxIcon(cu.weather_code,!cu.is_day)+'</span><span class="big">'+R(cu.temperature_2m)+'°</span><div class="cd"><b>'+tr(L.wxName(cu.weather_code))+'</b><small>'+tr('Feels like')+' '+R(cu.apparent_temperature)+'° · '+tr('Wind')+' '+R(cu.wind_speed_10m)+' km/h</small></div><button class="x"><svg width="18" height="18" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></button></div>';
  if(!(this.wxTab==='a'&&this.wxDest())){const tip=L.wxTip(j,fr);if(tip) h+='<div class="rk">'+(TN.roccoSVG?TN.roccoSVG(38):'')+'<span>'+tip+'</span></div>';}
  const A=this.wxArrival();if(!A&&this.wxTab==='a') this.wxTab='h';
  h+='<div class="tb">'+(A?'<button data-t="a" class="'+(this.wxTab==='a'?'on':'')+'">'+tr('Arrival')+'</button>':'')+'<button data-t="h" class="'+(this.wxTab==='h'?'on':'')+'">'+tr('Today')+'</button><button data-t="d" class="'+(this.wxTab==='d'?'on':'')+'">'+tr('7 days')+'</button></div>';
  if(this.wxTab==='a'&&A){
    if(!A.ok) h+='<div class="ar"><b>'+tr('Loading')+'\u2026</b></div>';
    else{const H=A.j.hourly,i=A.i,pp=H.precipitation_probability?H.precipitation_probability[i]:0;
      h+='<div class="ar">'+L.wxIcon(H.weather_code[i],!H.is_day[i],58)+'<span class="t">'+R(H.temperature_2m[i])+'\u00b0</span><div><b>'+TN.esc(A.name)+'</b><small>'+tr('Arriving')+' '+A.at+' \u00b7 '+tr(L.wxName(H.weather_code[i]))+(pp>=20?' \u00b7 '+pp+'% '+tr(((+H.weather_code[i]>=71&&+H.weather_code[i]<=77)||+H.weather_code[i]===85||+H.weather_code[i]===86)?'snow':'rain'):'')+'</small></div></div>';
      {const tip=L.wxTipAt(A.j,i,fr);if(tip) h+='<div class="rk">'+(TN.roccoSVG?TN.roccoSVG(38):'')+'<span>'+tip+'</span></div>';}
      h+='<div class="ar3">';for(let n=1;n<=3&&i+n<H.time.length;n++){const q=i+n,p2=H.precipitation_probability?H.precipitation_probability[q]:0;
        h+='<div>'+R(+H.time[q].slice(11,13))+(fr?' h':':00')+'<i>'+L.wxIcon(H.weather_code[q],!H.is_day[q],30)+'</i><b>'+R(H.temperature_2m[q])+'\u00b0</b><small>'+(p2>=20?p2+'%':'')+'</small></div>';}
      h+='</div>';}
    c.innerHTML=h;return;}
  if(this.wxTab==='h'){const H=j.hourly,now=(cu.time||'').slice(0,13);let i=Math.max(0,H.time.findIndex(t=>t.slice(0,13)===now));h+='<div class="hr">';
    for(let n=0;n<24&&i<H.time.length;n++,i++){const pp=H.precipitation_probability?H.precipitation_probability[i]:0;
      h+='<div class="'+(n?'':'nw')+'">'+(n?R(+H.time[i].slice(11,13))+(fr?' h':''):tr('Now'))+'<i>'+L.wxIcon(H.weather_code[i],!H.is_day[i])+'</i><b>'+R(H.temperature_2m[i])+'°</b><small>'+(pp>=20?pp+'%':'')+'</small></div>';}
    h+='</div>';}
  else{const D=j.daily,lo=Math.min(...D.temperature_2m_min),hi=Math.max(...D.temperature_2m_max),sp=Math.max(1,hi-lo);h+='<div class="dy">';
    D.time.forEach((t,i)=>{const nm=i?new Date(t+'T12:00').toLocaleDateString(loc,{weekday:'short'}):tr('Today'),a=D.temperature_2m_min[i],b=D.temperature_2m_max[i],pp=D.precipitation_probability_max?D.precipitation_probability_max[i]:0;
      h+='<div><span class="n">'+nm+'</span><i>'+L.wxIcon(D.weather_code[i],false)+'</i><small>'+(pp>=20?pp+'%':'')+'</small><span class="lo">'+R(a)+'°</span><span class="bar"><span style="left:'+((a-lo)/sp*100)+'%;right:'+((hi-b)/sp*100)+'%;background:linear-gradient(90deg,'+L.tCol(a)+','+L.tCol((a+b)/2)+','+L.tCol(b)+')"></span></span><span class="hi">'+R(b)+'°</span></div>';});
    h+='</div>';}
  c.innerHTML=h;
};
/* starts once the app has set itself up (its buttons exist) */
(function(){if(typeof document==='undefined') return;let n=0;const go=()=>{if(document.body&&document.body.classList.contains('tn-app')){if(!TN.layout) TN.layout=new TN.Layout();return;}if(++n<200) setTimeout(go,150);};go();})();
