import * as THREE from 'three';
import { makeRng } from '../lib/utils.js';
import { radiusAtAngle } from './shapes.js';

// ─────────────────────────────────────────────────────────────────────────────
// Topper models. Each factory returns a THREE.Group positioned on the cake.
// Every model is built from primitives — no external .glb, so the whole
// studio loads instantly and works fully offline.
// ─────────────────────────────────────────────────────────────────────────────

const TAU = Math.PI * 2;
const rng = makeRng(20261007);

// ── detail tiers ────────────────────────────────────────────────────────────
// Every sphere/cylinder/torus in this file used to be built at 8-16 segments,
// which is why the add-ons read as faceted next to the (smooth) tiers. The
// factories below take their segment counts from here instead. The names map
// to the studio's quality setting, so 'low' still gives a usable framerate.
const DETAIL = {
  low: { sphere: [20, 14], round: 20, tube: 8, capsule: [6, 14] },
  medium: { sphere: [32, 22], round: 32, tube: 12, capsule: [10, 22] },
  high: { sphere: [48, 32], round: 48, tube: 18, capsule: [14, 32] },
};
let D = DETAIL.high;

/** Studio sets this alongside its own quality tier. */
export function setTopperQuality(q) {
  D = DETAIL[q] || DETAIL.high;
}
export function topperDetail() { return D; }

const std = (color, roughness = 0.55, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.03, ...extra });
const phys = (color, roughness = 0.35, extra = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness, metalness: 0.05, ...extra });

/** Shared: place items around a ring at radius r, on the cake top. */
function ring(count, r, y, jitter = 0.12) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + (rng() - 0.5) * 0.3;
    const rr = r * (0.55 + rng() * 0.35);
    out.push({
      x: Math.cos(a) * rr,
      z: Math.sin(a) * rr,
      y: y + (rng() - 0.5) * jitter,
      a,
    });
  }
  return out;
}

// ─── flowers ────────────────────────────────────────────────────────────────

/**
 * A petal, as opposed to a squashed sphere.
 *
 * Every petal in this file used to be a `SphereGeometry` with a `scale` — a
 * balloon. A balloon has no edge: it meets the next petal in a smooth tangent,
 * so a rose built from them reads as one scoop of ice cream no matter how many
 * segments it has. A petal needs a silhouette that is narrow at the base, widest
 * about three-fifths out, drawn to a soft point, thin at the rim, and *folded*
 * across its width so it reads as a shell rather than a blade.
 *
 * Starts from a sphere (so it inherits the smooth high-segment surface) and
 * reshapes it. Length runs along +Z, base at z = 0.
 */
function petalGeometry(len, wid, thick = 0.13, cup = 0.4, fold = 0.45, seg = 28, tip = 0.55) {
  const geo = new THREE.SphereGeometry(1, seg, Math.max(10, Math.round(seg * 0.6)));
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    // Both poles of a sphere are single vertices, so mapping z straight to the
    // tip puts a needle at each end — which is what made these read as carrots.
    // asin() re-spaces z linearly along the petal while the ring radius
    // sqrt(1 - z²) still shapes the silhouette, so the far pole now lands in the
    // MIDDLE of a rounded tip instead of at the end of a spike.
    const t = Math.asin(THREE.MathUtils.clamp(z, -1, 1)) / Math.PI + 0.5;
    // Broad and obovate: nearly full width for the first half of the petal, then
    // rounding off. The previous sin(t^1.3π)^0.62 profile tapered continuously
    // from the base, which gives a lance — a blade, and blades are what a lily
    // is made of. A rose petal is round-ended and wide.
    //
    // `tip` is the exponent that decides how the tip is SHAPED, and it is per
    // flower because the right answer is not the same for both. A low exponent
    // holds most of the width until very near the end and then closes it fast —
    // a round tip, which is what an orchid's near-circular laterals want. The
    // default spends a longer tail tapering, which reads as a soft round-off at
    // rose scale but goes chisel-pointed on a petal this size. Making the round
    // version the default seemed obviously better and was not: the extra width
    // is most of a whorl's silhouette, and at rose proportions it re-opened the
    // outer whorl into the flat pale saucer that reads as a lotus.
    const w = Math.pow(1 - Math.pow(t, 3.2), tip);
    // Thickness holds a third back at the tip, so the two faces do not meet at
    // zero angle — the rolled edge a real petal ends in.
    const body = 0.3 + 0.7 * w;
    pos.setX(i, x * wid * 0.5 * w);
    pos.setY(
      i,
      y * thick * body
      + cup * t * t * len * 0.3       // lengthwise curl: positive closes inward
      + fold * x * x * wid * 0.5,     // cross-fold: lifts both rims off the blade
    );
    pos.setZ(i, t * len);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * One whorl of petals around a common axis, all sharing one geometry.
 *
 * `lean` is measured from horizontal-outward: 0 lays the petal flat on the
 * table pointing away from the axis, π/2 stands it straight up, and anything
 * past π/2 tips it INWARD over the centre.
 *
 * The petal's SIZE is derived rather than passed. A whorl of `count` petals has
 * a fixed amount of base circumference to cover, so the petal width that makes
 * neighbours just meet is that circumference divided by `count`; `overlap`
 * scales it from there. Sizing petals off the whorl radius instead — which is
 * what this did first — makes them nearly half again too wide, and petals that
 * wide cannot help but fuse into a solid bowl. The length is a fraction of the
 * radius, and together the two give the flower its proportions.
 */
function petalLayer(radius, count, lean, color, opts = {}) {
  const {
    cup = 0.30,      // lengthwise curl of the tip, as a fraction of petal length
    fold = 0.5,      // cross-fold of the rims
    curl = 0.1,      // sideways roll, breaks the wheel symmetry
    base = 0.55,     // where the petal bases sit, as a fraction of `radius`
    len = 0.85,      // petal length, as a fraction of `radius`
    overlap = 1.2,   // petal width vs. the spacing that would just touch
    tip = 0.55,      // tip roundness — see petalGeometry; higher is more pointed
    phase = 0,       // azimuth offset, so successive whorls spiral
  } = opts;
  const g = new THREE.Group();
  const wid = 2 * Math.PI * radius * base * overlap / count;
  const geo = petalGeometry(radius * len, wid, radius * 0.06, cup, fold, 28, tip);
  const mat = std(color, 0.6, { side: THREE.DoubleSide });
  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * TAU;
    const p = new THREE.Mesh(geo, mat);
    p.position.set(Math.cos(a) * radius * base, 0, Math.sin(a) * radius * base);
    p.rotation.order = 'YXZ';
    p.rotation.y = -a + Math.PI / 2;   // petal's +Z points outward from the centre
    p.rotation.x = -lean;              // …then leans up out of the horizontal
    p.rotation.z = curl;
    g.add(p);
  }
  g.userData.assets = [geo, mat];
  return g;
}

