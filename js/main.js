/* TessyNav main: roads, buildings, map setup, driving view, sky button */
function roadWidth(z13,z20){
  const m=v=>['match',['get','class'],['motorway','trunk','primary'],v[0],['secondary','tertiary'],v[1],'minor',v[2],v[3]];
  return ['interpolate',['exponential',2],['zoom'],13,m(z13),20,m(z20)];
}

/* Sky setting */
let skyOn=cacheGet('sky')===true;
const skyBtn=document.getElementById('skybtn');
function showSkyBtn(){skyBtn.textContent='Sky: '+(skyOn?'On':'Off');}
showSkyBtn();

map.on('load',()=>{
  for(const l of map.getStyle().layers){
    if(l.type==='symbol'&&/poi|transit|parking/i.test(l.id)) map.setLayoutProperty(l.id,'visibility','none');
  }
  try{styleGround();}catch(e){console.warn('ground style',e);}
  if(!map.getLayer('building-3d')){
    map.addLayer({id:'building-3d',type:'fill-extrusion',source:'openmaptiles','source-layer':'building',
      paint:{'fill-extrusion-height':['coalesce',['get','render_height'],8],
      'fill-extrusion-base':['coalesce',['get','render_min_height'],0]}});
  }
  for(const l of map.getStyle().layers){
    if(l.type!=='line'||l['source-layer']!=='transportation') continue;
    if(/rail|path|ferry|aerialway|pier|pedestrian|footway/i.test(l.id)) continue;
    if(/casing/i.test(l.id)){
      map.setPaintProperty(l.id,'line-color','#b9b4aa');
      map.setPaintProperty(l.id,'line-width',roadWidth([3,2.5,1.5,0.8],[136,104,82,44]));
    }else{
      map.setPaintProperty(l.id,'line-color','#4b4f56');
      map.setPaintProperty(l.id,'line-width',roadWidth([2,1.5,1,0.5],[120,90,70,35]));
    }
  }
  map.addLayer({id:'lane-lines',type:'line',source:'openmaptiles','source-layer':'transportation',minzoom:16,
    filter:['in',['get','class'],['literal',['motorway','trunk','primary','secondary','tertiary','minor']]],
    paint:{'line-color':['match',['get','class'],['motorway','trunk','primary'],'#e2b21f','#f2f2ee'],
      'line-width':['interpolate',['exponential',2],['zoom'],16,0.6,19,2],
      'line-dasharray':[4,4]}},'building-3d');
  map.addSource('night-area',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]]]}}});
  map.addLayer({id:'night-tint',type:'fill',source:'night-area',paint:{'fill-color':'#0b1630','fill-opacity':0,'fill-antialias':false}},'building-3d');
  map.setPaintProperty('building-3d','fill-extrusion-opacity',1);
  map.addLayer({id:'roofs',type:'fill-extrusion',source:'openmaptiles','source-layer':'building',
    paint:{'fill-extrusion-color':'#9a958d',
      'fill-extrusion-base':['coalesce',['get','render_height'],8],
      'fill-extrusion-height':['+',['coalesce',['get','render_height'],8],0.4]}});
  map.addLayer(treeLayer);
  updateTrees();
  updateSun();
  setInterval(updateSun,60000);
  if(skyOn) map.easeTo({pitch:80,duration:0});
  map.on('move',()=>updateSkyObjects());
  map.on('moveend',()=>{const c=map.getCenter();if(map.getZoom()>=15)loadAround(c.lng,c.lat);updateTrees();});
  map.on('idle',parkTrees);
});

/* Driving view */
const el=document.createElement('div');
el.innerHTML='<svg viewBox="0 0 34 34" width="52" height="52"><path d="M17 3 L29 30 L17 23 L5 30 Z" fill="#3fd1b0" stroke="#fff" stroke-width="2"/></svg>';
const car=new maplibregl.Marker({element:el,rotationAlignment:'map',pitchAlignment:'map'}).setLngLat(startPos).addTo(map);
let follow=false,last=null,heading=0,watchId=null,lastTile='';
function view(pos,ms){map.easeTo({center:pos,zoom:skyOn?17.6:18,pitch:skyOn?80:65,bearing:heading,duration:ms,offset:[0,skyOn?260:150]});}
function onPos(p){
  const pos=[p.coords.longitude,p.coords.latitude];
  if(p.coords.heading!=null&&!isNaN(p.coords.heading)&&(p.coords.speed||0)>1) heading=p.coords.heading;
  else if(last&&dist(last,pos)>4) heading=bearing(last,pos);
  if(!last||dist(last,pos)>4) last=pos;
  car.setLngLat(pos).setRotation(heading);
  speedEl.innerHTML=Math.round((p.coords.speed||0)*3.6)+' <small>km/h</small>';
  status.textContent='GPS accuracy: '+Math.round(p.coords.accuracy)+' m';
  if(p.coords.accuracy<100){
    cacheSet('lastPos',[+pos[0].toFixed(5),+pos[1].toFixed(5)]);
    const t=Math.floor(pos[0]/OT)+','+Math.floor(pos[1]/OT);
    if(t!==lastTile){lastTile=t;loadAround(pos[0],pos[1]);}
  }
  if(follow) view(pos,1000);
}
btn.onclick=()=>{
  follow=true;btn.textContent='Recenter';
  if(watchId===null){watchId=navigator.geolocation.watchPosition(onPos,()=>{status.textContent='Location not available';},{enableHighAccuracy:true,maximumAge:0,timeout:15000});}
  else if(last) view(last,800);
};
skyBtn.onclick=()=>{
  skyOn=!skyOn;cacheSet('sky',skyOn);showSkyBtn();
  if(follow&&last) view(last,800);
  else map.easeTo({pitch:skyOn?80:60,duration:800});
  updateSkyObjects();
};
map.on('dragstart',()=>{follow=false;});
