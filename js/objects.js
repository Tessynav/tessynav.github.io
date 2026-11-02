/* TessyNav objects v5 (v5: thick 3D bridge cables, tower also shows when you look at it on the map; v4: v4: better bridges everywhere: concrete barriers, real piers, street lights, T-shaped REM lights that light the tracks at night, and the Champlain Bridge tower and cables; v3: v3: a bridge made of many pieces gets one height, no more broken sections; v2: v2: bridge decks use the same light road color as the normal roads)
   Things that stood on the road now stand beside it, and the camera stays above bridges.
   1. Street lamps, traffic lights and stop signs: if one would stand on a drawn road, it is moved to
      the curb (about 1 m outside the road edge). Before, they were placed beside the old map-tile roads,
      which are in slightly different places than the drawn roads.
   2. Bridges: a pier that would stand on a road underneath is left out, and the grass slope of a bridge
      ramp is not built where it would cover a road beside it (a plain ramp wall is used there instead).
   3. Camera on bridges: when the car is up on a bridge or ramp, the camera rises with it (it zooms out
      a little and tilts down a little), so it no longer ends up under the deck.
   Replaces buildLightCell (fixes.js) and buildBridgeMesh (bridges.js) with the same code plus these checks. */

/* v4 bridge colors */
const TNO_COL={barrier:new THREE.Color('#cdcac2'),pier:new THREE.Color('#bdb9b0'),pole:new THREE.Color('#8a8d92'),head:new THREE.Color('#fff4d6')};

