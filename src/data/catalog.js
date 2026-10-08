// ─────────────────────────────────────────────────────────────────────────────
// Atelier Crème — catalogue data
// Every option the customer can touch, plus pricing rules for the estimator.
// ─────────────────────────────────────────────────────────────────────────────

export const FLAVORS = [
  { id: 'vanilla-bean',    label: 'Vanilla Bean',        color: '#f7ecd4', note: 'Madagascar vanilla, brown-butter crumb' },
  { id: 'chocolate',       label: 'Dark Chocolate',      color: '#4a2c17', note: '70% Valrhona, espresso-kissed' },
  { id: 'red-velvet',      label: 'Red Velvet',          color: '#9b1b30', note: 'Cocoa-kissed crimson, cream-cheese heart' },
  { id: 'lemon',           label: 'Sicilian Lemon',      color: '#f2e39b', note: 'Zested, light, olive-oil soft' },
  { id: 'strawberry',      label: 'Strawberry',          color: '#f6b8c1', note: 'Fresh berry purée, vanilla bean' },
  { id: 'pistachio',       label: 'Pistachio',           color: '#b7c69a', note: 'Sicilian pistachio, honey' },
  { id: 'caramel',         label: 'Salted Caramel',      color: '#d3a05a', note: 'Burnt sugar, fleur de sel' },
  { id: 'matcha',          label: 'Matcha',              color: '#9fae7c', note: 'Ceremonial-grade, white chocolate' },
  { id: 'coffee',          label: 'Espresso',            color: '#6b4a32', note: 'Double shot, Kahlúa crumb' },
  { id: 'coconut',         label: 'Coconut',             color: '#f4efe2', note: 'Toasted coconut, mango curd' },
  { id: 'black-forest',    label: 'Black Forest',        color: '#3a1f16', note: 'Kirsch, dark cherries, shavings' },
  { id: 'blueberry',       label: 'Blueberry',           color: '#8d7fb8', note: 'Wild blueberry, lemon thyme' },
];

export const FILLINGS = [
  { id: 'none',       label: 'No filling',        color: null },
  { id: 'ganache',    label: 'Chocolate Ganache', color: '#5b3a29' },
  { id: 'cream',      label: 'Whipped Cream',     color: '#fffaf0' },
  { id: 'curd',       label: 'Fruit Curd',        color: '#f4c14f' },
  { id: 'jam',        label: 'Berry Jam',         color: '#b0305a' },
  { id: 'caramel',    label: 'Caramel',           color: '#c97f35' },
  { id: 'mousse',     label: 'Mousse',            color: '#f0d9d0' },
];

// Frostings drive the 3D surface: shader style + base colour + roughness.
export const FROSTINGS = [
  // Atelier staples — always available
  { id: 'smooth',        label: 'Velvet Smooth',     style: 'smooth',        color: '#fff6ea', roughness: 0.42, premium: false, tier: 'basic' },
  { id: 'buttercream',   label: 'Silk Buttercream',  style: 'buttercream',   color: '#fbeed8', roughness: 0.62, premium: false, tier: 'basic' },
  { id: 'chocolate',     label: 'Full Chocolate',    style: 'chocolate',     color: '#402314', roughness: 0.38, premium: false, tier: 'basic' },
  { id: 'fondant',       label: 'Rolled Fondant',    style: 'fondant',       color: '#fdf3ec', roughness: 0.50, premium: true,  tier: 'basic' },
  { id: 'mirror',        label: 'Mirror Glaze',      style: 'mirror',        color: '#b3123f', roughness: 0.08, premium: true,  tier: 'basic' },

  // Mid atelier
  { id: 'stucco',        label: 'Stucco Rustico',    style: 'stucco',        color: '#efe3cf', roughness: 0.74, premium: true,  tier: 'mid' },
  { id: 'semi-naked',    label: 'Semi-Naked',        style: 'semi-naked',    color: '#f7ead6', roughness: 0.60, premium: false, tier: 'mid' },
  { id: 'textured',      label: 'Textured Velvet',   style: 'textured',      color: '#f0e0d2', roughness: 0.80, premium: true,  tier: 'mid' },
  { id: 'marble',        label: 'Marble Swirl',      style: 'marble',        color: '#f6ead8', roughness: 0.45, premium: true,  tier: 'mid' },
  { id: 'gelato',        label: 'Gelato Stripes',    style: 'gelato',        color: '#f3d9e2', roughness: 0.58, premium: true,  tier: 'mid' },

  // Grand atelier
  { id: 'crystal',       label: 'Crystal Lace',      style: 'crystal',       color: '#f2ecff', roughness: 0.22, premium: true,  tier: 'high' },
  { id: 'gold-drip',     label: '24k Gold Drip',     style: 'gold-drip',     color: '#e8c56a', roughness: 0.18, premium: true,  tier: 'high' },
  { id: 'velvet-matte',  label: 'Velvet Matte',      style: 'velvet-matte',  color: '#d7b9c4', roughness: 0.95, premium: true,  tier: 'high' },
  { id: 'marzipan',      label: 'Marzipan Crumb',    style: 'marzipan',      color: '#f0dcb4', roughness: 0.85, premium: true,  tier: 'high' },
  { id: 'pearl',         label: 'Pearl Finish',      style: 'pearl',         color: '#efe6da', roughness: 0.30, premium: true,  tier: 'high' },
];

