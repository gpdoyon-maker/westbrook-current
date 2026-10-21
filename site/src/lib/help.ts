// Shared helpers for Get Help pages.
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-10-14" -> "Oct 14, 2026". Built by hand so the build machine's time zone cannot shift the day.
export const formatCheckedDate = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  return `${months[month - 1]} ${day}, ${year}`;
};

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Turns phone numbers inside a sentence into tappable tel: links.
// Matches (207) 553-5800, 207-591-7015, 800-452-4699 and 1-800-773-0387. Other text is escaped, not changed.
const phonePattern = /\(\d{3}\) \d{3}-\d{4}|(?:1-)?\d{3}-\d{3}-\d{4}/g;
export const linkPhones = (text: string) =>
  escapeHtml(text).replace(phonePattern, (shown) => {
    const digits = shown.replace(/\D/g, '');
    const full = digits.length === 10 ? `1${digits}` : digits;
    return `<a class="tel-inline" href="tel:+${full}">${shown}</a>`;
  });

export interface HelpProgram {
  id: string;
  tag: string;
  name: string;
  chip?: string;
  chipKind?: 'limit' | 'none' | 'info';
  summary: string;
  know?: string;
  phone?: string;
  phoneHref?: string;
  email?: string;
  sourceLabel: string;
  sourceUrl: string;
  last?: boolean;
  more?: { label: string; url: string };
}
