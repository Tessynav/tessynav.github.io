/* MapKoon v2 — app.js: buttons, GPS, road loading and the main loop */
var TN=globalThis.TN||{};globalThis.TN=TN;
TN.VERSION='v2 step 1';
/* the build number written inside this file: the Version button shows it, so a wrong upload is easy to spot */
TN.APPBUILD=133;
/* reloading after an update keeps the address's other settings (like ?heights=v2), only the cache-buster changes */
TN.keepQuery=function(add){const q=(location.search||'').replace(/^\?/,'').split('&').filter(x=>x&&!/^r=/.test(x));q.push(add);return '?'+q.join('&');};

(function(){
  const $=id=>document.getElementById(id);
  /* (declared first: the navigation and alert modules can ask about it while the app is still starting) */
  let follow=false;
  const start=(()=>{try{return JSON.parse(localStorage.getItem('lastPos'))||TN.ORIGIN;}catch(e){return TN.ORIGIN;}})();
  const map=new maplibregl.Map({container:'map',style:'https://tiles.openfreemap.org/styles/liberty',center:start,zoom:17,pitch:60,maxPitch:85,
    fadeDuration:0,pixelRatio:1,
    attributionControl:{customAttribution:'Roads: © OpenStreetMap contributors'}});
  document.body.classList.add('tn-app');   /* (the buttons can show now) */
  const net=new TN.Net(),track=new TN.Track(net),scene=new TN.Scene(map,net),rec=new TN.Rec();
  /* the background road builder: builds the 3D road areas on its own thread (the screen never waits for it); it gets
     the same road packs and the heights worked out here. Off with ?rw=0, and it switches itself off if it fails. */
  TN.RW=null;
  if(typeof Worker!=='undefined'&&!/[?&]rw=0/.test(location.search)){try{
    const sv=n=>{const e=document.querySelector('script[src*="'+n+'.js"]');return e&&(e.getAttribute('src').match(/v=(\d+)/)||[])[1]||'1';},rv=sv('roads');
    const W=new Worker('js/roadworker.js?v=8&r='+rv+'&b='+sv('buildings')+'&s='+sv('shadows')),RW={w:W,ready:false,ver:-1,syncVer:-1,sj:null,pend:new Map(),id:0,failed:false,t0:performance.now()};
    /* if it stops: everything is done here again as before, heights included (a full rebuild) */
    const failAll=()=>{if(RW.failed&&!net.remoteHeights) return;RW.failed=true;net.mirror=false;
      if(net.remoteHeights){net.remoteHeights=false;if(!net.job) net.startRebuild();else net._dirty=true;}
      for(const cb of RW.pend.values()){try{cb(null,'stopped');}catch(e){}}RW.pend.clear();};
    TN.RWfail=failAll;
    /* (for the trip recording: what the background builder did) */
    const rwNote=(k,d)=>{try{if(rec&&rec.rec) rec.note('road builder',Object.assign({ev:k},d||{}));}catch(e){}};RW.note=rwNote;
    W.onmessage=e=>{const m=e.data;
      if(m.t==='ready'){RW.ready=true;rwNote('ready');}
      else if(m.t==='heights'){const t0=performance.now();net.applyHeights(m.h);net.hVer=(net.hVer||0)+1;TN.prof('network',performance.now()-t0);}
      else if(m.t==='synced'){RW.ver=m.ver;RW.syncedT=performance.now();}
      else if(m.t==='cell'||m.t==='bld'||m.t==='error'){const cb=RW.pend.get(m.id);RW.pend.delete(m.id);if(cb) cb(m.t==='cell'?m.L:m.t==='bld'?m.R:null,m.t==='error'?m.msg:null,m.ver);
        if(m.t==='error'){rwNote('error',{msg:String(m.msg).slice(0,200)});
          /* an error while catching up with the network (not one area): the background builder is out of step, so
             everything goes back to being done here */
          if(m.id==null) failAll();}}};
    W.onerror=e=>{rwNote('crashed',{msg:String(e&&e.message||'').slice(0,200)});failAll();};
    net.mirror=true;net.remoteHeights=true;TN.RW=RW;}catch(e){TN.RW=null;}}   /* (round 2: the heights are worked out in the background too) */
  const trees=TN.Trees?new TN.Trees(scene,net):null;
  const buildings=TN.Buildings?new TN.Buildings(scene,net):null;TN.buildings=buildings;
  const rem=TN.Rem?new TN.Rem(scene,net):null;
  const buses=TN.Buses?new TN.Buses(scene,net):null;TN.rec=rec;TN.buses=buses;const fuel=TN.Fuel?new TN.Fuel(scene,net):null;TN.fuel=fuel;const chg3d=TN.Chg3D?new TN.Chg3D(scene,net):null;TN.chg3d=chg3d;   /* (gas station canopies, Settings → 3D details) */   /* (STM live buses, Settings → The city) */
  const landmarks=TN.Landmarks?new TN.Landmarks(scene):null;
  const garage=TN.Garage?new TN.Garage({scene:scene,note:(k,d)=>{try{if(rec&&rec.rec) rec.note(k,d);}catch(e){}}}):null;
  /* Can I park here? (City of Montréal parking signs, read when you stop) */
  const parking=TN.Parking?new TN.Parking({getCar:()=>track.car,getSpeed:()=>track.last?track.last.v:0,note:(k,d)=>{try{if(rec&&rec.rec) rec.note(k,d);}catch(e){}}}):null;TN.parking=parking;
  const season=TN.Season?new TN.Season(scene,trees):null;
  const ground=TN.Ground?new TN.Ground(scene,net,trees,season):null;   /* fallen leaves, snowy ground and car */
  const water=TN.Water?new TN.Water(scene):null;
  /* the settings menu (gear button) */
  const settings=TN.Settings?new TN.Settings({scene:scene,trees:trees,buildings:buildings,water:water,season:season,rem:rem,buses:buses,fuel:fuel,chg3d:chg3d,night:()=>night()}):null;
  if(settings){try{settings.build();}catch(e){}}
  /* navigation: search, route, directions */
  const nav=TN.Nav?new TN.Nav({map:map,scene:scene,net:net,getCar:()=>track.car,
    gps:()=>track.last?{x:track.last.x,z:track.last.z,v:track.last.v,hd:track.hd,t:track.last.t,raw:track.last.hd}:null,gpsHd:()=>track.hd,note:(k,d,sh)=>{if(rec&&rec.rec) rec.note(k,d,sh);if(TN.fb) TN.fb.note(k,d);},
    setFollow:b=>{if(b){if(typeof startFollow==='function') startFollow();}else{follow=false;$('btn').classList.add('free');}}}):null;
  if(nav){try{nav.build();}catch(e){}}
  /* road incidents with Rocco (TomTom) */
  /* shadows that follow the real sun (buildings and the car), and the car's soft contact shadow */
  TN.shadows=TN.Shadows?new TN.Shadows(scene):null;
  const incidents=TN.Incidents?new TN.Incidents({map:map,scene:scene,nav:nav,net:net,getCar:()=>track.car,following:()=>follow,roadsBase:'https://app.mapkoon.com/tessynav-roads/',note:(k,d)=>{if(rec&&rec.rec) rec.note(k,d);}}):null;
  /* Superchargers on the map (and other fast chargers, if chosen) */
  /* green highway exit signs along the highway ahead (with or without a route) */
  const signs=TN.Signs?new TN.Signs({net:net,scene:scene,track:track,nav:nav}):null;TN.signs=signs;
  const chargers=TN.Chargers?new TN.Chargers({map:map,nav:nav,getCar:()=>track.car,following:()=>follow}):null;TN.chargers=chargers;
  TN.incidentsObj=incidents;
  TN.fb=TN.Feedback?new TN.Feedback({map:map,nav:nav,getCar:()=>track.car,gps:()=>track.last}):null;   /* (Send feedback, on the main screen) */
  if(TN.tesla&&TN.tesla.connected()) setTimeout(()=>{TN.tesla.config();},8000);   /* (the car's model and colour) */
  TN.tunnel=TN.Tunnel?new TN.Tunnel(scene,net,()=>track.cur&&track.cur.w):null;   /* (Transports Québec events, also used by the bridges card) */
  TN.bridges=TN.Bridges?new TN.Bridges({getCar:()=>track.car,gps:()=>track.last,map:map,nav:nav}):null;
  if(chargers&&map.on) map.on('moveend',()=>{try{chargers.draw(true);}catch(e){}});
  if(incidents){try{incidents.build();}catch(e){}}
  /* real weather (sky, rain, snow, fog, wet roads) */
  const weather=TN.Weather?new TN.Weather(scene,season):null;
  if(TN.ScreenDrops&&!TN.screenDrops){try{TN.screenDrops=new TN.ScreenDrops();}catch(e){}}   /* (drops on the screen when it rains or snows) */
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
  let watchId=null,ready=false,camHd=null,gZoom=20.5,gPitch=55,camY=0,sKmh=0,autoZoom=20.5,zMaxNow=24;

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
  const ROADS='https://app.mapkoon.com/tessynav-roads/';
  let idx=null,loading=new Set(),pending=[],covered=true;
  fetch(ROADS+'index.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(j=>{idx=j;if(j&&TN.Store) TN.Store.use('roads',j.built||j.v);}).catch(()=>{});
  /* the packs along a planned route, saved in advance (roads and buildings), so nothing waits for data on the way */
  TN.prefetchRoute=function(coords){
    if(!idx||!TN.Store||!coords||!coords.length) return;
    const rk=new Set(),bk=new Set(),C=TN.CELL;
    for(let i=0;i<coords.length;i+=Math.max(1,Math.floor(coords.length/600))){const [lng,lat]=coords[i];
      const px=Math.floor(Math.floor(lng/idx.r3t)/idx.pack),py=Math.floor(Math.floor(lat/idx.r3t)/idx.pack);
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++) rk.add((px+dx)+'_'+(py+dy));
      const cx=Math.floor(lng/C),cy=Math.floor(lat/C);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++) bk.add(Math.floor((cx+dx*4)/4)+'_'+Math.floor((cy+dy*4)/4));}
    TN.Store.prefetch('roads',[...rk].map(k=>ROADS+'p/'+k+'.json'));
    if(TN.BTILES) TN.Store.prefetch('bld',[...bk].map(k=>TN.BTILES+'b/'+k+'.json'));
    if(TN.fb) TN.fb.note('prefetch',{roads:rk.size,buildings:bk.size});
  };
  function wantPacks(lng,lat){
    if(!idx) return;
    const tx=Math.floor(lng/idx.r3t),ty=Math.floor(lat/idx.r3t),px=Math.floor(tx/idx.pack),py=Math.floor(ty/idx.pack);
    covered=idx.regions.some(r=>lng>=r.bbox[0]&&lng<=r.bbox[2]&&lat>=r.bbox[1]&&lat<=r.bbox[3]);
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
      const k=(px+dx)+'_'+(py+dy);
      /* (not again if it's already here, on its way, waiting to be added, or being added right now) */
      if(net.packs.has(k)||loading.has(k)||pending.some(q=>q[0]===k)||(net.inAdd&&net.inAdd.has(k))) continue;
      loading.add(k);
      /* (from Tessy's storage when already saved; downloaded and saved otherwise) */
      (TN.Store?TN.Store.json('roads',ROADS+'p/'+k+'.json'):fetch(ROADS+'p/'+k+'.json').then(r=>r.status===404?{missing:true}:(r.ok?r.json():null))).then(P=>{
        if(P&&P.missing) P={w:[],b:[]};
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
    track.gps(now,c.longitude,c.latitude,c.accuracy,c.speed==null?null:c.speed*(TN.replay?TN.replay.k:1),c.heading);
    if(garage){try{garage.fix(c.accuracy,c.speed);}catch(e){}}
    if(TN.habits){try{TN.habits.pos(c.longitude,c.latitude,c.speed,c.accuracy);}catch(e){}}   /* (a replay at 2x or 4x: the car moves that much faster) */
    $('speed').innerHTML=Math.round((c.speed||0)*3.6)+' <small>km/h</small>';
    const car=track.car;
    /* status pill: the road you're on, then the GPS accuracy */
    const esc=t=>String(t).replace(/[<>&]/g,'');
    const road=car&&car.snapped?(car.w&&car.w.name?esc(car.w.name):({motorway:'Highway',trunk:'Highway',primary:'Main street',secondary:'Street',tertiary:'Street',minor:'Street',service:'Service road'}[car.cls]||'Road')):null;
    if(TN.inGarage) $('status').innerHTML=TN.garageMsg||'Underground parking';
    /* (the Tesla says 10000 m for a second or two under overpasses while its position is still fine: the status
       keeps what it said, instead of flashing "Finding your car… GPS 10000 m") */
    else if(c.accuracy>=9999&&road){}
    else if(c.accuracy>60) $('status').innerHTML='Finding your car… <span class="g">GPS '+(c.accuracy>=9999?'searching':Math.round(c.accuracy)+' m')+'</span>';
    else $('status').innerHTML=(road||'Finding the road…')+' <span class="g">· GPS '+Math.round(c.accuracy)+' m'+(covered?'':' · outside the map')+'</span>';
    if(c.accuracy<100){try{localStorage.setItem('lastPos',JSON.stringify([+c.longitude.toFixed(5),+c.latitude.toFixed(5)]));}catch(e){}}
    wantPacks(c.longitude,c.latitude);
  }
  let gpsStartT=0,gpsGoodT=0,gpsLastAcc=1e9,gpsRestarts=0;
  function startFollow(){
    follow=true;userZoom=0;$('btn').classList.remove('free');
    /* the car isn't placed yet (GPS still rough): bring the camera back to its last known spot, driving view */
    if(!track.car||track.car.x==null){
      let c=null;try{c=JSON.parse(localStorage.getItem('lastPos')||'null');}catch(e){}
      try{map.easeTo({center:c||map.getCenter(),zoom:18.5,pitch:60,duration:900});}catch(e){}
    }
    if(watchId===null){gpsStartT=Date.now();
      watchId=navigator.geolocation.watchPosition(p=>{if(TN.replay) return;try{localStorage.setItem('tn2_gpsok','1');}catch(e){}
          gpsLastAcc=p.coords.accuracy;if(gpsLastAcc<100) gpsGoodT=Date.now();onPos(p);},
        ()=>{$('status').textContent='Location not available';},{enableHighAccuracy:true,maximumAge:0,timeout:15000});}
  }
  function restartGps(){try{if(watchId!==null) navigator.geolocation.clearWatch(watchId);}catch(e){}watchId=null;startFollow();}
  /* GPS watchdog: if the position stays rough (a network guess over 1 km) for more than 8 s, ask again;
     that makes the browser switch to the car's precise GPS */
  setInterval(()=>{
    if(watchId===null||TN.replay) return;const now=Date.now();
    if(now-gpsStartT>8000&&now-gpsGoodT>10000&&gpsLastAcc>1000&&gpsRestarts<5){gpsRestarts++;restartGps();}
  },4000);
  $('btn').onclick=()=>{if(watchId!==null&&gpsLastAcc>1000) restartGps();else startFollow();};
  /* start following Tessy by itself when location is already allowed (no Start tap needed);
     the first time on a new device, the Start button asks for permission as before */
  /* ---- filming mode (?orbit=olympic): for the TikTok / Reels videos. The camera circles one landmark slowly, like a
     drone shot, with every button and panel hidden and no GPS. Tap the screen to pause / resume the turn.
     Names: olympic, saputo, biosphere, julep, champlain, jacquescartier, victoria.
     Extras: &spin=8 (degrees a second, minus turns the other way; 6 by default), &zoom=16.5, &pitch=65. */
  TN.ORBITS={
    olympic:{c:[-73.551575,45.557861],z:16.4,p:62},
    saputo:{c:[-73.55285,45.56265],z:16.9,p:60},
    biosphere:{c:[-73.531746,45.514164],z:17.4,p:60},
    julep:{c:[-73.6568,45.4957],z:18.4,p:62},
    champlain:{c:[-73.5048,45.4679],z:16.0,p:66},
    jacquescartier:{c:[-73.53973,45.52231],z:16.0,p:64},
    victoria:{c:[-73.52114,45.49441],z:16.0,p:64}
  };
  TN.ORBITS.orange=TN.ORBITS.julep;TN.ORBITS.cartier=TN.ORBITS.jacquescartier;TN.ORBITS.stadium=TN.ORBITS.olympic;
  TN.ORBIT=null;
  (function orbitMode(){
    const q=location.search,m=q.match(/[?&]orbit=([a-z]+)/i);if(!m) return;
    const S=TN.ORBITS[m[1].toLowerCase()];if(!S) return;
    const num=(k,d)=>{const r=q.match(new RegExp('[?&]'+k+'=(-?[0-9.]+)'));const v=r?parseFloat(r[1]):NaN;return isFinite(v)?v:d;};
    const O=TN.ORBIT={c:S.c,z:num('zoom',S.z),p:Math.min(80,num('pitch',S.p)),spin:num('spin',6),b:num('bearing',0),paused:false};
    document.body.classList.add('tn-orbit');
    const st=document.createElement('style');
    st.textContent='body.tn-orbit>*:not(#map):not(script):not(template):not(style){display:none!important}';
    document.head.appendChild(st);
    try{for(const h of ['dragPan','dragRotate','scrollZoom','touchZoomRotate','doubleClickZoom','keyboard','touchPitch']) map[h]&&map[h].disable();}catch(e){}
    map.jumpTo({center:O.c,zoom:O.z,pitch:O.p,bearing:O.b});
    map.getCanvasContainer().addEventListener('click',()=>{O.paused=!O.paused;});
    let t0=0,startAt=0;
    const step=t=>{requestAnimationFrame(step);
      if(!ready) return;
      if(!startAt){startAt=t+2500;wantPacks(O.c[0],O.c[1]);}
      const dt=t0?Math.min(0.1,(t-t0)/1000):0;t0=t;
      if(t>startAt&&!O.paused) O.b=(O.b+O.spin*dt+360)%360;
      map.jumpTo({center:O.c,zoom:O.z,pitch:O.p,bearing:O.b});};
    requestAnimationFrame(step);
  })();
  /* ---- blinker test (?blinktest=1): for filming. The 3D car signals left for 4 s, pauses, then right for 4 s, over and
     over, without navigation. Works parked, and during a trip replay (the car drives with its blinkers going). */
  if(/[?&]blinktest=1/.test(location.search)){
    const seq=[[-1,4000],[0,1200],[1,4000],[0,1200]];let si=0;
    const nextB=()=>{if(!(TN.navActive)){TN.blink=seq[si][0];}const d=seq[si][1];si=(si+1)%seq.length;setTimeout(nextB,d);};
    setTimeout(nextB,2000);
  }
  (function autoStart(){
    if(TN.ORBIT) return;   /* (filming mode: no GPS, the camera circles a landmark instead) */
    let ok=false;try{ok=localStorage.getItem('tn2_gpsok')==='1';}catch(e){}
    /* start once the map has loaded, plus a moment (like a natural tap on Start), so the GPS answers precisely */
    const go=()=>{$('status').textContent='Finding your car…';const st=()=>setTimeout(()=>{if(watchId===null) startFollow();},1500);
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
  /* ---------- compass: a small round dial above Recenter. The red needle always points north and the letter shows the
     direction you're heading (N, NE, E...). Tap it while looking around the map to turn the map north-up. It only
     changes when the map turns (a tiny drawing), so it costs nothing noticeable. ?compass=0 hides it. ---------- */
  if(!/[?&]compass=0/.test(location.search)) try{
    const cs=document.createElement('style');cs.textContent='#tn-compass{position:absolute;right:24px;bottom:172px;width:48px;height:48px;border-radius:50%;z-index:5;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;border:0}'+
      '#tn-compass b{position:absolute;bottom:-17px;left:50%;transform:translateX(-50%);font:700 11px system-ui,sans-serif;color:var(--tn-text,#fff);text-shadow:0 1px 3px rgba(0,0,0,.6)}'+
      'body.tn-film #tn-compass{visibility:hidden!important}@media (max-width:700px){#tn-compass{bottom:176px;right:20px}}';
    document.head.appendChild(cs);
    const el=document.createElement('button');el.id='tn-compass';el.className='hud notr';el.setAttribute('aria-label','Compass');
    el.innerHTML='<svg width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-width="1.5"/>'+
      '<path d="M20 4l5 16h-10z" fill="#e5534b"/><path d="M20 36l5-16h-10z" fill="currentColor" fill-opacity=".55"/><circle cx="20" cy="20" r="2.2" fill="currentColor"/>'+
      '<text x="20" y="13.5" text-anchor="middle" font-size="7" font-weight="800" fill="#fff" font-family="system-ui,sans-serif">N</text></svg><b></b>';
    document.body.appendChild(el);
    const svg=el.querySelector('svg'),lab=el.querySelector('b'),DIRS=['N','NE','E','SE','S','SW','W','NW'];let lastB=null;
    const upd=()=>{const b=map.getBearing();if(lastB!=null&&Math.abs(b-lastB)<0.5) return;lastB=b;
      svg.style.transform='rotate('+(-b)+'deg)';lab.textContent=DIRS[Math.round((((b%360)+360)%360)/45)%8];};
    map.on('rotate',upd);map.on('load',upd);upd();
    el.onclick=ev=>{ev.stopPropagation();if(follow){lab.style.color='#2f6fe4';setTimeout(()=>{lab.style.color='';},600);return;}
      map.easeTo({bearing:0,duration:600});};
  }catch(e){}
  map.on('dragstart',e=>{if(e.originalEvent){follow=false;try{TN.setLite&&TN.setLite(false);}catch(e2){}}});
  for(const ev of ['zoomstart','rotatestart','pitchstart']) map.on(ev,e=>{if(e.originalEvent){follow=false;$('btn').classList.add('free');}});
  /* touching the map (finger or mouse) pauses following right away, so you can drag, pinch, rotate and tilt freely;
     Recenter brings the following back. (Waiting for the map's own gesture events did not work while the camera was
     being moved every frame.) The + and - buttons keep following. */
  let lastTouchT=0,ringShown=-1;
  const pauseFollow=()=>{lastTouchT=performance.now();if(follow){follow=false;$('btn').classList.add('free');}};
  const cv=map.getCanvasContainer();
  cv.addEventListener('pointerdown',pauseFollow,{passive:true});
  cv.addEventListener('touchstart',pauseFollow,{passive:true});
  cv.addEventListener('wheel',pauseFollow,{passive:true});
  /* (still touching or dragging the map counts as using it) */
  cv.addEventListener('pointermove',e=>{if(e.buttons||e.pointerType==='touch') lastTouchT=performance.now();},{passive:true});
  /* back to the car by itself after a touch: 8 s after the last touch while driving, 30 s when stopped or parked,
     with or without navigation; a ring around the Recenter button fills up as it's about to come back. Not while a
     search, its results or a route overview is open. */
  const autoRecenter=()=>{
    const btn=$('btn');if(!btn) return;
    let k=0;
    if(!follow&&lastTouchT&&track.car&&track.car.x!=null){
      const busy=(nav&&((nav.res&&nav.res.style.display!=='none'&&nav.res.childElementCount)||(nav.ov&&nav.ov.style.display!=='none')))||
        (document.activeElement&&/INPUT|TEXTAREA/.test(document.activeElement.tagName));
      if(busy) lastTouchT=performance.now();
      else{const v=track.last?track.last.v:0,lim=v>2?8000:30000,el=performance.now()-lastTouchT;
        if(el>=lim){lastTouchT=0;startFollow();}else k=Math.max(0,(el-(lim-4000))/4000);}
    }
    const q=Math.round(k*20)/20;if(q!==ringShown){ringShown=q;btn.style.setProperty('--tnRing',q);btn.classList.toggle('ring',q>0);}
  };
  map.on('rotatestart',e=>{if(e.originalEvent) follow=false;});
  map.on('pitchstart',e=>{if(e.originalEvent) follow=false;});

  /* ---------- recording ---------- */
  TN.recorder=rec;
  /* while recording, the button shows the time since the recording started (minutes:seconds), so a moment can be
     pointed out ("at 12:30 I turned on ..."); the same time is what the recording uses */
  let recTick=null;
  const recTime=()=>{const s=Math.max(0,Math.floor((Date.now()-rec.t0)/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
  $('rec').onclick=async(ev,force)=>{
    /* (a drive not uploaded yet: offered first, so a new recording doesn't replace it) */
    if(!rec.rec&&!force){const old=rec.saved();if(old&&old.g&&old.g.length>50){panel('Your last drive ('+Math.round((old.dur||0)/60000)+' min) isn’t uploaded yet.',
      [['Upload it',()=>uploadTrip(old)],['Record anyway',()=>{hide();try{localStorage.removeItem('tn2_rec');}catch(e){}$('rec').onclick(null,true);}],['Close',hide]]);return;}}
    if(!rec.rec){rec.start();try{if(nav&&nav.active) nav.noteRoute();}catch(e){}$('rec').textContent='■ Stop 0:00';$('rec').style.color='#ff6b6b';$('rec').classList.add('on');
      recTick=setInterval(()=>{if(rec.rec) $('rec').textContent='■ Stop '+recTime();},1000);return;}
    if(recTick){clearInterval(recTick);recTick=null;}
    const trip=rec.stop();$('rec').textContent='● Record';$('rec').style.color='';$('rec').classList.remove('on');
    uploadTrip(trip);
  };
  async function uploadTrip(trip){
    panel('Encrypting and uploading…',[]);
    try{const name=await TN.up.upload(trip);
      /* remember it in this car's list of recordings (Trips button) */
      try{localStorage.removeItem('tn2_rec');}catch(e){}
  try{const L=JSON.parse(localStorage.getItem('tn2_trips')||'[]');L.unshift({n:name,t:Date.now(),d:Math.round((trip.dur||0)/60000)});localStorage.setItem('tn2_trips',JSON.stringify(L.slice(0,40)));}catch(e){}
panel('Uploaded! Trip name:<br><b style="font-size:22px">'+name+'</b><br><small>Send this name to Claude.</small>',[['Close',hide]]);}
    catch(e){panel('Upload failed:<br><small>'+String(e.message||e)+'</small><br><small>Your drive is kept in this car, it will be offered again next time.</small>',[['Try again',()=>uploadTrip(trip)],['Set up',()=>upCode(trip)],['Close',hide]]);}
  }
  /* (Nov 21: upload setup in the car with the short code from the phone) */
  function upCode(trip){
    const st='display:block;width:260px;max-width:80vw;margin:8px auto;padding:9px;font-size:16px;border-radius:8px;border:0';
    panel('<b>Set up upload</b><br><small>On your phone: app.mapkoon.com/v1.html → Trips → Setup → Share to car.<br>Then type that code and your trip password here.</small>'+
      '<input id="up-code" placeholder="6-character code" autocapitalize="off" autocomplete="off" style="'+st+'">'+
      '<input id="up-cpass" type="password" placeholder="Trip password" style="'+st+'">',
      [['Connect',async()=>{const c=$('up-code').value.trim().toLowerCase(),p=$('up-cpass').value;if(!c||!p) return;
        panel('Connecting…',[]);
        try{await TN.up.useCode(c,p);if(trip) uploadTrip(trip);else panel('Connected! This car can now upload trips.',[['Close',hide]]);}
        catch(e){panel('Could not connect: '+String(e.message||e),[['Try again',()=>upCode(trip)],['Close',hide]]);}}],['Close',hide]]);
  }
  /* ---------- Trips: the list of recordings ---------- */
  function tripLabel(n){const m=n.match(/trip-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})/);if(!m) return '';
    const d=new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5]);return d.toLocaleDateString('en-CA',{month:'short',day:'numeric'})+' \u00b7 '+m[4]+':'+m[5];}
  function showTrip(n){
    panel('Trip name:<br><b style="font-size:22px;user-select:all">'+n+'</b><br><small>Send this name to Claude.</small>',
      [['\u25b6 Replay',()=>replay(n)],['Copy',()=>{try{navigator.clipboard.writeText(n).then(()=>panel('Copied:<br><b>'+n+'</b>',[['Close',hide]]),()=>{});}catch(e){}}],['Back',showTrips],['Close',hide]]);
  }
  /* ---------- Replay: play a recorded drive back on this screen (for videos, and to look at a moment again) ----------
     The recorded GPS goes through the same tracking, map and 3D as a live drive, so it looks like it did that day.
     Play / pause, a timeline to jump anywhere, 1x 2x 4x, and Film mode: every button hidden, only the map, car and
     buildings (tap the screen to bring the bar back for 3 s). The real GPS is ignored while replaying; X reloads the app. */
  async function replay(n,passTry){
    if(rec.rec){panel('Stop the recording first, then replay.',[['Close',hide]]);return;}
    let pass=passTry||TN.up.get('pass');try{if(!pass) pass=sessionStorage.getItem('tn_rp_pass')||'';}catch(e){}
    if(!pass){
      panel('Trip password<br><small>The password the recordings are locked with (kept only until this page closes).</small><br><input id="tn-rpp" type="password" style="margin-top:10px;width:90%;font-size:18px;padding:10px;border-radius:10px;border:1px solid var(--tn-line);background:transparent;color:inherit">',
        [['Open',()=>{const v=($('tn-rpp')||{}).value||'';if(v) replay(n,v);}],['Cancel',hide]]);
      setTimeout(()=>{try{$('tn-rpp').focus();}catch(e){}},50);return;}
    panel('Loading '+n+'…',[]);
    let trip=null;
    try{const r=await fetch('https://raw.githubusercontent.com/Tessynav/tessynav-trips/main/trips/'+n+'.json?t='+Date.now(),{cache:'no-store'});
      if(!r.ok) throw new Error('not found ('+r.status+')');
      const e=await r.json(),b=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
      const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);
      const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b(e.salt),iterations:e.iter||200000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['decrypt']);
      let d;try{d=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:b(e.iv)},key,b(e.data)));}
      catch(x){try{sessionStorage.removeItem('tn_rp_pass');}catch(y){}panel('That password doesn’t open this trip.',[['Try again',()=>replay(n,'')],['Close',hide]]);return;}
      if(e.gz) d=new Uint8Array(await new Response(new Blob([d]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
      trip=JSON.parse(new TextDecoder().decode(d));
      try{sessionStorage.setItem('tn_rp_pass',pass);}catch(x){}
    }catch(err){panel('Couldn’t load this trip: '+String(err.message||err).replace(/[<>&]/g,''),[['Back',showTrips],['Close',hide]]);return;}
    const g=(trip.g||[]).filter(r=>r&&r[1]!=null&&r[2]!=null);
    if(g.length<10){panel('This trip has no GPS to replay.',[['Close',hide]]);return;}
    hide();startReplay(g,n,trip.start);
  }
  function resetTrack(){const f=new TN.Track(net);for(const k of Object.keys(track)) delete track[k];Object.assign(track,f);}
  function startReplay(g,n,t0){
    /* (the sky, sun and shadows are worked out again right away, for the replayed moment) */
    const sky=()=>{try{scene.sunT=0;if(TN.shadows) TN.shadows.sunT=0;night();}catch(e){}};
    try{if(watchId!==null&&watchId>=0) navigator.geolocation.clearWatch(watchId);}catch(e){}
    watchId=-1;gpsLastAcc=5;   /* (the real GPS stays off; Recenter just recentres) */
    const FILM_G=[
      /* (Nov 21: Film chooses what stays on screen, for the videos; remembered on this device. The map credits always stay) */
      ['ui','Buttons & search','#tn-search,#status,#tag,#rec,#trips,#ver,#btn,#zin,#zout,#panel,#tn-viewbtn,#tn-compass,#tn-gear,#tn-set,#tn-fbbtn,#tn-report,#tn-mute,#tn-upd,#tn-updpill,#tn-updbar,#tn-savemenu,#tn-park,#tn-chgcard,#tn-garage',false],
      ['turn','Next turn (top card)','#tn-bar',true],
      ['dest','Destination & arrival time','#tn-ov,#tn-end,#tn-stopbtn',false],
      ['spd','Speed & speed limit','#speed,#tn-limit,#tn-roadname',false],
      ['rocco','Rocco messages & alerts','#tn-rbub,#tn-rarr,#tn-alert,#tn-jam,#tn-faster,#tn-wcard',true],
      ['mus','Music card','#tn-mus,#tn-mpan,#tn-mmsg',false],
      ['pins','Map pins','.maplibregl-marker',false]];
    const R=TN.replay={g:g,i:0,t:g[0][0],k:1,play:true,dur:g[g.length-1][0],n:n,film:false,t0:typeof t0==='number'?t0:0};
    sky();
    resetTrack();startFollow();
    const st=document.createElement('style');
    st.textContent='#tn-rp{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:50;display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:18px;background:rgba(20,22,26,.92);color:#fff;font:600 14px system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.4);width:min(760px,calc(100vw - 32px));box-sizing:border-box;transition:opacity .4s}'+
      '#tn-rp button{background:rgba(255,255,255,.12);border:0;color:#fff;border-radius:12px;height:40px;min-width:44px;padding:0 10px;font:600 14px system-ui;cursor:pointer;flex:none}#tn-rp button.on{background:#2f6fe4}#tn-rp .tm{font-variant-numeric:tabular-nums;flex:none;min-width:92px;text-align:center}'+
      '#tn-rp input{flex:1;min-width:60px;accent-color:#2f6fe4}#tn-rp .nm{position:absolute;left:14px;top:-22px;font-size:12px;opacity:.8;text-shadow:0 1px 3px #000}'+
      FILM_G.map(g=>g[2].split(',').map(x=>'body.tn-film.tnh-'+g[0]+' '+x).join(',')+'{visibility:hidden!important}').join('')+
      'body.tn-film #tn-det,body.tn-film #tn-fb,body.tn-film #tn-fbn,body.tn-film #tn-res{visibility:hidden!important}body.tn-film #tn-rp.idle{opacity:0}'+
      '#tn-fpick{position:absolute;left:50%;bottom:62px;transform:translateX(-50%);display:none;flex-direction:column;gap:2px;padding:10px 12px;border-radius:14px;background:rgba(20,26,34,.94);color:#fff;font:500 14px system-ui;white-space:nowrap;box-shadow:0 6px 24px rgba(0,0,0,.4)}'+
      '#tn-clip{position:absolute;right:14px;bottom:62px;display:none;flex-direction:column;gap:10px;padding:14px;border-radius:14px;background:rgba(20,26,34,.96);color:#fff;font:500 15px system-ui;box-shadow:0 6px 24px rgba(0,0,0,.4);min-width:280px}'+
      '#tn-clip.on{display:flex}#tn-clip b{font-size:12px;opacity:.7}#tn-clip .row{display:flex;align-items:center;gap:8px}#tn-clip .row span{width:44px}'+
      '#tn-clip input{flex:1;width:90px;font:600 18px system-ui;padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;text-align:center;font-variant-numeric:tabular-nums}'+
      '#tn-clip .go{background:#d33!important;height:46px;font-size:16px}#tn-clip .er{color:#ff9a9a;font-size:13px;min-height:1em}'+
      '#tn-fpick.on{display:flex}#tn-fpick b{font-size:12px;opacity:.7;margin-bottom:4px}#tn-fpick label{display:flex;align-items:center;gap:8px;padding:5px 2px;cursor:pointer}#tn-fpick input{width:18px;height:18px;flex:none}';
    document.head.appendChild(st);
    const bar=document.createElement('div');bar.id='tn-rp';
    bar.innerHTML='<span class="nm"></span><button class="pp" aria-label="Play or pause"></button><span class="tm">0:00 / 0:00</span><input type="range" min="0" max="1000" value="0" aria-label="Timeline">'+
      '<button data-k="1" class="on">1×</button><button data-k="2">2×</button><button data-k="4">4×</button><button class="cl">Clip</button><button class="fm">Film</button><button class="x" aria-label="End replay">✕</button>';
    document.body.appendChild(bar);
    bar.querySelector('.nm').textContent='Replay · '+n;
    const fmt=ms=>{const s=Math.max(0,Math.floor(ms/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
    const sl=bar.querySelector('input'),tm=bar.querySelector('.tm'),pp=bar.querySelector('.pp');
    let dragging=false;
    const ui=()=>{tm.textContent=fmt(R.t-g[0][0])+' / '+fmt(R.dur-g[0][0]);if(!dragging) sl.value=Math.round(1000*(R.t-g[0][0])/Math.max(1,R.dur-g[0][0]));pp.innerHTML=R.play?'<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>':'<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';};
    pp.onclick=()=>{if(R.i>=g.length) seek(0);R.play=!R.play;ui();};
    bar.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{R.k=+b.dataset.k;bar.querySelectorAll('[data-k]').forEach(o=>o.classList.toggle('on',o===b));});
    /* jumping on the timeline: the car starts fresh from there, like opening the app at that spot */
    const seek=f=>{R.t=g[0][0]+f*(R.dur-g[0][0]);let i=0;while(i<g.length&&g[i][0]<R.t) i++;R.i=i;resetTrack();frameBody.rpCar=null;
      if(!R.play){R.play=true;setTimeout(()=>{R.play=false;ui();},1200);}   /* (paused: play 1 s so the car appears at the new spot, then hold) */
      startFollow();ui();sky();};
    sl.oninput=()=>{dragging=true;tm.textContent=fmt(+sl.value/1000*(R.dur-g[0][0]))+' / '+fmt(R.dur-g[0][0]);};
    sl.onchange=()=>{dragging=false;seek(+sl.value/1000);};
    let idleT=null;const wake=()=>{bar.classList.remove('idle');clearTimeout(idleT);if(R.film) idleT=setTimeout(()=>{bar.classList.add('idle');const fp=document.getElementById('tn-fpick');if(fp) fp.classList.remove('on');},3000);};
    /* Film: on, with a small list of what to keep on screen (tick = shown) */
    let keep={};try{keep=JSON.parse(localStorage.getItem('tn2_filmkeep')||'{}')||{};}catch(e){}
    const pick=document.createElement('div');pick.id='tn-fpick';
    pick.innerHTML='<b>Show while filming</b>'+FILM_G.map(g=>'<label><input type="checkbox" data-g="'+g[0]+'">'+g[1]+'</label>').join('');
    bar.appendChild(pick);
    const applyKeep=()=>{for(const g of FILM_G){const on=keep[g[0]]!=null?keep[g[0]]:g[3];document.body.classList.toggle('tnh-'+g[0],!on);const cb=pick.querySelector('[data-g="'+g[0]+'"]');if(cb) cb.checked=on;}};
    pick.querySelectorAll('input').forEach(cb=>cb.onchange=()=>{keep[cb.dataset.g]=cb.checked;try{localStorage.setItem('tn2_filmkeep',JSON.stringify(keep));}catch(e){}applyKeep();});
    applyKeep();
    bar.querySelector('.fm').onclick=e=>{if(R.film&&!pick.classList.contains('on')){pick.classList.add('on');wake();return;}   /* (list hidden after a pause: show it again first) */
      R.film=!R.film;document.body.classList.toggle('tn-film',R.film);e.target.classList.toggle('on',R.film);pick.classList.toggle('on',R.film);wake();};
    document.addEventListener('pointerdown',wake,true);document.addEventListener('mousemove',wake,true);
    /* Clip (Nov 23): choose where a video starts and ends, then one button films it. The replay jumps to the start,
       Film turns on, the bar hides, it waits 3 s (time to start the screen recording), plays, and stops at the end.
       The start and end are remembered for each trip on this device. */
    const clip=document.createElement('div');clip.id='tn-clip';
    clip.innerHTML='<b>Clip to film</b><div class="row"><span>Start</span><input class="cs" inputmode="numeric" placeholder="13:00"><button class="cn" data-w="cs">Now</button></div>'+
      '<div class="row"><span>End</span><input class="ce" inputmode="numeric" placeholder="14:00"><button class="cn" data-w="ce">Now</button></div>'+
      '<div class="er"></div><button class="go">Film clip</button>';
    bar.appendChild(clip);
    const ck='tn2_clip_'+n,cs=clip.querySelector('.cs'),ce=clip.querySelector('.ce'),cer=clip.querySelector('.er');
    try{const sv=JSON.parse(localStorage.getItem(ck)||'null');if(sv){cs.value=sv[0]||'';ce.value=sv[1]||'';}}catch(e){}
    const toMs=v=>{v=String(v||'').trim().replace(/[.,h ]/g,':');if(!v) return null;const p=v.split(':').map(Number);if(p.some(isNaN)) return null;
      return (p.length===1?p[0]*60:p.length===2?p[0]*60+p[1]:p[0]*3600+p[1]*60+p[2])*1000;};
    clip.querySelectorAll('.cn').forEach(b=>b.onclick=()=>{clip.querySelector('.'+b.dataset.w).value=fmt(R.t-g[0][0]);});
    bar.querySelector('.cl').onclick=e=>{pick.classList.remove('on');clip.classList.toggle('on');cer.textContent='';e.stopPropagation();};
    clip.querySelector('.go').onclick=()=>{
      const a=toMs(cs.value),b=toMs(ce.value),total=R.dur-g[0][0];
      if(a==null||b==null){cer.textContent='Type a start and an end, like 13:00 and 14:00.';return;}
      if(b<=a){cer.textContent='The end has to come after the start.';return;}
      if(a>=total){cer.textContent='This trip is only '+fmt(total)+' long.';return;}
      try{localStorage.setItem(ck,JSON.stringify([cs.value,ce.value]));}catch(e){}
      clip.classList.remove('on');clearTimeout(R.clipT);
      R.film=true;document.body.classList.add('tn-film');bar.querySelector('.fm').classList.add('on');pick.classList.remove('on');
      R.clipEnd=g[0][0]+Math.min(b,total);
      R.play=false;seek(Math.max(0,a-1000)/total);          /* (a second early: the car settles in, then holds) */
      bar.classList.add('idle');
      R.clipT=setTimeout(()=>{R.play=true;ui();bar.classList.add('idle');},3000+1300);   /* 3 s to start recording */
    };
    /* X: back to the live drive right away (no reload): the bar goes, the real GPS comes back */
    bar.querySelector('.x').onclick=()=>{
      clearInterval(R.timer);clearTimeout(idleT);bar.remove();st.remove();document.body.classList.remove('tn-film');FILM_G.forEach(g=>document.body.classList.remove('tnh-'+g[0]));
      document.removeEventListener('pointerdown',wake,true);document.removeEventListener('mousemove',wake,true);
      TN.replay=null;frameBody.rpCar=null;resetTrack();restartGps();sky();
      $('speed').innerHTML='0 <small>km/h</small>';};
    /* the clock: recorded GPS fixes are given to the app at the moment they came in that day (times the speed) */
    let last=performance.now(),uiT=0;
    R.timer=setInterval(()=>{const now=performance.now(),dt=Math.min(250,now-last);last=now;
      if(R.play&&!dragging){R.t+=dt*R.k;
        while(R.i<g.length&&g[R.i][0]<=R.t){const r=g[R.i++];
          onPos({coords:{latitude:r[1],longitude:r[2],accuracy:r[3]==null?5:r[3],speed:r[4],heading:r[5]}});}
        if(R.i>=g.length){R.play=false;R.t=R.dur;}
        if(R.clipEnd&&R.t>=R.clipEnd){R.play=false;R.clipEnd=null;}}
      if(now-uiT>250){uiT=now;ui();}
    },33);
    ui();
  }
  async function showTrips(){
    let L=[];try{L=JSON.parse(localStorage.getItem('tn2_trips')||'[]');}catch(e){}
    let more=null,repoErr='';const shaOf={};
    /* deleting a trip: from this car's list and from the trips repository (so it's gone everywhere) */
    const delTrip=async(n,row)=>{
      L=L.filter(x=>x.n!==n);try{localStorage.setItem('tn2_trips',JSON.stringify(L));}catch(e){}
      if(more) more=more.filter(m=>m!==n);
      let ok=true;
      try{const tok=TN.up.get('token');
        if(tok){const h={'Accept':'application/vnd.github+json','Authorization':'Bearer '+tok};
          let sha=shaOf[n];
          if(!sha){const r=await fetch('https://api.github.com/repos/Tessynav/tessynav-trips/contents/trips/'+n+'.json?t='+Date.now(),{headers:h,cache:'no-store'});if(r.ok) sha=(await r.json()).sha;}
          if(sha){const r=await fetch('https://api.github.com/repos/Tessynav/tessynav-trips/contents/trips/'+n+'.json',{method:'DELETE',headers:h,body:JSON.stringify({message:'Delete '+n,sha:sha})});ok=r.ok;}}}
      catch(e){ok=false;}
      render();
      if(!ok) panel('Removed from this car\'s list.<br><small>It couldn\'t be removed from the trips repository right now (no connection?). Try again later.</small>',[['Back',showTrips],['Close',hide]]);
    };
    const render=()=>{
      const mine=new Set(L.map(x=>x.n));
      const rows=L.map(x=>({n:x.n,sub:tripLabel(x.n)+(x.d?' \u00b7 '+x.d+' min':'')+' \u00b7 this car'})).concat((more||[]).filter(n=>!mine.has(n)).map(n=>({n:n,sub:tripLabel(n)})));
      if(!rows.length){panel((TN.roccoSVG?'<div style="text-align:center;margin-bottom:6px">'+TN.roccoSVG(64)+'</div>':'')+'<div id="tn-trips-empty">'+(more===null?'Looking for your recordings…':'No recordings yet.')+'<br><small>'+(repoErr?repoErr:more===null?'Checking the trips repository.':'Use Record on a drive, then they show up here. Rocco is waiting for your first one.')+'</small></div>',[['Close',hide]]);return;}
      const bin='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';
      panel('<b>Recordings</b><div id="tn-trips" style="max-height:50vh;overflow:auto;margin-top:10px;text-align:left">'+
        rows.slice(0,30).map((r,i)=>'<div data-row="'+i+'" style="display:flex;align-items:center;gap:8px;padding:8px 6px 8px 10px;border-bottom:1px solid var(--tn-line)">'+
          '<div data-i="'+i+'" style="flex:1;min-width:0;padding:4px 0;cursor:pointer">'+r.n+'<br><small style="color:var(--tn-sub)">'+r.sub+'</small></div>'+
          '<button data-del="'+i+'" aria-label="Delete trip" style="flex:none;width:48px;height:48px;border:none;border-radius:10px;background:transparent;color:#e5534b;display:flex;align-items:center;justify-content:center;cursor:pointer">'+bin+'</button></div>').join('')+'</div>',[['Close',hide]]);
      document.querySelectorAll('#tn-trips [data-i]').forEach(el=>el.onclick=()=>showTrip(rows[+el.dataset.i].n));
      /* the trash button asks first, right in that row */
      document.querySelectorAll('#tn-trips [data-del]').forEach(el=>el.onclick=()=>{
        const i=+el.dataset.del,row=document.querySelector('#tn-trips [data-row="'+i+'"]');if(!row) return;
        row.style.background='rgba(229,83,75,.12)';
        row.innerHTML='<div style="flex:1;min-width:0;padding:4px 0;color:#e5534b">Delete '+rows[i].n+'?<br><small>This can\'t be undone.</small></div>'+
          '<button data-no style="flex:none;height:44px;padding:0 14px;border-radius:10px;border:1px solid var(--tn-line);background:transparent;color:inherit;cursor:pointer">Cancel</button>'+
          '<button data-yes style="flex:none;height:44px;padding:0 14px;border-radius:10px;border:1px solid #e5534b;background:transparent;color:#e5534b;cursor:pointer">Delete</button>';
        row.querySelector('[data-no]').onclick=render;
        row.querySelector('[data-yes]').onclick=()=>{row.style.opacity='.5';delTrip(rows[i].n,row);};
      });
    };
    render();
    /* also the latest ones in the trips repo (recordings from other devices) */
    try{const tok=TN.up.get('token'),h={'Accept':'application/vnd.github+json'};if(tok) h.Authorization='Bearer '+tok;
      const r=await fetch('https://api.github.com/repos/Tessynav/tessynav-trips/contents/trips?t='+Date.now(),{headers:h,cache:'no-store'});
      if(r.ok){const j=await r.json();for(const f of j) shaOf[f.name.replace(/\.json$/,'')]=f.sha;
        more=j.map(f=>f.name.replace(/\.json$/,'')).filter(n=>/^trip-/.test(n)).sort().reverse().slice(0,30);
        if($('tn-trips')||$('tn-trips-empty')) render();}
      /* (the list from the trips repository couldn't be read: say why, instead of "No recordings yet") */
      else{more=[];repoErr=(r.status===404||r.status===401||r.status===403)?'Couldn\'t open the trips repository (error '+r.status+'): this browser needs a GitHub token that can read tessynav-trips.':'Couldn\'t reach the trips repository (error '+r.status+'). Try again in a minute.';
        if($('tn-trips-empty')) render();}}
    catch(e){more=[];repoErr='Couldn\'t reach the trips repository (no connection?).';if($('tn-trips-empty')) render();}
  }
  if($('trips')) $('trips').onclick=showTrips;
  const saved=rec.saved();
  if(saved&&saved.g&&saved.g.length>50) setTimeout(()=>panel('A recording was saved before the app closed ('+Math.round((saved.dur||0)/60000)+' min).',
    [['Upload it',()=>uploadTrip(saved)],['Delete',()=>{try{localStorage.removeItem('tn2_rec');}catch(e){}hide();}]]),1500);

  /* ---------- version and updates ----------
     The check asks GitHub itself (not the website copy, which can be up to 10 minutes behind), so it sees an
     upload within about a minute. "Update now" reloads; if the website copy is still behind, it waits and retries
     on its own until the new files are there. */
  /* the files this page actually loaded (from the loader in index.html; older pages: the script tags) */
  const mine=(window.TN_FILES&&window.TN_FILES.length)?window.TN_FILES.slice():[...document.querySelectorAll('script[src]')].map(s=>s.getAttribute('src')).filter(s=>/^js\//.test(s));
  const label=s=>{const m=s.match(/js\/([\w-]+)\.js\?v=(\d+)/);return m?m[1]+' v'+m[2]:s;};
  /* the files as a tidy two-column table, sorted by name (instead of one long line) */
  const table=list=>{const it=list.map(f=>{const m=f.match(/js\/([\w-]+)\.js\?v=(\d+)/);return m?[m[1],'v'+m[2]]:[f,''];}).sort((x,y)=>x[0].localeCompare(y[0]));
    /* (4 narrow columns, scrolling if needed: the list grew past the height of the Tesla screen and the Close button was cut off) */
    return '<div style="display:grid;grid-template-columns:repeat('+(innerWidth>620?4:2)+',minmax(0,1fr));gap:2px 12px;font-size:12.5px;text-align:left;margin:8px 0 2px;max-height:46vh;overflow:auto">'+
      it.map(x=>'<div style="display:flex;justify-content:space-between;gap:6px;border-bottom:1px solid rgba(127,127,127,.18);padding:1px 0;white-space:nowrap"><span>'+x[0]+'</span><span style="opacity:.6">'+x[1]+'</span></div>').join('')+'</div>';};
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
      d.innerHTML='<div class="t">Updating MapKoon</div><div class="bar"><div class="fill"></div></div><div class="s">Getting the new version… 0%</div>';
      document.body.appendChild(d);requestAnimationFrame(()=>{d.style.opacity='1';});
    }
    /* a snapshot of the map just before reloading, shown faded behind the progress bar on the new page */
    let gone=false;const go=()=>{if(gone) return;gone=true;location.replace(location.pathname+TN.keepQuery('r='+Date.now()));};
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
        panel('Update available: <b>'+changed+'</b><br><br>Running now:'+table(mine),[['Update now',()=>update(now)],['Later',hide]]);
      }else panel((TN.roccoSVG?'<div style="text-align:center;margin-bottom:4px">'+TN.roccoSVG(40)+'</div>':'')+'<b>MapKoon</b> · build '+TN.APPBUILD+'<br><span style="font-size:14px">Heights: '+(TN.HV2?'new':'current')+'</span>'+table(mine)+'<br>You have the latest version.',[['Close',hide]]);
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
     '#tn-updbar{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);z-index:8;display:none;align-items:center;gap:12px;padding:8px 10px 8px 16px;border-radius:14px;background:rgb(var(--tn-panel-rgb) / .95);color:var(--tn-text);font:15px sans-serif}'+
     '#tn-updbar button{border:0;border-radius:9px;padding:7px 12px;font:600 14px sans-serif;cursor:pointer}#tn-updbar .u{background:var(--tn-accent);color:var(--tn-on-accent)}#tn-updbar .l{background:var(--tn-btn);color:var(--tn-text)}'+
     '#tn-updbar .i{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:var(--tn-accent);color:var(--tn-on-accent);font-size:15px}'+
     '#tn-updpill{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);z-index:8;display:none;padding:6px 14px;border-radius:999px;background:rgb(var(--tn-panel-rgb) / .85);color:var(--tn-tip);font:13px sans-serif}';
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
   setInterval(tick,2000);window.TN_updTick=tick;
   TN.doUpdate=()=>{if(pendingUpd) update(pendingUpd);};   /* (the Update now button in Settings) */}catch(e){}
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
      if(left--<=0){clearInterval(iv2);location.replace(location.pathname+TN.keepQuery('r='+Date.now()));}};
    const iv2=setInterval(tick,1000);setTimeout(tick,500);
  })();
  /* every 2 minutes, a quiet check: the Version button turns into "Update ready" (it never reloads by itself) */
  setInterval(async()=>{
    try{const now=await latest();const newer=now.join('|')!==mine.join('|');$('ver').textContent=newer?'↻ Update ready':'Version';$('ver').style.color=newer?'#7fe3d4':'';}catch(e){}
  },120000);

  /* ---------- night ---------- */
  let lastNt=0;
  function night(){
    const c=map.getCenter(),alt=TN.sunAlt(TN.clock(),c.lat,c.lng);
    let nt=Math.min(1,Math.max(0,(6-alt)/12));
    const mm=typeof location!=='undefined'&&location.search.match(/[?&]night=([0-9.]+)/);
    if(mm){nt=Math.min(1,Math.max(0,parseFloat(mm[1])));scene.extraDark=0;}
    else if(TN.nightFrom){const nf=TN.nightFrom(nt);nt=nf.nt;scene.extraDark=nf.extra;}
    lastNt=nt;
    if(ready){scene.applyNight(nt);if(trees) trees.setNight(nt);if(buildings) buildings.setNight(nt);if(rem) rem.setNight(nt);if(season) season.setNight(nt);if(water) water.setNight(nt);}
  }
  setInterval(night,60000);
  setInterval(()=>{if(TN.replay&&TN.replay.t0) night();},15000);

  /* ---------- main loop ---------- */
  try{window.TN_PROGRESS&&window.TN_PROGRESS(75,'Preparing the map…');}catch(e){}
  /* ---- one engine while driving (Option B): while the camera follows the car, the base map stops drawing its labels,
     road lines, icons and its own 3D (the 3D scene draws the roads and buildings itself); it keeps only its flat
     colours (land, parks, water) and our route layers. Everything comes back when you look around the map yourself.
     ?lite=0 switches it off. */
  TN.liteOn=!/[?&]lite=0/.test(location.search);let liteIds=null,liteState=null;
  const setLite=on=>{if(!TN.liteOn) on=false;if(on===liteState) return;
    try{if(!liteIds){liteIds=[];for(const L of map.getStyle().layers){if(/^tn-/.test(L.id)) continue;
          if(L.type==='symbol'||L.type==='line'||L.type==='fill-extrusion'||L.type==='circle'||L.type==='heatmap') liteIds.push([L.id,(L.layout&&L.layout.visibility)||'visible']);}}
      for(const [id,v0] of liteIds) if(map.getLayer(id)) map.setLayoutProperty(id,'visibility',on?'none':v0);
      liteState=on;try{if(rec&&rec.rec) rec.note('map lite',{on:on,layers:liteIds.length});}catch(e){}}catch(e){}};
  TN.setLite=setLite;
  /* ---- the 3D/2D button (above the compass): 3D is the normal tilted view; 2D is the calmer view (the old Clean camera, tilted 57°),
     a bit zoomed out, with a thicker route and no falling leaves. (It replaces Classic/Clean; a saved 'clean' becomes 3D.)
     TN.viewClean stays the name the other files check, now meaning 2D. */
  TN.viewClean=!!(TN.settings&&TN.settings.view==='2d');
  const applyView=()=>{try{const thick=['interpolate',['linear'],['zoom'],12,6,16,14,20,30];
      if(map.getLayer('tn-route-line')){if(!TN._rw0) TN._rw0=map.getPaintProperty('tn-route-line','line-width');map.setPaintProperty('tn-route-line','line-width',TN.viewClean?thick:TN._rw0);}
      const b=document.getElementById('tn-viewbtn');if(b){b.textContent=TN.viewClean?'2D':'3D';b.classList.toggle('on',TN.viewClean);}}catch(e){}};
  TN.applyView=applyView;
  {const st=document.createElement('style');st.textContent='#tn-viewbtn{position:absolute;right:24px;bottom:252px;z-index:5;width:48px;height:48px;padding:0;border-radius:50%;font:700 15px system-ui,sans-serif;cursor:pointer}#tn-viewbtn.on{background:#2f6fe4!important;color:#fff!important}body.tn-film #tn-viewbtn{visibility:hidden!important}@media (max-width:700px){#tn-viewbtn{bottom:256px;right:20px}}';document.head.appendChild(st);
   const b=document.createElement('button');b.id='tn-viewbtn';b.className='hud notr';b.setAttribute('aria-label','Switch between 3D and 2D');b.textContent=TN.viewClean?'2D':'3D';
   b.onclick=ev=>{ev.stopPropagation();TN.viewClean=!TN.viewClean;try{if(settings&&settings.set) settings.set('view',TN.viewClean?'2d':'3d');}catch(e){}applyView();
     try{if(rec&&rec.rec) rec.note('view',{d2:TN.viewClean});}catch(e){}};
   document.body.appendChild(b);}
  map.on('load',()=>{scene.styleMap();ready=true;setTimeout(()=>{try{applyView();setLite(follow);}catch(e){}},500);if(settings){try{settings.applyAll();}catch(e){}}night();
    try{window.TN_PROGRESS&&window.TN_PROGRESS(90,'Building the streets…');}catch(e){}
    try{map.once('idle',()=>{try{window.TN_PROGRESS&&window.TN_PROGRESS(100,'Ready');}catch(e){}});}catch(e){try{window.TN_PROGRESS&&window.TN_PROGRESS(100,'Ready');}catch(e2){}}
    /* opening animation: the city in glowing lines with the MapKoon name, then real colours */
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
    fpsN++;if(pnow-fpsT>=1000){rec.second(fpsN,worst);if(TN.fb) TN.fb.second(fpsN,worst);lastFps=fpsN;fpsN=0;worst=0;fpsT=pnow;}
    if(!ready) return;
    /* one shared budget for background work each frame (about 7 ms): the road network first, then roads,
       buildings and trees with what is left; whatever doesn't fit waits for the next frame (no stutter) */
    TN.frameT0=pnow;
    /* back after a pause (the browser was hidden, e.g. by the backup camera): the car jumps straight to where it
       is now, instead of sweeping across the map from where it was */
    if(dt>=0.25&&pnow-(frameBody.prev||pnow)>3000){dX=null;dispHd=null;camHd=null;if(nav){nav.ps=null;nav.relT=0;nav.offT=0;}track.hdRate=0;}
    frameBody.prev=pnow;
    if(net.job){const tn=performance.now();net.step(Math.max(2,Math.min(6,TN.workLeft())));TN.prof('network',performance.now()-tn);}
    /* a safety net: the background builder was sent the new map but hasn't answered in 15 s (stuck or stopped): the
       roads are built here again, so they never stay missing */
    {const RW=TN.RW;if(RW&&!RW.failed&&RW.ready&&RW.syncVer===net.ver&&RW.ver!==net.ver&&RW.syncT&&performance.now()-RW.syncT>15000){if(RW.note) RW.note('no answer',{ver:net.ver});if(TN.RWfail) TN.RWfail();}}
    /* after a network rebuild: the background road builder gets the new packs and heights (worked out in slices) */
    /* (one map update at a time: the next one waits until the background builder has finished the last. On long
       highway drives new map arrived every few seconds and the updates queued up behind each other, each a full
       height calculation, so the requests for roads and buildings waited behind them: buildings didn't appear) */
    {const RW=TN.RW;if(RW&&RW.ready&&!RW.failed&&!net.job&&RW.syncVer!==net.ver&&!(RW.syncVer!==RW.ver&&RW.syncT&&performance.now()-RW.syncT<15000)){const tn=performance.now();
      if(!RW.sj){RW.sj=net.workerSyncJob();RW.sjVer=net.ver;}
      let r;do{r=RW.sj.next();}while(!r.done&&performance.now()-tn<Math.max(1,Math.min(3,TN.workLeft())));
      if(r.done){RW.sj=null;if(RW.sjVer===net.ver){try{RW.w.postMessage(r.value.msg,r.value.transfer);RW.syncVer=net.ver;RW.syncT=performance.now();}catch(e){if(TN.RWfail) TN.RWfail();}}}
      TN.prof('network',performance.now()-tn);}}
    const t0=performance.now();
    /* (a paused replay: the car stays exactly where it is. The tracking otherwise kept moving it ahead on its last
       speed for a few seconds, like a car whose GPS dropped out, and wobbled while it gave up) */
    let car;
    if(TN.replay&&!TN.replay.play&&frameBody.rpCar) car=Object.assign({},frameBody.rpCar);
    else{car=track.frame(Date.now(),dt);if(TN.replay&&car) frameBody.rpCar=Object.assign({},car);}
    if(garage&&car){try{car=garage.frame(car,track.last?track.last.v:0);}catch(e){}}
    TN.prof('track',performance.now()-t0);
    if(car&&car.x!=null){
      /* navigating: the car is drawn on the route path (smooth turns like Google Maps / Waze) */
      /* navigating: the car keeps its normal tracking (the same as without a route); gluing it onto the route line
         is optional (Settings), it made the car and the line shift sideways */
      /* navigating: on straight roads the car keeps its normal tracking (steady); in turns it follows the route's curve,
         blended in and out gradually (Settings: glue Off / In turns / Always) */
      const glueAll=!!(TN.settings&&TN.settings.glueRoute),glueTurns=!(TN.settings&&TN.settings.glueTurns===false);
      if(nav&&nav.active&&(glueAll||glueTurns)){try{const pc=nav.place(car,track.last,Date.now(),dt);
          /* (Nov 22, trip 16:00: in the tunnel the car's own position estimate drifted up to 9 m sideways and the car
             swung across the lanes: in a tunnel, on a route, the car stays on the route's line, moving at its speed) */
          if(glueAll||(pc&&track.last&&track.last.dr)){if(pc) car=pc;frameBody.gw=0;}
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
      /* the car's height changes at most 5 m per second: when it moves onto a road piece at another height (a ramp
         beside a raised highway, after navigation ends), it glides up or down instead of jumping 10 m at once */
      {const yT=car.y||0;if(TN._ys==null||Math.abs(yT-TN._ys)>30) TN._ys=yT;else{const st=5*Math.min(0.1,dt||0.016);TN._ys+=Math.max(-st,Math.min(st,yT-TN._ys));}}
      /* (the drawn car follows the tracking directly again: the extra sideways smoothing of builds 116 and 117 caused the
         stepping and the zigzag on screen, while the tracking itself, in the recordings, was smooth) */
      scene.placeCar(car.x,car.z,TN._ys,dispHd,track.last?track.last.v:0,dt);
      if(ground){try{ground.update({x:car.x,z:car.z,hd:dispHd},dt);}catch(e){}}
      if(TN.shadows){try{const sl=TN.fromLocal(car.x,car.z);TN.shadows.update(sl[0],sl[1],{x:car.x,z:car.z,y:car.y,hd:dispHd,br:car.br});}catch(e){}}
      try{scene.updateBeam(car);}catch(e){}
      if(nav){try{nav.update(dt);}catch(e){}}
      /* without a route: the speed limit of the road the car is on (from the road tiles) */
      if(nav&&!nav.active){try{const rc=track.car;nav.showLimit(rc&&rc.w&&rc.snapped?(rc.w.lim||null):null,(track.last?track.last.v:0)*3.6);}catch(e){}}
      /* live traffic lines when browsing the map or looking at a route overview (not while following the car) */
      if(nav&&follow!==lastFollowT){lastFollowT=follow;try{nav.traffic(!follow);}catch(e){}}
      if(chargers) try{chargers.update();}catch(e){}
      if(signs) try{signs.update();}catch(e){}
      try{autoRecenter();}catch(e){}
      if(TN.tunnel) try{TN.tunnel.update(dt);}catch(e){}
      {const cc=track.car,lv=track.last;TN.carOffRoad=!!(cc&&cc.x!=null&&!cc.snapped&&(!lv||(lv.v||0)<2.5));}   /* (not on a road, and slow: the x-ray bubble) */   /* (tunnel mode: the tunnel you're in, and the view dims) */
      if(incidents&&pnow-(incT||0)>250){incT=pnow;try{const il=TN.fromLocal(car.x,car.z);incidents.update(car,il[0],il[1]);}catch(e){}}
      if(weather){try{weather.carV=track.last?track.last.v:0;weather.carHd=dispHd;const wl=TN.fromLocal(car.x,car.z);weather.update(dt,wl[1],wl[0],car.x,car.y||0,car.z);}catch(e){}}
      const ll=TN.fromLocal(car.x,car.z);
      /* the car leaving the screen while the map isn't following it (at the start of a trip, or after looking around):
         driving off the edge brings the view back to the car right away, instead of after the usual wait */
      const viewBusy=(nav&&((nav.res&&nav.res.style.display!=='none'&&nav.res.childElementCount)||(nav.ov&&nav.ov.style.display!=='none')||(nav.lookAway&&Date.now()<nav.lookAway)))||(document.activeElement&&/INPUT|TEXTAREA/.test(document.activeElement.tagName));
      if(!follow&&ready&&!viewBusy&&track.last&&(track.last.v||0)>2&&typeof startFollow==='function'){
        try{const pp=map.project([ll[0],ll[1]]),Wd=map.getContainer().clientWidth,Hd=map.getContainer().clientHeight;
          if(pp.y>Hd*0.93||pp.y<Hd*0.05||pp.x<Wd*0.03||pp.x>Wd*0.97){startFollow();try{if(rec&&rec.rec) rec.note('car off screen',{x:Math.round(pp.x),y:Math.round(pp.y)});}catch(e){}}}catch(e){}}
      if(follow){
        const kmh=(track.last?track.last.v:0)*3.6;
        /* heading-up, like Tesla's map: the car always points straight up the screen and in a turn the whole map
           turns around it (the camera is locked to the car's smooth on-screen direction, with only a very light
           smoothing against tiny jitters) */
        if(camHd===null) camHd=car.hd;
        /* (Nov 23) Settings -> Map and view -> Smooth map turning: the map follows the car's turn gently (about a
           second behind) instead of turning with it */
        const rate=TN.settings&&TN.settings.smoothTurn?2.2:12;
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
        /* (the 2D/3D camera angle, worked out here because the aim below needs the angle actually used: it used the
           Classic angle, up to 74° with a route, against 52° in Clean, so on raised roads like the Champlain bridge the
           aim went 30 m too far ahead and the car slid off the bottom of the screen) */
        {const want=TN.viewClean?1:0;TN._ck=(TN._ck==null?want:TN._ck)+(want-(TN._ck==null?want:TN._ck))*Math.min(1,(dt||0.016)*2.5);}
        const ck=TN._ck||0,pitchNow=gPitch+(57-gPitch)*ck;   /* (2D: the old Clean camera, 57°, tilted toward the horizon; flat from above was too much, Nov 17) */
        let aim=ll;
        if(camY>0.3){
          const d=camY*Math.tan(pitchNow*TN.R),hr=camHd*TN.R;
          aim=TN.fromLocal(car.x+Math.sin(hr)*d,car.z-Math.cos(hr)*d);
        }
        autoZoom=gZoom;
        /* 2D view: flat and a little zoomed out (was 2 levels: too far, Nov 17), the car a little lower than the middle so more road ahead shows */
        const view={center:aim,bearing:camHd,zoom:Math.min(gZoom+userZoom,zMaxNow)-0.35*ck,pitch:pitchNow,padding:{top:Math.round(H*(0.56-0.06*ck)),bottom:0,left:0,right:0}};   /* (Clean: a bit higher than Classic, not "from space": 0.9 zoom out, 50°; it was 1.7 and 45°, which also drew up to a million triangles) */
        map.jumpTo(view);
        if(ready) setLite(true);
      }
      /* roads and trees are built around the car while following, and around what you look at when you browse */
      const ac=follow?{lng:ll[0],lat:ll[1]}:map.getCenter();
      /* building ahead: while driving, the areas in the direction you're going are built first (roads), and trees,
         buildings and water are centred up to 200 m ahead, so what you're about to see is ready before you get there */
      let ahead=ac;
      {const v=track.last?track.last.v:0;
       if(follow&&car&&car.hd!=null&&v>4){const hr=car.hd*TN.R;TN.aheadDir=[Math.sin(hr),Math.cos(hr)];   /* (east, north) */
         const d=Math.min(200,v*8),q=TN.fromLocal(car.x+Math.sin(hr)*d,car.z-Math.cos(hr)*d);ahead={lng:q[0],lat:q[1]};}
       else TN.aheadDir=null;}
      scene.update(ac.lng,ac.lat);
      if(trees){try{trees.update(ahead.lng,ahead.lat,lastFps);}catch(e){}}
      if(buildings){try{buildings.update(ahead.lng,ahead.lat,lastFps);}catch(e){}}
      if(landmarks){try{landmarks.update(ac.lng,ac.lat);}catch(e){}}
      if(rem){try{const tr0=performance.now(),q=TN.toLocal(ac.lng,ac.lat);rem.update(dt,q[0],q[1]);TN.prof('rem',performance.now()-tr0);}catch(e){}}
      if(buses){try{const tb0=performance.now(),q=TN.toLocal(ac.lng,ac.lat);buses.update(dt,q[0],q[1]);TN.prof('buses',performance.now()-tb0);}catch(e){}}
      if(fuel){try{const q=TN.toLocal(ac.lng,ac.lat);fuel.update(dt,q[0],q[1]);}catch(e){}}
      if(chg3d){try{const q=TN.toLocal(ac.lng,ac.lat);chg3d.update(dt,q[0],q[1]);}catch(e){}}
      if(parking){try{parking.update(dt);}catch(e){}}
      if(water){try{water.update(dt,ahead.lng,ahead.lat);}catch(e){}}
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
      try{scene.blinkTick(performance.now());}catch(e){}
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
      if(landmarks){try{landmarks.update(c.lng,c.lat);}catch(e){}}
      if(rem){try{const q=TN.toLocal(c.lng,c.lat);rem.update(dt,q[0],q[1]);}catch(e){}}
      if(buses){try{const q=TN.toLocal(c.lng,c.lat);buses.update(dt,q[0],q[1]);}catch(e){}}
      if(fuel){try{const q=TN.toLocal(c.lng,c.lat);fuel.update(dt,q[0],q[1]);}catch(e){}}
      if(chg3d){try{const q=TN.toLocal(c.lng,c.lat);chg3d.update(dt,q[0],q[1]);}catch(e){}}
      if(season){try{const q=TN.toLocal(c.lng,c.lat);season.update(dt,q[0],0,q[1],lastFps);}catch(e){}}
      if(water){try{water.update(dt,c.lng,c.lat);}catch(e){}}
    }
  }
  requestAnimationFrame(loop);
  /* when not following, still load roads where the map is looked at */
  map.on('moveend',()=>{if(!follow){const c=map.getCenter();wantPacks(c.lng,c.lat);}});
  const iv=setInterval(()=>{if(idx){const c=map.getCenter();wantPacks(c.lng,c.lat);clearInterval(iv);}},500);
})();
