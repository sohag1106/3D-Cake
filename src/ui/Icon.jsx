// Line-art icon set — hand-drawn to match the atelier typography.
const S = ({ children, size = 20, stroke = 1.5, ...rest }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" {...rest}
  >
    {children}
  </svg>
);

export const Icon = {
  spark: (p) => <S {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M17.7 6.3l-2.8 2.8M9.1 14.9l-2.8 2.8"/><circle cx="12" cy="12" r="2.4"/></S>,
  shape: (p) => <S {...p}><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17"/></S>,
  layers: (p) => <S {...p}><path d="M12 3l8 4.2-8 4.2-8-4.2L12 3Z"/><path d="M4 12.2l8 4.2 8-4.2"/><path d="M4 16.6l8 4.2 8-4.2"/></S>,
  whisk: (p) => <S {...p}><path d="M12 3v6"/><path d="M7.5 9c0 4.5 1.4 8 4.5 12 3.1-4 4.5-7.5 4.5-12"/><path d="M7.5 9h9"/><path d="M9.5 9c0 3.6.8 6.4 2.5 9.4M14.5 9c0 3.6-.8 6.4-2.5 9.4"/></S>,
  drop: (p) => <S {...p}><path d="M12 3.5s6 6.6 6 10.6a6 6 0 0 1-12 0c0-4 6-10.6 6-10.6Z"/></S>,
  flower: (p) => <S {...p}><circle cx="12" cy="12" r="2.6"/><path d="M12 9.4c0-2.6-.8-5.4-2.4-5.4S7.6 6.6 9.6 9.9M14.4 9.9c2.4-3.3 3.2-6 1.6-6-1.6 0-2.4 2.8-2.4 5.4M14.4 14.1c2.4 3.3 3.2 6 1.6 6-1.6 0-2.4-2.8-2.4-5.4M9.6 14.1c-2.4 3.3-3.2 6-1.6 6 1.6 0 2.4-2.8 2.4-5.4"/></S>,
  palette: (p) => <S {...p}><path d="M12 21a9 9 0 1 1 9-9c0 2.2-1.8 3.4-3.6 3.4h-1.6a2 2 0 0 0-1.4 3.4A1.9 1.9 0 0 1 12 21Z"/><circle cx="7.6" cy="12.2" r="1.1" fill="currentColor" stroke="none"/><circle cx="9.8" cy="8.2" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.4" cy="7.6" r="1.1" fill="currentColor" stroke="none"/></S>,
  candle: (p) => <S {...p}><rect x="9" y="10" width="6" height="10" rx="1.2"/><path d="M12 10V8"/><path d="M12 7.6c1.4-1 1.4-2.6 0-4.1-1.4 1.5-1.4 3.1 0 4.1Z"/></S>,
  text: (p) => <S {...p}><path d="M5 6.5h14M12 6.5V19M9 19h6"/></S>,
  gift: (p) => <S {...p}><rect x="3.5" y="8.5" width="17" height="11" rx="1.6"/><path d="M3.5 12.5h17M12 8.5V19.5"/><path d="M12 8.5S10.4 4 8.2 4a1.9 1.9 0 0 0 0 4.5M12 8.5S13.6 4 15.8 4a1.9 1.9 0 0 1 0 4.5"/></S>,
  ball: (p) => <S {...p}><path d="M12 3a5.2 5.2 0 0 0-3.6 9 5.2 5.2 0 0 0 7.2 0A5.2 5.2 0 0 0 12 3Z"/><path d="M12 17v3.5"/></S>,
  sparkle: (p) => <S {...p}><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9L12 3.5Z"/><path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z"/></S>,
  camera: (p) => <S {...p}><path d="M4 8.5h2.6l1.3-2h8.2l1.3 2H20a1.4 1.4 0 0 1 1.4 1.4v7.2A1.4 1.4 0 0 1 20 18.5H4a1.4 1.4 0 0 1-1.4-1.4v-7.2A1.4 1.4 0 0 1 4 8.5Z"/><circle cx="12" cy="13.4" r="3.2"/></S>,
  rotate: (p) => <S {...p}><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4.5V10h-5.4"/></S>,
  eye: (p) => <S {...p}><path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></S>,
  dice: (p) => <S {...p}><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="9" cy="15" r="1.2" fill="currentColor" stroke="none"/></S>,
  save: (p) => <S {...p}><path d="M5.5 3.5h10.2L20.5 8.3V19a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 19V5a1.5 1.5 0 0 1 1.5-1.5Z"/><path d="M8 3.5v6h7v-6M8 20.5v-6h8v6"/></S>,
  undo: (p) => <S {...p}><path d="M4 9h10.5a5 5 0 0 1 0 10H8"/><path d="M7.5 5.5 4 9l3.5 3.5"/></S>,
  trash: (p) => <S {...p}><path d="M4.5 6.5h15M9.5 6.5V4.8A1.2 1.2 0 0 1 10.7 3.6h2.6a1.2 1.2 0 0 1 1.2 1.2v1.7"/><path d="M6.5 6.5 7.6 20a1.4 1.4 0 0 0 1.4 1.3h6a1.4 1.4 0 0 0 1.4-1.3l1.1-13.5"/></S>,
  check: (p) => <S {...p}><path d="M4.5 12.5 9.5 17.5 19.5 7"/></S>,
  close: (p) => <S {...p}><path d="M6 6l12 12M18 6 6 18"/></S>,
  chevron: (p) => <S {...p}><path d="M8.5 5.5 15 12l-6.5 6.5"/></S>,
  plus: (p) => <S {...p}><path d="M12 5v14M5 12h14"/></S>,
  minus: (p) => <S {...p}><path d="M5 12h14"/></S>,
  lock: (p) => <S {...p}><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/></S>,
  bag: (p) => <S {...p}><path d="M5 7.5h14l1 13H4l1-13Z"/><path d="M8.5 10V6.6a3.5 3.5 0 0 1 7 0V10"/></S>,
  phone: (p) => <S {...p}><path d="M6.2 3.5h3l1.4 3.6-1.8 1.3a11 11 0 0 0 5.8 5.8l1.3-1.8 3.6 1.4v3a1.6 1.6 0 0 1-1.8 1.6C11.4 17.6 6.4 12.6 4.6 5.3A1.6 1.6 0 0 1 6.2 3.5Z"/></S>,
  calendar: (p) => <S {...p}><rect x="3.5" y="5.5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3.5v4M16 3.5v4"/></S>,
  cap: (p) => <S {...p}><path d="M2.5 9 12 4.5 21.5 9 12 13.5 2.5 9Z"/><path d="M6.5 11v4.6c0 1.3 2.5 2.4 5.5 2.4s5.5-1.1 5.5-2.4V11"/></S>,
  heart: (p) => <S {...p}><path d="M12 20s-7.5-4.7-7.5-10A4.5 4.5 0 0 1 12 7.2 4.5 4.5 0 0 1 19.5 10c0 5.3-7.5 10-7.5 10Z"/></S>,
  rings: (p) => <S {...p}><circle cx="9.2" cy="14" r="5.2"/><circle cx="14.8" cy="14" r="5.2"/><path d="M12 4.4l1.6 2.4h-3.2L12 4.4Z"/></S>,
  star: (p) => <S {...p}><path d="M12 3.5l2.6 5.6 6.1.8-4.5 4.2 1.2 6.1L12 17.3l-5.4 2.9 1.2-6.1L3.3 9.9l6.1-.8L12 3.5Z"/></S>,
  tree: (p) => <S {...p}><path d="M12 3.5 6.5 11h11L12 3.5Z"/><path d="M12 8.5 5.5 16h13L12 8.5Z"/><path d="M12 16v4.5"/></S>,
  bat: (p) => <S {...p}><path d="M12 5.5c1.6 0 2.4 1.2 2.4 2.6 0 1.2-.6 2-1.2 2.6 2.6-.7 4.6-2.6 8.3-2.2-1.4 1.5-1.9 3.2-1.6 5.2-.9-.6-1.8-.7-2.7-.3.3 1.6 0 3-1 4.3-1.2-1.5-2.6-2.3-4.2-2.3s-3 .8-4.2 2.3c-1-1.3-1.3-2.7-1-4.3-.9-.4-1.8-.3-2.7.3.3-2-.2-3.7-1.6-5.2 3.7-.4 5.7 1.5 8.3 2.2-.6-.6-1.2-1.4-1.2-2.6 0-1.4.8-2.6 2.4-2.6Z"/></S>,
  baby: (p) => <S {...p}><circle cx="12" cy="8" r="5"/><path d="M9.5 7.2h.01M14.5 7.2h.01"/><path d="M10 10.2c1.2.9 2.8.9 4 0"/><path d="M6.5 21v-3.5A3.5 3.5 0 0 1 10 14h4a3.5 3.5 0 0 1 3.5 3.5V21"/></S>,
  leaf: (p) => <S {...p}><path d="M20 4c-8 0-13 3.6-13 9a6 6 0 0 0 1.8 4.3C12.4 13.6 16 11 20 10.2 20 8 20 6 20 4Z"/><path d="M8.8 17.3C6.6 17.9 5 19.4 4 21.5"/></S>,
  balloon: (p) => <S {...p}><path d="M12 3.5a5.5 5.5 0 0 0-5.5 5.5c0 3.4 3 6.4 5.5 8.4 2.5-2 5.5-5 5.5-8.4A5.5 5.5 0 0 0 12 3.5Z"/><path d="M12 17.4v3M10.4 20.4h3.2"/></S>,
  sliders: (p) => <S {...p}><path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h9M17 17h3"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="15" cy="17" r="2"/></S>,
  layers2: (p) => <S {...p}><rect x="3.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.4"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.4"/></S>,
  grid: (p) => <S {...p}><path d="M4 9.5h16M4 15h16M9.5 4v16M15 4v16"/></S>,
  info: (p) => <S {...p}><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8h.01"/></S>,
  arrow: (p) => <S {...p}><path d="M4.5 12h15M13.5 6l6 6-6 6"/></S>,
  print: (p) => <S {...p}><path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="1.6"/><path d="M7 14h10v6.5H7z"/></S>,
};

/** Edition icon names map onto the drawn set. */
export const EDITION_ICON = {
  balloon: 'balloon', rings: 'rings', heart: 'heart', cap: 'cap', baby: 'baby',
  star: 'star', tree: 'tree', bat: 'bat', leaf: 'leaf', spark: 'sparkle',
};
