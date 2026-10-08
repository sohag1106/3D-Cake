// Macro shot of a single sugar flower.
//
// The tier-top view is fine for judging placement, but at that distance one
// bloom is about eighty pixels across — not enough to tell a rose from a lotus.
// This pins the design to exactly one topper (bypassing the UI entirely, so the
// shot cannot be confused by whatever the click loop did or did not select),
// then frames the camera on that topper's own world bounds.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:/Users/Sohag/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe';
const URL = process.argv[2] || 'http://127.0.0.1:5173/';
const TOPPER = process.argv[3] || 'rose-garden';
const OUT = 'C:/Cake/.smoke';
const PORT = 9351;
const PROFILE = join(tmpdir(), 'cake-bloom-profile');

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
const logs = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
    return;
  }
  if (m.method === 'Runtime.exceptionThrown') {
    logs.push('EXC ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  }
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
    logs.push(m.params.type.toUpperCase() + ' ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
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
await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 900, deviceScaleFactor: 2, mobile: false });
await send('Page.navigate', { url: URL });
await sleep(7000);

await evaluate(`document.querySelector('.intro__cta .btn--primary')?.click()`);
await sleep(1600);

const drive = async (sel, text, wait = 800) => {
  await evaluate(`(() => {
    const els = [...document.querySelectorAll(${JSON.stringify(sel)})];
    const el = els.find(e => e.textContent.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}));
    if (el) el.click();
  })()`);
  await sleep(wait);
};
await drive('.size-card', '5 lb');
await drive('.segmented__btn', 'three', 1400);

// Pin the design through the studio itself rather than through the UI, so the
// frame can only contain the flower we asked for.
const pinned = await evaluate(`(() => {
  const s = window.__studio;
  s.setTurntable(false);
  s.setDesign({ ...s.design, toppers: [${JSON.stringify(TOPPER)}], candles: 0 }, { force: true });
  return { toppers: s.design.toppers, candles: s.design.candles ?? null };
})()`);
console.log('pinned:', JSON.stringify(pinned));
await sleep(2200);

// Find the topper group by its pivot: buildTopper parents everything under a
// group parked on the tier top, scaled by TOPPER_SCALE.
const geo = await evaluate(`(() => {
  const s = window.__studio;
  const v = s.camera.position.constructor;   // Vector3 ctor borrowed off the live scene
  let best = null;
  for (const c of s.cakeRoot.children) {
    if (c.type !== 'Group') continue;
    let meshes = 0;
    c.traverse((o) => { if (o.isMesh) meshes++; });
    if (meshes > 20) best = c;
  }
  if (!best) return null;
  best.updateWorldMatrix(true, true);
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  best.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox;
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
      const w = o.localToWorld(new v(x, y, z));
      mn = [Math.min(mn[0], w.x), Math.min(mn[1], w.y), Math.min(mn[2], w.z)];
      mx = [Math.max(mx[0], w.x), Math.max(mx[1], w.y), Math.max(mx[2], w.z)];
    }
  });
  let meshes = 0;
  best.traverse((o) => { if (o.isMesh) meshes++; });
  return { meshes, min: mn, max: mx };
})()`);
if (!geo) throw new Error('no topper group found');
const size = geo.max.map((v, i) => v - geo.min[i]);
const c = geo.min.map((v, i) => v + size[i] / 2);
console.log(`topper group: meshes ${geo.meshes} size ${size.map((v) => v.toFixed(2)).join(' x ')} centre ${c.map((v) => v.toFixed(2)).join(',')}`);

// Frame the cluster. Distance is solved from the field of view rather than
// guessed from the bounding box — a fixed multiple of the cluster width puts a
// 26-degree lens far too close, which is why the first attempts cropped the
// flowers off the top of the frame. The capture is then cropped to the stage,
// so the rail beside it cannot make the framing look off-centre.
const WANT = Number(process.argv[4]) || 2.3;   // world units across the frame
const halfFov = 13 * Math.PI / 180;
const dist = (WANT / 2) / Math.tan(halfFov);
const elev = 0.55;   // ~31 degrees above the tier
const park = `(() => {
  const s = window.__studio;
  s._flight = null;
  const c = [${c.join(',')}];
  s.camera.fov = 26; s.camera.updateProjectionMatrix();
  s.controls.target.set(c[0], c[1] + ${(size[1] * 0.35).toFixed(3)}, c[2]);
  const r = ${dist.toFixed(3)};
  const d = r * Math.cos(${elev});
  s.camera.position.set(c[0] + d * 0.45, s.controls.target.y + r * Math.sin(${elev}), c[2] + d * 0.89);
  s.camera.lookAt(s.controls.target);
  s.controls.update();
  return { dist: r, cam: s.camera.position.toArray().map((v) => +v.toFixed(2)) };
})()`;
console.log('park:', JSON.stringify(await evaluate(park)));
await sleep(2600);
console.log('park (final):', JSON.stringify(await evaluate(park)));
await sleep(600);

const shot = await send('Page.captureScreenshot', { format: 'png' });
const png = Buffer.from(shot.data, 'base64');
writeFileSync(`${OUT}/bloom-${TOPPER}.png`, png);
// The commission rail owns the right ~34% of the frame; drop it so the flower
// is centred in what is actually examined.
const crop = await evaluate(`(async (b64) => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * 0.66); c.height = img.height;
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
})(${JSON.stringify(shot.data)})`);
writeFileSync(`${OUT}/bloom-${TOPPER}-crop.png`, Buffer.from(String(crop).split(',')[1], 'base64'));
console.log('console:', logs.length ? logs.slice(0, 6).join(' | ') : '(none)');
console.log(`wrote bloom-${TOPPER}.png, bloom-${TOPPER}-crop.png`);
ws.close();
chrome.kill();
