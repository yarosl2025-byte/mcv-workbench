/* Оборудование (дерево из PMS, карточки) и история неисправностей */
import * as db from './store.js';

let C;
export function init(ctx) { C = ctx; Object.assign(C.S, { eqTab: 'tree', eqG: '', eqSel: '', eqQ: '', tsQ: '', tsSt: '', tsG: '', tsSel: '', tsEdit: null, tsSrc: '' }) }

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const dd = s => !s ? '' : s.length < 10 ? (s.length === 7 ? MS[+s.slice(5, 7) - 1] + ' ' + s.slice(0, 4) : s) : (+s.slice(8, 10)) + ' ' + MS[+s.slice(5, 7) - 1] + ' ' + s.slice(0, 4);
const tabs = (act, cur, items) => `<div class="tabs" role="tablist">${items.map(([k, l]) => `<button role="tab" data-act="${act}" data-k="${k}" aria-selected="${cur === k}">${l}</button>`).join('')}</div>`;
const chips = (act, cur, items) => `<div class="chips mt">${items.map(([k, l]) => `<button class="chip" data-act="${act}" data-k="${k}" aria-pressed="${cur === k}">${l}</button>`).join('')}</div>`;
const stat = (l, v, u) => `<div class="stat"><span class="lbl">${l}</span><b>${v}</b><span class="lbl">${u || ''}</span></div>`;

