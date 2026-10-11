// JSON backup so local-only data can be restored on a new phone.
import { getAll, putMany, clear } from './db.js';

export async function exportBackup() {
  const [customers, equipment] = await Promise.all([getAll('customers'), getAll('equipment')]);
  return new Blob([JSON.stringify({ app: 'equipment-census', version: 2, exported: Date.now(), customers, equipment })],
    { type: 'application/json' });
}

// Replaces everything on the phone with the backup. Photo fields from older backups are dropped.
export async function importBackup(text) {
  let d;
  try { d = JSON.parse(text); } catch { throw new Error('Not a valid backup file.'); }
  if (d.app !== 'equipment-census') throw new Error('This is not an Equipment Census backup.');
  const equipment = (d.equipment || []).map(({ photos, thumb, lat, lng, acc, ...rest }) => rest);
  const customers = d.customers || [];
  await clear('equipment'); await clear('customers');
  await putMany('customers', customers);
  await putMany('equipment', equipment);
  return { customers: customers.length, equipment: equipment.length };
}