/**
 * A garden rose, not a water lily.
 *
 * The difference is entirely in the envelope. A lily is a bowl: its petals all
 * sweep up and inward around an open middle, so the silhouette is a cup you can
 * see the bottom of. A rose is a dome — a squashed sphere, wider than it is
 * tall, whose petals climb to a rounded crown and close it. So the whorls here
 * are laid out to a dome profile, with the rise of each whorl picked so the
 * height of every petal TIP traces that curve rather than a straight climb.
 * That single change is what stops the flower looking like a lotus; getting the
 * petal shapes right without it just produces a better-looking lotus.
 *
 * Colour runs dark in the heart and light outside, which is how a rose actually
 * reads — the outer petals catch the light and the centre sits in its own
 * shadow. Note that this is the OPPOSITE of the natural painting order and the
 * reverse of what this did first; palest-in-the-middle is exactly the white star
 * that made the flower look like a lily.
 */
function makeBloom(size = 0.3, colors = ['#f6d9dc', '#e5a9b6', '#c98f9b']) {
  const bloom = new THREE.Group();
  // radius, petals, lean, rise, colour, cup, fold, len. Outer to inner.
  //
  // The rises look uneven because they are: the outer petals lie almost flat so
  // they need a big step to reach dome height, while the inner ones already
  // stand nearly upright and only need a little. The last whorl rises least of
  // all, which recesses the centre slightly — the little dip at the heart of a
  // garden rose.
  //
  // The outer petals are also the SHORTEST. They are the oldest, most open ones,
  // and giving them the same length as the rest is what left a wide pale saucer
  // spread under each flower; a rose ball is barely wider than the whorl that
  // starts it.
  const whorls = [
    [1.00, 7, 0.62, 0.00, 0, -0.20, 0.30, 0.60],
    [0.92, 7, 0.78, 0.09, 0, 0.00, 0.36, 0.68],
    [0.82, 6, 0.95, 0.17, 1, 0.16, 0.42, 0.76],
    [0.70, 6, 1.12, 0.24, 1, 0.32, 0.48, 0.84],
    [0.58, 5, 1.32, 0.31, 2, 0.46, 0.54, 0.92],
    [0.45, 5, 1.52, 0.37, 2, 0.58, 0.60, 1.00],
    [0.33, 4, 1.72, 0.43, 2, 0.70, 0.66, 1.05],   // closes over the axis
  ];
  whorls.forEach(([r, n, lean, rise, ci, cup, fold, len], i) => {
    const layer = petalLayer(size * r, n, lean, colors[ci], {
      cup,
      fold,
      len,
      curl: 0.1,
      // Half a step between whorls, so petals sit in the gaps of the whorl below
      // and the flower spirals instead of stacking into a symmetrical wheel.
      phase: (i % 2) * (Math.PI / n),
    });
    layer.position.y = size * rise;
    bloom.add(layer);
  });
  whorls.forEach(([r, n, lean, rise, ci, cup, fold], i) => {
    const layer = petalLayer(size * r, n, lean, colors[ci], {
      cup,
      fold,
      curl: 0.12,
      // Half a step between whorls, so petals sit in the gaps of the whorl below
      // and the flower spirals instead of stacking into a symmetrical wheel.
      phase: (i % 2) * (Math.PI / n),
    });
    layer.position.y = size * rise;
    bloom.add(layer);
  });
  // assets are registered inside petalLayer; collect them so dispose() is whole.
  const assets = [];
  bloom.traverse((o) => { if (o.isMesh) assets.push(...(o.parent?.userData?.assets || [])); });
  bloom.userData.assets = [...new Set(assets)];
  return bloom;
}

/**
 * A five-petal floret — cherry blossom, plum, the little almond flowers.
 *
 * These are NOT small roses. A blossom is one ring of five broad, notched
 * petals around a brush of stamens; run through makeBloom it comes out as a
 * shrunken rose, which is why this used to look wrong. The notched tip is the
 * giveaway shape, and the stamens are what stop the middle reading as a hole.
 */
