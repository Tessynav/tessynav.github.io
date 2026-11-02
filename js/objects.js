/* TessyNav objects v2 (v2: bridge decks use the same light road color as the normal roads)
   Things that stood on the road now stand beside it, and the camera stays above bridges.
   1. Street lamps, traffic lights and stop signs: if one would stand on a drawn road, it is moved to
      the curb (about 1 m outside the road edge). Before, they were placed beside the old map-tile roads,
      which are in slightly different places than the drawn roads.
   2. Bridges: a pier that would stand on a road underneath is left out, and the grass slope of a bridge
      ramp is not built where it would cover a road beside it (a plain ramp wall is used there instead).
   3. Camera on bridges: when the car is up on a bridge or ramp, the camera rises with it (it zooms out
      a little and tilts down a little), so it no longer ends up under the deck.
   Replaces buildLightCell (fixes.js) and buildBridgeMesh (bridges.js) with the same code plus these checks. */

/* --- the drawn roads (the same roads the car follows) --- */
function tnoRoadHit(px,pz,pad){
  const G=(typeof r3GetGrid==='function')?r3GetGrid():null;
  if(!G||!G.size) return null;
  const l=G.get(Math.floor(px/25)+','+Math.floor(pz/25));
  if(!l) return null;
  let best=null;
  for(const s of l){
    const dx=s.bx-s.ax,dz=s.bz-s.az,l2=dx*dx+dz*dz;
    if(l2<0.01) continue;
    const u=Math.max(0,Math.min(1,((px-s.ax)*dx+(pz-s.az)*dz)/l2));
    const fx=s.ax+dx*u,fz=s.az+dz*u,d=Math.hypot(fx-px,fz-pz);
    const inside=s.w/2+pad-d;
    if(inside>0&&(!best||inside>best.inside)) best={inside:inside,fx:fx,fz:fz,d:d,w:s.w,dx:dx,dz:dz,l:Math.sqrt(l2)};
  }
  return best;
}
/* move a pole off the road, to about 1 m outside the edge (a few tries for crossings) */
function tnoPushOff(px,pz){
  for(let k=0;k<4;k++){
    const h=tnoRoadHit(px,pz,0.6);
    if(!h) break;
    let ox=px-h.fx,oz=pz-h.fz;
    if(h.d<0.05){ox=-h.dz/h.l;oz=h.dx/h.l;}else{ox/=h.d;oz/=h.d;}
    px=h.fx+ox*(h.w/2+1.0);pz=h.fz+oz*(h.w/2+1.0);
  }
  return [px,pz];
}
/* a bridge pier (across = its width across the bridge) standing on a road? */
function tnoPierOnRoad(x,z,tx,tz,across){
  const nx=-tz,nz=tx;
  for(const f of [-0.5,-0.25,0,0.25,0.5]){
    if(tnoRoadHit(x+nx*across*f,z+nz*across*f,0.8)) return true;
  }
  return false;
}
/* would the grass slope of a ramp piece (k m wide on each side) cover a road beside it? */
function tnoSlopeOnRoad(L0,L1,R0,R1,nx,nz,k){
  if(k<0.5) return false;
  const lx=(L0[0]+L1[0])/2,lz=(L0[1]+L1[1])/2,rx=(R0[0]+R1[0])/2,rz=(R0[1]+R1[1])/2;
  for(const f of [0.5,1]){
    if(tnoRoadHit(lx+nx*k*f,lz+nz*k*f,-0.5)) return true;
    if(tnoRoadHit(rx-nx*k*f,rz-nz*k*f,-0.5)) return true;
  }
  return false;
}

