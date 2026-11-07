/* TessyNav v2 — tunnel.js (v1)
   Tunnel mode. Tunnel roads run under the city (the Ville-Marie tunnel passes beneath streets and buildings), so the
   road builder never draws them. When the car is on a tunnel road, this draws THAT tunnel around it (road surface
   and lane lines, concrete walls, a row of warm lights) and dims the view, like entering a real tunnel; buildings
   above already fade around the car. At the exit the view brightens again and the tunnel is removed. */
var TN=globalThis.TN||{};globalThis.TN=TN;
TN.Tunnel=function(scene,net,getWay){
  this.scene=scene;this.net=net;this.getWay=getWay;this.k=0;this.grp=null;this.ids=new Set();this.outT=0;this.veil=null;
};
/* the whole tunnel from the piece you're on: tunnel roads joined at their points, up to about 6 km */
TN.Tunnel.prototype.collect=function(w0){
  const net=this.net,seen=new Set([w0]),list=[w0],q=[w0];let L=w0.L||0;
  while(q.length&&list.length<80&&L<6000){const w=q.shift();
    for(const k of w.keys){const l=net.keys&&net.keys.get(k);if(!l) continue;
      for(const [v] of l){if(v.tun&&!seen.has(v)){seen.add(v);list.push(v);q.push(v);L+=v.L||0;}}}}
  /* and the tunnel roads running alongside (the other direction's tube, a parallel ramp), within about 45 m */
  if(net.near){const add=[];
    for(const w of list){const P=w.pts;for(let i=0;i<P.length;i+=Math.max(1,Math.floor(P.length/12))){
      net.near(P[i][0],P[i][1],45,v=>{if(v&&v.tun&&!seen.has(v)){seen.add(v);add.push(v);}});}}
    for(const v of add) list.push(v);}
  return list;
};
/* building is done in small slices (a few ms per frame), started as soon as you're on a road leading into a tunnel,
   so it is usually ready before you enter and never causes a hitch */
/* a copy of a tunnel road with a point every 25 m (its real ends kept), so it can be drawn in short slices */
TN.Tunnel.prototype.dense=function(w){
  const P=w.pts,pts=[],cum=[],keys=[];let c=0;
  for(let i=0;i<P.length-1;i++){const a=P[i],b=P[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(L/25));
    for(let k=0;k<n;k++){const t=k/n;pts.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);cum.push(c+L*t);keys.push(i===0&&k===0?w.keys[0]:'tnx:'+w.id+':'+pts.length);}
    c+=L;}
  pts.push(P[P.length-1]);cum.push(c);keys.push(w.keys[w.keys.length-1]);
  return Object.assign({},w,{pts:pts,cum:cum,keys:keys,L:c,hs:null});
};
TN.Tunnel.prototype.start=function(w0){
  const ways=this.collect(w0).map(w=>this.dense(w)),chunks=[];
  for(const w of ways){const n=w.pts.length-1;let a=0;
    while(a<n){let b=a+1;while(b<n&&w.cum[b]-w.cum[a]<60) b++;chunks.push([w,a,b]);a=b;}}
  this.job={ways:ways,chunks:chunks,i:0,L:{lot:TN.geo(),curb:TN.geo(),road:TN.geo(),mark:TN.geo(),glow:TN.geo(),lamps:[]},ids:new Set(ways.map(w=>w.id))};
};
TN.Tunnel.prototype.step=function(){
  const J=this.job;if(!J) return;const t0=performance.now();
  while(J.i<J.chunks.length&&performance.now()-t0<3){const [w,a,b]=J.chunks[J.i++];try{this.net.drawWay(J.L,w,[[a,b]]);}catch(e){}}
  if(J.i<J.chunks.length) return;
  this.job=null;this.finish(J.L,J.ids);
};
TN.Tunnel.prototype.build=function(w0){this.start(w0);while(this.job) this.step();};
TN.Tunnel.prototype.finish=function(L,ids){
  this.drop();for(const id of ids) this.ids.add(id);
  const grp=this.scene.meshOf?this.scene.meshOf(L):null;if(!grp) return;
  /* (drawn just above the surface streets it passes under, and its lights always on) */
  grp.position.y=0.03;
  grp.traverse(o=>{if(o.isMesh){o.renderOrder=(o.renderOrder||0)+5;if(o.tnGlow){o.tnGlow=false;o.visible=true;}}});
  this.scene.three.scene.add(grp);this.grp=grp;
};
TN.Tunnel.prototype.drop=function(){
  if(this.grp){this.scene.three.scene.remove(this.grp);this.grp.traverse(o=>{if(o.geometry) o.geometry.dispose();});this.grp=null;}
  this.ids.clear();
};
/* the darkening: a soft veil over the map (under the buttons), darker at the edges */
TN.Tunnel.prototype.dim=function(k){
  if(!this.veil){if(k<0.01) return;const v=document.createElement('div');v.id='tn-tunveil';
    v.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:2;background:radial-gradient(ellipse at 50% 62%,rgba(8,10,14,.25) 0%,rgba(8,10,14,.62) 70%,rgba(8,10,14,.8) 100%);opacity:0;transition:none';
    document.body.appendChild(v);this.veil=v;}
  this.veil.style.opacity=k.toFixed(3);this.veil.style.display=k<0.01?'none':'block';
};
TN.Tunnel.prototype.update=function(dt){
  if(!this.scene||!this.scene.three||!this.net) return;
  const w=this.getWay&&this.getWay(),inT=!!(w&&w.tun);
  const busy=id=>this.ids.has(id)||(this.job&&this.job.ids.has(id));
  if(inT){this.outT=0;if(!busy(w.id)) this.start(w);}
  else{
    this.outT+=dt;
    /* the road you're on leads into a tunnel: start building it now */
    if(w&&this.net.keys&&!this.job&&(now=>now-(this.peekT||0)>1000)(performance.now())){this.peekT=performance.now();
      for(const k of [w.keys[0],w.keys[w.keys.length-1]]){const l=this.net.keys.get(k);if(!l) continue;
        const t=l.find(([v])=>v.tun&&(v.L||0)>=40);if(t&&!busy(t[0].id)){this.start(t[0]);this.outT=0;break;}}}
    if(this.grp&&this.outT>6&&!this.job) this.drop();}
  this.step();
  this.k+=((inT?1:0)-this.k)*Math.min(1,dt*(inT?1.4:0.9));
  this.dim(this.k);
};
TN.Tunnel.prototype.inTunnel=function(){return this.k>0.5;};
