/* TessyNav bridges v3: raised bridges, ramps that follow the road, embankments, railings, pillars */
const BRC=0.005;
const brCells=new Map(),brMeshes=new Map();
let brMat=null,brFailed=false,brReady=false,br3D=false,brLast=0,brChanged=false;
const BR_W={motorway:11,trunk:10,primary:10,secondary:9,tertiary:8,minor:7.5,service:5,track:4,path:3,rail:4.5,transit:4.5};
const BR_RAMP={motorway:170,trunk:170,primary:120,secondary:120,tertiary:80,minor:80,service:50,rail:220,transit:220};
const BR_COL={
  asphalt:new THREE.Color('#4b4f56'),ballast:new THREE.Color('#5a5048'),side:new THREE.Color('#b3afa6'),
  rail:new THREE.Color('#c4c0b7'),pillar:new THREE.Color('#9e9a92'),white:new THREE.Color('#f2f2ee'),
  yellow:new THREE.Color('#e2b21f'),grass:new THREE.Color('#5f7d45')
};
const BR_T=1.2;

function nearTileEdge(lng,lat){
  const n=16384,x=(lng+180)/360*n,s=Math.sin(lat*R);
  const y=(0.5-Math.log((1+s)/(1-s))/(4*Math.PI))*n;
  const fx=x-Math.floor(x),fy=y-Math.floor(y);
  return fx<0.02||fx>0.98||fy<0.02||fy>0.98;
}
function endKey(p){return Math.round(p[0]*1e5)+','+Math.round(p[1]*1e5);}
function nearKeys(p){
  const kx=Math.round(p[0]*1e5),ky=Math.round(p[1]*1e5),out=[];
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++) out.push((kx+dx)+','+(ky+dy));
  return out;
}
function lookupNear(m,p){let out=[];for(const k of nearKeys(p)){const v=m.get(k);if(v) out=out.concat(v);}return out;}
function angOf(a,b){return Math.atan2(b[1]-a[1],b[0]-a[0])/R;}
function angDiff(a,b){let d=Math.abs(a-b)%360;return d>180?360-d:d;}
function polyLenM(pts){let s=0;for(let i=1;i<pts.length;i++) s+=dist(pts[i-1],pts[i]);return s;}

function collectBridges(cx,cy){
  const feats=map.querySourceFeatures('openmaptiles',{sourceLayer:'transportation',filter:['==',['get','brunnel'],'bridge']});
  for(const f of feats){
    const pr=f.properties||{},g=f.geometry;
    const lines=g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[];
    for(const ln of lines){
      if(ln.length<2) continue;
      const mid=ln[Math.floor(ln.length/2)];
      const gx=Math.floor(mid[0]/BRC),gy=Math.floor(mid[1]/BRC);
      if(Math.abs(gx-cx)>3||Math.abs(gy-cy)>3) continue;
      const ck=gx+','+gy;
      const a=ln[0],z=ln[ln.length-1];
      const key=ln.length+'|'+a[0].toFixed(6)+','+a[1].toFixed(6)+'|'+z[0].toFixed(6)+','+z[1].toFixed(6);
      let cell=brCells.get(ck); if(!cell){cell=new Map();brCells.set(ck,cell);}
      if(cell.has(key)) continue;
      cell.set(key,{pts:ln,cls:pr.class||'minor',layer:Math.max(1,Math.min(4,+pr.layer||1)),oneway:!!pr.oneway});
      brChanged=true;
    }
  }
}

/* Follow a road from the bridge end across several pieces until the ramp length is reached */
function chainRoad(first,RL,roadIdx){
  let pts=first.pts.slice(),len=polyLenM(pts),hops=0;
  while(len<RL&&hops<8){
    const endP=pts[pts.length-1],prevP=pts[pts.length-2];
    const dirIn=angOf(prevP,endP);
    const prevK=endKey(prevP);
    const next=lookupNear(roadIdx,endP).find(o=>o.pts.length>1&&endKey(o.pts[1])!==prevK&&angDiff(angOf(o.pts[0],o.pts[1]),dirIn)<50);
    if(!next) break;
    pts=pts.concat(next.pts.slice(1));len+=polyLenM(next.pts);hops++;
  }
  return pts;
}

