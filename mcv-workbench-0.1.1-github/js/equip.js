import { t as tr, localized, language, formatDate } from "./i18n.js";
/* Оборудование (дерево из PMS, карточки) и история неисправностей */
import * as db from './store.js';
import { urgencyBadge, urgencyOf } from './urgency.js';

let C;
export function init(ctx) { C = ctx; Object.assign(C.S, { eqTab: 'tree', eqG: '', eqSel: '', eqQ: '', tsQ: '', tsSt: '', tsG: '', tsSel: '', tsEdit: null, tsSrc: '' }) }

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MS = localized(() => ([tr("s701"), tr("s702"), tr("s703"), tr("s704"), tr("s36"), tr("s705"), tr("s706"), tr("s707"), tr("s708"), tr("s709"), tr("s710"), tr("s711")]));
const dd = s => language() === 'en' ? formatDate(s, s?.length === 7 ? { month: 'short', year: 'numeric' } : undefined) : !s ? '' : s.length < 10 ? (s.length === 7 ? MS[+s.slice(5, 7) - 1] + ' ' + s.slice(0, 4) : s) : (+s.slice(8, 10)) + ' ' + MS[+s.slice(5, 7) - 1] + ' ' + s.slice(0, 4);
const tabs = (act, cur, items) => `<div class="tabs" role="tablist">${items.map(([k, l]) => `<button role="tab" data-act="${act}" data-k="${k}" aria-selected="${cur === k}">${l}</button>`).join('')}</div>`;
const chips = (act, cur, items) => `<div class="chips mt">${items.map(([k, l]) => `<button class="chip" data-act="${act}" data-k="${k}" aria-pressed="${cur === k}">${l}</button>`).join('')}</div>`;
const stat = (l, v, u) => `<div class="stat"><span class="lbl">${l}</span><b>${v}</b><span class="lbl">${u || ''}</span></div>`;

