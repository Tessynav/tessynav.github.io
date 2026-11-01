/* TessyNav roads v1: real-world road widths, curbs, sidewalks under roads, center and lane lines (Option A look) */
const ROAD_PPM15=512*Math.pow(2,15)/(40075016.686*Math.cos(45.5*Math.PI/180));
const ROAD_W2={motorway:11,trunk:10,primary:13,secondary:12,tertiary:11,minor:10,service:5.5,track:4,busway:7,raceway:8};
const ROAD_W1={motorway:11,trunk:10,primary:9,secondary:8.5,tertiary:8,minor:7,service:4.5,track:4,busway:4,raceway:8};
const ROAD_COLORS={road:'#c9cad1',curb:'#f2f2f4',sidewalk:'#e6e2da',center:'#e2b93b',lane:'#ffffff'};

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
        map.setPaintProperty(l.id,'line-width',roadMeters(0.7)===null?1:roadPx(roadMeters(0.7)));
        map.setPaintProperty(l.id,'line-color',ROAD_COLORS.curb);
      }else{
        if(!firstRoad) firstRoad=l.id;
        map.setPaintProperty(l.id,'line-width',roadPx(roadMeters(0)));
        map.setPaintProperty(l.id,'line-color',ROAD_COLORS.road);
      }
    }catch(e){console.warn('road style',l.id,e);}
  }
  /* sidewalks go under every road, so they can never cover the roadway */
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
        filter:['all',['in',['get','class'],['literal',['motorway','trunk','primary','secondary','tertiary']]],ONEWAY,notBridge],
        layout:{'line-cap':'butt','line-join':'round'},
        paint:{'line-color':ROAD_COLORS.lane,'line-width':roadPx(0.12),'line-dasharray':[25,50]}},firstSymbol);
    }
  }catch(e){console.warn('road markings',e);}
}

/* The road matching uses the same real widths, so Tessy's lane matches the drawn road */
if(typeof SNAP_W!=='undefined'){
  for(const k in ROAD_W2){SNAP_W[k]=ROAD_W2[k];}
}

map.on('load',()=>{
  restyleRoads();
  setTimeout(restyleRoads,3000);
});
