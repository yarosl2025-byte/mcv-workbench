import { t as tr, original as orig, label as displayLabel, localized, language, locale, formatNumber, formatDate, languagePicker, setLanguage, loadLanguage, localizeError } from "./i18n.js";
import * as db from './store.js';
import * as CLO from './clo.js';
import * as T from './tanks.js';
import * as RR from './rhrs.js';
import * as ENG from './eng.js';
import * as EQ from './equip.js';

import { priorityLevels, levels, taskColor, urgencyBadge, urgencyChips, urgencyOf, urgencySettings } from './urgency.js';
import { decorateIcons, ico } from './icons.js';
import { isBiolab, markTiles, terminal, updateClock } from './biolab.js';
import * as PREVIEW from './preview-views.js';
import * as SHIP from './ship.js';

const VERSION = '0.7.1';
const TASK_PRIORITIES = localized(() => ({ urgent: tr("s1"), medium: tr("s2"), later: tr("s3"), '': tr("s4") }));
const PRIORITY_ORDER = Object.keys(TASK_PRIORITIES);
const LEGACY_PRIORITY = { 1: 'medium', 2: 'medium', 3: 'later', 4: '' }; // 'urgent' is only ever set by hand
const PRIORITY_ROUTE = 'plan/priorities';
function taskPriority(task) {
  if (Object.hasOwn(task, 'pri')) {
    return typeof task.pri === 'string' && Object.hasOwn(TASK_PRIORITIES, task.pri) ? task.pri : '';
  }
  return Object.hasOwn(LEGACY_PRIORITY, task.prio) ? LEGACY_PRIORITY[task.prio] : '';
}
const appearance = window.MCVAppearance;
appearance.setTranslator?.(tr);
const theme = () => document.documentElement.dataset.theme;
const defaultView = () => theme() === 'old' ? 'today' : 'ship';
const CATS = ['Док', 'PMS', 'ABS', 'Заказы', 'Офис', 'Текущие', 'IT', 'Logbook', 'Отчёты', 'Почта'];
const categoryText = value => displayLabel(value, ["s5", "s6", "s7", "s8", "s9", "s10", "s159", "s160", "s161", "s162", "s325"]);
const ST = localized(() => ({ inbox: tr("s11"), todo: tr("s12"), doing: tr("s13"), wait: tr("s14"), done: tr("s15") }));
const SLOTS = localized(() => ({ '': tr("s16"), am: tr("s17"), noon: tr("s18"), pm: tr("s19"), eve: tr("s20") }));
const REP = localized(() => ({ '': tr("s21"), daily: tr("s22"), weekly: tr("s23"), monthly: tr("s24") }));
const DOW = localized(() => ([tr("s25"), tr("s26"), tr("s27"), tr("s28"), tr("s29"), tr("s30"), tr("s31")]));
const MON = localized(() => ([tr("s32"), tr("s33"), tr("s34"), tr("s35"), tr("s36"), tr("s37"), tr("s38"), tr("s39"), tr("s40"), tr("s41"), tr("s42"), tr("s43")]));
const MON1 = localized(() => ([tr("s44"), tr("s45"), tr("s46"), tr("s47"), tr("s48"), tr("s49"), tr("s50"), tr("s51"), tr("s52"), tr("s53"), tr("s54"), tr("s55")]));
const VIEWS = ['ship', 'today', 'plan', 'alerts', 'pms', 'rhrs', 'perf', 'tanks', 'lube', 'reefer', 'log', 'bwm', 'oil', 'dg', 'fuel', 'notes', 'lochart', 'equip', 'sync', 'more', 'urgency', 'icons', 'biolab'];

const S = { tasks: new Map(), sources: [], feed: [], settings: {}, loaded: false, taskPriority: null,
  view: 'today', urgency: '', mode: 'week', off: 0, sel: null, cat: '', q: '', hideDone: true, mOff: 0, rolled: false, edit: null, undo: null,
  lubeTab: 'clo', install: null, tankTab: 'daily', sDate: null, sDraft: null, tmOff: 0, tmUnit: 'cm', robDraft: null, logTab: 'scrape', scDraft: null, lgQ: '', lgCode: '', lgYear: null, lgMore: 100, pmDs: '', pmQ: '', pmResp: 'eng', pmFree: false, pmMore: 80, pfG: 'exh', bwM: 'dev', bwFrom: '', bwDay: '' };
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) };
const today = () => iso(new Date());
const add = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d) };
const addM = (s, n) => { const d = parse(s); d.setMonth(d.getMonth() + n); return iso(d) };
const diff = (a, b) => Math.round((parse(a) - parse(b)) / 864e5);
const dshort = s => { const d = parse(s); return DOW[d.getDay()] + ' ' + d.getDate() };
const dlong = s => { if (language() === 'en') return formatDate(s); const d = parse(s); return d.getDate() + ' ' + MON[d.getMonth()] };
const plural = (n, a, b, c) => { if (language() === 'en') return n === 1 ? a : b; const m = n % 10, h = n % 100; return m == 1 && h != 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c };
const num = (x, d = 2) => x == null || isNaN(x) ? '—' : formatNumber(Number(x), d);
const ls = { get(k) { try { return localStorage.getItem(k) } catch (e) { return null } }, set(k, v) { try { localStorage.setItem(k, v) } catch (e) {} } };
const narrow = () => matchMedia('(max-width:760px)').matches;
S.mode = ls.get('mcv.mode') || 'week';
const live = () => [...S.tasks.values()].filter(t => t.status !== 'dropped');
const isOver = t => t.status !== 'done' && t.status !== 'inbox' && t.due && t.due < today() && (!t.day || t.day <= today());
const match = t => (!S.cat || t.cat === S.cat) && (!S.q || (t.title + ' ' + (t.note || '') + ' ' + (t.owner || '')).toLowerCase().includes(S.q.toLowerCase()));
const limit = () => Number(S.settings.dayLimit) || 8;
const uid = p => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
PREVIEW.init({ tasks: live, esc });
SHIP.init({ today, add, diff, pmsJobs, tasks: live });
EQ.init({ S, render: () => render(), refresh: () => requestRender(), toast: (m, p) => toast(m, p), put: (a, b) => put(a, b) });
ENG.init({ S, render: () => render(), refresh: () => requestRender(), toast: (m, p) => toast(m, p), put: (a, b) => put(a, b), feed: t => feed(t), openTask: (title, note) => { openEd(null); const f = $('#edf'); if (f) { f.title.value = title; f.note.value = note } } });

/* ---------- data ---------- */
function load() {
  S.tasks = new Map(db.all('tasks').map(t => [t.id, t]));
  S.sources = db.all('sources');
  S.feed = db.all('feed').sort((a, b) => (b.at || '').localeCompare(a.at || '')).slice(0, 40);
  S.settings = db.get('meta/settings') || {};
  const vs = db.get('cal/clo-vessel'); if (vs && vs.name) $('#brandsub').textContent = vs.name + tr("s56");
}
function put(path, body, onSaved) { return db.set(path, body).then(onSaved).catch(e => toast(tr("s57") + (e.message || e))) }
const draftSaves = new Map();
function saveDraft(path, draft, delay, stateKey) {
  clearTimeout(draftSaves.get(path)?.timer);
  const body = structuredClone(draft);
  const save = {};
  draftSaves.set(path, save);
  const write = () => put(path, body, () => {
    if (draftSaves.get(path) !== save) return;
    draftSaves.delete(path);
    if (stateKey) S[stateKey] = null;
  });
  if (delay) save.timer = setTimeout(write, delay);
  else write();
}
function saveTask(t, msg, prev) {
  t.updated = new Date().toISOString();
  S.tasks.set(t.id, t);
  put('tasks/' + t.id, strip(t), () => { if (msg) toast(msg, prev) });
  render();
}
const strip = o => { const { id, ...r } = o; return r };
function feed(text) { const id = uid('f'); const f = { text, at: new Date().toISOString(), by: orig("s58") }; S.feed.unshift({ id, ...f }); put('feed/' + id, f) }

/* ---------- toast + undo ---------- */
let tt;
function toast(msg, prev) { $('#tmsg').textContent = msg; S.undo = prev || null; $('#tundo').hidden = !prev; $('#toast').hidden = false; clearTimeout(tt); tt = setTimeout(() => { $('#toast').hidden = true; S.undo = null }, 5000) }
$('#tundo').addEventListener('click', () => { if (!S.undo) return; const p = S.undo; S.undo = null; $('#toast').hidden = true;
  if (p._new) { S.tasks.delete(p.id); db.del('tasks/' + p.id); render() } else if (p._row) { db.set(p._row, p.body) } else saveTask(p) });

/* ---------- task ops ---------- */
function toggle(id) {
  const t = S.tasks.get(id); if (!t) return; const prev = { ...t };
  if (t.status === 'done') { t.status = 'todo'; t.doneAt = '' } else { t.status = 'done'; t.doneAt = today();
    if (t.repeat) { const n = { ...t, id: uid('t'), status: 'todo', doneAt: '', moved: 0, created: today() };
      const step = t.repeat === 'daily' ? d => add(d, 1) : t.repeat === 'weekly' ? d => add(d, 7) : d => addM(d, 1);
      n.day = step(t.day || today()); if (t.due) n.due = step(t.due); saveTask(n) } }
  saveTask(t, t.status === 'done' ? tr("s59") + t.title : tr("s60"), prev);
}
function move(id, day, status) { const t = S.tasks.get(id); if (!t) return; const prev = { ...t };
  if (day !== undefined) { if (t.day && day && day > t.day && t.status !== 'inbox') t.moved = (t.moved || 0) + 1; t.day = day }
  if (status) t.status = status; else if (t.status === 'inbox') t.status = 'todo';
  saveTask(t, day ? tr("s61") + dshort(day) : day === '' ? tr("s62") : tr("s63") + ST[t.status], prev) }
function rollover() {
  if (S.rolled) return; S.rolled = true; const td = today(); let n = 0;
  for (const t of live()) if (t.status !== 'done' && t.status !== 'inbox' && t.day && t.day < td && (!t.due || t.due >= td)) { t.day = td; t.moved = (t.moved || 0) + 1; put('tasks/' + t.id, strip(t)); n++ }
  if (n) { feed(tr("s64") + n + ' ' + plural(n, tr("s65"), tr("s66"), tr("s67"))); render() }
}

/* ---------- pieces ---------- */
function card(t, opt = {}) {
  const o = isOver(t), soon = !o && t.status !== 'done' && t.due && diff(t.due, today()) <= 2;
  const level = urgencyOf(t), color = taskColor(t.color), priority = taskPriority(t);
  return `<div class="t task-card${t.status === 'done' ? ' done' : ''}" data-urgency="${level}" data-priority="${priority}" draggable="${!!opt.drag}" data-id="${esc(t.id)}" data-act="open">
  <input type="checkbox" aria-label="${tr("s15")}" data-act="toggle" ${t.status === 'done' ? 'checked' : ''}>
  ${urgencyBadge(level)}
  <div class="tb"><span class="tt">${priority ? `<span class="priority-dot" role="img" aria-label="${tr("s68", {0: (TASK_PRIORITIES[priority])})}"></span>` : ''}${color ? `<span class="task-dot" data-task-color="${color}" role="img" aria-label="${tr("s69", {1: (color)})}"></span>` : ''}${esc(t.title)}</span><span class="meta">
  <span class="tag ${esc(t.cat)}">${esc(categoryText(t.cat))}</span>${t.prio == 1 ? '<span class="tag p1">P1</span>' : ''}${t.att && t.att.length ? `<span class="tag att-tag">${ico('file', { size: 12 })} ${t.att.length}</span>` : ''}
  ${o ? `<span class="tag warn">${tr("s70", {0: (diff(today(), t.due))})}</span>` : soon ? `<span class="tag warn">${tr("s71", {0: (dlong(t.due))})}</span>` : t.due && opt.showDue ? `<span class="small">${tr("s71", {0: (dlong(t.due))})}</span>` : ''}
  ${t.moved >= 2 ? `<span class="small">${tr("s72", {0: (t.moved)})}</span>` : ''}${t.status === 'wait' ? `<span class="small">${tr("s73", {0: (t.waiting ? ': ' + esc(t.waiting) : '')})}</span>` : ''}
  ${t.repeat ? `<span class="small">${tr("s74")}</span>` : ''}${t.pmsClosed && t.status !== 'done' ? ("<span class=\"tag\" style=\"color:var(--blue)\">" + tr("s75") + "</span>") : t.pms && t.pms.some(p => p.ds === 'Overdue') ? ("<span class=\"tag warn\">" + tr("s76") + "</span>") : ''}${opt.day && t.day ? `<span class="small">${dshort(t.day)}</span>` : ''}</span></div>
  <button type="button" class="task-reply" data-act="reply" data-icon="reply" aria-label="${tr("s77")}" title="${tr("s77")}" aria-pressed="${t.reply === true}"></button></div>`;
}
const listOf = (arr, opt) => arr.length ? arr.map(t => card(t, opt)).join('') : ("<div class=\"empty\">" + tr("s78") + "</div>");
const byPrio = (a, b) => (a.prio || 3) - (b.prio || 3) || (a.due || '9').localeCompare(b.due || '9');
const byDue = (a, b) => (a.due || '9').localeCompare(b.due || '9');
const byTaskPriority = (a, b) =>
  PRIORITY_ORDER.indexOf(taskPriority(a)) - PRIORITY_ORDER.indexOf(taskPriority(b)) || byDue(a, b);
function counts() { const td = today(), L = live();
  return { today: L.filter(t => t.day === td && t.status !== 'done' && t.status !== 'inbox').length, over: L.filter(isOver).length,
    inbox: L.filter(t => t.status === 'inbox').length, stale: S.sources.filter(s => staleDays(s) > 0).length } }
function staleDays(s) { if (!s.last) return 0; return diff(today(), s.last) - (Number(s.norm) || 0) }
function cdown(date, name, label) { if (!date) return ''; const n = diff(date, today());
  return `<div class="card"><div class="lbl">${esc(label)}</div><div class="big" style="color:var(--acc)">${n >= 0 ? n + ' ' + plural(n, tr("s79"), tr("s80"), tr("s81")) : tr("s82")}</div><div class="lbl">${esc(name || '')} · ${dlong(date)}</div></div>` }

/* ---------- Сегодня ---------- */
function vToday() {
  const td = today(), c = counts(), L = live();
  const mine = L.filter(t => t.day === td && t.status !== 'inbox').sort(byPrio);
  const over = L.filter(isOver).sort((a, b) => a.due.localeCompare(b.due));
  const soon = L.filter(t => t.status !== 'done' && t.due && t.due > td && diff(t.due, td) <= 3 && t.day !== td).sort((a, b) => a.due.localeCompare(b.due));
  const replies = L.filter(t => t.reply === true && t.status !== 'done' && !mine.includes(t) && !over.includes(t) && !soon.includes(t));
  const d = new Date();
  const stat = (href, n, lbl, col) => `<a class="stat" href="${href}"><b style="color:${n ? col : 'inherit'}">${n}</b><span class="lbl">${lbl}</span></a>`;
  return `<div><div class="sub">${[tr("s83"), tr("s84"), tr("s85"), tr("s86"), tr("s87"), tr("s88"), tr("s89")][d.getDay()]}, ${dlong(td)}</div><h1>${tr("s99")}</h1></div>
  ${!S.tasks.size ? `<a class="banner" href="#sync">${tr("s90")}</a>` : ''}
  <div class="grid2">${cdown(S.settings.dockDate, S.settings.dockName, tr("s91"))}${cdown(S.settings.absDate, S.settings.absName, 'ABS')}</div>
  <div class="grid4">${stat('#plan', c.today, tr("s92"), 'inherit')}${stat('#alerts', c.over, tr("s93"), 'var(--red)')}${stat('#alerts', c.inbox, tr("s94"), 'var(--blue)')}${stat('#sync', c.stale, tr("s95"), 'var(--acc)')}</div>
  <section class="card"><div class="row between"><h2>${tr("s100")}</h2><span class="sub">${mine.filter(t => t.status !== 'done').length} / ${limit()}</span></div><div class="list mt">${listOf(mine, { showDue: true })}</div></section>
  ${over.length ? `<section class="card"><div class="row between"><h2 style="color:var(--red)">${tr("s96", {0: (over.length)})}</h2><a href="#alerts" class="sub">${tr("s97")}</a></div><div class="list mt">${listOf(over.slice(0, 6), {})}</div></section>` : ''}
  <section class="card"><h2>${tr("s101")}</h2><div class="list mt">${listOf(soon.slice(0, 8), { day: true })}</div></section>
  ${replies.length ? `<section class="card"><h2>${tr("s77")}</h2><div class="list mt">${listOf(replies, { showDue: true })}</div></section>` : ''}
  <section class="card feed"><h2 style="margin-bottom:6px">${tr("s102")}</h2>${S.feed.slice(0, 6).map(f => `<div><span>${esc(f.text)}</span><time>${f.at ? dshort(f.at.slice(0, 10)) : ''}</time></div>`).join('') || ("<div class=\"empty\">" + tr("s98") + "</div>")}</section>`;
}

/* ---------- Планировщик ---------- */
function toolbar() {
  const grouped = S.taskPriority !== null;
  return `<div class="row between"><div><h1>${grouped ? tr("s103") : tr("s104")}</h1>${grouped ? '' : `<div class="sub">${narrow() ? tr("s105") : S.mode === 'month' ? tr("s106") : tr("s107")}</div>`}</div>
  ${grouped ? ("<a class=\"chip priority-chip\" href=\"#plan\">" + tr("s108") + "</a>")
    : `<div class="seg" role="group" aria-label="${tr("s113")}">${[['week', tr("s109")], ['status', tr("s110")], ['day', tr("s111")], ['month', tr("s112")]].map(([k, v]) => `<button data-act="mode" data-m="${k}" aria-pressed="${S.mode === k}">${v}</button>`).join('')}</div>`}</div>
  <div class="row between"><div class="chips">${['', ...CATS.slice(0, 7)].map(c => `<button class="chip" data-act="cat" data-c="${c}" aria-pressed="${S.cat === c}">${c ? esc(categoryText(c)) : tr("s114")}</button>`).join('')}</div>
  <div class="row"><input class="search" id="q" type="search" placeholder="${tr("s115")}" value="${esc(S.q)}" aria-label="${tr("s116")}"><label class="sub"><input type="checkbox" data-act="hide" ${S.hideDone ? 'checked' : ''}> ${tr("s117")}</label></div></div>`;
}
function priorityChips(groups, total) {
  return `<nav class="chips priority-filters" aria-label="${tr("s118")}">${['all', ...PRIORITY_ORDER.filter(Boolean)].map(key => {
    const all = key === 'all', active = key === S.taskPriority;
    return `<a id="task-priority-${key}" class="chip priority-chip" href="#${PRIORITY_ROUTE}${all ? '' : '/' + key}" data-priority="${all ? '' : key}"${active ? ' aria-current="page"' : ''}>${all ? tr("s114") : `<span class="priority-dot" aria-hidden="true"></span>${TASK_PRIORITIES[key]}`} <b>${all ? total : groups[key].length}</b></a>`;
  }).join('')}</nav>`;
}

