import { useState, useEffect, useRef, useMemo } from 'react';
import { Icon } from './Icon.jsx';
import { useDesign, useStore, makeOrder } from '../lib/store.js';
import {
  SHAPES, SIZES, TIERS, FLAVORS, FILLINGS, FROSTINGS, TOPPERS,
  BOARD_STYLES, CURRENCY,
} from '../data/catalog.js';
import { quote, resolve } from '../lib/pricing.js';
import { daysUntil } from '../lib/utils.js';

// ─────────────────────────────────────────────────────────────────────
// OrderModal — the handoff to the shop keeper.
// Collects contact + delivery date, then produces a commission
// the atelier can read at the counter.
// ─────────────────────────────────────────────────────────────────────

export function OrderModal({ quoteResult, onClose, onPlaced, fireConfetti }) {
  const design = useDesign();
  const [stage, setStage] = useState('form');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState(design.occasionDate || '');
  const [notes, setNotes] = useState(design.servingsNote || '');
  const [code, setCode] = useState(null);
  const first = useRef(null);

  const computed = useMemo(() => quote(design), [design]);
  const q = quoteResult || computed;
  const days = daysUntil(date);
  const leadTime = days === Infinity ? null : days;

  useEffect(() => {
    first.current?.focus();
  }, []);

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const order = makeOrder({
      name: name.trim(),
      phone: phone.trim(),
      date: date || null,
      notes: notes.trim(),
      total: q.total,
      lines: q.lines,
    });
    setCode(order.code);
    setStage('done');
    fireConfetti?.();
    onPlaced?.(order);
  };

  const d = resolve(design);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-label="Send your design to the atelier">
      <div className="modal">
        <div className="modal__head">
          <div>
            <h3 className="modal__title">
              {stage === 'done'
                ? <>Commission <em>placed</em></>
                : <>Send to the <em>atelier</em></>}
            </h3>
            <p className="modal__sub">
              {stage === 'done'
                ? 'The counter has your design. We will call to confirm.'
                : 'Your 3D design travels with the order — exactly as you built it.'}
            </p>
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            <Icon.close size={15} />
          </button>
        </div>

        <div className="modal__body">
          {stage === 'form' ? (
            <form onSubmit={submit}>
              {/* mini receipt */}
              <div className="receipt">
                <div className="receipt__title">
                  {SIZES.find((s) => s.id === design.size)?.label}
                  {' '}{SHAPES.find((s) => s.id === design.shape)?.label}
                  {TIERS.find((t) => t.id === design.tiers)?.count > 1
                    ? ` · ${TIERS.find((t) => t.id === design.tiers)?.label}` : ''}
                </div>
                <div className="receipt__row">
                  <span>{FLAVORS.find((f) => f.id === design.flavor)?.label} sponge</span>
                  <span>{FILLINGS.find((f) => f.id === design.filling)?.label}</span>
                </div>
                <div className="receipt__row">
                  <span>{FROSTINGS.find((f) => f.id === design.frosting)?.label}</span>
                  <span>{BOARD_STYLES.find((b) => b.id === design.board)?.label}</span>
                </div>
                {design.toppers.length > 0 && (
                  <div className="receipt__row receipt__row--wrap">
                    <span>
                      {design.toppers.map((id) => TOPPERS.find((t) => t.id === id)?.label).join(', ')}
                    </span>
                  </div>
                )}
                {design.message?.trim() && (
                  <div className="receipt__row">
                    <span>“{design.message.trim()}”</span>
                    <span>piped</span>
                  </div>
                )}
                <div className="receipt__total">
                  <span>Total</span>
                  <span>{CURRENCY}{Math.round(q.total).toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="field">
                <label className="field__label" htmlFor="order-name">Your name</label>
                <input
                  id="order-name"
                  ref={first}
                  type="text"
                  className="text-input"
                  placeholder="Amara Khan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label className="field__label" htmlFor="order-phone">Phone</label>
                <input
                  id="order-phone"
                  type="tel"
                  className="text-input"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="field__row">
                <div className="field">
                  <label className="field__label" htmlFor="order-date">Occasion date</label>
                  <input
                    id="order-date"
                    type="date"
                    className="text-input"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                  {leadTime !== null && (
                    <div className="field__hint" data-warn={leadTime < 2}>
                      {leadTime < 0
                        ? 'That date has passed'
                        : leadTime === 0
                          ? 'Today — we will rush it'
                          : leadTime === 1
                            ? 'Tomorrow — expedited bench'
                            : `${leadTime} days away`}
                    </div>
                  )}
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="order-notes">Notes</label>
                  <input
                    id="order-notes"
                    type="text"
                    className="text-input"
                    placeholder="Table size, colours…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn--primary btn--block" disabled={!name.trim()}>
                Place commission · {CURRENCY}{Math.round(q.total).toLocaleString('en-IN')}
              </button>
              <p className="modal__fine">
                No payment now. The atelier confirms by phone within 2 hours, then 50% secures the bake.
              </p>
            </form>
          ) : (
            <div className="order-done">
              <div className="order-done__seal">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4.5 12.5 9.5 17.5 19.5 7" />
                </svg>
              </div>
              <h4 className="order-done__title">Thank you, {name.split(' ')[0]}.</h4>
              <p className="order-done__code">{code}</p>
              <p className="order-done__sub">
                Show this code at the counter. Your cake is sketched, priced and queued
                {leadTime !== null && leadTime >= 0 ? ` for ${leadTime === 0 ? 'today' : leadTime === 1 ? 'tomorrow' : `${leadTime} days`}` : ''}.
              </p>
              <div className="order-done__rows">
                {q.lines.slice(0, 7).map((l, i) => (
                  <div className="summary__line" key={`done-${l.label}-${i}`}>
                    <span>{l.label}</span>
                    <span>{CURRENCY}{Math.round(l.amount).toLocaleString('en-IN')}</span>
                  </div>
                ))}
                {q.lines.length > 7 && (
                  <div className="summary__line">
                    <span>…and {q.lines.length - 7} more lines</span>
                    <span />
                  </div>
                )}
                <div className="summary__line summary__line--total">
                  <span>Total</span>
                  <span>{CURRENCY}{Math.round(q.total).toLocaleString('en-IN')}</span>
                </div>
              </div>
              <div className="order-done__actions">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => {
                  const blob = new Blob([commissionText(design, q, name, phone, date, notes, code)], { type: 'text/plain' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = `${code}-commission.txt`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                }}>
                  <Icon.print size={14} /> Commission sheet
                </button>
                <button type="button" className="btn btn--primary btn--sm" onClick={onClose}>
                  Back to designing
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function commissionText(design, q, name, phone, date, notes, code) {
  const d = resolve(design);
  const bar = '─'.repeat(52);
  const rows = [
    'ATELIER CRÈME — COMMISSION',
    bar,
    `Code:        ${code}`,
    `Placed:      ${new Date().toLocaleString('en-IN')}`,
    `Client:      ${name}`,
    phone ? `Phone:       ${phone}` : null,
    date ? `Occasion:    ${date}` : null,
    '',
    'THE CAKE',
    bar,
    `Size:        ${d.size.label} (serves ${d.size.serves})`,
    `Shape:       ${d.shape.label}`,
    `Tiers:       ${d.tierDef.label}`,
    `Sponge:      ${d.flavor.label}`,
    `Filling:     ${d.filling.label}`,
    `Finish:      ${d.frosting.label}`,
    `Stand:       ${d.board.label}`,
    d.toppers.length ? `Toppers:     ${d.toppers.map((t) => t.label).join(', ')}` : null,
    design.candles ? `Candles:     ${design.candles}` : null,
    design.message?.trim() ? `Inscription: "${design.message.trim()}"` : null,
    design.servingsNote ? `Notes:       ${design.servingsNote}` : null,
    notes ? `Order notes: ${notes}` : null,
    '',
    'PRICE',
    bar,
    ...q.lines.map((l) => `${l.label.padEnd(34, ' ')} ${String(Math.round(l.amount)).padStart(8)}`),
    bar,
    `TOTAL`.padEnd(34, ' ') + ` ${String(Math.round(q.total)).padStart(8)}`,
    '',
    'Deposit 50% to confirm. Balance on collection.',
    'Atelier Crème · 14 Rosewater Lane · open Tue–Sun, 9:00–21:00',
  ].filter((r) => r !== null);
  return rows.join('\n');
}

// ─────────────────────────────────────────────────────────────────────
// SavedDrawer — the "my saved cakes" panel
// ─────────────────────────────────────────────────────────────────────

export function SavedDrawer({ onClose, onLoad, onDelete }) {
  const saved = useStore((s) => s.saved);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Saved cakes">
        <div className="drawer__head">
          <div>
            <h3 className="modal__title" style={{ fontSize: 21 }}>Saved <em>cakes</em></h3>
            <p className="modal__sub" style={{ marginTop: 3 }}>
              {saved.length ? `${saved.length} design${saved.length > 1 ? 's' : ''} in your atelier` : 'Nothing saved yet'}
            </p>
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            <Icon.close size={15} />
          </button>
        </div>
        <div className="drawer__body">
          {saved.length === 0 ? (
            <div className="empty">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5.5 3.5h10.2L20.5 8.3V19a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 19V5a1.5 1.5 0 0 1 1.5-1.5Z" /><path d="M8 3.5v6h7v-6M8 20.5v-6h8v6" />
              </svg>
              <div>
                Design something beautiful, then press <b>Save</b>.
                <br />It will wait here, ready to pick up where you left off.
              </div>
            </div>
          ) : (
            saved.map((entry) => (
              <SavedCard
                key={entry.id}
                entry={entry}
                onLoad={() => onLoad(entry.id)}
                onDelete={() => onDelete(entry.id)}
              />
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

function SavedCard({ entry, onLoad, onDelete }) {
  const q = useMemo(() => quote(entry.design), [entry]);
  return (
    <div className="saved-card">
      <div className="saved-card__name">{entry.name}</div>
      <div className="saved-card__desc">{describeBrief(entry.design, q)}</div>
      <div className="saved-card__meta">
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--gold-2)' }}>
          {CURRENCY}{Math.round(q.total).toLocaleString('en-IN')}
        </span>
        <span className="saved-card__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onLoad}>
            <Icon.arrow size={13} /> Open
          </button>
          <button type="button" className="btn btn--ghost btn--sm btn--danger" onClick={onDelete} aria-label={`Delete ${entry.name}`}>
            <Icon.trash size={13} />
          </button>
        </span>
      </div>
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
  return parts.join(' · ');
}

// ─────────────────────────────────────────────────────────────────────
// ContactModal — talk to the shop keeper
// ─────────────────────────────────────────────────────────────────────

export function ContactModal({ onClose }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-label="Talk to the atelier">
      <div className="modal">
        <div className="modal__head">
          <div>
            <h3 className="modal__title">Talk to the <em>atelier</em></h3>
            <p className="modal__sub">Real bakers, real questions. We reply within two hours.</p>
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            <Icon.close size={15} />
          </button>
        </div>
        <div className="modal__body">
          <div className="contact-grid">
            <a className="contact-card" href="tel:+919876543210">
              <span className="contact-card__icon"><Icon.phone size={18} /></span>
              <span>
                <b>Call the counter</b>
                <small>+91 98765 43210 · Tue–Sun, 9:00–21:00</small>
              </span>
            </a>
            <a className="contact-card" href="sms:+919876543210">
              <span className="contact-card__icon"><Icon.bag size={18} /></span>
              <span>
                <b>WhatsApp</b>
                <small>Send a photo of your sketch</small>
              </span>
            </a>
            <a className="contact-card" href="mailto:hello@ateliercreme.example">
              <span className="contact-card__icon"><Icon.sparkle size={18} /></span>
              <span>
                <b>Email</b>
                <small>hello@ateliercreme.example</small>
              </span>
            </a>
            <div className="contact-card">
              <span className="contact-card__icon"><Icon.calendar size={18} /></span>
              <span>
                <b>Visit the studio</b>
                <small>14 Rosewater Lane, Bandra West</small>
              </span>
            </div>
          </div>
          <p className="modal__fine">
            Bring a photo, a colour swatch, or just an idea. We sketch it with you before
            anything is baked.
          </p>
        </div>
      </div>
    </div>
  );
}
