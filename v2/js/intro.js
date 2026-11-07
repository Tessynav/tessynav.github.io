/* TessyNav v2 — intro.js (v7) — "Headlights on"
   The opening starts the moment the page appears (it is drawn by the page itself, in index.html): a dark screen,
   the TessyNav name, Tessy's headlights flash twice, then glow while the map loads. As soon as the map is ready (and
   the headlights have flashed), an orange light wave spreads from the headlights and reveals the real 3D city around
   you, the view settles in, and Rocco says hello. One tap skips it. Not played after an update reload (?r=), unless
   ?intro=1; ?intro=0 or the setting switches it off. Nothing here touches the car, the roads or the recording. */
var TN=globalThis.TN||{};globalThis.TN=TN;

TN.Intro=function(scene,map){this.scene=scene;this.map=map;this.done=false;};
TN.Intro.allowed=function(){return !!document.getElementById('tn-boot');};
/* called when the map has loaded: reveal as soon as the headlights have flashed (about 1.6 s after the page appeared) */
TN.Intro.prototype.start=function(){
  const b=document.getElementById('tn-boot');if(!b) return false;
  b.onclick=()=>this.reveal(true);
  const since=performance.now()-(window.TN_T0||0),wait=Math.max(250,1650-since);   /* (250 ms: the first frame of the city is drawn) */
  setTimeout(()=>this.reveal(false),wait);
  return true;
};
TN.Intro.prototype.reveal=function(skip){
  if(this.done) return;this.done=true;
  const b=document.getElementById('tn-boot');
  const finish=()=>{if(b&&b.parentNode) b.parentNode.removeChild(b);const u=document.getElementById('tn-upd');if(u) u.remove();   /* (the map is ready: no update screen after the intro) */
    const r=document.getElementById('tn-ring');if(r) r.remove();document.body.classList.remove('tn-intro');};
  if(!b){finish();return;}
  if(skip){b.style.transition='opacity .25s';b.style.opacity='0';setTimeout(finish,260);return;}
  /* the light wave from the headlights */
  const ring=document.createElement('div');ring.id='tn-ring';document.body.appendChild(ring);
  b.classList.add('reveal');
  /* the view settles in as the city appears (a gentle zoom of the picture, nothing moves in the map itself) */
  const m=document.getElementById('map');
  try{if(m&&m.animate) m.animate([{transform:'scale(1.08)'},{transform:'scale(1)'}],{duration:2100,easing:'cubic-bezier(.2,.7,.2,1)'});}catch(e){}
  setTimeout(()=>{finish();this.hello();},1900);
};
/* Rocco says hello (fun mode) */
TN.Intro.prototype.hello=function(){
  if(TN.settings&&TN.settings.fun===false) return;
  const fr=TN.LANG==='fr',h=document.createElement('div');h.id='tn-hi';h.className='notr';
  h.innerHTML=(TN.roccoSVG?TN.roccoSVG(46):'')+'<span>'+(fr?'C’est parti!':'Let’s roll!')+'</span>';
  document.body.appendChild(h);setTimeout(()=>{try{h.remove();}catch(e){}},2700);
};
