/* TessyNav v2 — habits.js (v3): learning your usual routes, and your usual way into a place
   After each drive, TessyNav keeps a short note of it on the car (never sent anywhere): where it started and ended,
   the day and hour, and the ~100 m squares of map it went through. When you plan a route and Mapbox offers a few
   ways, the one that follows the roads you usually take between those two places is marked "Usual" and chosen,
   unless it is clearly slower today (more than 3 minutes and 15%), then Rocco says so and the faster one stays.
   It needs 3 similar drives first (start within 1.5 km, end within 1 km), so one odd trip changes nothing.
   Light: about 2 KB per drive, the last 150 drives. Settings → Learn my usual routes turns it off (and Forget clears it);
   ?habits=0 also turns it off. */
var TN=globalThis.TN||{};globalThis.TN=TN;
TN.Habits=function(){
  this.K='tn2_habits';this.cur=null;this.stillSince=0;this.lastSave=0;this.list=[];
  try{const j=JSON.parse(localStorage.getItem(this.K)||'null');if(j&&Array.isArray(j.d)) this.list=j.d;}catch(e){}
  /* a drive cut short (the page closed): finished now if it is old */
  try{const c=JSON.parse(localStorage.getItem(this.K+'_cur')||'null');if(c&&Date.now()-c.t1>10*60000){this.cur=c;this.finish();}else if(c) this.cur=c;}catch(e){}
  if(typeof addEventListener==='function') addEventListener('pagehide',()=>this.saveCur());
};
TN.Habits.prototype.on=function(){
  if(typeof location!=='undefined'&&/[?&]habits=0/.test(location.search)) return false;
  return !(TN.settings&&TN.settings.habits===false);
};
TN.Habits.cell=(lng,lat)=>Math.floor(lng/0.0013)+':'+Math.floor(lat/0.0009);   /* (about 100 m x 100 m) */
TN.Habits.dist=(a,b)=>Math.hypot((a[0]-b[0])*111320*Math.cos(a[1]*Math.PI/180),(a[1]-b[1])*111320);
/* every GPS position while driving (lng, lat, speed in m/s, accuracy in m) */
TN.Habits.prototype.pos=function(lng,lat,v,acc,now){
  if(!this.on()||lng==null||(acc||0)>40||TN.replay) return;now=now||Date.now();v=v||0;
  if(!this.cur){if(v<3) return;
    const d=new Date(now);this.cur={s:[+lng.toFixed(5),+lat.toFixed(5)],e:null,w:d.getDay(),h:d.getHours(),c:[],t0:now,t1:now};}
  const c=this.cur,k=TN.Habits.cell(lng,lat);if(c.c[c.c.length-1]!==k&&c.c.indexOf(k)<0) c.c.push(k);
  c.e=[+lng.toFixed(5),+lat.toFixed(5)];c.t1=now;
  /* parked for 3 minutes: the drive is over */
  if(v<1){if(!this.stillSince) this.stillSince=now;else if(now-this.stillSince>180000){this.finish();return;}}else this.stillSince=0;
  if(now-this.lastSave>60000){this.lastSave=now;this.saveCur();}
};
TN.Habits.prototype.saveCur=function(){try{if(this.cur) localStorage.setItem(this.K+'_cur',JSON.stringify(this.cur));}catch(e){}};
TN.Habits.prototype.finish=function(){
  const c=this.cur;this.cur=null;this.stillSince=0;try{localStorage.removeItem(this.K+'_cur');}catch(e){}
  if(!c||c.c.length<10||!c.e||TN.Habits.dist(c.s,c.e)<500) return;   /* (very short drives teach nothing) */
  this.list.push({s:c.s,e:c.e,w:c.w,h:c.h,c:c.c.join(' '),t:c.t0});
  if(this.list.length>150) this.list=this.list.slice(-150);
  try{localStorage.setItem(this.K,JSON.stringify({v:1,d:this.list}));}catch(e){}
};
TN.Habits.prototype.forget=function(){this.list=[];this.cur=null;try{localStorage.removeItem(this.K);localStorage.removeItem(this.K+'_cur');}catch(e){}};
/* past drives between about the same two places */
TN.Habits.prototype.similar=function(from,to){
  return this.list.filter(d=>TN.Habits.dist(d.s,from)<1500&&TN.Habits.dist(d.e,to)<1000);
};
/* how much of a route (its coordinates) runs on roads you took on those drives: 0 to 1 */
TN.Habits.prototype.overlap=function(coords,drives){
  const seen=new Set();for(const d of drives) for(const k of d.c.split(' ')) seen.add(k);
  let n=0,hit=0,last=null;
  for(const p of coords){if(last&&TN.Habits.dist(last,p)<40) continue;last=p;const k=TN.Habits.cell(p[0],p[1]);n++;
    /* (a square next door counts too: the GPS and the map can be a few metres apart at a square's edge) */
    const [x,y]=k.split(':').map(Number);let ok=seen.has(k);if(!ok) for(let dx=-1;dx<=1&&!ok;dx++) for(let dy=-1;dy<=1&&!ok;dy++) ok=seen.has((x+dx)+':'+(y+dy));
    if(ok) hit++;}
  return n?hit/n:0;
};
/* among the ways offered, your usual one: {i, score, n} (n: how many past drives), or null */
TN.Habits.prototype.usual=function(routes){
  if(!this.on()||!routes||routes.length<2) return null;
  const C0=routes[0].geometry.coordinates,from=C0[0],to=C0[C0.length-1],D=this.similar(from,to);
  if(D.length<3) return null;
  const sc=routes.map(r=>this.overlap(r.geometry.coordinates,D));
  let i=0;for(let k=1;k<sc.length;k++) if(sc[k]>sc[i]) i=k;
  const second=Math.max(...sc.filter((x,k)=>k!==i));
  /* (clearly your way: most of it on your roads, and clearly more than the others) */
  if(sc[i]<0.75||sc[i]-second<0.12) return null;
  return {i:i,score:sc[i],n:D.length,scores:sc};
};
/* (v2, Nov 18) your usual way INTO a place: whole-trip choices need 3 drives from about the same start, which rarely
   happens when you start from different places every time, and Mapbox's 2-3 ways seldom differ only in the last
   kilometres (the roundabout on Île-des-Soeurs before home: the route took the other way on every drive). So the last
   3 km of your drives that ended at this place are compared on their own, whatever the start: when at least 3 of them
   (and 3 out of 4) went through the same ~100 m square that the new route misses, that square is returned, and the
   route is asked again through it (nav.js), kept when it isn't clearly slower. null when there's nothing to change. */
