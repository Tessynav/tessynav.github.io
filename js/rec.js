/* TessyNav recorder v1: record drives, download them, replay them with raw GPS vs shown car */
const REPLAY=new URLSearchParams(location.search).has('replay');
let rec=null,recTimer=null,recTicks=0,recFrames=0,recMaxGap=0,recLastFrame=0,replaying=false;
function r1(v,d){const k=Math.pow(10,d);return Math.round(v*k)/k;}
function mmss(ms){const s=Math.max(0,Math.floor(ms/1000));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}

/* ---------- Panel for messages and buttons ---------- */
const recPanel=document.createElement('div');
recPanel.className='hud';
recPanel.style.cssText='display:none;top:50%;left:50%;transform:translate(-50%,-50%);font-size:16px;text-align:center;z-index:10;max-width:90%;line-height:1.5';
document.body.appendChild(recPanel);
function showPanel(html,buttons){
  recPanel.innerHTML='<div style="margin-bottom:12px">'+html+'</div>';
  const row=document.createElement('div');row.style.cssText='display:flex;gap:10px;justify-content:center;flex-wrap:wrap';
  for(const [label,fn] of buttons){
    const b=document.createElement('button');b.textContent=label;
    b.style.cssText='font-size:16px;padding:10px 18px;border:0;border-radius:10px;background:#2bb3a3;color:#fff;cursor:pointer';
    b.onclick=fn;row.appendChild(b);
  }
  recPanel.appendChild(row);recPanel.style.display='block';
}
function hidePanel(){recPanel.style.display='none';}

/* ---------- Saving trips in this browser ---------- */
function saveTrip(trip){
  const key='rec:trip:'+trip.start,json=JSON.stringify(trip);
  let list=cacheGet('rec:list')||[];
  for(let attempt=0;attempt<5;attempt++){
    try{
      localStorage.setItem(key,json);
      list=list.filter(x=>x.key!==key);
      list.push({key:key,start:trip.start,dur:trip.dur||0,n:trip.g.length});
      while(list.length>3){const old=list.shift();try{localStorage.removeItem(old.key);}catch(e){}}
      localStorage.setItem('rec:list',JSON.stringify(list));
      return true;
    }catch(e){
      if(!list.length) return false;
      const old=list.shift();try{localStorage.removeItem(old.key);}catch(e2){}
    }
  }
  return false;
}
function loadTrip(key){try{return JSON.parse(localStorage.getItem(key));}catch(e){return null;}}
function tripName(t){const d=new Date(t.start);return d.toLocaleDateString()+' '+d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+' · '+mmss(t.dur||0);}
function downloadTrip(trip){
  try{
    const d=new Date(trip.start),stamp=d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'-'+String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0');
    const blob=new Blob([JSON.stringify(trip)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='tessynav-trip-'+stamp+'.json';
    document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},3000);
  }catch(e){showPanel('Download is not available in this browser.',[['Close',hidePanel]]);}
}

/* ---------- Recording ---------- */
const recBtn=document.createElement('button');
recBtn.className='hud';
recBtn.style.cssText='top:294px;left:12px;font-size:13px;border:0;cursor:pointer';
if(!REPLAY) document.body.appendChild(recBtn);
function recLabel(){
  if(!rec){recBtn.textContent='● Record';recBtn.style.color='';return;}
  recBtn.textContent='■ Stop '+mmss(Date.now()-rec.start);recBtn.style.color='#ff6b6b';
}
recLabel();
function recT(){return Date.now()-rec.start;}
function recStart(){
  rec={v:1,start:Date.now(),info:{ua:navigator.userAgent,w:innerWidth,h:innerHeight,dpr:window.devicePixelRatio||1,
    quality:quality,view:viewMode,date:new Date().toISOString()},
    g:[],f:[],p:[],e:[]};
  recTicks=0;recFrames=0;recMaxGap=0;
  recTimer=setInterval(recTick,500);recLabel();
}
function recTick(){
  if(!rec) return;
  recTicks++;
  if(gPos){
    const mv=Math.hypot(snapOff[0],snapOff[1]);
    rec.f.push([recT(),r1(gPos[1],7),r1(gPos[0],7),r1(gHd,1),snapOk?1:0,snapCls||'',r1(mv,1),follow?1:0,r1(map.getZoom(),2)]);
  }
  if(recTicks%2===0){rec.p.push([recT(),recFrames,Math.round(recMaxGap)]);recFrames=0;recMaxGap=0;}
  if(recTicks%2===0) recLabel();
  if(recTicks%20===0){rec.dur=recT();try{localStorage.setItem('rec:current',JSON.stringify(rec));}catch(e){}}
}
function recStop(){
  if(!rec) return;
  clearInterval(recTimer);
  rec.dur=recT();
  const trip=rec;rec=null;recLabel();
  try{localStorage.removeItem('rec:current');}catch(e){}
  const saved=saveTrip(trip);
  showPanel('Trip recorded: '+mmss(trip.dur)+' · '+trip.g.length+' GPS points'+(saved?'':'<br><b>Not enough space to keep it here, download it now.</b>'),
    [['Download',()=>downloadTrip(trip)],['Replay',()=>{location.href=location.pathname+'?replay='+encodeURIComponent('rec:trip:'+trip.start);}],['Close',hidePanel]]);
}
recBtn.onclick=()=>{if(rec) recStop(); else recStart();};

