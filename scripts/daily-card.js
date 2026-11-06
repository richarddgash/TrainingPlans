// Renders the Daily Health Dashboard as a JPG card for sharing (e.g. WhatsApp).
// Usage: node scripts/daily-card.js <garmin-daily.json> <out.jpg>
// Input: JSON array of {date, steps, sleep_min, burned_kcal, eaten_kcal, water_ml}, oldest first.
// Yesterday is the last row; the tracker shows the last 8 rows.
const fs = require('fs');
const { chromium } = require('playwright');

const STEPS = 12000, SLEEP = 420, MARGIN = 200, WATER = 2000;
const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) { console.error('usage: node scripts/daily-card.js <in.json> <out.jpg>'); process.exit(1); }

const rows = JSON.parse(fs.readFileSync(inPath, 'utf8'))
  .sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-8)
  .map((d) => {
    const cal_target = d.burned_kcal - MARGIN;
    const cal_diff = d.eaten_kcal == null ? null : d.eaten_kcal - cal_target;
    return { ...d, cal_target, cal_diff,
      steps_met: d.steps >= STEPS, sleep_met: d.sleep_min >= SLEEP, water_met: d.water_ml >= WATER,
      cal_met: cal_diff != null && cal_diff <= 0 };
  });
const y = rows[rows.length - 1];

