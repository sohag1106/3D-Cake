import { FLAVORS, FILLINGS, FROSTINGS, SHAPES, SIZES, TIERS, TOPPERS, BOARD_STYLES, PRICING, PALETTE } from '../data/catalog.js';
import { daysUntil } from './utils.js';

export const DEFAULT_DESIGN = {
  edition: null,          // editions[].id — purely a starting point, never locks anything
  shape: 'round',
  size: '2lb',
  tiers: 'single',
  flavor: 'vanilla-bean',
  filling: 'ganache',
  frosting: 'buttercream',
  frostingColor: null,    // null => use the frosting's own signature colour
  board: 'cake',
  boardColor: 'gold',
  toppers: [],            // catalog ids, max 6
  message: '',
  messageColor: 'gold',
  candles: 0,             // 0–12
  dripColor: null,
  occasionDate: '',
  servingsNote: '',
};

const byId = (list, id) => list.find((x) => x.id === id) || list[0];

/**
 * The rail stores palette *ids* ('rose', 'gold'), the renderer wants hex.
 * Resolving here means every consumer — 3D, summary, order sheet — agrees.
 */
export function paletteHex(id, fallback) {
  if (!id) return fallback || null;
  if (typeof id === 'string' && id.startsWith('#')) return id;
  return PALETTE.find((p) => p.id === id)?.hex || fallback || null;
}

export function resolve(design) {
  const shape = byId(SHAPES, design.shape);
  const size = byId(SIZES, design.size);
  const tierDef = byId(TIERS, design.tiers);
  const flavor = byId(FLAVORS, design.flavor);
  const filling = byId(FILLINGS, design.filling);
  const frosting = byId(FROSTINGS, design.frosting);
  const board = byId(BOARD_STYLES, design.board);
  const toppers = design.toppers.map((id) => TOPPERS.find((t) => t.id === id)).filter(Boolean);

  // Frosting colour: an explicit palette pick wins, otherwise the finish's
  // own signature colour.
  const color = paletteHex(design.frostingColor, frosting.color);

  const boardColor = paletteHex(design.boardColor, '#c9a24b');
  const ribbonColor = paletteHex(design.ribbonColor, '#c9a24b');
  const messageColor = paletteHex(design.messageColor, '#c9a24b');
  const dripColor = paletteHex(design.dripColor, null);

  // Ribbon is a topper chip in the catalog, so it participates in pricing too.
  const ribbonOn = design.toppers.includes('ribbon');

  return {
    shape, size, tierDef, flavor, filling, frosting, board, toppers,
    color, boardColor, ribbonColor, messageColor, dripColor, ribbonOn,
  };
}

/**
 * Full price breakdown. Every line is shown to the customer, so nothing here
 * should be a surprise at checkout.
 */
export function quote(design) {
  const { shape, size, tierDef, flavor, filling, frosting, board, toppers } = resolve(design);
  const lines = [];
  const push = (label, amount) => { if (amount) lines.push({ label, amount }); };

  push(`${size.label} ${shape.label.toLowerCase()} — ${tierDef.label.toLowerCase()}`, size.price);

  if (tierDef.count > 1) push(`${tierDef.label} structure & doweling`, tierDef.price);
  if (shape.price) push(`${shape.label} mould work`, shape.price);

  const flavorPremium = ['pistachio', 'matcha', 'black-forest', 'blueberry'].includes(flavor.id);
  if (flavorPremium) push(`${flavor.label} sponge`, PRICING.flavorSurcharge * tierDef.count);

  if (filling.id !== 'none') push(`${filling.label} filling`, PRICING.fillingSurcharge * tierDef.count);

  push(`${frosting.label} finish`, PRICING.frostingSurcharge[frosting.tier] ?? 0);

  if (toppers.length > 2) push(`${toppers.length - 2} extra topping${toppers.length - 2 > 1 ? 's' : ''}`, PRICING.toppingSurcharge * (toppers.length - 2));
  toppers.forEach((t) => push(`${t.label}`, t.price));

  push(`${board.label}`, PRICING.boardSurcharge[board.id] ?? 0);
  if (design.candles) push(`${design.candles} candle${design.candles > 1 ? 's' : ''}`, design.candles * 30);
  if (design.message?.trim()) push('Hand-piped inscription', 180);

  const days = daysUntil(design.occasionDate);
  const expedited = days !== Infinity && days < 2;
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);

  if (expedited) lines.push({ label: 'Expedited (< 48h) — 25%', amount: subtotal * (PRICING.expedited - 1) });

  const total = lines.reduce((s, l) => s + l.amount, 0);
  return {
    lines,
    subtotal,
    total,
    expedited,
    days,
    serves: size.serves,
    tierCount: tierDef.count,
  };
}

/** Short human summary used in the summary rail and the order handoff. */
export function describe(design) {
  const { shape, size, tierDef, frosting, flavor, filling, toppers, board } = resolve(design);
  const bits = [
    `${size.label} ${shape.label.toLowerCase()}`,
    tierDef.count > 1 ? `${tierDef.label.toLowerCase()}` : null,
    `${flavor.label.toLowerCase()} sponge`,
    filling.id !== 'none' ? `${filling.label.toLowerCase()}` : null,
    `${frosting.label.toLowerCase()}`,
    board.id !== 'none' ? board.label.toLowerCase() : null,
    toppers.length ? `${toppers.map((t) => t.label.toLowerCase()).join(', ')}` : null,
  ].filter(Boolean);
  return bits.join(' · ');
}
