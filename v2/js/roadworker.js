/* TessyNav v2 — roadworker.js (runs in the background, on its own thread; v2: also works out the road heights)
   Builds the 3D road areas (road surfaces, curbs, markings, parking lots, light pools) away from the screen's thread,
   so drawing never waits for it. It keeps its own copy of the road network: the app sends it the same road packs
   it loads and the heights it works out; the finished areas come back as ready-made number arrays. */
self.TN={};
importScripts('roads.js?v='+(new URL(self.location.href).searchParams.get('r')||'1'));
const T=self.TN;T.HV2=true;
const net=new T.Net();
/* the road index only (which pieces meet where, what is near what); the heights come from the app */
const indexOnly=()=>{const keys=new Map(),idx=new Map();
  for(const w of net.ways.values()){
    for(let i=0;i<w.keys.length;i++){let l=keys.get(w.keys[i]);if(!l){l=[];keys.set(w.keys[i],l);}l.push([w,i]);}
    for(let gx=Math.floor(w.bb[0]/100);gx<=Math.floor(w.bb[1]/100);gx++)
      for(let gz=Math.floor(w.bb[2]/100);gz<=Math.floor(w.bb[3]/100);gz++){const k=gx*1e6+gz;let l=idx.get(k);if(!l){l=[];idx.set(k,l);}l.push(w);}
  }
  net.keys=keys;net.idx=idx;};
const typed=G=>{const big=G.p.length/3>65535;return {n:G.n,p:new Float32Array(G.p),c:new Float32Array(G.c),i:big?new Uint32Array(G.i):new Uint16Array(G.i)};};
self.onmessage=e=>{const m=e.data;
  try{
    if(m.t==='sync'){
      for(const k of m.drop||[]) net.dropPack(k,true);
      for(const [k,P] of m.add||[]){const g=net.addPackJob(k,P);while(!g.next().done);}
      if(m.remote){
        /* the heights are worked out here (round 2): the whole network rebuild, then the heights that changed go back */
        T.HV2=!!m.hv2;const g=net.rebuildJob();while(!g.next().done);
        const pg=net.packHeights();let q;do{q=pg.next();}while(!q.done);const H=q.value;
        net.ver=m.ver;net.remVer=m.remVer||0;net.changed=[];
        self.postMessage({t:'heights',ver:m.ver,h:H},[H.ids.buffer,H.meta.buffer,H.hs.buffer]);
      }else{indexOnly();net.applyHeights(m.h);net.ver=m.ver;net.remVer=m.remVer||0;net.changed=[];}
      self.postMessage({t:'synced',ver:m.ver});
    }else if(m.t==='cell'){
      const g=net.buildCellJob(m.x,m.y);let r;do{r=g.next();}while(!r.done);net._sg=null;
      const L=r.value,out={lamps:L.lamps||[]},tr=[];
      for(const q of ['lot','curb','road','mark','glow']){const G=L[q];if(!G||!G.n) continue;const T=typed(G);out[q]=T;tr.push(T.p.buffer,T.c.buffer,T.i.buffer);}
      self.postMessage({t:'cell',k:m.k,id:m.id,ver:net.ver,L:out},tr);
    }
  }catch(err){self.postMessage({t:'error',k:m.k,id:m.id,msg:String(err&&err.message||err)});}
};
self.postMessage({t:'ready'});
