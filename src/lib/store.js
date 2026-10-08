import { createStore, clampInt, uid } from './utils.js';
import { DEFAULT_DESIGN } from './pricing.js';
import { EDITIONS, TOPPERS } from '../data/catalog.js';

export const MAX_TOPPERS = 6;
export const MAX_CANDLES = 12;

const saved = loadSaved();

export const store = createStore({
  design: saved?.design || { ...DEFAULT_DESIGN },
  saved: saved?.saved || [],
  order: null,
  ui: {
    backdrop: 'atelier',
    stage: 'stage',
    turntable: true,
    quality: 'high',
    sound: false,
    reducedMotion: false,
    advanced: false,
  },
  lastAction: null,
});

// ── persistence ───────────────────────────────────────────────────────────

function loadSaved() {
  try {
    const raw = localStorage.getItem('atelier-creme-v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.design) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function persist() {
  try {
    const { design, saved: list, ui } = store.get();
    localStorage.setItem('atelier-creme-v1', JSON.stringify({
      design,
      saved: list,
      ui: { backdrop: ui.backdrop, quality: ui.quality, turntable: ui.turntable, sound: ui.sound, reducedMotion: ui.reducedMotion },
    }));
  } catch {
    /* storage unavailable — the studio still works in-memory */
  }
}

let persistTimer;
store.subscribe(() => {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persist, 350);
});

// ── design mutations ──────────────────────────────────────────────────────

export function patchDesign(patch, action = null) {
  store.set((s) => ({
    ...s,
    design: { ...s.design, ...patch },
    lastAction: action ? { ...action, at: Date.now() } : s.lastAction,
  }));
}

/** Apply an edition's starting recipe — a suggestion, never a lock. */
export function applyEdition(id) {
  const edition = EDITIONS.find((e) => e.id === id);
  if (!edition) return;
  const a = edition.apply;
  patchDesign({
    edition: id,
    ...(a.shape ? { shape: a.shape } : {}),
    ...(a.tiers ? { tiers: a.tiers } : {}),
    ...(a.frosting ? { frosting: a.frosting } : {}),
    ...(a.toppers ? { toppers: [...a.toppers] } : {}),
    ...(a.filling ? { filling: a.filling } : {}),
  }, { type: 'edition', id, label: edition.label });
}

export function toggleTopper(id) {
  const s = store.get();
  const list = s.design.toppers;
  const has = list.includes(id);
  if (!has && list.length >= MAX_TOPPERS) {
    return { ok: false, reason: `Up to ${MAX_TOPPERS} toppings per cake — remove one first.` };
  }
  const label = TOPPERS.find((t) => t.id === id)?.label || id;
  patchDesign(
    { toppers: has ? list.filter((x) => x !== id) : [...list, id] },
    { type: has ? 'remove' : 'add', id, label },
  );
  return { ok: true, added: !has };
}

export function setCandles(n) {
  patchDesign({ candles: clampInt(n, 0, MAX_CANDLES) }, { type: 'candles', value: clampInt(n, 0, MAX_CANDLES) });
}

export function randomize() {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const candles = pick([0, 0, 1, 3, 5, 8]);
  const edition = pick(EDITIONS);
  const a = edition.apply;
  patchDesign({
    edition: edition.id,
    shape: a.shape || pick(['round', 'square', 'heart', 'hexagon', 'drum', 'petal', 'sculpt']),
    size: pick(['1lb', '2lb', '2lb', '3lb', '5lb']),
    tiers: a.tiers || pick(['single', 'single', 'two', 'three']),
    flavor: pick(['vanilla-bean', 'chocolate', 'red-velvet', 'lemon', 'strawberry', 'pistachio', 'caramel', 'matcha', 'coffee', 'black-forest']),
    filling: a.filling || pick(['none', 'ganache', 'cream', 'curd', 'jam', 'caramel', 'mousse']),
    frosting: a.frosting || pick(['smooth', 'buttercream', 'chocolate', 'fondant', 'mirror', 'marble', 'textured', 'velvet-matte', 'pearl']),
    frostingColor: null,
    candles,
    toppers: (() => {
      const pool = TOPPERS.filter((t) => t.tier !== 'high' || Math.random() > 0.6);
      const out = new Set(a.toppers || []);
      const want = 2 + Math.floor(Math.random() * 3);
      let guard = 0;
      while (out.size < want && guard++ < 40) out.add(pick(pool).id);
      return [...out].slice(0, MAX_TOPPERS);
    })(),
    message: '',
  }, { type: 'randomize' });
}

// ── saved designs ─────────────────────────────────────────────────────────

export function saveCurrent(name) {
  const { design, saved: list } = store.get();
  const entry = { id: uid(), name: name?.trim() || 'Untitled cake', design: { ...design }, at: Date.now() };
  store.set((s) => ({ ...s, saved: [entry, ...s.saved].slice(0, 24) }));
  return entry;
}

export function deleteSaved(id) {
  store.set((s) => ({ ...s, saved: s.saved.filter((x) => x.id !== id) }));
}

export function loadSavedDesign(id) {
  const entry = store.get().saved.find((x) => x.id === id);
  if (entry) patchDesign({ ...entry.design }, { type: 'load', label: entry.name });
  return entry;
}

export function resetDesign() {
  patchDesign({ ...DEFAULT_DESIGN }, { type: 'reset' });
}

export function undoLast() {
  const { lastAction } = store.get();
  if (!lastAction) return;
  switch (lastAction.type) {
    case 'add': toggleTopper(lastAction.id); break;
    case 'remove': toggleTopper(lastAction.id); break;
    case 'candles': setCandles(0); break;
    default: break;
  }
}

// ── order handoff ─────────────────────────────────────────────────────────

export function makeOrder({ name, phone, date, notes, total, lines }) {
  const { design } = store.get();
  const code = `AC-${Date.now().toString(36).toUpperCase().slice(-5)}`;
  const order = {
    code,
    name, phone, date, notes,
    design: { ...design },
    total,
    lines,
    placedAt: new Date().toISOString(),
  };
  store.set((s) => ({ ...s, order }));
  return order;
}

export function clearOrder() {
  store.set((s) => ({ ...s, order: null }));
}

/** React hook: subscribe a component to the whole store. */
import { useSyncExternalStore } from 'react';
export function useStore(selector = (s) => s) {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.get()),
    () => selector(store.get()),
  );
}

/** Stable accessor for the current design object. */
export const useDesign = () => useStore((s) => s.design);
export const useUi = () => useStore((s) => s.ui);

export function patchUi(patch) {
  store.set((s) => ({ ...s, ui: { ...s.ui, ...patch } }));
}
