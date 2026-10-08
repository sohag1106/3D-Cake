// Headless smoke test over raw Chrome DevTools Protocol.
// No npm deps: Node 26 ships a global WebSocket.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:/Users/Sohag/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe';
const URL = process.argv[2] || 'http://127.0.0.1:5173/';
const OUT = 'C:/Cake/.smoke';
const PORT = 9333;
// Chrome's profile lives OUTSIDE the project — Vite watches the project
// root and crashes (EBUSY) on Chrome's Code Cache files.
const PROFILE = join(tmpdir(), 'cake-smoke-profile');

mkdirSync(OUT, { recursive: true });

// fail loudly if the dev server isn't up
try {
  const r = await fetch(URL, { method: 'HEAD' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
} catch (e) {
  console.error(`✗ Dev server not reachable at ${URL}: ${e.message}`);
  console.error('  Start it first:  npx vite --port 5173 --strictPort');
  process.exit(2);
}

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  '--headless=new',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--enable-webgl',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  '--window-size=1600,950',
  `--user-data-dir=${PROFILE}`,
  'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] });

chrome.stderr.on('data', () => {});

async function findTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('Chrome never came up');
}

const target = await findTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pending = new Map();
const errors = [];
const warnings = [];
const logs = [];

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
    return;
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ');
    if (msg.params.type === 'error') errors.push(text);
    else if (msg.params.type === 'warning') warnings.push(text);
    else logs.push(text);
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    errors.push(`PAGEERROR: ${d.exception?.description || d.text}`);
  }
};

const send = (method, params = {}) => new Promise((res, rej) => {
  const mid = ++id;
  pending.set(mid, { res, rej });
  ws.send(JSON.stringify({ id: mid, method, params }));
  setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); rej(new Error(`timeout ${method}`)); } }, 90000);
});

const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', {
    expression: expr, returnByValue: true, awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed');
  return r.result.value;
};

const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.data, 'base64'));
};

await send('Runtime.enable');
await send('Page.enable');
await send('Log.enable');

await send('Page.navigate', { url: URL });
await sleep(6000);

const steps = [];
const step = async (name, fn) => {
  try { await fn(); steps.push(`OK   ${name}`); }
  catch (e) { steps.push(`FAIL ${name}: ${String(e.message).split('\n')[0].slice(0, 160)}`); }
};

// ── helper: click by selector + text ──────────────────────────────────────
const clickText = (sel, text) => `(() => {
  const els = [...document.querySelectorAll(${JSON.stringify(sel)})];
  const el = els.find(e => e.textContent.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}));
  if (!el) return 'not-found:' + els.length;
  el.click(); return 'ok';
})()`;

await step('intro → enter', async () => {
  const r = await evaluate(clickText('.intro__cta .btn--primary', 'enter'));
  if (r !== 'ok') throw new Error(r);
  await sleep(1200);
});

const base = await evaluate(`(() => {
  const canvas = document.querySelector('.stage canvas');
  const gl = canvas && (canvas.getContext('webgl2') || canvas.getContext('webgl'));
  return {
    canvas: !!canvas,
    size: canvas ? canvas.width + 'x' + canvas.height : null,
    contextLost: gl ? gl.isContextLost() : 'no-gl',
    rail: !!document.querySelector('.rail'),
    tabs: document.querySelectorAll('.tab').length,
    editions: document.querySelectorAll('.edition-chip').length,
    shapeCards: document.querySelectorAll('.opt-grid--3 .opt').length,
    miniPreviews: document.querySelectorAll('canvas[data-preview]').length,
    price: document.querySelector('.price-bubble__value')?.textContent,
    introGone: !document.querySelector('.intro'),
  };
})()`);

console.log('── BASE RENDER ──');
console.log(JSON.stringify(base, null, 2));

