import { getAll, get, put, del, getSetting } from '../db.js';
import { $, esc, uid, toast, navigate, sheet, NJ_COUNTIES } from '../util.js';
import { customerStats, DEFAULT_AGE_THRESHOLD, isOpportunity } from '../insights.js';
import { equipRow } from './equipment.js';

const field = (id, label, val = '', attrs = '') => `<label for="${id}">${label}</label><input id="${id}" value="${esc(val)}" ${attrs}>`;

function customerForm(c) {
  return `<h3>${c.id ? 'Edit customer' : 'New customer'}</h3>
    ${field('c_name', 'Business name', c.name, 'autocapitalize="words"')}
    ${field('c_contact', 'Contact person', c.contact, 'autocapitalize="words"')}
    ${field('c_phone', 'Phone', c.phone, 'type="tel" inputmode="tel"')}
    ${field('c_address', 'Address', c.address, 'autocapitalize="words"')}
    ${field('c_county', 'County', c.county, 'list="c_counties"')}
    <datalist id="c_counties">${NJ_COUNTIES.map((n) => `<option value="${n}">`).join('')}</datalist>
    <label for="c_notes">Notes</label><textarea id="c_notes">${esc(c.notes)}</textarea>
    <div class="stack" style="margin-top:16px"><button id="c_save">Save</button><button class="secondary" id="c_cancel">Cancel</button></div>`;
}

async function editCustomer(existing, done) {
  const s = sheet(customerForm(existing || {}));
  $('#c_cancel', s.el).onclick = s.close;
  $('#c_save', s.el).onclick = async () => {
    const name = $('#c_name', s.el).value.trim();
    if (!name) { toast('Name is required'); return; }
    const all = await getAll('customers');
    if (all.some((c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== existing?.id)) { toast('A customer with that name already exists'); return; }
    const c = { ...(existing || { id: uid(), created: Date.now() }), name };
    ['contact', 'phone', 'address', 'county', 'notes'].forEach((k) => { c[k] = $('#c_' + k, s.el).value.trim(); });
    await put('customers', c);
    s.close();
    toast('Saved');
    done(c);
  };
}

export async function render(el) {
  const [customers, equipment] = await Promise.all([getAll('customers'), getAll('equipment')]);
  const stats = customerStats(customers, equipment);
  el.innerHTML = `
    <input id="q" type="search" placeholder="Search customers…">
    <div class="small muted" id="count" style="margin:8px 4px"></div>
    <div class="list" id="list"></div>
    <button class="fab" id="new" aria-label="New customer">+</button>`;

  function draw() {
    const q = $('#q', el).value.trim().toLowerCase();
    const rows = customers
      .filter((c) => !q || [c.name, c.county, c.contact, c.address].join(' ').toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
    $('#count', el).textContent = `${rows.length} customer${rows.length === 1 ? '' : 's'}`;
    $('#list', el).innerHTML = rows.length ? rows.map((c) => {
      const s = stats.get(c.id);
      return `<a class="row" href="#/customers/${c.id}">
        <div class="meta"><b>${esc(c.name)}</b><span class="sub">${esc([c.county, c.contact].filter(Boolean).join(' · ') || 'No details')}</span>
          <div class="tags"><span class="badge">${s.total} machine${s.total === 1 ? '' : 's'}</span>
          ${s.bobcat ? `<span class="badge bobcat">${s.bobcat} Bobcat</span>` : ''}
          ${s.comp ? `<span class="badge comp">${s.comp} other</span>` : ''}
          ${s.total && !s.bobcat ? '<span class="badge opp">No Bobcat yet</span>' : ''}</div></div><span class="chev">&#8250;</span></a>`;
    }).join('') : `<div class="empty">${customers.length ? 'No matches.' : 'No customers yet. They are created automatically when you add equipment, or tap + to add one.'}</div>`;
  }
  $('#q', el).addEventListener('input', draw);
  $('#new', el).onclick = () => editCustomer(null, (c) => navigate('#/customers/' + c.id));
  draw();
}

export async function detail(el, { params }) {
  const c = await get('customers', params[0]);
  if (!c) { el.innerHTML = '<div class="empty">Customer not found.</div>'; return; }
  const [equipment, threshold] = await Promise.all([getAll('equipment'), getSetting('ageThreshold', DEFAULT_AGE_THRESHOLD)]);
  const fleet = equipment.filter((e) => e.customerId === c.id).sort((a, b) => b.created - a.created);
  const bobcat = fleet.filter((e) => /bobcat/i.test(e.brand || '')).length;
  const opps = fleet.filter((e) => isOpportunity(e, threshold)).length;
  const kv = (k, v) => (v ? `<dt>${k}</dt><dd>${v}</dd>` : '');

  el.innerHTML = `
    <div class="card">
      <h2 style="margin:0 0 10px;font-size:22px;text-transform:none;letter-spacing:0;color:var(--text)">${esc(c.name)}</h2>
      <dl class="kv">
        ${kv('Contact', esc(c.contact))}
        ${kv('Phone', c.phone ? `<a href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}">${esc(c.phone)}</a>` : '')}
        ${kv('Address', c.address ? `<a href="https://maps.apple.com/?q=${encodeURIComponent(c.address)}">${esc(c.address)}</a>` : '')}
        ${kv('County', esc(c.county))}
        ${kv('Notes', esc(c.notes).replace(/\n/g, '<br>'))}
      </dl>
      <div class="tags" style="margin-top:12px"><span class="badge">${fleet.length} machines</span>
        <span class="badge bobcat">${bobcat} Bobcat</span><span class="badge comp">${fleet.length - bobcat} other</span>
        ${opps ? `<span class="badge opp">★ ${opps} opportunit${opps === 1 ? 'y' : 'ies'}</span>` : ''}</div>
    </div>
    <div class="stack"><button id="add">📷 Add equipment for this customer</button>
      <button class="secondary" id="edit">Edit customer</button></div>
    <h2>Fleet</h2>
    <div class="list">${fleet.length ? fleet.map((e) => equipRow(e, c.name, threshold)).join('') : '<div class="empty">No equipment logged yet.</div>'}</div>
    <div class="spacer"></div><button class="danger" id="del">Delete customer</button>`;

  $('#add', el).onclick = () => { sessionStorage.setItem('lastCustomer', c.id); navigate('#/add'); };
  $('#edit', el).onclick = () => editCustomer(c, () => navigate('#/customers/' + c.id));
  $('#del', el).onclick = async () => {
    if (!confirm(`Delete ${c.name}? Their ${fleet.length} machine(s) will be kept but unassigned.`)) return;
    for (const e of fleet) await put('equipment', { ...e, customerId: null, updated: Date.now() });
    await del('customers', c.id);
    if (sessionStorage.getItem('lastCustomer') === c.id) sessionStorage.removeItem('lastCustomer');
    toast('Customer deleted');
    navigate('#/customers');
  };
}
