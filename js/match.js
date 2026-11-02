/* TessyNav match v2 (v2: roads pointing another way, like ramps beside the highway, count as farther away)
   TessyNav match v1
   The car now follows the SAME roads that are drawn on screen (the OpenStreetMap roads from roads.js),
   instead of the map-tile roads, whose shape is different. That was why the car drove on the grass
   beside the A-10 and the Champlain Bridge approach.
   - Drawn roads first. Map-tile roads only where drawn roads are missing: bridges and tunnels
     (drawn by bridges.js), or when the road data has not loaded yet ("Roads 0").
   - Highway exits: the car stays on the highway only while the GPS is still on the highway's
     pavement, so it follows you onto the exit instead of staying behind and jumping.
   - Replaces the whole stack of matchRoad versions in perf.js and fixes.js (v7, v18, v25, v26, v30, v32).
   - Recordings: each shown-car row gets the road source at the end ('r3' drawn roads, 't' map tiles). */

const TNR={lastFull:0,hd:[],src:''};
const TNR_EVERY=400;        /* full matching at most every 0.4 s; in between, slide along the road */
const TNR_MAXD=14;          /* look for roads up to 14 m from the GPS */

/* Candidates from the drawn roads (local meters, cached per tile by r3LocalWays) */
function tnrDrawn(x,z,fx,fz){
  let best=null,cont=null,n=0;
  if(typeof r3LocalWays!=='function') return {best:best,cont:cont,n:0};
  for(const arr of r3LocalWays()){
    for(const W of arr){
      if(!SNAP_W[W.cls]) continue;
      if(x<W.bb[0]||x>W.bb[1]||z<W.bb[2]||z>W.bb[3]) continue;
      const P=W.pts,ow=W.ow||0,hw=Math.max(1.5,(W.w||roadWidthM(W.cls,ow,false))/2);
      for(let i=0;i<P.length-1;i++){
        const a=P[i],b=P[i+1],dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz;
        if(l2<0.01) continue;
        const l=Math.sqrt(l2),traw=((x-a[0])*dx+(z-a[1])*dz)/l2;
        if(traw<0&&-traw*l>1.5) continue;
        if(traw>1&&(traw-1)*l>1.5) continue;
        const t=Math.max(0,Math.min(1,traw));
        const qx=a[0]+dx*t,qz=a[1]+dz*t,d=Math.hypot(qx-x,qz-z);
        if(d>TNR_MAXD) continue;
        let tx=dx/l,tz=dz/l;
        const align=tx*fx+tz*fz;
        if(Math.abs(align)<SNAP_ALIGN) continue;
        if((ow===1&&align<0)||(ow===-1&&align>0)) continue;
        if(align<0){tx=-tx;tz=-tz;}
        n++;
        const c={d:d,de:Math.max(0,d-(hw-1)),qx:qx,qz:qz,tx:tx,tz:tz,lane:ow?0:hw/2,
          cls:W.cls,oneway:ow,bridge:false,w:hw*2,src:'r3'};
        c.sc=c.de+tnrTurnCost(Math.abs(align));
        if(!best||c.sc<best.sc||(c.sc===best.sc&&d<best.d)) best=c;
        if(curRoad){
          const ang=curRoad.tx*tx+curRoad.tz*tz;
          const off=Math.abs((qx-curRoad.qx)*curRoad.tz-(qz-curRoad.qz)*curRoad.tx);
          if(ang>0.9&&off<3&&(!cont||c.sc<cont.sc||(c.sc===cont.sc&&d<cont.d))) cont=c;
        }
      }
    }
  }
  return {best:best,cont:cont,n:n};
}

/* Candidates from the map tiles (what the app used before); only for bridges, tunnels, missing data */
function tnrTiles(ll,x,z,fx,fz){
  let c=findCandidates(renderedRoads(ll),ll[0],ll[1],x,z,fx,fz);
  if(!c.best) c=findCandidates(sourceRoads(),ll[0],ll[1],x,z,fx,fz);
  for(const k of ['best','cont']){
    const r=c[k];
    if(r&&!r.src){r.src='t';r.w=roadWidthM(r.cls,r.oneway,false);r.sc=r.de+tnrTurnCost(Math.abs(r.tx*fx+r.tz*fz));}
  }
  return c;
}

/* Stay on the current road unless another one is clearly better (edge distance, two votes) */
function tnrPick(c){
  const best=c.best,cont=c.cont;
  if(cont&&best&&best!==cont){
    if(cont.sc>1.5&&best.sc<cont.sc-2){
      if(cont.sc>4){switchVotes=0;return {pick:best,why:'switch-now'};}
      switchVotes++;
      if(switchVotes>=2){switchVotes=0;return {pick:best,why:'switch-voted'};}
      return {pick:cont,why:'stay-voting'};
    }
    switchVotes=0;return {pick:cont,why:'stay'};
  }
  if(cont){switchVotes=0;return {pick:cont,why:'stay'};}
  if(best) return {pick:best,why:'new'};
  return {pick:null,why:'none'};
}

/* roads pointing a different way than you are driving count as farther away:
   4 degrees free, then 0.25 m per degree (a ramp splitting off at 12 degrees counts 2 m farther) */
function tnrTurnCost(cosA){
  const ang=Math.acos(Math.min(1,cosA))/R;
  return Math.max(0,ang-4)*0.25;
}

/* how far the GPS is from a road's center line, and the road's half width */
function tnrLat(r,x,z){return Math.abs((x-r.qx)*(-r.tz)+(z-r.qz)*r.tx);}
function tnrHalf(r){return (r.w||roadWidthM(r.cls,r.oneway,false))/2;}

