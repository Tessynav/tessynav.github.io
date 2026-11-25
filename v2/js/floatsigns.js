/* TessyNav v2 — floatsigns.js (v1, Nov 25)
   Floating road signs on city streets: stop, yield, speed limits, no U-turn / left / right, do not enter, school zone.
   - where: the City of Montréal's own sign list (every pole, updated daily by tessynav-roads/signs.py); elsewhere the
     stop and yield signs from OpenStreetMap (the ones the map used to draw small at the corners)
   - which: only the signs for YOUR way: on your side of the street (either side on a one-way), ahead of you and before
     the next intersection, so the cross street's stop sign never shows; at most the next 3 poles
   - how: each pole is a thin stem with its signs stacked on top (top sign first, like the real pole), facing you,
     floating above the roadside; they fade in and out
   - highways keep the big green signs (signs.js) */
var TN=globalThis.TN||{};globalThis.TN=TN;
TN.FLOAT_BASE='https://raw.githubusercontent.com/Tessynav/tessynav-roads/main/signs/';

TN.FloatSigns=function(o){
  this.net=o.net;this.scene=o.scene;this.track=o.track;
  this.idx=null;this.idxT=0;this.tiles=new Map();this.items=new Map();this.tex=new Map();this.t=0;
};
TN.FloatSigns.HW=/motorway|trunk/;

