/* TessyNav lights v2: street lamps with night glow, and traffic lights placed per approach */
const LC=0.005;
const lCells=new Map(),lMeshes=new Map();
let lFailed=false,lLast=0,lDirtyAll=false;
let lMatPole=null,lMatHead=null,lMatPool=null,lMatGlow=null;
const sigCells=new Map();
let sigCount=0;
const LAMP={motorway:[50,11,true,12],trunk:[45,10,true,11],primary:[38,10,true,9.5],secondary:[36,9,true,9],tertiary:[34,8,false,8.5],minor:[32,7.5,false,8]};
const LCOL={pole:new THREE.Color('#5d6166'),sigBox:new THREE.Color('#2b2d30'),red:new THREE.Color('#5a1c1c'),amber:new THREE.Color('#5a4a1c'),green:new THREE.Color('#1c4a2c')};

function lightAcc(withColor){
  const A={pos:[],nor:[],col:[],uv:[],idx:[],base:0};
  A.quad=(v,n,c,uv)=>{
    for(let i=0;i<4;i++){const p=v[i];A.pos.push(p[0],p[1],p[2]);A.nor.push(n[0],n[1],n[2]);
      if(withColor&&c) A.col.push(c.r,c.g,c.b); if(uv) A.uv.push(uv[i][0],uv[i][1]);}
    A.idx.push(A.base,A.base+1,A.base+2,A.base,A.base+2,A.base+3);A.base+=4;
  };
  A.box=(cx,cz,tx,tz,along,across,y0,y1,c)=>{
    const nx=-tz,nz=tx,a=along/2,b=across/2;
    const P=(sa,sb,y)=>[cx+tx*a*sa+nx*b*sb,y,cz+tz*a*sa+nz*b*sb];
    A.quad([P(1,1,y0),P(1,-1,y0),P(1,-1,y1),P(1,1,y1)],[tx,0,tz],c);
    A.quad([P(-1,-1,y0),P(-1,1,y0),P(-1,1,y1),P(-1,-1,y1)],[-tx,0,-tz],c);
    A.quad([P(-1,1,y0),P(1,1,y0),P(1,1,y1),P(-1,1,y1)],[nx,0,nz],c);
    A.quad([P(1,-1,y0),P(-1,-1,y0),P(-1,-1,y1),P(1,-1,y1)],[-nx,0,-nz],c);
    A.quad([P(-1,-1,y1),P(-1,1,y1),P(1,1,y1),P(1,-1,y1)],[0,1,0],c);
    A.quad([P(-1,1,y0),P(-1,-1,y0),P(1,-1,y0),P(1,1,y0)],[0,-1,0],c);
  };
  return A;
}
function lightFixWinding(pos,nor,idx){
  for(let i=0;i<idx.length;i+=3){
    const a=idx[i]*3,b=idx[i+1]*3,c=idx[i+2]*3;
    const ux=pos[b]-pos[a],uy=pos[b+1]-pos[a+1],uz=pos[b+2]-pos[a+2];
    const vx=pos[c]-pos[a],vy=pos[c+1]-pos[a+1],vz=pos[c+2]-pos[a+2];
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    if(nx*nor[a]+ny*nor[a+1]+nz*nor[a+2]<0){const t=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=t;}
  }
}
function lightGeom(A){
  if(!A.pos.length) return null;
  lightFixWinding(A.pos,A.nor,A.idx);
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(A.pos,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(A.nor,3));
  if(A.col.length) g.setAttribute('color',new THREE.Float32BufferAttribute(A.col,3));
  if(A.uv.length) g.setAttribute('uv',new THREE.Float32BufferAttribute(A.uv,2));
  g.setIndex(A.idx);
  return g;
}
function radialTex(rgb){
  const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
  const g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba('+rgb+',1)');g.addColorStop(0.4,'rgba('+rgb+',0.45)');g.addColorStop(1,'rgba('+rgb+',0)');
  x.fillStyle=g;x.fillRect(0,0,64,64);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function makeLightMaterials(){
  lMatPole=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
  lMatHead=new THREE.MeshBasicMaterial({color:0x9a9a9a});
  lMatPool=new THREE.MeshBasicMaterial({map:radialTex('255,214,150'),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0});
  lMatGlow=new THREE.PointsMaterial({map:radialTex('255,225,170'),size:12,sizeAttenuation:false,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0});
}

/* Real traffic light locations from feux.csv */
function loadSignals(){
  fetch('feux.csv').then(r=>r.ok?r.text():'').then(txt=>{
    if(!txt) return;
    const lines=txt.split(/\r?\n/).filter(l=>l.trim());
    if(lines.length<2) return;
    const delim=(lines[0].split(';').length>lines[0].split(',').length)?';':',';
    const head=lines[0].replace(/^\uFEFF/,'').split(delim).map(h=>h.trim().replace(/"/g,'').toLowerCase());
    let iLon=head.findIndex(h=>h.indexOf('longitude')>=0),iLat=head.findIndex(h=>h.indexOf('latitude')>=0);
    if(iLon<0) iLon=head.findIndex(h=>h==='lon'||h==='long'||h==='x_long');
    if(iLat<0) iLat=head.findIndex(h=>h==='lat'||h==='y_lat');
    if(iLon<0||iLat<0){console.warn('feux.csv: no longitude/latitude columns',head);return;}
    for(let i=1;i<lines.length;i++){
      const c=lines[i].split(delim);
      const lng=parseFloat((c[iLon]||'').replace(/"/g,'').replace(',','.')),lat=parseFloat((c[iLat]||'').replace(/"/g,'').replace(',','.'));
      if(!isFinite(lng)||!isFinite(lat)||lng<-80||lng>-70||lat<40||lat>50) continue;
      const ck=Math.floor(lng/LC)+','+Math.floor(lat/LC);
      if(!sigCells.has(ck)) sigCells.set(ck,[]);
      sigCells.get(ck).push([lng,lat]);sigCount++;
    }
    console.log('Traffic lights loaded:',sigCount);
    lDirtyAll=true;updateLights(true);
  }).catch(()=>{});
}

function collectLightRoads(cx,cy){
  const feats=map.querySourceFeatures('openmaptiles',{sourceLayer:'transportation',filter:['all',
    ['in',['get','class'],['literal',['motorway','trunk','primary','secondary','tertiary','minor']]],
    ['!=',['get','brunnel'],'bridge'],['!=',['get','brunnel'],'tunnel']]});
  for(const f of feats){
    const pr=f.properties||{},g=f.geometry;
    const lines=g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[];
    for(const ln of lines){
      if(ln.length<2) continue;
      const mid=ln[Math.floor(ln.length/2)];
      const gx=Math.floor(mid[0]/LC),gy=Math.floor(mid[1]/LC);
      if(Math.abs(gx-cx)>2||Math.abs(gy-cy)>2) continue;
      const ck=gx+','+gy;
      const a=ln[0],z=ln[ln.length-1];
      const key=ln.length+'|'+a[0].toFixed(6)+','+a[1].toFixed(6)+'|'+z[0].toFixed(6)+','+z[1].toFixed(6);
      let cell=lCells.get(ck); if(!cell){cell=new Map();lCells.set(ck,cell);}
      if(cell.has(key)) continue;
      cell.set(key,{pts:ln,cls:pr.class,oneway:+pr.oneway||0});
      if(lMeshes.has(ck)) lMeshes.get(ck).dirty=true;
    }
  }
}

function localRoad(r){
  const spec=LAMP[r.cls]; if(!spec) return null;
  const pts=r.pts.map(p=>toLocal(p[0],p[1])),n=pts.length;
  const cum=[0];for(let i=1;i<n;i++) cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  return {pts:pts,cum:cum,L:cum[n-1],W:spec[1],spec:spec,oneway:r.oneway};
}

function buildLightCell(ck){
  const [gx,gy]=ck.split(',').map(Number);
  const cell=lCells.get(ck)||new Map();
  const poles=lightAcc(true),heads=lightAcc(false),pools=lightAcc(false),glow=[];
  const occ=new Set();
  /* Street lamps */
  for(const r0 of cell.values()){
    const r=localRoad(r0); if(!r) continue;
    const [spacing,W,both,ph]=r.spec,pts=r.pts,cum=r.cum,n=pts.length;
    let k=0;
    for(let s=spacing/2;s<r.L;s+=spacing,k++){
      let i=0;while(i<n-2&&cum[i+1]<s) i++;
      const seg=cum[i+1]-cum[i]||1,t=(s-cum[i])/seg;
      const x=pts[i][0]+(pts[i+1][0]-pts[i][0])*t,z=pts[i][1]+(pts[i+1][1]-pts[i][1])*t;
      const tx=(pts[i+1][0]-pts[i][0])/seg,tz=(pts[i+1][1]-pts[i][1])/seg;
      const nx=-tz,nz=tx;
      const sides=both?[1,-1]:[k%2?1:-1];
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
  /* Traffic lights: one pole per approaching direction, at the stop line, right side */
  const sigs=sigCells.get(ck)||[];
  if(sigs.length){
    const near=[];
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
      const c2=lCells.get((gx+dx)+','+(gy+dy));
      if(c2) for(const r0 of c2.values()){const r=localRoad(r0);if(r) near.push(r);}
    }
    for(const sg of sigs){
      const [sx,sz]=toLocal(sg[0],sg[1]);
      const sigOcc=new Set();
      for(const r of near){
        const pts=r.pts,cum=r.cum;
        let bd=28,best=null;
        for(let i=0;i<pts.length-1;i++){
          const a=pts[i],b=pts[i+1],dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz||1;
          const t=Math.max(0,Math.min(1,((sx-a[0])*dx+(sz-a[1])*dz)/l2));
          const px=a[0]+dx*t,pz=a[1]+dz*t,d=Math.hypot(px-sx,pz-sz);
          if(d<bd){bd=d;const l=Math.sqrt(l2);best={px:px,pz:pz,tx:dx/l,tz:dz/l,s:cum[i]+t*l};}
        }
        if(!best) continue;
        const dirs=r.oneway===1?[1]:r.oneway===-1?[-1]:[1,-1];
        for(const dsg of dirs){
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
          poles.box(hx,hz,fx,fz,0.4,0.42,4.9,6.0,LCOL.sigBox);
          const fxo=hx-fx*0.05,fzo=hz-fz*0.05;
          poles.box(fxo,fzo,fx,fz,0.42,0.30,5.65,5.9,LCOL.red);
          poles.box(fxo,fzo,fx,fz,0.42,0.30,5.32,5.57,LCOL.amber);
          poles.box(fxo,fzo,fx,fz,0.42,0.30,4.99,5.24,LCOL.green);
        }
      }
    }
  }
  const group=new THREE.Group();
  const pg=lightGeom(poles);
  if(pg){const m=new THREE.Mesh(pg,lMatPole);m.castShadow=true;m.frustumCulled=false;group.add(m);}
  const hg=lightGeom(heads);
  if(hg){const m=new THREE.Mesh(hg,lMatHead);m.frustumCulled=false;group.add(m);}
  const qg=lightGeom(pools);
  if(qg){const m=new THREE.Mesh(qg,lMatPool);m.frustumCulled=false;m.renderOrder=2;group.add(m);}
  if(glow.length){
    const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.Float32BufferAttribute(glow,3));
    const p=new THREE.Points(gg,lMatGlow);p.frustumCulled=false;group.add(p);
  }
  return group;
}

function disposeGroup(g){g.traverse(o=>{if(o.geometry) o.geometry.dispose();});}

function updateLightNight(){
  const nt=typeof nightNow==='number'?nightNow:0;
  if(lMatHead) lMatHead.color.set(mixHex('#9a9a9a','#ffe2a8',nt));
  if(lMatPool) lMatPool.opacity=0.6*nt;
  if(lMatGlow) lMatGlow.opacity=0.9*nt;
}

function updateLights(force){
  if(lFailed||!treeScene) return;
  const now=performance.now();
  if(!force&&now-lLast<900) return;
  lLast=now;
  try{
    if(!lMatPole) makeLightMaterials();
    updateLightNight();
    const zoomOk=map.getZoom()>=15.5;
    for(const v of lMeshes.values()) v.group.visible=zoomOk;
    if(!zoomOk){map.triggerRepaint();return;}
    const c=map.getCenter(),cx=Math.floor(c.lng/LC),cy=Math.floor(c.lat/LC);
    collectLightRoads(cx,cy);
    for(const ck of [...lCells.keys()]){
      const [x,y]=ck.split(',').map(Number);
      if(Math.abs(x-cx)>2||Math.abs(y-cy)>2) lCells.delete(ck);
    }
    for(const [ck,v] of lMeshes){
      const [x,y]=ck.split(',').map(Number);
      if(lDirtyAll||v.dirty||Math.abs(x-cx)>1||Math.abs(y-cy)>1){treeScene.remove(v.group);disposeGroup(v.group);lMeshes.delete(ck);}
    }
    lDirtyAll=false;
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
      const ck=(cx+dx)+','+(cy+dy);
      if(lMeshes.has(ck)||(!lCells.has(ck)&&!sigCells.has(ck))) continue;
      const group=buildLightCell(ck);
      treeScene.add(group);lMeshes.set(ck,{group:group,dirty:false});
    }
    map.triggerRepaint();
  }catch(e){
    lFailed=true;console.warn('Street lights failed',e);
    for(const v of lMeshes.values()) treeScene.remove(v.group);
  }
}

map.on('load',()=>{
  loadSignals();
  updateLights(true);
  map.on('idle',()=>updateLights(false));
  map.on('moveend',()=>updateLights(true));
  setInterval(()=>updateLightNight(),30000);
});
