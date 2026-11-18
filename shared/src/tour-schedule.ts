// The body editor accepts at most 500 blocks. Never expand a typo in archived
// dates into more itinerary headings than the editor could save.
export const maxItineraryDays = 500;
const dayMs = 86_400_000;

function isoDay(value: string) {
  const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  const iso = local ? [local[3], local[2]!.padStart(2, '0'), local[1]!.padStart(2, '0')].join('-') : value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const time = Date.parse(iso + 'T00:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === iso ? iso : null;
}

export function tourRange(dates: string) {
  const pair = /^\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})\s*[-–—]\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})\s*$/.exec(dates);
  if (!pair) return null;
  const first = isoDay(pair[1]!), last = isoDay(pair[2]!);
  if (!first || !last) return null;
  // The old Hebrew cards list the return date first.
  const [start, end] = first <= last ? [first, last] : [last, first];
  return { start, end, days: (Date.parse(end) - Date.parse(start)) / dayMs + 1 };
}

export function itineraryDayCount(dates = '', duration = '') {
  const range = tourRange(dates);
  if (range && range.days <= maxItineraryDays) return range.days;
  if (duration.trim() === 'יום אחד') return 1;
  const match = /^\s*(\d+)\s*(?:$|(?:ימים|יום|days?)(?=\s|[,.;(]|$))/i.exec(duration);
  const days = Number(match?.[1]);
  return days > 0 && days <= maxItineraryDays ? days : null;
}

export function durationLabel(days: number) {
  return days === 1 ? 'יום אחד' : days + ' ימים';
}

export function formatTourRange(start: string, end: string) {
  return [start, end].map(value => value.split('-').reverse().join('/')).join(' - ');
}