// Cake geometry. radius in scene units (1 unit ≈ 1 inch of visible scale).
export const SHAPES = [
  { id: 'round',    label: 'Classic Round',     radius: 2.0, height: 1.15, depth: null,  price: 0   },
  { id: 'square',   label: 'Square',            radius: 2.0, height: 1.15, depth: 2.0,  price: 120 },
  { id: 'heart',    label: 'Heart',             radius: 2.0, height: 1.15, depth: null,  price: 260 },
  { id: 'hexagon',  label: 'Hexagon',           radius: 2.0, height: 1.15, depth: null,  price: 180 },
  { id: 'drum',     label: 'Drum',              radius: 2.15, height: 1.55, depth: null, price: 140 },
  { id: 'petal',    label: 'Petal',             radius: 2.05, height: 1.10, depth: null, price: 320 },
  { id: 'sculpt',   label: 'Sculpted Oval',     radius: 2.0, height: 1.15, depth: 1.35, price: 340 },
];

export const SIZES = [
  { id: '0.5lb', label: '½ lb',  serves: '4–6',   scale: 0.72, price: 280  },
  { id: '1lb',   label: '1 lb',  serves: '8–10',  scale: 0.86, price: 420  },
  { id: '2lb',   label: '2 lb',  serves: '12–16', scale: 1.00, price: 650  },
  { id: '3lb',   label: '3 lb',  serves: '20–24', scale: 1.12, price: 890  },
  { id: '5lb',   label: '5 lb',  serves: '30–36', scale: 1.28, price: 1250 },
  { id: '8lb',   label: '8 lb',  serves: '48–60', scale: 1.45, price: 1850 },
];

// Tier count multiplies height & radius slightly; each tier repeats the shape.
export const TIERS = [
  { id: 'single', label: 'Single',      count: 1, price: 0   },
  { id: 'two',    label: 'Two tiers',   count: 2, price: 650 },
  { id: 'three',  label: 'Three tiers', count: 3, price: 1350 },
];

export const BOARD_STYLES = [
  { id: 'none',    label: 'No stand' },
  { id: 'cake',    label: 'Cake board' },
  { id: 'pedestal',label: 'Pedestal' },
  { id: 'riser',   label: 'Gold riser' },
];

