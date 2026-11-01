/* TessyNav fixes v1: hide map roads under detailed roads, lamps only on the outer side of divided roads */

/* Map's own roads disappear completely where our detailed roads are loaded */
function r3SetNarrow(narrow){
  if(r3Narrow===narrow) return;
  r3Narrow=narrow;
  for(const id of r3TileRoads){try{map.setPaintProperty(id,'line-width',narrow?roadPxN(roadMeters(0),0):roadPx(roadMeters(0)));}catch(e){}}
  for(const id of r3TileCasings){try{map.setPaintProperty(id,'line-width',narrow?roadPxN(roadMeters(0),0):roadPx(roadMeters(0.7)));}catch(e){}}
}

/* Street lamps and traffic lights, with lamps kept off the median of divided roads */
function buildLightCell(ck){
  const [gx,gy]=ck.split(',').map(Number);
  const cell=lCells.get(ck)||new Map();
  const poles=lightAcc(true),heads=lightAcc(false),pools=lightAcc(false),lenses=lightAcc(true);
  const glow=[],sigGlow=[],sigGlowCol=[];
  const occ=new Set();
  const near=[];
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
    const c2=lCells.get((gx+dx)+','+(gy+dy));
    if(c2) for(const r0 of c2.values()){const r=localRoad(r0);if(r) near.push(r);}
  }
  /* Street lamps */
  for(const r0 of cell.values()){
    const r=localRoad(r0); if(!r) continue;
    const [spacing,W,both,ph]=r.spec,pts=r.pts,cum=r.cum,n=pts.length;
    let outer=0;
    if(r.oneway&&n>1){
      const mi=Math.floor((n-1)/2),a=pts[mi],b=pts[Math.min(n-1,mi+1)];
      const dl=Math.hypot(b[0]-a[0],b[1]-a[1])||1,tx=(b[0]-a[0])/dl,tz=(b[1]-a[1])/dl;
      for(const o of near){
        if(o.pts===r.pts) continue;
        const q=closestOn(o,a[0],a[1],35);
        if(!q||q.d<4) continue;
        if(Math.abs(q.tx*tx+q.tz*tz)<0.9) continue;
        const side=tx*(q.pz-a[1])-tz*(q.px-a[0]);
        outer=side>0?-1:1;
        break;
      }
    }
    let k=0;
    for(let s=spacing/2;s<r.L;s+=spacing,k++){
      let i=0;while(i<n-2&&cum[i+1]<s) i++;
      const seg=cum[i+1]-cum[i]||1,t=(s-cum[i])/seg;
      const x=pts[i][0]+(pts[i+1][0]-pts[i][0])*t,z=pts[i][1]+(pts[i+1][1]-pts[i][1])*t;
      const tx=(pts[i+1][0]-pts[i][0])/seg,tz=(pts[i+1][1]-pts[i][1])/seg;
      const nx=-tz,nz=tx;
      const sides=outer?[outer]:(both?[1,-1]:[k%2?1:-1]);
      for(const sd of sides){
        const off=W/2+1.2,px=x+nx*off*sd,pz=z+nz*off*sd;
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
  /* Traffic lights: one per real approaching direction, bright lenses facing drivers */
  const sigs=sigCells.get(ck)||[];
  if(sigs.length){
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
          const px=stx+rx*o,pz=stz+rz*o;
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
}

if(typeof lDirtyAll!=='undefined') lDirtyAll=true;
map.on('load',()=>{lDirtyAll=true;});
