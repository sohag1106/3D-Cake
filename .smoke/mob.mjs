// Captures the app at a set of device widths so responsiveness can be judged
// from the render instead of inferred from media queries.
//
// Usage: node .smoke/mob.mjs [width,height] [more sizes...] [--after-enter]
//        each size writes mob-<w>x<h>.png and a horizontal-overflow report
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:/Users/Sohag/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe';
const URL = process.argv[2] || 'http://127.0.0.1:5173/';
const OUT = 'C:/Cake/.smoke';
const PORT = 9361;
const PROFILE = join(tmpdir(), 'cake-mob-profile');

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

// Defaults: phone, small phone, large tablet, laptop — the widths where a
// two-column studio layout actually changes behaviour.
const sizes = [];
for (const a of process.argv.slice(3)) {
  const m = a.match(/^(\d+)x(\d+)$/);
  if (m) sizes.push([+m[1], +m[2]]);
}
if (!sizes.length) sizes.push([390, 844], [360, 740], [768, 1024], [430, 932]);

/**
 * Everything a responsive bug can manifest as, measured rather than eyeballed:
 * horizontal overflow, elements wider than the viewport, anything clipped at
 * the right edge, the 3D canvas size, and whether any control ended up
 * unclickable because something else covers it.
 */
const AUDIT = () => {
  const vw = document.documentElement.clientWidth;
  const bad = [];
  const seen = new Set();
  document.querySelectorAll('body *').forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    // Off-screen to the right by more than 2px: clipped or pushing the page wide.
    if (r.right > vw + 2 && r.left < vw + 400) {
      const id = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
      if (!seen.has(id)) {
        seen.add(id);
        bad.push({ sel: id, right: Math.round(r.right), w: Math.round(r.width), txt: (el.textContent || '').trim().slice(0, 40) });
      }
    }
  });
  const doc = document.documentElement;
  const canvas = document.querySelector('canvas');
  return {
    vw,
    scrollW: doc.scrollWidth,
    overflowing: doc.scrollWidth > vw + 1,
    docH: doc.scrollHeight,
    canvas: canvas ? { w: canvas.width, h: canvas.height, cssW: Math.round(canvas.getBoundingClientRect().width), cssH: Math.round(canvas.getBoundingClientRect().height) } : null,
    clipped: bad.slice(0, 12),
    clippedTotal: bad.length,
    // Below this an input cannot hold the browser's 16px default font without
    // triggering the iOS auto-zoom on focus.
    smallInputs: [...document.querySelectorAll('input,select,textarea')].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && parseFloat(getComputedStyle(e).fontSize) < 16;
    }).map((e) => `${e.tagName.toLowerCase()}${e.type ? '[' + e.type + ']' : ''} ${parseFloat(getComputedStyle(e).fontSize)}px`),
    // Touch targets smaller than 44px (Apple) / 48px (Material).
    tinyTargets: [...document.querySelectorAll('button,a,[role="button"],.topper,.seg,.size-card,.tab')]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.height < 40 || r.width < 40);
      })
      .map((e) => {
        const r = e.getBoundingClientRect();
        return `${(e.className || e.tagName).toString().trim().slice(0, 26)} ${Math.round(r.width)}x${Math.round(r.height)}`;
      }).slice(0, 14),
    // Text that is being cut off inside its own box. This is the failure
    // the overflow check above cannot see: a flex box whose children refuse
    // to shrink does not push the page wide, it silently spills over its
    // neighbours ("DESIGN FLAVOR FINISH" reading as one run-on string) or
    // ellipsises a label. Neither moves `scrollWidth` on <html>.
    clippedText: [...document.querySelectorAll('button, a, span, h1, h2, p, label')]
      .filter((e) => {
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        if (cs.overflow === 'visible' && cs.overflowX === 'visible') return false;
        const r = e.getBoundingClientRect();
        return r.width > 0 && e.scrollWidth > e.clientWidth + 1;
      })
      .map((e) => {
        const t = (e.className || e.tagName).toString().trim().split(/\s+/).slice(0, 2).join('.');
        return `${t} ${e.clientWidth}<${e.scrollWidth} "${(e.textContent || '').trim().slice(0, 24)}"`;
      }).slice(0, 12),
    // Children wider than the flex/grid box that is meant to hold them —
    // the run-on tab row, caught by geometry rather than by scrollWidth.
    spilling: [...document.querySelectorAll('.tabs, .summary__head, .section__head, .topper, .opt')]
      .filter((e) => [...e.children].some((c) => {
        const cr = c.getBoundingClientRect();
        const er = e.getBoundingClientRect();
        return cr.width > 0 && (cr.right > er.right + 1 || cr.left < er.left - 1);
      }))
      .map((e) => (e.className || e.tagName).toString().trim().split(/\s+/)[0]).slice(0, 8),
    hasRail: !!document.querySelector('.rail'),
    railBox: (() => { const r = document.querySelector('.rail'); if (!r) return null; const b = r.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; })(),
    stageBox: (() => { const r = document.querySelector('.stage') || document.querySelector('.app'); if (!r) return null; const b = r.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; })(),
    // Elements whose scroll content exceeds their box — a scrollable region
    // with no visible affordance is a common mobile failure.
    scrollable: [...document.querySelectorAll('*')].filter((e) => {
      const cs = getComputedStyle(e);
      return (cs.overflowX === 'auto' || cs.overflowX === 'scroll') && e.scrollWidth > e.clientWidth + 4;
    }).map((e) => `${(e.className || e.tagName).toString().trim().slice(0, 30)} ${e.scrollWidth}>${e.clientWidth}`).slice(0, 8),
  };
};

