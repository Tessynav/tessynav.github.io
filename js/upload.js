/* TessyNav upload v1: trips encrypted in the browser (AES-256-GCM) and uploaded to a GitHub repository */
const UP_DEFAULT_REPO='Tessynav/tessynav-trips';
function upGet(k){try{return localStorage.getItem('up:'+k)||'';}catch(e){return '';}}
function upSet(k,v){try{localStorage.setItem('up:'+k,v);}catch(e){}}
function upB64(bytes){let s='';const c=0x8000;for(let i=0;i<bytes.length;i+=c) s+=String.fromCharCode.apply(null,bytes.subarray(i,i+c));return btoa(s);}
async function upGzip(bytes){
  if(typeof CompressionStream==='undefined') return null;
  const out=new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')));
  return new Uint8Array(await out.arrayBuffer());
}
async function upEncrypt(trip,pass){
  const enc=new TextEncoder();
  let data=enc.encode(JSON.stringify(trip)),gz=false;
  try{const z=await upGzip(data);if(z){data=z;gz=true;}}catch(e){}
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const base=await crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:salt,iterations:200000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt']);
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:iv},key,data));
  return JSON.stringify({v:1,alg:'AES-256-GCM',kdf:'PBKDF2-SHA256',iter:200000,gz:gz,salt:upB64(salt),iv:upB64(iv),data:upB64(ct)});
}
function upName(trip){
  const d=new Date(trip.start),p=n=>String(n).padStart(2,'0');
  return 'trip-'+d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'-'+p(d.getHours())+p(d.getMinutes());
}
async function upPut(repo,token,name,body){
  return fetch('https://api.github.com/repos/'+repo+'/contents/trips/'+name+'.json',{
    method:'PUT',
    headers:{'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','Content-Type':'application/json'},
    body:JSON.stringify({message:'Trip '+name,content:btoa(body)})
  });
}
async function uploadTrip(trip){
  const token=upGet('token'),pass=upGet('pass'),repo=upGet('repo')||UP_DEFAULT_REPO;
  if(!token||!pass){upSetup(()=>uploadTrip(trip));return;}
  if(!window.crypto||!crypto.subtle){showPanel('This browser cannot encrypt trips.',[['Close',hidePanel]]);return;}
  showPanel('Encrypting and uploading…<br><small>Long trips can take a minute.</small>',[]);
  try{
    const body=await upEncrypt(trip,pass);
    let name=upName(trip),r=await upPut(repo,token,name,body);
    for(let i=0;i<3&&r.status===422;i++){
      name=upName(trip)+'-'+Math.random().toString(36).slice(2,5);
      r=await upPut(repo,token,name,body);
    }
    if(!r.ok){const t=await r.text();throw new Error(r.status+' '+t.slice(0,120));}
    showPanel('Uploaded! Trip name:<br><b style="font-size:20px">'+name+'</b><br><small>Send this name to Claude to analyze it.</small>',[['Close',hidePanel]]);
  }catch(e){
    showPanel('Upload failed:<br><small>'+String(e.message||e).replace(/</g,'&lt;')+'</small>',[['Setup',()=>upSetup()],['Close',hidePanel]]);
  }
}
function upSetup(after){
  const st='display:block;width:260px;max-width:80vw;margin:8px auto;padding:8px;font-size:15px;border-radius:8px;border:0';
  showPanel('<b>Trip upload setup</b><br><small>Saved only in this browser. Trips are encrypted with your password before upload.</small>'+
    '<input id="up-repo" placeholder="owner/repository" style="'+st+'">'+
    '<input id="up-token" type="password" placeholder="GitHub token (github_pat_…)" style="'+st+'">'+
    '<input id="up-pass" type="password" placeholder="Trip password" style="'+st+'">',
    [['Save',()=>{
      upSet('repo',document.getElementById('up-repo').value.trim()||UP_DEFAULT_REPO);
      upSet('token',document.getElementById('up-token').value.trim());
      upSet('pass',document.getElementById('up-pass').value);
      hidePanel();if(after) after();
    }],['Close',hidePanel]]);
  document.getElementById('up-repo').value=upGet('repo')||UP_DEFAULT_REPO;
  document.getElementById('up-token').value=upGet('token');
  document.getElementById('up-pass').value=upGet('pass');
}

/* Stop recording: now with an Upload button */
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

/* ☁ Trips: upload any saved trip, and the setup */
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
