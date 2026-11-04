/* TessyNav v2 — rem.js
   REM trains on the elevated guideway (drawn by roads.js): white two-car trains with a teal stripe that glide
   along the line, stop now and then like at a station, and continue; lit windows and headlights at night.
   For now the trains run on a made-up rhythm near you (not their real positions).
   Built to stay light: at most 3 trains, only within about 2 km. ?rem=0 switches the trains off. */
var TN=globalThis.TN||{};globalThis.TN=TN;

TN.Rem=function(scene,net){
  this.scene=scene;this.net=net;this.trains=[];this.spawnT=0;
  this.on=!(typeof location!=='undefined'&&/[?&]rem=0/.test(location.search));
  this.geo=null;this.matBody=null;this.matWin=null;this.night=0;
};
TN.Rem.prototype.build=function(){
  if(this.geo) return;
  /* one train = two 19 m cars, 3 m wide, 3.6 m tall; front at -z (heading 0 = north) */
  const body=TN.geo(),win=TN.geo();
  const W=1.5,Hh=3.6,white=TN.hex('#eef0f2'),stripe=TN.hex('#1fa596'),roof=TN.hex('#c9ccd0'),end=TN.hex('#dfe2e5');
  const boxQ=(G,z0,z1,y0,y1,x,col)=>{TN.quad(G,[x,y0,z0],[x,y0,z1],[x,y1,z1],[x,y1,z0],col);};
  for(const [z0,z1] of [[-19.5,-0.25],[0.25,19.5]]){
    for(const x of [W,-W]){boxQ(body,z0,z1,0.3,0.9,x,stripe);boxQ(body,z0,z1,0.9,Hh,x,white);
      boxQ(win,z0+0.8,z1-0.8,1.6,2.6,x*1.004,[1,1,1]);}
    TN.quad(body,[-W,Hh,z0],[W,Hh,z0],[W,Hh,z1],[-W,Hh,z1],roof);
    for(const z of [z0,z1]){TN.quad(body,[-W,0.3,z],[W,0.3,z],[W,Hh,z],[-W,Hh,z],end);}
  }
  /* windscreens and headlights at both ends */
  for(const z of [-19.52,19.52]){TN.quad(win,[-1.1,1.7,z],[1.1,1.7,z],[1.1,2.8,z],[-1.1,2.8,z],[1,1,1]);}
  const mk=G=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(G.p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(G.c,3));g.setIndex(G.i);return g;};
  this.geo={body:mk(body),win:mk(win)};
  this.matBody=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide});
  this.matWin=new THREE.MeshBasicMaterial({color:0x2c3a48,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  this.setNight(this.night);
};
TN.Rem.prototype.setNight=function(nt){
  this.night=nt;
  if(this.matWin) this.matWin.color.set(TN.mix('#2c3a48','#ffe2a6',Math.max(0,Math.min(1,(nt-0.15)/0.5))));
  if(this.matBody) this.matBody.color.set(TN.mix('#ffffff','#8e97aa',nt));
};
TN.Rem.prototype.spawn=function(cx,cz){
  const net=this.net,c=[];
  for(const w of net.rem.values()){if(w.L<60) continue;const b=w.bb;if(cx<b[0]-900||cx>b[1]+900||cz<b[2]-900||cz>b[3]+900) continue;c.push(w);}
  if(!c.length) return;
  const w=c[Math.floor(Math.random()*c.length)];
  const g=new THREE.Group();
  g.add(new THREE.Mesh(this.geo.body,this.matBody));g.add(new THREE.Mesh(this.geo.win,this.matWin));
  g.children.forEach(m=>{m.frustumCulled=false;});
  this.scene.three.scene.add(g);
  this.trains.push({w:w,s:Math.random()*w.L,dir:Math.random()<0.5?1:-1,v:19,wait:0,next:900+Math.random()*900,g:g});
};
TN.Rem.prototype.free=function(t){this.scene.three.scene.remove(t.g);};
/* the piece that continues the line at an end point (the straightest one) */
TN.Rem.prototype.nextPiece=function(t){
  const w=t.w,end=t.dir>0?w.pts.length-1:0,links=this.net.remLinks().get(w.keys[end])||[];
  const a=w.pts[t.dir>0?end-1:1],b=w.pts[end];let ux=b[0]-a[0],uz=b[1]-a[1];const l=Math.hypot(ux,uz)||1;ux/=l;uz/=l;
  let best=null,bs=-2;
  for(const [v,j] of links){if(v===w) continue;const k=j===0?1:v.pts.length-2;
    let vx=v.pts[k][0]-v.pts[j][0],vz=v.pts[k][1]-v.pts[j][1];const vl=Math.hypot(vx,vz)||1;const d=(vx*ux+vz*uz)/vl;
    if(d>bs){bs=d;best={w:v,s:j===0?0:v.L,dir:j===0?1:-1};}}
  return bs>0.3?best:null;
};
TN.Rem.prototype.update=function(dt,cx,cz){
  const net=this.net;
  if(!this.on||!this.scene.three||!net.rem||!net.rem.size){for(const t of this.trains) this.free(t);this.trains=[];return;}
  this.build();
  /* keep up to 3 trains around you */
  this.spawnT-=dt;
  if(this.trains.length<4&&this.spawnT<=0){this.spawnT=1.5;this.spawn(cx,cz);}
  for(let k=this.trains.length-1;k>=0;k--){
    const t=this.trains[k];
    if(!net.rem.has(t.w.id)){this.free(t);this.trains.splice(k,1);continue;}
    /* stop now and then (like at a station), otherwise run at about 70 km/h, slowing in and out of stops */
    if(t.wait>0){t.wait-=dt;t.v=0;}
    else{
      t.v=Math.min(19,t.v+dt*1.2);if(t.next<60) t.v=Math.max(3,Math.min(t.v,Math.sqrt(2*1.0*Math.max(1,t.next))));
      const ds=t.v*dt;t.s+=t.dir*ds;t.next-=ds;
      if(t.next<=0){t.wait=20;t.next=1100+Math.random()*900;}
      if(t.s<0||t.s>t.w.L){
        const over=t.s<0?-t.s:t.s-t.w.L,n=this.nextPiece(t);
        if(n){t.w=n.w;t.dir=n.dir;t.s=n.dir>0?over:n.w.L-over;}
        else{t.s=Math.max(0,Math.min(t.w.L,t.s));t.dir=-t.dir;t.wait=15;t.next=1100+Math.random()*900;}
      }
    }
    const hs=net.remHeights(t.w),q=TN.remAt(t.w,hs,Math.max(0,Math.min(t.w.L,t.s)));
    const dx=q.ux*t.dir,dz=q.uz*t.dir,rx=-dz,rz=dx;
    t.g.position.set(q.x,q.y+0.1,q.z);   /* on its own track */
    t.g.rotation.y=-Math.atan2(dx,-dz);
    if(Math.hypot(q.x-cx,q.z-cz)>2500){this.free(t);this.trains.splice(k,1);}
  }
};
