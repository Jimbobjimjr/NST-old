/**
 * Abandoned Lands Story Map: story sheet backend.
 *
 * Paste this whole file into Extensions > Apps Script on a new Google Sheet,
 * run setup() once, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone). Put the web app URL in config.js.
 *
 * Tabs it uses:
 *   Events   one row per story event; `changes` holds the map changes as JSON; `turn` groups entries into turns of the national story
 *   Sites    places reps add or move on their region maps
 *   Notes    the "current situation" text for each region
 *   Reps     who can edit: code, name, role (story | rep | nst | lead), chapters
 *   Settings map layout, the region map notice, renamed places, danger levels set by hand, the calendar link
 *   Dispatches  news for players, written by each chapter's story team
 *   Calendar    upcoming chapter events; the plan and main threat are for story teams only
 *   Requests    chapter requests; only the chapters involved and the NST Team see them, only the NST Lead decides
 *   Log      every change, who made it and when
 */

var TABS = {
  Events: ['id', 'order', 'turn', 'title', 'when', 'chapter', 'visibility', 'summary', 'changes', 'example', 'createdAt', 'updatedBy', 'updatedAt'],
  Sites: ['id', 'region', 'name', 'x', 'y', 'note', 'story', 'hidden', 'custom', 'updatedBy', 'updatedAt'],
  Notes: ['region', 'public', 'story', 'updatedBy', 'updatedAt'],
  Reps: ['code', 'name', 'role', 'chapters', 'active'],
  Settings: ['key', 'value'],
  Dispatches: ['id', 'chapter', 'title', 'body', 'when', 'pinned', 'createdBy', 'createdAt', 'updatedAt'],
  Calendar: ['id', 'date', 'chapter', 'name', 'link', 'plan', 'evil', 'updatedBy', 'updatedAt'],
  Requests: ['id', 'chapter', 'affects', 'text', 'status', 'reply', 'comments', 'createdBy', 'createdAt', 'decidedBy', 'decidedAt'],
  Log: ['time', 'who', 'action', 'detail']
};
var CHAPTERS = ['ritterstein', 'kreigstor', 'bracken', 'eisendreieck', 'sudenburg', 'stromstadt', 'braylong', 'handelsdorf', 'weitnordlich', 'helsreik', 'reefwatch'];
var VIS_RANK = { 'public': 0, story: 1, nst: 2 };
var ROLE_RANK = { viewer: 0, story: 1, rep: 2, nst: 2, lead: 2 };
var LESSER_MAX = 3;
var REQUEST_STATUS = ['waiting', 'approved', 'changes', 'declined'];
/* What a story team code may do: details on places, dispatches, calendar entries and requests for its own chapters. */
var STORY_ACTIONS = ['saveSite', 'saveDispatch', 'deleteDispatch', 'saveCal', 'deleteCal', 'saveRequest', 'commentRequest', 'deleteRequest'];

var OPENING = { id: 'opening', order: 0, title: 'Opening positions', when: 'NST Guidebook, October 2026', chapter: 'national', visibility: 'public',
  summary: 'Where each External Evil presses at the start of the story, as the guidebook sets out. Tokens show pressure on that front, using the Power Scale.',
  changes: [{ type: 'set', evil: 'gor', region: 'wastes', tier: 3 }, { type: 'set', evil: 'pale', region: 'northpass', tier: 3 },
    { type: 'set', evil: 'wild', region: 'southswamp', tier: 3 }, { type: 'set', evil: 'drowned', region: 'whispering', tier: 3 },
    { type: 'set', evil: 'drowned', region: 'shoals', tier: 2 }], example: false };

