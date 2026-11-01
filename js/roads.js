/* TessyNav roads v4: own road shapes from OpenStreetMap (real widths, straight divided-road ends), curbs, markings, crosswalks, stop lines, one-way arrows */
const ROAD_PPM15=512*Math.pow(2,15)/(40075016.686*Math.cos(45.5*Math.PI/180));
const ROAD_W2={motorway:11,trunk:10,primary:13,secondary:12,tertiary:11,minor:9.5,service:5.5,track:4,busway:7,raceway:8};
const ROAD_W1={motorway:10.5,trunk:9.5,primary:8,secondary:7.5,tertiary:6.5,minor:5.5,service:4,track:4,busway:4,raceway:8};
const ROAD_COLORS={road:'#c9cad1',curb:'#f2f2f4',sidewalk:'#e6e2da',center:'#e2b93b',lane:'#ffffff',paint:'#ffffff'};

function roadWidthM(cls,oneway,ramp){
  if(ramp) return 6;
  return oneway?(ROAD_W1[cls]||6):(ROAD_W2[cls]||8);
}

/* ---------- Width in meters -> pixels, exact at every zoom ---------- */
function roadPx(meters){
  return ['interpolate',['exponential',2],['zoom'],
    10,['max',0.5,['*',meters,ROAD_PPM15/32]],15,['*',meters,ROAD_PPM15],22,['*',meters,ROAD_PPM15*128]];
}
function roadPxS(meters){
  return ['interpolate',['exponential',2],['zoom'],
    10,['*',meters,ROAD_PPM15/32],15,['*',meters,ROAD_PPM15],22,['*',meters,ROAD_PPM15*128]];
}
function roadPxN(meters,k){
  return ['interpolate',['exponential',2],['zoom'],
    10,['max',0.5,['*',meters,ROAD_PPM15/32]],15,['*',meters,ROAD_PPM15],
    16.5,['*',meters,ROAD_PPM15*Math.pow(2,1.5)*k],22,['*',meters,ROAD_PPM15*128*k]];
}
function roadMatch(table,fallback){
  const m=['match',['get','class']];
  for(const k in table){m.push(k,table[k]);}
  m.push(fallback);
  return m;
}
const ONEWAY=['!=',['coalesce',['get','oneway'],0],0];
function roadMeters(extra){
  return ['+',['case',['==',['coalesce',['get','ramp'],0],1],6,ONEWAY,roadMatch(ROAD_W1,6),roadMatch(ROAD_W2,8)],extra];
}

/* ---------- Map's own roads: styled, and narrowed under our detailed shapes ---------- */
let r3TileRoads=[],r3TileCasings=[],r3Narrow=null;
function restyleRoads(){
  const layers=map.getStyle().layers;
  let firstRoad=null;
  const paths=[];
  r3TileRoads=[];r3TileCasings=[];
  for(const l of layers){
    if(l.type!=='line'||l['source-layer']!=='transportation') continue;
    if(/rail|ferry|aerialway|pier/i.test(l.id)) continue;
    try{
      if(/path|pedestrian|footway|steps|cycle/i.test(l.id)){
        paths.push(l.id);
        map.setPaintProperty(l.id,'line-width',roadPx(1.8));
        map.setPaintProperty(l.id,'line-color',ROAD_COLORS.sidewalk);
        try{map.setPaintProperty(l.id,'line-dasharray',[1,0]);}catch(e){}
      }else if(l.id==='lane-lines'){
        map.setLayoutProperty(l.id,'visibility','none');
      }else if(/casing/i.test(l.id)){
        if(!firstRoad) firstRoad=l.id;
        r3TileCasings.push(l.id);
        map.setPaintProperty(l.id,'line-color',ROAD_COLORS.curb);
      }else{
        if(!firstRoad) firstRoad=l.id;
        r3TileRoads.push(l.id);
        map.setPaintProperty(l.id,'line-color',ROAD_COLORS.road);
      }
    }catch(e){console.warn('road style',l.id,e);}
  }
  if(firstRoad){for(const id of paths){try{map.moveLayer(id,firstRoad);}catch(e){}}}
  r3Narrow=null;r3SetNarrow(false);
}
function r3SetNarrow(narrow){
  if(r3Narrow===narrow) return;
  r3Narrow=narrow;
  for(const id of r3TileRoads){try{map.setPaintProperty(id,'line-width',narrow?roadPxN(roadMeters(0),0.5):roadPx(roadMeters(0)));}catch(e){}}
  for(const id of r3TileCasings){try{map.setPaintProperty(id,'line-width',narrow?roadPxN(roadMeters(0),0.5):roadPx(roadMeters(0.7)));}catch(e){}}
}

