/* TessyNav sun and moon: real positions, day/night lighting, moonlight, sky */
function astroDays(date){return date.getTime()/864e5-0.5+2440588-2451545;}
function sunCoords(d){
  const M=R*(357.5291+0.98560028*d);
  const Cc=R*(1.9148*Math.sin(M)+0.02*Math.sin(2*M)+0.0003*Math.sin(3*M));
  const L=M+Cc+R*102.9372+Math.PI,e=R*23.4397;
  return {dec:Math.asin(Math.sin(e)*Math.sin(L)),ra:Math.atan2(Math.sin(L)*Math.cos(e),Math.cos(L))};
}
function moonCoords(d){
  const L=R*(218.316+13.176396*d),M=R*(134.963+13.064993*d),F=R*(93.272+13.229350*d);
  const l=L+R*6.289*Math.sin(M),b=R*5.128*Math.sin(F),e=R*23.4397;
  return {ra:Math.atan2(Math.sin(l)*Math.cos(e)-Math.tan(b)*Math.sin(e),Math.cos(l)),
          dec:Math.asin(Math.sin(b)*Math.cos(e)+Math.cos(b)*Math.sin(e)*Math.sin(l)),
          dist:385001-20905*Math.cos(M)};
}
function horizonPos(c,d,lat,lng){
  const H=R*(280.16+360.9856235*d)+R*lng-c.ra,phi=R*lat;
  const alt=Math.asin(Math.sin(phi)*Math.sin(c.dec)+Math.cos(phi)*Math.cos(c.dec)*Math.cos(H));
  const az=Math.atan2(Math.sin(H),Math.cos(H)*Math.sin(phi)-Math.tan(c.dec)*Math.cos(phi))+Math.PI;
  return {alt:alt,az:az};
}
function sunPos(date,lat,lng){const d=astroDays(date);return horizonPos(sunCoords(d),d,lat,lng);}
function moonInfo(date,lat,lng){
  const d=astroDays(date),s=sunCoords(d),m=moonCoords(d),sd=149598000;
  const h=horizonPos(m,d,lat,lng);
  const phi=Math.acos(Math.min(1,Math.max(-1,Math.sin(s.dec)*Math.sin(m.dec)+Math.cos(s.dec)*Math.cos(m.dec)*Math.cos(s.ra-m.ra))));
  const inc=Math.atan2(sd*Math.sin(phi),m.dist-sd*Math.cos(phi));
  const ang=Math.atan2(Math.cos(s.dec)*Math.sin(s.ra-m.ra),Math.sin(s.dec)*Math.cos(m.dec)-Math.cos(s.dec)*Math.sin(m.dec)*Math.cos(s.ra-m.ra));
  return {alt:h.alt,az:h.az,fraction:(1+Math.cos(inc))/2,phase:0.5+0.5*inc*(ang<0?-1:1)/Math.PI};
}

const testHour=new URLSearchParams(location.search).get('hour');
function nowForSun(){
  const d=new Date();
  if(testHour!==null&&testHour!==''){const h=parseFloat(testHour);d.setHours(Math.floor(h),Math.round((h%1)*60),0,0);}
  return d;
}
const DAY_B=['#e3d5c1','#d9c7b0','#cfd3d6','#b9c3cc'],NIGHT_B=['#5a5f70','#555a6a','#4d5566','#46505f'];
let hemiLight=null,sunLight=null,shadowPlane=null,sunUp=false;
let sunNow=null,moonNow=null,nightNow=0;
const sunDir=new THREE.Vector3(-0.4,0.8,0.3).normalize();

