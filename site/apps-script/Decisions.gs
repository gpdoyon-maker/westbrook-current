/**
 * Decisions.gs  (Westbrook Currents)  v1.0.0
 *
 * Emails the person who submitted an event when you Approve or Reject it.
 *
 * HOW TO ADD IT
 *   Add this as a NEW file named Decisions in the same Apps Script project as Code.gs.
 *   Code.gs is not changed. This file uses a few helpers from Code.gs.
 *
 * HOW IT WORKS
 *   1. You set Status to Approved or Rejected on the Events tab, as you do now.
 *   2. For a Rejected event you may type ONE sentence in the "Reason for Submitter"
 *      column (AD). Type it BEFORE you set Status to Rejected. If you leave it blank,
 *      a standard sentence is used.
 *   3. Every 15 minutes this script finds decided events it has not emailed yet,
 *      sends the email, and writes what it did in the "Decision Email" column (AE).
 *
 * WHO GETS AN EMAIL
 *   Only events submitted through the website form AND confirmed by email link.
 *   Events found by the harvester, and events from trusted submitters that were
 *   approved automatically, get no email.
 *   Each event is emailed once. To send one again, clear its cell in column AE.
 *
 * ONE-TIME SETUP (run each from the function drop-down, then press Run)
 *   1. testDecisionEmails      sends a sample of each email to YOU. Check the From line.
 *   2. setupDecisionEmails     adds the two columns, marks old rows as skipped,
 *                              and starts the 15-minute timer.
 *   To turn it off: run stopDecisionEmails.
 *
 * SENDING FROM westbrookcurrents@gmail.com
 *   If the script runs under gpdoyon@gmail.com, add westbrookcurrents@gmail.com in
 *   Gmail: Settings > See all settings > Accounts and Import > Send mail as >
 *   Add another email address. Gmail sends a code to that inbox. Until that is done
 *   this script refuses to send, so nothing goes out from the wrong address.
 */

const DECISION_FROM_EMAIL = 'westbrookcurrents@gmail.com';
const DECISION_SIGNER = 'Gerry';
const DECISION_COL_REASON = 30;   // AD
const DECISION_COL_SENT = 31;     // AE
const DECISION_DEFAULT_REASON = 'It does not fit what we list on the site right now.';
const DECISION_MAX_PER_RUN = 20;
const DECISION_TIMER_MINUTES = 15;

// ---- Main job (runs on the timer) ------------------------------------------
function sendDecisionEmails() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    const sheet = eventsSheet_();
    if (!sheet) return;
    const last = sheet.getLastRow();
    if (last < 2) return;
    const tz = Session.getScriptTimeZone();
    const width = Math.max(DECISION_COL_SENT, sheet.getLastColumn());
    const vals = sheet.getRange(2, 1, last - 1, width).getValues();

    let approved = 0, rejected = 0, skipped = 0, failed = 0, notSetUp = false;
    let quota = 100;
    try { quota = MailApp.getRemainingDailyQuota(); } catch (e) { /* ignore */ }

    for (let i = 0; i < vals.length; i++) {
      const r = vals[i];
      const rowNum = i + 2;
      const status = String(r[0]).trim();
      if (status !== 'Approved' && status !== 'Rejected') continue;
      if (String(r[COL_VERIFIED - 1]).indexOf('Yes (email link)') !== 0) continue;
      if (String(r[DECISION_COL_SENT - 1] || '').trim() !== '') continue;
      if ((approved + rejected) >= DECISION_MAX_PER_RUN || quota < 5) break;

      const sentCell = sheet.getRange(rowNum, DECISION_COL_SENT);
      const notes = String(r[COL_REVIEW_NOTES - 1] || '');
      if (status === 'Approved' && /auto-approved \(trusted/i.test(notes)) {
        sentCell.setValue('Skipped: trusted submitter, approved automatically');
        skipped++;
        continue;
      }
      const email = String(r[COL_EMAIL - 1] || '').trim();
      if (!isValidEmail_(email.toLowerCase())) {
        sentCell.setValue('Skipped: no valid email address');
        skipped++;
        continue;
      }

      const title = cleanText_(r[3], 120) || 'your event';
      const name = decisionFirstName_(r[17]);
      const dateText = decisionFriendlyDate_(r[4], tz);
      let msg;
      if (status === 'Approved') {
        msg = decisionApprovedEmail_(name, title, dateText);
      } else {
        const reason = decisionSentence_(cleanText_(r[DECISION_COL_REASON - 1], 250)) || DECISION_DEFAULT_REASON;
        msg = decisionRejectedEmail_(name, title, reason);
      }

      try {
        const from = sendDecisionMail_(email, msg.subject, msg.text, msg.html);
        const stamp = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd h:mm a');
        sentCell.setValue(status + ' email sent ' + stamp + ' from ' + from);
        if (status === 'Approved') approved++; else rejected++;
        quota--;
      } catch (err) {
        if (String(err && err.message).indexOf('NOT_SET_UP') === 0) { notSetUp = true; break; }
        sentCell.setValue('FAILED: ' + String(err).substring(0, 150) + ' (clear this cell to try again)');
        failed++;
      }
    }

    if (notSetUp) {
      Logger.log(DECISION_FROM_EMAIL + ' is not set up as a sender yet. No decision emails were sent.');
    }
    if (approved + rejected + skipped + failed > 0) {
      writeHarvestLogRow_({
        type: 'Decision emails',
        status: failed > 0 ? 'ERRORS' : 'OK',
        notes: approved + ' approval, ' + rejected + ' not-approved, ' + skipped + ' skipped, ' + failed + ' failed.'
      });
    }
  } finally {
    lock.releaseLock();
  }
}

