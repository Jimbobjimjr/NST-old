/**
 * Abandoned Lands War Map: story sheet backend.
 *
 * Paste this whole file into Extensions > Apps Script on a new Google Sheet,
 * run setup() once, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone). Put the web app URL in config.js.
 *
 * Tabs it uses:
 *   Events   one row per story event; `changes` holds the map changes as JSON
 *   Sites    places reps add or move on their region maps
 *   Notes    the "current situation" text for each region
 *   Reps     who can edit: code, name, role (story | rep | nst | lead), chapters
 *   Settings map layout, the region map notice, renamed places
 *   Log      every change, who made it and when
 */

var TABS = {
  Events: ['id', 'order', 'title', 'when', 'chapter', 'visibility', 'summary', 'changes', 'example', 'createdAt', 'updatedBy', 'updatedAt'],
  Sites: ['id', 'region', 'name', 'x', 'y', 'note', 'story', 'hidden', 'custom', 'updatedBy', 'updatedAt'],
  Notes: ['region', 'public', 'story', 'updatedBy', 'updatedAt'],
  Reps: ['code', 'name', 'role', 'chapters', 'active'],
  Settings: ['key', 'value'],
  Log: ['time', 'who', 'action', 'detail']
};
var CHAPTERS = ['ritterstein', 'kreigstor', 'bracken', 'eisendreieck', 'sudenburg', 'stromstadt', 'braylong', 'handelsdorf', 'weitnordlich', 'helsreik', 'reefwatch'];
var VIS_RANK = { 'public': 0, story: 1, nst: 2 };
var ROLE_RANK = { viewer: 0, story: 1, rep: 2, nst: 2, lead: 2 };
var LESSER_MAX = 3;

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
    sheet('Reps').appendRow([code, 'NST lead', 'nst', 'all', true]);
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
  if (me.role === 'story' && body.action !== 'saveSite') return json({ ok: false, error: 'Story team codes can add details to places, but not change the story.' });
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
      if (!isNst(me)) throw new Error('Only the NST can reorder the story.');
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
        if (named && !custom && me.role !== 'lead') throw new Error('Only the NST lead can rename the map\'s own places.');
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
      if (!isNst(me)) throw new Error('Only the NST can rearrange the main map.');
      writeRow('Settings', 'key', { key: 'positions', value: JSON.stringify(b.positions || {}) });
      log(me, 'layout', '');
      return {};
    }
    case 'saveSetting': {
      if (b.key === 'notice') { if (!isNst(me)) throw new Error('Only the NST can change the map notice.'); }
      else if (b.key === 'regions') { if (me.role !== 'lead') throw new Error('Only the NST lead can rename places on the map.'); }
      else throw new Error('Unknown setting ' + b.key);
      writeRow('Settings', 'key', { key: b.key, value: JSON.stringify(b.value === undefined ? null : b.value) });
      log(me, 'setting', b.key);
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
  var pos = findRow('Settings', 'key', 'positions'), notice = findRow('Settings', 'key', 'notice'), regions = findRow('Settings', 'key', 'regions');
  var settings = { regions: regions ? safeJSON(regions.value, {}) : {} };
  if (notice) settings.notice = safeJSON(notice.value, null) || undefined;
  return { me: { role: me.role, name: me.name, chapters: me.chapters }, events: events, sites: sites, notes: notes, positions: pos ? safeJSON(pos.value, {}) : {}, settings: settings };
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
    if (!ROLE_RANK.hasOwnProperty(role) || role === 'viewer') role = 'rep';
    var ch = String(r.chapters || '').toLowerCase().trim();
    return { role: role, name: r.name || 'Rep', chapters: ch === 'all' ? CHAPTERS.slice() : ch.split(/[\s,;]+/).filter(function (x) { return x; }) };
  }
  return null;
}
function isNst(me) { return me.role === 'nst' || me.role === 'lead'; }
function canEditChapter(me, chapter) { return isNst(me) || (me.role === 'rep' && me.chapters.indexOf(chapter) >= 0); }
function canEditRegion(me, region) { return canEditChapter(me, region); }
function checkTiers(me, changes) {
  if (isNst(me)) return;
  changes.forEach(function (c) {
    if ((c.type === 'set' || c.type === 'move') && +c.tier >= 4) throw new Error('Tier 4 and 5 appearances need Brett or Andrew. Ask the NST to record this one.');
    if (c.type === 'threat' && c.kind === 'lesser' && +c.tier > LESSER_MAX) throw new Error('Lesser Evils stop at tier 3. The NST decides anything beyond that.');
  });
}
function nextOrder() { var m = -1; readRows('Events').forEach(function (r) { m = Math.max(m, num(r.order)); }); return m + 1; }

/* ---------- Sheet helpers ---------- */
var CHECKED = {};
function sheet(name) {
  var sh = SpreadsheetApp.getActive().getSheetByName(name);
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
  return { id: ev.id, order: num(ev.order), title: ev.title || '', when: ev.when || '', chapter: ev.chapter || 'national', visibility: ev.visibility || 'story', summary: ev.summary || '',
    changes: JSON.stringify(ev.changes || []), example: !!ev.example, createdAt: ev.createdAt || new Date().toISOString(), updatedBy: ev.updatedBy || '', updatedAt: ev.updatedAt || '' };
}
function rowToEvent(r) {
  return { id: String(r.id), order: num(r.order), title: r.title, when: String(r.when || ''), chapter: r.chapter || 'national', visibility: r.visibility || 'public', summary: r.summary || '',
    changes: safeJSON(r.changes, []), example: r.example === true || r.example === 'TRUE', updatedBy: r.updatedBy || '', updatedAt: iso(r.updatedAt) };
}
function log(me, action, detail) { try { sheet('Log').appendRow([new Date(), me.name, action, String(detail || '').slice(0, 200)]); } catch (e) {} }
function safeJSON(s, d) { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } }
function truthy(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function num(v) { var n = Number(v); return isNaN(n) ? 0 : n; }
function iso(v) { return v instanceof Date ? v.toISOString() : String(v || ''); }
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