function buildBridgeMesh(cell,endInfo,roadIdx){
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
    for(let i=0;i<n-1;i++){
      const h0=Hs[i],h1=Hs[i+1],nx=T[i][2],nz=T[i][3];
      if(h0<0.05&&h1<0.05) continue;
      quad([[Lp[i][0],h0,Lp[i][1]],[Rp[i][0],h0,Rp[i][1]],[Rp[i+1][0],h1,Rp[i+1][1]],[Lp[i+1][0],h1,Lp[i+1][1]]],[0,1,0],opt.deck);
      if(opt.embank){
        const k0=h0*1.6,k1=h1*1.6;
        quad([[Lp[i][0],h0,Lp[i][1]],[Lp[i+1][0],h1,Lp[i+1][1]],[Lp[i+1][0]+nx*k1,0,Lp[i+1][1]+nz*k1],[Lp[i][0]+nx*k0,0,Lp[i][1]+nz*k0]],[nx*0.53,0.85,nz*0.53],BR_COL.grass);
        quad([[Rp[i+1][0],h1,Rp[i+1][1]],[Rp[i][0],h0,Rp[i][1]],[Rp[i][0]-nx*k0,0,Rp[i][1]-nz*k0],[Rp[i+1][0]-nx*k1,0,Rp[i+1][1]-nz*k1]],[-nx*0.53,0.85,-nz*0.53],BR_COL.grass);
      }else{
        quad([[Lp[i][0],h0,Lp[i][1]],[Lp[i+1][0],h1,Lp[i+1][1]],[Lp[i+1][0],h1-BR_T,Lp[i+1][1]],[Lp[i][0],h0-BR_T,Lp[i][1]]],[nx,0,nz],BR_COL.side);
        quad([[Rp[i+1][0],h1,Rp[i+1][1]],[Rp[i][0],h0,Rp[i][1]],[Rp[i][0],h0-BR_T,Rp[i][1]],[Rp[i+1][0],h1-BR_T,Rp[i+1][1]]],[-nx,0,-nz],BR_COL.side);
        quad([[Rp[i][0],h0-BR_T,Rp[i][1]],[Lp[i][0],h0-BR_T,Lp[i][1]],[Lp[i+1][0],h1-BR_T,Lp[i+1][1]],[Rp[i+1][0],h1-BR_T,Rp[i+1][1]]],[0,-1,0],BR_COL.side);
      }
      if((h0+h1)/2>1.5){
        quad([[Lp[i][0],h0,Lp[i][1]],[Lp[i+1][0],h1,Lp[i+1][1]],[Lp[i+1][0],h1+0.9,Lp[i+1][1]],[Lp[i][0],h0+0.9,Lp[i][1]]],[nx,0,nz],BR_COL.rail);
        quad([[Rp[i+1][0],h1,Rp[i+1][1]],[Rp[i][0],h0,Rp[i][1]],[Rp[i][0],h0+0.9,Rp[i][1]],[Rp[i+1][0],h1+0.9,Rp[i+1][1]]],[-nx,0,-nz],BR_COL.rail);
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
        box(p.x,p.z,p.tx,p.tz,1.1,Math.max(1.4,W*0.55),0,h-BR_T,BR_COL.pillar);
      }
    }
  }
  const sm=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
  const doneAppr=new Set();
  for(const b of cell.values()){
    const n=b.pts.length;
    const pts=b.pts.map(p=>toLocal(p[0],p[1]));
    let L=0;for(let i=1;i<n;i++) L+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);
    if(L<2) continue;
    const H=6.5*b.layer,W=BR_W[b.cls]||7,isRail=b.cls==='rail'||b.cls==='transit';
    const lineCol=(isRail||b.cls==='path'||b.cls==='track')?null:(b.oneway?BR_COL.white:BR_COL.yellow);
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
        const RLw=BR_RAMP[a.cls]||40;
        const chained=chainRoad(a,RLw,roadIdx);
        const ap=chained.map(p=>toLocal(p[0],p[1]));
        let AL=0;for(let i=1;i<ap.length;i++) AL+=Math.hypot(ap[i][0]-ap[i-1][0],ap[i][1]-ap[i-1][1]);
        const RL=Math.max(15,Math.min(RLw,AL));
        ribbon(ap,s=>H*(1-sm(s/RL)),BR_W[a.cls]||W,{deck:isRail?BR_COL.ballast:BR_COL.asphalt,embank:true,line:lineCol});
      }
    });
    const RLin=Math.min(45,L*0.45);
    const hAt=s=>H*(ramp[0]?sm(s/RLin):1)*(ramp[1]?sm((L-s)/RLin):1);
    ribbon(pts,hAt,W,{deck:isRail?BR_COL.ballast:BR_COL.asphalt,embank:false,line:lineCol,pillars:true});
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
}

