import { uid, normBrand } from './util.js';

export function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

const cell = (v) => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
export const toCSV = (header, rows) => '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');

export const EQUIP_COLS = ['customer', 'category', 'brand', 'model', 'year', 'serial', 'hours', 'condition', 'status', 'follow_up', 'county', 'lat', 'lng', 'notes'];
export const CUST_COLS = ['name', 'contact', 'phone', 'address', 'county', 'notes'];

export function equipmentCSV(equipment, customers) {
  const names = new Map(customers.map((c) => [c.id, c.name]));
  return toCSV(EQUIP_COLS, equipment.map((e) => [names.get(e.customerId) || '', e.category, e.brand, e.model, e.year, e.serial, e.hours,
    e.condition, e.status, e.followUp, e.county, e.lat, e.lng, e.notes]));
}
export const customersCSV = (customers) => toCSV(CUST_COLS, customers.map((c) => CUST_COLS.map((k) => c[k])));

// Turns CSV text into records. Equipment if a brand/model column exists, otherwise customers.
// Returns { kind, customers: [new customers to put], equipment: [new equipment to put], skipped }.
export function importCSV(text, existingCustomers) {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error('CSV has no data rows.');
  const head = rows[0].map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, '_'));
  const idx = (k) => head.indexOf(k);
  const val = (r, k) => (idx(k) >= 0 ? (r[idx(k)] || '').trim() : '');
  const isEquip = idx('brand') >= 0 || idx('model') >= 0;
  if (!isEquip && idx('name') < 0) throw new Error('Unrecognized CSV. Need a "name" column (customers) or "brand"/"model" columns (equipment).');

  const byName = new Map(existingCustomers.map((c) => [c.name.toLowerCase(), c]));
  const newCustomers = [];
  const getCustomer = (name, county) => {
    if (!name) return null;
    let c = byName.get(name.toLowerCase());
    if (!c) { c = { id: uid(), name, county: county || '', created: Date.now() }; byName.set(name.toLowerCase(), c); newCustomers.push(c); }
    return c;
  };

  const equipment = [];
  let skipped = 0;
  for (const r of rows.slice(1)) {
    if (isEquip) {
      if (!val(r, 'brand') && !val(r, 'model')) { skipped++; continue; }
      const c = getCustomer(val(r, 'customer'), val(r, 'county'));
      const lat = parseFloat(val(r, 'lat')), lng = parseFloat(val(r, 'lng'));
      equipment.push({
        id: uid(), customerId: c ? c.id : null, category: val(r, 'category'), brand: normBrand(val(r, 'brand')), model: val(r, 'model'),
        year: parseInt(val(r, 'year'), 10) || null, serial: val(r, 'serial'), hours: parseInt(val(r, 'hours'), 10) || null,
        condition: val(r, 'condition') || 'Unknown', status: val(r, 'status'), followUp: val(r, 'follow_up'), county: val(r, 'county'),
        lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null, notes: val(r, 'notes'),
        photos: [], thumb: null, created: Date.now(), updated: Date.now(),
      });
    } else {
      const name = val(r, 'name');
      if (!name) { skipped++; continue; }
      const existing = byName.get(name.toLowerCase());
      if (existing) { skipped++; continue; }
      const c = { id: uid(), name, created: Date.now() };
      CUST_COLS.slice(1).forEach((k) => { c[k] = val(r, k); });
      byName.set(name.toLowerCase(), c);
      newCustomers.push(c);
    }
  }
  return { kind: isEquip ? 'equipment' : 'customers', customers: newCustomers, equipment, skipped };
}