await step('shape → Heart', async () => {
  const r = await evaluate(clickText('.opt', 'heart'));
  if (r !== 'ok') throw new Error(r);
  await sleep(800);
});
await step('size → 5 lb', async () => {
  const r = await evaluate(clickText('.size-card', '5 lb'));
  if (r !== 'ok') throw new Error(r);
  await sleep(600);
});
await step('tiers → Three', async () => {
  const r = await evaluate(clickText('.segmented__btn', 'three'));
  if (r !== 'ok') throw new Error(r);
  await sleep(900);
});
await step('tab → Finish', async () => {
  const r = await evaluate(clickText('.tab', 'finish'));
  if (r !== 'ok') throw new Error(r);
  await sleep(500);
});
await step('finish → Mirror', async () => {
  const r = await evaluate(clickText('.opt', 'mirror'));
  if (r !== 'ok') throw new Error(r);
  await sleep(900);
});
await step('colour swatch #4', async () => {
  const r = await evaluate(`(() => { const s = document.querySelectorAll('.swatch-grid .swatch'); if(!s[3]) return 'none'; s[3].click(); return 'ok'; })()`);
  if (r !== 'ok') throw new Error(r);
  await sleep(900);
});
await step('stand → Pedestal', async () => {
  const r = await evaluate(clickText('.opt', 'pedestal'));
  if (r !== 'ok') throw new Error(r);
  await sleep(800);
});
await step('tab → Toppers', async () => {
  const r = await evaluate(clickText('.tab', 'toppers'));
  if (r !== 'ok') throw new Error(r);
  await sleep(500);
});
await step('add 3 toppers', async () => {
  for (const n of [0, 2, 4]) {
    const r = await evaluate(`(() => { const t = document.querySelectorAll('.topper'); if(!t[${n}]) return 'none'; t[${n}].click(); return 'ok'; })()`);
    if (r !== 'ok') throw new Error(r + ' @' + n);
    await sleep(450);
  }
});
await step('candles → 6', async () => {
  const r = await evaluate(`(() => {
    const s = document.querySelector('.slider'); if (!s) return 'none';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(s, '6');
    s.dispatchEvent(new Event('input', { bubbles: true }));
    s.dispatchEvent(new Event('change', { bubbles: true }));
    return 'ok';
  })()`);
  if (r !== 'ok') throw new Error(r);
  await sleep(800);
});
await step('tab → Details', async () => {
  const r = await evaluate(clickText('.tab', 'details'));
  if (r !== 'ok') throw new Error(r);
  await sleep(500);
});
await step('ribbon on', async () => {
  const r = await evaluate(clickText('.opt', 'add ribbon'));
  if (r !== 'ok') throw new Error(r);
  await sleep(600);
});
await step('inscription typed', async () => {
  const r = await evaluate(`(() => {
    const i = document.querySelector('input[aria-label="Cake inscription"]');
    if (!i) return 'none';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(i, 'Happy Birthday');
    i.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  })()`);
  if (r !== 'ok') throw new Error(r);
  await sleep(1000);
});

await sleep(1500);

// The summary's breakdown and its six action buttons are folded behind
// the total's chevron, so every query below that reaches into
// .summary__more — and every click on Save / Saved / Shuffle — needs the
// panel open first.
await step('open summary panel', async () => {
  const r = await evaluate(`(() => {
    const head = document.querySelector('.summary__head');
    if (!head) return 'no-head';
    if (head.getAttribute('aria-expanded') === 'true') return 'already';
    head.click(); return 'ok';
  })()`);
  if (r === 'no-head') throw new Error(r);
  await sleep(500);
});

// ── collect every report BEFORE printing, so a later failure can't
// ── swallow the earlier ones (console output is fully buffered).
const after = await evaluate(`(() => ({
  price: document.querySelector('.price-bubble__value')?.textContent,
  meta: document.querySelector('.price-bubble__meta')?.textContent,
  desc: document.querySelector('.summary__desc')?.textContent?.trim(),
  toppersOn: document.querySelectorAll('.topper[aria-pressed="true"]').length,
  total: document.querySelector('.summary__total')?.textContent?.trim(),
  lines: document.querySelectorAll('.summary__line').length,
}))()`);

// studio screenshot
await evaluate(clickText('.chip', 'close-up'));
await sleep(2200);
await shot('cake');
await evaluate(clickText('.chip', 'studio'));
await sleep(1800);
await shot('studio');

// order flow
await step('open order modal', async () => {
  const r = await evaluate(clickText('.summary .btn--primary', 'send'));
  if (r !== 'ok') throw new Error(r);
  await sleep(900);
});
const receipt = await evaluate(`(() => ({
  modal: !!document.querySelector('.modal'),
  receiptTitle: document.querySelector('.receipt__title')?.textContent?.trim(),
  receiptRows: document.querySelectorAll('.receipt__row').length,
  receiptTotal: document.querySelector('.receipt__total')?.textContent?.trim(),
}))()`);