function makeBlossom(size = 0.24, petalColor = '#fdf0f3', stamenColor = '#e8b93c') {
  const g = new THREE.Group();
  const N = 5;
  const wid = 2 * Math.PI * size * 0.45 * 1.5 / N;
  const geo = petalGeometry(size * 0.95, wid, size * 0.06, 0.16, 0.5);
  // Notch the tip, which is the one feature that says "blossom" on its own.
  // The tip of a petal is the strip of vertices nearest the far end, and the
  // profile gives it one vertex per column — so pulling the centre column back
  // along the petal carves a clean V.
  const pos = geo.attributes.position;
  const L = size * 0.95;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    if (z < L * 0.86) continue;
    const notch = Math.max(0, 1 - Math.abs(x) / (wid * 0.5)) * L * 0.14;
    pos.setZ(i, z - notch);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const mat = std(petalColor, 0.6, { side: THREE.DoubleSide });
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    const p = new THREE.Mesh(geo, mat);
    p.position.set(Math.cos(a) * size * 0.42, 0, Math.sin(a) * size * 0.42);
    p.rotation.order = 'YXZ';
    p.rotation.y = -a + Math.PI / 2;
    p.rotation.x = -0.35;
    g.add(p);
  }

  const filGeo = new THREE.CylinderGeometry(size * 0.012, size * 0.018, size * 0.5, 6);
  const filMat = std(stamenColor, 0.6);
  const tipGeo = new THREE.SphereGeometry(size * 0.045, 12, 8);
  const tipMat = std(stamenColor, 0.45);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + 0.4;
    const f = new THREE.Mesh(filGeo, filMat);
    f.position.set(Math.cos(a) * size * 0.14, size * 0.22, Math.sin(a) * size * 0.14);
    f.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
    g.add(f);
    const t = new THREE.Mesh(tipGeo, tipMat);
    t.position.set(Math.cos(a) * size * 0.26, size * 0.45, Math.sin(a) * size * 0.26);
    g.add(t);
  }
  g.userData.assets = [geo, mat, filGeo, filMat, tipGeo, tipMat];
  return g;
}

function makeLeaf(size, color = '#7d9b63') {
  const g = new THREE.Group();
  // Same treatment as the petals: a tapered blade with a pointed tip, not a
  // stretched sphere. Thin, with a slight cup so it catches a highlight.
  const geo = petalGeometry(size * 2.0, size * 0.86, size * 0.10, 0.22, 0.06, 18);
  const mat = std(color, 0.7, { side: THREE.DoubleSide });
  const l = new THREE.Mesh(geo, mat);
  l.rotation.x = -Math.PI / 2 + 0.28;   // lay it roughly flat, tip up a little
  l.rotation.z = 0.5;
  g.add(l);
  g.userData.assets = [geo, mat];
  return g;
}

/**
 * A stem standing ON the surface, not centred on it.
 *
 * A CylinderGeometry is centred on its own origin, so a stem left at position 0
 * runs from -h/2 to +h/2 and sinks half its length into the cake. Every caller
 * then had to place its flower at a height that had nothing to do with where the
 * stem actually ended — which is why the blooms were floating a third of a unit
 * above their own stems with clear air between. Seating it here means y = 0 is
 * the icing and y = height is the tip, for every stem in the file.
 */
function makeStem(height = 0.5, color = '#6b7d4f') {
  const geo = new THREE.CylinderGeometry(0.022, 0.03, height, D.round);
  const mat = std(color, 0.75);
  const m = new THREE.Mesh(geo, mat);
  m.position.y = height / 2;
  m.userData.assets = [geo, mat];
  m.userData.tipY = height;
  return m;
}

// ─── chocolate ───────────────────────────────────────────────────────────

function makeShard(size = 0.5, color = '#3a2415', shine = 0.32) {
  const geo = new THREE.ConeGeometry(size * 0.4, size, D.round, 1);
  const mat = phys(color, shine, { metalness: 0.12, clearcoat: 0.4 });
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(0.55, 1, 1);
  m.userData.assets = [geo, mat];
  return m;
}

function makeCurl(size = 0.35, color = '#3a2415') {
  const pts = [];
  const turns = 2.4;
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * TAU * turns;
    const r = size * (1 - t * 0.55);
    pts.push(new THREE.Vector3(Math.cos(a) * r, t * size * 0.5, Math.sin(a) * r));
  }
  // Both counts come from D: the sweep (60 → D.tube * 4) and, more to the
  // point, the cross-section. A hardcoded 6 there made the curl a hexagonal
  // prism, which is exactly the faceting that shows at close-up.
  const geo = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(pts), 60, size * 0.07, D.tube, false,
  );
  const mat = phys(color, 0.28, { clearcoat: 0.5 });
  const m = new THREE.Mesh(geo, mat);
  m.userData.assets = [geo, mat];
  return m;
}

function makeTruffle(size = 0.24, color = '#4a2c17') {
  const geo = new THREE.SphereGeometry(size, D.sphere[0], D.sphere[1]);
  const mat = phys(color, 0.3, { clearcoat: 0.6, clearcoatRoughness: 0.4 });
  const m = new THREE.Mesh(geo, mat);
  m.scale.y = 0.86;
  m.userData.assets = [geo, mat];
  return m;
}

function makeCage(radius = 1.4, color = '#3a2415') {
  const g = new THREE.Group();
  const mat = phys(color, 0.3, { clearcoat: 0.5, metalness: 0.1 });
  const struts = 14;
  for (let i = 0; i < struts; i++) {
    const a = (i / struts) * TAU;
    const geo = new THREE.TorusGeometry(radius, 0.022, D.tube, 40, Math.PI * 0.72);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.set(Math.PI / 2, 0, a);
    m.position.y = radius * 0.42;
    m.scale.set(1, 1, 0.72);
    g.add(m);
  }
  const band = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.03, D.tube, 48), mat);
  band.rotation.x = Math.PI / 2;
  band.position.y = radius * 0.42;
  g.add(band);
  g.userData.assets = [mat];
  return g;
}

function makeSculptFigure(size = 0.8) {
  const g = new THREE.Group();
  const mat = phys('#3a2415', 0.3, { clearcoat: 0.5 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(size * 0.32, size * 0.9, D.capsule[0], D.capsule[1]), mat);
  body.position.y = size * 0.75;
  const head = new THREE.Mesh(new THREE.SphereGeometry(size * 0.26, D.sphere[0], D.sphere[1]), mat);
  head.position.y = size * 1.62;
  const armGeo = new THREE.CapsuleGeometry(size * 0.09, size * 0.5, D.capsule[0], D.capsule[1]);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, mat);
    arm.position.set(s * size * 0.36, size * 0.95, 0);
    arm.rotation.z = s * 0.5;
    g.add(arm);
  }
  g.add(body, head);
  g.userData.assets = [body.geometry, head.geometry, armGeo, mat];
  return g;
}

