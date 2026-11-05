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
   '#tn-search .i{padding-left:16px}#tn-search .x{padding:0 16px;cursor:pointer;display:none}'+
   '#tn-res{left:50%;top:76px;transform:translateX(-50%);width:min(44vw,560px);padding:6px;display:none;max-height:56vh;overflow:auto}'+
   '#tn-res .r{display:flex;align-items:center;gap:12px;padding:14px 12px;border-radius:12px;cursor:pointer;font-size:17px}'+
   '#tn-res .r:active,#tn-res .r:hover{background:rgba(255,255,255,.08)}#tn-res .r small{display:block;color:#9fb3c8;font-size:13px;margin-top:2px}'+
   '#tn-res .d{margin-left:auto;color:#9fb3c8;font-size:14px;white-space:nowrap}#tn-res .msg{padding:12px;color:#9fb3c8}'+
   '#tn-ov{left:50%;bottom:24px;transform:translateX(-50%);display:none;align-items:center;gap:18px;padding:14px 18px;font-size:16px}'+
   '#tn-ov small{color:#9fb3c8;font-size:14px}#tn-ov button,#tn-end{border:0;border-radius:12px;padding:12px 22px;font:600 17px system-ui,sans-serif;cursor:pointer}'+
   '#tn-ov .go{background:#1fa596;color:#fff}#tn-ov .cancel{background:#3a4352;color:#e8f1fa}'+
   '#tn-bar{left:16px;right:82px;top:16px;display:none;align-items:center;gap:16px;padding:12px 18px}'+
   '#tn-bar .a{width:44px;display:flex;justify-content:center}#tn-bar .t{flex:1;min-width:0}#tn-bar .dist{font:600 26px system-ui,sans-serif}'+
   '#tn-bar .ins{font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#tn-bar .eta{text-align:right;color:#cfe3f5;font-size:14px}#tn-bar .eta b{font-size:20px;display:block;color:#fff}'+
   '#tn-end{right:16px;bottom:228px;display:none;background:rgba(10,18,32,.88);color:#ff8a80}'+
   '#tn-roadname{left:16px;bottom:96px;display:none;font-size:15px;color:#9fb3c8}'+
   'body.tn-routing #status,body.tn-routing #tn-search{display:none}body.tn-routing #rec{top:auto;bottom:228px;left:16px}body.tn-routing #trips{top:auto;bottom:228px;left:132px}';
  document.head.appendChild(st);
  const el=(id,cls,html,tag)=>{const e=document.createElement(tag||'div');e.id=id;e.className='hud'+(cls?' '+cls:'');if(html) e.innerHTML=html;document.body.appendChild(e);return e;};
  this.box=el('tn-search','','<span class="i">'+TN.ICON('search',22,'#9fb3c8')+'</span><input type="text" placeholder="Search a place or address" autocomplete="off" spellcheck="false"><span class="x">'+TN.ICON('x',22,'#9fb3c8')+'</span>');
  this.res=el('tn-res');this.ov=el('tn-ov');this.bar=el('tn-bar','','<div class="a"></div><div class="t"><div class="dist"></div><div class="ins"></div></div><div class="eta"></div>');
  this.endBtn=el('tn-end','','End route','button');this.roadName=el('tn-roadname');
  const inp=this.input=this.box.querySelector('input'),x=this.box.querySelector('.x');
  let tmr=null;
  inp.addEventListener('focus',()=>{if(!inp.value) this.showRecent();});
  inp.addEventListener('input',()=>{x.style.display=inp.value?'flex':'none';clearTimeout(tmr);
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
    return '<div class="r" data-i="'+i+'"><span>'+(it.recent?TN.ICON('recent',22,'#9fb3c8'):TN.ICON('pin',24))+'</span><div>'+TN.esc(it.name)+'<small>'+TN.esc(it.sub||'')+'</small></div><span class="d">'+fmtDist(d)+'</span></div>';}).join('');
  R.querySelectorAll('.r').forEach(r=>r.onclick=()=>this.pick(items[+r.dataset.i]));
};
/* icons as small drawings (some car browsers lack symbol fonts) */
TN.ICON=(name,size,color)=>{const c=color||'currentColor',z=size||22,P={
  search:'<circle cx="10" cy="10" r="6.5" fill="none" stroke="'+c+'" stroke-width="2.4"/><path d="M15 15l5.5 5.5" stroke="'+c+'" stroke-width="2.6" stroke-linecap="round"/>',
  x:'<path d="M6 6l12 12M18 6L6 18" stroke="'+c+'" stroke-width="2.6" stroke-linecap="round"/>',
  pin:'<path d="M12 22s7-7.2 7-12.2A7 7 0 0 0 5 9.8C5 14.8 12 22 12 22z" fill="#ff5a4f"/><circle cx="12" cy="9.8" r="2.6" fill="#fff"/>',
  recent:'<circle cx="12" cy="12" r="8.5" fill="none" stroke="'+c+'" stroke-width="2.2"/><path d="M12 7.5V12l3 2" stroke="'+c+'" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
  straight:'<path d="M12 21V4M6 10l6-6 6 6" stroke="'+c+'" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  left:'<path d="M17 21v-7a4 4 0 0 0-4-4H5M10 5L5 10l5 5" stroke="'+c+'" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  right:'<path d="M7 21v-7a4 4 0 0 1 4-4h8M14 5l5 5-5 5" stroke="'+c+'" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  sleft:'<path d="M15 21v-6.5L7 6.5M7 12.5V6.5h6" stroke="'+c+'" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  sright:'<path d="M9 21v-6.5l8-8M11 6.5h6v6" stroke="'+c+'" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  uturn:'<path d="M8 21V9a4 4 0 0 1 8 0v4M12 10l4 4 4-4" stroke="'+c+'" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  round:'<circle cx="12" cy="11" r="5" fill="none" stroke="'+c+'" stroke-width="2.6"/><path d="M12 21v-5M15.5 7.5L19 4M19 4v4.5M19 4h-4.5" stroke="'+c+'" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  flag:'<path d="M6 21V4M6 4h11l-2.5 4L17 12H6" stroke="'+c+'" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
  }[name]||'';return '<svg width="'+z+'" height="'+z+'" viewBox="0 0 24 24" style="display:block">'+P+'</svg>';};
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
  /* round the corners like a real turn (two smoothing passes; the ends stay put) */
  for(let pass=0;pass<3;pass++){if(pts.length<3) break;const q=[pts[0]];
    for(let i=0;i<pts.length-1;i++){const A=pts[i],B=pts[i+1];q.push([A[0]*0.75+B[0]*0.25,A[1]*0.75+B[1]*0.25],[A[0]*0.25+B[0]*0.75,A[1]*0.25+B[1]*0.75]);}
    q.push(pts[pts.length-1]);pts.length=0;for(const p of q) pts.push(p);}
  const cum=[0];for(let i=1;i<pts.length;i++) cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  const steps=[];for(const lg of rt.legs) for(const s of lg.steps){const q=TN.toLocal(s.maneuver.location[0],s.maneuver.location[1]);
    let bi=0,bd=1e18;for(let i=0;i<pts.length;i++){const d=(pts[i][0]-q[0])**2+(pts[i][1]-q[1])**2;if(d<bd){bd=d;bi=i;}}
    steps.push({at:cum[bi],type:s.maneuver.type,mod:s.maneuver.modifier||'',exit:s.maneuver.exit,name:s.name||'',ref:s.ref||'',dest:s.destinations||''});}
  this.route={pts:pts,cum:cum,L:cum[cum.length-1],dur:rt.duration,dist:rt.distance,steps:steps,hy:null};
  this.idx=0;this.offT=0;this.drawn=-1;this.heights();this.draw(0);
  this.mapLine(rt.geometry.coordinates);
};
/* height of the route at each point: the road it runs on (bridges and ramps included) */
TN.Nav.prototype.heights=function(){
  const R=this.route,net=this.api.net,hs=[],lanes=[];
  for(let i=0;i<R.pts.length;i++){
    const p=R.pts[i],q=R.pts[Math.min(R.pts.length-1,i+1)],o=R.pts[Math.max(0,i-1)];let ux=q[0]-o[0],uz=q[1]-o[1];const ul=Math.hypot(ux,uz)||1;ux/=ul;uz/=ul;
    let best=null;
    net.near(p[0],p[1],12,(w,k)=>{if(w.tun) return;const r=TN.seg(w,k,p[0],p[1]);if(r.d>TN.width(w)/2+6) return;
      const sc=r.d+(1-Math.abs(r.tx*ux+r.tz*uz))*20;if(!best||sc<best.sc){const h=w.hs?w.hs[k]+(w.hs[k+1]-w.hs[k])*r.u:(w.br?w.H:0);
        /* two-way street: the driving lane is the right half (to the right of the travel direction) */
        const lane=w.ow?0:TN.width(w)/4;best={sc:sc,h:h,lane:lane};}});
    hs.push(best?best.h:(hs.length?hs[hs.length-1]:0));lanes.push(best?best.lane:0);
  }
  R.hy=hs;
  /* smooth the lane offset so the line doesn't jump where streets change */
  R.lane=lanes.map((v,i)=>{let a=0,n=0;for(let k=Math.max(0,i-4);k<=Math.min(lanes.length-1,i+4);k++){a+=lanes[k];n++;}return a/n;});
};
TN.Nav.prototype.draw=function(from){
  const R=this.route;if(!R) return;
  const S=this.api.scene;if(!S.three) return;
  if(!this.mat){this.mat=new THREE.MeshBasicMaterial({color:0x3b82f6,transparent:true,opacity:0.85,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-8,polygonOffsetUnits:-16});}
  const pos=[],idx=[],hw=1.3;let n=0;
  const a0=Math.max(0,from|0);
  for(let i=a0;i<R.pts.length;i++){
    const p=R.pts[i],q=R.pts[Math.min(R.pts.length-1,i+1)],o=R.pts[Math.max(0,i-1)];let ux=q[0]-o[0],uz=q[1]-o[1];const ul=Math.hypot(ux,uz)||1;ux/=ul;uz/=ul;
    const y=(R.hy?R.hy[i]:0)+0.16,lo=R.lane?R.lane[i]:0,cx=p[0]-uz*lo,cz=p[1]+ux*lo;
    pos.push(cx-uz*hw,y,cz+ux*hw,cx+uz*hw,y,cz-ux*hw);
    if(i>a0) idx.push(n-2,n-1,n+1,n-2,n+1,n);
    n+=2;
  }
  if(this.mesh){S.three.scene.remove(this.mesh);this.mesh.geometry.dispose();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);
  this.mesh=new THREE.Mesh(g,this.mat);this.mesh.frustumCulled=false;this.mesh.renderOrder=4;S.three.scene.add(this.mesh);this.drawn=a0;
};
/* the route as a map line: stays thick and visible at any zoom (overview, and far ahead beyond the 3D roads) */
TN.Nav.prototype.mapLine=function(coords){
  const map=this.api.map,data={type:'Feature',geometry:{type:'LineString',coordinates:coords}};
  try{
    if(map.getSource('tn-route')) map.getSource('tn-route').setData(data);
    else{map.addSource('tn-route',{type:'geojson',data:data});
      map.addLayer({id:'tn-route-casing',type:'line',source:'tn-route',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#ffffff','line-width':['interpolate',['linear'],['zoom'],10,6,16,12],'line-opacity':0.9}});
      map.addLayer({id:'tn-route-line',type:'line',source:'tn-route',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#3b82f6','line-width':['interpolate',['linear'],['zoom'],10,4,16,8]}});}
    const end=coords[coords.length-1];
    if(!this.pinEl){this.pinEl=document.createElement('div');this.pinEl.innerHTML=TN.ICON('pin',40);this.pinEl.style.transform='translateY(-18px)';}
    if(!this.pin&&typeof maplibregl!=='undefined') this.pin=new maplibregl.Marker({element:this.pinEl,anchor:'bottom'}).setLngLat(end).addTo(map);
    else if(this.pin) this.pin.setLngLat(end);
  }catch(e){}
};
TN.Nav.prototype.clearMapLine=function(){
  const map=this.api.map;try{if(map.getLayer('tn-route-line')) map.removeLayer('tn-route-line');if(map.getLayer('tn-route-casing')) map.removeLayer('tn-route-casing');if(map.getSource('tn-route')) map.removeSource('tn-route');}catch(e){}
  if(this.pin){try{this.pin.remove();}catch(e){}this.pin=null;}
};
TN.Nav.prototype.overview=function(){
  const R=this.route,api=this.api;api.setFollow(false);
  try{for(const id of ['tn-route-casing','tn-route-line']) if(api.map.getLayer(id)) api.map.setLayoutProperty(id,'visibility','visible');}catch(e){}
  let a=[1e9,1e9],b=[-1e9,-1e9];for(let i=0;i<R.pts.length;i+=4){const ll=TN.fromLocal(R.pts[i][0],R.pts[i][1]);a=[Math.min(a[0],ll[0]),Math.min(a[1],ll[1])];b=[Math.max(b[0],ll[0]),Math.max(b[1],ll[1])];}
  /* the overview position, worked out directly: the middle of the route, and the zoom at which the route fills
     the screen between the top and bottom panels (the map's own fit function gets this wrong with a tilted camera) */
  try{
    const cv=api.map.getCanvas(),W=Math.max(300,cv.clientWidth-160),H=Math.max(200,cv.clientHeight-260);
    const midLat=(a[1]+b[1])/2,mx=(b[0]-a[0])*111320*Math.cos(midLat*Math.PI/180),my=(b[1]-a[1])*111320;
    const mpp=Math.max(mx/W,my/H,0.5);
    let z=Math.log2(156543.03*Math.cos(midLat*Math.PI/180)/mpp)-1;
    z=Math.max(10,Math.min(18,z-0.15));
    /* (clear the following camera's large top margin first, or the route is squeezed into a small strip) */
    api.map.easeTo({center:[(a[0]+b[0])/2,(a[1]+b[1])/2],zoom:z,pitch:0,bearing:0,padding:{top:0,bottom:0,left:0,right:0},offset:[0,-30],duration:900});
  }catch(e){}
  const arr=new Date(Date.now()+R.dur*1000);
  this.ov.style.display='flex';
  this.ov.innerHTML='<div><b>'+TN.esc(this.dest.name)+'</b><br><small>'+Math.max(1,Math.round(R.dur/60))+' min \u00b7 '+fmtDist(R.dist)+' \u00b7 arrive '+arr.toTimeString().slice(0,5)+'</small></div><button class="go">Go</button><button class="cancel">Cancel</button>';
  this.ov.querySelector('.go').onclick=()=>this.go();
  this.ov.querySelector('.cancel').onclick=()=>this.end();
};
TN.Nav.prototype.go=function(){
  /* while driving, the 3D line shows the route; the flat map line was only for the overview */
  try{for(const id of ['tn-route-casing','tn-route-line']) if(this.api.map.getLayer(id)) this.api.map.setLayoutProperty(id,'visibility','none');}catch(e){}
  this.ov.style.display='none';this.active=true;document.body.classList.add('tn-routing');
  this.bar.style.display='flex';this.endBtn.style.display='block';this.roadName.style.display='block';
  this.api.setFollow(true);
};
TN.Nav.prototype.end=function(){
  this.active=false;this.route=null;document.body.classList.remove('tn-routing');
  this.ov.style.display='none';this.bar.style.display='none';this.endBtn.style.display='none';this.roadName.style.display='none';
  if(this.mesh){this.api.scene.three.scene.remove(this.mesh);this.mesh.geometry.dispose();this.mesh=null;}
  this.clearMapLine();this.input.value='';this.api.setFollow(true);
};
/* ---------- the car on the route (like Google Maps, Waze, Codriver) ----------
   While navigating and near the route, the car is drawn ON the route path (rounded corners): it glides forward at
   the current speed between GPS readings and is gently pulled towards where each reading says it is. Its heading
   is the direction of the path, so a turn is a smooth curve. Off the route (over 25 m), normal following takes over. */
TN.Nav.prototype.place=function(base,L,now,dt){
  const R=this.route;if(!R||!this.active||!L||!base||base.x==null) return null;
  /* where the GPS is along the route (searching around the last place) */
  let bi=this.pi||this.idx||0,bd=1e18;
  for(let i=Math.max(0,bi-60);i<Math.min(R.pts.length,bi+200);i++){const d=(R.pts[i][0]-L.x)**2+(R.pts[i][1]-L.z)**2;if(d<bd){bd=d;bi=i;}}
  const gd=Math.sqrt(bd);
  /* clearly not on the route (missed a turn): show where the car really is, at once */
  {const P0=R.pts[Math.max(0,bi-2)],P1=R.pts[Math.min(R.pts.length-1,bi+2)];
   const rh=(Math.atan2(P1[0]-P0[0],-(P1[1]-P0[1]))*180/Math.PI+360)%360;
   const off=Math.abs(((base.hd-rh+540)%360)-180);
   /* (a different direction must last a moment: during a normal turn the two briefly differ) */
   if(gd>8&&off>55&&L.v>2) this.relT=(this.relT||0)+dt;else this.relT=0;
   if(gd>12||this.relT>0.6||this.rerouting){this.ps=null;return null;}}
  this.pi=bi;
  /* projection on the segment for a precise distance */
  const i0=Math.max(0,Math.min(R.pts.length-2,bi-(bi>0&&bi===R.pts.length-1?1:0)));
  const A=R.pts[i0],B=R.pts[i0+1],dx=B[0]-A[0],dz=B[1]-A[1],l2=dx*dx+dz*dz||1;
  const u=Math.max(0,Math.min(1,((L.x-A[0])*dx+(L.z-A[1])*dz)/l2));
  const age=Math.min(1,Math.max(0,(now-L.t)/1000));
  const sGps=R.cum[i0]+u*Math.sqrt(l2)+L.v*age*0.5;
  if(this.ps==null) this.ps=sGps;
  /* glide at the current speed, and correct a part of the gap each second (never backwards when moving) */
  const v=L.v<0.5?0:L.v;
  let ns=this.ps+v*dt+(sGps-this.ps)*Math.min(1,dt*1.5);
  if(v>0.5&&ns<this.ps) ns=this.ps;
  this.ps=Math.max(0,Math.min(R.L,ns));
  /* point and direction on the path at that distance */
  let j=Math.max(0,Math.min(R.pts.length-2,this.pi));while(j>0&&R.cum[j]>this.ps) j--;while(j<R.pts.length-2&&R.cum[j+1]<this.ps) j++;
  const P=R.pts[j],Q=R.pts[j+1],sg=R.cum[j+1]-R.cum[j]||1,t=(this.ps-R.cum[j])/sg;
  const px=P[0]+(Q[0]-P[0])*t,pz=P[1]+(Q[1]-P[1])*t;
  /* direction from a little behind to a little ahead: smooth through the curve */
  const at=sd=>{let k=j;sd=Math.max(0,Math.min(R.L,sd));while(k>0&&R.cum[k]>sd) k--;while(k<R.pts.length-2&&R.cum[k+1]<sd) k++;
    const a=R.pts[k],b=R.pts[k+1],g=R.cum[k+1]-R.cum[k]||1,tt=(sd-R.cum[k])/g;return [a[0]+(b[0]-a[0])*tt,a[1]+(b[1]-a[1])*tt];};
  const p1=at(this.ps-3),p2=at(this.ps+3);
  const hd=(Math.atan2(p2[0]-p1[0],-(p2[1]-p1[1]))*180/Math.PI+360)%360;
  const lo=R.lane?R.lane[j]+(R.lane[j+1]-R.lane[j])*t:0,ux=Math.sin(hd*Math.PI/180),uz=-Math.cos(hd*Math.PI/180);
  const y=R.hy?R.hy[j]+(R.hy[j+1]-R.hy[j])*t:(base.y||0);
  return Object.assign({},base,{x:px-uz*lo,z:pz+ux*lo,hd:hd,y:y,onRoute:true});
};
/* ---------- while driving ---------- */
TN.Nav.prototype.instr=function(s){
  const m=s.mod,side=m.indexOf('left')>=0?'left':m.indexOf('right')>=0?'right':'';
  const arrow={'left':'left','right':'right','slight left':'sleft','slight right':'sright','sharp left':'left','sharp right':'right','straight':'straight','uturn':'uturn'}[m]||'straight';
  let t,a=arrow;
  switch(s.type){
    case 'depart':t='Head '+(s.name?'on '+s.name:'out');break;
    case 'arrive':t='Arrive at your destination';a='flag';break;
    case 'turn':case 'end of road':t='Turn '+(m||'');break;
    case 'fork':t='Keep '+(side||'straight');break;
    case 'merge':t='Merge'+(side?' '+side:'');break;
    case 'on ramp':t='Take the ramp'+(side?' on the '+side:'');break;
    case 'off ramp':t='Take the exit'+(side?' on the '+side:'');break;
    case 'roundabout':case 'rotary':t='At the roundabout, take exit '+(s.exit||1);a='round';break;
    case 'exit roundabout':case 'exit rotary':t='Exit the roundabout';break;
    case 'new name':case 'continue':t=m&&m!=='straight'?'Keep '+side:'Continue';break;
    default:t=m?'Turn '+m:'Continue';
  }
  const where=s.type==='off ramp'||s.type==='on ramp'?(s.dest||s.ref||s.name):(s.name||s.ref);
  return {a:a,t:t,where:where};
};
/* recalculate from where the car is now: the old line fades, the top bar says so, the new route replaces it */
TN.Nav.prototype.reroute=async function(){
  this.rerouting=true;this.lastReroute=Date.now();this.offT=0;
  this.bar.querySelector('.dist').textContent='Recalculating\u2026';this.bar.querySelector('.ins').textContent='';
  if(this.mat) this.mat.opacity=0.25;
  try{await this.plan(true);}catch(e){}
  if(this.mat) this.mat.opacity=0.85;
  this.rerouting=false;this.pi=0;this.ps=null;this.idx=0;
};
TN.Nav.prototype.update=function(dt){
  if(!this.route||!this.active) return;
  const R=this.route,c=this.api.getCar();if(!c||c.x==null) return;
  /* where the car is along the route (searching a little ahead of the last place) */
  let bi=this.idx,bd=1e18;
  for(let i=Math.max(0,this.idx-20);i<Math.min(R.pts.length,this.idx+400);i++){const d=(R.pts[i][0]-c.x)**2+(R.pts[i][1]-c.z)**2;if(d<bd){bd=d;bi=i;}}
  const off=Math.sqrt(bd);this.idx=bi;const s=R.cum[bi],left=R.L-s;
  if(bi-this.drawn>8) this.draw(Math.max(0,bi-2));
  if(this.rerouting) return;
  /* next step ahead */
  let nx=null;for(const st of R.steps){if(st.at>s+8){nx=st;break;}}
  if(!nx) nx=R.steps[R.steps.length-1];
  const I=this.instr(nx),dNext=Math.max(0,nx.at-s);
  if(this.lastIcon!==I.a){this.bar.querySelector('.a').innerHTML=TN.ICON(I.a,42,'#ffffff');this.lastIcon=I.a;}
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
  /* off the route: far from it, or away from it in a clearly different direction */
  const P0=R.pts[Math.max(0,bi-2)],P1=R.pts[Math.min(R.pts.length-1,bi+2)];
  const rh=(Math.atan2(P1[0]-P0[0],-(P1[1]-P0[1]))*180/Math.PI+360)%360,hoff=Math.abs(((c.hd-rh+540)%360)-180);
  const away=v>1.5&&(off>18||(off>10&&hoff>50));
  if(away) this.offT+=dt;else this.offT=Math.max(0,this.offT-dt*2);
  const need=off>10&&hoff>50?1.5:2;
  if(this.offT>need&&!this.rerouting&&Date.now()-this.lastReroute>5000){this.reroute();}
};
