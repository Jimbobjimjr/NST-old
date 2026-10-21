// End-to-end checks for the danger level, the region summary and the "Right now" tab.
// Runs the page in Chromium against Code.gs running in Node. Usage: node dev/test/summary-run.js
const { chromium } = require('playwright');
const fs = require('fs');
const makeGas = require('./gas.js');
const SITE = require('path').resolve(__dirname, '../..');
const D3 = process.env.D3;
const OUT = (process.env.SHOTS || '/tmp/shots') + '/'; fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const check = (ok, what, extra) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + what + (extra !== undefined ? ' · ' + JSON.stringify(extra) : '')); };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const gas = makeGas(SITE + '/apps-script/Code.gs');
  gas.ctx.setup();
  gas.sheets.Reps.appendRow(['bracken-123', 'Sam (Bracken rep)', 'rep', 'bracken', true]);
  gas.sheets.Reps.appendRow(['lead-1', 'Brett', 'lead', 'all', true]);
  const post = o => gas.post(JSON.stringify(o));
  // Example story: Wildwrought at tier 3 in Bracken, then Bracken besieged with raiders on the south road.
  post({ action: 'saveEvent', code: 'lead-1', event: { id: 'ev-a', turn: 1, title: 'Thorns and Embers', when: 'Oct', chapter: 'bracken', visibility: 'public', order: 1, changes: [{ type: 'set', evil: 'wild', region: 'bracken', tier: 3 }] } });
  post({ action: 'saveEvent', code: 'lead-1', event: { id: 'ev-b', turn: 2, title: 'The south road burns', when: 'Nov', chapter: 'bracken', visibility: 'public', order: 2, changes: [{ type: 'status', region: 'bracken', status: 'besieged' }, { type: 'threat', tid: 't1', kind: 'other', group: 'bandits', name: 'South road raiders', tier: 1, region: 'bracken' }] } });
  check(!!post({ action: 'saveSetting', code: 'bracken-123', key: 'danger', value: {} }).error, 'a rep cannot set a danger level by hand');

  const open = async (opts) => {
    const p = await b.newPage(opts || { viewport: { width: 1360, height: 900 } });
    await p.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ path: D3, contentType: 'text/javascript' }));
    await p.route('**/fonts.g*/**', r => r.abort());
    await p.route('**/config.js', r => r.fulfill({ body: 'window.WARMAP_CONFIG={apiUrl:"https://script.google.com/macros/s/TEST/exec",pollSeconds:600}', contentType: 'text/javascript' }));
    await p.route('https://script.google.com/**', async r => {
      const req = r.request();
      const out = req.method() === 'GET' ? gas.get(Object.fromEntries(new URL(req.url()).searchParams)) : gas.post(req.postData());
      r.fulfill({ body: JSON.stringify(out), contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
    });
    p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) p.errs.push(m.text()); });
    await p.goto('file://' + SITE + '/index.html'); await sleep(1500);
    return p;
  };
  const signIn = async (p, code) => { await p.click('#who-btn'); await p.fill('#code-in', code); await p.click('#code-go'); await sleep(700); };
  const pick = async (p, id) => { await p.click('#zfit'); const bx = await p.locator(`.citygrp[data-region="${id}"]`).boundingBox(); await p.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2); await sleep(400); };
  const ring = (p, id) => p.$eval(`.citygrp[data-region="${id}"] .city-ring`, e => e.style.stroke);

  // 1. A viewer sees danger rings and Bracken's summary
  let p = await open();
  check(await ring(p, 'bracken') === 'var(--bad)', 'Bracken ring is Dire (tier 3, besieged, two threats)', await ring(p, 'bracken'));
  check(await ring(p, 'ritterstein') === 'var(--ok)', 'a quiet town is Calm', await ring(p, 'ritterstein'));
  await pick(p, 'bracken');
  const now = await p.locator('.nowbox').textContent();
  check(/Dire/.test(now) && /region besieged/.test(now) && /Wildwrought at tier 3/.test(now), 'summary says Dire and explains why', now.slice(0, 200));
  check(/since The south road burns/.test(now), 'summary says when the siege began');
  check(/The south road burns[\s\S]*Thorns and Embers/.test(now), 'latest events listed newest first');
  check(await p.locator('.dset').count() === 0, 'viewer cannot set the danger level');
  await p.screenshot({ path: OUT + 's1-region-summary.png' });
  // Stepping back in the story changes the danger
  await p.click('#tl-prev'); await sleep(900);
  check(await ring(p, 'bracken') === 'var(--peril)', 'one step back, Bracken is Perilous', await ring(p, 'bracken'));
  await p.click('#tl-next'); await sleep(900);
  // Right now tab
  await p.click('#tab-overview'); await sleep(300);
  const rows = await p.locator('.ovrow .ovname').allTextContents();
  check(rows[0] === 'Bracken' && rows.length === 11, 'Right now lists every chapter, most dangerous first', rows.slice(0, 3));
  await p.screenshot({ path: OUT + 's2-right-now.png' });
  await p.locator('.ovrow[data-goreg="bracken"]').click(); await sleep(300);
  check(await p.locator('#tab-region[aria-selected="true"]').count() === 1, 'clicking a row opens that region');
  // The layer can be turned off
  await p.click('#layers summary'); await p.click('#ly-danger'); await sleep(300);
  check(await ring(p, 'bracken') === '', 'danger layer turns off');
  await p.click('#ly-danger'); await sleep(200);
  check(p.errs.length === 0, 'no page errors for the viewer', p.errs);
  await p.close();

  // 2. The NST lead sets Ritterstein's level by hand
  p = await open(); await signIn(p, 'lead-1');
  await pick(p, 'ritterstein');
  await p.click('.dset summary');
  await p.selectOption('#dg-level', '2'); await p.fill('#dg-why', 'Sea raiders sighted off the coast'); await p.click('#dg-save'); await sleep(800);
  check(await ring(p, 'ritterstein') === 'var(--warn)', 'NST override makes Ritterstein Dangerous', await ring(p, 'ritterstein'));
  check(/set by the NST Team/.test(await p.locator('.nowbox').textContent()), 'summary says the NST set it');
  await p.screenshot({ path: OUT + 's3-override.png' });
  await p.close();

  // 3. A viewer sees the override, but only at the latest step
  p = await open();
  check(await ring(p, 'ritterstein') === 'var(--warn)', 'viewer sees the override');
  await pick(p, 'ritterstein');
  check(/Sea raiders sighted/.test(await p.locator('.nowbox').textContent()), 'viewer sees the reason');
  await p.click('#tl-first'); await sleep(900);
  check(await ring(p, 'ritterstein') === 'var(--ok)', 'override does not apply to earlier steps');
  await p.close();

  // 4. Phone layout
  p = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await p.evaluate(() => document.querySelector('#tab-overview').click()); await sleep(300);
  const w = await p.evaluate(() => document.documentElement.scrollWidth);
  check(w <= 390, 'no sideways scroll on a phone', w);
  await p.locator('#pane-overview').screenshot({ path: OUT + 's4-phone.png' });
  check(p.errs.length === 0, 'no page errors on a phone', p.errs);
  await p.close();

  await b.close();
  console.log(fails ? fails + ' failed' : 'all passed');
  process.exit(fails ? 1 : 0);
})();
