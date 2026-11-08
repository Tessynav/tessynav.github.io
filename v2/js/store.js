/* TessyNav v2 — store.js (v1)
   Map data kept on Tessy: road and building packs are saved in the browser's permanent storage (Cache Storage) after
   the first download, labelled with the map's version (the roads index's build time, the buildings index's date), so
   areas you've driven load instantly, even with a weak signal, and are never downloaded twice. When the weekly map
   rebuild publishes a new version, the old copies are deleted. A size limit keeps the storage in check.
   When a route is planned, the packs along the whole route are saved in advance, two at a time, in the background. */
var TN=globalThis.TN||{};globalThis.TN=TN;
TN.Store={
  ok:typeof caches!=='undefined'&&typeof location!=='undefined'&&location.protocol==='https:',
  names:{},limit:{roads:900,bld:300},   /* (about 60 MB of roads: all of Greater Montréal; 300 building packs) */
  hits:0,miss:0,puts:{},queue:[],busy:0,
  /* which version of a kind of data is current (older saved copies of that kind are deleted) */
  use(kind,version){
    if(!version) return;const name='tn-'+kind+'-'+version;if(this.names[kind]===name) return;this.names[kind]=name;
    if(!this.ok) return;
    caches.keys().then(ks=>{for(const k of ks) if(k.indexOf('tn-'+kind+'-')===0&&k!==name) caches.delete(k);}).catch(()=>{});
  },
  /* a pack: from storage if saved, otherwise downloaded (and saved). A missing pack (404) comes back as {missing:true}. */
  async json(kind,url){
    const name=this.names[kind];
    if(this.ok&&name){
      try{
        const c=await caches.open(name),hit=await c.match(url);
        if(hit){this.hits++;return hit.status===404?{missing:true}:await hit.json();}
        const r=await fetch(url);this.miss++;
        if(r.ok||r.status===404){c.put(url,r.clone()).then(()=>this.trim(kind,c)).catch(()=>{});}
        return r.status===404?{missing:true}:(r.ok?await r.json():null);
      }catch(e){}
    }
    const r=await fetch(url);return r.status===404?{missing:true}:(r.ok?await r.json():null);
  },
  /* the size limit: past it, the oldest saved packs of that kind are deleted, 100 at a time */
  trim(kind,c){
    this.puts[kind]=(this.puts[kind]||0)+1;if(this.puts[kind]%40) return;
    c.keys().then(ks=>{const over=ks.length-(this.limit[kind]||1000);if(over>0) for(const k of ks.slice(0,over+100)) c.delete(k);}).catch(()=>{});
  },
  /* save packs in advance (the route ahead): only those not saved yet, two at a time */
  prefetch(kind,urls){
    if(!this.ok||!this.names[kind]) return;
    for(const u of urls) if(!this.queue.some(q=>q[1]===u)) this.queue.push([kind,u]);
    this.pump();
  },
  async pump(){
    while(this.busy<2&&this.queue.length){
      const [kind,u]=this.queue.shift();this.busy++;
      (async()=>{try{const c=await caches.open(this.names[kind]);if(!(await c.match(u))){const r=await fetch(u);if(r.ok||r.status===404){await c.put(u,r);this.trim(kind,c);}}}catch(e){}
        this.busy--;this.pump();})();
    }
  }
};