// ---- Sending ----------------------------------------------------------------
/** Sends from DECISION_FROM_EMAIL or refuses. Returns the address it sent from. */
function sendDecisionMail_(to, subject, text, html) {
  const from = DECISION_FROM_EMAIL;
  let aliases = [];
  try { aliases = GmailApp.getAliases().map(function (a) { return String(a).toLowerCase(); }); } catch (e) { /* ignore */ }
  const me = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();

  if (me === from.toLowerCase()) {
    MailApp.sendEmail({ to: to, subject: subject, body: text, htmlBody: html, name: 'Westbrook Currents', replyTo: from });
    return from;
  }
  if (aliases.indexOf(from.toLowerCase()) >= 0) {
    GmailApp.sendEmail(to, subject, text, { from: from, name: 'Westbrook Currents', htmlBody: html, replyTo: from });
    return from;
  }
  throw new Error('NOT_SET_UP: ' + from + ' is not set up as a "Send mail as" address for ' + (me || 'this account') + '.');
}

// ---- Email wording ------------------------------------------------------------
function decisionApprovedEmail_(name, title, dateText) {
  const subject = 'Your event was approved: ' + title;
  const text = 'Hi ' + name + ',\n\n' +
    'Good news! "' + title + '" on ' + dateText + ' was approved. It will show on Westbrook Currents within a day.\n\n' +
    'If the date, time or place changes, just reply to this email and I will update it.\n\n' +
    'Thank you for sharing what is happening in Westbrook.\n\n' +
    '– ' + DECISION_SIGNER + '\nWestbrook Currents\n' + SITE_URL + '\n';
  const body =
    '<p>Hi ' + esc_(name) + ',</p>' +
    '<p>Good news! <b>' + esc_(title) + '</b> on ' + esc_(dateText) + ' was approved. It will show on Westbrook Currents within a day.</p>' +
    '<p>If the date, time or place changes, just reply to this email and I will update it.</p>' +
    '<p>Thank you for sharing what is happening in Westbrook.</p>' +
    '<p>– ' + esc_(DECISION_SIGNER) + '</p>';
  return { subject: subject, text: text, html: decisionWrapHtml_(body) };
}

function decisionRejectedEmail_(name, title, reason) {
  const submitUrl = SITE_URL + '/submit';
  const subject = 'About your event submission';
  const text = 'Hi ' + name + ',\n\n' +
    'Thank you for sending "' + title + '" to Westbrook Currents. I am not able to list it. ' + reason + '\n\n' +
    'You are welcome to send another event any time: ' + submitUrl + '\n\n' +
    'If you have a question, just reply to this email.\n\n' +
    '– ' + DECISION_SIGNER + '\nWestbrook Currents\n' + SITE_URL + '\n';
  const body =
    '<p>Hi ' + esc_(name) + ',</p>' +
    '<p>Thank you for sending <b>' + esc_(title) + '</b> to Westbrook Currents. I am not able to list it. ' + esc_(reason) + '</p>' +
    '<p>You are welcome to send another event any time: <a href="' + esc_(submitUrl) + '">' + esc_(submitUrl) + '</a></p>' +
    '<p>If you have a question, just reply to this email.</p>' +
    '<p>– ' + esc_(DECISION_SIGNER) + '</p>';
  return { subject: subject, text: text, html: decisionWrapHtml_(body) };
}

function decisionWrapHtml_(inner) {
  return '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a2a3a;line-height:1.5">' +
    '<div style="background:#002147;color:#ffffff;padding:16px 20px;font-size:20px;font-weight:bold">Westbrook Currents</div>' +
    '<div style="padding:20px;border:1px solid #d8e2ec;border-top:0">' + inner + '</div></div>';
}

