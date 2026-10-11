// Add / edit one machine: photos -> AI suggestion -> confirm -> save to a customer.
import { getAll, get, put, del, getSetting } from '../db.js';
import { $, $$, esc, uid, toast, navigate, blobURL, lightbox, getPosition, normBrand,
  CATEGORIES, BRANDS, CONDITIONS, STATUSES, NJ_COUNTIES } from '../util.js';
import { resizeImage } from '../image.js';
import { identify, DEFAULT_MODEL } from '../ai.js';

const opts = (list, sel, blank) =>
  (blank !== undefined ? `<option value="">${blank}</option>` : '') +
  list.filter(Boolean).map((v) => `<option ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');

export async function render(el, { params }) {
  const id = params[0];
  let rec = id ? await get('equipment', id) : null;
  if (id && !rec) { el.innerHTML = '<div class="empty">Equipment not found.</div>'; return; }
  const isNew = !rec;
  rec = rec || { id: uid(), photos: [], condition: 'Unknown', status: '', created: Date.now() };

  const customers = await getAll('customers');
  let custName = '';
  if (rec.customerId) custName = customers.find((c) => c.id === rec.customerId)?.name || '';
  else if (isNew) {
    // Same yard, next machine: default to the customer you just saved.
    const last = sessionStorage.getItem('lastCustomer');
    custName = customers.find((c) => c.id === last)?.name || '';
  }
  const apiKey = await getSetting('apiKey', '');
  const model = (await getSetting('model', '')) || DEFAULT_MODEL;
  const autoIdentify = await getSetting('autoIdentify', true);

  const photos = [...(rec.photos || [])];
  let loc = rec.lat != null ? { lat: rec.lat, lng: rec.lng, acc: rec.acc } : null;
  let aiUsed = false;
  let busy = false;
  const touched = new Set();

  el.innerHTML = `
    <div class="card">
      <div class="photos" id="photos"></div>
      <div class="grid2" style="margin-top:10px">
        <button type="button" id="cam">📷 Take photo</button>
        <button type="button" class="secondary" id="lib">🖼 Choose photos</button>
      </div>
      <input type="file" id="fcam" accept="image/*" capture="environment" hidden>
      <input type="file" id="flib" accept="image/*" multiple hidden>
      <p class="small muted" style="margin:10px 0 0">Tip: include a close-up of the model/serial plate for the best ID.</p>
    </div>

    <div class="card ai" id="aibox" hidden></div>

    <form class="card" id="f" autocomplete="off">
      <label for="customer">Customer</label>
      <input id="customer" list="custlist" placeholder="Start typing a name…" value="${esc(custName)}" autocapitalize="words">
      <datalist id="custlist">${customers.map((c) => `<option value="${esc(c.name)}">`).join('')}</datalist>

      <div class="grid2">
        <div><label for="brand">Brand</label>
          <input id="brand" list="brandlist" value="${esc(rec.brand)}" autocapitalize="words">
          <datalist id="brandlist">${BRANDS.map((b) => `<option value="${b}">`).join('')}</datalist></div>
        <div><label for="model">Model</label><input id="model" value="${esc(rec.model)}" autocapitalize="characters"></div>
      </div>
      <div class="grid2">
        <div><label for="year">Year</label><input id="year" type="number" inputmode="numeric" min="1950" max="2100" value="${esc(rec.year)}"></div>
        <div><label for="hours">Hours</label><input id="hours" type="number" inputmode="numeric" min="0" value="${esc(rec.hours)}"></div>
      </div>
      <div id="yearnote" class="small muted"></div>
      <label for="category">Type</label>
      <select id="category">${opts(CATEGORIES, rec.category, 'Select type…')}</select>
      <label for="serial">Serial #</label>
      <input id="serial" value="${esc(rec.serial)}" autocapitalize="characters">

      <div class="grid2">
        <div><label for="condition">Condition</label><select id="condition">${opts(CONDITIONS, rec.condition || 'Unknown')}</select></div>
        <div><label for="county">County</label>
          <input id="county" list="countylist" value="${esc(rec.county)}">
          <datalist id="countylist">${NJ_COUNTIES.map((c) => `<option value="${c}">`).join('')}</datalist></div>
      </div>
      <div class="grid2">
        <div><label for="status">Sales status</label>
          <select id="status">${STATUSES.map((s) => `<option value="${s}" ${s === (rec.status || '') ? 'selected' : ''}>${s || 'None'}</option>`).join('')}</select></div>
        <div><label for="followUp">Follow up</label><input id="followUp" type="date" value="${esc(rec.followUp)}"></div>
      </div>
      <label for="notes">Notes</label>
      <textarea id="notes" placeholder="Decision maker, replacement timing, attachments…">${esc(rec.notes)}</textarea>

      <label>Location</label>
      <div class="row-flex">
        <div class="grow small" id="locnote"></div>
        <button type="button" class="secondary small" id="getloc">📍 Use my location</button>
        <button type="button" class="secondary small" id="clrloc" hidden>Clear</button>
      </div>

      <div class="stack" style="margin-top:18px">
        <button type="submit" id="save">Save</button>
        ${isNew ? '<button type="button" class="secondary" id="saveadd">Save &amp; add another</button>' : '<button type="button" class="danger" id="delete">Delete equipment</button>'}
      </div>
    </form>`;

  const f = (k) => $('#' + k, el);
  $$('#f input, #f select, #f textarea', el).forEach((i) => i.addEventListener('input', () => touched.add(i.id)));

  function drawPhotos() {
    const box = f('photos');
    box.innerHTML = photos.length
      ? photos.map((b, i) => `<div class="ph" data-i="${i}" style="background-image:url(${blobURL(b)})"><button type="button" data-rm="${i}" aria-label="Remove photo">&times;</button></div>`).join('')
      : '<div class="muted small" style="padding:6px 2px">No photos yet.</div>';
  }
  function drawLoc() {
    f('locnote').textContent = loc ? `Saved ±${loc.acc ?? '?'} m (${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)})` : 'Not set';
    f('clrloc').hidden = !loc;
  }
  function drawYearNote(basis) {
    f('yearnote').textContent = basis && basis !== 'unknown' ? `Year source: ${basis.replace('_', ' ')}` : '';
  }
  drawPhotos(); drawLoc();

  f('photos').addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rm]');
    if (rm) { photos.splice(+rm.dataset.rm, 1); drawPhotos(); return; }
    const ph = e.target.closest('.ph');
    if (ph) lightbox(blobURL(photos[+ph.dataset.i]));
  });

  f('cam').onclick = () => f('fcam').click();
  f('lib').onclick = () => f('flib').click();
  async function addFiles(files) {
    if (!files.length) return;
    try {
      for (const file of files) photos.push(await resizeImage(file));
    } catch (err) { toast(err.message); return; }
    drawPhotos();
    if (isNew && !loc) fetchLocation(true);
    if (apiKey && autoIdentify) runAI();
  }
  f('fcam').onchange = async (e) => { await addFiles([...e.target.files]); e.target.value = ''; };
  f('flib').onchange = async (e) => { await addFiles([...e.target.files]); e.target.value = ''; };

  async function fetchLocation(quiet) {
    try { loc = await getPosition(); drawLoc(); if (!quiet) toast('Location saved'); }
    catch (err) { if (!quiet) toast(err.message); }
  }
  f('getloc').onclick = () => fetchLocation(false);
  f('clrloc').onclick = () => { loc = null; drawLoc(); };

  // ---- AI ----
  function aiBox(html) { const b = f('aibox'); b.hidden = !html; b.innerHTML = html || ''; }
  function setIfFree(k, v) {
    if (v === null || v === undefined || v === '' || touched.has(k)) return;
    f(k).value = v;
  }
  async function runAI() {
    if (busy || !photos.length) return;
    if (!apiKey) { toast('Add your API key in Settings to use AI ID'); return; }
    busy = true;
    aiBox('<div class="row-flex"><span class="spin"></span><b>Identifying equipment…</b></div>');
    try {
      const r = await identify(photos, { apiKey, model });
      aiUsed = true;
      setIfFree('brand', normBrand(r.brand));
      setIfFree('model', r.model);
      setIfFree('category', r.category);
      setIfFree('year', r.year);
      setIfFree('serial', r.serial);
      setIfFree('hours', r.hours);
      setIfFree('condition', r.condition);
      drawYearNote(r.yearBasis);
      const hint = r.customerHint && !f('customer').value;
      aiBox(`<b>AI suggestion — ${esc(r.confidence)} confidence</b>
        <div class="small muted" style="margin:4px 0 8px">Please verify before saving. ${esc(r.notes)}</div>
        ${hint ? `<button type="button" class="secondary small" id="usehint">Use customer “${esc(r.customerHint)}”</button> ` : ''}
        <button type="button" class="secondary small" id="reai">Re-identify</button>`);
      if (hint) $('#usehint', el).onclick = () => { f('customer').value = r.customerHint; touched.add('customer'); $('#usehint', el).remove(); };
      $('#reai', el).onclick = () => { ['brand', 'model', 'year', 'category', 'serial', 'hours', 'condition'].forEach((k) => touched.delete(k)); runAI(); };
    } catch (err) {
      aiBox(`<b>AI could not identify this</b><div class="small muted" style="margin:4px 0 8px">${esc(err.message)}</div>
        <button type="button" class="secondary small" id="reai">Try again</button>`);
      $('#reai', el).onclick = runAI;
    } finally { busy = false; }
  }
  if (photos.length === 0 && !apiKey && isNew) {
    aiBox('<b>Manual mode</b><div class="small muted">Add an Anthropic API key in Settings to have AI fill in brand, model, type and year from photos.</div>');
  } else if (photos.length && apiKey && isNew === false) {
    aiBox('<button type="button" class="secondary small" id="reai">✨ Re-identify from photos</button>');
    $('#reai', el).onclick = runAI;
  }

  // Selecting an existing customer fills in their county.
  f('customer').addEventListener('change', () => {
    const c = customers.find((x) => x.name.toLowerCase() === f('customer').value.trim().toLowerCase());
    if (c && c.county && !f('county').value) f('county').value = c.county;
  });

  // ---- save ----
  async function save(another) {
    const brand = normBrand(f('brand').value);
    const model = f('model').value.trim();
    if (!brand && !model && !f('category').value && !photos.length) { toast('Add a photo or some details first'); return; }

    let customerId = null;
    const name = f('customer').value.trim();
    if (name) {
      let c = customers.find((x) => x.name.toLowerCase() === name.toLowerCase());
      if (!c) {
        c = { id: uid(), name, county: f('county').value.trim(), created: Date.now() };
        await put('customers', c);
        customers.push(c);
      }
      customerId = c.id;
      sessionStorage.setItem('lastCustomer', c.id);
    }
    const year = parseInt(f('year').value, 10);
    const hours = parseInt(f('hours').value, 10);
    const out = {
      ...rec, customerId, brand, model,
      category: f('category').value, year: year || null, hours: Number.isFinite(hours) ? hours : null,
      serial: f('serial').value.trim(), condition: f('condition').value, county: f('county').value.trim(),
      status: f('status').value, followUp: f('followUp').value, notes: f('notes').value.trim(),
      photos, thumb: photos[0] ? await resizeImage(photos[0], 240, 0.7) : null,
      lat: loc ? loc.lat : null, lng: loc ? loc.lng : null, acc: loc ? loc.acc : null,
      aiIdentified: rec.aiIdentified || aiUsed, updated: Date.now(),
    };
    await put('equipment', out);
    toast('Saved');
    navigate(another ? '#/add' : '#/equipment/' + out.id);
  }
  f('f').addEventListener('submit', (e) => { e.preventDefault(); save(false); });
  if (isNew) f('saveadd').onclick = () => save(true);
  else f('delete').onclick = async () => {
    if (!confirm('Delete this equipment record?')) return;
    await del('equipment', rec.id);
    toast('Deleted');
    navigate('#/equipment');
  };
}
