/* TessyNav v2 — sw.js (offline mode, v1)
   Keeps a copy of TessyNav on the car so it opens and drives without internet (no Premium Connectivity, a tunnel,
   a dead zone):
   - the app itself (the page, its files, the 3D car, the map and 3D libraries): saved on the first visit, and
     refreshed in the background whenever there's internet; the page always tries the internet first (4 s), so
     updates arrive as before
   - the base map (its style, fonts and the map tiles of the areas you've seen): kept as you drive, up to about
     1,500 tiles (the oldest go first)
   - the lists of road and building packs: the newest one is kept, so the packs already saved on the car (by
     store.js) can be found offline
   Not kept (they need internet anyway): searching places, routes, traffic, roadwork, weather, Spotify, uploads. */
const V='tn-sw-1',APP='tn-app',MAP='tn-map',IDX='tn-idx',MAPMAX=1500,APPMAX=250;
const LIBS=['https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js','https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css',
  'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.min.js'];
const SCOPE=self.registration.scope;   /* (…/v2/) */

/* the app's own file list, read from the page itself (the same list the page loads) */
const filesOf=html=>[...html.matchAll(/<script[^>]+src="(js\/[^"]+)"/g)].map(m=>new URL(m[1],SCOPE).href);
async function saveApp(html){
  const c=await caches.open(APP),want=filesOf(html).concat(LIBS,[new URL('../model3.glb',SCOPE).href]);
  for(const u of want){try{if(await c.match(u)) continue;const r=await fetch(u,{mode:/^https:\/\/cdn\./.test(u)?'no-cors':'cors'});if(r.ok||r.type==='opaque') await c.put(u,r);}catch(e){}}
}
self.addEventListener('install',e=>{e.waitUntil((async()=>{
  /* the road and building pack lists too, so the packs already on the car can be found offline */
  try{const c=await caches.open(IDX);for(const u of ['https://tessynav.github.io/tessynav-roads/index.json','https://tessynav.github.io/tessynav-buildings/index.json']){
    try{const r=await fetch(u,{cache:'no-store'});if(r.ok) await c.put(u,r);}catch(x){}}}catch(x){}
  try{const r=await fetch(SCOPE,{cache:'no-store'});if(r.ok){const h=await r.clone().text();await (await caches.open(APP)).put(SCOPE,r);await saveApp(h);}}catch(x){}
  await self.skipWaiting();})());});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim());});

/* a cache key without the one-off "fresh copy" marks (b= and bust=), so a reload after an update doesn't pile up copies */
const keyOf=u=>{const x=new URL(u);x.searchParams.delete('b');x.searchParams.delete('bust');return x.href;};
async function trim(name,max){try{const c=await caches.open(name),ks=await c.keys();if(ks.length>max) for(const k of ks.slice(0,ks.length-max+50)) await c.delete(k);}catch(e){}}
let puts=0;
const timeout=(p,ms)=>Promise.race([p,new Promise((_,no)=>setTimeout(()=>no(new Error('slow')),ms))]);

self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET') return;
  const u=new URL(req.url);
  /* the page: internet first (4 s), the saved copy otherwise */
  if(req.mode==='navigate'&&u.href.startsWith(SCOPE)&&/\/v2\/(index\.html)?$/.test(u.pathname)){
    e.respondWith((async()=>{
      try{const r=await timeout(fetch(req),4000);if(r.ok){const c=r.clone();e.waitUntil((async()=>{const h=await c.clone().text();await (await caches.open(APP)).put(SCOPE,c);await saveApp(h);})());}return r;}
      catch(x){const hit=await caches.match(SCOPE);return hit||Response.error();}})());
    return;}
  /* the road / building / tree pack lists: internet first, the newest saved one otherwise */
  if(/^\/tessynav-(roads|buildings)\/index\.json$/.test(u.pathname)||/\/trees\/index\.json$/.test(u.pathname)){
    e.respondWith((async()=>{const c=await caches.open(IDX),k=u.origin+u.pathname;
      try{const r=await fetch(req);if(r.ok) e.waitUntil(c.put(k,r.clone()));return r;}catch(x){return (await c.match(k))||Response.error();}})());
    return;}
  /* the packs themselves: store.js keeps them (not doubled here) */
  if(/^\/tessynav-(roads|buildings)\//.test(u.pathname)) return;
  /* the app's own files and the 3D car (same site), the map and 3D libraries: the saved copy first */
  const own=u.origin===location.origin&&(u.href.startsWith(SCOPE)||/\/(model3\.glb|trees\/)/.test(u.pathname));
  const lib=/^https:\/\/(cdn\.jsdelivr\.net\/npm|unpkg\.com)\//.test(u.href);
  if(own||lib){
    e.respondWith((async()=>{const c=await caches.open(APP),k=keyOf(req.url);
      const hit=await c.match(k);if(hit) return hit;
      try{const r=await fetch(req);if(r.ok||r.type==='opaque'){e.waitUntil(c.put(k,r.clone()).then(()=>{if(++puts%25===0) return trim(APP,APPMAX);}));}return r;}
      catch(x){return (await c.match(k,{ignoreSearch:true}))||Response.error();}})());
    return;}
  /* the base map (style, tiles, fonts, icons): the saved copy at once, refreshed in the background */
  if(u.hostname==='tiles.openfreemap.org'){
    e.respondWith((async()=>{const c=await caches.open(MAP),hit=await c.match(req.url);
      const net=fetch(req).then(r=>{if(r.ok){c.put(req.url,r.clone()).then(()=>{if(++puts%40===0) trim(MAP,MAPMAX);});}return r;});
      if(hit){e.waitUntil(net.catch(()=>{}));return hit;}
      try{return await net;}catch(x){return Response.error();}})());
    return;}
  /* everything else (search, routes, traffic, weather, Spotify, uploads): straight to the internet, as before */
});
