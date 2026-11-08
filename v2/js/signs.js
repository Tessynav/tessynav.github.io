/* TessyNav v2 — signs.js
   Green highway exit signs, like the real ones on Quebec highways, with or without a route:
   - while driving on a motorway or trunk, the road ahead (in the direction you're going, about 1.6 km) is followed and
     every exit on it gets its signs: one about 1 km before (with "1 km") and one at the exit, with the exit number,
     the route numbers and the destinations (from the road tiles, OpenStreetMap)
   - signs stand on the right side of the road at the road's own height (on a bridge they're fixed to its edge)
   - signs for exits on the other side of the highway, or behind you, are never drawn
   - while navigating, the sign for the exit the route takes gets a blue frame */
var TN=globalThis.TN||{};globalThis.TN=TN;

TN.Signs=function(o){
  this.net=o.net;this.scene=o.scene;this.track=o.track;this.nav=o.nav||null;
  this.items=new Map();this.t=0;
};
TN.Signs.HW=/motorway|trunk/;

/* the road ahead: from where the car is, along its road in its direction, through the highway's continuation at each
   joint (straightest piece of motorway/trunk, never a ramp, never against a one-way), for about 1.6 km */
TN.Signs.prototype.ahead=function(cur,max){
  const net=this.net,out=[];if(!cur||!cur.w) return out;
  let w=cur.w,dir=cur.dir>=0?1:-1,s=cur.r&&cur.r.s!=null?cur.r.s:0,d=0,guard=0;
  /* the first vertex ahead of the car on its road */
  let i=0;while(i<w.pts.length-1&&w.cum[i+1]<=s) i++;
  let j=dir>0?i+1:i;d=Math.abs(w.cum[j]-s);
  while(d<max&&guard++<400){
    const n=w.pts.length;
    for(;j>=0&&j<n;j+=dir){
      if(out.length){const L=out[out.length-1];if(L.w===w&&L.i===j) continue;d+=Math.hypot(w.pts[j][0]-L.x,w.pts[j][1]-L.z);}
      const a=w.pts[Math.max(0,Math.min(n-1,j-dir))],b=w.pts[Math.max(0,Math.min(n-1,j+dir))];
      let ux=b[0]-a[0],uz=b[1]-a[1];const ul=Math.hypot(ux,uz)||1;ux/=ul;uz/=ul;if(dir<0&&j===0||dir>0&&j===n-1){/* (end: keep the last direction) */}
      out.push({w:w,i:j,x:w.pts[j][0],z:w.pts[j][1],d:d,key:w.keys[j],ux:ux*1,uz:uz*1});
      if(d>=max) return out;
    }
    /* at the end of this piece: the highway's continuation */
    const k=w.keys[dir>0?n-1:0],L=out[out.length-1];let best=null,bd=0.7;
    for(const [v,vi] of (net.keys.get(k)||[])){
      if(v===w||v.ramp||!TN.Signs.HW.test(v.cls||'')) continue;
      for(const sd of [1,-1]){const vj=vi+sd;if(vj<0||vj>=v.pts.length) continue;
        if(v.ow===1&&sd<0||v.ow===-1&&sd>0) continue;
        const dx=v.pts[vj][0]-v.pts[vi][0],dz=v.pts[vj][1]-v.pts[vi][1],dl=Math.hypot(dx,dz)||1,dot=(dx*L.ux+dz*L.uz)/dl;
        if(dot>bd){bd=dot;best=[v,vi,sd];}}
    }
    if(!best) break;
    w=best[0];dir=best[2];j=best[1];
  }
  return out;
};
/* a point on the road ahead, a distance along it, with its direction, road and height */
TN.Signs.prototype.at=function(path,dd){
  for(let q=1;q<path.length;q++){const A=path[q-1],B=path[q];if(B.d<dd) continue;
    const seg=B.d-A.d||1,u=Math.max(0,Math.min(1,(dd-A.d)/seg));
    let ux=B.x-A.x,uz=B.z-A.z;const ul=Math.hypot(ux,uz)||1;ux/=ul;uz/=ul;
    const w=B.w,ia=B.i,ib=A.w===B.w?A.i:B.i;
    const ha=w.hs?w.hs[ia]:(w.br?w.H:0),hb=A.w===B.w?(w.hs?w.hs[ib]:(w.br?w.H:0)):ha;
    return {x:A.x+(B.x-A.x)*u,z:A.z+(B.z-A.z)*u,ux:ux,uz:uz,w:w,h:hb+(ha-hb)*u};}
  return null;
};
TN.Signs.prototype.update=function(){
  const now=Date.now();if(now-this.t<500) return;this.t=now;
  const S=this.scene;if(!S||!S.three||!this.track) return;
  const cur=this.track.cur,car=this.track.car;
  const want=new Set();
  if(cur&&cur.w&&!cur.w.ramp&&TN.Signs.HW.test(cur.w.cls||'')&&this.net.exits&&this.net.exits.size){
    const path=this.ahead(cur,1700);
    const byKey=new Map();for(const e of this.net.exits.values()) byKey.set(e.key,e);
    const routeExit=this.routeExit();
    for(const p of path){const e=byKey.get(p.key);if(!e||p.d<60) continue;
      if(!e.ref&&!e.dest&&!e.refs) continue;
      for(const kind of ['adv','at']){
        const id=e.id+':'+kind;want.add(id);if(this.items.has(id)){const it=this.items.get(id);it.hot=routeExit===e.id;this.frame(it);continue;}
        const dd=kind==='adv'?p.d-1000:p.d-70;if(dd<40) continue;
        const pt=this.at(path,dd);if(!pt) continue;
        const it=this.make(e,kind,pt);if(!it) continue;it.hot=routeExit===e.id;this.frame(it);this.items.set(id,it);
      }
    }
  }
  /* signs passed or left behind stay a moment, then go */
  for(const [id,it] of this.items){
    const dx=it.x-(car?car.x:it.x),dz=it.z-(car?car.z:it.z),far=Math.hypot(dx,dz);
    const behind=car&&car.hd!=null?(dx*Math.sin(car.hd*Math.PI/180)-dz*Math.cos(car.hd*Math.PI/180))<-40:false;
    if((!want.has(id)&&(behind||far>1900))||far>2200){S.three.scene.remove(it.g);it.g.traverse(o=>{if(o.geometry) o.geometry.dispose();if(o.material){if(o.material.map) o.material.map.dispose();o.material.dispose();}});this.items.delete(id);}
  }
};
/* the exit the route takes (only while navigating): the route passes the exit point and is still on the exit ramp
   60 m further on */