/** Run once from the editor. Creates the tabs, the opening event and a first NST code. */
function setup() {
  var ss = SpreadsheetApp.getActive();
  var first = ss.getSheets()[0];
  if (first && !ss.getSheetByName('Events') && String(first.getRange(1, 1).getValue()) === 'id') first.setName('Events');
  Object.keys(TABS).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) { sh.appendRow(TABS[name]); sh.setFrozenRows(1); sh.getRange(1, 1, 1, TABS[name].length).setFontWeight('bold'); }
  });
  if (readRows('Events').length === 0) writeRow('Events', 'id', eventToRow(OPENING));
  if (readRows('Reps').length === 0) {
    var code = 'nst-' + Utilities.getUuid().slice(0, 8);
    sheet('Reps').appendRow([code, 'NST Lead', 'nst', 'all', true]);
    Logger.log('Your NST code is ' + code + '. Add a row in the Reps tab for each chapter rep.');
  }
  ss.getSheetByName('Sheet1') && ss.getSheetByName('Sheet1').getLastRow() === 0 && ss.deleteSheet(ss.getSheetByName('Sheet1'));
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    var me = auth(p.code);
    var out = load(me || viewer());
    if (p.code && !me) out.badCode = true;
    return json(out);
  } catch (err) { return json({ error: String(err.message || err) }); }
}

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json({ ok: false, error: 'Bad request' }); }
  var me = auth(body.code);
  if (!me) return json({ ok: false, error: 'That rep code is not recognised.' });
  if (me.role === 'story' && STORY_ACTIONS.indexOf(body.action) < 0) return json({ ok: false, error: 'Story team codes can add details to places, write dispatches, calendar entries and requests, but not change the story.' });
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var res = act(me, body) || {};
    res.ok = true;
    return json(res);
  } catch (err) {
    return json({ ok: false, error: String(err.message || err) });
  } finally { lock.releaseLock(); }
}

