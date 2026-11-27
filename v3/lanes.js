/* MapKoon v3 — lanes.js: keeps the car in a lane of a real road.
   Uses only what has already happened (each GPS fix as it arrives), like the car will live.
   1. which road: the nearest road that runs the way you're going and connects to the last one (driveways and parking
      lanes only when slow);
   2. where along it: from your speed, nudged gently toward the GPS; it never goes backwards;
   3. which lane: from the GPS's side-to-side position, but a lane change only after it holds for a couple of seconds;
      then the car glides across over about 2 seconds.
   The car is then drawn on the lane itself, so it follows every curve of the road and can't zigzag. */
(function (root) {
  const CELL = 50;
  /* the road network. It can grow: add() takes more roads (the tiles around the car, as you drive); a road that
     comes in two tiles is kept once (by its 'g' id) */
  function Net(data) {
    this.roads = []; this.grid = new Map(); this.byG = new Map();
    if (data && data.roads) this.add(data.roads);
  }
  Net.prototype.add = function (list) {
    const first = this.roads.length, nw = [];
    let X0 = Infinity, Z0 = Infinity, X1 = -Infinity, Z1 = -Infinity;
    for (const d of list) {
      if (d.g != null) { if (this.byG.has(d.g)) continue; this.byG.set(d.g, this.roads.length); }
      const n = d.p.length / 2, P = new Float64Array(d.p), cs = new Float64Array(n);
      for (let i = 1; i < n; i++) cs[i] = cs[i - 1] + Math.hypot(P[2 * i] - P[2 * i - 2], P[2 * i + 1] - P[2 * i - 1]);
      const k = this.roads.length;
      const r = { id: k, g: d.g, c: d.c, s: d.s, w: d.w, ow: !!d.ow, ln: d.ln || 1, P, h: d.h, cs, n, L: cs[n - 1], ends: [[], []], adj: new Set() };
      this.roads.push(r); nw.push(k);
      for (let i = 0; i < n; i++) { X0 = Math.min(X0, P[2 * i]); X1 = Math.max(X1, P[2 * i]); Z0 = Math.min(Z0, P[2 * i + 1]); Z1 = Math.max(Z1, P[2 * i + 1]); }
      for (let i = 0; i < n - 1; i++) {
        const x0 = Math.min(P[2 * i], P[2 * i + 2]), x1 = Math.max(P[2 * i], P[2 * i + 2]);
        const z0 = Math.min(P[2 * i + 1], P[2 * i + 3]), z1 = Math.max(P[2 * i + 1], P[2 * i + 3]);
        for (let gx = Math.floor(x0 / CELL); gx <= Math.floor(x1 / CELL); gx++)
          for (let gz = Math.floor(z0 / CELL); gz <= Math.floor(z1 / CELL); gz++) {
            const g = gx + ',' + gz; let l = this.grid.get(g); if (!l) this.grid.set(g, l = []); l.push(k, i);
          }
      }
    }
    if (!nw.length) return 0;
    /* roads already here that reach into the new area may now meet a new road: look at them again */
    X0 -= 3; Z0 -= 3; X1 += 3; Z1 += 3;
    const inBox = (x, z) => x >= X0 && x <= X1 && z >= Z0 && z <= Z1, redo = new Set(nw);
    if (first) for (let gx = Math.floor(X0 / CELL); gx <= Math.floor(X1 / CELL); gx++)
      for (let gz = Math.floor(Z0 / CELL); gz <= Math.floor(Z1 / CELL); gz++) {
        const l = this.grid.get(gx + ',' + gz); if (l) for (let j = 0; j < l.length; j += 2) if (l[j] < first) redo.add(l[j]);
      }
    for (const k of redo) {
      const r = this.roads[k], old = k < first;
      /* which roads meet each end: any road passing within 2.5 m of it, at its end or in its middle (a T junction),
         kept as [road, distance along that road] */
      for (const e of [0, 1]) {
        const i = e ? r.n - 1 : 0;
        if (old && !inBox(r.P[2 * i], r.P[2 * i + 1])) continue;
        r.ends[e] = [];
        for (const c of this.near(r.P[2 * i], r.P[2 * i + 1], 2.5)) if (c.k !== k) r.ends[e].push([c.k, c.s]);
      }
      /* roads that touch anywhere (crossings in the middle of both count too) */
      for (let i = 0; i < r.n; i++) {
        if (old && !inBox(r.P[2 * i], r.P[2 * i + 1])) continue;
        for (const c of this.near(r.P[2 * i], r.P[2 * i + 1], 1.2)) if (c.k !== k) { r.adj.add(c.k); this.roads[c.k].adj.add(k); }
      }
    }
    return nw.length;
  };
  Net.prototype.joined = function (a, b) {
    const A = this.roads[a].adj;
    if (A.has(b)) return true;
    /* or through one short piece in between (the gap across a divided road at a junction) */
    for (const L of A) if (this.roads[L].L < 45 && this.roads[L].adj.has(b)) return true;
    return false;
  };
  /* nearest point of every road within 'rad' metres */
  Net.prototype.near = function (x, z, rad) {
    const best = new Map(), seen = new Set();
    for (let gx = Math.floor((x - rad) / CELL); gx <= Math.floor((x + rad) / CELL); gx++)
      for (let gz = Math.floor((z - rad) / CELL); gz <= Math.floor((z + rad) / CELL); gz++) {
        const l = this.grid.get(gx + ',' + gz); if (!l) continue;
        for (let j = 0; j < l.length; j += 2) {
          const k = l[j], i = l[j + 1], sk = k * 100000 + i; if (seen.has(sk)) continue; seen.add(sk);
          const r = this.roads[k], ax = r.P[2 * i], az = r.P[2 * i + 1], bx = r.P[2 * i + 2], bz = r.P[2 * i + 3];
          const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-9;
          const u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
          const px = ax + dx * u, pz = az + dz * u, dist = Math.hypot(x - px, z - pz);
          if (dist > rad) continue;
          const b = best.get(k);
          if (!b || dist < b.dist) {
            const ln = Math.sqrt(L2), tx = dx / ln, tz = dz / ln;
            /* signed side: + = left of the road's drawing direction (x east, z south: left of (tx,tz) is (tz,-tx)) */
            const d = (x - px) * tz - (z - pz) * tx;
            best.set(k, { k, i, u, s: r.cs[i] + ln * u, dist, d, tx, tz });
          }
        }
      }
    return [...best.values()];
  };
  /* a point on a road: position, direction and height at distance s */
  Net.prototype.at = function (k, s) {
    const r = this.roads[k]; s = Math.max(0, Math.min(r.L, s));
    let lo = 0, hi = r.n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (r.cs[m] <= s) lo = m; else hi = m; }
    const seg = r.cs[hi] - r.cs[lo] || 1e-9, u = (s - r.cs[lo]) / seg;
    const ax = r.P[2 * lo], az = r.P[2 * lo + 1], bx = r.P[2 * hi], bz = r.P[2 * hi + 1];
    /* direction blended with the neighbouring pieces, so curves turn smoothly instead of in corners */
    const dir = i => { const j = Math.max(0, Math.min(r.n - 2, i)); const dx = r.P[2 * j + 2] - r.P[2 * j], dz = r.P[2 * j + 3] - r.P[2 * j + 1], l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; };
    const d0 = dir(lo - 1), d1 = dir(lo), d2 = dir(lo + 1);
    let tx = d1[0] + (u < 0.5 ? (d0[0] - d1[0]) * (0.5 - u) : (d2[0] - d1[0]) * (u - 0.5)), tz = d1[1] + (u < 0.5 ? (d0[1] - d1[1]) * (0.5 - u) : (d2[1] - d1[1]) * (u - 0.5));
    const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    const h = r.h[lo] + (r.h[hi] - r.h[lo]) * u;
    return { x: ax + (bx - ax) * u, z: az + (bz - az) * u, tx, tz, h };
  };

  const SLOW_ONLY = { driveway: 1, parking_aisle: 1, alley: 1 };
  function Track(net) { this.net = net; this.st = null; this.lastFix = null; this.stats = { switches: 0, jumps: 0, laneChanges: 0, lost: 0 }; }
  Track.prototype.laneGeo = function (r, dir, lane) {
    const two = !r.ow, band = two ? r.w / 2 : r.w, lw = band / r.ln;
    /* offset from the centre line (+ = left of drawing direction); lane 0 = rightmost in the travel direction */
    return { lw, off: dir > 0 ? (-r.w / 2 + (lane + 0.5) * lw) : (r.w / 2 - (lane + 0.5) * lw) };
  };
  Track.prototype.fix = function (f) {
    /* f: {t (s), x, z (metres), v (m/s), hd (degrees clockwise from north, or null)} */
    const net = this.net, st = this.st, v = f.v || 0;
    /* which way you're going: from your own movement over the last ~1.5 s (the GPS heading can be stale when slow) */
    const H = this.hist || (this.hist = []); H.push(f); while (H.length && f.t - H[0].t > 1.6) H.shift();
    let hv = null; const o = H[0], mvx = f.x - o.x, mvz = f.z - o.z, mvl = Math.hypot(mvx, mvz);
    if (mvl > 3) hv = [mvx / mvl, mvz / mvl];
    else if (f.hd != null && v > 3) hv = [Math.sin(f.hd * Math.PI / 180), -Math.cos(f.hd * Math.PI / 180)];
    const C = net.near(f.x, f.z, 30);
    let best = null; const now = new Map();
    for (const c of C) {
      const r = net.roads[c.k];
      if (SLOW_ONLY[r.s] && v > 5) continue;                       /* (no driveways at street speed: last night's lesson) */
      let dir;
      if (hv) dir = (c.tx * hv[0] + c.tz * hv[1]) >= 0 ? 1 : -1;
      else if (st && st.k === c.k) dir = st.dir; else dir = 1;
      if (r.ow && dir < 0) { if (v > 1) continue; dir = 1; }
      const band = r.ow ? r.w / 2 : r.w / 4, ctr = r.ow ? 0 : -dir * r.w / 4;
      /* how far outside your half of the road you are, counting past-the-end too (a road that has ended is not yours) */
      const out = Math.hypot(Math.max(0, Math.abs(c.d - ctr) - band), Math.sqrt(Math.max(0, c.dist * c.dist - c.d * c.d)));
      let cost = (out * out) / 16 + c.dist * 0.02;
      if (hv) cost += (1 - Math.abs(c.tx * hv[0] + c.tz * hv[1])) * (v > 4 ? 10 : 3);
      if (st && !st.free) {
        if (st.k === c.k) cost += 0;
        else if (net.joined(st.k, c.k)) cost += 0.4;
        else cost += 2.5;
      }
      if (r.s === 'link') cost += 0.2;
      /* (Nov 26 21:15 drive, Nuns' Island: in the roundabout the car turned into the Bell campus entrance for a second,
         the GPS being 1.5 m to the inside; this afternoon, same roundabout, it didn't) a service road (an entrance, a
         lane behind buildings) only wins over a street when you're clearly on it, not on a 1-2 m GPS wobble */
      if (r.c === 'service' && v > 3 && !(st && !st.free && net.roads[st.k] && net.roads[st.k].c === 'service')) cost += 1.5;
      const cand = Object.assign({ cost, dir }, c); now.set(c.k, cand);
      if (!best || cost < best.cost) best = cand;
    }
    /* (step 3) judge each road over the last ~1.2 s, not one fix: one odd GPS point near a junction can't flip the car
       onto the wrong branch and back */
    const A = this.acc || (this.acc = new Map()), dt0 = this.lastFix ? Math.max(0.02, Math.min(1, f.t - this.lastFix.t)) : 0.1;
    const keep = Math.exp(-dt0 / 1.2);
    for (const [k, sc] of A) if (!now.has(k)) { const n = sc + 3 * (1 - keep); if (n > 12) A.delete(k); else A.set(k, n); }
    for (const [k, c] of now) A.set(k, A.has(k) ? A.get(k) * keep + c.cost * (1 - keep) : c.cost + 0.8);
    let pick = best;
    if (pick && st && !st.free && pick.k !== st.k && now.has(st.k)) {
      const r = net.roads[st.k], cur = now.get(st.k);
      const atEnd = st.dir > 0 ? (r.L - cur.s < 12) : (cur.s < 12);
      /* at the end of the current road: take the best next one right away. Before the end: switch only when the other
         road is clearly better now AND has been better over the last second */
      const stay = atEnd ? cur.cost <= pick.cost + 0.3 : (cur.cost <= pick.cost + 1.2 || A.get(st.k) <= A.get(pick.k) + 0.3);
      if (stay) pick = Object.assign({}, cur, { dir: st.dir });
    }
    best = pick;
    if (!best || best.cost > 14) {                                 /* nowhere sensible: off the map (a lot, a garage) */
      if (st && !st.free) this.stats.lost++;
      this.st = { free: true, x: f.x, z: f.z, hd: f.hd, v, t: f.t }; this.lastFix = f; return;
    }
    const r = net.roads[best.k];
    if (!st || st.free || st.k !== best.k) {
      if (st && !st.free) {
        this.stats.switches++;
        if (!net.joined(st.k, best.k)) this.stats.jumps++;
      }
      /* lane: keep the same lane number across a junction when it still exists, else the measured one */
      const g0 = this.laneGeo(r, best.dir, 0), u = best.dir > 0 ? best.d + r.w / 2 : r.w / 2 - best.d;
      const meas = Math.max(0, Math.min(r.ln - 1, Math.floor(u / g0.lw)));
      /* (v3, Nov 26 17:06 drive: where lanes are added or merge, keeping the lane NUMBER moved the car sideways) keep the
         car where it is drawn across the road instead, and pick the lane under it on the new road */
      let lane = meas, lat = this.laneGeo(r, best.dir, meas).off;
      if (st && !st.free) {
        const here = this.raw && net.near(this.raw.x, this.raw.z, 12).find(c => c.k === best.k);
        if (here) {
          const uh = best.dir > 0 ? here.d + r.w / 2 : r.w / 2 - here.d;
          lane = Math.max(0, Math.min(r.ln - 1, Math.floor(uh / g0.lw))); lat = Math.max(-r.w / 2, Math.min(r.w / 2, here.d));
        } else if (st.lane < r.ln) { lane = st.lane; lat = st.lat; }
      }
      /* (v3, Nov 26 drive: right after turning onto the next road the car raced ~5 m ahead) start on the new road where the
         car is drawn now, not where the GPS is: the gentle catch-up below closes any gap instead of a sudden slide */
      let s0 = best.s;
      if (st && !st.free && this.raw) for (const c of net.near(this.raw.x, this.raw.z, 12)) if (c.k === best.k && Math.abs(c.s - best.s) < 20) s0 = c.s;
      this.st = { k: best.k, dir: best.dir, s: s0, lane, lat, v, t: f.t, acc: 0 };
    } else {
      /* (v3, Nov 26 drive: pulling away from a stop, the car surged ahead at twice your speed for a second) the GPS's
         own speed lags when you speed up, so the car fell behind and then raced to catch up. Now the speed also comes
         from how fast the GPS moves along the road over the last second, and catching up is spread out gently */
      const dt = Math.max(0, f.t - st.t);
      const HS = st.hs || (st.hs = []); HS.push([f.t, best.s]); while (HS.length > 2 && f.t - HS[0][0] > 1.2) HS.shift();
      let vAlong = null; if (f.t - HS[0][0] > 0.6) vAlong = Math.max(0, (best.s - HS[0][1]) * st.dir / (f.t - HS[0][0]));
      const vUse = vAlong != null && vAlong > v && vAlong < v * 1.6 + 3 ? (v + vAlong) / 2 : v;
      /* (the GPS sends nothing while you're stopped, sometimes for 20 s: the next fix must not move the car all at once) */
      const sPred = st.s + st.dir * ((st.v + vUse) / 2) * Math.min(dt, 1), gap = best.s - sPred;
      const cap = (0.2 * vUse + 0.3 + 0.1 * Math.abs(gap)) * Math.min(dt, 0.25);   /* at most ~20% faster or slower than you, a bit more if far off */
      let s = sPred + Math.max(-cap, Math.min(cap, 0.15 * gap));
      if (Math.abs(gap) > 25) s = best.s;                          /* far off: trust the GPS */
      else if ((s - st.s) * st.dir < 0) s = st.s;                  /* never backwards */
      st.s = Math.max(0, Math.min(r.L, s)); st.v = vUse; st.t = f.t; st.dir = best.dir;
      /* lane change only when the GPS stays in the other lane for 2.5 s and is clearly in it */
      const g0 = this.laneGeo(r, st.dir, 0), u = st.dir > 0 ? best.d + r.w / 2 : r.w / 2 - best.d;
      const meas = Math.max(0, Math.min(r.ln - 1, Math.floor(u / g0.lw)));
      /* (v3, Nov 26 15:27 drive: the car changed lanes on the Champlain Bridge while you didn't) the GPS slowly drifts
         sideways, a couple of metres over a minute; that alone moved the car to another lane. A real lane change is a
         quick sideways move (about a lane in a few seconds): now the car changes lane only after one; a slow drift
         changes it only if it stays in the other lane for half a minute (to correct a wrong start) */
      const LH = st.lh || (st.lh = []); LH.push([f.t, u]); while (LH.length > 2 && f.t - LH[0][0] > 8) LH.shift();
      const moved = u - LH[0][1], want = (st.lane + 0.5) * g0.lw, off = u - want;
      const out = meas !== st.lane && Math.abs(off) > 0.8 * g0.lw;
      const quick = out && Math.sign(moved) === Math.sign(off) && Math.abs(moved) > 0.55 * g0.lw;
      if (out) { st.acc = quick ? st.acc + dt : st.acc; st.slow = (st.slow || 0) + dt; } else { st.acc = 0; st.slow = 0; }
      if (st.acc > 2.0 || st.slow > 30) { st.lane = meas; st.acc = 0; st.slow = 0; st.lh = [[f.t, u]]; this.stats.laneChanges++; }
      st.lane = Math.min(st.lane, r.ln - 1);
    }
    this.lastFix = f;
  };
  /* where to draw the car at time t (between fixes it keeps moving at your speed along the lane) */
  Track.prototype.pose = function (t, dt) {
    const st = this.st, net = this.net; if (!st) return null;
    if (st.free) return this.blend({ x: st.x, z: st.z, h: 0, hd3: st.hd != null ? Math.atan2(Math.sin(st.hd * Math.PI / 180), -Math.cos(st.hd * Math.PI / 180)) : 0, free: true }, dt);
    let k = st.k, dir = st.dir, s = st.s + dir * st.v * Math.max(0, Math.min(1, t - st.t));
    let r = net.roads[k];
    /* past the end of this road piece: carry on into the connecting piece that continues straightest */
    for (let n = 0; n < 3 && (s > r.L || s < 0); n++) {
      const e = s > r.L ? 1 : 0, over = e ? s - r.L : -s, here = net.at(k, e ? r.L : 0);
      let nb = null, bd = -2;
      for (const [k2, s2] of r.ends[e]) {
        const r2 = net.roads[k2]; if (SLOW_ONLY[r2.s] && st.v > 5) continue;
        const p2 = net.at(k2, s2);
        for (const d2 of [1, -1]) {
          if (r2.ow && d2 < 0) continue;
          if ((d2 > 0 && s2 > r2.L - 1) || (d2 < 0 && s2 < 1)) continue;   /* (that way the road ends right here) */
          const dot = (here.tx * dir) * (p2.tx * d2) + (here.tz * dir) * (p2.tz * d2);
          if (dot > bd) { bd = dot; nb = [k2, d2, s2 + d2 * over]; }
        }
      }
      if (!nb || bd < 0.3) { s = Math.max(0, Math.min(r.L, s)); break; }
      k = nb[0]; dir = nb[1]; s = nb[2]; r = net.roads[k];
    }
    /* glide toward the lane's centre (about 1.5 m/s sideways) */
    const want = this.laneGeo(r, dir, Math.min(st.lane, r.ln - 1)).off;
    if (k === st.k) { const step = 1.5 * (dt || 0.033); st.lat += Math.max(-step, Math.min(step, want - st.lat)); }
    const lat = k === st.k ? st.lat : want;
    const p = net.at(k, s);
    /* left of drawing direction is (tz, -tx) */
    return this.blend({ x: p.x + p.tz * lat, z: p.z - p.tx * lat, h: p.h, hd3: Math.atan2(p.tx * dir, p.tz * dir), k, lane: st.lane, road: r }, dt);
  };
  /* when the answer changes suddenly (a new road chosen at a junction), slide there over about a second instead of jumping
     (v3, Nov 26: was half a second, which looked like a push forward after turns) */
  Track.prototype.blend = function (p, dt) {
    const r0 = this.raw, v = (this.st && this.st.v) || 0; dt = dt || 0.033;
    this.ox = this.ox || 0; this.oz = this.oz || 0; this.oy = this.oy || 0; this.oh = this.oh || 0;
    if (r0) {
      /* where the car should be if it just kept going: last answer moved forward at your speed */
      const ex = r0.x + Math.sin(p.hd3) * v * dt, ez = r0.z + Math.cos(p.hd3) * v * dt, jump = Math.hypot(p.x - ex, p.z - ez);
      if (jump > 0.25 && jump < 40) { this.ox += ex - p.x; this.oz += ez - p.z; this.oy += (r0.h || 0) - p.h; }
      let dh = p.hd3 - r0.hd3; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); if (Math.abs(dh) > 0.12) this.oh -= dh;
    }
    this.raw = p;
    const k = Math.exp(-dt / 0.8);
    /* (v3, Nov 26, 9:49 drive: after slow turns the car still swung forward at twice your speed) the slide is also limited
       in speed: never more than about half your speed on top of your own, so the car never looks like it's racing */
    const o = Math.hypot(this.ox, this.oz), shrink = o * (1 - k), maxStep = (0.5 * v + 1.0) * dt;
    const ko = o > 0 && shrink > maxStep ? (o - maxStep) / o : k;
    this.ox *= ko; this.oz *= ko; this.oy *= k; this.oh *= k;
    const q = Object.assign({}, p, { x: p.x + this.ox, z: p.z + this.oz, h: p.h + this.oy, hd3: p.hd3 + this.oh });
    /* (step 3) the car steers like a car: it follows its lane with a quarter-second of give, so a sharp corner in the map
       (two roads meeting at a junction) becomes a smooth arc instead of a snap; on straight roads nothing changes */
    const lp = this.lp;
    if (lp && Math.hypot(q.x - lp.x, q.z - lp.z) < 30) {
      const a = 1 - Math.exp(-dt / 0.25), nx = lp.x + (q.x - lp.x) * a, nz = lp.z + (q.z - lp.z) * a;
      let dh = q.hd3 - lp.hd3; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      this.lp = { x: nx, z: nz, h: lp.h + (q.h - lp.h) * a, hd3: lp.hd3 + dh * (1 - Math.exp(-dt / 0.3)) };
    } else this.lp = { x: q.x, z: q.z, h: q.h, hd3: q.hd3 };
    return Object.assign(q, this.lp);
  };
  const api = { Net, Track };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MKLanes = api;
})(typeof window !== 'undefined' ? window : globalThis);
