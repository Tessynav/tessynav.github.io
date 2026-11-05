/* TessyNav v2 — water.js
   Animated water on rivers, canals and lakes near you (drawn over the map's flat water):
   - day: fine moving ripples, lighter water along the shore, sun sparkles
   - night: dark glossy water, faint ripples, the amber street lights reflected as shimmering streaks, and a
     moonlight path on the water when the moon is up (real position and phase)
   Ripples and sparkles fade out with distance so they never shimmer or flicker far away.
   Built to stay light: one surface per area, a small graphics program animates it. ?water=0 switches it off. */
var TN=globalThis.TN||{};globalThis.TN=TN;

TN.Water=function(scene){
  this.scene=scene;this.cells=new Map();this.t=0;this.night=0;this.mat=null;this.lampT=0;
  this.on=!(typeof location!=='undefined'&&/[?&]water=0/.test(location.search));
};
TN.Water.prototype.material=function(){
  if(this.mat) return this.mat;
  const lp=[];for(let i=0;i<12;i++) lp.push(new THREE.Vector3(0,-1e6,0));
  this.mat=new THREE.ShaderMaterial({
    uniforms:{time:{value:0},night:{value:this.night},lampP:{value:lp},camP:{value:new THREE.Vector3()},
      moonD:{value:new THREE.Vector2(0,-1)},moonK:{value:0}},
    side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:2,polygonOffsetUnits:4,
    vertexShader:[
      'attribute float aShore;varying vec2 vP;varying float vShore;',
      'void main(){vec4 w=modelMatrix*vec4(position,1.0);vP=w.xz;vShore=aShore;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}'].join('\n'),
    fragmentShader:[
      'uniform float time;uniform float night;uniform vec3 lampP[12];uniform vec3 camP;uniform vec2 moonD;uniform float moonK;',
      'varying vec2 vP;varying float vShore;',
      'float hh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
      'void main(){',
      '  vec3 day=vec3(0.184,0.624,0.839),dark=vec3(0.039,0.102,0.172);',
      '  vec3 col=mix(day,dark,night);',
      /* lighter shallow water along the shore */
      '  col=mix(col,mix(vec3(0.67,0.88,0.96),vec3(0.09,0.20,0.28),night),vShore*0.45);',
      /* ripples: thin crests from two crossing wave trains, fading out where they would be smaller than a pixel */
      '  float a=dot(vP,vec2(0.36,0.21))+time*0.9,b=dot(vP,vec2(-0.17,0.44))-time*0.7;',
      '  float w=sin(a)*0.6+sin(b)*0.4+0.25*sin(dot(vP,vec2(0.9,0.6))+time*1.7);',
      '  float fade=1.0-smoothstep(0.25,0.9,fwidth(a)+fwidth(b));',
      '  float crest=smoothstep(0.72,0.98,w)*fade;',
      '  col+=crest*mix(0.13,0.05,night);',
      /* sun sparkles (day): a few cells twinkle at a time */
      '  vec2 c=floor(vP/2.5);float tw=floor(time*2.0+hh(c)*7.0);',
      '  float sp=step(0.992,hh(c+tw))*fade*(1.0-night);',
      '  col+=sp*0.55;',
      /* street lights reflected as shimmering streaks running towards the camera (night) */
      '  float st=0.0;',
      '  for(int i=0;i<12;i++){vec2 L=lampP[i].xz;if(lampP[i].y<-1000.0) continue;vec2 v=vP-L;vec2 d=camP.xz-L;float dl=length(d);if(dl<1.0) continue;d/=dl;',
      '    float al=dot(v,d);if(al<0.0||al>45.0) continue;float la=dot(v,vec2(-d.y,d.x))+sin(al*0.8+time*2.0)*0.45;',
      '    float wd=0.7+al*0.05;st+=(1.0-al/45.0)*smoothstep(wd,0.0,abs(la))*(0.55+0.45*sin(al*1.7-time*3.0));}',
      '  col+=vec3(1.0,0.62,0.28)*min(st,1.2)*0.42*night;',
      /* moonlight path (night, moon up) */
      '  if(moonK>0.0){vec2 v=vP-camP.xz;float al=dot(v,moonD);if(al>0.0){float la=dot(v,vec2(-moonD.y,moonD.x))+sin(al*0.5+time)*0.6;',
      '    float wd=2.0+al*0.08;col+=vec3(0.86,0.9,0.98)*moonK*0.28*smoothstep(wd,0.0,abs(la))*(0.5+0.5*sin(al*0.9-time*2.0))*max(0.0,1.0-al/600.0);}}',
      '  gl_FragColor=vec4(col,1.0);}'].join('\n')
  });
  return this.mat;
};
TN.Water.prototype.setNight=function(nt){this.night=nt;if(this.mat) this.mat.uniforms.night.value=nt;};
/* water shapes of one area from the map tiles already loaded */
TN.Water.prototype.collect=function(ck){
  const map=this.scene.map;if(!map||typeof map.querySourceFeatures!=='function') return [];
  const [cx,cy]=ck.split(',').map(Number),out=[],seen=new Set();
  let fs=[];try{fs=map.querySourceFeatures('openmaptiles',{sourceLayer:'water'});}catch(e){return [];}
  for(const f of fs){
    const g=f.geometry;if(!g) continue;
    const list=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
    for(const rings of list){
      const r=rings[0];if(!r||r.length<4) continue;
      let sx=0,sy=0;for(const p of r){sx+=p[0];sy+=p[1];}sx/=r.length;sy/=r.length;
      if(Math.floor(sx/TN.CELL)!==cx||Math.floor(sy/TN.CELL)!==cy) continue;
      const key=r[0][0].toFixed(6)+','+r[0][1].toFixed(6)+','+r.length;if(seen.has(key)) continue;seen.add(key);
      out.push(rings);
    }
  }
  return out;
};
TN.Water.prototype.build=function(polys){
  const pos=[],sh=[],idx=[];let n=0;
  const add=(x,z,s)=>{pos.push(x,0.005,z);sh.push(s);return n++;};
  for(const rings of polys){
    const R=rings.map(r=>r.slice(0,-1).map(p=>{const q=TN.toLocal(p[0],p[1]);return new THREE.Vector2(q[0],q[1]);})).filter(r=>r.length>=3);
    if(!R.length) continue;
    let faces=[];try{faces=THREE.ShapeUtils.triangulateShape(R[0],R.slice(1));}catch(e){continue;}
    const all=[].concat(...R),base=n;for(const v of all) add(v.x,v.y,0);
    for(const f of faces) idx.push(base+f[0],base+f[1],base+f[2]);
    /* a band of lighter water along real shores (not along the cut edges of map tiles) */
    for(let ri=0;ri<rings.length;ri++){
      const raw=rings[ri],ring=R[ri];if(!ring) continue;
      let A=0;for(let i=0;i<ring.length;i++){const p=ring[i],q=ring[(i+1)%ring.length];A+=p.x*q.y-q.x*p.y;}
      const left=(ri===0)===(A>0);   /* water lies on the left of each edge? */
      for(let i=0;i<ring.length;i++){
        const p=ring[i],q=ring[(i+1)%ring.length],o=raw[i],o2=raw[(i+1)%ring.length];
        if(Math.abs(o[0]-o2[0])<1e-9||Math.abs(o[1]-o2[1])<1e-9) continue;   /* tile cut edge */
        let dx=q.x-p.x,dz=q.y-p.y;const l=Math.hypot(dx,dz);if(l<0.5) continue;dx/=l;dz/=l;
        const nx=left?-dz:dz,nz=left?dx:-dx,wb=7;
        const a0=add(p.x,p.y,1),a1=add(q.x,q.y,1),b1=add(q.x+nx*wb,q.y+nz*wb,0),b0=add(p.x+nx*wb,p.y+nz*wb,0);
        pos[a0*3+1]=pos[a1*3+1]=pos[b0*3+1]=pos[b1*3+1]=0.01;
        idx.push(a0,a1,b1,a0,b1,b0);
      }
    }
  }
  if(!n) return null;
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('aShore',new THREE.Float32BufferAttribute(sh,1));g.setIndex(idx);
  const m=new THREE.Mesh(g,this.material());m.frustumCulled=false;m.renderOrder=-1;return m;
};
TN.Water.prototype.free=function(k){const e=this.cells.get(k);if(!e) return;if(e.mesh){this.scene.three.scene.remove(e.mesh);e.mesh.geometry.dispose();}this.cells.delete(k);};
TN.Water.prototype.update=function(dt,lng,lat,car){
  if(!this.on||!this.scene.three) return;
  this.t+=dt;const U=this.material().uniforms;U.time.value=this.t;
  const S=this.scene;if(TN.CUTU) U.camP.value.copy(TN.CUTU.cutCam.value);
  /* nearest street lamps (for the reflections) and the moon, twice a second */
  this.lampT-=dt;
  if(this.lampT<=0){this.lampT=0.5;
    const c=TN.toLocal(lng,lat),all=[];
    for(const e of S.cells.values()) if(e.lamps) for(let i=0;i<e.lamps.length;i+=3){const dx=e.lamps[i]-c[0],dz=e.lamps[i+2]-c[1];all.push([dx*dx+dz*dz,i,e.lamps]);}
    all.sort((a,b)=>a[0]-b[0]);
    for(let i=0;i<12;i++){const v=U.lampP.value[i];if(i<all.length){const L=all[i][2],j=all[i][1];v.set(L[j],L[j+1],L[j+2]);}else v.set(0,-1e6,0);}
    const M=S.moonI;
    if(M&&M.alt>2){const az=M.az*TN.R;U.moonD.value.set(Math.sin(az),-Math.cos(az));U.moonK.value=Math.min(1,0.3+M.illum)*Math.max(0,Math.min(1,(S.glowOp||0)*1.2));}
    else U.moonK.value=0;
  }
  const cx=Math.floor(lng/TN.CELL),cy=Math.floor(lat/TN.CELL),now=performance.now();
  for(const k of [...this.cells.keys()]){const [x,y]=k.split(',').map(Number);if(Math.abs(x-cx)>3||Math.abs(y-cy)>3) this.free(k);}
  /* one missing area per call (retried later if the map had not loaded its water yet) */
  let best=null;
  for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++){
    const k=(cx+dx)+','+(cy+dy),e=this.cells.get(k),d=dx*dx+dy*dy;
    if(e&&(e.n||e.tries>=3||now-e.t<4000)) continue;
    if(!best||d<best.d) best={k:k,d:d,tries:e?e.tries+1:0};
  }
  if(!best) return;
  const t0=performance.now();this.free(best.k);
  const polys=this.collect(best.k),mesh=polys.length?this.build(polys):null;
  if(mesh) S.three.scene.add(mesh);
  this.cells.set(best.k,{mesh:mesh,n:polys.length,t:now,tries:best.tries});
  TN.prof('water',performance.now()-t0);
};
