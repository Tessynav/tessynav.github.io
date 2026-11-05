/* TessyNav v2 — nav.js  (navigation, part 1)
   - search: results as you type (Photon, nearest first), recent destinations when the box is empty
   - route: OSRM (fastest by car), overview with time / distance / arrival, then Go or Cancel
   - the route as a blue line laid on the 3D roads (bridges included), trimmed behind the car
   - top bar: turn arrow, distance, instruction and street; arrival time, minutes and kilometres left
   - rerouting when you leave the route, arrival detection, End route
   Services: Photon (photon.komoot.io) and OSRM (router.project-osrm.org) are free public servers for testing. */
var TN=globalThis.TN||{};globalThis.TN=TN;

TN.Nav=function(api){
  this.api=api;this.route=null;this.mesh=null;this.mat=null;this.idx=0;this.offT=0;this.lastReroute=0;this.arriveT=0;
  this.recent=[];try{this.recent=JSON.parse(localStorage.getItem('tn2_recent')||'[]')||[];}catch(e){}
};
/* ---------- screen ---------- */
TN.Nav.prototype.build=function(){
  const st=document.createElement('style');
  st.textContent=
   '#tn-search{left:50%;top:16px;transform:translateX(-50%);width:min(44vw,560px);padding:0;display:flex;align-items:center}'+
   '#tn-search input{flex:1;background:transparent;border:0;outline:0;color:#e8f1fa;font:18px system-ui,sans-serif;padding:14px 16px 14px 6px}'+
   '#tn-search .i{padding-left:16px;font-size:20px;color:#9fb3c8}#tn-search .x{padding:0 16px;font-size:20px;color:#9fb3c8;cursor:pointer;display:none}'+
   '#tn-res{left:50%;top:76px;transform:translateX(-50%);width:min(44vw,560px);padding:6px;display:none;max-height:56vh;overflow:auto}'+
   '#tn-res .r{display:flex;align-items:center;gap:12px;padding:14px 12px;border-radius:12px;cursor:pointer;font-size:17px}'+
   '#tn-res .r:active,#tn-res .r:hover{background:rgba(255,255,255,.08)}#tn-res .r small{display:block;color:#9fb3c8;font-size:13px;margin-top:2px}'+
   '#tn-res .d{margin-left:auto;color:#9fb3c8;font-size:14px;white-space:nowrap}#tn-res .msg{padding:12px;color:#9fb3c8}'+
   '#tn-ov{left:50%;bottom:24px;transform:translateX(-50%);display:none;align-items:center;gap:18px;padding:14px 18px;font-size:16px}'+
   '#tn-ov small{color:#9fb3c8;font-size:14px}#tn-ov button,#tn-end{border:0;border-radius:12px;padding:12px 22px;font:600 17px system-ui,sans-serif;cursor:pointer}'+
   '#tn-ov .go{background:#1fa596;color:#fff}#tn-ov .cancel{background:#3a4352;color:#e8f1fa}'+
   '#tn-bar{left:16px;right:82px;top:16px;display:none;align-items:center;gap:16px;padding:12px 18px}'+
   '#tn-bar .a{font-size:40px;line-height:1;width:44px;text-align:center}#tn-bar .t{flex:1;min-width:0}#tn-bar .dist{font:600 26px system-ui,sans-serif}'+
   '#tn-bar .ins{font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#tn-bar .eta{text-align:right;color:#cfe3f5;font-size:14px}#tn-bar .eta b{font-size:20px;display:block;color:#fff}'+
   '#tn-end{right:16px;bottom:228px;display:none;background:rgba(10,18,32,.88);color:#ff8a80}'+
   '#tn-roadname{left:16px;bottom:96px;display:none;font-size:15px;color:#9fb3c8}'+
   'body.tn-routing #status,body.tn-routing #tn-search,body.tn-routing #rec{display:none}';
  document.head.appendChild(st);
  const el=(id,cls,html,tag)=>{const e=document.createElement(tag||'div');e.id=id;e.className='hud'+(cls?' '+cls:'');if(html) e.innerHTML=html;document.body.appendChild(e);return e;};
  this.box=el('tn-search','','<span class="i">\u2315</span><input type="text" placeholder="Search a place or address" autocomplete="off" spellcheck="false"><span class="x">\u2715</span>');
  this.res=el('tn-res');this.ov=el('tn-ov');this.bar=el('tn-bar','','<div class="a"></div><div class="t"><div class="dist"></div><div class="ins"></div></div><div class="eta"></div>');
  this.endBtn=el('tn-end','','End route','button');this.roadName=el('tn-roadname');
  const inp=this.input=this.box.querySelector('input'),x=this.box.querySelector('.x');
  let tmr=null;
  inp.addEventListener('focus',()=>{if(!inp.value) this.showRecent();});
  inp.addEventListener('input',()=>{x.style.display=inp.value?'block':'none';clearTimeout(tmr);
    if(inp.value.trim().length<2){this.showRecent();return;}tmr=setTimeout(()=>this.search(inp.value.trim()),300);});
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'&&this.results&&this.results[0]) this.pick(this.results[0]);if(e.key==='Escape') this.closeSearch();});
  x.onclick=()=>{inp.value='';x.style.display='none';this.showRecent();inp.focus();};
  this.endBtn.onclick=()=>this.end();
  document.addEventListener('pointerdown',e=>{if(!this.box.contains(e.target)&&!this.res.contains(e.target)) this.res.style.display='none';},true);
};
TN.Nav.prototype.closeSearch=function(){this.res.style.display='none';this.input.blur();};
TN.Nav.prototype.here=function(){const c=this.api.getCar();if(c&&c.x!=null) return TN.fromLocal(c.x,c.z);const m=this.api.map.getCenter();return [m.lng,m.lat];};
const fmtDist=m=>m<950?(m<100?Math.max(10,Math.round(m/10)*10):Math.round(m/50)*50)+' m':(m/1000).toFixed(m<9500?1:0)+' km';
TN.Nav.prototype.list=function(items,msg){
  this.results=items;const R=this.res;R.style.display='block';
  if(!items.length){R.innerHTML='<div class="msg">'+(msg||'No results')+'</div>';return;}
  const h=this.here();
  R.innerHTML=items.map((it,i)=>{const d=TN.distLL(h,[it.lng,it.lat]);
    return '<div class="r" data-i="'+i+'"><span>'+(it.recent?'\u21BB':'\uD83D\uDCCD')+'</span><div>'+TN.esc(it.name)+'<small>'+TN.esc(it.sub||'')+'</small></div><span class="d">'+fmtDist(d)+'</span></div>';}).join('');
  R.querySelectorAll('.r').forEach(r=>r.onclick=()=>this.pick(items[+r.dataset.i]));
};
TN.esc=t=>String(t==null?'':t).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
TN.distLL=(a,b)=>{const R=6371000,p=Math.PI/180,dLa=(b[1]-a[1])*p,dLo=(b[0]-a[0])*p,s=Math.sin(dLa/2)**2+Math.cos(a[1]*p)*Math.cos(b[1]*p)*Math.sin(dLo/2)**2;return 2*R*Math.asin(Math.sqrt(s));};
TN.Nav.prototype.showRecent=function(){
  if(!this.recent.length){this.res.style.display='none';return;}
  this.list(this.recent.map(r=>Object.assign({},r,{recent:true})));
};
TN.Nav.prototype.search=async function(q){
  const h=this.here(),my=++this.qn;this.qn=my;
  try{
    const u='https://photon.komoot.io/api/?q='+encodeURIComponent(q)+'&lat='+h[1].toFixed(4)+'&lon='+h[0].toFixed(4)+'&limit=7&lang=en';
    const r=await fetch(u);if(!r.ok) throw 0;const j=await r.json();if(my!==this.qn) return;
    const items=(j.features||[]).map(f=>{const p=f.properties||{},c=f.geometry.coordinates;
      const name=p.name||[p.housenumber,p.street].filter(Boolean).join(' ')||p.city||'Place';
      const sub=[p.name&&p.street?[p.housenumber,p.street].filter(Boolean).join(' '):'',p.city||p.county||'',p.state&&p.state!=='Quebec'&&p.state!=='Québec'?p.state:''].filter(Boolean).join(' \u00b7 ');
      return {name:name,sub:sub,lng:c[0],lat:c[1]};});
    items.sort((a,b)=>TN.distLL(h,[a.lng,a.lat])-TN.distLL(h,[b.lng,b.lat]));
    this.list(items);
  }catch(e){if(my===this.qn) this.list([],'Search is not available right now');}
};
TN.Nav.prototype.qn=0;
TN.Nav.prototype.pick=function(it){
  this.closeSearch();this.input.value=it.name;
  this.recent=[{name:it.name,sub:it.sub,lng:it.lng,lat:it.lat}].concat(this.recent.filter(r=>r.name!==it.name||Math.abs(r.lat-it.lat)>1e-4)).slice(0,6);
  try{localStorage.setItem('tn2_recent',JSON.stringify(this.recent));}catch(e){}
  this.dest=it;this.plan(false);
};
/* ---------- route ---------- */
TN.Nav.prototype.fetchRoute=async function(from,to){
  const u='https://router.project-osrm.org/route/v1/driving/'+from[0].toFixed(6)+','+from[1].toFixed(6)+';'+to[0].toFixed(6)+','+to[1].toFixed(6)+'?overview=full&geometries=geojson&steps=true';
  const r=await fetch(u);if(!r.ok) throw new Error('route');const j=await r.json();
  if(!j.routes||!j.routes[0]) throw new Error('no route');return j.routes[0];
};
TN.Nav.prototype.plan=async function(reroute){
  const from=this.here(),to=[this.dest.lng,this.dest.lat];
  if(!reroute){this.ov.style.display='flex';this.ov.innerHTML='<div>Calculating the route\u2026</div>';}
  try{
    const rt=await this.fetchRoute(from,to);this.setRoute(rt);
    if(!reroute) this.overview();
  }catch(e){
    if(!reroute){this.ov.innerHTML='<div>Could not find a route</div><button class="cancel">Close</button>';this.ov.querySelector('.cancel').onclick=()=>{this.ov.style.display='none';};}
  }
};
TN.Nav.prototype.setRoute=function(rt){
  /* the route line in local metres, densified to about every 5 m, with distances along it */
  const C=rt.geometry.coordinates,pts=[];
  for(let i=0;i<C.length;i++){const q=TN.toLocal(C[i][0],C[i][1]);
    if(i){const p=pts[pts.length-1],d=Math.hypot(q[0]-p[0],q[1]-p[1]),n=Math.floor(d/5);for(let k=1;k<n;k++) pts.push([p[0]+(q[0]-p[0])*k/n,p[1]+(q[1]-p[1])*k/n]);}
    pts.push(q);}
  const cum=[0];for(let i=1;i<pts.length;i++) cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  const steps=[];for(const lg of rt.legs) for(const s of lg.steps){const q=TN.toLocal(s.maneuver.location[0],s.maneuver.location[1]);
    let bi=0,bd=1e18;for(let i=0;i<pts.length;i++){const d=(pts[i][0]-q[0])**2+(pts[i][1]-q[1])**2;if(d<bd){bd=d;bi=i;}}
    steps.push({at:cum[bi],type:s.maneuver.type,mod:s.maneuver.modifier||'',exit:s.maneuver.exit,name:s.name||'',ref:s.ref||'',dest:s.destinations||''});}
  this.route={pts:pts,cum:cum,L:cum[cum.length-1],dur:rt.duration,dist:rt.distance,steps:steps,hy:null};
  this.idx=0;this.offT=0;this.drawn=-1;this.heights();this.draw(0);
};
/* height of the route at each point: the road it runs on (bridges and ramps included) */
TN.Nav.prototype.heights=function(){
  const R=this.route,net=this.api.net,hs=[];
  for(let i=0;i<R.pts.length;i++){
    const p=R.pts[i],q=R.pts[Math.min(R.pts.length-1,i+1)],o=R.pts[Math.max(0,i-1)];let ux=q[0]-o[0],uz=q[1]-o[1];const ul=Math.hypot(ux,uz)||1;ux/=ul;uz/=ul;
    let best=null;
    net.near(p[0],p[1],12,(w,k)=>{if(w.tun) return;const r=TN.seg(w,k,p[0],p[1]);if(r.d>TN.width(w)/2+6) return;
      const sc=r.d+(1-Math.abs(r.tx*ux+r.tz*uz))*20;if(!best||sc<best.sc){const h=w.hs?w.hs[k]+(w.hs[k+1]-w.hs[k])*r.u:(w.br?w.H:0);best={sc:sc,h:h};}});
    hs.push(best?best.h:(hs.length?hs[hs.length-1]:0));
  }
  R.hy=hs;
};
TN.Nav.prototype.draw=function(from){
  const R=this.route;if(!R) return;
  const S=this.api.scene;if(!S.three) return;
  if(!this.mat){this.mat=new THREE.MeshBasicMaterial({color:0x3b82f6,transparent:true,opacity:0.85,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-8,polygonOffsetUnits:-16});}
  const pos=[],idx=[],hw=1.6;let n=0;
  const a0=Math.max(0,from|0);
  for(let i=a0;i<R.pts.length;i++){
    const p=R.pts[i],q=R.pts[Math.min(R.pts.length-1,i+1)],o=R.pts[Math.max(0,i-1)];let ux=q[0]-o[0],uz=q[1]-o[1];const ul=Math.hypot(ux,uz)||1;ux/=ul;uz/=ul;
    const y=(R.hy?R.hy[i]:0)+0.14;
    pos.push(p[0]-uz*hw,y,p[1]+ux*hw,p[0]+uz*hw,y,p[1]-ux*hw);
    if(i>a0) idx.push(n-2,n-1,n+1,n-2,n+1,n);
    n+=2;
  }
  if(this.mesh){S.three.scene.remove(this.mesh);this.mesh.geometry.dispose();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);
  this.mesh=new THREE.Mesh(g,this.mat);this.mesh.frustumCulled=false;this.mesh.renderOrder=4;S.three.scene.add(this.mesh);this.drawn=a0;
};
TN.Nav.prototype.overview=function(){
  const R=this.route,api=this.api;api.setFollow(false);
  let a=[1e9,1e9],b=[-1e9,-1e9];for(let i=0;i<R.pts.length;i+=4){const ll=TN.fromLocal(R.pts[i][0],R.pts[i][1]);a=[Math.min(a[0],ll[0]),Math.min(a[1],ll[1])];b=[Math.max(b[0],ll[0]),Math.max(b[1],ll[1])];}
  try{api.map.fitBounds([a,b],{padding:{top:110,bottom:150,left:80,right:80},pitch:0,bearing:0,duration:900});}catch(e){}
  const arr=new Date(Date.now()+R.dur*1000);
  this.ov.style.display='flex';
  this.ov.innerHTML='<div><b>'+TN.esc(this.dest.name)+'</b><br><small>'+Math.max(1,Math.round(R.dur/60))+' min \u00b7 '+fmtDist(R.dist)+' \u00b7 arrive '+arr.toTimeString().slice(0,5)+'</small></div><button class="go">Go</button><button class="cancel">Cancel</button>';
  this.ov.querySelector('.go').onclick=()=>this.go();
  this.ov.querySelector('.cancel').onclick=()=>this.end();
};
TN.Nav.prototype.go=function(){
  this.ov.style.display='none';this.active=true;document.body.classList.add('tn-routing');
  this.bar.style.display='flex';this.endBtn.style.display='block';this.roadName.style.display='block';
  this.api.setFollow(true);
};
TN.Nav.prototype.end=function(){
  this.active=false;this.route=null;document.body.classList.remove('tn-routing');
  this.ov.style.display='none';this.bar.style.display='none';this.endBtn.style.display='none';this.roadName.style.display='none';
  if(this.mesh){this.api.scene.three.scene.remove(this.mesh);this.mesh.geometry.dispose();this.mesh=null;}
  this.input.value='';this.api.setFollow(true);
};
/* ---------- while driving ---------- */
TN.Nav.prototype.instr=function(s){
  const m=s.mod,side=m.indexOf('left')>=0?'left':m.indexOf('right')>=0?'right':'';
  const arrow={'left':'\u2190','right':'\u2192','slight left':'\u2196','slight right':'\u2197','sharp left':'\u21B0','sharp right':'\u21B1','straight':'\u2191','uturn':'\u21B6'}[m]||'\u2191';
  let t,a=arrow;
  switch(s.type){
    case 'depart':t='Head '+(s.name?'on '+s.name:'out');break;
    case 'arrive':t='Arrive at your destination';a='\uD83C\uDFC1';break;
    case 'turn':case 'end of road':t='Turn '+(m||'');break;
    case 'fork':t='Keep '+(side||'straight');break;
    case 'merge':t='Merge'+(side?' '+side:'');break;
    case 'on ramp':t='Take the ramp'+(side?' on the '+side:'');break;
    case 'off ramp':t='Take the exit'+(side?' on the '+side:'');break;
    case 'roundabout':case 'rotary':t='At the roundabout, take exit '+(s.exit||1);a='\u27F3';break;
    case 'exit roundabout':case 'exit rotary':t='Exit the roundabout';break;
    case 'new name':case 'continue':t=m&&m!=='straight'?'Keep '+side:'Continue';break;
    default:t=m?'Turn '+m:'Continue';
  }
  const where=s.type==='off ramp'||s.type==='on ramp'?(s.dest||s.ref||s.name):(s.name||s.ref);
  return {a:a,t:t,where:where};
};
TN.Nav.prototype.update=function(dt){
  if(!this.route||!this.active) return;
  const R=this.route,c=this.api.getCar();if(!c||c.x==null) return;
  /* where the car is along the route (searching a little ahead of the last place) */
  let bi=this.idx,bd=1e18;
  for(let i=Math.max(0,this.idx-20);i<Math.min(R.pts.length,this.idx+400);i++){const d=(R.pts[i][0]-c.x)**2+(R.pts[i][1]-c.z)**2;if(d<bd){bd=d;bi=i;}}
  const off=Math.sqrt(bd);this.idx=bi;const s=R.cum[bi],left=R.L-s;
  if(bi-this.drawn>8) this.draw(Math.max(0,bi-2));
  /* next step ahead */
  let nx=null;for(const st of R.steps){if(st.at>s+8){nx=st;break;}}
  if(!nx) nx=R.steps[R.steps.length-1];
  const I=this.instr(nx),dNext=Math.max(0,nx.at-s);
  this.bar.querySelector('.a').textContent=I.a;
  this.bar.querySelector('.dist').textContent=nx.type==='arrive'&&dNext<30?'Arriving':fmtDist(dNext);
  this.bar.querySelector('.ins').textContent=I.t+(I.where?' \u00b7 '+I.where:'');
  const remain=R.dur*(left/Math.max(1,R.L)),arr=new Date(Date.now()+remain*1000);
  this.bar.querySelector('.eta').innerHTML='<b>'+arr.toTimeString().slice(0,5)+'</b>'+Math.max(1,Math.round(remain/60))+' min \u00b7 '+fmtDist(left);
  this.roadName.textContent=c.w&&c.w.name?c.w.name:'';this.roadName.style.display=c.w&&c.w.name?'block':'none';
  /* arrived */
  if(left<30||(nx.type==='arrive'&&dNext<25)){this.arriveT+=dt;if(this.arriveT>3){this.bar.querySelector('.dist').textContent='You have arrived';this.bar.querySelector('.ins').textContent=TN.esc(this.dest.name);}
    if(this.arriveT>12) this.end();return;}
  /* left the route: find a new one (at most every 15 s) */
  const v=c.v!=null?c.v:5;
  if(off>40&&v>2) this.offT+=dt;else this.offT=Math.max(0,this.offT-dt);
  if(this.offT>5&&Date.now()-this.lastReroute>15000){this.lastReroute=Date.now();this.offT=0;
    this.bar.querySelector('.ins').textContent='Finding a new route\u2026';this.plan(true);}
};
