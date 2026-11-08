/* TessyNav v2 — feedback.js (v4)
   While driving (a route, or moving): one tap on the button SENDS the moment right away (screenshot, time, street,
   position, what the app was doing) and Rocco confirms it clearly; no typing on the road. After the trip, Rocco asks
   whether to add details, which are added to that same report (a comment on the same issue). The app keeps a light
   history of the whole drive (an hour), and quietly saves a screenshot when it catches an error or freezes (a few
   per hour), attached to the next report. A report that can't be sent (no connection) waits and is sent later.
   "Send feedback" from the main screen: a round button under Rocco's settings button opens a short form (what happened,
   an optional message, and two choices: include a screenshot, include my location). The report also carries what the
   app was doing in the last 2 minutes (GPS quality, smoothness, route events, errors), the build and file versions,
   the device and the settings. It goes to the TessyNav server, which files it as an issue in a private GitHub
   repository (you get an email for each). Nothing personal is sent beyond what the user ticks. */
var TN=globalThis.TN||{};globalThis.TN=TN;
/* (its own text escaping, named fbEsc: browsers share one space for all scripts) */
var fbEsc=t=>String(t==null?'':t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
TN.Feedback=function(api){
  this.api=api;this.log=[];this.errs=[];this.sec=[];this.gps=[];this.auto=[];this.autoT=0;
  const ld=k=>{try{return JSON.parse(localStorage.getItem(k)||'null');}catch(e){return null;}};
  this.pend=ld('tn2_fbpend')||[];this.queue=ld('tn2_fbqueue')||[];this.loc=ld('tn2_fbloc');if(this.loc==null) this.loc=true;
  const me=this;
  /* a GPS point every 3 s for the last hour (sent only when the user allows the location) */
  setInterval(()=>{const c=me.api.getCar&&me.api.getCar();if(c&&c.x!=null&&TN.fromLocal){const ll=TN.fromLocal(c.x,c.z);
    me.gps.push([Date.now(),+ll[1].toFixed(5),+ll[0].toFixed(5)]);if(me.gps.length>1200) me.gps.shift();}},3000);
  setInterval(()=>me.flush(),60000);setTimeout(()=>me.flush(),15000);
  document.addEventListener('visibilitychange',()=>{me.visT=Date.now();});   /* (coming back from the background is not a freeze) */
  window.addEventListener('error',e=>me.err(String(e.message||e.error||'error'),(e.filename||'').split('/').pop()+':'+(e.lineno||'')),true);
  window.addEventListener('unhandledrejection',e=>me.err('promise: '+String((e.reason&&e.reason.message)||e.reason||'')));
  this.button();
};
/* the last 2 minutes: route and app events, a line per second, errors */
TN.Feedback.prototype.save=function(){try{localStorage.setItem('tn2_fbpend',JSON.stringify(this.pend.slice(-10)));localStorage.setItem('tn2_fbqueue',JSON.stringify(this.queue.slice(-5)));}catch(e){}};
TN.Feedback.prototype.note=function(k,d){this.log.push([Date.now(),k,d]);while(this.log.length&&(this.log.length>3000||Date.now()-this.log[0][0]>3600000)) this.log.shift();};
TN.Feedback.prototype.second=function(fps,worst){
  const g=this.api.gps&&this.api.gps(),c=this.api.getCar&&this.api.getCar();
  this.sec.push([Date.now(),fps,Math.round(worst||0),g?Math.round((g.v||0)*3.6):null,c&&c.snapped?1:0]);
  while(this.sec.length>3600) this.sec.shift();
  /* (a real freeze: the app visible and stuck 1.5 to 5 s; longer gaps are the screen asleep or the browser hidden) */
  if(worst>1500&&worst<5000&&document.visibilityState!=='hidden'&&Date.now()-(this.visT||0)>3000) this.snap('freeze '+Math.round(worst)+' ms');
};
/* a quiet screenshot when something goes wrong: at most 3 kept, one a minute at most */
TN.Feedback.prototype.snap=function(why){
  const now=Date.now();if(now-this.autoT<60000) return;this.autoT=now;
  const place=this.place();this.capture(true).then(img=>{if(!img) return;this.auto.push({t:now,why:why,place:place,img:img});if(this.auto.length>3) this.auto.shift();});
};
TN.Feedback.prototype.place=function(){
  const st=document.getElementById('status'),t=st?st.textContent.split('\u00b7')[0].trim():'';
  return /finding|recherche/i.test(t)?'':t.slice(0,60);
};
TN.Feedback.prototype.err=function(msg,where){this.errs.push([Date.now(),String(msg).slice(0,300),where||'']);if(this.errs.length>30) this.errs.shift();this.snap('error: '+String(msg).slice(0,60));};
TN.Feedback.prototype.button=function(){
  const st=document.createElement('style');
  /* bottom right on every screen (where Recenter was); the compass sits above it, End route to its left */
  st.textContent='#tn-fbbtn{right:16px;bottom:24px;width:56px;height:56px;padding:0;display:flex;align-items:center;justify-content:center;border-radius:16px}'+
    '#tn-fb{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:40;width:min(92vw,520px);max-height:86vh;overflow:auto;display:none;background:rgb(var(--tn-panel-rgb,43 45 49)/.98);color:var(--tn-text,#f3f1ec);border-radius:18px;padding:18px;box-shadow:0 10px 40px rgba(0,0,0,.5);font:15px system-ui,sans-serif}'+
    '#tn-fb h3{margin:0 0 4px;font-size:19px}#tn-fb .s{color:var(--tn-sub,#b9b6ae);font-size:13px;margin-bottom:12px}'+
    '#tn-fb .k{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px}#tn-fb .k button{border:0;border-radius:11px;padding:11px 8px;font:600 14px system-ui,sans-serif;background:rgba(255,255,255,.08);color:var(--tn-text,#f3f1ec)}'+
    '#tn-fb .k button.on{background:var(--tn-accent,#e8913a);color:var(--tn-on-accent,#2b1a08)}#tn-fb textarea{width:100%;box-sizing:border-box;min-height:84px;border-radius:12px;border:1px solid rgba(127,127,127,.35);background:rgba(0,0,0,.15);color:inherit;padding:10px;font:15px system-ui,sans-serif;resize:vertical}'+
    '#tn-fb label{display:flex;align-items:center;gap:10px;margin-top:10px;font-size:14px}#tn-fb label input{width:20px;height:20px}'+
    '#tn-fb .row{display:flex;gap:8px;margin-top:14px}#tn-fb .row button{flex:1;border:0;border-radius:11px;padding:12px;font:600 15px system-ui,sans-serif;background:rgba(255,255,255,.08);color:var(--tn-text,#f3f1ec)}#tn-fb .row .send{background:var(--tn-accent,#e8913a);color:var(--tn-on-accent,#2b1a08)}';
  document.head.appendChild(st);
  const b=document.createElement('button');b.id='tn-fbbtn';b.className='hud';b.setAttribute('aria-label','Send feedback');b.title='Send feedback';
  b.innerHTML='<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/></svg>';
  b.onclick=()=>{if(this.driving()) this.moment();else if(this.pend.some(m=>!m.asked)) this.details();else this.open();};document.body.appendChild(b);
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
TN.Feedback.prototype.capture=function(small){
  const map=this.api.map;if(!map||!map.getCanvas) return Promise.resolve(null);
  return new Promise(res=>{let done=false;
    const grab=()=>{if(done) return;done=true;try{const c=map.getCanvas(),w=Math.min(small?560:900,c.width),h=Math.round(c.height*w/c.width);
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
    gps:g?{acc:g.acc!=null?Math.round(g.acc):null,speed:Math.round((g.v||0)*3.6)}:null,snapped:!!(c&&c.snapped)};
  if(withLoc&&c&&c.x!=null&&TN.fromLocal){const ll=TN.fromLocal(c.x,c.z);info.position=[+ll[1].toFixed(5),+ll[0].toFixed(5)];}
  return {info:info,errors:this.errs.slice(),events:this.log.slice(-400),seconds:this.sec.slice(-1800),gps:withLoc?this.gps.slice(-600):[],
    auto:this.auto.map(a=>({t:a.t,why:a.why,place:a.place}))};
};
TN.Feedback.prototype.send=async function(P){
  const btn=P.querySelector('.send'),say=m=>{if(TN.toast) TN.toast(m);else if(this.api.nav&&this.api.nav.toast) this.api.nav.toast(m);};
  btn.disabled=true;btn.textContent='Sending…';
  if(!this.shot&&P.querySelector('.sh').checked) await new Promise(r=>setTimeout(r,600));
  this.loc=P.querySelector('.lo').checked;try{localStorage.setItem('tn2_fbloc',JSON.stringify(this.loc));}catch(e){}
  const body={kind:this.kind,text:P.querySelector('textarea').value.slice(0,2000),report:this.report(this.loc),
    screenshot:P.querySelector('.sh').checked?this.shot:null,shots:this.auto.map(a=>a.img)};
  try{
    const r=await fetch((TN.TESLA_SERVER||'https://tessynav.mznwattar.workers.dev')+'/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const j=await r.json().catch(()=>({}));
    if(r.ok){P.style.display='none';this.auto=[];say('Thanks! Rocco passed it on.');return;}
    btn.disabled=false;btn.textContent='Send';say('Could not send right now'+(j.error?' ('+j.error+')':''));
  }catch(e){btn.disabled=false;btn.textContent='Send';say('Could not send right now');}
};

TN.Feedback.prototype.driving=function(){const n=this.api.nav,g=this.api.gps&&this.api.gps();return !!((n&&n.active)||(g&&(g.v||0)>2.5));};
TN.Feedback.prototype.post=async function(path,body){
  const r=await fetch((TN.TESLA_SERVER||'https://tessynav.mznwattar.workers.dev')+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>({}));if(!r.ok) throw new Error(j.error||('status '+r.status));return j;
};
/* one tap while driving: the moment is sent right away; Rocco says so clearly */
TN.Feedback.prototype.moment=async function(){
  const t=Date.now(),place=this.place();
  this.flash();
  const img=await this.capture();
  const body={kind:'moment',quick:true,text:'',place:place,report:this.report(this.loc),screenshot:img,shots:this.auto.map(a=>a.img)};
  const fr=TN.LANG==='fr',hm=new Date(t).toLocaleTimeString(fr?'fr-CA':'en-CA',{hour:'2-digit',minute:'2-digit'});
  try{const j=await this.post('/feedback',body);this.auto=[];
    this.pend.push({num:j.num,key:j.key,t:t,place:place,asked:false});this.save();
    this.notice(fr?'C’est noté! 📸':'Got it! 📸',fr?'Ce moment ('+hm+(place?', '+place:'')+') a été envoyé à l’équipe TessyNav. Vous pourrez ajouter des détails à l’arrêt.':'This moment ('+hm+(place?', '+place:'')+') was sent to the TessyNav team. You can add details when you stop.');}
  catch(e){this.queue.push({body:body,t:t,place:place});this.save();
    this.notice(fr?'Moment gardé 📸':'Moment saved 📸',fr?'Pas de connexion pour l’instant : je l’enverrai dès que possible.':'No connection right now: I’ll send it as soon as I can.');}
};
/* reports that waited for a connection */
TN.Feedback.prototype.flush=async function(){
  if(!this.queue.length||this.flushing) return;this.flushing=true;
  try{while(this.queue.length){const q=this.queue[0];const j=await this.post('/feedback',q.body);this.queue.shift();
      this.pend.push({num:j.num,key:j.key,t:q.t,place:q.place,asked:false});this.save();}}catch(e){}
  this.flushing=false;
};
/* a camera-like flash, so the tap is clearly felt */
TN.Feedback.prototype.flash=function(){
  const f=document.createElement('div');f.style.cssText='position:absolute;inset:0;z-index:60;background:#fff;opacity:.55;pointer-events:none;transition:opacity .35s';
  document.body.appendChild(f);requestAnimationFrame(()=>requestAnimationFrame(()=>{f.style.opacity='0';}));setTimeout(()=>f.remove(),450);
};
/* Rocco's clear message: big, at the top, for a few seconds (tap to close) */
TN.Feedback.prototype.notice=function(title,text){
  if(!document.getElementById('tn-fbn-css')){const st=document.createElement('style');st.id='tn-fbn-css';
    st.textContent='#tn-fbn{position:absolute;left:50%;top:16px;transform:translate(-50%,-140%);z-index:55;width:min(92vw,560px);display:flex;gap:14px;align-items:center;padding:14px 18px;border-radius:18px;background:rgb(var(--tn-panel-rgb,43 45 49)/.98);color:var(--tn-text,#f3f1ec);box-shadow:0 8px 30px rgba(0,0,0,.45);font:15px system-ui,sans-serif;transition:transform .35s cubic-bezier(.2,1.3,.4,1)}'+
      '#tn-fbn.on{transform:translate(-50%,0)}#tn-fbn b{display:block;font-size:20px;margin-bottom:3px}#tn-fbn span{line-height:1.35}#tn-fbn svg{flex-shrink:0}';
    document.head.appendChild(st);}
  const old=document.getElementById('tn-fbn');if(old) old.remove();
  const n=document.createElement('div');n.id='tn-fbn';n.className='notr';
  n.innerHTML=(TN.roccoSVG?TN.roccoSVG(54):'')+'<div><b>'+fbEsc(title)+'</b><span>'+fbEsc(text)+'</span></div>';
  n.onclick=()=>n.remove();document.body.appendChild(n);
  requestAnimationFrame(()=>requestAnimationFrame(()=>n.classList.add('on')));
  clearTimeout(this.noteT);this.noteT=setTimeout(()=>{n.classList.remove('on');setTimeout(()=>n.remove(),400);},6500);
};
/* after the trip: add details to the moments flagged on the way (each goes to its own report) */
TN.Feedback.prototype.afterTrip=function(){if(this.pend.some(m=>!m.asked)&&!this.driving()) this.details();};
TN.Feedback.prototype.details=function(){
  const list=this.pend.filter(m=>!m.asked).slice(-3);if(!list.length) return this.open();
  let P=document.getElementById('tn-fb');if(!P){P=document.createElement('div');P.id='tn-fb';document.body.appendChild(P);}
  const fr=TN.LANG==='fr',tm=t=>new Date(t).toLocaleTimeString(fr?'fr-CA':'en-CA',{hour:'2-digit',minute:'2-digit'});
  const n=list.length;
  P.innerHTML='<div style="display:flex;gap:12px;align-items:center;margin-bottom:6px">'+(TN.roccoSVG?TN.roccoSVG(46):'')+
    '<h3 class="notr" style="margin:0">'+(fr?(n>1?'Vous avez signalé '+n+' moments':'Vous avez signalé un moment'):(n>1?'You flagged '+n+' moments':'You flagged a moment'))+'</h3></div>'+
    '<div class="s notr">'+(fr?'Ils ont déjà été envoyés avec une capture d’écran. Voulez-vous ajouter ce qui s’est passé?':'They were already sent with a screenshot. Want to add what happened?')+'</div>'+
    list.map((m,i)=>'<div class="notr" style="margin:10px 0 6px;font-weight:600">'+tm(m.t)+(m.place?' · '+fbEsc(m.place):'')+'</div><textarea data-i="'+i+'" placeholder="'+(fr?'Que s’est-il passé ici? (facultatif)':'What happened here? (optional)')+'"></textarea>').join('')+
    '<div class="row"><button class="cancel notr">'+(fr?'Non merci':'No thanks')+'</button><button class="send notr">'+(fr?'Ajouter les détails':'Add details')+'</button></div>';
  P.style.display='block';
  const done=()=>{list.forEach(m=>m.asked=true);this.pend=this.pend.filter(m=>!m.asked).concat([]);this.save();P.style.display='none';};
  P.querySelector('.cancel').onclick=done;
  P.querySelector('.send').onclick=async()=>{const btn=P.querySelector('.send');btn.disabled=true;btn.textContent=fr?'Envoi…':'Sending…';let ok=0,bad=0;
    for(const ta of P.querySelectorAll('textarea')){const m=list[+ta.dataset.i],txt=ta.value.trim();if(!txt) continue;
      try{await this.post('/feedback/comment',{num:m.num,key:m.key,text:txt.slice(0,2000)});ok++;}catch(e){bad++;}}
    done();
    if(bad) this.notice(fr?'Pas encore envoyé':'Not sent yet',fr?'Je n’ai pas pu ajouter vos détails. Réessayez plus tard avec le bouton commentaire.':'I couldn’t add your details. Please try again later with the feedback button.');
    else if(ok) this.notice(fr?'Merci! 🙌':'Thanks! 🙌',fr?'Vos détails ont été ajoutés au rapport.':'Your details were added to the report.');};
};
