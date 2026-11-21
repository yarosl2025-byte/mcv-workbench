import * as db from './store.js';
import * as CLO from './clo.js';
import * as T from './tanks.js';

const VERSION = '0.2.2';
const CATS = ['Док', 'PMS', 'ABS', 'Заказы', 'Офис', 'Текущие', 'IT', 'Logbook', 'Отчёты', 'Почта'];
const ST = { inbox: 'Входящие', todo: 'Нужно сделать', doing: 'В работе', wait: 'Ждём', done: 'Готово' };
const SLOTS = { '': 'Без времени', am: 'Утро', noon: 'До обеда', pm: 'После обеда', eve: 'Вечер' };
const REP = { '': 'Нет', daily: 'Каждый день', weekly: 'Каждую неделю', monthly: 'Каждый месяц' };
const DOW = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MON1 = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const VIEWS = ['today', 'plan', 'alerts', 'tanks', 'lube', 'bwm', 'sync', 'more'];

const S = { tasks: new Map(), sources: [], feed: [], settings: {}, loaded: false,
  view: 'today', mode: 'week', off: 0, sel: null, cat: '', q: '', hideDone: true, mOff: 0, rolled: false, edit: null, undo: null,
  lubeTab: 'clo', install: null, tankTab: 'daily', sDate: null, sDraft: null, tmOff: 0, tmUnit: 'cm', robDraft: null };
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
  ${t.repeat ? `<span class="small">повтор</span>` : ''}${opt.day && t.day ? `<span class="small">${dshort(t.day)}</span>` : ''}</span></div></div>`;
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

/* ---------- Bearing Wear Monitoring ---------- */
function vBwm() {
  const reps = db.all('bwm').sort((a, b) => (b.month || '').localeCompare(a.month || ''));
  const cyl = [1, 2, 3, 4, 5, 6], last = reps[0];
  return `<div><h1>Bearing Wear Monitoring</h1><div class="sub">Kongsberg BWM · износ подшипников главного двигателя ${esc((db.get('cal/clo-vessel') || {}).engine || '')}</div></div>
  <section class="card"><div class="row between"><div><h2>Последний отчёт</h2><div class="note">${last ? esc(last.title || last.month) : 'Отчётов пока нет'}</div></div>${last && last.status ? `<span class="tag ${last.status === 'ok' ? '' : 'warn'}">${last.status === 'ok' ? 'в норме' : 'есть отклонения'}</span>` : ''}</div>
  <div class="cyl mt">${cyl.map(c => { const v = last && last.cyl && last.cyl[c]; return `<div class="cy${v && v.flag ? ' bad' : ''}"><span class="lbl">Цил. ${c}</span><b>${v ? esc(v.value) : '—'}</b><span class="lbl">${v ? esc(v.note || '') : 'нет данных'}</span></div>` }).join('')}</div></section>
  <section class="card"><h2>Тренд по месяцам</h2>${reps.length >= 2 ? '<div class="note mt">Тренд построится по загруженным отчётам.</div>' : '<div class="empty">Появится, когда будет хотя бы два месячных отчёта.</div>'}</section>
  <section class="card"><h2>Месячные отчёты</h2><div class="list mt">${reps.map(r => `<div class="t"><div class="tb"><span class="tt">${esc(r.title || r.month)}</span><span class="small">${esc(r.summary || '')}</span></div></div>`).join('') || `<div class="empty">Скинь мне месячный отчёт из Kongsberg BWM (PDF, Excel или фото экрана). Я разберу его и добавлю сюда значения по цилиндрам, отклонения и тренд, а также сделаю интерактивный файл отчёта.</div>`}</div></section>`;
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
function lubeOrderState() { const s = db.get('meta/lubeorder'); return s ? JSON.parse(JSON.stringify(s)) : JSON.parse(JSON.stringify(LUBE_DEF)) }
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

/* ---------- Ещё (телефон) ---------- */
function vMore() {
  const c = counts(), n = c.over + c.inbox + c.stale;
  const it = (href, title, sub, badge) => `<a class="t" href="${href}"><div class="tb"><span class="tt">${title}</span><span class="small">${sub}</span></div>${badge ? `<span class="tag warn">${badge}</span>` : ''}</a>`;
  return `<div><h1>Ещё</h1><div class="sub">Остальные разделы</div></div><div class="list">
   ${it('#alerts', 'Уведомления', 'Просрочки, входящие, устаревшие источники', n || '')}
   ${it('#bwm', 'Bearing monitoring', 'Kongsberg BWM · месячные отчёты')}
   ${it('#sync', 'Синхронизация', 'Облако, резервная копия, источники, настройки')}</div>
   <section class="card"><h2>Скоро</h2><div class="note mt">Заказы и заявки · Запчасти · Док 2026 и ABS · Logbook и scrape-down · StarConnect · ACONIS · ME performance · Handover · Отчёты · Почта</div></section>`;
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
  m.innerHTML = { plan: vPlan, alerts: vAlerts, tanks: vTanks, lube: vLube, bwm: vBwm, sync: vSync, more: vMore }[S.view]?.() ?? vToday();
  document.querySelectorAll('[data-v]').forEach(a => a.setAttribute('aria-current', a.dataset.v === S.view || (a.hasAttribute('data-more') && ['alerts', 'bwm', 'sync'].includes(S.view)) ? 'page' : 'false'));
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
  if (d.lo) return `[data-lo="${q(d.lo)}"]`;
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
  if (e.target.id === 'q') { S.q = e.target.value; clearTimeout(S.qt); S.qt = setTimeout(render, 200) }
  const ds = e.target.dataset || {};
  if (ds.snd) { S.sDraft[ds.snd] = e.target.value; clearTimeout(S.st); S.st = setTimeout(render, 350) }
  if (ds.rob) { const I = robInputs(); (I.tanks[ds.rob] ||= {})[ds.f] = e.target.value; clearTimeout(S.st); S.st = setTimeout(render, 400) }
  if (e.target.form && e.target.form.id === 'robh') { robInputs()[e.target.name] = e.target.value; clearTimeout(S.st); S.st = setTimeout(render, 400) }
  if (ds.lo) { const p = lubeOrderState(), [a, b] = ds.lo.split('.'); if (b) p[a][b] = e.target.value; else p[a] = e.target.value; clearTimeout(S.ct); S.ct = setTimeout(() => put('meta/lubeorder', p).then(render), 300) }
  if (e.target.dataset.clo !== undefined) { const p = cloState(); p[e.target.name] = e.target.value; clearTimeout(S.ct); S.ct = setTimeout(() => { put('meta/clo', p).then(render) }, 250) }
});
document.addEventListener('change', e => {
  if (e.target.id === 'sdate' && e.target.value) { S.sDate = e.target.value; render() }
  if (e.target.id === 'impf' && e.target.files[0]) { e.target.files[0].text().then(t => db.importAll(JSON.parse(t))).then(n => { toast('Загружено записей: ' + n) }).catch(x => toast(x.message)) }
});
document.addEventListener('submit', e => {
  e.preventDefault(); const id = e.target.id, f = new FormData(e.target);
  if (id === 'edf' && S.edit) { const t = { ...S.edit.t }, prev = S.edit.isNew ? { id: t.id, _new: true } : { ...S.tasks.get(t.id) };
    for (const k of ['title', 'cat', 'day', 'due', 'slot', 'status', 'waiting', 'owner', 'repeat', 'note']) t[k] = String(f.get(k) || '').trim();
    t.prio = +f.get('prio') || 3; if (!t.title) return; if (t.status === 'done' && !t.doneAt) t.doneAt = today();
    const nw = S.edit.isNew; closeEd(); saveTask(t, nw ? 'Задача добавлена' : 'Сохранено', prev); if (nw) feed('Новая задача: ' + t.title) }
  if (id === 'rowf' && S.edit) { const body = {}; for (const [k, v] of f.entries()) if (String(v).trim() !== '') body[k] = String(v).trim();
    const p = S.edit.col + '/' + S.edit.rid; body.updatedBy = 'Ярослав'; closeEd(); put(p, body).then(() => { render(); toast('Сохранено') }) }
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