function tnrMatch(x,z,spd,now){
  /* turning, measured over about 1 s */
  if(lastHd!==null){
    TNR.hd.push([now,lastHd]);
    while(TNR.hd.length&&now-TNR.hd[0][0]>1200) TNR.hd.shift();
    if(TNR.hd.length>1&&now-TNR.hd[0][0]>600){
      const dh=Math.abs(((lastHd-TNR.hd[0][1]+540)%360)-180);
      turning=spd>1.5&&dh/((now-TNR.hd[0][0])/1000)>TURN_RATE;
    }
  }
  if(spd<1.0){
    if(curRoad){
      const s=onCurRoad(x,z);
      if(Math.hypot(s[0]-x,s[1]-z)<=SNAP_MAX+4){lastMatchInfo={why:'slow-onroad',src:TNR.src};return {x:s[0],z:s[1],tx:curRoad.tx,tz:curRoad.tz};}
    }
    lastMatchInfo={why:'slow',src:''};
    return null;
  }
  if(lastHd===null){lastMatchInfo={why:'no-heading',src:''};return null;}
  if(turning){curRoad=null;switchVotes=0;TNR.src='';lastMatchInfo={why:'turning',src:''};return null;}

  /* between full matches: slide along the current road, same lane */
  if(curRoad&&now-TNR.lastFull<TNR_EVERY&&tnrLat(curRoad,x,z)<=tnrHalf(curRoad)+0.5){
    const s=onCurRoad(x,z);
    if(Math.hypot(s[0]-x,s[1]-z)<=SNAP_MAX+4){lastMatchInfo={why:'between',src:TNR.src};return {x:s[0],z:s[1],tx:curRoad.tx,tz:curRoad.tz};}
  }
  TNR.lastFull=now;

  const fx=Math.sin(lastHd*R),fz=-Math.cos(lastHd*R),ll=fromLocal(x,z);
  const prev=curRoad;
  let c=null,tiles=null;
  /* on a bridge: keep following it from the map tiles (bridges are not part of the drawn roads) */
  if(prev&&prev.bridge){
    tiles=tnrTiles(ll,x,z,fx,fz);
    if(tiles.cont&&tiles.cont.bridge) c=tiles;
  }
  if(!c){
    const r=tnrDrawn(x,z,fx,fz);
    if(r.best){
      c=r;
      /* driving onto a bridge: the road under it may be close, so a bridge that fits better wins */
      if(r.best.de>1){
        tiles=tiles||tnrTiles(ll,x,z,fx,fz);
        if(tiles.best&&tiles.best.bridge&&tiles.best.de<r.best.de) c=tiles;
      }
    }
  }
  if(!c) c=tiles||tnrTiles(ll,x,z,fx,fz);

  const info={why:'',src:'',n:c.n,best:segInfo(c.best),cont:segInfo(c.cont),pick:null};
  lastMatchInfo=info;
  let {pick,why}=tnrPick(c);

  /* highway exits: stay on the highway only while the GPS is still on its pavement,
     and take the exit right away once the GPS has left the highway and the exit fits */
  if(pick&&prev&&prev.cls==='motorway'&&c.cont){
    const k=c.cont,kh=(Math.atan2(k.tx,-k.tz)/R+360)%360;
    const hdiff=Math.abs(((kh-lastHd+540)%360)-180);
    const onIt=tnrLat(k,x,z)<=tnrHalf(k)+0.5;
    if(pick!==k&&hdiff<6&&onIt){pick=k;why='stay-highway';switchVotes=0;}
    else if(pick===k&&!onIt&&c.best&&c.best!==k&&c.best.sc<0.5){pick=c.best;why='exit';switchVotes=0;}
  }

  if(!pick){info.why='none';lostCount++;if(lostCount>=2){curRoad=null;TNR.src='';}return null;}
  info.pick=segInfo(pick);info.src=pick.src;
  curRoad=pick;
  /* lane: trust the GPS across the road, kept inside the road (motion.js laneOffset) */
  try{curRoad.lane=laneOffset(curRoad,x,z);}catch(e){}
  const s=onCurRoad(x,z),d=Math.hypot(s[0]-x,s[1]-z);
  if(d>SNAP_MAX+4){info.why='too-far';lostCount++;curRoad=prev;if(lostCount>=2){curRoad=null;TNR.src='';}return null;}
  /* let go when the road clearly doesn't fit (bends the road data doesn't have) */
  const rh=(Math.atan2(pick.tx,-pick.tz)/R+360)%360;
  const diff=Math.abs(((rh-lastHd+540)%360)-180);
  if((d>5&&diff>15)||d>8){curRoad=null;switchVotes=0;TNR.src='';info.why='let-go';return null;}
  lostCount=0;TNR.src=pick.src;info.why=why;
  return {x:s[0],z:s[1],tx:pick.tx,tz:pick.tz};
}

matchRoad=function(x,z,spd){
  const t0=performance.now();
  try{return tnrMatch(x,z,spd,t0);}
  finally{if(typeof PROF!=='undefined') PROF.matchRoad=(PROF.matchRoad||0)+performance.now()-t0;}
};

/* recordings: which roads the car followed ('r3' drawn, 't' tiles, '' none) */
if(typeof recTick==='function'){
  recTick=(function(base){return function(){
    const before=rec?rec.f.length:0;
    base();
    if(rec&&rec.f.length>before) rec.f[rec.f.length-1].push(snapOk?TNR.src:'');
  };})(recTick);
}

/* replay jumps start the matching fresh */
if(typeof rpSeek==='function'){
  rpSeek=(function(base){return function(t){TNR.lastFull=0;TNR.hd=[];TNR.src='';return base(t);};})(rpSeek);
}
