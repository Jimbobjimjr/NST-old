// Draws mock-ups of proposed features on top of the real page, for discussion only. Usage: node dev/test/mockups.js
const { chromium } = require('playwright');
const fs = require('fs');
const makeGas = require('./gas.js');
const SITE = require('path').resolve(__dirname, '../..');
const D3 = process.env.D3;
const OUT = process.env.SHOTS + '/'; fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const CSS = `
.mk-tag{position:fixed;left:24px;bottom:18px;z-index:99;background:#7b4e18;color:#fff8ec;font:600 12px/1 var(--f-body);padding:6px 10px;border-radius:4px;letter-spacing:.06em;text-transform:uppercase}
.mk-pane{gap:12px}
.mk-pane h3{margin:0}
.mk-card{background:var(--panel-2);border:1px solid var(--line);border-radius:6px;padding:10px 12px}
.mk-card p{margin:4px 0 0}
.mk-meta{font-size:12px;color:var(--muted)}
.mk-chip{display:inline-block;font-size:11px;padding:2px 7px;border-radius:10px;border:1px solid var(--line);margin-right:4px;background:var(--panel)}
.mk-btn{display:inline-block;font-size:13px;padding:5px 12px;border-radius:5px;border:1px solid var(--line);background:var(--panel);margin:8px 6px 0 0}
.mk-btn.go{background:var(--ok);color:#fff;border-color:var(--ok)}
.mk-btn.no{background:var(--bad);color:#fff;border-color:var(--bad)}
.mk-lock{font-size:12px;color:var(--bad);font-weight:600}
.mk-badge{position:fixed;z-index:60;transform:translate(-50%,-130%);background:var(--panel);border:1px solid var(--line);border-radius:5px;padding:3px 7px;font:600 12px/1.2 var(--f-body);box-shadow:0 2px 6px rgba(0,0,0,.25);white-space:nowrap}
.mk-over{position:fixed;z-index:70;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:22px 26px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.25)}
.mk-over h2{font-family:var(--f-display);font-weight:400;font-size:30px;margin:0 0 4px}
.crier{background:#efe4c6;color:#2a241a;border:1px solid #b8a578;border-radius:6px;padding:14px 16px;font-family:var(--f-fell)}
.crier .mast{text-align:center;font-family:var(--f-display);font-size:26px;border-bottom:3px double #2a241a;padding-bottom:4px}
.crier .sub{text-align:center;font-size:12px;margin:4px 0 8px;letter-spacing:.08em}
.crier h4{font-family:var(--f-display);font-weight:400;font-size:19px;margin:10px 0 2px}
.crier p{margin:0;font-size:14px;line-height:1.35}
.crier .from{margin-top:12px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6a5a3a}
.gauge{display:flex;gap:3px;margin:6px 0}
.gauge span{flex:1;height:12px;border-radius:2px;background:var(--line)}
.grid{display:grid;gap:14px}
.stat{background:var(--panel-2);border:1px solid var(--line);border-radius:6px;padding:12px}
.stat h5{margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:.09em;color:var(--muted);font-weight:500}
.stat b{display:block;font-size:28px;font-family:var(--f-display);font-weight:400}
.bar{height:10px;border-radius:2px;display:inline-block;vertical-align:middle}
table.mk{border-collapse:collapse;width:100%;font-size:13px}
table.mk td,table.mk th{border-bottom:1px solid var(--line);padding:5px 6px;text-align:left}
`;

