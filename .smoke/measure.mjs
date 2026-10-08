// One-off: reports the laid-out geometry of the app shell and the tab row,
// after the intro has actually gone. Usage:
//   node .smoke/measure.mjs <url> <WxH> [more sizes...]
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:/Users/Sohag/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe';
const URL = process.argv[2] || 'http://127.0.0.1:5173/';
const PORT = 9377;
const PROFILE = join(tmpdir(), 'cake-measure-profile');

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`, '--headless=new',
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--hide-scrollbars',
  '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${PROFILE}`, 'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] });
chrome.stderr.on('data', () => {});

async function findTarget() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const page = (await r.json()).find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch { /* not up */ }
    await sleep(250);
  }
  throw new Error('Chrome never came up');
}
const target = await findTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
  }
};
const send = (method, params = {}) => new Promise((res, rej) => {
  const mid = ++id;
  pending.set(mid, { res, rej });
  ws.send(JSON.stringify({ id: mid, method, params }));
  setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); rej(new Error(`timeout ${method}`)); } }, 120000);
});
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed');
  return r.result.value;
};

await send('Runtime.enable');
await send('Page.enable');

const sizes = [];
for (const a of process.argv.slice(3)) {
  const m = a.match(/^(\d+)x(\d+)$/);
  if (m) sizes.push([+m[1], +m[2]]);
}
if (!sizes.length) sizes.push([1024, 800]);

const PROBE = () => {
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      x: Math.round(r.x), w: Math.round(r.width), right: Math.round(r.right),
      transform: cs.transform === 'none' ? null : cs.transform,
      animation: cs.animationName === 'none' ? null : `${cs.animationName} ${cs.animationDuration}`,
      opacity: cs.opacity,
    };
  };
  const vbox = (sel, host) => {
    const el = (host || document).querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return `${sel} ${Math.round(r.top)}..${Math.round(r.bottom)} h${Math.round(r.height)}`;
  };
  return {
    vw: document.documentElement.clientWidth,
    scrollW: document.documentElement.scrollWidth,
    introPresent: !!document.querySelector('.intro'),
    app: box('.app'),
    stage: box('.stage'),
    rail: box('.rail'),
    railKids: [...(document.querySelector('.rail')?.children || [])].map((c) => {
      const r = c.getBoundingClientRect();
      const n = (c.className || c.tagName).toString().trim().split(/\s+/)[0];
      const inside = [...c.querySelectorAll(':scope > *')].slice(0, 6)
        .map((k) => {
          const kr = k.getBoundingClientRect();
          const kn = (k.className || k.tagName).toString().trim().split(/\s+/)[0];
          const kcs = getComputedStyle(k);
          return `${kn} h${Math.round(kr.height)}${kcs.display === 'none' ? '(none)' : ''}`;
        }).join(' ');
      return `${n} ${Math.round(r.top)}..${Math.round(r.bottom)} h${Math.round(r.height)} { ${inside} }`;
    }),
    tabs: box('.tabs'),
    tabBoxes: [...document.querySelectorAll('.tab')].map((t) => {
      const r = t.getBoundingClientRect();
      const l = t.querySelector('.tab__label');
      const svg = t.querySelector('svg');
      const ic = svg?.getBoundingClientRect();
      const icHidden = svg ? getComputedStyle(svg).display === 'none' : null;
      const clipped = l ? l.scrollWidth > l.clientWidth + 1 : false;
      return `${t.textContent.trim()} box ${Math.round(r.width)}`
        + ` icon ${icHidden ? 'hidden' : ic ? Math.round(ic.width) : '-'}`
        + ` label ${l ? Math.round(l.clientWidth) + '/' + l.scrollWidth : '-'}${clipped ? ' CLIPPED' : ''}`;
    }),
  };
};

for (const [W, H] of sizes) {
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < 800 });
  await send('Emulation.setTouchEmulationEnabled', { enabled: W < 800, maxTouchPoints: 5 });
  await send('Page.navigate', { url: URL });
  await sleep(7000);
  await evaluate(`document.querySelector('.intro__cta .btn--primary')?.click()`);
  // wait for the intro to actually leave the DOM, not a fixed guess
  for (let i = 0; i < 40; i++) {
    if (!(await evaluate(`!!document.querySelector('.intro')`))) break;
    await sleep(250);
  }
  await sleep(1200);
  console.log(`\n── ${W}x${H} ──`);
  console.log(JSON.stringify(await evaluate(`(${PROBE.toString()})()`), null, 2));
}

ws.close();
chrome.kill();