function weekDays() { const s = add(today(), S.off * 7); return [...Array(7)].map((_, i) => add(s, i)) }
function vPlan() {
  const L = live().filter(match).filter(t => !(S.hideDone && t.status === 'done' && t.day !== today()));
  const groups = { urgent: [], medium: [], later: [], '': [] };
  for (const task of L) groups[taskPriority(task)].push(task);
  const controls = toolbar() + priorityChips(groups, L.length) + urgencyChips(L, S.urgency);
  if (S.taskPriority !== null) {
    const selected = S.taskPriority === 'all' ? PRIORITY_ORDER : [S.taskPriority];
    return controls + selected.map(key => `<section class="card" data-priority-group="${key}">
      <h2>${TASK_PRIORITIES[key]}</h2><div class="list mt">${listOf(groups[key].sort(byDue), { day: true, showDue: true })}</div></section>`).join('');
  }
  if (S.urgency) {
    const filtered = L.filter(t => urgencyOf(t) === S.urgency).sort(byTaskPriority);
    return controls + `<section class="card"><h2>${levels[S.urgency][0]}</h2><div class="list mt">${listOf(filtered, { day: true, showDue: true })}</div></section>`;
  }
  let body = '';
  if (S.mode === 'week' && !narrow()) {
    const days = weekDays(), td = today();
    const col = (key, title, cls, arr, sub) => `<section class="col ${cls}" data-drop="${key}"><div class="ch"><b>${title}</b><small>${sub ?? arr.length}</small></div>${arr.sort(byTaskPriority).map(t => card(t, { drag: true })).join('') || '<div class="empty">—</div>'}</section>`;
    const cols = [];
    if (S.off === 0) { cols.push(col('inbox', tr("s11"), 'inbox', L.filter(t => t.status === 'inbox'))); cols.push(col('over', tr("s119"), 'over', L.filter(isOver))) }
    for (const d of days) { const a = L.filter(t => t.day === d && t.status !== 'inbox' && !isOver(t)); const open = a.filter(t => t.status !== 'done').length;
      cols.push(col(d, dshort(d) + (d === td ? tr("s120") : ''), (d === td ? 'today' : '') + (open > limit() ? ' full' : ''), a, open + ' / ' + limit())) }
    cols.push(col('nodate', tr("s62"), 'nod', L.filter(t => !t.day && t.status !== 'inbox' && !isOver(t))));
    body = `<div class="row"><button class="btn" data-act="wk" data-d="-1" aria-label="${tr("s121")}">←</button><button class="btn" data-act="wk" data-d="0">${tr("s99")}</button><button class="btn" data-act="wk" data-d="1" aria-label="${tr("s122")}">→</button><span class="sub">${dlong(days[0])} — ${dlong(days[6])}</span></div><div class="board"><div class="cols">${cols.join('')}</div></div>`;
  } else if (S.mode === 'status') {
    body = `<div class="board"><div class="cols">${['inbox', 'todo', 'doing', 'wait', 'done'].map(k => { const a = L.filter(t => t.status === k).sort(byTaskPriority); return `<section class="col ${k === 'inbox' ? 'inbox' : ''}" data-drop="st:${k}"><div class="ch"><b>${ST[k]}</b><small>${a.length}</small></div>${a.slice(0, 80).map(t => card(t, { drag: true, day: true })).join('') || '<div class="empty">—</div>'}${a.length > 80 ? `<div class="empty">${tr("s123", {0: (a.length - 80)})}</div>` : ''}</section>` }).join('')}</div></div>`;
  } else if (S.mode === 'month') {
    const base = parse(today()); base.setDate(1); base.setMonth(base.getMonth() + S.mOff);
    const start = add(iso(base), -((base.getDay() + 6) % 7)), m = base.getMonth();
    const cells = [...Array(42)].map((_, i) => add(start, i));
    body = `<div class="row"><button class="btn" data-act="mo" data-d="-1" aria-label="${tr("s124")}">←</button><b>${MON1[m]} ${base.getFullYear()}</b><button class="btn" data-act="mo" data-d="1" aria-label="${tr("s125")}">→</button></div>
    <div class="month">${[tr("s26"), tr("s27"), tr("s28"), tr("s29"), tr("s30"), tr("s31"), tr("s25")].map(x => `<div class="dn">${x}</div>`).join('')}${cells.map(d => { const a = L.filter(t => t.day === d && t.status !== 'done').sort(byTaskPriority); const ev = [S.settings.dockDate === d ? tr("s5") : '', S.settings.absDate === d ? 'ABS' : ''].filter(Boolean).join(' · ');
      return `<button class="mc${parse(d).getMonth() !== m ? ' out' : ''}${d === today() ? ' now' : ''}" data-act="pickday" data-d="${d}"><b>${parse(d).getDate()}</b>${ev ? `<em>${ev}</em>` : ''}${a.slice(0, 2).map(t => `<span>${esc(t.title)}</span>`).join('')}${a.length > 2 ? `<span>+${a.length - 2}</span>` : ''}</button>` }).join('')}</div>`;
  } else {
    const days = weekDays(), sel = S.sel && days.includes(S.sel) ? S.sel : days[0]; S.sel = sel;
    const a = L.filter(t => t.day === sel && t.status !== 'inbox' && !isOver(t)), inb = L.filter(t => t.status === 'inbox'), ov = L.filter(isOver);
    body = `<div class="strip">${days.map(d => { const n = L.filter(t => t.day === d && t.status !== 'done' && t.status !== 'inbox').length; return `<button data-act="sel" data-d="${d}" aria-pressed="${d === sel}">${DOW[parse(d).getDay()]}<b style="display:block;font-size:17px">${parse(d).getDate()}</b><small>${n}</small></button>` }).join('')}</div>
    <div class="row"><button class="btn" data-act="wk" data-d="-1" aria-label="${tr("s130")}">←</button><button class="btn" data-act="wk" data-d="0">${tr("s99")}</button><button class="btn" data-act="wk" data-d="1" aria-label="${tr("s131")}">→</button></div>
    ${sel === today() && inb.length ? `<a class="banner" href="#alerts">${tr("s126", {0: (inb.length)})}</a>` : ''}
    ${sel === today() && ov.length ? `<a class="banner red" href="#alerts">${tr("s127", {0: (ov.length)})}</a>` : ''}
    ${Object.entries(SLOTS).map(([k, v]) => { const b = a.filter(t => (t.slot || '') === k).sort(byTaskPriority); return b.length ? `<div class="slot"><h3>${v}</h3><div class="list">${b.map(t => card(t, {})).join('')}</div></div>` : '' }).join('') || ("<div class=\"empty\">" + tr("s128") + "</div>")}
    ${(() => { const w = L.filter(t => t.status === 'wait').sort(byTaskPriority); return w.length ? `<section class="card"><h2>${tr("s129")}</h2><div class="list mt">${w.map(t => card(t, { day: true })).join('')}</div></section>` : '' })()}`;
  }
  return controls + body;
}

/* ---------- Уведомления ---------- */
function vAlerts() {
  const td = today(), L = live();
  const inb = L.filter(t => t.status === 'inbox'), ov = L.filter(isOver).sort((a, b) => a.due.localeCompare(b.due));
  const soon = L.filter(t => t.status !== 'done' && !isOver(t) && t.due && diff(t.due, td) >= 0 && diff(t.due, td) <= 2).sort((a, b) => a.due.localeCompare(b.due));
  const listed = new Set([...inb, ...ov, ...soon]);
  const attention = L.filter(t => !listed.has(t) && (t.reply === true && t.status !== 'done' || ['crit', 'high'].includes(urgencyOf(t))));
  const mv = L.filter(t => t.status !== 'done' && (t.moved || 0) >= 3), st = S.sources.filter(s => staleDays(s) > 0);
  const sec = (title, body, n, color) => `<section class="card"><div class="row between"><h2${color ? ` style="color:${color}"` : ''}>${title}</h2><span class="sub">${n}</span></div><div class="list mt">${body}</div></section>`;
  return `<div><h1>${tr("s143")}</h1><div class="sub">${tr("s144")}</div></div>
  ${sec(tr("s132"), inb.map(t => `<div class="row" style="align-items:stretch"><div style="flex:1">${card(t, {})}</div><div class="row"><button class="btn pri" data-act="accept" data-id="${esc(t.id)}">${tr("s133")}</button><button class="btn" data-act="decline" data-id="${esc(t.id)}">${tr("s134")}</button></div></div>`).join('') || ("<div class=\"empty\">" + tr("s135") + "</div>"), inb.length, 'var(--blue)')}
  ${sec(tr("s119"), listOf(ov, {}), ov.length, 'var(--red)')}
  ${sec(tr("s136"), listOf(soon, { day: true }), soon.length)}
  ${attention.length ? sec(tr("s137"), listOf(attention, { showDue: true }), attention.length) : ''}
  ${sec(tr("s138"), st.map(s => `<a class="t" href="#sync"><div class="tb"><span class="tt">${esc(s.name)}</span><span class="small">${tr("s139", {1: (s.last ? dlong(s.last) : '—'), 2: (esc(s.how || ''))})}</span></div></a>`).join('') || ("<div class=\"empty\">" + tr("s140") + "</div>"), st.length, 'var(--acc)')}
  ${(() => { const cl = L.filter(t => t.pmsClosed && t.status !== 'done'); return cl.length ? sec(tr("s141"), listOf(cl, { day: true }), cl.length, 'var(--blue)') : '' })()}
  ${mv.length ? sec(tr("s142"), listOf(mv, { day: true }), mv.length) : ''}`;
}