await step('fill name', async () => {
  const r = await evaluate(`(() => {
    const i = document.querySelector('#order-name'); if (!i) return 'none';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(i, 'Amara Khan');
    i.dispatchEvent(new Event('input', { bubbles: true }));
    const p = document.querySelector('#order-phone');
    setter.call(p, '+91 98765 43210');
    p.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  })()`);
  if (r !== 'ok') throw new Error(r);
  await sleep(400);
});
await step('submit order', async () => {
  const r = await evaluate(`(() => { const b = document.querySelector('.modal button[type="submit"]'); if(!b) return 'none'; if(b.disabled) return 'disabled'; b.click(); return 'ok'; })()`);
  if (r !== 'ok') throw new Error(r);
  await sleep(2200);
});
const done = await evaluate(`(() => ({
  code: document.querySelector('.order-done__code')?.textContent,
  title: document.querySelector('.order-done__title')?.textContent,
  toasts: document.querySelectorAll('.toast').length,
  confetti: document.querySelectorAll('canvas').length,
}))()`);
await shot('order');

await step('close order', async () => {
  const r = await evaluate(clickText('.order-done__actions .btn--primary', 'back'));
  if (r !== 'ok') throw new Error(r);
  await sleep(700);
});

// saved drawer
await step('save design', async () => {
  const r = await evaluate(clickText('.summary__mini-grid .btn', 'save'));
  if (r !== 'ok') throw new Error(r);
  await sleep(700);
});
await step('open saved drawer', async () => {
  const r = await evaluate(clickText('.summary__mini-grid .btn', 'saved'));
  if (r !== 'ok') throw new Error(r);
  await sleep(900);
});
const saved = await evaluate(`(() => ({
  drawer: !!document.querySelector('.drawer'),
  cards: document.querySelectorAll('.saved-card').length,
  name: document.querySelector('.saved-card__name')?.textContent,
  desc: document.querySelector('.saved-card__desc')?.textContent,
}))()`);

// randomize
const beforeShuffle = await evaluate(`(() => ({
  desc: document.querySelector('.summary__desc')?.textContent?.trim(),
  price: document.querySelector('.price-bubble__value')?.textContent,
}))()`);

await step('close drawer', async () => {
  const r = await evaluate(`(() => { const b=document.querySelector('.drawer .modal__close, .drawer button[aria-label="Close"]'); if(!b) return 'none'; b.click(); return 'ok'; })()`);
  if (r !== 'ok') throw new Error(r);
  await sleep(800);
});
await step('shuffle', async () => {
  const r = await evaluate(clickText('.summary__mini-grid .btn', 'shuffle'));
  if (r !== 'ok') throw new Error(r);
  await sleep(2400);
});
const afterShuffle = await evaluate(`(() => ({
  desc: document.querySelector('.summary__desc')?.textContent?.trim(),
  price: document.querySelector('.price-bubble__value')?.textContent,
  changed: true,
}))()`);
afterShuffle.changed = beforeShuffle.desc !== afterShuffle.desc;
await shot('random');

await step('backdrop switch', async () => {
  for (const s of ['table', 'overhead', 'editorial', 'studio']) {
    const r = await evaluate(clickText('.chip', s));
    if (r !== 'ok') throw new Error(`${s}: ${r}`);
    await sleep(1300);
  }
});

const glow = await evaluate(`(() => {
  const c = document.querySelector('.chip--on');
  return { active: c?.textContent?.trim() || null, sparkle: !!document.querySelector('.stage__glow, .stage-glow') };
})()`);

await sleep(1000);
await shot('final');

// ── every report, printed at the very end ────────────────────────────────
console.log('\n── UI STEPS ──');
steps.forEach((s) => console.log(' ', s));
console.log('\n── AFTER DESIGNING ──');
console.log(JSON.stringify(after, null, 2));
console.log('\n── ORDER MODAL ──');
console.log(JSON.stringify(receipt, null, 2));
console.log('\n── ORDER PLACED ──');
console.log(JSON.stringify(done, null, 2));
console.log('\n── SAVED DRAWER ──');
console.log(JSON.stringify(saved, null, 2));
console.log('\n── SHUFFLE ──');
console.log('before:', JSON.stringify(beforeShuffle));
console.log('after: ', JSON.stringify(afterShuffle));
console.log('\n── STAGE ──');
console.log(JSON.stringify(glow));

console.log('\n══ ERRORS (' + errors.length + ') ══');
errors.slice(0, 30).forEach((e) => console.log(' !', e.slice(0, 400)));
console.log('\n══ WARNINGS (' + warnings.length + ') ══');
warnings.slice(0, 15).forEach((w) => console.log(' ~', w.slice(0, 240)));

ws.close();
chrome.kill();
process.exit(errors.length ? 1 : 0);