export const TOPPERS = [
  // fresh
  { id: 'rose-garden',  label: 'Rose Garden',         category: 'fresh',      price: 340, premium: false, tier: 'basic' },
  { id: 'berry-crown',  label: 'Berry Crown',         category: 'fresh',      price: 290, premium: false, tier: 'basic' },
  { id: 'lavender',     label: 'Lavender Mist',       category: 'fresh',      price: 310, premium: false, tier: 'basic' },
  { id: 'peony',        label: 'Peony Cascade',       category: 'fresh',      price: 420, premium: true,  tier: 'basic' },
  { id: 'orchid',       label: 'Orchid Bloom',        category: 'fresh',      price: 480, premium: true,  tier: 'mid' },
  { id: 'sunflower',    label: 'Sunflower Field',     category: 'fresh',      price: 360, premium: false, tier: 'mid' },
  { id: 'cherry-blossom',label:'Cherry Blossom',      category: 'fresh',      price: 390, premium: true,  tier: 'mid' },
  { id: 'tropical',     label: 'Tropical Plume',      category: 'fresh',      price: 410, premium: true,  tier: 'mid' },
  { id: 'pressed',      label: 'Pressed Flowers',     category: 'fresh',      price: 330, premium: false, tier: 'high' },
  { id: 'gold-leaf',    label: 'Gold Leaf Cluster',   category: 'fresh',      price: 520, premium: true,  tier: 'high' },
  { id: 'moss',         label: 'Moss & Fern',         category: 'fresh',      price: 380, premium: true,  tier: 'high' },
  { id: 'fruit-burst',  label: 'Fresh Fruit Burst',   category: 'fresh',      price: 300, premium: false, tier: 'high' },
  // chocolate
  { id: 'choco-shards', label: 'Chocolate Shards',    category: 'chocolate',  price: 240, premium: false, tier: 'basic' },
  { id: 'choco-drip',   label: 'Chocolate Drip',      category: 'chocolate',  price: 220, premium: false, tier: 'basic' },
  { id: 'choco-curl',   label: 'Chocolate Curls',     category: 'chocolate',  price: 260, premium: false, tier: 'mid' },
  { id: 'choco-truffle',label: 'Truffle Cluster',     category: 'chocolate',  price: 340, premium: true,  tier: 'mid' },
  { id: 'choco-cage',   label: 'Chocolate Cage',      category: 'chocolate',  price: 560, premium: true,  tier: 'high' },
  { id: 'choco-sculpt', label: 'Chocolate Sculpture', category: 'chocolate',  price: 780, premium: true,  tier: 'high' },
  // fruit
  { id: 'strawberry',   label: 'Strawberry Hearts',   category: 'fruit',      price: 260, premium: false, tier: 'basic' },
  { id: 'blueberry',    label: 'Blueberry Scatter',   category: 'fruit',      price: 240, premium: false, tier: 'basic' },
  { id: 'fig',          label: 'Fig & Honey',         category: 'fruit',      price: 330, premium: true,  tier: 'mid' },
  { id: 'citrus',       label: 'Candied Citrus',      category: 'fruit',      price: 300, premium: false, tier: 'mid' },
  { id: 'pomegranate',  label: 'Pomegranate Jewels',  category: 'fruit',      price: 350, premium: true,  tier: 'high' },
  { id: 'gold-berry',   label: 'Gold-Dusted Berries', category: 'fruit',      price: 460, premium: true,  tier: 'high' },
  // sugar & craft
  { id: 'pearls',       label: 'Sugar Pearls',        category: 'sugar',      price: 200, premium: false, tier: 'basic' },
  { id: 'gold-dust',    label: 'Gold Dust',           category: 'sugar',      price: 280, premium: true,  tier: 'basic' },
  { id: 'ribbon',       label: 'Silk Ribbon',         category: 'sugar',      price: 190, premium: false, tier: 'basic' },
  { id: 'macarons',     label: 'Macaron Ring',        category: 'sugar',      price: 380, premium: true,  tier: 'mid' },
  { id: 'meringue',     label: 'Meringue Kisses',     category: 'sugar',      price: 320, premium: true,  tier: 'mid' },
  { id: 'candles',      label: 'Sparkler Candles',    category: 'sugar',      price: 250, premium: false, tier: 'mid' },
  { id: 'monogram',     label: 'Monogram Plaque',     category: 'sugar',      price: 450, premium: true,  tier: 'mid' },
  { id: 'number',       label: 'Number Topper',       category: 'sugar',      price: 360, premium: false, tier: 'mid' },
  { id: 'isomalt',      label: 'Isomalt Gems',        category: 'sugar',      price: 520, premium: true,  tier: 'high' },
  { id: 'sugar-flower', label: 'Hand-Piped Sugar Rose',category: 'sugar',     price: 680, premium: true,  tier: 'high' },
  { id: 'lace',         label: 'Sugar Lace Collar',   category: 'sugar',      price: 590, premium: true,  tier: 'high' },
  { id: 'royal-crown',  label: 'Royal Crown',         category: 'sugar',      price: 840, premium: true,  tier: 'high' },
];

