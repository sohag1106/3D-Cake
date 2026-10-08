import * as THREE from 'three';
import { makeRng, lerp } from '../lib/utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Shape construction. Every cake body is a THREE.Shape extruded upward and then
// carved, so silhouettes can be sculpted with a falloff curve rather than being
// plain cylinders. UVs are rebuilt deliberately so frosting textures tile
// predictably around the side wall and across the top.
// ─────────────────────────────────────────────────────────────────────────────

const TAU = Math.PI * 2;

/** Outline point list for each shape id. `r` is the base radius. */
export function outlineFor(id, r, depth) {
  const pts = [];
  const push = (x, y) => pts.push(new THREE.Vector2(x, y));

  switch (id) {
    case 'square': {
      const s = r * 0.9;
      const corner = r * 0.16;
      for (let i = 0; i < 4; i++) {
        const a0 = (i / 4) * TAU + Math.PI / 4;
        const a1 = ((i + 1) / 4) * TAU + Math.PI / 4;
        const c = [Math.cos(a0) * s * Math.SQRT2, Math.sin(a0) * s * Math.SQRT2];
        const n = [Math.cos(a1) * s * Math.SQRT2, Math.sin(a1) * s * Math.SQRT2];
        push(...c);
        for (let t = 1; t <= 12; t++) {
          const k = t / 12;
          push(lerp(c[0], n[0], k), lerp(c[1], n[1], k));
        }
      }
      // round the corners
      return roundPts(pts, corner);
    }
    case 'heart': {
      const N = 320;
      for (let i = 0; i < N; i++) {
        const t = (i / N) * TAU;
        const x = 16 * Math.sin(t) ** 3;
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        push((x / 17) * r, (y / 17) * r);
      }
      return pts;
    }
    case 'hexagon': {
      const N = 6;
      const rotation = Math.PI / 6;
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * TAU + rotation;
        const a1 = ((i + 1) / N) * TAU + rotation;
        const c = [Math.cos(a0) * r, Math.sin(a0) * r];
        const n = [Math.cos(a1) * r, Math.sin(a1) * r];
        push(...c);
        for (let t = 1; t <= 16; t++) {
          const k = t / 16;
          push(lerp(c[0], n[0], k), lerp(c[1], n[1], k));
        }
      }
      return roundPts(pts, r * 0.10);
    }
    case 'drum':
      return roundPts(circle(r * 0.96, 192), r * 0.0);
    case 'petal': {
      const N = 300;
      const lobes = 6;
      for (let i = 0; i < N; i++) {
        const t = (i / N) * TAU;
        const rr = r * (0.86 + 0.14 * Math.abs(Math.cos((lobes / 2) * t)));
        push(Math.cos(t) * rr, Math.sin(t) * rr);
      }
      return pts;
    }
    case 'sculpt': {
      const d = depth || r * 0.68;
      const N = 280;
      for (let i = 0; i < N; i++) {
        const t = (i / N) * TAU;
        push(Math.cos(t) * r, Math.sin(t) * d);
      }
      return pts;
    }
    case 'round':
    default:
      return circle(r, 256);
  }
}

function circle(r, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU;
    pts.push(new THREE.Vector2(Math.cos(t) * r, Math.sin(t) * r));
  }
  return pts;
}

/** Corner-rounding pass — softens any polyline silhouette. */
function roundPts(pts, radius) {
  if (!radius) return pts;
  const n = pts.length;
  const out = [];
  const window = Math.max(1, Math.round((radius / 0.4)));
  for (let i = 0; i < n; i++) {
    let sx = 0, sy = 0;
    for (let k = -window; k <= window; k++) {
      const p = pts[(i + k + n) % n];
      sx += p.x; sy += p.y;
    }
    const c = 2 * window + 1;
    out.push(new THREE.Vector2(sx / c, sy / c));
  }
  return out;
}

/**
 * Build one cake tier.
 * `carve` (0–1) eases the radius inward toward the top so the tier reads as a
 * shaped, hand-sculpted cake rather than an extruded prism.
 */
export function buildTier({ shapeId, radius, height, depth, carve = 0, segments = 96, bevel = 0.1 }) {
  const pts = outlineFor(shapeId, radius, depth);
  const shape = new THREE.Shape(pts);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel * height,
    bevelSize: bevel * radius * 0.35,
    bevelSegments: 6,
    curveSegments: 32,
    steps: 1,
  });
  geo.rotateX(-Math.PI / 2);
  if (carve > 0) sculptSides(geo, height, carve);
  rebuildUVs(geo, height);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  return geo;
}

/** Taper the side wall: radius multiplier falls off smoothly with height. */
function sculptSides(geo, height, carve) {
  const pos = geo.attributes.position;
  const y0 = -height / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const t = THREE.MathUtils.clamp((y - y0) / height, 0, 1);
    const k = 1 - carve * (t * t * (3 - 2 * t)); // smoothstep taper
    pos.setX(i, x * k);
    pos.setZ(i, z * k);
  }
  pos.needsUpdate = true;
}