/* --- street lamps and traffic lights (fixes.js buildLightCell, plus the curb rule) --- */
buildLightCell=function(ck){
  const [gx,gy]=ck.split(',').map(Number);
  const cell=lCells.get(ck)||new Map();
  const poles=lightAcc(true),heads=lightAcc(false),pools=lightAcc(false),lenses=lightAcc(true);
  const glow=[],sigGlow=[],sigGlowCol=[];
  const occ=new Set();
  const G=r3GetGrid();
  const near=[];
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
    const c2=lCells.get((gx+dx)+','+(gy+dy));
    if(c2) for(const r0 of c2.values()){const r=localRoad(r0);if(r) near.push(r);}
  }
  for(const r0 of cell.values()){
    const r=localRoad(r0); if(!r) continue;
    let [spacing,W,both,ph]=r.spec;
    spacing*=LAMP_SPACING_MUL;
    const pts2=r.pts,cum=r.cum,n=pts2.length;
    if(n<2) continue;
    const mi=Math.floor((n-1)/2),ma=pts2[mi],mb=pts2[Math.min(n-1,mi+1)];
    const ml=Math.hypot(mb[0]-ma[0],mb[1]-ma[1])||1;
    try{const info=r3InfoAt(ma[0],ma[1],(mb[0]-ma[0])/ml,(mb[1]-ma[1])/ml);if(info&&info.w) W=info.w;}catch(e){}
    const ow=r.oneway?(r.oneway===-1?-1:1):0;
    let k=0;
    for(let s=spacing/2;s<r.L;s+=spacing,k++){
      let i=0;while(i<n-2&&cum[i+1]<s) i++;
      const seg=cum[i+1]-cum[i]||1,t=(s-cum[i])/seg;
      const x=pts2[i][0]+(pts2[i+1][0]-pts2[i][0])*t,z=pts2[i][1]+(pts2[i+1][1]-pts2[i][1])*t;
      const tx=(pts2[i+1][0]-pts2[i][0])/seg,tz=(pts2[i+1][1]-pts2[i][1])/seg;
      const nx=-tz,nz=tx;
      const sides=ow?[ow]:(both?[1,-1]:[k%2?1:-1]);
      for(const sd of sides){
        const off=W/2+1.6;let px=x+nx*off*sd,pz=z+nz*off*sd;
        [px,pz]=tnoPushOff(px,pz);
        if(tnoRoadHit(px,pz,0.3)) continue;
        const ok=Math.round(px/8)+','+Math.round(pz/8);
        if(occ.has(ok)) continue; occ.add(ok);
        poles.box(px,pz,tx,tz,0.22,0.22,0,ph,LCOL.pole);
        const ax=-nx*sd,az=-nz*sd;
        poles.box(px+ax*1.0,pz+az*1.0,ax,az,2.0,0.12,ph-0.12,ph,LCOL.pole);
        const hx=px+ax*1.9,hz=pz+az*1.9;
        heads.box(hx,hz,ax,az,0.7,0.3,ph-0.35,ph-0.1);
        glow.push(hx,ph-0.4,hz);
        const cxp=px+ax*3.2,czp=pz+az*3.2,r1=9;
        pools.quad([[cxp-r1,0.25,czp-r1],[cxp+r1,0.25,czp-r1],[cxp+r1,0.25,czp+r1],[cxp-r1,0.25,czp+r1]],[0,1,0],null,[[0,0],[1,0],[1,1],[0,1]]);
      }
    }
  }
  const sigs=sigCells.get(ck)||[];
  for(const sg of sigs){
    const [sx,sz]=toLocal(sg[0],sg[1]);
    const sigOcc=new Set();
    for(const r of near){
      const best=closestOn(r,sx,sz,28);
      if(!best) continue;
      for(const dsg of travelDirs(r,best,near)){
        if(dsg===1&&best.s<9) continue;
        if(dsg===-1&&best.s>r.L-9) continue;
        const fx=best.tx*dsg,fz=best.tz*dsg;
        const rx=-fz,rz=fx;
        const stx=best.px-fx*9,stz=best.pz-fz*9,o=r.W/2+1.5;
        let px=stx+rx*o,pz=stz+rz*o;
        [px,pz]=tnoPushOff(px,pz);
        const ok=Math.round(px/5)+','+Math.round(pz/5);
        if(sigOcc.has(ok)) continue; sigOcc.add(ok);
        poles.box(px,pz,fx,fz,0.28,0.28,0,6.2,LCOL.pole);
        const ax=-rx,az=-rz,reach=Math.min(r.W*0.75,7);
        poles.box(px+ax*reach/2,pz+az*reach/2,ax,az,reach,0.16,6.0,6.2,LCOL.pole);
        const hx=px+ax*(reach-0.3),hz=pz+az*(reach-0.3);
        poles.box(hx,hz,fx,fz,0.42,0.5,4.75,6.0,LCOL.sigBox);
        const lx=hx-fx*0.24,lz=hz-fz*0.24;
        const lens=[[LCOL.red,5.62,5.92],[LCOL.amber,5.23,5.53],[LCOL.green,4.84,5.14]];
        for(const [colr,y0,y1] of lens){
          lenses.box(lx,lz,fx,fz,0.06,0.32,y0,y1,colr);
          sigGlow.push(lx-fx*0.1,(y0+y1)/2,lz-fz*0.1);
          sigGlowCol.push(colr.r,colr.g,colr.b);
        }
      }
    }
  }
  const group=new THREE.Group();
  const pg=lightGeom(poles);
  if(pg){const m=new THREE.Mesh(pg,lMatPole);m.castShadow=true;m.frustumCulled=false;group.add(m);}
  const hg=lightGeom(heads);
  if(hg){const m=new THREE.Mesh(hg,lMatHead);m.frustumCulled=false;group.add(m);}
  const lg=lightGeom(lenses);
  if(lg){const m=new THREE.Mesh(lg,lMatLens);m.frustumCulled=false;group.add(m);}
  const qg=lightGeom(pools);
  if(qg){const m=new THREE.Mesh(qg,lMatPool);m.frustumCulled=false;m.renderOrder=2;group.add(m);}
  if(glow.length){
    const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.Float32BufferAttribute(glow,3));
    const p=new THREE.Points(gg,lMatGlow);p.frustumCulled=false;group.add(p);
  }
  if(sigGlow.length){
    const sg=new THREE.BufferGeometry();
    sg.setAttribute('position',new THREE.Float32BufferAttribute(sigGlow,3));
    sg.setAttribute('color',new THREE.Float32BufferAttribute(sigGlowCol,3));
    const p=new THREE.Points(sg,lMatSigGlow);p.frustumCulled=false;group.add(p);
  }
  return group;
};

