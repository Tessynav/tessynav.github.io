/* MapKoon v3 — nav.js (part 1, Nov 27 2026): search a destination, see the route on the v3 map, drive it.
   Moved from v2 (step 6), rebuilt for v3's ready-made map. Part 2 adds turn-by-turn (arrow, next turn, voice).
   - search: results as you type (Mapbox, near you first; Photon when Mapbox can't), your recent places and Home /
     Work when the box is empty (the same saved places as v2)
   - route: Mapbox with live traffic (OSRM when Mapbox can't): an overview with minutes, km and arrival, then Go
   - the route: a blue line laid on v3's own roads, bridges included (heights from the road network around you),
     trimmed behind the car while driving; arrival within 30 m; End route
   Light on the car's computer: the line is rebuilt at most every 2 s, only near the car. */
(function (root) {
  const MBX = 'pk.eyJ1IjoibXpud2F0dGFyIiwiYSI6ImNtdzNramNhMDAyaXIyeW9na3FpYnVtN2gifQ.Y9UmNDaEoXj0RRMTJLV-_g';   /* (only works on app.mapkoon.com) */
  const esc = t => String(t == null ? '' : t).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const distLL = (a, b) => { const R = 6371000, p = Math.PI / 180, dLa = (b[1] - a[1]) * p, dLo = (b[0] - a[0]) * p, s = Math.sin(dLa / 2) ** 2 + Math.cos(a[1] * p) * Math.cos(b[1] * p) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)); };
  const routeTo = p => p.rlng != null && !p.ub ? [p.rlng, p.rlat] : [p.lng, p.lat];
  const fmtMin = s => { const m = Math.max(1, Math.round(s / 60)); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0'); };
  const fmtKm = m => m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m < 10000 ? (m / 1000).toFixed(1) : Math.round(m / 1000)) + ' km';
  const fmtArr = s => new Date(Date.now() + s * 1000).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });

  function Nav(o) {
    /* o: {THREE, scene, net, toL(lon,lat)->[x,z], toLL(x,z)->[lon,lat], here()->[lon,lat], driving(on), look(x,z), msg(text,ms)} */
    Object.assign(this, o); this.route = null; this.active = false; this.mesh = null; this.qn = 0; this.t = 0; this.idx = 0;
    this.recent = []; try { this.recent = JSON.parse(localStorage.getItem('tn2_recent') || '[]') || []; } catch (e) {}
    this.places = {}; try { this.places = JSON.parse(localStorage.getItem('tn2_places') || '{}') || {}; } catch (e) {}
    this.build();
  }
  Nav.prototype.build = function () {
    const st = document.createElement('style');
    st.textContent =
      '#nsearch{position:absolute;right:calc(16px + env(safe-area-inset-right,0px));top:calc(16px + env(safe-area-inset-top,0px));width:min(40vw,480px);z-index:20;' +
      'background:rgba(28,30,34,.95);border-radius:14px;box-shadow:0 2px 10px rgba(0,0,0,.3);display:flex;align-items:center}' +
      '#nsearch input{flex:1;min-width:0;background:transparent;border:0;outline:0;color:#f3f1ec;font:18px system-ui,sans-serif;padding:14px 16px}' +
      '#nsearch .x{padding:0 14px;cursor:pointer;color:#b9b6ae;font:600 20px system-ui;display:none}' +
      '#nres{position:absolute;right:calc(16px + env(safe-area-inset-right,0px));top:calc(76px + env(safe-area-inset-top,0px));width:min(40vw,480px);max-height:56vh;overflow:auto;z-index:20;' +
      'background:rgba(28,30,34,.97);border-radius:14px;padding:6px;display:none;box-shadow:0 6px 24px rgba(0,0,0,.4)}' +
      '#nres .r{display:flex;align-items:center;gap:12px;padding:13px 12px;border-radius:12px;cursor:pointer;font-size:17px;color:#f3f1ec}#nres .r:active,#nres .r:hover{background:rgba(255,255,255,.08)}' +
      '#nres .r small{display:block;color:#b9b6ae;font-size:13px;margin-top:2px}#nres .d{margin-left:auto;color:#b9b6ae;font-size:14px;white-space:nowrap}' +
      '#nres .hd{font-size:12px;letter-spacing:.06em;color:#8d97a6;padding:10px 12px 2px}#nres .msg{padding:12px;color:#b9b6ae}' +
      '#nov,#nbar{position:absolute;left:50%;transform:translateX(-50%);z-index:21;background:rgba(28,30,34,.96);color:#f3f1ec;border-radius:16px;box-shadow:0 6px 24px rgba(0,0,0,.45);font:16px system-ui,sans-serif;display:none}' +
      '#nov{bottom:calc(96px + env(safe-area-inset-bottom,0px));min-width:300px;max-width:92vw;padding:14px 16px}#nov .n{font-weight:700;font-size:18px}#nov .s{color:#b9b6ae;font-size:13px;margin-top:2px}' +
      '#nov .big{font:800 26px system-ui;margin-top:10px}#nov .big small{font:600 15px system-ui;color:#b9b6ae;margin-left:8px}#nov .row{display:flex;gap:8px;margin-top:12px}' +
      '#nov button,#nbar button{flex:1;border:0;border-radius:10px;padding:11px 14px;font:600 16px system-ui;background:#45474d;color:#f3f1ec;cursor:pointer}#nov button.go{background:#e8913a;color:#2b1a08}' +
      '#nbar{top:calc(16px + env(safe-area-inset-top,0px));display:none;align-items:center;gap:16px;padding:10px 12px 10px 18px}#nbar b{font:800 22px system-ui}#nbar span{color:#b9b6ae;font-size:15px}#nbar button{flex:0 0 auto}' +
      'body.nav-on #msg{top:calc(84px + env(safe-area-inset-top,0px))}body.nav-on #nsearch,body.nav-on #nres{display:none!important}';
    document.head.appendChild(st);
    const box = document.createElement('div'); box.id = 'nsearch'; box.innerHTML = '<input placeholder="Search a place or address" enterkeyhint="search" autocomplete="off"><span class="x">✕</span>'; document.body.appendChild(box);
    this.res = document.createElement('div'); this.res.id = 'nres'; document.body.appendChild(this.res);
    this.ov = document.createElement('div'); this.ov.id = 'nov'; document.body.appendChild(this.ov);
    this.bar = document.createElement('div'); this.bar.id = 'nbar'; document.body.appendChild(this.bar);
    this.input = box.querySelector('input'); this.x = box.querySelector('.x');
    let tm = 0;
    this.input.addEventListener('focus', () => { if (!this.input.value) this.start(); });
    this.input.addEventListener('input', () => {
      this.x.style.display = this.input.value ? 'block' : 'none'; clearTimeout(tm);
      const q = this.input.value.trim(); if (q.length < 2) { this.start(); return; }
      tm = setTimeout(() => this.search(q), 250);
    });
    this.input.addEventListener('keydown', e => { if (e.key === 'Enter') { const f = this.res.querySelector('.r'); if (f) f.click(); } if (e.key === 'Escape') this.close(); });
    this.x.onclick = () => { this.input.value = ''; this.x.style.display = 'none'; this.start(); this.input.focus(); };
    document.addEventListener('pointerdown', e => { if (!box.contains(e.target) && !this.res.contains(e.target)) this.res.style.display = 'none'; });
  };
  Nav.prototype.close = function () { this.res.style.display = 'none'; this.input.blur(); };
  /* the empty box: Home, Work, your recent places */
  Nav.prototype.start = function () {
    const h = this.here(), rows = [];
    for (const k of ['home', 'work']) { const p = this.places[k]; if (p && p.lng != null) rows.push(Object.assign({}, p, { name: k === 'home' ? 'Home' : 'Work', sub: p.name || p.sub || '' })); }
    for (const r of this.recent.slice(0, 6)) if (r && r.lng != null) rows.push(r);
    if (!rows.length) { this.res.style.display = 'none'; return; }
    this.list(rows, null, 'Recent');
  };
  Nav.prototype.list = function (items, msg, head) {
    const h = this.here();
    this.res.innerHTML = (head ? '<div class="hd">' + esc(head.toUpperCase()) + '</div>' : '') + (msg ? '<div class="msg">' + esc(msg) + '</div>' : '') +
      items.map((it, i) => {
        const d = it.lng != null ? distLL(h, [it.lng, it.lat]) : it.dist;
        return '<div class="r" data-i="' + i + '"><div>' + esc(it.name) + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '</div>' + (d != null ? '<span class="d">' + fmtKm(d) + '</span>' : '') + '</div>';
      }).join('');
    this.res.style.display = items.length || msg ? 'block' : 'none';
    this.res.querySelectorAll('.r').forEach(el => el.onclick = () => this.pick(items[+el.dataset.i]));
  };
  Nav.prototype.search = async function (q) {
    const h = this.here(), my = ++this.qn;
    try {
      if (!this.sess) this.sess = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const u = 'https://api.mapbox.com/search/searchbox/v1/suggest?q=' + encodeURIComponent(q) + '&language=en&country=ca,us&limit=8&proximity=' + h[0].toFixed(5) + ',' + h[1].toFixed(5) +
        '&origin=' + h[0].toFixed(5) + ',' + h[1].toFixed(5) + '&session_token=' + this.sess + '&access_token=' + MBX;
      const r = await fetch(u); if (!r.ok) throw 0; const j = await r.json(); if (my !== this.qn) return;
      const items = (j.suggestions || []).filter(s => s.feature_type !== 'category' && s.mapbox_id).map(s => ({ name: s.name, sub: s.full_address || s.place_formatted || '', mbid: s.mapbox_id, dist: s.distance }));
      if (items.length) { this.list(items); return; }
    } catch (e) {}
    try {
      const u = 'https://photon.komoot.io/api/?q=' + encodeURIComponent(q) + '&lat=' + h[1].toFixed(4) + '&lon=' + h[0].toFixed(4) + '&limit=7&lang=en';
      const r = await fetch(u); if (!r.ok) throw 0; const j = await r.json(); if (my !== this.qn) return;
      const items = (j.features || []).map(f => {
        const p = f.properties || {}, c = f.geometry.coordinates;
        return { name: p.name || [p.housenumber, p.street].filter(Boolean).join(' ') || p.city || 'Place', sub: [p.street, p.city].filter(Boolean).join(' · '), lng: c[0], lat: c[1] };
      });
      this.list(items, items.length ? null : 'Nothing found');
    } catch (e) { if (my === this.qn) this.list([], 'Search is not available right now'); }
  };
  /* a place picked: its exact spot (and where cars reach it), remembered in Recent, then the route */
  Nav.prototype.pick = async function (it) {
    this.close(); this.input.value = it.name; this.x.style.display = 'block';
    if (it.lng == null && it.mbid) {
      try {
        const r = await fetch('https://api.mapbox.com/search/searchbox/v1/retrieve/' + encodeURIComponent(it.mbid) + '?session_token=' + this.sess + '&access_token=' + MBX);
        const j = await r.json(), f = j.features && j.features[0];
        if (f) {
          it.lng = f.geometry.coordinates[0]; it.lat = f.geometry.coordinates[1];
          const rp = f.properties && f.properties.coordinates && f.properties.coordinates.routable_points;
          if (rp && rp.length) { const d = rp.find(p => p.name === 'default') || rp[0]; if (d && d.latitude != null) { it.rlng = d.longitude; it.rlat = d.latitude; } }
        }
      } catch (e) {}
      this.sess = null;
    }
    if (it.lng == null) { this.msg('Could not open that place', 5000); return; }
    const keep = { name: it.name, sub: it.sub, lng: it.lng, lat: it.lat, rlng: it.rlng, rlat: it.rlat };
    this.recent = [keep].concat(this.recent.filter(r => r.name !== it.name || Math.abs(r.lat - it.lat) > 1e-4)).slice(0, 6);
    try { localStorage.setItem('tn2_recent', JSON.stringify(this.recent)); } catch (e) {}
    this.dest = keep; this.plan();
  };
  Nav.prototype.fetchRoute = async function (from, to) {
    try {
      const u = 'https://api.mapbox.com/directions/v5/mapbox/driving-traffic/' + from[0].toFixed(6) + ',' + from[1].toFixed(6) + ';' + to[0].toFixed(6) + ',' + to[1].toFixed(6) +
        '?geometries=geojson&overview=full&steps=true&language=en&access_token=' + MBX;
      const r = await fetch(u); if (r.ok) { const j = await r.json(); if (j.routes && j.routes[0]) return j.routes[0]; }
    } catch (e) {}
    const u = 'https://router.project-osrm.org/route/v1/driving/' + from[0].toFixed(6) + ',' + from[1].toFixed(6) + ';' + to[0].toFixed(6) + ',' + to[1].toFixed(6) + '?overview=full&geometries=geojson&steps=true';
    const r = await fetch(u); if (!r.ok) throw new Error('route'); const j = await r.json(); if (!j.routes || !j.routes[0]) throw new Error('no route'); return j.routes[0];
  };
  Nav.prototype.plan = async function (reroute) {
    if (!reroute) { this.ov.style.display = 'block'; this.ov.innerHTML = '<div>Finding the route…</div>'; }
    try {
      const rt = await this.fetchRoute(this.here(), routeTo(this.dest));
      this.setRoute(rt);
      if (!reroute) this.overview();
    } catch (e) {
      if (!reroute) { this.ov.innerHTML = '<div>Could not find a route</div><div class="row"><button>Close</button></div>'; this.ov.querySelector('button').onclick = () => this.end(); }
    }
  };
  /* the route in local metres, a point every 8 m (so the line follows the road's height on bridges and ramps) */
  Nav.prototype.setRoute = function (rt) {
    const P = rt.geometry.coordinates.map(c => this.toL(c[0], c[1])), pts = [];
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 8));
      for (let k = 0; k < n; k++) pts.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    }
    pts.push(P[P.length - 1]);
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    this.route = { rt, pts, cum, h: new Float32Array(pts.length), hk: new Uint8Array(pts.length), L: cum[cum.length - 1] };
    this.idx = 0; this.t = 0; this.draw(true);
  };
  /* the height of the road under each point near the car (only roads already loaded around you are known) */
  Nav.prototype.heights = function (cx, cz, R) {
    const r = this.route; let changed = false;
    for (let i = this.idx; i < r.pts.length; i++) {
      const [x, z] = r.pts[i]; if (Math.abs(x - cx) > R || Math.abs(z - cz) > R) continue;
      /* the road the route runs along (same direction), not one crossing over or under it */
      const a = r.pts[Math.max(0, i - 1)], b = r.pts[Math.min(r.pts.length - 1, i + 1)], dl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / dl, uz = (b[1] - a[1]) / dl;
      let best = null, bestAny = null;
      for (const c of this.net.near(x, z, 9)) {
        if (!bestAny || c.dist < bestAny.dist) bestAny = c;
        if (Math.abs(c.tx * ux + c.tz * uz) > 0.7 && (!best || c.dist < best.dist)) best = c;
      }
      best = best || bestAny;
      const h = best ? this.net.at(best.k, best.s).h || 0 : 0;
      if (!r.hk[i] || Math.abs(h - r.h[i]) > 0.05) { r.h[i] = h; r.hk[i] = 1; changed = true; }
    }
    return changed;
  };
  Nav.prototype.draw = function (force) {
    const T = this.THREE, r = this.route; if (!r) return;
    const from = Math.max(0, this.idx - 1), P = r.pts.slice(from), n = P.length; if (n < 2) return;
    const pos = new Float32Array(n * 2 * 3), idx = [], W = this.wide ? 6 : 1.6;
    for (let i = 0; i < n; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l, y = r.h[from + i] + 0.3;
      pos.set([P[i][0] + nx * W, y, P[i][1] + nz * W, P[i][0] - nx * W, y, P[i][1] - nz * W], i * 6);
      if (i < n - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setIndex(idx);
    if (!this.mat) this.mat = new T.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.88, depthWrite: false, fog: false, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -12 });
    if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.geometry = g; }
    else { this.mesh = new T.Mesh(g, this.mat); this.mesh.renderOrder = 5; this.mesh.frustumCulled = false; this.scene.add(this.mesh); }
  };
  Nav.prototype.overview = function () {
    const rt = this.route.rt, d = this.dest;
    this.ov.style.display = 'block';
    this.ov.innerHTML = '<div class="n">' + esc(d.name) + '</div>' + (d.sub ? '<div class="s">' + esc(d.sub) + '</div>' : '') +
      '<div class="big">' + fmtMin(rt.duration) + '<small>' + fmtKm(rt.distance) + ' · arrive ' + fmtArr(rt.duration) + '</small></div>' +
      '<div class="row"><button class="go">Go</button><button class="cancel">Cancel</button></div>';
    this.ov.querySelector('.go').onclick = () => this.go();
    this.ov.querySelector('.cancel').onclick = () => this.end();
    /* the map shows the destination's end of the route */
    const e = this.route.pts[this.route.pts.length - 1]; this.look(e[0], e[1]);
  };
  Nav.prototype.go = function () {
    this.active = true; this.ov.style.display = 'none'; document.body.classList.add('nav-on'); this.driving(true); this.t = 0; this.bars();
    this.msg('Turn-by-turn directions come in the next update: follow the blue line', 6000);
  };
  Nav.prototype.end = function () {
    this.active = false; this.route = null; this.ov.style.display = 'none'; this.bar.style.display = 'none'; document.body.classList.remove('nav-on');
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh = null; }
    this.input.value = ''; this.x.style.display = 'none';
  };
  /* the top bar while driving: arrival time, minutes and km left, End */
  Nav.prototype.bars = function () {
    const r = this.route; if (!r) return; const left = Math.max(0, r.L - r.cum[this.idx]), frac = r.L > 0 ? left / r.L : 0, sec = r.rt.duration * frac;
    this.bar.style.display = 'flex';
    this.bar.innerHTML = '<b>' + fmtArr(sec) + '</b><span>' + fmtMin(sec) + ' · ' + fmtKm(left) + '</span><button>End</button>';
    this.bar.querySelector('button').onclick = () => this.end();
  };
  /* every frame (cheap): where the car is along the route, every 0.5 s; heights and the line every 2 s */
  Nav.prototype.update = function (dt, cx, cz, camH, vx, vz) {
    const r = this.route; if (!r) return;
    /* (seen from high up, a wider line so it stays visible) */
    const wide = (camH || 0) > 600; if (wide !== !!this.wide) { this.wide = wide; this.draw(); }
    this.t -= dt; if (this.t > 0) return; this.t = 0.5;
    if (this.active) {
      /* the nearest point ahead (looking up to ~400 m ahead of the last one, never backwards by more than a little) */
      let bi = this.idx, bd = Infinity;
      for (let i = Math.max(0, this.idx - 5); i < Math.min(r.pts.length, this.idx + 50); i++) { const d = Math.hypot(r.pts[i][0] - cx, r.pts[i][1] - cz); if (d < bd) { bd = d; bi = i; } }
      const moved = bi !== this.idx; this.idx = bi;
      if (r.L - r.cum[this.idx] < 30 && bd < 40) { this.msg('You have arrived: ' + this.dest.name, 8000); this.end(); return; }
      /* off the route for 10 s (more than 40 m away): a new route from here */
      if (bd > 40) { this.off = (this.off || 0) + 0.5; if (this.off > 10 && Date.now() - (this.lastRe || 0) > 15000) { this.off = 0; this.lastRe = Date.now(); this.msg('New route…', 3000); this.plan(true); return; } } else this.off = 0;
      this.slow = (this.slow || 0) + 0.5; if (this.slow >= 2 || moved) { this.slow = 0; this.bars(); }
    }
    /* (heights around the car, and around where you're looking when you move the map: a bridge far ahead gets its height as
       soon as its roads are loaded, so the line isn't hidden under the deck) */
    this.hT = (this.hT || 0) - 0.5; if (this.hT <= 0) { this.hT = 2; let ch = this.heights(cx, cz, 1500); if (vx != null && Math.hypot(vx - cx, vz - cz) > 300) ch = this.heights(vx, vz, 1500) || ch; if (ch || this.active) this.draw(); }
  };
  root.MKNav = Nav;
})(typeof window !== 'undefined' ? window : globalThis);