function updateSun(){
  const c=map.getCenter(),now=nowForSun();
  const s=sunPos(now,c.lat,c.lng),mo=moonInfo(now,c.lat,c.lng);
  sunNow=s;moonNow=mo;
  const altDeg=s.alt/R,azDeg=(s.az/R+360)%360,mAlt=mo.alt/R,mAz=(mo.az/R+360)%360;
  const dirs=['N','NE','E','SE','S','SW','W','NW'],dn=a=>dirs[Math.round(a/45)%8];
  const tag=testHour?' (test '+testHour+'h)':'';
  const golden=altDeg>0&&altDeg<12;
  const night=Math.min(1,Math.max(0,(6-altDeg)/12));
  nightNow=night;
  const pct=Math.round(mo.fraction*100);
  const moonUp=mAlt>3&&altDeg<-2;
  const moonB=moonUp?mo.fraction*Math.min(1,Math.sin(mo.alt)*2.5):0;
  if(altDeg>0) sunEl.textContent='Sun: '+Math.round(altDeg)+'° high, '+dn(azDeg)+tag;
  else if(mAlt>0) sunEl.textContent='Moon: '+pct+'% full, '+Math.round(mAlt)+'° high, '+dn(mAz)+tag;
  else sunEl.textContent='Sun and moon are down ('+pct+'% moon)'+tag;
  const up=Math.max(0,Math.sin(s.alt));
  if(altDeg>0||!moonUp){
    const ce=Math.cos(s.alt);
    sunDir.set(ce*Math.sin(s.az),Math.max(0.05,Math.sin(s.alt)),-ce*Math.cos(s.az)).normalize();
    sunUp=altDeg>2;
  }else{
    const mc=Math.cos(mo.alt);
    sunDir.set(mc*Math.sin(mo.az),Math.max(0.05,Math.sin(mo.alt)),-mc*Math.cos(mo.az)).normalize();
    sunUp=mo.fraction>0.45&&mAlt>8;
  }
  if(sunLight&&hemiLight){
    if(altDeg>0){sunLight.intensity=1.2+2.6*Math.min(1,up*1.6);sunLight.color.set(golden?0xffc890:0xfff4e4);}
    else if(moonUp){sunLight.intensity=1.1*moonB;sunLight.color.set(0xa9bfff);}
    else sunLight.intensity=0;
    hemiLight.intensity=(altDeg>0?0.9+0.5*up:0.9)*(1-0.45*night)+0.15*moonB;
    hemiLight.color.set(night>0.5?0x9fb2dc:0xdfeeff);
  }
  if(shadowPlane) shadowPlane.material.opacity=altDeg>0?0.18+0.17*Math.min(1,up*2):0.14*moonB;
  try{
    if(map.getLayer('night-tint')) map.setPaintProperty('night-tint','fill-opacity',0.55*night*(1-0.3*moonB));
    if(map.getLayer('building-3d')) map.setPaintProperty('building-3d','fill-extrusion-color',
      ['interpolate',['linear'],['coalesce',['get','render_height'],8],
        0,mixHex(DAY_B[0],NIGHT_B[0],night),10,mixHex(DAY_B[1],NIGHT_B[1],night),
        20,mixHex(DAY_B[2],NIGHT_B[2],night),60,mixHex(DAY_B[3],NIGHT_B[3],night)]);
    if(map.getLayer('roofs')) map.setPaintProperty('roofs','fill-extrusion-color',mixHex('#9a958d','#3e4250',night));
    map.setLight(altDeg>0
      ?{anchor:'map',color:golden?'#ffd2a0':'#ffffff',intensity:0.35+0.3*up,position:[1.5,azDeg,Math.min(88,Math.max(10,90-altDeg))]}
      :{anchor:'map',color:'#b8c6e8',intensity:0.3,position:[1.15,210,30]});
  }catch(e){}
  updateSkyColors(night,golden);
  updateSkyObjects();
  map.triggerRepaint();
}

/* ---------- Sky colors ---------- */
function updateSkyColors(night,golden){
  const sky=mixHex('#6fa8e6','#08102a',night);
  const hor=mixHex(golden?'#f2b37a':'#cfe3f5','#1b2a4a',night);
  const fog=mixHex(golden?'#e8c3a0':'#dfe9f2','#1a2440',night);
  try{map.setSky({'sky-color':sky,'horizon-color':hor,'fog-color':fog,'sky-horizon-blend':0.6,'horizon-fog-blend':0.7,'fog-ground-blend':0.35});}catch(e){}
}

