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
 *
 * No secrets are needed. Everything sent comes from public obituaries.
 */

var SHEET_ID = '1UtYMwmq9c5L1dOdj5LLQCLje7wrwGrkCvZ9zbDZ7tHs';
var SHEET_NAME = 'Veterans';
var CACHE_SECONDS = 600; // 10 minutes: approvals show up on the page within 10 minutes

// Short unit names (as the scheduled task writes them at the start of Notes) -> full names.
var UNITS = [
  [/^101st\s*ARW\b/i, '101st Air Refueling Wing'],
  [/^265th\s*(CBCS|CCS)\b/i, '265th Combat Communications Squadron'],
  [/^243rd\s*EIS\b/i, '243rd Engineering Installation Squadron'],
  [/^133rd\s*Eng(ineer)?\.?\s*(Bn|Battalion)\b/i, '133rd Engineer Battalion']
];

function doGet() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('veterans_v1');
  if (cached) return out_(cached);

  var body = JSON.stringify(build_());
  if (body.length < 90000) cache.put('veterans_v1', body, CACHE_SECONDS);
  return out_(body);
}

function build_() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  var values = sheet.getDataRange().getValues();
  var tz = Session.getScriptTimeZone();
  var rows = [];

  // Columns: A Name, B Age, C Date of Death, D Branch, E Town, F Funeral Home,
  // G Obituary Link, H Source, I Date Added, J Confidence, K Status, L Notes
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (String(r[10]).trim() !== 'Approved') continue;
    var name = String(r[0]).trim();
    var died = dateText_(r[2], tz);
    if (!name || !died) continue;

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
  return { ok: true, updated: Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'), rows: rows };
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
