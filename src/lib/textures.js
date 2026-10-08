import * as THREE from 'three';
import { makeRng } from './utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Procedural textures — no image assets anywhere in the repo.
// Every canvas is painted from code, so the palette is fully live.
// ─────────────────────────────────────────────────────────────────────────────

const S = 512;

/**
 * The RNG a painter draws from. tilePaint sticks a seeded stream onto the
 * context so the nine replayed passes all generate the SAME pattern — with
 * Math.random each pass would differ and the overlap would turn to mush.
 * A painter called directly (a preview canvas, a test) falls back to Math.random.
 */
function rndOf(ctx) {
  if (!ctx.__rnd) ctx.__rnd = Math.random;
  return ctx.__rnd;
}

/**
 * Paint a canvas so it tiles seamlessly.
 *
 * Every drawing operation is replayed over a 3×3 grid at ±`size` offsets.
 * Anything a painter draws that runs off one edge therefore reappears on the
 * opposite one, exactly in phase — which is what a structured pattern like the
 * piping grid needs. (A pixel-copy of the edges cannot do this: it duplicates
 * whole blobs into the wrong places. It also cannot be alpha-blended, because
 * `putImageData` ignores `globalAlpha`.)
 */
export function tilePaint(draw, size, seed) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  for (let gy = -1; gy <= 1; gy++) {
    for (let gx = -1; gx <= 1; gx++) {
      // A fresh stream at the same seed for each of the nine passes, or the
      // copies would differ from one another and the overlap would be mush.
      ctx.__rnd = makeRng(seed);
      ctx.save();
      ctx.translate(gx * size, gy * size);
      draw(ctx, size, ctx.__rnd);
      ctx.restore();
    }
  }
  delete ctx.__rnd;
  return c;
}

export function canvasTexture(draw, size = S, repeat = [1, 1], seed = 1) {
  const tex = new THREE.CanvasTexture(tilePaint(draw, size, seed));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 8;
  return tex;
}

/**
 * Albedo + normal from a SINGLE painting. Running the painter twice (once in
 * colour, once in grey) gives each pass its own seeded stream, so the relief
 * never lines up with the swirl it is supposed to be sculpting — the highlight
 * lands in the gaps instead of on the piping. Deriving the normal from the
 * albedo's own luminance keeps them locked together, and halves the painting
 * cost.
 *
 * The relief gain is measured from the painting rather than fixed: an albedo
 * baked for colour has a different contrast range than a greyscale one, so a
 * constant k under-bumps a low-contrast finish (piped rosettes) and over-bumps
 * a busy one (marble) — visible as either flat icing or a rippled surface.
 */
export function frostingTextures(draw, normalDraw, albedoSize = S, detailSize = S, strength = 2.6, seed = 1) {
  const albedo = tilePaint(draw, albedoSize, seed);
  const map = new THREE.CanvasTexture(albedo);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  // A dedicated greyscale painter (chocolate crumb, semi-naked sponge) carries
  // different relief than the colour does, so it still paints its own canvas.
  const source = normalDraw ? tilePaint(normalDraw, detailSize, seed + 7919) : albedo;
  const s = source.width;
  const src = source.getContext('2d').getImageData(0, 0, s, s).data;

  const out = document.createElement('canvas');
  out.width = out.height = s;
  const octx = out.getContext('2d');
  const img = octx.createImageData(s, s);

  const luma = (i) => (src[i] * 0.2126 + src[i + 1] * 0.7152 + src[i + 2] * 0.0722) / 255;
  const at = (x, y) => {
    const xi = (x + s) % s, yi = (y + s) % s;
    return luma((yi * s + xi) * 4);
  };

  // Mean central-difference gradient over the whole painting, at unit step.
  // A flat finish barely moves between neighbours; a crumb or a piping grid
  // moves a lot. Scaling k by the inverse keeps the perceived relief uniform
  // across styles without a per-style magic number.
  let gsum = 0;
  const stride = 4; // sample every 4th pixel; the field is statistical
  for (let y = 0; y < s; y += stride) {
    for (let x = 0; x < s; x += stride) {
      gsum += Math.abs(at(x + 1, y) - at(x - 1, y)) + Math.abs(at(x, y + 1) - at(x, y - 1));
    }
  }
  const meanGrad = gsum / (Math.ceil(s / stride) ** 2) / 2;
  // 0.035 is the gradient a typical crumb texture measures; clamp so a nearly
  // flat painting cannot send k to infinity.
  const k = strength * s / 512 * (0.035 / Math.max(0.004, meanGrad));

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * k;
      const dy = (at(x, y + 1) - at(x, y - 1)) * k;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * s + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len) * 0.5 * 255 + 127.5;
      img.data[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);

  const normal = new THREE.CanvasTexture(out);
  normal.colorSpace = THREE.NoColorSpace;
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.anisotropy = 8;
  return { map, normal };
}

