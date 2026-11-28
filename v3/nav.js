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
  try { (globalThis.TN = globalThis.TN || {}).MBX = globalThis.TN.MBX || MBX; } catch (e) {}   /* (the voice's Mapbox backup uses it) */
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
      '#nbar{top:calc(16px + env(safe-area-inset-top,0px));display:none;align-items:center;gap:18px;padding:10px 12px 10px 14px;max-width:calc(100vw - 32px)}#nbar b{font:800 22px system-ui}#nbar span{color:#b9b6ae;font-size:15px;display:block}#nbar button{flex:0 0 auto}' +
      '#nbar .t{display:flex;align-items:center;gap:12px;padding-right:18px;border-right:1px solid rgba(255,255,255,.12)}#nbar .t b{font:800 30px system-ui}#nbar .w{font:600 17px system-ui;max-width:34vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#nbar .eta b{font:700 18px system-ui}' +
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
      const items = (j.suggestions || []).filter(s => s.feature_type !== 'category' && s.feature_type !== 'brand' && s.mapbox_id)   /* (a brand, like "Costco", has no one place: the real stores come next, nearest first) */.map(s => ({ name: s.name, sub: s.full_address || s.place_formatted || '', mbid: s.mapbox_id, dist: s.distance }));
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
        '?geometries=geojson&overview=full&steps=true&language=en&voice_instructions=true&voice_units=metric&banner_instructions=true&access_token=' + MBX;
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
    this.idx = 0; this.t = 0; this.man = this.maneuvers(rt); this.said = new Set(); this.draw(true);
  };
  /* (part 2) the turns along the route: where each one is (metres along the line), its arrow, its words, and what to
     say before it. Mapbox gives the words and the spoken sentences; for OSRM (the backup) they're made here */
  Nav.prototype.maneuvers = function (rt) {
    const r = this.route, steps = (rt.legs && rt.legs[0] && rt.legs[0].steps) || [], M = []; let from = 0;
    const words = (m, name) => {
      const mod = m.modifier || '', t = m.type, on = name ? ' onto ' + name : '';
      if (t === 'arrive') return 'Your destination is ' + (mod.includes('left') ? 'on the left' : mod.includes('right') ? 'on the right' : 'ahead');
      if (t === 'roundabout' || t === 'rotary') return 'At the roundabout, take the ' + (['', '1st', '2nd', '3rd', '4th', '5th'][m.exit] || 'next') + ' exit' + on;
      if (t === 'merge') return 'Merge' + on; if (t === 'on ramp') return 'Take the ramp' + on; if (t === 'off ramp') return 'Take the exit' + on;
      if (t === 'fork') return 'Keep ' + (mod.includes('left') ? 'left' : 'right') + on;
      if (mod === 'uturn') return 'Make a U-turn' + on; if (mod === 'straight') return 'Continue' + on;
      return (mod.startsWith('slight') ? 'Bear ' + mod.slice(7) : mod.startsWith('sharp') ? 'Turn sharp ' + mod.slice(6) : 'Turn ' + mod) + on;
    };
    for (let k = 1; k < steps.length; k++) {
      const st = steps[k], m = st.maneuver, p = this.toL(m.location[0], m.location[1]);
      let bi = from, bd = Infinity; for (let i = from; i < r.pts.length; i++) { const d = Math.hypot(r.pts[i][0] - p[0], r.pts[i][1] - p[1]); if (d < bd) { bd = d; bi = i; } if (d > bd + 200) break; }
      from = bi; const prev = steps[k - 1], ban = prev.bannerInstructions && prev.bannerInstructions[0] && prev.bannerInstructions[0].primary;
      M.push({
        s: r.cum[bi], type: (ban && ban.type) || m.type, mod: (ban && ban.modifier) || m.modifier || '', exit: m.exit,
        text: m.instruction || words(m, st.name), street: (ban && ban.text) || st.name || '',
        /* what to say before this turn: Mapbox's sentences (distance before the turn), or ours at 400 m and 60 m */
        voice: (prev.voiceInstructions && prev.voiceInstructions.length) ? prev.voiceInstructions.map(v => ({ d: v.distanceAlongGeometry, t: v.announcement }))
          : [{ d: 400, gen: true, w: words(m, st.name) }, { d: 60, t: words(m, st.name) }]
      });
    }
    return M;
  };
  /* the arrow for a turn (white on the bar) */
  Nav.prototype.arrow = function (m) {
    const t = m.type, mod = m.mod || '', P = 'stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"';
    const svg = p => '<svg width="46" height="46" viewBox="0 0 48 48">' + p + '</svg>';
    if (t === 'arrive') return svg('<circle cx="24" cy="20" r="9" ' + P + '/><path d="M24 29v12" ' + P + '/>');
    if (t === 'roundabout' || t === 'rotary') return svg('<circle cx="24" cy="26" r="9" ' + P + '/><path d="M24 35v9M31 20l8-8M33 12h6v6" ' + P + '/>');
    if (mod === 'uturn') return svg('<path d="M30 42V20a8 8 0 0 0-16 0v4" ' + P + '/><path d="M8 20l6 6 6-6" ' + P + '/>');
    /* drawn for a right turn; a left turn is the mirror image */
    const L = mod.includes('left'), X = x => L ? 48 - x : x, pth = pts => 'M' + pts.map(q => X(q[0]) + ' ' + q[1]).join(' L');
    if (mod === 'straight' || !mod) return svg('<path d="M24 42V8M14 18l10-10 10 10" ' + P + '/>');
    if (mod.startsWith('slight')) return svg('<path d="' + pth([[22, 42], [22, 26], [34, 12]]) + '" ' + P + '/><path d="' + pth([[25, 12], [34, 12], [34, 21]]) + '" ' + P + '/>');
    if (mod.startsWith('sharp')) return svg('<path d="' + pth([[18, 42], [18, 16], [34, 32]]) + '" ' + P + '/><path d="' + pth([[25, 32], [34, 32], [34, 23]]) + '" ' + P + '/>');
    return svg('<path d="' + pth([[16, 42], [16, 22], [38, 22]]) + '" ' + P + '/><path d="' + pth([[30, 14], [38, 22], [30, 30]]) + '" ' + P + '/>');
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
    this.speak(true);
  };
  Nav.prototype.end = function () {
    this.active = false; this.route = null; this.ov.style.display = 'none'; this.bar.style.display = 'none'; document.body.classList.remove('nav-on');
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh = null; }
    this.input.value = ''; this.x.style.display = 'none';
  };
  /* the top bar while driving: arrival time, minutes and km left, End */
  Nav.prototype.bars = function () {
    const r = this.route; if (!r) return; const here = r.cum[this.idx], left = Math.max(0, r.L - here), frac = r.L > 0 ? left / r.L : 0, sec = r.rt.duration * frac;
    /* (part 2) the next turn: arrow, distance (rounded like the car's own: 10 m steps, then 50 m, then km), words, street */
    const m = (this.man || []).find(x => x.s > here + 3), d = m ? Math.max(0, m.s - here) : 0;
    const dd = d < 100 ? Math.round(d / 10) * 10 + ' m' : d < 1000 ? Math.round(d / 50) * 50 + ' m' : (d / 1000).toFixed(d < 10000 ? 1 : 0) + ' km';
    const turn = m ? '<div class="t">' + this.arrow(m) + '<div><b>' + dd + '</b><div class="w">' + esc(m.text.replace(/\.$/, '')) + '</div></div></div>' : '';
    this.bar.style.display = 'flex';
    this.bar.innerHTML = turn + '<div class="eta"><b>' + fmtArr(sec) + '</b><span>' + fmtMin(sec) + ' · ' + fmtKm(left) + '</span></div><button>End</button>';
    this.bar.querySelector('button').onclick = () => this.end();
  };
  /* (part 2) the spoken instructions: each sentence once, when the distance to its turn comes down to its own distance */
  Nav.prototype.speak = function (first) {
    const V = globalThis.TN && TN.voice; if (!V || !this.route) return;
    const here = this.route.cum[this.idx];
    if (first) { const v0 = this.route.rt.legs && this.route.rt.legs[0].steps[0].voiceInstructions; const t0 = v0 && v0[0] ? v0[0].announcement : 'Starting route to ' + this.dest.name; V.say(t0, true); if (v0 && v0[0]) this.said.add('1:0'); }   /* (the route's first sentence belongs to the first turn: said once) */
    for (let k = 0; k < (this.man || []).length; k++) {
      const m = this.man[k], d = m.s - here; if (d < -5) continue; if (d > 2500) break;
      for (let j = 0; j < m.voice.length; j++) {
        const key = (k + 1) + ':' + j, v = m.voice[j]; if (this.said.has(key)) continue;
        if (d <= v.d + 15 && (j === m.voice.length - 1 || d > m.voice[j + 1].d)) {
          this.said.add(key); for (let q = 0; q < j; q++) this.said.add((k + 1) + ':' + q);
          /* (our own warning, for the backup route: the real distance, rounded; none when the turn is already close) */
          if (v.gen) { if (d < 150) continue; V.say('In ' + Math.round(d / 50) * 50 + ' meters, ' + v.w.charAt(0).toLowerCase() + v.w.slice(1), false, false); }
          else V.say(v.t, d < 120, d < 120);
        }
      }
      break;
    }
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
      if (r.L - r.cum[this.idx] < 30 && bd < 40) { this.msg('You have arrived: ' + this.dest.name, 8000); try { TN.voice && TN.voice.say('You have arrived', true); } catch (e) {} this.end(); return; }
      /* off the route for 10 s (more than 40 m away): a new route from here */
      if (bd > 40) { this.off = (this.off || 0) + 0.5; if (this.off > 10 && Date.now() - (this.lastRe || 0) > 15000) { this.off = 0; this.lastRe = Date.now(); this.msg('New route…', 3000); this.plan(true); return; } } else this.off = 0;
      this.slow = (this.slow || 0) + 0.5; if (this.slow >= 1 || moved) { this.slow = 0; this.bars(); }
      this.speak(false);
    }
    /* (heights around the car, and around where you're looking when you move the map: a bridge far ahead gets its height as
       soon as its roads are loaded, so the line isn't hidden under the deck) */
    this.hT = (this.hT || 0) - 0.5; if (this.hT <= 0) { this.hT = 2; let ch = this.heights(cx, cz, 1500); if (vx != null && Math.hypot(vx - cx, vz - cz) > 300) ch = this.heights(vx, vz, 1500) || ch; if (ch || this.active) this.draw(); }
  };
  root.MKNav = Nav;
})(typeof window !== 'undefined' ? window : globalThis);
