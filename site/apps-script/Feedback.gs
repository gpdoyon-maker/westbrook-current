/**
 * Westbrook Currents - Feedback receiver (Google Apps Script web app)
 *
 * Saves each feedback message as a new row in the private "Feedback" Sheet and
 * emails the owner a short alert. Separate from the event-submission script,
 * so a problem here can never affect events.
 *
 * Setup (once):
 *  1. Open the Feedback Sheet > Extensions > Apps Script. Paste this file over Code.gs. Save.
 *  2. Project Settings (gear) > Script Properties > Add:
 *       TURNSTILE_SECRET = the same Cloudflare Turnstile SECRET key the event script uses.
 *  3. Deploy > New deployment > type "Web app". Execute as: Me. Who has access: Anyone. Deploy.
 *     Approve the permissions when asked. Copy the Web app URL.
 *  4. Give that URL to Claude, who puts it in site/src/lib/feedback-config.ts.
 *  After any later code change: Deploy > Manage deployments > edit > New version > Deploy.
 *
 * Never put the secret key in this file.
 */

var SHEET_ID = '1nyYWrmhnEYkxKDSB1PWyh0_kCEfSOfvcwqWjlW_XINc';
var SHEET_NAME = 'Feedback';
var TYPES = ['Comment', 'Question', 'Concern', 'Report wrong info'];
var MAX_PER_HOUR = 40; // overall cap, a safety valve against floods

function doGet() {
  return json_({ ok: true, message: 'Westbrook Currents feedback receiver.' });
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action !== 'feedback') return json_({ ok: false, message: 'Unknown request.' });

    // Spam traps: hidden field filled in, or sent faster than a person can type.
    if (body.hp) return json_({ ok: true });
    if (!body.loadedAt || Date.now() - Number(body.loadedAt) < 4000) {
      return json_({ ok: false, message: 'That was too fast. Please take a moment and try again.' });
    }

    var type = String(body.type || '');
    var message = String(body.message || '').trim();
    if (TYPES.indexOf(type) === -1) return json_({ ok: false, message: 'Please choose what this is about.' });
    if (message.length < 5) return json_({ ok: false, message: 'Please write a short message.' });
    if (message.length > 1000) return json_({ ok: false, message: 'Please keep your message under 1000 characters.' });
    var email = String(body.email || '').trim().slice(0, 120);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json_({ ok: false, message: 'That email address does not look right. You can also leave it blank.' });
    }

    if (!verifyTurnstile_(body.turnstileToken)) {
      return json_({ ok: false, message: 'The security check did not pass. Please reload the page and try again.' });
    }
    if (!underLimit_()) {
      return json_({ ok: false, message: 'We are getting a lot of messages right now. Please try again later.' });
    }

    var name = String(body.name || '').trim().slice(0, 80);
    var page = String(body.page || '').trim().slice(0, 120);
    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    var received = Utilities.formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd HH:mm');
    sheet.appendRow([received, type, safe_(message), safe_(name), safe_(email), safe_(page), 'New', '', '']);

    try {
      MailApp.sendEmail(
        Session.getEffectiveUser().getEmail(),
        'New Westbrook Currents feedback: ' + type,
        type + ' received ' + received + '.\n\nOpen the Feedback Sheet to read it:\n' +
          SpreadsheetApp.openById(SHEET_ID).getUrl()
      );
    } catch (mailErr) { /* the row is saved; a missed alert is not fatal */ }

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, message: 'Something went wrong. Please try again.' });
  }
}

// Stops a spreadsheet from treating typed text as a formula.
function safe_(v) {
  v = String(v);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function verifyTurnstile_(token) {
  var secret = PropertiesService.getScriptProperties().getProperty('TURNSTILE_SECRET');
  if (!secret || !token) return false;
  var res = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'post',
    payload: { secret: secret, response: String(token) },
    muteHttpExceptions: true
  });
  try { return JSON.parse(res.getContentText()).success === true; } catch (e) { return false; }
}

function underLimit_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var cache = CacheService.getScriptCache();
    var count = Number(cache.get('fb_count') || 0);
    if (count >= MAX_PER_HOUR) return false;
    cache.put('fb_count', String(count + 1), 3600);
    return true;
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