// ─── fruit ────────────────────────────────────────────────────────────────

function makeBerry(size = 0.16, color = '#b0305a', rough = 0.35) {
  const geo = new THREE.SphereGeometry(size, D.sphere[0], D.sphere[1]);
  const mat = phys(color, rough, { clearcoat: 0.5 });
  const m = new THREE.Mesh(geo, mat);
  m.scale.y = 0.9;
  m.userData.assets = [geo, mat];
  return m;
}

function makeStrawberry(size = 0.28) {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(size, D.sphere[0], D.sphere[1]);
  const mat = phys('#c9283c', 0.3, { clearcoat: 0.6 });
  const body = new THREE.Mesh(geo, mat);
  body.scale.set(1, 1.15, 1);
  g.add(body);
  const seedGeo = new THREE.SphereGeometry(size * 0.045, D.sphere[0], D.sphere[1]);
  const seedMat = std('#f2d38a', 0.5);
  for (let i = 0; i < 26; i++) {
    const t = (i / 26) * Math.PI * 1.4;
    const phi = (i * 2.4) % Math.PI;
    const s = new THREE.Mesh(seedGeo, seedMat);
    s.position.set(Math.sin(phi) * Math.cos(t) * size * 0.9, Math.cos(phi) * size * 0.9, Math.sin(phi) * Math.sin(t) * size * 0.9);
    g.add(s);
  }
  const leaf = new THREE.Mesh(new THREE.ConeGeometry(size * 0.34, size * 0.3, D.round), std('#4f7a3a', 0.7));
  leaf.position.y = size * 1.16;
  g.add(leaf);
  g.userData.assets = [geo, mat, seedGeo, seedMat, leaf.geometry, leaf.material];
  return g;
}

function makeFig(size = 0.3) {
  const geo = new THREE.SphereGeometry(size, D.sphere[0], D.sphere[1]);
  const mat = phys('#7a3b52', 0.42, { clearcoat: 0.35 });
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(0.82, 1.15, 0.82);
  m.userData.assets = [geo, mat];
  return m;
}

function makePomegranate(size = 0.22) {
  const geo = new THREE.SphereGeometry(size, D.sphere[0], D.sphere[1]);
  const mat = phys('#c9283c', 0.28, { clearcoat: 0.7, metalness: 0.1 });
  const m = new THREE.Mesh(geo, mat);
  m.userData.assets = [geo, mat];
  return m;
}

function makeCitrus(size = 0.2) {
  const geo = new THREE.SphereGeometry(size, D.sphere[0], D.sphere[1]);
  const mat = phys('#e8952b', 0.4, { clearcoat: 0.4 });
  const m = new THREE.Mesh(geo, mat);
  m.scale.y = 0.5;
  m.userData.assets = [geo, mat];
  return m;
}

function makeGoldBerry(size = 0.17) {
  const geo = new THREE.SphereGeometry(size, D.sphere[0], D.sphere[1]);
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#d9a441', roughness: 0.16, metalness: 1,
    clearcoat: 1, clearcoatRoughness: 0.1,
  });
  const m = new THREE.Mesh(geo, mat);
  m.userData.assets = [geo, mat];
  return m;
}

// ─── sugar & craft ────────────────────────────────────────────────────────

function makePearl(size = 0.09, color = '#fdf3ec') {
  const geo = new THREE.SphereGeometry(size, D.sphere[0], D.sphere[1]);
  const mat = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.12, metalness: 0.05,
    clearcoat: 1, iridescence: 0.85, iridescenceIOR: 1.4,
  });
  const m = new THREE.Mesh(geo, mat);
  m.userData.assets = [geo, mat];
  return m;
}

function makeMacaron(size = 0.22, color = '#f6d9dc') {
  const g = new THREE.Group();
  const shellGeo = new THREE.CylinderGeometry(size, size, size * 0.28, D.round, 1);
  const shellMat = std(color, 0.6);
  for (const s of [-1, 1]) {
    const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.position.y = s * size * 0.36;
    g.add(shell);
  }
  const creamGeo = new THREE.CylinderGeometry(size * 0.94, size * 0.94, size * 0.2, D.round);
  const creamMat = std('#fffaf0', 0.7);
  const cream = new THREE.Mesh(creamGeo, creamMat);
  g.add(cream);
  g.userData.assets = [shellGeo, shellMat, creamGeo, creamMat];
  return g;
}

function makeMeringue(size = 0.2) {
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push(new THREE.Vector2(Math.max(0.001, size * Math.sin(t * Math.PI * 0.5) * (1 - t * 0.4)), t * size * 1.7));
  }
  const geo = new THREE.LatheGeometry(pts, D.round);
  const mat = std('#fffaf0', 0.85);
  const m = new THREE.Mesh(geo, mat);
  m.userData.assets = [geo, mat];
  return m;
}

function makeIsomaltGem(size = 0.24, color = '#e5a9b6') {
  const geo = new THREE.OctahedronGeometry(size, 1);
  const mat = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.05, metalness: 0,
    transmission: 0.75, thickness: 0.6, ior: 1.6,
    clearcoat: 1, transparent: true, opacity: 0.92,
  });
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(0.8, 1.4, 0.8);
  m.userData.assets = [geo, mat];
  return m;
}

function makeMonogram(color = '#c9a24b') {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.18, metalness: 0.85, clearcoat: 0.6,
  });
  const plaqueGeo = new THREE.BoxGeometry(1.1, 0.5, 0.08);
  const plaque = new THREE.Mesh(plaqueGeo, mat);
  plaque.castShadow = true;
  g.add(plaque);
  g.userData.assets = [plaqueGeo, mat];
  g.userData.plaque = plaque;
  return g;
}