/* ---------- группы систем ---------- */
export const GROUPS = [
  ['me', 'Главный двигатель', /^M\/E|MAIN ENGINE|^ME LO|TORSIONMETER|TURNING DEVICE|SHAFT GROUNDING|PNEUMATIC MANOEUVRING|PROPULSION CONTROL|ENGINE CONTROLS|REMOTE SOUNDING|MAIN LO (PURIFIER|SUMP|SETTLING|STORAGE)|CYLINDER OIL|SCAVENGE AIR STEAM|MAIN AIR COMPRESSOR|STARTING AIR/i],
  ['ae', 'Дизель-генераторы и аварийный', /GENERATOR ENGINE|^G\/E|EMERGENCY GENERATOR|G\/E LO|ELECTRIC MOTORS$/i],
  ['tg', 'Утилизация тепла, турбогенератор, котлы', /^T\/G|TURBO GEN|EXHAUST GAS ECONOMIZER|EXH\. GAS|AUX BOILER|AUX BLR|BOILER|STEAM DRUM|DUMP CONDENSER|STEAM DISTRIBUTION|CALORIFIER|FWG|VACUUM PUMP|MINERALIZER/i],
  ['st', 'Рулевое и подруливающие', /STEERING|RUDDER|THRUSTER|TAIL SHAFT|STERN ?TUBE|INTERMEDIATE SHAFT|STERN FRAME|LO SYSTEM STERN/i],
  ['dk', 'Палубные механизмы и краны', /WINDLASS|MOORING|CAPSTAN|ANCHOR|CRANE|MONORAIL|HYDRO BLASTER|CONTAINER LASH|CARGO SECURING|LADDER|HAWSE|LIFTING APPL|BOSUN/i],
  ['ls', 'Спасательные средства', /LIFE ?BOAT|RESCUE|DAVIT|LIFE RAFT|SUEZ BOAT|DEFIBRILL|MEDICAL|HOSPITAL/i],
  ['fp', 'Пожарные системы', /CO2|FIRE|WATER MIST|WATER SPRAY|SMOKE|FOAM|EXTINGUISH|OXYGEN ROOM|ACETYLENE/i],
  ['ps', 'Насосы, сепараторы, компрессоры, подогреватели', /PUMP|PURIFIER|SEPARATOR|COMPRESSOR|HEATER|FLOWMETER|BOB |COOLER|FWD SEAL/i],
  ['sy', 'Системы: топливо, вода, балласт, стоки', /BALLAST|BILGE|SEWAGE|SLUDGE|FO TRANSFER|HFO|MDO|TRANSFER & BUNKER|SEA WATER|FRESH WATER COOLING|COOLING FW|COOLING SYSTEMS|SEA CHEST|SEA CONNECTIONS|SHIP SIDE|DRAIN|PIPE TUNNEL|VENTILATION|FAN|AIR HANDLING|AHU|SERVICE SYSTEMS|SERVICE AIR|CONTROL\/WORKING AIR|STERILIZER|GARBAGE|COMPACTOR|GREASE TRAP|HYDR SYSTEM|WORKSHOP|VALVE/i],
  ['el', 'Электрика и автоматика', /ELECTRIC|SWITCHBOARD|CABLE|BATTERY|440V|POWER MANAGEMENT|CONTROL, ALARM|CALL & ALARM|IMPRESSED CURRENT|TRANSFORMER|LIGHT INSTALL|AC-EM|SHORE SUPPLY|REEFER ELECTRICAL|INTERCOM/i],
  ['nv', 'Навигация и связь', /NAVIGATION|ECDIS|VDR|AUTOMATIC IDENT|SPEED LOG|DAYLIGHT SIGNAL|BRIDGE WINDOWS|WHEELHOUSE|COMMUNICATION|GMDSS/i],
  ['cg', 'Грузовые люки, лифт, рефы', /CARGO HATCH|HATCH|ELEVATOR|LIFT TRUNK|CONTAINER HOLD|^HOLD|HOLD BILGE|PROVISION|ECR, COOLER|GALLEY/i],
  ['hl', 'Корпус, танки, помещения', /TANK|HULL|BULKHEAD|VOID|COFFERDAM|PLATING|DECK|WEATHER|ROOM|STORE|ACCOMMODATION|CASING|HANDRAIL|BULWARK|FORECASTLE|PEAK|PASSAGEWAY|MEETING|LAUNDRY|GYMNASIUM|MESS|WATER TIGHT|SAFETY AREA/i],
  ['gn', 'Общие проверки, учения, журналы', /CHECKS|DRILLS|LOG BOOKS|MEETINGS|FIRE PROTECTION|LIFESAVING/i],
];
const GN = Object.fromEntries(GROUPS.map(g => [g[0], g[1]]));
GN.gn = 'Общее / прочее';
function grpOf(name) { const n = name || ''; if (/^(MONTHLY|WEEKLY|QUARTERLY|ANNUAL|HALF YEARLY) CHECKS|DRILLS|LOG BOOKS|^MEETINGS/i.test(n)) return 'gn'; for (const [k, , rx] of GROUPS) if (rx.test(n)) return k; return 'gn' }
function baseOf(name) {
  const n = (name || '').trim();
  if (/^M\/E[ ,]|^MAIN ENGINE|^ME LO/i.test(n)) return 'MAIN ENGINE 6S80ME-C9';
  let m;
  if (m = n.match(/^(?:GENERATOR ENGINE|G\/E) ?(\d)/i)) return 'GENERATOR ENGINE ' + m[1];
  if (/^T\/G|^TURBO GEN/i.test(n)) return 'TURBO GENERATOR';
  if (/^CARGO HATCH/i.test(n)) return 'CARGO HATCHES';
  if (/TANK/i.test(n) && !/ HEATER|PUMP/i.test(n)) return 'TANKS';
  if (/^SAFETY AREA/i.test(n)) return 'SAFETY AREA INSPECTIONS';
  if (/^HOLD \d|^VOID SPACE|BULKHEAD|COFFERDAM|PLATING/i.test(n)) return 'HULL / HOLDS / SPACES';
  return n.split(',')[0].trim();
}
const LCMAP = [[/^MAIN ENGINE|^M\/E|^ME LO/i, ['1']], [/GENERATOR ENGINE|^G\/E/i, ['2', 'E-2']], [/ALTERNATOR/i, ['E-2']], [/^T\/G|TURBO GEN/i, ['3']], [/BOILER|BLR|ECONOMIZER/i, ['4']], [/COMPRESSOR/i, ['5', 'A-2']], [/PURIFIER|SEPARATOR/i, ['6']], [/OILY BILGE/i, ['7']], [/ENGINE ROOM CRANE/i, ['10']], [/ELEVATOR/i, ['A-3']], [/EMERGENCY GENERATOR/i, ['E-1']], [/STEERING|RUDDER/i, ['S-1', 'S-4']], [/STERN ?TUBE|TAIL SHAFT/i, ['S-3']], [/INTERMEDIATE SHAFT/i, ['S-5']], [/RESCUE/i, ['H-3', 'H-4']], [/LIFE ?BOAT|LIFEBOAT/i, ['H-1', 'H-2']], [/WINDLASS|MOORING|ANCHOR/i, ['H-5']], [/CAPSTAN/i, ['H-12']], [/BOW THRUSTER/i, ['H-6']], [/STERN THRUSTER/i, ['H-7']], [/MONORAIL/i, ['H-8']], [/PILOT/i, ['H-9']], [/ACCOMMODATION LADDER|ACCOMODATION LADDER/i, ['H-10']], [/SUEZ/i, ['H-11']], [/CONTAINER CRANE/i, ['H-13']], [/PROVISION/i, ['A-2']], [/AIR HANDLING|AHU|COOLER UNIT/i, ['A-1']]];
const lcNos = n => [...new Set(LCMAP.filter(([r]) => r.test(n)).flatMap(x => x[1]))];

