export const OPEN_STATUSES = ['Lead', 'Contacted', 'Quoted'];
export const DEFAULT_AGE_THRESHOLD = 7;

export const isBobcat = (e) => /bobcat/i.test(e.brand || '');

export function ageOf(e, now = new Date().getFullYear()) {
  const y = parseInt(e.year, 10);
  return y > 1900 && y <= now + 1 ? Math.max(0, now - y) : null;
}

// A competitor machine is a sales opportunity when it is old enough to be a replacement
// candidate, or when the rep has it in an active pipeline stage. Won/Lost are closed out.
export function isOpportunity(e, threshold = DEFAULT_AGE_THRESHOLD) {
  if (isBobcat(e) || e.status === 'Won' || e.status === 'Lost') return false;
  if (OPEN_STATUSES.includes(e.status)) return true;
  const a = ageOf(e);
  return a !== null && a >= threshold;
}

export function ageBucket(e) {
  const a = ageOf(e);
  if (a === null) return 'unknown';
  if (a <= 3) return '0-3';
  if (a <= 7) return '4-7';
  if (a <= 12) return '8-12';
  return '13+';
}
export const AGE_BUCKETS = [['0-3', '0–3 yrs'], ['4-7', '4–7 yrs'], ['8-12', '8–12 yrs'], ['13+', '13+ yrs'], ['unknown', 'Unknown']];

// Returns [[key, count], ...] sorted by count desc.
export function countBy(list, fn) {
  const m = new Map();
  for (const x of list) {
    const k = fn(x);
    if (k === undefined || k === null || k === '') continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

export function customerStats(customers, equipment) {
  const by = new Map(customers.map((c) => [c.id, { c, total: 0, bobcat: 0, comp: 0 }]));
  for (const e of equipment) {
    const s = by.get(e.customerId);
    if (!s) continue;
    s.total++;
    if (isBobcat(e)) s.bobcat++; else s.comp++;
  }
  return by;
}

export function titleOf(e) {
  return [e.year, e.brand, e.model].filter(Boolean).join(' ') || e.category || 'Unidentified machine';
}
