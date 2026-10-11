import { getAll, get, put, getSetting } from '../db.js';
import { $, $$, esc, toast, navigate, blobURL, lightbox, fmtDate, STATUSES, CATEGORIES } from '../util.js';
import { isBobcat, ageOf, isOpportunity, ageBucket, AGE_BUCKETS, titleOf, DEFAULT_AGE_THRESHOLD } from '../insights.js';

export function tags(e, threshold) {
  const a = ageOf(e);
  const t = [`<span class="badge ${isBobcat(e) ? 'bobcat' : 'comp'}">${isBobcat(e) ? 'Bobcat' : 'Competitor'}</span>`];
  if (e.category) t.push(`<span class="badge">${esc(e.category)}</span>`);
  if (a !== null) t.push(`<span class="badge">${a} yr${a === 1 ? '' : 's'}</span>`);
  if (isOpportunity(e, threshold)) t.push('<span class="badge opp">★ Opportunity</span>');
  if (e.status) t.push(`<span class="badge ${e.status === 'Won' ? 'won' : ''}">${esc(e.status)}</span>`);
  return t.join('');
}

export function equipRow(e, custName, threshold) {
  const bg = e.thumb || e.photos?.[0];
  return `<a class="row" href="#/equipment/${e.id}">
    <div class="thumb" ${bg ? `style="background-image:url(${blobURL(bg)})"` : ''}>${bg ? '' : '🚜'}</div>
    <div class="meta"><b>${esc(titleOf(e))}</b>
      <span class="sub">${esc(custName || 'No customer')}${e.county ? ' · ' + esc(e.county) : ''}</span>
      <div class="tags">${tags(e, threshold)}</div></div>
    <span class="chev">&#8250;</span></a>`;
}

const SORTS = {
  newest: ['Newest first', (a, b) => b.created - a.created],
  oldest: ['Oldest machines first', (a, b) => (ageOf(b) ?? -1) - (ageOf(a) ?? -1)],
  customer: ['Customer A–Z', (a, b, n) => (n(a) || '~').localeCompare(n(b) || '~')],
  brand: ['Brand A–Z', (a, b) => (a.brand || '~').localeCompare(b.brand || '~')],
};