/* ---------- Downloading detailed roads from OpenStreetMap ---------- */
const R3T=0.005,R3_CLS={motorway:'motorway',trunk:'trunk',primary:'primary',secondary:'secondary',tertiary:'tertiary',
  unclassified:'minor',residential:'minor',living_street:'minor',service:'service'};
const r3Tiles=new Map(),r3Wanted=new Set(),r3Queue=[];
let r3Busy=false,r3RebuildT=null,r3Ready=false,r3LastWant=0,r3LastCenter='';
function r3CacheGet(k){try{const v=localStorage.getItem('rd3:'+k);return v?JSON.parse(v):null;}catch(e){return null;}}
function r3CacheSet(k,v){
  let idx=cacheGet('rd3:idx')||[];
  idx=idx.filter(x=>x!==k);idx.push(k);
  while(idx.length>30){const old=idx.shift();try{localStorage.removeItem('rd3:'+old);}catch(e){}}
  const json=JSON.stringify(v);
  for(let a=0;a<6;a++){
    try{localStorage.setItem('rd3:'+k,json);break;}
    catch(e){if(idx.length<=1) break;const old=idx.shift();try{localStorage.removeItem('rd3:'+old);}catch(e2){}}
  }
  try{localStorage.setItem('rd3:idx',JSON.stringify(idx));}catch(e){}
}
async function r3Fetch(tx,ty){
  const k=tx+','+ty;
  const s=(ty*R3T).toFixed(5),w=(tx*R3T).toFixed(5),n=((ty+1)*R3T).toFixed(5),e=((tx+1)*R3T).toFixed(5),bb=s+','+w+','+n+','+e;
  const q='[out:json][timeout:25];way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"]('+bb+');out geom;node["highway"~"^(crossing|stop)$"]('+bb+');out;';
  for(const url of SERVERS){
    try{
      const r=await fetch(url+'?data='+encodeURIComponent(q));
      if(!r.ok) throw new Error('busy');
      const j=await r.json(),ways=[],nodes=[];
      for(const el of j.elements){
        const t=el.tags||{};
        if(el.type==='way'&&el.geometry&&el.nodes){
          if(t.area==='yes') continue;
          if((t.bridge&&t.bridge!=='no')||(t.tunnel&&t.tunnel!=='no')||t.covered==='yes') continue;
          if(t.highway==='service'&&/driveway|parking_aisle|drive-through/.test(t.service||'')) continue;
          const base=t.highway.replace(/_link$/,''),cls=R3_CLS[base];
          if(!cls) continue;
          const ramp=/_link$/.test(t.highway);
          let ow=0;
          if(t.oneway==='yes'||t.oneway==='1'||t.oneway==='true'||t.junction==='roundabout'||t.highway==='motorway') ow=1;
          else if(t.oneway==='-1'||t.oneway==='reverse') ow=-1;
          const lanes=parseInt(t.lanes)||0;
          let wd=parseFloat(t.width);
          if(!(wd>2&&wd<40)){
            wd=lanes>0?Math.max(ow?3.5:6,lanes*3.4+((cls==='minor'&&!ow)?2:0)):roadWidthM(cls,ow,ramp);
          }
          const flat=[];
          for(const g of el.geometry){flat.push(+g.lon.toFixed(6),+g.lat.toFixed(6));}
          ways.push([el.id,cls,ow,Math.round(wd*10)/10,t.name||'',el.nodes[0],el.nodes[el.nodes.length-1],lanes,flat]);
        }else if(el.type==='node'){
          let kind=null;
          if(t.highway==='stop') kind='s';
          else if(t.highway==='crossing'){
            const c=(t.crossing||'')+' '+(t['crossing:markings']||'');
            if(/unmarked|\bno\b/.test(c)) continue;
            kind='c';
          }
          if(kind) nodes.push([+el.lon.toFixed(6),+el.lat.toFixed(6),kind]);
        }
      }
      const tile={w:ways,n:nodes};
      r3CacheSet(k,tile);
      return tile;
    }catch(err){}
  }
  return null;
}
async function r3Pump(){
  if(r3Busy) return;r3Busy=true;
  while(r3Queue.length){
    const [tx,ty]=r3Queue.shift(),k=tx+','+ty;
    const tile=await r3Fetch(tx,ty);
    r3Wanted.delete(k);
    if(tile){r3Tiles.set(k,tile);r3Schedule();}
  }
  r3Busy=false;
}
function r3Want(){
  if(!r3Ready) return;
  const now=performance.now();
  if(now-r3LastWant<1200) return;
  r3LastWant=now;
  if(map.getZoom()<15){r3SetNarrow(false);return;}
  const c=map.getCenter(),tx=Math.floor(c.lng/R3T),ty=Math.floor(c.lat/R3T);
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
    const k=(tx+dx)+','+(ty+dy);
    if(r3Tiles.has(k)||r3Wanted.has(k)) continue;
    const cached=r3CacheGet(k);
    if(cached){r3Tiles.set(k,cached);r3Schedule();}
    else{r3Wanted.add(k);r3Queue.push([tx+dx,ty+dy]);}
  }
  for(const k of [...r3Tiles.keys()]){
    const [x,y]=k.split(',').map(Number);
    if(Math.abs(x-tx)>2||Math.abs(y-ty)>2) r3Tiles.delete(k);
  }
  r3Pump();
  r3SetNarrow(r3Tiles.has(tx+','+ty));
  if(tx+','+ty!==r3LastCenter){r3LastCenter=tx+','+ty;r3Schedule();}
}
function r3Schedule(){if(r3RebuildT) return;r3RebuildT=setTimeout(r3Rebuild,300);}