const recBaseOnPos=onPos;
onPos=function(p){
  recBaseOnPos(p);
  if(rec&&!replaying){
    const c=p.coords;
    rec.g.push([recT(),r1(c.latitude,7),r1(c.longitude,7),r1(c.accuracy||0,1),
      c.speed==null||isNaN(c.speed)?null:r1(c.speed,2),
      c.heading==null||isNaN(c.heading)?null:r1(c.heading,1),r1(heading,1)]);
  }
};
function recFrameLoop(now){
  requestAnimationFrame(recFrameLoop);
  if(recLastFrame) recMaxGap=Math.max(recMaxGap,now-recLastFrame);
  recLastFrame=now;recFrames++;
}
requestAnimationFrame(recFrameLoop);
window.addEventListener('error',e=>{if(rec) rec.e.push([recT(),String(e.message||'error').slice(0,200)]);});

/* Recover a trip interrupted by a crash or reload */
(function(){
  const cur=cacheGet('rec:current');
  if(cur&&cur.g&&cur.g.length){saveTrip(cur);}
  try{localStorage.removeItem('rec:current');}catch(e){}
})();

/* ---------- Replay ---------- */
const fakeWatchers=[];
if(REPLAY){
  const fakeGeo={
    watchPosition:function(ok){fakeWatchers.push(ok);return fakeWatchers.length;},
    clearWatch:function(){},
    getCurrentPosition:function(){}
  };
  try{navigator.geolocation.watchPosition=fakeGeo.watchPosition;navigator.geolocation.clearWatch=fakeGeo.clearWatch;navigator.geolocation.getCurrentPosition=fakeGeo.getCurrentPosition;}catch(e){}
  if(navigator.geolocation.watchPosition!==fakeGeo.watchPosition){
    try{Object.defineProperty(navigator,'geolocation',{value:fakeGeo,configurable:true});}catch(e){}
  }
}
let rpTrip=null,rpIdx=0,rpF=0,rpP=0,rpSpeed=1,rpPaused=false,rpClock=0,rpLast=0,rpRaw=[],rpUi=null,rpTxt=null,rpUiT=0;
function rpFeed(r){
  const p={timestamp:Date.now(),coords:{latitude:r[1],longitude:r[2],accuracy:r[3],speed:r[4],heading:r[5]}};
  for(const f of fakeWatchers){try{f(p);}catch(e){console.warn(e);}}
  try{map.getSource('rp-now').setData({type:'Feature',geometry:{type:'Point',coordinates:[r[2],r[1]]}});}catch(e){}
}
function rpSeek(t){
  const g=rpTrip.g;
  rpClock=Math.max(g[0][0],Math.min(t,g[g.length-1][0]));
  rpIdx=0;while(rpIdx<g.length&&g[rpIdx][0]<=rpClock) rpIdx++;
  if(rpIdx>0) rpFeed(g[rpIdx-1]);
  rpF=0;rpP=0;
}
function rpFrame(now){
  requestAnimationFrame(rpFrame);
  if(!replaying) return;
  if(!rpPaused) rpClock+=(now-(rpLast||now))*rpSpeed;
  rpLast=now;
  const g=rpTrip.g;
  while(rpIdx<g.length&&g[rpIdx][0]<=rpClock){rpFeed(g[rpIdx]);rpIdx++;}
  if(now-rpUiT>250){
    rpUiT=now;
    const f=rpTrip.f,p=rpTrip.p;
    while(rpF<f.length-1&&f[rpF+1][0]<=rpClock) rpF++;
    while(rpP<p.length-1&&p[rpP+1][0]<=rpClock) rpP++;
    const fs=f[rpF],ps=p[rpP];
    let info='';
    if(fs) info+=(fs[4]?'on road · moved '+fs[6]+' m'+(fs[5]?' ('+fs[5]+')':''):'finding road');
    if(ps) info+=' · '+ps[1]+' fps · worst frame '+ps[2]+' ms';
    rpTxt.innerHTML=mmss(rpClock-g[0][0])+' / '+mmss(g[g.length-1][0]-g[0][0])+' · '+rpSpeed+'x'+(rpPaused?' · paused':'')+'<br><small>Recorded: '+info+'</small>';
  }
}
function rpAddOverlays(){
  const raw={type:'Feature',geometry:{type:'MultiPoint',coordinates:rpTrip.g.map(r=>[r[2],r[1]])}};
  const shown={type:'Feature',geometry:{type:'LineString',coordinates:rpTrip.f.map(r=>[r[2],r[1]])}};
  const add=()=>{
    try{
      map.addSource('rp-raw',{type:'geojson',data:raw});
      map.addSource('rp-shown',{type:'geojson',data:shown});
      map.addSource('rp-now',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
      map.addLayer({id:'rp-shown',type:'line',source:'rp-shown',paint:{'line-color':'#2bd1bd','line-width':4,'line-opacity':0.85}});
      map.addLayer({id:'rp-raw',type:'circle',source:'rp-raw',paint:{'circle-radius':4,'circle-color':'#ff3b3b','circle-opacity':0.6}});
      map.addLayer({id:'rp-now',type:'circle',source:'rp-now',paint:{'circle-radius':8,'circle-color':'#ff1f1f','circle-stroke-color':'#fff','circle-stroke-width':2}});
    }catch(e){console.warn(e);}
  };
  if(map.loaded()) add(); else map.once('load',add);
}
function rpButtons(){
  rpUi=document.createElement('div');rpUi.className='hud';
  rpUi.style.cssText='bottom:90px;left:50%;transform:translateX(-50%);font-size:15px;text-align:center;z-index:9';
  rpTxt=document.createElement('div');rpTxt.style.marginBottom='8px';rpUi.appendChild(rpTxt);
  const row=document.createElement('div');row.style.cssText='display:flex;gap:8px;justify-content:center';
  const mk=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.style.cssText='font-size:15px;padding:8px 14px;border:0;border-radius:8px;background:#2bb3a3;color:#fff;cursor:pointer';b.onclick=()=>fn(b);row.appendChild(b);return b;};
  mk('−30 s',()=>rpSeek(rpClock-30000));
  mk('Pause',b=>{rpPaused=!rpPaused;b.textContent=rpPaused?'Play':'Pause';});
  mk('Speed',()=>{rpSpeed=rpSpeed>=8?1:rpSpeed*2;});
  mk('+30 s',()=>rpSeek(rpClock+30000));
  rpUi.appendChild(row);document.body.appendChild(rpUi);
}
function rpPlay(trip){
  if(!trip||!trip.g||trip.g.length<2){showPanel('This trip has no GPS points.',[['Close',hidePanel]]);return;}
  hidePanel();
  rpTrip=trip;rpRaw=[];rpIdx=0;rpF=0;rpP=0;rpClock=trip.g[0][0];rpLast=0;
  map.jumpTo({center:[trip.g[0][2],trip.g[0][1]],zoom:18});
  rpAddOverlays();rpButtons();
  replaying=true;
  if(watchId===null) btn.click();
  try{status.textContent='Replay: '+tripName(trip);}catch(e){}
  requestAnimationFrame(rpFrame);
}
function rpChooser(){
  const list=cacheGet('rec:list')||[];
  const buttons=list.slice().reverse().map(t=>[tripName(t),()=>rpPlay(loadTrip(t.key))]);
  buttons.push(['Open trip file…',()=>{
    const inp=document.createElement('input');inp.type='file';inp.accept='.json,application/json';
    inp.onchange=()=>{
      const file=inp.files[0];if(!file) return;
      const rd=new FileReader();
      rd.onload=()=>{try{rpPlay(JSON.parse(rd.result));}catch(e){showPanel('Could not read this file.',[['Close',hidePanel]]);}};
      rd.readAsText(file);
    };
    inp.click();
  }]);
  showPanel('<b>Replay a trip</b><br>Red dots: raw GPS · Teal line: where the car was shown',buttons);
}
if(REPLAY){
  const want=new URLSearchParams(location.search).get('replay');
  map.on('load',()=>{
    setTimeout(()=>{
      if(want&&want.indexOf('rec:trip:')===0){const t=loadTrip(want);if(t){rpPlay(t);return;}}
      rpChooser();
    },1500);
  });
}
