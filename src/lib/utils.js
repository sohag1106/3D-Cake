// Small shared helpers.

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/** Seeded PRNG — keeps the cake's procedural detail identical across re-renders. */
export function makeRng(seed = 1) {
  let s = seed >>> 0 || 1;
  return function rng() {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}

export const hexToInt = (hex) => parseInt(hex.replace('#', ''), 16);

export function shade(hex, amount) {
  const n = hexToInt(hex);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amount >= 0) {
    r = Math.round(r + (255 - r) * amount);
    g = Math.round(g + (255 - g) * amount);
    b = Math.round(b + (255 - b) * amount);
  } else {
    const k = 1 + amount;
    r = Math.round(r * k); g = Math.round(g * k); b = Math.round(b * k);
  }
  return `#${((1 << 24) | (clamp(r, 0, 255) << 16) | (clamp(g, 0, 255) << 8) | clamp(b, 0, 255)).toString(16).slice(1)}`;
}

/** Perceived luminance — used to pick readable text over a swatch. */
export function luminance(hex) {
  const n = hexToInt(hex);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export const isDark = (hex) => luminance(hex) < 0.42;

export const money = (n, currency = '₹') =>
  `${currency}${Math.round(n).toLocaleString('en-IN')}`;

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/** Days from now until an ISO yyyy-mm-dd date, floored. */
export function daysUntil(iso) {
  if (!iso) return Infinity;
  const target = new Date(`${iso}T12:00:00`);
  const now = new Date();
  const a = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / 86400000);
}

/** Clamp a value in place — used by the store's numeric setters. */
export const clampInt = (v, lo, hi) => clamp(Math.round(Number(v) || 0), lo, hi);

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/** Minimal reactive store: subscribe / patch / select. */
export function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    get: () => state,
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : { ...state, ...patch };
      if (next === state) return state;
      const prev = state;
      state = next;
      listeners.forEach((l) => l(state, prev));
      return state;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
