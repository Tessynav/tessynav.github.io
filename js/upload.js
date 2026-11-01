/* TessyNav upload v2: trips encrypted in the browser (AES-256-GCM), uploaded to GitHub, plus short-code pairing for the car */
const UP_DEFAULT_REPO='Tessynav/tessynav-trips';
function upGet(k){try{return localStorage.getItem('up:'+k)||'';}catch(e){return '';}}
function upSet(k,v){try{localStorage.setItem('up:'+k,v);}catch(e){}}
function upB64(bytes){let s='';const c=0x8000;for(let i=0;i<bytes.length;i+=c) s+=String.fromCharCode.apply(null,bytes.subarray(i,i+c));return btoa(s);}
function upUnB64(s){const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++) u[i]=b.charCodeAt(i);return u;}
async function upGzip(bytes){
  if(typeof CompressionStream==='undefined') return null;
  const out=new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')));
  return new Uint8Array(await out.arrayBuffer());
}
async function upGunzip(bytes){
  const out=new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')));
  return new Uint8Array(await out.arrayBuffer());
}
async function upKey(pass,salt,iter,use){
  const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt:salt,iterations:iter,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,[use]);
}
async function upEncrypt(obj,pass){
  let data=new TextEncoder().encode(JSON.stringify(obj)),gz=false;
  try{const z=await upGzip(data);if(z){data=z;gz=true;}}catch(e){}
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await upKey(pass,salt,200000,'encrypt');
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:iv},key,data));
  return JSON.stringify({v:1,alg:'AES-256-GCM',kdf:'PBKDF2-SHA256',iter:200000,gz:gz,salt:upB64(salt),iv:upB64(iv),data:upB64(ct)});
}
async function upDecrypt(text,pass){
  const e=JSON.parse(text);
  const key=await upKey(pass,upUnB64(e.salt),e.iter,'decrypt');
  let pt=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:upUnB64(e.iv)},key,upUnB64(e.data)));
  if(e.gz) pt=await upGunzip(pt);
  return JSON.parse(new TextDecoder().decode(pt));
}
function upHeaders(token){
  const h={'Accept':'application/vnd.github+json','Content-Type':'application/json'};
  if(token) h['Authorization']='Bearer '+token;
  return h;
}
function upName(trip){
  const d=new Date(trip.start),p=n=>String(n).padStart(2,'0');
  return 'trip-'+d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'-'+p(d.getHours())+p(d.getMinutes());
}
async function upPut(repo,token,path,body,msg){
  return fetch('https://api.github.com/repos/'+repo+'/contents/'+path,{method:'PUT',headers:upHeaders(token),
    body:JSON.stringify({message:msg,content:btoa(body)})});
}

/* ---------- Upload a trip ---------- */
async function uploadTrip(trip){
  const token=upGet('token'),pass=upGet('pass'),repo=upGet('repo')||UP_DEFAULT_REPO;
  if(!token||!pass){upSetup(()=>uploadTrip(trip));return;}
  if(!window.crypto||!crypto.subtle){showPanel('This browser cannot encrypt trips.',[['Close',hidePanel]]);return;}
  showPanel('Encrypting and uploading…<br><small>Long trips can take a minute.</small>',[]);
  try{
    const body=await upEncrypt(trip,pass);
    let name=upName(trip),r=await upPut(repo,token,'trips/'+name+'.json',body,'Trip '+name);
    for(let i=0;i<3&&r.status===422;i++){
      name=upName(trip)+'-'+Math.random().toString(36).slice(2,5);
      r=await upPut(repo,token,'trips/'+name+'.json',body,'Trip '+name);
    }
    if(!r.ok){const t=await r.text();throw new Error(r.status+' '+t.slice(0,120));}
    showPanel('Uploaded! Trip name:<br><b style="font-size:20px">'+name+'</b><br><small>Send this name to Claude to analyze it.</small>',[['Close',hidePanel]]);
  }catch(e){
    showPanel('Upload failed:<br><small>'+String(e.message||e).replace(/</g,'&lt;')+'</small>',[['Setup',()=>upSetup()],['Close',hidePanel]]);
  }
}

