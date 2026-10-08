import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import Viewport, { bindFlash } from './ui/Viewport.jsx';
import Rail from './ui/Rail.jsx';
import { OrderModal, SavedDrawer, ContactModal } from './ui/Modals.jsx';
import { useDesign, randomize, saveCurrent, deleteSaved, loadSavedDesign, resetDesign, undoLast, store } from './lib/store.js';
import { quote } from './lib/pricing.js';

/**
 * Atelier Crème — the shell.
 * Left: the 3D studio. Right: the commission rail. Over both:
 * the intro, the order handoff and the toast system.
 */
export default function App() {
  const studioRef = useRef(null);
  const design = useDesign();
  const [entered, setEntered] = useState(false);
  const [modal, setModal] = useState(null); // 'order' | 'saved' | 'contact'
  const [toasts, setToasts] = useState([]);
  const [quoteResult, setQuoteResult] = useState(null);

  const q = useMemo(() => quote(design), [design]);

  // toasts — the Viewport's flash() channel lands here
  const pushToast = useCallback((message, kind = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  }, []);

  useEffect(() => { bindFlash(pushToast); }, [pushToast]);

  // Escape closes whatever is open
  useEffect(() => {
    if (!modal && entered) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (modal) setModal(null);
      else if (!entered) setEntered(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, entered]);

  // fire the little celebration when an order lands
  const celebrate = useCallback(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    confetti({
      particleCount: 90,
      spread: 70,
      startVelocity: 32,
      origin: { y: 0.72, x: 0.72 },
      colors: ['#e8c56a', '#c9a24b', '#f3e3cc', '#8a5a3b', '#ffffff'],
      disableForReducedMotion: true,
    });
  }, []);

  const openOrder = useCallback((quoted) => {
    setQuoteResult(quoted || null);
    setModal('order');
  }, []);

  const handleSave = useCallback(() => {
    const entry = saveCurrent();
    pushToast(`Saved as “${entry.name}”`);
  }, [pushToast]);

  const handleRandomize = useCallback(() => {
    randomize();
    pushToast('A surprise commission, fresh from the bench');
  }, [pushToast]);

  const handleReset = useCallback(() => {
    resetDesign();
    pushToast('Fresh canvas — back to a bare 2lb round');
  }, [pushToast]);

  const handleUndo = useCallback(() => {
    const { lastAction } = store.get();
    if (!lastAction) {
      pushToast('Nothing to undo yet', 'warn');
      return;
    }
    undoLast();
    pushToast('Undid the last change');
  }, [pushToast]);

  const handleLoadSaved = useCallback((id) => {
    const entry = loadSavedDesign(id);
    if (entry) {
      pushToast(`Loaded “${entry.name}”`);
      setModal(null);
    }
  }, [pushToast]);

  const handleDeleteSaved = useCallback((id) => {
    deleteSaved(id);
    pushToast('Removed from your atelier');
  }, [pushToast]);

  const handlePlaced = useCallback((order) => {
    pushToast(`Commission ${order.code} sent to the atelier`);
  }, [pushToast]);

  return (
    <div className="app">
      <Viewport studioRef={studioRef} onReady={() => pushToast('The studio is warm — drag to orbit')} />

      <Rail
        onOrder={openOrder}
        onRandomize={handleRandomize}
        onSave={handleSave}
        onSaved={() => setModal('saved')}
        onUndo={handleUndo}
        onReset={handleReset}
        onPhone={() => setModal('contact')}
      />

      {modal === 'order' && (
        <OrderModal
          quoteResult={quoteResult}
          onClose={() => setModal(null)}
          onPlaced={handlePlaced}
          fireConfetti={celebrate}
        />
      )}
      {modal === 'saved' && (
        <SavedDrawer
          onClose={() => setModal(null)}
          onLoad={handleLoadSaved}
          onDelete={handleDeleteSaved}
        />
      )}
      {modal === 'contact' && <ContactModal onClose={() => setModal(null)} />}

      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div className={`toast toast--${t.kind}`} key={t.id}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 12.5 9.5 17.5 19.5 7" />
            </svg>
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {!entered && <Intro onEnter={() => setEntered(true)} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Intro — the velvet rope. One click, then the studio.
// ─────────────────────────────────────────────────────────────

function Intro({ onEnter }) {
  const [leaving, setLeaving] = useState(false);

  const go = () => {
    setLeaving(true);
    setTimeout(onEnter, 620);
  };

  return (
    <div className={`intro${leaving ? ' intro--out' : ''}`}>
      <div className="intro__inner">
        <div className="intro__eyebrow">Custom Cake Atelier</div>
        <h1 className="intro__title">
          Design your cake<br /><em>in three dimensions</em>
        </h1>
        <p className="intro__sub">
          Shape it, size it, frost it, crown it. Every choice you make
          appears on the turntable the instant you make it — then
          the finished sketch goes straight to the counter.
        </p>
        <div className="intro__cta">
          <button type="button" className="btn btn--primary" onClick={go}>
            Enter the studio
          </button>
          <button type="button" className="btn btn--ghost" onClick={go}>
            Just browsing
          </button>
        </div>
        <div className="intro__foot">
          <span>18 occasions</span>
          <i />
          <span>7 shapes</span>
          <i />
          <span>34 toppings</span>
          <i />
          <span>Hand-piped inscriptions</span>
        </div>
      </div>
    </div>
  );
}
