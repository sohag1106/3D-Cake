// Frames the topper cluster and crops it at native 2x resolution, so the
// add-ons can actually be judged instead of squinted at inside a full frame.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:/Users/Sohag/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe';
const URL = process.argv[2] || 'http://127.0.0.1:5173/';
const OUT = 'C:/Cake/.smoke';
const PORT = 9340;
const PROFILE = join(tmpdir(), 'cake-topperzoom-profile');

mkdirSync(OUT, { recursive: true });

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
await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 850, deviceScaleFactor: 2, mobile: false });
await send('Page.navigate', { url: URL });
await sleep(7000);

const clickText = (sel, text) => `(() => {
  const els = [...document.querySelectorAll(${JSON.stringify(sel)})];
  const el = els.find(e => e.textContent.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}));
  if (!el) return 'not-found';
  el.click(); return 'ok';
})()`;
const drive = async (sel, text, wait = 700) => {
  const r = await evaluate(clickText(sel, text));
  if (r !== 'ok') console.log(`  drive miss: ${sel} "${text}"`);
  await sleep(wait);
};

await evaluate(`document.querySelector('.intro__cta .btn--primary')?.click()`);
await sleep(1500);
await drive('.size-card', '5 lb');
await drive('.segmented__btn', 'three', 1100);
await drive('.tab', 'toppers', 500);
// Flower-heavy selection so the petals, buds and stems are all in frame.
// Names come from argv (comma-separated) so the same probe can isolate one
// builder instead of always photographing the same fixed quartet.
const picks = (process.argv[3] || 'rose garden,peony,cherry blossom,pressed').split(',');
const labels = await evaluate(`[...document.querySelectorAll('.topper')].map(e => e.textContent.trim())`);
console.log('topper buttons:', JSON.stringify(labels));
for (const p of picks) {
  const n = labels.findIndex((l) => l.toLowerCase().includes(p.trim().toLowerCase()));
  if (n < 0) { console.log(`  no button matching "${p}"`); continue; }
  await evaluate(`document.querySelectorAll('.topper')[${n}].click()`);
  await sleep(450);
}

// Park the camera just above the top tier, looking down at the cluster.
// A design change kicks off a framing animation that runs for a couple of
// seconds and lands the camera back on the default hero view, so the park is
// applied twice: once to let any in-flight move finish, then again immediately
// before the capture with nothing in between that could trigger another.
const park = `(() => {
  const s = window.__studio;
  s._flight = null;
  s.controls.target.set(0, 3.05, 0);
  s.camera.position.set(0.9, 3.75, 3.1);
  s.camera.lookAt(0, 3.05, 0);
  s.controls.update();
  return {
    cam: s.camera.position.toArray().map((v) => +v.toFixed(2)),
    target: s.controls.target.toArray().map((v) => +v.toFixed(2)),
  };
})()`;

const framed = await evaluate(park);
console.log('framed (settle):', JSON.stringify(framed));
await sleep(2600);
console.log('framed (final):  ', JSON.stringify(await evaluate(park)));
await sleep(500);

const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(`${OUT}/toppers-full.png`, Buffer.from(shot.data, 'base64'));

// Crop the topper cluster out of the full frame at native pixels.
const crop = await evaluate(`(async (b64) => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
  const c = document.createElement('canvas');
  // Left 71.5% of the frame is the stage; take a generous band across it.
  const W = Math.round(img.width * 0.715), H = img.height;
  c.width = W; c.height = Math.round(H * 0.62);
  const cx = c.getContext('2d');
  cx.drawImage(img, 0, 0, W, c.height, 0, 0, W, c.height);
  return c.toDataURL('image/png');
})(${JSON.stringify(shot.data)})`);
writeFileSync(`${OUT}/toppers-crop.png`, Buffer.from(String(crop).split(',')[1], 'base64'));

console.log('wrote toppers-full.png, toppers-crop.png');
ws.close();
chrome.kill();