/* ---------- группы систем ---------- */
export const GROUPS = localized(() => ([
  ['me', tr("s189"), /^M\/E|MAIN ENGINE|^ME LO|TORSIONMETER|TURNING DEVICE|SHAFT GROUNDING|PNEUMATIC MANOEUVRING|PROPULSION CONTROL|ENGINE CONTROLS|REMOTE SOUNDING|MAIN LO (PURIFIER|SUMP|SETTLING|STORAGE)|CYLINDER OIL|SCAVENGE AIR STEAM|MAIN AIR COMPRESSOR|STARTING AIR/i],
  ['ae', tr("s1063"), /GENERATOR ENGINE|^G\/E|EMERGENCY GENERATOR|G\/E LO|ELECTRIC MOTORS$/i],
  ['tg', tr("s1064"), /^T\/G|TURBO GEN|EXHAUST GAS ECONOMIZER|EXH\. GAS|AUX BOILER|AUX BLR|BOILER|STEAM DRUM|DUMP CONDENSER|STEAM DISTRIBUTION|CALORIFIER|FWG|VACUUM PUMP|MINERALIZER/i],
  ['st', tr("s1065"), /STEERING|RUDDER|THRUSTER|TAIL SHAFT|STERN ?TUBE|INTERMEDIATE SHAFT|STERN FRAME|LO SYSTEM STERN/i],
  ['dk', tr("s1066"), /WINDLASS|MOORING|CAPSTAN|ANCHOR|CRANE|MONORAIL|HYDRO BLASTER|CONTAINER LASH|CARGO SECURING|LADDER|HAWSE|LIFTING APPL|BOSUN/i],
  ['ls', tr("s1067"), /LIFE ?BOAT|RESCUE|DAVIT|LIFE RAFT|SUEZ BOAT|DEFIBRILL|MEDICAL|HOSPITAL/i],
  ['fp', tr("s1068"), /CO2|FIRE|WATER MIST|WATER SPRAY|SMOKE|FOAM|EXTINGUISH|OXYGEN ROOM|ACETYLENE/i],
  ['ps', tr("s1069"), /PUMP|PURIFIER|SEPARATOR|COMPRESSOR|HEATER|FLOWMETER|BOB |COOLER|FWD SEAL/i],
  ['sy', tr("s1070"), /BALLAST|BILGE|SEWAGE|SLUDGE|FO TRANSFER|HFO|MDO|TRANSFER & BUNKER|SEA WATER|FRESH WATER COOLING|COOLING FW|COOLING SYSTEMS|SEA CHEST|SEA CONNECTIONS|SHIP SIDE|DRAIN|PIPE TUNNEL|VENTILATION|FAN|AIR HANDLING|AHU|SERVICE SYSTEMS|SERVICE AIR|CONTROL\/WORKING AIR|STERILIZER|GARBAGE|COMPACTOR|GREASE TRAP|HYDR SYSTEM|WORKSHOP|VALVE/i],
  ['el', tr("s1071"), /ELECTRIC|SWITCHBOARD|CABLE|BATTERY|440V|POWER MANAGEMENT|CONTROL, ALARM|CALL & ALARM|IMPRESSED CURRENT|TRANSFORMER|LIGHT INSTALL|AC-EM|SHORE SUPPLY|REEFER ELECTRICAL|INTERCOM/i],
  ['nv', tr("s1072"), /NAVIGATION|ECDIS|VDR|AUTOMATIC IDENT|SPEED LOG|DAYLIGHT SIGNAL|BRIDGE WINDOWS|WHEELHOUSE|COMMUNICATION|GMDSS/i],
  ['cg', tr("s1073"), /CARGO HATCH|HATCH|ELEVATOR|LIFT TRUNK|CONTAINER HOLD|^HOLD|HOLD BILGE|PROVISION|ECR, COOLER|GALLEY/i],
  ['hl', tr("s1074"), /TANK|HULL|BULKHEAD|VOID|COFFERDAM|PLATING|DECK|WEATHER|ROOM|STORE|ACCOMMODATION|CASING|HANDRAIL|BULWARK|FORECASTLE|PEAK|PASSAGEWAY|MEETING|LAUNDRY|GYMNASIUM|MESS|WATER TIGHT|SAFETY AREA/i],
  ['gn', tr("s1075"), /CHECKS|DRILLS|LOG BOOKS|MEETINGS|FIRE PROTECTION|LIFESAVING/i],
]));
const GN = localized(() => ({ ...Object.fromEntries(GROUPS.map(g => [g[0], g[1]])), gn: tr("s1076") }));
export function grpOf(name) { const n = name || ''; if (/^(MONTHLY|WEEKLY|QUARTERLY|ANNUAL|HALF YEARLY) CHECKS|DRILLS|LOG BOOKS|^MEETINGS/i.test(n)) return 'gn'; for (const [k, , rx] of GROUPS) if (rx.test(n)) return k; return 'gn' }
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
const ST = localized(() => ({ open: [tr("s1077"), 'warn'], prog: [tr("s13"), ''], wait: [tr("s1078"), ''], done: [tr("s1079"), ''], hist: [tr("s1080"), ''] }));
const PR = ['', 'Critical', 'High', 'Medium', 'Low'];
const cases = () => db.all('ts').sort((a, b) => (b.date || '0').localeCompare(a.date || '0'));
function caseMatches(c, eqName, grp) {
  if (eqName) { const n = eqName.toUpperCase(); return (c.kw || []).some(k => n.includes(k.toUpperCase())) || (c.eq && n.includes(c.eq.toUpperCase())) }
  return grp ? c.grp === grp : true;
}