function act(me, b) {
  var now = new Date().toISOString();
  switch (b.action) {
    case 'saveEvent': {
      var ev = b.event || {};
      var existing = ev.id ? findRow('Events', 'id', ev.id) : null;
      if (existing && !canEditChapter(me, existing.chapter)) throw new Error('That event belongs to another chapter.');
      if (!canEditChapter(me, ev.chapter)) throw new Error('You can only record events for your own chapter.');
      checkTiers(me, ev.changes || []);
      // Reps post into the turn the NST Team has open; only the NST Team moves an entry to another turn.
      if (existing && (!isNst(me) || ev.turn === undefined || ev.turn === '')) ev.turn = existing.turn;
      else if (!existing && (!isNst(me) || ev.turn === undefined || ev.turn === '')) ev.turn = openTurn();
      if (!ev.id) ev.id = 'ev' + Date.now().toString(36);
      if (existing) { ev.order = existing.order; ev.createdAt = existing.createdAt; ev.example = existing.example; }
      if (ev.order === undefined || ev.order === '') ev.order = nextOrder();
      ev.updatedBy = me.name; ev.updatedAt = now;
      writeRow('Events', 'id', eventToRow(ev));
      log(me, existing ? 'edit event' : 'add event', ev.title);
      return { id: ev.id };
    }
    case 'deleteEvent': {
      var row = findRow('Events', 'id', b.id);
      if (!row) return {};
      if (!canEditChapter(me, row.chapter)) throw new Error('That event belongs to another chapter.');
      deleteRow('Events', 'id', b.id);
      log(me, 'delete event', row.title);
      return {};
    }
    case 'reorder': {
      if (!isNst(me)) throw new Error('Only the NST Team can reorder the story.');
      (b.orders || []).forEach(function (o) { var r = findRow('Events', 'id', o.id); if (r) { r.order = o.order; writeRow('Events', 'id', r); } });
      log(me, 'reorder', (b.orders || []).length + ' events');
      return {};
    }
    case 'saveSite': {
      var s = b.site || {};
      if (!s.id || !s.region) throw new Error('A site needs an id and a region.');
      var cur = findRow('Sites', 'id', s.id) || {};
      // Sites reps add have ids like "bracken-c-..."; every other id is one of the map's own places.
      var custom = String(s.id).indexOf(s.region + '-c-') === 0 || truthy(cur.custom);
      if (me.role === 'story') {
        if (me.chapters.indexOf(s.region) < 0) throw new Error('You can only add details to places in your own chapter.');
        if (!cur.id && custom) throw new Error('Story team codes can add details to places, not add new places.');
        ['note', 'story'].forEach(function (k) { if (s[k] !== undefined) cur[k] = s[k]; });
      } else {
        if (!canEditRegion(me, s.region)) throw new Error('You can only change sites in your own region.');
        var named = s.name !== undefined && String(s.name).trim() !== '' && String(s.name) !== String(cur.name || '');
        if (named && !custom && me.role !== 'lead') throw new Error('Only the NST Lead can rename the map\'s own places.');
        ['name', 'x', 'y', 'note', 'story', 'hidden'].forEach(function (k) { if (s[k] !== undefined) cur[k] = s[k]; });
      }
      cur.custom = custom;
      cur.id = s.id; cur.region = s.region; cur.updatedBy = me.name; cur.updatedAt = now;
      writeRow('Sites', 'id', cur);
      log(me, 'site', s.region + ': ' + (cur.name || s.id));
      return {};
    }
    case 'deleteSite': {
      var site = findRow('Sites', 'id', b.id);
      if (!site) return {};
      if (!canEditRegion(me, site.region)) throw new Error('You can only change sites in your own region.');
      deleteRow('Sites', 'id', b.id);
      log(me, 'delete site', site.region + ': ' + site.name);
      return {};
    }
    case 'saveNote': {
      if (!canEditRegion(me, b.region)) throw new Error('You can only write notes for your own region.');
      var n = b.note || {};
      writeRow('Notes', 'region', { region: b.region, 'public': n['public'] || '', story: n.story || '', updatedBy: me.name, updatedAt: now });
      log(me, 'notes', b.region);
      return {};
    }
    case 'savePositions': {
      if (!isNst(me)) throw new Error('Only the NST Team can rearrange the main map.');
      writeRow('Settings', 'key', { key: 'positions', value: JSON.stringify(b.positions || {}) });
      log(me, 'layout', '');
      return {};
    }
    case 'saveSetting': {
      if (b.key === 'notice') { if (!isNst(me)) throw new Error('Only the NST Team can change the map notice.'); }
      else if (b.key === 'regions') { if (me.role !== 'lead') throw new Error('Only the NST Lead can rename places on the map.'); }
      else if (b.key === 'danger') { if (!isNst(me)) throw new Error('Only the NST Team can set a danger level by hand.'); }
      else if (b.key === 'turns') { if (!isNst(me)) throw new Error('Only the NST Team can open a new turn.'); }
      else if (b.key === 'calendar') { if (!isNst(me)) throw new Error('Only the NST Team can change the calendar link.'); }
      else throw new Error('Unknown setting ' + b.key);
      writeRow('Settings', 'key', { key: b.key, value: JSON.stringify(b.value === undefined ? null : b.value) });
      log(me, 'setting', b.key);
      return {};
    }
    case 'saveDispatch': {
      var d = b.item || {}, oldD = d.id ? findRow('Dispatches', 'id', d.id) : null;
      if (oldD && !canWrite(me, oldD.chapter)) throw new Error('That dispatch belongs to another chapter.');
      if (!canWrite(me, d.chapter)) throw new Error('You can only write dispatches for your own chapter.');
      if (!String(d.title || '').trim()) throw new Error('A dispatch needs a headline.');
      var rowD = oldD || { id: newId('d'), createdBy: me.name, createdAt: now };
      rowD.chapter = d.chapter; rowD.title = String(d.title).trim(); rowD.body = d.body || ''; rowD.when = d.when || '';
      rowD.pinned = isNst(me) ? !!d.pinned : truthy(rowD.pinned); rowD.updatedAt = now;
      writeRow('Dispatches', 'id', rowD);
      log(me, oldD ? 'edit dispatch' : 'add dispatch', rowD.title);
      return { id: rowD.id };
    }
    case 'deleteDispatch': {
      var dd = findRow('Dispatches', 'id', b.id);
      if (!dd) return {};
      if (!canWrite(me, dd.chapter)) throw new Error('That dispatch belongs to another chapter.');
      deleteRow('Dispatches', 'id', b.id);
      log(me, 'delete dispatch', dd.title);
      return {};
    }
    case 'saveCal': {
      var c = b.item || {}, oldC = c.id ? findRow('Calendar', 'id', c.id) : null;
      if (oldC && !canWrite(me, oldC.chapter)) throw new Error('That calendar entry belongs to another chapter.');
      if (!canWrite(me, c.chapter) || c.chapter === 'national' && !isNst(me)) throw new Error('You can only add events for your own chapter.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(c.date || ''))) throw new Error('A calendar entry needs a date.');
      if (!String(c.name || '').trim()) throw new Error('A calendar entry needs a name.');
      var rowC = oldC || { id: newId('c') };
      // A leading apostrophe keeps Sheets from turning the date into a time zone-shifted date value.
      rowC.date = "'" + c.date; rowC.chapter = c.chapter; rowC.name = String(c.name).trim(); rowC.link = c.link || ''; rowC.plan = c.plan || ''; rowC.evil = c.evil || '';
      rowC.updatedBy = me.name; rowC.updatedAt = now;
      writeRow('Calendar', 'id', rowC);
      log(me, oldC ? 'edit calendar' : 'add calendar', c.date + ' ' + rowC.name);
      return { id: rowC.id };
    }
    case 'deleteCal': {
      var cc = findRow('Calendar', 'id', b.id);
      if (!cc) return {};
      if (!canWrite(me, cc.chapter)) throw new Error('That calendar entry belongs to another chapter.');
      deleteRow('Calendar', 'id', b.id);
      log(me, 'delete calendar', cc.name);
      return {};
    }
    case 'saveRequest': {
      var q = b.item || {}, oldQ = q.id ? findRow('Requests', 'id', q.id) : null;
      if (oldQ && !(me.role === 'lead' || canWrite(me, oldQ.chapter) && oldQ.status === 'waiting')) throw new Error('Only the asking chapter can change a request, and only while it waits for an answer.');
      if (!canWrite(me, q.chapter) || q.chapter === 'national') throw new Error('You can only ask on behalf of your own chapter.');
      var affects = (q.affects || []).filter(function (x) { return CHAPTERS.indexOf(x) >= 0 && x !== q.chapter; });
      if (!affects.length) throw new Error('Pick at least one chapter the request affects.');
      if (!String(q.text || '').trim()) throw new Error('Say what you are asking.');
      var rowQ = oldQ || { id: newId('q'), status: 'waiting', reply: '', comments: '[]', createdBy: me.name, createdAt: now };
      rowQ.chapter = q.chapter; rowQ.affects = affects.join(','); rowQ.text = String(q.text).trim();
      writeRow('Requests', 'id', rowQ);
      log(me, oldQ ? 'edit request' : 'add request', rowQ.chapter + ' → ' + rowQ.affects);
      return { id: rowQ.id };
    }
    case 'commentRequest': {
      var rq = findRow('Requests', 'id', b.id);
      if (!rq || !involved(me, rq)) throw new Error('That request is not one of yours.');
      if (!String(b.text || '').trim()) throw new Error('Write a comment first.');
      var cm = safeJSON(rq.comments, []);
      cm.push({ by: me.name, text: String(b.text).trim(), at: now });
      rq.comments = JSON.stringify(cm);
      writeRow('Requests', 'id', rq);
      log(me, 'comment request', rq.id);
      return {};
    }
    case 'decideRequest': {
      if (me.role !== 'lead') throw new Error('Only the NST Lead can decide a chapter request.');
      var dq = findRow('Requests', 'id', b.id);
      if (!dq) throw new Error('That request no longer exists.');
      if (REQUEST_STATUS.indexOf(b.status) < 0) throw new Error('Unknown decision ' + b.status);
      dq.status = b.status; dq.reply = b.reply || ''; dq.decidedBy = b.status === 'waiting' ? '' : me.name; dq.decidedAt = b.status === 'waiting' ? '' : now;
      writeRow('Requests', 'id', dq);
      log(me, 'decide request', dq.id + ' ' + b.status);
      return {};
    }
    case 'deleteRequest': {
      var xq = findRow('Requests', 'id', b.id);
      if (!xq) return {};
      if (!(me.role === 'lead' || canWrite(me, xq.chapter) && xq.status === 'waiting')) throw new Error('Only the asking chapter can withdraw a request, and only while it waits for an answer.');
      deleteRow('Requests', 'id', b.id);
      log(me, 'delete request', xq.id);
      return {};
    }
  }
  throw new Error('Unknown action ' + b.action);
}

/* ---------- Reading ---------- */
function load(me) {
  var rank = ROLE_RANK[me.role] || 0;
  var events = readRows('Events').filter(function (r) { return r.id && (VIS_RANK[r.visibility || 'public'] || 0) <= rank; }).map(rowToEvent);
  var sites = readRows('Sites').filter(function (r) { return r.id; }).map(function (r) {
    var site = { id: r.id, region: r.region, name: r.name, x: r.x === '' ? undefined : num(r.x), y: r.y === '' ? undefined : num(r.y), note: r.note || '', hidden: truthy(r.hidden), custom: truthy(r.custom) };
    if (rank >= 1) site.story = r.story || '';
    return site;
  });
  var notes = {};
  readRows('Notes').forEach(function (r) {
    if (!r.region) return;
    notes[r.region] = { 'public': r['public'] || '', updatedBy: r.updatedBy || '', updatedAt: iso(r.updatedAt) };
    if (rank >= 1) notes[r.region].story = r.story || '';
  });
  var pos = findRow('Settings', 'key', 'positions'), notice = findRow('Settings', 'key', 'notice'), regions = findRow('Settings', 'key', 'regions'), danger = findRow('Settings', 'key', 'danger');
  var settings = { regions: regions ? safeJSON(regions.value, {}) : {} };
  if (notice) settings.notice = safeJSON(notice.value, null) || undefined;
  if (danger) settings.danger = safeJSON(danger.value, {});
  var turns = findRow('Settings', 'key', 'turns');
  if (turns) settings.turns = safeJSON(turns.value, {});
  var cal = findRow('Settings', 'key', 'calendar');
  if (cal) settings.calendar = safeJSON(cal.value, {});
  var dispatches = readRows('Dispatches').filter(function (r) { return r.id; }).map(function (r) {
    return { id: String(r.id), chapter: r.chapter, title: r.title, body: r.body || '', when: String(r.when || ''), pinned: truthy(r.pinned), createdBy: r.createdBy || '', createdAt: iso(r.createdAt), updatedAt: iso(r.updatedAt) };
  });
  var calendar = readRows('Calendar').filter(function (r) { return r.id && r.date; }).map(function (r) {
    var c = { id: String(r.id), date: dateStr(r.date), chapter: r.chapter, name: r.name, link: r.link || '' };
    if (rank >= 1) { c.plan = r.plan || ''; c.evil = r.evil || ''; c.updatedBy = r.updatedBy || ''; }
    return c;
  });
  var requests = rank < 1 ? [] : readRows('Requests').filter(function (r) { return r.id && involved(me, r); }).map(function (r) {
    return { id: String(r.id), chapter: r.chapter, affects: String(r.affects || '').split(',').filter(function (x) { return x; }), text: r.text || '', status: r.status || 'waiting', reply: r.reply || '',
      comments: safeJSON(r.comments, []), createdBy: r.createdBy || '', createdAt: iso(r.createdAt), decidedBy: r.decidedBy || '', decidedAt: iso(r.decidedAt) };
  });
  return { me: { role: me.role, name: me.name, chapters: me.chapters }, events: events, sites: sites, notes: notes, positions: pos ? safeJSON(pos.value, {}) : {}, settings: settings,
    dispatches: dispatches, calendar: calendar, requests: requests };
}
function viewer() { return { role: 'viewer', name: '', chapters: [] }; }
function auth(code) {
  if (!code) return null;
  code = String(code).trim();
  var rows = readRows('Reps');
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (String(r.code).trim() !== code || r.active === false || String(r.active).toUpperCase() === 'FALSE') continue;
    var role = String(r.role || 'rep').toLowerCase().trim();
    if (/^nst[\s_-]*team$/.test(role)) role = 'nst';
    if (/^nst[\s_-]*lead$/.test(role)) role = 'lead';
    if (/^nst[\s_-]*rep$/.test(role)) role = 'rep';
    if (!ROLE_RANK.hasOwnProperty(role) || role === 'viewer') role = 'rep';
    var ch = String(r.chapters || '').toLowerCase().trim();
    return { role: role, name: r.name || 'Rep', chapters: ch === 'all' ? CHAPTERS.slice() : ch.split(/[\s,;]+/).filter(function (x) { return x; }) };
  }
  return null;
}
function isNst(me) { return me.role === 'nst' || me.role === 'lead'; }
function canEditChapter(me, chapter) { return isNst(me) || (me.role === 'rep' && me.chapters.indexOf(chapter) >= 0); }
function canEditRegion(me, region) { return canEditChapter(me, region); }
/* Dispatches, calendar entries and requests: story teams and reps for their own chapters, the NST Team for any. */
function canWrite(me, chapter) { return isNst(me) || ((me.role === 'story' || me.role === 'rep') && me.chapters.indexOf(chapter) >= 0); }
function involved(me, req) {
  if (isNst(me)) return true;
  var all = [req.chapter].concat(Array.isArray(req.affects) ? req.affects : String(req.affects || '').split(','));
  return all.some(function (c) { return me.chapters.indexOf(c) >= 0; });
}
function checkTiers(me, changes) {
  if (isNst(me)) return;
  changes.forEach(function (c) {
    if ((c.type === 'set' || c.type === 'move') && +c.tier >= 4) throw new Error('Tier 4 and 5 appearances need Brett or Andrew. Ask the NST Team to record this one.');
    if (c.type === 'threat' && c.kind === 'lesser' && +c.tier > LESSER_MAX) throw new Error('Lesser Evils stop at tier 3. The NST Team decides anything beyond that.');
  });
}
/* Entries saved before turns existed are each their own turn, keyed by their order. */
function turnKeyOf(r) { return r.turn === '' || r.turn === undefined || r.turn === null ? num(r.order) : num(r.turn); }
function openTurn() {
  var m = 0; readRows('Events').forEach(function (r) { if (r.id) m = Math.max(m, turnKeyOf(r)); });
  var t = findRow('Settings', 'key', 'turns'), open = t ? safeJSON(t.value, {}).open : undefined;
  return open === undefined || open === null ? m : Math.max(m, num(open));
}
function nextOrder() { var m = -1; readRows('Events').forEach(function (r) { m = Math.max(m, num(r.order)); }); return m + 1; }

