/* TessyNav tiles v1
   Roads come from our own road tiles (tessynav-roads, rebuilt every week from OpenStreetMap)
   instead of asking Overpass during the drive. Inside the covered regions the roads load in one
   quick request per 1.6 x 2.2 km pack, so no more "Roads 0" at highway speed.
   Outside the covered regions, or if the tiles can't be reached, it falls back to Overpass as before.
   The drawn roads and the road matching (match.js) both use these roads. */

const TNT={
  base:'https://tessynav.github.io/tessynav-roads/',
  idx:null,idxP:null,idxFailT:0,
  packs:new Map(),loading:new Map(),
  MAX_PACKS:16
};

/* the list of covered regions (loaded once; retried after a minute if it failed) */
function tntIndex(){
  if(TNT.idx) return Promise.resolve(TNT.idx);
  if(TNT.idxP) return TNT.idxP;
  if(TNT.idxFailT&&performance.now()-TNT.idxFailT<60000) return Promise.resolve(null);
  TNT.idxP=fetch(TNT.base+'index.json',{cache:'no-cache'})
    .then(r=>r.ok?r.json():null)
    .then(j=>{
      TNT.idxP=null;
      if(j&&j.v===1&&Array.isArray(j.regions)){TNT.idx=j;console.log('Road tiles:',j.regions.map(r=>r.name).join(', '),'built',j.built);return j;}
      TNT.idxFailT=performance.now();return null;
    })
    .catch(()=>{TNT.idxP=null;TNT.idxFailT=performance.now();return null;});
  return TNT.idxP;
}
function tntCovers(idx,tx,ty){
  if(!idx) return false;
  const lng=(tx+0.5)*idx.r3t,lat=(ty+0.5)*idx.r3t;
  return idx.regions.some(r=>lng>=r.bbox[0]&&lng<=r.bbox[2]&&lat>=r.bbox[1]&&lat<=r.bbox[3]);
}

/* one pack (4 x 4 cells); a missing pack inside a region just means no roads there */
function tntPack(px,py){
  const k=px+'_'+py;
  if(TNT.packs.has(k)){const P=TNT.packs.get(k);TNT.packs.delete(k);TNT.packs.set(k,P);return Promise.resolve(P);}
  if(TNT.loading.has(k)) return TNT.loading.get(k);
  const pr=fetch(TNT.base+'p/'+k+'.json')
    .then(r=>{
      if(r.status===404) return {w:[],n:[],c:{}};
      if(!r.ok) throw new Error('pack '+r.status);
      return r.json();
    })
    .then(P=>{
      TNT.loading.delete(k);
      TNT.packs.set(k,P);
      while(TNT.packs.size>TNT.MAX_PACKS) TNT.packs.delete(TNT.packs.keys().next().value);
      return P;
    })
    .catch(e=>{TNT.loading.delete(k);console.warn('road pack',k,e);return null;});
  TNT.loading.set(k,pr);
  return pr;
}

/* one road cell, in the same shape the Overpass loader made, so roads.js draws it unchanged */
function tntCell(P,tx,ty,r3t){
  const ids=(P.c&&P.c[tx+','+ty])||[];
  const w=ids.map(i=>P.w[i]);
  const x0=tx*r3t,x1=x0+r3t,y0=ty*r3t,y1=y0+r3t;
  const n=(P.n||[]).filter(m=>m[0]>=x0&&m[0]<x1&&m[1]>=y0&&m[1]<y1);
  return {w:w,n:n,own:1};
}

r3Fetch=(function(overpass){return async function(tx,ty){
  const idx=await tntIndex();
  if(tntCovers(idx,tx,ty)){
    const P=await tntPack(Math.floor(tx/idx.pack),Math.floor(ty/idx.pack));
    if(P) return tntCell(P,tx,ty,idx.r3t);
  }
  return overpass(tx,ty);
};})(r3Fetch);

/* inside covered regions, skip the old saved Overpass copies so the fresh tiles are used */
if(typeof r3CacheGet==='function'){
  r3CacheGet=(function(base){return function(k){
    if(TNT.idx){const [x,y]=k.split(',').map(Number);if(tntCovers(TNT.idx,x,y)) return null;}
    return base(k);
  };})(r3CacheGet);
}

tntIndex();
