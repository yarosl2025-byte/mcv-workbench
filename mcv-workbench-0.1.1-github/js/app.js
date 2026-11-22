import * as db from './store.js';
import * as CLO from './clo.js';
import * as T from './tanks.js';
import * as RR from './rhrs.js';
import * as ENG from './eng.js';
import * as EQ from './equip.js';

const VERSION = '0.6.0';
const CATS = ['Док', 'PMS', 'ABS', 'Заказы', 'Офис', 'Текущие', 'IT', 'Logbook', 'Отчёты', 'Почта'];
const ST = { inbox: 'Входящие', todo: 'Нужно сделать', doing: 'В работе', wait: 'Ждём', done: 'Готово' };
const SLOTS = { '': 'Без времени', am: 'Утро', noon: 'До обеда', pm: 'После обеда', eve: 'Вечер' };
const REP = { '': 'Нет', daily: 'Каждый день', weekly: 'Каждую неделю', monthly: 'Каждый месяц' };
const DOW = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MON1 = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const VIEWS = ['today', 'plan', 'alerts', 'pms', 'rhrs', 'perf', 'tanks', 'lube', 'reefer', 'log', 'bwm', 'oil', 'dg', 'fuel', 'notes', 'lochart', 'equip', 'sync', 'more'];

const S = { tasks: new Map(), sources: [], feed: [], settings: {}, loaded: false,
  view: 'today', mode: 'week', off: 0, sel: null, cat: '', q: '', hideDone: true, mOff: 0, rolled: false, edit: null, undo: null,
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
const dlong = s => { const d = parse(s); return d.getDate() + ' ' + MON[d.getMonth()] };
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m == 1 && h != 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c };
const num = (x, d = 2) => x == null || isNaN(x) ? '—' : Number(x).toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });
const ls = { get(k) { try { return localStorage.getItem(k) } catch (e) { return null } }, set(k, v) { try { localStorage.setItem(k, v) } catch (e) {} } };
const narrow = () => matchMedia('(max-width:760px)').matches;
S.mode = ls.get('mcv.mode') || 'week';
const live = () => [...S.tasks.values()].filter(t => t.status !== 'dropped');
const isOver = t => t.status !== 'done' && t.status !== 'inbox' && t.due && t.due < today() && (!t.day || t.day <= today());
const match = t => (!S.cat || t.cat === S.cat) && (!S.q || (t.title + ' ' + (t.note || '') + ' ' + (t.owner || '')).toLowerCase().includes(S.q.toLowerCase()));
const limit = () => Number(S.settings.dayLimit) || 8;
const uid = p => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
EQ.init({ S, render: () => render(), toast: (m, p) => toast(m, p), put: (a, b) => put(a, b) });
ENG.init({ S, render: () => render(), toast: (m, p) => toast(m, p), put: (a, b) => put(a, b), feed: t => feed(t), openTask: (title, note) => { openEd(null); const f = $('#edf'); if (f) { f.title.value = title; f.note.value = note } } });

/* ---------- data ---------- */
function load() {
  S.tasks = new Map(db.all('tasks').map(t => [t.id, t]));
  S.sources = db.all('sources');
  S.feed = db.all('feed').sort((a, b) => (b.at || '').localeCompare(a.at || '')).slice(0, 40);
  S.settings = db.get('meta/settings') || {};
  const vs = db.get('cal/clo-vessel'); if (vs && vs.name) $('#brandsub').textContent = vs.name + ' · СМ';
}
function put(path, body) { return db.set(path, body).catch(e => toast('Не сохранилось: ' + (e.message || e))) }
function saveTask(t, msg, prev) { t.updated = new Date().toISOString(); S.tasks.set(t.id, t); put('tasks/' + t.id, strip(t)); render(); if (msg) toast(msg, prev) }
const strip = o => { const { id, ...r } = o; return r };
function feed(text) { const id = uid('f'); const f = { text, at: new Date().toISOString(), by: 'Ярослав' }; S.feed.unshift({ id, ...f }); put('feed/' + id, f) }

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
  saveTask(t, t.status === 'done' ? 'Готово: ' + t.title : 'Снова в работе', prev);
}
function move(id, day, status) { const t = S.tasks.get(id); if (!t) return; const prev = { ...t };
  if (day !== undefined) { if (t.day && day && day > t.day && t.status !== 'inbox') t.moved = (t.moved || 0) + 1; t.day = day }
  if (status) t.status = status; else if (t.status === 'inbox') t.status = 'todo';
  saveTask(t, day ? 'Перенесено на ' + dshort(day) : day === '' ? 'Без даты' : 'Статус: ' + ST[t.status], prev) }
function rollover() {
  if (S.rolled) return; S.rolled = true; const td = today(); let n = 0;
  for (const t of live()) if (t.status !== 'done' && t.status !== 'inbox' && t.day && t.day < td && (!t.due || t.due >= td)) { t.day = td; t.moved = (t.moved || 0) + 1; put('tasks/' + t.id, strip(t)); n++ }
  if (n) { feed('Перенесено на сегодня ' + n + ' ' + plural(n, 'незакрытая задача', 'незакрытые задачи', 'незакрытых задач')); render() }
}

/* ---------- pieces ---------- */
function card(t, opt = {}) {
  const o = isOver(t), soon = !o && t.status !== 'done' && t.due && diff(t.due, today()) <= 2;
  return `<div class="t${t.status === 'done' ? ' done' : ''}" draggable="${!!opt.drag}" data-id="${esc(t.id)}" data-act="open">
  <input type="checkbox" aria-label="Готово" data-act="toggle" ${t.status === 'done' ? 'checked' : ''}>
  <div class="tb"><span class="tt">${esc(t.title)}</span><span class="meta">
  <span class="tag ${esc(t.cat)}">${esc(t.cat)}</span>${t.prio == 1 ? '<span class="tag p1">P1</span>' : ''}
  ${o ? `<span class="tag warn">просрочено ${diff(today(), t.due)} дн.</span>` : soon ? `<span class="tag warn">срок ${dlong(t.due)}</span>` : t.due && opt.showDue ? `<span class="small">срок ${dlong(t.due)}</span>` : ''}
  ${t.moved >= 2 ? `<span class="small">перенесено ×${t.moved}</span>` : ''}${t.status === 'wait' ? `<span class="small">ждём${t.waiting ? ': ' + esc(t.waiting) : ''}</span>` : ''}
  ${t.repeat ? `<span class="small">повтор</span>` : ''}${t.pmsClosed && t.status !== 'done' ? '<span class="tag" style="color:var(--blue)">нет в PMS — закрыта?</span>' : t.pms && t.pms.some(p => p.ds === 'Overdue') ? '<span class="tag warn">PMS просрочена</span>' : ''}${opt.day && t.day ? `<span class="small">${dshort(t.day)}</span>` : ''}</span></div></div>`;
}
const listOf = (arr, opt) => arr.length ? arr.map(t => card(t, opt)).join('') : '<div class="empty">Пусто</div>';
const byPrio = (a, b) => (a.prio || 3) - (b.prio || 3) || (a.due || '9').localeCompare(b.due || '9');
function counts() { const td = today(), L = live();
  return { today: L.filter(t => t.day === td && t.status !== 'done' && t.status !== 'inbox').length, over: L.filter(isOver).length,
    inbox: L.filter(t => t.status === 'inbox').length, stale: S.sources.filter(s => staleDays(s) > 0).length } }
function staleDays(s) { if (!s.last) return 0; return diff(today(), s.last) - (Number(s.norm) || 0) }
function cdown(date, name, label) { if (!date) return ''; const n = diff(date, today());
  return `<div class="card"><div class="lbl">${esc(label)}</div><div class="big" style="color:var(--acc)">${n >= 0 ? n + ' ' + plural(n, 'день', 'дня', 'дней') : 'идёт'}</div><div class="lbl">${esc(name || '')} · ${dlong(date)}</div></div>` }

/* ---------- Сегодня ---------- */
function vToday() {
  const td = today(), c = counts(), L = live();
  const mine = L.filter(t => t.day === td && t.status !== 'inbox').sort(byPrio);
  const over = L.filter(isOver).sort((a, b) => a.due.localeCompare(b.due));
  const soon = L.filter(t => t.status !== 'done' && t.due && t.due > td && diff(t.due, td) <= 3 && t.day !== td).sort((a, b) => a.due.localeCompare(b.due));
  const d = new Date();
  const stat = (href, n, lbl, col) => `<a class="stat" href="${href}"><b style="color:${n ? col : 'inherit'}">${n}</b><span class="lbl">${lbl}</span></a>`;
  return `<div><div class="sub">${['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'][d.getDay()]}, ${dlong(td)}</div><h1>Сегодня</h1></div>
  ${!S.tasks.size ? `<a class="banner" href="#sync">Данных пока нет. Открой «Синхронизация»: подключи облачную базу или загрузи файл копии — задачи, настройки и источники появятся.</a>` : ''}
  <div class="grid2">${cdown(S.settings.dockDate, S.settings.dockName, 'До дока')}${cdown(S.settings.absDate, S.settings.absName, 'ABS')}</div>
  <div class="grid4">${stat('#plan', c.today, 'на сегодня', 'inherit')}${stat('#alerts', c.over, 'просрочено', 'var(--red)')}${stat('#alerts', c.inbox, 'во входящих', 'var(--blue)')}${stat('#sync', c.stale, 'источники устарели', 'var(--acc)')}</div>
  <section class="card"><div class="row between"><h2>План на сегодня</h2><span class="sub">${mine.filter(t => t.status !== 'done').length} / ${limit()}</span></div><div class="list mt">${listOf(mine, { showDue: true })}</div></section>
  ${over.length ? `<section class="card"><div class="row between"><h2 style="color:var(--red)">Просрочено · ${over.length}</h2><a href="#alerts" class="sub">все</a></div><div class="list mt">${listOf(over.slice(0, 6), {})}</div></section>` : ''}
  <section class="card"><h2>Сроки в ближайшие 3 дня</h2><div class="list mt">${listOf(soon.slice(0, 8), { day: true })}</div></section>
  <section class="card feed"><h2 style="margin-bottom:6px">Что нового</h2>${S.feed.slice(0, 6).map(f => `<div><span>${esc(f.text)}</span><time>${f.at ? dshort(f.at.slice(0, 10)) : ''}</time></div>`).join('') || '<div class="empty">Пока ничего</div>'}</section>`;
}

/* ---------- Планировщик ---------- */
function toolbar() {
  return `<div class="row between"><div><h1>Планировщик</h1><div class="sub">${narrow() ? 'Нажми на задачу, чтобы перенести её на другой день' : S.mode === 'month' ? 'Нажми на день, чтобы открыть его' : 'Перетащи карточку на другой день, чтобы перенести'}</div></div>
  <div class="seg" role="group" aria-label="Вид">${[['week', 'Неделя'], ['status', 'Статусы'], ['day', 'День'], ['month', 'Месяц']].map(([k, v]) => `<button data-act="mode" data-m="${k}" aria-pressed="${S.mode === k}">${v}</button>`).join('')}</div></div>
  <div class="row between"><div class="chips">${['', ...CATS.slice(0, 7)].map(c => `<button class="chip" data-act="cat" data-c="${c}" aria-pressed="${S.cat === c}">${c || 'Все'}</button>`).join('')}</div>
  <div class="row"><input class="search" id="q" type="search" placeholder="Поиск по задачам" value="${esc(S.q)}" aria-label="Поиск"><label class="sub"><input type="checkbox" data-act="hide" ${S.hideDone ? 'checked' : ''}> скрыть готовые</label></div></div>`;
}
function weekDays() { const s = add(today(), S.off * 7); return [...Array(7)].map((_, i) => add(s, i)) }
function vPlan() {
  const L = live().filter(match).filter(t => !(S.hideDone && t.status === 'done' && t.day !== today()));
  let body = '';
  if (S.mode === 'week' && !narrow()) {
    const days = weekDays(), td = today();
    const col = (key, title, cls, arr, sub) => `<section class="col ${cls}" data-drop="${key}"><div class="ch"><b>${title}</b><small>${sub ?? arr.length}</small></div>${arr.sort(byPrio).map(t => card(t, { drag: true })).join('') || '<div class="empty">—</div>'}</section>`;
    const cols = [];
    if (S.off === 0) { cols.push(col('inbox', 'Входящие', 'inbox', L.filter(t => t.status === 'inbox'))); cols.push(col('over', 'Просрочено', 'over', L.filter(isOver))) }
    for (const d of days) { const a = L.filter(t => t.day === d && t.status !== 'inbox' && !isOver(t)); const open = a.filter(t => t.status !== 'done').length;
      cols.push(col(d, dshort(d) + (d === td ? ' · сегодня' : ''), (d === td ? 'today' : '') + (open > limit() ? ' full' : ''), a, open + ' / ' + limit())) }
    cols.push(col('nodate', 'Без даты', 'nod', L.filter(t => !t.day && t.status !== 'inbox' && !isOver(t))));
    body = `<div class="row"><button class="btn" data-act="wk" data-d="-1" aria-label="Предыдущая неделя">←</button><button class="btn" data-act="wk" data-d="0">Сегодня</button><button class="btn" data-act="wk" data-d="1" aria-label="Следующая неделя">→</button><span class="sub">${dlong(days[0])} — ${dlong(days[6])}</span></div><div class="board"><div class="cols">${cols.join('')}</div></div>`;
  } else if (S.mode === 'status') {
    body = `<div class="board"><div class="cols">${['inbox', 'todo', 'doing', 'wait', 'done'].map(k => { const a = L.filter(t => t.status === k).sort(byPrio); return `<section class="col ${k === 'inbox' ? 'inbox' : ''}" data-drop="st:${k}"><div class="ch"><b>${ST[k]}</b><small>${a.length}</small></div>${a.slice(0, 80).map(t => card(t, { drag: true, day: true })).join('') || '<div class="empty">—</div>'}${a.length > 80 ? `<div class="empty">ещё ${a.length - 80}</div>` : ''}</section>` }).join('')}</div></div>`;
  } else if (S.mode === 'month') {
    const base = parse(today()); base.setDate(1); base.setMonth(base.getMonth() + S.mOff);
    const start = add(iso(base), -((base.getDay() + 6) % 7)), m = base.getMonth();
    const cells = [...Array(42)].map((_, i) => add(start, i));
    body = `<div class="row"><button class="btn" data-act="mo" data-d="-1" aria-label="Предыдущий месяц">←</button><b>${MON1[m]} ${base.getFullYear()}</b><button class="btn" data-act="mo" data-d="1" aria-label="Следующий месяц">→</button></div>
    <div class="month">${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(x => `<div class="dn">${x}</div>`).join('')}${cells.map(d => { const a = L.filter(t => t.day === d && t.status !== 'done'); const ev = [S.settings.dockDate === d ? 'Док' : '', S.settings.absDate === d ? 'ABS' : ''].filter(Boolean).join(' · ');
      return `<button class="mc${parse(d).getMonth() !== m ? ' out' : ''}${d === today() ? ' now' : ''}" data-act="pickday" data-d="${d}"><b>${parse(d).getDate()}</b>${ev ? `<em>${ev}</em>` : ''}${a.slice(0, 2).map(t => `<span>${esc(t.title)}</span>`).join('')}${a.length > 2 ? `<span>+${a.length - 2}</span>` : ''}</button>` }).join('')}</div>`;
  } else {
    const days = weekDays(), sel = S.sel && days.includes(S.sel) ? S.sel : days[0]; S.sel = sel;
    const a = L.filter(t => t.day === sel && t.status !== 'inbox' && !isOver(t)), inb = L.filter(t => t.status === 'inbox'), ov = L.filter(isOver);
    body = `<div class="strip">${days.map(d => { const n = L.filter(t => t.day === d && t.status !== 'done' && t.status !== 'inbox').length; return `<button data-act="sel" data-d="${d}" aria-pressed="${d === sel}">${DOW[parse(d).getDay()]}<b style="display:block;font-size:17px">${parse(d).getDate()}</b><small>${n}</small></button>` }).join('')}</div>
    <div class="row"><button class="btn" data-act="wk" data-d="-1" aria-label="Неделя назад">←</button><button class="btn" data-act="wk" data-d="0">Сегодня</button><button class="btn" data-act="wk" data-d="1" aria-label="Неделя вперёд">→</button></div>
    ${sel === today() && inb.length ? `<a class="banner" href="#alerts">Входящие · ${inb.length} — разобрать</a>` : ''}
    ${sel === today() && ov.length ? `<a class="banner red" href="#alerts">Просрочено: ${ov.length} — открыть список</a>` : ''}
    ${Object.entries(SLOTS).map(([k, v]) => { const b = a.filter(t => (t.slot || '') === k).sort(byPrio); return b.length ? `<div class="slot"><h3>${v}</h3><div class="list">${b.map(t => card(t, {})).join('')}</div></div>` : '' }).join('') || '<div class="empty">На этот день задач нет. Нажми «+», чтобы добавить.</div>'}
    ${(() => { const w = L.filter(t => t.status === 'wait'); return w.length ? `<section class="card"><h2>Ждём от других</h2><div class="list mt">${w.map(t => card(t, { day: true })).join('')}</div></section>` : '' })()}`;
  }
  return toolbar() + body;
}

