export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const uid = () =>
  crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

export const CATEGORIES = [
  'Compact Track Loader', 'Skid Steer Loader', 'Compact Excavator', 'Excavator', 'Backhoe Loader',
  'Wheel Loader', 'Telehandler', 'Utility Vehicle', 'Compact Tractor', 'Tractor', 'Mower',
  'Forklift', 'Dozer', 'Attachment', 'Trailer', 'Truck', 'Light Tower / Generator', 'Compressor', 'Other',
];
export const BRANDS = [
  'Bobcat', 'Caterpillar', 'John Deere', 'Kubota', 'Case', 'New Holland', 'Takeuchi', 'Komatsu', 'Volvo', 'JCB',
  'Gehl', 'Mustang', 'ASV', 'Yanmar', 'Hitachi', 'Doosan', 'Hyundai', 'Link-Belt', 'Wacker Neuson', 'Manitou',
  'Genie', 'JLG', 'Ditch Witch', 'Vermeer', 'Toro', 'Kioti', 'Mahindra', 'Massey Ferguson', 'Ford', 'Toyota', 'Hyster',
];
const BRAND_ALIASES = { cat: 'Caterpillar', caterpillar: 'Caterpillar', deere: 'John Deere', 'john deere': 'John Deere', jd: 'John Deere',
  'case ih': 'Case', 'case construction': 'Case', 'new holland': 'New Holland', nh: 'New Holland', 'link belt': 'Link-Belt',
  'wacker': 'Wacker Neuson', 'wacker neuson': 'Wacker Neuson', 'ditchwitch': 'Ditch Witch', 'massey': 'Massey Ferguson' };
export function normBrand(b) {
  const t = String(b || '').trim();
  if (!t) return '';
  const k = t.toLowerCase();
  if (BRAND_ALIASES[k]) return BRAND_ALIASES[k];
  const hit = BRANDS.find((x) => x.toLowerCase() === k);
  return hit || t.replace(/\b\w/g, (c) => c.toUpperCase());
}
export const CONDITIONS = ['Unknown', 'Excellent', 'Good', 'Fair', 'Poor'];
export const STATUSES = ['', 'Lead', 'Contacted', 'Quoted', 'Won', 'Lost'];
export const NJ_COUNTIES = ['Atlantic', 'Bergen', 'Burlington', 'Camden', 'Cape May', 'Cumberland', 'Essex', 'Gloucester', 'Hudson',
  'Hunterdon', 'Mercer', 'Middlesex', 'Monmouth', 'Morris', 'Ocean', 'Passaic', 'Salem', 'Somerset', 'Sussex', 'Union', 'Warren'];

// Object URLs for photos are tracked so the router can free them on navigation.
const urls = [];
export function blobURL(b) { const u = URL.createObjectURL(b); urls.push(u); return u; }
export function revokeURLs() { urls.splice(0).forEach((u) => URL.revokeObjectURL(u)); }

let toastTimer;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

export function navigate(hash) {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
}

export function sheet(html) {
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet">${html}</div>`;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
  return { el: bg.firstElementChild, close };
}

export function lightbox(src) {
  const o = document.createElement('div');
  o.className = 'overlay';
  o.innerHTML = `<img src="${src}" alt=""><button class="x" aria-label="Close">&times;</button>`;
  o.addEventListener('click', () => o.remove());
  document.body.appendChild(o);
}

export function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location not supported'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }),
      (e) => reject(new Error(e.code === 1 ? 'Location permission denied' : 'Could not get location')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  });
}

// iOS: the share sheet lets the user save to Files; falls back to a normal download.
export async function saveFile(blob, filename) {
  const file = new File([blob], filename, { type: blob.type });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return;
    }
  } catch (e) {
    if (e.name === 'AbortError') return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

export const fmtDate = (t) => (t ? new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '');