for (const [W, H] of sizes) {
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: W < 800 });
  await send('Emulation.setTouchEmulationEnabled', { enabled: W < 800, maxTouchPoints: 5 });
  await send('Page.navigate', { url: URL });
  await sleep(6500);

  // Entering the studio is what lays out the rail; auditing the intro alone
  // would show an empty grid.
  await evaluate(`document.querySelector('.intro__cta .btn--primary')?.click()`);
  await sleep(1800);

  const audit = await evaluate(`(${AUDIT.toString()})()`);
  console.log(`\n── ${W}x${H} ──`);
  console.log(`  overflow-x: ${audit.overflowing ? 'YES  scrollW ' + audit.scrollW + ' > vw ' + audit.vw : 'no'}`);
  console.log(`  canvas: ${audit.canvas ? audit.canvas.cssW + 'x' + audit.canvas.cssH + ' (buf ' + audit.canvas.w + 'x' + audit.canvas.h + ')' : 'none'}`);
  console.log(`  rail: ${audit.railBox ? JSON.stringify(audit.railBox) : 'none'}   stage: ${audit.stageBox ? JSON.stringify(audit.stageBox) : 'none'}`);
  if (audit.clipped.length) {
    console.log(`  clipped/pushing (${audit.clippedTotal}):`);
    audit.clipped.forEach((c) => console.log(`     ${c.sel}  right ${c.right} w ${c.w}  "${c.txt}"`));
  } else console.log('  clipped: none');
  if (audit.smallInputs.length) console.log(`  small inputs (iOS zoom): ${audit.smallInputs.join(', ')}`);
  if (audit.clippedText.length) console.log(`  clipped text (${audit.clippedText.length}): ${audit.clippedText.join(' | ')}`);
  if (audit.spilling.length) console.log(`  children spilling their box: ${audit.spilling.join(', ')}`);
  if (audit.tinyTargets.length) console.log(`  touch targets <40px: ${audit.tinyTargets.join(' | ')}`);
  if (audit.scrollable.length) console.log(`  hidden-scroll regions: ${audit.scrollable.join(' | ')}`);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/mob-${W}x${H}.png`, Buffer.from(shot.data, 'base64'));
  console.log(`  wrote mob-${W}x${H}.png`);
}

console.log('\n=== console ===');
console.log(logs.length ? logs.slice(0, 12).join('\n') : '(none)');
ws.close();
chrome.kill();
