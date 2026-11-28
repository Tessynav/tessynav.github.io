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
          it.cat = (f.properties && (f.properties.poi_category || [])).join ? f.properties.poi_category.join(',') : '';
        }
      } catch (e) {}
      this.sess = null;
    }
    if (it.lng == null) { this.msg('Could not open that place', 5000); return; }
    const old = this.recent.find(r => r.name === it.name && Math.abs(r.lat - it.lat) < 1e-4);
    if (old && old.ub && it.ub == null) it.ub = true;   /* (your choice for this place, remembered: v2's "use the building") */
    const keep = { name: it.name, sub: it.sub, lng: it.lng, lat: it.lat, rlng: it.rlng, rlat: it.rlat, ub: it.ub, sc: it.sc, cat: it.cat };
    this.recent = [keep].concat(this.recent.filter(r => r.name !== it.name || Math.abs(r.lat - it.lat) > 1e-4)).slice(0, 6);
    try { localStorage.setItem('tn2_recent', JSON.stringify(this.recent)); } catch (e) {}
    this.dest = Object.assign({}, keep); this.plan();
  };
  /* (Nov 27) the trip recording gets the navigation too: what you picked, where the route really goes, every check */
  Nav.prototype.note = function (k, d) { try { this.rec && this.rec(k, d); } catch (e) {} };
  /* a download that gives up after ms (OpenStreetMap's server can be slow: never hold the route for it) */
  const fetchT = async (url, ms) => {
    const c = typeof AbortController !== 'undefined' ? new AbortController() : null, tm = c ? setTimeout(() => c.abort(), ms) : null;
    try { const r = await fetch(url, c ? { signal: c.signal } : {}); if (tm) clearTimeout(tm); return r.ok ? r : null; } catch (e) { if (tm) clearTimeout(tm); return null; }
  };
  const overpass = async (q, ms) => {
    for (const s of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']) {
      const r = await fetchT(s + '?data=' + encodeURIComponent(q), ms); if (r) { try { return await r.json(); } catch (e) {} }
    }
    return null;
  };
  /* one route from Mapbox (live traffic, leaving the way the car points), else OSRM */
  Nav.prototype.fetchRouteOnce = async function (from, to) {
    try {
      const G = this.gps ? this.gps() : null, brg = G && G.v > 2 && G.hd != null ? '&bearings=' + Math.round(G.hd) + ',60;' : '';
      const u = 'https://api.mapbox.com/directions/v5/mapbox/driving-traffic/' + from[0].toFixed(6) + ',' + from[1].toFixed(6) + ';' + to[0].toFixed(6) + ',' + to[1].toFixed(6) +
        '?geometries=geojson&overview=full&steps=true&language=en&voice_instructions=true&voice_units=metric&banner_instructions=true' + brg + '&access_token=' + MBX;
      const r = await fetch(u); if (r.ok) { const j = await r.json(); if (j.routes && j.routes[0]) return j.routes[0]; }
    } catch (e) {}
    try {
      const u = 'https://router.project-osrm.org/route/v1/driving/' + from[0].toFixed(6) + ',' + from[1].toFixed(6) + ';' + to[0].toFixed(6) + ',' + to[1].toFixed(6) + '?overview=full&geometries=geojson&steps=true';
      const r = await fetch(u); if (!r.ok) return null; const j = await r.json(); return j.routes && j.routes[0] || null;
    } catch (e) { return null; }
  };
  /* does this route end badly? (v2) arriving on a highway, or passing close to the destination, going away and back */
  const badEnding = (rt, to) => {
    const C = rt && rt.geometry && rt.geometry.coordinates; if (!C || C.length < 2) return null;
    const lg = rt.legs && rt.legs[rt.legs.length - 1], st = lg && lg.steps || [];
    let hwy = false; for (let i = Math.max(0, st.length - 3); i < st.length; i++) { const its = st[i].intersections || []; if (its.slice(-2).some(x => (x.classes || []).indexOf('motorway') >= 0)) hwy = true; }
    let first = -1; for (let i = 0; i < C.length; i++) if (distLL(C[i], to) < 120) { first = i; break; }
    let after = 0; if (first >= 0) for (let i = first; i < C.length - 1; i++) after += distLL(C[i], C[i + 1]);
    const loop = first >= 0 && after > 600;
    return hwy || loop ? { hwy, loop, after: Math.round(after) } : null;
  };
  /* the nearest point on a local street (not a highway or its ramp) around a place, from v3's road data */
  Nav.prototype.localStreet = function (to) {
    const q = this.toL(to[0], to[1]); let best = null;
    try { for (const c of this.net.near(q[0], q[1], 250)) { const r = this.net.roads[c.k]; if (!r || /^(motorway|trunk)$/.test(r.c) || r.s === 'link' || r.s === 'driveway') continue; if (!best || c.dist < best.dist) best = c; } } catch (e) {}
    return best && best.px != null ? this.toLL(best.px, best.pz) : null;
  };
  /* where the route should end (worked out once per destination, then kept for reroutes):
     - a Supercharger: the chargers themselves (our charger list), or the garage entrance next to them when OpenStreetMap
       has one (DIX30, Nov 27: the chargers are underground, Mapbox's "car access" was 70 m away on the wrong side)
     - otherwise v2's checks: the car access vs the place itself, the place's parking lot, a bad ending */
  Nav.prototype.fetchRoute = async function (from, to) {
    const d = this.dest || {};
    if (/supercharger/i.test((d.name || '') + ' ' + (d.cat || '')) || d.sc) {
      let best = null, bd = 1e9;
      try { for (const s of (this.chargers && this.chargers()) || []) { if (s.kind !== 'sc') continue; const dd = distLL([d.lng, d.lat], [s.lon, s.lat]); if (dd < bd) { bd = dd; best = s; } } } catch (e) {}
      if (best && bd < 300) {
        let goal = [best.lon, best.lat], ent = null;
        const j = await overpass('[out:json][timeout:6];node(around:120,' + best.lat.toFixed(6) + ',' + best.lon.toFixed(6) + ')["amenity"="parking_entrance"];out;', 3500);
        if (j) { let ed = 1e9; for (const e of j.elements || []) { const dd = distLL([e.lon, e.lat], goal) - (/underground|multi-storey/.test((e.tags || {}).parking || '') ? 30 : 0); if (dd < ed) { ed = dd; ent = e; } } }
        if (ent) goal = [ent.lon, ent.lat];
        this.note('charger destination', { name: d.name, fromPlace: Math.round(bd), entrance: ent ? ent.id : null, osm: j ? 1 : 0 });
        const rt = await this.fetchRouteOnce(from, goal); if (rt) { rt.goal = goal; return rt; }
      }
    }
    let rt = await this.fetchRouteOnce(from, to); if (!rt) throw new Error('no route'); rt.goal = to;
    /* (v2) the car access point can be on a back street: the route to the place itself, when clearly quicker and
       still ending close to it, or ending right at it for at most 1.5 min more */
    try {
      if (!d.ub && d.rlng != null && distLL([d.lng, d.lat], [d.rlng, d.rlat]) > 40) {
        const rt2 = await this.fetchRouteOnce(from, [d.lng, d.lat]);
        if (rt2) {
          const C = rt2.geometry.coordinates, near = distLL(C[C.length - 1], [d.lng, d.lat]);
          const quicker = rt2.duration < rt.duration - 60 || rt2.duration < rt.duration * 0.85, close = near < 40 && rt2.duration <= rt.duration + 90;
          this.note('entrance check', { name: d.name, accessMin: Math.round(rt.duration / 60), placeMin: Math.round(rt2.duration / 60), endFromPlace: Math.round(near), used: !!((quicker && near < 150) || close) });
          if ((quicker && near < 150) || close) { rt = rt2; rt.goal = [d.lng, d.lat]; }
        }
      }
    } catch (e) {}
    /* (v2) a place with its own parking lot within 150 m: the route goes into the lot when that's not much longer */
    try {
      if (!d.ub && distLL(from, [d.lng, d.lat]) > 400) {
        const j = await overpass('[out:json][timeout:6];(nwr(around:150,' + d.lat.toFixed(6) + ',' + d.lng.toFixed(6) + ')["amenity"="parking"]["access"!~"private|no"];);out center tags 20;', 4000);
        let best = null, bd = 1e9;
        for (const e of (j && j.elements) || []) { const c = e.center || (e.lat != null ? { lat: e.lat, lon: e.lon } : null); if (!c) continue; const dd = distLL([d.lng, d.lat], [c.lon, c.lat]); if (dd < bd) { bd = dd; best = c; } }
        if (best && bd < 150) {
          const rt3 = await this.fetchRouteOnce(from, [best.lon, best.lat]);
          if (rt3) {
            const C = rt3.geometry.coordinates, e = C[C.length - 1], inLot = distLL(e, [best.lon, best.lat]), toPlace = distLL(e, [d.lng, d.lat]);
            const ok = inLot < 70 && toPlace < 180 && rt3.duration <= rt.duration + 90;
            this.note('parking lot check', { name: d.name, lotFromPlace: Math.round(bd), endInLot: Math.round(inLot), lotMin: Math.round(rt3.duration / 60), bestMin: Math.round(rt.duration / 60), used: ok });
            if (ok) { rt = rt3; rt.goal = [best.lon, best.lat]; }
          }
        }
      }
    } catch (e) {}
    /* (v2) a bad ending (passing the place, going away and coming back; or ending on a highway): the nearest local street */
    try {
      const bad = badEnding(rt, rt.goal);
      if (bad) {
        const alt = this.localStreet(rt.goal);
        if (alt && distLL(alt, rt.goal) > 3) {
          const rt2 = await this.fetchRouteOnce(from, alt), bad2 = rt2 && badEnding(rt2, alt), better = rt2 && (!bad2 || rt2.duration < rt.duration * 0.9);
          this.note('route ending check', { hwy: bad.hwy, loop: bad.loop, after: bad.after, used: !!better, min: Math.round(rt.duration / 60), min2: rt2 ? Math.round(rt2.duration / 60) : null });
          if (better) { rt = rt2; rt.goal = alt; }
        }
      }
    } catch (e) {}
    return rt;
  };
  Nav.prototype.plan = async function (reroute) {
    if (!reroute) { this.ov.style.display = 'block'; this.ov.innerHTML = '<div>Finding the route…</div>'; }
    try {
      const from = this.here();
      /* a reroute keeps the ending already worked out (the same garage entrance, the same lot) */
      const rt = reroute && this.dest.goal ? await this.fetchRouteOnce(from, this.dest.goal) : await this.fetchRoute(from, routeTo(this.dest));
      if (!rt) throw new Error('no route');
      if (rt.goal) this.dest.goal = rt.goal;
      this.setRoute(rt);
      try {
        const C = rt.geometry.coordinates, e = C[C.length - 1], line = [];
        for (let i = 0, last = null; i < C.length; i++) if (!last || distLL(last, C[i]) > 15 || i === C.length - 1) { last = C[i]; line.push([+C[i][0].toFixed(5), +C[i][1].toFixed(5)]); }
        this.note('route to', { name: this.dest.name, place: [+this.dest.lng.toFixed(5), +this.dest.lat.toFixed(5)], to: (this.dest.goal || []).map(v => +v.toFixed(5)), end: [+e[0].toFixed(5), +e[1].toFixed(5)], km: +(rt.distance / 1000).toFixed(2), min: Math.round(rt.duration / 60), reroute: !!reroute, line });
      } catch (e) {}
      if (!reroute) this.overview();
    } catch (e) {
      this.note('route failed', { reroute: !!reroute, err: String(e && e.message || e) });
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
    this.route = { rt, pts, cum, h: new Float32Array(pts.length), hk: new Uint8Array(pts.length), L: cum[cum.length - 1],
      sx: new Float32Array(pts.length), sz: new Float32Array(pts.length), rk: new Int32Array(pts.length) };   /* (on our own roads, below) */
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
      /* the road the route runs along, going the same way (a one-way road only in its own direction: never the other
         half of a divided road), not one crossing over or under it */
      const a = r.pts[Math.max(0, i - 2)], b = r.pts[Math.min(r.pts.length - 1, i + 2)], dl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / dl, uz = (b[1] - a[1]) / dl;
      let best = null, bestAny = null;
      for (const c of this.net.near(x, z, 14)) {
        if (!bestAny || c.dist < bestAny.dist) bestAny = c;
        const rd = this.net.roads[c.k], dot = c.tx * ux + c.tz * uz;
        if (!(rd.ow ? dot > 0.8 : Math.abs(dot) > 0.8)) continue;
        const sc = c.dist + (/driveway|parking_aisle/.test(rd.s || '') ? 6 : 0);   /* (a driveway beside a street: the street) */
        if (!best || sc < best.sc) best = Object.assign({ sc }, c);
      }
      const h = (best || bestAny) ? this.net.at((best || bestAny).k, (best || bestAny).s).h || 0 : 0;
      if (!r.hk[i] || Math.abs(h - r.h[i]) > 0.05) { r.h[i] = h; r.hk[i] = 1; changed = true; }
      /* (Nov 27) the line laid on OUR road: the middle of a one-way road, the right half of a two-way one (where you
         drive). Kept as a shift from Mapbox's point, smoothed in draw() so it never zigzags */
      if (best && best.dist < 9) {   /* (farther: likely a parallel street, not ours) */
        const rd = this.net.roads[best.k], off = rd && !rd.ow ? rd.w / 4 : 0;
        const sx = best.px - uz * off - x, sz = best.pz + ux * off - z;
        if (r.rk[i] !== best.k + 1 || Math.abs(sx - r.sx[i]) + Math.abs(sz - r.sz[i]) > 0.2) { r.sx[i] = sx; r.sz[i] = sz; r.rk[i] = best.k + 1; changed = true; }
      } else if (r.rk[i]) { r.rk[i] = 0; changed = true; }
    }
    return changed;
  };
  /* the line to draw from point 'from': Mapbox's points shifted onto our roads. The shifts are filled across short gaps,
     faded out at long ones, and smoothed over ~50 m, so the line glides from one road to the next instead of jumping
     (Nov 27, 22:32 drive: before a left turn and before home the line zigzagged across the street) */
  Nav.prototype.lineFrom = function (from, lane) {
    const r = this.route, n = r.pts.length - from, dx = new Float32Array(n), dz = new Float32Array(n), ok = new Uint8Array(n);
    for (let i = 0; i < n; i++) if (r.rk[from + i]) { dx[i] = r.sx[from + i]; dz[i] = r.sz[from + i]; ok[i] = 1; }
    /* your lane: on the road you're on, the line moves to where the car is; it eases back over the last 40 m of that road */
    if (lane) {
      /* (roads are cut in short pieces at every crossing: the lane carries on along the route until it turns) */
      const dir = j => { const a = r.pts[Math.max(0, j - 2)], b = r.pts[Math.min(r.pts.length - 1, j + 2)]; return Math.atan2(b[0] - a[0], b[1] - a[1]); };
      const d0 = dir(Math.min(from + 1, r.pts.length - 1)); let end = 0, miss = 0;
      while (end < n) { let d = dir(from + end) - d0; d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(d) > 0.45) break; miss = r.rk[from + end] ? 0 : miss + 1; if (miss > 3) break; end++; }
      for (let i = 0; i < end; i++) {
        const j = from + i, a = r.pts[Math.max(0, j - 2)], b = r.pts[Math.min(r.pts.length - 1, j + 2)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const f = Math.min(1, (end - 1 - i) / 5); dx[i] += -(b[1] - a[1]) / l * lane.o * f; dz[i] += (b[0] - a[0]) / l * lane.o * f;
      }
    }
    /* gaps: up to 8 points (~64 m) between two known shifts are filled in a straight blend; at longer gaps the shift
       fades to nothing over 4 points */
    let last = -1;
    for (let i = 0; i <= n; i++) {
      if (i < n && !ok[i]) continue;
      const g0 = last + 1, g1 = i - 1;
      if (g1 >= g0) {
        if (last >= 0 && i < n && g1 - g0 < 8) { for (let k = g0; k <= g1; k++) { const t = (k - last) / (i - last); dx[k] = dx[last] + (dx[i] - dx[last]) * t; dz[k] = dz[last] + (dz[i] - dz[last]) * t; } }
        else {
          /* (fading at most ~0.8 m per point: never a sideways step) */
          const La = last >= 0 ? Math.max(4, Math.ceil(Math.hypot(dx[last], dz[last]) / 0.8)) : 1, Lb = i < n ? Math.max(4, Math.ceil(Math.hypot(dx[i], dz[i]) / 0.8)) : 1;
          for (let k = g0; k <= g1; k++) {
            const fa = last >= 0 ? Math.max(0, 1 - (k - last) / La) : 0, fb = i < n ? Math.max(0, 1 - (i - k) / Lb) : 0;
            dx[k] = (last >= 0 ? dx[last] * fa : 0) + (i < n ? dx[i] * fb : 0); dz[k] = (last >= 0 ? dz[last] * fa : 0) + (i < n ? dz[i] * fb : 0);
          }
        }
      }
      last = i;
    }
    const Q = new Array(n), W = [1, 2, 3, 4, 3, 2, 1];
    for (let i = 0; i < n; i++) {
      let sx = 0, sz = 0, sw = 0;
      for (let k = -3; k <= 3; k++) { const j = i + k; if (j < 0 || j >= n) continue; sx += dx[j] * W[k + 3]; sz += dz[j] * W[k + 3]; sw += W[k + 3]; }
      Q[i] = [r.pts[from + i][0] + sx / sw, r.pts[from + i][1] + sz / sw];
    }
    return Q;
  };
  Nav.prototype.draw = function (force) {
    const T = this.THREE, r = this.route; if (!r) return;
    const from = Math.max(0, this.idx - 1), n = r.pts.length - from; if (n < 2) return;
    const P = this.lineFrom(from, this.lane && this.active ? this.lane : null);
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
      /* where the car is across its road, from the line's point on that road (the lane lock keeps it in its lane) */
      this.lane = null;
      if (r.rk[bi]) {
        const a = r.pts[Math.max(0, bi - 1)], b = r.pts[Math.min(r.pts.length - 1, bi + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, rx = -(b[1] - a[1]) / l, rz = (b[0] - a[0]) / l;
        const o = (cx - r.pts[bi][0] - r.sx[bi]) * rx + (cz - r.pts[bi][1] - r.sz[bi]) * rz, rd = this.net.roads[r.rk[bi] - 1];
        if (rd && Math.abs(o) < rd.w / 2 + 0.5) this.lane = { k: r.rk[bi] - 1, o: Math.max(-rd.w / 2 + 1, Math.min(rd.w / 2 - 1, o)) };
      }
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
