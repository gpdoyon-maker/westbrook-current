/**
 * Westbrook Currents - Maine Veterans Remembered feed (Google Apps Script web app)
 *
 * Sends the website ONLY the rows Gerry has marked "Approved" in the
 * Veterans tab of the "Maine Veteran Obituaries" Sheet. Pending and
 * Rejected rows, Confidence, Source and the Notes column never leave the Sheet.
 * (The one exception: a Maine Guard unit written at the START of Notes,
 * such as "265th CBCS; ...", is turned into its full unit name for the page.)
 *
 * Setup (once):
 *   1. Open the Veteran Obituaries Sheet > Extensions > Apps Script. Paste this file over Code.gs. Save.
 *   2. Deploy > New deployment > type "Web app". Execute as: Me. Who has access: Anyone. Deploy.
 *      Approve the permissions when asked. Copy the Web app URL.
 *   3. Give that URL to Claude, who puts it in site/src/lib/veterans-config.ts.
 * After any later code change: Deploy > Manage deployments > edit > New version > Deploy.
 * The onEdit function below needs no setup; it runs on its own when the Sheet is edited by hand.
 *
 * No secrets are needed. Everything sent comes from public obituaries.
 */

var SHEET_ID = '1UtYMwmq9c5L1dOdj5LLQCLje7wrwGrkCvZ9zbDZ7tHs';
var SHEET_NAME = 'Veterans';
var CACHE_SECONDS = 600; // 10 minutes: approvals show up on the page within 10 minutes
var CACHE_KEY = 'veterans_v2';
var STATUS_COL = 11;      // K
var APPROVED_ON_COL = 13; // M

// Short unit names (as the scheduled task writes them at the start of Notes) -> full names.
var UNITS = [
  [/^101st\s*ARW\b/i, '101st Air Refueling Wing'],
  [/^265th\s*(CBCS|CCS)\b/i, '265th Combat Communications Squadron'],
  [/^243rd\s*EIS\b/i, '243rd Engineering Installation Squadron'],
  [/^133rd\s*Eng(ineer)?\.?\s*(Bn|Battalion)\b/i, '133rd Engineer Battalion']
];

function doGet() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(CACHE_KEY);
  if (cached) return out_(cached);

  var body = JSON.stringify(build_());
  if (body.length < 90000) cache.put(CACHE_KEY, body, CACHE_SECONDS);
  return out_(body);
}

function build_() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  var values = sheet.getDataRange().getValues();
  var tz = Session.getScriptTimeZone();
  var rows = [];
  var liveDates = [];

  // Columns: A Name, B Age, C Date of Death, D Branch, E Town, F Funeral Home,
  // G Obituary Link, H Source, I Date Added, J Confidence, K Status, L Notes, M Approved On
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (String(r[10]).trim() !== 'Approved') continue;
    var name = String(r[0]).trim();
    var died = dateText_(r[2], tz);
    if (!name || !died) continue;

    var live = dateText_(r[12], tz) || dateText_(r[8], tz);
    if (live) liveDates.push(live);

    var link = String(r[6]).trim();
    if (!/^https:\/\//i.test(link)) link = '';

    rows.push({
      name: name,
      age: (r[1] === '' || isNaN(Number(r[1]))) ? null : Number(r[1]),
      died: died,
      branches: String(r[3]).split(';').map(function (b) { return b.trim(); }).filter(String),
      town: String(r[4]).trim(),
      funeralHome: String(r[5]).trim(),
      link: link,
      unit: unit_(String(r[11]))
    });
  }

  rows.sort(function (a, b) { return a.died < b.died ? 1 : a.died > b.died ? -1 : 0; });

  // "Last updated" = the most recent day a veteran went live, and how many went live that day.
  // A row goes live on its Approved On date (column M, stamped by onEdit when Gerry approves
  // by hand), or else its Date Added (column I, when the search approved it itself).
  var updated = '';
  var added = 0;
  for (var j = 0; j < liveDates.length; j++) {
    if (liveDates[j] > updated) { updated = liveDates[j]; added = 1; }
    else if (liveDates[j] === updated) added++;
  }
  return { ok: true, updated: updated, added: added, rows: rows };
}

// Runs by itself whenever someone edits the Sheet by hand. When a Status cell (column K) on the
// Veterans tab is changed to "Approved", it writes today's date in Approved On (column M) and
// clears the page's 10-minute cache so the change shows right away. Changing a row away from
// Approved clears its Approved On date. (Edits made by the scheduled search don't trigger this;
// its own approvals use Date Added instead.)
function onEdit(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_NAME) return;
  var firstCol = e.range.getColumn();
  var lastCol = firstCol + e.range.getNumColumns() - 1;
  if (STATUS_COL < firstCol || STATUS_COL > lastCol) return;

  var firstRow = Math.max(e.range.getRow(), 2);
  var lastRow = e.range.getRow() + e.range.getNumRows() - 1;
  if (lastRow < firstRow) return;
  var n = lastRow - firstRow + 1;
  var status = sheet.getRange(firstRow, STATUS_COL, n, 1).getValues();
  var stamp = sheet.getRange(firstRow, APPROVED_ON_COL, n, 1);
  var stamps = stamp.getValues();
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var changed = false;
  for (var i = 0; i < n; i++) {
    var approved = String(status[i][0]).trim() === 'Approved';
    if (approved && stamps[i][0] === '') { stamps[i][0] = today; changed = true; }
    if (!approved && stamps[i][0] !== '') { stamps[i][0] = ''; changed = true; }
  }
  if (changed) stamp.setNumberFormat('@').setValues(stamps);
  try { CacheService.getScriptCache().remove(CACHE_KEY); } catch (err) {}
}

function unit_(notes) {
  var first = notes.split(';')[0].trim();
  for (var i = 0; i < UNITS.length; i++) {
    if (UNITS[i][0].test(first)) return UNITS[i][1];
  }
  return '';
}

function dateText_(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  var s = String(v).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function out_(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}

// Run this from the editor (select "testFeed", press Run) to check the output in the Execution log.
function testFeed() {
  Logger.log(JSON.stringify(build_(), null, 2));
}