/**
 * World-space size of one frosting texture tile, in scene units. UVs are
 * emitted in tile units rather than 0–1, so a cell stays square on the side
 * wall AND across the lid. The old mapping stretched 3 tiles around the
 * circumference but only one over the whole tier height, which squashed every
 * piping swirl to roughly a third of its width.
 *
 * Sized against reality: 1 unit ≈ 1 inch, and pipedTexture lays four rosettes
 * per tile, so 3 units puts a rosette at 3/4 inch — a real 1M swirl. It also
 * sets the texel density, which is what actually decides whether the piping
 * survives at a grazing angle: a 2048px albedo over a 3-unit tile is 682px per
 * inch, where the earlier 4-unit tile gave 256. A smaller tile would keep
 * buying density, but at some point the tile is narrower than the tier and the
 * repeat becomes visible as a grid.
 */
export const FROST_TILE = 3;

/** Cylindrical UVs in tile units: u wraps the wall, v runs bottom→top. */
function rebuildUVs(geo, height) {
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  const bb = new THREE.Box3().setFromBufferAttribute(pos);
  const size = new THREE.Vector3();
  bb.getSize(size);
  const cx = (bb.max.x + bb.min.x) / 2;
  const cz = (bb.max.z + bb.min.z) / 2;
  // Perimeter estimated from the bounding box — it only sets the texture
  // scale, so an approximation is fine. It MUST resolve to a whole number of
  // tiles: a fractional count leaves a hard seam where u wraps back to 0.
  const perimeter = Math.PI * (size.x + size.z) * 0.5;
  const around = Math.max(1, Math.round(perimeter / FROST_TILE));

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) - cx;
    const y = pos.getY(i);
    const z = pos.getZ(i) - cz;
    const n = geo.attributes.normal;
    const ny = n ? Math.abs(n.getY(i)) : 0;
    if (ny > 0.72) {
      // top / bottom cap — planar map at the same world scale as the wall
      uv[i * 2] = x / FROST_TILE;
      uv[i * 2 + 1] = z / FROST_TILE;
    } else {
      uv[i * 2] = (Math.atan2(z, x) / TAU + 0.5) * around;
      uv[i * 2 + 1] = (y - bb.min.y) / FROST_TILE;
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// ─────────────────────────────────────────────────────────────────────────────
// Piped borders, drips, ribbons, candles
// ─────────────────────────────────────────────────────────────────────────────

/** A ring of piped rosettes sitting on a ledge. */
export function pipedBorder({ radius, y, count = 34, size = 0.1, color, rough = 0.5 }) {
  const group = new THREE.Group();
  const geo = rosetteGeometry(size);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.02 });
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU;
    const m = new THREE.Mesh(geo, mat);
    m.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius);
    m.rotation.y = -a;
    group.add(m);
  }
  group.userData.dispose = () => { geo.dispose(); mat.dispose(); };
  return group;
}

/** Swirled rosette — a lathe of a wobbling profile. */
export function rosetteGeometry(size = 0.1) {
  const pts = [];
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = Math.sin(t * Math.PI * 0.5) * size * (1 - t * 0.35);
    pts.push(new THREE.Vector2(Math.max(0.001, r), t * size * 0.95));
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const r = Math.sin(t * Math.PI * 0.5) * size * (1 - t * 0.35) * 0.42;
    pts.push(new THREE.Vector2(Math.max(0.001, r), t * size * 0.95 + size * 0.06));
  }
  return new THREE.LatheGeometry(pts, 64);
}

/** Ganache drip: teardrop capsules hanging over the top edge. */
export function makeDrips({ radius, y, shapeId, count = 42, color, rough = 0.25, metal = 0.15 }) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color, roughness: rough, metalness: metal,
    emissive: new THREE.Color(color).multiplyScalar(0.06),
  });
  const rng = makeRng(7331);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + rng() * 0.05;
    const len = 0.22 + rng() * 0.55;
    const w = 0.055 + rng() * 0.05;
    const geo = new THREE.CapsuleGeometry(w, len, 12, 24);
    const m = new THREE.Mesh(geo, mat);
    const rr = radiusAtAngle(shapeId, radius, a);
    const sy = y - len * 0.5 - 0.02;
    m.position.set(Math.cos(a) * (rr + w * 0.28), sy, Math.sin(a) * (rr + w * 0.28));
    m.rotation.z = Math.cos(a) * 0.06;
    m.rotation.x = -Math.sin(a) * 0.06;
    m.scale.set(0.85, 1, 0.6);
    group.add(m);
  }
  group.userData.dispose = () => { mat.dispose(); };
  return group;
}

