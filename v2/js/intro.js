/* TessyNav v2 — intro.js
   Opening animation (about 3.5 s), played while the map, roads and buildings load:
   the real city around you appears as glowing blue lines on a dark screen, the TessyNav name is traced in
   glowing outlines and then filled, with "Navigation for Tesla" under it and a scan line sweeping down;
   then everything fills in with its real colours.
   Not played after an update reload. One tap skips it. ?intro=0 in the address switches it off.
   Nothing here touches the car position, the roads data or the recording. */
var TN=globalThis.TN||{};globalThis.TN=TN;

TN.Intro=function(scene,map){this.scene=scene;this.map=map;this.on=true;this.done=false;};
TN.Intro.allowed=function(){
  try{
    if(/[?&]intro=0/.test(location.search)) return false;
    if(TN.settings&&TN.settings.intro===false) return false;
    if(/[?&]r=\d/.test(location.search)) return false;          /* reload after an update */
    if(sessionStorage.getItem('tn2_target')) return false;
  }catch(e){}
  return true;
};
TN.Intro.prototype.start=function(nt){
  if(!TN.Intro.allowed()||!this.scene.three) return false;
  const s=this.scene,m=this.map;this.nt=nt||0;this.t0=performance.now();s.introActive=true;
  this.mat=new THREE.MeshBasicMaterial({color:0x78dcff,wireframe:true,transparent:true,opacity:0.85,depthWrite:true});
  s.three.scene.overrideMaterial=this.mat;
  try{m.setPaintProperty('tn-night','fill-color','#080e1a');m.setPaintProperty('tn-night','fill-opacity',0.93);}catch(e){}
  try{m.setLayoutProperty('tn-buildings','visibility','none');}catch(e){}
  try{if(typeof m.setSky==='function') m.setSky({'sky-color':'#060b16','horizon-color':'#0e1a30','fog-color':'#080e1a','sky-horizon-blend':0.6,'horizon-fog-blend':0.5,'fog-ground-blend':0.85,'atmosphere-blend':0});}catch(e){}
  /* the name, tagline and scan line are drawn on a see-through layer above the map */
  const cv=document.createElement('canvas');cv.id='tn-intro';
  cv.style.cssText='position:absolute;left:0;top:0;width:100%;height:100%;z-index:50;pointer-events:auto;';
  document.body.appendChild(cv);this.cv=cv;this.g=cv.getContext('2d');
  cv.addEventListener('pointerdown',()=>this.finish(),{once:true});
  /* trees: plain blue lines too (their own colours would tint the lines) */
  this.colors=[];s.three.scene.traverse(o=>{if(o.isInstancedMesh&&o.instanceColor){this.colors.push([o,o.instanceColor]);o.instanceColor=null;}});
  /* the dark start screen goes away once the map has drawn itself dark */
  const boot=document.getElementById('tn-boot');
  if(boot){let n=0;const off=()=>{if(++n<3){m.once('render',off);try{m.triggerRepaint();}catch(e){}return;}boot.style.opacity='0';setTimeout(()=>{if(boot.parentNode) boot.parentNode.removeChild(boot);},400);};
    try{m.once('render',off);m.triggerRepaint();}catch(e){off();off();off();}}
  this.frame=this.frame.bind(this);requestAnimationFrame(this.frame);
  return true;
};
TN.Intro.prototype.frame=function(){
  if(this.done) return;
  const t=(performance.now()-this.t0)/1000,s=this.scene,m=this.map;
  /* keep the lines until something of the city has been built (at most 3.2 s) */
  const built=s.three&&s.three.scene.children.length>4;
  if(!this.tSolid&&s.three.scene.overrideMaterial) s.three.scene.traverse(o=>{if(o.isInstancedMesh&&o.instanceColor){this.colors.push([o,o.instanceColor]);o.instanceColor=null;}});
  /* the filled name stays readable for a good second before the colours come in */
  if(!this.tSolid&&t>2.7&&(built||t>4.2)) this.tSolid=t;
  const ts=this.tSolid||1e9,k=Math.min(1,Math.max(0,(t-ts)/0.8)),fade=k*k*(3-2*k);
  if(this.tSolid&&t-ts>0.2&&s.three.scene.overrideMaterial){s.three.scene.overrideMaterial=null;this.restoreColors();try{m.setLayoutProperty('tn-buildings','visibility','visible');}catch(e){}
    document.body.classList.remove('tn-intro');}
  try{m.setPaintProperty('tn-night','fill-opacity',0.93*(1-fade));}catch(e){}
  if(this.mat) this.mat.opacity=0.85*(1-fade);
  this.draw(t,1-fade);
  if(this.tSolid&&t-ts>=0.85){this.finish();return;}
  requestAnimationFrame(this.frame);
};
TN.Intro.prototype.draw=function(t,a){
  const cv=this.cv,g=this.g,dpr=Math.min(2,window.devicePixelRatio||1),W=cv.clientWidth,H=cv.clientHeight;
  if(cv.width!==Math.round(W*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);}
  g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);if(a<=0) return;
  const E=x=>x<0?0:x>1?1:x*x*(3-2*x);
  /* scan line */
  if(t<2.6){const y=H*((t/1.4)%1);g.fillStyle='rgba(120,220,255,'+(0.28*a)+')';g.fillRect(0,y,W,2);}
  /* the name: glowing outlines letter by letter, then filled */
  const txt='TessyNav',fs=Math.round(Math.min(72,W/8)),y=H*0.26;
  g.font='500 '+fs+'px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';g.textAlign='left';g.textBaseline='alphabetic';
  const full=g.measureText(txt).width,rs=Math.round(fs*1.25),gap=Math.round(fs*0.3),shift=(rs+gap)/2;let x=W/2-full/2+shift;
  /* Rocco, next to the name (fades in with it) */
  {const im=TN.roccoImage&&TN.roccoImage(),k=E((t-0.25)/0.5)*a;if(im&&im.complete&&im.naturalWidth&&k>0){g.save();g.globalAlpha=k;g.drawImage(im,W/2-(full+rs+gap)/2,y-fs*0.8-rs*0.2,rs,rs);g.restore();}}
  g.shadowColor='rgba(120,220,255,0.9)';
  for(let i=0;i<txt.length;i++){
    const ch=txt[i],w=g.measureText(ch).width,k=E((t-0.15-i*0.07)/0.25)*a;
    if(k>0){
      g.shadowBlur=12;g.strokeStyle='rgba(140,230,255,'+k+')';g.lineWidth=Math.max(1.2,fs/40);g.strokeText(ch,x,y);
      const f=E((t-1.0)/0.3)*a;if(f>0){g.shadowBlur=18;g.fillStyle='rgba(230,248,255,'+f+')';g.fillText(ch,x,y);}
    }
    x+=w;
  }
  g.shadowBlur=0;
  const u=E((t-0.7)/0.4)*a;
  if(u>0){
    g.fillStyle='rgba(120,220,255,'+u+')';g.fillRect(W/2+shift-full/2*u,y+fs*0.22,full*u,2);
    g.font='400 '+Math.round(fs*0.28)+'px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';g.textAlign='center';
    g.fillStyle='rgba(159,215,240,'+u+')';g.fillText('Navigation for Tesla',W/2+shift,y+fs*0.62);
  }
};
TN.Intro.prototype.restoreColors=function(){
  if(this.colors){for(const [o,c] of this.colors) o.instanceColor=c;this.colors=[];}
};
TN.Intro.prototype.finish=function(){
  if(this.done) return;this.done=true;
  const s=this.scene,m=this.map;
  if(s.three) s.three.scene.overrideMaterial=null;
  this.restoreColors();document.body.classList.remove('tn-intro');
  const boot=document.getElementById('tn-boot');if(boot&&boot.parentNode) boot.parentNode.removeChild(boot);
  try{m.setLayoutProperty('tn-buildings','visibility','visible');m.setPaintProperty('tn-night','fill-color','#0b1630');}catch(e){}
  if(this.cv&&this.cv.parentNode) this.cv.parentNode.removeChild(this.cv);
  if(this.mat){this.mat.dispose();this.mat=null;}
  s.introActive=false;
  try{s.applyNight(s.pendingNt!=null?s.pendingNt:this.nt);}catch(e){}
};
