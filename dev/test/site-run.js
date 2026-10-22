const { chromium } = require('playwright');
const fs = require('fs');
const makeGas = require('./gas.js');
const SITE = require('path').resolve(__dirname, '../..');
const D3 = process.env.D3 || 'd3-delaunay.min.js';
const OUT = (process.env.SHOTS || 'shots') + '/'; fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function page(b, opts, url, setup) {
  const p = await b.newPage(opts);
  await p.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ path: D3, contentType: 'text/javascript' }));
  await p.route('**/fonts.g*/**', r => r.abort());
  p.errs = []; p.on('console', m => { if (m.type() === 'error') p.errs.push(m.text()); }); p.on('pageerror', e => p.errs.push('PAGEERR ' + e.message));
  if (setup) await setup(p);
  await p.goto('file://' + SITE + '/index.html' + (url || '')); await sleep(1200);
  return p;
}
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  // 1. Sheets mode, end to end against Code.gs running in Node
  const gas = makeGas(SITE + '/apps-script/Code.gs');
  gas.ctx.setup();
  gas.sheets.Reps.appendRow(['bracken-123', 'Sam (Bracken rep)', 'rep', 'bracken', true]);
  const nstCode = gas.sheets.Reps.rows[1][0];
  const setupSheets = async p => {
    await p.route('**/config.js', r => r.fulfill({ body: 'window.WARMAP_CONFIG={apiUrl:"https://script.google.com/macros/s/TEST/exec",pollSeconds:600}', contentType: 'text/javascript' }));
    await p.route('https://script.google.com/**', async r => {
      const req = r.request(); let out;
      if (req.method() === 'GET') out = gas.get(Object.fromEntries(new URL(req.url()).searchParams));
      else out = gas.post(req.postData());
      r.fulfill({ body: JSON.stringify(out), contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
    });
  };
  let p = await page(b, { viewport: { width: 1440, height: 900 } }, '', setupSheets);
  await p.screenshot({ path: OUT + 's1-public.png' });
  console.log('public events', await p.locator('.ev').count(), 'who', await p.locator('#who-btn').textContent());
  // sign in as Bracken rep
  await p.click('#who-btn'); await p.fill('#code-in', 'bracken-123'); await p.click('#code-go'); await sleep(500);
  console.log('after sign in', await p.locator('#who-btn').textContent(), 'layer btns', await p.locator('#layerseg button:not([hidden])').count());
  // open Bracken via double click
  const box = await p.locator('.citygrp[data-region="bracken"]').boundingBox();
  await p.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2); await sleep(1200);
  await p.screenshot({ path: OUT + 's2-bracken.png' });
  // click a site (Fort Blackridge) and raise Wildwrought there
  await p.locator('.site[data-site="bracken-fort-blackridge"]').dispatchEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
  await p.locator('.site[data-site="bracken-fort-blackridge"]').dispatchEvent('pointerup', { pointerId: 1 });
  await sleep(300);
  console.log('site selected', await p.locator('.sitebox h3').textContent());
  await p.click('[data-step="wild"][data-site="bracken-fort-blackridge"][data-d="1"]'); await sleep(150);
  await p.click('[data-step="wild"][data-site="bracken-fort-blackridge"][data-d="1"]'); await sleep(150);
  // add a threat at that site
  await p.click('.sitebox [data-addthr]'); await sleep(300);
  await p.selectOption('select[data-f="kind"]', 'other'); await sleep(200);
  await p.fill('input[data-f="name"]', 'Blackmaw raiders'); 
  await p.selectOption('select[data-f="group"]', 'bandits'); await sleep(200);
  await p.fill('#d-title', 'Smoke over Fort Blackridge');
  await p.screenshot({ path: OUT + 's3-draft.png' });
  console.log('warnings', await p.locator('.warns div').allTextContents());
  await p.click('#d-save'); await sleep(800);
  console.log('events in sheet', gas.sheets.Events.rows.length - 1, 'log', gas.sheets.Log.rows.slice(1).map(r => r[1] + ':' + r[2]));
  await p.screenshot({ path: OUT + 's4-saved.png' });
  // write a note
  await p.click('#tab-region'); await sleep(200);
  await p.fill('#n-pub', 'Thick smoke rises from Fort Blackridge. Hunters report raiders on the south road.');
  await p.click('#n-save'); await sleep(600);
  console.log('notes rows', gas.sheets.Notes.rows.length - 1);
  // add a site in edit mode
  await p.click('#site-edit'); await sleep(200);
  const rb = await p.locator('#rmap').boundingBox();
  await p.mouse.click(rb.x + rb.width * .62, rb.y + rb.height * .35); await sleep(300);
  await p.fill('#ps-name', 'Thornwatch camp'); await p.click('#ps-save'); await sleep(700);
  console.log('sites rows', gas.sheets.Sites.rows.length - 1, gas.sheets.Sites.rows[1]);
  await p.screenshot({ path: OUT + 's5-site.png' });
  // try a forbidden thing: a tier 4 at Bracken
  const res = gas.post(JSON.stringify({ action: 'saveEvent', code: 'bracken-123', event: { title: 'x', chapter: 'bracken', changes: [{ type: 'set', evil: 'pale', region: 'bracken', tier: 4 }] } }));
  const res2 = gas.post(JSON.stringify({ action: 'saveEvent', code: 'bracken-123', event: { title: 'x', chapter: 'sudenburg', changes: [] } }));
  const res3 = gas.post(JSON.stringify({ action: 'saveNote', code: 'bracken-123', region: 'sudenburg', note: { public: 'x' } }));
  console.log('server refusals', res.error, '|', res2.error, '|', res3.error);
  console.log('viewer sees story notes?', JSON.stringify(gas.get({}).notes.bracken));
  console.log('sheets errs', p.errs);
  await p.close();
  // 2. Public embed of the region in dark mode, phone
  p = await page(b, { viewport: { width: 900, height: 820 }, colorScheme: 'dark' }, '?embed=1&region=bracken', setupSheets);
  await p.screenshot({ path: OUT + 's6-embed-dark.png' });
  console.log('embed errs', p.errs); await p.close();
  p = await page(b, { viewport: { width: 400, height: 860 } }, '?region=reefwatch', setupSheets);
  await p.screenshot({ path: OUT + 's7-phone.png', fullPage: true });
  console.log('phone errs', p.errs); await p.close();
  // 3. Local mode demo editing, crop region
  const noSheet = async p => p.route('**/config.js', r => r.fulfill({ body: 'window.WARMAP_CONFIG={apiUrl:""}', contentType: 'text/javascript' }));
  p = await page(b, { viewport: { width: 1440, height: 900 } }, '', noSheet);
  await p.click('#who-btn'); await p.click('#demo-on'); await sleep(300);
  await p.evaluate(() => document.querySelector('[data-goreg]') );
  const kb = await p.locator('.citygrp[data-region="stromstadt"]').boundingBox();
  await p.mouse.dblclick(kb.x + kb.width / 2, kb.y + kb.height / 2); await sleep(1100);
  await p.screenshot({ path: OUT + 's8-local-crop.png' });
  console.log('local errs', p.errs); await p.close();
  await b.close();
})();