/* ---------- Бункер и масло ---------- */
const TABLES = localized(() => ({
  bunker: { title: tr("s145"), add: tr("s146"), sort: (a, b) => (b.date || '').localeCompare(a.date || ''), fields: [
    ['date', tr("s147"), 'date'], ['port', tr("s148")], ['grade', tr("s149"), 'select', ['VLSFO', 'ULSFO', 'HSFO', 'MGO', 'LSMGO']], ['qty', tr("s150"), 'number'],
    ['sulphur', 'S, %', 'number'], ['density', tr("s151"), 'number'], ['visc', tr("s152"), 'number'], ['bdn', 'BDN №'], ['supplier', tr("s153")], ['note', tr("s154"), 'textarea']] },
  lube: { title: tr("s155"), add: tr("s156"), sort: (a, b) => (a.cat || '').localeCompare(b.cat || '') || (a.name || '').localeCompare(b.name || ''), fields: [
    ['name', tr("s157")], ['cat', tr("s158"), 'select', [orig("s159"), orig("s160"), orig("s161"), orig("s162")]], ['drum', tr("s163"), 'number'], ['full', tr("s164"), 'number'],
    ['inuse', tr("s165"), 'number'], ['density', tr("s166"), 'number'], ['location', tr("s167")], ['date', tr("s168"), 'date'], ['note', tr("s154"), 'textarea']] },
}));
function cloState() { return S.cloDraft || { s: 0.49, sw: 29, load: 50, total: 5710, bnBlend: 50, bnAdd: 110, bnSys: 15, pkg: 'Chevron-MCLA-BN400', batch: 100, bn: 120, ...(db.get('meta/clo') || {}) } }
function vLube() {
  const tabs = [['clo', tr("s169")], ['bob', 'BoB'], ['thin', 'Thin Lube'], ['order', tr("s170")], ['lube', tr("s171")], ['bunker', tr("s145")]];
  let body = '';
  if (S.lubeTab === 'clo') body = cloView(); else if (S.lubeTab === 'bob') body = bobView(); else if (S.lubeTab === 'thin') body = thinView(); else if (S.lubeTab === 'order') body = orderView(); else if (S.lubeTab === 'lube') body = packedView(); else body = tableView(S.lubeTab);
  return `<div><h1>${tr("s172")}</h1><div class="sub">${tr("s173")}</div></div>
  <div class="tabs" role="tablist">${tabs.map(([k, v]) => `<button role="tab" data-act="ltab" data-t="${k}" aria-selected="${S.lubeTab === k}">${v}</button>`).join('')}</div>${body}`;
}
const inp = (name, label, val, attrs = '') => `<label class="f">${label}<input type="number" inputmode="decimal" step="any" name="${name}" value="${esc(val)}" data-clo ${attrs}></label>`;
const out = (label, val, unit, accent) => `<div class="stat"><span class="lbl">${label}</span><b${accent ? ' style="color:var(--acc)"' : ''}>${val}</b><span class="lbl">${unit}</span></div>`;
function cloView() {
  const v = db.get('cal/clo-vessel'), p = cloState();
  if (!v) return `<div class="banner">${tr("s174")}</div>`;
  const r = CLO.calc({ s: +p.s, sw: +p.sw, load: +p.load }, v);
  return `<section class="card"><h2>${tr("s187")}</h2><div class="kv mt">
   <span>${tr("s188")}</span><b>${v.name}</b><span>${tr("s189")}</span><b>${v.engine}</b><span>SMCR</span><b>${num(v.smcr, 0)} kW</b>
   <span>${tr("s190")}</span><b>${v.lubSystem}</b><span>MOP / LDCL</span><b>${v.mop ? tr("s175") : tr("s21")} / ${v.ldcl ? tr("s175") : tr("s21")}</b><span>BoB</span><b>${tr("s191", {6: (v.bobModel)})}</b></div></section>
  <section class="card"><h2>${tr("s192")}</h2><form class="fg3 mt" data-form="clo">${inp('s', tr("s176"), p.s)}${inp('sw', tr("s177"), p.sw)}${inp('load', tr("s178"), p.load)}</form></section>
  <div class="grid4">${out(tr("s179"), r.bn, 'mg KOH/g', 1)}${out(tr("s180"), num(r.frf), 'g/kWh/S%', 1)}${out(tr("s181"), num(r.minFr), 'g/kWh', 1)}${out(tr("s182"), num(r.fr, 3), 'g/kWh')}</div>
  <div class="grid2">${out(tr("s183"), num(r.cons, 1), tr("s184"))}${out(tr("s185"), num(r.cons * 30 / 1000, 2), tr("s186"))}</div>
  <section class="card"><h2>${tr("s193")}</h2>${bnChart(+p.s, r.bn)}</section>
  <section class="card"><h2>${tr("s194")}</h2>${frChart(r.curve, +p.load, r.fr)}<div class="note mt">${tr("s195", {18: (r.curve.map(([l, f]) => `${l}% → ${num(f)}`).join(' · '))})}</div></section>`;
}
function bobView() {
  const p = cloState(), r = CLO.bobConventional({ total: +p.total, bnBlend: +p.bnBlend, bnAdd: +p.bnAdd, bnSys: +p.bnSys });
  return `<section class="card"><h2>${tr("s203")}</h2><div class="note">${tr("s204")}</div>
  <form class="fg mt" data-form="clo">${inp('total', tr("s196"), p.total)}${inp('bnBlend', tr("s197"), p.bnBlend)}${inp('bnAdd', tr("s198"), p.bnAdd)}${inp('bnSys', tr("s199"), p.bnSys)}</form></section>
  <div class="grid2">${out(tr("s200"), num(r.additive, 0), tr("s201"), 1)}${out(tr("s202"), num(r.system, 0), tr("s201"), 1)}</div>
  <div class="note">${tr("s205")}</div>`;
}
function thinView() {
  const p = cloState(), r = CLO.thinLube({ pkg: p.pkg, batch: Math.min(+p.batch, 150), bn: +p.bn });
  const bns = Object.keys(CLO.THIN[p.pkg] || {});
  return `<section class="card"><h2>BoB, Thin Lube</h2><div class="note">${tr("s211")}</div>
  <form class="fg3 mt" data-form="clo"><label class="f">${tr("s212")}<select name="pkg" data-clo>${Object.keys(CLO.THIN).map(k => `<option${k === p.pkg ? ' selected' : ''}>${k}</option>`).join('')}</select></label>
  ${inp('batch', tr("s206"), p.batch, 'max="150"')}<label class="f">${tr("s213")}<select name="bn" data-clo>${[50, 70, 100, 120, 140].map(b => `<option${b == p.bn ? ' selected' : ''}${bns.includes(String(b)) ? '' : ' disabled'}>${b}</option>`).join('')}</select></label></form></section>
  ${r ? `<div class="grid4" style="grid-template-columns:repeat(3,minmax(0,1fr))">${out(tr("s202"), num(r.system, 1), tr("s207") + Math.round(r.ratio[0] * 100) + '%', 1)}${out('Thin base oil', num(r.thin, 1), tr("s207") + Math.round(r.ratio[1] * 100) + '%', 1)}${out(tr("s208"), num(r.additive, 1), tr("s207") + Math.round(r.ratio[2] * 100) + '%', 1)}</div>` : ("<div class=\"banner\">" + tr("s209") + "</div>")}
  ${+p.batch > 150 ? ("<div class=\"banner red\">" + tr("s210") + "</div>") : ''}
  <div class="note">${tr("s214")}</div>`;
}
// Small SVG charts (no library, work offline)
function bnChart(s, bn) {
  const W = 560, H = 190, P = 34, x = v => P + v / 3.5 * (W - P - 10), y = v => H - 24 - (v - 40) / 110 * (H - 44);
  const path = CLO.BN_CURVE.map(([a, b], i) => (i ? 'L' : 'M') + x(a).toFixed(1) + ' ' + y(b).toFixed(1)).join(' ');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${tr("s215", {2: (bn), 3: (s)})}">
  ${[50, 70, 100, 120, 140].map(b => `<line x1="${P}" x2="${W - 10}" y1="${y(b)}" y2="${y(b)}" class="gl"/><text x="${P - 6}" y="${y(b) + 4}" text-anchor="end">${b}</text>`).join('')}
  ${[0, 0.5, 1.5, 2.25, 3, 3.5].map(a => `<text x="${x(a)}" y="${H - 6}" text-anchor="middle">${a}</text>`).join('')}
  <path d="${path}" class="ln"/><circle cx="${x(Math.min(s, 3.5))}" cy="${y(bn)}" r="6" class="pt"/></svg>`;
}
function frChart(curve, load, fr) {
  const W = 560, H = 190, P = 40, x = v => P + v / 100 * (W - P - 10), mx = Math.max(...curve.map(c => c[1])) * 1.15, y = v => H - 24 - v / mx * (H - 44);
  const pts = [...curve].sort((a, b) => a[0] - b[0]);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${tr("s216", {2: (fr.toFixed(2)), 3: (load)})}">
  ${[0, 0.5, 1, 1.5].filter(v => v < mx).map(v => `<line x1="${P}" x2="${W - 10}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${P - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
  ${[10, 25, 50, 75, 100].map(a => `<text x="${x(a)}" y="${H - 6}" text-anchor="middle">${a}%</text>`).join('')}
  <path d="${pts.map(([a, b], i) => (i ? 'L' : 'M') + x(a).toFixed(1) + ' ' + y(b).toFixed(1)).join(' ')}" class="ln"/>
  <circle cx="${x(Math.min(Math.max(load, 0), 100))}" cy="${y(fr)}" r="6" class="pt"/></svg>`;
}
function tableView(col) {
  const T = TABLES[col], rows = db.all(col).sort(T.sort), cols = T.fields.filter(f => f[2] !== 'textarea');
  const low = col === 'lube' ? rows.filter(r => r.min && +r.rob < +r.min).length : 0;
  const tot = col === 'bunker' ? rows.reduce((a, r) => a + (+r.qty || 0), 0) : 0;
  return `<section class="card"><div class="row between"><div><h2>${T.title}</h2><div class="note">${rows.length ? (col === 'bunker' ? `${tr("s220", {0: (rows.length), 1: (plural(rows.length, tr("s217"), tr("s218"), tr("s219"))), 2: (num(tot, 1))})}` : `${rows.length} ${plural(rows.length, tr("s221"), tr("s222"), tr("s223"))}${low ? ` · <span class="bad">${tr("s224", {0: (low)})}</span>` : ''}`) : tr("s225")}</div></div>
  <button class="btn pri" data-act="rowadd" data-col="${col}">${T.add}</button></div>
  ${rows.length ? `<div class="scroll mt"><table class="stack"><thead><tr>${cols.map(f => `<th>${f[1]}</th>`).join('')}</tr></thead><tbody>
  ${rows.map(r => `<tr data-act="rowedit" data-col="${col}" data-rid="${esc(r.id)}" class="click${col === 'lube' && r.min && +r.rob < +r.min ? ' lowrow' : ''}">${cols.map(f => `<td data-l="${f[1]}">${f[2] === 'date' && r[f[0]] ? dlong(r[f[0]]) : esc(r[f[0]] ?? '')}</td>`).join('')}</tr>`).join('')}
  </tbody></table></div>` : ''}</section>`;
}
function packedView() {
  const rows = db.all('lube'), cats = [orig("s159"), orig("s160"), orig("s161"), orig("s162")];
  const cur = r => (+r.drum || 0) * (+r.full || 0) + (+r.inuse || 0), kg = r => r.cat === orig("s161") ? cur(r) : r.density ? cur(r) * r.density : null;
  const last = rows.map(r => r.date).filter(Boolean).sort().pop();
  return `<section class="card"><div class="row between"><div><h2>${tr("s155")}</h2><div class="note">${rows.length ? `${tr("s227", {0: (rows.length), 1: (last ? tr("s226") + dlong(last) : '')})}` : tr("s228")}</div></div><button class="btn pri" data-act="rowadd" data-col="lube">${tr("s156")}</button></div></section>
  ${cats.map(c => { const g = rows.filter(r => (r.cat || orig("s162")) === c).sort((a, b) => (a.name || '').localeCompare(b.name || '')); if (!g.length) return '';
    const tl = g.reduce((a, r) => a + cur(r), 0), tk = g.reduce((a, r) => a + (kg(r) || 0), 0), u = c === orig("s161") ? tr("s201") : tr("s229");
    return `<section class="card"><div class="row between"><h2>${esc(categoryText(c))}</h2><span class="sub">${num(tl, 0)} ${u}${c !== orig("s161") ? ' · ' + num(tk, 0) + tr("s230") : ''}</span></div><div class="scroll mt"><table class="stack"><thead><tr><th>${tr("s231")}</th><th>${tr("s232")}</th><th>${tr("s233")}</th><th>${tr("s234")}</th><th>${tr("s237", {4: (u)})}</th>${c !== orig("s161") ? ("<th>" + tr("s201") + "</th>") : ''}<th>${tr("s236")}</th></tr></thead><tbody>
    ${g.map(r => `<tr class="click${cur(r) === 0 ? ' lowrow' : ''}" data-act="rowedit" data-col="lube" data-rid="${esc(r.id)}"><td data-l="${tr("s231")}">${esc(r.name)}</td><td data-l="${tr("s232")}">${esc(r.drum ?? '')}</td><td data-l="${tr("s233")}">${esc(r.full ?? '')}</td><td data-l="${tr("s234")}">${esc(r.inuse ?? '')}</td><td data-l="${tr("s235")}"><b>${num(cur(r), 0)}</b></td>${c !== orig("s161") ? `<td data-l="${tr("s201")}">${kg(r) != null ? num(kg(r), 0) : ''}</td>` : ''}<td data-l="${tr("s236")}">${esc(r.location || '')}</td></tr>`).join('')}
    </tbody></table></div></section>` }).join('')}`;
}
function openRow(col, rid) {
  const T = TABLES[col], r = rid ? { ...(db.get(col + '/' + rid) || {}) } : {};
  S.edit = { row: true, col, rid: rid || uid(col[0]) };
  $('#modal').innerHTML = `<form class="sheet" id="rowf"><div class="row between"><h2 id="mt">${rid ? T.title + tr("s238") : T.add}</h2>${closeBtn()}</div>
  <div class="fg">${T.fields.map(([k, l, t, o]) => t === 'select' ? `<label class="f">${l}<select name="${k}"><option value=""></option>${o.map(x => `<option value="${esc(x)}"${x === r[k] ? ' selected' : ''}>${esc(categoryText(x))}</option>`).join('')}</select></label>`
    : t === 'textarea' ? `<label class="f" style="grid-column:1/-1">${l}<textarea name="${k}">${esc(r[k] || '')}</textarea></label>`
    : `<label class="f">${l}<input name="${k}" type="${t === 'number' ? 'number' : t || 'text'}" ${t === 'number' ? 'step="any" inputmode="decimal"' : ''} value="${esc(r[k] ?? (t === 'date' && !rid ? today() : ''))}"></label>`).join('')}</div>
  <div class="row between"><div>${rid ? ("<button type=\"button\" class=\"btn danger\" data-act=\"rowdel\">" + tr("s239") + "</button>") : ''}</div><div class="row"><button type="button" class="btn" data-act="close">${tr("s240")}</button><button class="btn pri">${tr("s241")}</button></div></div></form>`;
  $('#modal').hidden = false;
}

/* ---------- Синхронизация ---------- */
function vSync() {
  const src = [...S.sources].sort((a, b) => staleDays(b) - staleDays(a)), rc = db.remoteConfig(), st = db.status;
  const stTxt = { local: tr("s242"), idle: tr("s243") + (st.at ? ' · ' + new Date(st.at).toTimeString().slice(0, 5) : ''), syncing: tr("s244"), offline: tr("s245"), error: tr("s246") + localizeError(st.error) }[st.state];
  return `<div><h1>${tr("s265")}</h1><div class="sub">${tr("s266")}</div></div>
  <section class="card"><h2>${tr("s267")}</h2><div class="theme-options theme-grid" role="group" aria-label="${tr("s268")}">
    ${Object.entries(appearance.themes).map(([key, option]) => `<button type="button" id="theme-${key}" class="theme-card" data-preview-theme="${key}" data-act="theme" data-k="${key}" data-icon="map" aria-pressed="${key === theme()}"><span class="theme-demo" aria-hidden="true"><i></i><i></i><i></i></span><span>${option.label}</span></button>`).join('')}
  </div><div class="row mt"><b>${tr("s269")}</b><div class="seg metal-options" role="group" aria-label="${tr("s269")}">
    ${Object.entries(appearance.metals).map(([key, label]) => `<button type="button" id="metal-${key}" data-act="metal" data-k="${key}" data-icon="box" aria-pressed="${key === document.documentElement.dataset.metal}">${label}</button>`).join('')}
  </div></div></section>
  <section class="card">${languagePicker()}</section>
  ${isBiolab() ? `<section class="card"><h2>${tr("s247")}</h2><div class="seg metal-options" role="group" aria-label="${tr("s247")}">
    ${Object.entries(appearance.effects).map(([key, label]) => `<button type="button" id="effects-${key}" data-act="effects" data-k="${key}" data-icon="settings" aria-pressed="${key === document.documentElement.dataset.effects}">${label}</button>`).join('')}
  </div></section>` : ''}
  ${urgencySettings(appearance)}
  <section class="card"><div class="row between"><div><h2>${tr("s270")}</h2><div class="note mt">${esc(stTxt)}${st.pending ? `${tr("s248", {0: (st.pending)})}` : ''}</div></div>
  <button class="btn pri" data-act="syncall">${tr("s270")}</button></div></section>
  <section class="card"><h2>${tr("s271")}</h2><div class="note mt">${rc ? tr("s249") + esc(rc.url.replace(/^https?:\/\//, '')) : tr("s250")}</div>
  <form id="remf" class="fg mt"><label class="f">${tr("s272")}<input name="url" value="${esc(rc?.url || '')}" placeholder="https://xxxx.supabase.co" autocomplete="off"></label>
  <label class="f">${tr("s273")}<input name="key" value="${esc(rc?.key || '')}" autocomplete="off"></label>
  <label class="f">${tr("s274")}<input name="space" value="${esc(rc?.space || '')}" autocomplete="off" minlength="24" placeholder="${tr("s275")}"></label>
  <div class="f" style="justify-content:flex-end"><div class="row">${rc ? '' : ("<button type=\"button\" class=\"btn\" data-act=\"gencode\">" + tr("s251") + "</button>")}<button class="btn pri">${rc ? tr("s241") : tr("s252")}</button>${rc ? ("<button type=\"button\" class=\"btn danger\" data-act=\"unlink\">" + tr("s253") + "</button>") : ''}</div></div></form></section>
  <section class="card"><h2>${tr("s276")}</h2><div class="note mt">${tr("s277")}</div>
  <div class="row mt"><button class="btn" data-act="export">${tr("s278")}</button><label class="btn" style="display:inline-flex;align-items:center">${tr("s279")}<input type="file" accept=".json,application/json" id="impf" hidden></label></div></section>
  <section class="card"><h2>${tr("s280")}</h2><div class="scroll mt"><table class="stack"><thead><tr><th>${tr("s257")}</th><th>${tr("s258")}</th><th>${tr("s259")}</th><th>${tr("s260")}</th><th>${tr("s261")}</th><th>${tr("s167")}</th><th>${tr("s262")}</th></tr></thead><tbody>
  ${src.map(s => { const k = staleDays(s); return `<tr><td data-l="${tr("s257")}">${esc(s.name)}</td><td data-l="${tr("s258")}">${esc(s.section || '')}</td><td data-l="${tr("s259")}">${s.last ? dlong(s.last) : '—'}</td><td data-l="${tr("s260")}">${s.norm ? s.norm + tr("s254") : '—'}</td><td data-l="${tr("s261")}" class="${k > 0 ? 'bad' : 'ok'}">${k > 0 ? tr("s255") + k + tr("s254") : tr("s256")}</td><td data-l="${tr("s167")}"><code>${esc(s.path || '')}</code></td><td data-l="${tr("s262")}">${esc(s.how || '')}</td></tr>` }).join('') || ("<tr><td colspan=\"7\" class=\"empty\">" + tr("s263") + "</td></tr>")}
  </tbody></table></div></section>
  <section class="card"><h2>${tr("s281")}</h2><form id="setf" class="fg mt">
   <label class="f">${tr("s282")}<input type="date" name="dockDate" value="${esc(S.settings.dockDate || '')}"></label>
   <label class="f">${tr("s283")}<input name="dockName" value="${esc(S.settings.dockName || '')}"></label>
   <label class="f">${tr("s284")}<input type="date" name="absDate" value="${esc(S.settings.absDate || '')}"></label>
   <label class="f">${tr("s285")}<input name="absName" value="${esc(S.settings.absName || '')}"></label>
   <label class="f">${tr("s286")}<input type="number" min="1" max="30" name="dayLimit" value="${esc(S.settings.dayLimit || 8)}"></label>
   <div class="f" style="justify-content:flex-end"><button class="btn pri">${tr("s287")}</button></div></form></section>
  <div class="row"><span class="note">MCV Workbench ${VERSION}</span><button class="btn" data-act="update">${tr("s288")}</button>${S.install ? ("<button class=\"btn\" data-act=\"install\">" + tr("s264") + "</button>") : ''}</div>`;
}


/* ---------- Танки и замеры ---------- */
const GROUPS = localized(() => ({ water: tr("s289"), oil: tr("s290"), fuel: tr("s291"), drain: tr("s292") }));
const shortLbl = l => String(l || '').replace(/\s*\(cm\)\s*/i, '').trim();
function dailyCal() { return (db.get('cal/daily') || {}).rows || [] }
function foMeta() { return (db.get('cal/fo-meta') || {}).tanks || [] }
function foCal() { const o = {}; for (const t of foMeta()) if (t.sheet && !o[t.sheet]) { const d = db.get('cal/fo-' + t.sheet); if (d) o[t.sheet] = d.rows } return o }
const noCal = () => `<div class="banner">${tr("s293")}</div>`;
function soundingsBefore(date) { return db.all('soundings').filter(s => s.id < date).sort((a, b) => b.id.localeCompare(a.id))[0] || null }
function vTanks() {
  const tabs = [['daily', tr("s294")], ['month', tr("s112")], ['rob', tr("s295")]];
  const body = S.tankTab === 'month' ? tMonth() : S.tankTab === 'rob' ? tRob() : tDaily();
  return `<div><h1>${tr("s296")}</h1><div class="sub">${tr("s297")}</div></div>
  <div class="tabs" role="tablist">${tabs.map(([k, v]) => `<button role="tab" data-act="ttab" data-t="${k}" aria-selected="${S.tankTab === k}">${v}</button>`).join('')}</div>${body}`;
}
function soundingsDirty(draft, saved) {
  return JSON.stringify(Object.entries(draft).filter(([k]) => k !== '_date').sort()) !== JSON.stringify(Object.entries(saved ? saved.values : {}).sort());
}
function tDaily() {
  const rows = dailyCal(); if (!rows.length) return noCal();
  const date = S.sDate || today(), saved = db.get('soundings/' + date), prev = soundingsBefore(date);
  if (!S.sDraft || S.sDraft._date !== date) S.sDraft = { _date: date, ...(saved ? saved.values : {}) };
  const D = S.sDraft, dirty = soundingsDirty(D, saved);
  const filled = rows.filter(r => D[r.key] !== undefined && D[r.key] !== '').length;
  return `<section class="card"><div class="row between"><div class="row"><button class="btn" data-act="sday" data-d="-1" aria-label="${tr("s307")}">←</button>
   <input type="date" class="search" style="width:auto" id="sdate" value="${date}"><button class="btn" data-act="sday" data-d="1" aria-label="${tr("s308")}">→</button></div>
   <div class="note">${tr("s309", {1: (saved ? tr("s298") + (saved.by ? ' · ' + esc(saved.by) : '') : tr("s299")), 2: (filled), 3: (rows.length), 4: (prev ? tr("s300") + dlong(prev.id) : '')})}</div></div></section>
  ${Object.entries(GROUPS).map(([g, gl]) => `<section class="card"><h2>${gl}</h2><div class="srows mt">${rows.filter(r => r.group === g).map(r => {
    const v = D[r.key], pv = prev && prev.values[r.key], vol = r.cal ? T.dailyVolume(r.cal, v) : null, pvol = r.cal && pv != null ? T.dailyVolume(r.cal, pv) : null;
    const dv = v !== undefined && v !== '' && pv != null ? (r.cal && vol != null && pvol != null ? vol - pvol : v - pv) : null;
    return `<label class="srow"><span class="sl">${esc(shortLbl(r.label))}${pv != null ? `<small>${tr("s301", {0: (num(pv, pv % 1 ? 2 : 0))})}</small>` : ''}</span>
     <input inputmode="decimal" type="number" step="any" data-snd="${esc(r.key)}" value="${esc(v ?? '')}" placeholder="${r.cal ? tr("s302") : '—'}">
     <span class="sv">${r.cal ? (vol != null ? num(vol, 1) + tr("s303") : '') : ("<small>" + tr("s304") + "</small>")}${dv ? `<small class="${Math.abs(dv) > 0 ? (dv > 0 ? 'up' : 'dn') : ''}">${dv > 0 ? '+' : ''}${num(dv, r.cal ? 1 : 2)}</small>` : ''}</span></label>` }).join('')}</div></section>`).join('')}
  <div class="savebar"><span class="note">${dirty ? tr("s305") : tr("s306")}</span><button class="btn pri" data-act="ssave"${dirty ? '' : ' disabled'}>${tr("s310")}</button></div>`;
}
function tMonth() {
  const rows = dailyCal(); if (!rows.length) return noCal();
  const base = parse(today()); base.setDate(1); base.setMonth(base.getMonth() + S.tmOff);
  const y = base.getFullYear(), m = base.getMonth(), n = new Date(y, m + 1, 0).getDate();
  const days = [...Array(n)].map((_, i) => iso(new Date(y, m, i + 1))), data = Object.fromEntries(db.all('soundings').filter(s => s.id.startsWith(days[0].slice(0, 7))).map(s => [s.id, s.values]));
  const vol = S.tmUnit === 'm3', cnt = Object.keys(data).length;
  return `<div class="row between"><div class="row"><button class="btn" data-act="tmo" data-d="-1" aria-label="${tr("s124")}">←</button><b>${MON1[m]} ${y}</b><button class="btn" data-act="tmo" data-d="1" aria-label="${tr("s125")}">→</button><span class="sub">${tr("s311", {2: (cnt), 3: (plural(cnt, tr("s79"), tr("s80"), tr("s81")))})}</span></div>
   <div class="row"><div class="seg" role="group" aria-label="${tr("s312")}"><button data-act="tmu" data-u="cm" aria-pressed="${!vol}">${tr("s302")}</button><button data-act="tmu" data-u="m3" aria-pressed="${vol}">${tr("s313")}</button></div><button class="btn" data-act="tmcsv">CSV</button></div></div>
  <div class="scroll card" style="padding:0"><table class="mtab"><thead><tr><th class="stick">${tr("s314")}</th>${days.map(d => `<th data-act="tday" data-d="${d}" class="click${d === today() ? ' now' : ''}">${parse(d).getDate()}</th>`).join('')}</tr></thead><tbody>
  ${rows.map(r => `<tr><th class="stick">${esc(shortLbl(r.label))}</th>${days.map(d => { const v = data[d] && data[d][r.key]; const x = v == null || v === '' ? '' : vol && r.cal ? T.dailyVolume(r.cal, v) : v; return `<td>${x === '' || x == null ? '' : num(x, vol && r.cal ? 1 : (x % 1 ? 2 : 0))}</td>` }).join('')}</tr>`).join('')}
  </tbody></table></div><div class="note">${tr("s315")}</div>`;
}
function robInputs() { return S.robDraft || (S.robDraft = (() => { const last = db.all('rob').sort((a, b) => b.id.localeCompare(a.id))[0]; const t = {};
  if (last) for (const [k, v] of Object.entries(last.tanks || {})) t[k] = { density: v.density ?? '', temp: v.temp ?? '' };
  return { date: today(), place: '', event: 'Quantity check', fwd: last ? last.fwd : '', aft: last ? last.aft : '', logHfo: '', logDo: '', tanks: t } })()) }
function tRob() {
  const meta = foMeta(); if (!meta.length) return noCal();
  const I = robInputs(), ok = I.fwd !== '' && I.aft !== '', res = ok ? T.computeROB(meta, foCal(), I) : null, byKey = res ? Object.fromEntries(res.rows.map(r => [r.key, r])) : {};
  const grp = [['HFO', tr("s316"), m => m.group === 'HFO' && m.k !== 0.0008], ['DO', tr("s317"), m => m.k === 0.0008], ['LO', tr("s318"), m => m.group === 'LO']];
  const hist = db.all('rob').sort((a, b) => b.id.localeCompare(a.id));
  const fx = (k, f, v, ph, w = '') => `<input inputmode="decimal" type="number" step="any" data-rob="${esc(k)}" data-f="${f}" value="${esc(v ?? '')}" placeholder="${esc(ph ?? '')}" ${w}>`;
  return `<section class="card"><h2>${tr("s333")}</h2><div class="note">${tr("s334")}</div>
  <form class="fg3 mt" id="robh"><label class="f">${tr("s147")}<input type="date" name="date" value="${esc(I.date)}"></label><label class="f">${tr("s335")}<input name="place" value="${esc(I.place)}"></label>
  <label class="f">${tr("s336")}<select name="event">${['Quantity check', 'Before bunkering', 'After bunkering', 'Monthly ROB', 'Arrival', 'Departure'].map(e => `<option${e === I.event ? ' selected' : ''}>${e}</option>`).join('')}</select></label>
  <label class="f">${tr("s337")}<input inputmode="decimal" type="number" step="any" name="fwd" value="${esc(I.fwd)}"></label><label class="f">${tr("s338")}<input inputmode="decimal" type="number" step="any" name="aft" value="${esc(I.aft)}"></label>
  <div class="f">${tr("s339")}<b style="font-size:20px;color:var(--ink)">${ok ? num(res.trim, 2) + tr("s319") : '—'}</b></div>
  <label class="f">${tr("s340")}<input inputmode="decimal" type="number" step="any" name="logHfo" value="${esc(I.logHfo)}"></label><label class="f">${tr("s341")}<input inputmode="decimal" type="number" step="any" name="logDo" value="${esc(I.logDo)}"></label></form></section>
  ${!ok ? ("<div class=\"banner\">" + tr("s320") + "</div>") : ''}
  ${grp.map(([g, gl, f]) => `<section class="card"><h2>${gl}</h2><div class="scroll mt"><table class="rob"><thead><tr><th>${tr("s314")}</th><th>${tr("s322")}</th>${g !== 'LO' ? '<th>ρ15</th><th>t, °C</th>' : '<th>ρ</th>'}<th>${tr("s313")}</th><th>%</th><th>${tr("s186")}</th></tr></thead><tbody>
   ${meta.filter(f).map(m => { const d = I.tanks[m.key] || {}, r = byKey[m.key] || {}; return `<tr><th>${esc(m.key)}<small>${m.capacity ? num(m.capacity, 1) + tr("s303") : ''}</small></th>
     <td>${fx(m.key, 'value', d.value, m.kind === 'volume' ? tr("s313") : tr("s302"))}</td><td>${fx(m.key, 'density', d.density, m.density)}</td>${g !== 'LO' ? `<td>${fx(m.key, 'temp', d.temp, m.temp)}</td>` : ''}
     <td>${r.error ? ("<span class=\"bad\">" + tr("s321") + "</span>") : r.m3 != null ? num(r.m3, 2) : ''}</td><td class="${r.pct > m.maxpct ? 'bad' : ''}">${r.pct != null ? num(r.pct, 1) : ''}</td><td>${r.t != null ? num(r.t, 2) : ''}</td></tr>` }).join('')}</tbody></table></div></section>`).join('')}
  ${res ? `<div class="grid4" style="grid-template-columns:repeat(3,minmax(0,1fr))">${[['HFO', tr("s323"), I.logHfo], ['DO', tr("s324"), I.logDo], ['LO', tr("s325"), '']].map(([k, l, lg]) => `<div class="stat"><span class="lbl">${l}</span><b style="color:var(--acc)">${tr("s327", {1: (num(res.sum[k].t, 2))})}</b><span class="lbl">${tr("s328", {2: (num(res.sum[k].m3, 1)), 3: (lg !== '' && lg != null ? `${tr("s326", {0: (num(+lg, 1)), 1: (num(res.sum[k].t - lg, 2))})}` : '')})}</span></div>`).join('')}</div>
  <div class="savebar"><span class="note">${tr("s329")}</span><button class="btn pri" data-act="robsave">${tr("s330")}</button></div>` : ''}
  <section class="card"><h2>${tr("s342")}</h2><div class="list mt">${hist.map(h => `<div class="t" data-act="robopen" data-rid="${esc(h.id)}"><div class="tb"><span class="tt">${dlong(h.date)} · ${esc(h.event || '')}${h.place ? ' · ' + esc(h.place) : ''}</span><span class="small">${tr("s331", {4: (num(h.sum?.HFO?.t, 1)), 5: (num(h.sum?.DO?.t, 1)), 6: (num(h.sum?.LO?.t, 1)), 7: (esc(h.fwd)), 8: (esc(h.aft))})}</span></div></div>`).join('') || ("<div class=\"empty\">" + tr("s332") + "</div>")}</div></section>`;
}
function monthCSV() {
  const rows = dailyCal(), base = parse(today()); base.setDate(1); base.setMonth(base.getMonth() + S.tmOff);
  const y = base.getFullYear(), m = base.getMonth(), n = new Date(y, m + 1, 0).getDate(), days = [...Array(n)].map((_, i) => iso(new Date(y, m, i + 1)));
  const data = Object.fromEntries(db.all('soundings').map(s => [s.id, s.values])), vol = S.tmUnit === 'm3';
  const lines = [['Tank', ...days].join(';'), ...rows.map(r => [r.label, ...days.map(d => {
    const v = data[d] && data[d][r.key];
    if (v == null || v === '') return '';
    const x = vol && r.cal ? T.dailyVolume(r.cal, v) : v;
    const rounded = String(Math.round(x * 1000) / 1000);
    return language() === 'ru' ? rounded.replace('.', ',') : rounded;
  })].join(';'))];
  download(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' }), `soundings-${y}-${String(m + 1).padStart(2, '0')}-${vol ? 'm3' : 'cm'}.csv`);
}
function download(blob, name) { const u = URL.createObjectURL(blob), l = document.createElement('a'); l.href = u; l.download = name; l.click(); setTimeout(() => URL.revokeObjectURL(u), 2000) }

/* ---------- Заказ масла (MLFMT) ---------- */
const LUBE_DEF = { delivery_date: '', forward_date: '', additive: { product: 'GulfSea Cylcare 50140', stock_kg: '', tank_kg: 54000, unusable_kg: 500, target_bn: 50, blended_stock_kg: 0, blend_consumption_kg_month: 5000 },
  meso: { stock_kg: '', sump_kg: 48480, safety_stock_kg: 36000, tank_kg: 56500, consumption_kg_month: 200, bn: 6 }, tpeo: { stock_kg: '', sump_kg: 2500, tank_kg: 10000, consumption_kg_month: 800, changeouts: 0 }, mdcl2: { bn: 70, stock_kg: 0, consumption_kg_month: 0 } };
function lubeOrderState() { if (!S.loDraft) { const s = db.get('meta/lubeorder'); S.loDraft = JSON.parse(JSON.stringify(s || LUBE_DEF)) } return S.loDraft }
function orderView() {
  const p = lubeOrderState(), f = (path, label, type = 'number') => { const [a, b] = path.split('.'); const v = b ? p[a][b] : p[a]; return `<label class="f">${label}<input ${type === 'number' ? 'inputmode="decimal" type="number" step="any"' : 'type="' + type + '"'} data-lo="${path}" value="${esc(v ?? '')}"></label>` };
  let r = null, err = '';
  try { if (p.delivery_date && p.forward_date && p.additive.stock_kg !== '' && p.meso.stock_kg !== '' && p.tpeo.stock_kg !== '') r = T.lubeBOB(num0(p)) } catch (e) { err = e.message }
  return `<section class="card"><h2>${tr("s359")}</h2><div class="note">${tr("s360")}</div>
   <div class="fg mt">${f('delivery_date', tr("s343"), 'date')}${f('forward_date', tr("s344"), 'date')}</div></section>
  <section class="card"><h2>${tr("s361")}</h2><div class="fg3 mt"><label class="f">${tr("s362")}<select data-lo="additive.product">${Object.keys(T.ADDITIVES).map(k => `<option${k === p.additive.product ? ' selected' : ''}>${k}</option>`).join('')}</select></label>
   ${f('additive.stock_kg', tr("s345"))}${f('additive.tank_kg', tr("s346"))}${f('additive.unusable_kg', tr("s347"))}${f('additive.target_bn', tr("s348"))}${f('additive.blended_stock_kg', tr("s349"))}${f('additive.blend_consumption_kg_month', tr("s350"))}</div></section>
  <section class="card"><h2>${tr("s363")}</h2><div class="fg3 mt">${f('meso.stock_kg', tr("s345"))}${f('meso.sump_kg', tr("s351"))}${f('meso.safety_stock_kg', tr("s352"))}${f('meso.tank_kg', tr("s346"))}${f('meso.consumption_kg_month', tr("s353"))}${f('meso.bn', 'BN')}</div></section>
  <section class="card"><h2>${tr("s364")}</h2><div class="fg3 mt">${f('tpeo.stock_kg', tr("s345"))}${f('tpeo.sump_kg', tr("s351"))}${f('tpeo.tank_kg', tr("s346"))}${f('tpeo.consumption_kg_month', tr("s353"))}${f('tpeo.changeouts', tr("s354"))}</div></section>
  ${r ? `<div class="grid4">${out(tr("s200"), num(r.add.order, 0), r.add.unit, 1)}${out('MESO', num(r.meso.order, 0), tr("s229"), 1)}${out('TPEO', num(r.tpeo.order, 0), tr("s229"), 1)}${out(tr("s355"), r.days, tr("s356"))}</div>
   ${r.warnings.map(w => `<div class="banner red">${esc(w)}</div>`).join('')}
   <div class="note">${tr("s357", {5: (num(r.ratioAdd * 100, 1)), 6: (num(r.ratioMeso * 100, 1)), 7: (num(r.add.safety, 0)), 8: (num(r.meso.safety, 0)), 9: (num(r.tpeo.safety, 0))})}</div>` : `<div class="banner">${err ? esc(err) : tr("s358")}</div>`}`;
}
function num0(p) { const c = JSON.parse(JSON.stringify(p)); for (const g of ['additive', 'meso', 'tpeo', 'mdcl2']) for (const k in c[g]) if (k !== 'product' && c[g][k] !== '') c[g][k] = +c[g][k]; return c }


/* ---------- Logbook: scrape-down, ORB Part I, Biofouling ---------- */
const ORB_CODES = localized(() => ({ 'C.11': tr("s365"), 'C.12': tr("s366"), D: tr("s367"), H: tr("s368"), I: tr("s369"), F: tr("s370") }));
const CYL_COL = ['#5BB8F5', '#3FB68B', '#F2A93B', '#F0616D', '#B49CF5', '#4FD1C5'];
function vLog() {
  const tabs = [['scrape', tr("s371")], ['orb', 'ORB Part I'], ['bio', 'Biofouling']];
  const body = S.logTab === 'orb' ? logBook('orb') : S.logTab === 'bio' ? logBook('bio') : scrapeView();
  return `<div><h1>Logbook</h1><div class="sub">${tr("s372")}</div></div>
  <div class="tabs" role="tablist">${tabs.map(([k, v]) => `<button role="tab" data-act="lgtab" data-t="${k}" aria-selected="${S.logTab === k}">${v}</button>`).join('')}</div>${body}`;
}
const avg = a => { const v = a.filter(x => x != null && x !== ''); return v.length ? v.reduce((s, x) => s + +x, 0) / v.length : null };
function scrapeView() {
  const rows = db.all('scrape').sort((a, b) => b.id.localeCompare(a.id)), lim = db.get('meta/scrapelimits') || {};
  const D = S.scDraft || (S.scDraft = { date: today(), time: new Date().toTimeString().slice(0, 5), rh: rows[0] && rows[0].rh ? '' : '', fe: ['', '', '', '', '', ''], bn: ['', '', '', '', '', ''], remarks: '' });
  const feMax = +lim.feMax || null, bnMin = +lim.bnMin || null;
  const cell = (v, bad) => `<td class="${bad ? 'bad' : ''}">${v == null || v === '' ? '' : num(v, v % 1 ? 1 : 0)}</td>`;
  return `<section class="card"><h2>${tr("s382")}</h2><div class="note">${tr("s383")}</div>
   <div class="fg3 mt"><label class="f">${tr("s147")}<input type="date" data-sc="date" value="${esc(D.date)}"></label><label class="f">${tr("s384")}<input type="time" data-sc="time" value="${esc(D.time)}"></label><label class="f">${tr("s385")}<input inputmode="numeric" type="number" data-sc="rh" value="${esc(D.rh)}" placeholder="${rows[0] && rows[0].rh ? tr("s373") + rows[0].rh : ''}"></label></div>
   <div class="cylin mt"><span class="lbl">Fe, ppm</span>${[0, 1, 2, 3, 4, 5].map(i => `<label><small>${tr("s374", {0: (i + 1)})}</small><input inputmode="decimal" type="number" step="any" data-sc="fe" data-i="${i}" value="${esc(D.fe[i])}"></label>`).join('')}</div>
   <div class="cylin"><span class="lbl">BN, mg KOH/g</span>${[0, 1, 2, 3, 4, 5].map(i => `<label><small>${tr("s374", {0: (i + 1)})}</small><input inputmode="decimal" type="number" step="any" data-sc="bn" data-i="${i}" value="${esc(D.bn[i])}"></label>`).join('')}</div>
   <label class="f mt">${tr("s386")}<input data-sc="remarks" value="${esc(D.remarks)}"></label>
   <div class="row mt" style="justify-content:flex-end"><button class="btn pri" data-act="scsave">${tr("s387")}</button></div></section>
  ${rows.length ? `<section class="card"><div class="row between"><h2>${tr("s379")}</h2><span class="sub">${feMax ? tr("s375") + feMax + ' ppm' : tr("s376")}${bnMin ? tr("s377") + bnMin : ''}</span></div>${scrapeChart(rows.slice(0, 40).reverse(), feMax)}
   <div class="legend">${CYL_COL.map((c, i) => `<span><i style="background:${c}"></i>${tr("s378", {1: (i + 1)})}</span>`).join('')}<span><i style="background:var(--ink)"></i>${tr("s380")}</span></div></section>` : ''}
  <section class="card"><h2>${tr("s388")}</h2><div class="scroll mt"><table class="mtab sc"><thead><tr><th class="stick">${tr("s147")}</th><th>${tr("s389")}</th>${[1, 2, 3, 4, 5, 6].map(i => `<th>Fe ${i}</th>`).join('')}<th>${tr("s390")}</th><th>${tr("s391")}</th>${[1, 2, 3, 4, 5, 6].map(i => `<th>BN ${i}</th>`).join('')}<th>${tr("s392")}</th><th>${tr("s386")}</th></tr></thead><tbody>
   ${rows.map(r => { const fa = avg(r.fe), fm = Math.max(...r.fe.filter(x => x != null && x !== '').map(Number)), ba = avg(r.bn);
     return `<tr class="click" data-act="scopen" data-rid="${esc(r.id)}"><th class="stick">${dlong(r.date)} ${esc(r.time || '')}</th><td>${r.rh ?? ''}</td>${r.fe.map(v => cell(v, feMax && v > feMax)).join('')}${cell(fa)}${cell(isFinite(fm) ? fm : null, feMax && fm > feMax)}${r.bn.map(v => cell(v, bnMin && v != null && v !== '' && v < bnMin)).join('')}${cell(ba)}<td style="text-align:left">${esc(r.remarks || '')}</td></tr>` }).join('') || ("<tr><td colspan=\"20\" class=\"empty\">" + tr("s381") + "</td></tr>")}
   </tbody></table></div></section>
  <section class="card"><h2>${tr("s393")}</h2><div class="note">${tr("s394")}</div>
   <form id="limf" class="fg mt"><label class="f">${tr("s395")}<input inputmode="decimal" type="number" step="any" name="feMax" value="${esc(lim.feMax ?? '')}"></label><label class="f">${tr("s396")}<input inputmode="decimal" type="number" step="any" name="bnMin" value="${esc(lim.bnMin ?? '')}"></label>
   <div class="f" style="justify-content:flex-end"><button class="btn">${tr("s397")}</button></div></form></section>`;
}
function scrapeChart(rows, feMax) {
  const W = 640, H = 220, P = 38, n = rows.length, vals = rows.flatMap(r => r.fe).filter(v => v != null && v !== '').map(Number);
  const mx = Math.max(feMax || 0, ...vals, 10) * 1.1, x = i => P + (n < 2 ? 0 : i / (n - 1) * (W - P - 12)), y = v => H - 26 - v / mx * (H - 44);
  const line = (get, col, w) => { let d = '', pen = false; rows.forEach((r, i) => { const v = get(r); if (v == null || v === '' || isNaN(v)) { pen = false; return } d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(+v).toFixed(1); pen = true }); return `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linejoin="round"/>` };
  const ticks = [0, 25, 50, 75, 100, 125, 150, 200].filter(t => t < mx);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${tr("s379")}">
   ${ticks.map(t => `<line x1="${P}" x2="${W - 10}" y1="${y(t)}" y2="${y(t)}" class="gl"/><text x="${P - 6}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join('')}
   ${feMax ? `<line x1="${P}" x2="${W - 10}" y1="${y(feMax)}" y2="${y(feMax)}" stroke="var(--red)" stroke-dasharray="5 4"/>` : ''}
   ${rows.map((r, i) => i % Math.ceil(n / 8 || 1) === 0 ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${parse(r.date).getDate()}.${String(parse(r.date).getMonth() + 1).padStart(2, '0')}</text>` : '').join('')}
   ${CYL_COL.map((c, k) => line(r => r.fe[k], c, 1.6)).join('')}${line(r => avg(r.fe), 'var(--ink)', 3)}</svg>`;
}
function logBook(kind) {
  const docs = db.all('logbook').filter(d => d.book === (kind === 'orb' ? 'ORB1' : 'BIO')), all = docs.flatMap(d => d.entries).sort((a, b) => b.date.localeCompare(a.date));
  if (!all.length) return `<div class="banner">${tr("s398")}</div>`;
  const q = (S.lgQ || '').toLowerCase(), code = kind === 'orb' ? S.lgCode : '';
  const years = [...new Set(all.map(e => e.date.slice(0, 4)))].sort().reverse(), yr = S.lgYear === null ? (q ? '' : years[0]) : S.lgYear;
  const list = all.filter(e => (!code || e.code === code) && (!yr || e.date.startsWith(yr)) && (!q || (e.title + ' ' + e.details + ' ' + (e.remarks || '') + ' ' + e.author).toLowerCase().includes(q)));
  const last = all[0].date, cnt = c => all.filter(e => e.code === c && (!yr || e.date.startsWith(yr))).length;
  const shown = list.slice(0, S.lgMore || 100);
  return `<section class="card"><div class="row between"><div><h2>${kind === 'orb' ? 'Oil Record Book Part I' : 'Biofouling Management Log Book'}</h2><div class="note">${tr("s405", {1: (all.length), 2: (dlong(last.slice(0, 10)))})}</div></div></div>
   <div class="row mt"><input class="search" id="lgq" type="search" placeholder="${tr("s406")}" value="${esc(S.lgQ || '')}" aria-label="${tr("s407")}">
   <select class="search" style="width:auto" data-act="lgyear" id="lgyear"><option value="">${tr("s408")}</option>${years.map(y => `<option${y === yr ? ' selected' : ''}>${y}</option>`).join('')}</select></div>
   ${kind === 'orb' ? `<div class="chips mt"><button class="chip" data-act="lgcode" data-c="" aria-pressed="${!code}">${tr("s114")}</button>${Object.entries(ORB_CODES).map(([c, l]) => `<button class="chip" data-act="lgcode" data-c="${c}" aria-pressed="${code === c}">${l} · ${cnt(c)}</button>`).join('')}</div>` : ''}</section>
  <div class="note">${tr("s409", {6: (list.length), 7: (list.length > shown.length ? tr("s399") + shown.length : '')})}</div>
  <div class="list">${shown.map(e => `<div class="lg${e.warnings ? ' warnrow' : ''}"><div class="row between"><b>${e.date.slice(8, 10)}.${e.date.slice(5, 7)}.${e.date.slice(0, 4)} ${e.date.slice(11, 16)} · <span class="tag">${esc(e.code)}</span> ${esc(e.title.replace(/^[A-Z.0-9]+:\s*/, '').replace(/^\d\.\d\s*-\s*/, ''))}</b>${e.ok ? '' : ("<span class=\"tag warn\">" + tr("s400") + "</span>")}</div>
    <div class="ld">${esc(e.details)}</div>${e.remarks ? `<div class="small">${tr("s401", {0: (esc(e.remarks))})}</div>` : ''}${e.warnings ? `<div class="small bad">e-log: ${esc(e.warnings)}</div>` : ''}<div class="small">${esc(e.author || '')}${e.att ? tr("s402") + e.att : ''}</div></div>`).join('') || ("<div class=\"empty\">" + tr("s403") + "</div>")}</div>
  ${list.length > shown.length ? `<button class="btn" data-act="lgmore">${tr("s404")}</button>` : ''}`;
}


/* ---------- Наработка компонентов ГД (ME RHRS) ---------- */
function vRhrs() {
  const meta = db.get('rhrs-meta/current'), groups = db.all('rhrs').sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  if (!groups.length) return `<div><h1>${tr("s410")}</h1></div><div class="banner">${tr("s411")}</div>`;
  const RH = meta ? +meta.rh : null, log = db.all('rhrslog').sort((a, b) => b.id.localeCompare(a.id)).slice(0, 5);
  const all = groups.flatMap(g => g.rows.map(r => ({ g, r, c: RR.calcRow(g, r, RH) })));
  const over = all.filter(x => x.c.left != null && x.c.left < 0 || x.c.left2 != null && x.c.left2 < 0), soon = all.filter(x => !over.includes(x) && (x.c.left != null && x.c.left < 2000 || x.c.left2 != null && x.c.left2 < 2000));
  const col = v => v == null ? '' : v < 0 ? 'bad' : v < 2000 ? 'warnc' : '';
  const n0 = v => v == null ? '' : num(v, 0);
  return `<div><h1>${tr("s436")}</h1><div class="sub">${tr("s437")}</div></div>
  <section class="card"><form id="rhf" class="rhf"><label class="f">${tr("s385")}<input name="rh" inputmode="numeric" type="number" value="${esc(RH ?? '')}" style="font-size:22px;font-weight:600"></label>
   <div class="note">${meta ? tr("s412") + dlong(meta.date) + (meta.by ? ' · ' + esc(meta.by) : '') : ''}${log.length ? ("<br>" + tr("s413") + " ") + log.map(l => num(l.rh, 0) + ' (' + dlong(l.date) + ')').join(' · ') : ''}</div>
   <button class="btn pri">${tr("s438")}</button></form></section>
  <div class="grid2"><div class="stat"><b style="color:${over.length ? 'var(--red)' : 'inherit'}">${over.length}</b><span class="lbl">${tr("s439")}</span></div><div class="stat"><b style="color:${soon.length ? 'var(--acc)' : 'inherit'}">${soon.length}</b><span class="lbl">${tr("s440")}</span></div></div>
  ${over.length + soon.length ? `<section class="card"><h2>${tr("s418")}</h2><div class="list mt">${[...over, ...soon].sort((a, b) => Math.min(a.c.left ?? 1e9, a.c.left2 ?? 1e9) - Math.min(b.c.left ?? 1e9, b.c.left2 ?? 1e9)).map(x => { const l = Math.min(x.c.left ?? 1e9, x.c.left2 ?? 1e9); return `<a class="t" href="#g-${esc(x.g.id)}" data-act="rhgo" data-g="${esc(x.g.id)}"><div class="tb"><span class="tt">${esc(x.g.title)} · ${esc(x.r.pos)}</span><span class="small ${l < 0 ? 'bad' : 'warnc'}">${l < 0 ? tr("s414") + num(-l, 0) + tr("s415") : tr("s416") + num(l, 0) + tr("s415")}${x.g.kind === 'fv' && x.c.left2 < x.c.left ? tr("s417") : ''}</span></div></a>` }).join('')}</div></section>` : ''}
  ${groups.map(g => { const fv = g.kind === 'fv';
    return `<section class="card" id="g-${esc(g.id)}"><div class="row between"><h2>${esc(g.title)}</h2><span class="sub">${g.interval ? tr("s419") + num(g.interval, 0) + tr("s415") : ''}${g.interval2 ? tr("s420") + num(g.interval2, 0) + tr("s415") : ''}${g.kind === 'own' ? tr("s421") : ''}</span></div>
    <div class="scroll mt"><table class="stack rh"><thead><tr><th>${tr("s432")}</th><th>${tr("s433")}</th><th>${tr("s434")}</th><th>${tr("s435")}</th>${g.kind === 'own' ? ("<th>" + tr("s422") + "</th>") : ''}<th>${fv ? tr("s423") : tr("s424")}</th>${g.kind !== 'run' ? `<th>${fv ? tr("s425") : tr("s426")}</th>` : ''}${fv ? ("<th>" + tr("s427") + "</th>") : ''}${g.total ? ("<th>" + tr("s428") + "</th>") : ''}<th>${tr("s154")}</th></tr></thead><tbody>
    ${g.rows.map((r, i) => { const c = RR.calcRow(g, r, RH); return `<tr class="click" data-act="rhedit" data-g="${esc(g.id)}" data-i="${i}"><td data-l="${tr("s432")}"><b>${esc(r.pos)}</b></td><td data-l="${tr("s433")}">${esc(r.id || '')}</td><td data-l="${tr("s434")}">${r.date && /^\d{4}-/.test(r.date) ? dlong(r.date) + (language() === 'ru' ? ' ' + r.date.slice(0, 4) : '') : esc(r.date || '')}</td><td data-l="${tr("s435")}">${n0(r.rhInst)}</td>${g.kind === 'own' ? `<td data-l="${tr("s429")}">${n0(r.own)}</td>` : ''}
      <td data-l="${fv ? tr("s423") : tr("s424")}">${n0(c.run)}</td>${g.kind !== 'run' ? `<td data-l="${fv ? tr("s425") : tr("s426")}" class="${col(c.left)}"><b>${n0(c.left)}</b></td>` : ''}${fv ? `<td data-l="${tr("s430")}" class="${col(c.left2)}"><b>${n0(c.left2)}</b></td>` : ''}${g.total ? `<td data-l="${tr("s431")}">${n0(c.total)}</td>` : ''}<td data-l="${tr("s154")}" class="small">${esc(r.note || '')}</td></tr>` }).join('')}
    </tbody></table></div></section>` }).join('')}
  <div class="note">${tr("s441", {9: (num((groups.find(g => g.id === 'cover') || {}).interval || 24000, 0))})}</div>`;
}
function openRh(gid, i) {
  const g = db.get('rhrs/' + gid), r = g.rows[i]; S.edit = { rh: true, gid, i };
  const f = (k, l, t = 'text') => `<label class="f">${l}<input name="${k === 'id' ? '_pid' : k}" ${t === 'number' ? 'inputmode="numeric" type="number"' : 'type="' + t + '"'} value="${esc(r[k] ?? '')}"></label>`;
  $('#modal').innerHTML = `<form class="sheet" id="rhrow"><div class="row between"><h2 id="mt">${esc(g.title)} · ${esc(r.pos)}</h2>${closeBtn()}</div>
   <div class="fg">${f('id', tr("s442"))}${f('date', tr("s443"), 'date')}${f('rhInst', tr("s444"), 'number')}${g.kind === 'fv' ? f('prior', tr("s445"), 'number') : g.total ? f('prior', tr("s446"), 'number') : ''}${g.kind === 'own' ? f('own', tr("s422"), 'number') : ''}</div>
   <label class="f">${tr("s154")}<textarea name="note">${esc(r.note || '')}</textarea></label>
   <div class="row between"><label class="f" style="max-width:220px">${tr("s447")}<input name="_interval" inputmode="numeric" type="number" value="${esc(g.interval ?? '')}"></label><div class="row"><button type="button" class="btn" data-act="close">${tr("s240")}</button><button class="btn pri">${tr("s241")}</button></div></div></form>`;
  $('#modal').hidden = false;
}

/* ---------- Рефы ---------- */
function vReefer() {
  const p = S.rfDraft || (S.rfDraft = { sw: '', n: '', hh: 24, mm: 0, ...(db.get('meta/reefer') || {}) }), perf = db.get('perf/meta'), seaT = perf && perf.last && perf.last.sea;
  const ok = p.sw !== '' && p.n !== '', k = ok ? RR.reeferKWh(p.sw, p.n, p.hh, p.mm) : null, per = p.sw !== '' ? 1.787 + 0.054 * Math.min(35, Math.max(5, +p.sw)) : null;
  const inp = (k2, l, extra = '') => `<label class="f">${l}<input inputmode="decimal" type="number" step="any" data-rf="${k2}" value="${esc(p[k2])}" ${extra}></label>`;
  return `<div><h1>${tr("s457")}</h1><div class="sub">${tr("s458")}</div></div>
  <section class="card"><div class="fg mt">${inp('sw', tr("s448"), seaT != null ? `placeholder="StarConnect: ${seaT}"` : '')}${inp('n', tr("s449"))}${inp('hh', tr("s450"))}${inp('mm', tr("s451"))}</div>
  ${seaT != null && p.sw === '' ? `<button class="btn mt" data-act="rfsea">${tr("s452", {0: (seaT)})}</button>` : ''}</section>
  <div class="grid2">${out(tr("s453"), k != null ? num(k, 1) : '—', tr("s454"), 1)}${out(tr("s455"), per != null ? num(per, 3) : '—', tr("s456"))}</div>
  <div class="note">${tr("s459")}</div>`;
}

/* ---------- PMS Workboard ---------- */
const DS_RU = localized(() => ({ Overdue: tr("s119"), Due: tr("s460"), 'Due Shortly': tr("s461"), 'Upcoming Due': tr("s462"), 'Postponed to Drydock Approved': tr("s463") }));
function pmsJobs() { return db.all('pmswb').filter(d => d.jobs).flatMap(d => d.jobs) }
function vPms() {
  const jobs = pmsJobs(), meta = db.get('pmswb/meta');
  if (!jobs.length) return `<div><h1>PMS Workboard</h1></div><div class="banner">${tr("s464")}</div>`;
  const planned = new Set(live().flatMap(t => (t.pms || []).map(p => p.no))), q = (S.pmQ || '').toLowerCase();
  const order = ['Overdue', 'Due', 'Postponed to Drydock Approved', 'Due Shortly', 'Upcoming Due'];
  const L = jobs.filter(j => (!S.pmDs || j.ds === S.pmDs) && (S.pmResp === 'all' || (S.pmResp === 'eng' ? /Engineer|Electrician/.test(j.resp) : j.resp === S.pmResp)) && (!S.pmFree || !planned.has(j.no))
    && (!q || (j.title + ' ' + j.eq + ' ' + j.no + ' ' + j.code).toLowerCase().includes(q))).sort((a, b) => order.indexOf(a.ds) - order.indexOf(b.ds) || (a.due || '9').localeCompare(b.due || '9'));
  const cnt = k => jobs.filter(j => j.ds === k && (S.pmResp === 'all' || (S.pmResp === 'eng' ? /Engineer|Electrician/.test(j.resp) : j.resp === S.pmResp))).length;
  const closed = live().filter(t => t.pmsClosed && t.status !== 'done');
  return `<div><h1>PMS Workboard</h1><div class="sub">${tr("s473", {0: (jobs.length), 1: (meta ? dlong(meta.date) : '')})}</div></div>
  ${closed.length ? `<section class="card"><h2 style="color:var(--blue)">${tr("s465", {0: (closed.length)})}</h2><div class="note">${tr("s466")}</div><div class="list mt">${closed.map(t => card(t, { day: true })).join('')}</div></section>` : ''}
  <section class="card"><div class="chips">${['', ...order].map(k => `<button class="chip" data-act="pmds" data-c="${k}" aria-pressed="${(S.pmDs || '') === k}">${k ? DS_RU[k] + ' · ' + cnt(k) : tr("s114")}</button>`).join('')}</div>
   <div class="row mt"><input class="search" id="pmq" type="search" placeholder="${tr("s474")}" value="${esc(S.pmQ || '')}" aria-label="${tr("s475")}">
   <select class="search" style="width:auto" id="pmresp"><option value="eng"${S.pmResp === 'eng' ? ' selected' : ''}>${tr("s476")}</option><option value="all"${S.pmResp === 'all' ? ' selected' : ''}>${tr("s477")}</option>${[...new Set(jobs.map(j => j.resp))].sort().map(r => `<option${S.pmResp === r ? ' selected' : ''}>${esc(r)}</option>`).join('')}</select>
   <label class="sub"><input type="checkbox" data-act="pmfree" ${S.pmFree ? 'checked' : ''}> ${tr("s478")}</label></div></section>
  <div class="note">${tr("s479", {9: (L.length), 10: (L.length > S.pmMore ? tr("s399") + S.pmMore : '')})}</div>
  <div class="list">${L.slice(0, S.pmMore).map(j => `<div class="lg" data-urgency="${urgencyOf(j)}"><div class="row between"><b>${urgencyBadge(urgencyOf(j))} ${esc(j.title)}</b><span class="tag ${j.ds === 'Overdue' ? 'warn' : ''}">${DS_RU[j.ds] || esc(j.ds)}</span></div>
    <div class="ld">${esc(j.eq)} · ${esc(j.freq)}${j.tol ? ' (±' + esc(j.tol) + ')' : ''} · ${esc(j.resp)}</div>
    <div class="row between"><span class="small">${tr("s472", {9: (esc(j.no)), 10: (esc(j.code || '')), 11: (j.due ? dlong(j.due) + (language() === 'ru' ? ' ' + j.due.slice(0, 4) : '') : '—'), 12: (j.ctr ? tr("s467") + num(j.ctr, 0) + tr("s468") + num(j.rh, 0) + ')' : ''), 13: (j.last ? tr("s469") + j.last : ''), 14: (esc(j.js))})}</span>
    ${planned.has(j.no) ? ("<span class=\"tag\">" + tr("s470") + "</span>") : `<button class="btn" data-act="pmadd" data-no="${esc(j.no)}">${tr("s471")}</button>`}</div></div>`).join('') || ("<div class=\"empty\">" + tr("s403") + "</div>")}</div>
  ${L.length > S.pmMore ? ("<button class=\"btn\" data-act=\"pmmore\">" + tr("s404") + "</button>") : ''}`;
}

/* ---------- ME performance (StarConnect) ---------- */
const PERF = localized(() => ({ load: [['pw', tr("s480"), 0], ['rpm', tr("s481"), 1], ['fi', tr("s482"), 1], ['sog', tr("s483"), 1]],
  exh: [1, 2, 3, 4, 5, 6].map(c => ['exh' + c, tr("s484") + c, 0]), pmax: [1, 2, 3, 4, 5, 6].map(c => ['pmax' + c, tr("s484") + c, 1]), pcomp: [1, 2, 3, 4, 5, 6].map(c => ['pcomp' + c, tr("s484") + c, 1]),
  tc: [['tc1', tr("s485"), 0], ['tc2', tr("s486"), 0], ['tcin1', tr("s487"), 0], ['tcin2', tr("s488"), 0], ['tcout1', tr("s489"), 0], ['tcout2', tr("s490"), 0]],
  air: [['scavP', tr("s491"), 2], ['scavT', 'Tscav, °C', 1], ['exhP', tr("s492"), 2], ['sacIn1', tr("s493"), 0], ['sacOut1', tr("s494"), 1], ['sacIn2', tr("s495"), 0], ['sacOut2', tr("s496"), 1], ['sacCW', tr("s497"), 1]],
  sys: [['jcw', tr("s498"), 1], ['lo', tr("s499"), 1], ['hydP', tr("s500"), 0], ['visc', tr("s501"), 1], ['fuelT', tr("s502"), 1], ['sea', tr("s177"), 1], ['er', tr("s503"), 1]],
  ae: [['ae1', tr("s504"), 0], ['ae2', tr("s505"), 0], ['ae3', tr("s506"), 0], ['ae1h', tr("s507"), 0], ['ae2h', tr("s508"), 0], ['ae3h', tr("s509"), 0], ['whr', tr("s510"), 0]] }));
const PERF_T = localized(() => ({ load: tr("s511"), exh: tr("s512"), pmax: tr("s513"), pcomp: tr("s514"), tc: tr("s515"), air: tr("s516"), sys: tr("s517"), ae: tr("s518") }));
function vPerf() {
  if (S.pfTab === 'iso' || S.pfTab === 'pmi') return `<div><h1>ME performance</h1><div class="sub">${tr("s519")}</div></div>${ENG.perfTabs()}${S.pfTab === 'iso' ? ENG.isoView() : ENG.pmiView()}`;
  return vPerfSC();
}
function vPerfSC() {
  const meta = db.get('perf/meta'), days = db.all('perf').filter(d => /^day-/.test(d.id)).sort((a, b) => b.id.localeCompare(a.id));
  if (!meta) return `<div><h1>ME performance</h1></div>${ENG.perfTabs()}<div class="banner">${tr("s520")}</div>`;
  const grp = S.pfG || 'exh', defs = PERF[grp], sea = days.filter(d => d.n > 0), L = meta.last || {};
  const cyl = ['exh', 'pmax', 'pcomp'].includes(grp);
  const dev = (d, k) => { if (!cyl) return null; const vals = defs.map(x => d[x[0]]).filter(v => v != null); const m = vals.reduce((a, b) => a + b, 0) / vals.length; return d[k] != null ? d[k] - m : null };
  return `<div><h1>ME performance</h1><div class="sub">${tr("s531", {0: (dlong(meta.from)), 1: (dlong(meta.to))})}</div></div>${ENG.perfTabs()}
  <section class="card"><h2>${tr("s532", {3: (L.t ? L.t.replace('T', ' ') : '')})}</h2><div class="grid4 mt">${[['pw', tr("s521"), tr("s522"), 0], ['rpm', tr("s523"), tr("s524"), 1], ['fi', tr("s525"), '%', 1], ['scavP', 'Pscav', tr("s526"), 2]].map(([k, l, u, d]) => out(l, L[k] != null ? num(L[k], d) : '—', u)).join('')}</div>
  <div class="note mt">${tr("s533", {5: (L.dfwd ?? '—'), 6: (L.daft ?? '—'), 7: (L.sea ?? '—'), 8: (L.er ?? '—'), 9: ([1, 2, 3].map(i => L['ae' + i] > 50 ? tr("s527") + i + ' ' + num(L['ae' + i], 0) + tr("s528") : '').filter(Boolean).join(', ') || tr("s529"))})}</div></section>
  <div class="tabs" role="tablist">${Object.keys(PERF).map(k => `<button role="tab" data-act="pfg" data-g="${k}" aria-selected="${grp === k}">${PERF_T[k].split(',')[0]}</button>`).join('')}</div>
  ${sea.length > 1 ? `<section class="card"><h2>${PERF_T[grp]}</h2>${perfChart(sea.slice().reverse(), defs)}<div class="legend">${defs.map((x, i) => `<span><i style="background:${CYL_COL[i % 6]}"></i>${esc(x[1])}</span>`).join('')}</div></section>` : ''}
  <section class="card"><h2>${tr("s534", {12: (cyl ? tr("s530") : '')})}</h2><div class="scroll mt"><table class="mtab"><thead><tr><th class="stick">${tr("s147")}</th><th>${tr("s535")}</th>${defs.map(x => `<th>${esc(x[1])}</th>`).join('')}</tr></thead><tbody>
  ${days.map(d => `<tr><th class="stick">${dlong(d.id.slice(4))}</th><td>${d.hours ?? ''}</td>${defs.map(([k, l, dp]) => { const v = d[k], dv = dev(d, k); return `<td>${v != null ? num(v, dp) : ''}${dv != null && d.n ? `<small class="${Math.abs(dv) > (grp === 'exh' ? 15 : 3) ? 'bad' : 'note'}"> ${dv > 0 ? '+' : ''}${num(dv, grp === 'exh' ? 0 : 1)}</small>` : ''}</td>` }).join('')}</tr>`).join('')}
  </tbody></table></div><div class="note">${tr("s536")}</div></section>`;
}
function perfChart(rows, defs) {
  const W = 640, H = 220, P = 44, n = rows.length, vals = rows.flatMap(r => defs.map(d => r[d[0]])).filter(v => v != null);
  if (!vals.length) return ("<div class=\"empty\">" + tr("s537") + "</div>");
  let mn = Math.min(...vals), mx = Math.max(...vals); const pad = (mx - mn) * .1 || 1; mn -= pad; mx += pad;
  const x = i => P + (n < 2 ? 0 : i / (n - 1) * (W - P - 12)), y = v => H - 26 - (v - mn) / (mx - mn) * (H - 44);
  const ticks = [0, .25, .5, .75, 1].map(f => mn + (mx - mn) * f);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${tr("s538")}">${ticks.map(t => `<line x1="${P}" x2="${W - 10}" y1="${y(t)}" y2="${y(t)}" class="gl"/><text x="${P - 6}" y="${y(t) + 4}" text-anchor="end">${num(t, mx - mn < 10 ? 1 : 0)}</text>`).join('')}
  ${rows.map((r, i) => i % Math.ceil(n / 8) === 0 ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${r.id.slice(12, 14)}.${r.id.slice(9, 11)}</text>` : '').join('')}
  ${defs.map((d, k) => { let p = '', pen = false; rows.forEach((r, i) => { const v = r[d[0]]; if (v == null) { pen = false; return } p += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); pen = true }); return `<path d="${p}" fill="none" stroke="${CYL_COL[k % 6]}" stroke-width="2" stroke-linejoin="round"/>` }).join('')}</svg>`;
}

/* ---------- Bearing Wear Monitoring (Kongsberg BWCM) ---------- */
const BWM_M = localized(() => ({ dev: tr("s539"), s1: tr("s540"), s2: tr("s541"), mb: tr("s542") }));
function vBwm() {
  const meta = db.get('bwm/meta'), months = db.all('bwm').filter(d => /^m-/.test(d.id)).sort((a, b) => a.month.localeCompare(b.month)), lim = db.get('meta/bwmlimits') || {};
  if (!months.length) return `<div><h1>Bearing Wear Monitoring</h1><div class="sub">Kongsberg BWM</div></div><div class="banner">${tr("s543")}</div>`;
  const met = S.bwM || 'dev', last = months[months.length - 1], yago = months.find(m => m.month === String(+last.month.slice(0, 4) - 1) + last.month.slice(4)) || months[Math.max(0, months.length - 13)];
  const base = months.find(m => m.month >= '2016-01' && Object.keys(m.cyl).length === 6) || months[0];
  const val = (m, c) => met === 'mb' ? (m.mb || {})[c] : m.cyl[c] && m.cyl[c][met];
  const L = +lim.dev || null, cyls = met === 'mb' ? [2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6];
  const st = (meta && meta.status) || {}, from = S.bwFrom || '';
  const shown = months.filter(m => !from || m.month >= from);
  return `<div><h1>Bearing Wear Monitoring</h1><div class="sub">${tr("s555", {0: (esc(meta?.system || 'Kongsberg BWM')), 1: (esc(meta?.engine || '')), 2: (dlongM(months[0].month)), 3: (dlongM(last.month))})}</div></div>
  <section class="card"><div class="row between"><h2>${tr("s556")}</h2><span class="sub">${tr("s557", {4: (meta ? dlong(meta.statusDate) : '—')})}</span></div>
   <div class="cyl mt">${[1, 2, 3, 4, 5, 6].map(c => { const now = last.cyl[c] && last.cyl[c].dev, d12 = now != null && yago.cyl[c] ? now - yago.cyl[c].dev : null, d0 = now != null && base.cyl[c] ? now - base.cyl[c].dev : null, s = st[c];
     return `<div class="cy${s === 'Alarm' || (L && Math.abs(now) >= L) ? ' bad' : ''}"><span class="lbl">${tr("s544", {1: (c), 2: (s ? ' · ' + (s === 'Alarm' ? '<span class="bad">Alarm</span>' : 'Normal') : '')})}</span><b>${now != null ? fmtmm(now) : '—'}</b><span class="lbl">${tr("s545", {4: (d12 != null ? sign(d12) : '—'), 5: (base.month.slice(0, 4)), 6: (d0 != null ? sign(d0) : '—')})}</span></div>` }).join('')}</div>
   <div class="note mt">${tr("s558", {6: (dlongM(last.month)), 7: (meta?.hi?.length ? `${tr("s546", {0: (meta.hi.slice(-3).map(h => esc(h.date.slice(0, 10)) + ' ' + esc(h.msg.replace(/.*tag (\S+)\. .*Value = ([\d.]+).*/, '$1 = $2'))).join('; '))})}` : '')})}</div></section>
  <section class="card"><div class="row between"><h2>${tr("s559", {8: (BWM_M[met])})}</h2><div class="row"><select class="search" style="width:auto" id="bwfrom" aria-label="${tr("s560")}"><option value="">${tr("s561", {9: (months[0].month.slice(0, 4))})}</option>${['2020-01', '2022-01', '2024-01', '2025-11'].map(v => `<option value="${v}"${from === v ? ' selected' : ''}>${tr("s548", {2: (v.slice(0, 4) === '2025' ? tr("s547") : v.slice(0, 4))})}</option>`).join('')}</select></div></div>
   <div class="chips mt">${Object.entries(BWM_M).map(([k, l]) => `<button class="chip" data-act="bwm" data-m="${k}" aria-pressed="${met === k}">${l.split(',')[0]}</button>`).join('')}</div>
   ${bwmChart(shown, cyls, c => m => val(m, c), met === 'mb' ? null : L)}
   <div class="legend">${cyls.map(c => `<span><i style="background:${CYL_COL[c - 1]}"></i>${met === 'mb' ? tr("s549") + c : tr("s484") + c}</span>`).join('')}${L && met !== 'mb' ? `<span><i style="background:var(--red)"></i>${tr("s550", {0: (L)})}</span>` : ''}</div></section>
  <section class="card"><h2>${tr("s562", {15: (BWM_M[met])})}</h2><div class="scroll mt"><table class="mtab"><thead><tr><th class="stick">${tr("s112")}</th><th>${tr("s389")}</th>${cyls.map(c => `<th>${met === 'mb' ? tr("s549") : tr("s484")}${c}</th>`).join('')}</tr></thead><tbody>
   ${shown.slice().reverse().slice(0, S.bwAll ? 999 : 24).map((m, i, arr) => { const prev = arr[i + 1]; return `<tr class="click" data-act="bwday" data-m="${m.month}"><th class="stick">${dlongM(m.month)}</th><td>${m.rh ? num(m.rh, 0) : ''}</td>${cyls.map(c => { const v = val(m, c), p = prev ? val(prev, c) : null, d = v != null && p != null ? v - p : null;
     return `<td class="${L && met !== 'mb' && v != null && Math.abs(v) >= L ? 'bad' : ''}">${v != null ? fmtmm(v) : ''}${d != null && Math.abs(d) >= .005 ? `<small class="${d > 0 ? 'up' : 'dn'}"> ${sign(d)}</small>` : ''}</td>` }).join('')}</tr>` }).join('')}
   </tbody></table></div>${shown.length > 24 && !S.bwAll ? `<button class="btn mt" data-act="bwall">${tr("s551", {0: (shown.length)})}</button>` : ''}<div class="note">${tr("s563")}</div></section>
  ${S.bwDay ? bwmDays(months.find(m => m.month === S.bwDay)) : ''}
  <section class="card"><h2>${tr("s564")}</h2><div class="note">${tr("s565")}</div>
   <form id="bwlimf" class="fg mt"><label class="f">${tr("s566")}<input inputmode="decimal" type="number" step="any" name="dev" value="${esc(lim.dev ?? '')}"></label><div class="f" style="justify-content:flex-end"><button class="btn">${tr("s567")}</button></div></form></section>
  ${meta && meta.events ? `<section class="card"><h2>${tr("s553")}</h2><div class="note">${tr("s554", {0: (esc(meta.eventsTo.slice(0, 10)))})}</div><div class="scroll mt"><table class="stack"><thead><tr><th>${tr("s112")}</th><th>${tr("s336")}</th><th>${tr("s552")}</th></tr></thead><tbody>${meta.events.slice(0, 15).map(e => `<tr><td data-l="${tr("s112")}">${esc(e.month)}</td><td data-l="${tr("s336")}">${esc(e.what)}</td><td data-l="${tr("s552")}">${e.n}</td></tr>`).join('')}</tbody></table></div></section>` : ''}`;
}
const fmtmm = v => (v > 0 ? '+' : '') + num(v, 3);
const sign = v => (v > 0 ? '+' : '') + num(v, 3);
const dlongM = m => MON1[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4);
function bwmChart(months, cyls, getter, L) {
  const W = 680, H = 240, P = 48, n = months.length, vals = months.flatMap(m => cyls.map(c => getter(c)(m))).filter(v => v != null);
  let mn = Math.min(...vals, L ? -L : 0), mx = Math.max(...vals, L ? L : 0); const pad = (mx - mn) * .08 || .01; mn -= pad; mx += pad;
  const x = i => P + (n < 2 ? 0 : i / (n - 1) * (W - P - 12)), y = v => H - 26 - (v - mn) / (mx - mn) * (H - 44);
  const step = (mx - mn) > .2 ? .05 : (mx - mn) > .08 ? .02 : .01, ticks = []; for (let t = Math.ceil(mn / step) * step; t <= mx; t += step) ticks.push(+t.toFixed(3));
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${tr("s568")}">${ticks.map(t => `<line x1="${P}" x2="${W - 10}" y1="${y(t)}" y2="${y(t)}" class="gl"${t === 0 ? ' style="stroke:#3A4A5C"' : ''}/><text x="${P - 6}" y="${y(t) + 4}" text-anchor="end">${num(t, 2)}</text>`).join('')}
   ${L ? [L, -L].map(l => `<line x1="${P}" x2="${W - 10}" y1="${y(l)}" y2="${y(l)}" stroke="var(--red)" stroke-dasharray="5 4"/>`).join('') : ''}
   ${months.map((m, i) => m.month.endsWith('-01') && (n < 40 || +m.month.slice(0, 4) % 2 === 0) ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${n < 30 ? m.month.slice(5, 7) + '.' : ''}${m.month.slice(0, 4)}</text>` : '').join('')}
   ${cyls.map(c => { let p = '', pen = false; months.forEach((m, i) => { const v = getter(c)(m); if (v == null) { pen = false; return } p += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); pen = true }); return `<path d="${p}" fill="none" stroke="${CYL_COL[c - 1]}" stroke-width="2" stroke-linejoin="round"/>` }).join('')}</svg>`;
}
function bwmDays(m) {
  if (!m || !m.days || !m.days.length) return '';
  const rows = m.days.map(d => ({ month: d[0], vals: d.slice(1) }));
  return `<section class="card"><div class="row between"><h2>${tr("s569", {0: (dlongM(m.month))})}</h2><button class="btn" data-act="bwday" data-m="">${tr("s570")}</button></div>
   ${bwmChart(rows, [1, 2, 3, 4, 5, 6], c => r => r.vals[c - 1], +(db.get('meta/bwmlimits') || {}).dev || null)}
   <div class="scroll mt"><table class="mtab"><thead><tr><th class="stick">${tr("s147")}</th>${[1, 2, 3, 4, 5, 6].map(c => `<th>${tr("s374", {0: (c)})}</th>`).join('')}</tr></thead><tbody>${rows.slice().reverse().map(r => `<tr><th class="stick">${dlong(r.month)}</th>${r.vals.map(v => `<td>${v != null ? fmtmm(v) : ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
}

/* ---------- Ещё (телефон) ---------- */
function vMore() {
  const c = counts(), n = c.over + c.inbox + c.stale;
  const it = (href, title, sub, badge) => `<a class="t" href="${href}"><div class="tb"><span class="tt">${title}</span><span class="small">${sub}</span></div>${badge ? `<span class="tag warn">${badge}</span>` : ''}</a>`;
  return `<div><h1>${tr("s594")}</h1><div class="sub">${tr("s595")}</div></div><div class="list more-menu">
   ${it('#' + PRIORITY_ROUTE, tr("s103"), tr("s571"))}
   ${it('#ship', tr("s188"), tr("s572"))}
   ${it('#rhrs', tr("s410"), tr("s573"))}
   ${it('#pms', 'PMS Workboard', tr("s574"))}
   ${it('#notes', tr("s575"), tr("s576"))}
   ${it('#perf', 'ME performance', tr("s577"))}
   ${it('#equip', tr("s578"), tr("s579"))}
   ${it('#lochart', tr("s580"), tr("s581"))}
   ${it('#oil', tr("s582"), tr("s583"))}
   ${it('#dg', tr("s584"), tr("s585"))}
   ${it('#fuel', tr("s586"), tr("s587"))}
   ${it('#log', 'Logbook', tr("s588"))}
   ${it('#reefer', tr("s589"), tr("s590"))}
   ${it('#alerts', tr("s143"), tr("s591"), n || '')}
   ${it('#bwm', 'Bearing monitoring', tr("s592"))}
   ${it('#sync', tr("s265"), tr("s593"))}</div>
   <section class="card"><h2>${tr("s461")}</h2><div class="note mt">${tr("s596")}</div></section>`;
}

/* ---------- editor ---------- */

/* ---------- task attachments (stored on this device only) ---------- */
const ATT_MAX = 25 * 1024 * 1024;
const fmtSize = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
async function shrinkImage(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file), k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.82));
    return blob && blob.size < file.size ? blob : file;
  } catch (e) { return file }
}
function attHtml(t) {
  const L = t.att || [];
  return `<fieldset class="att"><legend>${tr('att.title')}</legend>${L.map(a => `<div class="att-row">${/^image\//.test(a.type) ? `<img class="att-th" alt="" data-aid="${esc(a.id)}">` : ico('file', { size: 22 })}<button type="button" class="att-name" data-act="attopen" data-k="${esc(a.id)}">${esc(a.name)}</button><span class="small">${fmtSize(a.size)}</span><button type="button" class="btn ghost att-x" data-act="attdel" data-k="${esc(a.id)}" aria-label="${tr('att.remove')}">${ico('close', { size: 16 })}</button></div>`).join('')}
  <label class="btn att-add">${ico('upload', { size: 16 })} ${tr('att.add')}<input type="file" id="attin" multiple hidden></label><div class="small">${tr('att.note')}</div></fieldset>`;
}
function hydrateAtt() {
  document.querySelectorAll('#attfs img[data-aid]').forEach(img => db.fileGet(img.dataset.aid).then(b => { if (b) img.src = URL.createObjectURL(b) }).catch(() => {}));
}
function refreshAtt() { const box = $('#attfs'); if (box && S.edit) { box.innerHTML = attHtml(S.edit.t); hydrateAtt() } }
async function openAtt(id) {
  const a = ((S.edit && S.edit.t.att) || []).find(x => x.id === id) || [...S.tasks.values()].flatMap(t => t.att || []).find(x => x.id === id);
  const b = await db.fileGet(id).catch(() => null);
  if (!b || !a) { toast(tr('att.missing')); return }
  const l = document.createElement('a'); l.href = URL.createObjectURL(b); l.target = '_blank'; l.rel = 'noopener';
  if (!/^(image\/|application\/pdf)/.test(a.type)) l.download = a.name;
  document.body.appendChild(l); l.click(); l.remove();
}
function delAtt(id) {
  if (!S.edit) return;
  S.edit.t.att = (S.edit.t.att || []).filter(a => a.id !== id);
  if ((S.edit.newAtt || []).includes(id)) { db.fileDel(id).catch(() => {}); S.edit.newAtt = S.edit.newAtt.filter(x => x !== id) } else (S.edit.rm ||= []).push(id);
  refreshAtt();
}
document.addEventListener('change', async e => {
  if (e.target.id !== 'attin' || !S.edit) return;
  const files = [...e.target.files]; e.target.value = '';
  for (const f of files) {
    if (f.size > ATT_MAX) { toast(tr('att.big', { 0: f.name })); continue }
    const blob = await shrinkImage(f), id = uid('a');
    await db.fileSet(id, blob);
    if (!S.edit) { db.fileDel(id).catch(() => {}); return }
    S.edit.t.att = [...(S.edit.t.att || []), { id, name: blob !== f ? f.name.replace(/\.[^.]+$/, '') + '.jpg' : f.name, type: blob.type || f.type, size: blob.size }];
    (S.edit.newAtt ||= []).push(id);
  }
  refreshAtt();
});
const closeBtn = () => `<button type="button" class="btn ghost" data-act="close" aria-label="${tr("s570")}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
function openEd(id, preset) {
  const isNew = !id; const t = isNew ? { id: uid('t'), title: '', note: '', cat: orig("s8"), prio: 2, pri: '', owner: '', phase: '', due: '', day: preset || S.sel || today(), slot: '', status: 'todo', waiting: '', moved: 0, repeat: '', notion: '', trello: '', source: orig("s597"), created: today(), doneAt: '' } : { ...S.tasks.get(id) };
  if (!t || !t.id) return; S.edit = { t, isNew };
  const opts = (o, v) => Object.entries(o).map(([k, x]) => `<option value="${k}"${k === (v || '') ? ' selected' : ''}>${x}</option>`).join('');
  $('#modal').innerHTML = `<form class="sheet" id="edf"><div class="row between"><h2 id="mt">${isNew ? tr("s598") : tr("s599")}</h2>${closeBtn()}</div>
  <label class="f" style="position:relative">${tr("s608")}<input name="title" required value="${esc(t.title)}" style="padding-right:46px">${SR ? ("<button type=\"button\" class=\"mic\" data-act=\"mic\" aria-label=\"" + tr("s600") + "\"><svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" aria-hidden=\"true\"><rect x=\"9\" y=\"3\" width=\"6\" height=\"11\" rx=\"3\"/><path d=\"M5 11a7 7 0 0 0 14 0M12 18v3\"/></svg></button>") : ''}</label>
  <fieldset class="priority-editor"><legend>${tr("s609")}</legend><div class="row">
    ${PRIORITY_ORDER.map(key => `<label class="priority-option" data-priority="${key}"><input type="radio" name="pri" value="${key}"${taskPriority(t) === key ? ' checked' : ''}>${TASK_PRIORITIES[key]}</label>`).join('')}
  </div></fieldset>
  <div class="fg">
   <label class="f">${tr("s610")}<select name="cat">${(t.cat && !CATS.includes(t.cat) ? [...CATS, t.cat] : CATS).map(c => `<option value="${esc(c)}"${c === t.cat ? ' selected' : ''}>${esc(categoryText(c))}</option>`).join('')}</select></label>
   <label class="f">${tr("s611")}<select name="prio">${[1, 2, 3, 4].map(p => `<option value="${p}"${p === (Number(t.prio) || 3) ? ' selected' : ''}>P${p}</option>`).join('')}</select></label>
   <label class="f">${tr("s612")}<input type="date" name="day" value="${esc(t.day || '')}"></label>
   <label class="f">${tr("s613")}<input type="date" name="due" value="${esc(t.due || '')}"></label>
   <label class="f">${tr("s614")}<select name="slot">${opts(SLOTS, t.slot)}</select></label>
   <label class="f">${tr("s261")}<select name="status">${opts(ST, t.status)}</select></label>
   <label class="f">${tr("s615")}<input name="waiting" value="${esc(t.waiting || '')}" placeholder="${tr("s616")}"></label>
   <label class="f">${tr("s617")}<input name="owner" value="${esc(t.owner || '')}"></label>
   <label class="f">${tr("s618")}<select name="repeat">${opts(REP, t.repeat)}</select></label>
  </div>
  <div class="row"><span class="sub">${tr("s619")}</span><button type="button" class="chip" data-act="qd" data-d="0">${tr("s99")}</button><button type="button" class="chip" data-act="qd" data-d="1">${tr("s620")}</button><button type="button" class="chip" data-act="qd" data-d="7">${tr("s621")}</button><button type="button" class="chip" data-act="qd" data-d="x">${tr("s62")}</button></div>
  <label class="reply-field"><input type="checkbox" name="reply" ${t.reply === true ? 'checked' : ''}> ${tr("s77")}</label>
  <fieldset class="task-colors"><legend>${tr("s622")}</legend><div class="row">
    ${Array.from({ length: 9 }, (_, i) => {
      const value = i ? String(i) : '', title = i ? tr("s601") + i : tr("s602");
      return `<label data-task-color="${value}" title="${title}"><input type="radio" name="color" value="${value}" aria-label="${title}" ${taskColor(t.color) === value ? 'checked' : ''}><span aria-hidden="true"></span></label>`;
    }).join('')}
  </div></fieldset>
  <div id="attfs">${attHtml(t)}</div>
  <label class="f">${tr("s154")}<textarea name="note">${esc(t.note || '')}</textarea></label>
  <div class="note">${[t.notion ? `<a href="${esc(t.notion)}" target="_blank" rel="noopener">${tr("s603")}</a>` : '', t.trello ? `<a href="${esc(t.trello)}" target="_blank" rel="noopener">${tr("s604")}</a>` : '', t.phase ? tr("s605") + esc(t.phase) : '', t.source ? tr("s606") + esc(t.source === orig("s597") ? tr("s597") : t.source) : '', t.moved ? tr("s607") + t.moved : ''].filter(Boolean).join(' · ')}</div>
  <div class="row between"><div>${isNew ? '' : ("<button type=\"button\" class=\"btn danger\" data-act=\"del\">" + tr("s239") + "</button>")}</div><div class="row"><button type="button" class="btn" data-act="close">${tr("s240")}</button><button class="btn pri">${tr("s241")}</button></div></div></form>`;
  $('#modal').hidden = false; hydrateAtt(); setTimeout(() => $('#edf [name=title]')?.focus(), 30);
}
function closeEd() { if (S.edit) { for (const id of (S.edit.saved ? S.edit.rm : S.edit.newAtt) || []) db.fileDel(id).catch(() => {}) } $('#modal').hidden = true; $('#modal').innerHTML = ''; S.edit = null; if (rec) { try { rec.stop() } catch (e) {} rec = null } scheduleRender() }
function mic(btn) {
  if (rec) { rec.stop(); return }
  const input = $('#edf [name=title]'), base = input.value ? input.value + ' ' : '';
  rec = new SR(); rec.lang = locale(); rec.interimResults = true; rec.continuous = true;
  rec.onresult = e => { let s = ''; for (const r of e.results) s += r[0].transcript; input.value = base + s };
  rec.onstart = () => btn.classList.add('on');
  rec.onend = () => { btn.classList.remove('on'); rec = null };
  rec.onerror = e => { toast(e.error === 'not-allowed' ? tr("s623") : tr("s624") + e.error) };
  try { rec.start() } catch (e) { toast(tr("s625")); rec = null }
}

/* ---------- render ---------- */
const formField = el => el?.matches('input,textarea,select');
const uncommitted = new WeakSet();
let pendingRender = false, renderTimer, committedField = null, pointer;

function scheduleRender() {
  if (!pendingRender || renderTimer !== undefined || pointer !== undefined) return;
  renderTimer = setTimeout(() => {
    renderTimer = undefined;
    const active = document.activeElement;
    if (S.edit || pointer !== undefined || (formField(active) && active !== committedField)) return;
    render(true);
  }, 0);
}
function requestRender(field) {
  pendingRender = true;
  if (field) committedField = field;
  scheduleRender();
}
document.addEventListener('blur', e => { if (formField(e.target)) scheduleRender() }, true);
// A blur during pointerdown must not replace the button before the ensuing click.
document.addEventListener('pointerdown', e => { if (e.isPrimary) pointer = e.pointerId }, true);
function releasePointer(e) {
  if (pointer === e.pointerId) { pointer = undefined; scheduleRender() }
}
window.addEventListener('pointerup', releasePointer, true);
window.addEventListener('pointercancel', releasePointer, true);
window.addEventListener('blur', () => { pointer = undefined; scheduleRender() });

function render(keepEdits = false) {
  pendingRender = false;
  committedField = null;
  clearTimeout(renderTimer);
  renderTimer = undefined;
  const m = $('#main'), active = document.activeElement, keep = focusSel(active);
  const selection = keep && formField(active)
    ? [active.selectionStart, active.selectionEnd, active.selectionDirection, active.scrollTop, active.scrollLeft] : [];
  const drafts = keepEdits ? [...m.querySelectorAll('input,textarea,select')]
    .filter(el => uncommitted.has(el)).map(el => [focusSel(el), el.value, el.checked]).filter(([key]) => key) : [];
  m.innerHTML = { plan: vPlan, alerts: vAlerts, tanks: vTanks, lube: vLube, log: vLog, rhrs: vRhrs, reefer: vReefer, pms: vPms, perf: vPerf, bwm: vBwm, sync: vSync, more: vMore, ...ENG.VIEWS, ...EQ.VIEWS, ...SHIP.VIEWS, ...PREVIEW.VIEWS }[S.view]?.() ?? vToday();
  decorateIcons(m, S.view);
  document.querySelectorAll('[data-v]').forEach(a => a.setAttribute('aria-current', a.dataset.v === S.view || (a.hasAttribute('data-more') && ['alerts', 'bwm', 'sync', 'log', 'rhrs', 'pms', 'perf', 'reefer', 'oil', 'dg', 'fuel', 'notes', 'lochart', 'equip'].includes(S.view)) ? 'page' : 'false'));
  const c = counts(), n = c.over + c.inbox + c.stale; document.querySelectorAll('[data-cnt]').forEach(x => { x.hidden = !n; x.textContent = n });
  const st = db.status;
  if (isBiolab()) {
    markTiles(m, S.view);
    m.insertAdjacentHTML('afterbegin', terminal(st, c.over));
  }
  $('#sfoot').textContent = { local: tr("s626"), idle: tr("s243"), syncing: tr("s244"), offline: tr("s627"), error: tr("s628") }[st.state];
  $('#sdot').style.background = { local: 'var(--mute)', idle: 'var(--green)', syncing: 'var(--blue)', offline: 'var(--acc)', error: 'var(--red)' }[st.state];
  $('#fab').hidden = !['today', 'plan', 'alerts'].includes(S.view);
  for (const [selector, value, checked] of drafts) {
    const el = m.querySelector(selector);
    if (el) {
      el.value = value;
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = checked;
      uncommitted.add(el);
    }
  }
  const focused = keep && m.querySelector(keep);
  if (focused) {
    focused.focus({ preventScroll: true });
    const [start, end, direction, top, left] = selection;
    if (Number.isInteger(start) && Number.isInteger(end) && typeof focused.selectionStart === 'number') {
      focused.setSelectionRange(start, end, direction || 'none');
    }
    if (Number.isInteger(top) && Number.isInteger(left)) {
      focused.scrollTop = top;
      focused.scrollLeft = left;
    }
  }
}
function focusSel(ae) {
  if (!ae || ae === document.body || !$('#main').contains(ae)) return null;
  const q = v => CSS.escape(v);
  if (ae.id) return '#' + q(ae.id);
  const d = ae.dataset || {};
  if (d.snd) return `[data-snd="${q(d.snd)}"]`;
  if (d.rob) return `[data-rob="${q(d.rob)}"][data-f="${q(d.f)}"]`;
  if (d.rf) return `[data-rf="${q(d.rf)}"]`;
  if (d.lo) return `[data-lo="${q(d.lo)}"]`;
  if (d.sc) return d.i != null ? `[data-sc="${q(d.sc)}"][data-i="${q(d.i)}"]` : `[data-sc="${q(d.sc)}"]`;
  if (d.clo !== undefined) return `[data-clo][name="${q(ae.name)}"]`;
  const f = ae.form;
  if (f?.id && ae.name) return `#${q(f.id)} [name="${q(ae.name)}"]${ae.type === 'radio' ? `[value="${q(ae.value)}"]` : ''}`;
  return null;
}
function route() {
  const h = location.hash.slice(1);
  const planFilter = h.startsWith('plan/') ? h.slice(5) : '';
  S.urgency = priorityLevels.includes(planFilter) ? planFilter : '';
  const taskFilter = h.startsWith(PRIORITY_ROUTE + '/') ? h.slice(PRIORITY_ROUTE.length + 1) : '';
  S.taskPriority = h === PRIORITY_ROUTE ? 'all' : taskFilter && PRIORITY_ORDER.includes(taskFilter) ? taskFilter : null;
  if (S.urgency || S.taskPriority !== null) {
    S.view = 'plan';
  } else if (h === 'equip/defects') {
    S.view = 'equip';
    S.eqTab = 'ts';
    S.eqSel = '';
  } else {
    S.view = VIEWS.includes(h) ? h : defaultView();
  }
  render(); window.scrollTo(0, 0);
}
addEventListener('hashchange', route);
matchMedia('(max-width:760px)').addEventListener('change', () => { if (S.view === 'plan') requestRender() });

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return; const a = el.dataset.act;
  if (ENG.onClick(a, el, e) || EQ.onClick(a, el, e)) return;
  if (a === 'language') {
    const saved = setLanguage(el.dataset.k);
    load();
    render();
    saved.then(() => toast(tr("language.saved")));
    return;
  }
  if (a === 'theme' || a === 'metal' || a === 'effects') {
    if (a === 'theme') appearance.setTheme(el.dataset.k);
    else if (a === 'metal') appearance.setMetal(el.dataset.k);
    else appearance.setEffects(el.dataset.k);
    render();
    return;
  }
  if (a === 'urgency-palette') {
    appearance.setUrgency(el.dataset.k);
    render();
    return;
  }
  if (a === 'urgency-filter') {
    const level = el.dataset.k;
    location.hash = S.urgency === level ? 'plan' : 'plan/' + level;
    return;
  }
  if (a === 'reply') {
    const task = S.tasks.get(el.closest('[data-id]').dataset.id);
    if (task) {
      const next = { ...task };
      if (next.reply === true) delete next.reply;
      else next.reply = true;
      saveTask(next, next.reply ? tr("s77") : tr("s629"), task);
    }
    return;
  }
  if (a === 'toggle') { e.stopPropagation(); toggle(el.closest('[data-id]').dataset.id); return }
  if (a === 'open') { openEd(el.dataset.id); return }
  if (a === 'mode') { S.mode = el.dataset.m; ls.set('mcv.mode', S.mode); render() }
  if (a === 'cat') { S.cat = el.dataset.c; render() }
  if (a === 'hide') { S.hideDone = el.checked; render() }
  if (a === 'wk') { const d = +el.dataset.d; S.off = d === 0 ? 0 : S.off + d; S.sel = d === 0 ? today() : null; render() }
  if (a === 'mo') { S.mOff += +el.dataset.d; render() }
  if (a === 'sel') { S.sel = el.dataset.d; render() }
  if (a === 'pickday') { const d = el.dataset.d; S.off = Math.floor(diff(d, today()) / 7); S.sel = d; S.mode = 'day'; ls.set('mcv.mode', 'day'); render() }
  if (a === 'accept') move(el.dataset.id, today(), 'todo');
  if (a === 'decline') { const t = S.tasks.get(el.dataset.id); if (t) { const p = { ...t }; t.status = 'dropped'; saveTask(t, tr("s630"), p) } }
  if (a === 'syncall') { if (!db.remoteConfig()) { toast(tr("s631")); return } db.syncNow().then(r => toast(tr("s632") + r.pulled + tr("s633") + r.pushed)).catch(e => toast(localizeError(e.message))); render() }
  if (a === 'close') closeEd();
  if (a === 'attopen') openAtt(el.dataset.k);
  if (a === 'attdel') delAtt(el.dataset.k);
  if (a === 'qd') { const f = $('#edf'); const v = el.dataset.d; f.day.value = v === 'x' ? '' : add(today(), +v) }
  if (a === 'del') { if (el.dataset.sure) { const t = S.tasks.get(S.edit.t.id); const p = { ...t }; t.status = 'dropped'; closeEd(); saveTask(t, tr("s634"), p) } else { el.dataset.sure = '1'; el.textContent = tr("s635") } }
  if (a === 'mic' && SR) mic(el);
  if (a === 'ltab') { S.lubeTab = el.dataset.t; render() }
  if (a === 'ttab') { S.tankTab = el.dataset.t; render() }
  if (a === 'rhedit') openRh(el.dataset.g, +el.dataset.i);
  if (a === 'rhgo') { e.preventDefault(); document.getElementById('g-' + el.dataset.g)?.scrollIntoView({ behavior: 'smooth' }) }
  if (a === 'rfsea') { S.rfDraft.sw = db.get('perf/meta').last.sea; saveDraft('meta/reefer', S.rfDraft, 0); render() }
  if (a === 'pmds') { S.pmDs = el.dataset.c; S.pmMore = 80; render() }
  if (a === 'pmfree') { S.pmFree = el.checked; render() }
  if (a === 'pmmore') { S.pmMore += 200; render() }
  if (a === 'pmadd') { const j = pmsJobs().find(x => x.no === el.dataset.no); if (j) { const t = { id: 't-pms-' + j.no.replace(/\D/g, ''), title: j.title, note: `PMS ${j.no} · ${j.eq} · ${j.freq}`, cat: 'PMS', prio: j.ds === 'Overdue' ? 1 : 2, owner: j.resp, due: j.due, day: j.due && j.due > today() ? j.due : today(), status: 'todo', source: 'Workboard', pms: [{ no: j.no, ds: j.ds, js: j.js, due: j.due }], created: today() }; saveTask(t, tr("s636") + dshort(t.day), { id: t.id, _new: true }) } }
  if (a === 'pfg') { S.pfG = el.dataset.g; render() }
  if (a === 'bwall') { S.bwAll = true; render() }
  if (a === 'bwm') { S.bwM = el.dataset.m; render() }
  if (a === 'bwday') { S.bwDay = el.dataset.m; render(); if (S.bwDay) setTimeout(() => document.querySelector('[data-act=bwday][data-m=""]')?.scrollIntoView({ block: 'center' }), 50) }
  if (a === 'lgtab') { S.logTab = el.dataset.t; S.lgMore = 100; S.lgQ = ''; S.lgYear = null; render() }
  if (a === 'lgcode') { S.lgCode = el.dataset.c; S.lgMore = 100; render() }
  if (a === 'lgmore') { S.lgMore += 200; render() }
  if (a === 'scsave') { const D = S.scDraft, n = v => v === '' || v == null ? null : +v;
    if (!D.date) { toast(tr("s637")); return } const fe = D.fe.map(n), bn = D.bn.map(n);
    if (fe.every(v => v == null) && bn.every(v => v == null)) { toast(tr("s638")); return }
    const id = D.date + 'T' + (D.time || '').replace(':', ''), old = db.get('scrape/' + id);
    put('scrape/' + id, { date: D.date, time: D.time, rh: n(D.rh), fe, bn, remarks: D.remarks, by: orig("s58") }).then(() => { if (!document.activeElement?.dataset.sc) S.scDraft = null; requestRender(); toast(old ? tr("s639") + dlong(D.date) + ' ' + D.time + tr("s640") : tr("s641")) });
    const lim = db.get('meta/scrapelimits') || {}, hi = lim.feMax ? fe.map((v, i) => v > lim.feMax ? tr("s642") + (i + 1) + ' Fe ' + v : '').filter(Boolean) : [];
    feed('Scrape-down ' + dlong(D.date) + tr("s643") + num(avg(fe), 0) + ' ppm' + (hi.length ? tr("s644") + hi.join(', ') : '')) }
  if (a === 'scopen') { const r = db.get('scrape/' + el.dataset.rid); if (r) { S.scDraft = { date: r.date, time: r.time || '', rh: r.rh ?? '', fe: r.fe.map(v => v ?? ''), bn: r.bn.map(v => v ?? ''), remarks: r.remarks || '' }; render(); scrollTo(0, 0); toast(tr("s645")) } }
  if (a === 'sday') { S.sDate = add(S.sDate || today(), +el.dataset.d); render() }
  if (a === 'tday') { S.sDate = el.dataset.d; S.tankTab = 'daily'; render(); scrollTo(0, 0) }
  if (a === 'tmo') { S.tmOff += +el.dataset.d; render() }
  if (a === 'tmu') { S.tmUnit = el.dataset.u; render() }
  if (a === 'tmcsv') monthCSV();
  if (a === 'ssave') { const draft = S.sDraft, { _date, ...raw } = draft, vals = { ...raw }; for (const k in vals) if (vals[k] === '') delete vals[k]; else vals[k] = +vals[k];
    put('soundings/' + _date, { values: vals, by: orig("s58"), at: new Date().toISOString() }).then(() => { if (S.sDraft === draft && !soundingsDirty(draft, { values: raw })) S.sDraft = { _date, ...vals }; requestRender(); toast(tr("s646") + dlong(_date) + tr("s647")) }) }
  if (a === 'robsave') { const I = robInputs(), r = T.computeROB(foMeta(), foCal(), I), id = I.date + '-' + Date.now().toString(36);
    const tanks = {}; for (const [k, v] of Object.entries(I.tanks)) if (v && (v.value !== '' && v.value != null || v.density !== '' || v.temp !== '')) tanks[k] = v;
    put('rob/' + id, { date: I.date, place: I.place, event: I.event, fwd: I.fwd, aft: I.aft, logHfo: I.logHfo, logDo: I.logDo, tanks, trim: r.trim, sum: r.sum }).then(() => { requestRender(); toast(tr("s648")) });
    feed(`${tr("s649", {0: (I.event), 1: (num(r.sum.HFO.t, 1)), 2: (num(r.sum.DO.t, 1))})}`) }
  if (a === 'robopen') { const h = db.get('rob/' + el.dataset.rid); if (h) { S.robDraft = { date: h.date, place: h.place || '', event: h.event || 'Quantity check', fwd: h.fwd, aft: h.aft, logHfo: h.logHfo || '', logDo: h.logDo || '', tanks: JSON.parse(JSON.stringify(h.tanks || {})) }; render(); scrollTo(0, 0); toast(tr("s650") + dlong(h.date) + tr("s651")) } }
  if (a === 'rowadd') openRow(el.dataset.col);
  if (a === 'rowedit') openRow(el.dataset.col, el.dataset.rid);
  if (a === 'rowdel') { if (el.dataset.sure) { const p = S.edit.col + '/' + S.edit.rid, body = db.get(p); closeEd(); db.del(p).then(() => { requestRender(); toast(tr("s634"), { _row: p, body }) }) } else { el.dataset.sure = '1'; el.textContent = tr("s635") } }
  if (a === 'export') { const b = new Blob([JSON.stringify(db.exportAll())], { type: 'application/json' }); const u = URL.createObjectURL(b); const l = document.createElement('a'); l.href = u; l.download = 'mcv-workbench-' + today() + '.json'; l.click(); setTimeout(() => URL.revokeObjectURL(u), 2000) }
  if (a === 'unlink') { db.setRemote(null).then(() => { requestRender(); toast(tr("s652")) }) }
  if (a === 'gencode') { const b = crypto.getRandomValues(new Uint8Array(24)); const field = $('#remf [name=space]'); uncommitted.add(field); field.value = 'mcv-' + [...b].map(x => x.toString(36).padStart(2, '0')).join('').slice(0, 36); toast(tr("s653")) }
  if (a === 'update') { if (!S.reg) { location.reload(); return } toast(tr("s654")); S.reg.update().then(() => { if (!S.reg.installing && !S.reg.waiting) toast(tr("s655") + VERSION) }).catch(() => toast(tr("s656"))) }
  if (a === 'install' && S.install) { S.install.prompt(); S.install = null }
});
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeEd() });
addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeEd() });
const searchFields = { q: 'q', pmq: 'pmQ', lgq: 'lgQ' };
function updateInput(field) {
  const { id, value, dataset: ds, name, form } = field;
  if (Object.hasOwn(searchFields, id)) {
    S[searchFields[id]] = value;
    if (id === 'pmq') S.pmMore = 80;
    if (id === 'lgq') S.lgMore = 100;
  } else if (ds.snd) {
    S.sDraft[ds.snd] = value;
    const dirty = soundingsDirty(S.sDraft, db.get('soundings/' + S.sDraft._date));
    const button = $('[data-act="ssave"]');
    button.disabled = !dirty;
    button.previousElementSibling.textContent = dirty ? tr("s305") : tr("s306");
  } else if (ds.rob) {
    (robInputs().tanks[ds.rob] ||= {})[ds.f] = value;
  } else if (form?.id === 'robh') {
    robInputs()[name] = value;
  } else if (ds.rf) {
    if (S.rfDraft[ds.rf] !== value) {
      S.rfDraft[ds.rf] = value;
      saveDraft('meta/reefer', S.rfDraft, 300);
    }
  } else if (ds.lo) {
    const p = lubeOrderState(), [a, b] = ds.lo.split('.');
    const target = b ? p[a] : p, key = b || a;
    if (target[key] !== value) {
      target[key] = value;
      saveDraft('meta/lubeorder', p, 300);
    }
  } else if (ds.clo !== undefined) {
    const p = cloState();
    if (p[name] !== value) {
      p[name] = value;
      S.cloDraft = p;
      saveDraft('meta/clo', p, 250, 'cloDraft');
    }
  } else {
    return false;
  }
  return true;
}
document.addEventListener('input', e => {
  committedField = null;
  const colorIndex = e.target.dataset.urgencyColor;
  if (colorIndex !== undefined) {
    appearance.setUrgency('custom', Number(colorIndex), e.target.value);
    $('#palette-custom .palette-samples').children[Number(colorIndex)].style.setProperty('--u-color', e.target.value);
    return;
  }
  if (ENG.onInput(e) || EQ.onInput(e)) return;
  if (updateInput(e.target)) return;
  const ds = e.target.dataset || {};
  if (ds.sc) { const D = S.scDraft; if (ds.i != null) D[ds.sc][+ds.i] = e.target.value; else D[ds.sc] = e.target.value }
  else if (formField(e.target) && e.target.form && e.target.type !== 'file') uncommitted.add(e.target);
});
document.addEventListener('change', e => {
  const field = e.target;
  if (ENG.onChange?.(e) || EQ.onChange?.(e) || updateInput(field)) { requestRender(field); return }
  const { id, value } = field;
  if (id === 'pmresp') S.pmResp = value;
  else if (id === 'bwfrom') S.bwFrom = value;
  else if (id === 'lgyear') { S.lgYear = value; S.lgMore = 100 }
  else if (id === 'sdate' && value) S.sDate = value;
  else {
    if (id === 'impf' && field.files[0]) field.files[0].text().then(t => db.importAll(JSON.parse(t))).then(n => { toast(tr("s657") + n) }).catch(x => toast(localizeError(x.message)));
    return;
  }
  requestRender(field);
});
document.addEventListener('submit', e => {
  e.preventDefault(); const id = e.target.id, f = new FormData(e.target);
  for (const field of e.target.elements) uncommitted.delete(field);
  if (ENG.onSubmit(id, f) || EQ.onSubmit(id, f)) return;
  if (id === 'edf' && S.edit) { const t = { ...S.edit.t }, prev = S.edit.isNew ? { id: t.id, _new: true } : { ...S.tasks.get(t.id) };
    for (const k of ['title', 'cat', 'day', 'due', 'slot', 'status', 'waiting', 'owner', 'repeat', 'note']) t[k] = String(f.get(k) || '').trim();
    if (f.has('reply')) t.reply = true; else delete t.reply;
    const color = taskColor(f.get('color'));
    if (color) t.color = color; else delete t.color;
    const legacy = +f.get('prio');
    if (legacy !== (Number(t.prio) || 3)) t.prio = legacy;
    const priority = f.get('pri');
    if (priority !== taskPriority(t) && typeof priority === 'string' && Object.hasOwn(TASK_PRIORITIES, priority)) {
      t.pri = priority;
    }
    if (!t.att || !t.att.length) delete t.att;
    if (!t.title) return; if (t.status === 'done' && !t.doneAt) t.doneAt = today();
    const nw = S.edit.isNew; S.edit.saved = true; closeEd(); saveTask(t, nw ? tr("s658") : tr("s298"), prev); if (nw) feed(tr("s659") + t.title) }
  if (id === 'rowf' && S.edit) { const body = {}; for (const [k, v] of f.entries()) if (String(v).trim() !== '') body[k] = String(v).trim();
    const p = S.edit.col + '/' + S.edit.rid; body.updatedBy = orig("s58"); closeEd(); put(p, body).then(() => { requestRender(); toast(tr("s298")) }) }
  if (id === 'rhf') { const v = +f.get('rh'); if (!v) return; const cur = db.get('rhrs-meta/current'); if (cur && v < cur.rh) { toast(tr("s660") + cur.rh + tr("s661")); return }
    put('rhrs-meta/current', { rh: v, date: today(), by: orig("s58") }); put('rhrslog/' + today(), { rh: v, date: today() }).then(() => requestRender()); toast(tr("s662") + num(v, 0) + tr("s663")) }
  if (id === 'rhrow' && S.edit && S.edit.rh) { const g = JSON.parse(JSON.stringify(db.get('rhrs/' + S.edit.gid))), r = g.rows[S.edit.i];
    for (const [k, v] of f.entries()) { if (k === '_interval') { if (v) g.interval = +v; continue } if (k === '_pid') { r.id = v; continue } r[k] = ['rhInst', 'prior', 'own'].includes(k) ? (v === '' ? null : +v) : v }
    const gid = S.edit.gid; delete g.id; closeEd(); put('rhrs/' + gid, g).then(() => { requestRender(); toast(tr("s664") + g.title + ' · ' + r.pos) }) }
  if (id === 'bwlimf') { const v = f.get('dev'); put('meta/bwmlimits', v ? { dev: +v } : {}).then(() => requestRender()); toast(tr("s665")) }
  if (id === 'limf') { const l = {}; for (const [k, v] of f.entries()) if (v !== '') l[k] = +v; put('meta/scrapelimits', l).then(() => requestRender()); toast(tr("s666")) }
  if (id === 'setf') { const s = { ...S.settings }; for (const [k, v] of f.entries()) s[k] = k === 'dayLimit' ? Number(v) || 8 : String(v); S.settings = s; put('meta/settings', s).then(() => requestRender()); toast(tr("s667")) }
  if (id === 'remf') { const cfg = Object.fromEntries(f.entries()); if ((cfg.space || '').trim().length < 24) { toast(tr("s668")); return } toast(tr("s669")); db.setRemote(cfg).then(r => { requestRender(); toast(r && r.pulled !== undefined ? tr("s670") + r.pulled + tr("s633") + r.pushed : tr("s298")) }).catch(x => { requestRender(); toast(localizeError(x.message)) }) }
  if (id === 'edf' || id === 'rowf') return;
});
$('#fab').addEventListener('click', () => openEd(null, S.view === 'plan' && S.mode === 'day' ? S.sel : today()));
/* drag & drop */
let dragId = null;
document.addEventListener('dragstart', e => { const c = e.target.closest && e.target.closest('.t[draggable=true]'); if (c) { dragId = c.dataset.id; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragId) } catch (x) {} } });
document.addEventListener('dragover', e => { const c = e.target.closest && e.target.closest('[data-drop]'); if (c && dragId && c.dataset.drop !== 'over') { e.preventDefault(); c.classList.add('drop') } });
document.addEventListener('dragleave', e => { const c = e.target.closest && e.target.closest('[data-drop]'); if (c) c.classList.remove('drop') });
document.addEventListener('drop', e => { const c = e.target.closest && e.target.closest('[data-drop]'); if (!c || !dragId) return; e.preventDefault(); c.classList.remove('drop');
  const k = c.dataset.drop, id = dragId; dragId = null;
  if (k === 'inbox') move(id, undefined, 'inbox'); else if (k === 'nodate') move(id, ''); else if (k.startsWith('st:')) move(id, undefined, k.slice(3)); else if (/^\d{4}-/.test(k)) move(id, k) });
addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.install = e; if (S.view === 'sync') requestRender() });

decorateIcons(document.querySelector('.side'), 'more');
decorateIcons(document.querySelector('.bottom'), 'more');
decorateIcons(document.body, 'more');
const modal = $('#modal');
new MutationObserver(() => decorateIcons(modal, S.view)).observe(modal, { childList: true, subtree: true });

/* ---------- start ---------- */
(async () => {
  try {
    const initialize = async () => {
      await db.init();
      await loadLanguage();
      await db.seedIfEmpty('data/seed.json');
    };
    if (navigator.locks) await navigator.locks.request('mcv-initialize', initialize);
    else await initialize();
  } catch (e) {
    $('#main').innerHTML = `<div class="banner red">${tr("s671", {0: (esc(localizeError(e.message)))})}</div>`;
    document.documentElement.dataset.appReady = 'error';
    return;
  }
  load(); S.loaded = true;
  db.on(() => { load(); requestRender() });
  route(); rollover();
  // Align the UTC display with minute boundaries without re-rendering the active screen.
  setTimeout(() => {
    updateClock();
    setInterval(updateClock, 60000);
  }, 60000 - Date.now() % 60000);
  document.documentElement.dataset.appReady = 'true';
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => { S.reg = r; setInterval(() => r.update().catch(() => {}), 30 * 60000) }).catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !S.edit) toast(tr("s672"), null) || setTimeout(() => { if (!S.edit && !formField(document.activeElement)) location.reload() }, 600) });
  }
})();
