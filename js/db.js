// Thin promise wrapper over IndexedDB. All data lives on the device.
const NAME = 'equipment_census';
let dbp;

function open() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const r = indexedDB.open(NAME, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('customers', { keyPath: 'id' });
        d.createObjectStore('equipment', { keyPath: 'id' });
        d.createObjectStore('settings', { keyPath: 'key' });
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  return dbp;
}

async function run(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req && req.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const getAll = (s) => run(s, 'readonly', (o) => o.getAll());
export const get = (s, id) => run(s, 'readonly', (o) => o.get(id));
export const put = (s, v) => run(s, 'readwrite', (o) => o.put(v));
export const del = (s, id) => run(s, 'readwrite', (o) => o.delete(id));
export const clear = (s) => run(s, 'readwrite', (o) => o.clear());

export async function putMany(store, items) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, 'readwrite');
    const o = t.objectStore(store);
    items.forEach((i) => o.put(i));
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function getSetting(key, def) {
  const r = await get('settings', key);
  return r && r.value !== undefined ? r.value : def;
}
export const setSetting = (key, value) => put('settings', { key, value });
