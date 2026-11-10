/* TessyNav v2 — roadworker.js (runs in the background, on its own thread; v2: also works out the road heights; v3: and builds the buildings)
   Builds the 3D road areas (road surfaces, curbs, markings, parking lots, light pools) away from the screen's thread,
   so drawing never waits for it. It keeps its own copy of the road network: the app sends it the same road packs
   it loads and the heights it works out; the finished areas come back as ready-made number arrays. */
self.TN={};
/* (just what the building code needs from the 3D library: cutting a roof outline into triangles) */
self.THREE={Vector2:function(x,y){this.x=x;this.y=y;},ShapeUtils:{triangulateShape:c=>self.TN.earcut(c.map(v=>[v.x,v.y]))}};
{const q=new URL(self.location.href).searchParams;
 importScripts('roads.js?v='+(q.get('r')||'1'));
 try{importScripts('buildings.js?v='+(q.get('b')||'1'),'shadows.js?v='+(q.get('s')||'1'));}catch(e){}}
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
    }else if(m.t==='bld'){
      /* one area of buildings from our building tiles: decoded and built here, sent back as number arrays */
      const T2=self.TN,out=[],ox=m.o[0],oy=m.o[1];
      for(const r of m.recs){let x=r[2],y=r[3];const ring=[T2.toLocal(ox+x/1e6,oy+y/1e6)];
        for(let k=4;k<r.length;k+=2){x+=r[k];y+=r[k+1];ring.push(T2.toLocal(ox+x/1e6,oy+y/1e6));}
        let A=0;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];A+=a[0]*b[1]-b[0]*a[1];}
        out.push({ring:ring,H:r[0]/10,B:r[1]/10,id:null,wa:Math.abs(A)/2,parts:1});}
      const [cx,cy]=m.k.split(',').map(Number),a=T2.toLocal(cx*T2.CELL,(cy+1)*T2.CELL),b=T2.toLocal((cx+1)*T2.CELL,cy*T2.CELL);
      net._sg=out.length?net.segGrid([Math.min(a[0],b[0])-20,Math.max(a[0],b[0])+20,Math.min(a[1],b[1])-20,Math.max(a[1],b[1])+20]):null;
      T2.shadows=m.shadows&&T2.Shadows?{addBuilding:T2.Shadows.prototype.addBuilding}:null;
      const ctx={scene:{map:null},net:net,overRem:T2.Buildings.prototype.overRem,crossesRoad:T2.Buildings.prototype.crossesRoad,palette:T2.Buildings.prototype.palette};
      const G={p:[],n:[],c:[],w:[],i:[],cnt:0,s:{p:[],h:[],i:[],cnt:0}};
      for(const bd of out) T2.Buildings.prototype.addBuilding.call(ctx,G,bd,null);
      net._sg=null;
      const big=G.cnt>65535,R={cnt:G.cnt,n:out.length,p:new Float32Array(G.p),nm:new Float32Array(G.n),c:new Float32Array(G.c),w:new Float32Array(G.w),i:big?new Uint32Array(G.i):new Uint16Array(G.i),
        s:{cnt:G.s.cnt,p:new Float32Array(G.s.p),h:new Float32Array(G.s.h),i:G.s.cnt>65535?new Uint32Array(G.s.i):new Uint16Array(G.s.i)}};
      self.postMessage({t:'bld',k:m.k,id:m.id,R:R},[R.p.buffer,R.nm.buffer,R.c.buffer,R.w.buffer,R.i.buffer,R.s.p.buffer,R.s.h.buffer,R.s.i.buffer]);
    }else if(m.t==='cell'){
      const g=net.buildCellJob(m.x,m.y);let r;do{r=g.next();}while(!r.done);net._sg=null;
      const L=r.value,out={lamps:L.lamps||[]},tr=[];
      for(const q of ['lot','curb','road','mark','glow']){const G=L[q];if(!G||!G.n) continue;const T=typed(G);out[q]=T;tr.push(T.p.buffer,T.c.buffer,T.i.buffer);}
      self.postMessage({t:'cell',k:m.k,id:m.id,ver:net.ver,L:out},tr);
    }
  }catch(err){self.postMessage({t:'error',k:m.k,id:m.id,msg:String(err&&err.message||err)+' @'+m.t+' '+String(err&&err.stack||'').split('\n').slice(1,3).join(' | ')});}
};
self.postMessage({t:'ready'});