/** Radius of a shape at a given angle — lets trim sit flush on non-round tiers. */
export function radiusAtAngle(shapeId, r, angle) {
  switch (shapeId) {
    case 'square': return r * 0.9 / Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle)));
    case 'hexagon': {
      const rot = angle - Math.PI / 6;
      const seg = TAU / 6;
      const local = ((rot % seg) + seg) % seg - seg / 2;
      return (r * Math.cos(seg / 2)) / Math.max(0.0001, Math.cos(local));
    }
    case 'heart': {
      const t = angle + Math.PI / 2;
      const x = 16 * Math.sin(t) ** 3;
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      return Math.hypot(x, y) / 17 * r;
    }
    case 'petal': return r * (0.86 + 0.14 * Math.abs(Math.cos(3 * angle)));
    case 'sculpt': {
      const c = Math.cos(angle), s = Math.sin(angle);
      return 1 / Math.hypot(c / r, s / (r * 0.68));
    }
    default: return r;
  }
}

/** Satin ribbon band around a tier, with a tidy bow. */
export function makeRibbon({ radius, y, height = 0.2, color, shapeId, bow = true }) {
  const group = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.55, metalness: 0.05,
    sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color(0xffffff),
    side: THREE.DoubleSide,
  });
  const N = 128;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * TAU;
    const rr = radiusAtAngle(shapeId, radius, a) + 0.035;
    pts.push(new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true);
  const geo = new THREE.TubeGeometry(curve, 420, height * 0.34, 20, true);
  const band = new THREE.Mesh(geo, mat);
  band.scale.y = 1.1;
  // flatten the tube into a band
  const pos = geo.attributes.position;
  const centerY = y;
  for (let i = 0; i < pos.count; i++) {
    const dy = pos.getY(i) - centerY;
    pos.setY(i, centerY + dy * 2.4);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  group.add(band);

  if (bow) {
    const a = Math.PI * 0.5;
    const rr = radiusAtAngle(shapeId, radius, a) + 0.05;
    const bx = Math.cos(a) * rr, bz = Math.sin(a) * rr;
    const loopGeo = new THREE.TorusGeometry(height * 0.42, height * 0.13, 20, 48);
    for (const s of [-1, 1]) {
      const loop = new THREE.Mesh(loopGeo, mat);
      loop.position.set(bx + s * 0.12, y, bz + 0.10);
      loop.rotation.set(Math.PI / 2.6, s * 0.5, s * 0.7);
      group.add(loop);
    }
    const knotGeo = new THREE.SphereGeometry(height * 0.16, 40, 28);
    const knot = new THREE.Mesh(knotGeo, mat);
    knot.position.set(bx, y, bz + 0.14);
    group.add(knot);
    const tailGeo = new THREE.BoxGeometry(height * 0.14, height * 1.5, 0.02, 4, 4);
    for (const s of [-1, 1]) {
      const tail = new THREE.Mesh(tailGeo, mat);
      tail.position.set(bx + s * 0.12, y - height * 0.75, bz + 0.16);
      tail.rotation.z = s * 0.22;
      group.add(tail);
    }
    group.userData.extraGeo = [loopGeo, knotGeo, tailGeo];
  }
  group.userData.dispose = () => {
    geo.dispose(); mat.dispose();
    (group.userData.extraGeo || []).forEach((g) => g.dispose());
  };
  return group;
}

/** Slender taper candles. */
export function makeCandles({ positions, color = '#fff6ea', flameColor = '#ffb347' }) {
  const group = new THREE.Group();
  const waxMat = new THREE.MeshStandardMaterial({
    color, roughness: 0.42, metalness: 0,
    emissive: new THREE.Color(color).multiplyScalar(0.08),
  });
  const wickMat = new THREE.MeshStandardMaterial({ color: '#2b2118', roughness: 0.9 });
  const flameMat = new THREE.MeshBasicMaterial({ color: flameColor, transparent: true, opacity: 0.95 });

  const bodyGeo = new THREE.CylinderGeometry(0.032, 0.036, 0.62, 32, 1);
  const wickGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.07, 16);
  const flameGeo = new THREE.SphereGeometry(0.045, 40, 28);

  positions.forEach((p, i) => {
    const body = new THREE.Mesh(bodyGeo, waxMat);
    body.position.set(p.x, p.y + 0.31, p.z);
    group.add(body);

    const wick = new THREE.Mesh(wickGeo, wickMat);
    wick.position.set(p.x, p.y + 0.65, p.z);
    group.add(wick);

    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(p.x, p.y + 0.715, p.z);
    flame.scale.set(0.7, 1.7, 0.7);
    flame.userData.flicker = Math.random() * TAU;
    group.add(flame);

    const light = new THREE.PointLight(flameColor, 0.55, 4.5, 2);
    light.position.set(p.x, p.y + 0.75, p.z);
    light.userData.flicker = Math.random() * TAU;
    group.add(light);
    group.userData.lights = group.userData.lights || [];
    group.userData.lights.push(light);
  });

  group.userData.dispose = () => {
    bodyGeo.dispose(); wickGeo.dispose(); flameGeo.dispose();
    waxMat.dispose(); wickMat.dispose(); flameMat.dispose();
  };
  return group;
}
