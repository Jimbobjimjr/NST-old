// Minimal Google Apps Script fakes so Code.gs runs in Node.
const vm = require('vm'), fs = require('fs');
module.exports = function makeGas(path) {
  const sheets = {};
  const mkSheet = name => {
    const rows = [];
    const sh = {
      name, rows,
      getLastRow: () => rows.length,
      getLastColumn: () => Math.max(0, ...rows.map(r => r.length)),
      appendRow: v => rows.push(v.slice()),
      setName(n) { delete sheets[sh.name]; sh.name = n; sheets[n] = sh; },
      setFrozenRows() {}, deleteRow: i => rows.splice(i - 1, 1),
      getRange: (r, c, nr = 1, nc = 1) => ({
        getValues: () => rows.slice(r - 1, r - 1 + nr).map(row => Array.from({ length: nc }, (_, j) => row[c - 1 + j] ?? '')),
        setValues: vals => vals.forEach((v, i) => { rows[r - 1 + i] = rows[r - 1 + i] || []; v.forEach((x, j) => rows[r - 1 + i][c - 1 + j] = x); }),
        setFontWeight() { return this; },
        getValue: () => (rows[r - 1] || [])[c - 1] ?? '',
      }),
    };
    return sh;
  };
  const ss = { getSheets: () => Object.values(sheets), getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = mkSheet(n)), deleteSheet: s => delete sheets[s.name] };
  const ctx = {
    SpreadsheetApp: { getActive: () => ss },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ s, setMimeType() { return this; } }) },
    Utilities: { getUuid: () => 'abcdef1234567890' },
    Logger: { log: m => console.log('[gas]', m) },
    console, Date, JSON, Math, String, Number, Object, Array, isNaN,
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path, 'utf8'), ctx);
  return { ctx, sheets, mkSheet, get: q => JSON.parse(ctx.doGet({ parameter: q }).s), post: body => JSON.parse(ctx.doPost({ postData: { contents: body } }).s) };
};
