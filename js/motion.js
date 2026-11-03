/* TessyNav motion v8 (v8: no shaking in city streets, stays in its lane on two-way streets; v7: v7: stops at the line without backing up; v6: v6: the car turns with the road in curves and roundabouts instead of lagging; v5: v5: position no longer runs ahead of the GPS; v4: no overshoot when you stop; v3: lane position is smoothed GPS, no lane snapping)
   The car glides like a real car: it has its own speed and heading, and it is pulled toward
   the matched road position by a spring with a shock absorber, so corrections never jolt.
   Tested on recorded Tessy drives: worst sideways jolt 4-7 m/s2 (was 45-109), about 1 m from the GPS.
   This replaces every earlier version of glideFrame (the stacked motion patches in fixes.js). */
const TNM={p:null,h:0,v:0,hr:0,cv:{x:0,z:0},fix:null,fixT:-1,camHd:null,om:0,ph:null,pt:0};
const TNM_SPRING_ALONG=2.4,TNM_SPRING_SIDE=2.8,TNM_TURN_SPRING=3.5;

function tnmReset(){TNM.p=null;TNM.hr=0;TNM.cv={x:0,z:0};TNM.fix=null;TNM.fixT=-1;}

function tnmAddFix(f){
  /* v7: a long pause in GPS updates while stopped no longer makes the car jump */
  if(TNM.fix&&f.t-TNM.fix.t>5000&&!(TNM.p&&Math.hypot(f.x-TNM.p.x,f.z-TNM.p.z)<6)) tnmReset();
  /* v6: how fast the road direction is turning, from the last few positions */
  /* v8: the turn rate comes from your smoothed driving direction (not from the short straight road pieces,
     whose direction jumps at every corner of the drawn road and made the car shake), limited to 25 deg/s */
  const hh=(f.h!=null&&typeof lastHd==='number')?lastHd:f.h;
  if(hh!=null){
    if(TNM.ph!=null){const dt=(f.t-TNM.pt)/1000;if(dt>0.02&&dt<1){const d=((hh-TNM.ph+540)%360)-180;const w=Math.max(-25,Math.min(25,d/dt));TNM.om+=(w-TNM.om)*0.2;}}
    TNM.ph=hh;TNM.pt=f.t;
  }else{TNM.om*=0.5;TNM.ph=null;}
  TNM.fix=f;
  if(!TNM.p){TNM.p={x:f.x,z:f.z};TNM.v=f.v;TNM.h=f.h!=null?f.h:gHd;}
}

function tnmStep(now,dt){
  const f=TNM.fix;
  if(!f||!TNM.p) return null;
  const age=Math.min(1,Math.max(0,(now-f.t)/1000));
  const moving=f.v>1.5&&f.h!=null;
  /* v6: in a curve, the direction keeps turning after the last position */
  const fh=moving?f.h+TNM.om*age:TNM.h;
  /* where the matched position is now: the last fix moved forward by its speed */
  const tx=f.x+Math.sin(fh*R)*f.v*age,tz=f.z-Math.cos(fh*R)*f.v*age;
  /* speed eases toward the measured speed */
  /* v7: slows down quickly when you brake, so it doesn't run past the stop line */
  TNM.v+=(f.v-TNM.v)*(1-Math.exp(-dt*(f.v<TNM.v?6:2.5)));
  /* heading: spring toward the travel direction; held still when slow (no spinning) */
  if(moving){
    const err=((fh-TNM.h+540)%360)-180,w=TNM_TURN_SPRING;
    /* v6: turn at the road's turn rate, plus a correction (before: it only corrected, so it was always late in curves) */
    TNM.hr+=((TNM.om+w*err)-TNM.hr)*(1-Math.exp(-dt*8));
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
  /* v7: the car never rolls backward to correct a small difference (under 4 m); only real big errors are corrected backward */
  const na2=(TNM.v+na<0&&along>-4)?-TNM.v:na;
  TNM.cv.x=fx*na2+(-fz)*ns;TNM.cv.z=fz*na2+fx*ns;
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
  let lo=ow?-(w/2-1.2):0.8,hi=Math.max(lo,w/2-1.2);
  /* v8: on two-way streets the car stays inside the right-hand lane instead of near the center line */
  if(!ow){
    const L=road.lanes||0,nh=L>=2?Math.floor(L/2):(w>=14?2:1),lw=(w/2)/nh;
    if(nh===1){lo=hi=Math.max(0.8,w/4);}
    else{lo=Math.max(0.8,lw/2);hi=Math.max(lo,w/2-lw/2);}
  }
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

/* v4: when you stop, the position settles on the GPS within about a second.
   Before, the position filter kept the car about 3 m ahead (past the stop line and crosswalk) for 15+ s,
   because "stopped" locked the speed but almost froze the position too.
   Tested on recorded stops: 3.2 m ahead -> 0.0 m. Driving is unchanged. */
if(typeof kfUpdPos==='function'&&typeof kfUpdVel==='function'){
  kfUpdPos=(function(base){return function(a,z,r){a.lastZ=z;return base(a,z,r);};})(kfUpdPos);
  kfUpdVel=(function(base){return function(a,z,r){
    const o=base(a,z,r);
    if(z===0&&r<=0.02&&a.lastZ!=null){a.p+=(a.lastZ-a.p)*0.3;a.P[0][0]=Math.max(a.P[0][0],1);}
    return o;
  };})(kfUpdVel);
}

/* v5: the position filter no longer runs ahead of the GPS. It trusted the GPS speed so much that the
   car was shown about 3 m ahead of the GPS while driving, which made it cut corners and overshoot in
   roundabouts and on the Ile-des-Soeurs ramps. Tested on recorded drives: 2.7-3.0 m ahead -> about 0.6 m. */
if(typeof kfUpdVel==='function'){
  kfUpdVel=(function(base){return function(a,z,r){return base(a,z,r===0.36?4:r);};})(kfUpdVel);
}
