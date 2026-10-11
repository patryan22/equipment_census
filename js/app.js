import { $, $$ } from './util.js';
import * as form from './views/form.js';
import * as equipment from './views/equipment.js';
import * as customers from './views/customers.js';
import * as dashboard from './views/dashboard.js';
import * as settings from './views/settings.js';

// [pattern, view, tab, title, backHref]
const ROUTES = [
  [/^#\/add$/, form, 'add', 'Add Equipment'],
  [/^#\/equipment\/([\w-]+)\/edit$/, form, 'equipment', 'Edit Equipment', '#/equipment'],
  [/^#\/equipment\/([\w-]+)$/, equipment.detail, 'equipment', 'Equipment', '#/equipment'],
  [/^#\/equipment$/, equipment, 'equipment', 'Fleet'],
  [/^#\/customers\/([\w-]+)$/, customers.detail, 'customers', 'Customer', '#/customers'],
  [/^#\/customers$/, customers, 'customers', 'Customers'],
  [/^#\/dashboard$/, dashboard, 'dashboard', 'Insights'],
  [/^#\/settings$/, settings, '', 'Settings', '#/equipment'],
];

let cleanup = null;

async function route() {
  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  const [path, qs] = (location.hash || '#/equipment').split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  const main = $('#main');
  for (const [re, view, tab, title, back] of ROUTES) {
    const m = path.match(re);
    if (!m) continue;
    $('#title').textContent = title;
    $('#back').hidden = !back;
    if (back) $('#back').setAttribute('href', back);
    $$('#tabs a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
    main.innerHTML = '';
    window.scrollTo(0, 0);
    try {
      const fn = view.render || view;
      cleanup = (await fn(main, { params: m.slice(1), query })) || null;
    } catch (err) {
      console.error(err);
      main.innerHTML = `<div class="empty">Something went wrong.<br><span class="small">${String(err.message || err)}</span></div>`;
    }
    return;
  }
  location.replace('#/equipment');
}

window.addEventListener('hashchange', route);
route();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
