// MCV Workbench — local-first document store.
// Every record is a document at "collection/id". Documents live in IndexedDB on the device,
// so the app works fully offline. When a cloud database is configured (Supabase), changes are
// pushed and pulled in the background; conflicts resolve by "last edit wins" (field `updated`).

const DB_NAME = 'mcv-workbench', DB_VER = 1;
let idb = null;
const mem = new Map();            // path -> {path, body, updated, deleted, dirty}
const listeners = new Set();
let remote = null;                // {url, key, space}
let syncing = null, timer = null;
export const status = { state: 'local', at: '', error: '', pending: 0 };

function req(r) { return new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error) }) }
function store(name, mode = 'readonly') { return idb.transaction(name, mode).objectStore(name) }
async function kvGet(k) { return req(store('kv').get(k)) }
async function kvSet(k, v) { return req(store('kv', 'readwrite').put(v, k)) }

export async function init() {
  idb = await new Promise((ok, no) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('docs', { keyPath: 'path' }); d.createObjectStore('kv') };
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  });
  for (const rec of await req(store('docs').getAll())) mem.set(rec.path, rec);
  remote = (await kvGet('remote')) || null;
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  countPending();
  if (remote) { status.state = 'idle'; schedule(500) }
  return mem.size;
}

const now = () => new Date().toISOString();
function emit(paths) { for (const f of listeners) try { f(paths) } catch (e) { console.error(e) } }
function countPending() { status.pending = [...mem.values()].filter(r => r.dirty).length }
function writeRec(rec) { mem.set(rec.path, rec); return req(store('docs', 'readwrite').put(rec)) }

export function on(fn) { listeners.add(fn); return () => listeners.delete(fn) }
export function get(path) { const r = mem.get(path); return r && !r.deleted ? r.body : null }
export function all(col) {
  const out = [], pre = col + '/';
  for (const r of mem.values()) if (!r.deleted && r.path.startsWith(pre) && !r.path.slice(pre.length).includes('/')) out.push({ id: r.path.slice(pre.length), ...r.body });
  return out;
}
export async function set(path, body) {
  const rec = { path, body: JSON.parse(JSON.stringify(body)), updated: now(), deleted: false, dirty: 1 };
  await writeRec(rec); countPending(); emit([path]); schedule(1500);
}
export async function del(path) {
  const rec = { path, body: {}, updated: now(), deleted: true, dirty: 1 };
  await writeRec(rec); countPending(); emit([path]); schedule(1500);
}

// First run: load the bundled data set (tasks from Trello, sources, settings).
export async function seedIfEmpty(url) {
  if (mem.size || (await kvGet('seeded'))) return false;
  let docs;
  try { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) { await kvSet('seeded', 'none'); return false } docs = await r.json() } catch (e) { return false }
  const t = '2000-01-01T00:00:00.000Z';   // old timestamp: any real edit (local or cloud) wins over seed data
  for (const [path, body] of Object.entries(docs)) await writeRec({ path, body, updated: t, deleted: false, dirty: 1 });
  await kvSet('seeded', now()); countPending(); emit(Object.keys(docs)); return true;
}

// Backup file: everything, including deletions, so it can be merged on another device.
export function exportAll() { return { app: 'mcv-workbench', exported: now(), docs: [...mem.values()].map(({ dirty, ...r }) => r) } }
export async function importAll(json) {
  const docs = json && json.docs; if (!Array.isArray(docs)) throw new Error('Это не файл резервной копии MCV Workbench');
  let n = 0;
  for (const r of docs) { const cur = mem.get(r.path); if (!cur || r.updated > cur.updated) { await writeRec({ ...r, dirty: 1 }); n++ } }
  countPending(); emit(docs.map(d => d.path)); schedule(500); return n;
}