/* ---------- Уведомления ---------- */
function vAlerts() {
  const td = today(), L = live();
  const inb = L.filter(t => t.status === 'inbox'), ov = L.filter(isOver).sort((a, b) => a.due.localeCompare(b.due));
  const soon = L.filter(t => t.status !== 'done' && !isOver(t) && t.due && diff(t.due, td) >= 0 && diff(t.due, td) <= 2).sort((a, b) => a.due.localeCompare(b.due));
  const mv = L.filter(t => t.status !== 'done' && (t.moved || 0) >= 3), st = S.sources.filter(s => staleDays(s) > 0);
  const sec = (title, body, n, color) => `<section class="card"><div class="row between"><h2${color ? ` style="color:${color}"` : ''}>${title}</h2><span class="sub">${n}</span></div><div class="list mt">${body}</div></section>`;
  return `<div><h1>Уведомления</h1><div class="sub">Сроки, застрявшие задачи и устаревшие источники</div></div>
  ${sec('Входящие — разобрать', inb.map(t => `<div class="row" style="align-items:stretch"><div style="flex:1">${card(t, {})}</div><div class="row"><button class="btn pri" data-act="accept" data-id="${esc(t.id)}">На сегодня</button><button class="btn" data-act="decline" data-id="${esc(t.id)}">Отклонить</button></div></div>`).join('') || '<div class="empty">Нечего разбирать</div>', inb.length, 'var(--blue)')}
  ${sec('Просрочено', listOf(ov, {}), ov.length, 'var(--red)')}
  ${sec('Срок в ближайшие 2 дня', listOf(soon, { day: true }), soon.length)}
  ${sec('Источники устарели', st.map(s => `<a class="t" href="#sync"><div class="tb"><span class="tt">${esc(s.name)}</span><span class="small">обновлён ${s.last ? dlong(s.last) : '—'} · ${esc(s.how || '')}</span></div></a>`).join('') || '<div class="empty">Все источники свежие</div>', st.length, 'var(--acc)')}
  ${(() => { const cl = L.filter(t => t.pmsClosed && t.status !== 'done'); return cl.length ? sec('Нет в PMS Workboard — вероятно, уже закрыты', listOf(cl, { day: true }), cl.length, 'var(--blue)') : '' })()}
  ${mv.length ? sec('Переносится уже 3 раза и больше', listOf(mv, { day: true }), mv.length) : ''}`;
}

