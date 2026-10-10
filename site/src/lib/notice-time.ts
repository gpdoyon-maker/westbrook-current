// Time helpers for notices and alerts. All dates and times in notices.json are
// Westbrook (America/New_York) wall-clock values; these helpers turn them into
// absolute instants so visibility can be checked in the visitor's browser.

export const NOTICE_TIME_ZONE = 'America/New_York';

const wallFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: NOTICE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Accepts YYYY-MM-DD or M/D/YYYY. Returns YYYY-MM-DD, or '' when missing or not a real date. */
export function normalizeDate(value: unknown): string {
  const text = String(value ?? '').trim();
  let year = '';
  let month = '';
  let day = '';
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (match) {
    [, year, month, day] = match;
  } else if ((match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text))) {
    [, month, day, year] = match;
  } else {
    return '';
  }
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return '';
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Accepts H:mm, HH:mm, HH:mm:ss, or 12-hour times such as "10:00 AM". Returns HH:mm, or '' when missing or invalid. */
export function normalizeTime(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i.exec(text);
  if (!match) return '';
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toLowerCase();
  if (minutes > 59) return '';
  if (meridiem) {
    if (hours < 1 || hours > 12) return '';
    hours = (hours % 12) + (meridiem === 'pm' ? 12 : 0);
  } else if (hours > 23) {
    return '';
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** A date plus a time, as "YYYY-MM-DD HH:mm". Returns '' unless both parts are valid. */
export function normalizePosted(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const [datePart, ...rest] = text.split(/[ T]+/);
  const date = normalizeDate(datePart);
  const time = normalizeTime(rest.join(' '));
  return date && time ? `${date} ${time}` : '';
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** The instant (ms since epoch) at which the Westbrook wall clock reads the given date and HH:mm. */
export function nyToUtcMs(date: string, time: string): number {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const target = Date.UTC(year, month - 1, day, hours, minutes);
  let timestamp = target;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = Object.fromEntries(wallFormatter.formatToParts(new Date(timestamp)).map(({ type, value }) => [type, value]));
    const shown = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    timestamp += target - shown;
  }
  return timestamp;
}

/** Today's calendar date in Westbrook, as YYYY-MM-DD. */
export function newYorkDate(nowMs: number): string {
  const parts = Object.fromEntries(wallFormatter.formatToParts(new Date(nowMs)).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatClock(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
}

/** "Posted 6:10 AM" for today, "Posted Oct 9, 6:10 PM" for an earlier day. */
export function postedLabel(posted: string, nowMs: number): string {
  const [date, time] = posted.split(' ');
  if (!date || !time) return '';
  const clock = formatClock(time);
  if (date === newYorkDate(nowMs)) return `Posted ${clock}`;
  const [, month, day] = date.split('-').map(Number);
  return `Posted ${MONTHS[month - 1]} ${day}, ${clock}`;
}
