import { getAll, getSetting } from '../db.js';
import { $, $$, esc, getPosition, toast } from '../util.js';
import { isBobcat, isOpportunity, titleOf, DEFAULT_AGE_THRESHOLD } from '../insights.js';

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist/';

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  return new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = LEAFLET + 'leaflet.css';
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = LEAFLET + 'leaflet.js';
    s.onload = () => resolve(window.L);
    s.onerror = () => reject(new Error('Map library could not load. Check your connection.'));
    document.head.appendChild(s);
  });
}

export async function render(el) {
  const [equipment, customers, threshold] = await Promise.all([getAll('equipment'), getAll('customers'), getSetting('ageThreshold', DEFAULT_AGE_THRESHOLD)]);
  const cname = new Map(customers.map((c) => [c.id, c.name]));
  const located = equipment.filter((e) => e.lat != null && e.lng != null);

  el.innerHTML = `
    <div class="seg" id="seg" style="margin-bottom:8px">
      <button class="on" data-f="all">All</button><button data-f="bobcat">Bobcat</button>
      <button data-f="comp">Competitor</button><button data-f="opp">★ Opps</button></div>
    <div id="mapbox"></div>
    <div class="row-flex small muted" style="margin-top:8px;justify-content:space-between">
      <span><span style="color:var(--bobcat)">●</span> Bobcat &nbsp;<span style="color:var(--comp)">●</span> Competitor &nbsp;<span style="color:var(--bad)">◯</span> Opportunity</span>
      <span id="mcount"></span></div>`;

  let L;
  try { L = await loadLeaflet(); }
  catch (err) { $('#mapbox', el).innerHTML = `<div class="empty">${esc(err.message)}</div>`; return; }

  const map = L.map('mapbox', { zoomControl: true }).setView([40.25, -74.6], 8);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
  const layer = L.layerGroup().addTo(map);
  let fit = true;

  function draw(filter) {
    layer.clearLayers();
    const pts = [];
    const shown = located.filter((e) => filter === 'all' || (filter === 'bobcat' && isBobcat(e)) || (filter === 'comp' && !isBobcat(e)) || (filter === 'opp' && isOpportunity(e, threshold)));
    for (const e of shown) {
      const opp = isOpportunity(e, threshold);
      L.circleMarker([e.lat, e.lng], {
        radius: 9, weight: opp ? 3 : 1.5, color: opp ? '#d6336c' : '#fff', fillColor: isBobcat(e) ? '#e8590c' : '#3b6fb6', fillOpacity: 0.95,
      }).addTo(layer).bindPopup(`<b>${esc(titleOf(e))}</b><br>${esc(cname.get(e.customerId) || 'No customer')}${e.county ? ' · ' + esc(e.county) : ''}<br><a href="#/equipment/${e.id}">Open details</a>`);
      pts.push([e.lat, e.lng]);
    }
    $('#mcount', el).textContent = `${shown.length} of ${equipment.length} on map`;
    if (fit && pts.length) { map.fitBounds(pts, { padding: [30, 30], maxZoom: 14 }); fit = false; }
  }
  $('#seg', el).addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    $$('#seg button', el).forEach((x) => x.classList.toggle('on', x === b));
    draw(b.dataset.f);
  });
  draw('all');
  if (!located.length) toast('No located equipment yet. Photos taken with location on appear here.');

  // Blue dot for "where am I" to plan the next stop.
  getPosition().then((p) => L.circleMarker([p.lat, p.lng], { radius: 7, color: '#fff', weight: 2, fillColor: '#0a84ff', fillOpacity: 1 }).addTo(map).bindPopup('You are here')).catch(() => {});
  setTimeout(() => map.invalidateSize(), 200);
  return () => map.remove();
}