/* ---------- Бункер и масло ---------- */
const TABLES = {
  bunker: { title: 'Бункеровки', add: 'Добавить бункеровку', sort: (a, b) => (b.date || '').localeCompare(a.date || ''), fields: [
    ['date', 'Дата', 'date'], ['port', 'Порт'], ['grade', 'Сорт', 'select', ['VLSFO', 'ULSFO', 'HSFO', 'MGO', 'LSMGO']], ['qty', 'Кол-во, т', 'number'],
    ['sulphur', 'S, %', 'number'], ['density', 'Плотность @15°C', 'number'], ['visc', 'Вязкость, cSt @50°C', 'number'], ['bdn', 'BDN №'], ['supplier', 'Поставщик'], ['note', 'Заметка', 'textarea']] },
  lube: { title: 'Фасованные масла и смазки', add: 'Добавить позицию', sort: (a, b) => (a.cat || '').localeCompare(b.cat || '') || (a.name || '').localeCompare(b.name || ''), fields: [
    ['name', 'Масло / смазка'], ['cat', 'Группа', 'select', ['Гидравлика', 'Другие масла', 'Смазки', 'Прочее']], ['drum', 'Тара, л (смазки — кг)', 'number'], ['full', 'Полных, шт', 'number'],
    ['inuse', 'В начатой, л (кг)', 'number'], ['density', 'Плотность', 'number'], ['location', 'Где лежит'], ['date', 'Проверено', 'date'], ['note', 'Заметка', 'textarea']] },
};
function cloState() { return { s: 0.49, sw: 29, load: 50, total: 5710, bnBlend: 50, bnAdd: 110, bnSys: 15, pkg: 'Chevron-MCLA-BN400', batch: 100, bn: 120, ...(db.get('meta/clo') || {}) } }
function vLube() {
  const tabs = [['clo', 'Цилиндровое масло'], ['bob', 'BoB'], ['thin', 'Thin Lube'], ['order', 'Заказ масла'], ['lube', 'Фасованные'], ['bunker', 'Бункеровки']];
  let body = '';
  if (S.lubeTab === 'clo') body = cloView(); else if (S.lubeTab === 'bob') body = bobView(); else if (S.lubeTab === 'thin') body = thinView(); else if (S.lubeTab === 'order') body = orderView(); else if (S.lubeTab === 'lube') body = packedView(); else body = tableView(S.lubeTab);
  return `<div><h1>Бункер и масло</h1><div class="sub">CLO Matrix (A603), Blending on Board, заказ масла (MLFMT), фасованные масла, бункеровки</div></div>
  <div class="tabs" role="tablist">${tabs.map(([k, v]) => `<button role="tab" data-act="ltab" data-t="${k}" aria-selected="${S.lubeTab === k}">${v}</button>`).join('')}</div>${body}`;
}
const inp = (name, label, val, attrs = '') => `<label class="f">${label}<input type="number" inputmode="decimal" step="any" name="${name}" value="${esc(val)}" data-clo ${attrs}></label>`;
const out = (label, val, unit, accent) => `<div class="stat"><span class="lbl">${label}</span><b${accent ? ' style="color:var(--acc)"' : ''}>${val}</b><span class="lbl">${unit}</span></div>`;
function cloView() {
  const v = db.get('cal/clo-vessel'), p = cloState();
  if (!v) return `<div class="banner">Данные судна из CLO Matrix ещё не загружены. «Синхронизация» → «Загрузить копию» → файл данных танков.</div>`;
  const r = CLO.calc({ s: +p.s, sw: +p.sw, load: +p.load }, v);
  return `<section class="card"><h2>Данные судна (лист Matrix)</h2><div class="kv mt">
   <span>Судно</span><b>${v.name}</b><span>Главный двигатель</span><b>${v.engine}</b><span>SMCR</span><b>${num(v.smcr, 0)} kW</b>
   <span>Система лубрикации</span><b>${v.lubSystem}</b><span>MOP / LDCL</span><b>${v.mop ? 'Да' : 'Нет'} / ${v.ldcl ? 'Да' : 'Нет'}</b><span>BoB</span><b>Да · модель M${v.bobModel}</b></div></section>
  <section class="card"><h2>Ввод</h2><form class="fg3 mt" data-form="clo">${inp('s', 'Сера в топливе, %', p.s)}${inp('sw', 'Забортная вода, °C', p.sw)}${inp('load', 'Нагрузка ГД, % SMCR', p.load)}</form></section>
  <div class="grid4">${out('BN масла для смешивания', r.bn, 'mg KOH/g', 1)}${out('Feed Rate Factor (на MOP)', num(r.frf), 'g/kWh/S%', 1)}${out('Min. Feed Rate (на MOP)', num(r.minFr), 'g/kWh', 1)}${out('Фактический feed rate', num(r.fr, 3), 'g/kWh')}</div>
  <div class="grid2">${out('Расход цилиндрового масла', num(r.cons, 1), 'кг / сутки')}${out('Расход за 30 суток', num(r.cons * 30 / 1000, 2), 'т')}</div>
  <section class="card"><h2>BN в зависимости от серы (модель M4)</h2>${bnChart(+p.s, r.bn)}</section>
  <section class="card"><h2>Feed rate по нагрузке</h2>${frChart(r.curve, +p.load, r.fr)}<div class="note mt">Точки модели: ${r.curve.map(([l, f]) => `${l}% → ${num(f)}`).join(' · ')} g/kWh. Если вода выше 28 °C и сера выше 1,5 %, feed rate умножается на 1,1. Значения FRF и Min. Feed Rate вводятся на MOP.</div></section>`;
}
function bobView() {
  const p = cloState(), r = CLO.bobConventional({ total: +p.total, bnBlend: +p.bnBlend, bnAdd: +p.bnAdd, bnSys: +p.bnSys });
  return `<section class="card"><h2>BoB, обычный блендер</h2><div class="note">Сколько присадки и системного масла смешать, чтобы получить нужный BN</div>
  <form class="fg mt" data-form="clo">${inp('total', 'Сколько смешать, кг', p.total)}${inp('bnBlend', 'BN смеси (цель)', p.bnBlend)}${inp('bnAdd', 'BN присадки (от поставщика)', p.bnAdd)}${inp('bnSys', 'BN системного масла (замер)', p.bnSys)}</form></section>
  <div class="grid2">${out('Присадка', num(r.additive, 0), 'кг', 1)}${out('Системное масло ГД', num(r.system, 0), 'кг', 1)}</div>
  <div class="note">Формула A603: присадка = (BN смеси − BN системного) / (BN присадки − BN системного) × количество.</div>`;
}
function thinView() {
  const p = cloState(), r = CLO.thinLube({ pkg: p.pkg, batch: Math.min(+p.batch, 150), bn: +p.bn });
  const bns = Object.keys(CLO.THIN[p.pkg] || {});
  return `<section class="card"><h2>BoB, Thin Lube</h2><div class="note">Целевая вязкость 13,5 cSt. Партия не больше 150 кг.</div>
  <form class="fg3 mt" data-form="clo"><label class="f">Пакет присадки<select name="pkg" data-clo>${Object.keys(CLO.THIN).map(k => `<option${k === p.pkg ? ' selected' : ''}>${k}</option>`).join('')}</select></label>
  ${inp('batch', 'Партия, кг (макс. 150)', p.batch, 'max="150"')}<label class="f">BN цилиндрового масла<select name="bn" data-clo>${[50, 70, 100, 120, 140].map(b => `<option${b == p.bn ? ' selected' : ''}${bns.includes(String(b)) ? '' : ' disabled'}>${b}</option>`).join('')}</select></label></form></section>
  ${r ? `<div class="grid4" style="grid-template-columns:repeat(3,minmax(0,1fr))">${out('Системное масло ГД', num(r.system, 1), 'кг · ' + Math.round(r.ratio[0] * 100) + '%', 1)}${out('Thin base oil', num(r.thin, 1), 'кг · ' + Math.round(r.ratio[1] * 100) + '%', 1)}${out('Присадка High BN', num(r.additive, 1), 'кг · ' + Math.round(r.ratio[2] * 100) + '%', 1)}</div>` : '<div class="banner">Для этого пакета нет пропорций на такой BN.</div>'}
  ${+p.batch > 150 ? '<div class="banner red">Партия больше 150 кг: посчитано для 150 кг.</div>' : ''}
  <div class="note">На блендере обязательно соблюдать «Table Blend Sequence».</div>`;
}
// Small SVG charts (no library, work offline)
function bnChart(s, bn) {
  const W = 560, H = 190, P = 34, x = v => P + v / 3.5 * (W - P - 10), y = v => H - 24 - (v - 40) / 110 * (H - 44);
  const path = CLO.BN_CURVE.map(([a, b], i) => (i ? 'L' : 'M') + x(a).toFixed(1) + ' ' + y(b).toFixed(1)).join(' ');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="BN ${bn} при сере ${s}%">
  ${[50, 70, 100, 120, 140].map(b => `<line x1="${P}" x2="${W - 10}" y1="${y(b)}" y2="${y(b)}" class="gl"/><text x="${P - 6}" y="${y(b) + 4}" text-anchor="end">${b}</text>`).join('')}
  ${[0, 0.5, 1.5, 2.25, 3, 3.5].map(a => `<text x="${x(a)}" y="${H - 6}" text-anchor="middle">${a}</text>`).join('')}
  <path d="${path}" class="ln"/><circle cx="${x(Math.min(s, 3.5))}" cy="${y(bn)}" r="6" class="pt"/></svg>`;
}
function frChart(curve, load, fr) {
  const W = 560, H = 190, P = 40, x = v => P + v / 100 * (W - P - 10), mx = Math.max(...curve.map(c => c[1])) * 1.15, y = v => H - 24 - v / mx * (H - 44);
  const pts = [...curve].sort((a, b) => a[0] - b[0]);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Feed rate ${fr.toFixed(2)} g/kWh при нагрузке ${load}%">
  ${[0, 0.5, 1, 1.5].filter(v => v < mx).map(v => `<line x1="${P}" x2="${W - 10}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${P - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
  ${[10, 25, 50, 75, 100].map(a => `<text x="${x(a)}" y="${H - 6}" text-anchor="middle">${a}%</text>`).join('')}
  <path d="${pts.map(([a, b], i) => (i ? 'L' : 'M') + x(a).toFixed(1) + ' ' + y(b).toFixed(1)).join(' ')}" class="ln"/>
  <circle cx="${x(Math.min(Math.max(load, 0), 100))}" cy="${y(fr)}" r="6" class="pt"/></svg>`;
}
function tableView(col) {
  const T = TABLES[col], rows = db.all(col).sort(T.sort), cols = T.fields.filter(f => f[2] !== 'textarea');
  const low = col === 'lube' ? rows.filter(r => r.min && +r.rob < +r.min).length : 0;
  const tot = col === 'bunker' ? rows.reduce((a, r) => a + (+r.qty || 0), 0) : 0;
  return `<section class="card"><div class="row between"><div><h2>${T.title}</h2><div class="note">${rows.length ? (col === 'bunker' ? `${rows.length} ${plural(rows.length, 'запись', 'записи', 'записей')} · всего ${num(tot, 1)} т` : `${rows.length} ${plural(rows.length, 'позиция', 'позиции', 'позиций')}${low ? ` · <span class="bad">ниже минимума: ${low}</span>` : ''}`) : 'Пока пусто. Добавь вручную или пришли мне BDN / замеры — внесу сам.'}</div></div>
  <button class="btn pri" data-act="rowadd" data-col="${col}">${T.add}</button></div>
  ${rows.length ? `<div class="scroll mt"><table class="stack"><thead><tr>${cols.map(f => `<th>${f[1]}</th>`).join('')}</tr></thead><tbody>
  ${rows.map(r => `<tr data-act="rowedit" data-col="${col}" data-rid="${esc(r.id)}" class="click${col === 'lube' && r.min && +r.rob < +r.min ? ' lowrow' : ''}">${cols.map(f => `<td data-l="${f[1]}">${f[2] === 'date' && r[f[0]] ? dlong(r[f[0]]) : esc(r[f[0]] ?? '')}</td>`).join('')}</tr>`).join('')}
  </tbody></table></div>` : ''}</section>`;
}
function packedView() {
  const rows = db.all('lube'), cats = ['Гидравлика', 'Другие масла', 'Смазки', 'Прочее'];
  const cur = r => (+r.drum || 0) * (+r.full || 0) + (+r.inuse || 0), kg = r => r.cat === 'Смазки' ? cur(r) : r.density ? cur(r) * r.density : null;
  const last = rows.map(r => r.date).filter(Boolean).sort().pop();
  return `<section class="card"><div class="row between"><div><h2>Фасованные масла и смазки</h2><div class="note">${rows.length ? `${rows.length} позиций${last ? ' · проверено ' + dlong(last) : ''} · остаток = тара × полных + начатая` : 'Пока пусто.'}</div></div><button class="btn pri" data-act="rowadd" data-col="lube">Добавить позицию</button></div></section>
  ${cats.map(c => { const g = rows.filter(r => (r.cat || 'Прочее') === c).sort((a, b) => (a.name || '').localeCompare(b.name || '')); if (!g.length) return '';
    const tl = g.reduce((a, r) => a + cur(r), 0), tk = g.reduce((a, r) => a + (kg(r) || 0), 0), u = c === 'Смазки' ? 'кг' : 'л';
    return `<section class="card"><div class="row between"><h2>${c}</h2><span class="sub">${num(tl, 0)} ${u}${c !== 'Смазки' ? ' · ' + num(tk, 0) + ' кг' : ''}</span></div><div class="scroll mt"><table class="stack"><thead><tr><th>Наименование</th><th>Тара</th><th>Полных</th><th>Начатая</th><th>Остаток, ${u}</th>${c !== 'Смазки' ? '<th>кг</th>' : ''}<th>Где</th></tr></thead><tbody>
    ${g.map(r => `<tr class="click${cur(r) === 0 ? ' lowrow' : ''}" data-act="rowedit" data-col="lube" data-rid="${esc(r.id)}"><td data-l="Наименование">${esc(r.name)}</td><td data-l="Тара">${esc(r.drum ?? '')}</td><td data-l="Полных">${esc(r.full ?? '')}</td><td data-l="Начатая">${esc(r.inuse ?? '')}</td><td data-l="Остаток"><b>${num(cur(r), 0)}</b></td>${c !== 'Смазки' ? `<td data-l="кг">${kg(r) != null ? num(kg(r), 0) : ''}</td>` : ''}<td data-l="Где">${esc(r.location || '')}</td></tr>`).join('')}
    </tbody></table></div></section>` }).join('')}`;
}
function openRow(col, rid) {
  const T = TABLES[col], r = rid ? { ...(db.get(col + '/' + rid) || {}) } : {};
  S.edit = { row: true, col, rid: rid || uid(col[0]) };
  $('#modal').innerHTML = `<form class="sheet" id="rowf"><div class="row between"><h2 id="mt">${rid ? T.title + ' · правка' : T.add}</h2>${closeBtn()}</div>
  <div class="fg">${T.fields.map(([k, l, t, o]) => t === 'select' ? `<label class="f">${l}<select name="${k}"><option value=""></option>${o.map(x => `<option${x === r[k] ? ' selected' : ''}>${x}</option>`).join('')}</select></label>`
    : t === 'textarea' ? `<label class="f" style="grid-column:1/-1">${l}<textarea name="${k}">${esc(r[k] || '')}</textarea></label>`
    : `<label class="f">${l}<input name="${k}" type="${t === 'number' ? 'number' : t || 'text'}" ${t === 'number' ? 'step="any" inputmode="decimal"' : ''} value="${esc(r[k] ?? (t === 'date' && !rid ? today() : ''))}"></label>`).join('')}</div>
  <div class="row between"><div>${rid ? '<button type="button" class="btn danger" data-act="rowdel">Удалить</button>' : ''}</div><div class="row"><button type="button" class="btn" data-act="close">Отмена</button><button class="btn pri">Сохранить</button></div></div></form>`;
  $('#modal').hidden = false;
}

/* ---------- Синхронизация ---------- */
function vSync() {
  const src = [...S.sources].sort((a, b) => staleDays(b) - staleDays(a)), rc = db.remoteConfig(), st = db.status;
  const stTxt = { local: 'Только на этом устройстве', idle: 'Синхронизировано' + (st.at ? ' · ' + new Date(st.at).toTimeString().slice(0, 5) : ''), syncing: 'Синхронизация…', offline: 'Нет интернета — изменения сохранены на устройстве', error: 'Ошибка: ' + st.error }[st.state];
  return `<div><h1>Синхронизация</h1><div class="sub">Облако, резервная копия и источники данных</div></div>
  <section class="card"><div class="row between"><div><h2>Синхронизировать всё</h2><div class="note mt">${esc(stTxt)}${st.pending ? ` · не отправлено: ${st.pending}` : ''}</div></div>
  <button class="btn pri" data-act="syncall">Синхронизировать всё</button></div></section>
  <section class="card"><h2>Облачная база (телефон ⇄ ноутбук)</h2><div class="note mt">${rc ? 'Подключено: ' + esc(rc.url.replace(/^https?:\/\//, '')) : 'Не подключено. Пока данные живут только на этом устройстве. Чтобы телефон и ноутбук видели одно и то же, подключи облачную базу: адрес и ключ берутся в Supabase (Project Settings → API Keys), код пространства создаётся кнопкой ниже и вводится одинаковым на всех устройствах.'}</div>
  <form id="remf" class="fg mt"><label class="f">Адрес (URL)<input name="url" value="${esc(rc?.url || '')}" placeholder="https://xxxx.supabase.co" autocomplete="off"></label>
  <label class="f">Ключ (Publishable key)<input name="key" value="${esc(rc?.key || '')}" autocomplete="off"></label>
  <label class="f">Код пространства<input name="space" value="${esc(rc?.space || '')}" autocomplete="off" minlength="24" placeholder="минимум 24 символа"></label>
  <div class="f" style="justify-content:flex-end"><div class="row">${rc ? '' : '<button type="button" class="btn" data-act="gencode">Создать код</button>'}<button class="btn pri">${rc ? 'Сохранить' : 'Подключить'}</button>${rc ? '<button type="button" class="btn danger" data-act="unlink">Отключить</button>' : ''}</div></div></form></section>
  <section class="card"><h2>Резервная копия</h2><div class="note mt">Файл со всеми данными. Через него можно перенести данные на другое устройство без облака.</div>
  <div class="row mt"><button class="btn" data-act="export">Скачать копию</button><label class="btn" style="display:inline-flex;align-items:center">Загрузить копию<input type="file" accept=".json,application/json" id="impf" hidden></label></div></section>
  <section class="card"><h2>Источники</h2><div class="scroll mt"><table class="stack"><thead><tr><th>Источник</th><th>Раздел</th><th>Обновлён</th><th>Норма</th><th>Статус</th><th>Где лежит</th><th>Как обновить</th></tr></thead><tbody>
  ${src.map(s => { const k = staleDays(s); return `<tr><td data-l="Источник">${esc(s.name)}</td><td data-l="Раздел">${esc(s.section || '')}</td><td data-l="Обновлён">${s.last ? dlong(s.last) : '—'}</td><td data-l="Норма">${s.norm ? s.norm + ' дн.' : '—'}</td><td data-l="Статус" class="${k > 0 ? 'bad' : 'ok'}">${k > 0 ? 'устарел на ' + k + ' дн.' : 'свежий'}</td><td data-l="Где лежит"><code>${esc(s.path || '')}</code></td><td data-l="Как обновить">${esc(s.how || '')}</td></tr>` }).join('') || '<tr><td colspan="7" class="empty">Источники ещё не загружены</td></tr>'}
  </tbody></table></div></section>
  <section class="card"><h2>Настройки</h2><form id="setf" class="fg mt">
   <label class="f">Дата дока<input type="date" name="dockDate" value="${esc(S.settings.dockDate || '')}"></label>
   <label class="f">Где док<input name="dockName" value="${esc(S.settings.dockName || '')}"></label>
   <label class="f">Дата ABS<input type="date" name="absDate" value="${esc(S.settings.absDate || '')}"></label>
   <label class="f">Что по ABS<input name="absName" value="${esc(S.settings.absName || '')}"></label>
   <label class="f">Лимит задач в день<input type="number" min="1" max="30" name="dayLimit" value="${esc(S.settings.dayLimit || 8)}"></label>
   <div class="f" style="justify-content:flex-end"><button class="btn pri">Сохранить настройки</button></div></form></section>
  <div class="row"><span class="note">MCV Workbench ${VERSION}</span><button class="btn" data-act="update">Проверить обновление</button>${S.install ? '<button class="btn" data-act="install">Установить приложение</button>' : ''}</div>`;
}


/* ---------- Танки и замеры ---------- */
const GROUPS = { water: 'Вода', oil: 'Масло', fuel: 'Топливо', drain: 'Льяла, дренажи, шлам' };
const shortLbl = l => String(l || '').replace(/\s*\(cm\)\s*/i, '').trim();
function dailyCal() { return (db.get('cal/daily') || {}).rows || [] }
function foMeta() { return (db.get('cal/fo-meta') || {}).tanks || [] }
function foCal() { const o = {}; for (const t of foMeta()) if (t.sheet && !o[t.sheet]) { const d = db.get('cal/fo-' + t.sheet); if (d) o[t.sheet] = d.rows } return o }
const noCal = () => `<div class="banner">Калибровки танков ещё не загружены. Открой «Синхронизация» → «Загрузить копию» и выбери файл данных танков — или дождись синхронизации, если файл уже загружен на другом устройстве.</div>`;
function soundingsBefore(date) { return db.all('soundings').filter(s => s.id < date).sort((a, b) => b.id.localeCompare(a.id))[0] || null }
function vTanks() {
  const tabs = [['daily', 'Суточные замеры'], ['month', 'Месяц'], ['rob', 'ROB · бункеровка']];
  const body = S.tankTab === 'month' ? tMonth() : S.tankTab === 'rob' ? tRob() : tDaily();
  return `<div><h1>Танки и замеры</h1><div class="sub">Суточный журнал ER, расчёт ROB FO/DO/LO по калибровкам судна</div></div>
  <div class="tabs" role="tablist">${tabs.map(([k, v]) => `<button role="tab" data-act="ttab" data-t="${k}" aria-selected="${S.tankTab === k}">${v}</button>`).join('')}</div>${body}`;
}
function tDaily() {
  const rows = dailyCal(); if (!rows.length) return noCal();
  const date = S.sDate || today(), saved = db.get('soundings/' + date), prev = soundingsBefore(date);
  if (!S.sDraft || S.sDraft._date !== date) S.sDraft = { _date: date, ...(saved ? saved.values : {}) };
  const D = S.sDraft, dirty = JSON.stringify(Object.entries(D).filter(([k]) => k !== '_date').sort()) !== JSON.stringify(Object.entries(saved ? saved.values : {}).sort());
  const filled = rows.filter(r => D[r.key] !== undefined && D[r.key] !== '').length;
  return `<section class="card"><div class="row between"><div class="row"><button class="btn" data-act="sday" data-d="-1" aria-label="Предыдущий день">←</button>
   <input type="date" class="search" style="width:auto" id="sdate" value="${date}"><button class="btn" data-act="sday" data-d="1" aria-label="Следующий день">→</button></div>
   <div class="note">${saved ? 'Сохранено' + (saved.by ? ' · ' + esc(saved.by) : '') : 'Новая запись'} · заполнено ${filled} из ${rows.length}${prev ? ' · сравнение с ' + dlong(prev.id) : ''}</div></div></section>
  ${Object.entries(GROUPS).map(([g, gl]) => `<section class="card"><h2>${gl}</h2><div class="srows mt">${rows.filter(r => r.group === g).map(r => {
    const v = D[r.key], pv = prev && prev.values[r.key], vol = r.cal ? T.dailyVolume(r.cal, v) : null, pvol = r.cal && pv != null ? T.dailyVolume(r.cal, pv) : null;
    const dv = v !== undefined && v !== '' && pv != null ? (r.cal && vol != null && pvol != null ? vol - pvol : v - pv) : null;
    return `<label class="srow"><span class="sl">${esc(shortLbl(r.label))}${pv != null ? `<small>вчера ${num(pv, pv % 1 ? 2 : 0)}</small>` : ''}</span>
     <input inputmode="decimal" type="number" step="any" data-snd="${esc(r.key)}" value="${esc(v ?? '')}" placeholder="${r.cal ? 'см' : '—'}">
     <span class="sv">${r.cal ? (vol != null ? num(vol, 1) + ' м³' : '') : '<small>как в журнале</small>'}${dv ? `<small class="${Math.abs(dv) > 0 ? (dv > 0 ? 'up' : 'dn') : ''}">${dv > 0 ? '+' : ''}${num(dv, r.cal ? 1 : 2)}</small>` : ''}</span></label>` }).join('')}</div></section>`).join('')}
  <div class="savebar"><span class="note">${dirty ? 'Есть несохранённые изменения' : 'Изменений нет'}</span><button class="btn pri" data-act="ssave"${dirty ? '' : ' disabled'}>Сохранить замеры</button></div>`;
}
function tMonth() {
  const rows = dailyCal(); if (!rows.length) return noCal();
  const base = parse(today()); base.setDate(1); base.setMonth(base.getMonth() + S.tmOff);
  const y = base.getFullYear(), m = base.getMonth(), n = new Date(y, m + 1, 0).getDate();
  const days = [...Array(n)].map((_, i) => iso(new Date(y, m, i + 1))), data = Object.fromEntries(db.all('soundings').filter(s => s.id.startsWith(days[0].slice(0, 7))).map(s => [s.id, s.values]));
  const vol = S.tmUnit === 'm3', cnt = Object.keys(data).length;
  return `<div class="row between"><div class="row"><button class="btn" data-act="tmo" data-d="-1" aria-label="Предыдущий месяц">←</button><b>${MON1[m]} ${y}</b><button class="btn" data-act="tmo" data-d="1" aria-label="Следующий месяц">→</button><span class="sub">${cnt} ${plural(cnt, 'день', 'дня', 'дней')} с замерами</span></div>
   <div class="row"><div class="seg" role="group" aria-label="Единицы"><button data-act="tmu" data-u="cm" aria-pressed="${!vol}">см</button><button data-act="tmu" data-u="m3" aria-pressed="${vol}">м³</button></div><button class="btn" data-act="tmcsv">CSV</button></div></div>
  <div class="scroll card" style="padding:0"><table class="mtab"><thead><tr><th class="stick">Танк</th>${days.map(d => `<th data-act="tday" data-d="${d}" class="click${d === today() ? ' now' : ''}">${parse(d).getDate()}</th>`).join('')}</tr></thead><tbody>
  ${rows.map(r => `<tr><th class="stick">${esc(shortLbl(r.label))}</th>${days.map(d => { const v = data[d] && data[d][r.key]; const x = v == null || v === '' ? '' : vol && r.cal ? T.dailyVolume(r.cal, v) : v; return `<td>${x === '' || x == null ? '' : num(x, vol && r.cal ? 1 : (x % 1 ? 2 : 0))}</td>` }).join('')}</tr>`).join('')}
  </tbody></table></div><div class="note">Нажми на число месяца, чтобы открыть замеры этого дня. Для танков без калибровки в «м³» показано значение как в журнале.</div>`;
}
function robInputs() { return S.robDraft || (S.robDraft = (() => { const last = db.all('rob').sort((a, b) => b.id.localeCompare(a.id))[0]; const t = {};
  if (last) for (const [k, v] of Object.entries(last.tanks || {})) t[k] = { density: v.density ?? '', temp: v.temp ?? '' };
  return { date: today(), place: '', event: 'Quantity check', fwd: last ? last.fwd : '', aft: last ? last.aft : '', logHfo: '', logDo: '', tanks: t } })()) }
function tRob() {
  const meta = foMeta(); if (!meta.length) return noCal();
  const I = robInputs(), ok = I.fwd !== '' && I.aft !== '', res = ok ? T.computeROB(meta, foCal(), I) : null, byKey = res ? Object.fromEntries(res.rows.map(r => [r.key, r])) : {};
  const grp = [['HFO', 'Тяжёлое топливо (ullage, см)', m => m.group === 'HFO' && m.k !== 0.0008], ['DO', 'Дизельное топливо (sounding, см)', m => m.k === 0.0008], ['LO', 'Масла (sounding, см; Cyl daily — м³)', m => m.group === 'LO']];
  const hist = db.all('rob').sort((a, b) => b.id.localeCompare(a.id));
  const fx = (k, f, v, ph, w = '') => `<input inputmode="decimal" type="number" step="any" data-rob="${esc(k)}" data-f="${f}" value="${esc(v ?? '')}" placeholder="${esc(ph ?? '')}" ${w}>`;
  return `<section class="card"><h2>Расчёт ROB / бункеровка</h2><div class="note">Повторяет формулы «FO soundings» / «Vessel bunker calculation»: поправка на дифферент, плотность и температуру. Пустой танк не считается.</div>
  <form class="fg3 mt" id="robh"><label class="f">Дата<input type="date" name="date" value="${esc(I.date)}"></label><label class="f">Порт / место<input name="place" value="${esc(I.place)}"></label>
  <label class="f">Событие<select name="event">${['Quantity check', 'Before bunkering', 'After bunkering', 'Monthly ROB', 'Arrival', 'Departure'].map(e => `<option${e === I.event ? ' selected' : ''}>${e}</option>`).join('')}</select></label>
  <label class="f">Осадка нос, м<input inputmode="decimal" type="number" step="any" name="fwd" value="${esc(I.fwd)}"></label><label class="f">Осадка корма, м<input inputmode="decimal" type="number" step="any" name="aft" value="${esc(I.aft)}"></label>
  <div class="f">Дифферент<b style="font-size:20px;color:var(--ink)">${ok ? num(res.trim, 2) + ' м' : '—'}</b></div>
  <label class="f">ROB HFO по журналу, т<input inputmode="decimal" type="number" step="any" name="logHfo" value="${esc(I.logHfo)}"></label><label class="f">ROB DO по журналу, т<input inputmode="decimal" type="number" step="any" name="logDo" value="${esc(I.logDo)}"></label></form></section>
  ${!ok ? '<div class="banner">Введи осадку носом и кормой — без неё калибровку не применить.</div>' : ''}
  ${grp.map(([g, gl, f]) => `<section class="card"><h2>${gl}</h2><div class="scroll mt"><table class="rob"><thead><tr><th>Танк</th><th>Замер</th>${g !== 'LO' ? '<th>ρ15</th><th>t, °C</th>' : '<th>ρ</th>'}<th>м³</th><th>%</th><th>т</th></tr></thead><tbody>
   ${meta.filter(f).map(m => { const d = I.tanks[m.key] || {}, r = byKey[m.key] || {}; return `<tr><th>${esc(m.key)}<small>${m.capacity ? num(m.capacity, 1) + ' м³' : ''}</small></th>
     <td>${fx(m.key, 'value', d.value, m.kind === 'volume' ? 'м³' : 'см')}</td><td>${fx(m.key, 'density', d.density, m.density)}</td>${g !== 'LO' ? `<td>${fx(m.key, 'temp', d.temp, m.temp)}</td>` : ''}
     <td>${r.error ? '<span class="bad">вне таблицы</span>' : r.m3 != null ? num(r.m3, 2) : ''}</td><td class="${r.pct > m.maxpct ? 'bad' : ''}">${r.pct != null ? num(r.pct, 1) : ''}</td><td>${r.t != null ? num(r.t, 2) : ''}</td></tr>` }).join('')}</tbody></table></div></section>`).join('')}
  ${res ? `<div class="grid4" style="grid-template-columns:repeat(3,minmax(0,1fr))">${[['HFO', 'Тяжёлое топливо', I.logHfo], ['DO', 'Дизельное топливо', I.logDo], ['LO', 'Масла', '']].map(([k, l, lg]) => `<div class="stat"><span class="lbl">${l}</span><b style="color:var(--acc)">${num(res.sum[k].t, 2)} т</b><span class="lbl">${num(res.sum[k].m3, 1)} м³${lg !== '' && lg != null ? ` · журнал ${num(+lg, 1)} т · разница ${num(res.sum[k].t - lg, 2)}` : ''}</span></div>`).join('')}</div>
  <div class="savebar"><span class="note">Масса топлива: V × (ρ15 − k × (t − 15)); k = 0,00063 для HFO, 0,0008 для DO.</span><button class="btn pri" data-act="robsave">Сохранить расчёт</button></div>` : ''}
  <section class="card"><h2>Сохранённые расчёты</h2><div class="list mt">${hist.map(h => `<div class="t" data-act="robopen" data-rid="${esc(h.id)}"><div class="tb"><span class="tt">${dlong(h.date)} · ${esc(h.event || '')}${h.place ? ' · ' + esc(h.place) : ''}</span><span class="small">HFO ${num(h.sum?.HFO?.t, 1)} т · DO ${num(h.sum?.DO?.t, 1)} т · LO ${num(h.sum?.LO?.t, 1)} т · осадка ${esc(h.fwd)}/${esc(h.aft)}</span></div></div>`).join('') || '<div class="empty">Пока нет. После расчёта нажми «Сохранить расчёт».</div>'}</div></section>`;
}
function monthCSV() {
  const rows = dailyCal(), base = parse(today()); base.setDate(1); base.setMonth(base.getMonth() + S.tmOff);
  const y = base.getFullYear(), m = base.getMonth(), n = new Date(y, m + 1, 0).getDate(), days = [...Array(n)].map((_, i) => iso(new Date(y, m, i + 1)));
  const data = Object.fromEntries(db.all('soundings').map(s => [s.id, s.values])), vol = S.tmUnit === 'm3';
  const lines = [['Tank', ...days].join(';'), ...rows.map(r => [r.label, ...days.map(d => { const v = data[d] && data[d][r.key]; if (v == null || v === '') return ''; const x = vol && r.cal ? T.dailyVolume(r.cal, v) : v; return String(Math.round(x * 1000) / 1000).replace('.', ',') })].join(';'))];
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
  return `<section class="card"><h2>Заказ масла по правилу MLFMT</h2><div class="note">Лист «BOB-Vessels» из MLFMT InventoryMgt Calc-Guidelines 03-08-2026. Запасы и расходы — в кг. ROB берётся из расчёта ROB (т × 1000).</div>
   <div class="fg mt">${f('delivery_date', 'Дата поставки (основной порт)', 'date')}${f('forward_date', 'Следующий основной порт', 'date')}</div></section>
  <section class="card"><h2>Присадка (BoB)</h2><div class="fg3 mt"><label class="f">Продукт<select data-lo="additive.product">${Object.keys(T.ADDITIVES).map(k => `<option${k === p.additive.product ? ' selected' : ''}>${k}</option>`).join('')}</select></label>
   ${f('additive.stock_kg', 'ROB, кг')}${f('additive.tank_kg', 'Ёмкость танка, кг')}${f('additive.unusable_kg', 'Неоткачиваемый остаток, кг')}${f('additive.target_bn', 'Целевой BN смеси')}${f('additive.blended_stock_kg', 'Запас готовой смеси, кг')}${f('additive.blend_consumption_kg_month', 'Расход смеси, кг/мес')}</div></section>
  <section class="card"><h2>Системное масло ГД (MESO)</h2><div class="fg3 mt">${f('meso.stock_kg', 'ROB, кг')}${f('meso.sump_kg', 'Заправка картера, кг')}${f('meso.safety_stock_kg', 'Страховой запас, кг')}${f('meso.tank_kg', 'Ёмкость танка, кг')}${f('meso.consumption_kg_month', 'Расход, кг/мес')}${f('meso.bn', 'BN')}</div></section>
  <section class="card"><h2>Масло ДГ (TPEO)</h2><div class="fg3 mt">${f('tpeo.stock_kg', 'ROB, кг')}${f('tpeo.sump_kg', 'Заправка картера, кг')}${f('tpeo.tank_kg', 'Ёмкость танка, кг')}${f('tpeo.consumption_kg_month', 'Расход, кг/мес')}${f('tpeo.changeouts', 'Замен масла за период')}</div></section>
  ${r ? `<div class="grid4">${out('Присадка', num(r.add.order, 0), r.add.unit, 1)}${out('MESO', num(r.meso.order, 0), 'л', 1)}${out('TPEO', num(r.tpeo.order, 0), 'л', 1)}${out('Дней до след. порта', r.days, 'дн.')}</div>
   ${r.warnings.map(w => `<div class="banner red">${esc(w)}</div>`).join('')}
   <div class="note">Пропорция смешивания: присадка ${num(r.ratioAdd * 100, 1)} % · MESO ${num(r.ratioMeso * 100, 1)} %. Страховой запас: присадка ${num(r.add.safety, 0)} кг, MESO ${num(r.meso.safety, 0)} кг, TPEO ${num(r.tpeo.safety, 0)} кг. После поставки танк — не выше 95 %.</div>` : `<div class="banner">${err ? esc(err) : 'Заполни даты и ROB по присадке, MESO и TPEO — заказ посчитается сразу.'}</div>`}`;
}
function num0(p) { const c = JSON.parse(JSON.stringify(p)); for (const g of ['additive', 'meso', 'tpeo', 'mdcl2']) for (const k in c[g]) if (k !== 'product' && c[g][k] !== '') c[g][k] = +c[g][k]; return c }


/* ---------- Logbook: scrape-down, ORB Part I, Biofouling ---------- */
const ORB_CODES = { 'C.11': 'C11 Сбор шлама', 'C.12': 'C12 Перекачка/сдача шлама', D: 'D Льяльные воды', H: 'H Бункеровка', I: 'I Прочее, инвентаризация', F: 'F Фильтрующее оборудование' };
const CYL_COL = ['#5BB8F5', '#3FB68B', '#F2A93B', '#F0616D', '#B49CF5', '#4FD1C5'];
function vLog() {
  const tabs = [['scrape', 'Scrape-down ГД'], ['orb', 'ORB Part I'], ['bio', 'Biofouling']];
  const body = S.logTab === 'orb' ? logBook('orb') : S.logTab === 'bio' ? logBook('bio') : scrapeView();
  return `<div><h1>Logbook</h1><div class="sub">Scrape-down главного двигателя, Oil Record Book Part I, Biofouling Management Log</div></div>
  <div class="tabs" role="tablist">${tabs.map(([k, v]) => `<button role="tab" data-act="lgtab" data-t="${k}" aria-selected="${S.logTab === k}">${v}</button>`).join('')}</div>${body}`;
}
const avg = a => { const v = a.filter(x => x != null && x !== ''); return v.length ? v.reduce((s, x) => s + +x, 0) / v.length : null };
function scrapeView() {
  const rows = db.all('scrape').sort((a, b) => b.id.localeCompare(a.id)), lim = db.get('meta/scrapelimits') || {};
  const D = S.scDraft || (S.scDraft = { date: today(), time: new Date().toTimeString().slice(0, 5), rh: rows[0] && rows[0].rh ? '' : '', fe: ['', '', '', '', '', ''], bn: ['', '', '', '', '', ''], remarks: '' });
  const feMax = +lim.feMax || null, bnMin = +lim.bnMin || null;
  const cell = (v, bad) => `<td class="${bad ? 'bad' : ''}">${v == null || v === '' ? '' : num(v, v % 1 ? 1 : 0)}</td>`;
  return `<section class="card"><h2>Новый замер</h2><div class="note">Незамеренный цилиндр оставь пустым (не 0). Запись с той же датой и временем заменяет прежнюю.</div>
   <div class="fg3 mt"><label class="f">Дата<input type="date" data-sc="date" value="${esc(D.date)}"></label><label class="f">Время<input type="time" data-sc="time" value="${esc(D.time)}"></label><label class="f">Наработка ГД, ч<input inputmode="numeric" type="number" data-sc="rh" value="${esc(D.rh)}" placeholder="${rows[0] && rows[0].rh ? 'было ' + rows[0].rh : ''}"></label></div>
   <div class="cylin mt"><span class="lbl">Fe, ppm</span>${[0, 1, 2, 3, 4, 5].map(i => `<label><small>Цил. ${i + 1}</small><input inputmode="decimal" type="number" step="any" data-sc="fe" data-i="${i}" value="${esc(D.fe[i])}"></label>`).join('')}</div>
   <div class="cylin"><span class="lbl">BN, mg KOH/g</span>${[0, 1, 2, 3, 4, 5].map(i => `<label><small>Цил. ${i + 1}</small><input inputmode="decimal" type="number" step="any" data-sc="bn" data-i="${i}" value="${esc(D.bn[i])}"></label>`).join('')}</div>
   <label class="f mt">Замечания<input data-sc="remarks" value="${esc(D.remarks)}"></label>
   <div class="row mt" style="justify-content:flex-end"><button class="btn pri" data-act="scsave">Сохранить замер</button></div></section>
  ${rows.length ? `<section class="card"><div class="row between"><h2>Тренд Fe по цилиндрам</h2><span class="sub">${feMax ? 'предел Fe ' + feMax + ' ppm' : 'предел Fe не задан'}${bnMin ? ' · BN мин. ' + bnMin : ''}</span></div>${scrapeChart(rows.slice(0, 40).reverse(), feMax)}
   <div class="legend">${CYL_COL.map((c, i) => `<span><i style="background:${c}"></i>Цил. ${i + 1}</span>`).join('')}<span><i style="background:var(--ink)"></i>Среднее</span></div></section>` : ''}
  <section class="card"><h2>Журнал</h2><div class="scroll mt"><table class="mtab sc"><thead><tr><th class="stick">Дата</th><th>Наработка</th>${[1, 2, 3, 4, 5, 6].map(i => `<th>Fe ${i}</th>`).join('')}<th>Fe ср.</th><th>Fe макс.</th>${[1, 2, 3, 4, 5, 6].map(i => `<th>BN ${i}</th>`).join('')}<th>BN ср.</th><th>Замечания</th></tr></thead><tbody>
   ${rows.map(r => { const fa = avg(r.fe), fm = Math.max(...r.fe.filter(x => x != null && x !== '').map(Number)), ba = avg(r.bn);
     return `<tr class="click" data-act="scopen" data-rid="${esc(r.id)}"><th class="stick">${dlong(r.date)} ${esc(r.time || '')}</th><td>${r.rh ?? ''}</td>${r.fe.map(v => cell(v, feMax && v > feMax)).join('')}${cell(fa)}${cell(isFinite(fm) ? fm : null, feMax && fm > feMax)}${r.bn.map(v => cell(v, bnMin && v != null && v !== '' && v < bnMin)).join('')}${cell(ba)}<td style="text-align:left">${esc(r.remarks || '')}</td></tr>` }).join('') || '<tr><td colspan="20" class="empty">Замеров пока нет</td></tr>'}
   </tbody></table></div></section>
  <section class="card"><h2>Пределы для подсветки</h2><div class="note">В Excel ячейки пределов были пустыми. Впиши значения по мануалу MAN или рекомендации лаборатории — превышения подсветятся красным.</div>
   <form id="limf" class="fg mt"><label class="f">Fe, макс. ppm<input inputmode="decimal" type="number" step="any" name="feMax" value="${esc(lim.feMax ?? '')}"></label><label class="f">BN, мин. mg KOH/g<input inputmode="decimal" type="number" step="any" name="bnMin" value="${esc(lim.bnMin ?? '')}"></label>
   <div class="f" style="justify-content:flex-end"><button class="btn">Сохранить пределы</button></div></form></section>`;
}
function scrapeChart(rows, feMax) {
  const W = 640, H = 220, P = 38, n = rows.length, vals = rows.flatMap(r => r.fe).filter(v => v != null && v !== '').map(Number);
  const mx = Math.max(feMax || 0, ...vals, 10) * 1.1, x = i => P + (n < 2 ? 0 : i / (n - 1) * (W - P - 12)), y = v => H - 26 - v / mx * (H - 44);
  const line = (get, col, w) => { let d = '', pen = false; rows.forEach((r, i) => { const v = get(r); if (v == null || v === '' || isNaN(v)) { pen = false; return } d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(+v).toFixed(1); pen = true }); return `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linejoin="round"/>` };
  const ticks = [0, 25, 50, 75, 100, 125, 150, 200].filter(t => t < mx);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Тренд Fe по цилиндрам">
   ${ticks.map(t => `<line x1="${P}" x2="${W - 10}" y1="${y(t)}" y2="${y(t)}" class="gl"/><text x="${P - 6}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join('')}
   ${feMax ? `<line x1="${P}" x2="${W - 10}" y1="${y(feMax)}" y2="${y(feMax)}" stroke="var(--red)" stroke-dasharray="5 4"/>` : ''}
   ${rows.map((r, i) => i % Math.ceil(n / 8 || 1) === 0 ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${parse(r.date).getDate()}.${String(parse(r.date).getMonth() + 1).padStart(2, '0')}</text>` : '').join('')}
   ${CYL_COL.map((c, k) => line(r => r.fe[k], c, 1.6)).join('')}${line(r => avg(r.fe), 'var(--ink)', 3)}</svg>`;
}
function logBook(kind) {
  const docs = db.all('logbook').filter(d => d.book === (kind === 'orb' ? 'ORB1' : 'BIO')), all = docs.flatMap(d => d.entries).sort((a, b) => b.date.localeCompare(a.date));
  if (!all.length) return `<div class="banner">Записей пока нет. «Синхронизация» → «Загрузить копию» → файл данных Logbook.</div>`;
  const q = (S.lgQ || '').toLowerCase(), code = kind === 'orb' ? S.lgCode : '';
  const years = [...new Set(all.map(e => e.date.slice(0, 4)))].sort().reverse(), yr = S.lgYear === null ? (q ? '' : years[0]) : S.lgYear;
  const list = all.filter(e => (!code || e.code === code) && (!yr || e.date.startsWith(yr)) && (!q || (e.title + ' ' + e.details + ' ' + (e.remarks || '') + ' ' + e.author).toLowerCase().includes(q)));
  const last = all[0].date, cnt = c => all.filter(e => e.code === c && (!yr || e.date.startsWith(yr))).length;
  const shown = list.slice(0, S.lgMore || 100);
  return `<section class="card"><div class="row between"><div><h2>${kind === 'orb' ? 'Oil Record Book Part I' : 'Biofouling Management Log Book'}</h2><div class="note">${all.length} записей · последняя ${dlong(last.slice(0, 10))} · выгрузка из e-log. Официальные записи делаются в e-log; сюда они попадают новой выгрузкой.</div></div></div>
   <div class="row mt"><input class="search" id="lgq" type="search" placeholder="Поиск: танк, порт, количество…" value="${esc(S.lgQ || '')}" aria-label="Поиск по журналу">
   <select class="search" style="width:auto" data-act="lgyear" id="lgyear"><option value="">Все годы</option>${years.map(y => `<option${y === yr ? ' selected' : ''}>${y}</option>`).join('')}</select></div>
   ${kind === 'orb' ? `<div class="chips mt"><button class="chip" data-act="lgcode" data-c="" aria-pressed="${!code}">Все</button>${Object.entries(ORB_CODES).map(([c, l]) => `<button class="chip" data-act="lgcode" data-c="${c}" aria-pressed="${code === c}">${l} · ${cnt(c)}</button>`).join('')}</div>` : ''}</section>
  <div class="note">Найдено: ${list.length}${list.length > shown.length ? ', показаны первые ' + shown.length : ''}</div>
  <div class="list">${shown.map(e => `<div class="lg${e.warnings ? ' warnrow' : ''}"><div class="row between"><b>${e.date.slice(8, 10)}.${e.date.slice(5, 7)}.${e.date.slice(0, 4)} ${e.date.slice(11, 16)} · <span class="tag">${esc(e.code)}</span> ${esc(e.title.replace(/^[A-Z.0-9]+:\s*/, '').replace(/^\d\.\d\s*-\s*/, ''))}</b>${e.ok ? '' : '<span class="tag warn">не утверждена</span>'}</div>
    <div class="ld">${esc(e.details)}</div>${e.remarks ? `<div class="small">Замечание: ${esc(e.remarks)}</div>` : ''}${e.warnings ? `<div class="small bad">e-log: ${esc(e.warnings)}</div>` : ''}<div class="small">${esc(e.author || '')}${e.att ? ' · вложений: ' + e.att : ''}</div></div>`).join('') || '<div class="empty">Ничего не найдено</div>'}</div>
  ${list.length > shown.length ? `<button class="btn" data-act="lgmore">Показать ещё</button>` : ''}`;
}


/* ---------- Наработка компонентов ГД (ME RHRS) ---------- */
function vRhrs() {
  const meta = db.get('rhrs-meta/current'), groups = db.all('rhrs').sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  if (!groups.length) return `<div><h1>Наработка ГД</h1></div><div class="banner">Данные компонентов ещё не загружены. «Синхронизация» → «Загрузить копию» → файл данных.</div>`;
  const RH = meta ? +meta.rh : null, log = db.all('rhrslog').sort((a, b) => b.id.localeCompare(a.id)).slice(0, 5);
  const all = groups.flatMap(g => g.rows.map(r => ({ g, r, c: RR.calcRow(g, r, RH) })));
  const over = all.filter(x => x.c.left != null && x.c.left < 0 || x.c.left2 != null && x.c.left2 < 0), soon = all.filter(x => !over.includes(x) && (x.c.left != null && x.c.left < 2000 || x.c.left2 != null && x.c.left2 < 2000));
  const col = v => v == null ? '' : v < 0 ? 'bad' : v < 2000 ? 'warnc' : '';
  const n0 = v => v == null ? '' : num(v, 0);
  return `<div><h1>Наработка компонентов ГД</h1><div class="sub">Как в ME_RHRS: вводишь наработку ГД — остальное считается само</div></div>
  <section class="card"><form id="rhf" class="rhf"><label class="f">Наработка ГД, ч<input name="rh" inputmode="numeric" type="number" value="${esc(RH ?? '')}" style="font-size:22px;font-weight:600"></label>
   <div class="note">${meta ? 'Обновлено ' + dlong(meta.date) + (meta.by ? ' · ' + esc(meta.by) : '') : ''}${log.length ? '<br>История: ' + log.map(l => num(l.rh, 0) + ' (' + dlong(l.date) + ')').join(' · ') : ''}</div>
   <button class="btn pri">Сохранить наработку</button></form></section>
  <div class="grid2"><div class="stat"><b style="color:${over.length ? 'var(--red)' : 'inherit'}">${over.length}</b><span class="lbl">просрочено по часам</span></div><div class="stat"><b style="color:${soon.length ? 'var(--acc)' : 'inherit'}">${soon.length}</b><span class="lbl">осталось меньше 2000 ч</span></div></div>
  ${over.length + soon.length ? `<section class="card"><h2>Требуют внимания</h2><div class="list mt">${[...over, ...soon].sort((a, b) => Math.min(a.c.left ?? 1e9, a.c.left2 ?? 1e9) - Math.min(b.c.left ?? 1e9, b.c.left2 ?? 1e9)).map(x => { const l = Math.min(x.c.left ?? 1e9, x.c.left2 ?? 1e9); return `<a class="t" href="#g-${esc(x.g.id)}" data-act="rhgo" data-g="${esc(x.g.id)}"><div class="tb"><span class="tt">${esc(x.g.title)} · ${esc(x.r.pos)}</span><span class="small ${l < 0 ? 'bad' : 'warnc'}">${l < 0 ? 'просрочено на ' + num(-l, 0) + ' ч' : 'осталось ' + num(l, 0) + ' ч'}${x.g.kind === 'fv' && x.c.left2 < x.c.left ? ' (направляющая шпинделя)' : ''}</span></div></a>` }).join('')}</div></section>` : ''}
  ${groups.map(g => { const fv = g.kind === 'fv';
    return `<section class="card" id="g-${esc(g.id)}"><div class="row between"><h2>${esc(g.title)}</h2><span class="sub">${g.interval ? 'интервал ' + num(g.interval, 0) + ' ч' : ''}${g.interval2 ? ' · направляющая шпинделя ' + num(g.interval2, 0) + ' ч' : ''}${g.kind === 'own' ? ' · свой счётчик' : ''}</span></div>
    <div class="scroll mt"><table class="stack rh"><thead><tr><th>Поз.</th><th>Номер</th><th>Установлен</th><th>При наработке</th>${g.kind === 'own' ? '<th>Счётчик сейчас</th>' : ''}<th>${fv ? 'С опрессовки' : 'Отработал'}</th>${g.kind !== 'run' ? `<th>${fv ? 'До опрессовки' : 'До переборки'}</th>` : ''}${fv ? '<th>До замены направляющей</th>' : ''}${g.total ? '<th>Всего у детали</th>' : ''}<th>Заметка</th></tr></thead><tbody>
    ${g.rows.map((r, i) => { const c = RR.calcRow(g, r, RH); return `<tr class="click" data-act="rhedit" data-g="${esc(g.id)}" data-i="${i}"><td data-l="Поз."><b>${esc(r.pos)}</b></td><td data-l="Номер">${esc(r.id || '')}</td><td data-l="Установлен">${r.date && /^\d{4}-/.test(r.date) ? dlong(r.date) + ' ' + r.date.slice(0, 4) : esc(r.date || '')}</td><td data-l="При наработке">${n0(r.rhInst)}</td>${g.kind === 'own' ? `<td data-l="Счётчик">${n0(r.own)}</td>` : ''}
      <td data-l="${fv ? 'С опрессовки' : 'Отработал'}">${n0(c.run)}</td>${g.kind !== 'run' ? `<td data-l="${fv ? 'До опрессовки' : 'До переборки'}" class="${col(c.left)}"><b>${n0(c.left)}</b></td>` : ''}${fv ? `<td data-l="До направляющей" class="${col(c.left2)}"><b>${n0(c.left2)}</b></td>` : ''}${g.total ? `<td data-l="Всего">${n0(c.total)}</td>` : ''}<td data-l="Заметка" class="small">${esc(r.note || '')}</td></tr>` }).join('')}
    </tbody></table></div></section>` }).join('')}
  <div class="note">Нажми на строку, чтобы внести замену детали: дата, наработка ГД при установке, номер. В исходном Excel у крышек цилиндров «до переборки» считалось по интервалу втулок (70 000 ч) — здесь по своему интервалу ${num((groups.find(g => g.id === 'cover') || {}).interval || 24000, 0)} ч.</div>`;
}
function openRh(gid, i) {
  const g = db.get('rhrs/' + gid), r = g.rows[i]; S.edit = { rh: true, gid, i };
  const f = (k, l, t = 'text') => `<label class="f">${l}<input name="${k === 'id' ? '_pid' : k}" ${t === 'number' ? 'inputmode="numeric" type="number"' : 'type="' + t + '"'} value="${esc(r[k] ?? '')}"></label>`;
  $('#modal').innerHTML = `<form class="sheet" id="rhrow"><div class="row between"><h2 id="mt">${esc(g.title)} · ${esc(r.pos)}</h2>${closeBtn()}</div>
   <div class="fg">${f('id', 'Номер / ID')}${f('date', 'Дата установки', 'date')}${f('rhInst', 'Наработка ГД при установке', 'number')}${g.kind === 'fv' ? f('prior', 'Часы форсунки при установке', 'number') : g.total ? f('prior', 'Часы детали при установке', 'number') : ''}${g.kind === 'own' ? f('own', 'Счётчик сейчас', 'number') : ''}</div>
   <label class="f">Заметка<textarea name="note">${esc(r.note || '')}</textarea></label>
   <div class="row between"><label class="f" style="max-width:220px">Интервал группы, ч<input name="_interval" inputmode="numeric" type="number" value="${esc(g.interval ?? '')}"></label><div class="row"><button type="button" class="btn" data-act="close">Отмена</button><button class="btn pri">Сохранить</button></div></div></form>`;
  $('#modal').hidden = false;
}

/* ---------- Рефы ---------- */
function vReefer() {
  const p = S.rfDraft || (S.rfDraft = { sw: '', n: '', hh: 24, mm: 0, ...(db.get('meta/reefer') || {}) }), perf = db.get('perf/meta'), seaT = perf && perf.last && perf.last.sea;
  const ok = p.sw !== '' && p.n !== '', k = ok ? RR.reeferKWh(p.sw, p.n, p.hh, p.mm) : null, per = p.sw !== '' ? 1.787 + 0.054 * Math.min(35, Math.max(5, +p.sw)) : null;
  const inp = (k2, l, extra = '') => `<label class="f">${l}<input inputmode="decimal" type="number" step="any" data-rf="${k2}" value="${esc(p[k2])}" ${extra}></label>`;
  return `<div><h1>Расход энергии на рефы</h1><div class="sub">Reefer Consumption Calculator — когда счётчик кВт·ч не работает</div></div>
  <section class="card"><div class="fg mt">${inp('sw', 'Температура забортной воды, °C', seaT != null ? `placeholder="StarConnect: ${seaT}"` : '')}${inp('n', 'Количество рефконтейнеров')}${inp('hh', 'Период, часов')}${inp('mm', 'и минут')}</div>
  ${seaT != null && p.sw === '' ? `<button class="btn mt" data-act="rfsea">Взять ${seaT} °C из StarConnect</button>` : ''}</section>
  <div class="grid2">${out('Расход за период', k != null ? num(k, 1) : '—', 'кВт·ч', 1)}${out('На один реф', per != null ? num(per, 3) : '—', 'кВт (кВт·ч в час)')}</div>
  <div class="note">Формула из таблицы: кВт·ч = (1,787 + 0,054 × t забортной воды) × число рефов × часы. Температура ограничивается диапазоном 5…35 °C.</div>`;
}

/* ---------- PMS Workboard ---------- */
const DS_RU = { Overdue: 'Просрочено', Due: 'Срок', 'Due Shortly': 'Скоро', 'Upcoming Due': 'Предстоит', 'Postponed to Drydock Approved': 'Перенесено в док' };
function pmsJobs() { return db.all('pmswb').filter(d => d.jobs).flatMap(d => d.jobs) }
function vPms() {
  const jobs = pmsJobs(), meta = db.get('pmswb/meta');
  if (!jobs.length) return `<div><h1>PMS Workboard</h1></div><div class="banner">Workboard ещё не загружен. Пришли мне свежую выгрузку maintenance-workboard.xlsx.</div>`;
  const planned = new Set(live().flatMap(t => (t.pms || []).map(p => p.no))), q = (S.pmQ || '').toLowerCase();
  const order = ['Overdue', 'Due', 'Postponed to Drydock Approved', 'Due Shortly', 'Upcoming Due'];
  const L = jobs.filter(j => (!S.pmDs || j.ds === S.pmDs) && (S.pmResp === 'all' || (S.pmResp === 'eng' ? /Engineer|Electrician/.test(j.resp) : j.resp === S.pmResp)) && (!S.pmFree || !planned.has(j.no))
    && (!q || (j.title + ' ' + j.eq + ' ' + j.no + ' ' + j.code).toLowerCase().includes(q))).sort((a, b) => order.indexOf(a.ds) - order.indexOf(b.ds) || (a.due || '9').localeCompare(b.due || '9'));
  const cnt = k => jobs.filter(j => j.ds === k && (S.pmResp === 'all' || (S.pmResp === 'eng' ? /Engineer|Electrician/.test(j.resp) : j.resp === S.pmResp))).length;
  const closed = live().filter(t => t.pmsClosed && t.status !== 'done');
  return `<div><h1>PMS Workboard</h1><div class="sub">${jobs.length} работ · выгрузка ${meta ? dlong(meta.date) : ''} · связь с планировщиком по номеру работы</div></div>
  ${closed.length ? `<section class="card"><h2 style="color:var(--blue)">Нет в Workboard — вероятно, закрыты в PMS · ${closed.length}</h2><div class="note">Проверь и отметь готовыми, если работа сделана.</div><div class="list mt">${closed.map(t => card(t, { day: true })).join('')}</div></section>` : ''}
  <section class="card"><div class="chips">${['', ...order].map(k => `<button class="chip" data-act="pmds" data-c="${k}" aria-pressed="${(S.pmDs || '') === k}">${k ? DS_RU[k] + ' · ' + cnt(k) : 'Все'}</button>`).join('')}</div>
   <div class="row mt"><input class="search" id="pmq" type="search" placeholder="Поиск: оборудование, название, номер" value="${esc(S.pmQ || '')}" aria-label="Поиск по PMS">
   <select class="search" style="width:auto" id="pmresp"><option value="eng"${S.pmResp === 'eng' ? ' selected' : ''}>Машинная команда</option><option value="all"${S.pmResp === 'all' ? ' selected' : ''}>Все ответственные</option>${[...new Set(jobs.map(j => j.resp))].sort().map(r => `<option${S.pmResp === r ? ' selected' : ''}>${esc(r)}</option>`).join('')}</select>
   <label class="sub"><input type="checkbox" data-act="pmfree" ${S.pmFree ? 'checked' : ''}> только не в плане</label></div></section>
  <div class="note">Найдено: ${L.length}${L.length > S.pmMore ? ', показаны первые ' + S.pmMore : ''}</div>
  <div class="list">${L.slice(0, S.pmMore).map(j => `<div class="lg${j.ds === 'Overdue' ? ' warnrow' : ''}"><div class="row between"><b>${esc(j.title)}</b><span class="tag ${j.ds === 'Overdue' ? 'warn' : ''}">${DS_RU[j.ds] || esc(j.ds)}</span></div>
    <div class="ld">${esc(j.eq)} · ${esc(j.freq)}${j.tol ? ' (±' + esc(j.tol) + ')' : ''} · ${esc(j.resp)}</div>
    <div class="row between"><span class="small">№ ${esc(j.no)} · ${esc(j.code || '')} · срок ${j.due ? dlong(j.due) + ' ' + j.due.slice(0, 4) : '—'}${j.ctr ? ' · по счётчику ' + num(j.ctr, 0) + ' ч (сейчас ' + num(j.rh, 0) + ')' : ''}${j.last ? ' · последний раз ' + j.last : ''} · ${esc(j.js)}</span>
    ${planned.has(j.no) ? '<span class="tag">в плане</span>' : `<button class="btn" data-act="pmadd" data-no="${esc(j.no)}">В план</button>`}</div></div>`).join('') || '<div class="empty">Ничего не найдено</div>'}</div>
  ${L.length > S.pmMore ? '<button class="btn" data-act="pmmore">Показать ещё</button>' : ''}`;
}

/* ---------- ME performance (StarConnect) ---------- */
const PERF = { load: [['pw', 'Мощность ГД, кВт', 0], ['rpm', 'Обороты, об/мин', 1], ['fi', 'Индекс топлива, %', 1], ['sog', 'Скорость, уз', 1]],
  exh: [1, 2, 3, 4, 5, 6].map(c => ['exh' + c, 'Цил. ' + c, 0]), pmax: [1, 2, 3, 4, 5, 6].map(c => ['pmax' + c, 'Цил. ' + c, 1]), pcomp: [1, 2, 3, 4, 5, 6].map(c => ['pcomp' + c, 'Цил. ' + c, 1]),
  tc: [['tc1', 'ТК1, об/мин', 0], ['tc2', 'ТК2, об/мин', 0], ['tcin1', 'ТК1 газ вход, °C', 0], ['tcin2', 'ТК2 газ вход, °C', 0], ['tcout1', 'ТК1 газ выход, °C', 0], ['tcout2', 'ТК2 газ выход, °C', 0]],
  air: [['scavP', 'Pscav, бар', 2], ['scavT', 'Tscav, °C', 1], ['exhP', 'Выпускной ресивер, бар', 2], ['sacIn1', 'Возд. охл. 1 вход, °C', 0], ['sacOut1', 'Возд. охл. 1 выход, °C', 1], ['sacIn2', 'Возд. охл. 2 вход, °C', 0], ['sacOut2', 'Возд. охл. 2 выход, °C', 1], ['sacCW', 'Охл. вода выход, °C', 1]],
  sys: [['jcw', 'ЦОВ выход, °C', 1], ['lo', 'Масло вход, °C', 1], ['hydP', 'Гидравлика, бар', 0], ['visc', 'Вязкость топлива, сСт', 1], ['fuelT', 'Т топлива, °C', 1], ['sea', 'Забортная вода, °C', 1], ['er', 'МО, °C', 1]],
  ae: [['ae1', 'ДГ1, кВт', 0], ['ae2', 'ДГ2, кВт', 0], ['ae3', 'ДГ3, кВт', 0], ['ae1h', 'ДГ1, ч', 0], ['ae2h', 'ДГ2, ч', 0], ['ae3h', 'ДГ3, ч', 0], ['whr', 'WHR, кВт', 0]] };
const PERF_T = { load: 'Нагрузка', exh: 'Т выхлопа по цилиндрам, °C', pmax: 'Pmax, бар', pcomp: 'Pcomp, бар', tc: 'Турбокомпрессоры', air: 'Продувочный воздух и охладители', sys: 'Системы', ae: 'ДГ и WHR' };
function vPerf() {
  if (S.pfTab === 'iso' || S.pfTab === 'pmi') return `<div><h1>ME performance</h1><div class="sub">Отчёты Conakry ISO (Managing Performance) и PMI</div></div>${ENG.perfTabs()}${S.pfTab === 'iso' ? ENG.isoView() : ENG.pmiView()}`;
  return vPerfSC();
}
function vPerfSC() {
  const meta = db.get('perf/meta'), days = db.all('perf').filter(d => /^day-/.test(d.id)).sort((a, b) => b.id.localeCompare(a.id));
  if (!meta) return `<div><h1>ME performance</h1></div>${ENG.perfTabs()}<div class="banner">Данных StarConnect ещё нет. Пришли мне выгрузку CAMS ICS (.xlsx) — разберу и загружу.</div>`;
  const grp = S.pfG || 'exh', defs = PERF[grp], sea = days.filter(d => d.n > 0), L = meta.last || {};
  const cyl = ['exh', 'pmax', 'pcomp'].includes(grp);
  const dev = (d, k) => { if (!cyl) return null; const vals = defs.map(x => d[x[0]]).filter(v => v != null); const m = vals.reduce((a, b) => a + b, 0) / vals.length; return d[k] != null ? d[k] - m : null };
  return `<div><h1>ME performance</h1><div class="sub">StarConnect / ACONIS · ${dlong(meta.from)} — ${dlong(meta.to)} · средние за сутки на ходу (ГД > 5000 кВт)</div></div>${ENG.perfTabs()}
  <section class="card"><h2>Последние значения · ${L.t ? L.t.replace('T', ' ') : ''}</h2><div class="grid4 mt">${[['pw', 'Мощность ГД', 'кВт', 0], ['rpm', 'Обороты', 'об/мин', 1], ['fi', 'Индекс топлива', '%', 1], ['scavP', 'Pscav', 'бар', 2]].map(([k, l, u, d]) => out(l, L[k] != null ? num(L[k], d) : '—', u)).join('')}</div>
  <div class="note mt">Осадка ${L.dfwd ?? '—'} / ${L.daft ?? '—'} м · забортная вода ${L.sea ?? '—'} °C · МО ${L.er ?? '—'} °C · ДГ: ${[1, 2, 3].map(i => L['ae' + i] > 50 ? 'ДГ' + i + ' ' + num(L['ae' + i], 0) + ' кВт' : '').filter(Boolean).join(', ') || 'нет нагрузки'}</div></section>
  <div class="tabs" role="tablist">${Object.keys(PERF).map(k => `<button role="tab" data-act="pfg" data-g="${k}" aria-selected="${grp === k}">${PERF_T[k].split(',')[0]}</button>`).join('')}</div>
  ${sea.length > 1 ? `<section class="card"><h2>${PERF_T[grp]}</h2>${perfChart(sea.slice().reverse(), defs)}<div class="legend">${defs.map((x, i) => `<span><i style="background:${CYL_COL[i % 6]}"></i>${esc(x[1])}</span>`).join('')}</div></section>` : ''}
  <section class="card"><h2>По суткам${cyl ? ' · отклонение от среднего по цилиндрам' : ''}</h2><div class="scroll mt"><table class="mtab"><thead><tr><th class="stick">Дата</th><th>Часов на ходу</th>${defs.map(x => `<th>${esc(x[1])}</th>`).join('')}</tr></thead><tbody>
  ${days.map(d => `<tr><th class="stick">${dlong(d.id.slice(4))}</th><td>${d.hours ?? ''}</td>${defs.map(([k, l, dp]) => { const v = d[k], dv = dev(d, k); return `<td>${v != null ? num(v, dp) : ''}${dv != null && d.n ? `<small class="${Math.abs(dv) > (grp === 'exh' ? 15 : 3) ? 'bad' : 'note'}"> ${dv > 0 ? '+' : ''}${num(dv, grp === 'exh' ? 0 : 1)}</small>` : ''}</td>` }).join('')}</tr>`).join('')}
  </tbody></table></div><div class="note">Отклонение подсвечивается, если оно больше 15 °C для выхлопа или 3 бар для давлений: это ориентир для глаза, а не лимит MAN.</div></section>`;
}
function perfChart(rows, defs) {
  const W = 640, H = 220, P = 44, n = rows.length, vals = rows.flatMap(r => defs.map(d => r[d[0]])).filter(v => v != null);
  if (!vals.length) return '<div class="empty">Нет данных</div>';
  let mn = Math.min(...vals), mx = Math.max(...vals); const pad = (mx - mn) * .1 || 1; mn -= pad; mx += pad;
  const x = i => P + (n < 2 ? 0 : i / (n - 1) * (W - P - 12)), y = v => H - 26 - (v - mn) / (mx - mn) * (H - 44);
  const ticks = [0, .25, .5, .75, 1].map(f => mn + (mx - mn) * f);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Тренд">${ticks.map(t => `<line x1="${P}" x2="${W - 10}" y1="${y(t)}" y2="${y(t)}" class="gl"/><text x="${P - 6}" y="${y(t) + 4}" text-anchor="end">${num(t, mx - mn < 10 ? 1 : 0)}</text>`).join('')}
  ${rows.map((r, i) => i % Math.ceil(n / 8) === 0 ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${r.id.slice(12, 14)}.${r.id.slice(9, 11)}</text>` : '').join('')}
  ${defs.map((d, k) => { let p = '', pen = false; rows.forEach((r, i) => { const v = r[d[0]]; if (v == null) { pen = false; return } p += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); pen = true }); return `<path d="${p}" fill="none" stroke="${CYL_COL[k % 6]}" stroke-width="2" stroke-linejoin="round"/>` }).join('')}</svg>`;
}

/* ---------- Bearing Wear Monitoring (Kongsberg BWCM) ---------- */
const BWM_M = { dev: 'Отклонение цилиндра (DEV), мм', s1: 'Датчик носовой (SNS 1 DEV), мм', s2: 'Датчик кормовой (SNS 2 DEV), мм', mb: 'Рамовые подшипники (DMMB SUM), мм' };
function vBwm() {
  const meta = db.get('bwm/meta'), months = db.all('bwm').filter(d => /^m-/.test(d.id)).sort((a, b) => a.month.localeCompare(b.month)), lim = db.get('meta/bwmlimits') || {};
  if (!months.length) return `<div><h1>Bearing Wear Monitoring</h1><div class="sub">Kongsberg BWM</div></div><div class="banner">Данных BWM ещё нет. Пришли архив KM-Service (.zip) — разберу и загружу тренды.</div>`;
  const met = S.bwM || 'dev', last = months[months.length - 1], yago = months.find(m => m.month === String(+last.month.slice(0, 4) - 1) + last.month.slice(4)) || months[Math.max(0, months.length - 13)];
  const base = months.find(m => m.month >= '2016-01' && Object.keys(m.cyl).length === 6) || months[0];
  const val = (m, c) => met === 'mb' ? (m.mb || {})[c] : m.cyl[c] && m.cyl[c][met];
  const L = +lim.dev || null, cyls = met === 'mb' ? [2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6];
  const st = (meta && meta.status) || {}, from = S.bwFrom || '';
  const shown = months.filter(m => !from || m.month >= from);
  return `<div><h1>Bearing Wear Monitoring</h1><div class="sub">${esc(meta?.system || 'Kongsberg BWM')} · ${esc(meta?.engine || '')} · данные ${dlongM(months[0].month)} — ${dlongM(last.month)}</div></div>
  <section class="card"><div class="row between"><h2>Состояние по цилиндрам</h2><span class="sub">статус системы на ${meta ? dlong(meta.statusDate) : '—'}</span></div>
   <div class="cyl mt">${[1, 2, 3, 4, 5, 6].map(c => { const now = last.cyl[c] && last.cyl[c].dev, d12 = now != null && yago.cyl[c] ? now - yago.cyl[c].dev : null, d0 = now != null && base.cyl[c] ? now - base.cyl[c].dev : null, s = st[c];
     return `<div class="cy${s === 'Alarm' || (L && Math.abs(now) >= L) ? ' bad' : ''}"><span class="lbl">Цил. ${c}${s ? ' · ' + (s === 'Alarm' ? '<span class="bad">Alarm</span>' : 'Normal') : ''}</span><b>${now != null ? fmtmm(now) : '—'}</b><span class="lbl">за год ${d12 != null ? sign(d12) : '—'} · с ${base.month.slice(0, 4)} ${d0 != null ? sign(d0) : '—'}</span></div>` }).join('')}</div>
   <div class="note mt">DEV — медиана за ${dlongM(last.month)}: смещение положения крейцкопфа в НМТ относительно эталона, мм. Отражает суммарный износ рамового, мотылевого и крейцкопфного подшипников цилиндра. «Alarm» — статус в самой системе Kongsberg${meta?.hi?.length ? `; последние превышения HI: ${meta.hi.slice(-3).map(h => esc(h.date.slice(0, 10)) + ' ' + esc(h.msg.replace(/.*tag (\S+)\. .*Value = ([\d.]+).*/, '$1 = $2'))).join('; ')}` : ''}.</div></section>
  <section class="card"><div class="row between"><h2>Тренд · ${BWM_M[met]}</h2><div class="row"><select class="search" style="width:auto" id="bwfrom" aria-label="Период"><option value="">С ${months[0].month.slice(0, 4)}</option>${['2020-01', '2022-01', '2024-01', '2025-11'].map(v => `<option value="${v}"${from === v ? ' selected' : ''}>С ${v.slice(0, 4) === '2025' ? 'последнего года' : v.slice(0, 4)}</option>`).join('')}</select></div></div>
   <div class="chips mt">${Object.entries(BWM_M).map(([k, l]) => `<button class="chip" data-act="bwm" data-m="${k}" aria-pressed="${met === k}">${l.split(',')[0]}</button>`).join('')}</div>
   ${bwmChart(shown, cyls, c => m => val(m, c), met === 'mb' ? null : L)}
   <div class="legend">${cyls.map(c => `<span><i style="background:${CYL_COL[c - 1]}"></i>${met === 'mb' ? 'Рам. ' + c : 'Цил. ' + c}</span>`).join('')}${L && met !== 'mb' ? `<span><i style="background:var(--red)"></i>предел ±${L} мм</span>` : ''}</div></section>
  <section class="card"><h2>Таблица по месяцам · ${BWM_M[met]}</h2><div class="scroll mt"><table class="mtab"><thead><tr><th class="stick">Месяц</th><th>Наработка</th>${cyls.map(c => `<th>${met === 'mb' ? 'Рам. ' : 'Цил. '}${c}</th>`).join('')}</tr></thead><tbody>
   ${shown.slice().reverse().slice(0, S.bwAll ? 999 : 24).map((m, i, arr) => { const prev = arr[i + 1]; return `<tr class="click" data-act="bwday" data-m="${m.month}"><th class="stick">${dlongM(m.month)}</th><td>${m.rh ? num(m.rh, 0) : ''}</td>${cyls.map(c => { const v = val(m, c), p = prev ? val(prev, c) : null, d = v != null && p != null ? v - p : null;
     return `<td class="${L && met !== 'mb' && v != null && Math.abs(v) >= L ? 'bad' : ''}">${v != null ? fmtmm(v) : ''}${d != null && Math.abs(d) >= .005 ? `<small class="${d > 0 ? 'up' : 'dn'}"> ${sign(d)}</small>` : ''}</td>` }).join('')}</tr>` }).join('')}
   </tbody></table></div>${shown.length > 24 && !S.bwAll ? `<button class="btn mt" data-act="bwall">Показать все месяцы (${shown.length})</button>` : ''}<div class="note">Нажми на месяц, чтобы открыть значения по дням. Изменение к прошлому месяцу показано, если оно не меньше 0,005 мм.</div></section>
  ${S.bwDay ? bwmDays(months.find(m => m.month === S.bwDay)) : ''}
  <section class="card"><h2>Пределы алармов</h2><div class="note">Впиши предел отклонения DEV из настроек системы Kongsberg на судне или из инструкции MAN. Значения, достигшие предела, подсветятся красным, на графике появится линия.</div>
   <form id="bwlimf" class="fg mt"><label class="f">Предел DEV, ± мм<input inputmode="decimal" type="number" step="any" name="dev" value="${esc(lim.dev ?? '')}"></label><div class="f" style="justify-content:flex-end"><button class="btn">Сохранить предел</button></div></form></section>
  ${meta && meta.events ? `<section class="card"><h2>Журнал событий системы</h2><div class="note">По месяцам, до ${esc(meta.eventsTo.slice(0, 10))}</div><div class="scroll mt"><table class="stack"><thead><tr><th>Месяц</th><th>Событие</th><th>Раз</th></tr></thead><tbody>${meta.events.slice(0, 15).map(e => `<tr><td data-l="Месяц">${esc(e.month)}</td><td data-l="Событие">${esc(e.what)}</td><td data-l="Раз">${e.n}</td></tr>`).join('')}</tbody></table></div></section>` : ''}`;
}
const fmtmm = v => (v > 0 ? '+' : '') + num(v, 3);
const sign = v => (v > 0 ? '+' : '') + num(v, 3);
const dlongM = m => MON1[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4);
function bwmChart(months, cyls, getter, L) {
  const W = 680, H = 240, P = 48, n = months.length, vals = months.flatMap(m => cyls.map(c => getter(c)(m))).filter(v => v != null);
  let mn = Math.min(...vals, L ? -L : 0), mx = Math.max(...vals, L ? L : 0); const pad = (mx - mn) * .08 || .01; mn -= pad; mx += pad;
  const x = i => P + (n < 2 ? 0 : i / (n - 1) * (W - P - 12)), y = v => H - 26 - (v - mn) / (mx - mn) * (H - 44);
  const step = (mx - mn) > .2 ? .05 : (mx - mn) > .08 ? .02 : .01, ticks = []; for (let t = Math.ceil(mn / step) * step; t <= mx; t += step) ticks.push(+t.toFixed(3));
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Тренд BWM">${ticks.map(t => `<line x1="${P}" x2="${W - 10}" y1="${y(t)}" y2="${y(t)}" class="gl"${t === 0 ? ' style="stroke:#3A4A5C"' : ''}/><text x="${P - 6}" y="${y(t) + 4}" text-anchor="end">${num(t, 2)}</text>`).join('')}
   ${L ? [L, -L].map(l => `<line x1="${P}" x2="${W - 10}" y1="${y(l)}" y2="${y(l)}" stroke="var(--red)" stroke-dasharray="5 4"/>`).join('') : ''}
   ${months.map((m, i) => m.month.endsWith('-01') && (n < 40 || +m.month.slice(0, 4) % 2 === 0) ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${n < 30 ? m.month.slice(5, 7) + '.' : ''}${m.month.slice(0, 4)}</text>` : '').join('')}
   ${cyls.map(c => { let p = '', pen = false; months.forEach((m, i) => { const v = getter(c)(m); if (v == null) { pen = false; return } p += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); pen = true }); return `<path d="${p}" fill="none" stroke="${CYL_COL[c - 1]}" stroke-width="2" stroke-linejoin="round"/>` }).join('')}</svg>`;
}
function bwmDays(m) {
  if (!m || !m.days || !m.days.length) return '';
  const rows = m.days.map(d => ({ month: d[0], vals: d.slice(1) }));
  return `<section class="card"><div class="row between"><h2>${dlongM(m.month)} по дням · DEV, мм</h2><button class="btn" data-act="bwday" data-m="">Закрыть</button></div>
   ${bwmChart(rows, [1, 2, 3, 4, 5, 6], c => r => r.vals[c - 1], +(db.get('meta/bwmlimits') || {}).dev || null)}
   <div class="scroll mt"><table class="mtab"><thead><tr><th class="stick">Дата</th>${[1, 2, 3, 4, 5, 6].map(c => `<th>Цил. ${c}</th>`).join('')}</tr></thead><tbody>${rows.slice().reverse().map(r => `<tr><th class="stick">${dlong(r.month)}</th>${r.vals.map(v => `<td>${v != null ? fmtmm(v) : ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
}

/* ---------- Ещё (телефон) ---------- */
function vMore() {
  const c = counts(), n = c.over + c.inbox + c.stale;
  const it = (href, title, sub, badge) => `<a class="t" href="${href}"><div class="tb"><span class="tt">${title}</span><span class="small">${sub}</span></div>${badge ? `<span class="tag warn">${badge}</span>` : ''}</a>`;
  return `<div><h1>Ещё</h1><div class="sub">Остальные разделы</div></div><div class="list">
   ${it('#rhrs', 'Наработка ГД', 'Компоненты: клапаны, форсунки, поршни, втулки, HCU')}
   ${it('#pms', 'PMS Workboard', 'Работы из ShipManager, связь с планировщиком')}
   ${it('#notes', 'Заметки', 'Голосовая диктовка, перенос в задачи и вопросы Claude')}
   ${it('#perf', 'ME performance', 'StarConnect по суткам · отчёты ISO · PMI по цилиндрам')}
   ${it('#equip', 'Оборудование и неисправности', 'Узлы из PMS, карточки, история отказов с поиском по сигналу')}
   ${it('#lochart', 'Заправка систем', 'Lube Oil Chart: литры по механизмам и танкам, запас на борту')}
   ${it('#oil', 'Анализы масла', 'VPS OCM: все агрегаты, история и тренды')}
   ${it('#dg', 'ДГ performance', 'AE1–AE3: Doctor, ISO, формы, по цилиндрам')}
   ${it('#fuel', 'Расход топлива', 'StarConnect расходомеры: сутки, SFOC по нагрузке, счётчики')}
   ${it('#log', 'Logbook', 'Scrape-down ГД · ORB Part I · Biofouling')}
   ${it('#reefer', 'Рефы', 'Расход энергии на рефконтейнеры')}
   ${it('#alerts', 'Уведомления', 'Просрочки, входящие, устаревшие источники', n || '')}
   ${it('#bwm', 'Bearing monitoring', 'Kongsberg BWM · месячные отчёты')}
   ${it('#sync', 'Синхронизация', 'Облако, резервная копия, источники, настройки')}</div>
   <section class="card"><h2>Скоро</h2><div class="note mt">Заказы и заявки · Каталог запчастей · Оборудование · История неисправностей · Док 2026 и ABS · Handover · Почта</div></section>`;
}

/* ---------- editor ---------- */
const closeBtn = () => `<button type="button" class="btn ghost" data-act="close" aria-label="Закрыть"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
function openEd(id, preset) {
  const isNew = !id; const t = isNew ? { id: uid('t'), title: '', note: '', cat: 'Текущие', prio: 2, owner: '', phase: '', due: '', day: preset || S.sel || today(), slot: '', status: 'todo', waiting: '', moved: 0, repeat: '', notion: '', trello: '', source: 'Вручную', created: today(), doneAt: '' } : { ...S.tasks.get(id) };
  if (!t || !t.id) return; S.edit = { t, isNew };
  const opts = (o, v) => Object.entries(o).map(([k, x]) => `<option value="${k}"${k === (v || '') ? ' selected' : ''}>${x}</option>`).join('');
  $('#modal').innerHTML = `<form class="sheet" id="edf"><div class="row between"><h2 id="mt">${isNew ? 'Новая задача' : 'Задача'}</h2>${closeBtn()}</div>
  <label class="f" style="position:relative">Название<input name="title" required value="${esc(t.title)}" style="padding-right:46px">${SR ? '<button type="button" class="mic" data-act="mic" aria-label="Надиктовать"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>' : ''}</label>
  <div class="fg">
   <label class="f">Категория<select name="cat">${CATS.map(c => `<option${c === t.cat ? ' selected' : ''}>${c}</option>`).join('')}</select></label>
   <label class="f">Приоритет<select name="prio">${[1, 2, 3, 4].map(p => `<option value="${p}"${p == t.prio ? ' selected' : ''}>P${p}</option>`).join('')}</select></label>
   <label class="f">День (когда делаю)<input type="date" name="day" value="${esc(t.day || '')}"></label>
   <label class="f">Срок (крайняя дата)<input type="date" name="due" value="${esc(t.due || '')}"></label>
   <label class="f">Время дня<select name="slot">${opts(SLOTS, t.slot)}</select></label>
   <label class="f">Статус<select name="status">${opts(ST, t.status)}</select></label>
   <label class="f">Ждём от кого<input name="waiting" value="${esc(t.waiting || '')}" placeholder="суперинтендант, байер, сервис…"></label>
   <label class="f">Ответственный<input name="owner" value="${esc(t.owner || '')}"></label>
   <label class="f">Повтор<select name="repeat">${opts(REP, t.repeat)}</select></label>
  </div>
  <div class="row"><span class="sub">Быстро:</span><button type="button" class="chip" data-act="qd" data-d="0">Сегодня</button><button type="button" class="chip" data-act="qd" data-d="1">Завтра</button><button type="button" class="chip" data-act="qd" data-d="7">+ неделя</button><button type="button" class="chip" data-act="qd" data-d="x">Без даты</button></div>
  <label class="f">Заметка<textarea name="note">${esc(t.note || '')}</textarea></label>
  <div class="note">${[t.notion ? `<a href="${esc(t.notion)}" target="_blank" rel="noopener">Файлы в Notion</a>` : '', t.trello ? `<a href="${esc(t.trello)}" target="_blank" rel="noopener">Карточка Trello</a>` : '', t.phase ? 'Этап: ' + esc(t.phase) : '', t.source ? 'Источник: ' + esc(t.source) : '', t.moved ? 'Переносов: ' + t.moved : ''].filter(Boolean).join(' · ')}</div>
  <div class="row between"><div>${isNew ? '' : '<button type="button" class="btn danger" data-act="del">Удалить</button>'}</div><div class="row"><button type="button" class="btn" data-act="close">Отмена</button><button class="btn pri">Сохранить</button></div></div></form>`;
  $('#modal').hidden = false; setTimeout(() => $('#edf [name=title]')?.focus(), 30);
}
function closeEd() { $('#modal').hidden = true; $('#modal').innerHTML = ''; S.edit = null; if (rec) { try { rec.stop() } catch (e) {} rec = null } }
function mic(btn) {
  if (rec) { rec.stop(); return }
  const input = $('#edf [name=title]'), base = input.value ? input.value + ' ' : '';
  rec = new SR(); rec.lang = 'ru-RU'; rec.interimResults = true; rec.continuous = true;
  rec.onresult = e => { let s = ''; for (const r of e.results) s += r[0].transcript; input.value = base + s };
  rec.onstart = () => btn.classList.add('on');
  rec.onend = () => { btn.classList.remove('on'); rec = null };
  rec.onerror = e => { toast(e.error === 'not-allowed' ? 'Нет доступа к микрофону' : 'Микрофон: ' + e.error) };
  try { rec.start() } catch (e) { toast('Микрофон недоступен'); rec = null }
}

/* ---------- render ---------- */
function render() {
  const m = $('#main'); const keep = focusSel(document.activeElement);
  m.innerHTML = { plan: vPlan, alerts: vAlerts, tanks: vTanks, lube: vLube, log: vLog, rhrs: vRhrs, reefer: vReefer, pms: vPms, perf: vPerf, bwm: vBwm, sync: vSync, more: vMore, ...ENG.VIEWS, ...EQ.VIEWS }[S.view]?.() ?? vToday();
  document.querySelectorAll('[data-v]').forEach(a => a.setAttribute('aria-current', a.dataset.v === S.view || (a.hasAttribute('data-more') && ['alerts', 'bwm', 'sync', 'log', 'rhrs', 'pms', 'perf', 'reefer', 'oil', 'dg', 'fuel', 'notes', 'lochart', 'equip'].includes(S.view)) ? 'page' : 'false'));
  const c = counts(), n = c.over + c.inbox + c.stale; document.querySelectorAll('[data-cnt]').forEach(x => { x.hidden = !n; x.textContent = n });
  const st = db.status; $('#sfoot').textContent = { local: 'На устройстве', idle: 'Синхронизировано', syncing: 'Синхронизация…', offline: 'Офлайн', error: 'Ошибка синхронизации' }[st.state];
  $('#sdot').style.background = { local: 'var(--mute)', idle: 'var(--green)', syncing: 'var(--blue)', offline: 'var(--acc)', error: 'var(--red)' }[st.state];
  $('#fab').hidden = !['today', 'plan', 'alerts'].includes(S.view);
  if (keep) { const el = $(keep); if (el) { el.focus(); try { if (el.type !== 'number' && el.type !== 'date') el.setSelectionRange(el.value.length, el.value.length) } catch (e) {} } }
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
  const f = ae.form; if (f && f.id && ae.name) return `#${q(f.id)} [name="${q(ae.name)}"]`;
  return null;
}
function route() { const h = location.hash.slice(1); S.view = VIEWS.includes(h) ? h : 'today'; render(); window.scrollTo(0, 0) }
addEventListener('hashchange', route);
addEventListener('resize', () => { if (S.view === 'plan') render() });

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return; const a = el.dataset.act;
  if (ENG.onClick(a, el, e) || EQ.onClick(a, el, e)) return;
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
  if (a === 'decline') { const t = S.tasks.get(el.dataset.id); if (t) { const p = { ...t }; t.status = 'dropped'; saveTask(t, 'Отклонено', p) } }
  if (a === 'syncall') { if (!db.remoteConfig()) { toast('Облако не подключено: всё сохранено на устройстве'); return } db.syncNow().then(r => toast('Готово: получено ' + r.pulled + ', отправлено ' + r.pushed)).catch(e => toast(e.message)); render() }
  if (a === 'close') closeEd();
  if (a === 'qd') { const f = $('#edf'); const v = el.dataset.d; f.day.value = v === 'x' ? '' : add(today(), +v) }
  if (a === 'del') { if (el.dataset.sure) { const t = S.tasks.get(S.edit.t.id); const p = { ...t }; t.status = 'dropped'; closeEd(); saveTask(t, 'Удалено', p) } else { el.dataset.sure = '1'; el.textContent = 'Точно удалить?' } }
  if (a === 'mic' && SR) mic(el);
  if (a === 'ltab') { S.lubeTab = el.dataset.t; render() }
  if (a === 'ttab') { S.tankTab = el.dataset.t; render() }
  if (a === 'rhedit') openRh(el.dataset.g, +el.dataset.i);
  if (a === 'rhgo') { e.preventDefault(); document.getElementById('g-' + el.dataset.g)?.scrollIntoView({ behavior: 'smooth' }) }
  if (a === 'rfsea') { S.rfDraft.sw = db.get('perf/meta').last.sea; put('meta/reefer', { ...S.rfDraft }).then(render) }
  if (a === 'pmds') { S.pmDs = el.dataset.c; S.pmMore = 80; render() }
  if (a === 'pmfree') { S.pmFree = el.checked; render() }
  if (a === 'pmmore') { S.pmMore += 200; render() }
  if (a === 'pmadd') { const j = pmsJobs().find(x => x.no === el.dataset.no); if (j) { const t = { id: 't-pms-' + j.no.replace(/\D/g, ''), title: j.title, note: `PMS ${j.no} · ${j.eq} · ${j.freq}`, cat: 'PMS', prio: j.ds === 'Overdue' ? 1 : 2, owner: j.resp, due: j.due, day: j.due && j.due > today() ? j.due : today(), status: 'todo', source: 'Workboard', pms: [{ no: j.no, ds: j.ds, js: j.js, due: j.due }], created: today() }; saveTask(t, 'Добавлено в план на ' + dshort(t.day), { id: t.id, _new: true }) } }
  if (a === 'pfg') { S.pfG = el.dataset.g; render() }
  if (a === 'bwall') { S.bwAll = true; render() }
  if (a === 'bwm') { S.bwM = el.dataset.m; render() }
  if (a === 'bwday') { S.bwDay = el.dataset.m; render(); if (S.bwDay) setTimeout(() => document.querySelector('[data-act=bwday][data-m=""]')?.scrollIntoView({ block: 'center' }), 50) }
  if (a === 'lgtab') { S.logTab = el.dataset.t; S.lgMore = 100; S.lgQ = ''; S.lgYear = null; render() }
  if (a === 'lgcode') { S.lgCode = el.dataset.c; S.lgMore = 100; render() }
  if (a === 'lgmore') { S.lgMore += 200; render() }
  if (a === 'scsave') { const D = S.scDraft, n = v => v === '' || v == null ? null : +v;
    if (!D.date) { toast('Укажи дату'); return } const fe = D.fe.map(n), bn = D.bn.map(n);
    if (fe.every(v => v == null) && bn.every(v => v == null)) { toast('Нет ни одного значения Fe или BN'); return }
    const id = D.date + 'T' + (D.time || '').replace(':', ''), old = db.get('scrape/' + id);
    put('scrape/' + id, { date: D.date, time: D.time, rh: n(D.rh), fe, bn, remarks: D.remarks, by: 'Ярослав' }).then(() => { S.scDraft = null; render(); toast(old ? 'Замер ' + dlong(D.date) + ' ' + D.time + ' заменён' : 'Замер сохранён') });
    const lim = db.get('meta/scrapelimits') || {}, hi = lim.feMax ? fe.map((v, i) => v > lim.feMax ? 'цил. ' + (i + 1) + ' Fe ' + v : '').filter(Boolean) : [];
    feed('Scrape-down ' + dlong(D.date) + ': Fe ср. ' + num(avg(fe), 0) + ' ppm' + (hi.length ? ' · выше предела: ' + hi.join(', ') : '')) }
  if (a === 'scopen') { const r = db.get('scrape/' + el.dataset.rid); if (r) { S.scDraft = { date: r.date, time: r.time || '', rh: r.rh ?? '', fe: r.fe.map(v => v ?? ''), bn: r.bn.map(v => v ?? ''), remarks: r.remarks || '' }; render(); scrollTo(0, 0); toast('Замер открыт для правки') } }
  if (a === 'sday') { S.sDate = add(S.sDate || today(), +el.dataset.d); render() }
  if (a === 'tday') { S.sDate = el.dataset.d; S.tankTab = 'daily'; render(); scrollTo(0, 0) }
  if (a === 'tmo') { S.tmOff += +el.dataset.d; render() }
  if (a === 'tmu') { S.tmUnit = el.dataset.u; render() }
  if (a === 'tmcsv') monthCSV();
  if (a === 'ssave') { const { _date, ...vals } = S.sDraft; for (const k in vals) if (vals[k] === '') delete vals[k]; else vals[k] = +vals[k];
    put('soundings/' + _date, { values: vals, by: 'Ярослав', at: new Date().toISOString() }).then(() => { S.sDraft = null; render(); toast('Замеры за ' + dlong(_date) + ' сохранены') }) }
  if (a === 'robsave') { const I = robInputs(), r = T.computeROB(foMeta(), foCal(), I), id = I.date + '-' + Date.now().toString(36);
    const tanks = {}; for (const [k, v] of Object.entries(I.tanks)) if (v && (v.value !== '' && v.value != null || v.density !== '' || v.temp !== '')) tanks[k] = v;
    put('rob/' + id, { date: I.date, place: I.place, event: I.event, fwd: I.fwd, aft: I.aft, logHfo: I.logHfo, logDo: I.logDo, tanks, trim: r.trim, sum: r.sum }).then(() => { render(); toast('Расчёт сохранён') });
    feed(`ROB ${I.event}: HFO ${num(r.sum.HFO.t, 1)} т, DO ${num(r.sum.DO.t, 1)} т`) }
  if (a === 'robopen') { const h = db.get('rob/' + el.dataset.rid); if (h) { S.robDraft = { date: h.date, place: h.place || '', event: h.event || 'Quantity check', fwd: h.fwd, aft: h.aft, logHfo: h.logHfo || '', logDo: h.logDo || '', tanks: JSON.parse(JSON.stringify(h.tanks || {})) }; render(); scrollTo(0, 0); toast('Открыт расчёт ' + dlong(h.date) + '. Изменишь — сохрани как новый') } }
  if (a === 'rowadd') openRow(el.dataset.col);
  if (a === 'rowedit') openRow(el.dataset.col, el.dataset.rid);
  if (a === 'rowdel') { if (el.dataset.sure) { const p = S.edit.col + '/' + S.edit.rid, body = db.get(p); closeEd(); db.del(p).then(() => { render(); toast('Удалено', { _row: p, body }) }) } else { el.dataset.sure = '1'; el.textContent = 'Точно удалить?' } }
  if (a === 'export') { const b = new Blob([JSON.stringify(db.exportAll())], { type: 'application/json' }); const u = URL.createObjectURL(b); const l = document.createElement('a'); l.href = u; l.download = 'mcv-workbench-' + today() + '.json'; l.click(); setTimeout(() => URL.revokeObjectURL(u), 2000) }
  if (a === 'unlink') { db.setRemote(null).then(() => { render(); toast('Облако отключено, данные остались на устройстве') }) }
  if (a === 'gencode') { const b = crypto.getRandomValues(new Uint8Array(24)); $('#remf [name=space]').value = 'mcv-' + [...b].map(x => x.toString(36).padStart(2, '0')).join('').slice(0, 36); toast('Код создан: сохрани его, он нужен на втором устройстве') }
  if (a === 'update') { if (!S.reg) { location.reload(); return } toast('Проверяю…'); S.reg.update().then(() => { if (!S.reg.installing && !S.reg.waiting) toast('Установлена последняя версия ' + VERSION) }).catch(() => toast('Нет связи с сервером')) }
  if (a === 'install' && S.install) { S.install.prompt(); S.install = null }
});
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeEd() });
addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeEd() });
document.addEventListener('input', e => {
  if (ENG.onInput(e) || EQ.onInput(e)) return;
  if (e.target.id === 'q') { S.q = e.target.value; clearTimeout(S.qt); S.qt = setTimeout(render, 200) }
  const ds = e.target.dataset || {};
  if (ds.rf) { S.rfDraft[ds.rf] = e.target.value; clearTimeout(S.ct); S.ct = setTimeout(() => put('meta/reefer', { ...S.rfDraft }).then(render), 300) }
  if (e.target.id === 'pmq') { S.pmQ = e.target.value; S.pmMore = 80; clearTimeout(S.qt); S.qt = setTimeout(render, 250) }
  if (ds.sc) { const D = S.scDraft; if (ds.i != null) D[ds.sc][+ds.i] = e.target.value; else D[ds.sc] = e.target.value }
  if (e.target.id === 'lgq') { S.lgQ = e.target.value; S.lgMore = 100; clearTimeout(S.qt); S.qt = setTimeout(render, 250) }
  if (ds.snd) { S.sDraft[ds.snd] = e.target.value; clearTimeout(S.st); S.st = setTimeout(render, 350) }
  if (ds.rob) { const I = robInputs(); (I.tanks[ds.rob] ||= {})[ds.f] = e.target.value; clearTimeout(S.st); S.st = setTimeout(render, 400) }
  if (e.target.form && e.target.form.id === 'robh') { robInputs()[e.target.name] = e.target.value; clearTimeout(S.st); S.st = setTimeout(render, 400) }
  if (ds.lo) { const p = lubeOrderState(), [a, b] = ds.lo.split('.'); if (b) p[a][b] = e.target.value; else p[a] = e.target.value; clearTimeout(S.ct); S.ct = setTimeout(() => put('meta/lubeorder', JSON.parse(JSON.stringify(p))).then(render), 300) }
  if (e.target.dataset.clo !== undefined) { const p = cloState(); p[e.target.name] = e.target.value; clearTimeout(S.ct); S.ct = setTimeout(() => { put('meta/clo', p).then(render) }, 250) }
});
document.addEventListener('change', e => {
  if (e.target.id === 'pmresp') { S.pmResp = e.target.value; render() }
  if (e.target.id === 'bwfrom') { S.bwFrom = e.target.value; render() }
  if (e.target.id === 'lgyear') { S.lgYear = e.target.value; S.lgMore = 100; render() }
  if (e.target.id === 'sdate' && e.target.value) { S.sDate = e.target.value; render() }
  if (e.target.id === 'impf' && e.target.files[0]) { e.target.files[0].text().then(t => db.importAll(JSON.parse(t))).then(n => { toast('Загружено записей: ' + n) }).catch(x => toast(x.message)) }
});
document.addEventListener('submit', e => {
  e.preventDefault(); const id = e.target.id, f = new FormData(e.target);
  if (ENG.onSubmit(id, f) || EQ.onSubmit(id, f)) return;
  if (id === 'edf' && S.edit) { const t = { ...S.edit.t }, prev = S.edit.isNew ? { id: t.id, _new: true } : { ...S.tasks.get(t.id) };
    for (const k of ['title', 'cat', 'day', 'due', 'slot', 'status', 'waiting', 'owner', 'repeat', 'note']) t[k] = String(f.get(k) || '').trim();
    t.prio = +f.get('prio') || 3; if (!t.title) return; if (t.status === 'done' && !t.doneAt) t.doneAt = today();
    const nw = S.edit.isNew; closeEd(); saveTask(t, nw ? 'Задача добавлена' : 'Сохранено', prev); if (nw) feed('Новая задача: ' + t.title) }
  if (id === 'rowf' && S.edit) { const body = {}; for (const [k, v] of f.entries()) if (String(v).trim() !== '') body[k] = String(v).trim();
    const p = S.edit.col + '/' + S.edit.rid; body.updatedBy = 'Ярослав'; closeEd(); put(p, body).then(() => { render(); toast('Сохранено') }) }
  if (id === 'rhf') { const v = +f.get('rh'); if (!v) return; const cur = db.get('rhrs-meta/current'); if (cur && v < cur.rh) { toast('Наработка меньше прежней (' + cur.rh + '). Проверь цифру'); return }
    put('rhrs-meta/current', { rh: v, date: today(), by: 'Ярослав' }); put('rhrslog/' + today(), { rh: v, date: today() }).then(render); toast('Наработка ГД ' + num(v, 0) + ' ч сохранена') }
  if (id === 'rhrow' && S.edit && S.edit.rh) { const g = JSON.parse(JSON.stringify(db.get('rhrs/' + S.edit.gid))), r = g.rows[S.edit.i];
    for (const [k, v] of f.entries()) { if (k === '_interval') { if (v) g.interval = +v; continue } if (k === '_pid') { r.id = v; continue } r[k] = ['rhInst', 'prior', 'own'].includes(k) ? (v === '' ? null : +v) : v }
    const gid = S.edit.gid; delete g.id; closeEd(); put('rhrs/' + gid, g).then(() => { render(); toast('Сохранено: ' + g.title + ' · ' + r.pos) }) }
  if (id === 'bwlimf') { const v = f.get('dev'); put('meta/bwmlimits', v ? { dev: +v } : {}).then(render); toast('Предел сохранён') }
  if (id === 'limf') { const l = {}; for (const [k, v] of f.entries()) if (v !== '') l[k] = +v; put('meta/scrapelimits', l).then(render); toast('Пределы сохранены') }
  if (id === 'setf') { const s = { ...S.settings }; for (const [k, v] of f.entries()) s[k] = k === 'dayLimit' ? Number(v) || 8 : String(v); S.settings = s; put('meta/settings', s).then(render); toast('Настройки сохранены') }
  if (id === 'remf') { const cfg = Object.fromEntries(f.entries()); if ((cfg.space || '').trim().length < 24) { toast('Код пространства — минимум 24 символа. Нажми «Создать код»'); return } toast('Подключаю…'); db.setRemote(cfg).then(r => { render(); toast(r && r.pulled !== undefined ? 'Подключено: получено ' + r.pulled + ', отправлено ' + r.pushed : 'Сохранено') }).catch(x => { render(); toast(x.message) }) }
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
addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.install = e; if (S.view === 'sync') render() });

/* ---------- start ---------- */
(async () => {
  try {
    await db.init();
    await db.seedIfEmpty('data/seed.json');
  } catch (e) { $('#main').innerHTML = `<div class="banner red">Не удалось открыть хранилище: ${esc(e.message)}</div>`; return }
  load(); S.loaded = true;
  db.on(() => { load(); if (!S.edit) render() });
  route(); rollover();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => { S.reg = r; setInterval(() => r.update().catch(() => {}), 30 * 60000) }).catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !S.edit) toast('Приложение обновлено до новой версии', null) || setTimeout(() => location.reload(), 600) });
  }
})();
