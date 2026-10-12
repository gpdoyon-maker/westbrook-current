// The 12 event categories. Keep this list identical to CATEGORIES in Code.gs (Google Apps Script).
export const categories = [
  'Arts & music',
  'Community & civic',
  'Classes & learning',
  'Family & kids',
  'Food & drink',
  'Health & wellness',
  'Markets & shopping',
  'Outdoors & nature',
  'Sports & recreation',
  'Seniors',
  'Faith & spirituality',
  'Other',
] as const;

// Same colors the Events page uses for its category dot and left border.
export const categoryColors: Record<string, string> = {
  'Arts & music': '#8b6fb3',
  'Community & civic': '#3b6e91',
  'Classes & learning': '#a47726',
  'Family & kids': '#c0765a',
  'Food & drink': '#a14e4e',
  'Health & wellness': '#347c60',
  'Markets & shopping': '#8c7a4e',
  'Outdoors & nature': '#4b784b',
  'Sports & recreation': '#3e7ca6',
  Seniors: '#71627f',
  'Faith & spirituality': '#896b95',
  Other: '#6e6e6e',
};