const DANGER = [['Calm', 'var(--ok)'], ['Uneasy', '#8a9a3a'], ['Dangerous', 'var(--warn)'], ['Perilous', '#c4561c'], ['Dire', 'var(--bad)']];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const gas = makeGas(SITE + '/apps-script/Code.gs');
  gas.ctx.setup();
  gas.sheets.Reps.appendRow(['lead-1', 'Brett', 'lead', 'all', true]);
  gas.sheets.Reps.appendRow(['story-br', 'Kit (Bracken story)', 'story', 'bracken', true]);
  const open = async () => {
    const p = await b.newPage({ viewport: { width: 1360, height: 860 } });
    await p.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ path: D3, contentType: 'text/javascript' }));
    await p.route('**/config.js', r => r.fulfill({ body: 'window.WARMAP_CONFIG={apiUrl:"https://script.google.com/macros/s/TEST/exec",pollSeconds:600}', contentType: 'text/javascript' }));
    await p.route('https://script.google.com/**', async r => {
      const req = r.request();
      const out = req.method() === 'GET' ? gas.get(Object.fromEntries(new URL(req.url()).searchParams)) : gas.post(req.postData());
      r.fulfill({ body: JSON.stringify(out), contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
    });
    await p.goto('file://' + SITE + '/index.html'); await sleep(1800);
    await p.addStyleTag({ content: CSS });
    await p.evaluate(() => { const t = document.createElement('div'); t.className = 'mk-tag'; t.textContent = 'Mock-up · example data, not canon'; document.body.append(t); });
    return p;
  };
  const signIn = async (p, code) => { await p.click('#who-btn'); await p.fill('#code-in', code); await p.click('#code-go'); await sleep(700); };
  // Adds a new selected tab to the side panel and shows the given html in it.
  const pane = (p, label, html) => p.evaluate(([label, html]) => {
    document.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', 'false'));
    const t = document.createElement('button'); t.textContent = label; t.setAttribute('aria-selected', 'true'); document.querySelector('.tabs').append(t);
    document.querySelectorAll('.pane').forEach(x => x.hidden = true);
    const d = document.createElement('div'); d.className = 'pane mk-pane'; d.innerHTML = html; document.querySelector('.side').append(d);
  }, [label, html]);
  const badges = (p, list) => p.evaluate(list => {
    for (const [id, html, style] of list) {
      const g = document.querySelector(`.citygrp[data-region="${id}"]`); if (!g) continue;
      const r = g.getBoundingClientRect(); const d = document.createElement('div'); d.className = 'mk-badge'; d.innerHTML = html;
      d.style.left = (r.x + r.width / 2) + 'px'; d.style.top = r.y + 'px'; if (style) d.style.cssText += style; document.body.append(d);
    }
  }, list);
  const overMap = (p, html) => p.evaluate(html => {
    const r = document.querySelector('#mapwrap').getBoundingClientRect(); const d = document.createElement('div'); d.className = 'mk-over';
    Object.assign(d.style, { left: r.x + 'px', top: r.y + 'px', width: r.width + 'px', height: r.height + 'px' }); d.innerHTML = html; document.body.append(d);
  }, html);
  const shot = async (p, name) => { await sleep(300); await p.screenshot({ path: OUT + name }); await p.close(); };

  // 1. Dispatches
  let p = await open();
  await pane(p, 'Dispatches', `<div class="crier"><div class="mast">Dispatches</div><div class="sub">CARRIED BY RIDER FROM ACROSS THE ABANDONED LANDS</div>
    <div class="from">From Eisendreieck</div><h4>Drums at Greyhook Pass!</h4><p>A warclan holds the pass. Caravans for the west now take the long road through the hills. Smiths in the city work through the night.</p>
    <div class="from">From Reefwatch Keep</div><h4>The well at Southbrook runs sweet again</h4><p>Farmers give thanks to the band who broke the coral totem. The salt is gone, but the fishermen still won't say what they saw.</p>
    <div class="from">From Braylong</div><h4>Lanterns on the barrow road</h4><p>Pilgrims swear the grave-markers near Braylong have turned to face north. Who turned them?</p></div>
    <div class="mk-meta">Built from Players entries only. News arrives after the event, by rider, so it is never live. Each dispatch links to its spot on the map.</div>`);
  await shot(p, '1-dispatches.png');

  // 2. Event calendar linked to the map
  p = await open();
  await badges(p, [['bracken', '📅 8 Nov'], ['eisendreieck', '📅 15 Nov'], ['sudenburg', '📅 22 Nov'], ['reefwatch', '📅 29 Nov'], ['braylong', '📅 6 Dec']]);
  await pane(p, 'Calendar', `<h3>Upcoming events</h3><div class="mk-meta">Pulled from the Swordcraft events calendar. Click one to fly to its region.</div>
    ${[['8 Nov', 'Bracken', 'Thorns and Embers', 'Wildwrought · tier 2 planned'], ['15 Nov', 'Eisendreieck', 'Iron Will', 'Gor Horde · tier 3 incursion'], ['22 Nov', 'Sudenburg', 'The Broker\'s Feast', 'No External Evil planned'], ['29 Nov', 'Reefwatch Keep', 'Low Tide', 'Drowned Court · tier 1']].map(([d, r, n, t]) => `<div class="mk-card"><b>${d} · ${n}</b><div class="mk-meta">${r}</div><p class="mk-meta">Story team only: ${t}</p></div>`).join('')}
    <div class="mk-card" style="border-color:var(--warn)"><b>⚠ Heads up for the NST</b><p class="mk-meta">Gor Horde appears in two chapters within 3 weeks (Eisendreieck 15 Nov, Sudenburg 22 Nov).</p></div>`);
  await shot(p, '2-calendar.png');

  // 3. State of the realm summary
  p = await open(); await signIn(p, 'story-br');
  await pane(p, 'Summary', `<h3>Bracken, right now</h3><div class="mk-meta">Written from canon map entries. Updated after every event.</div>
    <div class="mk-card"><h5>Condition</h5><b style="color:var(--bad)">Besieged</b> since Thorns and Embers (Oct)</div>
    <div class="mk-card"><h5>Threats here</h5><span class="mk-chip">Wildwrought · tier 3</span><span class="mk-chip">Raiders · Lesser · tier 1</span></div>
    <div class="mk-card"><h5>The story so far</h5><p>The Wildwrought have pushed through Leben's Blessing at two points. Fort Blackridge's palisade burned but the gate held. Raiders work the south road while the wardens are stretched.</p></div>
    <div class="mk-card"><h5>Last three events</h5><p class="mk-meta">Oct · Thorns and Embers<br>Aug · The bell falls silent<br>Jun · Harvest under watch</p></div>
    <div class="mk-card" style="border-color:var(--accent)"><h5>Open threads · story team only</h5><p class="mk-meta">Who rang the bell? · The cult's ledger is still missing · A Braylong scout owes the Reeve a debt</p></div>`);
  await shot(p, '3-summary.png');

  // 4. Handoff requests
  p = await open(); await signIn(p, 'lead-1');
  await pane(p, 'Requests', `<h3>Chapter requests</h3><div class="mk-lock">🔒 Never shown to players. Only the NST lead can approve.</div>
    <div class="mk-card"><span class="mk-chip">Waiting on the NST lead</span><b style="display:block;margin-top:6px">Bracken asks</b><p>Can the Pale Host scouts from Braylong's barrow road follow our players into Bracken's woods at Thorns and Embers (8 Nov)? Tier 1 only.</p><p class="mk-meta">Affects Braylong · their story team can see this and comment.</p>
      <span class="mk-btn go">Approve</span><span class="mk-btn">Approve with changes</span><span class="mk-btn no">Decline</span></div>
    <div class="mk-card"><span class="mk-chip" style="color:var(--ok)">Approved</span><b style="display:block;margin-top:6px">Eisendreieck asks</b><p>Raise the Gor Horde at Greyhook Pass to tier 3.</p><p class="mk-meta">Approved by Brett · 14 Oct · "Keep the warchief off-stage until spring."</p></div>
    <div class="mk-card"><span class="mk-chip" style="color:var(--bad)">Declined</span><b style="display:block;margin-top:6px">Sudenburg asks</b><p>Borrow the Drowned Court for a dockside scene.</p><p class="mk-meta">Declined by Brett · "Reefwatch reveals them at Low Tide first."</p></div>`);
  await shot(p, '4-requests.png');

  // 5. Danger level
  p = await open();
  const lv = { bracken: 3, eisendreieck: 2, braylong: 2, reefwatch: 2, sudenburg: 1, ritterstein: 0, kreigstor: 1, stromstadt: 0, handelsdorf: 1, weitnordlich: 0, helsreik: 2 };
  await badges(p, Object.entries(lv).map(([id, n]) => [id, DANGER[n][0], `background:${DANGER[n][1]};color:#fff;border-color:transparent`]));
  await pane(p, 'Danger', `<h3>Bracken</h3><h5>Danger</h5><div class="gauge">${DANGER.map((d, i) => `<span style="${i <= 4 ? 'background:' + d[1] : ''};opacity:${i <= 3 ? 1 : .25}"></span>`).join('')}</div>
    <b style="color:#c4561c;font-size:18px">Perilous</b>
    <div class="mk-card"><h5>Why</h5><p class="mk-meta">Wildwrought at tier 3 · region besieged · raiders on the south road · no win for the players in two events</p></div>
    <div class="mk-card"><h5>What players feel</h5><p>Travel is unsafe after dark. Prices are up. The wardens are asking every chapter for help.</p></div>
    <div class="mk-meta">The level is worked out from the threats and condition on the map, so nobody has to keep a score. The NST can override it.</div>`);
  await shot(p, '5-danger.png');

  // 6. Yearly recap
  p = await open(); await signIn(p, 'lead-1');
  const ch = [['Bracken', 3], ['Eisendreieck', 2], ['Sudenburg', 2], ['Braylong', 2], ['Reefwatch Keep', 1], ['Ritterstein', 1], ['New Kriegstor', 0], ['Stromstadt', 0], ['Handelsdorf', 1], ['Weitnördlich', 0], ['Helsreik', 1]];
  await overMap(p, `<h2>Yearly recap · 2026</h2><div class="mk-meta" style="margin-bottom:14px">NST only. Built from this year's entries.</div>
    <div class="grid" style="grid-template-columns:repeat(4,1fr)"><div class="stat"><b>13</b>events posted</div><div class="stat"><b>3</b>threats rose</div><div class="stat"><b>2</b>threats beaten</div><div class="stat"><b style="color:var(--bad)">1</b>region besieged</div></div>
    <div class="grid" style="grid-template-columns:1.2fr 1fr;margin-top:14px"><div class="stat"><h5>Entries by chapter</h5><table class="mk">${ch.map(([n, c]) => `<tr><td>${n}</td><td style="width:60%">${c ? `<span class="bar" style="width:${c * 50}px;background:var(--accent)"></span> ${c}` : '<span style="color:var(--bad)">None yet</span>'}</td></tr>`).join('')}</table></div>
    <div class="grid" style="align-content:start"><div class="stat"><h5>Needs a look</h5><p class="mk-meta" style="margin:0">New Kriegstor, Stromstadt and Weitnördlich have posted nothing this year.<br>Raiders (Lesser Evil) in Bracken were ignored twice and can grow to tier 2.<br>Braylong's Pale Host has sat at tier 1 all year.</p></div>
    <div class="stat"><h5>Biggest moments of the year</h5><p class="mk-meta" style="margin:0">Bracken besieged (Oct)<br>Gor Horde reach Greyhook Pass (Sep)<br>Southbrook well saved (Sep)</p></div></div></div>`);
  await shot(p, '6-yearly-recap.png');
  await b.close();
})();