/* ---------- Setup ---------- */
function upInputStyle(){return 'display:block;width:260px;max-width:80vw;margin:8px auto;padding:8px;font-size:15px;border-radius:8px;border:0';}
function upSetup(after){
  const st=upInputStyle();
  showPanel('<b>Trip upload setup</b><br><small>Saved only in this browser. Trips are encrypted with your password before upload.</small>'+
    '<input id="up-repo" placeholder="owner/repository" style="'+st+'">'+
    '<input id="up-token" type="password" placeholder="GitHub token (github_pat_…)" style="'+st+'">'+
    '<input id="up-pass" type="password" placeholder="Trip password" style="'+st+'">',
    [['Save',()=>{
      upSet('repo',document.getElementById('up-repo').value.trim()||UP_DEFAULT_REPO);
      upSet('token',document.getElementById('up-token').value.trim());
      upSet('pass',document.getElementById('up-pass').value);
      hidePanel();if(after) after();
    }],['Share to car',upShareSetup],['Use car code',upUseCode],['Close',hidePanel]]);
  document.getElementById('up-repo').value=upGet('repo')||UP_DEFAULT_REPO;
  document.getElementById('up-token').value=upGet('token');
  document.getElementById('up-pass').value=upGet('pass');
}

/* ---------- Pairing: share the setup to the car with a short code ---------- */
async function upShareSetup(){
  const token=upGet('token'),pass=upGet('pass'),repo=upGet('repo')||UP_DEFAULT_REPO;
  if(!token||!pass){showPanel('Save your token and password first.',[['Setup',()=>upSetup()],['Close',hidePanel]]);return;}
  const chars='abcdefghjkmnpqrstuvwxyz23456789';
  const code=Array.from(crypto.getRandomValues(new Uint8Array(6))).map(b=>chars[b%chars.length]).join('');
  showPanel('Creating car code…',[]);
  try{
    const body=await upEncrypt({repo:repo,token:token},pass);
    const r=await upPut(repo,token,'setup/'+code+'.json',body,'Setup code');
    if(!r.ok) throw new Error('error '+r.status);
    showPanel('Car code:<br><b style="font-size:30px;letter-spacing:4px">'+code+'</b><br><small>In Tessy: ☁ Trips → Setup → Use car code.<br>Type this code and your trip password.</small>',[['Close',hidePanel]]);
  }catch(e){showPanel('Could not create the code: '+String(e.message||e),[['Close',hidePanel]]);}
}
function upUseCode(){
  const st=upInputStyle();
  showPanel('<b>Use car code</b><br><small>Created on your phone with "Share to car".</small>'+
    '<input id="up-code" placeholder="6-character code" autocapitalize="off" style="'+st+'">'+
    '<input id="up-cpass" type="password" placeholder="Trip password" style="'+st+'">',
    [['Connect',async()=>{
      const code=document.getElementById('up-code').value.trim().toLowerCase();
      const pass=document.getElementById('up-cpass').value;
      const repo=upGet('repo')||UP_DEFAULT_REPO;
      if(!code||!pass) return;
      showPanel('Connecting…',[]);
      try{
        const r=await fetch('https://api.github.com/repos/'+repo+'/contents/setup/'+code+'.json',{headers:upHeaders(null)});
        if(!r.ok) throw new Error(r.status===404?'code not found':'error '+r.status);
        const j=await r.json();
        const s=await upDecrypt(atob(j.content.replace(/\n/g,'')),pass);
        upSet('repo',s.repo);upSet('token',s.token);upSet('pass',pass);
        try{
          await fetch('https://api.github.com/repos/'+s.repo+'/contents/setup/'+code+'.json',{method:'DELETE',headers:upHeaders(s.token),
            body:JSON.stringify({message:'Remove setup code',sha:j.sha})});
        }catch(e){}
        showPanel('Connected! This device can now upload trips.',[['Close',hidePanel]]);
      }catch(e){
        const msg=e&&e.name==='OperationError'?'wrong password':String(e.message||e);
        showPanel('Could not connect: '+msg,[['Try again',upUseCode],['Close',hidePanel]]);
      }
    }],['Close',hidePanel]]);
}