/* the area files: the list once (again after 6 hours), each area once */
TN.FloatSigns.prototype.load=function(lng,lat){
  const now=Date.now();
  if(!this.idx&&now-this.idxT>60000){this.idxT=now;
    fetch(TN.FLOAT_BASE+'index.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(j=>{if(j&&j.tiles){this.idx={set:new Set(j.tiles),k:j.tile||50,date:j.date};}}).catch(()=>{});}
  if(!this.idx) return;
  const K=this.idx.k,ix=Math.floor(lng*K),iy=Math.floor(lat*K);
  for(let a=-1;a<=1;a++) for(let b=-1;b<=1;b++){const key=(ix+a)+'_'+(iy+b);
    if(this.tiles.has(key)||!this.idx.set.has(key)) continue;this.tiles.set(key,null);
    fetch(TN.FLOAT_BASE+'t/'+key+'.json').then(r=>r.ok?r.json():null).then(j=>{
      if(!j||!j.p){this.tiles.delete(key);return;}
      this.tiles.set(key,j.p.map((p,i)=>{const q=TN.toLocal(p[0],p[1]);return {id:key+':'+i,x:q[0],z:q[1],s:p[2]};}));}).catch(()=>this.tiles.delete(key));}
};

/* the road ahead of the car up to the next intersection (or 220 m): a line of points with distances */
TN.FloatSigns.prototype.ahead=function(cur){
  const net=this.net,w=cur.w;if(!w||!w.pts||!w.cum) return null;
  const dir=cur.dir>=0?1:-1,s=cur.r&&cur.r.s!=null?cur.r.s:0,n=w.pts.length;
  let i=0;while(i<n-1&&w.cum[i+1]<=s) i++;
  const p0=TN.wayPt?TN.wayPt(w,s,0):w.pts[i];const pts=[[p0[0],p0[1],0]];let d=0;
  let j=dir>0?i+1:i;
  for(;j>=0&&j<n;j+=dir){const P=w.pts[j],L=pts[pts.length-1];d+=Math.hypot(P[0]-L[0],P[1]-L[1]);pts.push([P[0],P[1],d]);
    /* an intersection: another road meets here (the end of the piece with only its continuation is not one) */
    const others=(net.keys.get(w.keys[j])||[]).filter(h=>h[0]!==w&&!/service|parking|track|path|footway|cycleway|pedestrian/.test(h[0].cls||''));
    const isEnd=j===0||j===n-1;
    if(others.length>(isEnd?1:0)||d>=220) break;}
  return {pts:pts,L:d,w:w,hw:TN.width?TN.width(w)/2:4,ow:!!w.ow};
};
/* where a point is relative to that line: distance along it, and to the side (+ = right of the driving direction) */
TN.FloatSigns.prototype.proj=function(A,x,z){
  let best=null,bd=1e18;const P=A.pts;
  for(let k=1;k<P.length;k++){const a=P[k-1],b=P[k];let ux=b[0]-a[0],uz=b[1]-a[1];const L=Math.hypot(ux,uz)||1;ux/=L;uz/=L;
    let u=(x-a[0])*ux+(z-a[1])*uz;const uc=Math.max(0,Math.min(L,u));
    const qx=a[0]+ux*uc,qz=a[1]+uz*uc,dd=(x-qx)**2+(z-qz)**2;
    if(dd<bd){bd=dd;const side=(x-a[0])*(-uz)+(z-a[1])*ux;best={along:a[2]+u,side:side,ux:ux,uz:uz};}}
  return best;
};

TN.FloatSigns.prototype.update=function(){
  const now=Date.now();if(now-this.t<400) return;this.t=now;
  const S=this.scene;if(!S||!S.three||!this.track) return;
  const car=this.track.car,cur=this.track.cur;const want=new Map();
  if(car&&cur&&cur.w&&!TN.FloatSigns.HW.test(cur.w.cls||'')&&!(TN.settings&&TN.settings.floatSigns===false)){
    try{const ll=TN.fromLocal(car.x,car.z);this.load(ll[0],ll[1]);}catch(e){}
    const A=this.ahead(cur);
    if(A){
      const cand=[];const ok=(x,z)=>{const p=this.proj(A,x,z);if(!p) return null;
        if(p.along<3||p.along>A.L+3) return null;
        const sd=p.side,hw=A.hw;
        if(!(sd>=hw-1.8&&sd<=hw+12)&&!(A.ow&&-sd>=hw-1.8&&-sd<=hw+12)) return null;
        return p;};
      /* the city's poles near the car */
      const city=[];
      for(const T of this.tiles.values()){if(!T) continue;
        for(const q of T){if(Math.abs(q.x-car.x)>260||Math.abs(q.z-car.z)>260) continue;city.push(q);
          const p=ok(q.x,q.z);if(p) cand.push({id:q.id,x:q.x,z:q.z,s:q.s,p:p});}}
      /* OpenStreetMap stop / yield signs where the city has none nearby, facing your way */
      if(this.net.marks&&this.net.signPlace) for(const m of this.net.marks.values()){
        if((m.kind!=='s'&&m.kind!=='y')||Math.abs(m.x-car.x)>260||Math.abs(m.z-car.z)>260) continue;
        if(city.some(q=>(q.x-m.x)**2+(q.z-m.z)**2<45*45&&q.s.some(k=>k==='s'||k==='S4'||k==='y'))) continue;
        let P=null;try{P=this.net.signPlace(m);}catch(e){}if(!P) continue;
        const p=ok(P.x,P.z);if(!p||P.dx*p.ux+P.dz*p.uz<0.6) continue;
        cand.push({id:'osm:'+m.key+':'+m.kind,x:P.x,z:P.z,s:[m.kind],p:p});}
      cand.sort((a,b)=>a.p.along-b.p.along);
      for(const c of cand.slice(0,3)) want.set(c.id,c);
    }
  }
  const y0=car&&car.y!=null?car.y:0;
  for(const [id,c] of want){let it=this.items.get(id);
    if(!it){it=this.make(c,y0);if(!it) continue;this.items.set(id,it);}
    it.gone=0;}
  for(const [id,it] of this.items){
    if(!want.has(id)){it.gone=(it.gone||0)+1;it.target=0;}else it.target=1;
    if(it.gone>4){S.three.scene.remove(it.g);it.g.traverse(o=>{if(o.geometry) o.geometry.dispose();if(o.material) o.material.dispose();});this.items.delete(id);}}
};
/* gentle fade (called every frame) */
TN.FloatSigns.prototype.frame=function(){
  for(const it of this.items.values()){const t=it.target==null?1:it.target;it.a+=(t-it.a)*0.12;
    for(const m of it.mats) m.opacity=it.a*(m.userData.o||1);it.g.visible=it.a>0.02;}
};

/* one pole: stem + its signs, top sign first */
TN.FloatSigns.prototype.make=function(c,y0){
  const T=globalThis.THREE;if(!T) return null;
  const kinds=c.s.filter(k=>this.face(k)).slice(0,3);if(!kinds.length) return null;
  const g=new T.Group(),mats=[];const SZ=2.3,GAP=0.25;
  let y=5.2+SZ/2;   /* (the top of the stack floats about 6.4 m up) */
  for(const k of kinds){const tx=this.face(k);
    const m=new T.MeshBasicMaterial({map:tx,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide});mats.push(m);
    const ar=k==='v'||k[0]==='v'?1.3:1;
    const pl=new T.Mesh(new T.PlaneGeometry(SZ,SZ*ar),m);pl.position.set(0,y-(ar-1)*SZ/2,0);pl.renderOrder=9;g.add(pl);
    y-=SZ*ar+GAP;}
  const sm=new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false});sm.userData.o=0.55;mats.push(sm);
  const top=y+GAP;const st=new T.Mesh(new T.CylinderGeometry(0.06,0.06,top,8),sm);st.position.set(0,top/2,0);g.add(st);
  const shm=new T.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0,depthWrite:false});shm.userData.o=0.22;mats.push(shm);
  const sh=new T.Mesh(new T.CircleGeometry(0.8,20),shm);sh.rotation.x=-Math.PI/2;sh.position.y=0.06;g.add(sh);
  g.position.set(c.x,y0,c.z);g.rotation.y=Math.atan2(-c.p.ux,-c.p.uz);
  g.traverse(o=>{o.frustumCulled=false;});g.renderOrder=9;this.scene.three.scene.add(g);
  return {g:g,mats:mats,a:0,target:1};
};

