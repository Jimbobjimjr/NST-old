// End-to-end checks for full screen, story details, the map notice, the lead tier, pinpoints and region conditions.
// Runs the page in Chromium against Code.gs running in Node. Usage: node dev/test/features-run.js
const { chromium } = require('playwright');
const fs = require('fs');
const makeGas = require('./gas.js');
const SITE = require('path').resolve(__dirname, '../..');
const D3 = process.env.D3 || 'd3-delaunay.min.js';
const OUT = (process.env.SHOTS || 'shots') + '/'; fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const check = (ok, what, extra) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + what + (extra !== undefined ? ' · ' + JSON.stringify(extra) : '')); };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const gas = makeGas(SITE + '/apps-script/Code.gs');
  gas.ctx.setup();
  gas.sheets.Reps.appendRow(['bracken-123', 'Sam (Bracken rep)', 'rep', 'bracken', true]);
  gas.sheets.Reps.appendRow(['story-br', 'Kit (Bracken story)', 'story', 'bracken', true]);
  gas.sheets.Reps.appendRow(['lead-1', 'Brett', 'lead', 'all', true]);
  const open = async (opts, url) => {
    const p = await b.newPage(opts);
    await p.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ path: D3, contentType: 'text/javascript' }));
    await p.route('**/fonts.g*/**', r => r.abort());
    await p.route('**/config.js', r => r.fulfill({ body: 'window.WARMAP_CONFIG={apiUrl:"https://script.google.com/macros/s/TEST/exec",pollSeconds:600}', contentType: 'text/javascript' }));
    await p.route('https://script.google.com/**', async r => {
      const req = r.request();
      const out = req.method() === 'GET' ? gas.get(Object.fromEntries(new URL(req.url()).searchParams)) : gas.post(req.postData());
      r.fulfill({ body: JSON.stringify(out), contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
    });
    p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) p.errs.push(m.text()); });
    await p.goto('file://' + SITE + '/index.html' + (url || '')); await sleep(1200);
    return p;
  };
  const signIn = async (p, code) => { await p.click('#who-btn'); await p.fill('#code-in', code); await p.click('#code-go'); await sleep(600); };
  const signOut = async p => { await p.click('#who-btn'); await p.click('#sign-out'); await sleep(500); };
  const tap = async (p, sel) => { const l = p.locator(sel).first(); await l.dispatchEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }); await l.dispatchEvent('pointerup', { pointerId: 1 }); await sleep(250); };
  const site = 'bracken-fort-blackridge';
  const center = async (p, id) => { const bx = await p.locator(`.citygrp[data-region="${id}"]`).boundingBox(); return [bx.x + bx.width / 2, bx.y + bx.height / 2]; };
  const openReg = async (p, id) => { await p.click('#zfit'); const [x, y] = await center(p, id); await p.mouse.dblclick(x, y); await sleep(1100); };
  const pickReg = async (p, id) => { await p.click('#zfit'); const [x, y] = await center(p, id); await p.mouse.click(x, y); await sleep(300); };

  // 1. Full screen and zoom for a viewer
  let p = await open({ viewport: { width: 1280, height: 860 } });
  await p.click('#fs'); await sleep(400);
  const fsBox = await p.locator('#mapwrap').boundingBox();
  check(await p.locator('#mapwrap.fs').count() === 1 && fsBox.width >= 1270 && fsBox.height >= 850, 'full screen fills the window', fsBox);
  const vb0 = await p.getAttribute('#map', 'viewBox'); await p.click('#zin'); await sleep(100);
  check(vb0 !== await p.getAttribute('#map', 'viewBox'), 'zoom works in full screen');
  await p.screenshot({ path: OUT + 'f1-fullscreen.png' });
  await p.click('#fs'); await sleep(300);
  check(await p.locator('#mapwrap.fs').count() === 0, 'full screen exits');
  await openReg(p, 'bracken');
  check(await p.locator('#rview:not([hidden])').count() === 1, 'region map opens');
  check(await p.locator('#rv-notice:not([hidden])').count() === 1, 'region map shows the being-updated notice', await p.locator('#rv-notice').textContent());
  await p.click('#rz-fs'); await sleep(300);
  check(await p.locator('#mapwrap.fs #rview:not([hidden])').count() === 1, 'region map goes full screen');
  // Esc in a real browser ends native full screen, which fires fullscreenchange
  await p.evaluate(() => document.fullscreenElement ? document.exitFullscreen() : null); await sleep(300);
  check(await p.locator('#mapwrap.fs').count() === 0, 'leaving native full screen restores the page');

  // 2. Story team code adds details to a place, but can't change the story
  await signIn(p, 'story-br');
  await tap(p, `.site[data-site="${site}"]`);
  check(await p.locator('#se-details').count() === 1, 'story team sees the details editor');
  check(await p.locator('[data-step]').count() === 0, 'story team gets no tier steppers');
  await p.fill('#se-note', 'Charred palisade; the gate still holds.'); await p.fill('#se-story', 'The raiders are paid by someone inside the fort.');
  await p.click('#se-details'); await sleep(600);
  const srow = gas.sheets.Sites.rows.find(r => r[0] === site), shead = gas.sheets.Sites.rows[0];
  check(srow && srow[shead.indexOf('note')] === 'Charred palisade; the gate still holds.' && srow[shead.indexOf('story')].startsWith('The raiders'), 'story details saved to the Sites tab', shead);
  check(srow[shead.indexOf('x')] === '', 'saving details does not move the place');
  const pub = gas.get({}).sites.find(s => s.id === site);
  check(pub.note && pub.story === undefined && pub.x === undefined, 'players get the details but not the story notes', pub);
  const story1 = gas.post(JSON.stringify({ action: 'saveSite', code: 'story-br', site: { id: site, region: 'bracken', name: 'Renamed', note: 'x' } }));
  check(story1.ok && gas.get({}).sites.find(s => s.id === site).name === '', 'story code cannot rename a place', story1);
  const story2 = gas.post(JSON.stringify({ action: 'saveSite', code: 'story-br', site: { id: 'braylong-velaris', region: 'braylong', note: 'x' } }));
  const story3 = gas.post(JSON.stringify({ action: 'saveEvent', code: 'story-br', event: { title: 'x', chapter: 'bracken', changes: [] } }));
  check(!story2.ok && !story3.ok, 'story code refused outside its chapter and for events', [story2.error, story3.error]);
  // restore the details the rename test overwrote
  gas.post(JSON.stringify({ action: 'saveSite', code: 'story-br', site: { id: site, region: 'bracken', note: 'Charred palisade; the gate still holds.' } }));
  await signOut(p);

  // 3. A rep pinpoints a moment and marks the region besieged
  await signIn(p, 'bracken-123');
  await p.locator('#tab-region').click(); await sleep(200);
  await p.click('[data-addmark=""]'); await sleep(300);
  check(await p.locator('#rv-hint:not([hidden])').textContent().then(t => /place the pinpoint/.test(t)), 'placing mode shows a hint');
  const rb = await p.locator('#rmap').boundingBox();
  await p.mouse.click(rb.x + rb.width * .3, rb.y + rb.height * .4); await sleep(400);
  check(await p.locator('input[data-f="label"]').count() === 1, 'clicking the map starts a pinpoint draft');
  await p.fill('input[data-f="label"]', 'The burned chapel');
  await p.selectOption('select[data-f="icon"]', 'loss'); await sleep(150);
  await p.fill('input[data-ci="0"][data-f="note"]', 'Found ash and a broken bell.');
  await p.locator('#tab-region').click(); await sleep(200);
  await p.selectOption('#st-sel', 'besieged'); await sleep(200);
  await p.locator('#tab-log').click(); await sleep(200);
  await p.fill('#d-title', 'The bell falls silent');
  await p.click('#d-save'); await sleep(800);
  const hd = gas.sheets.Events.rows[0], evs = gas.sheets.Events.rows.slice(1).map(r => ({ title: r[hd.indexOf('title')], changes: JSON.parse(r[hd.indexOf('changes')]) }));
  const ev = evs.find(e => e.title === 'The bell falls silent');
  const mk = ev && ev.changes.find(c => c.type === 'mark');
  check(mk && mk.label === 'The burned chapel' && mk.icon === 'loss' && mk.x > .2 && mk.x < .4 && mk.site === undefined, 'pinpoint saved with its spot', mk);
  check(ev.changes.some(c => c.type === 'status' && c.status === 'besieged'), 'besieged saved');
  check(await p.locator('#rmap .mk').count() === 1, 'pinpoint drawn on the region map');
  check(await p.locator('#rmap text.rv-stamp.besieged').count() === 1, 'besieged stamp on the region map');
  const mkb = await p.locator('#rmap .mk').boundingBox();
  await p.mouse.move(mkb.x + mkb.width / 2, mkb.y + mkb.height / 3); await sleep(250);
  const tipText = await p.locator('#tip').textContent();
  check(/The burned chapel/.test(tipText) && /Last change: The bell falls silent/.test(tipText), 'hovering the pinpoint shows its details', tipText);
  await p.screenshot({ path: OUT + 'f2-besieged-pin.png' });
  // pinpoint at a site
  await tap(p, `.site[data-site="${site}"]`);
  await p.locator('#tab-region').click(); await sleep(150);
  await p.click(`[data-addmark="${site}"]`); await sleep(300);
  await p.fill('input[data-f="label"]', 'Raider camp'); await p.selectOption('select[data-f="icon"]', 'flag');
  await p.fill('#d-title', 'Raiders dig in'); await p.click('#d-save'); await sleep(800);
  check(await p.locator('#rmap .mk').count() === 2, 'second pinpoint at a site');
  const ren = gas.post(JSON.stringify({ action: 'saveSite', code: 'bracken-123', site: { id: site, region: 'bracken', name: 'Fort Ashridge' } }));
  check(!ren.ok && /Lead/.test(ren.error), 'reps cannot rename the map\'s own places', ren.error);
  const own = gas.post(JSON.stringify({ action: 'saveSite', code: 'bracken-123', site: { id: 'bracken-c-hut-abcd', region: 'bracken', name: 'Old hut', x: .5, y: .5 } }));
  const own2 = gas.post(JSON.stringify({ action: 'saveSite', code: 'bracken-123', site: { id: 'bracken-c-hut-abcd', region: 'bracken', name: 'Older hut' } }));
  check(own.ok && own2.ok, 'reps can still name places they add');
  // main map: hover a token for details
  await p.click('#rv-back'); await sleep(700);
  const tok = p.locator('.tok[data-region="wastes"]');
  const tb = await tok.boundingBox(); await p.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2); await sleep(250);
  check(/Fielded/.test(await p.locator('#tip').textContent()) && /Last change: Opening positions/.test(await p.locator('#tip').textContent()), 'hovering a token shows tier details and its last change');
  check(await p.locator('#map .mk[data-region="bracken"]').count() === 2, 'pinpoints show on the main map');
  check(await p.locator('#map path[fill="url(#hatch-siege)"]').count() >= 1, 'besieged region hatched on the main map');
  await p.screenshot({ path: OUT + 'f3-main-besieged.png' });
  check(await p.locator('#mn-save').count() === 0 && await p.locator('#ld-save').count() === 0, 'reps get no notice or naming controls');
  await signOut(p);

  // 4. The NST lead renames a place, renames a site, turns off a notice and records a fall
  await signIn(p, 'lead-1');
  await pickReg(p, 'northpass');
  await p.locator('#tab-region').click(); await sleep(150);
  await p.fill('#ld-name', 'The Northern Pass'); await p.click('#ld-save'); await sleep(700);
  const reg = gas.sheets.Settings.rows.find(r => r[0] === 'regions');
  check(reg && JSON.parse(reg[1]).northpass.name === 'The Northern Pass', 'lead renamed the North Pass in the sheet', reg && reg[1]);
  const labels = await p.locator('.citygrp[data-region="northpass"] text').allTextContents();
  check(labels.includes('The Northern Pass'), 'new name shows on the map', labels);
  const repTry = gas.post(JSON.stringify({ action: 'saveSetting', code: 'bracken-123', key: 'regions', value: {} }));
  check(!repTry.ok, 'only the lead can rename regions', repTry.error);
  // site rename by the lead
  await openReg(p, 'bracken');
  await p.click('#site-edit'); await sleep(200);
  await tap(p, `.site[data-site="${site}"]`);
  await p.fill('#se-name', 'Fort Ashridge'); await p.click('#se-save'); await sleep(700);
  check(gas.get({}).sites.find(s => s.id === site).name === 'Fort Ashridge', 'lead renamed a built-in place');
  check(gas.get({}).sites.find(s => s.id === site).note === 'Charred palisade; the gate still holds.', 'renaming kept the story details');
  await p.click('#site-edit'); await sleep(150);
  await p.uncheck('#mn-show'); await p.click('#mn-save'); await sleep(700);
  check(await p.locator('#rv-notice[hidden]').count() === 1, 'notice turned off for Bracken');
  const notice = JSON.parse(gas.sheets.Settings.rows.find(r => r[0] === 'notice')[1]);
  check(notice.done.includes('bracken') && notice.text, 'notice setting saved', notice);
  await p.click('#rv-back'); await sleep(600);
  await pickReg(p, 'kreigstor'); await p.locator('#tab-region').click(); await sleep(150);
  await p.selectOption('#st-sel', 'fallen'); await sleep(200);
  await p.locator('#tab-log').click(); await sleep(150);
  await p.fill('#d-title', 'Kriegstor burns again'); await p.selectOption('#d-vis', 'public'); await p.click('#d-save'); await sleep(800);
  check(await p.locator('#map path.blackout').count() >= 1, 'fallen region blacked out on the main map');
  await p.screenshot({ path: OUT + 'f4-main-fallen.png' });
  check(p.errs.length === 0, 'no page errors', p.errs);
  await p.close();

  // 5. A player sees the result on a phone, in dark mode
  p = await open({ viewport: { width: 400, height: 860 }, colorScheme: 'dark', hasTouch: true }, '?region=kreigstor');
  check(await p.locator('#rmap text.rv-stamp.fallen').count() === 1, 'fallen stamp on the region map for players');
  check(await p.locator('#rv-notice:not([hidden])').count() === 1, 'notice still shows on Kriegstor');
  await p.screenshot({ path: OUT + 'f5-phone-fallen.png', fullPage: true });
  await p.click('#rz-fs'); await sleep(300);
  const pb = await p.locator('#mapwrap').boundingBox();
  check(pb.height >= 850, 'phone full screen fills the screen', pb);
  await p.screenshot({ path: OUT + 'f6-phone-fs.png' });
  check(p.errs.length === 0, 'no page errors on the phone', p.errs);
  await p.close();

  // 6. Pinch zoom on the region map
  p = await open({ viewport: { width: 900, height: 820 }, hasTouch: true }, '?region=bracken');
  const before = await p.getAttribute('#rmap', 'viewBox');
  const box = await p.locator('#rmap').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await p.evaluate(({ cx, cy }) => {
    const s = document.querySelector('#rmap'), ev = (type, id, x) => s.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: id, clientX: x, clientY: cy, pointerType: 'touch' }));
    ev('pointerdown', 11, cx - 40); ev('pointerdown', 12, cx + 40); ev('pointermove', 11, cx - 120); ev('pointermove', 12, cx + 120); ev('pointerup', 11, cx - 120); ev('pointerup', 12, cx + 120);
  }, { cx, cy });
  const after = await p.getAttribute('#rmap', 'viewBox');
  check(+after.split(' ')[2] < +before.split(' ')[2] * .6, 'pinching out zooms the region map in', [before, after]);
  await p.close();

  await b.close();
  console.log(fails ? fails + ' FAILED' : 'all passed');
  process.exit(fails ? 1 : 0);
})();