function makeCrown(size = 0.5, color = '#d9a441') {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.14, metalness: 1, clearcoat: 1,
  });
  const bandGeo = new THREE.CylinderGeometry(size * 0.6, size * 0.5, size * 0.28, D.round, 1, true);
  const band = new THREE.Mesh(bandGeo, mat);
  band.material.side = THREE.DoubleSide;
  g.add(band);
  const spikeGeo = new THREE.ConeGeometry(size * 0.12, size * 0.42, D.round);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const s = new THREE.Mesh(spikeGeo, mat);
    s.position.set(Math.cos(a) * size * 0.52, size * 0.34, Math.sin(a) * size * 0.52);
    g.add(s);
  }
  const gemGeo = new THREE.OctahedronGeometry(size * 0.12);
  const gemMat = new THREE.MeshPhysicalMaterial({ color: '#c9283c', roughness: 0.05, transmission: 0.6, thickness: 0.4 });
  const gem = new THREE.Mesh(gemGeo, gemMat);
  gem.position.y = size * 0.14;
  g.add(gem);
  g.userData.assets = [bandGeo, spikeGeo, gemGeo, mat, gemMat];
  return g;
}

function makeSparkler(size = 0.9) {
  const g = new THREE.Group();
  const stickGeo = new THREE.CylinderGeometry(0.014, 0.014, size, D.tube);
  const stickMat = std('#9a9aa0', 0.4, { metalness: 0.8 });
  const stick = new THREE.Mesh(stickGeo, stickMat);
  stick.position.y = size / 2;
  g.add(stick);
  // crackle star
  const starGeo = new THREE.SphereGeometry(0.05, D.sphere[0], D.sphere[1]);
  const starMat = new THREE.MeshBasicMaterial({ color: '#ffd27a' });
  for (let i = 0; i < 22; i++) {
    const s = new THREE.Mesh(starGeo, starMat);
    const t = i / 22;
    const a = i * 2.4;
    s.position.set(Math.cos(a) * t * 0.4, size + t * 0.22, Math.sin(a) * t * 0.4);
    s.scale.setScalar(1 - t * 0.6);
    g.add(s);
  }
  g.userData.assets = [stickGeo, stickMat, starGeo, starMat];
  return g;
}

function makeNumber(color = '#c9a24b') {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.15, metalness: 0.85, clearcoat: 0.7,
  });
  // stylised "1" — a slender column with a flag and base
  const colGeo = new THREE.BoxGeometry(0.22, 1.5, 0.16);
  const col = new THREE.Mesh(colGeo, mat);
  col.position.y = 0.95;
  const flagGeo = new THREE.BoxGeometry(0.6, 0.2, 0.16);
  const flag = new THREE.Mesh(flagGeo, mat);
  flag.position.set(-0.2, 1.66, 0);
  flag.rotation.z = -0.5;
  const baseGeo = new THREE.BoxGeometry(0.7, 0.14, 0.3);
  const base = new THREE.Mesh(baseGeo, mat);
  base.position.y = 0.2;
  g.add(col, flag, base);
  g.userData.assets = [colGeo, flagGeo, baseGeo, mat];
  return g;
}

function makeLaceCollar(radius = 1.6) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#fffaf0', roughness: 0.4, metalness: 0,
    transparent: true, opacity: 0.85, side: THREE.DoubleSide,
    transmission: 0.2, thickness: 0.1,
  });
  const geo = new THREE.TorusGeometry(radius, 0.05, D.tube, 64);
  const band = new THREE.Mesh(geo, mat);
  band.rotation.x = Math.PI / 2;
  band.scale.set(1, 1, 2.4);
  g.add(band);
  const scallopGeo = new THREE.SphereGeometry(0.09, D.sphere[0], D.sphere[1]);
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * TAU;
    const s = new THREE.Mesh(scallopGeo, mat);
    s.position.set(Math.cos(a) * radius, 0, Math.sin(a) * radius);
    s.scale.set(1, 0.7, 1);
    g.add(s);
  }
  g.userData.assets = [geo, mat, scallopGeo];
  return g;
}

// ─── orchestration ────────────────────────────────────────────────────────

