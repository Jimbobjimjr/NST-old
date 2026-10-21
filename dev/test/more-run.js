// End-to-end checks for Dispatches, the events calendar, chapter requests and the yearly recap.
// Runs the page in Chromium against Code.gs running in Node. Usage: node dev/test/more-run.js
const { chromium } = require('playwright');
const fs = require('fs');
const makeGas = require('./gas.js');
const SITE = require('path').resolve(__dirname, '../..');
const D3 = process.env.D3;
const OUT = (process.env.SHOTS || '/tmp/shots') + '/'; fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const check = (ok, what, extra) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + what + (extra !== undefined ? ' · ' + JSON.stringify(extra) : '')); };
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = s => { const [y, m, d] = s.split('-').map(Number); return `${d} ${MON[m - 1]}`; };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const gas = makeGas(SITE + '/apps-script/Code.gs');
  gas.ctx.setup();
  [['story-b', 'Ash (Bracken story team)', 'story', 'bracken'], ['braylong-1', 'Kit (Braylong rep)', 'rep', 'braylong'], ['ritter-1', 'Lee (Ritterstein rep)', 'rep', 'ritterstein'],
    ['nst-2', 'Andrew', 'nst', 'all'], ['lead-1', 'Brett', 'lead', 'all']].forEach(r => gas.sheets.Reps.appendRow([...r, true]));
  const post = o => gas.post(JSON.stringify(o));
  const load = code => gas.get(code ? { action: 'load', code } : { action: 'load' });

  // Example story (made up, not canon): a quiet 2025, then a busy 2026 in Bracken.
  post({ action: 'saveEvent', code: 'lead-1', event: { id: 'ev-0', turn: 1, title: 'Smoke on the north road', when: 'Nov 2025', chapter: 'kreigstor', visibility: 'public', order: 1, createdAt: '2025-11-20T00:00:00Z', changes: [{ type: 'set', evil: 'pale', region: 'kreigstor', tier: 1 }] } });
  post({ action: 'saveEvent', code: 'lead-1', event: { id: 'ev-a', turn: 2, title: 'Thorns and Embers', when: 'Mar 2026', chapter: 'bracken', visibility: 'public', order: 2, createdAt: '2026-03-02T00:00:00Z', changes: [{ type: 'set', evil: 'wild', region: 'bracken', tier: 3 }, { type: 'threat', tid: 'tf', kind: 'lesser', group: 'forsworn', tier: 2, region: 'braylong' }] } });
  post({ action: 'saveEvent', code: 'lead-1', event: { id: 'ev-b', turn: 3, title: 'The south road burns', when: 'May 2026', chapter: 'bracken', visibility: 'public', order: 3, createdAt: '2026-05-10T00:00:00Z', changes: [{ type: 'status', region: 'bracken', status: 'besieged' }] } });
  post({ action: 'saveEvent', code: 'lead-1', event: { id: 'ev-c', turn: 4, title: 'Bells at Braylong', when: 'Jun 2026', chapter: 'braylong', visibility: 'public', order: 4, createdAt: '2026-06-10T00:00:00Z', changes: [{ type: 'set', evil: 'pale', region: 'braylong', tier: 2 }] } });
  post({ action: 'saveEvent', code: 'lead-1', event: { id: 'ev-d', turn: 5, title: 'Quiet watch', when: 'Jul 2026', chapter: 'braylong', visibility: 'public', order: 5, createdAt: '2026-07-10T00:00:00Z', changes: [{ type: 'mark', mid: 'm1', icon: 'pin', region: 'braylong', wide: true }] } });
  post({ action: 'saveEvent', code: 'lead-1', event: { id: 'ev-e', turn: 6, title: 'Long night', when: 'Aug 2026', chapter: 'braylong', visibility: 'public', order: 6, createdAt: '2026-08-10T00:00:00Z', changes: [{ type: 'mark', mid: 'm2', icon: 'star', region: 'braylong', wide: true }] } });

  // Permissions in the story sheet
  check(post({ action: 'saveDispatch', code: 'story-b', item: { chapter: 'bracken', title: 'Smoke over the thorn wall', when: 'After the May event', body: 'Travellers say the south road is ash.\n\nThe Reeve asks for help.' } }).ok, 'a story team writes a dispatch for its own chapter');
  check(!post({ action: 'saveDispatch', code: 'story-b', item: { chapter: 'braylong', title: 'Not ours' } }).ok, 'a story team cannot write for another chapter');
  check(!post({ action: 'saveEvent', code: 'story-b', event: { title: 'x', chapter: 'bracken', changes: [] } }).ok, 'a story team still cannot change the story');
  check(!post({ action: 'saveDispatch', code: 'braylong-1', item: { chapter: 'national', title: 'National news' } }).ok, 'only the NST writes national dispatches');
  check(post({ action: 'saveCal', code: 'story-b', item: { id: 'cal-1', date: day(10), chapter: 'bracken', name: 'The Thorn Moot', evil: 'wild', plan: 'Wildwrought raid on the mill' } }).ok, 'a story team adds its chapter event');
  check(post({ action: 'saveCal', code: 'braylong-1', item: { id: 'cal-2', date: day(24), chapter: 'braylong', name: 'Swamp Watch', evil: 'wild', plan: 'Briar Totems in the south swamp' } }).ok, 'a rep adds their chapter event');
  check(!post({ action: 'saveCal', code: 'braylong-1', item: { date: day(5), chapter: 'bracken', name: 'Not ours' } }).ok, 'a rep cannot add another chapter\'s event');
  post({ action: 'saveCal', code: 'lead-1', item: { id: 'cal-0', date: day(-40), chapter: 'sudenburg', name: 'Sudenburg Spring Muster' } });
  check(post({ action: 'saveRequest', code: 'story-b', item: { id: 'rq-1', chapter: 'bracken', affects: ['braylong'], text: 'Can the Wildwrought raiders retreat into Braylong\'s south swamp after our event?' } }).ok, 'a story team makes a request');
  check(!post({ action: 'saveRequest', code: 'story-b', item: { chapter: 'bracken', affects: [], text: 'x' } }).ok, 'a request needs an affected chapter');
  const RQ = load('lead-1').requests[0].id;
  check(post({ action: 'commentRequest', code: 'braylong-1', id: RQ, text: 'Fine by us if they arrive after the 20th.' }).ok, 'an affected chapter comments');
  check(!post({ action: 'commentRequest', code: 'ritter-1', id: RQ, text: 'x' }).ok, 'an uninvolved chapter cannot comment');
  check(!post({ action: 'decideRequest', code: 'nst-2', id: RQ, status: 'approved' }).ok, 'the NST (not lead) cannot decide');
  check(!post({ action: 'decideRequest', code: 'braylong-1', id: RQ, status: 'approved' }).ok, 'a rep cannot decide');
  const v = load();
  check(v.dispatches.length === 1 && v.calendar.length === 3, 'players load dispatches and the calendar');
  check(v.calendar.every(c => c.plan === undefined && c.evil === undefined), 'players never get calendar plans');
  check(v.requests.length === 0, 'players never get requests');
  check(load('ritter-1').requests.length === 0, 'an uninvolved chapter does not see the request');
  check(load('braylong-1').requests.length === 1, 'the affected chapter sees the request');
  check(load('nst-2').requests.length === 1, 'the NST sees every request');

  const open = async (opts, q = '') => {
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
    await p.goto('file://' + SITE + '/index.html' + q); await sleep(1500);
    return p;
  };
  const signIn = async (p, code) => { await p.click('#who-btn'); await p.fill('#code-in', code); await p.click('#code-go'); await sleep(700); };
  const tab = async (p, t) => { await p.click('#tab-' + t); await sleep(300); };
  const text = (p, sel) => p.locator(sel).first().textContent();

  // 1. A player
  let p = await open();
  check(await p.locator('#tab-requests').isHidden() && await p.locator('#tab-recap').isHidden(), 'players do not see Requests or the recap');
  check((await text(p, '#tab-calendar .tabbadge')) === '2', 'Calendar tab shows 2 events in the next 30 days');
  const badge = await p.locator('.citygrp[data-region="bracken"] .calbadge text').textContent();
  check(badge === short(day(10)), 'Bracken shows its next event date on the map', badge);
  check(await p.locator('.citygrp[data-region="sudenburg"] .calbadge').count() === 0, 'a past event shows no badge');
  await p.screenshot({ path: OUT + 'm1-map-badges.png' });
  await tab(p, 'dispatches');
  const disp = await text(p, '#pane-dispatches');
  check(/Smoke over the thorn wall/.test(disp) && /The Reeve asks for help/.test(disp), 'the dispatch reads for players');
  check(await p.locator('#dp-new').count() === 0, 'players cannot write dispatches');
  await p.locator('#pane-dispatches').screenshot({ path: OUT + 'm2-dispatches.png' });
  await tab(p, 'calendar');
  const cal = await text(p, '#pane-calendar');
  check(/The Thorn Moot/.test(cal) && /Swamp Watch/.test(cal), 'the calendar lists upcoming events');
  if (day(-40).slice(0, 4) === String(new Date().getFullYear())) check(/Sudenburg Spring Muster/.test(cal) && await p.locator('.calrow.past').count() === 1, 'the calendar shows the whole year, past events included');
  check(/(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}/.test(cal), 'the calendar is grouped by month');
  check(!/Wildwrought raid/.test(cal) && !/Heads-up/.test(cal), 'players see no plans or clash warnings');
  await p.click('.citygrp[data-region="bracken"]', { force: true }).catch(() => {});
  check(p.errs.length === 0, 'no page errors for players', p.errs);
  await p.close();

  // 2. The Bracken story team
  p = await open(); await signIn(p, 'story-b');
  check(await p.locator('#tab-requests').isVisible() && await p.locator('#tab-recap').isHidden(), 'story teams see Requests but not the recap');
  await tab(p, 'calendar');
  const cal2 = await text(p, '#pane-calendar');
  check(/Wildwrought raid on the mill/.test(cal2), 'story teams see what is planned');
  check(/Heads-up: Bracken .* and Braylong .* both plan Wildwrought/.test(cal2), 'clash warning for the same evil within 30 days', cal2.match(/Heads-up[^.]*/)?.[0]);
  await p.locator('#pane-calendar').screenshot({ path: OUT + 'm3-calendar-story.png' });
  await tab(p, 'dispatches');
  await p.click('#dp-new'); await p.fill('#dp-title', 'The Moot gathers'); await p.fill('#dp-when', 'Before the Thorn Moot'); await p.fill('#dp-body', 'Word goes out to every farm.');
  check(await p.locator('#dp-pin').count() === 0, 'only the NST can pin');
  await p.click('#dp-save'); await sleep(800);
  check(/The Moot gathers/.test(await text(p, '#pane-dispatches')), 'a story team sends a dispatch from the page');
  await tab(p, 'requests');
  await p.click('#rq-new'); await p.check('[data-rqaff="handelsdorf"]'); await p.fill('#rq-text', 'Can a Forsworn deserter flee to Handelsdorf?');
  await p.click('#rq-save'); await sleep(800);
  const rq = await text(p, '#pane-requests');
  check(/Forsworn deserter/.test(rq) && /Fine by us/.test(rq), 'the request list shows both requests and comments');
  check(await p.locator('[data-rqdecide]').count() === 0, 'story teams cannot decide');
  await p.locator('#pane-requests').screenshot({ path: OUT + 'm4-requests-story.png' });
  check(p.errs.length === 0, 'no page errors for a story team', p.errs);
  await p.close();

  // 3. The NST lead decides and reads the recap
  p = await open(); await signIn(p, 'lead-1');
  await tab(p, 'requests');
  check((await text(p, '#tab-requests .tabbadge')) === '2', 'two requests wait for the lead');
  await p.selectOption(`[data-rqst="${RQ}"]`, 'changes'); await p.fill(`[data-rqreply="${RQ}"]`, 'Yes, after the 20th, as Braylong asked.');
  await p.click(`[data-rqdecide="${RQ}"]`); await sleep(800);
  const rq3 = await p.locator('article.request', { hasText: 'south swamp' }).textContent();
  check(/Approved with changes/.test(rq3) && /after the 20th, as Braylong asked/.test(rq3), 'the lead approves with changes and a note');
  await p.locator('#pane-requests').screenshot({ path: OUT + 'm5-requests-lead.png' });
  await tab(p, 'recap');
  const rc = await text(p, '#pane-recap');
  check(/2026/.test(await p.locator('#rc-year').inputValue()), 'recap opens on the latest year');
  check(/5\s*events posted/.test(rc), 'recap counts the year\'s events', rc.match(/\d+\s*events posted/)?.[0]);
  check(/Besieged: Bracken/.test(rc), 'recap lists besieged regions');
  check(/No events in 2026 from Ritterstein, /.test(rc), 'recap flags quiet chapters');
  check(/Forsworn has sat in Braylong at tier 2 for 4 years/.test(rc), 'recap flags a Lesser Evil left alone', rc.match(/Forsworn[^.]*/)?.[0]);
  check(/Thorns and Embers/.test(await text(p, '#pane-recap .hist')), 'recap lists the biggest moments');
  await p.locator('#pane-recap').screenshot({ path: OUT + 'm6-recap.png' });
  await p.selectOption('#rc-year', '2025'); await sleep(300);
  check(/1\s*events? posted/.test(await text(p, '#pane-recap')), 'recap switches year');
  await p.click('#layerseg [data-layer="public"]'); await sleep(500);
  check(await p.locator('#tab-requests').isHidden() && await p.locator('#tab-recap').isHidden(), 'viewing as Players hides Requests and the recap');
  await p.click('#layerseg [data-layer="nst"]'); await sleep(500);
  await tab(p, 'calendar');
  await p.click('.setup summary >> text=Calendar link'); await p.fill('#cl-url', 'https://example.org/swordcraft-calendar'); await p.click('#cl-url-save'); await sleep(800);
  check(await p.locator('a', { hasText: 'Open the full Swordcraft calendar' }).count() === 1, 'the NST links the full calendar');
  check(!post({ action: 'saveSetting', code: 'braylong-1', key: 'calendar', value: { url: 'x' } }).ok, 'a rep cannot change the calendar link');
  check(p.errs.length === 0, 'no page errors for the lead', p.errs);
  await p.close();

  // 4. The Braylong rep sees the answer and the region page
  p = await open(); await signIn(p, 'braylong-1');
  await tab(p, 'requests');
  const rq4 = await text(p, '#pane-requests');
  check(/Approved with changes/.test(rq4) && !/Forsworn deserter/.test(rq4), 'the rep sees only requests involving Braylong');
  await p.fill(`[data-rqc="${RQ}"]`, 'Thanks, noted.'); await p.click(`[data-rqcsend="${RQ}"]`); await sleep(800);
  check(/Thanks, noted/.test(await text(p, '#pane-requests')), 'the rep adds a comment');
  await p.close();

  // 5. A region page, the dispatches link and a phone
  p = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, '?tab=dispatches');
  check(await p.locator('#tab-dispatches[aria-selected="true"]').count() === 1, '?tab=dispatches opens on the Dispatches');
  const w = await p.evaluate(() => document.documentElement.scrollWidth);
  check(w <= 390, 'no sideways scroll on a phone', w);
  await p.locator('#pane-dispatches').screenshot({ path: OUT + 'm7-phone-dispatches.png' });
  await p.evaluate(() => document.querySelector('.ovrow, [data-goreg]') || null);
  await p.click('#tab-overview'); await sleep(300); await p.click('.ovrow[data-goreg="bracken"]'); await sleep(400);
  const ahead = await text(p, '.aheadbox');
  check(/Next event/.test(ahead) && /The Thorn Moot/.test(ahead) && /The Moot gathers/.test(ahead), 'the region page shows the next event and latest dispatch');
  await p.locator('.aheadbox').screenshot({ path: OUT + 'm8-region-ahead.png' });
  check(p.errs.length === 0, 'no page errors on a phone', p.errs);
  await p.close();

  await b.close();
  console.log(fails ? fails + ' failed' : 'all passed');
  process.exit(fails ? 1 : 0);
})();