/* ---------- cloud sync (Supabase / PostgREST) ---------- */
export function remoteConfig() { return remote ? { ...remote } : null }
export async function setRemote(cfg) {
  if (cfg) for (const [k, n] of [['url', 'адресе'], ['key', 'ключе'], ['space', 'коде пространства']])
    if (cfg[k] && !/^[\x21-\x7e]+$/.test(cfg[k].trim())) throw new Error(`В ${n} лишние символы (пробел, «…» или русские буквы). Скопируй заново кнопкой копирования.`);
  if (cfg && cfg.url) cfg.url = cfg.url.trim().replace(/\/rest\/v1\/?$/, '');
  remote = cfg && cfg.url && cfg.key && cfg.space ? { url: cfg.url.replace(/\/+$/, ''), key: cfg.key.trim(), space: cfg.space.trim() } : null;
  await kvSet('remote', remote); await kvSet('cursor', '');
  if (remote) { for (const r of mem.values()) if (!r.dirty) await writeRec({ ...r, dirty: 1 }); countPending(); status.state = 'idle'; return syncNow() }
  status.state = 'local'; emit([]);
}
// New Supabase keys (sb_publishable_…) go only in the apikey header; legacy anon JWTs (eyJ…) also as Bearer.
function headers(extra = {}) { const h = { apikey: remote.key, 'x-space': remote.space, 'Content-Type': 'application/json', ...extra }; if (remote.key.startsWith('eyJ')) h.Authorization = 'Bearer ' + remote.key; return h }
function schedule(ms) { if (!remote) return; clearTimeout(timer); timer = setTimeout(() => syncNow().catch(() => {}), ms) }

export function syncNow() {
  if (!remote) return Promise.resolve({ local: true });
  if (syncing) return syncing;
  if (!navigator.onLine) { status.state = 'offline'; emit([]); schedule(30000); return Promise.resolve({ offline: true }) }
  status.state = 'syncing'; emit([]);
  syncing = (async () => {
    const base = remote.url + '/rest/v1/docs';
    // 1. pull everything changed on the server since the last pull
    let cursor = (await kvGet('cursor')) || '', pulled = 0, changed = [];
    for (;;) {
      const q = `?space=eq.${encodeURIComponent(remote.space)}&order=synced_at.asc&limit=500` + (cursor ? `&synced_at=gt.${encodeURIComponent(cursor)}` : '');
      const r = await fetch(base + q, { headers: headers() });
      if (!r.ok) throw new Error('Облако: ' + r.status + ' ' + (await r.text()).slice(0, 160));
      const rows = await r.json();
      for (const row of rows) {
        const cur = mem.get(row.path);
        if (!cur || row.updated >= cur.updated) { await writeRec({ path: row.path, body: row.body || {}, updated: row.updated, deleted: !!row.deleted, dirty: 0 }); changed.push(row.path) }
        cursor = row.synced_at; pulled++;
      }
      await kvSet('cursor', cursor);
      if (rows.length < 500) break;
    }
    // 2. push local edits
    const dirty = [...mem.values()].filter(r => r.dirty);
    const chunks = []; let cur = [], size = 0;           // ~300 KB per request (calibration tables are big)
    for (const d of dirty) { const z = JSON.stringify(d.body).length; if (cur.length && (size + z > 300000 || cur.length >= 200)) { chunks.push(cur); cur = []; size = 0 } cur.push(d); size += z }
    if (cur.length) chunks.push(cur);
    for (const chunk of chunks) {
      const r = await fetch(base + '?on_conflict=space,path', { method: 'POST', headers: headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(chunk.map(d => ({ space: remote.space, path: d.path, body: d.body, updated: d.updated, deleted: d.deleted }))) });
      if (!r.ok) throw new Error('Облако: ' + r.status + ' ' + (await r.text()).slice(0, 160));
      for (const d of chunk) { const cur = mem.get(d.path); if (cur && cur.updated === d.updated) await writeRec({ ...cur, dirty: 0 }) }
    }
    countPending();
    Object.assign(status, { state: 'idle', at: now(), error: '' });
    if (changed.length) emit(changed); else emit([]);
    return { pulled, pushed: dirty.length };
  })().catch(e => { Object.assign(status, { state: 'error', error: e.message || String(e) }); emit([]); throw e })
    .finally(() => { syncing = null; schedule(60000) });
  return syncing;
}
addEventListener('online', () => schedule(300));
addEventListener('focus', () => schedule(300));
document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(300) });