/* ---------- Stop recording: now with an Upload button ---------- */
recStop=function(){
  if(!rec) return;
  clearInterval(recTimer);
  rec.dur=recT();
  const trip=rec;rec=null;recLabel();
  try{localStorage.removeItem('rec:current');}catch(e){}
  const saved=saveTrip(trip);
  showPanel('Trip recorded: '+mmss(trip.dur)+' · '+trip.g.length+' GPS points'+(saved?'':'<br><b>Not enough space to keep it here, upload or download it now.</b>'),
    [['Upload',()=>uploadTrip(trip)],['Download',()=>downloadTrip(trip)],
     ['Replay',()=>{location.href=location.pathname+'?replay='+encodeURIComponent('rec:trip:'+trip.start);}],['Close',hidePanel]]);
};

/* ---------- ☁ Trips: upload any saved trip, and the setup ---------- */
const upBtn=document.createElement('button');
upBtn.className='hud';upBtn.textContent='☁ Trips';
upBtn.style.cssText='top:340px;left:12px;font-size:13px;border:0;cursor:pointer';
if(!REPLAY) document.body.appendChild(upBtn);
upBtn.onclick=()=>{
  const list=(cacheGet('rec:list')||[]).slice().reverse();
  const buttons=list.map(t=>['☁ '+tripName(t),()=>{const trip=loadTrip(t.key);if(trip) uploadTrip(trip);}]);
  buttons.push(['Setup',()=>upSetup()]);
  buttons.push(['Close',hidePanel]);
  showPanel('<b>Upload a saved trip</b>'+(list.length?'':'<br><small>No saved trips yet.</small>'),buttons);
};
/* Auto-upload: after Stop, the trip uploads by itself when upload is set up on this device */
recStop=function(){
  if(!rec) return;
  clearInterval(recTimer);
  rec.dur=recT();
  const trip=rec;rec=null;recLabel();
  try{localStorage.removeItem('rec:current');}catch(e){}
  const saved=saveTrip(trip);
  if(upGet('token')&&upGet('pass')){uploadTrip(trip);return;}
  showPanel('Trip recorded: '+mmss(trip.dur)+' · '+trip.g.length+' GPS points'+(saved?'':'<br><b>Not enough space to keep it here, upload or download it now.</b>'),
    [['Upload',()=>uploadTrip(trip)],['Download',()=>downloadTrip(trip)],
     ['Replay',()=>{location.href=location.pathname+'?replay='+encodeURIComponent('rec:trip:'+trip.start);}],['Close',hidePanel]]);
};

/* Auto-update: if a newer version is published, load it (never in the middle of a drive) */
(function(){
  if(typeof REPLAY!=='undefined'&&REPLAY) return;
  const mine=[...document.querySelectorAll('script[src]')].map(s=>s.getAttribute('src')).join('|');
  let updBtn=null;
  function reloadNew(){location.replace(location.pathname+'?r='+Date.now());}
  async function check(){
    try{
      const r=await fetch(location.pathname+'?check='+Date.now(),{cache:'no-store'});
      if(!r.ok) return;
      const html=await r.text();
      const srcs=[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m=>m[1]).join('|');
      if(!srcs||srcs===mine) return;
      const busy=(typeof rec!=='undefined'&&rec)||(typeof watchId!=='undefined'&&watchId!==null);
      if(!busy){reloadNew();return;}
      if(!updBtn){
        updBtn=document.createElement('button');
        updBtn.className='hud';updBtn.textContent='↻ Update ready';
        updBtn.style.cssText='top:12px;left:50%;transform:translateX(-50%);font-size:14px;border:0;cursor:pointer;z-index:9;color:#7fe3d4';
        updBtn.onclick=()=>{if(typeof rec!=='undefined'&&rec){showPanel('Stop the recording first, then update.',[['Close',hidePanel]]);return;}reloadNew();};
        document.body.appendChild(updBtn);
      }
    }catch(e){}
  }
  setTimeout(check,5000);
  setInterval(check,10*60*1000);
})();