/* ---------- Geometry helpers (local meters) ---------- */
function r3Local(flat){const p=[];for(let i=0;i<flat.length;i+=2)p.push(toLocal(flat[i],flat[i+1]));return p;}
function r3LL(p){const q=fromLocal(p[0],p[1]);return [Math.round(q[0]*1e7)/1e7,Math.round(q[1]*1e7)/1e7];}
function r3Rect(cx,cz,ux,uz,hu,vx,vz,hv){
  const P=(a,b)=>r3LL([cx+ux*hu*a+vx*hv*b,cz+uz*hu*a+vz*hv*b]);
  const r=[P(1,1),P(1,-1),P(-1,-1),P(-1,1)];r.push(r[0]);return [r];
}
function r3Circle(c,rad){const ring=[];for(let i=0;i<=10;i++){const t=i/10*Math.PI*2;ring.push(r3LL([c[0]+Math.cos(t)*rad,c[1]+Math.sin(t)*rad]));}return [ring];}
function r3Ribbon(pts,h){
  const polys=[];
  for(let i=0;i<pts.length-1;i++){
    const a=pts[i],b=pts[i+1],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);
    if(l<0.05) continue;
    polys.push(r3Rect((a[0]+b[0])/2,(a[1]+b[1])/2,dx/l,dz/l,l/2,-dz/l,dx/l,h));
  }
  for(let i=0;i<pts.length;i++){
    let need=i===0||i===pts.length-1;
    if(!need){
      const a=pts[i-1],b=pts[i],c=pts[i+1];
      const d1x=b[0]-a[0],d1z=b[1]-a[1],d2x=c[0]-b[0],d2z=c[1]-b[1];
      const l1=Math.hypot(d1x,d1z)||1,l2=Math.hypot(d2x,d2z)||1;
      need=(d1x*d2x+d1z*d2z)/(l1*l2)<0.99;
    }
    if(need) polys.push(r3Circle(pts[i],h));
  }
  return polys;
}
function r3DistToLine(pts,p){
  let best=1e9;
  for(let i=0;i<pts.length-1;i++){
    const a=pts[i],b=pts[i+1],dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz;
    if(l2<0.01) continue;
    const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/l2));
    const d=Math.hypot(a[0]+dx*t-p[0],a[1]+dz*t-p[1]);
    if(d<best) best=d;
  }
  return best;
}
/* Point at a given distance back from the last point of a polyline */
function r3Back(pts,dist){
  let acc=0;
  for(let i=pts.length-1;i>0;i--){
    const a=pts[i],b=pts[i-1],l=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(acc+l>=dist){const t=(dist-acc)/l;return {p:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],i:i};}
    acc+=l;
  }
  return null;
}
/* Straighten the end of a divided-road half that bends toward its twin before an intersection */
function r3Straighten(W,atEnd){
  const pts=atEnd?W.pts.slice():W.pts.slice().reverse();
  const n=pts.length;
  const P45=r3Back(pts,45);if(!P45) return false;
  const P90=r3Back(pts,90)||{p:pts[0],i:1};
  const dx=P45.p[0]-P90.p[0],dz=P45.p[1]-P90.p[1],dl=Math.hypot(dx,dz);
  if(dl<10) return false;
  const ux=dx/dl,uz=dz/dl;
  const dev=p=>ux*(p[1]-P45.p[1])-uz*(p[0]-P45.p[0]);
  const N=pts[n-1],latN=dev(N);
  if(Math.abs(latN)<1||Math.abs(latN)>12) return false;
  /* find where the bend starts: last vertex (walking toward the end) still on the straight line */
  let A=P45.p,iA=P45.i;
  for(let i=P45.i;i<n-1;i++){
    if(Math.abs(dev(pts[i]))>0.8) break;
    A=pts[i];iA=i+1;
  }
  const fwd=ux*(N[0]-A[0])+uz*(N[1]-A[1]);
  if(fwd<3) return false;
  const np=pts.slice(0,iA);
  if(!np.length||np[np.length-1]!==A) np.push(A);
  np.push([A[0]+ux*fwd,A[1]+uz*fwd]);
  W.pts=atEnd?np:np.reverse();
  return true;
}
function r3Nearest(ways,p,maxD){
  let best=null;
  for(const W of ways){
    const pts=W.pts;let s=0,mine=null;
    for(let i=0;i<pts.length-1;i++){
      const a=pts[i],b=pts[i+1],dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz;
      if(l2<0.01) continue;
      const l=Math.sqrt(l2),t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/l2));
      const qx=a[0]+dx*t,qz=a[1]+dz*t,d=Math.hypot(qx-p[0],qz-p[1]);
      if(d<maxD&&(!best||d<best.d)){best={W:W,d:d,qx:qx,qz:qz,tx:dx/l,tz:dz/l,s:s+t*l};mine=best;}
      s+=l;
    }
    if(mine) mine.L=s;
  }
  return best;
}

