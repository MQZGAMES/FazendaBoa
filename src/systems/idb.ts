/** Chave-valor mínimo sobre IndexedDB, com fallback para localStorage (só strings). */
const DB_NAME = 'fazendaboa';
const STORE = 'kv';
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (!('indexedDB' in window)) { resolve(null); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbPromise;
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  if (!db) {
    const v = localStorage.getItem('fb:' + key);
    return v == null ? undefined : (JSON.parse(v) as T);
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const r = tx.objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result as T | undefined);
      r.onerror = () => resolve(undefined);
    } catch { resolve(undefined); }
  });
}

export async function idbSet(key: string, value: unknown): Promise<boolean> {
  const db = await openDb();
  if (!db) {
    if (value instanceof Blob) return false;
    try { localStorage.setItem('fb:' + key, JSON.stringify(value)); return true; } catch { return false; }
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch { resolve(false); }
  });
}

export async function idbDel(key: string): Promise<void> {
  const db = await openDb();
  if (!db) { localStorage.removeItem('fb:' + key); return; }
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch { resolve(); }
  });
}
