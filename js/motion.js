/* TessyNav motion v3 (lane position: smoothed GPS, no lane snapping)
   The car glides like a real car: it has its own speed and heading, and it is pulled toward
   the matched road position by a spring with a shock absorber, so corrections never jolt.
   Tested on recorded Tessy drives: worst sideways jolt 4-7 m/s2 (was 45-109), about 1 m from the GPS.
   This replaces every earlier version of glideFrame (the stacked motion patches in fixes.js). */
const TNM={p:null,h:0,v:0,hr:0,cv:{x:0,z:0},fix:null,fixT:-1,camHd:null};
const TNM_SPRING_ALONG=2.4,TNM_SPRING_SIDE=2.8,TNM_TURN_SPRING=3.5;

function tnmReset(){TNM.p=null;TNM.hr=0;TNM.cv={x:0,z:0};TNM.fix=null;TNM.fixT=-1;}

function tnmAddFix(f){
  if(TNM.fix&&f.t-TNM.fix.t>5000) tnmReset();
  TNM.fix=f;
  if(!TNM.p){TNM.p={x:f.x,z:f.z};TNM.v=f.v;TNM.h=f.h!=null?f.h:gHd;}
}

function tnmStep(now,dt){
  const f=TNM.fix;
  if(!f||!TNM.p) return null;
  const age=Math.min(1,Math.max(0,(now-f.t)/1000));
  const moving=f.v>1.5&&f.h!=null;
  const fh=moving?f.h:TNM.h;
  /* where the matched position is now: the last fix moved forward by its speed */
  const tx=f.x+Math.sin(fh*R)*f.v*age,tz=f.z-Math.cos(fh*R)*f.v*age;
  /* speed eases toward the measured speed */
  TNM.v+=(f.v-TNM.v)*(1-Math.exp(-dt*2.5));
  /* heading: spring toward the travel direction; held still when slow (no spinning) */
  if(moving){
    const err=((fh-TNM.h+540)%360)-180,w=TNM_TURN_SPRING;
    TNM.hr+=(w*w*err-2*w*TNM.hr)*dt;
    TNM.hr=Math.max(-80,Math.min(80,TNM.hr));
  }else TNM.hr*=Math.exp(-dt*6);
  TNM.h=(TNM.h+TNM.hr*dt+360)%360;
  const fx=Math.sin(TNM.h*R),fz=-Math.cos(TNM.h*R);
  const ex=tx-TNM.p.x,ez=tz-TNM.p.z;
  if(Math.hypot(ex,ez)>25){TNM.p={x:tx,z:tz};TNM.cv={x:0,z:0};return {x:tx,z:tz,h:TNM.h};}
  /* spring + shock absorber on the correction, along and across the direction of travel */
  const along=ex*fx+ez*fz,side=ex*(-fz)+ez*fx;
  const ca=TNM.cv.x*fx+TNM.cv.z*fz,cs=TNM.cv.x*(-fz)+TNM.cv.z*fx;
  const wa=TNM_SPRING_ALONG,ws=TNM_SPRING_SIDE;
  const na=ca+(wa*wa*along-2*wa*ca)*dt,ns=cs+(ws*ws*side-2*ws*cs)*dt;
  TNM.cv.x=fx*na+(-fz)*ns;TNM.cv.z=fz*na+fx*ns;
  TNM.p.x+=(fx*TNM.v+TNM.cv.x)*dt;
  TNM.p.z+=(fz*TNM.v+TNM.cv.z)*dt;
  return {x:TNM.p.x,z:TNM.p.z,h:TNM.h};
}

glideFrame=function(){
  requestAnimationFrame(glideFrame);
  const now=performance.now(),dt=Math.min(0.1,lastFrameT?(now-lastFrameT)/1000:0.016);
  lastFrameT=now;
  if(!pts.length){tnmReset();return;}
  if(watchId===null) return;
  /* newest matched position from the road matching (snapped to the lane when on a road) */
  const last=pts[pts.length-1];
  if(last.t!==TNM.fixT){
    TNM.fixT=last.t;
    const v=Math.hypot(last.vx,last.vz);
    tnmAddFix({t:last.t,x:last.x,z:last.z,v:v,h:v>1.5?(Math.atan2(last.vx,-last.vz)/R+360)%360:null});
  }
  const s=tnmStep(now,dt);
  if(!s) return;
  gHd=s.h;
  /* front wheels steer with the actual turn rate */
  const curv=TNM.v>1?(TNM.hr*R)/TNM.v:0;
  const wantSteer=Math.max(-0.5,Math.min(0.5,Math.atan(WHEELBASE*curv)));
  steerNow+=(wantSteer-steerNow)*Math.min(1,dt*5);
  gPos=fromLocal(s.x,s.z);
  car.setLngLat(gPos).setRotation(gHd);
  updateCar3D(s.x,s.z,gHd,steerNow);
  map.triggerRepaint();
  /* calm camera: the map rotates smoothly behind the car */
  if(TNM.camHd===null) TNM.camHd=gHd;
  const cd=((gHd-TNM.camHd+540)%360)-180;
  TNM.camHd=(TNM.camHd+cd*Math.min(1,dt*1.6)+360)%360;
  if(!follow||now-lastUserZoom<500||now-lastTouch<300) return;
  const cs=camSpec();
  gZoom+=(cs.zoom+userZoomDelta-gZoom)*0.04;
  gPitch+=(cs.pitch-gPitch)*0.06;
  const H=map.getContainer().clientHeight||800;
  map.jumpTo({center:gPos,bearing:TNM.camHd,zoom:gZoom,pitch:gPitch,
    padding:{top:Math.round(H*cs.pad),bottom:0,left:0,right:0}});
};

/* replay jumps (+/- 30 s) start the motion fresh */
if(typeof rpSeek==='function'){
  rpSeek=(function(base){return function(t){tnmReset();TNM.camHd=null;return base(t);};})(rpSeek);
}

/* Lane placement v2: trust where the GPS puts you across the road, kept inside the road.
   Lane centering only nudges you (60%) when the street's real lanes are known. */
/* Lane position: trust the GPS across the road, smoothed over about 2 s and kept inside the road.
   v3: no more snapping to lane centers. GPS wobbles 1-2 m sideways, and the snapping made the car
   jump a whole lane near lane lines. A real lane change (3-5 s) still shows; GPS wobble doesn't.
   The smoothing follows the shown position across road pieces, so a new piece never causes a jump. */
const TNL={x:0,z:0,t:-1e9};
const TNL_TAU=2.0;
function laneOffset(road,x,z){
  let w=road.w,ow=road.oneway;
  if(!w){
    const info=(typeof r3InfoAt==='function')?r3InfoAt(road.qx,road.qz,road.tx,road.tz):null;
    w=info?info.w:roadWidthM(road.cls,road.oneway,false);
    if(info) ow=info.ow;
  }
  const nx=-road.tz,nz=road.tx;
  const lo=ow?-(w/2-1.2):0.8,hi=Math.max(lo,w/2-1.2);
  const clamp=v=>Math.max(lo,Math.min(hi,v));
  const target=clamp((x-road.qx)*nx+(z-road.qz)*nz);
  const now=performance.now(),dt=(now-TNL.t)/1000;
  let lane=target;
  if(dt>0&&dt<3){
    /* where the car was last shown, measured across this road */
    const prev=clamp((TNL.x-road.qx)*nx+(TNL.z-road.qz)*nz);
    lane=prev+(target-prev)*(1-Math.exp(-dt/TNL_TAU));
  }
  TNL.x=road.qx+nx*lane;TNL.z=road.qz+nz*lane;TNL.t=now;
  return lane;
}
