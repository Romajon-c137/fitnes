// Keyframed movement demos. keys[i].d = seconds to next key, hold = pause on this key.
// ill = [start key, finish key] used for the still illustrations.
const ANIMS = (() => {
  const FL = { t: 'floor' };
  const TALL = '-20 -32 240 192';
  const HANG = '-20 -8 240 192';
  const STAND = { p: [96, 76], torso: 180, legN: { t: [100, 146] } };
  const st = (extra) => Object.assign({}, STAND, extra);
  const benchLegs = (x1, x2, y) => [{ t: 'line', a: [x1, y], b: [x1, 150] }, { t: 'line', a: [x2, y], b: [x2, 150] }];
  const A = {};

  // ---------- legs ----------
  A.squat = { view: 'side', ill: [0, 1], props: [FL], keys: [
    { pose: st({ armN: [6, 4] }), d: 1.1, hold: 0.35 },
    { pose: { p: [77, 109], torso: 146, head: 156, legN: { t: [100, 146] }, armN: [88, 90] }, d: 0.9, hold: 0.25 },
  ] };
  A.goblet = { view: 'side', ill: [0, 1], props: [FL, { t: 'db', at: 'wristN', r: 7, z: 'front' }], keys: [
    { pose: st({ armN: { rt: [-12, 13], b: -1 } }), d: 1.1, hold: 0.35 },
    { pose: { p: [78, 109], torso: 150, head: 160, legN: { t: [100, 146] }, armN: { rt: [-12, 13], b: -1 } }, d: 0.9, hold: 0.25 },
  ] };
  A.squatBB = { view: 'side', ill: [0, 1], props: [FL, { t: 'plate', at: 'wristN', r: 11, z: 'front' }], keys: [
    { pose: st({ armN: { rt: [3, -9], b: 1 } }), d: 1.2, hold: 0.35 },
    { pose: { p: [79, 108], torso: 152, head: 162, legN: { t: [100, 146] }, armN: { rt: [3, -9], b: 1 } }, d: 1.0, hold: 0.25 },
  ] };
  A.legPress = { view: 'side', ill: [1, 0], props: [
    FL, { t: 'thick', a: [56, 131], b: [20, 103], w: 6 }, { t: 'thick', a: [54, 134], b: [82, 134], w: 6 },
    { t: 'line', a: [34, 118], b: [34, 150] }, { t: 'line', a: [74, 137], b: [74, 150] },
    { t: 'line', a: [100, 132], b: [176, 92] }, { t: 'line', a: [160, 101], b: [160, 150] },
    { t: 'seg', at: 'ankleN', ang: 30, len: 36, off: [2, -6], w: 6, c: 'fx-plateline', z: 'front' },
  ], keys: [
    { pose: { p: [64, 120], torso: 232, head: 222, legN: { t: [126, 84] }, ftN: 205, armN: [60, 80] }, d: 1.1, hold: 0.3 },
    { pose: { p: [64, 120], torso: 232, head: 222, legN: { t: [100, 98] }, ftN: 205, armN: [60, 80] }, d: 1.0, hold: 0.25 },
  ] };
  A.lunge = { view: 'side', ill: [0, 2], props: [FL], keys: [
    { pose: st({ legF: { t: [98, 146] }, armN: [6, 8] }), d: 0.55, hold: 0.3 },
    { pose: { p: [82, 90], torso: 178, legN: { t: [100, 146] }, legF: { t: [58, 130] }, ftF: 70, armN: [6, 8] }, d: 0.5 },
    { pose: { p: [64, 107], torso: 174, legN: { t: [100, 146] }, legF: { t: [27, 140] }, ftF: 48, armN: [8, 10] }, d: 0.5, hold: 0.3 },
    { pose: { p: [82, 90], torso: 178, legN: { t: [100, 146] }, legF: { t: [58, 130] }, ftF: 70, armN: [6, 8] }, d: 0.55 },
  ] };
  A.splitSquat = { view: 'side', ill: [0, 1], props: [FL, { t: 'rect', x: 18, y: 109, w: 44, h: 6 }, ...benchLegs(24, 56, 115)], keys: [
    { pose: { p: [86, 80], torso: 180, legN: { t: [112, 146] }, legF: { t: [54, 103] }, ftF: -95, armN: [6, 6] }, d: 1.0, hold: 0.3 },
    { pose: { p: [80, 110], torso: 172, legN: { t: [112, 146] }, legF: { t: [54, 103] }, ftF: -95, armN: [10, 10] }, d: 1.0, hold: 0.25 },
  ] };
  A.rdlBB = { view: 'side', ill: [0, 1], props: [FL, { t: 'plate', at: 'wristN', r: 12, z: 'front' }], keys: [
    { pose: st({ armN: [5, 3] }), d: 1.3, hold: 0.3 },
    { pose: { p: [75, 85], torso: 116, head: 120, legN: { t: [100, 146] }, armN: [0, 0] }, d: 1.0, hold: 0.25 },
  ] };
  A.rdlDB = Object.assign({}, A.rdlBB, { props: [FL, { t: 'db', at: 'wristN', z: 'front' }], _ready: false });
  A.deadlift = { view: 'side', ill: [0, 1], props: [FL, { t: 'plate', at: 'wristN', r: 12, z: 'front' }], keys: [
    { pose: { p: [77, 111], torso: 125, head: 135, legN: { t: [102, 146] }, armN: [0, 0] }, d: 1.0, hold: 0.45 },
    { pose: { p: [96, 76], torso: 183, legN: { t: [100, 146] }, armN: [3, 3] }, d: 1.2, hold: 0.4 },
  ] };
  A.legExt = { view: 'side', ill: [0, 1], props: [
    FL, { t: 'thick', a: [52, 117], b: [104, 117], w: 6 }, { t: 'thick', a: [64, 113], b: [62, 68], w: 6 },
    { t: 'line', a: [66, 120], b: [66, 150] }, { t: 'line', a: [96, 120], b: [96, 150] },
    { t: 'pad', at: 'ankleN', r: 6, off: [3, -2] },
  ], keys: [
    { pose: { p: [74, 110], torso: 184, head: 182, legN: [90, 6], ftN: 90, armN: [24, 64] }, d: 1.0, hold: 0.25 },
    { pose: { p: [74, 110], torso: 184, head: 182, legN: [90, 84], ftN: 160, armN: [24, 64] }, d: 1.1, hold: 0.35 },
  ] };
  A.legCurl = { view: 'side', ill: [0, 1], props: [
    FL, { t: 'thick', a: [52, 117], b: [104, 117], w: 6 }, { t: 'thick', a: [64, 113], b: [62, 68], w: 6 },
    { t: 'line', a: [66, 120], b: [66, 150] }, { t: 'line', a: [96, 120], b: [96, 150] },
    { t: 'pad', at: 'ankleN', r: 6, off: [0, 5] }, { t: 'thick', a: [92, 100], b: [116, 100], w: 5, z: 'front' },
  ], keys: [
    { pose: { p: [74, 110], torso: 184, head: 182, legN: [90, 80], ftN: 150, armN: [24, 64] }, d: 1.0, hold: 0.25 },
    { pose: { p: [74, 110], torso: 184, head: 182, legN: [90, -18], ftN: 60, armN: [24, 64] }, d: 1.1, hold: 0.35 },
  ] };
  A.bridge = { view: 'side', ill: [0, 1], props: [FL], keys: [
    { pose: { p: [104, 138], torso: 270, head: 268, legN: { t: [136, 146] }, armN: [88, 90] }, d: 0.9, hold: 0.25 },
    { pose: { p: [99.6, 119.8], torso: 297, head: 265, legN: { t: [136, 146] }, armN: [88, 90] }, d: 1.0, hold: 0.5 },
  ] };
  A.hipThrust = { view: 'side', ill: [0, 1], props: [FL, { t: 'rect', x: 2, y: 109, w: 56, h: 6 }, ...benchLegs(10, 50, 115), { t: 'plate', at: 'pelvis', off: [3, -12], r: 12, z: 'front' }], keys: [
    { pose: { p: [85.7, 130.8], torso: 228, head: 205, legN: { t: [132, 146] }, armN: { rt: [-34, 14], b: -1 } }, d: 1.0, hold: 0.25 },
    { pose: { p: [96, 105.4], torso: 268, head: 245, legN: { t: [132, 146] }, armN: { rt: [-34, 14], b: -1 } }, d: 1.0, hold: 0.5 },
  ] };
  A.calf = { view: 'side', ill: [0, 1], props: [FL], keys: [
    { pose: st({ armN: [4, 4], ftN: 90 }), d: 0.8, hold: 0.25 },
    { pose: { p: [97, 68], torso: 180, legN: { t: [101, 138] }, ftN: 44, armN: [4, 4] }, d: 0.9, hold: 0.5 },
  ] };

  // ---------- chest ----------
  const benchFlat = [FL, { t: 'rect', x: 34, y: 116, w: 102, h: 6 }, ...benchLegs(44, 126, 122)];
  const lieBase = { p: [118, 105], torso: 270, head: 268, legN: { t: [151, 146] } };
  const lie = (arm) => Object.assign({}, lieBase, { armN: arm });
  A.benchBB = { view: 'side', ill: [0, 1], props: [...benchFlat, { t: 'plate', at: 'wristN', r: 12, z: 'front' }], keys: [
    { pose: lie({ t: [80, 56], b: -1 }), d: 1.2, hold: 0.3 },
    { pose: lie({ t: [86, 89], b: -1, k: [0.55, 1] }), d: 1.0, hold: 0.2 },
  ] };
  A.benchDB = { view: 'side', ill: [0, 1], props: [...benchFlat, { t: 'db', at: 'wristN', r: 6, z: 'front' }], keys: [
    { pose: lie({ t: [80, 56], b: -1 }), d: 1.2, hold: 0.3 },
    { pose: lie({ t: [88, 91], b: -1, k: [0.55, 1] }), d: 1.0, hold: 0.2 },
  ] };
  A.inclineDB = { view: 'side', ill: [0, 1], props: [
    FL, { t: 'thick', a: [106, 118], b: [75, 87], w: 6 }, { t: 'thick', a: [98, 121], b: [126, 121], w: 6 },
    { t: 'line', a: [112, 124], b: [112, 150] }, { t: 'line', a: [82, 96], b: [70, 150] },
    { t: 'db', at: 'wristN', r: 6, z: 'front' },
  ], keys: [
    { pose: { p: [112, 112], torso: 225, head: 218, legN: { t: [150, 146] }, armN: { t: [87, 40], b: -1 } }, d: 1.2, hold: 0.3 },
    { pose: { p: [112, 112], torso: 225, head: 218, legN: { t: [150, 146] }, armN: { t: [95, 74], b: -1, k: [0.55, 1] } }, d: 1.0, hold: 0.2 },
  ] };
  A.chestPress = { view: 'side', ill: [0, 1], props: [
    FL, { t: 'thick', a: [56, 120], b: [96, 120], w: 6 }, { t: 'thick', a: [71, 118], b: [69, 70], w: 6 },
    { t: 'line', a: [76, 123], b: [76, 150] }, { t: 'seg', at: 'wristN', ang: 0, len: 14, w: 4, c: 'fx-eqthick', z: 'front' },
  ], keys: [
    { pose: { p: [80, 114], torso: 182, head: 180, legN: [88, 4], armN: { t: [94, 80], b: -1, k: [0.6, 1] } }, d: 1.0, hold: 0.2 },
    { pose: { p: [80, 114], torso: 182, head: 180, legN: [88, 4], armN: { t: [126, 77], b: -1 } }, d: 1.1, hold: 0.3 },
  ] };
  A.cableFly = { view: 'front', ill: [0, 1], props: [
    FL, { t: 'line', a: [186, 0], b: [186, 150] }, { t: 'line', a: [14, 0], b: [14, 150] },
    { t: 'cable', from: [182, 12], to: 'wristR' }, { t: 'cable', from: [18, 12], to: 'wristL' },
    { t: 'grip', at: 'wristR' }, { t: 'grip', at: 'wristL' },
  ], keys: [
    { pose: { p: [100, 76], leg: [5, 1], arm: [112, 104] }, d: 1.1, hold: 0.25 },
    { pose: { p: [100, 76], leg: [5, 1], arm: { t: [105, 72], b: -1, k: [0.62, 0.62] } }, d: 1.2, hold: 0.35 },
  ] };
  const plankUp = { p: [104.1, 112], torso: 113.6, head: 110, legN: { t: [40, 139] }, ftN: 25 };
  A.pushup = { view: 'side', ill: [0, 1], props: [FL], keys: [
    { pose: Object.assign({}, plankUp, { armN: { t: [141, 145], b: -1 } }), d: 1.1, hold: 0.25 },
    { pose: { p: [109.3, 128.8], torso: 98.3, head: 96, legN: { t: [40, 139] }, ftN: 25, armN: { t: [141, 145], b: -1, k: [0.8, 1] } }, d: 0.9, hold: 0.2 },
  ] };
  A.kneePushup = { view: 'side', ill: [0, 1], props: [FL], keys: [
    { pose: { p: [97.9, 121.3], torso: 129.2, head: 125, legN: [-50.8, -90], ftN: -110, armN: { t: [129, 145], b: -1 } }, d: 1.1, hold: 0.25 },
    { pose: { p: [104.6, 132.1], torso: 106, head: 104, legN: [-74, -90], ftN: -110, armN: { t: [129, 145], b: -1, k: [0.8, 1] } }, d: 0.9, hold: 0.2 },
  ] };

  // ---------- back ----------
  const bar = (y) => ({ t: 'line', a: [30, y], b: [170, y], c: 'fx-bar' });
  A.pullup = { view: 'front', face: 'back', vb: HANG, ill: [0, 1], props: [bar(6)], keys: [
    { pose: { p: [100, 93], leg: [-2, 2], arm: { t: [138, 8], b: -1 } }, d: 1.0, hold: 0.3 },
    { pose: { p: [100, 60], leg: [-2, 4], arm: { t: [138, 8], b: -1, k: [0.85, 1] } }, d: 1.2, hold: 0.3 },
  ] };
  A.chinup = { view: 'front', face: 'back', vb: HANG, ill: [0, 1], props: [bar(6)], keys: [
    { pose: { p: [100, 98], leg: [-2, 2], arm: { t: [117, 8], b: -1 } }, d: 1.0, hold: 0.3 },
    { pose: { p: [100, 62], leg: [-2, 4], arm: { t: [117, 8], b: -1, k: [0.6, 1] } }, d: 1.2, hold: 0.3 },
  ] };
  const seatF = [FL, { t: 'rect', x: 76, y: 110, w: 48, h: 6 }, { t: 'line', a: [100, 116], b: [100, 150] }];
  const seatedLeg = { a: [52, 4], k: [0.35, 1] };
  A.latPulldown = { view: 'front', face: 'back', ill: [0, 1], props: [...seatF, { t: 'cable', from: [100, 2], to: ['wristL', 'wristR'] }, { t: 'fbar', ext: 16, plates: false, z: 'front' }], keys: [
    { pose: { p: [100, 104], leg: seatedLeg, arm: { t: [142, 26], b: -1 } }, d: 1.0, hold: 0.25 },
    { pose: { p: [100, 104], leg: seatedLeg, arm: { t: [135, 58], b: -1 } }, d: 1.1, hold: 0.3 },
  ] };
  A.rowBB = { view: 'side', ill: [0, 1], props: [FL, { t: 'plate', at: 'wristN', r: 12, z: 'front' }], keys: [
    { pose: { p: [78, 82], torso: 118, head: 114, legN: { t: [100, 146] }, armN: [0, 0] }, d: 0.9, hold: 0.25 },
    { pose: { p: [78, 82], torso: 118, head: 114, legN: { t: [100, 146] }, armN: { t: [103, 95], b: -1 } }, d: 1.1, hold: 0.35 },
  ] };
  A.rowDB = { view: 'side', ill: [0, 1], props: [FL, { t: 'rect', x: 112, y: 126, w: 64, h: 6, far: true }, ...benchLegs(118, 170, 132), { t: 'db', at: 'wristN', r: 6, z: 'front' }], keys: [
    { pose: { p: [82, 88], torso: 105, head: 102, legN: { t: [68, 146] }, legF: { t: [104, 146] }, armF: { t: [125, 124], b: 1 }, armN: [-4, -4] }, d: 0.9, hold: 0.25 },
    { pose: { p: [82, 88], torso: 105, head: 102, legN: { t: [68, 146] }, legF: { t: [104, 146] }, armF: { t: [125, 124], b: 1 }, armN: { t: [104, 97], b: -1 } }, d: 1.1, hold: 0.35 },
  ] };
  A.cableRow = { view: 'side', ill: [0, 1], props: [
    FL, { t: 'thick', a: [28, 142], b: [92, 142], w: 6 }, { t: 'line', a: [36, 145], b: [36, 150] }, { t: 'line', a: [84, 145], b: [84, 150] },
    { t: 'thick', a: [125, 106], b: [125, 142], w: 5 }, { t: 'line', a: [160, 30], b: [160, 150] },
    { t: 'cable', from: [156, 116], to: 'wristN' }, { t: 'grip', at: 'wristN', z: 'front' },
  ], keys: [
    { pose: { p: [60, 128], torso: 160, head: 158, legN: { t: [117, 124] }, ftN: 165, armN: { t: [118, 112], b: -1 } }, d: 1.0, hold: 0.25 },
    { pose: { p: [60, 128], torso: 186, head: 182, legN: { t: [117, 124] }, ftN: 165, armN: { t: [86, 110], b: -1 } }, d: 1.1, hold: 0.35 },
  ] };
  const stagger = { p: [92, 76], torso: 184, legN: { t: [108, 146] }, legF: { t: [76, 146] } };
  A.facePull = { view: 'side', ill: [0, 1], props: [FL, { t: 'line', a: [194, 0], b: [194, 150] }, { t: 'cable', from: [190, 22], to: 'wristN' }, { t: 'grip', at: 'wristN', z: 'front' }], keys: [
    { pose: Object.assign({}, stagger, { armN: { t: [140, 28], b: 1 } }), d: 1.0, hold: 0.25 },
    { pose: Object.assign({}, stagger, { armN: { t: [101, 22], b: 1 } }), d: 1.1, hold: 0.4 },
  ] };
  A.bandRow = { view: 'side', ill: [0, 1], props: [FL, { t: 'line', a: [194, 0], b: [194, 150] }, { t: 'band', from: [192, 62], to: 'wristN' }, { t: 'grip', at: 'wristN', z: 'front' }], keys: [
    { pose: Object.assign({}, stagger, { torso: 180, armN: { t: [141, 56], b: -1 } }), d: 1.0, hold: 0.25 },
    { pose: Object.assign({}, stagger, { torso: 182, armN: { t: [104, 66], b: -1 } }), d: 1.1, hold: 0.4 },
  ] };
  A.doorRow = { view: 'side', ill: [0, 1], props: [FL, { t: 'thick', a: [142, -10], b: [142, 150], w: 6 }], keys: [
    { pose: { p: [106.7, 78.7], torso: 196, head: 192, legN: { t: [126, 146] }, armN: { t: [136, 70], b: -1 } }, d: 1.0, hold: 0.25 },
    { pose: { p: [118.7, 76.4], torso: 186, head: 184, legN: { t: [126, 146] }, armN: { t: [136, 70], b: -1 } }, d: 1.0, hold: 0.4 },
  ] };
  A.superman = { view: 'side', ill: [0, 1], props: [FL], keys: [
    { pose: { p: [96, 139], torso: 90, head: 92, armN: [90, 90], legN: [-90, -90], ftN: -90 }, d: 0.9, hold: 0.25 },
    { pose: { p: [96, 140], torso: 102, head: 108, armN: [106, 106], legN: [-102, -100], ftN: -100 }, d: 1.0, hold: 0.6 },
  ] };
  A.bandPullApart = { view: 'front', face: 'back', ill: [0, 1], props: [FL, { t: 'band', from: 'wristL', to: 'wristR' }], keys: [
    { pose: { p: [100, 76], leg: [4, 1], arm: { a: [58, 70], k: [0.35, 0.4] } }, d: 1.0, hold: 0.25 },
    { pose: { p: [100, 76], leg: [4, 1], arm: [90, 90] }, d: 1.0, hold: 0.4 },
  ] };

  // ---------- shoulders ----------
  A.ohp = { view: 'side', vb: TALL, ill: [0, 1], props: [FL, { t: 'plate', at: 'wristN', r: 12, z: 'front' }], keys: [
    { pose: st({ head: 188, armN: { t: [109, 41], b: -1 } }), d: 1.1, hold: 0.3 },
    { pose: st({ head: 180, armN: { t: [95, -12], b: -1 } }), d: 1.0, hold: 0.3 },
  ] };
  A.dbPress = { view: 'front', vb: TALL, ill: [0, 1], props: [...seatF, { t: 'rect', x: 86, y: 54, w: 28, h: 54, r: 4 }, { t: 'fdb', at: 'wristR', z: 'front' }, { t: 'fdb', at: 'wristL', z: 'front' }], keys: [
    { pose: { p: [100, 104], leg: seatedLeg, arm: { t: [134, 60], b: -1 } }, d: 1.1, hold: 0.25 },
    { pose: { p: [100, 104], leg: seatedLeg, arm: { t: [123, 17], b: -1 } }, d: 1.0, hold: 0.3 },
  ] };
  A.latRaise = { view: 'front', ill: [0, 1], props: [FL, { t: 'db', at: 'wristR', z: 'front' }, { t: 'db', at: 'wristL', z: 'front' }], keys: [
    { pose: { p: [100, 76], leg: [3, 0], arm: [10, 6] }, d: 1.0, hold: 0.2 },
    { pose: { p: [100, 76], leg: [3, 0], arm: [86, 80] }, d: 1.2, hold: 0.3 },
  ] };
  A.latRaiseBand = Object.assign({}, A.latRaise, { props: [FL, { t: 'band', from: 'ankleR', to: 'wristR' }, { t: 'band', from: 'ankleL', to: 'wristL' }, { t: 'grip', at: 'wristR', z: 'front' }, { t: 'grip', at: 'wristL', z: 'front' }], keys: JSON.parse(JSON.stringify(A.latRaise.keys)) });
  A.pike = { view: 'side', ill: [0, 1], props: [FL], keys: [
    { pose: { p: [88, 78], torso: 68, head: 30, legN: { t: [50, 140] }, ftN: 20, armN: { t: [130, 145], b: -1 } }, d: 1.0, hold: 0.25 },
    { pose: { p: [90, 76], torso: 36, head: 16, legN: { t: [50, 140] }, ftN: 20, armN: { t: [130, 145], b: -1, k: [0.85, 1] } }, d: 1.0, hold: 0.2 },
  ] };

  // ---------- arms ----------
  const curl = (props) => ({ view: 'side', ill: [0, 1], props: [FL, ...props], keys: [
    { pose: st({ armN: [3, 4] }), d: 1.0, hold: 0.2 },
    { pose: st({ armN: [12, 150] }), d: 1.2, hold: 0.3 },
  ] });
  A.curlBB = curl([{ t: 'plate', at: 'wristN', r: 12, z: 'front' }]);
  A.curlDB = curl([{ t: 'db', at: 'wristN', z: 'front' }]);
  A.curlBand = curl([{ t: 'band', from: 'ankleN', to: 'wristN' }, { t: 'grip', at: 'wristN', z: 'front' }]);
  const pd = (props) => ({ view: 'side', ill: [0, 1], props: [FL, ...props], keys: [
    { pose: { p: [94, 76], torso: 172, head: 176, legN: { t: [100, 146] }, armN: [4, 140] }, d: 1.0, hold: 0.2 },
    { pose: { p: [94, 76], torso: 172, head: 176, legN: { t: [100, 146] }, armN: [6, 4] }, d: 1.2, hold: 0.35 },
  ] });
  A.pushdown = pd([{ t: 'line', a: [134, 0], b: [134, 150] }, { t: 'cable', from: [128, 4], to: 'wristN' }, { t: 'grip', at: 'wristN', z: 'front' }]);
  A.pushdownBand = pd([{ t: 'line', a: [134, 0], b: [134, 150] }, { t: 'band', from: [132, 4], to: 'wristN' }, { t: 'grip', at: 'wristN', z: 'front' }]);
  A.ohExt = { view: 'side', vb: TALL, ill: [0, 1], props: [FL, { t: 'db', at: 'wristN', r: 7, z: 'front' }], keys: [
    { pose: st({ armN: [160, -32] }), d: 1.1, hold: 0.25 },
    { pose: st({ armN: [162, 168] }), d: 1.1, hold: 0.3 },
  ] };
  A.benchDip = { view: 'side', ill: [0, 1], props: [FL, { t: 'rect', x: 18, y: 105, w: 60, h: 6 }, ...benchLegs(26, 70, 111)], keys: [
    { pose: { p: [80, 96], torso: 180, legN: { t: [128, 146] }, ftN: 160, armN: { t: [74, 103], b: -1 } }, d: 1.1, hold: 0.25 },
    { pose: { p: [82, 122], torso: 180, legN: { t: [128, 146] }, ftN: 160, armN: { t: [74, 103], b: -1 } }, d: 1.0, hold: 0.2 },
  ] };

  // ---------- core & conditioning ----------
  A.plank = { view: 'side', ill: [0, 0], props: [FL], keys: [
    { pose: { p: [108.6, 126], torso: 101.5, head: 100, legN: { t: [40, 139] }, ftN: 25, armN: [0, 90] }, d: 1.6 },
    { pose: { p: [108.6, 124.6], torso: 102.3, head: 101, legN: { t: [40, 139] }, ftN: 25, armN: [0, 90] }, d: 1.6 },
  ] };
  A.crunch = { view: 'side', ill: [0, 1], props: [FL], keys: [
    { pose: { p: [112, 140], torso: 268, head: 266, legN: { t: [146, 146] }, armN: { rt: [12, 8], b: -1 } }, d: 0.9, hold: 0.2 },
    { pose: { p: [112, 140], torso: 236, head: 228, legN: { t: [146, 146] }, armN: { rt: [12, 8], b: -1 } }, d: 0.9, hold: 0.35 },
  ] };
  A.legRaise = { view: 'side', ill: [0, 1], props: [FL], keys: [
    { pose: { p: [100, 140], torso: 270, head: 268, legN: [96, 96], ftN: 160, armN: [88, 90] }, d: 1.2, hold: 0.2 },
    { pose: { p: [100, 140], torso: 270, head: 268, legN: [178, 178], ftN: 205, armN: [88, 90] }, d: 1.2, hold: 0.3 },
  ] };
  A.hangKnee = { view: 'side', vb: HANG, ill: [0, 1], props: [bar(6)], keys: [
    { pose: { p: [100, 96], torso: 182, legN: [2, 2], armN: { t: [100, 8], b: -1 } }, d: 1.0, hold: 0.25 },
    { pose: { p: [96, 93], torso: 190, legN: [104, 8], armN: { t: [100, 8], b: -1 } }, d: 1.0, hold: 0.35 },
  ] };
  A.mountain = { view: 'side', ill: [0, 1], props: [FL], keys: [
    { pose: Object.assign({}, plankUp, { armN: { t: [141, 145], b: -1 }, legN: { t: [100, 134] }, legF: { t: [40, 139] }, ftN: 20, ftF: 25 }), d: 0.38 },
    { pose: Object.assign({}, plankUp, { armN: { t: [141, 145], b: -1 }, legN: { t: [40, 139] }, legF: { t: [100, 134] }, ftN: 25, ftF: 20 }), d: 0.38 },
  ] };
  A.jacks = { view: 'front', ill: [0, 1], props: [FL], keys: [
    { pose: { p: [100, 76], leg: [2, 0], arm: [8, 6] }, d: 0.36 },
    { pose: { p: [100, 72], leg: [17, 14], arm: [150, 168] }, d: 0.36 },
  ] };
  return A;
})();
if (typeof module !== 'undefined') module.exports = ANIMS;
