// ================= 3D exercise demonstrations =================
// Procedural anatomical body as a single SkinnedMesh bound to a bone skeleton.
// Poses are driven per frame by bone rotations (two-bone IK for limbs), so the
// mesh, muscle colours and equipment all move together. Rest pose: upright,
// facing +Z, character's left = +X, metres.
const REP3D = (() => {
  const SRC = 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js';
  const SRI = 'sha384-RRHfJ6w1mTlKUBMYT/hvnRiOzEB/vyRV3DrQOseb6oYfvaZSfdd0byS4bHps0k2R'; // integrity of the pinned build; update together with SRC
  let loading = null;
  function load() {
    if (window.THREE) return Promise.resolve();
    if (!loading) loading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = SRC; s.async = true; s.crossOrigin = 'anonymous'; s.integrity = SRI;
      s.onload = () => (window.THREE ? res() : rej(new Error('three')));
      s.onerror = () => { loading = null; rej(new Error('load')); };
      document.head.append(s);
    });
    return loading;
  }
  function webglOk() {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
  }

  // ---------- small math helpers ----------
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const sstep5 = (t) => { t = clamp(t, 0, 1); return t * t * t * (t * (6 * t - 15) + 10); };
  const lin = (c) => Math.pow(c, 2.2);
  const rgb = (r, g, b) => [lin(r), lin(g), lin(b)];
  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const SKIN = rgb(0.8, 0.805, 0.815), SHORTS = rgb(0.22, 0.22, 0.235), RED = rgb(0.8, 0.24, 0.17), PINK = rgb(0.92, 0.6, 0.52);
  const line = (d, w = 0.005) => Math.exp(-(d * d) / (w * w));
  const shadeC = (c, k) => [c[0] * (1 - k), c[1] * (1 - k), c[2] * (1 - k)];
  function table(rows) { // [[y, v1, v2, ...]] sorted by y desc or asc -> interpolator
    const r = rows.slice().sort((a, b) => a[0] - b[0]);
    return (y) => {
      if (y <= r[0][0]) return r[0].slice(1);
      for (let i = 1; i < r.length; i++) if (y <= r[i][0]) {
        const a = r[i - 1], b = r[i], t = (y - a[0]) / (b[0] - a[0]), u = t * t * (3 - 2 * t);
        return a.slice(1).map((v, k) => v + (b[k + 1] - v) * u);
      }
      return r[r.length - 1].slice(1);
    };
  }
  function polyDist(px, py, poly) { // signed distance (negative inside)
    let d = Infinity, inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, ay] = poly[j], [bx, by] = poly[i];
      const ex = bx - ax, ey = by - ay, t = clamp(((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey), 0, 1);
      d = Math.min(d, Math.hypot(px - ax - ex * t, py - ay - ey * t));
      if ((ay > py) !== (by > py) && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) inside = !inside;
    }
    return inside ? -d : d;
  }
  const soft = (poly, u, y, w = 0.018) => sstep(w, -w, polyDist(u, y, poly));

  // ---------- skeleton ----------
  const BONES = ['pelvis', 'spine1', 'spine2', 'neck', 'head', 'clavL', 'upperL', 'foreL', 'handL', 'clavR', 'upperR', 'foreR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
  const BI = Object.fromEntries(BONES.map((b, i) => [b, i]));
  function buildSkeleton(THREE) {
    const B = {};
    const mk = (name, parent, x, y, z) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); if (parent) B[parent].add(b); B[name] = b; };
    mk('pelvis', null, 0, 0.98, 0);
    mk('spine1', 'pelvis', 0, 0.12, 0);
    mk('spine2', 'spine1', 0, 0.15, 0);
    mk('neck', 'spine2', 0, 0.21, 0);
    mk('head', 'neck', 0, 0.1, 0.01);
    for (const [s, sx] of [['L', 1], ['R', -1]]) {
      mk('clav' + s, 'spine2', sx * 0.03, 0.17, -0.01);
      mk('upper' + s, 'clav' + s, sx * 0.165, 0, 0);
      mk('fore' + s, 'upper' + s, 0, -0.29, 0);
      mk('hand' + s, 'fore' + s, 0, -0.26, 0);
      mk('thigh' + s, 'pelvis', sx * 0.095, -0.06, 0);
      mk('shin' + s, 'thigh' + s, 0, -0.43, 0);
      mk('foot' + s, 'shin' + s, 0, -0.42, 0);
    }
    return B;
  }

  // ---------- geometry accumulator ----------
  function Geo() { return { pos: [], col: [], uv: [], si: [], sw: [], idx: [], bulge: [], seams: [] }; }
  function pushW(G, ws) {
    const w = ws.filter((x) => x[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const tot = w.reduce((a, x) => a + x[1], 0) || 1;
    for (let k = 0; k < 4; k++) { G.si.push(w[k] ? BI[w[k][0]] : 0); G.sw.push(w[k] ? w[k][1] / tot : 0); }
  }
  // generic sweep: rings along t in [0,1]; point(t, th) -> {p:[x,y,z], c:[r,g,b], w:[[bone,w]], b: bulge}
  function sweep(G, n, m, point, center) {
    const base = G.pos.length / 3;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      for (let j = 0; j <= m; j++) {
        const th = (j / m) * Math.PI * 2;
        const v = point(t, th);
        G.pos.push(v.p[0], v.p[1], v.p[2]); G.col.push(v.c[0], v.c[1], v.c[2]);
        G.uv.push(v.u0 ? 0.004 : 0.03 + 0.94 * (j / m), v.v ?? t); pushW(G, v.w); G.bulge.push(v.b || 0);
      }
      G.seams.push([base + i * (m + 1), base + i * (m + 1) + m]);
    }
    // orientation check using the first quad against radial direction
    const P = (k) => [G.pos[k * 3], G.pos[k * 3 + 1], G.pos[k * 3 + 2]];
    const a0 = base + Math.floor(n / 2) * (m + 1), b0 = a0 + 1, c0 = a0 + m + 1;
    const A = P(a0), Bv = P(b0), C = P(c0), ctr = center(0.5 + 0.5 / n);
    const e1 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]], e2 = [Bv[0] - A[0], Bv[1] - A[1], Bv[2] - A[2]];
    const nrm = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const out = [A[0] - ctr[0], A[1] - ctr[1], A[2] - ctr[2]];
    const flip = nrm[0] * out[0] + nrm[1] * out[1] + nrm[2] * out[2] < 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const a = base + i * (m + 1) + j, b = a + 1, c = a + m + 1, d = c + 1;
      if (flip) G.idx.push(a, b, c, b, d, c); else G.idx.push(a, c, b, b, c, d);
    }
  }

  // ---------- body parts ----------
  // muscles: object of key -> 1 (primary) | 2 (secondary)
  function bodyGeometry(mus) {
    const G = Geo();
    let SIDE = null; // 'L' | 'R' while painting a limb or torso half
    const lv = (k) => { const l = mus[k] === 1 ? 1 : mus[k] === 2 ? 2 : 0; if (!l || !mus.side || !SIDE || SIDE === mus.side) return l; return mus.unilateral && mus.unilateral.includes(k) ? 0 : 2; };
    const paint = (c, k, mask) => { const l = lv(k); if (!l || mask <= 0) return c; return mix3(c, l === 1 ? RED : PINK, mask); };
    const bulgeOf = (k, mask, amt) => (lv(k) === 1 ? mask * amt : lv(k) === 2 ? mask * amt * 0.4 : 0);

    // torso: superellipse cross-sections, front/back depth, glutes and chest shaping
    const tw = table([[0.8, 0.07, 0.07, 0.07], [0.84, 0.115, 0.085, 0.1], [0.9, 0.165, 0.1, 0.125], [0.97, 0.168, 0.105, 0.12], [1.04, 0.152, 0.104, 0.095], [1.1, 0.142, 0.1, 0.08], [1.18, 0.152, 0.11, 0.09], [1.26, 0.172, 0.126, 0.104], [1.32, 0.182, 0.135, 0.112], [1.38, 0.19, 0.125, 0.108], [1.43, 0.17, 0.09, 0.09], [1.47, 0.12, 0.065, 0.07], [1.5, 0.07, 0.05, 0.055], [1.52, 0.03, 0.03, 0.03]]);
    const Y0 = 0.8, Y1 = 1.52;
    sweep(G, 72, 56, (t, th) => {
      const y = Y1 - (Y1 - Y0) * t;
      let [rx, zf, zb] = tw(y);
      const s = Math.sin(th), c = Math.cos(th);
      const ex = 2 / 2.6;
      let x = Math.sign(s) * Math.pow(Math.abs(s), ex) * rx;
      let z = Math.sign(c) * Math.pow(Math.abs(c), ex) * (c > 0 ? zf : zb);
      const u = Math.abs(x) / rx;
      // pecs: two mounds with a sternum groove
      if (c > 0) z += c * 0.016 * sstep(1.22, 1.29, y) * sstep(1.41, 1.33, y) * Math.sin(Math.PI * clamp(Math.abs(x) / 0.17, 0, 1)) - 0.004 * c * sstep(0.05, 0, Math.abs(x)) * sstep(1.2, 1.3, y);
      // abs: gentle segmented relief
      if (c > 0.3 && y > 0.98 && y < 1.22) z += 0.004 * Math.cos((y - 0.98) * 40) * sstep(0.12, 0.02, Math.abs(x));
      // spinal groove and erector ridges, scapulae, lats flare
      if (c < 0) {
        z -= 0.006 * sstep(0.03, 0, Math.abs(x)) * sstep(0.95, 1.05, y);
        z += -0.008 * sstep(0.02, 0.05, Math.abs(x)) * sstep(0.11, 0.06, Math.abs(x)) * sstep(0.98, 1.05, y) * sstep(1.26, 1.16, y);
        z += -0.012 * sstep(0.04, 0.09, Math.abs(x)) * sstep(0.16, 0.11, Math.abs(x)) * sstep(1.26, 1.32, y) * sstep(1.44, 1.36, y);
        x *= 1 + 0.06 * sstep(1.14, 1.26, y) * sstep(1.4, 1.3, y) * sstep(0.5, 0.9, u);
        z -= 0.03 * sstep(0.84, 0.9, y) * sstep(1.04, 0.95, y) * (1 - u * u) * (-c); // glutes
      }
      const P = [x, y, z - 0.005];
      // weights
      const ws = [['pelvis', sstep(1.08, 0.98, y)], ['spine1', sstep(0.98, 1.08, y) * sstep(1.28, 1.16, y)], ['spine2', sstep(1.16, 1.28, y)]];
      const sh = sstep(0.1, 0.17, Math.abs(x)) * sstep(1.3, 1.42, y) * 0.55;
      if (sh > 0) { ws.forEach((w) => { w[1] *= 1 - sh; }); ws.push([x > 0 ? 'clavL' : 'clavR', sh]); }
      // colour
      let col = y < 1.02 ? SHORTS : SKIN;
      if (y >= 1.0 && y < 1.025) col = mix3(SHORTS, SKIN, (y - 1.0) / 0.025);
      const back = sstep(0.06, -0.02, z), front = sstep(0.03, 0.08, z), au = Math.abs(x);
      const PL = [[0.03, 1.03], [0.1, 1.06], [0.17, 1.15], [0.195, 1.28], [0.19, 1.38], [0.15, 1.35], [0.08, 1.27], [0.03, 1.2]];
      const PU = [[0, 1.14], [0.06, 1.23], [0.13, 1.35], [0.16, 1.43], [0.1, 1.47], [0.03, 1.5], [0, 1.5]];
      const PC = [[0.01, 1.24], [0.17, 1.25], [0.19, 1.37], [0.12, 1.41], [0.01, 1.4]];
      const PA = [[0, 1.0], [0.1, 1.02], [0.12, 1.23], [0, 1.23]];
      const dL = polyDist(au, y, PL), dU = polyDist(au, y, PU), dC = polyDist(au, y, PC), dA = polyDist(au, y, PA);
      SIDE = x >= 0 ? 'L' : 'R';
      const latsSide = sstep(0.08, 0.0, z), E = 0.011;
      const lats = sstep(E, -E, dL) * latsSide, ub = sstep(E, -E, dU) * back;
      const chest = sstep(E, -E, dC) * front, abs = sstep(E, -E, dA) * front;
      let b = 0, dark = 0;
      if (y > 1.02) {
        col = paint(col, 'chest', chest); col = paint(col, 'abs', abs);
        col = paint(col, 'lats', lats); col = paint(col, 'upperback', ub);
        b = bulgeOf('lats', lats, 0.01) + bulgeOf('upperback', ub, 0.008);
        // anatomical separations: muscle borders, spine, scapula, linea alba, ribs/serratus
        dark += 0.42 * line(dL) * latsSide + 0.4 * line(dU) * back + 0.34 * line(dC) * front + 0.26 * line(dA) * front;
        dark += 0.22 * line(au, 0.006) * sstep(1.0, 1.1, y) * (back + front);
        const scap = polyDist(au, y, [[0.06, 1.44], [0.075, 1.3], [0.13, 1.24], [0.17, 1.31], [0.16, 1.43]]);
        dark += 0.2 * line(scap, 0.005) * back;
        if (front > 0 && y > 1.03 && y < 1.22) dark += 0.16 * line(((y - 1.03) % 0.06) - 0.03, 0.004) * sstep(0.12, 0.08, au);
        if (au > 0.13 && y > 1.12 && y < 1.3) dark += 0.12 * line(((y - 1.12) % 0.045) - 0.022, 0.004) * sstep(0.02, 0.06, z + 0.04);
      }
      dark += 0.25 * line(y - 1.015, 0.004);
      SIDE = null;
      return { p: P, c: shadeC(col, Math.min(0.5, dark)), w: ws, b, v: y < 1.02 ? 0 : t * 3, u0: y < 1.02 };
    }, (t) => [0, Y1 - (Y1 - Y0) * t, 0]);

    // neck
    sweep(G, 14, 24, (t, th) => {
      const y = 1.53 - 0.12 * t + 0.0;
      const yy = 1.66 - 0.2 * t;
      const r = 0.05 + 0.012 * sstep(1.5, 1.46, yy);
      const P = [Math.sin(th) * r * 1.05, yy, Math.cos(th) * r * 0.95 + 0.005];
      return { p: P, c: SKIN, w: [['spine2', sstep(1.5, 1.44, yy)], ['neck', sstep(1.44, 1.5, yy) * sstep(1.62, 1.56, yy)], ['head', sstep(1.56, 1.62, yy)]], v: t };
    }, (t) => [0, 1.66 - 0.2 * t, 0.005]);

    // head: faceless egg with jaw, rigid to head bone
    const HC = [0, 1.665, 0.02];
    sweep(G, 30, 36, (t, th) => {
      const phi = t * Math.PI; // 0 top .. pi bottom
      const sy = Math.cos(phi), sr = Math.sin(phi);
      let rx = 0.077, rz = 0.096, ry = 0.112;
      const c = Math.cos(th), s = Math.sin(th);
      const lower = sstep(0.05, -0.7, sy), jaw = sstep(-0.35, -0.85, sy);
      rx *= 1 - 0.2 * lower - 0.12 * jaw * (1 - Math.max(0, c));
      rz *= 1 - 0.1 * lower;
      let zoff = 0;
      if (c < 0) zoff -= 0.012 * sstep(-0.3, 0.4, sy) * sstep(0.95, 0.5, sy) * (-c); // occiput
      if (c < 0) zoff += 0.03 * lower * (-c); // back of neck under the skull
      if (c > 0) zoff -= 0.01 * sstep(0.6, 0.0, Math.abs(s)) * sstep(0.1, 0.4, sy) * c; // flatter face plane
      if (c > 0) zoff += 0.006 * jaw * c; // chin
      const P = [HC[0] + s * sr * rx, HC[1] + sy * ry, HC[2] + c * sr * rz + zoff];
      return { p: P, c: SKIN, w: [['head', 1]], v: 0, u0: true };
    }, () => HC);

    // ears
    for (const sx of [1, -1]) {
      sweep(G, 10, 14, (t, th) => {
        const y = 1.692 - 0.062 * t, k = Math.sin(Math.PI * clamp(t * 1.05, 0, 1));
        const P = [sx * (0.073 + 0.008 * k * (0.6 + 0.4 * Math.cos(th))), y, 0.004 + Math.sin(th) * 0.017 * k * (1 - 0.25 * t)];
        return { p: P, c: SKIN, w: [['head', 1]], v: 0, u0: true };
      }, (t) => [sx * 0.075, 1.692 - 0.062 * t, 0.004]);
    }
    // limbs
    for (const [S, sx] of [['L', 1], ['R', -1]]) {
      // arm: y from deltoid top 1.47 to wrist 0.865
      const aw = table([[0.86, 0.028, 0.024], [0.9, 0.03, 0.026], [1.0, 0.037, 0.03], [1.07, 0.044, 0.036], [1.11, 0.043, 0.036], [1.14, 0.038, 0.037], [1.2, 0.043, 0.046], [1.28, 0.048, 0.052], [1.36, 0.058, 0.055], [1.42, 0.06, 0.056], [1.455, 0.045, 0.045], [1.475, 0.015, 0.015]]);
      const ax = sx * 0.195;
      SIDE = S;
      sweep(G, 64, 30, (t, th) => {
        const y = 1.475 - (1.475 - 0.865) * t;
        let [rl, rf] = aw(y);
        const s = Math.sin(th), c = Math.cos(th);
        let fr = c * rf, lat = s * rl;
        fr += 0.011 * Math.max(0, c) ** 2 * sstep(1.17, 1.23, y) * sstep(1.36, 1.28, y); // biceps
        fr -= 0.012 * Math.max(0, -c) ** 2 * sstep(1.2, 1.26, y) * sstep(1.4, 1.32, y); // triceps
        lat += 0.008 * Math.max(0, s) * sstep(1.3, 1.36, y) * sstep(1.47, 1.4, y); // deltoid
        fr += 0.006 * c * sstep(1.0, 1.06, y) * sstep(1.12, 1.07, y); // forearm belly
        const P = [ax + sx * lat, y, fr];
        const ws = [['clav' + S, sstep(1.42, 1.47, y)], ['upper' + S, sstep(1.47, 1.42, y) * sstep(1.09, 1.17, y)], ['fore' + S, sstep(1.17, 1.09, y) * sstep(0.85, 0.89, y)], ['hand' + S, sstep(0.89, 0.85, y)]];
        let col = SKIN, b = 0;
        const rear = sstep(-0.1, -0.5, c) * sstep(1.3, 1.36, y) * sstep(1.49, 1.43, y);
        const bic = sstep(0.25, 0.6, c) * sstep(1.17, 1.21, y) * sstep(1.38, 1.33, y);
        const fdel = sstep(0.1, 0.5, c) * sstep(1.3, 1.36, y) * sstep(1.49, 1.43, y);
        const tri = sstep(-0.2, -0.6, c) * sstep(1.17, 1.22, y) * sstep(1.38, 1.32, y);
        const delts = sstep(1.3, 1.36, y) * sstep(1.49, 1.43, y);
        col = paint(col, 'delts', delts); col = paint(col, 'rearDelts', rear); col = paint(col, 'frontDelts', fdel);
        col = paint(col, 'biceps', bic); col = paint(col, 'triceps', tri);
        b = bulgeOf('biceps', bic, 0.012) + bulgeOf('rearDelts', rear, 0.004);
        let dark = 0.26 * line(y - (1.3 + 0.03 * Math.abs(s)), 0.006) * (y > 1.25 ? 1 : 0); // deltoid insertion
        dark += 0.22 * line(c, 0.09) * sstep(1.15, 1.2, y) * sstep(1.34, 1.28, y); // biceps/triceps groove
        dark += 0.18 * line(c - 0.55, 0.08) * sstep(1.12, 1.08, y) * sstep(0.93, 0.98, y); // forearm
        dark += 0.15 * line(y - 1.135, 0.008);
        return { p: P, c: shadeC(col, dark), w: ws, b, v: t * 2 };
      }, (t) => [ax, 1.475 - 0.61 * t, 0]);
      SIDE = null;

      // leg: y from 1.0 to 0.04
      const lw = table([[0.04, 0.026, 0.026], [0.08, 0.03, 0.032], [0.15, 0.033, 0.035], [0.25, 0.042, 0.046], [0.33, 0.05, 0.056], [0.4, 0.052, 0.058], [0.46, 0.047, 0.048], [0.5, 0.05, 0.05], [0.56, 0.06, 0.06], [0.66, 0.07, 0.07], [0.78, 0.078, 0.08], [0.88, 0.085, 0.085], [0.95, 0.085, 0.08], [1.0, 0.05, 0.05]]);
      const lx = sx * 0.095;
      sweep(G, 80, 30, (t, th) => {
        const y = 1.0 - 0.96 * t;
        let [rl, rf] = lw(y);
        const s = Math.sin(th), c = Math.cos(th);
        let fr = c * rf, lat = s * rl;
        fr -= 0.016 * Math.max(0, -c) ** 2 * sstep(0.26, 0.32, y) * sstep(0.44, 0.38, y); // calf
        fr += 0.01 * Math.max(0, c) * sstep(0.58, 0.66, y) * sstep(0.86, 0.74, y); // quads
        lat -= 0.008 * Math.max(0, -s) * Math.max(0, c) * sstep(0.52, 0.56, y) * sstep(0.66, 0.6, y); // vastus medialis
        const P = [lx + sx * lat, y, fr];
        const ws = [['pelvis', sstep(0.9, 0.98, y)], ['thigh' + S, sstep(0.98, 0.9, y) * sstep(0.45, 0.53, y)], ['shin' + S, sstep(0.53, 0.45, y)]];
        let col = y > 0.8 ? SHORTS : SKIN;
        if (y > 0.78 && y <= 0.8) col = mix3(SKIN, SHORTS, (y - 0.78) / 0.02);
        const quads = sstep(0.0, 0.4, c) * sstep(0.52, 0.58, y) * sstep(0.8, 0.76, y);
        const hams = sstep(0.0, -0.4, c) * sstep(0.52, 0.58, y) * sstep(0.8, 0.76, y);
        const calves = sstep(-0.1, -0.5, c) * sstep(0.18, 0.24, y) * sstep(0.46, 0.4, y);
        col = paint(col, 'quads', quads); col = paint(col, 'hams', hams); col = paint(col, 'calves', calves);
        let dark = 0;
        if (y < 0.8) {
          dark += 0.2 * line(c - 0.35, 0.08) * sstep(0.56, 0.62, y) * sstep(0.8, 0.7, y) + 0.2 * line(c + 0.1, 0.08) * sstep(0.56, 0.62, y) * sstep(0.8, 0.72, y);
          dark += 0.22 * line(c + 0.35, 0.09) * sstep(0.2, 0.26, y) * sstep(0.44, 0.36, y) + 0.12 * line(y - 0.5, 0.01) * Math.max(0, c);
          dark += 0.3 * line(y - 0.795, 0.005);
        }
        return { p: P, c: shadeC(col, dark), w: ws, v: y > 0.8 ? 0 : t * 3, u0: y > 0.8 };
      }, (t) => [lx, 1.0 - 0.96 * t, 0]);

      // foot: along +Z from heel to toe, rigid to foot bone
      const fx = lx;
      sweep(G, 22, 22, (t, th) => {
        const z = -0.065 + 0.255 * t;
        const prof = table([[-0.065, 0.006, 0.006, 0.03], [-0.05, 0.026, 0.03, 0.035], [0.0, 0.034, 0.045, 0.04], [0.06, 0.042, 0.035, 0.03], [0.12, 0.046, 0.022, 0.018], [0.16, 0.04, 0.016, 0.013], [0.19, 0.01, 0.008, 0.01]]);
        const [w, hu, cy] = prof(z);
        const s = Math.sin(th), c = Math.cos(th);
        const P = [fx + s * w * (s * sx > 0 ? 1 : 0.92), cy + c * (c > 0 ? hu : Math.min(hu, cy - 0.004)), z];
        return { p: P, c: SKIN, w: [['foot' + S, 1]], v: 0, u0: true };
      }, (t) => [fx, 0.03, -0.065 + 0.255 * t]);
    }
    // hands: left = fist gripping a neutral handle, right = flat palm (support)
    sweep(G, 20, 24, (t, th) => {
      const y = 0.875 - 0.11 * t;
      const prof = table([[0.765, 0.008, 0.01], [0.775, 0.022, 0.034], [0.8, 0.026, 0.046], [0.84, 0.024, 0.042], [0.865, 0.022, 0.032], [0.875, 0.012, 0.02]]);
      const [rl, rf] = prof(y);
      const s = Math.sin(th), c = Math.cos(th);
      let fr = c * rf; const lat = s * rl;
      fr += 0.008 * Math.max(0, c) * sstep(0.82, 0.84, y) * sstep(0.87, 0.85, y) * sstep(0.2, 0.8, -s); // thumb pad
      return { p: [0.195 + lat, y, fr], c: SKIN, w: [['handL', 1]], v: 0, u0: true };
    }, (t) => [0.195, 0.875 - 0.11 * t, 0]);
    sweep(G, 20, 24, (t, th) => {
      const y = 0.875 - 0.19 * t;
      const prof = table([[0.685, 0.004, 0.01], [0.7, 0.008, 0.03], [0.76, 0.011, 0.042], [0.82, 0.014, 0.044], [0.86, 0.015, 0.034], [0.875, 0.01, 0.02]]);
      const [rt, rw] = prof(y);
      const s = Math.sin(th), c = Math.cos(th);
      return { p: [-0.195 + s * rt, y, c * rw], c: SKIN, w: [['handR', 1]], v: 0, u0: true };
    }, (t) => [-0.195, 0.875 - 0.19 * t, 0]);
    return G;
  }

  function fiberTexture(THREE) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 110; i++) {
      const x = 10 + rnd() * 236, w = 0.5 + rnd() * 0.9, a = 0.025 + rnd() * 0.045;
      g.strokeStyle = `rgba(70,70,76,${a})`; g.lineWidth = w;
      g.beginPath(); g.moveTo(x, 0);
      for (let y = 0; y <= 256; y += 16) g.lineTo(x + Math.sin(y / 40 + i) * 3, y);
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4, 1);
    return tex;
  }

  function buildBody(THREE, mus) {
    const B = buildSkeleton(THREE);
    const G = bodyGeometry(mus);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(G.pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(G.col, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(G.uv, 2));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(G.si, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(G.sw, 4));
    geo.setIndex(G.idx);
    geo.computeVertexNormals();
    const N = geo.attributes.normal;
    for (const [a, b] of G.seams) {
      const x = N.getX(a) + N.getX(b), y = N.getY(a) + N.getY(b), z = N.getZ(a) + N.getZ(b), l = Math.hypot(x, y, z) || 1;
      N.setXYZ(a, x / l, y / l, z / l); N.setXYZ(b, x / l, y / l, z / l);
    }
    // contraction morph target: target muscles swell along their normals
    const morph = new Float32Array(G.pos.length);
    for (let i = 0; i < G.pos.length / 3; i++) {
      const k = G.bulge[i];
      morph[i * 3] = G.pos[i * 3] + N.getX(i) * k; morph[i * 3 + 1] = G.pos[i * 3 + 1] + N.getY(i) * k; morph[i * 3 + 2] = G.pos[i * 3 + 2] + N.getZ(i) * k;
    }
    geo.morphAttributes.position = [new THREE.Float32BufferAttribute(morph, 3)];
    const fib = fiberTexture(THREE);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.66, metalness: 0, bumpMap: fib, bumpScale: 0.022 });
    const mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.add(B.pelvis);
    mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(BONES.map((n) => B[n])));
    mesh.frustumCulled = false;
    return { mesh, B };
  }

  // ---------- posing helpers ----------
  function Poser(THREE, B) {
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const m4 = new THREE.Matrix4(), qW = new THREE.Quaternion(), qP = new THREE.Quaternion();
    function setWorld(bone, x, y, z) { m4.makeBasis(x, y, z); qW.setFromRotationMatrix(m4); bone.parent.getWorldQuaternion(qP); bone.quaternion.copy(qP.invert().multiply(qW)); bone.updateMatrixWorld(true); }
    // point bone's local -Y along dir, local +Z toward front hint
    function aim(bone, dir, front) {
      const y = dir.clone().normalize().negate();
      const z = front.clone().sub(y.clone().multiplyScalar(front.dot(y))).normalize();
      const x = new THREE.Vector3().crossVectors(y, z);
      setWorld(bone, x, y, z);
    }
    const wpos = (bone) => bone.getWorldPosition(new THREE.Vector3());
    // two-bone IK; pole = where the middle joint points; frontSign: +1 knees, -1 elbows
    function ik(b1, b2, target, pole, frontSign) {
      const A = wpos(b1), l1 = b2.position.length(), l2 = (b2.children[0] ? b2.children[0].position.length() : 0.26);
      const d = target.clone().sub(A); let dist = d.length();
      dist = clamp(dist, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-4);
      const dir = d.normalize();
      const pd = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
      const ca = clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1), sa = Math.sqrt(1 - ca * ca);
      const M = A.clone().add(dir.clone().multiplyScalar(ca * l1)).add(pd.clone().multiplyScalar(sa * l1));
      const E = A.clone().add(dir.clone().multiplyScalar(dist));
      const front = pd.clone().multiplyScalar(frontSign);
      aim(b1, M.clone().sub(A), front);
      aim(b2, E.clone().sub(M), front);
      return { M, E };
    }
    return { V, aim, ik, setWorld, wpos };
  }

  // ---------- equipment ----------
  function standardMat(THREE, c, rough = 0.6, metal = 0) { return new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal }); }
  function dumbbell(THREE) {
    const g = new THREE.Group();
    const iron = standardMat(THREE, 0x1c1d1f, 0.45, 0.35), steel = standardMat(THREE, 0x9a9da2, 0.35, 0.6);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.0135, 0.0135, 0.2, 20), steel);
    handle.rotation.x = Math.PI / 2; g.add(handle);
    for (const sd of [-1, 1]) {
      const plates = [[0.095, 0.026, 0.07], [0.084, 0.02, 0.095], [0.07, 0.016, 0.114]];
      for (const [r, th, z] of plates) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, th, 40), iron);
        p.rotation.x = Math.PI / 2; p.position.z = sd * z; g.add(p);
      }
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.014, 20), steel);
      collar.rotation.x = Math.PI / 2; collar.position.z = sd * 0.128; g.add(collar);
    }
    return g;
  }
  function bench(THREE, x0, x1, zc, top) {
    const g = new THREE.Group();
    const pad = standardMat(THREE, 0x0d0e10, 0.7), frame = standardMat(THREE, 0xf1f2f4, 0.45, 0.05), foot = standardMat(THREE, 0x202124, 0.7);
    const L = x1 - x0, cx = (x0 + x1) / 2;
    const p = new THREE.Mesh(new THREE.BoxGeometry(L, 0.065, 0.3), pad); p.position.set(cx, top - 0.0325, zc); g.add(p);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(L - 0.14, 0.05, 0.08), frame); rail.position.set(cx, top - 0.09, zc); g.add(rail);
    for (const fx of [x0 + 0.12, x1 - 0.12]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, top - 0.09, 0.05), frame); leg.position.set(fx, (top - 0.09) / 2, zc); g.add(leg);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.42), frame); base.position.set(fx, 0.02, zc); g.add(base);
      for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.025, 0.05), foot); f.position.set(fx, 0.0125, zc + s * 0.2); g.add(f); }
    }
    return g;
  }

  // ---------- exercise: one-arm dumbbell row ----------
  // Left (near) arm works; right knee and right hand rest on the bench.
  const EX = {
    row_db: {
      cycle: 3.8,
      muscles: { lats: 1, upperback: 1, biceps: 2, rearDelts: 2, side: 'L', unilateral: ['biceps', 'rearDelts'] },
      camera: { pos: [0.62, 1.72, 2.95], look: [0.16, 0.56, -0.04], fov: 27 },
      setup(THREE, scene, rig) {
        scene.add(bench(THREE, -0.6, 0.92, -0.13, 0.45));
        const db = dumbbell(THREE);
        db.position.set(0, -0.055, 0.004);
        rig.B.handL.add(db);
      },
      // a: 0 = arm extended (stretch), 1 = dumbbell at the hip (contraction)
      progress(p) {
        if (p < 0.08) return 0;
        if (p < 0.42) return sstep5((p - 0.08) / 0.34);
        if (p < 0.53) return 1;
        if (p < 0.95) return 1 - sstep5((p - 0.53) / 0.42);
        return 0;
      },
      pose(THREE, rig, p) {
        const { B } = rig, P = rig.P, V = P.V;
        const a = this.progress(p);
        const breath = Math.sin(p * Math.PI * 2);
        // pelvis: torso nearly horizontal, head toward -X, chest facing the floor
        const beta = (11 + 1.5 * a) * Math.PI / 180;
        const up = V(-Math.cos(beta), Math.sin(beta), 0), fwd = V(-Math.sin(beta), -Math.cos(beta), 0);
        const left = new THREE.Vector3().crossVectors(up, fwd);
        B.pelvis.position.set(0.3, 0.9 + 0.003 * breath, 0);
        P.setWorld(B.pelvis, left, up, fwd);
        // thoracic rotation toward the working side at the top, slight extension
        B.spine1.rotation.set(-0.03, 0.05 * a, 0);
        B.spine2.rotation.set(-0.05 + 0.006 * breath, 0.08 * a, 0);
        B.neck.rotation.set(0.12, 0.02 * a, 0);
        B.head.rotation.set(0.18, 0, 0);
        // scapulae: left retracts as the dumbbell rises, protracts at the bottom
        B.clavL.rotation.set(0, 0.1 - 0.32 * a, 0.08 - 0.22 * a);
        B.clavR.rotation.set(0, -0.06, -0.05);
        B.pelvis.updateMatrixWorld(true);
        // support leg: knee and shin on the bench, foot hanging past the end
        const kneeR = V(0.55, 0.51, -0.12), ankleR = V(0.96, 0.493, -0.125);
        P.aim(B.thighR, kneeR.clone().sub(P.wpos(B.thighR)), V(-0.2, -1, 0));
        P.aim(B.shinR, ankleR.clone().sub(P.wpos(B.shinR)), V(0, -1, 0));
        P.setWorld(B.footR, ...basis(V, V(0.62, -0.78, 0), V(0.78, 0.62, 0), THREE));
        // standing leg: foot flat on the floor, slight knee bend
        P.ik(B.thighL, B.shinL, V(0.28, 0.075, 0.24), V(-0.9, 0.2, 0.35), 1);
        P.setWorld(B.footL, ...basis(V, V(-0.97, 0, 0.25), V(0, 1, 0), THREE, true));
        // support arm: palm flat on the pad
        P.ik(B.upperR, B.foreR, V(-0.33, 0.47, -0.16), V(0.5, 0.2, -0.8), -1);
        P.setWorld(B.handR, ...handFlat(V, THREE));
        // working arm: wrist follows a curved path from below the shoulder to the hip
        const b0 = V(-0.115, 0.47, 0.205), c0 = V(0.0, 0.6, 0.235), e0 = V(0.115, 0.825, 0.215);
        const u = a, w = b0.clone().multiplyScalar((1 - u) * (1 - u)).add(c0.clone().multiplyScalar(2 * u * (1 - u))).add(e0.clone().multiplyScalar(u * u));
        P.ik(B.upperL, B.foreL, w, V(0.85, 0.5, 0.18), -1);
        B.handL.rotation.set(0, 0, 0);
        B.handL.updateMatrixWorld(true);
        rig.mesh.morphTargetInfluences[0] = sstep(0.15, 0.95, a);
      },
    },
  };
  function basis(V, toe, top, THREE) { // foot: local +Z toes, local +Y up
    const z = toe.clone().normalize(), y = top.clone().sub(z.clone().multiplyScalar(top.dot(z))).normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    return [x, y, z];
  }
  function handFlat(V, THREE) { // fingers forward (-X), palm down: local -Y -> -X, local X -> up
    const y = V(1, 0.08, 0).normalize(), x = V(0, 1, 0);
    const z = new THREE.Vector3().crossVectors(x, y);
    return [x, y, z];
  }

  function supports(exId) { return !!EX[exId]; }

  // mount(container, exId, { autoplay }) -> controller
  async function mount(el, exId, opts = {}) {
    const ex = EX[exId];
    if (!ex) throw new Error('unsupported');
    if (!webglOk()) throw new Error('webgl');
    await load();
    const THREE = window.THREE;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: !!opts.preserve });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setClearColor(0xffffff, 1);
    const canvas = renderer.domElement; canvas.className = 'gl3d';
    el.append(canvas);
    const scene = new THREE.Scene();
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x7d828a, 0.42));
    const key = new THREE.DirectionalLight(0xffffff, 0.92); key.position.set(-0.9, 3.0, 1.9);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0006; key.shadow.normalBias = 0.012; key.shadow.radius = 4;
    Object.assign(key.shadow.camera, { left: -1.3, right: 1.5, top: 1.4, bottom: -1.2, near: 0.5, far: 6 });
    key.target.position.set(0.15, 0.5, 0); scene.add(key, key.target);
    const fill = new THREE.DirectionalLight(0xffffff, 0.3); fill.position.set(2.2, 0.8, 1.6); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.38); rim.position.set(0.6, 1.8, -2.4); scene.add(rim);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShadowMaterial({ opacity: 0.1 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const rig = buildBody(THREE, ex.muscles);
    rig.P = Poser(THREE, rig.B);
    scene.add(rig.mesh);
    ex.setup(THREE, scene, rig);
    scene.traverse((o) => { if (o.isMesh && o !== floor) { o.castShadow = true; o.receiveShadow = true; } });
    const cam = new THREE.PerspectiveCamera(ex.camera.fov, 1, 0.05, 20);
    const cv = opts.camera || ex.camera;
    cam.fov = cv.fov; cam.position.set(...cv.pos); cam.lookAt(...cv.look);
    const size = () => {
      const w = el.clientWidth || 320, h = el.clientHeight || 256;
      renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    };
    size();
    const ro = window.ResizeObserver ? new ResizeObserver(size) : null;
    if (ro) ro.observe(el);
    let t = 0, last = performance.now(), playing = opts.autoplay !== false, raf = 0, disposed = false;
    const draw = () => { ex.pose(THREE, rig, (t % ex.cycle) / ex.cycle); renderer.render(scene, cam); };
    const loop = (now) => {
      raf = 0;
      if (disposed) return;
      if (!canvas.isConnected) { api.dispose(); return; }
      if (playing) { t += Math.min(0.1, (now - last) / 1000); draw(); }
      last = now;
      raf = requestAnimationFrame(loop);
    };
    const api = {
      get playing() { return playing; },
      play() { playing = true; last = performance.now(); if (!raf) raf = requestAnimationFrame(loop); },
      pause() { playing = false; },
      toggle() { if (playing) api.pause(); else api.play(); return playing; },
      setTime(sec) { t = sec; draw(); },
      cycle: ex.cycle,
      dispose() {
        if (disposed) return; disposed = true;
        if (raf) cancelAnimationFrame(raf);
        if (ro) ro.disconnect();
        scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { for (const k of ['map', 'bumpMap']) if (o.material[k]) o.material[k].dispose(); o.material.dispose(); } });
        renderer.dispose();
      },
    };
    draw();
    raf = requestAnimationFrame(loop);
    return api;
  }
  return { supports, mount, load };
})();
if (typeof module !== 'undefined') module.exports = REP3D;
