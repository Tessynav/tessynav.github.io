/* TessyNav roads v2: real-world road widths, curbs, sidewalks under roads, markings, and lamps/signs aligned to the same widths */
const ROAD_PPM15=512*Math.pow(2,15)/(40075016.686*Math.cos(45.5*Math.PI/180));
const ROAD_W2={motorway:11,trunk:10,primary:13,secondary:12,tertiary:11,minor:9.5,service:5.5,track:4,busway:7,raceway:8};
const ROAD_W1={motorway:10.5,trunk:9.5,primary:8,secondary:7.5,tertiary:6.5,minor:5.5,service:4,track:4,busway:4,raceway:8};
const ROAD_COLORS={road:'#c9cad1',curb:'#f2f2f4',sidewalk:'#e6e2da',center:'#e2b93b',lane:'#ffffff'};

/* Width in meters for a road, used by the drawing AND by lamps, signs and snapping */
function roadWidthM(cls,oneway,ramp){
  if(ramp) return 6;
  return oneway?(ROAD_W1[cls]||6):(ROAD_W2[cls]||8);
}

/* Pixels for a width in meters, exact at every zoom (512-pixel tiles) */
function roadPx(meters){
  return ['interpolate',['exponential',2],['zoom'],
    10,['max',0.5,['*',meters,ROAD_PPM15/32]],
    15,['*',meters,ROAD_PPM15],
    22,['*',meters,ROAD_PPM15*128]];
}
function roadMatch(table,fallback){
  const m=['match',['get','class']];
  for(const k in table){m.push(k,table[k]);}
  m.push(fallback);
  return m;
}
const ONEWAY=['!=',['coalesce',['get','oneway'],0],0];
function roadMeters(extra){
  return ['+',
    ['case',
      ['==',['coalesce',['get','ramp'],0],1],6,
      ONEWAY,roadMatch(ROAD_W1,6),
      roadMatch(ROAD_W2,8)],
    extra];
}

function restyleRoads(){
  const layers=map.getStyle().layers;
  let firstRoad=null;
  const paths=[];
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
        map.setPaintProperty(l.id,'line-width',roadPx(roadMeters(0.7)));
        map.setPaintProperty(l.id,'line-color',ROAD_COLORS.curb);
      }else{
        if(!firstRoad) firstRoad=l.id;
        map.setPaintProperty(l.id,'line-width',roadPx(roadMeters(0)));
        map.setPaintProperty(l.id,'line-color',ROAD_COLORS.road);
      }
    }catch(e){console.warn('road style',l.id,e);}
  }
  if(firstRoad){for(const id of paths){try{map.moveLayer(id,firstRoad);}catch(e){}}}
  addRoadMarkings();
}

function addRoadMarkings(){
  if(!map.getSource('openmaptiles')) return;
  const firstSymbol=(map.getStyle().layers.find(l=>l.type==='symbol')||{}).id;
  const notBridge=['!=',['coalesce',['get','brunnel'],''],'bridge'];
  try{
    if(!map.getLayer('center-yellow')){
      map.addLayer({id:'center-yellow',type:'line',source:'openmaptiles','source-layer':'transportation',minzoom:16,
        filter:['all',['in',['get','class'],['literal',['primary','secondary','tertiary']]],['!',ONEWAY],notBridge],
        layout:{'line-cap':'butt','line-join':'round'},
        paint:{'line-color':ROAD_COLORS.center,'line-width':roadPx(0.15)}},firstSymbol);
    }
    if(!map.getLayer('lane-dash')){
      map.addLayer({id:'lane-dash',type:'line',source:'openmaptiles','source-layer':'transportation',minzoom:17,
        filter:['all',['in',['get','class'],['literal',['motorway','trunk','primary','secondary']]],ONEWAY,notBridge],
        layout:{'line-cap':'butt','line-join':'round'},
        paint:{'line-color':ROAD_COLORS.lane,'line-width':roadPx(0.12),'line-dasharray':[25,50]}},firstSymbol);
    }
  }catch(e){console.warn('road markings',e);}
}

/* Snapping uses the same widths (two-way widths; one-way roads snap to their center) */
if(typeof SNAP_W!=='undefined'){
  for(const k in ROAD_W2){SNAP_W[k]=ROAD_W2[k];}
}

/* Lamps, traffic lights and stop signs stand just outside the drawn road */
if(typeof localRoad==='function'){
  const baseLocalRoad=localRoad;
  localRoad=function(r){
    const o=baseLocalRoad(r);
    if(!o) return o;
    const w=roadWidthM(r.cls,r.oneway,false);
    o.W=w;
    o.spec=[o.spec[0],w,o.spec[2],o.spec[3]];
    return o;
  };
  if(typeof lDirtyAll!=='undefined') lDirtyAll=true;
  if(typeof sDirtyAll!=='undefined') sDirtyAll=true;
}

map.on('load',()=>{
  restyleRoads();
  setTimeout(restyleRoads,3000);
});
