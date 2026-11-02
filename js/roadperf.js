/* TessyNav roadperf v1
   Now that roads load for the whole drive, two things in the old road code became a problem:
   1. Memory: a converted copy of every road area ever loaded was kept forever (r3LocalCache).
      Now only the areas still loaded are kept.
   2. Freezes: every few seconds all ~500 nearby roads were rebuilt shape by shape (up to 0.5 s each time).
      Now each road's shape is built once and reused while it stays nearby; only new roads are built.
   Recordings: each fps row gets the browser memory in MB at the end (when the browser reports it),
   so we can see if memory still climbs during a drive. */

const RP={memo:new Map(),gen:0,hits:0,miss:0};

/* same shape for the same road points and width -> reuse it */
function rpKey(pts,h){
  let a=2166136261,b=0;
  for(let i=0;i<pts.length;i++){
    const x=Math.round(pts[i][0]*100),z=Math.round(pts[i][1]*100);
    a=Math.imul(a^x,16777619);a=Math.imul(a^z,16777619);
    b=(b+x*31+z*17+i)|0;
  }
  return pts.length+'|'+Math.round(h*100)+'|'+a+'|'+b;
}

if(typeof r3Ribbon==='function'){
  r3Ribbon=(function(base){return function(pts,h){
    const k=rpKey(pts,h);
    const e=RP.memo.get(k);
    if(e){e.g=RP.gen;RP.hits++;return e.v;}
    const v=base(pts,h);
    RP.memo.set(k,{v:v,g:RP.gen});RP.miss++;
    return v;
  };})(r3Ribbon);
}

if(typeof r3Rebuild==='function'){
  r3Rebuild=(function(base){return function(){
    RP.gen++;
    const r=base.apply(this,arguments);
    /* forget road shapes not used in the last two rebuilds */
    for(const [k,e] of RP.memo) if(RP.gen-e.g>1) RP.memo.delete(k);
    /* forget converted road areas that are no longer loaded */
    if(typeof r3LocalCache!=='undefined'&&typeof r3Tiles!=='undefined'){
      for(const k of r3LocalCache.keys()) if(!r3Tiles.has(k)) r3LocalCache.delete(k);
    }
    return r;
  };})(r3Rebuild);
}

/* memory in recordings (MB), added at the end of each fps row */
if(typeof recTick==='function'){
  recTick=(function(base){return function(){
    const before=rec?rec.p.length:0;
    base();
    if(rec&&rec.p.length>before){
      let mb=-1;
      try{if(performance.memory) mb=Math.round(performance.memory.usedJSHeapSize/1048576);}catch(e){}
      rec.p[rec.p.length-1].push(mb);
    }
  };})(recTick);
}
