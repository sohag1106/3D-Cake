import { useRef, useEffect, useState, useMemo } from 'react';
import { CakeStudio } from '../three/studio.js';
import { useDesign, useStore, patchUi, store } from '../lib/store.js';
import { quote } from '../lib/pricing.js';

/**
 * Owns the WebGL canvas and keeps it in sync with the design in the store.
 * Everything else in the app is plain DOM, so the 3D layer stays isolated.
 */
export default function Viewport({ studioRef, onReady }) {
  const canvasRef = useRef(null);
  const design = useDesign();
  const ui = useStore((s) => s.ui);
  const [booted, setBooted] = useState(false);

  // ── boot ──
  useEffect(() => {
    if (!canvasRef.current) return;
    const studio = new CakeStudio(canvasRef.current, {
      onReady: () => {
        setBooted(true);
        onReady?.();
      },
    });
    studioRef.current = studio;
    studio.setDesign(store.get().design, { force: true });
    // Dev handle so the render cost can be measured and toggled from the
    // console without a UI control for it.
    if (import.meta.env.DEV) window.__studio = studio;

    const onFirstDrag = () => {
      studio._userMovedCamera = true;
      document.getElementById('drag-hint')?.classList.add('gone');
    };
    canvasRef.current.addEventListener('pointerdown', onFirstDrag, { once: true });

    return () => {
      studio.dispose();
      studioRef.current = null;
    };
  }, []);

  // ── design → scene ──
  useEffect(() => {
    if (!studioRef.current || !booted) return;
    studioRef.current.setDesign(design);
  }, [design, booted]);

  // ── ui knobs ──
  useEffect(() => { studioRef.current?.setTurntable(ui.turntable); }, [ui.turntable]);
  useEffect(() => { studioRef.current?.setQuality(ui.quality); }, [ui.quality]);
  useEffect(() => { studioRef.current?.setBackdrop(ui.backdrop); }, [ui.backdrop]);

  const q = useMemo(() => quote(design), [design]);

  return (
    <div className="stage">
      <canvas ref={canvasRef} />

      <div className="brand">
        <div className="brand__mark">
          <span className="brand__glyph">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M5 20h14M6.5 20v-4.2c0-1.2.9-2.2 2.1-2.4V11a2 2 0 0 1 2-2h2.8a2 2 0 0 1 2 2v2.4c1.2.2 2.1 1.2 2.1 2.4V20" />
              <path d="M12 9V6.4M12 5.6c1.2-.9 1.2-2.3 0-3.6-1.2 1.3-1.2 2.7 0 3.6Z" />
              <path d="M4.5 13.6h15" />
            </svg>
          </span>
          <h1 className="brand__word">Atelier <em>Crème</em></h1>
        </div>
        <div className="brand__sub">Cake Design Studio</div>
      </div>

      <StageTools studioRef={studioRef} />
      <StageFrame studioRef={studioRef} />

      <div id="drag-hint" className="hint">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" opacity=".45" />
          <circle cx="12" cy="12" r="3.2" />
        </svg>
        Drag to orbit · scroll to zoom
      </div>

      <div className="price-bubble">
        <div className="price-bubble__label">Your cake</div>
        <div className="price-bubble__value">
          ₹{Math.round(q.total).toLocaleString('en-IN')}
        </div>
        <div className="price-bubble__meta">
          {q.tierCount > 1 ? `${q.tierCount} tiers · ` : ''}serves {q.serves}
        </div>
      </div>
    </div>
  );
}

// ── viewport toolbar ──────────────────────────────────────────────────────

const Icon = {
  spin: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4.5V10h-5.4" /></svg>,
  camera: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8.5h2.6l1.3-2h8.2l1.3 2H20a1.4 1.4 0 0 1 1.4 1.4v7.2A1.4 1.4 0 0 1 20 18.5H4a1.4 1.4 0 0 1-1.4-1.4v-7.2A1.4 1.4 0 0 1 4 8.5Z" /><circle cx="12" cy="13.4" r="3.2" /></svg>,
  reset: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9h10.5a5 5 0 0 1 0 10H8" /><path d="M7.5 5.5 4 9l3.5 3.5" /></svg>,
  full: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" /></svg>,
};

const STAGES = [
  { id: 'stage', label: 'Studio' },
  { id: 'close', label: 'Close-up' },
  { id: 'table', label: 'Table' },
  { id: 'overhead', label: 'Overhead' },
  { id: 'editorial', label: 'Editorial' },
];

function StageTools({ studioRef }) {
  const ui = useStore((s) => s.ui);
  const flash = useFlash();

  const shoot = () => {
    const url = studioRef.current?.snapshot();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `atelier-creme-${Date.now()}.png`;
    a.click();
    flash('Photographed — saved to your downloads');
  };

  const goFull = () => {
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.().catch(() => {});
  };

  return (
    <div className="stage-tools">
      <div className="toolbar">
        <ToolBtn label={ui.turntable ? 'Stop rotation' : 'Rotate cake'} pressed={ui.turntable} onClick={() => patchUi({ turntable: !ui.turntable })}>{Icon.spin}</ToolBtn>
        <ToolBtn label="Save a photo" onClick={shoot}>{Icon.camera}</ToolBtn>
        <ToolBtn label="Reset view" onClick={() => studioRef.current?.resetView()}>{Icon.reset}</ToolBtn>
        <ToolBtn label="Full screen" onClick={goFull}>{Icon.full}</ToolBtn>
      </div>
    </div>
  );
}

function ToolBtn({ label, pressed, onClick, children }) {
  return (
    <button type="button" className="tool-btn" aria-label={label} aria-pressed={pressed} onClick={onClick}>
      {children}
      <span className="tip">{label}</span>
    </button>
  );
}

function StageFrame({ studioRef }) {
  const [active, setActive] = useState('stage');
  return (
    <div className="stage-chips">
      {STAGES.map((s) => (
        <button
          key={s.id}
          type="button"
          className="chip"
          aria-pressed={active === s.id}
          onClick={() => { setActive(s.id); studioRef.current?.setStage(s.id); }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

// ── tiny toast helper shared across the viewport ──────────────────────────

let flashFn = () => {};
export function useFlash() {
  const [, force] = useState(0);
  useEffect(() => { force(1); }, []);
  return (msg) => flashFn(msg);
}
export function bindFlash(fn) { flashFn = fn; }