const pmsJobs = () => db.all('pmswb').filter(d => d.jobs).flatMap(d => d.jobs);
const today = () => new Date().toISOString().slice(0, 10);
const isOver = j => j.ds === 'Overdue';
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/* ---------- статусы ---------- */
const ST = { open: ['Открыта', 'warn'], prog: ['В работе', ''], wait: ['Ждём запчасти', ''], done: ['Закрыта', ''], hist: ['История', ''] };
const PR = ['', 'Critical', 'High', 'Medium', 'Low'];
const cases = () => db.all('ts').sort((a, b) => (b.date || '0').localeCompare(a.date || '0'));
function caseMatches(c, eqName, grp) {
  if (eqName) { const n = eqName.toUpperCase(); return (c.kw || []).some(k => n.includes(k.toUpperCase())) || (c.eq && n.includes(c.eq.toUpperCase())) }
  return grp ? c.grp === grp : true;
}

/* ---------- Оборудование ---------- */
function tree() {
  const S = C.S, jobs = pmsJobs();
  if (!jobs.length) return '<div class="banner">PMS Workboard ещё не загружен — дерево строится из него.</div>';
  const q = S.eqQ.trim().toLowerCase();
  const G = new Map(GROUPS.map(g => [g[0], { k: g[0], name: g[1], B: new Map() }]));
  for (const j of jobs) {
    const g = G.get(grpOf(j.eq)) || G.get('gn'), b = baseOf(j.eq);
    if (!g.B.has(b)) g.B.set(b, { b, jobs: [], over: 0 });
    const x = g.B.get(b); x.jobs.push(j); if (isOver(j)) x.over++;
  }
  const CS = cases();
  const rows = [...G.values()].filter(g => g.B.size).map(g => {
    const B = [...g.B.values()].filter(b => !q || b.b.toLowerCase().includes(q) || b.jobs.some(j => (j.eq + ' ' + j.title).toLowerCase().includes(q))).sort((a, b) => b.over - a.over || a.b.localeCompare(b.b));
    return { g, B };
  }).filter(x => x.B.length);
  if (S.eqSel) { const card = eqCard(S.eqSel, jobs); if (card) return `<button class="btn" data-act="eqback">← К списку</button>${card}` }
  return `<input class="search mt" id="eqq" type="search" placeholder="Поиск: оборудование, работа, код" value="${esc(S.eqQ)}">
  <div class="note mt">Дерево строится из PMS Workboard: ${jobs.length} работ, ${new Set(jobs.map(j => baseOf(j.eq))).size} узлов. Работы не дублируются, карточка собирает их на лету.</div>
  ${rows.map(({ g, B }) => {
    const open = S.eqG === g.k || !!q, over = B.reduce((a, b) => a + b.over, 0), nc = CS.filter(c => c.grp === g.k && c.status !== 'hist').length;
    return `<section class="card"><div class="row between click" data-act="eqg" data-k="${g.k}"><h2>${esc(g.name)}</h2><span class="sub">${B.length} узлов${over ? ` · <span class="tag warn">просрочено ${over}</span>` : ''}${nc ? ` · <span class="tag">дефектов ${nc}</span>` : ''}</span></div>
    ${open ? `<div class="list mt">${B.map(b => { const nb = CS.filter(c => caseMatches(c, b.b, '')).length; return `<div class="t click" data-act="eqsel" data-k="${esc(b.b)}"><div class="tb"><span class="tt">${esc(b.b)}</span><span class="meta"><span class="small">${b.jobs.length} работ</span>${b.over ? `<span class="tag warn">просрочено ${b.over}</span>` : ''}${nb ? `<span class="tag">случаев ${nb}</span>` : ''}</span></div></div>` }).join('')}</div>` : ''}</section>`;
  }).join('') || '<div class="empty">Ничего не найдено</div>'}`;
}
function eqCard(base, jobs) {
  const S = C.S, J = jobs.filter(j => baseOf(j.eq) === base);
  if (!J.length) return '';
  const over = J.filter(isOver).length, next = J.filter(j => j.due).sort((a, b) => a.due.localeCompare(b.due))[0], last = J.filter(j => j.last).sort((a, b) => b.last.localeCompare(a.last))[0];
  const by = new Map(); for (const j of J) { if (!by.has(j.eq)) by.set(j.eq, []); by.get(j.eq).push(j) }
  const subs = [...by.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const CS = cases().filter(c => caseMatches(c, base, '')), nos = lcNos(base);
  const LC = nos.length ? db.all('lochart').filter(x => x.id.startsWith('m-') && nos.includes(String(x.no))) : [];
  const note = db.get('eqx/' + slug(base));
  return `<section class="card"><h2>${esc(base)}</h2><div class="sub">${GN[grpOf(base)]}</div>
  <div class="grid mt">${stat('Работ в PMS', J.length, '')}${stat('Просрочено', over, '')}${stat('Ближайшая', next ? dd(next.due) : '—', next ? esc((next.title || '').slice(0, 28)) : '')}${stat('Последняя сделана', last ? dd(last.last) : '—', '')}</div></section>
  ${LC.length ? `<section class="card"><h2>Заправка (Lube Oil Chart)</h2><div class="scroll"><table class="stack"><thead><tr><th>Механизм</th><th>Точка</th><th>Заправка</th><th>Сорт</th></tr></thead><tbody>${LC.filter(m => !m.repl).map(m => `<tr><td data-l="Механизм">${esc(m.machine)}${m.sub ? ' — ' + esc(m.sub) : ''}</td><td data-l="Точка">${esc(m.point)}</td><td data-l="Заправка"><b>${m.amount ?? ''}</b> ${m.unit === 'KG' ? 'кг' : 'л'}</td><td data-l="Сорт">${esc(m.grade)}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
  <section class="card"><div class="row between"><h2>Неисправности (${CS.length})</h2><button class="btn" data-act="tsnew" data-eq="${esc(base)}" data-g="${grpOf(base)}">+ Добавить</button></div>
  <div class="list mt">${CS.map(caseRow).join('') || '<div class="empty">Записей по этому узлу пока нет</div>'}</div></section>
  <section class="card"><h2>Заметки по узлу</h2><form id="eqnf" data-k="${esc(base)}"><label class="f">Мануалы, номера чертежей, особенности<textarea name="note" rows="4" placeholder="Например: мануал MAN B&W vol. II, гл. 7; чертёж №…; кто обслуживает">${esc(note?.note || '')}</textarea></label><button class="btn pri mt">Сохранить</button></form></section>
  <section class="card"><h2>Работы PMS</h2>${subs.map(([n, L]) => `<details class="mt"${subs.length === 1 ? ' open' : ''}><summary><b>${esc(n)}</b> <span class="small">· ${L.length} работ${L.some(isOver) ? ' · просрочено ' + L.filter(isOver).length : ''}</span></summary><div class="scroll"><table class="stack"><thead><tr><th>Работа</th><th>Статус</th><th>След. срок</th><th>Периодичность</th><th>Последняя</th></tr></thead><tbody>${L.sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).map(j => `<tr><td data-l="Работа">${esc(j.title)}<div class="small">${esc(j.code || '')} · ${esc(j.no)}</div></td><td data-l="Статус">${isOver(j) ? '<span class="tag warn">Overdue</span>' : esc(j.ds || '')}</td><td data-l="След. срок">${dd(j.due)}</td><td data-l="Период.">${esc(j.freq || '')}</td><td data-l="Последняя">${dd(j.last)}</td></tr>`).join('')}</tbody></table></div></details>`).join('')}</section>`;
}

/* ---------- Неисправности ---------- */
function caseRow(c) {
  const S = C.S, st = ST[c.status] || ST.hist, open = S.tsSel === c.id;
  const meta = [c.date ? dd(c.date) + (c.date2 ? ' → ' + dd(c.date2) : '') : '', c.alarm ? 'сигн.: ' + c.alarm : '', c.n ? c.n + ' писем' : ''].filter(Boolean).join(' · ');
  return `<div class="t click" data-act="tssel" data-k="${esc(c.id)}"><div class="tb"><span class="tt">${esc(c.title)}</span>
  <span class="meta"><span class="tag${st[1] ? ' ' + st[1] : ''}">${st[0]}</span><span class="tag">${esc(GN[c.grp] || '')}</span>${c.prio === 'Critical' || c.prio === 'High' ? `<span class="tag p1">${c.prio}</span>` : ''}${c.dd ? '<span class="tag Док">док</span>' : ''}<span class="small">${esc(meta)}</span></span>
  ${open ? caseDetail(c) : ''}</div></div>`;
}
function caseDetail(c) {
  const F = [['Оборудование', c.eq], ['Симптом', c.symptom], ['Причина', c.cause], ['Что сделано', c.action], ['Запчасти', c.parts], ['Ссылка / PO', c.ref], ['Источник', ({ notion: 'Defect Tracker (Notion)', mail: 'Почтовый архив', chat: 'Разборы в чате с Claude' })[c.src] || c.src], ['Заметки', c.note]].filter(x => x[1]);
  return `<div class="kv2" style="margin-top:8px" onclick="event.stopPropagation()">${F.map(([k, v]) => `<div><b>${k}</b><div style="white-space:pre-wrap">${esc(v)}</div></div>`).join('')}
  <div class="row mt">${c.mailq ? `<button class="btn" data-act="tsmail" data-k="${esc(c.id)}">Копировать запрос для почты</button>` : ''}<button class="btn" data-act="tsedit" data-k="${esc(c.id)}">Править</button><button class="btn ghost" data-act="tsdel" data-k="${esc(c.id)}">Удалить</button></div></div>`;
}
function tsForm() {
  const E = C.S.tsEdit; if (!E) return '';
  const eqs = [...new Set(pmsJobs().map(j => baseOf(j.eq)))].sort();
  return `<section class="card"><h2>${E.id ? 'Править запись' : 'Новая неисправность'}</h2><form id="tsf">
  <label class="f">Заголовок<input name="title" required value="${esc(E.title || '')}" placeholder="Например: ДГ2 — подтекание ТНВД цил. 5"></label>
  <div class="fg mt"><label class="f">Система<select name="grp">${GROUPS.map(g => `<option value="${g[0]}"${E.grp === g[0] ? ' selected' : ''}>${g[1]}</option>`).join('')}</select></label>
  <label class="f">Оборудование<input name="eq" list="tseq" value="${esc(E.eq || '')}"><datalist id="tseq">${eqs.map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
  <label class="f">Дата<input type="date" name="date" value="${esc((E.date || '').slice(0, 10))}"></label>
  <label class="f">Статус<select name="status">${Object.entries(ST).map(([k, v]) => `<option value="${k}"${(E.status || 'open') === k ? ' selected' : ''}>${v[0]}</option>`).join('')}</select></label>
  <label class="f">Приоритет<select name="prio">${PR.map(p => `<option${E.prio === p ? ' selected' : ''}>${p}</option>`).join('')}</select></label>
  <label class="f">Код сигнала / аварии<input name="alarm" value="${esc(E.alarm || '')}"></label></div>
  <label class="f mt">Симптом<textarea name="symptom" rows="3">${esc(E.symptom || '')}</textarea></label>
  <label class="f mt">Причина<textarea name="cause" rows="3">${esc(E.cause || '')}</textarea></label>
  <label class="f mt">Что сделано<textarea name="action" rows="3">${esc(E.action || '')}</textarea></label>
  <div class="fg mt"><label class="f">Запчасти<input name="parts" value="${esc(E.parts || '')}"></label><label class="f">PO / ссылка / файл<input name="ref" value="${esc(E.ref || '')}"></label></div>
  <label class="row mt small"><input type="checkbox" name="dd" ${E.dd ? 'checked' : ''}> Нужен док</label>
  <div class="row mt"><button type="button" class="btn" data-act="tscancel">Отмена</button><button class="btn pri">Сохранить</button></div></form></section>`;
}
function faults() {
  const S = C.S, q = S.tsQ.trim().toLowerCase(), CS = cases();
  if (!CS.length) return '<div class="banner">Записей ещё нет. Загрузи файл mcv-workbench-faults-2026-11-22.json: Синхронизация → «Загрузить из файла».</div>' + tsForm();
  const L = CS.filter(c => (!S.tsSt || (S.tsSt === 'act' ? ['open', 'prog', 'wait'].includes(c.status) : c.status === S.tsSt)) && (!S.tsG || c.grp === S.tsG) && (!S.tsSrc || c.src === S.tsSrc)
    && (!q || [c.title, c.eq, c.symptom, c.cause, c.action, c.parts, c.alarm, c.ref, c.note, (c.kw || []).join(' ')].join(' ').toLowerCase().includes(q)));
  const act = CS.filter(c => ['open', 'prog', 'wait'].includes(c.status)).length;
  return `${tsForm()}<div class="row mt"><input class="search" id="tsq" type="search" placeholder="Поиск: оборудование, сигнал, симптом, причина, запчасть" value="${esc(S.tsQ)}"><button class="btn pri" data-act="tsnew" data-eq="" data-g="me">+ Запись</button></div>
  ${chips('tsst', S.tsSt, [['', 'Все · ' + CS.length], ['act', 'Активные · ' + act], ['done', 'Закрытые'], ['hist', 'История']])}
  <div class="chips mt"><select class="search" style="width:auto" id="tsg"><option value="">Все системы</option>${GROUPS.map(g => `<option value="${g[0]}"${S.tsG === g[0] ? ' selected' : ''}>${g[1]}</option>`).join('')}</select>
  <select class="search" style="width:auto" id="tssrc"><option value="">Все источники</option><option value="notion"${S.tsSrc === 'notion' ? ' selected' : ''}>Defect Tracker</option><option value="chat"${S.tsSrc === 'chat' ? ' selected' : ''}>Разборы с Claude</option><option value="mail"${S.tsSrc === 'mail' ? ' selected' : ''}>Почта</option></select></div>
  <section class="card"><div class="row between"><h2>Случаи (${L.length})</h2></div><div class="list mt">${L.map(caseRow).join('') || '<div class="empty">Ничего не найдено</div>'}</div>
  <div class="note">Записи «История» собраны из заголовков и счётчика писем в почтовом архиве. Причины и ремонт там не пересказаны — для них есть кнопка «Копировать запрос для почты»: вставь его мне, и я прочитаю цепочку и дополню запись.</div></section>`;
}
export function equipView() {
  const S = C.S;
  return `<div><h1>Оборудование</h1><div class="sub">Узлы из PMS, карточки и история неисправностей с поиском</div></div>${tabs('eqtab', S.eqTab, [['tree', 'Узлы'], ['ts', 'Неисправности']])}${S.eqTab === 'ts' ? faults() : tree()}`;
}
export const VIEWS = { equip: equipView };

export function onClick(a, el, e) {
  const S = C.S, k = el.dataset.k;
  if (a === 'eqtab') { S.eqTab = k; S.eqSel = ''; C.render(); return true }
  if (a === 'eqg') { S.eqG = S.eqG === k ? '' : k; C.render(); return true }
  if (a === 'eqsel') { S.eqSel = k; C.render(); scrollTo(0, 0); return true }
  if (a === 'eqback') { S.eqSel = ''; C.render(); return true }
  if (a === 'tssel') { S.tsSel = S.tsSel === k ? '' : k; C.render(); return true }
  if (a === 'tsst') { S.tsSt = k; C.render(); return true }
  if (a === 'tsnew') { S.tsEdit = { eq: el.dataset.eq || '', grp: el.dataset.g || 'me', status: 'open', date: today() }; S.eqTab = 'ts'; S.eqSel = ''; C.render(); scrollTo(0, 0); return true }
  if (a === 'tscancel') { S.tsEdit = null; C.render(); return true }
  if (a === 'tsedit') { const c = db.get('ts/' + k); if (c) { S.tsEdit = { id: k, ...c }; S.eqTab = 'ts'; S.eqSel = ''; C.render(); scrollTo(0, 0) } return true }
  if (a === 'tsdel') { if (el.dataset.sure) { const body = db.get('ts/' + k); db.del('ts/' + k).then(C.render); C.toast('Запись удалена', { _row: 'ts/' + k, body }) } else { el.dataset.sure = '1'; el.textContent = 'Точно?' } return true }
  if (a === 'tsmail') { const c = db.get('ts/' + k); const t = 'Найди в почтовом архиве и разбери цепочку: «' + c.mailq + '»' + (c.date ? ' (с ' + c.date + ')' : '') + '. Дополни запись в истории неисправностей: причина, что сделано, запчасти.'; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => C.toast('Скопировано: вставь в чат с Claude')).catch(() => prompt('Скопируй текст:', t)); return true }
  return false;
}
export function onInput(e) {
  const S = C.S, t = e.target;
  const re = (id, key) => { if (t.id === id) { S[key] = t.value; clearTimeout(S._eqt); S._eqt = setTimeout(() => { C.render(); const i = document.getElementById(id); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length) } }, 250); return true } return false };
  if (re('eqq', 'eqQ') || re('tsq', 'tsQ')) return true;
  if (t.id === 'tsg') { S.tsG = t.value; C.render(); return true }
  if (t.id === 'tssrc') { S.tsSrc = t.value; C.render(); return true }
  if (t.form && t.form.id === 'tsf') { const f = t.form; S.tsEdit = { ...(S.tsEdit || {}), title: f.title.value, grp: f.grp.value, eq: f.eq.value, date: f.date.value, status: f.status.value, prio: f.prio.value, alarm: f.alarm.value, symptom: f.symptom.value, cause: f.cause.value, action: f.action.value, parts: f.parts.value, ref: f.ref.value, dd: f.dd.checked }; return true }
  return false;
}
export function onSubmit(id, f) {
  const S = C.S;
  if (id === 'tsf') {
    const title = String(f.get('title') || '').trim(); if (!title) { C.toast('Нужен заголовок'); return true }
    const E = S.tsEdit || {}, cid = E.id || 'c-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), old = E.id ? db.get('ts/' + E.id) : {};
    const g = k => String(f.get(k) || '').trim();
    C.put('ts/' + cid, { ...old, title, grp: g('grp'), eq: g('eq'), date: g('date'), status: g('status'), prio: g('prio'), alarm: g('alarm'), symptom: g('symptom'), cause: g('cause'), action: g('action'), parts: g('parts'), ref: g('ref'), dd: f.get('dd') === 'on', src: old.src || 'user' }).then(() => { S.tsEdit = null; S.tsSel = cid; C.render(); C.toast('Запись сохранена') });
    return true;
  }
  if (id === 'eqnf') { const form = document.getElementById('eqnf'), base = form.dataset.k; C.put('eqx/' + slug(base), { name: base, note: String(f.get('note') || '').trim() }).then(() => C.toast('Заметка сохранена')); return true }
  return false;
}