function setBridge3D(on){
  if(on===br3D) return;
  br3D=on;
  for(const m of brMeshes.values()) m.visible=on;
  for(const l of map.getStyle().layers){
    if(/^bridge/i.test(l.id)&&l['source-layer']==='transportation') map.setLayoutProperty(l.id,'visibility',on?'none':'visible');
  }
  map.triggerRepaint();
}

function updateBridges(force){
  if(brFailed||!treeScene) return;
  const now=performance.now();
  if(!force&&now-brLast<900) return;
  brLast=now;
  try{
    if(!brMat) brMat=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
    if(map.getZoom()<15.5){setBridge3D(false);return;}
    const c=map.getCenter(),cx=Math.floor(c.lng/BRC),cy=Math.floor(c.lat/BRC);
    collectBridges(cx,cy);
    for(const ck of [...brCells.keys()]){
      const [x,y]=ck.split(',').map(Number);
      if(Math.abs(x-cx)>3||Math.abs(y-cy)>3){brCells.delete(ck);brChanged=true;}
    }
    let needBuild=brChanged;
    for(let dx=-2;dx<=2&&!needBuild;dx++)for(let dy=-2;dy<=2;dy++){
      const ck=(cx+dx)+','+(cy+dy);
      if(brCells.has(ck)&&!brMeshes.has(ck)){needBuild=true;break;}
    }
    for(const [ck,mesh] of brMeshes){
      const [x,y]=ck.split(',').map(Number);
      if(brChanged||Math.abs(x-cx)>2||Math.abs(y-cy)>2){treeScene.remove(mesh);mesh.geometry.dispose();brMeshes.delete(ck);}
    }
    if(needBuild){
      const endInfo=new Map();
      for(const cell of brCells.values()) for(const b of cell.values()){
        const n=b.pts.length;
        const add=(p,ang)=>{const k=endKey(p);if(!endInfo.has(k))endInfo.set(k,[]);endInfo.get(k).push(ang);};
        add(b.pts[0],angOf(b.pts[0],b.pts[1]));
        add(b.pts[n-1],angOf(b.pts[n-1],b.pts[n-2]));
      }
      const roadIdx=new Map();
      const roads=map.querySourceFeatures('openmaptiles',{sourceLayer:'transportation',
        filter:['all',['!=',['get','brunnel'],'bridge'],['!=',['get','brunnel'],'tunnel']]});
      for(const f of roads){
        const g=f.geometry,pr=f.properties||{};
        const lines=g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[];
        for(const ln of lines){
          if(ln.length<2) continue;
          const cls=pr.class||'minor';
          const k0=endKey(ln[0]),k1=endKey(ln[ln.length-1]);
          if(!roadIdx.has(k0)) roadIdx.set(k0,[]);
          roadIdx.get(k0).push({pts:ln,cls:cls});
          if(!roadIdx.has(k1)) roadIdx.set(k1,[]);
          roadIdx.get(k1).push({pts:ln.slice().reverse(),cls:cls});
        }
      }
      let built=false;
      for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++){
        const ck=(cx+dx)+','+(cy+dy),cell=brCells.get(ck);
        if(!cell||brMeshes.has(ck)) continue;
        const mesh=buildBridgeMesh(cell,endInfo,roadIdx);
        if(mesh){mesh.visible=br3D||!brReady;treeScene.add(mesh);brMeshes.set(ck,mesh);built=true;}
      }
      if(built&&!brReady) brReady=true;
    }
    brChanged=false;
    if(brReady) setBridge3D(true);
    map.triggerRepaint();
  }catch(e){
    brFailed=true;console.warn('3D bridges failed',e);
    for(const m of brMeshes.values()) treeScene.remove(m);
    for(const l of map.getStyle().layers){
      if(/^bridge/i.test(l.id)&&l['source-layer']==='transportation') map.setLayoutProperty(l.id,'visibility','visible');
    }
  }
}

map.on('load',()=>{
  try{
    if(map.getLayer('lane-lines')) map.setFilter('lane-lines',['all',
      ['in',['get','class'],['literal',['motorway','trunk','primary','secondary','tertiary','minor']]],
      ['!=',['get','brunnel'],'bridge']]);
  }catch(e){}
  updateBridges(true);
  map.on('idle',()=>updateBridges(false));
  map.on('moveend',()=>updateBridges(true));
});