/* ---------- Оборудование ---------- */
function tree() {
  const S = C.S, jobs = pmsJobs();
  if (!jobs.length) return ("<div class=\"banner\">" + tr("s1081") + "</div>");
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
  if (S.eqSel) { const card = eqCard(S.eqSel, jobs); if (card) return `<button class="btn" data-act="eqback">${tr("s1082")}</button>${card}` }
  return `<input class="search mt" id="eqq" type="search" placeholder="${tr("s1088")}" value="${esc(S.eqQ)}">
  <div class="note mt">${tr("s1089", {1: (jobs.length), 2: (new Set(jobs.map(j => baseOf(j.eq))).size)})}</div>
  ${rows.map(({ g, B }) => {
    const open = S.eqG === g.k || !!q, over = B.reduce((a, b) => a + b.over, 0), nc = CS.filter(c => c.grp === g.k && c.status !== 'hist').length;
    return `<section class="card"><div class="row between click" data-act="eqg" data-k="${g.k}"><h2>${esc(g.name)}</h2><span class="sub">${tr("s1087", {2: (B.length), 3: (over ? ` · <span class="tag warn">${tr("s1083", {0: (over)})}</span>` : ''), 4: (nc ? ` · <span class="tag">${tr("s1084", {0: (nc)})}</span>` : '')})}</span></div>
    ${open ? `<div class="list mt">${B.map(b => { const nb = CS.filter(c => caseMatches(c, b.b, '')).length; return `<div class="t click" data-act="eqsel" data-k="${esc(b.b)}"><div class="tb"><span class="tt">${esc(b.b)}</span><span class="meta"><span class="small">${tr("s1086", {2: (b.jobs.length)})}</span>${b.over ? `<span class="tag warn">${tr("s1083", {0: (b.over)})}</span>` : ''}${nb ? `<span class="tag">${tr("s1085", {0: (nb)})}</span>` : ''}</span></div></div>` }).join('')}</div>` : ''}</section>`;
  }).join('') || ("<div class=\"empty\">" + tr("s403") + "</div>")}`;
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
  <div class="grid mt">${stat(tr("s1090"), J.length, '')}${stat(tr("s119"), over, '')}${stat(tr("s1091"), next ? dd(next.due) : '—', next ? esc((next.title || '').slice(0, 28)) : '')}${stat(tr("s1092"), last ? dd(last.last) : '—', '')}</div></section>
  ${LC.length ? `<section class="card"><h2>${tr("s1093")}</h2><div class="scroll"><table class="stack"><thead><tr><th>${tr("s1050")}</th><th>${tr("s1051")}</th><th>${tr("s1042")}</th><th>${tr("s149")}</th></tr></thead><tbody>${LC.filter(m => !m.repl).map(m => `<tr><td data-l="${tr("s1050")}">${esc(m.machine)}${m.sub ? ' — ' + esc(m.sub) : ''}</td><td data-l="${tr("s1051")}">${esc(m.point)}</td><td data-l="${tr("s1042")}"><b>${m.amount ?? ''}</b> ${m.unit === 'KG' ? tr("s201") : tr("s229")}</td><td data-l="${tr("s149")}">${esc(m.grade)}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
  <section class="card"><div class="row between"><h2>${tr("s1102", {7: (CS.length)})}</h2><button class="btn" data-act="tsnew" data-eq="${esc(base)}" data-g="${grpOf(base)}">${tr("s1103")}</button></div>
  <div class="list mt">${CS.map(caseRow).join('') || ("<div class=\"empty\">" + tr("s1094") + "</div>")}</div></section>
  <section class="card"><h2>${tr("s1104")}</h2><form id="eqnf" data-k="${esc(base)}"><label class="f">${tr("s1105")}<textarea name="note" rows="4" placeholder="${tr("s1106")}">${esc(note?.note || '')}</textarea></label><button class="btn pri mt">${tr("s241")}</button></form></section>
  <section class="card"><h2>${tr("s1107")}</h2>${subs.map(([n, L]) => `<details class="mt"${subs.length === 1 ? ' open' : ''}><summary><b>${esc(n)}</b> <span class="small">${tr("s1100", {2: (L.length), 3: (L.some(isOver) ? tr("s1095") + L.filter(isOver).length : '')})}</span></summary><div class="scroll"><table class="stack"><thead><tr><th>${tr("s1096")}</th><th>${tr("s261")}</th><th>${tr("s1097")}</th><th>${tr("s1101")}</th><th>${tr("s1099")}</th></tr></thead><tbody>${L.sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).map(j => `<tr data-urgency="${urgencyOf(j)}"><td data-l="${tr("s1096")}">${urgencyBadge(urgencyOf(j))} ${esc(j.title)}<div class="small">${esc(j.code || '')} · ${esc(j.no)}</div></td><td data-l="${tr("s261")}">${isOver(j) ? '<span class="tag warn">Overdue</span>' : esc(j.ds || '')}</td><td data-l="${tr("s1097")}">${dd(j.due)}</td><td data-l="${tr("s1098")}">${esc(j.freq || '')}</td><td data-l="${tr("s1099")}">${dd(j.last)}</td></tr>`).join('')}</tbody></table></div></details>`).join('')}</section>`;
}

/* ---------- Неисправности ---------- */
function caseRow(c) {
  const S = C.S, st = ST[c.status] || ST.hist, open = S.tsSel === c.id;
  const meta = [c.date ? dd(c.date) + (c.date2 ? ' → ' + dd(c.date2) : '') : '', c.alarm ? tr("s1108") + c.alarm : '', c.n ? c.n + tr("s1109") : ''].filter(Boolean).join(' · ');
  const level = urgencyOf(c);
  return `<div class="t click" data-urgency="${level}" data-act="tssel" data-k="${esc(c.id)}">${urgencyBadge(level)}<div class="tb"><span class="tt">${esc(c.title)}</span>
  <span class="meta"><span class="tag${st[1] ? ' ' + st[1] : ''}">${st[0]}</span><span class="tag">${esc(GN[c.grp] || '')}</span>${c.prio === 'Critical' || c.prio === 'High' ? `<span class="tag p1">${c.prio}</span>` : ''}${c.dd ? ("<span class=\"tag Док\">" + tr("s1110") + "</span>") : ''}<span class="small">${esc(meta)}</span></span>
  ${open ? caseDetail(c) : ''}</div></div>`;
}
function caseDetail(c) {
  const F = [[tr("s1006"), c.eq], [tr("s1111"), c.symptom], [tr("s1112"), c.cause], [tr("s1113"), c.action], [tr("s1114"), c.parts], [tr("s1115"), c.ref], [tr("s257"), ({ notion: 'Defect Tracker (Notion)', mail: tr("s1116"), chat: tr("s1117") })[c.src] || c.src], [tr("s575"), c.note]].filter(x => x[1]);
  return `<div class="kv2" style="margin-top:8px" onclick="if (!event.target.closest('button[data-act]')) event.stopPropagation()">${F.map(([k, v]) => `<div><b>${k}</b><div style="white-space:pre-wrap">${esc(v)}</div></div>`).join('')}
  <div class="row mt">${c.mailq ? `<button class="btn" data-act="tsmail" data-k="${esc(c.id)}">${tr("s1118")}</button>` : ''}<button class="btn" data-act="tsedit" data-k="${esc(c.id)}">${tr("s1000")}</button><button class="btn ghost" data-act="tsdel" data-k="${esc(c.id)}">${tr("s239")}</button></div></div>`;
}
function tsForm() {
  const E = C.S.tsEdit; if (!E) return '';
  const eqs = [...new Set(pmsJobs().map(j => baseOf(j.eq)))].sort();
  return `<section class="card"><h2>${E.id ? tr("s1119") : tr("s1120")}</h2><form id="tsf">
  <label class="f">${tr("s1121")}<input name="title" required value="${esc(E.title || '')}" placeholder="${tr("s1122")}"></label>
  <div class="fg mt"><label class="f">${tr("s1056")}<select name="grp">${GROUPS.map(g => `<option value="${g[0]}"${E.grp === g[0] ? ' selected' : ''}>${g[1]}</option>`).join('')}</select></label>
  <label class="f">${tr("s1006")}<input name="eq" list="tseq" value="${esc(E.eq || '')}"><datalist id="tseq">${eqs.map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
  <label class="f">${tr("s147")}<input type="date" name="date" value="${esc((E.date || '').slice(0, 10))}"></label>
  <label class="f">${tr("s261")}<select name="status">${Object.entries(ST).map(([k, v]) => `<option value="${k}"${(E.status || 'open') === k ? ' selected' : ''}>${v[0]}</option>`).join('')}</select></label>
  <label class="f">${tr("s609")}<select name="prio">${PR.map(p => `<option${E.prio === p ? ' selected' : ''}>${p}</option>`).join('')}</select></label>
  <label class="f">${tr("s1123")}<input name="alarm" value="${esc(E.alarm || '')}"></label></div>
  <label class="f mt">${tr("s1111")}<textarea name="symptom" rows="3">${esc(E.symptom || '')}</textarea></label>
  <label class="f mt">${tr("s1112")}<textarea name="cause" rows="3">${esc(E.cause || '')}</textarea></label>
  <label class="f mt">${tr("s1113")}<textarea name="action" rows="3">${esc(E.action || '')}</textarea></label>
  <div class="fg mt"><label class="f">${tr("s1114")}<input name="parts" value="${esc(E.parts || '')}"></label><label class="f">${tr("s1124")}<input name="ref" value="${esc(E.ref || '')}"></label></div>
  <label class="row mt small"><input type="checkbox" name="dd" ${E.dd ? 'checked' : ''}> ${tr("s1125")}</label>
  <div class="row mt"><button type="button" class="btn" data-act="tscancel">${tr("s240")}</button><button class="btn pri">${tr("s241")}</button></div></form></section>`;
}
function faults() {
  const S = C.S, q = S.tsQ.trim().toLowerCase(), CS = cases();
  if (!CS.length) return ("<div class=\"banner\">" + tr("s1126") + "</div>") + tsForm();
  const L = CS.filter(c => (!S.tsSt || (S.tsSt === 'act' ? ['open', 'prog', 'wait'].includes(c.status) : c.status === S.tsSt)) && (!S.tsG || c.grp === S.tsG) && (!S.tsSrc || c.src === S.tsSrc)
    && (!q || [c.title, c.eq, c.symptom, c.cause, c.action, c.parts, c.alarm, c.ref, c.note, (c.kw || []).join(' ')].join(' ').toLowerCase().includes(q)));
  const act = CS.filter(c => ['open', 'prog', 'wait'].includes(c.status)).length;
  return `${tsForm()}<div class="row mt"><input class="search" id="tsq" type="search" placeholder="${tr("s1130")}" value="${esc(S.tsQ)}"><button class="btn pri" data-act="tsnew" data-eq="" data-g="me">${tr("s1131")}</button></div>
  ${chips('tsst', S.tsSt, [['', tr("s1127") + CS.length], ['act', tr("s1128") + act], ['done', tr("s1129")], ['hist', tr("s1080")]])}
  <div class="chips mt"><select class="search" style="width:auto" id="tsg"><option value="">${tr("s1132")}</option>${GROUPS.map(g => `<option value="${g[0]}"${S.tsG === g[0] ? ' selected' : ''}>${g[1]}</option>`).join('')}</select>
  <select class="search" style="width:auto" id="tssrc"><option value="">${tr("s1133")}</option><option value="notion"${S.tsSrc === 'notion' ? ' selected' : ''}>Defect Tracker</option><option value="chat"${S.tsSrc === 'chat' ? ' selected' : ''}>${tr("s1134")}</option><option value="mail"${S.tsSrc === 'mail' ? ' selected' : ''}>${tr("s10")}</option></select></div>
  <section class="card"><div class="row between"><h2>${tr("s1135", {7: (L.length)})}</h2></div><div class="list mt">${L.map(caseRow).join('') || ("<div class=\"empty\">" + tr("s403") + "</div>")}</div>
  <div class="note">${tr("s1136")}</div></section>`;
}
export function equipView() {
  const S = C.S;
  return `<div><h1>${tr("s1006")}</h1><div class="sub">${tr("s1139")}</div></div>${tabs('eqtab', S.eqTab, [['tree', tr("s1137")], ['ts', tr("s1138")]])}${S.eqTab === 'ts' ? faults() : tree()}`;
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
  if (a === 'tsdel') { if (el.dataset.sure) { const body = db.get('ts/' + k); db.del('ts/' + k).then(C.refresh); C.toast(tr("s1140"), { _row: 'ts/' + k, body }) } else { el.dataset.sure = '1'; el.textContent = tr("s1019") } return true }
  if (a === 'tsmail') {
    const c = db.get('ts/' + k);
    if (!c) return true;
    const date = c.date ? tr("s1142", undefined, 'en') + formatDate(c.date, undefined, 'en') + ')' : '';
    const text = tr("report.faultQuery", { 0: c.mailq, 1: date }, 'en');
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
      .then(() => C.toast(tr("s1021"))).catch(() => prompt(tr("s1022"), text));
    return true;
  }
  return false;
}
export function onInput(e) {
  const S = C.S, t = e.target;
  if (updateSearch(t)) return true;
  if (t.form && t.form.id === 'tsf') { const f = t.form; S.tsEdit = { ...(S.tsEdit || {}), title: f.title.value, grp: f.grp.value, eq: f.eq.value, date: f.date.value, status: f.status.value, prio: f.prio.value, alarm: f.alarm.value, symptom: f.symptom.value, cause: f.cause.value, action: f.action.value, parts: f.parts.value, ref: f.ref.value, dd: f.dd.checked }; return true }
  return false;
}
function updateSearch(field) {
  if (field.id === 'eqq') C.S.eqQ = field.value;
  else if (field.id === 'tsq') C.S.tsQ = field.value;
  else return false;
  return true;
}
export function onChange(e) {
  const field = e.target;
  if (updateSearch(field)) return true;
  if (field.id === 'tsg') C.S.tsG = field.value;
  else if (field.id === 'tssrc') C.S.tsSrc = field.value;
  else return false;
  return true;
}
export function onSubmit(id, f) {
  const S = C.S;
  if (id === 'tsf') {
    const title = String(f.get('title') || '').trim(); if (!title) { C.toast(tr("s1144")); return true }
    const E = S.tsEdit || {}, cid = E.id || 'c-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), old = E.id ? db.get('ts/' + E.id) : {};
    const g = k => String(f.get(k) || '').trim();
    C.put('ts/' + cid, { ...old, title, grp: g('grp'), eq: g('eq'), date: g('date'), status: g('status'), prio: g('prio'), alarm: g('alarm'), symptom: g('symptom'), cause: g('cause'), action: g('action'), parts: g('parts'), ref: g('ref'), dd: f.get('dd') === 'on', src: old.src || 'user' }).then(() => { S.tsEdit = null; S.tsSel = cid; C.refresh(); C.toast(tr("s1145")) });
    return true;
  }
  if (id === 'eqnf') { const form = document.getElementById('eqnf'), base = form.dataset.k; C.put('eqx/' + slug(base), { name: base, note: String(f.get('note') || '').trim() }).then(() => C.toast(tr("s1025"))); return true }
  return false;
}