export const EDITIONS = [
  {
    id: 'birthday', label: 'Birthday', icon: 'balloon',
    tagline: 'Confetti, candles and a candle-lit moment.',
    apply: { frosting: 'buttercream', toppers: ['candles', 'pearls'], filling: 'cream' },
  },
  {
    id: 'anniversary', label: 'Anniversary', icon: 'rings',
    tagline: 'Gold leaf, roses and quiet elegance.',
    apply: { frosting: 'velvet-matte', toppers: ['rose-garden', 'gold-leaf'], filling: 'ganache' },
  },
  {
    id: 'wedding', label: 'Wedding', icon: 'rings',
    tagline: 'Three tiers, hand-piped sugar roses.',
    apply: { tiers: 'three', frosting: 'fondant', toppers: ['sugar-flower', 'lace'], filling: 'cream' },
  },
  {
    id: 'valentine', label: 'Valentine', icon: 'heart',
    tagline: 'A heart, mirror-glazed and berry-strewn.',
    apply: { shape: 'heart', frosting: 'mirror', toppers: ['strawberry', 'berry-crown'], filling: 'curd' },
  },
  {
    id: 'graduation', label: 'Graduation', icon: 'cap',
    tagline: 'A number topper and a sparkler finish.',
    apply: { frosting: 'smooth', toppers: ['number', 'candles'], filling: 'jam' },
  },
  {
    id: 'baby-shower', label: 'Baby Shower', icon: 'baby',
    tagline: 'Soft pastels, blossoms and pearls.',
    apply: { frosting: 'buttercream', toppers: ['cherry-blossom', 'pearls'], filling: 'mousse' },
  },
  {
    id: 'eid', label: 'Eid', icon: 'star',
    tagline: 'Gold-drenched, crescent and jeweled.',
    apply: { frosting: 'gold-drip', toppers: ['gold-leaf', 'isomalt'], filling: 'caramel' },
  },
  {
    id: 'christmas', label: 'Christmas', icon: 'tree',
    tagline: 'Cocoa, cranberry and a dusting of gold.',
    apply: { frosting: 'chocolate', toppers: ['fruit-burst', 'gold-dust'], filling: 'jam' },
  },
  {
    id: 'halloween', label: 'Halloween', icon: 'bat',
    tagline: 'Midnight mirror glaze and black shards.',
    apply: { frosting: 'mirror', toppers: ['choco-shards', 'isomalt'], filling: 'caramel' },
  },
  {
    id: 'thank-you', label: 'Thank You', icon: 'leaf',
    tagline: 'Understated, semi-naked and fresh.',
    apply: { frosting: 'semi-naked', toppers: ['lavender'], filling: 'cream' },
  },
  {
    id: 'just-because', label: 'Just Because', icon: 'spark',
    tagline: 'Whatever the moment calls for.',
    apply: { frosting: 'buttercream', toppers: ['macarons'], filling: 'jam' },
  },
  {
    id: 'engagement', label: 'Engagement', icon: 'rings',
    tagline: 'A ring of roses and a golden crescent.',
    apply: { frosting: 'pearl', toppers: ['rose-garden', 'gold-leaf'], filling: 'ganache' },
  },
  {
    id: 'retirement', label: 'Retirement', icon: 'cap',
    tagline: 'A celebratory monogram and confetti.',
    apply: { frosting: 'smooth', toppers: ['monogram', 'candles'], filling: 'cream' },
  },
  {
    id: 'housewarming', label: 'Housewarming', icon: 'leaf',
    tagline: 'Warm caramel, moss and candlelight.',
    apply: { frosting: 'caramel', toppers: ['moss', 'candles'], filling: 'caramel' },
  },
  {
    id: 'kids', label: 'Kids Party', icon: 'balloon',
    tagline: 'Bright, cheerful and berry-sweet.',
    apply: { frosting: 'gelato', toppers: ['macarons', 'blueberry'], filling: 'jam' },
  },
  {
    id: 'dairy-free', label: 'Dairy Free', icon: 'leaf',
    tagline: 'Coconut cream, fruit and no dairy.',
    apply: { frosting: 'smooth', toppers: ['fruit-burst'], filling: 'curd' },
  },
  {
    id: 'vegan', label: 'Vegan', icon: 'leaf',
    tagline: 'Plant-based, still grand.',
    apply: { frosting: 'stucco', toppers: ['pressed', 'lavender'], filling: 'jam' },
  },
  {
    id: 'gluten-free', label: 'Gluten Free', icon: 'leaf',
    tagline: 'Almond crumb, pistachio and berry.',
    apply: { frosting: 'semi-naked', toppers: ['berry-crown'], filling: 'curd' },
  },
  {
    id: 'novelty', label: 'Novelty / Custom', icon: 'spark',
    tagline: 'Sculpted, themed and entirely yours.',
    apply: { shape: 'sculpt', frosting: 'fondant', toppers: ['choco-sculpt'], filling: 'ganache' },
  },
];

