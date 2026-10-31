/* TessyNav sun: real sun position and day/night lighting */
function sunPos(date,lat,lng){
  const d=date.getTime()/864e5-0.5+2440588-2451545;
  const M=R*(357.5291+0.98560028*d);
  const Cc=R*(1.9148*Math.sin(M)+0.02*Math.sin(2*M)+0.0003*Math.sin(3*M));
  const L=M+Cc+R*102.9372+Math.PI;
  const e=R*23.4397;
  const dec=Math.asin(Math.sin(e)*Math.sin(L));
  const ra=Math.atan2(Math.sin(L)*Math.cos(e),Math.cos(L));
  const H=R*(280.16+360.9856235*d)+R*lng-ra;
  const phi=R*lat;
  const alt=Math.asin(Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos(H));
  const az=Math.atan2(Math.sin(H),Math.cos(H)*Math.sin(phi)-Math.tan(dec)*Math.cos(phi))+Math.PI;
  return {alt:alt,az:az};
}
const testHour=new URLSearchParams(location.search).get('hour');
function nowForSun(){
  const d=new Date();
  if(testHour!==null&&testHour!==''){const h=parseFloat(testHour);d.setHours(Math.floor(h),Math.round((h%1)*60),0,0);}
  return d;
}
const DAY_B=['#e3d5c1','#d9c7b0','#cfd3d6','#b9c3cc'],NIGHT_B=['#5a5f70','#555a6a','#4d5566','#46505f'];
let hemiLight=null,sunLight=null,shadowPlane=null,sunUp=false;
const sunDir=new THREE.Vector3(-0.4,0.8,0.3).normalize();

function updateSun(){
  const c=map.getCenter();
  const s=sunPos(nowForSun(),c.lat,c.lng);
  const altDeg=s.alt/R,azDeg=(s.az/R+360)%360;
  const dirs=['N','NE','E','SE','S','SW','W','NW'];
  sunEl.textContent=altDeg>0?('Sun: '+Math.round(altDeg)+'° high, '+dirs[Math.round(azDeg/45)%8]+(testHour?' (test '+testHour+'h)':''))
                            :('Sun is down'+(testHour?' (test '+testHour+'h)':''));
  sunUp=altDeg>2;
  const golden=altDeg>0&&altDeg<12;
  const night=Math.min(1,Math.max(0,(6-altDeg)/12));
  const up=Math.max(0,Math.sin(s.alt)),ce=Math.cos(s.alt);
  sunDir.set(ce*Math.sin(s.az),Math.max(0.05,Math.sin(s.alt)),-ce*Math.cos(s.az)).normalize();
  if(sunLight&&hemiLight){
    sunLight.intensity=altDeg>0?1.2+2.6*Math.min(1,up*1.6):0;
    sunLight.color.set(golden?0xffc890:0xfff4e4);
    hemiLight.intensity=(altDeg>0?0.9+0.5*up:0.9)*(1-0.45*night);
    hemiLight.color.set(night>0.5?0x9fb2dc:0xdfeeff);
  }
  if(shadowPlane) shadowPlane.material.opacity=0.18+0.17*Math.min(1,up*2);
  try{
    if(map.getLayer('night-tint')) map.setPaintProperty('night-tint','fill-opacity',0.55*night);
    if(map.getLayer('building-3d')) map.setPaintProperty('building-3d','fill-extrusion-color',
      ['interpolate',['linear'],['coalesce',['get','render_height'],8],
        0,mixHex(DAY_B[0],NIGHT_B[0],night),10,mixHex(DAY_B[1],NIGHT_B[1],night),
        20,mixHex(DAY_B[2],NIGHT_B[2],night),60,mixHex(DAY_B[3],NIGHT_B[3],night)]);
    if(map.getLayer('roofs')) map.setPaintProperty('roofs','fill-extrusion-color',mixHex('#9a958d','#3e4250',night));
    map.setLight(altDeg>0
      ?{anchor:'map',color:golden?'#ffd2a0':'#ffffff',intensity:0.35+0.3*up,position:[1.5,azDeg,Math.min(88,Math.max(10,90-altDeg))]}
      :{anchor:'map',color:'#b8c6e8',intensity:0.3,position:[1.15,210,30]});
  }catch(e){}
  map.triggerRepaint();
}
