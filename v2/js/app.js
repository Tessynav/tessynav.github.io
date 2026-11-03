/* TessyNav v2 — app.js: buttons, GPS, road loading and the main loop */
var TN=globalThis.TN||{};globalThis.TN=TN;
TN.VERSION='v2 step 1';

(function(){
  const $=id=>document.getElementById(id);
  const start=(()=>{try{return JSON.parse(localStorage.getItem('lastPos'))||TN.ORIGIN;}catch(e){return TN.ORIGIN;}})();
  const map=new maplibregl.Map({container:'map',style:'https://tiles.openfreemap.org/styles/liberty',center:start,zoom:17,pitch:60,maxPitch:85,
    centerClampedToGround:false,maxTileCacheSize:60,fadeDuration:0,
    attributionControl:{customAttribution:'Roads: © OpenStreetMap contributors'}});
  const net=new TN.Net(),track=new TN.Track(net),scene=new TN.Scene(map,net),rec=new TN.Rec();
  TN.app={map:map,net:net,track:track,scene:scene,rec:rec};
  let follow=false,watchId=null,ready=false,camHd=null,gZoom=21.6,gPitch=72,camY=0;

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
      if(net.packs.has(k)||loading.has(k)) continue;
      loading.add(k);
      fetch(ROADS+'p/'+k+'.json').then(r=>r.status===404?{w:[],b:[]}:(r.ok?r.json():null)).then(P=>{
        loading.delete(k);if(P) pending.push([k,P]);
      }).catch(()=>loading.delete(k));
    }
    /* forget packs far behind */
    if(!net.job) for(const k of [...net.packs.keys()]){const [x,y]=k.split('_').map(Number);if(Math.abs(x-px)>2||Math.abs(y-py)>2){net.dropPack(k,true);net._dirty=true;}}
  }
  setInterval(()=>{
    /* add the packs that arrived, then rebuild the network in small steps (see the main loop) */
    if(net.job||(!pending.length&&!net._dirty)) return;
    const t0=performance.now();
    for(const [k,P] of pending.splice(0)) net.addPack(k,P,true);
    net._dirty=false;net.startRebuild();
    TN.prof('network',performance.now()-t0);
  },600);

  /* ---------- GPS ---------- */
  function onPos(p){
    const c=p.coords,now=Date.now();
    rec.gps(c);
    track.gps(now,c.longitude,c.latitude,c.accuracy,c.speed,c.heading);
    $('speed').innerHTML=Math.round((c.speed||0)*3.6)+' <small>km/h</small>';
    const car=track.car;
    if(c.accuracy>60) $('status').textContent='Waiting for precise GPS ('+Math.round(c.accuracy)+' m)…';
    else $('status').textContent='GPS '+Math.round(c.accuracy)+' m · '+(car&&car.snapped?('on road ('+car.cls+(car.br?', bridge':'')+')'):'finding road')+(covered?'':' · outside road tiles');
    if(c.accuracy<100){try{localStorage.setItem('lastPos',JSON.stringify([+c.longitude.toFixed(5),+c.latitude.toFixed(5)]));}catch(e){}}
    wantPacks(c.longitude,c.latitude);
  }
  $('btn').onclick=()=>{
    follow=true;$('btn').textContent='Recenter';
    if(watchId===null) watchId=navigator.geolocation.watchPosition(onPos,()=>{$('status').textContent='Location not available';},
      {enableHighAccuracy:true,maximumAge:0,timeout:15000});
  };
  map.on('dragstart',()=>{follow=false;});

  /* ---------- recording ---------- */
  $('rec').onclick=async()=>{
    if(!rec.rec){rec.start();$('rec').textContent='■ Stop';$('rec').style.color='#ff6b6b';return;}
    const trip=rec.stop();$('rec').textContent='● Record';$('rec').style.color='';
    uploadTrip(trip);
  };
  async function uploadTrip(trip){
    panel('Encrypting and uploading…',[]);
    try{const name=await TN.up.upload(trip);panel('Uploaded! Trip name:<br><b style="font-size:22px">'+name+'</b><br><small>Send this name to Claude.</small>',[['Close',hide]]);}
    catch(e){panel('Upload failed:<br><small>'+String(e.message||e)+'</small>',[['Try again',()=>uploadTrip(trip)],['Close',hide]]);}
  }
  const saved=rec.saved();
  if(saved&&saved.g&&saved.g.length>50) setTimeout(()=>panel('A recording was saved before the app closed ('+Math.round((saved.dur||0)/60000)+' min).',
    [['Upload it',()=>{try{localStorage.removeItem('tn2_rec');}catch(e){}uploadTrip(saved);}],['Delete',()=>{try{localStorage.removeItem('tn2_rec');}catch(e){}hide();}]]),1500);

  /* ---------- version ---------- */
  $('ver').onclick=async()=>{
    const mine=[...document.querySelectorAll('script[src]')].map(s=>s.getAttribute('src')).filter(s=>/^js\//.test(s));
    const label=s=>{const m=s.match(/js\/([\w-]+)\.js\?v=(\d+)/);return m?m[1]+' v'+m[2]:s;};
    panel('Checking…',[]);
    try{
      const html=await (await fetch(location.pathname+'?check='+Date.now(),{cache:'no-store'})).text();
      const now=[...html.matchAll(/<script[^>]+src="(js\/[^"]+)"/g)].map(m=>m[1]);
      const newer=now.join('|')!==mine.join('|');
      panel('TessyNav '+TN.VERSION+'<br><br>'+mine.map(label).join(', ')+(newer?'<br><br><b>An update is available.</b>':'<br><br>You have the latest version.'),
        newer?[['Update now',()=>{if(rec.rec){panel('Stop the recording first.',[['Close',hide]]);return;}location.replace(location.pathname+'?r='+Date.now());}],['Later',hide]]:[['Close',hide]]);
    }catch(e){panel('Could not check.',[['Close',hide]]);}
  };

  /* ---------- night ---------- */
  function night(){
    const c=map.getCenter(),alt=TN.sunAlt(new Date(),c.lat,c.lng);
    const nt=Math.min(1,Math.max(0,(6-alt)/12));
    if(ready) scene.applyNight(nt);
  }
  setInterval(night,60000);

  /* ---------- main loop ---------- */
  map.on('load',()=>{scene.styleMap();ready=true;night();});
  let last=performance.now(),fpsN=0,fpsT=performance.now(),worst=0,lastRec=0;
  let loopErr=0;
  function loop(){
    requestAnimationFrame(loop);
    try{frameBody();}catch(e){if(loopErr++<5) console.warn('frame',e);}
  }
  function frameBody(){
    const pnow=performance.now(),dt=Math.min(0.1,(pnow-last)/1000);worst=Math.max(worst,pnow-last);last=pnow;
    fpsN++;if(pnow-fpsT>=1000){rec.second(fpsN,worst);fpsN=0;worst=0;fpsT=pnow;}
    if(!ready) return;
    /* a few milliseconds per frame for the road network rebuild, so it never freezes the view */
    if(net.job){const tn=performance.now();net.step(6);TN.prof('network',performance.now()-tn);}
    const t0=performance.now();
    const car=track.frame(Date.now(),dt);
    TN.prof('track',performance.now()-t0);
    if(car&&car.x!=null){
      scene.placeCar(car.x,car.z,car.y||0,car.hd);
      const ll=TN.fromLocal(car.x,car.z);
      if(follow){
        const kmh=(track.last?track.last.v:0)*3.6;
        /* the camera turns with the car: tighter at speed, gentle when slow */
        if(camHd===null) camHd=car.hd;
        const rate=kmh<15?1.6:kmh<40?1.6+(kmh-15)/25*2.4:4;
        camHd=(camHd+TN.angDiff2(car.hd,camHd)*Math.min(1,dt*rate)+360)%360;
        let zoom=21.6-Math.min(0.5,kmh/200),pitch=72;
        const y=car.y||0;
        /* the camera rises with the car on bridges and ramps (it looks at the car at its real height), so the car
           keeps its normal size and the camera is always above the deck. Older map versions: pull back instead. */
        const lift=typeof map.setCenterClampedToGround==='function';
        if(!lift&&y>0.5){
          pitch-=Math.min(4,y*0.25);
          const Hc=map.getContainer().clientHeight||600,mpp=40075016.7*Math.cos(ll[1]*TN.R)/(512*Math.pow(2,zoom));
          const camH=1.5*Hc*mpp*Math.cos(pitch*TN.R),need=y+3.5;
          if(camH<need) zoom-=Math.log2(need/camH);
        }
        gZoom+=(zoom-gZoom)*Math.min(1,dt*2.5);gPitch+=(pitch-gPitch)*Math.min(1,dt*2.5);
        camY+=(y-camY)*Math.min(1,dt*4);
        const H=map.getContainer().clientHeight||800;
        const view={center:ll,bearing:camHd,zoom:gZoom,pitch:gPitch,padding:{top:Math.round(H*0.48),bottom:0,left:0,right:0}};
        if(lift) view.elevation=camY;
        map.jumpTo(view);
      }
      scene.update(ll[0],ll[1]);
      if(rec.rec&&Date.now()-lastRec>=500){lastRec=Date.now();rec.frame(car,map.getZoom(),follow);}
    }else{
      const c=map.getCenter();scene.update(c.lng,c.lat);
    }
  }
  requestAnimationFrame(loop);
  /* when not following, still load roads where the map is looked at */
  map.on('moveend',()=>{if(!follow){const c=map.getCenter();wantPacks(c.lng,c.lat);}});
  const iv=setInterval(()=>{if(idx){const c=map.getCenter();wantPacks(c.lng,c.lat);clearInterval(iv);}},500);
})();