/* ---------- Build all shapes for the area around the map center ---------- */
let r3Straightened=0;
function r3Rebuild(){
  r3RebuildT=null;
  if(!r3Ready||!map.getSource('r3-area')) return;
  const c=map.getCenter(),tx=Math.floor(c.lng/R3T),ty=Math.floor(c.lat/R3T);
  const seen=new Set(),ways=[],nodes=[];
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
    const t=r3Tiles.get((tx+dx)+','+(ty+dy));if(!t) continue;
    for(const w of t.w){
      if(seen.has(w[0])) continue;seen.add(w[0]);
      ways.push({id:w[0],cls:w[1],ow:w[2],w:w[3],name:w[4],n0:w[5],n1:w[6],lanes:w[7],pts:r3Local(w[8])});
    }
    for(const nd of t.n) nodes.push(nd);
  }
  /* divided roads: a one-way half whose twin (same name) is within 30 m of its end */
  r3Straightened=0;
  const byName=new Map();
  for(const W of ways){if(W.ow&&W.name&&W.pts.length>1){if(!byName.has(W.name)) byName.set(W.name,[]);byName.get(W.name).push(W);}}
  for(const group of byName.values()){
    if(group.length<2) continue;
    for(const W of group){
      for(const atEnd of [false,true]){
        const N=atEnd?W.pts[W.pts.length-1]:W.pts[0];
        const twin=group.some(V=>V!==W&&r3DistToLine(V.pts,N)<30);
        if(twin&&r3Straighten(W,atEnd)) r3Straightened++;
      }
    }
  }
  const area=[],lines=[];
  for(const W of ways){
    if(W.pts.length<2) continue;
    const h=W.w/2;
    area.push({type:'Feature',properties:{k:'curb'},geometry:{type:'MultiPolygon',coordinates:r3Ribbon(W.pts,h+0.35)}});
    area.push({type:'Feature',properties:{k:'road'},geometry:{type:'MultiPolygon',coordinates:r3Ribbon(W.pts,h)}});
    const travel=W.ow===-1?W.pts.slice().reverse():W.pts;
    const ll=travel.map(r3LL);
    if(!W.ow&&(['primary','secondary','tertiary','trunk'].indexOf(W.cls)>=0||(W.lanes>=3&&W.cls!=='minor'))){
      lines.push({type:'Feature',properties:{k:'center'},geometry:{type:'LineString',coordinates:ll}});
    }
    if(W.ow){
      if(W.lanes>=2){
        for(let k=1;k<W.lanes;k++){
          lines.push({type:'Feature',properties:{k:'lane',off:(k-W.lanes/2)*(W.w/W.lanes)},geometry:{type:'LineString',coordinates:ll}});
        }
      }
      if(W.cls!=='motorway') lines.push({type:'Feature',properties:{k:'arrow'},geometry:{type:'LineString',coordinates:ll}});
    }
  }
  const paint=[];
  for(const nd of nodes){
    const p=toLocal(nd[0],nd[1]);
    if(nd[2]==='c'){
      const nb=r3Nearest(ways,p,5);if(!nb) continue;
      const h=nb.W.w/2,rx=-nb.tz,rz=nb.tx;
      for(let o=-h+0.35;o<=h-0.35;o+=1.0){
        paint.push(r3Rect(nb.qx+rx*o,nb.qz+rz*o,nb.tx,nb.tz,1.5,rx,rz,0.25));
      }
    }else{
      const nb=r3Nearest(ways,p,6);if(!nb) continue;
      const W=nb.W,h=W.w/2;
      const dsg=W.ow?(W.ow>0?1:-1):(nb.s>nb.L/2?1:-1);
      const fx=nb.tx*dsg,fz=nb.tz*dsg,rx=-fz,rz=fx;
      const toEnd=dsg>0?nb.L-nb.s:nb.s,back=toEnd<5?5-toEnd:0;
      const l0=W.ow?-h:0,l1=h,m=(l0+l1)/2,half=(l1-l0)/2-0.2;
      const cx=nb.qx-fx*back+rx*m,cz=nb.qz-fz*back+rz*m;
      paint.push(r3Rect(cx,cz,rx,rz,half,fx,fz,0.25));
    }
  }
  if(paint.length) area.push({type:'Feature',properties:{k:'paint'},geometry:{type:'MultiPolygon',coordinates:paint}});
  try{
    map.getSource('r3-area').setData({type:'FeatureCollection',features:area});
    map.getSource('r3-lines').setData({type:'FeatureCollection',features:lines});
    console.log('Roads built:',ways.length,'roads,',r3Straightened,'divided-road ends straightened');
  }catch(e){console.warn('roads rebuild',e);}
}

