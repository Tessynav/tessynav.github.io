/* MapKoon v3 — chargers.js (v1, Nov 27 2026): Tesla Superchargers on the map (step 6, the first v2 feature moved to v3).
   Same list as v2: OpenStreetMap, refreshed weekly by the "Chargers" job in tessynav-roads.
   - a red pin with a lightning bolt and the number of stalls floats above each Supercharger (within 2 km while
     following the car, everywhere loaded in Move map); tap it for a card: name, stalls, power, distance
   - close by (700 m, at most 6): a small 3D site, a row of charging posts at painted stalls and a tall sign, turned to
     face the nearest road. Simple shapes, no logos.
   - ?fastdc=1 also shows other fast chargers (blue); ?chg=0 turns all of it off
   Light on the car's computer: the list is filtered every 2 s, pins are sprites, each 3D site is 6 merged meshes. */
(function (root) {
  const URL_ = 'https://raw.githubusercontent.com/Tessynav/tessynav-roads/chargers/chargers.json';
  const esc = t => String(t == null ? '' : t).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

  function Chargers(o) {
    /* o: {THREE, scene, camera, canvas, toL (lon,lat)->[x,z], net (MKLanes.Net), car () -> {x,z} } */
    Object.assign(this, o); this.list = []; this.pins = new Map(); this.sites = new Map(); this.t = 0;
    const q = new URLSearchParams(location.search); this.on = q.get('chg') !== '0'; this.dc = q.get('fastdc') === '1';
    this.ray = new o.THREE.Raycaster(); this.tex = new Map();
    if (this.on) { this.load(); this.css(); o.canvas.addEventListener('pointerup', e => this.tap(e)); }
  }
  Chargers.prototype.css = function () {
    const st = document.createElement('style');
    st.textContent = '#chgcard{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:30;min-width:260px;max-width:92vw;' +
      'background:rgba(28,30,34,.95);color:#f3f1ec;border-radius:16px;padding:14px 16px;box-shadow:0 6px 24px rgba(0,0,0,.45);font:15px system-ui,sans-serif;display:none}' +
      '#chgcard .n{font-weight:700;font-size:17px;margin-bottom:2px}#chgcard .s{color:#b9b6ae;font-size:13px}' +
      '#chgcard button{margin-top:12px;width:100%;border:0;border-radius:10px;padding:10px;font:600 15px system-ui,sans-serif;background:#45474d;color:#f3f1ec}';
    document.head.appendChild(st);
  };
  Chargers.prototype.load = async function () {
    let j = null;
    try { const c = JSON.parse(localStorage.getItem('tn3_chargers') || 'null'); if (c && c.at && Date.now() - c.at < 24 * 3600e3) j = c.j; } catch (e) {}
    if (!j) {
      try {
        const r = await fetch(URL_ + '?t=' + Math.floor(Date.now() / 3600e3));
        if (r.ok) { j = await r.json(); try { localStorage.setItem('tn3_chargers', JSON.stringify({ at: Date.now(), j })); } catch (e) {} }
      } catch (e) {}
    }
    if (!j || !j.s) return;
    this.list = j.s.map(s => ({ id: s[0], lat: s[1], lon: s[2], name: s[3], stalls: s[4], kw: s[5], kind: s[6], net: s[7] }))
      .filter(s => s.kind === 'sc' || this.dc);
    for (const s of this.list) { const p = this.toL(s.lon, s.lat); s.x = p[0]; s.z = p[1]; }
    this.t = 0;
  };
  /* the pin picture: a rounded square, red (Supercharger) or blue, a white bolt and the number of stalls */
  Chargers.prototype.pinTex = function (s) {
    const key = s.kind + (s.stalls || 0); if (this.tex.has(key)) return this.tex.get(key);
    const T = this.THREE, cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
    x.fillStyle = s.kind === 'sc' ? '#e31937' : '#2f6fd6'; x.strokeStyle = '#fff'; x.lineWidth = 8;
    x.beginPath(); if (x.roundRect) x.roundRect(14, 14, 100, 100, 22); else x.rect(14, 14, 100, 100); x.fill(); x.stroke();
    x.fillStyle = '#fff'; x.beginPath(); x.moveTo(72, 26); x.lineTo(40, 70); x.lineTo(60, 70); x.lineTo(54, 102); x.lineTo(88, 56); x.lineTo(68, 56); x.closePath(); x.fill();
    if (s.stalls) { x.font = 'bold 30px sans-serif'; x.textAlign = 'right'; x.textBaseline = 'top'; x.fillText(String(s.stalls), 108, 20); }
    const m = new T.SpriteMaterial({ map: new T.CanvasTexture(cv), depthTest: false, sizeAttenuation: false });
    this.tex.set(key, m); return m;
  };
  /* the nearest road's direction, so the row of stalls faces it */
  Chargers.prototype.face = function (x, z) {
    let best = null;
    for (const c of this.net.near(x, z, 60)) { const r = this.net.roads[c.k]; if (r.h && Math.max(...r.h) > 0.5) continue; if (!best || c.dist < best.dist) best = c; }
    if (!best || best.dist < 0.5) return 0;
    const px = best.px - x, pz = best.pz - z;            /* toward the road */
    return Math.atan2(px, pz);                           /* the stalls' open side (+z) points that way */
  };
  /* a spot for the site, turned by a (stalls facing +z), moved back (away from the road) until clear of every road */
  Chargers.prototype.clear = function (x, z, a, L, D) {
    const ca = Math.cos(a), sa = Math.sin(a), corners = [];
    for (const lx of [-L - 1, 0, L + 1]) for (const lz of [-0.6, D / 2, D]) corners.push([lx, lz]);
    for (let back = 0; back <= 25; back += 1) {
      const ox = x - sa * back, oz = z - ca * back;          /* back = away from the road (the stalls face it) */
      let ok = true;
      for (const [lx, lz] of corners) {
        const wx = ox + lx * ca + lz * sa, wz = oz - lx * sa + lz * ca;
        for (const c of this.net.near(wx, wz, 20)) { const r = this.net.roads[c.k]; if (r.s === 'parking_aisle') continue; if (c.dist < r.w / 2 + 0.5) { ok = false; break; } }
        if (!ok) break;
      }
      if (ok) return [ox, oz];
    }
    return null;
  };
  Chargers.prototype.site = function (s) {
    const T = this.THREE, n = Math.max(2, Math.min(12, s.stalls || 8)), SW = 2.8, D = 5.5, L = n * SW / 2;
    const box = (x0, x1, y0, y1, z0, z1) => { const g = new T.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return g.toNonIndexed(); };
    const merge = list => {
      let k = 0; for (const g of list) k += g.attributes.position.count;
      const P = new Float32Array(k * 3), N = new Float32Array(k * 3); let o = 0;
      for (const g of list) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; g.dispose(); }
      const m = new T.BufferGeometry(); m.setAttribute('position', new T.BufferAttribute(P, 3)); m.setAttribute('normal', new T.BufferAttribute(N, 3)); return m;
    };
    const M = this.M || (this.M = {
      pad: new T.MeshLambertMaterial({ color: 0x3b3f45 }), line: new T.MeshBasicMaterial({ color: 0xe9ecef }),
      post: new T.MeshLambertMaterial({ color: 0xf3f4f6 }), sc: new T.MeshLambertMaterial({ color: 0xd8213b }),
      dc: new T.MeshLambertMaterial({ color: 0x2f6fd6 }), pole: new T.MeshLambertMaterial({ color: 0x8e959d }), screen: new T.MeshBasicMaterial({ color: 0x1b2733 })
    });
    const lines = [], posts = [], caps = [], scr = [];
    for (let i = 0; i <= n; i++) { const lx = -L + i * SW; lines.push(box(lx - 0.06, lx + 0.06, 0.1, 0.12, 0.2, D - 0.3)); }
    for (let i = 0; i < n; i++) {
      const px = -L + SW * (i + 0.5);
      posts.push(box(px - 0.2, px + 0.2, 0.1, 1.75, -0.35, -0.05), box(px - 0.32, px + 0.32, 0.1, 0.2, -0.45, 0.05));
      caps.push(box(px - 0.21, px + 0.21, 1.75, 1.95, -0.36, -0.04)); scr.push(box(px - 0.13, px + 0.13, 1.25, 1.55, -0.04, -0.02));
    }
    const g = new T.Group(), add = (geo, m) => g.add(new T.Mesh(geo, m));
    add(merge([box(-L - 1, L + 1, 0.05, 0.1, -0.6, D)]), M.pad); add(merge(lines), M.line); add(merge(posts), M.post);
    add(merge(caps), s.kind === 'sc' ? M.sc : M.dc); add(merge(scr), M.screen); add(merge([box(L + 0.4, L + 0.6, 0.1, 4.4, -0.3, -0.1)]), M.pole);
    const sign = new T.Sprite(this.pinTex(s).clone()); sign.material.sizeAttenuation = true; sign.material.depthTest = true; sign.scale.set(1.6, 1.6, 1); sign.position.set(L + 0.5, 5.2, -0.2); g.add(sign);
    /* (Nov 27: 2 of the 9 Superchargers on the map are mapped on a road or parking lane, so their stalls covered it)
       the site slides back from the road until none of it is on any road; no clear spot within 25 m: pin only */
    const a = this.face(s.x, s.z), spot = this.clear(s.x, s.z, a, L, D);
    if (!spot) { g.traverse(o => { if (o.geometry && !o.isSprite) o.geometry.dispose(); }); return null; }
    g.position.set(spot[0], 0, spot[1]); g.rotation.y = a;
    this.scene.add(g); return g;
  };
  Chargers.prototype.drop = function (map, id) {
    const g = map.get(id); if (!g) return; if (g === 'none') { map.delete(id); return; } this.scene.remove(g);
    g.traverse(o => { if (o.geometry && !o.isSprite) o.geometry.dispose(); }); map.delete(id);
  };
  /* every frame: cheap; the lists are rebuilt every 2 s */
  Chargers.prototype.update = function (dt, cx, cz, following) {
    if (!this.on || !this.list.length) return;
    this.t -= dt; if (this.t > 0) return; this.t = 2;
    const pinR = following ? 2000 : 6000, near = [];
    for (const s of this.list) { const d = Math.hypot(s.x - cx, s.z - cz); if (d < pinR) near.push([d, s]); }
    near.sort((a, b) => a[0] - b[0]);
    /* pins (the closest 40) */
    const keepP = new Set(near.slice(0, 40).map(n => n[1].id));
    for (const id of [...this.pins.keys()]) if (!keepP.has(id)) { this.scene.remove(this.pins.get(id)); this.pins.delete(id); }
    for (const [d, s] of near.slice(0, 40)) if (!this.pins.has(s.id)) {
      const sp = new this.THREE.Sprite(this.pinTex(s)); sp.center.set(0.5, 0); sp.scale.set(0.055, 0.055, 1); sp.position.set(s.x, 14, s.z);
      sp.renderOrder = 20; sp.userData.site = s; this.scene.add(sp); this.pins.set(s.id, sp);
    }
    /* 3D sites (within 700 m, at most 6) */
    const keepS = new Set(near.filter(n => n[0] < 700).slice(0, 6).map(n => n[1].id));
    for (const id of [...this.sites.keys()]) if (!keepS.has(id)) this.drop(this.sites, id);
    for (const [d, s] of near) if (keepS.has(s.id) && !this.sites.has(s.id)) { const g = this.site(s); this.sites.set(s.id, g || 'none'); }
  };
  /* tap a pin: its card */
  Chargers.prototype.tap = function (e) {
    if (!this.pins.size) return;
    const r = this.canvas.getBoundingClientRect(), v = new this.THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(v, this.camera);
    const hit = this.ray.intersectObjects([...this.pins.values()], false)[0]; if (!hit) return;
    const s = hit.object.userData.site, c = this.car && this.car(), d = c ? Math.hypot(s.x - c.x, s.z - c.z) / 1000 : null;
    let el = document.getElementById('chgcard'); if (!el) { el = document.createElement('div'); el.id = 'chgcard'; document.body.appendChild(el); }
    const info = [s.kind === 'sc' ? 'Tesla Supercharger' : (s.net || 'Fast charger')];
    if (s.stalls) info.push(s.stalls + ' stalls'); if (s.kw) info.push('up to ' + s.kw + ' kW');
    if (d != null) info.push(d < 10 ? d.toFixed(1) + ' km' : Math.round(d) + ' km');
    el.innerHTML = '<div class="n">' + esc(s.name) + '</div><div class="s">' + info.map(esc).join(' · ') + '</div><button>Close</button>';
    el.style.display = 'block'; el.querySelector('button').onclick = () => { el.style.display = 'none'; };
  };
  root.MKChargers = Chargers;
})(typeof window !== 'undefined' ? window : globalThis);
