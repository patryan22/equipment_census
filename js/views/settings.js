import { getAll, getSetting, setSetting, putMany, clear } from '../db.js';
import { $, esc, toast, saveFile, fmtDate, navigate } from '../util.js';
import { DEFAULT_AGE_THRESHOLD } from '../insights.js';
import { equipmentCSV, customersCSV, importCSV } from '../csv.js';
import { exportBackup, importBackup } from '../backup.js';

export async function render(el) {
  const [threshold, lastBackup, equipment, customers] = await Promise.all([
    getSetting('ageThreshold', DEFAULT_AGE_THRESHOLD), getSetting('lastBackup', 0), getAll('equipment'), getAll('customers'),
  ]);
  const stale = equipment.length && (!lastBackup || Date.now() - lastBackup > 14 * 864e5);
  const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null;

  el.innerHTML = `
    <h2>Data safety</h2>
    <div class="card">
      <p style="margin-top:0">All data lives <b>only on this phone</b>. If you clear Safari data, delete the app, or lose the phone, it is gone. Back up regularly and save the file to iCloud Drive.</p>
      <p class="small ${stale ? '' : 'muted'}" style="${stale ? 'color:var(--bad);font-weight:600' : ''}">${lastBackup ? 'Last backup: ' + fmtDate(lastBackup) : 'You have never backed up.'} · ${equipment.length} machines, ${customers.length} customers</p>
      <div class="stack">
        <button id="backup">Back up everything</button>
        <button class="secondary" id="restore">Restore from backup…</button>
        <input type="file" id="restoref" accept=".json,application/json" hidden>
      </div>
      <p class="small muted">Storage protection: ${persisted === null ? 'unknown' : persisted ? 'persistent' : 'standard (installing to Home Screen helps)'}</p>
    </div>

    <h2>Sales opportunities</h2>
    <div class="card">
      <label for="age" style="margin-top:0">Flag competitor machines this many years old or older</label>
      <input id="age" type="number" inputmode="numeric" min="1" max="40" value="${threshold}">
      <button id="saveage" style="margin-top:12px">Save</button>
    </div>

    <h2>Spreadsheets (CSV)</h2>
    <div class="card"><div class="stack">
      <button class="secondary" id="xeq">Export equipment CSV</button>
      <button class="secondary" id="xcu">Export customers CSV</button>
      <button class="secondary" id="imp">Import CSV (customers or equipment)…</button>
      <input type="file" id="impf" accept=".csv,text/csv" hidden>
    </div>
    <p class="small muted">Equipment columns: customer, category, brand, model, year, serial, hours, condition, status, follow_up, county, notes. Customer columns: name, contact, phone, address, county, notes. Unknown customers in an equipment file are created automatically.</p></div>

    <h2>Danger zone</h2>
    <div class="card"><button class="danger" id="wipe">Erase all data on this phone</button></div>
    <p class="small muted" style="text-align:center">Equipment Census v1</p>`;

  const stamp = () => new Date().toISOString().slice(0, 10);

  $('#backup', el).onclick = async () => {
    const btn = $('#backup', el); btn.disabled = true; btn.textContent = 'Preparing…';
    try {
      await saveFile(await exportBackup(), `equipment-census-backup-${stamp()}.json`);
      await setSetting('lastBackup', Date.now());
      toast('Backup created');
    } catch (e) { toast('Backup failed: ' + e.message); }
    navigate('#/settings');
  };
  $('#restore', el).onclick = () => $('#restoref', el).click();
  $('#restoref', el).onchange = async (ev) => {
    const file = ev.target.files[0]; if (!file) return;
    const replace = confirm('Restore this backup?\n\nOK = REPLACE everything on this phone with the backup.\nCancel = stop (nothing changes).');
    if (!replace) { ev.target.value = ''; return; }
    try {
      const r = await importBackup(await file.text());
      toast(`Restored ${r.equipment} machines, ${r.customers} customers`);
      navigate('#/equipment');
    } catch (e) { toast(e.message); }
  };

  $('#saveage', el).onclick = async () => {
    const n = parseInt($('#age', el).value, 10);
    if (!(n > 0)) { toast('Enter a number of years'); return; }
    await setSetting('ageThreshold', n);
    toast('Saved');
  };

  $('#xeq', el).onclick = () => saveFile(new Blob([equipmentCSV(equipment, customers)], { type: 'text/csv' }), `equipment-${stamp()}.csv`);
  $('#xcu', el).onclick = () => saveFile(new Blob([customersCSV(customers)], { type: 'text/csv' }), `customers-${stamp()}.csv`);
  $('#imp', el).onclick = () => $('#impf', el).click();
  $('#impf', el).onchange = async (ev) => {
    const file = ev.target.files[0]; if (!file) return;
    try {
      const r = importCSV(await file.text(), customers);
      if (!confirm(`Import ${r.kind === 'equipment' ? r.equipment.length + ' machines and ' : ''}${r.customers.length} new customers? (${r.skipped} rows skipped)`)) return;
      await putMany('customers', r.customers);
      await putMany('equipment', r.equipment);
      toast('Import complete');
      navigate(r.kind === 'equipment' ? '#/equipment' : '#/customers');
    } catch (e) { toast(e.message); }
    ev.target.value = '';
  };

  $('#wipe', el).onclick = async () => {
    if (!confirm('Erase ALL equipment and customers on this phone? This cannot be undone.')) return;
    if (!confirm('Really erase everything? Make sure you have a backup.')) return;
    await clear('equipment'); await clear('customers');
    toast('All data erased');
    navigate('#/equipment');
  };
}