const BUILDERS = {
  // fresh flowers
  'rose-garden': (r, y) => scatter(r, y, 9, () => {
    const g = new THREE.Group();
    const stem = makeStem(0.45);
    g.add(stem);
    // The head sits at the stem's tip, inside the top few millimetres of it. The
    // point of the stem is to hold the flower clear of the icing; a head perched
    // a whole 0.13 above the tip leaves an obvious gap of green air.
    const bloom = makeBloom(0.3, ['#f3c3ce', '#d9899f', '#a85f76']);
    bloom.position.y = 0.4;
    g.add(bloom);
    const leaf = makeLeaf(0.16);
    leaf.position.set(0.1, 0.2, 0.06);
    g.add(leaf);
    return g;
  }),
  'berry-crown': (r, y) => scatter(r, y, 11, () => makeBerry(0.17, '#7a1f3d')),
  'lavender': (r, y) => scatter(r, y, 14, () => {
    const g = new THREE.Group();
    // Buds along a curved spike, not a vertical stack. Six spheres stepping
    // straight up at 0.075 intervals read as a caterpillar standing on end; a
    // lavender spike leans, thins toward the tip, and the buds overlap the stem
    // rather than floating beside it.
    const stem = makeStem(0.3, '#8a9a72');
    stem.rotation.z = 0.18;
    stem.position.set(-0.03 * 0.42, 0, 0);
    g.add(stem);
    const budGeo = new THREE.SphereGeometry(0.048, D.sphere[0], D.sphere[1]);
    const budMat = std('#a48bc9', 0.72);
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      const bud = new THREE.Mesh(budGeo, budMat);
      // Buds run from just above the icing to the tip of the stem, thinning as
      // they rise. The stem now stands on y = 0 with its tip at 0.3, so this
      // spans 0.08 to 0.31 — the whole spike, with the lowest bud sitting on the
      // stem instead of floating a fifth of a unit above the cake.
      bud.position.set(-0.03 * (0.15 + t * 0.85), 0.08 + t * 0.23, 0.02 * Math.sin(t * 3));
      const k = 1 - t * 0.4;
      bud.scale.set(k, k * 1.5, k);
      g.add(bud);
    }
    g.userData.assets = [stem.geometry, stem.material, budGeo, budMat];
    return g;
  }),
  'peony': (r, y) => scatter(r, y, 5, () => {
    const bloom = makeBloom(0.42, ['#f6c6d3', '#dd8fa6', '#b2647f']);
    bloom.rotation.z = (rng() - 0.5) * 0.4;
    return bloom;
  }),
  'orchid': (r, y) => scatter(r, y, 5, () => {
    const g = new THREE.Group();
    const stem = makeStem(0.5, '#7d8a5a');
    g.add(stem);
    // Same petal as everything else. This used to be an ellipsoid at
    // scale (1, 0.28, 1.8) on every side of a tall stem — six flat discs
    // radiating from a post, which from above read as lily pads on stalks.
    // An orchid's lateral petals are broad and cupped; the lip hangs below.
    const head = new THREE.Group();
    head.position.y = 0.5;
    g.add(head);

    // The labellum. Broad, and pushed forward off the axis rather than sitting
    // inside it: an orchid's lip projects, and at 0.06 it was buried among the
    // laterals and read as just another petal. `fold` is high here on purpose —
    // this is the one part of an orchid that IS a creased card, folding along
    // its length into the two lobes that make the lip readable from above.
    const lip = new THREE.Mesh(
      petalGeometry(0.30, 0.30, 0.05, 0.45, 0.5, 22),
      phys('#c98fd8', 0.42, { clearcoat: 0.5, side: THREE.DoubleSide }),
    );
    lip.rotation.set(-1.35, 0, 0);
    lip.position.set(0, 0.04, 0.11);
    head.add(lip);

    // Five petals opening OUT — lean well under π/2. An orchid spreads; the
    // earlier lean of 0.85 tipped them upright into a closed bud, so the whole
    // topper read as a tulip on a stick instead of an orchid.
    //
    // fold is near zero here, which is a deliberate departure from the rose.
    // `fold` bends the petal ACROSS its width, and the result is a creased card
    // — fine for a rose, where the fold is hidden inside a dense whorl, wrong
    // for an orchid, which shows each petal in full against the icing. An orchid
    // petal curls along its LENGTH instead, which is what `cup` does, so the
    // curl is bought with cup and the cross-fold dropped.
    //
    // overlap is well past 1 for the same reason. petalLayer sizes a petal from
    // the circumference it has to cover, which for five petals gives a blade
    // half again as long as it is wide — the proportions of a lily. A
    // phalaenopsis lateral is very nearly round. Overlap is the only lever that
    // widens a petal without also lengthening it, so it carries the whole
    // difference; the 55% of each petal that now hides behind its neighbour
    // reads as the flat, broad, overlapping fan an orchid actually has.
    //
    // `tip` is the round one, which is the other half of the same problem: a
    // near-round lateral that ends in a chisel point is a leaf. The default
    // profile is left alone for the roses, because there it is the right shape
    // AND it keeps their outer whorl from splaying back out into a saucer.
    const whorl = petalLayer(0.24, 5, 0.5, '#d9a7e8', {
      cup: 0.5, fold: 0.08, len: 1.1, base: 0.55, overlap: 1.55, tip: 0.44,
    });
    whorl.position.y = 0.04;
    head.add(whorl);
    const assets = [lip.geometry, lip.material];
    whorl.traverse((o) => { if (o.isMesh) assets.push(...(o.parent?.userData?.assets || [])); });
    g.userData.assets = [...new Set(assets)];
    return g;
  }),
  'sunflower': (r, y) => scatter(r, y, 4, () => {
    const g = new THREE.Group();
    // On a stem. The head was sitting directly on the group origin, so once the
    // petals were flattened into true ray florets the whole topper measured 0.09
    // units tall against the rose's 0.49 — and at the shallow angle the camera
    // looks down a tier, a flat disc four centimetres off the icing is edge-on
    // and effectively invisible. The stem is what puts it back in the frame.
    const stem = makeStem(0.24, '#5c7a3c');
    g.add(stem);
    const head = new THREE.Group();
    head.position.y = 0.24;
    g.add(head);
    const discGeo = new THREE.CylinderGeometry(0.23, 0.2, 0.06, D.round);
    const discMat = std('#4a2f14', 0.78);
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.y = 0.07;
    head.add(disc);
    // A seed head is a ring of florets closing on the centre, not a flat lid.
    // Three rings of tiny spheres give the spiral some relief; one flat disc
    // reads as a hole cut in the middle of the petals.
    const seedGeo = new THREE.SphereGeometry(0.026, 10, 8);
    const seedMat = std('#2e1d0c', 0.85);
    for (let ring = 0; ring < 3; ring++) {
      const rr = 0.05 + ring * 0.062;
      const n = 7 + ring * 7;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + ring * 0.7;
        const s = new THREE.Mesh(seedGeo, seedMat);
        s.position.set(Math.cos(a) * rr, 0.101, Math.sin(a) * rr);
        s.scale.y = 0.5;
        head.add(s);
      }
    }
    // Ray florets, from the shared petal. They were a ring of ellipsoids at
    // scale (1, 0.22, 1.9) — smooth ovals, which is the one shape a sunflower
    // petal is not. A ray floret is a narrow strap with a notched tip, and the
    // shared geometry plus the tip notch is exactly that; it just needs to be
    // long and thin rather than broad, so the width is set well under the
    // circumference it has to cover.
    const rayGeo = petalGeometry(0.38, 0.095, 0.022, 0.12, 0.30, 20, 0.5);
    const rayMat = std('#f2b53a', 0.58, { side: THREE.DoubleSide });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + 0.1;
      const p = new THREE.Mesh(rayGeo, rayMat);
      p.position.set(Math.cos(a) * 0.18, 0.05, Math.sin(a) * 0.18);
      p.rotation.order = 'YXZ';
      p.rotation.y = -a + Math.PI / 2;
      // Splayed up around the disc rather than laid out flat. A ray floret
      // leaves the head angled upward, and the tilt is what gives the ring the
      // depth that stops it reading as a daisy printed onto the icing. The
      // spread is uneven because a real head is not a symmetrical wheel.
      p.rotation.x = -0.30 - rng() * 0.22;
      p.rotation.z = (rng() - 0.5) * 0.2;
      head.add(p);
    }
    g.userData.assets = [discGeo, discMat, seedGeo, seedMat, rayGeo, rayMat];
    return g;
  }),
  'cherry-blossom': (r, y) => scatter(r, y, 8, () => {
    const g = new THREE.Group();
    // On a short stem, not lying on the icing. A blossom is 0.2 units across
    // once the topper scale is applied — five millimetres of near-white petal
    // laid flat on near-white buttercream, which is why this topper was
    // effectively invisible before. Held above the surface it reads.
    const stem = makeStem(0.3, '#8a9a72');
    g.add(stem);
    const blossom = makeBlossom(0.3, '#fbe0e9', '#e8b93c');
    blossom.rotation.z = (rng() - 0.5) * 0.5;
    blossom.rotation.x = -0.25;
    blossom.position.y = 0.34;
    g.add(blossom);
    return g;
  }),
  'tropical': (r, y) => scatter(r, y, 5, () => {
    const g = new THREE.Group();
    const stem = makeStem(0.26, '#4e6b3a');
    g.add(stem);
    // Four broad leaves fanned around a short stem — a monstera-ish spray. They
    // were ellipsoids at scale (1, 0.14, 2.6) on a bare group, so each was a
    // smooth flat blade lying at the icing with no stalk under it. The shared
    // petal geometry gives them the lengthwise curl and rim fold that make a
    // leaf read, and `tip` is dropped toward the pointed end, which is right
    // for a leaf in a way it is not for a petal.
    const head = new THREE.Group();
    head.position.y = 0.26;
    g.add(head);
    const leafGeo = petalGeometry(0.5, 0.21, 0.03, 0.55, 0.5, 20, 0.72);
    const leafMat = std('#3f7a45', 0.62, { side: THREE.DoubleSide });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.35;
      const l = new THREE.Mesh(leafGeo, leafMat);
      l.position.set(0, 0, 0);
      l.rotation.order = 'YXZ';
      l.rotation.y = -a + Math.PI / 2;
      // Splayed up and out, each leaf at its own angle so the spray is not a
      // symmetrical four-point star.
      l.rotation.x = -0.75 - rng() * 0.3;
      l.rotation.z = (rng() - 0.5) * 0.22;
      head.add(l);
    }
    const budGeo = new THREE.SphereGeometry(0.05, 14, 10);
    const budMat = std('#d98a4a', 0.5);
    const bud = new THREE.Mesh(budGeo, budMat);
    bud.scale.set(0.7, 1.7, 0.7);
    bud.position.y = 0.16;
    head.add(bud);
    g.userData.assets = [leafGeo, leafMat, budGeo, budMat];
    return g;
  }),
  'pressed': (r, y) => scatter(r, y, 10, () => makeBloom(0.19, ['#f2e3c9', '#d9b98a', '#b98a5a'])),
  'gold-leaf': (r, y) => scatter(r, y, 12, () => {
    const geo = new THREE.PlaneGeometry(0.26, 0.34, 12, 12);
    const mat = new THREE.MeshPhysicalMaterial({
      color: '#d9a441', roughness: 0.16, metalness: 1,
      side: THREE.DoubleSide, clearcoat: 1,
    });
    const m = new THREE.Mesh(geo, mat);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setZ(i, (rng() - 0.5) * 0.07);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    m.rotation.x = -Math.PI / 2 + (rng() - 0.5) * 0.7;
    m.rotation.z = rng() * TAU;
    m.userData.assets = [geo, mat];
    return m;
  }),
  'moss': (r, y) => scatter(r, y, 16, () => {
    const geo = new THREE.SphereGeometry(0.11 + rng() * 0.09, D.sphere[0], D.sphere[1]);
    const mat = std(rng() > 0.5 ? '#5a7040' : '#6b8248', 0.95);
    const m = new THREE.Mesh(geo, mat);
    m.scale.y = 0.5;
    m.userData.assets = [geo, mat];
    return m;
  }),
  'fruit-burst': (r, y) => scatter(r, y, 13, () => {
    const kinds = [makeStrawberry, () => makeBerry(0.16, '#e8652b'), makeFig, makeCitrus, () => makeBerry(0.15, '#8fbf4a')];
    return kinds[Math.floor(rng() * kinds.length)]();
  }),

  // chocolate
  'choco-shards': (r, y) => scatter(r, y, 8, () => {
    const s = makeShard(0.5 + rng() * 0.3);
    s.rotation.y = rng() * TAU;
    s.rotation.z = (rng() - 0.5) * 0.35;
    return s;
  }),
  'choco-drip': () => null, // handled specially — see buildTopper
  'choco-curl': (r, y) => scatter(r, y, 7, makeCurl),
  'choco-truffle': (r, y) => scatter(r, y, 9, () => {
    const t = makeTruffle(0.22 + rng() * 0.1);
    t.rotation.y = rng() * TAU;
    return t;
  }),
  'choco-cage': (r, y) => {
    const g = makeCage(Math.min(r * 0.8, 1.7));
    g.position.y = y + 0.02;
    return g;
  },
  'choco-sculpt': (r, y) => {
    const g = makeSculptFigure(0.7);
    g.position.set(0, y, 0);
    g.rotation.y = 0.6;
    return g;
  },

  // fruit
  'strawberry': (r, y) => scatter(r, y, 9, () => {
    const s = makeStrawberry(0.26);
    s.rotation.y = rng() * TAU;
    return s;
  }),
  'blueberry': (r, y) => scatter(r, y, 18, () => makeBerry(0.13, '#4a5a8f', 0.3)),
  'fig': (r, y) => scatter(r, y, 6, () => {
    const f = makeFig(0.3);
    f.rotation.y = rng() * TAU;
    return f;
  }),
  'citrus': (r, y) => scatter(r, y, 9, makeCitrus),
  'pomegranate': (r, y) => scatter(r, y, 8, () => {
    const p = makePomegranate(0.22);
    p.rotation.y = rng() * TAU;
    return p;
  }),
  'gold-berry': (r, y) => scatter(r, y, 11, makeGoldBerry),

  // sugar & craft
  'pearls': (r, y) => scatter(r, y, 34, () => makePearl(0.07 + rng() * 0.03)),
  'gold-dust': (r, y) => {
    // fine golden shimmer — a ring of tiny metallic flakes
    const g = new THREE.Group();
    const geo = new THREE.PlaneGeometry(0.09, 0.09);
    const mat = new THREE.MeshPhysicalMaterial({
      color: '#e8c56a', roughness: 0.1, metalness: 1, side: THREE.DoubleSide,
    });
    for (let i = 0; i < 60; i++) {
      const m = new THREE.Mesh(geo, mat);
      const a = rng() * TAU;
      const rr = r * (0.2 + rng() * 0.75);
      m.position.set(Math.cos(a) * rr, y + 0.01 + rng() * 0.03, Math.sin(a) * rr);
      m.rotation.set(-Math.PI / 2 + (rng() - 0.5) * 0.8, 0, rng() * TAU);
      g.add(m);
    }
    g.userData.assets = [geo, mat];
    return g;
  },
  'ribbon': (r, y) => null, // handled specially
  'macarons': (r, y) => scatter(r, y, 8, () => makeMacaron(0.2, ['#f6d9dc', '#bcd6ea', '#b8c4a8', '#f6e5a8'][Math.floor(rng() * 4)])),
  'meringue': (r, y) => scatter(r, y, 10, makeMeringue),
  'candles': (r, y) => null, // handled specially
  'monogram': (r, y) => {
    const g = makeMonogram();
    g.position.set(0, y + 0.3, r * 0.55);
    g.rotation.y = -0.5;
    return g;
  },
  'number': (r, y) => {
    const g = makeNumber();
    g.position.set(0, y, r * 0.35);
    return g;
  },
  'isomalt': (r, y) => scatter(r, y, 8, () => makeIsomaltGem(0.2, ['#e5a9b6', '#bcd6ea', '#b8c4a8', '#f6e5a8'][Math.floor(rng() * 4)])),
  'sugar-flower': (r, y) => scatter(r, y, 4, () => {
    const bloom = makeBloom(0.46, ['#fffaf0', '#f6e0d0', '#e8c0a8']);
    bloom.rotation.z = (rng() - 0.5) * 0.5;
    return bloom;
  }),
  'lace': (r, y) => {
    const g = makeLaceCollar(r * 0.98);
    g.position.y = y + 0.12;
    return g;
  },
  'royal-crown': (r, y) => {
    const g = makeCrown(0.55);
    g.position.set(0, y, r * 0.3);
    g.rotation.y = 0.4;
    return g;
  },
};