TN.Signs.prototype.routeExit=function(){
  if(!TN.navActive||!TN.routeNear||!this.net.exits) return null;
  let best=null,bd=1e9;
  for(const e of this.net.exits.values()){
    const d0=TN.routeNear(e.x,e.z);if(d0==null||d0>12) continue;
    for(const [v,vi] of (this.net.keys.get(e.key)||[])){
      if(!v.ramp) continue;const sd=vi===0?1:vi===v.pts.length-1?-1:(v.ow===-1?-1:1);
      let acc=0,j=vi;while(acc<60){const jn=j+sd;if(jn<0||jn>=v.pts.length) break;acc+=Math.abs(v.cum[jn]-v.cum[j]);j=jn;}
      if(acc<20) continue;const d1=TN.routeNear(v.pts[j][0],v.pts[j][1]);
      if(d1!=null&&d1<6&&d0+d1<bd){bd=d0+d1;best=e.id;}
    }
  }
  return best;
};
/* the sign's face, drawn once on a canvas: exit number tab, route shields, destinations, "1 km" on the advance sign */
TN.Signs.prototype.face=function(e,kind){
  if(typeof document==='undefined') return null;
  const W=512,H=300,cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');
  const rr=(x,y,w,h,r)=>{g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();};
  g.fillStyle='#0b6b3a';g.fillRect(0,0,W,H);
  g.strokeStyle='#ffffff';g.lineWidth=8;rr(10,10,W-20,H-20,16);g.stroke();
  let y=34;
  /* exit number tab */
  if(e.ref){g.font='600 34px sans-serif';const tw=g.measureText('Sortie '+e.ref).width+36;rr(W-30-tw,y-4,tw,52,8);g.fillStyle='#ffffff';g.fill();
    g.fillStyle='#0b6b3a';g.textBaseline='middle';g.fillText('Sortie '+e.ref,W-30-tw+18,y+22);}
  /* route shields: "A 10 Est" -> [10] Est */
  let x=34;const refs=(e.refs||'').split(';').filter(Boolean).slice(0,2);
  for(const r of refs){const m=r.match(/(\d+[A-Z]?)\s*(.*)$/);const num=m?m[1]:r.slice(0,6),dirTxt=m?m[2]:'';
    const auto=/^A\b|autoroute/i.test(r);g.font='700 38px sans-serif';const nw=Math.max(64,g.measureText(num).width+28);
    rr(x,y,nw,52,8);g.fillStyle=auto?'#1f4fa3':'#ffffff';g.fill();if(!auto){g.strokeStyle='#111';g.lineWidth=3;g.stroke();}
    g.fillStyle=auto?'#ffffff':'#111111';g.textBaseline='middle';g.fillText(num,x+(nw-g.measureText(num).width)/2,y+27);x+=nw+10;
    if(dirTxt){g.font='600 32px sans-serif';g.fillStyle='#ffffff';g.fillText(dirTxt,x,y+27);x+=g.measureText(dirTxt).width+22;}
    if(x>W-200) break;}
  /* destinations (up to two lines, shrunk to fit) */
  let lines=(e.dest||'').split(';').filter(Boolean);if(!lines.length&&e.name) lines=[e.name];lines=lines.slice(0,2);
  y=refs.length||e.ref?132:80;g.fillStyle='#ffffff';g.textBaseline='middle';
  for(const L of lines){let fs=48;g.font='600 '+fs+'px sans-serif';while(g.measureText(L).width>W-90&&fs>26){fs-=2;g.font='600 '+fs+'px sans-serif';}g.fillText(L,36,y);y+=fs+12;}
  /* bottom: "1 km" on the advance sign, an exit arrow at the exit */
  if(kind==='adv'){g.font='600 36px sans-serif';g.fillText('1 km',W-120,H-50);}
  else{g.strokeStyle='#ffffff';g.lineWidth=10;g.lineCap='round';g.beginPath();g.moveTo(W-100,H-36);g.lineTo(W-56,H-80);g.moveTo(W-90,H-82);g.lineTo(W-54,H-82);g.lineTo(W-54,H-46);g.stroke();}
  return cv;
};
TN.Signs.prototype.make=function(e,kind,pt){
  const T=globalThis.THREE,S=this.scene;if(!T||!S.three) return null;
  const cv=this.face(e,kind);if(!cv) return null;
  const tex=new T.CanvasTexture(cv);if(T.SRGBColorSpace) tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;
  const PW=7.2,PH=4.2,onBridge=!!pt.w.br,clear=onBridge?2.6:3.2;
  const grp=new T.Group();
  const face=new T.Mesh(new T.PlaneGeometry(PW,PH),new T.MeshBasicMaterial({map:tex}));face.position.set(0,clear+PH/2,0);grp.add(face);
  const back=new T.Mesh(new T.PlaneGeometry(PW,PH),new T.MeshLambertMaterial({color:0x8a9096}));back.position.set(0,clear+PH/2,-0.06);back.rotation.y=Math.PI;grp.add(back);
  const frameMat=new T.MeshBasicMaterial({color:0x3b82f6,transparent:true,opacity:0});
  const fr=new T.Mesh(new T.PlaneGeometry(PW+0.7,PH+0.7),frameMat);fr.position.set(0,clear+PH/2,-0.03);grp.add(fr);
  const postMat=new T.MeshLambertMaterial({color:0x9aa0a6});
  for(const px of [-PW*0.32,PW*0.32]){const ph=clear+PH*0.85;const p=new T.Mesh(new T.BoxGeometry(0.22,ph,0.22),postMat);p.position.set(px,ph/2,-0.15);grp.add(p);}
  /* on the right side of the road, facing the drivers coming toward it (turned a little toward the road) */
  const off=TN.width(pt.w)/2+(onBridge?0.6:3.5),rx=-pt.uz,rz=pt.ux;
  const x=pt.x+rx*off,z=pt.z+rz*off;
  grp.position.set(x,pt.h,z);grp.rotation.y=Math.atan2(-pt.ux,-pt.uz)-0.12;
  grp.renderOrder=2;S.three.scene.add(grp);
  return {g:grp,x:x,z:z,frame:frameMat,hot:false};
};
TN.Signs.prototype.frame=function(it){if(it.frame) it.frame.opacity=it.hot?0.95:0;};