// Palette for frostings / board accents / monograms.
export const PALETTE = [
  { id: 'ivory',     label: 'Ivory',     hex: '#fff6ea' },
  { id: 'blush',     label: 'Blush',     hex: '#f6d9dc' },
  { id: 'rose',      label: 'Rose',      hex: '#e5a9b6' },
  { id: 'dusty-rose',label: 'Dusty Rose',hex: '#c98f9b' },
  { id: 'cherry',    label: 'Cherry',    hex: '#a92338' },
  { id: 'lavender',  label: 'Lavender',  hex: '#cdb9e3' },
  { id: 'sky',       label: 'Sky',       hex: '#bcd6ea' },
  { id: 'sage',      label: 'Sage',      hex: '#b8c4a8' },
  { id: 'pistachio', label: 'Pistachio', hex: '#c6cf9d' },
  { id: 'butter',    label: 'Butter',    hex: '#f6e5a8' },
  { id: 'peach',     label: 'Peach',     hex: '#f4c39a' },
  { id: 'champagne', label: 'Champagne', hex: '#e8cf9b' },
  { id: 'gold',      label: 'Gold',      hex: '#c9a24b' },
  { id: 'copper',    label: 'Copper',    hex: '#b06a3c' },
  { id: 'cocoa',     label: 'Cocoa',     hex: '#5a3a24' },
  { id: 'espresso',  label: 'Espresso',  hex: '#3a2415' },
  { id: 'midnight',  label: 'Midnight',  hex: '#23203a' },
  { id: 'charcoal',  label: 'Charcoal',  hex: '#4a4a50' },
  { id: 'white',     label: 'White',     hex: '#ffffff' },
  { id: 'silver',    label: 'Silver',    hex: '#c8c8cc' },
];

// Ribbon colour follows the palette; a subset keeps the ribbon tray tight.
export const RIBBON_COLORS = PALETTE.filter(p =>
  ['gold', 'copper', 'cocoa', 'espresso', 'blush', 'rose', 'dusty-rose', 'cherry', 'sage', 'midnight', 'champagne', 'white', 'silver'].includes(p.id),
);

export const CAKE_BOARDS = PALETTE;

export const PRICING = {
  perPound: 340,        // base per pound, scaled by size
  flavorSurcharge: 40,  // per tier, premium flavors
  fillingSurcharge: 60, // per tier
  frostingSurcharge: { basic: 0, mid: 180, high: 420 },
  toppingSurcharge: 120, // per additional topping beyond 2
  boardSurcharge: { none: 0, cake: 60, pedestal: 320, riser: 480 },
  expedited: 1.25,       // multiplier for < 48h
};

export const CURRENCY = '₹';