/** Scatter `count` procedural items across the top surface of a tier. */
function scatter(radius, y, count, factory) {
  const group = new THREE.Group();
  // Space the items out instead of trusting the RNG. `radius * (0.22 + rng*0.7)`
  // put a seventh of them inside a fifth of the tier, where they interpenetrated
  // and read as one lump; a golden-angle walk with a floor of 0.45R spreads the
  // same count over the lid without ever pushing one over the edge.
  const n = Math.max(1, count);
  const a0 = rng() * TAU;
  const lo = 0.45 * radius;
  const hi = 0.95 * radius;
  for (let i = 0; i < n; i++) {
    const item = factory();
    if (!item) continue;
    const a = a0 + i * 2.39996 + (rng() - 0.5) * 0.5;
    // Golden-ratio radial sequence: low-discrepancy, so successive items never
    // land on top of each other the way an unconstrained random walk does.
    const f = ((i * 0.6180339887) % 1);
    const rr = n === 1 ? (lo + hi) / 2 : lo + (hi - lo) * f;
    item.position.x = Math.cos(a) * rr;
    item.position.z = Math.sin(a) * rr;
    item.position.y = y;
    item.rotation.y = rng() * TAU;
    group.add(item);
  }
  return group;
}

/**
 * How large toppers are built relative to the cake. The factories were written
 * at a scale that made a rose head roughly a third of the tier it sat on —
 * flowers that could only be read as a centrepiece sculpture. Real sugar work
 * is scaled to the cake: a piped rose is about an inch across on a six-inch
 * tier. Scaling here rather than at each call site keeps the factories honest
 * about their own proportions, and makes the overall size one number to tune.
 */
const TOPPER_SCALE = 0.6;

/**
 * Build a topper on top of the topmost tier.
 * `ctx` carries { topY, topRadius, shapeId, dripColor, ribbonColor, candles }.
 */
export function buildTopper(id, ctx) {
  const builder = BUILDERS[id];
  if (!builder) return null;
  const built = builder(ctx.topRadius, ctx.topY);
  if (!built) return null;

  // Scale about the TIER TOP, not the group origin. A scatter-based topper
  // places each item at its absolute spot on the tier, so its children carry
  // y ≈ topY; scaling the group directly would scale those heights too and drop
  // the whole cluster into the cake. Re-parenting through a pivot that sits on
  // the tier top keeps everything where it was placed, just smaller.
  const group = new THREE.Group();
  group.position.y = ctx.topY;
  built.position.y = -ctx.topY;
  group.add(built);
  group.scale.setScalar(TOPPER_SCALE);

  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return group;
}

/** Which toppers need bespoke geometry beyond the generic scatter. */
export const SPECIAL_TOPPERS = new Set(['choco-drip', 'ribbon', 'candles']);