TN.Habits.center=k=>{const [x,y]=k.split(':').map(Number);return [(x+0.5)*0.0013,(y+0.5)*0.0009];};
TN.Habits.prototype.approach=function(coords,to){
  if(!this.on()||!coords||coords.length<2||!to) return null;
  const D=this.list.filter(d=>TN.Habits.dist(d.e,to)<800);if(D.length<3) return null;
  const cnt={};
  for(const d of D){const seen=new Set();for(const k of d.c.split(' ')){if(seen.has(k)) continue;const r=TN.Habits.dist(TN.Habits.center(k),to);if(r>350&&r<3000){seen.add(k);cnt[k]=(cnt[k]||0)+1;}}}
  const need=Math.max(3,Math.ceil(D.length*0.75));
  /* the squares the new route goes through near the place (a neighbouring square counts, as in overlap()) */
  const rc=new Set();let last=null;
  for(const p of coords){if(TN.Habits.dist(p,to)>3200) continue;if(last&&TN.Habits.dist(last,p)<40) continue;last=p;
    const [x,y]=TN.Habits.cell(p[0],p[1]).split(':').map(Number);for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++) rc.add((x+dx)+':'+(y+dy));}
  const all=[];
  for(const k in cnt){if(cnt[k]<need||rc.has(k)) continue;const r=TN.Habits.dist(TN.Habits.center(k),to);
    /* (the square of your way furthest from the route's own squares near the place, but not right at the door) */
    if(r<400||r>2500) continue;all.push({k:k,sc:cnt[k]*1000-r,n:cnt[k]});}
  if(!all.length) return null;
  all.sort((a,b)=>b.sc-a.sc);
  const ll=k=>{const c=TN.Habits.center(k);return [+c[0].toFixed(6),+c[1].toFixed(6)];};
  /* (a few other squares of the same way too, in case the first one lands on a side street: see nav.js) */
  return {via:ll(all[0].k),n:all[0].n,of:D.length,more:all.slice(1,4).map(x=>ll(x.k))};
};
TN.habits=new TN.Habits();
