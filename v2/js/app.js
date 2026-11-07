/* TessyNav v2 — app.js: buttons, GPS, road loading and the main loop */
var TN=globalThis.TN||{};globalThis.TN=TN;
TN.VERSION='v2 step 1';
/* the build number written inside this file: the Version button shows it, so a wrong upload is easy to spot */
TN.APPBUILD=72;

(function(){
  const $=id=>document.getElementById(id);
  const start=(()=>{try{return JSON.parse(localStorage.getItem('lastPos'))||TN.ORIGIN;}catch(e){return TN.ORIGIN;}})();
  const map=new maplibregl.Map({container:'map',style:'https://tiles.openfreemap.org/styles/liberty',center:start,zoom:17,pitch:60,maxPitch:85,
    fadeDuration:0,pixelRatio:1,
    attributionControl:{customAttribution:'Roads: © OpenStreetMap contributors'}});
  const net=new TN.Net(),track=new TN.Track(net),scene=new TN.Scene(map,net),rec=new TN.Rec();
  const trees=TN.Trees?new TN.Trees(scene,net):null;
  const buildings=TN.Buildings?new TN.Buildings(scene,net):null;
  const rem=TN.Rem?new TN.Rem(scene,net):null;
  const season=TN.Season?new TN.Season(scene,trees):null;
  const ground=TN.Ground?new TN.Ground(scene,net,trees,season):null;   /* fallen leaves, snowy ground and car */
  const water=TN.Water?new TN.Water(scene):null;
  /* the settings menu (gear button) */
  const settings=TN.Settings?new TN.Settings({scene:scene,trees:trees,buildings:buildings,water:water,season:season,rem:rem,night:()=>night()}):null;
  if(settings){try{settings.build();}catch(e){}}
  /* navigation: search, route, directions */
  const nav=TN.Nav?new TN.Nav({map:map,scene:scene,net:net,getCar:()=>track.car,
    gps:()=>track.last?{x:track.last.x,z:track.last.z,v:track.last.v,hd:track.hd,t:track.last.t,raw:track.last.hd}:null,gpsHd:()=>track.hd,note:(k,d,sh)=>{if(rec&&rec.rec) rec.note(k,d,sh);},
    setFollow:b=>{if(b){if(typeof startFollow==='function') startFollow();}else{follow=false;$('btn').textContent='Recenter';}}}):null;
  if(nav){try{nav.build();}catch(e){}}
  /* road incidents with Rocco (TomTom) */
  /* shadows that follow the real sun (buildings and the car), and the car's soft contact shadow */
  TN.shadows=TN.Shadows?new TN.Shadows(scene):null;
  const incidents=TN.Incidents?new TN.Incidents({map:map,scene:scene,nav:nav,net:net,getCar:()=>track.car,following:()=>follow,roadsBase:'https://tessynav.github.io/tessynav-roads/',note:(k,d)=>{if(rec&&rec.rec) rec.note(k,d);}}):null;
  if(incidents){try{incidents.build();}catch(e){}}
  /* real weather (sky, rain, snow, fog, wet roads) */
  const weather=TN.Weather?new TN.Weather(scene,season):null;
  if(weather&&TN.settings&&TN.settings.weather===false) weather.setOn(false);
  if(settings) settings.m.weather=weather;
  /* long-press anywhere on the map: drop a pin there (then Go) */
  try{let lp=null;const cv=map.getCanvasContainer();
   const down=e=>{if(nav&&nav.active) return;const pt=e.touches?e.touches[0]:e;if(e.touches&&e.touches.length>1){lp&&clearTimeout(lp.t);lp=null;return;}
     const r=cv.getBoundingClientRect(),x=pt.clientX-r.left,y=pt.clientY-r.top;
     lp&&clearTimeout(lp.t);lp={x:x,y:y,t:setTimeout(()=>{const ll=map.unproject([x,y]);if(nav) nav.dropAt(ll.lng,ll.lat);lp=null;},650)};};
   const move=e=>{if(!lp) return;const pt=e.touches?e.touches[0]:e,r=cv.getBoundingClientRect();if(Math.hypot(pt.clientX-r.left-lp.x,pt.clientY-r.top-lp.y)>12){clearTimeout(lp.t);lp=null;}};
   const up=()=>{if(lp){clearTimeout(lp.t);lp=null;}};
   cv.addEventListener('touchstart',down,{passive:true});cv.addEventListener('touchmove',move,{passive:true});cv.addEventListener('touchend',up);
   cv.addEventListener('mousedown',down);cv.addEventListener('mousemove',move);cv.addEventListener('mouseup',up);}catch(e){}
  TN.app={map:map,net:net,track:track,scene:scene,rec:rec};
  const brk={t:0,v:0,d:0,k:0,moved:0};let lastFollowT=null,incT=0,dispHd=null,dispX=null,dispZ=null,mvX=null,mvZ=null,mvHd=null,dX=null,dZ=null,dH=null,dV=0;
  let follow=false,watchId=null,ready=false,camHd=null,gZoom=20.5,gPitch=55,camY=0,sKmh=0,autoZoom=20.5,zMaxNow=24;

  /* ---------- panel ---------- */
  function panel(html,buttons){
    const p=$('panel');p.innerHTML='<div style="margin-bottom:12px">'+html+'</div>';
    const row=document.createElement('div');row.style.cssText='display:flex;gap:10px;justify-content:center;flex-wrap:wrap';
    for(const [label,fn] of buttons){const b=document.createElement('button');b.textContent=label;b.className='pbtn';b.onclick=fn;row.appendChild(b);}
    p.appendChild(row);p.style.display='block';
  }
  function hide(){$('panel').style.display='none';}
  TN.panel=panel;TN.hide=hide;

  /* ---------- road tiles: the packs around the car (about 5 x 7 km), loaded in the background ---------- */
  const ROADS='https://tessynav.github.io/tessynav-roads/';
  let idx=null,loading=new Set(),pending=[],covered=true;
  fetch(ROADS+'index.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(j=>{idx=j;}).catch(()=>{});
  function wantPacks(lng,lat){
    if(!idx) return;
    const tx=Math.floor(lng/idx.r3t),ty=Math.floor(lat/idx.r3t),px=Math.floor(tx/idx.pack),py=Math.floor(ty/idx.pack);
    covered=idx.regions.some(r=>lng>=r.bbox[0]&&lng<=r.bbox[2]&&lat>=r.bbox[1]&&lat<=r.bbox[3]);
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
      const k=(px+dx)+'_'+(py+dy);
      /* (not again if it's already here, on its way, waiting to be added, or being added right now) */
      if(net.packs.has(k)||loading.has(k)||pending.some(q=>q[0]===k)||(net.inAdd&&net.inAdd.has(k))) continue;
      loading.add(k);
      fetch(ROADS+'p/'+k+'.json').then(r=>r.status===404?{w:[],b:[]}:(r.ok?r.json():null)).then(P=>{
        loading.delete(k);if(P) pending.push([k,P]);
      }).catch(()=>loading.delete(k));
    }
    /* forget packs far behind */
    if(!net.job) for(const k of [...net.packs.keys()]){const [x,y]=k.split('_').map(Number);if(Math.abs(x-px)>2||Math.abs(y-py)>2){net.dropPack(k,true);if(!net._dirty) net.dirtyT=Date.now();net._dirty=true;}}
  }
  setInterval(()=>{
    /* add the packs that arrived, then rebuild the network in small steps (see the main loop) */
    if(net.job||(!pending.length&&!net._dirty)) return;
    const t0=performance.now();
    /* (the new tiles are added in small slices by the main loop, together with the network rebuild) */
    const fresh=pending.splice(0).filter(q=>!net.packs.has(q[0]));
    if(!fresh.length&&!net._dirty) return;   /* (nothing new: no rebuild) */
    /* tiles dropped far behind: forgetting them waits for the next new tiles (one rebuild instead of two), at most a minute */
    if(!fresh.length&&Date.now()-(net.dirtyT||0)<60000) return;
    net._dirty=false;net.startAdd(fresh);
    TN.prof('network',performance.now()-t0);
  },600);

  /* ---------- GPS ---------- */
  function onPos(p){
    const c=p.coords,now=Date.now();
    rec.gps(c);
    track.gps(now,c.longitude,c.latitude,c.accuracy,c.speed,c.heading);
    $('speed').innerHTML=Math.round((c.speed||0)*3.6)+' <small>km/h</small>';
    const car=track.car;
    /* status pill: the road you're on, then the GPS accuracy */
    const esc=t=>String(t).replace(/[<>&]/g,'');
    const road=car&&car.snapped?(car.w&&car.w.name?esc(car.w.name):({motorway:'Highway',trunk:'Highway',primary:'Main street',secondary:'Street',tertiary:'Street',minor:'Street',service:'Service road'}[car.cls]||'Road')):null;
    if(c.accuracy>60) $('status').innerHTML='Finding Tessy… <span class="g">GPS '+Math.round(c.accuracy)+' m</span>';
    else $('status').innerHTML=(road||'Finding the road…')+' <span class="g">· GPS '+Math.round(c.accuracy)+' m'+(covered?'':' · outside the map')+'</span>';
    if(c.accuracy<100){try{localStorage.setItem('lastPos',JSON.stringify([+c.longitude.toFixed(5),+c.latitude.toFixed(5)]));}catch(e){}}
    wantPacks(c.longitude,c.latitude);
  }
  let gpsStartT=0,gpsGoodT=0,gpsLastAcc=1e9,gpsRestarts=0;
  function startFollow(){
    follow=true;userZoom=0;$('btn').textContent='Recenter';
    /* the car isn't placed yet (GPS still rough): bring the camera back to its last known spot, driving view */
    if(!track.car||track.car.x==null){
      let c=null;try{c=JSON.parse(localStorage.getItem('lastPos')||'null');}catch(e){}
      try{map.easeTo({center:c||map.getCenter(),zoom:18.5,pitch:60,duration:900});}catch(e){}
    }
    if(watchId===null){gpsStartT=Date.now();
      watchId=navigator.geolocation.watchPosition(p=>{try{localStorage.setItem('tn2_gpsok','1');}catch(e){}
          gpsLastAcc=p.coords.accuracy;if(gpsLastAcc<100) gpsGoodT=Date.now();onPos(p);},
        ()=>{$('status').textContent='Location not available';},{enableHighAccuracy:true,maximumAge:0,timeout:15000});}
  }
  function restartGps(){try{if(watchId!==null) navigator.geolocation.clearWatch(watchId);}catch(e){}watchId=null;startFollow();}
  /* GPS watchdog: if the position stays rough (a network guess over 1 km) for more than 8 s, ask again;
     that makes the browser switch to the car's precise GPS */
  setInterval(()=>{
    if(watchId===null) return;const now=Date.now();
    if(now-gpsStartT>8000&&now-gpsGoodT>10000&&gpsLastAcc>1000&&gpsRestarts<5){gpsRestarts++;restartGps();}
  },4000);
  $('btn').onclick=()=>{if(watchId!==null&&gpsLastAcc>1000) restartGps();else startFollow();};
  /* start following Tessy by itself when location is already allowed (no Start tap needed);
     the first time on a new device, the Start button asks for permission as before */
  (function autoStart(){
    let ok=false;try{ok=localStorage.getItem('tn2_gpsok')==='1';}catch(e){}
    /* start once the map has loaded, plus a moment (like a natural tap on Start), so the GPS answers precisely */
    const go=()=>{$('status').textContent='Finding Tessy…';const st=()=>setTimeout(()=>{if(watchId===null) startFollow();},1500);
      if(ready) st();else map.once('load',st);};
    if(navigator.permissions&&navigator.permissions.query){
      navigator.permissions.query({name:'geolocation'}).then(r=>{if(r.state==='granted'||(ok&&r.state!=='denied')) go();}).catch(()=>{if(ok) go();});
    }else if(ok) go();
  })();
  /* using the screen while following:
     - pinch / zoom buttons / scroll: your zoom is kept as an offset, and the map keeps following the car
     - dragging, rotating or tilting by hand: following pauses so you can look around; Recenter brings it back */
  let userZoom=0;
  map.on('zoom',e=>{if(follow&&e.originalEvent) userZoom=Math.max(-4,Math.min(3,map.getZoom()-autoZoom));});
  /* zoom buttons (like Codriver's): they always work, even where the screen's pinch gesture doesn't reach the map */
  $('zin').onclick=()=>{userZoom=Math.min(3,userZoom+0.5);if(!follow) map.easeTo({zoom:map.getZoom()+0.5,duration:300});};
  $('zout').onclick=()=>{userZoom=Math.max(-4,userZoom-0.5);if(!follow) map.easeTo({zoom:map.getZoom()-0.5,duration:300});};
  map.on('dragstart',e=>{if(e.originalEvent) follow=false;});
  for(const ev of ['zoomstart','rotatestart','pitchstart']) map.on(ev,e=>{if(e.originalEvent){follow=false;$('btn').textContent='Recenter';}});
  /* touching the map (finger or mouse) pauses following right away, so you can drag, pinch, rotate and tilt freely;
     Recenter brings the following back. (Waiting for the map's own gesture events did not work while the camera was
     being moved every frame.) The + and - buttons keep following. */
  const pauseFollow=()=>{if(follow){follow=false;$('btn').textContent='Recenter';}};
  const cv=map.getCanvasContainer();
  cv.addEventListener('pointerdown',pauseFollow,{passive:true});
  cv.addEventListener('touchstart',pauseFollow,{passive:true});
  cv.addEventListener('wheel',pauseFollow,{passive:true});
  map.on('rotatestart',e=>{if(e.originalEvent) follow=false;});
  map.on('pitchstart',e=>{if(e.originalEvent) follow=false;});

  /* ---------- recording ---------- */
  TN.recorder=rec;
  /* while recording, the button shows the time since the recording started (minutes:seconds), so a moment can be
     pointed out ("at 12:30 I turned on ..."); the same time is what the recording uses */
  let recTick=null;
  const recTime=()=>{const s=Math.max(0,Math.floor((Date.now()-rec.t0)/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
  $('rec').onclick=async()=>{
    if(!rec.rec){rec.start();$('rec').textContent='■ Stop 0:00';$('rec').style.color='#ff6b6b';$('rec').classList.add('on');
      recTick=setInterval(()=>{if(rec.rec) $('rec').textContent='■ Stop '+recTime();},1000);return;}
    if(recTick){clearInterval(recTick);recTick=null;}
    const trip=rec.stop();$('rec').textContent='● Record';$('rec').style.color='';$('rec').classList.remove('on');
    uploadTrip(trip);
  };
  async function uploadTrip(trip){
    panel('Encrypting and uploading…',[]);
    try{const name=await TN.up.upload(trip);
      /* remember it in this car's list of recordings (Trips button) */
      try{const L=JSON.parse(localStorage.getItem('tn2_trips')||'[]');L.unshift({n:name,t:Date.now(),d:Math.round((trip.dur||0)/60000)});localStorage.setItem('tn2_trips',JSON.stringify(L.slice(0,40)));}catch(e){}
panel('Uploaded! Trip name:<br><b style="font-size:22px">'+name+'</b><br><small>Send this name to Claude.</small>',[['Close',hide]]);}
    catch(e){panel('Upload failed:<br><small>'+String(e.message||e)+'</small>',[['Try again',()=>uploadTrip(trip)],['Close',hide]]);}
  }
  /* ---------- Trips: the list of recordings ---------- */
  function tripLabel(n){const m=n.match(/trip-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})/);if(!m) return '';
    const d=new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5]);return d.toLocaleDateString('en-CA',{month:'short',day:'numeric'})+' \u00b7 '+m[4]+':'+m[5];}
  function showTrip(n){
    panel('Trip name:<br><b style="font-size:22px;user-select:all">'+n+'</b><br><small>Send this name to Claude.</small>',
      [['Copy',()=>{try{navigator.clipboard.writeText(n).then(()=>panel('Copied:<br><b>'+n+'</b>',[['Close',hide]]),()=>{});}catch(e){}}],['Back',showTrips],['Close',hide]]);
  }
  async function showTrips(){
    let L=[];try{L=JSON.parse(localStorage.getItem('tn2_trips')||'[]');}catch(e){}
    const mine=new Set(L.map(x=>x.n));
    const render=(more)=>{
      const rows=L.map(x=>({n:x.n,sub:tripLabel(x.n)+(x.d?' \u00b7 '+x.d+' min':'')+' \u00b7 this car'})).concat((more||[]).filter(n=>!mine.has(n)).map(n=>({n:n,sub:tripLabel(n)})));
      if(!rows.length){panel((TN.roccoSVG?'<div style="text-align:center;margin-bottom:6px">'+TN.roccoSVG(64)+'</div>':'')+'No recordings yet.<br><small>Use Record on a drive, then they show up here. Rocco is waiting for your first one.</small>',[['Close',hide]]);return;}
      panel('<b>Recordings</b><div id="tn-trips" style="max-height:50vh;overflow:auto;margin-top:10px;text-align:left">'+
        rows.slice(0,30).map((r,i)=>'<div data-i="'+i+'" style="padding:12px 10px;border-radius:10px;cursor:pointer;border-bottom:1px solid var(--tn-line)">'+r.n+'<br><small style="color:var(--tn-sub)">'+r.sub+'</small></div>').join('')+'</div>',[['Close',hide]]);
      document.querySelectorAll('#tn-trips [data-i]').forEach(el=>el.onclick=()=>showTrip(rows[+el.dataset.i].n));
    };
    render(null);
    /* also the latest ones in the trips repo (recordings from other devices) */
    try{const tok=TN.up.get('token'),h={'Accept':'application/vnd.github+json'};if(tok) h.Authorization='Bearer '+tok;
      const r=await fetch('https://api.github.com/repos/Tessynav/tessynav-trips/contents/trips?t='+Date.now(),{headers:h,cache:'no-store'});
      if(r.ok){const j=await r.json();const names=j.map(f=>f.name.replace(/\.json$/,'')).filter(n=>/^trip-/.test(n)).sort().reverse().slice(0,30);
        if($('tn-trips')) render(names);}}catch(e){}
  }
  if($('trips')) $('trips').onclick=showTrips;
  const saved=rec.saved();
  if(saved&&saved.g&&saved.g.length>50) setTimeout(()=>panel('A recording was saved before the app closed ('+Math.round((saved.dur||0)/60000)+' min).',
    [['Upload it',()=>{try{localStorage.removeItem('tn2_rec');}catch(e){}uploadTrip(saved);}],['Delete',()=>{try{localStorage.removeItem('tn2_rec');}catch(e){}hide();}]]),1500);

  /* ---------- version and updates ----------
     The check asks GitHub itself (not the website copy, which can be up to 10 minutes behind), so it sees an
     upload within about a minute. "Update now" reloads; if the website copy is still behind, it waits and retries
     on its own until the new files are there. */
  /* the files this page actually loaded (from the loader in index.html; older pages: the script tags) */
  const mine=(window.TN_FILES&&window.TN_FILES.length)?window.TN_FILES.slice():[...document.querySelectorAll('script[src]')].map(s=>s.getAttribute('src')).filter(s=>/^js\//.test(s));
  const label=s=>{const m=s.match(/js\/([\w-]+)\.js\?v=(\d+)/);return m?m[1]+' v'+m[2]:s;};
  async function latest(){
    const parse=html=>[...html.matchAll(/<script[^>]+src="(js\/[^"]+)"/g)].map(m=>m[1]);
    const api='https://api.github.com/repos/Tessynav/tessynav.github.io/contents/v2/index.html?t='+Date.now();
    const token=TN.up.get('token');
    /* 1. GitHub itself (with the saved token if it works, otherwise without) */
    for(const useTok of token?[true,false]:[false]){
      try{
        const h={'Accept':'application/vnd.github+json'};if(useTok) h['Authorization']='Bearer '+token;
        const r=await fetch(api,{headers:h,cache:'no-store'});
        if(r.ok){const j=await r.json();const l=parse(atob(j.content.replace(/\n/g,'')));if(l.length) return l;}
      }catch(e){}
    }
    /* 2. GitHub's raw copy (a few minutes behind at most), 3. the website copy */
    for(const u of ['https://raw.githubusercontent.com/Tessynav/tessynav.github.io/main/v2/index.html?t='+Date.now(),location.pathname+'?check='+Date.now()]){
      try{const r=await fetch(u,{cache:'no-store'});if(r.ok){const l=parse(await r.text());if(l.length) return l;}}catch(e){}
    }
    throw new Error('no connection');
  }
  function update(target){
    if(rec.rec){panel('Stop the recording first, then update.',[['Close',hide]]);return;}
    try{sessionStorage.setItem('tn2_target',JSON.stringify(target));sessionStorage.setItem('tn2_tries','0');sessionStorage.setItem('tn2_prev',JSON.stringify(mine));}catch(e){}
    hide();
    if(!document.getElementById('tn-upd')){
      const d=document.createElement('div');d.id='tn-upd';d.style.opacity='0';
      d.innerHTML='<div class="t">Updating TessyNav</div><div class="bar"><div class="fill"></div></div><div class="s">Getting the new version… 0%</div>';
      document.body.appendChild(d);requestAnimationFrame(()=>{d.style.opacity='1';});
    }
    /* a snapshot of the map just before reloading, shown faded behind the progress bar on the new page */
    let gone=false;const go=()=>{if(gone) return;gone=true;location.replace(location.pathname+'?r='+Date.now());};
    try{
      map.once('render',()=>{
        try{const c=map.getCanvas(),t=document.createElement('canvas'),k=Math.min(1,1000/Math.max(1,c.width));
          t.width=Math.round(c.width*k);t.height=Math.round(c.height*k);t.getContext('2d').drawImage(c,0,0,t.width,t.height);
          sessionStorage.setItem('tn2_shot',t.toDataURL('image/jpeg',0.6));}catch(e){}
        setTimeout(go,300);});
      map.triggerRepaint();
    }catch(e){}
    setTimeout(go,1200);
  }
  $('ver').onclick=async()=>{
    panel('Checking GitHub…',[]);
    try{
      const now=await latest();
      if(now.join('|')!==mine.join('|')){
        const changed=now.filter(x=>mine.indexOf(x)<0).map(label).join(', ');
        panel('Update available: <b>'+changed+'</b><br><br>Running now: '+mine.map(label).join(', '),[['Update now',()=>update(now)],['Later',hide]]);
      }else panel((TN.roccoSVG?'<div style="text-align:center;margin-bottom:4px">'+TN.roccoSVG(64)+'</div>':'')+'TessyNav '+TN.VERSION+'<br><br>'+mine.map(label).join(', ')+'<br><small>(app.js file inside: build '+TN.APPBUILD+')</small><br><br>You have the latest version.',[['Close',hide]]);
    }catch(e){panel('Could not check: '+String(e.message||e),[['Close',hide]]);}
  };
  /* the app checks for updates by itself (20 s after opening, then every 10 minutes); a found update shows a dot on
     the gear and, only when the car is stopped, a small banner: Update now / Later */
  let pendingUpd=null,updDismissed=null;try{updDismissed=sessionStorage.getItem('tn2_upd_later');}catch(e){}
  async function bgCheck(){
    try{const now=await latest();
      if(now&&now.length&&now.join('|')!==mine.join('|')){pendingUpd=now;
        const g=document.getElementById('tn-gear');if(g) g.classList.add('upd');
        const r=document.getElementById('tn-setver');if(r){r.textContent='Update available \u203a';r.style.color='#5fe0b0';}
        try{window.TN_updTick&&window.TN_updTick();}catch(e){}}
    }catch(e){}
  }
  setTimeout(bgCheck,5000);setInterval(bgCheck,180000);   /* first check 5 s after opening, then every 3 minutes */
  try{const st=document.createElement('style');
   st.textContent='#tn-gear.upd:after{content:"";position:absolute;top:6px;right:6px;width:10px;height:10px;border-radius:50%;background:#ff5a4f;box-shadow:0 0 0 2px rgb(var(--tn-panel-rgb) / .9)}'+
     '#tn-updbar{position:absolute;left:50%;top:16px;transform:translateX(-50%);z-index:8;display:none;align-items:center;gap:12px;padding:8px 10px 8px 16px;border-radius:14px;background:rgb(var(--tn-panel-rgb) / .95);color:var(--tn-text);font:15px sans-serif}'+
     '#tn-updbar button{border:0;border-radius:9px;padding:7px 12px;font:600 14px sans-serif;cursor:pointer}#tn-updbar .u{background:var(--tn-accent);color:var(--tn-on-accent)}#tn-updbar .l{background:var(--tn-btn);color:var(--tn-text)}'+
     '#tn-updbar .i{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:var(--tn-accent);color:var(--tn-on-accent);font-size:15px}'+
     '#tn-updpill{position:absolute;left:50%;top:16px;transform:translateX(-50%);z-index:8;display:none;padding:6px 14px;border-radius:999px;background:rgb(var(--tn-panel-rgb) / .85);color:var(--tn-tip);font:13px sans-serif}';
   document.head.appendChild(st);
   const bar=document.createElement('div');bar.id='tn-updbar';bar.innerHTML='<span class="i"><svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 4v13M6 11l6 6 6-6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="m">New update arrived</span><button class="u">Update now</button><button class="l">Later</button>';document.body.appendChild(bar);
   /* while driving: a quiet note without buttons */
   const pill=document.createElement('div');pill.id='tn-updpill';pill.textContent='New update ready \u00b7 it will be offered when you stop';document.body.appendChild(pill);
   bar.querySelector('.u').onclick=()=>{bar.style.display='none';if(pendingUpd) update(pendingUpd);};
   bar.querySelector('.l').onclick=()=>{bar.style.display='none';updDismissed=pendingUpd.join('|');try{sessionStorage.setItem('tn2_upd_later',updDismissed);}catch(e){}};
   const tick=()=>{
     if(!pendingUpd||updDismissed===pendingUpd.join('|')){bar.style.display='none';pill.style.display='none';return;}
     const L=track.last,stopped=!follow||!L||L.v<1.4;
     bar.style.display=stopped?'flex':'none';pill.style.display=stopped?'none':'block';
   };
   setInterval(tick,2000);window.TN_updTick=tick;}catch(e){}
  /* after "Update now": did the new files arrive? */
  (function(){
    let target=null,tries=0,prev=null;
    try{target=JSON.parse(sessionStorage.getItem('tn2_target')||'null');tries=+sessionStorage.getItem('tn2_tries')||0;prev=JSON.parse(sessionStorage.getItem('tn2_prev')||'null');}catch(e){}
    if(!target) return;
    if(target.join('|')===mine.join('|')){
      try{sessionStorage.removeItem('tn2_target');}catch(e){}
      const changed=mine.filter(x=>!prev||prev.indexOf(x)<0).map(label).join(', ');
      setTimeout(()=>panel('Updated: <b>'+(changed||mine.map(label).join(', '))+'</b>',[['Close',hide]]),800);
      return;
    }
    if(tries>=8){try{sessionStorage.removeItem('tn2_target');}catch(e){}
      setTimeout(()=>panel('GitHub is taking longer than usual to publish. Try Version again in a few minutes.',[['Close',hide]]),800);return;}
    try{sessionStorage.setItem('tn2_tries',String(tries+1));}catch(e){}
    let left=20;
    const tick=()=>{panel('Finishing the update… GitHub is still publishing the new files.<br><small>Trying again in '+left+' s (try '+(tries+1)+' of 8)</small>',[['Cancel',()=>{try{sessionStorage.removeItem('tn2_target');}catch(e){}hide();clearInterval(iv2);}]]);
      if(left--<=0){clearInterval(iv2);location.replace(location.pathname+'?r='+Date.now());}};
    const iv2=setInterval(tick,1000);setTimeout(tick,500);
  })();
  /* every 2 minutes, a quiet check: the Version button turns into "Update ready" (it never reloads by itself) */
  setInterval(async()=>{
    try{const now=await latest();const newer=now.join('|')!==mine.join('|');$('ver').textContent=newer?'↻ Update ready':'Version';$('ver').style.color=newer?'#7fe3d4':'';}catch(e){}
  },120000);

  /* ---------- night ---------- */
  let lastNt=0;
  function night(){
    const c=map.getCenter(),alt=TN.sunAlt(new Date(),c.lat,c.lng);
    let nt=Math.min(1,Math.max(0,(6-alt)/12));
    const mm=typeof location!=='undefined'&&location.search.match(/[?&]night=([0-9.]+)/);
    if(mm){nt=Math.min(1,Math.max(0,parseFloat(mm[1])));scene.extraDark=0;}
    else if(TN.nightFrom){const nf=TN.nightFrom(nt);nt=nf.nt;scene.extraDark=nf.extra;}
    lastNt=nt;
    if(ready){scene.applyNight(nt);if(trees) trees.setNight(nt);if(buildings) buildings.setNight(nt);if(rem) rem.setNight(nt);if(season) season.setNight(nt);if(water) water.setNight(nt);}
  }
  setInterval(night,60000);

  /* ---------- main loop ---------- */
  try{window.TN_PROGRESS&&window.TN_PROGRESS(75,'Preparing the map…');}catch(e){}
  map.on('load',()=>{scene.styleMap();ready=true;if(settings){try{settings.applyAll();}catch(e){}}night();
    try{window.TN_PROGRESS&&window.TN_PROGRESS(90,'Building the streets…');}catch(e){}
    try{map.once('idle',()=>{try{window.TN_PROGRESS&&window.TN_PROGRESS(100,'Ready');}catch(e){}});}catch(e){try{window.TN_PROGRESS&&window.TN_PROGRESS(100,'Ready');}catch(e2){}}
    /* opening animation: the city in glowing lines with the TessyNav name, then real colours */
    let started=false;
    if(TN.Intro){try{started=new TN.Intro(scene,map).start(scene.pendingNt!=null?scene.pendingNt:lastNt);}catch(e){}}
    if(!started){const b=document.getElementById('tn-boot');if(b&&b.parentNode) b.parentNode.removeChild(b);document.body.classList.remove('tn-intro');}
  });
  /* snapshots are taken right after the map is drawn (the picture is only complete at that moment) */
  map.on('render',()=>{if(rec.rec) rec.shoot(map.getCanvas());});
  let last=performance.now(),fpsN=0,fpsT=performance.now(),worst=0,lastRec=0,prevCar=null,lastFps=0;
  let loopErr=0;
  function loop(){
    requestAnimationFrame(loop);
    try{frameBody();}catch(e){if(loopErr++<5) console.warn('frame',e);}
  }
  function frameBody(){
    const pnow=performance.now(),dt=Math.min(0.25,(pnow-last)/1000);worst=Math.max(worst,pnow-last);last=pnow;
    fpsN++;if(pnow-fpsT>=1000){rec.second(fpsN,worst);lastFps=fpsN;fpsN=0;worst=0;fpsT=pnow;}
    if(!ready) return;
    /* one shared budget for background work each frame (about 7 ms): the road network first, then roads,
       buildings and trees with what is left; whatever doesn't fit waits for the next frame (no stutter) */
    TN.frameT0=pnow;
    /* back after a pause (the browser was hidden, e.g. by the backup camera): the car jumps straight to where it
       is now, instead of sweeping across the map from where it was */
    if(dt>=0.25&&pnow-(frameBody.prev||pnow)>3000){dX=null;dispHd=null;camHd=null;if(nav){nav.ps=null;nav.relT=0;nav.offT=0;}track.hdRate=0;}
    frameBody.prev=pnow;
    if(net.job){const tn=performance.now();net.step(Math.max(2,Math.min(6,TN.workLeft())));TN.prof('network',performance.now()-tn);}
    const t0=performance.now();
    let car=track.frame(Date.now(),dt);
    TN.prof('track',performance.now()-t0);
    if(car&&car.x!=null){
      /* navigating: the car is drawn on the route path (smooth turns like Google Maps / Waze) */
      /* navigating: the car keeps its normal tracking (the same as without a route); gluing it onto the route line
         is optional (Settings), it made the car and the line shift sideways */
      /* navigating: on straight roads the car keeps its normal tracking (steady); in turns it follows the route's curve,
         blended in and out gradually (Settings: glue Off / In turns / Always) */
      const glueAll=!!(TN.settings&&TN.settings.glueRoute),glueTurns=!(TN.settings&&TN.settings.glueTurns===false);
      if(nav&&nav.active&&(glueAll||glueTurns)){try{const pc=nav.place(car,track.last,Date.now(),dt);
          if(glueAll){if(pc) car=pc;frameBody.gw=0;}
          else{const w=pc?nav.turnWeight():0;frameBody.gw=(frameBody.gw||0)+(w-(frameBody.gw||0))*Math.min(1,dt*2.5);const k=frameBody.gw;
            if(pc&&k>0.01){const dh=((pc.hd-car.hd+540)%360)-180;
              car=Object.assign({},car,{x:car.x+(pc.x-car.x)*k,z:car.z+(pc.z-car.z)*k,y:(car.y||0)+((pc.y||0)-(car.y||0))*k,hd:(car.hd+dh*k+360)%360});}}}catch(e){}}
      else if(nav&&nav.ps!=null){nav.ps=null;nav.latS=null;nav.laneI=null;frameBody.gw=0;}
      /* the car on screen is DRIVEN like a real car: it only moves forward along its nose and steers toward where
         it should be (a point a little ahead on its path), within a real turning circle. Corrections happen by
         steering, never by sliding, so it can't move sideways (corners, roundabouts, parking lots). */
      {const vT=track.last?track.last.v:0;
       /* (just released from the route after leaving it: placed straight at the real position if it's more than
          8 m away, rather than driving across a median to get there) */
       const justRel=nav&&nav.relAt&&Date.now()-nav.relAt<1500;
       if(dX==null||Math.hypot(car.x-dX,car.z-dZ)>(justRel?8:25)){dX=car.x;dZ=car.z;dH=car.hd;dV=vT;if(justRel) nav.relAt=0;}
       const hr=dH*Math.PI/180,sx=Math.sin(hr),sz=-Math.cos(hr);
       const ex=car.x-dX,ez=car.z-dZ,along=ex*sx+ez*sz,dist=Math.hypot(ex,ez);
       /* stopped: ease straight into place (settling between the lines of a parking space, small corrections) */
       if(vT<=0.4&&dist<6){const k=Math.min(1,dt*1.5);dX+=ex*k;dZ+=ez*k;dH=(dH+(((car.hd-dH+540)%360)-180)*k+360)%360;}
       else if(vT>0.4||dist>1.5){
         /* steer toward a point ahead of where the car should be */
         const L=Math.max(3,vT*0.7),ch=car.hd*Math.PI/180;
         const tx=car.x+Math.sin(ch)*L,tz=car.z-Math.cos(ch)*L;
         let want=(Math.atan2(tx-dX,-(tz-dZ))*180/Math.PI+360)%360;
         /* steer only within 45 degrees of the road's direction: if the point to aim at ends up behind, the car
            slows down and lets it catch up instead of turning around */
         {const o=((want-car.hd+540)%360)-180;if(Math.abs(o)>45) want=(car.hd+Math.sign(o)*45+360)%360;}
         /* turning limit: a real car's turning circle (about 4.5 m), gentler at speed */
         const maxYaw=Math.max(15,Math.min(110,(Math.max(vT,1)*180/Math.PI)/4.5))*dt;
         dH=(dH+Math.max(-maxYaw,Math.min(maxYaw,(((want-dH+540)%360)-180)))+360)%360;
         /* speed: the real speed, a little faster or slower to catch up along the path */
         dV=Math.max(0,vT+Math.max(-3,Math.min(3,along*1.2)));
         if(vT<0.4) dV=Math.min(dV,2);
         const h2=dH*Math.PI/180;dX+=Math.sin(h2)*dV*dt;dZ-=Math.cos(h2)*dV*dt;
       }
       car=Object.assign({},car,{x:dX,z:dZ,hd:dH});dispHd=dH;}
      scene.placeCar(car.x,car.z,car.y||0,dispHd);
      if(ground){try{ground.update({x:car.x,z:car.z,hd:dispHd},dt);}catch(e){}}
      if(TN.shadows){try{const sl=TN.fromLocal(car.x,car.z);TN.shadows.update(sl[0],sl[1],{x:car.x,z:car.z,y:car.y,hd:dispHd,br:car.br});}catch(e){}}
      try{scene.updateBeam(car);}catch(e){}
      if(nav){try{nav.update(dt);}catch(e){}}
      /* without a route: the speed limit of the road the car is on (from the road tiles) */
      if(nav&&!nav.active){try{const rc=track.car;nav.showLimit(rc&&rc.w&&rc.snapped?(rc.w.lim||null):null,(track.last?track.last.v:0)*3.6);}catch(e){}}
      /* live traffic lines when browsing the map or looking at a route overview (not while following the car) */
      if(nav&&follow!==lastFollowT){lastFollowT=follow;try{nav.traffic(!follow);}catch(e){}}
      if(incidents&&pnow-(incT||0)>250){incT=pnow;try{const il=TN.fromLocal(car.x,car.z);incidents.update(car,il[0],il[1]);}catch(e){}}
      if(weather){try{const wl=TN.fromLocal(car.x,car.z);weather.update(dt,wl[1],wl[0],car.x,car.y||0,car.z);}catch(e){}}
      const ll=TN.fromLocal(car.x,car.z);
      if(follow){
        const kmh=(track.last?track.last.v:0)*3.6;
        /* heading-up, like Tesla's map: the car always points straight up the screen and in a turn the whole map
           turns around it (the camera is locked to the car's smooth on-screen direction, with only a very light
           smoothing against tiny jitters) */
        if(camHd===null) camHd=car.hd;
        const rate=12;
        camHd=(camHd+TN.angDiff2(car.hd,camHd)*Math.min(1,dt*rate)+360)%360;
        /* Codriver-style view: higher and further back (camera about 40 m up), so the car is always well above
           any bridge deck and the road ahead is visible. A little more zoomed out at speed. */
        /* Codriver-style zoom: close to the car when stopped, zooming out smoothly as speed builds up (fully out
           from about 60 km/h). Never so close that the camera could reach a bridge deck. */
        /* matched to Codriver's screenshots: more top-down and close when stopped, more tilted (horizon in view)
           and moderately zoomed out at speed */
        sKmh+=(kmh-sKmh)*Math.min(1,dt*0.8);
        /* from Codriver on Tessy's screen: tilted enough to see the sky and the city ahead, close when slow,
           further back at speed */
        const sf=Math.pow(Math.min(1,sKmh/70),0.9),y=car.y||0,pitch=66+3*sf;
        /* stopped: close on the car (it fills more of the screen), like Codriver at a light */
        let zoom=21.85-2.05*sf;
        {const Hc=map.getContainer().clientHeight||600,c=1.5*Hc*Math.cos(pitch*TN.R)*40075016.7*Math.cos(ll[1]*TN.R)/512;
         /* camera height at a zoom is c/2^zoom: keep it at least 8 m above the car */
         /* on raised roads keep the camera 8 m above the car (clear of any deck); on the ground 4.5 m is enough */
         zMaxNow=Math.log2(c/(y>0.5?y+8:3.5));if(zoom>zMaxNow) zoom=zMaxNow;}
        /* with a route: tilted a little more, so the sky shows below the navigation bar;
           before exits, forks and roundabouts: the bird's-eye view (higher and more from above) */
        let pitchT=pitch,zoomT=zoom;
        if(nav&&nav.active){pitchT=Math.min(74,pitch+5);const b=nav.bird||0;if(b>0.01){pitchT=pitchT*(1-b)+32*b;zoomT=zoom-1.1*b;}}
        if(pitchT!==pitch){const Hc=map.getContainer().clientHeight||600,c2=1.5*Hc*Math.cos(pitchT*TN.R)*40075016.7*Math.cos(ll[1]*TN.R)/512;
          zMaxNow=Math.log2(c2/(y>0.5?y+8:3.5));if(zoomT>zMaxNow) zoomT=zMaxNow;}
        gZoom+=(zoomT-gZoom)*Math.min(1,dt*1.2);gPitch+=(pitchT-gPitch)*Math.min(1,dt*2.5);
        camY+=(y-camY)*Math.min(1,dt*4);
        const H=map.getContainer().clientHeight||800;
        /* the map can only aim at the ground. On a raised road the car is above the ground point, so it showed up
           too high on the screen (looking like it flies, or even off the top of the screen on the Champlain bridge).
           Aim at the ground point that lines up with the car instead: a little ahead, by height x tan(pitch). */
        let aim=ll;
        if(camY>0.3){
          const d=camY*Math.tan(gPitch*TN.R),hr=camHd*TN.R;
          aim=TN.fromLocal(car.x+Math.sin(hr)*d,car.z-Math.cos(hr)*d);
        }
        autoZoom=gZoom;
        const view={center:aim,bearing:camHd,zoom:Math.min(gZoom+userZoom,zMaxNow),pitch:gPitch,padding:{top:Math.round(H*0.56),bottom:0,left:0,right:0}};
        map.jumpTo(view);
      }
      /* roads and trees are built around the car while following, and around what you look at when you browse */
      const ac=follow?{lng:ll[0],lat:ll[1]}:map.getCenter();
      scene.update(ac.lng,ac.lat);
      if(trees){try{trees.update(ac.lng,ac.lat,lastFps);}catch(e){}}
      if(buildings){try{buildings.update(ac.lng,ac.lat,lastFps);}catch(e){}}
      if(rem){try{const tr0=performance.now(),q=TN.toLocal(ac.lng,ac.lat);rem.update(dt,q[0],q[1]);TN.prof('rem',performance.now()-tr0);}catch(e){}}
      if(water){try{water.update(dt,ac.lng,ac.lat);}catch(e){}}
      if(season){try{if(follow&&car&&car.x!=null) season.update(dt,car.x,car.y||0,car.z,lastFps);else{const q=TN.toLocal(ac.lng,ac.lat);season.update(dt,q[0],0,q[1],lastFps);}}catch(e){}}
      /* brake lights: on while slowing down clearly, and while stopped after driving (like a held brake) */
      {const L=track.last;if(L&&L.t!==brk.t){
        brk.t=L.t;brk.v=L.v;if(L.v>3) brk.moved=Date.now();
        /* the speed trend over the last 2 s (a straight-line fit): steady even with noisy readings */
        brk.h=(brk.h||[]).filter(q=>L.t-q[0]<2200);brk.h.push([L.t,L.v]);
        if(brk.h.length>=2){const n=brk.h.length,mt=brk.h.reduce((a,q)=>a+q[0],0)/n,mv=brk.h.reduce((a,q)=>a+q[1],0)/n;
          let num=0,den=0;for(const q of brk.h){num+=(q[0]-mt)*(q[1]-mv);den+=(q[0]-mt)**2;}brk.d=den>0?-num/den*1000:0;}}
       const v=track.last?track.last.v:0;
       /* braking: slowing down by more than 0.6 m/s per second, or creeping to a stop; stays on 0.8 s after */
       const braking=v>0.5&&(brk.d>0.6||(v<3&&brk.d>0.25));
       if(braking) brk.hold=Date.now();
       const on=braking||Date.now()-(brk.hold||0)<800||(v<0.5&&Date.now()-brk.moved<600000);
       brk.k+=((on?1:0)-brk.k)*Math.min(1,dt*(on?12:5));try{scene.setBrake(Math.round(brk.k*20)/20);}catch(e){}}
      if(rec.rec&&Date.now()-lastRec>=500){
        lastRec=Date.now();rec.frame(car,map.getZoom(),follow);
        /* something looks wrong: take a snapshot right away */
        if(prevCar){
          const v=track.last?track.last.v:0,mv=Math.hypot(car.x-prevCar.x,car.z-prevCar.z);
          if(mv>Math.max(6,v*0.5*2)) rec.wantShot('jump');
          else if(Math.abs((car.y||0)-prevCar.y)>1.5) rec.wantShot('height');
          else if(!car.snapped&&v>5) rec.wantShot('off road');
          else if(lastFps&&lastFps<15) rec.wantShot('slow');
        }
        prevCar={x:car.x,z:car.z,y:car.y||0};
      }
    }else{
      const c=map.getCenter();scene.update(c.lng,c.lat);
      if(trees){try{trees.update(c.lng,c.lat,lastFps);}catch(e){}}
      if(buildings){try{buildings.update(c.lng,c.lat,lastFps);}catch(e){}}
      if(rem){try{const q=TN.toLocal(c.lng,c.lat);rem.update(dt,q[0],q[1]);}catch(e){}}
      if(season){try{const q=TN.toLocal(c.lng,c.lat);season.update(dt,q[0],0,q[1],lastFps);}catch(e){}}
      if(water){try{water.update(dt,c.lng,c.lat);}catch(e){}}
    }
  }
  requestAnimationFrame(loop);
  /* when not following, still load roads where the map is looked at */
  map.on('moveend',()=>{if(!follow){const c=map.getCenter();wantPacks(c.lng,c.lat);}});
  const iv=setInterval(()=>{if(idx){const c=map.getCenter();wantPacks(c.lng,c.lat);clearInterval(iv);}},500);
})();