/* ---------- Layers ---------- */
function r3ArrowImage(){
  const cv=document.createElement('canvas');cv.width=64;cv.height=32;
  const x=cv.getContext('2d');
  x.fillStyle='rgba(255,255,255,0.95)';
  x.fillRect(6,13,34,6);
  x.beginPath();x.moveTo(36,4);x.lineTo(58,16);x.lineTo(36,28);x.closePath();x.fill();
  return x.getImageData(0,0,64,32);
}
function r3AddLayers(){
  if(map.getSource('r3-area')) return;
  const empty={type:'FeatureCollection',features:[]};
  map.addSource('r3-area',{type:'geojson',data:empty,tolerance:0.1});
  map.addSource('r3-lines',{type:'geojson',data:empty,tolerance:0.1});
  try{if(!map.hasImage('r3arrow')) map.addImage('r3arrow',r3ArrowImage());}catch(e){}
  const before=(map.getStyle().layers.find(l=>l.type==='symbol')||{}).id;
  map.addLayer({id:'r3-curb',type:'fill',source:'r3-area',minzoom:15,filter:['==',['get','k'],'curb'],paint:{'fill-color':ROAD_COLORS.curb}},before);
  map.addLayer({id:'r3-road',type:'fill',source:'r3-area',minzoom:15,filter:['==',['get','k'],'road'],paint:{'fill-color':ROAD_COLORS.road}},before);
  map.addLayer({id:'r3-paint',type:'fill',source:'r3-area',minzoom:16,filter:['==',['get','k'],'paint'],paint:{'fill-color':ROAD_COLORS.paint,'fill-opacity':0.92}},before);
  map.addLayer({id:'r3-center',type:'line',source:'r3-lines',minzoom:16,filter:['==',['get','k'],'center'],
    layout:{'line-join':'round'},paint:{'line-color':ROAD_COLORS.center,'line-width':roadPx(0.15)}},before);
  map.addLayer({id:'r3-lane',type:'line',source:'r3-lines',minzoom:17,filter:['==',['get','k'],'lane'],
    layout:{'line-join':'round'},paint:{'line-color':ROAD_COLORS.lane,'line-width':roadPx(0.12),'line-dasharray':[25,50],'line-offset':roadPxS(['get','off'])}},before);
  map.addLayer({id:'r3-arrow',type:'symbol',source:'r3-lines',minzoom:17,filter:['==',['get','k'],'arrow'],
    layout:{'symbol-placement':'line','symbol-spacing':180,'icon-image':'r3arrow',
      'icon-size':['interpolate',['exponential',2],['zoom'],17,0.3,22,2.6],
      'icon-rotation-alignment':'map','icon-pitch-alignment':'map','icon-allow-overlap':true,'icon-ignore-placement':true},
    paint:{'icon-opacity':0.85}},before);
}

/* ---------- Snapping, lamps and signs use the same widths ---------- */
if(typeof SNAP_W!=='undefined'){for(const k in ROAD_W2){SNAP_W[k]=ROAD_W2[k];}}
if(typeof localRoad==='function'){
  const baseLocalRoad=localRoad;
  localRoad=function(r){
    const o=baseLocalRoad(r);
    if(!o) return o;
    const w=roadWidthM(r.cls,r.oneway,false);
    o.W=w;o.spec=[o.spec[0],w,o.spec[2],o.spec[3]];
    return o;
  };
  if(typeof lDirtyAll!=='undefined') lDirtyAll=true;
  if(typeof sDirtyAll!=='undefined') sDirtyAll=true;
}

map.on('load',()=>{
  restyleRoads();
  try{r3AddLayers();}catch(e){console.warn('roads layers',e);}
  r3Ready=true;
  r3Want();
  map.on('moveend',r3Want);
  setInterval(r3Want,2500);
  setTimeout(restyleRoads,3000);
});
