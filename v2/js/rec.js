/* TessyNav v2 — rec.js
   Recording in the same trip format as before (so every analysis keeps working), encrypted in the browser and
   uploaded to the trips repository. Uses the upload setup already saved in this browser by the main app.
   The recording is also saved locally every 20 s, so a crash never loses a drive. */
var TN=globalThis.TN||{};globalThis.TN=TN;

TN.Rec=function(){this.rec=null;this.t0=0;this.timer=null;};
TN.Rec.prototype.start=function(){
  this.t0=Date.now();
  this.rec={v:1,start:this.t0,app:'v2',info:{ua:navigator.userAgent,w:innerWidth,h:innerHeight,dpr:devicePixelRatio,view:'street',date:new Date().toISOString()},
    g:[],f:[],p:[],e:[],x:[],dur:0};
  this.timer=setInterval(()=>this.save(),20000);
};
TN.Rec.prototype.t=function(){return Math.round(Date.now()-this.t0);};
/* navigation log: what the navigation did and when (route started, recalculations, arrival, route ended and why) */
TN.Rec.prototype.note=function(kind,data,shot){if(!this.rec) return;const R=this.rec;R.n=R.n||[];if(R.n.length<4000) R.n.push([this.t(),kind,data||null]);if(shot) this.wantShot('nav: '+kind);};
/* snapshots: a small picture of the screen every 10 s, and right away when something looks wrong (the car jumps,
   changes height fast, loses the road, or the screen gets slow). They are uploaded with the trip so I can see
   what you saw. */
TN.Rec.prototype.wantShot=function(why){if(this.rec&&!this.shotWhy) this.shotWhy=why;};
TN.Rec.prototype.shoot=function(canvas){
  if(!this.rec) return;
  const now=Date.now(),R=this.rec;R.shots=R.shots||[];
  const due=now-(this.shotT||0)>10000,ev=this.shotWhy&&now-(this.shotT||0)>2500;
  if(!(due||ev)||R.shots.length>=300) return;
  try{
    if(!this.cv){this.cv=document.createElement('canvas');this.cx=this.cv.getContext('2d');}
    const w=320,h=Math.round(320*canvas.height/canvas.width);
    if(this.cv.width!==w){this.cv.width=w;this.cv.height=h;}
    this.cx.drawImage(canvas,0,0,w,h);
    R.shots.push([this.t(),this.cv.toDataURL('image/jpeg',0.6),ev?this.shotWhy:'']);
    this.shotT=now;this.shotWhy=null;
  }catch(e){}
};
TN.Rec.prototype.gps=function(c){
  if(!this.rec) return;
  this.rec.g.push([this.t(),+c.latitude.toFixed(7),+c.longitude.toFixed(7),Math.round((c.accuracy||0)*10)/10,
    c.speed==null?null:Math.round(c.speed*100)/100,c.heading==null||isNaN(c.heading)?null:Math.round(c.heading*10)/10]);
};
TN.Rec.prototype.frame=function(car,zoom,follow){
  if(!this.rec||!car) return;
  const ll=TN.fromLocal(car.x,car.z),r=v=>Math.round(v*10)/10;
  this.rec.f.push([this.t(),+ll[1].toFixed(7),+ll[0].toFixed(7),r(car.hd),car.snapped?1:0,car.snapped?car.cls:'',r(car.lat||0),follow?1:0,
    Math.round(zoom*100)/100,(car.y||0)>0.5?1:0,r(car.y||0),'v2',car.snapped?car.wid:0]);
};
TN.Rec.prototype.second=function(fps,worst){
  if(!this.rec) return;
  let mb=-1;try{if(performance.memory) mb=Math.round(performance.memory.usedJSHeapSize/1048576);}catch(e){}
  this.rec.p.push([this.t(),fps,Math.round(worst),mb]);
  const x={};for(const k in TN.PROF){x[k]=Math.round(TN.PROF[k]*10)/10;}TN.PROF={};
  this.rec.x.push([this.t(),x]);
};
TN.Rec.prototype.save=function(){
  if(!this.rec) return;
  this.rec.dur=this.t();
  /* (snapshots are too big for the browser storage: the crash backup keeps the drive data only) */
  try{localStorage.setItem('tn2_rec',JSON.stringify(Object.assign({},this.rec,{shots:undefined})));}catch(e){
    /* too big for the browser storage: keep the newest part */
    try{const r=Object.assign({},this.rec,{shots:undefined,g:this.rec.g.slice(-20000),f:this.rec.f.slice(-6000)});localStorage.setItem('tn2_rec',JSON.stringify(r));}catch(e2){}
  }
};
TN.Rec.prototype.stop=function(){
  if(!this.rec) return null;
  clearInterval(this.timer);this.rec.dur=this.t();
  const r=this.rec;this.rec=null;
  try{localStorage.removeItem('tn2_rec');}catch(e){}
  return r;
};
TN.Rec.prototype.saved=function(){try{const s=localStorage.getItem('tn2_rec');return s?JSON.parse(s):null;}catch(e){return null;}};

/* ---------- upload (same encryption and repository as the main app) ---------- */
TN.up={
  get:k=>{try{return localStorage.getItem('up:'+k)||'';}catch(e){return '';}},
  b64:bytes=>{let s='';const c=0x8000;for(let i=0;i<bytes.length;i+=c) s+=String.fromCharCode.apply(null,bytes.subarray(i,i+c));return btoa(s);},
  async gzip(bytes){if(typeof CompressionStream==='undefined') return null;
    const out=new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')));return new Uint8Array(await out.arrayBuffer());},
  async encrypt(obj,pass){
    let data=new TextEncoder().encode(JSON.stringify(obj)),gz=false;
    try{const z=await TN.up.gzip(data);if(z){data=z;gz=true;}}catch(e){}
    const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
    const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);
    const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:salt,iterations:200000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt']);
    const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:iv},key,data));
    return JSON.stringify({v:1,alg:'AES-256-GCM',kdf:'PBKDF2-SHA256',iter:200000,gz:gz,salt:TN.up.b64(salt),iv:TN.up.b64(iv),data:TN.up.b64(ct)});
  },
  name(trip){const d=new Date(trip.start),p=n=>String(n).padStart(2,'0');
    return 'trip-'+d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'-'+p(d.getHours())+p(d.getMinutes())+'-v2';},
  async upload(trip){
    const token=TN.up.get('token'),pass=TN.up.get('pass'),repo=TN.up.get('repo')||'Tessynav/tessynav-trips';
    if(!token||!pass) throw new Error('Upload is not set up in this browser yet. Open the main TessyNav once and use Trips → Setup.');
    const body=await TN.up.encrypt(trip,pass);
    let name=TN.up.name(trip);
    const put=n=>fetch('https://api.github.com/repos/'+repo+'/contents/trips/'+n+'.json',{method:'PUT',
      headers:{'Accept':'application/vnd.github+json','Content-Type':'application/json','Authorization':'Bearer '+token},
      body:JSON.stringify({message:'Trip '+n,content:btoa(body)})});
    let r=await put(name);
    for(let i=0;i<3&&r.status===422;i++){name=TN.up.name(trip)+'-'+Math.random().toString(36).slice(2,5);r=await put(name);}
    if(!r.ok) throw new Error('GitHub '+r.status);
    return name;
  }
};
