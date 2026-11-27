// Fuel changeover time calculator (HFO -> LSFO) — a port of Maersk "A498c - FFCO Changeover Time Calculator".
// T1 = ramp time at 2 °C/min; T2 = time to flush twice the system volume (2SV). Formulas are the sheet's own.
import { language } from './i18n.js';

let C;
const L = (en, ru) => language() === 'ru' ? ru : en;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KEY = 'mcv-fuelco';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch (e) { return {} } };
const save = v => { try { localStorage.setItem(KEY, JSON.stringify(v)) } catch (e) {} };

export function init(ctx) { C = ctx; C.S.fc = load() }

const TYPES = () => ({
  single: { name: L('1 ME + AE: Stralsund, Edinburgh, Emma, Gudrun, Lima, Mondrian series', '1 ГД + ДГ: серии Stralsund, Edinburgh, Emma, Gudrun, Lima, Mondrian'),
    fields: ['th', 'tl', 'sv', 'me', 'ae', 'fc', 'fm'] },
  eee: { name: L('EEE series (2 ME)', 'Серия EEE (2 ГД)'), fields: ['th', 'tl', 'sv', 'me', 'm1', 'm2', 'fc', 'fm'] },
  k19: { name: L('19K series (2 ME, FM1 + FM2)', 'Серия 19K (2 ГД, FM1 + FM2)'), fields: ['th', 'tl', 'sv', 'me', 'fc', 'fm', 'f2'] },
});
const FIELDS = () => ({
  th: [L('Temp H, °C', 'Temp H, °C'), L('HFO temperature at ME inlet before changeover', 'Температура HFO на входе ГД до перехода')],
  tl: [L('Temp L, °C', 'Temp L, °C'), L('LSFO temperature at ME inlet after changeover', 'Температура LSFO на входе ГД после перехода')],
  sv: [L('2SV, t', '2SV, т'), L('Twice the volume of the FO system', 'Удвоенный объём топливной системы')],
  me: [L('ME consumption, t/h', 'Расход ГД, т/ч'), L('ME fuel consumption at constant RPM before changeover', 'Расход ГД на постоянных оборотах до перехода')],
  ae: [L('AE consumption, t/h', 'Расход ДГ, т/ч'), L('AE fuel consumption at constant load before changeover', 'Расход ДГ на постоянной нагрузке до перехода')],
  m1: [L('ME1 inlet mass flow, kg/h', 'Расход на входе ГД1, кг/ч'), L('Inlet flowmeter of ME no.1 at constant RPM', 'Расходомер на входе ГД №1 на постоянных оборотах')],
  m2: [L('ME2 inlet mass flow, kg/h', 'Расход на входе ГД2, кг/ч'), L('Inlet flowmeter of ME no.2 at constant RPM', 'Расходомер на входе ГД №2 на постоянных оборотах')],
  fc: [L('FC01 setting (Δt ≥ 2 °C/min), %', 'Уставка FC01 (Δt ≥ 2 °C/мин), %'), L('FC01 opening set point when the temperature drop is ≥ 2 °C per minute', 'Открытие FC01, при котором падение температуры ≥ 2 °C в минуту')],
  fm: [L('FM1 (T2), kg/h', 'FM1 (T2), кг/ч'), L('Main supply mass flow when FC01 reached 100 % during changeover', 'Расход главного расходомера, когда FC01 вышел на 100 % при переходе')],
  f2: [L('FM2 (T2), kg/h', 'FM2 (T2), кг/ч'), L('Second main supply flowmeter when FC05 reached 100 %', 'Второй главный расходомер, когда FC05 вышел на 100 %')],
});

const num = v => v === '' || v == null ? NaN : Number(String(v).replace(',', '.'));

export function compute(type, v) {            // returns {t1, t2, t} in minutes, or {error}
  const n = Object.fromEntries(Object.keys(v).map(k => [k, num(v[k])]));
  const need = TYPES()[type].fields;
  if (need.some(k => !Number.isFinite(n[k]))) return { error: 'missing' };
  const t1 = (n.th - n.tl) / 2;
  let t2;
  if (type === 'single') {
    const cons = n.me + n.ae;
    t2 = (n.sv - cons * t1 / 60 - ((n.fm / 1000) * (t1 / 60) - cons * t1 / 60) * (n.fc / 100)) / (n.fm / 1000) * 60;
  } else if (type === 'eee') {
    t2 = (n.sv - n.me * t1 / 60 - (((n.m1 + n.m2) / 1000 / 60 * t1 - n.me * t1 / 60) * n.fc / 100)) / (n.fm / 1000) * 60;
  } else {
    const fs = n.fm + n.f2;
    t2 = (n.sv - n.me * t1 / 60 - ((fs / 1000) * (t1 / 60) - n.me * t1 / 60) * (n.fc / 100)) / (fs / 1000) * 60;
  }
  if (!Number.isFinite(t2) || !Number.isFinite(t1)) return { error: 'math' };
  return { t1, t2, t: t1 + t2 };
}

