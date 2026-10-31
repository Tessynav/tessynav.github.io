/* TessyNav ground: grass, woods, sports fields, sidewalks */
function speckPattern(base,specks,size){
  const c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d');
  x.fillStyle=base;x.fillRect(0,0,size,size);
  for(const [col,n,w,h] of specks){x.fillStyle=col;for(let i=0;i<n;i++)x.fillRect(Math.random()*size,Math.random()*size,w,h);}
  return x.getImageData(0,0,size,size);
}
function stripePattern(a,b,size){
  const c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d');
  x.fillStyle=a;x.fillRect(0,0,size,size);x.fillStyle=b;x.fillRect(0,0,size/2,size);
  for(let i=0;i<250;i++){x.fillStyle='rgba(60,90,40,.12)';x.fillRect(Math.random()*size,Math.random()*size,1,2);}
  return x.getImageData(0,0,size,size);
}
function addTex(name,img){
  try{if(!map.hasImage(name)) map.addImage(name,img,{pixelRatio:2});}catch(e){console.warn('texture',name,e);}
}
function styleGround(){
  addTex('tn-grass',speckPattern('#8db466',[['#7aa556',1400,1,3],['#a3c77c',1000,1,2],['#6f9a4c',400,2,2],['#b2cf8a',150,1,1]],128));
  addTex('tn-wood',speckPattern('#5f8247',[['#4f7039',700,4,4],['#6f9354',600,3,3],['#45632f',250,6,5],['#7d9e5e',200,2,2]],128));
  addTex('tn-pitch',stripePattern('#97c472','#8bb866',64));
  const layers=map.getStyle().layers;
  for(const l of layers){ if(l.type==='background') map.setPaintProperty(l.id,'background-color','#ebeae3'); }
  const water=layers.find(l=>l['source-layer']==='water');
  const firstRoad=layers.find(l=>l['source-layer']==='transportation');
  const before=(water||firstRoad||{}).id;
  map.addLayer({id:'lawns',type:'fill',source:'openmaptiles','source-layer':'landuse',
    filter:['in',['get','class'],['literal',['residential','suburb','neighbourhood','quarter']]],
    paint:{'fill-color':'#dde5cc','fill-opacity':0.9,'fill-antialias':false}},before);
  map.addLayer({id:'grass-tex',type:'fill',source:'openmaptiles','source-layer':'landcover',
    filter:['in',['get','class'],['literal',['grass','farmland']]],paint:{'fill-pattern':'tn-grass','fill-antialias':false}},before);
  map.addLayer({id:'park-tex',type:'fill',source:'openmaptiles','source-layer':'park',
    paint:{'fill-pattern':'tn-grass','fill-antialias':false}},before);
  map.addLayer({id:'wood-tex',type:'fill',source:'openmaptiles','source-layer':'landcover',
    filter:['in',['get','class'],['literal',['wood','wetland']]],paint:{'fill-pattern':'tn-wood','fill-antialias':false}},before);
  map.addLayer({id:'sport-tex',type:'fill',source:'openmaptiles','source-layer':'landuse',
    filter:['in',['get','class'],['literal',['pitch','stadium','playground']]],paint:{'fill-pattern':'tn-pitch','fill-antialias':false}},before);
  map.addLayer({id:'sand-fill',type:'fill',source:'openmaptiles','source-layer':'landcover',
    filter:['==',['get','class'],'sand'],paint:{'fill-color':'#e8dab0','fill-antialias':false}},before);
  for(const l of layers){
    if(l.type==='line'&&l['source-layer']==='transportation'&&/path|pedestrian|footway/i.test(l.id)){
      try{map.setPaintProperty(l.id,'line-dasharray',null);}catch(e){}
      map.setPaintProperty(l.id,'line-color','#d6d2c8');
      map.setPaintProperty(l.id,'line-width',['interpolate',['exponential',2],['zoom'],15,1,20,18]);
    }
  }
}
