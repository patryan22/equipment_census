// Full-fidelity JSON backup (including photos) so local-only data can be restored on a new phone.
import { getAll, putMany, clear, getSetting } from './db.js';
import { blobToDataURL, dataURLToBlob } from './image.js';

const enc = async (b) => (b ? blobToDataURL(b) : null);
const dec = async (s) => (s ? dataURLToBlob(s) : null);

export async function exportBackup() {
  const [customers, equipment] = await Promise.all([getAll('customers'), getAll('equipment')]);
  const eq = [];
  for (const e of equipment) {
    eq.push({ ...e, photos: await Promise.all((e.photos || []).map(enc)), thumb: await enc(e.thumb) });
  }
  const settings = {
    ageThreshold: await getSetting('ageThreshold', 7),
    model: await getSetting('model', ''),
    autoIdentify: await getSetting('autoIdentify', true),
  };
  return new Blob([JSON.stringify({ app: 'equipment-census', version: 1, exported: Date.now(), settings, customers, equipment: eq })],
    { type: 'application/json' });
}

// Merges by id (backup record wins). Pass replace=true to wipe first.
export async function importBackup(text, replace = false) {
  let d;
  try { d = JSON.parse(text); } catch { throw new Error('Not a valid backup file.'); }
  if (d.app !== 'equipment-census') throw new Error('This is not an Equipment Census backup.');
  const eq = [];
  for (const e of d.equipment || []) {
    eq.push({ ...e, photos: (await Promise.all((e.photos || []).map(dec))).filter(Boolean), thumb: await dec(e.thumb) });
  }
  if (replace) { await clear('equipment'); await clear('customers'); }
  await putMany('customers', d.customers || []);
  await putMany('equipment', eq);
  return { customers: (d.customers || []).length, equipment: eq.length };
}