const n = (v) => Math.round(v).toLocaleString('en-GB');
const hm = (m) => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, '0')}m`;
const hmS = (m) => `${Math.floor(m / 60)}h${String(Math.round(m % 60)).padStart(2, '0')}`;
const L = (ml) => (ml / 1000).toFixed(2).replace(/0$/, '') + ' L';
const day = (s, long) => new Date(s + 'T12:00:00Z').toLocaleDateString('en-GB', long
  ? { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }
  : { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const met = [['steps', y.steps_met], ['sleep', y.sleep_met], ['calories', y.cal_met], ['hydration', y.water_met]];
const metCount = met.filter((m) => m[1]).length;
const metText = [met.some((m) => m[1]) ? 'Met: ' + met.filter((m) => m[1]).map((m) => m[0]).join(', ') + '.' : '',
  met.some((m) => !m[1]) ? 'Missed: ' + met.filter((m) => !m[1]).map((m) => m[0]).join(', ') + '.' : ''].join(' ');

const cards = [
  { c: '#4f63d8', icon: '👟', name: 'Steps', val: n(y.steps), target: `Target ${n(STEPS)}`, ratio: y.steps / STEPS, ok: y.steps_met,
    pill: y.steps_met ? `${n(y.steps - STEPS)} over target` : `${n(STEPS - y.steps)} short` },
  { c: '#8a4fd8', icon: '🌙', name: 'Sleep', val: hm(y.sleep_min), target: `Target ${hm(SLEEP)}`, ratio: y.sleep_min / SLEEP, ok: y.sleep_met,
    pill: y.sleep_met ? `${hm(y.sleep_min - SLEEP)} over target` : `${hm(SLEEP - y.sleep_min)} short` },
  { c: '#e0700f', icon: '🍽️', name: 'Calories eaten', val: y.eaten_kcal == null ? 'Not logged' : n(y.eaten_kcal),
    target: `Target ${n(y.cal_target)} (${n(y.burned_kcal)} burned, less ${MARGIN})`, ratio: (y.eaten_kcal ?? 0) / y.cal_target, ok: y.cal_met,
    pill: y.cal_diff == null ? 'No food logged' : y.cal_met ? `${n(-y.cal_diff)} under target` : `${n(y.cal_diff)} over target` },
  { c: '#0e8ea6', icon: '💧', name: 'Hydration', val: L(y.water_ml), target: `Target ${(WATER / 1000).toFixed(1)} L`, ratio: y.water_ml / WATER, ok: y.water_met,
    pill: y.water_met ? `${L(y.water_ml - WATER)} over target` : `${L(WATER - y.water_ml)} short` },
];

const tracker = [
  ['#4f63d8', '👟 Steps', (r) => (r.steps / 1000).toFixed(1) + 'k', (r) => r.steps_met],
  ['#8a4fd8', '🌙 Sleep', (r) => hmS(r.sleep_min), (r) => r.sleep_met],
  ['#e0700f', '🍽️ Calories', (r) => (r.cal_diff == null ? '–' : (r.cal_diff > 0 ? '+' : '−') + n(Math.abs(r.cal_diff))), (r) => (r.cal_diff == null ? null : r.cal_met)],
  ['#0e8ea6', '💧 Water', (r) => L(r.water_ml), (r) => r.water_met],
];
const last = rows.length - 1;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #f6f7f9; font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif, 'Noto Color Emoji'; color: #1d2230; }
  .wrap { width: 1080px; padding: 44px; display: flex; flex-direction: column; gap: 28px; }
  h1 { margin: 0; font-family: 'DejaVu Serif', serif; font-weight: 400; font-size: 46px; }
  .sub { margin: 8px 0 0; font-size: 22px; color: #5b6170; } .sub b { color: #1d2230; }
  .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .card { padding: 26px; border-radius: 16px; border: 2px solid color-mix(in srgb, var(--c) 35%, #dfe2e8);
    background: color-mix(in srgb, var(--c) 7%, #fff); display: flex; flex-direction: column; gap: 12px; }
  .card h2 { margin: 0; font-size: 24px; font-weight: 600; display: flex; align-items: center; gap: 12px; }
  .ic { width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; font-size: 24px; background: color-mix(in srgb, var(--c) 16%, transparent); }
  .val { font-family: 'DejaVu Serif', serif; font-size: 52px; color: var(--c); line-height: 1.1; }
  .tg { font-size: 18px; color: #5b6170; }
  .bar { height: 12px; border-radius: 99px; background: color-mix(in srgb, var(--c) 15%, transparent); overflow: hidden; }
  .bar i { display: block; height: 100%; border-radius: 99px; background: var(--c); }
  .pill { align-self: flex-start; padding: 4px 14px; border-radius: 99px; font-size: 18px; }
  .ok { color: #1f7a3d; background: #e1f3e6; } .bad { color: #b3261e; background: #fbe4e2; }
  .week { background: #fff; border: 2px solid #dfe2e8; border-radius: 16px; padding: 26px; }
  .week h2 { margin: 0 0 14px; font-size: 24px; font-weight: 600; }
  .grid { display: grid; grid-template-columns: 170px repeat(8, 1fr); font-size: 17px; }
  .grid > div { padding: 10px 4px; text-align: center; border-top: 1px solid #e6e8ee; }
  .grid .hd { border-top: 0; color: #5b6170; }
  .grid .rl { text-align: left; font-weight: 600; color: var(--c); }
  .grid b { display: block; font-weight: 500; color: #1d2230; }
  .grid .last { font-weight: 700; box-shadow: inset 2px 0 0 #1d2230, inset -2px 0 0 #1d2230; } .grid .last b { font-weight: 700; }
  .grid .hd.last { color: #1d2230; box-shadow: inset 2px 0 0 #1d2230, inset -2px 0 0 #1d2230, inset 0 2px 0 #1d2230; }
  .note { margin: 14px 0 0; font-size: 15px; color: #5b6170; }
</style></head><body><div class="wrap">
  <div><h1>Yesterday: ${esc(day(y.date, true))}</h1><p class="sub"><b>${metCount}</b> of 4 targets met. ${esc(metText)}</p></div>
  <div class="cards">${cards.map((k) => `<div class="card" style="--c:${k.c}">
    <h2><span class="ic">${k.icon}</span>${esc(k.name)}</h2><div class="val">${esc(k.val)}</div><div class="tg">${esc(k.target)}</div>
    <div class="bar"><i style="width:${Math.max(0, Math.min(1, k.ratio)) * 100}%"></i></div>
    <div class="pill ${k.ok ? 'ok' : 'bad'}">${k.ok ? '✓' : '✗'} ${esc(k.pill)}</div></div>`).join('')}</div>
  <div class="week"><h2>Week tracker</h2><div class="grid">
    <div class="hd"></div>${rows.map((r, i) => `<div class="hd${i === last ? ' last' : ''}">${esc(day(r.date))}</div>`).join('')}
    ${tracker.map(([c, label, fmt, ok]) => `<div class="rl" style="--c:${c}">${label}</div>` + rows.map((r, i) => {
      const v = ok(r); return `<div class="${v == null ? '' : v ? 'ok' : 'bad'}${i === last ? ' last' : ''}"><b>${esc(fmt(r))}</b>${v == null ? '&nbsp;' : v ? '✓' : '✗'}</div>`;
    }).join('')).join('')}
  </div><p class="note">Calories shows over (+) or under (−) that day's target of calories burned less ${MARGIN}; a dash means no food was logged. Sleep is dated by the morning you woke up.</p></div>
</div></body></html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 800 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.locator('.wrap').screenshot({ path: outPath, type: 'jpeg', quality: 90 });
  await browser.close();
  console.log(outPath);
})();
