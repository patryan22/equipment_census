// Add / edit one machine by hand and file it under a customer.
import { getAll, get, put, del } from '../db.js';
import { $, esc, uid, toast, navigate, normBrand, CATEGORIES, BRANDS, CONDITIONS, STATUSES, NJ_COUNTIES } from '../util.js';

const opts = (list, sel, blank) =>
  (blank !== undefined ? `<option value="">${blank}</option>` : '') +
  list.map((v) => `<option ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');

// A <select> with an "Other…" choice that reveals a text box (more reliable on iOS than <datalist>).
function pick(id, label, list, value, otherLabel) {
  const known = !value || list.includes(value);
  return `<label for="${id}">${label}</label>
    <select id="${id}">${opts(list, known ? value : '__other', 'Select…')}<option value="__other" ${known ? '' : 'selected'}>Other…</option></select>
    <input id="${id}_other" placeholder="${otherLabel}" value="${known ? '' : esc(value)}" ${known ? 'hidden' : ''} style="margin-top:8px" autocapitalize="words">`;
}
const readPick = (el, id) => {
  const v = $('#' + id, el).value;
  return v === '__other' ? $('#' + id + '_other', el).value.trim() : v;
};

export async function render(el, { params }) {
  const id = params[0];
  let rec = id ? await get('equipment', id) : null;
  if (id && !rec) { el.innerHTML = '<div class="empty">Equipment not found.</div>'; return; }
  const isNew = !rec;
  rec = rec || { id: uid(), condition: 'Unknown', status: '', created: Date.now() };

  const customers = await getAll('customers');
  let custName = '';
  if (rec.customerId) custName = customers.find((c) => c.id === rec.customerId)?.name || '';
  else if (isNew) {
    // Same yard, next machine: default to the customer you just saved.
    const last = sessionStorage.getItem('lastCustomer');
    custName = customers.find((c) => c.id === last)?.name || '';
  }
  const lastCounty = isNew ? sessionStorage.getItem('lastCounty') || '' : '';

  el.innerHTML = `
    <form class="card" id="f" autocomplete="off" novalidate>
      <label for="customer" style="margin-top:0">Customer</label>
      <input id="customer" list="custlist" placeholder="Start typing a name…" value="${esc(custName)}" autocapitalize="words">
      <datalist id="custlist">${customers.map((c) => `<option value="${esc(c.name)}">`).join('')}</datalist>

      ${pick('brand', 'Brand', BRANDS, rec.brand, 'Brand name')}
      <label for="model">Model</label>
      <input id="model" placeholder="e.g. T770, SVL75, 259D3" value="${esc(rec.model)}" autocapitalize="characters">
      <div class="grid2">
        <div><label for="year">Year</label><input id="year" type="number" inputmode="numeric" min="1950" max="2100" placeholder="2018" value="${esc(rec.year)}"></div>
        <div><label for="hours">Hours</label><input id="hours" type="number" inputmode="numeric" min="0" value="${esc(rec.hours)}"></div>
      </div>
      ${pick('category', 'Type', CATEGORIES, rec.category, 'Equipment type')}
      <label for="serial">Serial #</label>
      <input id="serial" value="${esc(rec.serial)}" autocapitalize="characters">

      <div class="grid2">
        <div><label for="condition">Condition</label><select id="condition">${opts(CONDITIONS, rec.condition || 'Unknown')}</select></div>
        <div><label for="county">County</label><select id="county">${opts(NJ_COUNTIES, rec.county || lastCounty, 'Select…')}</select></div>
      </div>
      <div class="grid2">
        <div><label for="status">Sales status</label>
          <select id="status">${STATUSES.map((s) => `<option value="${s}" ${s === (rec.status || '') ? 'selected' : ''}>${s || 'None'}</option>`).join('')}</select></div>
        <div><label for="followUp">Follow up</label><input id="followUp" type="date" value="${esc(rec.followUp)}"></div>
      </div>
      <label for="notes">Notes</label>
      <textarea id="notes" placeholder="Decision maker, replacement timing, attachments…">${esc(rec.notes)}</textarea>

      <div id="err" class="small" style="color:var(--bad);margin-top:12px" role="alert"></div>
      <div class="stack" style="margin-top:12px">
        <button type="submit">Save</button>
        ${isNew ? '<button type="button" class="secondary" id="saveadd">Save &amp; add another</button>' : '<button type="button" class="danger" id="delete">Delete equipment</button>'}
      </div>
    </form>`;

  for (const k of ['brand', 'category']) {
    $('#' + k, el).addEventListener('change', (e) => { $('#' + k + '_other', el).hidden = e.target.value !== '__other'; });
  }
  // Picking an existing customer fills in their county if none chosen yet.
  $('#customer', el).addEventListener('change', () => {
    const c = customers.find((x) => x.name.toLowerCase() === $('#customer', el).value.trim().toLowerCase());
    if (c && c.county && !$('#county', el).value && NJ_COUNTIES.includes(c.county)) $('#county', el).value = c.county;
  });

  async function save(another) {
    const err = $('#err', el);
    err.textContent = '';
    const brand = normBrand(readPick(el, 'brand'));
    const model = $('#model', el).value.trim();
    const category = readPick(el, 'category');
    const year = parseInt($('#year', el).value, 10);
    if (!brand && !model) { err.textContent = 'Enter at least a brand or a model.'; return; }
    if ($('#year', el).value && !(year >= 1950 && year <= new Date().getFullYear() + 1)) { err.textContent = 'Year looks wrong.'; return; }

    let customerId = null;
    const name = $('#customer', el).value.trim();
    const county = $('#county', el).value;
    if (name) {
      let c = customers.find((x) => x.name.toLowerCase() === name.toLowerCase());
      if (!c) {
        c = { id: uid(), name, county, created: Date.now() };
        await put('customers', c);
        customers.push(c);
      }
      customerId = c.id;
      sessionStorage.setItem('lastCustomer', c.id);
    }
    if (county) sessionStorage.setItem('lastCounty', county);
    const hours = parseInt($('#hours', el).value, 10);
    const out = {
      ...rec, customerId, brand, model, category, year: year || null, hours: Number.isFinite(hours) ? hours : null,
      serial: $('#serial', el).value.trim(), condition: $('#condition', el).value, county,
      status: $('#status', el).value, followUp: $('#followUp', el).value, notes: $('#notes', el).value.trim(), updated: Date.now(),
    };
    await put('equipment', out);
    toast('Saved');
    navigate(another ? '#/add' : '#/equipment/' + out.id);
  }
  $('#f', el).addEventListener('submit', (e) => { e.preventDefault(); save(false); });
  if (isNew) $('#saveadd', el).onclick = () => save(true);
  else $('#delete', el).onclick = async () => {
    if (!confirm('Delete this equipment record?')) return;
    await del('equipment', rec.id);
    toast('Deleted');
    navigate('#/equipment');
  };
}
