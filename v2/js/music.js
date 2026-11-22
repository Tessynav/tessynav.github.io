/* MapKoon v2 — music.js (v9: never covers End route or the car; v7: the song shows up faster; v6: the key comes from the phone, nothing to type in the car; v5: "Use my own Spotify key": a 2-screen guide with a QR code to a help page; the key stays in this browser)
   A small music card beside the speed: the song playing on Spotify, with previous / play-pause / next. Tap the song
   to open the music panel: search, your playlists, recently played; tap a result and it plays on the car's Spotify
   (Spotify Connect). Login once with Spotify (PKCE, no secret anywhere). Spotify's free Web API: costs nothing,
   and nothing goes through Tesla. Needs Spotify Premium; Spotify limits a personal app to 5 users.
   Separate from the map and the car: if anything fails here, only the card is affected. ?music=0 switches it off. */
var TN=globalThis.TN||{};globalThis.TN=TN;
TN.SPOTIFY_ID='69e3fcb20ecc487da3512617ba29158f';   /* MapKoon's own key: works for the people invited to it (Spotify allows 5) */
TN.SPOTIFY_HELP='https://app.mapkoon.com/v2/spotify.html';
TN.Music=function(){
  this.on=typeof document!=='undefined'&&!/[?&]music=0/.test(location.search);
  if(!this.on) return;
  this.redirect=location.origin+location.pathname.replace(/[^/]*$/,'');   /* https://app.mapkoon.com/v2/ */
  this.tok=this.load();this.now=null;this.pollT=null;this.open=false;this.tab='search';
  this.ui();
  const q=new URLSearchParams(location.search);
  if(q.get('code')&&q.get('state')===this.ls('tn_sp_state')) this.finish(q.get('code'));
  else if(q.get('error')&&q.get('state')){this.clean();this.msg('Spotify login was cancelled.');}
  this.poll();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden) this.poll();});
};
/* storage (wrapped: the Tesla browser keeps it, private windows may not) */
TN.Music.prototype.ls=function(k,v){try{if(v===undefined) return localStorage.getItem(k);if(v===null) localStorage.removeItem(k);else localStorage.setItem(k,v);}catch(e){}return null;};
TN.Music.prototype.load=function(){try{return JSON.parse(this.ls('tn_sp_tok')||'null');}catch(e){return null;}};
TN.Music.prototype.save=function(t){this.tok=t;this.ls('tn_sp_tok',t?JSON.stringify(t):null);};
/* the key in use: the driver's own (Settings guide) or MapKoon's */
TN.Music.prototype.cid=function(){const c=this.ls('tn_sp_cid');return c&&/^[0-9a-f]{32}$/i.test(c)?c:TN.SPOTIFY_ID;};
TN.Music.prototype.own=function(){return this.cid()!==TN.SPOTIFY_ID;};
TN.Music.prototype.clean=function(){try{history.replaceState(null,'',location.pathname);}catch(e){}};
/* login: PKCE (code verifier stays in this browser) */
TN.Music.prototype.login=async function(){
  const rnd=n=>{const c='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',a=new Uint8Array(n);crypto.getRandomValues(a);return Array.from(a,b=>c[b%62]).join('');};
  const ver=rnd(64),st=rnd(16);
  const dg=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ver));
  const ch=btoa(String.fromCharCode(...new Uint8Array(dg))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  this.ls('tn_sp_ver',ver);this.ls('tn_sp_state',st);
  const p=new URLSearchParams({client_id:this.cid(),response_type:'code',redirect_uri:this.redirect,state:st,code_challenge_method:'S256',code_challenge:ch,
    scope:'user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private user-read-recently-played user-library-read'});
  location.href='https://accounts.spotify.com/authorize?'+p;
};
TN.Music.prototype.finish=async function(code){
  this.clean();
  try{const r=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({grant_type:'authorization_code',code:code,redirect_uri:this.redirect,client_id:this.cid(),code_verifier:this.ls('tn_sp_ver')||''})});
    const j=await r.json();if(!j.access_token) throw new Error(j.error_description||'no token');
    this.save({a:j.access_token,r:j.refresh_token,e:Date.now()+(j.expires_in-60)*1000,c:this.cid()});this.msg('Spotify connected'+(this.own()?' with your own key.':'.'));this.poll();
  }catch(e){this.msg('Spotify login failed: '+e.message);}
  this.ls('tn_sp_ver',null);this.ls('tn_sp_state',null);
};
TN.Music.prototype.access=async function(){
  if(!this.tok) return null;
  if(Date.now()<this.tok.e) return this.tok.a;
  try{const r=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({grant_type:'refresh_token',refresh_token:this.tok.r,client_id:this.tok.c||this.cid()})});
    const j=await r.json();if(!j.access_token){this.save(null);this.render();return null;}
    this.save({a:j.access_token,r:j.refresh_token||this.tok.r,e:Date.now()+(j.expires_in-60)*1000,c:this.tok.c});return this.tok.a;
  }catch(e){return null;}
};
/* one Web API call; returns {s: status, j: json or null} */
TN.Music.prototype.api=async function(path,opt){
  const a=await this.access();if(!a) return {s:401,j:null};
  try{const r=await fetch('https://api.spotify.com/v1'+path,Object.assign({},opt,{headers:Object.assign({Authorization:'Bearer '+a},opt&&opt.body?{'Content-Type':'application/json'}:{})}));
    let j=null;if(r.status!==204){try{j=await r.json();}catch(e){}}
    if(r.status===401){this.tok.e=0;}
    return {s:r.status,j:j};
  }catch(e){return {s:0,j:null};}
};
/* what's playing (see below for how often); nothing while the screen is off */
TN.Music.prototype.poll=async function(){
  clearTimeout(this.pollT);if(!this.tok||document.hidden){this.render();return;}
  const r=await this.api('/me/player?additional_types=episode');
  this.now=r.s===200&&r.j?r.j:null;
  /* a Spotify account not invited to MapKoon's key: Spotify answers 403; point to the own-key guide (once) */
  if(r.s===403&&!this.own()&&!this.told403){this.told403=true;this.msg('This Spotify account isn\u2019t invited to MapKoon\u2019s key. Tap \u2699 in the music panel \u2192 Use my own Spotify key.');}
  this.render();
  /* (v7, Nov 21: faster. While music plays: every 3 s (panel open) or 4 s, and right when the song ends (+0.4 s), so the
     next song shows up at once; paused or nothing playing: every 10 s. Spotify has no "tell me when it changes", only asking) */
  const N=this.now,play=!!(N&&N.is_playing);let wait=play?(this.open?3000:4000):10000;
  if(play&&N.item&&N.item.duration_ms&&N.progress_ms!=null){const left=N.item.duration_ms-N.progress_ms+400;if(left>300&&left<wait) wait=left;}
  this.pollT=setTimeout(()=>this.poll(),wait);
};
/* the car's Spotify (or whichever device is playing) */
TN.Music.prototype.device=async function(){
  if(this.now&&this.now.device) return this.now.device.id;
  const r=await this.api('/me/player/devices');const d=(r.j&&r.j.devices)||[];
  const pick=d.find(x=>x.is_active)||d.find(x=>/automobile/i.test(x.type)||/tesla|model/i.test(x.name))||d[0];
  return pick?pick.id:null;
};
TN.Music.prototype.cmd=async function(kind,body){
  const dev=await this.device();
  if(!dev){this.msg('Open Spotify on the car once (Tesla music → Spotify), then try again.');return;}
  const m={toggle:this.now&&this.now.is_playing?['PUT','/me/player/pause']:['PUT','/me/player/play'],next:['POST','/me/player/next'],prev:['POST','/me/player/previous'],play:['PUT','/me/player/play']}[kind];
  const r=await this.api(m[1]+'?device_id='+dev,{method:m[0],body:body?JSON.stringify(body):undefined});
  if(r.s===403) this.msg('Spotify refused this (it needs Premium, or Spotify limits this for new apps).');
  else if(r.s===404) this.msg('No Spotify player found. Open Spotify on the car, then try again.');
  setTimeout(()=>this.poll(),600);
};
/* ---------- screen ---------- */
TN.Music.prototype.ui=function(){
  const st=document.createElement('style');
  st.textContent='#tn-mus{left:240px;bottom:24px;display:flex;align-items:center;gap:10px;padding:8px 10px;max-width:min(420px,calc(100vw - 400px));height:44px;box-sizing:content-box}body.tn-routing #tn-mus{max-width:min(420px,calc(100vw - 530px))}'+
    '@media (max-width:700px){#tn-mus{left:16px;top:122px;bottom:auto;max-width:calc(100vw - 52px)}}'+
    '#tn-mus img{width:44px;height:44px;border-radius:8px;object-fit:cover;flex:none}#tn-mus .t{min-width:0;flex:1;cursor:pointer;line-height:1.25}'+
    '#tn-mus .t b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#tn-mus .t span{display:block;font-size:12px;opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
    '#tn-mus button,#tn-mpan button{background:none;border:0;color:inherit;cursor:pointer;padding:6px;border-radius:50%;flex:none}#tn-mus .pp{background:#1db954;color:#000;width:40px;height:40px}'+
    '#tn-mpan{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9;width:min(560px,calc(100vw - 32px));height:min(620px,calc(100vh - 80px));display:none;flex-direction:column;background:rgb(var(--tn-panel-rgb,24 26 30) / .97);color:var(--tn-text,#fff);border-radius:18px;box-shadow:0 10px 40px rgba(0,0,0,.45);font-family:system-ui,sans-serif;overflow:hidden}'+
    '#tn-mpan .hd{display:flex;gap:8px;align-items:center;padding:14px}#tn-mpan input{flex:1;font-size:17px;padding:10px 14px;border-radius:12px;border:0;background:rgba(127,127,127,.18);color:inherit;outline:none}'+
    '#tn-mpan .tabs{display:flex;gap:6px;padding:0 14px 8px}#tn-mpan .tabs button{border-radius:16px;padding:6px 14px;font-size:14px;background:rgba(127,127,127,.15)}#tn-mpan .tabs button.on{background:#1db954;color:#000}'+
    '#tn-mpan .ls{flex:1;overflow-y:auto;padding:0 8px 12px}#tn-mpan .it{display:flex;gap:12px;align-items:center;padding:8px;border-radius:10px;cursor:pointer}#tn-mpan .it:active{background:rgba(127,127,127,.2)}'+
    '#tn-mpan .it img{width:48px;height:48px;border-radius:6px;object-fit:cover;flex:none;background:#333}#tn-mpan .it div{min-width:0}#tn-mpan .it b{display:block;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#tn-mpan .it span{font-size:13px;opacity:.65}'+
    '#tn-mpan .dh{display:flex;align-items:center;gap:8px;padding:4px 6px 10px;position:sticky;top:0;background:rgb(var(--tn-panel-rgb,24 26 30));z-index:1}#tn-mpan .dh b{flex:1;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#tn-mpan .dh button{border-radius:16px;padding:7px 14px;font-size:14px;background:rgba(127,127,127,.18)}#tn-mpan .dh .pa{background:#1db954;color:#000;font-weight:600}'+
    '#tn-mpan .note{padding:20px;opacity:.7;text-align:center}#tn-mmsg{position:absolute;left:50%;bottom:90px;transform:translateX(-50%);z-index:10;background:rgba(20,20,24,.92);color:#fff;padding:10px 16px;border-radius:12px;font:14px system-ui,sans-serif;display:none;max-width:80vw;text-align:center}';
  document.head.appendChild(st);
  const ic={p:'<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',z:'<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
    n:'<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6l8.5 6L6 18zM16 6h2v12h-2z"/></svg>',b:'<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M18 6l-8.5 6 8.5 6zM6 6h2v12H6z"/></svg>'};
  this.ic=ic;
  const el=document.createElement('div');el.id='tn-mus';el.className='hud notr';document.body.appendChild(el);this.el=el;
  const pan=document.createElement('div');pan.id='tn-mpan';pan.className='notr';
  pan.innerHTML='<div class="hd"><input placeholder="Search songs, artists, podcasts" enterkeyhint="search"><button class="ky" aria-label="Spotify settings" style="font-size:20px">\u2699</button><button class="x" aria-label="Close"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>'+
    '<div class="tabs"><button data-t="search" class="on">Search</button><button data-t="lists">Playlists</button><button data-t="recent">Recent</button><button data-t="liked">Liked</button></div><div class="ls"></div>';
  document.body.appendChild(pan);this.pan=pan;
  const inp=pan.querySelector('input');let tm=null;
  inp.oninput=()=>{clearTimeout(tm);tm=setTimeout(()=>{this.detail=null;this.setTab('search');this.search(inp.value);},350);};
  pan.querySelector('.x').onclick=()=>this.close();
  pan.querySelector('.ky').onclick=()=>{this.close();this.choose();};
  pan.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{this.detail=null;this.setTab(b.dataset.t);this.list(b.dataset.t);});
  const m=document.createElement('div');m.id='tn-mmsg';document.body.appendChild(m);this.m=m;
  /* (v8, Nov 21: the player covered "End route" on some screens; v9: moving it up put it over the car, so now it first
     gets narrower to end just before the button (song title shortened), and only moves up if it would get too small) */
  setInterval(()=>{try{
    const E=this.el;if(!E||E.style.display==='none') return;
    if(document.body.classList.contains('tn-l1')&&innerWidth>=760) return;   /* (the Tesla layout places it in the bottom bar itself) */
    E.style.bottom='';E.style.top='';E.style.maxWidth='';
    const r=E.getBoundingClientRect();if(!r.width) return;
    let right=Infinity,lift=0;
    for(const id of ['tn-end','tn-ov','tn-stopbtn','tn-report']){const o=document.getElementById(id);if(!o||o===E) continue;
      const cs=getComputedStyle(o);if(cs.display==='none'||cs.visibility==='hidden') continue;const q=o.getBoundingClientRect();
      if(q.width&&q.left<r.right&&q.right>r.left&&q.top<r.bottom&&q.bottom>r.top&&q.top>innerHeight*0.45){
        if(q.left>r.left+240) right=Math.min(right,q.left-12);else lift=Math.max(lift,innerHeight-q.top+10);}}
    if(right<Infinity){const pad=r.width-E.clientWidth+20;E.style.maxWidth=Math.max(200,right-r.left-pad)+'px';}
    if(lift&&r.top>innerHeight*0.4){E.style.top='auto';E.style.bottom=lift+'px';}
  }catch(e){}},1000);
  this.render();
};
TN.Music.prototype.msg=function(t){if(!this.m) return;this.m.textContent=t;this.m.style.display='block';clearTimeout(this.mT);this.mT=setTimeout(()=>this.m.style.display='none',4500);};
TN.Music.prototype.render=function(){
  if(!this.el) return;const e=TN.esc||(s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])));
  if(!this.tok){this.el.innerHTML='<button class="pp" aria-label="Connect Spotify" style="width:auto;border-radius:20px;padding:0 14px;font:600 14px system-ui">♫ Connect Spotify</button>';
    this.el.querySelector('button').onclick=()=>this.choose();return;}
  const it=this.now&&this.now.item,pl=this.now&&this.now.is_playing;
  const img=it?((it.album||it.show||{}).images||[]).slice(-2)[0]:null;
  const title=it?it.name:'Nothing playing',sub=it?(it.artists?it.artists.map(a=>a.name).join(', '):(it.show?it.show.name:'')):'Tap to search Spotify';
  this.el.innerHTML=(img?'<img src="'+e(img.url)+'" alt="">':'')+'<div class="t"><b>'+e(title)+'</b><span>'+e(sub)+'</span></div>'+
    '<button class="b" aria-label="Previous">'+this.ic.b+'</button><button class="pp" aria-label="Play or pause">'+(pl?this.ic.z:this.ic.p)+'</button><button class="n" aria-label="Next">'+this.ic.n+'</button>';
  this.el.querySelector('.t').onclick=()=>this.show();
  this.el.querySelector('.b').onclick=()=>this.cmd('prev');this.el.querySelector('.pp').onclick=()=>this.cmd('toggle');this.el.querySelector('.n').onclick=()=>this.cmd('next');
};
TN.Music.prototype.show=function(){this.open=true;this.pan.style.display='flex';if(this.detail) this.openList(this.detail);else this.list(this.tab);this.poll();};
TN.Music.prototype.close=function(){this.open=false;this.pan.style.display='none';};
TN.Music.prototype.setTab=function(t){this.tab=t;this.pan.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));};
TN.Music.prototype.fill=function(items,note,head){
  const ls=this.pan.querySelector('.ls'),e=TN.esc||(s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])));
  const top=head?'<div class="dh"><button class="bk">\u2190 Back</button><b>'+e(head.t)+'</b><button class="pa">\u25b6 Play all</button></div>':'';
  if(!items||!items.length){ls.innerHTML=top+'<div class="note">'+e(note||'Nothing here yet.')+'</div>';}
  else ls.innerHTML=top+items.map((x,i)=>'<div class="it" data-i="'+i+'">'+(x.img?'<img src="'+e(x.img)+'" alt="">':'<img alt="">')+'<div><b>'+e(x.t)+'</b><span>'+e(x.s)+(x.open?' \u203a':'')+'</span></div></div>').join('');
  if(head){ls.querySelector('.bk').onclick=()=>{this.detail=null;this.list(this.tab);};
    ls.querySelector('.pa').onclick=()=>{this.cmd('play',{context_uri:head.ctx});this.msg('Playing: '+head.t);};}
  ls.querySelectorAll('.it').forEach(d=>d.onclick=()=>{const x=items[+d.dataset.i];
    if(x.open){this.openList(x);return;}
    /* a song inside a playlist or album plays from there, and the rest of the list follows */
    const body=x.inCtx?{context_uri:x.inCtx,offset:{uri:x.uri}}:x.ctx?{context_uri:x.ctx}:{uris:[x.uri]};
    this.cmd('play',body);this.msg('Playing: '+x.t);});
  ls.scrollTop=0;
};
/* open a playlist, artist, album or podcast: its songs first, then Play all or tap one */
TN.Music.prototype.openList=async function(x){
  this.detail=x;this.fill([],'Loading\u2026',x);
  const id=x.ctx.split(':').pop(),k=x.ctx.split(':')[1];let out=[],ok=false;
  const tr=(t,ctx)=>t&&t.uri&&{t:t.name,s:(t.artists||[]).map(a=>a.name).join(', ')||(t.show?t.show.name:''),img:tnImg(t.album||t),uri:t.uri,inCtx:ctx};
  if(k==='playlist'){for(const path of ['/playlists/'+id+'/items?limit=100','/playlists/'+id+'/tracks?limit=100']){
      const r=await this.api(path);if(r.s===200&&r.j){ok=true;out=(r.j.items||[]).map(i=>tr(i.track||i.item,x.ctx)).filter(Boolean);break;}}}
  else if(k==='album'){const r=await this.api('/albums/'+id+'/tracks?limit=50');if(r.s===200&&r.j){ok=true;out=(r.j.items||[]).map(t=>Object.assign(tr(t,x.ctx)||{},{img:x.img})).filter(o=>o.uri);}}
  else if(k==='artist'){const r=await this.api('/artists/'+id+'/top-tracks?market=from_token');if(r.s===200&&r.j){ok=true;out=(r.j.tracks||[]).map(t=>tr(t,null)).filter(Boolean);}}
  else if(k==='show'){const r=await this.api('/shows/'+id+'/episodes?limit=30&market=from_token');if(r.s===200&&r.j){ok=true;out=(r.j.items||[]).filter(Boolean).map(ep=>({t:ep.name,s:(ep.release_date||''),img:tnImg(ep)||x.img,uri:ep.uri}));}}
  if(this.detail!==x) return;   /* (closed or opened something else meanwhile) */
  this.fill(out,ok?'This list is empty.':'Spotify doesn\u2019t show this list to the app. Use Play all.',x);
};
const tnImg=o=>{const im=(o&&o.images)||[];return im.length?im[im.length-1].url:null;};
TN.Music.prototype.search=async function(q){
  q=(q||'').trim();if(q.length<2){this.fill([],'Type a song, an artist or a podcast.');return;}
  const r=await this.api('/search?type=track,artist,playlist,show&limit=6&q='+encodeURIComponent(q));
  if(r.s!==200||!r.j){this.fill([],r.s===403?'Spotify doesn’t allow search for this app yet.':'Search didn’t work. Check the connection.');return;}
  const j=r.j,out=[];
  ((j.artists&&j.artists.items)||[]).slice(0,2).forEach(a=>a&&out.push({t:a.name,s:'Artist',img:tnImg(a),ctx:a.uri,open:true}));
  ((j.tracks&&j.tracks.items)||[]).forEach(t=>t&&out.push({t:t.name,s:t.artists.map(a=>a.name).join(', '),img:tnImg(t.album),uri:t.uri}));
  ((j.playlists&&j.playlists.items)||[]).slice(0,3).forEach(p=>p&&out.push({t:p.name,s:'Playlist',img:tnImg(p),ctx:p.uri,open:true}));
  ((j.shows&&j.shows.items)||[]).slice(0,2).forEach(p=>p&&out.push({t:p.name,s:'Podcast',img:tnImg(p),ctx:p.uri,open:true}));
  this.fill(out,'No results.');
};
TN.Music.prototype.list=async function(t){
  if(t==='search'){this.search(this.pan.querySelector('input').value);return;}
  this.fill([],'Loading…');
  if(t==='lists'){const r=await this.api('/me/playlists?limit=40');this.fill(((r.j&&r.j.items)||[]).filter(Boolean).map(p=>({t:p.name,s:(p.tracks&&p.tracks.total!=null?p.tracks.total+' songs':(p.items&&p.items.total!=null?p.items.total+' songs':'Playlist')),img:tnImg(p),ctx:p.uri,open:true})),r.s===200?'No playlists.':'Spotify doesn’t allow this for the app yet.');}
  else if(t==='recent'){const r=await this.api('/me/player/recently-played?limit=30');const seen=new Set();
    this.fill(((r.j&&r.j.items)||[]).map(x=>x.track).filter(x=>x&&!seen.has(x.id)&&seen.add(x.id)).map(x=>({t:x.name,s:x.artists.map(a=>a.name).join(', '),img:tnImg(x.album),uri:x.uri})),r.s===200?'Nothing played recently.':'Spotify doesn’t allow this for the app yet.');}
  else if(t==='liked'){const r=await this.api('/me/tracks?limit=40');
    this.fill(((r.j&&r.j.items)||[]).map(x=>x.track).filter(Boolean).map(x=>({t:x.name,s:x.artists.map(a=>a.name).join(', '),img:tnImg(x.album),uri:x.uri})),r.s===200?'No liked songs.':'Spotify doesn’t allow this for the app yet.');}
};
/* ---------- Spotify key: choose, guide, paste ---------- */
TN.Music.prototype.box=function(html,btns){
  let d=document.getElementById('tn-mkey');
  if(!d){d=document.createElement('div');d.id='tn-mkey';d.className='notr';document.body.appendChild(d);
    const st=document.createElement('style');
    st.textContent='#tn-mkey{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:31;width:min(600px,calc(100vw - 32px));max-height:calc(100vh - 40px);overflow:auto;box-sizing:border-box;background:rgb(var(--tn-panel-rgb,24 26 30) / .98);color:var(--tn-text,#fff);border-radius:18px;box-shadow:0 10px 40px rgba(0,0,0,.45);font:15px/1.45 system-ui,sans-serif;padding:20px 22px}'+
      '#tn-mkey h3{margin:0 0 4px;font-size:20px;display:flex;align-items:center;gap:10px}#tn-mkey .sp{width:26px;height:26px;border-radius:50%;background:#1db954;color:#000;display:inline-flex;align-items:center;justify-content:center;font-size:15px;flex:none}'+
      '#tn-mkey .sub{opacity:.7;font-size:14px;margin-bottom:12px}#tn-mkey .st{display:flex;gap:12px;margin:10px 0}#tn-mkey .n{flex:none;width:26px;height:26px;border-radius:50%;background:#2f6fe4;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px}'+
      '#tn-mkey code{background:rgba(127,127,127,.2);padding:2px 7px;border-radius:6px;font-size:13.5px;word-break:break-all}#tn-mkey .qr .pc{font:700 17px ui-monospace,monospace;letter-spacing:.12em;color:#111;text-align:center;margin-top:4px}#tn-mkey .qr{float:right;margin:0 0 8px 14px;background:#fff;padding:8px;border-radius:10px;line-height:0;text-align:center}#tn-mkey .qr small{display:block;color:#333;font-size:11px;line-height:1.3;margin-top:4px}'+
      '#tn-mkey input{width:100%;box-sizing:border-box;font:16px ui-monospace,monospace;padding:12px 14px;border-radius:12px;border:2px solid #2f6fe4;background:rgba(127,127,127,.12);color:inherit;margin-top:6px;outline:none}'+
      '#tn-mkey .bt{display:flex;gap:10px;margin-top:16px;clear:both}#tn-mkey .bt button{flex:1;border:0;border-radius:14px;padding:12px;font:700 15px system-ui;cursor:pointer;background:rgba(127,127,127,.2);color:inherit}#tn-mkey .bt button.g{background:#1db954;color:#000}#tn-mkey .bt button:disabled{opacity:.4}'+
      '#tn-mkey .ok{font-size:14px;margin-top:8px;min-height:20px}#tn-mkey .cp{border:0;background:#2f6fe4;color:#fff;border-radius:10px;padding:2px 9px;font:600 12px system-ui;margin-left:6px;cursor:pointer}';
    document.head.appendChild(st);}
  d.innerHTML=html+'<div class="bt">'+btns.map((b,i)=>'<button data-i="'+i+'"'+(b[2]?' class="'+b[2]+'"':'')+'>'+b[0]+'</button>').join('')+'</div>';
  d.querySelectorAll('.bt button').forEach(x=>x.onclick=()=>btns[+x.dataset.i][1]());
  d.style.display='block';return d;
};
TN.Music.prototype.unbox=function(){const d=document.getElementById('tn-mkey');if(d) d.style.display='none';};
TN.Music.prototype.choose=function(){
  const own=this.own(),hd='<h3><span class="sp">♫</span>Spotify</h3>';
  if(this.tok) this.box(hd+'<div class="sub">Connected'+(own?' with <b>your own key</b>.':' with MapKoon’s key.')+'</div>',
      [[own?'Change my key':'Use my own Spotify key',()=>this.guide(1)],['Disconnect',()=>{this.save(null);this.now=null;this.render();this.unbox();this.msg('Spotify disconnected.');}],['Close',()=>this.unbox()]]);
  else this.box(hd+'<div class="sub">Control Spotify from MapKoon: what’s playing, search, your playlists. Needs <b>Spotify Premium</b>.</div>'+
      (own?'<div>Your own key is saved. Tap <b>Connect</b> to log in to Spotify.</div>':'<div><b>Use my own Spotify key</b> works for everyone (about 5 minutes, once). <b>Quick connect</b> only works for Spotify accounts invited to MapKoon.</div>'),
      own?[['Connect',()=>{this.unbox();this.login();},'g'],['Change my key',()=>this.guide(1)],['Remove my key',()=>{this.ls('tn_sp_cid',null);this.choose();}],['Cancel',()=>this.unbox()]]
         :[['Use my own Spotify key',()=>this.guide(1),'g'],['Quick connect',()=>{this.unbox();this.login();}],['Cancel',()=>this.unbox()]]);
};
/* (v6, Nov 21: no typing in the car. The guide shows a 6-character code; the QR opens the help page on the phone with
   that code already in it; after creating the Spotify app, the driver pastes the Client ID on the phone and taps
   "Send to my car". The car checks every 3 s while the guide is open, fills it in and connects. Typing stays possible) */