const hm = m => { const s = Math.round(m); return `${Math.floor(s / 60)} h ${String(s % 60).padStart(2, '0')} min` };
function resultHtml(S) {
  const r = compute(S.type, S.v);
  if (r.error === 'missing') return `<div class="note">${L('Fill in all fields to get the changeover time.', 'Заполни все поля, чтобы получить время перехода.')}</div>`;
  if (r.error === 'math' || r.t1 < 0 || r.t2 < 0) return `<div class="banner red">${L('The inputs give a negative or undefined time. Check Temp H > Temp L and that flows are above zero.', 'Входные данные дают отрицательное или неопределённое время. Проверь, что Temp H > Temp L и расходы больше нуля.')}</div>`;
  let start = '';
  if (S.done) { const d = new Date(new Date(S.done).getTime() - r.t * 60000); if (!isNaN(d)) start = `<div class="stat"><div class="lbl">${L('Start changeover at', 'Начать переход в')}</div><div class="big">${esc(d.toLocaleString(L('en-GB', 'ru-RU'), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }))}</div></div>` }
  return `<div class="fg3"><div class="stat"><div class="lbl">T1 · ${L('temperature ramp', 'прогрев/спад температуры')}</div><div class="big">${r.t1.toFixed(1)} min</div></div>
    <div class="stat"><div class="lbl">T2 · ${L('flush 2SV', 'промывка 2SV')}</div><div class="big">${r.t2.toFixed(1)} min</div></div>
    <div class="stat"><div class="lbl">T = T1 + T2</div><div class="big" style="color:var(--acc)">${r.t.toFixed(1)} min</div><div class="lbl">${hm(r.t)}</div></div>${start}</div>`;
}

export function fuelcoView() {
  const S = C.S.fc; S.type = TYPES()[S.type] ? S.type : 'single'; S.v ||= {};
  const T = TYPES(), F = FIELDS();
  return `<div><h1>${L('Fuel changeover', 'Переход на другое топливо')}</h1><div class="sub">${L('HFO → LSFO changeover time · Maersk FFCO calculator A498c', 'Время перехода HFO → LSFO · калькулятор Maersk FFCO A498c')}</div></div>
  <section class="card"><label class="f">${L('Vessel series (which sheet applies)', 'Серия судна (какой лист применять)')}
    <select id="fctype">${Object.entries(T).map(([k, t]) => `<option value="${k}"${k === S.type ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
  <form class="fg3 mt" id="fcf" autocomplete="off" onsubmit="return false">${T[S.type].fields.map(k => `<label class="f">${esc(F[k][0])}<input inputmode="decimal" type="number" step="any" name="${k}" value="${esc(S.v[k] ?? '')}"><span class="small">${esc(F[k][1])}</span></label>`).join('')}
  <label class="f">${L('Complete by (optional)', 'Закончить к (необязательно)')}<input type="datetime-local" name="done" value="${esc(S.done || '')}"><span class="small">${L('Gives the time to start, e.g. before entering the ECA', 'Покажет время начала, например перед входом в ECA')}</span></label></form></section>
  <section class="card"><h2>${L('Result', 'Результат')}</h2><div id="fcres">${resultHtml(S)}</div>
  <div class="note mt">${L('T1 = (Temp H − Temp L) / 2: ramp at 2 °C/min. T2 = time to flush twice the system volume, taking the fuel burnt and the flow through FC01 into account. Same formulas as the Maersk sheet.', 'T1 = (Temp H − Temp L) / 2: изменение температуры со скоростью 2 °C/мин. T2 — время промывки двойного объёма системы с учётом сожжённого топлива и потока через FC01. Формулы те же, что в таблице Maersk.')}</div></section>`;
}
export const VIEWS = { fuelco: fuelcoView };

export function onInput(e) {
  const t = e.target, f = t.form;
  if (!f || f.id !== 'fcf') return false;
  const S = C.S.fc; S.v ||= {};
  if (t.name === 'done') S.done = t.value; else S.v[t.name] = t.value;
  save({ type: S.type, v: S.v, done: S.done || '' });
  const el = document.getElementById('fcres'); if (el) el.innerHTML = resultHtml(S);   // no re-render: the caret stays put
  return true;
}
export function onChange(e) {
  if (e.target.id !== 'fctype') return false;
  const S = C.S.fc; S.type = e.target.value; save({ type: S.type, v: S.v || {}, done: S.done || '' }); C.render(); return true;
}
export function onClick() { return false }
export function onSubmit() { return false }