/* ---------- Moon, sun and stars in the sky ---------- */
let skyObj=null,moonTexPhase=-1;
function moonTexture(phase){
  const N=128,c=document.createElement('canvas');c.width=c.height=N;
  const x=c.getContext('2d'),img=x.createImageData(N,N);
  const t=Math.cos(2*Math.PI*phase),wax=phase<0.5;
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){
    const u=(i+0.5)/N*2-1,v=(j+0.5)/N*2-1,r2=u*u+v*v,o=(j*N+i)*4;
    if(r2>1){img.data[o+3]=0;continue;}
    const sh=Math.sqrt(1-v*v),xx=wax?u:-u;
    const litv=Math.min(1,Math.max(0,(xx-t*sh)*10+0.5));
    const crater=0.85+0.15*Math.sin(u*9.1+Math.cos(v*7.3)*2)*Math.cos(v*8.7-u*3.1);
    const b=(0.12+0.88*litv)*crater;
    img.data[o]=235*b;img.data[o+1]=232*b;img.data[o+2]=220*b;
    img.data[o+3]=255*Math.min(1,(1-r2)*12)*(0.25+0.75*litv);
  }
  x.putImageData(img,0,0);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}
function glowTexture(rgb,core){
  const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
  const g=x.createRadialGradient(64,64,0,64,64,64);
  g.addColorStop(0,'rgba('+rgb+',1)');g.addColorStop(core,'rgba('+rgb+',0.45)');g.addColorStop(1,'rgba('+rgb+',0)');
  x.fillStyle=g;x.fillRect(0,0,128,128);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}
function makeSkyObjects(){
  const disc=(tex,size,add)=>{
    const m=new THREE.Mesh(new THREE.PlaneGeometry(size,size),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,blending:add?THREE.AdditiveBlending:THREE.NormalBlending}));
    m.frustumCulled=false;m.visible=false;treeScene.add(m);return m;
  };
  const moonGlow=disc(glowTexture('170,190,255',0.2),180,true);
  const moon=disc(moonTexture(0.5),42,false);
  const sunGlow=disc(glowTexture('255,240,200',0.15),220,true);
  const sun=disc(glowTexture('255,252,240',0.5),55,true);
  const sp=[];
  for(let i=0;i<600;i++){
    const az=Math.random()*Math.PI*2,alt=Math.asin(0.08+Math.random()*0.92);
    sp.push(Math.cos(alt)*Math.sin(az)*850,Math.sin(alt)*850,-Math.cos(alt)*Math.cos(az)*850);
  }
  const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(sp,3));
  const stars=new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:2,sizeAttenuation:false,transparent:true,opacity:0,depthWrite:false}));
  stars.frustumCulled=false;stars.visible=false;treeScene.add(stars);
  return {moon:moon,moonGlow:moonGlow,sun:sun,sunGlow:sunGlow,stars:stars};
}
function updateSkyObjects(){
  if(typeof treeScene==='undefined'||!treeScene) return;
  if(!skyObj) skyObj=makeSkyObjects();
  const on=(typeof skyOn!=='undefined')&&skyOn;
  const c=map.getCenter(),[cx,cz]=toLocal(c.lng,c.lat),D=900;
  const place=(m,alt,az,dd)=>{const ce=Math.cos(alt);m.position.set(cx+ce*Math.sin(az)*dd,Math.sin(alt)*dd,cz-ce*Math.cos(az)*dd);m.lookAt(cx,0,cz);};
  if(moonNow){
    const vis=on&&moonNow.alt>0;
    skyObj.moon.visible=skyObj.moonGlow.visible=vis;
    if(Math.abs(moonNow.phase-moonTexPhase)>0.005){
      skyObj.moon.material.map.dispose();skyObj.moon.material.map=moonTexture(moonNow.phase);
      skyObj.moon.material.needsUpdate=true;moonTexPhase=moonNow.phase;
    }
    skyObj.moonGlow.material.opacity=(0.25+0.75*moonNow.fraction)*(0.3+0.7*nightNow);
    if(vis){place(skyObj.moon,moonNow.alt,moonNow.az,D);place(skyObj.moonGlow,moonNow.alt,moonNow.az,D+5);}
  }
  if(sunNow){
    const vis=on&&sunNow.alt>-0.02;
    skyObj.sun.visible=skyObj.sunGlow.visible=vis;
    if(vis){place(skyObj.sun,sunNow.alt,sunNow.az,D);place(skyObj.sunGlow,sunNow.alt,sunNow.az,D+5);}
  }
  skyObj.stars.visible=on&&nightNow>0.3;
  skyObj.stars.position.set(cx,0,cz);
  skyObj.stars.material.opacity=Math.max(0,(nightNow-0.3)/0.7)*0.9;
  map.triggerRepaint();
}