export async function render(el, { query }) {
  const [equipment, customers, threshold] = await Promise.all([getAll('equipment'), getAll('customers'), getSetting('ageThreshold', DEFAULT_AGE_THRESHOLD)]);
  const cname = new Map(customers.map((c) => [c.id, c.name]));
  const nameOf = (e) => cname.get(e.customerId) || '';

  if (!equipment.length) {
    el.innerHTML = `<div class="empty"><div style="font-size:48px">🚜</div><b>No equipment yet</b><br>
      Snap a photo of the first machine you see out in the field.<div class="spacer"></div>
      <a class="btn" href="#/add">📷 Add equipment</a><div class="spacer"></div>
      <a class="btn secondary" href="#/settings">Import CSV / restore backup</a></div>`;
    return;
  }

  const uniq = (fn) => [...new Set(equipment.map(fn).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
  const F = { q: query.q || '', brand: query.brand || '', type: query.type || '', county: query.county || '', who: query.who || '',
    status: query.status || '', age: query.age || '', customer: query.customer || '', opp: query.opp === '1', sort: query.sort || 'newest' };
  const sel = (id, label, list, cur) => `<div><label for="${id}">${label}</label><select id="${id}"><option value="">All</option>${list.map((v) => {
    const [val, text] = Array.isArray(v) ? v : [v, v];
    return `<option value="${esc(val)}" ${val === cur ? 'selected' : ''}>${esc(text)}</option>`;
  }).join('')}</select></div>`;

  const activeFilters = () => ['brand', 'type', 'county', 'who', 'status', 'age', 'customer'].filter((k) => F[k]).length + (F.opp ? 1 : 0);

  el.innerHTML = `
    <div class="sticky-tools">
      <input id="q" type="search" placeholder="Search brand, model, customer, notes…" value="${esc(F.q)}">
      <div class="row-flex" style="margin-top:8px">
        <button class="secondary small" id="tf" style="flex:1"></button>
        <select id="sort" style="flex:1;min-height:36px;padding:4px 10px">${Object.entries(SORTS).map(([k, [t]]) => `<option value="${k}" ${k === F.sort ? 'selected' : ''}>${t}</option>`).join('')}</select>
      </div>
    </div>
    <div class="card" id="filters" hidden>
      <div class="grid2">
        ${sel('brand', 'Brand', uniq((e) => e.brand), F.brand)}
        ${sel('type', 'Type', uniq((e) => e.category), F.type)}
        ${sel('county', 'County', uniq((e) => e.county), F.county)}
        ${sel('who', 'Bobcat?', [['bobcat', 'Bobcat only'], ['competitor', 'Competitor only']], F.who)}
        ${sel('status', 'Sales status', STATUSES.filter(Boolean), F.status)}
        ${sel('age', 'Age', AGE_BUCKETS, F.age)}
      </div>
      ${sel('customer', 'Customer', customers.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => [c.id, c.name]), F.customer)}
      <label><input type="checkbox" id="opp" style="width:auto;min-height:0;margin-right:8px" ${F.opp ? 'checked' : ''}>Sales opportunities only (competitor, ${threshold}+ yrs or in pipeline)</label>
      <button class="secondary small" id="reset" style="margin-top:8px">Clear filters</button>
    </div>
    <div id="count" class="small muted" style="margin:6px 4px"></div>
    <div class="list" id="list"></div>
    <a class="btn fab" href="#/add" aria-label="Add equipment">+</a>`;

  function matches(e) {
    if (F.brand && e.brand !== F.brand) return false;
    if (F.type && e.category !== F.type) return false;
    if (F.county && e.county !== F.county) return false;
    if (F.who === 'bobcat' && !isBobcat(e)) return false;
    if (F.who === 'competitor' && isBobcat(e)) return false;
    if (F.status && e.status !== F.status) return false;
    if (F.age && ageBucket(e) !== F.age) return false;
    if (F.customer && e.customerId !== F.customer) return false;
    if (F.opp && !isOpportunity(e, threshold)) return false;
    if (F.q) {
      const hay = [e.brand, e.model, e.category, e.year, e.serial, e.notes, e.county, nameOf(e)].join(' ').toLowerCase();
      if (!F.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  }

  function draw() {
    const rows = equipment.filter(matches).sort((a, b) => SORTS[F.sort][1](a, b, nameOf));
    const n = activeFilters();
    $('#tf', el).textContent = n ? `Filters (${n}) ▾` : 'Filters ▾';
    $('#count', el).textContent = `${rows.length} of ${equipment.length} machines`;
    $('#list', el).innerHTML = rows.length ? rows.map((e) => equipRow(e, nameOf(e), threshold)).join('') : '<div class="empty">No matches.</div>';
  }

  $('#q', el).addEventListener('input', (e) => { F.q = e.target.value.trim(); draw(); });
  $('#sort', el).addEventListener('change', (e) => { F.sort = e.target.value; draw(); });
  $('#tf', el).onclick = () => { const p = $('#filters', el); p.hidden = !p.hidden; };
  $$('#filters select', el).forEach((s) => s.addEventListener('change', () => { F[s.id] = s.value; draw(); }));
  $('#opp', el).addEventListener('change', (e) => { F.opp = e.target.checked; draw(); });
  $('#reset', el).onclick = () => {
    Object.assign(F, { brand: '', type: '', county: '', who: '', status: '', age: '', customer: '', opp: false });
    $$('#filters select', el).forEach((s) => { s.value = ''; });
    $('#opp', el).checked = false;
    draw();
  };
  if (activeFilters()) $('#filters', el).hidden = false;
  draw();
}

export async function detail(el, { params }) {
  const e = await get('equipment', params[0]);
  if (!e) { el.innerHTML = '<div class="empty">Equipment not found.</div>'; return; }
  const [cust, threshold] = await Promise.all([e.customerId ? get('customers', e.customerId) : null, getSetting('ageThreshold', DEFAULT_AGE_THRESHOLD)]);
  const a = ageOf(e);
  const kv = (k, v) => (v || v === 0 ? `<dt>${k}</dt><dd>${v}</dd>` : '');

  el.innerHTML = `
    ${e.photos?.length ? `<div class="photos big" id="ph">${e.photos.map((b, i) => `<div class="ph" data-i="${i}" style="background-image:url(${blobURL(b)})"></div>`).join('')}</div><div class="spacer"></div>` : ''}
    <div class="card">
      <h2 style="margin:0 0 4px;font-size:22px;text-transform:none;letter-spacing:0;color:var(--text)">${esc(titleOf(e))}</h2>
      <div class="tags" style="margin-bottom:12px">${tags(e, threshold)}</div>
      <dl class="kv">
        ${kv('Customer', cust ? `<a href="#/customers/${cust.id}">${esc(cust.name)}</a>` : '')}
        ${kv('Type', esc(e.category))}
        ${kv('Year', e.year ? `${e.year}${a !== null ? ` (${a} yrs old)` : ''}` : '')}
        ${kv('Hours', e.hours != null ? Number(e.hours).toLocaleString() : '')}
        ${kv('Serial #', esc(e.serial))}
        ${kv('Condition', e.condition && e.condition !== 'Unknown' ? esc(e.condition) : '')}
        ${kv('County', esc(e.county))}
        ${kv('Location', e.lat != null ? `<a href="https://maps.apple.com/?ll=${e.lat},${e.lng}&q=${encodeURIComponent(titleOf(e))}">Open in Maps</a>` : '')}
        ${kv('Follow up', e.followUp ? fmtDate(e.followUp + 'T12:00:00') : '')}
        ${kv('Notes', esc(e.notes).replace(/\n/g, '<br>'))}
        ${kv('Logged', fmtDate(e.created))}
      </dl>
    </div>
    <div class="card">
      <label for="st" style="margin-top:0">Sales status</label>
      <select id="st">${STATUSES.map((s) => `<option value="${s}" ${s === (e.status || '') ? 'selected' : ''}>${s || 'None'}</option>`).join('')}</select>
    </div>
    <div class="stack">
      <a class="btn" href="#/equipment/${e.id}/edit">Edit</a>
      ${cust ? `<a class="btn secondary" href="#/customers/${cust.id}">View ${esc(cust.name)}'s fleet</a>` : ''}
    </div>`;

  const ph = $('#ph', el);
  if (ph) ph.addEventListener('click', (ev) => { const p = ev.target.closest('.ph'); if (p) lightbox(blobURL(e.photos[+p.dataset.i])); });
  $('#st', el).addEventListener('change', async (ev) => {
    e.status = ev.target.value;
    e.updated = Date.now();
    await put('equipment', e);
    toast('Status updated');
    navigate(`#/equipment/${e.id}`);
  });
}