/** Speckle + soft mottling used by buttercream / stucco / crumb. */
export function speckle(ctx, size, { base, dots = 2600, dotAlpha = 0.09, dark = true, light = true, mottle = 0.05 }) {
  const rnd = rndOf(ctx);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  if (mottle > 0) {
    for (let i = 0; i < 26; i++) {
      const g = ctx.createRadialGradient(
        rnd() * size, rnd() * size, 0,
        rnd() * size, rnd() * size, 40 + rnd() * 90,
      );
      const col = rnd() > 0.5 ? '255,255,255' : '0,0,0';
      g.addColorStop(0, `rgba(${col},${mottle})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
  }
  for (let i = 0; i < dots; i++) {
    const r = 0.6 + rnd() * 2.4;
    const a = dotAlpha * (0.4 + rnd() * 0.6);
    ctx.fillStyle = rnd() > 0.5
      ? (light ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`)
      : (dark ? `rgba(0,0,0,${a * 0.8})` : `rgba(255,255,255,${a})`);
    ctx.beginPath();
    ctx.arc(rnd() * size, rnd() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Piped-buttercream rosettes.
 *
 * Sized against the world, not against the canvas. One scene unit is one inch,
 * and a frosting tile is FROST_TILE = 4 units, so a 1024px tile is 256px per
 * inch. A real piped rosette — a 1M star tip, the swirl on every celebration
 * cake — is about 3/4 inch across and is laid down as roughly ONE AND A HALF
 * turns of a rope a third of that width. Three turns of a thin rope is not a
 * rosette; it is a spiral of thread, and at 256px/inch its creases come out
 * around a third of a millimetre wide — below one screen pixel at any normal
 * viewing distance, so the mip chain averages them away and the finish degrades
 * into the flat disc with faint concentric rings this used to render as.
 *
 * The whole pattern is therefore described by shadow, at a scale that survives:
 * the crease where one turn of the coil meets the next, the cast shadow under
 * the rope, and the shaded valley the rosette sits in. Light is only a thin
 * sheen on the crown, and it is painted last so the shadows stay legible.
 */
export function pipedTexture(ctx, size, base) {
  const rnd = rndOf(ctx);
  // Coarse mottling only. Thousands of dots at this scale are sub-pixel once
  // the tier is on screen, and they only serve to thicken the mip chain.
  speckle(ctx, size, { base, dots: 700, dotAlpha: 0.05, mottle: 0.05, rnd });

  // Five rosettes per tile. With FROST_TILE = 3 that is a 0.6-unit rosette —
  // about 15mm, a small 1M swirl — which puts roughly seven across a 6-inch
  // tier, the way a real piped cake actually reads. Texel density is set by
  // the tile size, not by this count, so the scale can be tuned without
  // giving up any sharpness.
  const cells = 5;
  const cell = size / cells;
  const rows = Math.ceil(size / cell) + 1;
  const cols = Math.ceil(size / cell) + 1;
  const TAU2 = Math.PI * 2;

  // One warm shadow colour at three densities. Neutral black greys the
  // buttercream; a warm brown reads as light falling into a crease in cream.
  const SHADOW = (a) => `rgba(96,66,38,${a})`;

  /** Stroke a polyline as one continuous rope — round caps, no bead scallops. */
  const rope = (pts, w, style) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = style;
    ctx.stroke();
  };

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = col * cell + (row % 2 ? cell / 2 : 0) + (rnd() - 0.5) * cell * 0.07;
      const cy = row * cell + (rnd() - 0.5) * cell * 0.07;
      const R = cell * 0.44;              // rosette radius
      const wRope = R * 0.62;             // rope ≈ 1/3 of the rosette width
      // Adjacent turns touch, so the coil closes with no gap of bare icing.
      // turns = (R * 0.92) / wRope ≈ 1.5, the 1M swirl.
      const turns = (R * 0.92) / wRope;
      const pitch = (R * 0.92) / turns;
      const spin = rnd() < 0.5 ? 1 : -1;
      const a0 = rnd() * TAU2;

      // Archimedean: radius grows by a full `pitch` every turn, from rr0.
      const spiral = (rr0) => {
        const pts = [];
        const n = 96;
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          const a = a0 + spin * t * TAU2 * turns;
          const rr = rr0 + pitch * turns * t;
          pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
        }
        return pts;
      };

      // The valley the rosette sits in, darkest at its rim, so neighbouring
      // swirls are separated by a shadowed seam instead of floating on flat
      // icing. This replaces a piped border of its own.
      const valley = ctx.createRadialGradient(cx, cy, R * 0.3, cx, cy, R * 1.12);
      valley.addColorStop(0, SHADOW(0.02));
      valley.addColorStop(1, SHADOW(0.22));
      ctx.fillStyle = valley;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.12, 0, TAU2);
      ctx.fill();

      const rr0 = wRope * 0.6;
      const pts = spiral(rr0);

      // Cast shadow, offset down-right: the coil stands proud of the valley.
      ctx.save();
      ctx.translate(cell * 0.02, cell * 0.024);
      rope(pts, wRope * 1.06, SHADOW(0.2));
      ctx.restore();

      // The coil reads as light only because the base beneath it is shaded.
      rope(pts, wRope, 'rgba(255,255,255,0.34)');

      // The crease, drawn onto the coil's outer edge at a quarter of the rope
      // width — roughly 5mm here, which stays a solid line well down the mip
      // chain. This is the single stroke that says "piped".
      rope(spiral(rr0 + pitch * 0.5), wRope * 0.34, SHADOW(0.26));

      // A wet highlight riding the crown, offset up-left between the shadows.
      ctx.save();
      ctx.translate(-cell * 0.018, -cell * 0.022);
      rope(pts, wRope * 0.34, 'rgba(255,255,255,0.42)');
      ctx.restore();
    }
  }
}