/* --- bridges (bridges.js buildBridgeMesh, plus the pier and slope checks) --- */
buildBridgeMesh=function(cell,endInfo,roadIdx,cross){
  const pos=[],nor=[],col=[],idx=[];let base=0;
  function quad(v,n,c){
    for(const p of v){pos.push(p[0],p[1],p[2]);nor.push(n[0],n[1],n[2]);col.push(c.r,c.g,c.b);}
    idx.push(base,base+1,base+2,base,base+2,base+3);base+=4;
  }
  function box(cx,cz,tx,tz,along,across,y0,y1,c){
    const nx=-tz,nz=tx,a=along/2,b=across/2;
    const P=(sa,sb,y)=>[cx+tx*a*sa+nx*b*sb,y,cz+tz*a*sa+nz*b*sb];
    quad([P(1,1,y0),P(1,-1,y0),P(1,-1,y1),P(1,1,y1)],[tx,0,tz],c);
    quad([P(-1,-1,y0),P(-1,1,y0),P(-1,1,y1),P(-1,-1,y1)],[-tx,0,-tz],c);
    quad([P(-1,1,y0),P(1,1,y0),P(1,1,y1),P(-1,1,y1)],[nx,0,nz],c);
    quad([P(1,-1,y0),P(-1,-1,y0),P(-1,-1,y1),P(1,-1,y1)],[-nx,0,-nz],c);
  }
  function ribbon(pts,hAt,W,opt){
    const n=pts.length;
    const cum=[0];
    for(let i=1;i<n;i++) cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
    const L=cum[n-1]; if(L<1) return;
    const T=[],Lp=[],Rp=[],Hs=[];
    for(let i=0;i<n;i++){
      const a=pts[Math.max(0,i-1)],c=pts[Math.min(n-1,i+1)];
      let tx=c[0]-a[0],tz=c[1]-a[1];const tl=Math.hypot(tx,tz)||1;tx/=tl;tz/=tl;
      const nx=-tz,nz=tx;
      T.push([tx,tz,nx,nz]);
      Lp.push([pts[i][0]+nx*W/2,pts[i][1]+nz*W/2]);
      Rp.push([pts[i][0]-nx*W/2,pts[i][1]-nz*W/2]);
      Hs.push(hAt(cum[i]));
    }
    const railC=opt.railCol||BR_COL.rail;
    for(let i=0;i<n-1;i++){
      const h0=Hs[i],h1=Hs[i+1],nx=T[i][2],nz=T[i][3];
      if(h0<0.05&&h1<0.05) continue;
      quad([[Lp[i][0],h0,Lp[i][1]],[Rp[i][0],h0,Rp[i][1]],[Rp[i+1][0],h1,Rp[i+1][1]],[Lp[i+1][0],h1,Lp[i+1][1]]],[0,1,0],opt.deck);
      if(opt.embank&&!tnoSlopeOnRoad(Lp[i],Lp[i+1],Rp[i],Rp[i+1],nx,nz,Math.max(h0,h1)*1.6)){
        const k0=h0*1.6,k1=h1*1.6;
        quad([[Lp[i][0],h0,Lp[i][1]],[Lp[i+1][0],h1,Lp[i+1][1]],[Lp[i+1][0]+nx*k1,0,Lp[i+1][1]+nz*k1],[Lp[i][0]+nx*k0,0,Lp[i][1]+nz*k0]],[nx*0.53,0.85,nz*0.53],BR_COL.grass);
        quad([[Rp[i+1][0],h1,Rp[i+1][1]],[Rp[i][0],h0,Rp[i][1]],[Rp[i][0]-nx*k0,0,Rp[i][1]-nz*k0],[Rp[i+1][0]-nx*k1,0,Rp[i+1][1]-nz*k1]],[-nx*0.53,0.85,-nz*0.53],BR_COL.grass);
      }else{
        const t0=Math.min(BR_T,h0),t1=Math.min(BR_T,h1);
        quad([[Lp[i][0],h0,Lp[i][1]],[Lp[i+1][0],h1,Lp[i+1][1]],[Lp[i+1][0],h1-t1,Lp[i+1][1]],[Lp[i][0],h0-t0,Lp[i][1]]],[nx,0,nz],BR_COL.side);
        quad([[Rp[i+1][0],h1,Rp[i+1][1]],[Rp[i][0],h0,Rp[i][1]],[Rp[i][0],h0-t0,Rp[i][1]],[Rp[i+1][0],h1-t1,Rp[i+1][1]]],[-nx,0,-nz],BR_COL.side);
        quad([[Rp[i][0],h0-t0,Rp[i][1]],[Lp[i][0],h0-t0,Lp[i][1]],[Lp[i+1][0],h1-t1,Lp[i+1][1]],[Rp[i+1][0],h1-t1,Rp[i+1][1]]],[0,-1,0],BR_COL.side);
      }
      if(opt.railings&&(h0+h1)/2>opt.railMin){
        quad([[Lp[i][0],h0,Lp[i][1]],[Lp[i+1][0],h1,Lp[i+1][1]],[Lp[i+1][0],h1+0.9,Lp[i+1][1]],[Lp[i][0],h0+0.9,Lp[i][1]]],[nx,0,nz],railC);
        quad([[Rp[i+1][0],h1,Rp[i+1][1]],[Rp[i][0],h0,Rp[i][1]],[Rp[i][0],h0+0.9,Rp[i][1]],[Rp[i+1][0],h1+0.9,Rp[i+1][1]]],[-nx,0,-nz],railC);
      }
    }
    const at=s=>{
      let i=0;while(i<n-2&&cum[i+1]<s) i++;
      const seg=cum[i+1]-cum[i]||1,t=(s-cum[i])/seg;
      return {x:pts[i][0]+(pts[i+1][0]-pts[i][0])*t,z:pts[i][1]+(pts[i+1][1]-pts[i][1])*t,tx:T[i][0],tz:T[i][1]};
    };
    if(opt.line){
      for(let s=2;s+3<L;s+=9){
        const hp=hAt(s),hq=hAt(s+3);
        if(hp<0.2&&hq<0.2) continue;
        const p=at(s),q=at(s+3),nx=-p.tz*0.08,nz=p.tx*0.08;
        quad([[p.x+nx,hp+0.04,p.z+nz],[p.x-nx,hp+0.04,p.z-nz],[q.x-nx,hq+0.04,q.z-nz],[q.x+nx,hq+0.04,q.z+nz]],[0,1,0],opt.line);
      }
    }
    if(opt.pillars){
      for(let s=14;s<L-6;s+=28){
        const h=hAt(s);
        if(h<3) continue;
        const p=at(s);
        if(tnoPierOnRoad(p.x,p.z,p.tx,p.tz,Math.max(1.4,W*0.55))) continue;
        box(p.x,p.z,p.tx,p.tz,1.1,Math.max(1.4,W*0.55),0,h-BR_T,BR_COL.pillar);
      }
    }
  }
  const sm=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
  const doneAppr=new Set();
  for(const b of cell.values()){
    const n=b.pts.length;
    const pts=b.pts.map(p=>toLocal(p[0],p[1]));
    const cum=[0];for(let i=1;i<n;i++) cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
    const L=cum[n-1];
    if(L<2) continue;
    const W=BR_W[b.cls]||7,isRail=b.cls==='rail'||b.cls==='transit';
    /* Height depends on what the bridge crosses */
    const over=crossesRoad(pts,cum,L,cross);
    let H,low=false,rampMul=1;
    if(over){H=6.5*b.layer;}
    else if(L>400){H=15;rampMul=1.8;}
    else if(L>120){H=5;rampMul=0.8;}
    else{H=1.2;low=true;}
    const lineCol=(isRail||b.cls==='path'||b.cls==='track')?null:(b.oneway?BR_COL.white:BR_COL.yellow);
    const railCol=low?BR_COL.railLow:BR_COL.rail;
    const ends=[
      {p:b.pts[0],into:angOf(b.pts[0],b.pts[1])},
      {p:b.pts[n-1],into:angOf(b.pts[n-1],b.pts[n-2])}
    ];
    const ramp=[false,false];
    ends.forEach((e,ei)=>{
      const others=lookupNear(endInfo,e.p);
      if(others.some(a=>angDiff(a,e.into)>90)) return;
      const cands=lookupNear(roadIdx,e.p).filter(a=>a.pts.length>1&&angDiff(angOf(a.pts[0],a.pts[1]),e.into)>90);
      if(!cands.length){
        if(!nearTileEdge(e.p[0],e.p[1])) ramp[ei]=true;
        return;
      }
      for(const a of cands){
        const ak=endKey(e.p)+'|'+endKey(a.pts[1]);
        if(doneAppr.has(ak)) continue; doneAppr.add(ak);
        const RLw=low?20:(BR_RAMP[a.cls]||40)*rampMul;
        const chained=chainRoad(a,RLw,roadIdx);
        const ap=chained.map(p=>toLocal(p[0],p[1]));
        let AL=0;for(let i=1;i<ap.length;i++) AL+=Math.hypot(ap[i][0]-ap[i-1][0],ap[i][1]-ap[i-1][1]);
        const RL=Math.max(low?8:15,Math.min(RLw,AL));
        ribbon(ap,s=>H*(1-sm(s/RL)),BR_W[a.cls]||W,{deck:isRail?BR_COL.ballast:BR_COL.asphalt,embank:true,line:lineCol,railings:!low,railMin:1.5,railCol:railCol});
      }
    });
    const RLin=Math.min(low?12:45,L*0.45);
    const hAt=s=>H*(ramp[0]?sm(s/RLin):1)*(ramp[1]?sm((L-s)/RLin):1);
    ribbon(pts,hAt,W,{deck:isRail?BR_COL.ballast:BR_COL.asphalt,embank:false,line:lineCol,pillars:!low,railings:true,railMin:low?0.3:1.5,railCol:railCol});
  }
  if(!pos.length) return null;
  for(let i=0;i<idx.length;i+=3){
    const a=idx[i]*3,b=idx[i+1]*3,c=idx[i+2]*3;
    const ux=pos[b]-pos[a],uy=pos[b+1]-pos[a+1],uz=pos[b+2]-pos[a+2];
    const vx=pos[c]-pos[a],vy=pos[c+1]-pos[a+1],vz=pos[c+2]-pos[a+2];
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    if(nx*nor[a]+ny*nor[a+1]+nz*nor[a+2]<0){const t=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=t;}
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  g.setIndex(idx);
  const mesh=new THREE.Mesh(g,brMat);
  mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;
  return mesh;
};


/* keep the profiler numbers for the replaced light builder */
if(typeof PROF!=='undefined'){
  buildLightCell=(function(f){return function(){const t0=performance.now();try{return f.apply(this,arguments);}finally{PROF.buildLightCell=(PROF.buildLightCell||0)+performance.now()-t0;}};})(buildLightCell);
}

/* stop signs and other signs: same curb rule */
for(const nm of ['osmPlacements','cityPlacement']){
  if(typeof window[nm]!=='function') continue;
  window[nm]=(function(base){return function(){
    const r=base.apply(this,arguments);
    const fix=pl=>{if(pl&&typeof pl.px==='number'){const q=tnoPushOff(pl.px,pl.pz);pl.px=q[0];pl.pz=q[1];}return pl;};
    return Array.isArray(r)?r.map(fix):fix(r);
  };})(window[nm]);
}

/* when the drawn roads change, rebuild signs and bridges with the new checks (at most every 5 s) */
let tnoGridKey=null,tnoLastRefresh=0;
setInterval(()=>{
  try{
    if(typeof r3GridKey==='undefined') return;
    const now=performance.now();
    if(r3GridKey===tnoGridKey||now-tnoLastRefresh<5000) return;
    tnoGridKey=r3GridKey;tnoLastRefresh=now;
    if(typeof sDirtyAll!=='undefined'&&typeof updateSigns==='function'){sDirtyAll=true;updateSigns(true);}
    if(typeof brMeshes!=='undefined'&&brMeshes.size&&typeof updateBridges==='function'){brChanged=true;updateBridges(true);}
  }catch(e){}
},1000);

/* camera on bridges: keep it about 8 m above the car */
if(typeof camSpec==='function'){
  camSpec=(function(base){return function(){
    const cs=base();
    const y=(typeof carY==='number')?carY:0;
    if(y>0.5){
      cs.pitch=Math.min(cs.pitch,Math.max(60,cs.pitch-y*0.8));
      const H=map.getContainer().clientHeight||600;
      const lat=gPos?gPos[1]:45.5;
      const mpp=40075016.7*Math.cos(lat*Math.PI/180)/(512*Math.pow(2,cs.zoom));
      const camH=1.5*H*mpp*Math.cos(cs.pitch*Math.PI/180);
      const need=y+8;
      if(camH<need) cs.zoom-=Math.log2(need/camH);
    }
    return cs;
  };})(camSpec);
}

/* v2: bridge decks were dark grey (#4b4f56) and looked like black patches next to the light drawn roads.
   Now they use the same road color. (Bridges built before this loads get it on their next rebuild.) */
if(typeof BR_COL!=='undefined'&&BR_COL.asphalt&&BR_COL.asphalt.set){
  BR_COL.asphalt.set(typeof ROAD_COLORS!=='undefined'?ROAD_COLORS.road:'#c9cad1');
}
