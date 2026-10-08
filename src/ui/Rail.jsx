import { useState, useMemo, useEffect } from 'react';
import { Icon, EDITION_ICON } from './Icon.jsx';
import { Section, Segmented } from './components.jsx';
import { MiniPreview, shapeBuildFn } from './previews.jsx';
import {
  useDesign, useStore, patchDesign, applyEdition, toggleTopper,
  setCandles, MAX_TOPPERS, MAX_CANDLES,
} from '../lib/store.js';
import {
  SHAPES, SIZES, TIERS, FLAVORS, FILLINGS, FROSTINGS, EDITIONS,
  TOPPERS, PALETTE, CAKE_BOARDS, RIBBON_COLORS, CURRENCY, BOARD_STYLES,
} from '../data/catalog.js';
import { quote } from '../lib/pricing.js';

const TABS = [
  { id: 'design', label: 'Design', icon: Icon.sparkle },
  { id: 'flavor', label: 'Flavor', icon: Icon.whisk },
  { id: 'finish', label: 'Finish', icon: Icon.palette },
  { id: 'toppers', label: 'Toppers', icon: Icon.flower },
  { id: 'details', label: 'Details', icon: Icon.text },
];

export default function Rail({
  onOrder, onRandomize, onSave, onSaved, onUndo, onReset, onPhone,
}) {
  const [tab, setTab] = useState('design');
  const design = useDesign();
  const savedCount = useStore((s) => s.saved.length);
  const q = useMemo(() => quote(design), [design]);

  return (
    <aside className="rail">
      <header className="rail__head">
        <div className="rail__eyebrow">Commission</div>
        <div className="rail__titlerow">
          <h2 className="rail__title">Design your <em>cake</em></h2>
          <button
            type="button"
            className="btn btn--ghost btn--sm rail__shuffle"
            onClick={onRandomize}
            title="Surprise me — build a random commission"
          >
            <Icon.dice size={14} /> Shuffle
          </button>
        </div>
        <p className="rail__tagline">
          Every choice lands in the studio instantly — shape, sponge, finish and flourish.
        </p>

        <div className="editions" role="group" aria-label="Occasions">
          <button
            type="button"
            className="edition-chip"
            aria-pressed={!design.edition}
            onClick={() => patchDesign({ edition: null })}
            title="Start from a blank canvas"
          >
            <Icon.sparkle size={14} /> Blank canvas
          </button>
          {EDITIONS.map((e) => {
            const ic = EDITION_ICON[e.icon] || 'sparkle';
            const Glyph = Icon[ic] || Icon.sparkle;
            return (
              <button
                key={e.id}
                type="button"
                className="edition-chip"
                aria-pressed={design.edition === e.id}
                onClick={() => applyEdition(e.id)}
                title={e.tagline}
              >
                <Glyph size={14} />
                {e.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.icon({ size: 14, stroke: 1.8 })}
            <span className="tab__label">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="rail__body" role="tabpanel">
        {tab === 'design' && <DesignTab />}
        {tab === 'flavor' && <FlavorTab />}
        {tab === 'finish' && <FinishTab />}
        {tab === 'toppers' && <ToppersTab />}
        {tab === 'details' && <DetailsTab />}
      </div>

      <Summary
        q={q}
        design={design}
        onOrder={onOrder}
        onRandomize={onRandomize}
        onSave={onSave}
        onSaved={onSaved}
        onUndo={onUndo}
        onReset={onReset}
        onPhone={onPhone}
        savedCount={savedCount}
      />
    </aside>
  );
}

// ═════════════════════════════════════════════════════════════════
// DESIGN TAB — shape · size · tiers
// ═════════════════════════════════════════════════════════════════

function DesignTab() {
  const design = useDesign();
  const size = SIZES.find((s) => s.id === design.size);
  const tiers = TIERS.find((t) => t.id === design.tiers);

  return (
    <>
      <Section label="Shape" value={SHAPES.find((s) => s.id === design.shape)?.label}>
        <div className="opt-grid opt-grid--3">
          {SHAPES.map((s) => (
            <button
              key={s.id}
              type="button"
              className="opt"
              aria-pressed={design.shape === s.id}
              onClick={() => patchDesign({ shape: s.id }, { type: 'shape', label: s.label })}
            >
              <span className="opt__icon">
                <MiniPreview build={shapeBuildFn(s.id)} />
              </span>
              <span className="opt__name">{s.label}</span>
              {s.price > 0 && <span className="opt__price">+{CURRENCY}{s.price}</span>}
            </button>
          ))}
        </div>
      </Section>

      <Section label="Size" value={`serves ${size?.serves}`}>
        <div className="size-row">
          {SIZES.map((s) => (
            <button
              key={s.id}
              type="button"
              className="size-card"
              aria-pressed={design.size === s.id}
              onClick={() => patchDesign({ size: s.id }, { type: 'size', label: s.label })}
            >
              <div className="size-card__lb">{s.label}</div>
              <div className="size-card__serves">serves {s.serves}</div>
              <div className="size-card__price">{CURRENCY}{s.price.toLocaleString('en-IN')}</div>
            </button>
          ))}
        </div>
        <p className="section__note">
          Priced by weight. A <b>{size?.label}</b> cake is sculpted and baked to order.
        </p>
      </Section>

      <Section
        label="Tiers"
        value={tiers?.label}
        note={design.tiers !== 'single'
          ? 'Each tier is a full cake — sponge, filling and finish — stacked on food-safe dowels.'
          : 'A single, generous tier. Add tiers for height and drama.'}
      >
        <Segmented
          value={design.tiers}
          onChange={(v) => patchDesign({ tiers: v }, { type: 'tiers', label: v })}
          options={TIERS.map((t) => ({
            id: t.id,
            label: t.label,
            hint: t.price ? `+${CURRENCY}${t.price}` : 'included',
          }))}
        />
      </Section>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════
// FLAVOR TAB — sponge · filling
// ═════════════════════════════════════════════════════════════════

function FlavorTab() {
  const design = useDesign();
  const flavor = FLAVORS.find((f) => f.id === design.flavor);
  return (
    <>
      <Section label="Sponge" value={flavor?.label}>
        <div className="opt-grid opt-grid--3">
          {FLAVORS.map((f) => (
            <button
              key={f.id}
              type="button"
              className="opt"
              aria-pressed={design.flavor === f.id}
              onClick={() => patchDesign({ flavor: f.id }, { type: 'flavor', label: f.label })}
              title={f.note}
            >
              <span className="opt__icon">
                <span
                  style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: `radial-gradient(circle at 32% 28%, ${f.color}, ${f.color} 55%, rgba(0,0,0,.5))`,
                    boxShadow: 'inset 0 1px 3px rgba(255,255,255,.35), 0 3px 8px rgba(0,0,0,.4)',
                  }}
                />
              </span>
              <span className="opt__name">{f.label}</span>
            </button>
          ))}
        </div>
        <p className="section__note">{flavor?.note}</p>
      </Section>

      <Section
        label="Filling"
        value={FILLINGS.find((f) => f.id === design.filling)?.label}
        note="Shown as the seam between tiers — the line of colour that peeks out of the side."
      >
        <div className="opt-grid opt-grid--3">
          {FILLINGS.map((f) => (
            <button
              key={f.id}
              type="button"
              className="opt"
              aria-pressed={design.filling === f.id}
              onClick={() => patchDesign({ filling: f.id }, { type: 'filling', label: f.label })}
            >
              <span className="opt__icon">
                {f.color ? (
                  <span
                    style={{
                      width: 34, height: 9, borderRadius: 99, background: f.color,
                      boxShadow: '0 2px 6px rgba(0,0,0,.45), inset 0 1px 1px rgba(255,255,255,.4)',
                    }}
                  />
                ) : (
                  <span style={{ width: 34, height: 9, borderRadius: 99, border: '1.5px dashed rgba(255,255,255,.25)' }} />
                )}
              </span>
              <span className="opt__name">{f.label}</span>
            </button>
          ))}
        </div>
      </Section>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════
// FINISH TAB — frosting styles · palette · stand
// ═════════════════════════════════════════════════════════════════

const FINISH_META = {
  smooth: 'a flawless, poured shine',
  buttercream: 'piped rosettes, soft and sweet',
  chocolate: 'a full dark chocolate cloak',
  fondant: 'rolled smooth as porcelain',
  mirror: 'a glossy, jewel-like glaze',
  stucco: 'troweled Mediterranean texture',
  'semi-naked': 'crumb showing through a whisper of cream',
  textured: 'a deep velvet crumb',
  marble: 'swirled like honed stone',
  gelato: 'soft striped bands',
  crystal: 'a crackled crystal lattice',
  'gold-drip': 'molten 24k gold',
  'velvet-matte': 'a deep, light-drinking nap',
  marzipan: 'a sweet almond crumb',
  pearl: 'an iridescent sheen',
};

function FinishTab() {
  const design = useDesign();
  const frosting = FROSTINGS.find((f) => f.id === design.frosting);
  const activeColor = design.frostingColor
    ? PALETTE.find((p) => p.id === design.frostingColor)
    : null;

  return (
    <>
      <Section
        label="Finish"
        value={frosting?.label}
        note={frosting ? `“${frosting.label}” — ${FINISH_META[frosting.id] || 'a house finish'}.` : ''}
      >
        <FinishGroup label="Atelier staples" tier="basic" />
        <FinishGroup label="Mid atelier" tier="mid" />
        <FinishGroup label="Grand atelier" tier="high" />
      </Section>

      <Section
        label="Colour"
        value={activeColor?.label || `${frosting?.label} signature`}
        note="Pick a colour to override the finish's signature shade — the model re-renders instantly."
      >
        <div className="swatch-grid">
          {PALETTE.map((p) => (
            <button
              key={p.id}
              type="button"
              className="swatch"
              style={{ background: p.hex }}
              aria-pressed={design.frostingColor === p.id}
              aria-label={p.label}
              title={p.label}
              onClick={() => patchDesign({ frostingColor: p.id }, { type: 'color', label: p.label })}
            />
          ))}
        </div>
        {design.frostingColor && (
          <button
            type="button"
            className="btn btn--ghost btn--sm btn--block"
            style={{ marginTop: 24 }}
            onClick={() => patchDesign({ frostingColor: null })}
          >
            Back to {frosting?.label} signature
          </button>
        )}
      </Section>

      <Section label="Stand" value={BOARD_STYLES.find((b) => b.id === design.board)?.label}>
        <div className="opt-grid opt-grid--4">
          {BOARD_STYLES.map((b) => (
            <button
              key={b.id}
              type="button"
              className="opt"
              aria-pressed={design.board === b.id}
              onClick={() => patchDesign({ board: b.id }, { type: 'board', label: b.label })}
            >
              <span className="opt__icon"><StandGlyph id={b.id} /></span>
              <span className="opt__name">{b.label}</span>
            </button>
          ))}
        </div>
        {design.board !== 'none' && (
          <div className="swatch-grid" style={{ marginTop: 18 }}>
            {CAKE_BOARDS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="swatch"
                style={{ background: p.hex }}
                aria-pressed={design.boardColor === p.id}
                aria-label={p.label}
                title={p.label}
                onClick={() => patchDesign({ boardColor: p.id })}
              />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

function FinishGroup({ label, tier }) {
  const design = useDesign();
  const items = FROSTINGS.filter((f) => f.tier === tier);
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="group-label">{label}</div>
      <div className="opt-grid opt-grid--3">
        {items.map((f) => (
          <button
            key={f.id}
            type="button"
            className="opt"
            aria-pressed={design.frosting === f.id}
            onClick={() => patchDesign({ frosting: f.id }, { type: 'frosting', label: f.label })}
            title={FINISH_META[f.id] || f.label}
          >
            <span className="opt__icon">
              <span
                style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: `radial-gradient(circle at 30% 26%, ${lighten(f.color, 0.55)}, ${f.color} 62%, ${darken(f.color, 0.4)})`,
                  boxShadow: 'inset 0 1px 3px rgba(255,255,255,.4), 0 3px 8px rgba(0,0,0,.4)',
                }}
              />
            </span>
            <span className="opt__name">{f.label}</span>
            <span className="opt__price">{f.premium ? 'atelier' : 'house'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function StandGlyph({ id }) {
  const s = { width: 30, height: 30 };
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' };
  if (id === 'cake') {
    return (
      <svg style={s} viewBox="0 0 30 30" {...common}>
        <ellipse cx="15" cy="17" rx="12" ry="2.6" />
        <path d="M3.6 17v2a1.6 1.6 0 0 0 1.6 1.6h19.6A1.6 1.6 0 0 0 26.4 19v-2" />
        <path d="M6 11.5h18" strokeDasharray="2 2" opacity=".6" />
      </svg>
    );
  }
  if (id === 'pedestal') {
    return (
      <svg style={s} viewBox="0 0 30 30" {...common}>
        <ellipse cx="15" cy="7" rx="11" ry="2.2" />
        <path d="M6.6 7c0 2.4 1.2 3.3 2.3 4.1 1.6 1 1.7 2.3 1.7 4.1" />
        <path d="M23.4 7c0 2.4-1.2 3.3-2.3 4.1-1.6 1-1.7 2.3-1.7 4.1" />
        <ellipse cx="15" cy="22" rx="12.4" ry="2.8" />
        <path d="M4.6 22v1.6A1.6 1.6 0 0 0 6.2 25.2h17.6a1.6 1.6 0 0 0 1.6-1.6V22" />
      </svg>
    );
  }
  if (id === 'riser') {
    return (
      <svg style={s} viewBox="0 0 30 30" {...common}>
        <path d="M4 15.5h22" />
        <path d="M6.5 15.5v6.6h17v-6.6" />
        <path d="M4.5 22.1h21" />
        <path d="M9 9h12" strokeDasharray="2 2" opacity=".6" />
      </svg>
    );
  }
  return (
    <svg style={s} viewBox="0 0 30 30" {...common}>
      <path d="M5 23.5h20" strokeDasharray="2.5 3" opacity=".55" />
      <path d="M9 12.5h12" strokeDasharray="2 2.4" opacity=".6" />
    </svg>
  );
}

const lighten = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.min(255, c + 255 * amt) | 0;
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
};
const darken = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const k = 1 - amt;
  const f = (c) => (c * k) | 0;
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

// ═════════════════════════════════════════════════════════════════
// TOPPERS TAB
// ═════════════════════════════════════════════════════════════════

const TOPPER_CATS = [
  { id: 'fresh', label: 'Fresh' },
  { id: 'chocolate', label: 'Chocolate' },
  { id: 'fruit', label: 'Fruit' },
  { id: 'sugar', label: 'Sugar' },
];

const TOPPER_GLYPH = {
  'rose-garden': '🌹', 'berry-crown': '🫐', lavender: '💜', peony: '🌺',
  orchid: '🪷', sunflower: '🌻', 'cherry-blossom': '🌸', tropical: '🌴',
  pressed: '🌼', 'gold-leaf': '✨', moss: '🌿', 'fruit-burst': '🍓',
  'choco-shards': '🍫', 'choco-drip': '🍩', 'choco-curl': '🍥', 'choco-truffle': '🍬',
  'choco-cage': '🕸', 'choco-sculpt': '🗿',
  strawberry: '🍓', blueberry: '🫐', fig: '🍈', citrus: '🍊',
  pomegranate: '🔴', 'gold-berry': '🍇',
  pearls: '⚪', 'gold-dust': '✨', ribbon: '🎀', macarons: '🥮',
  meringue: '☁', candles: '🕯', monogram: '🔡', number: '🔢',
  isomalt: '💎', 'sugar-flower': '🌹', lace: '🕊', 'royal-crown': '👑',
};

function ToppersTab() {
  const design = useDesign();
  const [cat, setCat] = useState('fresh');
  const count = design.toppers.length;
  const hasChocoDrip = design.toppers.includes('choco-drip');
  const hasGold = design.frosting === 'gold-drip';

  return (
    <>
      <div className="topper-cats" role="group" aria-label="Topper categories">
        {TOPPER_CATS.map((c) => (
          <button
            key={c.id}
            type="button"
            className="topper-cats__btn"
            aria-pressed={cat === c.id}
            onClick={() => setCat(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="topper-list">
        {TOPPERS.filter((t) => t.category === cat).map((t) => {
          const on = design.toppers.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              className="topper"
              aria-pressed={on}
              onClick={() => toggleTopper(t.id)}
              title={`${t.label} — ${CURRENCY}${t.price}`}
            >
              <span className="topper__dot">{TOPPER_GLYPH[t.id] || '✦'}</span>
              <span style={{ minWidth: 0 }}>
                <span className="topper__name">{t.label}</span>
                <span className="topper__price" style={{ display: 'block' }}>
                  +{CURRENCY}{t.price.toLocaleString('en-IN')}
                </span>
              </span>
              <span className="topper__check">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4.5 12.5 9.5 17.5 19.5 7" />
                </svg>
              </span>
            </button>
          );
        })}
      </div>
      <div className="topper-count">{count} of {MAX_TOPPERS} toppers on the cake</div>

      <Section
        label="Candles"
        value={design.candles ? `${design.candles} lit` : 'none'}
        note="Hand-dipped beeswax tapers in a ring on the top tier — each one actually lights the frosting."
      >
        <div className="slider-row">
          <input
            type="range"
            className="slider"
            min="0"
            max={MAX_CANDLES}
            step="1"
            value={design.candles}
            style={{ '--fill': `${(design.candles / MAX_CANDLES) * 100}%` }}
            onChange={(e) => setCandles(Number(e.target.value))}
            aria-label="Number of candles"
          />
          <span className="slider-val">{design.candles}</span>
        </div>
      </Section>

      <Section label="Drip" value={hasChocoDrip ? 'Chocolate' : hasGold ? 'Gold' : 'none'}>
        <div className="opt-grid opt-grid--3">
          <button
            type="button"
            className="opt"
            aria-pressed={hasChocoDrip}
            onClick={() => toggleTopper('choco-drip')}
          >
            <span className="opt__icon">
              <span className="drip-glyph" style={{ background: 'linear-gradient(160deg,#5a3a24,#3a2415)' }} />
            </span>
            <span className="opt__name">Choco drip</span>
            <span className="opt__price">+{CURRENCY}220</span>
          </button>
          <button
            type="button"
            className="opt"
            aria-pressed={hasGold}
            onClick={() => patchDesign({ frosting: hasGold ? 'buttercream' : 'gold-drip' })}
            title="Gold drip is a full-cake finish — the whole cake wears molten gold"
          >
            <span className="opt__icon">
              <span className="drip-glyph" style={{ background: 'linear-gradient(160deg,#f4dd9a,#c9a24b)' }} />
            </span>
            <span className="opt__name">Gold finish</span>
            <span className="opt__price">grand</span>
          </button>
          <button
            type="button"
            className="opt"
            aria-pressed={!hasChocoDrip && !hasGold}
            onClick={() => {
              if (hasChocoDrip) toggleTopper('choco-drip');
              if (hasGold) patchDesign({ frosting: 'buttercream' });
            }}
          >
            <span className="opt__icon">
              <span className="drip-glyph drip-glyph--none" />
            </span>
            <span className="opt__name">No drip</span>
          </button>
        </div>
      </Section>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════
// DETAILS TAB — ribbon · inscription · date · notes
// ═════════════════════════════════════════════════════════════════

function DetailsTab() {
  const design = useDesign();
  const hasRibbon = design.toppers.includes('ribbon');
  const ribbonColor = RIBBON_COLORS.find((r) => r.id === design.ribbonColor) || RIBBON_COLORS[0];
  const msgLen = (design.message || '').length;

  return (
    <>
      <Section
        label="Silk ribbon"
        value={hasRibbon ? ribbonColor.label : 'none'}
        note="A hand-tied satin sash around the base tier — the quiet signature of a commission."
      >
        <div className="opt-grid opt-grid--2" style={{ marginBottom: 14 }}>
          <button
            type="button"
            className="opt"
            aria-pressed={!hasRibbon}
            onClick={() => { if (hasRibbon) toggleTopper('ribbon'); }}
          >
            <span className="opt__icon">
              <span style={{ width: 30, height: 30, borderRadius: '50%', border: '1.5px dashed rgba(255,255,255,.3)' }} />
            </span>
            <span className="opt__name">No ribbon</span>
          </button>
          <button
            type="button"
            className="opt"
            aria-pressed={hasRibbon}
            onClick={() => { if (!hasRibbon) toggleTopper('ribbon'); }}
          >
            <span className="opt__icon">
              <span style={{
                width: 30, height: 30, borderRadius: 8,
                background: 'linear-gradient(120deg,#e8c56a,#8a6a2a)',
                boxShadow: '0 3px 8px rgba(0,0,0,.45)',
              }} />
            </span>
            <span className="opt__name">Add ribbon</span>
            <span className="opt__price">+{CURRENCY}190</span>
          </button>
        </div>
        {hasRibbon && (
          <div className="swatch-grid">
            {RIBBON_COLORS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="swatch"
                style={{ background: p.hex }}
                aria-pressed={design.ribbonColor === p.id}
                aria-label={p.label}
                title={p.label}
                onClick={() => patchDesign({ ribbonColor: p.id })}
              />
            ))}
          </div>
        )}
      </Section>

      <Section
        label="Inscription"
        value={msgLen ? 'piped' : 'none'}
        note="Hand-piped in metallic food-safe paint. Up to 28 characters."
      >
        <input
          type="text"
          className="text-input"
          maxLength={28}
          placeholder="e.g. Happy 30th, Amara"
          value={design.message || ''}
          onChange={(e) => patchDesign({ message: e.target.value })}
          aria-label="Cake inscription"
        />
        <div className="char-count">{msgLen} / 28</div>
        {msgLen > 0 && (
          <div className="swatch-grid" style={{ marginTop: 14 }}>
            {['gold', 'champagne', 'copper', 'cocoa', 'espresso', 'white', 'silver', 'blush', 'cherry', 'midnight'].map((id) => {
              const p = PALETTE.find((x) => x.id === id);
              return (
                <button
                  key={id}
                  type="button"
                  className="swatch"
                  style={{ background: p.hex }}
                  aria-pressed={design.messageColor === id}
                  aria-label={p.label}
                  title={p.label}
                  onClick={() => patchDesign({ messageColor: id })}
                />
              );
            })}
          </div>
        )}
      </Section>

      <Section
        label="Occasion date"
        value={design.occasionDate
          ? new Date(`${design.occasionDate}T12:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
          : 'not set'}
        note="Inside 48 hours the commission moves to our expedited bench (+25%)."
      >
        <input
          type="date"
          className="text-input"
          value={design.occasionDate || ''}
          onChange={(e) => patchDesign({ occasionDate: e.target.value })}
          aria-label="Occasion date"
        />
      </Section>

      <Section label="Notes for the atelier" value="optional">
        <textarea
          className="textarea-input"
          maxLength={180}
          placeholder="Allergies, a theme colour, a table size — anything we should know."
          value={design.servingsNote || ''}
          onChange={(e) => patchDesign({ servingsNote: e.target.value })}
          aria-label="Notes for the atelier"
        />
        <div className="char-count">{(design.servingsNote || '').length} / 180</div>
      </Section>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════
// SUMMARY
// ═════════════════════════════════════════════════════════════════

function Summary({
  q, design, onOrder, onRandomize, onSave, onSaved, onUndo, onReset, onPhone, savedCount,
}) {
  // Folded by default at every width. Open, the breakdown plus the six
  // action buttons is ~600px — most of a phone rail and more than half
  // a 900px desktop one, which left the tab's own controls a sliver.
  // The total and the Send button stay visible either way; the chevron
  // opens the rest.
  const [open, setOpen] = useState(false);

  return (
    <div className="summary">
      <button type="button" className="summary__head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>
          <span className="summary__label">Estimated total</span>
          <span className="summary__total">{CURRENCY}{Math.round(q.total).toLocaleString('en-IN')}</span>
        </span>
        <span
          className="summary__toggle"
          style={{ transform: open ? 'rotate(90deg)' : 'none' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 5.5 15 12l-6.5 6.5" />
          </svg>
        </span>
      </button>

      {/* The commission button is the point of the whole rail, so it
          stays out of the fold. CSS `order` puts it below the
          breakdown on desktop and directly under the total on a
          phone — the two want opposite orders. */}
      <button type="button" className="btn btn--primary btn--block summary__send" onClick={() => onOrder(q)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 7.5h14l1 13H4l1-13Z" /><path d="M8.5 10V6.6a3.5 3.5 0 0 1 7 0V10" />
        </svg>
        Send to the atelier
      </button>

      {open && (
        <div className="summary__more">
          <p className="summary__desc">{describeBrief(design, q)}</p>

          {q.expedited && (
            <div className="summary__expedited">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><circle cx="12" cy="12" r="2.4" />
              </svg>
              Expedited bench — inside 48 hours
            </div>
          )}

          <div className="summary__lines">
            {q.lines.map((l, i) => (
              <div className="summary__line" key={`${l.label}-${i}`}>
                <span>{l.label}</span>
                <span>{CURRENCY}{Math.round(l.amount).toLocaleString('en-IN')}</span>
              </div>
            ))}
            <div className="summary__line summary__line--total">
              <span>Total</span>
              <span>{CURRENCY}{Math.round(q.total).toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="summary__actions">
            <div className="summary__mini-grid">
              <button type="button" className="btn btn--ghost btn--sm" onClick={onRandomize} title="Surprise me — build a random commission">
                <Icon.dice size={14} /> Shuffle
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={onSave} title="Save this design">
                <Icon.save size={14} /> Save
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={onUndo} title="Undo the last change">
                <Icon.undo size={14} /> Undo
              </button>
            </div>

            <div className="summary__mini-grid summary__mini-grid--2">
              <button type="button" className="btn btn--ghost btn--sm" onClick={onSaved}>
                <Icon.layers size={14} /> Saved · {savedCount}
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={onPhone}>
                <Icon.phone size={14} /> Talk to us
              </button>
            </div>

            <button type="button" className="btn btn--ghost btn--sm btn--block" onClick={onReset}>
              Start a fresh canvas
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function describeBrief(design, q) {
  const parts = [];
  const size = SIZES.find((s) => s.id === design.size);
  if (size) parts.push(size.label);
  const shape = SHAPES.find((s) => s.id === design.shape);
  if (shape && shape.id !== 'round') parts.push(shape.label.toLowerCase());
  if (q.tierCount > 1) parts.push(`${q.tierCount}-tier`);
  const fl = FLAVORS.find((f) => f.id === design.flavor);
  if (fl) parts.push(fl.label.toLowerCase());
  const fr = FROSTINGS.find((f) => f.id === design.frosting);
  if (fr) parts.push(fr.label.toLowerCase());
  if (design.toppers.length) parts.push(`${design.toppers.length} topper${design.toppers.length > 1 ? 's' : ''}`);
  if (design.candles) parts.push(`${design.candles} candle${design.candles > 1 ? 's' : ''}`);
  return parts.join(' · ');
}
