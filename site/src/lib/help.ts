// Shared helpers for Get Help pages.
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-10-14" -> "Oct 14, 2026". Built by hand so the build machine's time zone cannot shift the day.
export const formatCheckedDate = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  return `${months[month - 1]} ${day}, ${year}`;
};

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
  sourceLabel: string;
  sourceUrl: string;
  last?: boolean;
}
