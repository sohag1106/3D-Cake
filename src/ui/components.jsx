import { Icon } from './Icon.jsx';

/** One selectable option card: icon + label + price. */
export function OptionCard({ icon, label, price, selected, onSelect, title }) {
  return (
    <button
      type="button"
      className="opt"
      aria-pressed={selected}
      title={title || label}
      onClick={onSelect}
    >
      <span className="opt__icon">{icon}</span>
      <span className="opt__name">{label}</span>
      {price != null && <span className="opt__price">{price}</span>}
    </button>
  );
}

/** A circular colour swatch. */
export function Swatch({ hex, label, selected, onSelect }) {
  return (
    <button
      type="button"
      className="swatch"
      style={{ background: hex }}
      aria-pressed={selected}
      aria-label={label}
      title={label}
      onClick={onSelect}
    >
      <span className="swatch__label">{label}</span>
    </button>
  );
}

/** Segmented control. */
export function Segmented({ options, value, onChange, render }) {
  return (
    <div className="segmented" role="group">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className="segmented__btn"
          aria-pressed={value === opt.id}
          onClick={() => onChange(opt.id)}
        >
          {render ? render(opt) : opt.label}
          {opt.hint && <small>{opt.hint}</small>}
        </button>
      ))}
    </div>
  );
}

/** Section wrapper with a label, optional value readout and note. */
export function Section({ label, value, note, children }) {
  return (
    <section className="section">
      <div className="section__head">
        <h3 className="section__label">{label}</h3>
        {value && <span className="section__value">{value}</span>}
      </div>
      {children}
      {note && <p className="section__note">{note}</p>}
    </section>
  );
}

/** Icon-labelled tool button with hover tooltip. */
export function ToolButton({ icon, label, pressed, onClick }) {
  return (
    <button
      type="button"
      className="tool-btn"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {icon}
      <span className="tip">{label}</span>
    </button>
  );
}
