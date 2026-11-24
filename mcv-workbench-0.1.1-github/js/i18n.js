import { messages } from './messages.js';

const PREF = 'mcv-lang';
let current = 'en';
const valid = value => value === 'en' || value === 'ru';
export const language = () => current;
export const locale = () => current === 'ru' ? 'ru-RU' : 'en-GB';

export function t(key, vars, lang = current) {
  const entry = Object.hasOwn(messages, key) ? messages[key] : undefined;
  const pattern = entry?.[lang] ?? entry?.en ?? key;
  return vars ? pattern.replace(/\{(\d+)\}/g, (match, name) => Object.hasOwn(vars, name) ? String(vars[name]) : match) : pattern;
}

// Built-in categories have historically been stored by Russian name.
export const original = key => t(key, undefined, 'ru');
export function localizeError(message) {
  const value = String(message ?? '');
  if (current === 'ru') return value;
  if (value === original('error.backup')) return t('error.backup');
  const remote = value.match(/^В (адресе|ключе|коде пространства) лишние символы/);
  if (remote) return t('error.remote', { 0: { адресе: 'URL', ключе: 'key', 'коде пространства': 'space code' }[remote[1]] });
  return value.replace(/^Облако: /, 'Cloud: ');
}
export function label(value, keys, lang = current) {
  const key = keys.find(item => original(item) === value);
  return key ? t(key, undefined, lang) : value;
}

// Build display-only maps once for each active language. Data keys are unchanged.
export function localized(build) {
  let lang = current, result = build();
  const get = () => {
    if (lang !== current) { lang = current; result = build() }
    return result;
  };
  return new Proxy(result, {
    get: (_, key) => Reflect.get(get(), key),
    ownKeys: () => Reflect.ownKeys(get()),
    getOwnPropertyDescriptor: (_, key) => Reflect.getOwnPropertyDescriptor(get(), key),
  });
}

const formatters = new Map();
function formatter(kind, options, lang) {
  const key = JSON.stringify([kind, lang, options]);
  if (!formatters.has(key)) formatters.set(key, new Intl[kind](lang === 'ru' ? 'ru-RU' : 'en-GB', options));
  return formatters.get(key);
}
export const formatNumber = (value, digits = 2) =>
  formatter('NumberFormat', { minimumFractionDigits: digits, maximumFractionDigits: digits }, current).format(value);
export function formatDate(iso, options = { day: 'numeric', month: 'short', year: 'numeric' }, lang = current) {
  if (!iso) return '';
  const normalized = iso.length === 7 ? iso + '-01' : iso.slice(0, 10);
  const day = new Date(normalized + 'T00:00:00Z');
  return Number.isNaN(+day) ? iso : formatter('DateTimeFormat', { ...options, timeZone: 'UTC' }, lang).format(day);
}

// The store owns the schema. Open the existing DB only, and operate on one local KV entry.
function preference(mode, value) {
  return new Promise(resolve => {
    let request;
    try { request = indexedDB.open('mcv-workbench') } catch { resolve(); return }
    request.onupgradeneeded = () => request.transaction.abort();
    request.onerror = request.onblocked = () => resolve();
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('kv')) { db.close(); resolve(); return }
      const transaction = db.transaction('kv', mode);
      const kv = transaction.objectStore('kv');
      const operation = mode === 'readonly' ? kv.get(PREF) : kv.put(value, PREF);
      transaction.oncomplete = () => { db.close(); resolve(operation.result) };
      transaction.onerror = transaction.onabort = () => { db.close(); resolve() };
    };
  });
}

export function translateShell(root = document) {
  document.documentElement.lang = current;
  const manifest = root.querySelector('link[rel="manifest"]');
  if (manifest) manifest.setAttribute('href', current === 'ru' ? 'manifest.ru.webmanifest' : 'manifest.webmanifest');
  root.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = t(node.dataset.i18n) });
  for (const attr of ['aria-label', 'title', 'placeholder', 'alt']) {
    root.querySelectorAll(`[data-i18n-${attr}]`).forEach(node => node.setAttribute(attr, t(node.getAttribute('data-i18n-' + attr))));
  }
}

export async function loadLanguage() {
  const saved = await preference('readonly');
  const requested = new URLSearchParams(location.search).get('lang');
  current = valid(requested) ? requested : valid(saved) ? saved : 'en';
  translateShell();
  return current;
}

export async function setLanguage(value) {
  if (!valid(value)) return;
  current = value;
  const url = new URL(location.href);
  if (url.searchParams.has('lang')) {
    url.searchParams.set('lang', value);
    history.replaceState(history.state, '', url);
  }
  translateShell();
  await preference('readwrite', value);
}

export function languagePicker() {
  return `<div class="row"><b>Language / <span lang="ru">Язык</span></b><div class="seg" role="group" aria-label="${t('language.label')}">
    <button type="button" id="language-en" data-act="language" data-k="en" lang="en" aria-pressed="${current === 'en'}">English</button>
    <button type="button" id="language-ru" data-act="language" data-k="ru" lang="ru" aria-pressed="${current === 'ru'}">Русский</button>
  </div></div>`;
}