/* ---------- Sheet helpers ---------- */
var CHECKED = {};
function sheet(name) {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(name);
  // Tabs added in later versions of this script are created the first time they're needed.
  if (!sh && TABS[name] && ss.getSheetByName('Events')) { sh = ss.insertSheet(name); sh.appendRow(TABS[name]); sh.setFrozenRows(1); }
  if (!sh) throw new Error('Run setup() first: the ' + name + ' tab is missing.');
  // Sheets made by an older version of this script get any new columns added on first use.
  if (!CHECKED[name] && TABS[name] && sh.getLastRow() > 0) {
    CHECKED[name] = true;
    var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var missing = TABS[name].filter(function (h) { return head.indexOf(h) < 0; });
    if (missing.length) sh.getRange(1, head.length + 1, 1, missing.length).setValues([missing]);
  }
  return sh;
}
function readRows(name) {
  var sh = sheet(name), last = sh.getLastRow();
  if (last < 2) return [];
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  return sh.getRange(2, 1, last - 1, head.length).getValues().map(function (v) { var o = {}; head.forEach(function (h, i) { o[h] = v[i]; }); return o; });
}
function findRow(name, key, val) { var rows = readRows(name); for (var i = 0; i < rows.length; i++) if (String(rows[i][key]) === String(val)) return rows[i]; return null; }
function writeRow(name, key, obj) {
  var sh = sheet(name), head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var vals = head.map(function (h) { var v = obj[h]; return v === undefined || v === null ? '' : v; });
  var last = sh.getLastRow(), col = head.indexOf(key) + 1;
  if (last >= 2) {
    var keys = sh.getRange(2, col, last - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) if (String(keys[i][0]) === String(obj[key])) { sh.getRange(i + 2, 1, 1, vals.length).setValues([vals]); return; }
  }
  sh.appendRow(vals);
}
function deleteRow(name, key, val) {
  var sh = sheet(name), head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0], col = head.indexOf(key) + 1, last = sh.getLastRow();
  if (last < 2) return;
  var keys = sh.getRange(2, col, last - 1, 1).getValues();
  for (var i = keys.length - 1; i >= 0; i--) if (String(keys[i][0]) === String(val)) sh.deleteRow(i + 2);
}
function eventToRow(ev) {
  return { id: ev.id, order: num(ev.order), turn: ev.turn === undefined || ev.turn === null || ev.turn === '' ? '' : num(ev.turn), title: ev.title || '', when: ev.when || '', chapter: ev.chapter || 'national', visibility: ev.visibility || 'story', summary: ev.summary || '',
    changes: JSON.stringify(ev.changes || []), example: !!ev.example, createdAt: ev.createdAt || new Date().toISOString(), updatedBy: ev.updatedBy || '', updatedAt: ev.updatedAt || '' };
}
function rowToEvent(r) {
  return { id: String(r.id), order: num(r.order), turn: r.turn === '' || r.turn === undefined ? undefined : num(r.turn), title: r.title, when: String(r.when || ''), chapter: r.chapter || 'national', visibility: r.visibility || 'public', summary: r.summary || '',
    changes: safeJSON(r.changes, []), example: r.example === true || r.example === 'TRUE', createdAt: iso(r.createdAt), updatedBy: r.updatedBy || '', updatedAt: iso(r.updatedAt) };
}
function log(me, action, detail) { try { sheet('Log').appendRow([new Date(), me.name, action, String(detail || '').slice(0, 200)]); } catch (e) {} }
function safeJSON(s, d) { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } }
function truthy(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function num(v) { var n = Number(v); return isNaN(n) ? 0 : n; }
function newId(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function dateStr(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v || '').replace(/^'/, '').slice(0, 10);
}
function iso(v) { return v instanceof Date ? v.toISOString() : String(v || ''); }
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
