/* TessyNav v2 — feedback.js (v1)
   "Send feedback" from the main screen: a round button under Rocco's settings button opens a short form (what happened,
   an optional message, and two choices: include a screenshot, include my location). The report also carries what the
   app was doing in the last 2 minutes (GPS quality, smoothness, route events, errors), the build and file versions,
   the device and the settings. It goes to the TessyNav server, which files it as an issue in a private GitHub
   repository (you get an email for each). Nothing personal is sent beyond what the user ticks. */
var TN=globalThis.TN||{};globalThis.TN=TN;
TN.Feedback=function(api){
  this.api=api;this.log=[];this.errs=[];this.sec=[];
  const me=this;
  window.addEventListener('error',e=>me.err(String(e.message||e.error||'error'),(e.filename||'').split('/').pop()+':'+(e.lineno||'')),true);
  window.addEventListener('unhandledrejection',e=>me.err('promise: '+String((e.reason&&e.reason.message)||e.reason||'')));
  this.button();
};
/* the last 2 minutes: route and app events, a line per second, errors */
TN.Feedback.prototype.note=function(k,d){this.log.push([Date.now(),k,d]);while(this.log.length&&Date.now()-this.log[0][0]>120000) this.log.shift();};
TN.Feedback.prototype.second=function(fps,worst){
  const g=this.api.gps&&this.api.gps(),c=this.api.getCar&&this.api.getCar();
  this.sec.push([Date.now(),fps,Math.round(worst||0),g?Math.round((g.v||0)*3.6):null,c&&c.snapped?1:0]);
  while(this.sec.length>120) this.sec.shift();
};
TN.Feedback.prototype.err=function(msg,where){this.errs.push([Date.now(),String(msg).slice(0,300),where||'']);if(this.errs.length>30) this.errs.shift();};
TN.Feedback.prototype.button=function(){
  const st=document.createElement('style');
  st.textContent='#tn-fbbtn{right:16px;top:78px;width:50px;height:50px;padding:0;display:flex;align-items:center;justify-content:center;border-radius:16px}'+
    '#tn-fb{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:40;width:min(92vw,520px);max-height:86vh;overflow:auto;display:none;background:rgb(var(--tn-panel-rgb,43 45 49)/.98);color:var(--tn-text,#f3f1ec);border-radius:18px;padding:18px;box-shadow:0 10px 40px rgba(0,0,0,.5);font:15px system-ui,sans-serif}'+
    '#tn-fb h3{margin:0 0 4px;font-size:19px}#tn-fb .s{color:var(--tn-sub,#b9b6ae);font-size:13px;margin-bottom:12px}'+
    '#tn-fb .k{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px}#tn-fb .k button{border:0;border-radius:11px;padding:11px 8px;font:600 14px system-ui,sans-serif;background:rgba(255,255,255,.08);color:var(--tn-text,#f3f1ec)}'+
    '#tn-fb .k button.on{background:var(--tn-accent,#e8913a);color:#2b1a08}#tn-fb textarea{width:100%;box-sizing:border-box;min-height:84px;border-radius:12px;border:1px solid rgba(127,127,127,.35);background:rgba(0,0,0,.15);color:inherit;padding:10px;font:15px system-ui,sans-serif;resize:vertical}'+
    '#tn-fb label{display:flex;align-items:center;gap:10px;margin-top:10px;font-size:14px}#tn-fb label input{width:20px;height:20px}'+
    '#tn-fb .row{display:flex;gap:8px;margin-top:14px}#tn-fb .row button{flex:1;border:0;border-radius:11px;padding:12px;font:600 15px system-ui,sans-serif;background:rgba(255,255,255,.08);color:var(--tn-text,#f3f1ec)}#tn-fb .row .send{background:var(--tn-accent,#e8913a);color:#2b1a08}';
  document.head.appendChild(st);
  const b=document.createElement('button');b.id='tn-fbbtn';b.className='hud';b.setAttribute('aria-label','Send feedback');b.title='Send feedback';
  b.innerHTML='<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/></svg>';
  b.onclick=()=>this.open();document.body.appendChild(b);
};
TN.Feedback.prototype.open=function(){
  let P=document.getElementById('tn-fb');if(!P){P=document.createElement('div');P.id='tn-fb';document.body.appendChild(P);}
  /* (the screenshot is taken now, before the form covers the map) */
  this.shot=null;this.capture().then(s=>{this.shot=s;});
  const kinds=[['bug','Something went wrong'],['route','Wrong route'],['map','Map error'],['idea','An idea']];this.kind='bug';
  P.innerHTML='<h3>Send feedback</h3><div class="s">Tell us what happened. A tap on Send is enough: the details are added for you.</div>'+
    '<div class="k">'+kinds.map(k=>'<button data-k="'+k[0]+'" class="'+(k[0]==='bug'?'on':'')+'">'+k[1]+'</button>').join('')+'</div>'+
    '<textarea placeholder="What happened? (optional)"></textarea>'+
    '<label><input type="checkbox" class="sh" checked> Include a screenshot</label>'+
    '<label><input type="checkbox" class="lo" checked> Include my location</label>'+
    '<div class="row"><button class="cancel">Cancel</button><button class="send">Send</button></div>';
  P.style.display='block';
  P.querySelectorAll('.k button').forEach(x=>x.onclick=()=>{this.kind=x.dataset.k;P.querySelectorAll('.k button').forEach(y=>y.classList.toggle('on',y===x));});
  P.querySelector('.cancel').onclick=()=>{P.style.display='none';};
  P.querySelector('.send').onclick=()=>this.send(P);
};
/* a picture of the 3D view: read from the map's canvas right after it draws (the only moment it can be read) */
TN.Feedback.prototype.capture=function(){
  const map=this.api.map;if(!map||!map.getCanvas) return Promise.resolve(null);
  return new Promise(res=>{let done=false;
    const grab=()=>{if(done) return;done=true;try{const c=map.getCanvas(),w=Math.min(900,c.width),h=Math.round(c.height*w/c.width);
        const o=document.createElement('canvas');o.width=w;o.height=h;o.getContext('2d').drawImage(c,0,0,w,h);res(o.toDataURL('image/jpeg',0.72));}catch(e){res(null);}};
    try{map.once('render',grab);map.triggerRepaint&&map.triggerRepaint();}catch(e){res(null);}
    setTimeout(()=>{if(!done){done=true;res(null);}},1500);});
};
TN.Feedback.prototype.report=function(withLoc){
  const S=TN.settings||{},safe={};for(const k in S) if(!/token|secret|key/i.test(k)) safe[k]=S[k];
  const c=this.api.getCar&&this.api.getCar(),g=this.api.gps&&this.api.gps();
  const nav=this.api.nav,r=nav&&nav.route;
  const info={build:TN.APPBUILD,files:(window.TN_FILES||[]).map(f=>f.replace('js/','')),lang:TN.LANG,ua:navigator.userAgent,screen:[window.innerWidth,window.innerHeight,window.devicePixelRatio],
    time:new Date().toString(),settings:safe,tesla:!!(TN.tesla&&TN.tesla.connected()),car:TN.carInfo||null,
    route:r?{active:!!nav.active,dest:nav.dest&&nav.dest.name,km:+(r.L/1000).toFixed(2),at:nav.ps!=null?Math.round(nav.ps):null}:null,
    gps:g?{acc:g.acc,speed:Math.round((g.v||0)*3.6)}:null,snapped:!!(c&&c.snapped)};
  if(withLoc&&c&&c.x!=null&&TN.fromLocal){const ll=TN.fromLocal(c.x,c.z);info.position=[+ll[1].toFixed(5),+ll[0].toFixed(5)];}
  return {info:info,errors:this.errs.slice(),events:this.log.slice(-80),seconds:this.sec.slice()};
};
TN.Feedback.prototype.send=async function(P){
  const btn=P.querySelector('.send'),say=m=>{if(TN.toast) TN.toast(m);else if(this.api.nav&&this.api.nav.toast) this.api.nav.toast(m);};
  btn.disabled=true;btn.textContent='Sending…';
  if(!this.shot&&P.querySelector('.sh').checked) await new Promise(r=>setTimeout(r,600));
  const body={kind:this.kind,text:P.querySelector('textarea').value.slice(0,2000),report:this.report(P.querySelector('.lo').checked),
    screenshot:P.querySelector('.sh').checked?this.shot:null};
  try{
    const r=await fetch((TN.TESLA_SERVER||'https://tessynav.mznwattar.workers.dev')+'/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const j=await r.json().catch(()=>({}));
    if(r.ok){P.style.display='none';say('Thanks! Rocco passed it on.');return;}
    btn.disabled=false;btn.textContent='Send';say('Could not send right now'+(j.error?' ('+j.error+')':''));
  }catch(e){btn.disabled=false;btn.textContent='Send';say('Could not send right now');}
};
