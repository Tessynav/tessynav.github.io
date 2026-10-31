/* TessyNav core v3: shared tools, map setup, settings, exact map-matching coordinates */
const R=Math.PI/180;
function dist(a,b){const dLat=(b[1]-a[1])*R,dLng=(b[0]-a[0])*R;const h=Math.sin(dLat/2)**2+Math.cos(a[1]*R)*Math.cos(b[1]*R)*Math.sin(dLng/2)**2;return 12742000*Math.asin(Math.sqrt(h));}
function bearing(a,b){const y=Math.sin((b[0]-a[0])*R)*Math.cos(b[1]*R);const x=Math.cos(a[1]*R)*Math.sin(b[1]*R)-Math.sin(a[1]*R)*Math.cos(b[1]*R)*Math.cos((b[0]-a[0])*R);return (Math.atan2(y,x)/R+360)%360;}
function cacheGet(k){try{const v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch(e){return null;}}
function cacheSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function mixHex(a,b,t){
  const pa=[1,3,5].map(i=>parseInt(a.substr(i,2),16)),pb=[1,3,5].map(i=>parseInt(b.substr(i,2),16));
  return '#'+pa.map((v,i)=>Math.round(v+(pb[i]-v)*t).toString(16).padStart(2,'0')).join('');
}

const ORIGIN=[-73.568,45.459];
const startPos=cacheGet('lastPos')||ORIGIN;

/* Local meters use the exact same projection as the map, so 3D objects line up everywhere */
function mercX(lng){return (180+lng)/360;}
function mercY(lat){return (180-(180/Math.PI)*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360)))/360;}
const OMX=mercX(ORIGIN[0]),OMY=mercY(ORIGIN[1]);
const OMS=maplibregl.MercatorCoordinate.fromLngLat(ORIGIN,0).meterInMercatorCoordinateUnits();
function toLocal(lng,lat){return [(mercX(lng)-OMX)/OMS,(mercY(lat)-OMY)/OMS];}
function fromLocal(x,z){
  const mx=OMX+x*OMS,my=OMY+z*OMS;
  return [mx*360-180,360/Math.PI*Math.atan(Math.exp((180-my*360)*Math.PI/180))-90];
}

const map=new maplibregl.Map({container:'map',style:'https://tiles.openfreemap.org/styles/liberty',center:startPos,zoom:17,pitch:60,maxPitch:85,
  attributionControl:{customAttribution:'Arbres : Ville de Montréal (CC BY 4.0)'}});

const treesEl=document.getElementById('trees'),sunEl=document.getElementById('sun'),shBtn=document.getElementById('shbtn');
const status=document.getElementById('status'),speedEl=document.getElementById('speed'),btn=document.getElementById('btn');

/* Shadows setting */
let shadowsOn=cacheGet('shadows')!==false;
function showShadowBtn(){shBtn.textContent='Shadows: '+(shadowsOn?'On':'Off');}
showShadowBtn();
shBtn.onclick=()=>{shadowsOn=!shadowsOn;cacheSet('shadows',shadowsOn);showShadowBtn();map.triggerRepaint();};