/* the sign pictures, drawn once each */
TN.FloatSigns.prototype.face=function(k){
  if(this.tex.has(k)) return this.tex.get(k);
  const T=globalThis.THREE;if(!T||typeof document==='undefined') return null;
  const tall=k[0]==='v',W=256,H=tall?333:256,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  const rr=(x,y,w,h,r)=>{g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();};
  const shadow=()=>{g.shadowColor='rgba(0,0,0,.4)';g.shadowBlur=14;g.shadowOffsetY=5;},flat=()=>{g.shadowColor='transparent';};
  const oct=(R)=>{g.beginPath();for(let i=0;i<8;i++){const a=Math.PI/8+i*Math.PI/4;g.lineTo(128+R*Math.cos(a),128+R*Math.sin(a));}g.closePath();};
  const noSign=(arrow)=>{shadow();g.fillStyle='#fff';rr(26,26,204,204,18);g.fill();flat();g.strokeStyle='#111';g.lineWidth=5;rr(36,36,184,184,12);g.stroke();
    g.strokeStyle='#111';g.fillStyle='#111';g.lineWidth=16;g.lineCap='round';g.lineJoin='round';arrow();
    g.strokeStyle='#d32f2f';g.lineWidth=14;g.beginPath();g.arc(128,128,78,0,Math.PI*2);g.stroke();g.beginPath();g.moveTo(73,73);g.lineTo(183,183);g.stroke();};
  let ok=true;
  if(k==='s'||k==='S4'){shadow();g.fillStyle='#fff';oct(118);g.fill();flat();g.fillStyle='#d32f2f';oct(106);g.fill();
    g.fillStyle='#fff';g.font='bold 58px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('ARRÊT',128,k==='S4'?112:131);
    if(k==='S4'){g.font='bold 22px system-ui,sans-serif';g.fillText('TOUTES DIRECTIONS',128,160);}}
  else if(k==='y'){shadow();g.fillStyle='#fff';g.beginPath();g.moveTo(20,40);g.lineTo(236,40);g.lineTo(128,226);g.closePath();g.fill();flat();
    g.strokeStyle='#d32f2f';g.lineWidth=22;g.lineJoin='round';g.beginPath();g.moveTo(36,50);g.lineTo(220,50);g.lineTo(128,208);g.closePath();g.stroke();
    g.fillStyle='#111';g.font='bold 30px system-ui,sans-serif';g.textAlign='center';g.fillText('CÉDEZ',128,100);}
  else if(k[0]==='v'){shadow();g.fillStyle='#fff';rr(30,14,196,H-28,16);g.fill();flat();g.strokeStyle='#111';g.lineWidth=7;rr(42,26,172,H-52,10);g.stroke();
    g.fillStyle='#111';g.textAlign='center';g.textBaseline='middle';g.font='bold 34px system-ui,sans-serif';g.fillText('MAXIMUM',128,70);
    g.font='bold 130px system-ui,sans-serif';g.fillText(k.slice(1),128,200);}
  else if(k==='u') noSign(()=>{g.beginPath();g.moveTo(150,190);g.lineTo(150,108);g.arc(122,108,28,0,Math.PI,true);g.lineTo(94,150);g.stroke();g.beginPath();g.moveTo(74,140);g.lineTo(114,140);g.lineTo(94,172);g.fill();});
  else if(k==='l') noSign(()=>{g.beginPath();g.moveTo(144,190);g.lineTo(144,112);g.quadraticCurveTo(144,94,124,94);g.lineTo(96,94);g.stroke();g.beginPath();g.moveTo(72,94);g.lineTo(100,70);g.lineTo(100,118);g.fill();});
  else if(k==='r') noSign(()=>{g.beginPath();g.moveTo(112,190);g.lineTo(112,112);g.quadraticCurveTo(112,94,132,94);g.lineTo(160,94);g.stroke();g.beginPath();g.moveTo(184,94);g.lineTo(156,70);g.lineTo(156,118);g.fill();});
  else if(k==='e'){shadow();g.fillStyle='#fff';g.beginPath();g.arc(128,128,112,0,Math.PI*2);g.fill();flat();g.fillStyle='#d32f2f';g.beginPath();g.arc(128,128,102,0,Math.PI*2);g.fill();
    g.fillStyle='#fff';rr(58,110,140,36,6);g.fill();}
  else if(k==='k'){shadow();g.fillStyle='#c7ea1f';g.beginPath();g.moveTo(128,16);g.lineTo(232,92);g.lineTo(232,236);g.lineTo(24,236);g.lineTo(24,92);g.closePath();g.fill();flat();
    g.strokeStyle='#111';g.lineWidth=6;g.beginPath();g.moveTo(128,30);g.lineTo(220,98);g.lineTo(220,224);g.lineTo(36,224);g.lineTo(36,98);g.closePath();g.stroke();
    g.fillStyle='#111';const kid=(x,s)=>{g.beginPath();g.arc(x,118*s+30,13*s,0,Math.PI*2);g.fill();g.fillRect(x-11*s,136*s+30,22*s,46*s);g.fillRect(x-11*s,180*s+30,8*s,30*s);g.fillRect(x+3*s,180*s+30,8*s,30*s);};
    kid(100,0.95);kid(152,0.82);g.font='bold 22px system-ui,sans-serif';g.textAlign='center';g.fillText('ÉCOLE',128,215);}
  else ok=false;
  if(!ok){this.tex.set(k,null);return null;}
  const t=new T.CanvasTexture(c);if(T.SRGBColorSpace) t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;this.tex.set(k,t);return t;
};
