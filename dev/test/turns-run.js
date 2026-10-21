// End-to-end checks for turns and each region's own story.
// Runs the page in Chromium against Code.gs running in Node. Usage: node dev/test/turns-run.js
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
  [['bracken-1', 'Sam (Bracken rep)', 'rep', 'bracken'], ['braylong-1', 'Kit (Braylong rep)', 'rep', 'braylong'], ['lead-1', 'Brett', 'lead', 'all']].forEach(r => gas.sheets.Reps.appendRow([...r, true]));
  const post = o => gas.post(JSON.stringify(o));
  // Example story (made up, not canon). Two entries saved before turns existed: each is its own turn.
  post({ action: 'saveEvent', code: 'lead-1', event: { id: 'ev-a', title: 'Thorns and Embers', when: 'Sep', chapter: 'bracken', visibility: 'public', order: 1, changes: [{ type: 'set', evil: 'wild', region: 'bracken', tier: 2 }] } });
  post({ action: 'saveEvent', code: 'lead-1', event: { id: 'ev-b', title: 'Bells at Braylong', when: 'Oct', chapter: 'braylong', visibility: 'public', order: 2, changes: [{ type: 'set', evil: 'pale', region: 'braylong', tier: 2 }] } });

  // Clear their turn, as in a sheet from before turns existed.
  { const ev = gas.sheets.Events.rows, col = ev[0].indexOf('turn'); ev.slice(1).forEach(r => r[col] = ''); }

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
  const sub = p => p.locator('#sub-step').textContent();

  // 1. Before any turn is opened: the old entries are turns 1 to 3
  let p = await open();
  check(/^Year 3 of 3\./.test(await sub(p)), 'old entries are each their own year', await sub(p));
  check(await p.locator('#share-btn').isHidden(), 'players do not see the Embed button');
  await p.close();

  // 2. The NST Lead opens turn 4
  p = await open(); await signIn(p, 'lead-1');
  check(await p.locator('#share-btn').isVisible(), 'the NST Lead sees the Embed button');
  await p.click('#tab-log'); await sleep(300);
  await p.click('.turnbox summary'); await p.fill('#turn-label', '2026'); await p.click('#turn-open'); await sleep(800);
  check(/Year 4 · 2026/.test(await p.locator('.turnbox').textContent()), 'the current turn is turn 4, November 2026');
  check(!post({ action: 'saveSetting', code: 'bracken-1', key: 'turns', value: { open: 99 } }).ok, 'a rep cannot open a turn');
  await p.close();

  // 3. Two chapters post in the same turn; a rep cannot pick an older turn
  check(post({ action: 'saveEvent', code: 'bracken-1', event: { id: 'ev-c', title: 'The thorn wall holds', when: 'Nov', chapter: 'bracken', visibility: 'public', changes: [{ type: 'set', evil: 'wild', region: 'bracken', tier: 3 }] } }).ok, 'Bracken posts');
  check(post({ action: 'saveEvent', code: 'braylong-1', event: { id: 'ev-d', turn: 1, title: 'Drums in the north pass', when: 'Nov', chapter: 'braylong', visibility: 'public', changes: [{ type: 'set', evil: 'pale', region: 'braylong', tier: 3 }] } }).ok, 'Braylong posts');
  const rows = gas.get({ action: 'load' }).events, tc = rows.find(e => e.id === 'ev-c').turn, td = rows.find(e => e.id === 'ev-d').turn;
  check(tc === 3 && td === 3, 'both entries land in the open turn, whatever turn a rep asks for', [tc, td]);

  // 4. A player sees one national step with both entries
  p = await open();
  check(/^Year 4 of 4\./.test(await sub(p)), 'the national count only went up by one turn', await sub(p));
  const now = await p.locator('#tl-now').textContent();
  check(/Year 4 · 2026/.test(now) && /2 entries this year/.test(now) && /The thorn wall holds/.test(now) && /Drums in the north pass/.test(now), 'the timeline shows both entries in the turn');
  check(await p.locator('#ticks button').count() === 4, 'four ticks on the timeline');
  await p.locator('.timeline').screenshot({ path: OUT + 't1-turn-timeline.png' });
  const tok = await p.locator('.tok[data-evil="pale"][data-region="braylong"]').count();
  check(tok === 1, 'the map shows the whole turn applied');
  await p.click('#tl-prev'); await sleep(700);
  check(/^Year 3 of 4\./.test(await sub(p)) && /Bells at Braylong/.test(await p.locator('#tl-now').textContent()), 'back one step goes back a whole turn');
  await p.click('#tl-next'); await sleep(900);
  // Bracken's own story
  await p.click('#zfit'); const bx = await p.locator('.citygrp[data-region="bracken"]').boundingBox(); await p.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2); await sleep(500);
  check(/Bracken: beat 2 of 2/.test(await sub(p)), 'the header shows Bracken\'s own step', await sub(p));
  const rs = await p.locator('.rstory').textContent();
  check(/Bracken's story · beat 2 of 2/.test(rs) && /Thorns and Embers/.test(rs) && /The thorn wall holds/.test(rs) && !/Bells at Braylong/.test(rs), 'the region page lists only Bracken\'s steps', rs.slice(0, 120));
  await p.locator('.rstory').screenshot({ path: OUT + 't2-region-story.png' });
  await p.click('.rstory button:has-text("Previous here")'); await sleep(800);
  check(/Bracken's story · beat 1 of 2/.test(await p.locator('.rstory').textContent()) && /^Year 2 of 4/.test(await sub(p)), 'Previous here jumps to Bracken\'s last step', await sub(p));
  // Story log, filtered to one chapter
  await p.click('#tab-log'); await sleep(300);
  check(await p.locator('.turnhead').count() === 4, 'the story log is grouped by turn');
  await p.selectOption('#log-filter', 'braylong'); await sleep(300);
  const lg = await p.locator('#pane-log').textContent();
  check(/Braylong's story · 2 beats/.test(lg) && !/Thorns and Embers/.test(lg), 'Whose story shows one chapter on its own');
  await p.locator('#pane-log').screenshot({ path: OUT + 't3-log-braylong.png' });
  check(p.errs.length === 0, 'no page errors', p.errs);
  await p.close();

  // 5. The NST Lead moves an entry into another turn
  p = await open(); await signIn(p, 'lead-1');
  await p.click('#tab-log'); await sleep(300);
  await p.locator('.ev', { hasText: 'Drums in the north pass' }).locator('[data-edit]').click(); await sleep(400);
  await p.selectOption('#d-turn', '2'); await p.click('#d-save'); await sleep(900);
  check(gas.get({ action: 'load' }).events.find(e => e.id === 'ev-d').turn === 2, 'the NST Team moves an entry to an earlier turn');
  check(/1 entr/.test(await p.locator('.turnhead', { hasText: 'Year 4 · 2026' }).textContent()), 'the November turn now has one entry');
  check(p.errs.length === 0, 'no page errors for the lead', p.errs);
  await p.close();

  await b.close();
  console.log(fails ? fails + ' failed' : 'all passed');
  process.exit(fails ? 1 : 0);
})();