TN.Music.prototype.pairStart=function(){
  if(!this.pair){const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',a=new Uint8Array(6);crypto.getRandomValues(a);this.pair=Array.from(a,b=>A[b%A.length]).join('');this.pairT0=Date.now();}
  clearInterval(this.pairTimer);
  this.pairTimer=setInterval(async()=>{
    const bx=document.getElementById('tn-mkey');if(!bx||bx.style.display==='none'||Date.now()-this.pairT0>10*60e3){clearInterval(this.pairTimer);this.pairTimer=null;if(Date.now()-this.pairT0>10*60e3) this.pair=null;return;}
    try{const r=await fetch((TN.TESLA_SERVER||'https://tessynav.mznwattar.workers.dev')+'/pair?code='+this.pair);const j=await r.json();
      if(j&&j.v&&/^[0-9a-f]{32}$/i.test(j.v)){clearInterval(this.pairTimer);this.pairTimer=null;this.pair=null;this.got=j.v.toLowerCase();this.guide(2);}}catch(e){}
  },3000);
};
TN.Music.prototype.pairUrl=function(){return TN.SPOTIFY_HELP+'?pair='+this.pair;};
/* screen 1: the steps, with a QR code that opens the help page on the phone (easier than typing in the car) */
TN.Music.prototype.guide=function(step){
  const red=this.redirect,copy=t=>{try{navigator.clipboard.writeText(t);this.msg('Copied.');}catch(e){}};
  this.pairStart();
  if(step===1){
    const d=this.box('<h3><span class="sp">♫</span>Connect your own Spotify</h3><div class="sub">For search and playlists. About 5 minutes, once. Needs Spotify Premium.</div>'+
      '<div class="qr" id="tn-mqr"><small>Scan with<br>your phone</small><div class="pc">'+this.pair+'</div></div>'+
      '<div class="st"><div class="n">1</div><div>On your phone, scan the code (or open <b>developer.spotify.com/dashboard</b>) and log in with your Spotify account. Accept the terms.</div></div>'+
      '<div class="st"><div class="n">2</div><div>Tap <b>Create app</b>. Name: <code>MapKoon</code><br>Can’t see it? Browser menu → <b>Desktop site</b>.</div></div>'+
      '<div class="st"><div class="n">3</div><div>Redirect URI: <code>'+red+'</code><button class="cp" data-c="1">Copy</button><br>Tick <b>Web API</b>, then <b>Save</b>.</div></div>'+
      '<div class="st"><div class="n">4</div><div>Copy the <b>Client ID</b> (app <b>Settings</b>), paste it on the phone page and tap <b>Send to my car</b>. It appears here by itself, nothing to type.<br><span style="opacity:.7;font-size:13px">Never the Client Secret: it isn’t needed.</span></div></div>',
      [['Type it instead',()=>this.guide(2)],['Cancel',()=>this.unbox()]]);
    d.querySelector('[data-c]').onclick=()=>copy(red);
    const draw=()=>{const q=document.getElementById('tn-mqr');if(!q||typeof qrcode!=='function') return;
      const g=qrcode(0,'M');g.addData(this.pairUrl());g.make();q.insertAdjacentHTML('afterbegin',g.createSvgTag(4,0));};
    if(typeof qrcode==='function') draw();
    else{const s=document.createElement('script');s.src='js/qr.js?v=1';s.onload=draw;document.head.appendChild(s);}
    return;}
  /* screen 2: paste and connect (checked before it goes to Spotify) */
  const d=this.box('<h3><span class="sp">♫</span>Paste your Client ID</h3><div class="sub">Step 5 of 5</div>'+
    '<div>Paste the Client ID from your Spotify app:</div><input id="tn-mcid" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="32 letters and numbers">'+
    '<div class="ok" id="tn-mok"></div><div style="font-size:12.5px;opacity:.65;margin-top:8px">Your key is saved only in this browser. MapKoon never sees your Spotify password: you log in on Spotify’s own page. Remove it any time with ⚙ in the music panel.</div>',
    [['Back',()=>this.guide(1)],['Connect Spotify',()=>{const v=inp.value.trim();if(!/^[0-9a-f]{32}$/i.test(v)) return;
      this.ls('tn_sp_cid',v.toLowerCase());this.save(null);this.unbox();this.login();},'g']]);
  const inp=d.querySelector('#tn-mcid'),ok=d.querySelector('#tn-mok'),go=d.querySelector('.bt .g');
  const chk=()=>{const v=inp.value.trim();const good=/^[0-9a-f]{32}$/i.test(v);go.disabled=!good;
    ok.style.color=good?'#7ee2a0':'#ffb4a8';
    ok.textContent=!v?'':good?'✓ Looks right (32 letters and numbers)':v.length!==32?'That’s '+v.length+' characters; a Client ID has 32.':'Only letters a–f and numbers 0–9.';};
  inp.oninput=chk;const cur=this.ls('tn_sp_cid');if(cur) inp.value=cur;
  if(this.got){inp.value=this.got;this.got=null;chk();ok.textContent='✓ Received from your phone. Connecting…';
    setTimeout(()=>{if(!go.disabled) go.click();},1200);return;}
  chk();setTimeout(()=>{try{inp.focus();}catch(e){}},50);
};
if(typeof document!=='undefined') TN.music=new TN.Music();