// ---- Small helpers --------------------------------------------------------------
function decisionFirstName_(v) {
  const n = cleanText_(v, 60);
  return n ? n.split(' ')[0] : 'there';
}

/** Makes sure a typed reason reads as a sentence. Blank stays blank. */
function decisionSentence_(s) {
  const t = String(s || '').trim();
  if (!t) return '';
  return /[.!?]$/.test(t) ? t : t + '.';
}

/** Start Date can arrive as a Date or as text like 2026-10-18. */
function decisionFriendlyDate_(v, tz) {
  let d = null;
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    d = v;
  } else {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '').trim());
    if (m) d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), 12, 0, 0);
  }
  return d ? Utilities.formatDate(d, tz, 'EEEE, MMMM d') : String(v || 'the date you gave');
}

// ---- One-time setup and tests ---------------------------------------------------
/** Sends a sample of each email to YOU (NOTIFICATION_EMAIL). Nothing is sent to the public. */
function testDecisionEmails() {
  const tz = Session.getScriptTimeZone();
  const sampleDate = decisionFriendlyDate_(new Date(new Date().getTime() + 7 * 86400000), tz);
  const a = decisionApprovedEmail_('Gerry', 'Community Fall Festival (TEST)', sampleDate);
  const b = decisionRejectedEmail_('Gerry', 'Community Fall Festival (TEST)', 'This is a sample reason sentence.');
  let from;
  try {
    from = sendDecisionMail_(NOTIFICATION_EMAIL, a.subject, a.text, a.html);
    sendDecisionMail_(NOTIFICATION_EMAIL, b.subject, b.text, b.html);
  } catch (err) {
    const msg = 'The test email was NOT sent.\n\n' + String(err.message || err) +
      '\n\nFix: in Gmail, add ' + DECISION_FROM_EMAIL + ' under Settings > Accounts and Import > Send mail as. Then run this test again.';
    Logger.log(msg);
    try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* editor run: see the log */ }
    return;
  }
  const done = 'Sent 2 sample emails to ' + NOTIFICATION_EMAIL + ' from ' + from + '. Check the From line.';
  Logger.log(done);
  try { SpreadsheetApp.getUi().alert(done); } catch (e) { /* editor run: see the log */ }
}

/** Adds the two columns, marks existing decided rows as skipped, and starts the timer. Safe to run twice. */
function setupDecisionEmails() {
  const sheet = eventsSheet_();
  const hdr = sheet.getRange(1, DECISION_COL_REASON, 1, 2);
  hdr.setValues([['Reason for Submitter', 'Decision Email']])
    .setBackground('#002147').setFontColor('#ffffff').setFontWeight('bold');
  sheet.getRange(1, DECISION_COL_REASON).setNote(
    'Rejected events only. One short sentence the person will read in the email. ' +
    'Type it BEFORE you set Status to Rejected. Leave blank for a standard sentence.');
  sheet.getRange(1, DECISION_COL_SENT).setNote(
    'Filled in by the script after it emails the person. Clear a cell to send that email again.');
  sheet.setColumnWidth(DECISION_COL_REASON, 320);
  sheet.setColumnWidth(DECISION_COL_SENT, 260);

  // Anything decided before today is not emailed by the script.
  let marked = 0;
  const last = sheet.getLastRow();
  if (last >= 2) {
    const width = Math.max(DECISION_COL_SENT, sheet.getLastColumn());
    const vals = sheet.getRange(2, 1, last - 1, width).getValues();
    for (let i = 0; i < vals.length; i++) {
      const r = vals[i];
      const status = String(r[0]).trim();
      if (status !== 'Approved' && status !== 'Rejected') continue;
      if (String(r[COL_VERIFIED - 1]).indexOf('Yes (email link)') !== 0) continue;
      if (String(r[DECISION_COL_SENT - 1] || '').trim() !== '') continue;
      sheet.getRange(i + 2, DECISION_COL_SENT).setValue('Skipped: decided before decision emails began');
      marked++;
    }
  }

  installDecisionEmailTrigger_();
  const msg = 'Decision emails are on. Checked every ' + DECISION_TIMER_MINUTES + ' minutes. ' +
    marked + ' earlier decision(s) were marked as skipped.';
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* editor run: see the log */ }
}

function installDecisionEmailTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendDecisionEmails') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendDecisionEmails').timeBased().everyMinutes(DECISION_TIMER_MINUTES).create();
}

/** Turns the timer off. Run setupDecisionEmails to turn it back on. */
function stopDecisionEmails() {
  let n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendDecisionEmails') { ScriptApp.deleteTrigger(t); n++; }
  });
  const msg = 'Decision emails are off (' + n + ' timer removed).';
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* editor run: see the log */ }
}