/** Fondant — faintly waxy, soft sheen bands. */
export function fondantTexture(ctx, size, base) {
  const rnd = rndOf(ctx);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    const y = rnd() * size;
    ctx.moveTo(0, y);
    for (let x = 0; x <= size; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 6 + (rnd() - 0.5) * 2);
    ctx.strokeStyle = `rgba(255,255,255,${0.02 + rnd() * 0.03})`;
    ctx.lineWidth = 2 + rnd() * 8;
    ctx.stroke();
  }
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '0,0,0'},${0.02 + rnd() * 0.03})`;
    ctx.beginPath();
    ctx.arc(rnd() * size, rnd() * size, 0.5 + rnd() * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Marble — lazy wander veins. */
export function marbleTexture(ctx, size, base) {
  const rnd = rndOf(ctx);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let v = 0; v < 26; v++) {
    let x = rnd() * size;
    let y = rnd() * size;
    let angle = rnd() * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const steps = 60 + rnd() * 90;
    for (let s = 0; s < steps; s++) {
      angle += (rnd() - 0.5) * 0.55;
      x += Math.cos(angle) * 7;
      y += Math.sin(angle) * 7;
      ctx.lineTo(x, y);
    }
    const vein = rnd() > 0.35;
    ctx.strokeStyle = vein
      ? `rgba(120,86,52,${0.06 + rnd() * 0.13})`
      : `rgba(60,38,20,${0.05 + rnd() * 0.1})`;
    ctx.lineWidth = 0.8 + rnd() * 3.2;
    ctx.stroke();
  }
  for (let i = 0; i < 700; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.02 + rnd() * 0.04})`;
    ctx.beginPath();
    ctx.arc(rnd() * size, rnd() * size, 0.4 + rnd() * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Crumbly marzipan / textured velvet — heavy grain. */
export function crumbTexture(ctx, size, base) {
  const rnd = rndOf(ctx);
  speckle(ctx, size, { base, dots: 5200, dotAlpha: 0.12, mottle: 0.07 });
  for (let i = 0; i < 240; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.05 + rnd() * 0.07})`;
    ctx.beginPath();
    ctx.arc(rnd() * size, rnd() * size, 1.5 + rnd() * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.05 + rnd() * 0.08})`;
    ctx.beginPath();
    ctx.arc(rnd() * size, rnd() * size, 0.8 + rnd() * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Gelato stripes — soft vertical bands. */
export function stripedTexture(ctx, size, base) {
  const rnd = rndOf(ctx);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const bands = 26;
  for (let i = 0; i < bands; i++) {
    const w = size / bands;
    const g = ctx.createLinearGradient(i * w, 0, (i + 1) * w, 0);
    const tone = i % 2 === 0;
    g.addColorStop(0, tone ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.07)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.01)');
    g.addColorStop(1, tone ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.07)');
    ctx.fillStyle = g;
    ctx.fillRect(i * w, 0, w, size);
  }
}

/** Cracked crystal lace — fine polygonal network. */
export function crystalTexture(ctx, size, base) {
  const rnd = rndOf(ctx);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const pts = [];
  for (let i = 0; i < 90; i++) pts.push([rnd() * size, rnd() * size]);
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    const near = pts
      .map((p, j) => ({ p, j, d: Math.hypot(p[0] - x, p[1] - y) }))
      .filter((o) => o.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    near.forEach(({ p }) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(p[0], p[1]);
      ctx.strokeStyle = `rgba(255,255,255,${0.22 + rnd() * 0.3})`;
      ctx.lineWidth = 0.7 + rnd() * 1.1;
      ctx.stroke();
    });
  }
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Semi-naked — thin frosting band so sponge shows through. */
export function semiNakedTexture(ctx, size, base, spongeColor) {
  const rnd = rndOf(ctx);
  ctx.fillStyle = spongeColor || '#e8c9a0';
  ctx.fillRect(0, 0, size, size);
  const bandH = size * 0.34;
  const y0 = size * 0.33;
  const g = ctx.createLinearGradient(0, y0, 0, y0 + bandH);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.82, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, size, bandH);
  // irregular wavy edges
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    const y = rnd() > 0.5 ? y0 : y0 + bandH;
    ctx.moveTo(0, y);
    for (let x = 0; x <= size; x += 12) ctx.lineTo(x, y + Math.sin(x * 0.03 + i) * 4 + (rnd() - 0.5) * 3);
    ctx.strokeStyle = `rgba(255,255,255,0.5)`;
    ctx.lineWidth = 6 + rnd() * 10;
    ctx.stroke();
  }
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '0,0,0'},${0.03 + rnd() * 0.04})`;
    ctx.beginPath();
    ctx.arc(rnd() * size, rnd() * size, 0.6 + rnd() * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Crème anglaise / gelato stripes for the pearl look. */
export function pearlTexture(ctx, size, base) {
  const rnd = rndOf(ctx);
  speckle(ctx, size, { base, dots: 2000, dotAlpha: 0.05, mottle: 0.03 });
  for (let i = 0; i < 320; i++) {
    const x = rnd() * size, y = rnd() * size, r = 1 + rnd() * 3;
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.25)');
    g.addColorStop(1, 'rgba(0,0,0,0.05)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Stucco — trowel arcs. */
export function stuccoTexture(ctx, size, base) {
  const rnd = rndOf(ctx);
  speckle(ctx, size, { base, dots: 1200, dotAlpha: 0.05, mottle: 0.06 });
  for (let i = 0; i < 120; i++) {
    const x = rnd() * size, y = rnd() * size;
    const r = 20 + rnd() * 70;
    const a0 = rnd() * Math.PI * 2;
    const a1 = a0 + 0.5 + rnd() * 1.6;
    ctx.beginPath();
    ctx.arc(x, y, r, a0, a1);
    ctx.strokeStyle = rnd() > 0.5 ? `rgba(255,255,255,${0.06 + rnd() * 0.1})` : `rgba(0,0,0,${0.05 + rnd() * 0.09})`;
    ctx.lineWidth = 3 + rnd() * 9;
    ctx.stroke();
  }
}

/** Velvet matte — fine nap. */
export function velvetTexture(ctx, size, base) {
  const rnd = rndOf(ctx);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '0,0,0'},${0.015 + rnd() * 0.03})`;
    ctx.fillRect(rnd() * size, rnd() * size, 1, 1 + rnd() * 2);
  }
}