/* --- the drawn roads (the same roads the car follows) --- */
let tnoG=null,tnoGT=0;
function tnoRoadHit(px,pz,pad){
  const now=performance.now();
  if(!tnoG||now-tnoGT>300){tnoG=(typeof r3GetGrid==='function')?r3GetGrid():null;tnoGT=now;}
  const G=tnoG;
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


/* --- bridges: one height for a whole bridge ---
   The map data cuts a long bridge into many pieces (at map tile edges and wherever OpenStreetMap splits it),
   and each piece used to pick its own height from its own length (15 m, 13 m, 5 m or 1.2 m), so a bridge
   looked broken into sections with steps between them. Now connected pieces are joined into one bridge,
   and every piece gets the height of the whole bridge. */
let tnoChains=null,tnoChainsT=0;
function tnoBuildChains(cross){
  const all=[];
  for(const cell of brCells.values()) for(const b of cell.values()) all.push(b);
  const parent=new Map();all.forEach(b=>parent.set(b,b));
  const find=b=>{while(parent.get(b)!==b){parent.set(b,parent.get(parent.get(b)));b=parent.get(b);}return b;};
  const rail=b=>b.cls==='rail'||b.cls==='transit';
  const ends=new Map();
  for(const b of all){
    for(const p of [b.pts[0],b.pts[b.pts.length-1]]){
      for(const k of nearKeys(p)){
        const l=ends.get(k);
        if(l) for(const o of l) if(rail(o)===rail(b)) parent.set(find(o),find(b));
      }
      const k=endKey(p);if(!ends.has(k)) ends.set(k,[]);ends.get(k).push(b);
    }
  }
  const groups=new Map();
  for(const b of all){
    const r=find(b);let g=groups.get(r);if(!g){g={L:0,overH:0};groups.set(r,g);}
    const pts=b.pts.map(p=>toLocal(p[0],p[1]));
    const cum=[0];for(let i=1;i<pts.length;i++) cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
    const L=cum[cum.length-1];g.L+=L;
    if(L>=2&&crossesRoad(pts,cum,L,cross)) g.overH=Math.max(g.overH,6.5*b.layer);
  }
  const out=new Map();
  for(const b of all){
    const g=groups.get(find(b));
    let H,low=false,rampMul=1;
    if(g.L>400){H=Math.max(15,g.overH);rampMul=1.8;}
    else if(g.L>120){H=Math.max(5,g.overH);rampMul=0.8;}
    else if(g.overH){H=g.overH;}
    else{H=1.2;low=true;}
    out.set(b,{H:H,low:low,rampMul:rampMul});
  }
  return out;
}
function tnoChainH(b,cross){
  const now=performance.now();
  if(!tnoChains||now-tnoChainsT>200||!tnoChains.has(b)){tnoChains=tnoBuildChains(cross);tnoChainsT=now;}
  return tnoChains.get(b)||{H:1.2,low:true,rampMul:1};
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
  const tnoHeads=[];
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
        /* v4: concrete barrier (1.05 m high, 0.45 m thick) instead of a thin railing */
        const bh=1.05,bt=0.45,bc=TNO_COL.barrier;
        const Li0=[Lp[i][0]-nx*bt,Lp[i][1]-nz*bt],Li1=[Lp[i+1][0]-nx*bt,Lp[i+1][1]-nz*bt];
        const Ri0=[Rp[i][0]+nx*bt,Rp[i][1]+nz*bt],Ri1=[Rp[i+1][0]+nx*bt,Rp[i+1][1]+nz*bt];
        quad([[Lp[i][0],h0,Lp[i][1]],[Lp[i+1][0],h1,Lp[i+1][1]],[Lp[i+1][0],h1+bh,Lp[i+1][1]],[Lp[i][0],h0+bh,Lp[i][1]]],[nx,0,nz],bc);
        quad([[Li1[0],h1,Li1[1]],[Li0[0],h0,Li0[1]],[Li0[0],h0+bh,Li0[1]],[Li1[0],h1+bh,Li1[1]]],[-nx,0,-nz],bc);
        quad([[Lp[i][0],h0+bh,Lp[i][1]],[Lp[i+1][0],h1+bh,Lp[i+1][1]],[Li1[0],h1+bh,Li1[1]],[Li0[0],h0+bh,Li0[1]]],[0,1,0],bc);
        quad([[Rp[i+1][0],h1,Rp[i+1][1]],[Rp[i][0],h0,Rp[i][1]],[Rp[i][0],h0+bh,Rp[i][1]],[Rp[i+1][0],h1+bh,Rp[i+1][1]]],[-nx,0,-nz],bc);
        quad([[Ri0[0],h0,Ri0[1]],[Ri1[0],h1,Ri1[1]],[Ri1[0],h1+bh,Ri1[1]],[Ri0[0],h0+bh,Ri0[1]]],[nx,0,nz],bc);
        quad([[Rp[i+1][0],h1+bh,Rp[i+1][1]],[Rp[i][0],h0+bh,Rp[i][1]],[Ri0[0],h0+bh,Ri0[1]],[Ri1[0],h1+bh,Ri1[1]]],[0,1,0],bc);
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
      /* v4: piers = one column (narrow decks) or two columns (wide decks) with a cap beam under the deck */
      const step=W>=9?36:28;
      for(let s=step/2;s<L-6;s+=step){
        const h=hAt(s);
        if(h<3) continue;
        const p=at(s),nx2=-p.tz,nz2=p.tx,top=h-BR_T;
        const cols=W>=9?[-W*0.3,W*0.3]:[0];
        const cw=W>=9?1.3:1.2;
        let ok=true;
        for(const o of cols) if(tnoPierOnRoad(p.x+nx2*o,p.z+nz2*o,p.tx,p.tz,cw)) ok=false;
        if(!ok) continue;
        for(const o of cols) box(p.x+nx2*o,p.z+nz2*o,p.tx,p.tz,cw,cw,0,top-0.9,TNO_COL.pier);
        box(p.x,p.z,p.tx,p.tz,1.6,W>=9?W*0.85:Math.max(2.4,W*0.5),top-0.9,top,TNO_COL.pier);
      }
    }
    if(opt.lamps){
      /* v4: street lights on road bridges, every 40 m, along the edges */
      for(let s=20;s<L-10;s+=40){
        const h=hAt(s);if(h<2) continue;
        const p=at(s),nx2=-p.tz,nz2=p.tx;
        const sides=W>=9?[1,-1]:[1];
        for(const sd of sides){
          const ex=p.x+nx2*(W/2-0.25)*sd,ez=p.z+nz2*(W/2-0.25)*sd;
          box(ex,ez,p.tx,p.tz,0.2,0.2,h+1.05,h+9,TNO_COL.pole);
          const ax=-nx2*sd,az=-nz2*sd;
          box(ex+ax*1.0,ez+az*1.0,ax,az,2.0,0.12,h+8.85,h+9,TNO_COL.pole);
          box(ex+ax*1.9,ez+az*1.9,ax,az,0.6,0.3,h+8.6,h+8.85,TNO_COL.head);
          tnoHeads.push([ex+ax*1.9,h+8.55,ez+az*1.9,h]);
        }
      }
    }
    if(opt.rem){
      /* v4: T-shaped light posts along REM / train tracks, every 30 m, lighting the tracks */
      for(let s=15;s<L-8;s+=30){
        const h=hAt(s);if(h<1) continue;
        const p=at(s),nx2=-p.tz,nz2=p.tx;
        box(p.x,p.z,p.tx,p.tz,0.3,0.3,h,h+6.5,TNO_COL.pole);
        box(p.x,p.z,nx2,nz2,Math.min(W*0.8,4.6),0.18,h+6.3,h+6.5,TNO_COL.pole);
        for(const sd of [1,-1]){
          const hx=p.x+nx2*sd*Math.min(W*0.38,2.2),hz=p.z+nz2*sd*Math.min(W*0.38,2.2);
          box(hx,hz,p.tx,p.tz,0.6,0.3,h+6.05,h+6.3,TNO_COL.head);
          tnoHeads.push([hx,h+6.0,hz,h]);
        }
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
    let H,low=false,rampMul=1;
    {const ch=tnoChainH(b,cross);H=ch.H;low=ch.low;rampMul=ch.rampMul;}
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
    ribbon(pts,hAt,W,{deck:isRail?BR_COL.ballast:BR_COL.asphalt,embank:false,line:lineCol,pillars:!low,railings:true,railMin:low?0.3:1.5,railCol:railCol,lamps:!isRail&&!low&&b.cls!=='path'&&b.cls!=='track',rem:isRail});
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
  mesh.userData.heads=tnoHeads;
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

/* when the drawn roads change, rebuild bridges (at most every 15 s) and signs (at most every 60 s) with the new checks.
   v3: was every 5 s, which kept memory climbing during the drive */
let tnoGridKey=null,tnoLastRefresh=0,tnoSignT=0;
setInterval(()=>{
  try{
    if(typeof r3GridKey==='undefined') return;
    const now=performance.now();
    if(r3GridKey===tnoGridKey||now-tnoLastRefresh<15000) return;
    tnoGridKey=r3GridKey;tnoLastRefresh=now;
    if(typeof brMeshes!=='undefined'&&brMeshes.size&&typeof updateBridges==='function'){brChanged=true;updateBridges(true);}
    if(now-tnoSignT>60000&&typeof sDirtyAll!=='undefined'&&typeof updateSigns==='function'){tnoSignT=now;sDirtyAll=true;updateSigns(true);}
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
  /* v4: REM / train track beds were dark brown strips; now concrete grey */
  if(BR_COL.ballast) BR_COL.ballast.set('#9a958d');
}

/* ===== v4: night glow of bridge lights and REM lights (one shared object, rebuilt with the bridges) ===== */
let tnoGlow=null,tnoGlowSig='',tnoGlowTex=null;
function tnoGlowTexture(){
  if(tnoGlowTex) return tnoGlowTex;
  const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
  const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(0.35,'rgba(255,255,255,0.55)');g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g;x.fillRect(0,0,64,64);tnoGlowTex=new THREE.CanvasTexture(c);return tnoGlowTex;
}
function tnoDisposeGlow(){
  if(!tnoGlow) return;
  for(const o of tnoGlow){treeScene.remove(o);o.geometry.dispose();o.material.dispose();}
  tnoGlow=null;
}
function tnoRebuildGlow(){
  if(typeof treeScene==='undefined'||!treeScene) return;
  const keys=[...brMeshes.keys()].sort().join('|');
  if(keys===tnoGlowSig&&tnoGlow) return;
  tnoGlowSig=keys;tnoDisposeGlow();
  const heads=[];for(const m of brMeshes.values()) if(m.userData&&m.userData.heads) for(const h of m.userData.heads) heads.push(h);
  if(!heads.length) return;
  const tex=tnoGlowTexture();
  const pp=new Float32Array(heads.length*3);heads.forEach((h,i)=>{pp[i*3]=h[0];pp[i*3+1]=h[1];pp[i*3+2]=h[2];});
  const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(pp,3));
  const pts=new THREE.Points(pg,new THREE.PointsMaterial({color:0xffe6a8,size:2.4,sizeAttenuation:true,map:tex,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
  pts.frustumCulled=false;
  const pos=[],uv=[],idx=[];let n=0;const r=5.5;
  for(const h of heads){
    const y=h[3]+0.12;
    pos.push(h[0]-r,y,h[2]-r, h[0]+r,y,h[2]-r, h[0]+r,y,h[2]+r, h[0]-r,y,h[2]+r);
    uv.push(0,0,1,0,1,1,0,1);idx.push(n,n+2,n+1,n,n+3,n+2);n+=4;
  }
  const qg=new THREE.BufferGeometry();qg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));qg.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));qg.setIndex(idx);
  const pools=new THREE.Mesh(qg,new THREE.MeshBasicMaterial({color:0xffd690,map:tex,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
  pools.frustumCulled=false;
  treeScene.add(pools);treeScene.add(pts);tnoGlow=[pts,pools];tnoGlowNight();
}
function tnoGlowNight(){
  if(!tnoGlow) return;
  const nt=typeof nightNow==='number'?nightNow:0;
  tnoGlow[0].material.opacity=Math.min(1,nt*1.2);tnoGlow[0].visible=nt>0.1;
  tnoGlow[1].material.opacity=nt*0.45;tnoGlow[1].visible=nt>0.1;
}
if(typeof updateBridges==='function'){
  updateBridges=(function(base){return function(){
    const r=base.apply(this,arguments);
    try{if(typeof brMeshes!=='undefined') tnoRebuildGlow();}catch(e){}
    return r;
  };})(updateBridges);
}
setInterval(()=>{try{tnoGlowNight();}catch(e){}},1000);

/* ===== v4: Samuel-De Champlain Bridge landmark: the 170 m twin-leg tower and its two planes of harp cables =====
   Position from the bridge's own map data: 1,020 m from the Brossard end (780 m east approach + 240 m main span
   over the Seaway), between the two road decks, over the REM corridor. Main span toward Brossard, back span
   124 m toward Nuns' Island. Built only when you are within 4 km, removed beyond 6 km. */
const TNO_CHAMPLAIN={lat:45.468267,lng:-73.504888,east:98.4,deckY:15,height:170,legHalf:7.5,main:240,back:124,cables:15};
let tnoLandmark=null;
function tnoBuildChamplain(){
  const C=TNO_CHAMPLAIN,[cx,cz]=toLocal(C.lng,C.lat);
  const ex=Math.sin(C.east*Math.PI/180),ez=-Math.cos(C.east*Math.PI/180),nx=-ez,nz=ex;
  const pos=[],nor=[],idx=[];let b=0;
  const quad=(v,n)=>{for(const p of v){pos.push(p[0],p[1],p[2]);nor.push(n[0],n[1],n[2]);}idx.push(b,b+1,b+2,b,b+2,b+3);b+=4;};
  const box=(x,z,ux,uz,a,c,y0,y1)=>{const vx=-uz,vz=ux,A=a/2,B=c/2;const P=(sa,sb,y)=>[x+ux*A*sa+vx*B*sb,y,z+uz*A*sa+vz*B*sb];
    quad([P(1,1,y0),P(1,-1,y0),P(1,-1,y1),P(1,1,y1)],[ux,0,uz]);quad([P(-1,-1,y0),P(-1,1,y0),P(-1,1,y1),P(-1,-1,y1)],[-ux,0,-uz]);
    quad([P(-1,1,y0),P(1,1,y0),P(1,1,y1),P(-1,1,y1)],[vx,0,vz]);quad([P(1,-1,y0),P(-1,-1,y0),P(-1,-1,y1),P(1,-1,y1)],[-vx,0,-vz]);
    quad([P(-1,-1,y1),P(-1,1,y1),P(1,1,y1),P(1,-1,y1)],[0,1,0]);};
  /* two legs, slightly thinner at the top, and cross beams under the deck and near the top */
  for(const sd of [1,-1]){
    const lx=cx+nx*C.legHalf*sd,lz=cz+nz*C.legHalf*sd;
    box(lx,lz,ex,ez,6,4.5,0,C.deckY+40);
    box(lx,lz,ex,ez,5,3.6,C.deckY+40,C.height-25);
    box(lx,lz,ex,ez,4,3,C.height-25,C.height);
  }
  box(cx,cz,nx,nz,C.legHalf*2+3,3,C.deckY-4,C.deckY-1.2);
  box(cx,cz,nx,nz,C.legHalf*2+2,2.5,C.height-30,C.height-27);
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.setIndex(idx);
  const tower=new THREE.Mesh(g,new THREE.MeshLambertMaterial({color:0xd9d6ce}));
  tower.frustumCulled=false;tower.castShadow=false;
  /* harp cables: parallel stays from each leg down to the deck edge beside the REM corridor */
  const lp=[];
  for(const sd of [1,-1]){
    const lx=cx+nx*C.legHalf*sd,lz=cz+nz*C.legHalf*sd;
    for(let i=1;i<=C.cables;i++){
      const ay=C.deckY+28+(C.height-40-C.deckY-28)*i/C.cables;
      for(const [dir,span] of [[1,C.main],[-1,C.back]]){
        const d=span*0.95*i/C.cables;
        lp.push(lx,ay,lz, lx+ex*d*dir,C.deckY+1.2,lz+ez*d*dir);
      }
    }
  }
  /* v5: real 3D cables (0.5 m thick) instead of 1-pixel lines, so they stay visible from far away */
  const cp=[],cn=[],ci=[];let cb=0;
  for(let k=0;k<lp.length;k+=6){
    const A=[lp[k],lp[k+1],lp[k+2]],B=[lp[k+3],lp[k+4],lp[k+5]];
    const dx=B[0]-A[0],dy=B[1]-A[1],dz=B[2]-A[2],L=Math.hypot(dx,dy,dz)||1;
    let ux=-dz,uz=dx;const ul=Math.hypot(ux,uz)||1;ux=ux/ul*0.25;uz=uz/ul*0.25;
    const v=[[ux,0.25,uz],[ux,-0.25,uz],[-ux,-0.25,-uz],[-ux,0.25,-uz]];
    for(let f=0;f<4;f++){
      const a=v[f],c=v[(f+1)%4];
      const nx2=(a[0]+c[0]),ny2=(a[1]+c[1]),nz2=(a[2]+c[2]),nl=Math.hypot(nx2,ny2,nz2)||1;
      for(const q of [[A,a],[B,a],[B,c],[A,c]]){cp.push(q[0][0]+q[1][0],q[0][1]+q[1][1],q[0][2]+q[1][2]);cn.push(nx2/nl,ny2/nl,nz2/nl);}
      ci.push(cb,cb+1,cb+2,cb,cb+2,cb+3,cb,cb+2,cb+1,cb,cb+3,cb+2);cb+=4;
    }
  }
  const cg=new THREE.BufferGeometry();
  cg.setAttribute('position',new THREE.Float32BufferAttribute(cp,3));cg.setAttribute('normal',new THREE.Float32BufferAttribute(cn,3));cg.setIndex(ci);
  const cables=new THREE.Mesh(cg,new THREE.MeshLambertMaterial({color:0xf2f2f2}));
  cables.frustumCulled=false;
  /* aircraft warning light on top */
  const tg=new THREE.BufferGeometry();tg.setAttribute('position',new THREE.Float32BufferAttribute([cx,C.height+1,cz],3));
  const top=new THREE.Points(tg,new THREE.PointsMaterial({color:0xff3b30,size:6,sizeAttenuation:true,map:tnoGlowTexture(),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
  top.frustumCulled=false;
  return [tower,cables,top];
}
setInterval(()=>{
  try{
    if(typeof treeScene==='undefined'||!treeScene||!gPos) return;
    const C=TNO_CHAMPLAIN,[cx,cz]=toLocal(C.lng,C.lat),[px,pz]=toLocal(gPos[0],gPos[1]);
    /* v5: also when you look at the bridge on the map (map center), not only when the car is near it */
    const mc=map.getCenter(),[mx,mz]=toLocal(mc.lng,mc.lat);
    const d=Math.min(Math.hypot(px-cx,pz-cz),Math.hypot(mx-cx,mz-cz));
    if(d<4000&&!tnoLandmark){tnoLandmark=tnoBuildChamplain();for(const o of tnoLandmark) treeScene.add(o);}
    else if(d>6000&&tnoLandmark){for(const o of tnoLandmark){treeScene.remove(o);o.geometry.dispose();o.material.dispose();}tnoLandmark=null;}
    if(tnoLandmark){const nt=typeof nightNow==='number'?nightNow:0;tnoLandmark[2].visible=nt>0.1;}
  }catch(e){}
},2000);
