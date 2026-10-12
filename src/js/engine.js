// Exercise figure engine: pictogram-style skeleton, keyframes, 2-bone IK.
// Angle convention: 0 = straight down, 90 = forward (right), 180 = up, -90 = back.
const FIG = (() => {
  const R = Math.PI / 180;
  const add = (p, l, a) => [p[0] + l * Math.sin(a * R), p[1] + l * Math.cos(a * R)];
  const angOf = (dx, dy) => Math.atan2(dx, dy) / R;
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpAng = (a, b, t) => { const d = ((((b - a) % 360) + 540) % 360) - 180; return a + d * t; };
  const L = { torso: 44, shO: 40, head: 16, th: 36, sh: 34, ft: 11, ua: 26, fa: 24, shW: 12, hipW: 8, ftF: 7 };

  function norm(s) {
    if (!s) return null;
    if (Array.isArray(s)) return { a: s, k: [1, 1] };
    return Object.assign({ k: [1, 1], b: 1 }, s);
  }
  const kindOf = (s) => (s.a ? 'a' : s.t ? 't' : s.r ? 'r' : 'rt');
  function targetOf(s, o, T) {
    if (s.t) return s.t;
    if (s.r) return [o[0] + s.r[0], o[1] + s.r[1]];
    const a = add(o, s.rt[0], T);
    return add(a, s.rt[1], T - 90);
  }
  function ik(o, tg, l1, l2, b) {
    const dx = tg[0] - o[0], dy = tg[1] - o[1];
    let d = Math.hypot(dx, dy);
    d = Math.min(Math.max(d, Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01);
    const base = angOf(dx, dy);
    const c = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
    const A = Math.acos(Math.max(-1, Math.min(1, c))) / R;
    const a1 = base + b * A;
    const e = add(o, l1, a1);
    return [a1, angOf(tg[0] - e[0], tg[1] - e[1])];
  }
  function limb(o, l1, l2, spec, T) {
    const s = norm(spec);
    const k = s.k || [1, 1];
    const a = s.a ? s.a : ik(o, targetOf(s, o, T), l1 * k[0], l2 * k[1], s.b);
    const j1 = add(o, l1 * k[0], a[0]);
    return { a, j1, j2: add(j1, l2 * k[1], a[1]) };
  }
  function mirror(spec, px) {
    const s = norm(spec);
    if (s.a) return { a: [-s.a[0], -s.a[1]], k: s.k };
    if (s.t) return { t: [2 * px - s.t[0], s.t[1]], b: -s.b, k: s.k };
    if (s.r) return { r: [-s.r[0], s.r[1]], b: -s.b, k: s.k };
    return { rt: [s.rt[0], -s.rt[1]], b: -s.b, k: s.k };
  }

  const LIMBS = { side: ['legN', 'legF', 'armN', 'armF'], front: ['arm', 'armL', 'leg', 'legL'] };

  function solve(view, P) {
    const J = {}, A = {};
    const p = P.p, T = P.torso ?? 180;
    J.pelvis = p; J.sh = add(p, L.shO, T); J.neck = add(p, L.torso, T);
    J.head = add(J.neck, L.head, P.head ?? T);
    if (view === 'side') {
      const ln = limb(p, L.th, L.sh, P.legN, T); A.legN = ln.a; J.kneeN = ln.j1; J.ankleN = ln.j2;
      J.toeN = add(J.ankleN, L.ft, P.ftN ?? 90);
      if (P.legF) { const lf = limb(p, L.th, L.sh, P.legF, T); A.legF = lf.a; J.kneeF = lf.j1; J.ankleF = lf.j2; J.toeF = add(J.ankleF, L.ft, P.ftF ?? P.ftN ?? 90); }
      const an = limb(J.sh, L.ua, L.fa, P.armN, T); A.armN = an.a; J.elbowN = an.j1; J.wristN = an.j2;
      if (P.armF) { const af = limb(J.sh, L.ua, L.fa, P.armF, T); A.armF = af.a; J.elbowF = af.j1; J.wristF = af.j2; }
    } else {
      J.shR = add(J.sh, L.shW, T - 90); J.shL = add(J.sh, L.shW, T + 90);
      J.hipR = add(p, L.hipW, T - 90); J.hipL = add(p, L.hipW, T + 90);
      const armL = P.armL || mirror(P.arm, p[0]);
      const legL = P.legL || mirror(P.leg, p[0]);
      const ar = limb(J.shR, L.ua, L.fa, P.arm, T); A.arm = ar.a; J.elbowR = ar.j1; J.wristR = ar.j2;
      const al = limb(J.shL, L.ua, L.fa, armL, T + 0); A.armL = al.a; J.elbowL = al.j1; J.wristL = al.j2;
      const lr = limb(J.hipR, L.th, L.sh, P.leg, T); A.leg = lr.a; J.kneeR = lr.j1; J.ankleR = lr.j2;
      const ll = limb(J.hipL, L.th, L.sh, legL, T); A.legL = ll.a; J.kneeL = ll.j1; J.ankleL = ll.j2;
      const ft = P.ft ?? 90;
      J.toeR = add(J.ankleR, L.ftF, ft); J.toeL = add(J.ankleL, L.ftF, -ft);
    }
    return { J, A, hAng: P.head ?? T };
  }

  function lerpLimb(a, b, angA, angB, t) {
    const ka = kindOf(a), kb = kindOf(b);
    const k = [lerp(a.k[0], b.k[0], t), lerp(a.k[1], b.k[1], t)];
    if (ka === kb && ka !== 'a') {
      const va = a[ka], vb = b[ka];
      return { [ka]: [lerp(va[0], vb[0], t), lerp(va[1], vb[1], t)], b: a.b, k };
    }
    return { a: [lerpAng(angA[0], angB[0], t), lerpAng(angA[1], angB[1], t)], k };
  }

  function prepare(anim) {
    if (anim._ready) return anim;
    anim.keys.forEach((k) => { k._s = solve(anim.view, k.pose); });
    anim._total = anim.keys.reduce((s, k) => s + (k.d ?? 0.9) + (k.hold ?? 0), 0);
    anim._ready = true;
    return anim;
  }

  const ease = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);

  function poseAt(anim, time) {
    prepare(anim);
    const keys = anim.keys, n = keys.length;
    let t = ((time % anim._total) + anim._total) % anim._total;
    for (let i = 0; i < n; i++) {
      const k = keys[i], d = k.d ?? 0.9, h = k.hold ?? 0;
      if (t < h) return k._s;
      t -= h;
      if (t < d || i === n - 1) {
        const nx = keys[(i + 1) % n];
        const u = ease(Math.min(1, t / d));
        const A = k.pose, B = nx.pose, P = {};
        P.p = [lerp(A.p[0], B.p[0], u), lerp(A.p[1], B.p[1], u)];
        const tA = A.torso ?? 180, tB = B.torso ?? 180;
        P.torso = lerpAng(tA, tB, u);
        P.head = lerpAng(A.head ?? tA, B.head ?? tB, u);
        for (const f of ['ftN', 'ftF', 'ft']) if (A[f] !== undefined || B[f] !== undefined) {
          const dflt = f === 'ftF' ? (A.ftN ?? 90) : 90;
          P[f] = lerpAng(A[f] ?? dflt, B[f] ?? (f === 'ftF' ? (B.ftN ?? 90) : 90), u);
        }
        for (const l of LIMBS[anim.view]) {
          if (!A[l] || !B[l]) continue;
          P[l] = lerpLimb(norm(A[l]), norm(B[l]), k._s.A[l], nx._s.A[l], u);
        }
        return solve(anim.view, P);
      }
      t -= d;
    }
    return keys[0]._s;
  }

  // ---------- drawing ----------
  const f = (n) => Math.round(n * 10) / 10;
  const pts = (arr) => arr.map((q) => f(q[0]) + ',' + f(q[1])).join(' ');
  const pl = (arr, cls) => `<polyline class="${cls}" points="${pts(arr)}"/>`;
  function at(J, ref) { return typeof ref === 'string' ? J[ref] : ref; }
  function mid(J, refs) { const a = at(J, refs[0]), b = at(J, refs[1]); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }

  function prop(pr, J) {
    const o = pr.off || [0, 0];
    const isPair = (ref) => Array.isArray(ref) && typeof ref[0] === 'string';
    const P = (ref) => { const q = isPair(ref) ? mid(J, ref) : at(J, ref); return [q[0] + o[0], q[1] + o[1]]; };
    switch (pr.t) {
      case 'floor': return `<line class="fx-floor" x1="${pr.x1 ?? -40}" y1="${pr.y ?? 150}" x2="${pr.x2 ?? 240}" y2="${pr.y ?? 150}"/>`;
      case 'rect': return `<rect class="${pr.far ? 'fx-eq fx-far' : 'fx-eq'}" x="${pr.x}" y="${pr.y}" width="${pr.w}" height="${pr.h}" rx="${pr.r ?? 2}"/>`;
      case 'line': { const a = P(pr.a), b = P(pr.b); return `<line class="${pr.c || 'fx-eqline'}" x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}"/>`; }
      case 'thick': { const a = P(pr.a), b = P(pr.b); return `<line class="fx-eqthick" stroke-width="${pr.w || 7}" x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}"/>`; }
      case 'plate': { const c = P(pr.at); return `<circle class="fx-plate" cx="${f(c[0])}" cy="${f(c[1])}" r="${pr.r ?? 12}"/><circle class="fx-hub" cx="${f(c[0])}" cy="${f(c[1])}" r="2.4"/>`; }
      case 'db': { const c = P(pr.at); return `<circle class="${pr.far ? 'fx-db fx-far' : 'fx-db'}" cx="${f(c[0])}" cy="${f(c[1])}" r="${pr.r ?? 5.5}"/>`; }
      case 'fdb': { // dumbbell seen from the front, handle horizontal
        const c = P(pr.at), w = pr.w ?? 9;
        return `<line class="fx-dbbar" x1="${f(c[0] - w)}" y1="${f(c[1])}" x2="${f(c[0] + w)}" y2="${f(c[1])}"/><rect class="fx-db" x="${f(c[0] - w - 3)}" y="${f(c[1] - 5)}" width="5" height="10" rx="1.5"/><rect class="fx-db" x="${f(c[0] + w - 2)}" y="${f(c[1] - 5)}" width="5" height="10" rx="1.5"/>`;
      }
      case 'fbar': { // barbell from the front through both wrists
        const a = J[pr.a || 'wristL'], b = J[pr.b || 'wristR'], e = pr.ext ?? 26;
        const x1 = Math.min(a[0], b[0]) - e, x2 = Math.max(a[0], b[0]) + e, y = (a[1] + b[1]) / 2 + (pr.dy || 0);
        return `<line class="fx-bar" x1="${f(x1)}" y1="${f(y)}" x2="${f(x2)}" y2="${f(y)}"/>` + (pr.plates === false ? '' : `<rect class="fx-plate" x="${f(x1 - 2)}" y="${f(y - 12)}" width="6" height="24" rx="2"/><rect class="fx-plate" x="${f(x2 - 4)}" y="${f(y - 12)}" width="6" height="24" rx="2"/>`);
      }
      case 'cable': { const a = P(pr.from), b = isPair(pr.to) ? mid(J, pr.to) : at(J, pr.to); return `<line class="fx-cable" x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}"/><circle class="fx-pulley" cx="${f(a[0])}" cy="${f(a[1])}" r="4"/>`; }
      case 'band': { const a = at(J, pr.from), b = at(J, pr.to); return `<line class="fx-band" x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}"/>`; }
      case 'grip': { const c = P(pr.at); return `<circle class="fx-grip" cx="${f(c[0])}" cy="${f(c[1])}" r="${pr.r ?? 3.5}"/>`; }
      case 'seg': { const c = P(pr.at), h = (pr.len ?? 30) / 2; const a = [c[0] + h * Math.sin(pr.ang * R), c[1] + h * Math.cos(pr.ang * R)], b = [c[0] - h * Math.sin(pr.ang * R), c[1] - h * Math.cos(pr.ang * R)]; return `<line class="${pr.c || 'fx-eqthick'}" stroke-width="${pr.w || 6}" x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}"/>`; }
      case 'pad': { const c = P(pr.at); return `<circle class="fx-pad" cx="${f(c[0])}" cy="${f(c[1])}" r="${pr.r ?? 5}"/>`; }
      default: return '';
    }
  }

  // ---------- anatomical body ----------
  const PROF = {
    ua: [[-0.14, 4.6, 4.6], [0.02, 5.9, 5.9], [0.3, 5.7, 5.3], [0.55, 5.2, 4.9], [0.82, 4.0, 4.0], [1.0, 3.5, 3.5], [1.08, 3.0, 3.0]],
    fa: [[-0.06, 3.6, 3.6], [0.22, 4.3, 4.1], [0.62, 3.2, 3.0], [0.95, 2.4, 2.4], [1.04, 2.1, 2.1]],
    hd: [[-0.1, 2.3, 2.3], [0.45, 2.9, 2.7], [1.0, 2.1, 2.0], [1.12, 1.4, 1.4]],
    th: [[-0.12, 6.4, 7.4], [0.08, 7.6, 7.8], [0.45, 7.1, 6.6], [0.8, 5.4, 5.3], [0.98, 4.5, 4.5], [1.06, 3.9, 3.9]],
    sh: [[-0.05, 4.3, 4.3], [0.12, 4.5, 5.6], [0.32, 4.2, 6.4], [0.6, 3.4, 4.2], [0.9, 2.6, 2.7], [1.02, 2.4, 2.5]],
    ft: [[-0.32, 2.0, 2.4], [-0.05, 3.2, 2.7], [0.5, 2.0, 2.5], [0.88, 1.3, 1.7], [1.02, 0.9, 1.1]],
    nk: [[0, 3.8, 3.8], [1, 3.4, 3.4]],
    torsoS: [[-0.2, 5.5, 7], [-0.06, 8.5, 10.2], [0.12, 8.6, 9.2], [0.35, 8.2, 7.6], [0.55, 9.4, 8.2], [0.72, 10.6, 9.4], [0.88, 9.6, 8.8], [0.98, 6.5, 6.6], [1.05, 3.6, 3.8]],
    torsoF: [[-0.2, 8.5, 8.5], [-0.05, 12.5, 12.5], [0.15, 11.6, 11.6], [0.38, 10.2, 10.2], [0.6, 12.2, 12.2], [0.8, 14.4, 14.4], [0.93, 14.0, 14.0], [1.0, 7, 7], [1.05, 4.2, 4.2]],
  };
  const WSCALE = { ua: 1.32, fa: 1.3, hd: 1.15, th: 1.3, sh: 1.28, ft: 1.1, nk: 1.3, torsoS: 1.2, torsoF: 1.18 };
  for (const k in WSCALE) PROF[k] = PROF[k].map(([t, a, p]) => [t, a * WSCALE[k], p * WSCALE[k]]);
  // muscle regions: s 'a' anterior, 'p' posterior, 'b' both sides [t, ant, post]; 'm' mirrored lateral [t, inner, outer]
  const LIMB_SIDE = {
    ua: { delts: { s: 'b', p: [[-0.14, 1.06, 1.06], [0.05, 1.06, 1.06], [0.25, 1.0, 1.0], [0.4, 0.5, 0.5]] },
      frontDelts: { s: 'a', p: [[-0.12, 1.06, 0.05], [0.1, 1.06, 0.0], [0.36, 0.9, 0.35]] },
      rearDelts: { s: 'p', p: [[-0.12, 1.06, 0.05], [0.1, 1.06, 0.0], [0.36, 0.9, 0.35]] },
      biceps: { s: 'a', p: [[0.3, 0.96, 0.15], [0.55, 1.0, 0.05], [0.86, 0.9, 0.2]] },
      triceps: { s: 'p', p: [[0.22, 0.96, 0.15], [0.5, 1.0, 0.05], [0.86, 0.9, 0.25]] } },
    fa: { forearms: { s: 'b', p: [[0.04, 0.9, 0.9], [0.3, 0.96, 0.96], [0.68, 0.7, 0.7]] } },
    th: { quads: { s: 'a', p: [[0.32, 0.95, 0.1], [0.55, 1.0, 0.0], [0.85, 0.95, 0.15], [0.97, 0.75, 0.35]] },
      hams: { s: 'p', p: [[0.34, 0.95, 0.15], [0.6, 1.0, 0.05], [0.9, 0.85, 0.25]] } },
    sh: { calves: { s: 'p', p: [[0.1, 0.95, 0.2], [0.3, 1.0, 0.05], [0.62, 0.85, 0.25]] } },
  };
  const CAP = [[-0.14, 1.06, 1.06], [0.05, 1.06, 1.06], [0.25, 1.0, 1.0], [0.4, 0.5, 0.5]];
  const LIMB_FRONT = {
    ua: { delts: { s: 'b', p: CAP }, frontDelts: { s: 'b', p: CAP }, biceps: { s: 'b', p: [[0.3, 0.75, 0.75], [0.55, 0.85, 0.85], [0.85, 0.6, 0.6]] } },
    fa: LIMB_SIDE.fa,
    th: { quads: { s: 'b', p: [[0.32, 0.9, 0.9], [0.55, 0.97, 0.97], [0.88, 0.65, 0.65]] } },
    sh: {},
  };
  const LIMB_BACK = {
    ua: { delts: { s: 'b', p: CAP }, rearDelts: { s: 'b', p: CAP }, triceps: { s: 'b', p: [[0.24, 0.8, 0.8], [0.5, 0.9, 0.9], [0.85, 0.6, 0.6]] } },
    fa: LIMB_SIDE.fa,
    th: { hams: { s: 'b', p: [[0.34, 0.9, 0.9], [0.6, 0.97, 0.97], [0.9, 0.6, 0.6]] } },
    sh: { calves: { s: 'b', p: [[0.1, 0.9, 0.9], [0.3, 1.0, 1.0], [0.62, 0.7, 0.7]] } },
  };
  const TORSO_SIDE = {
    chest: { s: 'a', p: [[0.52, 0.88, 0.35], [0.64, 0.99, 0.05], [0.8, 0.99, 0.0], [0.9, 0.94, 0.1], [0.96, 0.78, 0.35]] },
    abs: { s: 'a', p: [[0.06, 0.92, 0.5], [0.3, 0.97, 0.45], [0.5, 0.97, 0.45], [0.6, 0.88, 0.55]] },
    lats: { s: 'p', p: [[0.38, 0.82, 0.15], [0.55, 0.97, 0.05], [0.75, 0.99, 0.1], [0.86, 0.86, 0.35]] },
    upperback: { s: 'p', p: [[0.66, 0.99, 0.6], [0.78, 1.0, 0.5], [0.9, 0.96, 0.6]] },
    traps: { s: 'p', p: [[0.84, 0.98, 0.35], [0.95, 0.98, 0.2], [1.03, 0.92, 0.1]] },
    lowerback: { s: 'p', p: [[0.06, 0.96, 0.55], [0.22, 0.98, 0.5], [0.38, 0.95, 0.55]] },
    glutes: { s: 'p', p: [[-0.2, 0.88, 0.2], [-0.08, 0.99, 0.08], [0.05, 0.99, 0.15], [0.16, 0.9, 0.45]] },
  };
  const TORSO_FRONT = {
    chest: [[0.62, 0.1, 0.82], [0.72, 0.04, 0.94], [0.83, 0.04, 0.95], [0.9, 0.12, 0.86]],
    abs: [[0.1, 0.04, 0.42], [0.3, 0.04, 0.48], [0.55, 0.04, 0.45], [0.62, 0.04, 0.38]],
    lats: [[0.42, 0.8, 0.99], [0.6, 0.82, 1.0], [0.78, 0.78, 0.99]],
    traps: [[0.92, 0.2, 0.55], [0.99, 0.18, 0.5], [1.04, 0.2, 0.38]],
  };
  const TORSO_BACK = {
    traps: [[0.68, 0.02, 0.22], [0.84, 0.02, 0.6], [0.95, 0.02, 0.78], [1.03, 0.02, 0.45]],
    upperback: [[0.6, 0.04, 0.5], [0.74, 0.04, 0.58], [0.84, 0.04, 0.45]],
    lats: [[0.34, 0.12, 0.72], [0.55, 0.22, 0.97], [0.74, 0.45, 1.0], [0.85, 0.62, 0.95]],
    lowerback: [[0.04, 0.03, 0.35], [0.24, 0.03, 0.4], [0.4, 0.03, 0.3]],
    glutes: [[-0.19, 0.03, 0.92], [-0.05, 0.03, 1.0], [0.08, 0.03, 0.96], [0.15, 0.08, 0.82]],
  };
  const DEF = new Set(['chest', 'abs', 'lats', 'traps', 'delts', 'biceps', 'triceps', 'calves', 'quads', 'hams', 'upperback']);
  const ORDER_T = ['glutes', 'lowerback', 'abs', 'lats', 'upperback', 'traps', 'chest'];
  const ORDER_L = ['delts', 'frontDelts', 'rearDelts', 'biceps', 'triceps', 'forearms', 'quads', 'hams', 'calves'];

  const f2 = (n) => Math.round(n * 10) / 10;
  function smooth(pts, closed = true) {
    const n = pts.length;
    if (n < 2) return '';
    let d = `M${f2(pts[0][0])},${f2(pts[0][1])}`;
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], p1 = pts[i], p2 = pts[closed ? (i + 1) % n : i + 1], p3 = pts[closed ? (i + 2) % n : Math.min(n - 1, i + 2)];
      d += `C${f2(p1[0] + (p2[0] - p0[0]) / 6)},${f2(p1[1] + (p2[1] - p0[1]) / 6)} ${f2(p2[0] - (p3[0] - p1[0]) / 6)},${f2(p2[1] - (p3[1] - p1[1]) / 6)} ${f2(p2[0])},${f2(p2[1])}`;
    }
    return closed ? d + 'Z' : d;
  }
  function interp(prof, t) {
    if (t <= prof[0][0]) return [prof[0][1], prof[0][2]];
    for (let i = 1; i < prof.length; i++) if (t <= prof[i][0]) {
      const a = prof[i - 1], b = prof[i], u = (t - a[0]) / (b[0] - a[0]);
      return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
    }
    const z = prof[prof.length - 1]; return [z[1], z[2]];
  }
  // frame along A->B; ant = +1 for torso (anterior = left normal), -1 for limbs
  function seg(A, B, ant) {
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1;
    const nx = (-dy / L) * ant, ny = (dx / L) * ant;
    return (t, o) => [A[0] + dx * t + nx * o, A[1] + dy * t + ny * o];
  }
  function baseShape(P, prof) {
    return smooth(prof.map(([t, a]) => P(t, a)).concat(prof.slice().reverse().map(([t, , p]) => P(t, -p))));
  }
  function region(P, prof, spec) {
    const pts = spec.p, A = [], B = [];
    for (const [t, x, y] of pts) {
      const [wa, wp] = interp(prof, t);
      if (spec.s === 'a') { A.push(P(t, x * wa)); B.push(P(t, y * wa)); }
      else if (spec.s === 'p') { A.push(P(t, -x * wp)); B.push(P(t, -y * wp)); }
      else { A.push(P(t, x * wa)); B.push(P(t, -y * wp)); }
    }
    const fib = [0.35, 0.68].map((m) => pts.map(([t, x, y]) => {
      const [wa, wp] = interp(prof, t);
      const o1 = spec.s === 'a' ? x * wa : spec.s === 'p' ? -x * wp : x * wa;
      const o2 = spec.s === 'a' ? y * wa : spec.s === 'p' ? -y * wp : -y * wp;
      return P(t, o2 + (o1 - o2) * m);
    }));
    return { d: smooth(A.concat(B.reverse())), fib };
  }
  function mirrored(P, prof, pts, side) {
    const A = [], B = [];
    for (const [t, inn, out] of pts) { const [w] = interp(prof, t); A.push(P(t, side * out * w)); B.push(P(t, side * inn * w)); }
    const fib = [0.4, 0.72].map((m) => pts.map(([t, inn, out]) => { const [w] = interp(prof, t); return P(t, side * (inn + (out - inn) * m) * w); }));
    return { d: smooth(A.concat(B.reverse())), fib };
  }
  function muscleSvg(r, level) {
    let s = `<path class="fb-m${level}" d="${r.d}"/>`;
    if (level === 1) for (const ln of r.fib) s += `<path class="fb-fib" d="${smooth(ln, false)}"/>`;
    return s;
  }
  function lvl(mus, k) { return mus && mus.p && mus.p.includes(k) ? 1 : mus && mus.s && mus.s.includes(k) ? 2 : 0; }
  function limbShape(A, B, key, map, mus, extra) {
    const P = seg(A, B, -1), prof = PROF[key];
    let s = `<path class="fb-skin" d="${baseShape(P, prof)}"/>`;
    s += `<path class="fb-shade" d="${region(P, prof, { s: 'p', p: [[prof[0][0] + 0.04, 1, 0.15], [0.5, 1, 0.1], [prof[prof.length - 1][0] - 0.04, 1, 0.15]] }).d}"/>`;
    if (extra) s += extra(P, prof);
    const m = map && map[key];
    if (m) for (const k of ORDER_L) if (m[k]) { const l = lvl(mus, k); s += l ? muscleSvg(region(P, prof, m[k]), l) : DEF.has(k) ? `<path class="fb-def" d="${region(P, prof, m[k]).d}"/>` : ''; }
    return s;
  }
  const HS = 0.9;
  const HEAD_PROFILE = [[-8.2, 1.2], [-6.2, 7.4], [0, 9.6], [5.6, 6.6], [7.6, 2.6], [8.0, 0.6], [9.5, -1.7], [8.0, -2.9], [8.1, -4.6], [6.8, -7.6], [2.6, -8.8], [-1.6, -6.4], [-5.4, -4.8], [-8.3, -1.6]];
  const HAIR_SIDE = [[6.2, 5.8], [2, 10], [-4.8, 9], [-8.9, 2.6], [-8.5, -2], [-5.8, 1], [-1.6, 4.6], [3.4, 5.4]];
  const HEAD_FRONT = [[0, 9.8], [5.4, 8.4], [7.4, 3.6], [7.1, -2.2], [5.6, -6.6], [2.8, -9.2], [0, -9.9], [-2.8, -9.2], [-5.6, -6.6], [-7.1, -2.2], [-7.4, 3.6], [-5.4, 8.4]];
  const HAIR_FRONT = [[-7.4, 3.2], [-5.8, 8.4], [0, 10.2], [5.8, 8.4], [7.4, 3.2], [5.6, 5.4], [0, 6.4], [-5.6, 5.4]];
  const HAIR_BACK = [[-7.6, -2.4], [-7.5, 4], [-5.4, 8.6], [0, 10.2], [5.4, 8.6], [7.5, 4], [7.6, -2.4], [4.6, -5.4], [0, -6.2], [-4.6, -5.4]];
  function headSide(J, ang) {
    const C = J.head, hu = [Math.sin(ang * R), Math.cos(ang * R)], hf = [Math.sin((ang - 90) * R), Math.cos((ang - 90) * R)];
    const at = (f, u) => [C[0] + (hf[0] * f + hu[0] * u) * HS, C[1] + (hf[1] * f + hu[1] * u) * HS];
    const rot = Math.atan2(hf[1], hf[0]) / R;
    let s = `<path class="fb-skin" d="${smooth(HEAD_PROFILE.map(([f, u]) => at(f, u)))}"/>`;
    s += `<path class="fb-hair" d="${smooth(HAIR_SIDE.map(([f, u]) => at(f, u)))}"/>`;
    const ear = at(-1.6, -0.8), eye = at(5.6, 1.4), brow = [at(4.2, 3.0), at(7.0, 2.6)];
    s += `<ellipse class="fb-ear" cx="${f2(ear[0])}" cy="${f2(ear[1])}" rx="${f2(1.6 * HS)}" ry="${f2(2.5 * HS)}" transform="rotate(${f2(rot)} ${f2(ear[0])} ${f2(ear[1])})"/>`;
    s += `<ellipse class="fb-eye" cx="${f2(eye[0])}" cy="${f2(eye[1])}" rx="1" ry="0.6" transform="rotate(${f2(rot)} ${f2(eye[0])} ${f2(eye[1])})"/>`;
    s += `<path class="fb-brow" d="M${f2(brow[0][0])},${f2(brow[0][1])}L${f2(brow[1][0])},${f2(brow[1][1])}"/>`;
    return s;
  }
  function headFront(J, ang, back) {
    const C = J.head, hu = [Math.sin(ang * R), Math.cos(ang * R)], hl = [Math.sin((ang - 90) * R), Math.cos((ang - 90) * R)];
    const at = (l, u) => [C[0] + (hl[0] * l + hu[0] * u) * HS, C[1] + (hl[1] * l + hu[1] * u) * HS];
    let s = '';
    for (const sd of [-1, 1]) { const e = at(sd * 7.4, -0.6); s += `<ellipse class="fb-ear" cx="${f2(e[0])}" cy="${f2(e[1])}" rx="${f2(1.7 * HS)}" ry="${f2(2.6 * HS)}"/>`; }
    s += `<path class="fb-skin" d="${smooth(HEAD_FRONT.map(([l, u]) => at(l, u)))}"/>`;
    s += `<path class="fb-hair" d="${smooth((back ? HAIR_BACK : HAIR_FRONT).map(([l, u]) => at(l, u)))}"/>`;
    if (!back) {
      for (const sd of [-1, 1]) { const e = at(sd * 3, 1.0); s += `<ellipse class="fb-eye" cx="${f2(e[0])}" cy="${f2(e[1])}" rx="1" ry="0.6"/>`; }
      const n1 = at(0, 0.2), n2 = at(0.8, -3.2), m1 = at(-2, -5.6), m2 = at(2, -5.6);
      s += `<path class="fb-brow" d="M${f2(n1[0])},${f2(n1[1])}L${f2(n2[0])},${f2(n2[1])}M${f2(m1[0])},${f2(m1[1])}L${f2(m2[0])},${f2(m2[1])}"/>`;
    }
    return s;
  }
  function neck(J, ang, ant) {
    const hu = [Math.sin(ang * R), Math.cos(ang * R)];
    const top = [J.head[0] - hu[0] * 5, J.head[1] - hu[1] * 5];
    return `<path class="fb-skin" d="${baseShape(seg(J.sh, top, ant), PROF.nk)}"/>`;
  }
  function shortsSide(PT, PL) {
    const t = smooth([PT(-0.24, 5), PT(-0.24, -7.2), PT(-0.08, -10.8), PT(0.08, -9.8), PT(0.2, -8.2), PT(0.2, 8.8), PT(0.06, 9.2)]);
    let s = `<path class="fb-shorts" d="${t}"/>`;
    if (PL) s += `<path class="fb-shorts" d="${smooth([PL(-0.12, 6.9), PL(0.34, 7.6), PL(0.34, -7.4), PL(-0.12, -8.2)])}"/>`;
    return s;
  }
  function drawSide(anim, S, mus) {
    const J = S.J, props = anim.props || [];
    const T = anim._T, H = anim._H;
    let s = '';
    for (const pr of props) if (pr.z !== 'front' && pr.z !== 'mid') s += prop(pr, J);
    let far = '';
    if (J.elbowF) far += limbShape(J.sh, J.elbowF, 'ua', LIMB_SIDE, mus) + limbShape(J.elbowF, J.wristF, 'fa', LIMB_SIDE, mus) + limbShape(J.wristF, ext(J.elbowF, J.wristF, 6), 'hd', null, mus);
    if (J.kneeF) far += limbShape(J.pelvis, J.kneeF, 'th', LIMB_SIDE, mus) + limbShape(J.kneeF, J.ankleF, 'sh', LIMB_SIDE, mus) + limbShape(J.ankleF, J.toeF, 'ft', null, mus) + `<path class="fb-shorts" d="${smooth([seg(J.pelvis, J.kneeF, -1)(-0.12, 6.9), seg(J.pelvis, J.kneeF, -1)(0.34, 7.6), seg(J.pelvis, J.kneeF, -1)(0.34, -7.4), seg(J.pelvis, J.kneeF, -1)(-0.12, -8.2)])}"/>`;
    if (far) s += `<g class="fb-far">${far}</g>`;
    for (const pr of props) if (pr.z === 'mid') s += prop(pr, J);
    const PT = seg(J.pelvis, J.neck, 1), tp = PROF.torsoS;
    s += `<path class="fb-skin" d="${baseShape(PT, tp)}"/>`;
    s += `<path class="fb-shade" d="${region(PT, tp, { s: 'p', p: [[-0.15, 1, 0.2], [0.5, 1, 0.15], [1.0, 1, 0.2]] }).d}"/>`;
    s += limbShape(J.pelvis, J.kneeN, 'th', null, mus) + limbShape(J.kneeN, J.ankleN, 'sh', LIMB_SIDE, mus) + limbShape(J.ankleN, J.toeN, 'ft', null, mus);
    const PL = seg(J.pelvis, J.kneeN, -1);
    s += shortsSide(PT, PL);
    for (const k of ORDER_T) { const l = lvl(mus, k); s += l ? muscleSvg(region(PT, tp, TORSO_SIDE[k]), l) : DEF.has(k) ? `<path class="fb-def" d="${region(PT, tp, TORSO_SIDE[k]).d}"/>` : ''; }
    for (const k of ['quads', 'hams']) { const l = lvl(mus, k); s += l ? muscleSvg(region(PL, PROF.th, LIMB_SIDE.th[k]), l) : `<path class="fb-def" d="${region(PL, PROF.th, LIMB_SIDE.th[k]).d}"/>`; }
    s += neck(J, S.hAng, 1) + headSide(J, S.hAng);
    s += limbShape(J.sh, J.elbowN, 'ua', LIMB_SIDE, mus) + limbShape(J.elbowN, J.wristN, 'fa', LIMB_SIDE, mus) + limbShape(J.wristN, ext(J.elbowN, J.wristN, 6), 'hd', null, mus);
    for (const pr of props) if (pr.z === 'front') s += prop(pr, J);
    return s;
  }
  function ext(A, B, len) { const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1; return [B[0] + dx / L * len, B[1] + dy / L * len]; }
  function drawFront(anim, S, mus) {
    const J = S.J, props = anim.props || [], back = anim.face === 'back';
    const LM = back ? LIMB_BACK : LIMB_FRONT, TM = back ? TORSO_BACK : TORSO_FRONT;
    let s = '';
    for (const pr of props) if (pr.z !== 'front' && pr.z !== 'mid') s += prop(pr, J);
    for (const pr of props) if (pr.z === 'mid') s += prop(pr, J);
    const legs = [['hipR', 'kneeR', 'ankleR', 'toeR'], ['hipL', 'kneeL', 'ankleL', 'toeL']];
    for (const [h0, k, a, t] of legs) s += limbShape(J[h0], J[k], 'th', null, mus) + limbShape(J[k], J[a], 'sh', LM, mus) + limbShape(J[a], J[t], 'ft', null, mus);
    const PT = seg(J.pelvis, J.neck, 1), tp = PROF.torsoF;
    s += `<path class="fb-skin" d="${baseShape(PT, tp)}"/>`;
    s += `<path class="fb-shade" d="${region(PT, tp, { s: 'p', p: [[-0.15, 1, 0.55], [0.5, 1, 0.6], [1.0, 1, 0.55]] }).d}"/>`;
    s += `<path class="fb-shorts" d="${smooth([PT(-0.24, 9.5), PT(-0.24, -9.5), PT(-0.06, -12.8), PT(0.18, -11.8), PT(0.18, 11.8), PT(-0.06, 12.8)])}"/>`;
    for (const [h0, k] of legs) { const P = seg(J[h0], J[k], -1); s += `<path class="fb-shorts" d="${smooth([P(-0.12, 7.4), P(0.32, 7.6), P(0.32, -7.6), P(-0.12, -7.4)])}"/>`; }
    for (const k of ORDER_T) { if (!TM[k]) continue; const l = lvl(mus, k); for (const sd of [-1, 1]) s += l ? muscleSvg(mirrored(PT, tp, TM[k], sd), l) : DEF.has(k) ? `<path class="fb-def" d="${mirrored(PT, tp, TM[k], sd).d}"/>` : ''; }
    for (const [h0, k] of legs) { const P = seg(J[h0], J[k], -1); for (const mk of ['quads', 'hams']) { if (!LM.th[mk]) continue; const l = lvl(mus, mk); s += l ? muscleSvg(region(P, PROF.th, LM.th[mk]), l) : `<path class="fb-def" d="${region(P, PROF.th, LM.th[mk]).d}"/>`; } }
    s += neck(J, S.hAng, 1) + headFront(J, S.hAng, back);
    for (const [sh, el, wr] of [['shR', 'elbowR', 'wristR'], ['shL', 'elbowL', 'wristL']]) s += limbShape(J[sh], J[el], 'ua', LM, mus) + limbShape(J[el], J[wr], 'fa', LM, mus) + limbShape(J[wr], ext(J[el], J[wr], 6), 'hd', null, mus);
    for (const pr of props) if (pr.z === 'front') s += prop(pr, J);
    return s;
  }
  function draw(anim, S, mus) {
    return anim.view === 'side' ? drawSide(anim, S, mus) : drawFront(anim, S, mus);
  }

  function frame(anim, time, mus) { return draw(anim, poseAt(anim, time), mus); }
  function still(anim, keyIndex, mus) { prepare(anim); return draw(anim, anim.keys[keyIndex]._s, mus); }
  function svg(anim, inner, cls) { return `<svg class="${cls || 'fig'}" viewBox="${anim.vb || '0 0 200 160'}" aria-hidden="true">${inner}</svg>`; }

  return { poseAt, frame, still, svg, prepare };
})();
if (typeof module !== 'undefined') module.exports = FIG;
