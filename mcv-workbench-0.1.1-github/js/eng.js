/* Разделы инженерных данных: ME ISO/PMI, анализы масла, ДГ, расход топлива, заметки */
import * as db from './store.js';

let C; // контекст из app.js: { S, render, toast, put, openTask, feed }
export function init(ctx) { C = ctx; Object.assign(C.S, { pfTab: 'sc', isoM: 'dev', isoSel: '', oilG: '', oilEq: '', oilP: 'v40', dgE: 'AE1', dgM: 'pmax', dgSel: '', fuTab: 'sum', ntQ: '', ntCat: '', ntMoved: false, ntEdit: null, dict: false }) }

const COL = ['#5BB8F5', '#3FB68B', '#F2A93B', '#F0616D', '#B49CF5', '#4FD1C5', '#E6EDF3', '#FF9F7A'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (x, d = 2) => x == null || x === '' || isNaN(x) ? '—' : Number(x).toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });
const MS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const dd = s => s ? (+s.slice(8, 10)) + ' ' + MS[+s.slice(5, 7) - 1] + ' ' + s.slice(0, 4) : '';
const dds = s => s ? s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(2, 4) : '';
const avg = a => { const v = a.filter(x => x != null && !isNaN(x)); return v.length ? v.reduce((p, q) => p + +q, 0) / v.length : null };
const tval = s => { if (s == null) return null; if (typeof s === 'number') return s; const m = String(s).replace(',', '.').match(/-?\d+(\.\d+)?/); return m ? +m[0] : null };
const stat = (l, v, u) => `<div class="stat"><span class="lbl">${l}</span><b>${v}</b><span class="lbl">${u || ''}</span></div>`;
const tabs = (act, cur, items) => `<div class="tabs" role="tablist">${items.map(([k, l]) => `<button role="tab" data-act="${act}" data-k="${k}" aria-selected="${cur === k}">${l}</button>`).join('')}</div>`;
const chips = (act, cur, items) => `<div class="chips mt">${items.map(([k, l]) => `<button class="chip" data-act="${act}" data-k="${k}" aria-pressed="${cur === k}">${l}</button>`).join('')}</div>`;
const legend = ser => `<div class="legend">${ser.map(s => `<span><i style="background:${s.color}${s.dash ? ';opacity:.6' : ''}"></i>${esc(s.name)}</span>`).join('')}</div>`;

/* ---------- универсальный график по датам ---------- */
function timeChart(series, o = {}) {
  const W = 680, H = o.h || 240, P = 52, all = series.flatMap(s => s.pts).filter(p => p[1] != null && !isNaN(p[1]));
  if (all.length < 1) return '<div class="empty">Нет данных для графика</div>';
  const t = s => Date.parse(s.length === 7 ? s + '-15' : s.slice(0, 10));
  const t0 = Math.min(...all.map(p => t(p[0]))), t1 = Math.max(...all.map(p => t(p[0])));
  const lv = (o.lines || []).map(l => l.v);
  let mn = Math.min(...all.map(p => p[1]), ...lv), mx = Math.max(...all.map(p => p[1]), ...lv); const pad = (mx - mn) * .08 || Math.abs(mx) * .05 || 1; mn -= pad; mx += pad;
  if (o.zero && mn > 0) mn = 0;
  const x = v => P + (t1 === t0 ? (W - P) / 2 : (t(v) - t0) / (t1 - t0) * (W - P - 14)), y = v => H - 26 - (v - mn) / (mx - mn) * (H - 44);
  const ticks = [0, .25, .5, .75, 1].map(f => mn + (mx - mn) * f), span = mx - mn, dp = span < 1 ? 2 : span < 10 ? 1 : 0;
  const y0 = new Date(t0).getFullYear(), y1 = new Date(t1).getFullYear(), yrs = []; for (let yy = y0; yy <= y1 + 1; yy++) yrs.push(yy);
  const xt = (y1 - y0 >= 2) ? yrs.map(yy => [Date.parse(yy + '-01-01'), String(yy)]) : (() => { const r = []; const d = new Date(t0); d.setDate(1); while (d.getTime() <= t1) { r.push([d.getTime(), MS[d.getMonth()] + (d.getMonth() === 0 || !r.length ? ' ' + d.getFullYear() : '')]); d.setMonth(d.getMonth() + (t1 - t0 > 2e10 ? 3 : 1)) } return r })();
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || 'График')}">
  ${ticks.map(v => `<line x1="${P}" x2="${W - 10}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${P - 6}" y="${y(v) + 4}" text-anchor="end">${num(v, dp)}</text>`).join('')}
  ${xt.filter(([v]) => v >= t0 - 1 && v <= t1 + 1).map(([v, l]) => `<text x="${(P + (t1 === t0 ? 0 : (v - t0) / (t1 - t0) * (W - P - 14))).toFixed(1)}" y="${H - 6}" text-anchor="middle">${l}</text>`).join('')}
  ${(o.lines || []).map(l => `<line x1="${P}" x2="${W - 10}" y1="${y(l.v)}" y2="${y(l.v)}" stroke="${l.color || 'var(--red)'}" stroke-dasharray="5 4"/><text x="${W - 12}" y="${y(l.v) - 4}" text-anchor="end" fill="${l.color || 'var(--red)'}">${esc(l.label || '')}</text>`).join('')}
  ${series.map(s => { const pts = s.pts.filter(p => p[1] != null && !isNaN(p[1])).sort((a, b) => t(a[0]) - t(b[0])); const d = pts.map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1)).join('');
    return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" ${s.dash ? 'stroke-dasharray="6 4" opacity=".75"' : ''} stroke-linejoin="round"/>${pts.map(p => `<circle cx="${x(p[0]).toFixed(1)}" cy="${y(p[1]).toFixed(1)}" r="${pts.length > 60 ? 1.8 : 3}" fill="${s.color}"><title>${esc(s.name)} · ${dds(p[0])}: ${num(p[1], dp + 1)}</title></circle>`).join('')}` }).join('')}</svg>`;
}
function xyChart(series, o = {}) {
  const W = 680, H = o.h || 240, P = 52, all = series.flatMap(s => s.pts);
  if (!all.length) return '<div class="empty">Нет данных</div>';
  let xmn = o.xmin ?? Math.min(...all.map(p => p[0])), xmx = o.xmax ?? Math.max(...all.map(p => p[0]));
  let mn = Math.min(...all.map(p => p[1])), mx = Math.max(...all.map(p => p[1])); const pad = (mx - mn) * .1 || 1; mn -= pad; mx += pad;
  const x = v => P + (v - xmn) / (xmx - xmn || 1) * (W - P - 14), y = v => H - 26 - (v - mn) / (mx - mn) * (H - 44);
  const ticks = [0, .25, .5, .75, 1].map(f => mn + (mx - mn) * f), dp = mx - mn < 10 ? 1 : 0, xs = []; for (let v = Math.ceil(xmn / 10) * 10; v <= xmx; v += 10) xs.push(v);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || 'График')}">
  ${ticks.map(v => `<line x1="${P}" x2="${W - 10}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${P - 6}" y="${y(v) + 4}" text-anchor="end">${num(v, dp)}</text>`).join('')}
  ${xs.map(v => `<text x="${x(v)}" y="${H - 6}" text-anchor="middle">${v}${o.xu || ''}</text>`).join('')}
  ${series.map(s => `${s.line ? `<path d="${s.pts.map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1)).join('')}" fill="none" stroke="${s.color}" stroke-width="1.5" opacity=".6"/>` : ''}${s.pts.map(p => `<circle cx="${x(p[0]).toFixed(1)}" cy="${y(p[1]).toFixed(1)}" r="${p[2] ? Math.max(3, Math.min(14, Math.sqrt(p[2]) * 1.1)) : 3.5}" fill="${s.color}" fill-opacity="${p[3] ? .35 : .8}" stroke="${s.color}"><title>${esc(s.name)} · ${num(p[0], 1)}${o.xu || ''}: ${num(p[1], 1)}${p[2] ? ' · ' + p[2] + ' ч' : ''}</title></circle>`).join('')}`).join('')}</svg>`;
}

/* =================== ME performance: вкладки =================== */
export function perfTabs() { return tabs('pftab', C.S.pfTab, [['sc', 'StarConnect по суткам'], ['iso', 'Отчёты ISO'], ['pmi', 'PMI по цилиндрам']]) }
const isoRecs = () => db.all('mehist').filter(r => r.id.startsWith('iso-')).sort((a, b) => a.date.localeCompare(b.date));
const ISO_M = {
  dev: ['Отклонения от модели', [['pcomp_d', 'Pcomp ISO − модель, бар'], ['pmax_d', 'Pmax ISO − модель, бар'], [r => r.pscav_i != null && r.pscav_m != null ? (r.pscav_i - r.pscav_m) * 10 : null, 'Pscav ISO − модель, ×0,1 бар'], ['sfoc_dev', 'SFOC к стенду, %']]],
  sfoc: ['SFOC ISO', [['sfoc_iso', 'SFOC ISO, г/кВт·ч'], ['sfoc_m', 'Модель (стенд), г/кВт·ч', 1]]],
  pcomp: ['Pcomp', [['pcomp', 'Замер, бар'], ['pcomp_i', 'ISO, бар'], ['pcomp_m', 'Модель, бар', 1]]],
  pmax: ['Pmax', [['pmax', 'Замер, бар'], ['pmax_i', 'ISO, бар'], ['pmax_m', 'Модель, бар', 1]]],
  pscav: ['Pscav', [['pscav', 'Замер, бар'], ['pscav_i', 'ISO, бар'], ['pscav_m', 'Модель, бар', 1]]],
  texh: ['Т перед ТК', [['texh', 'Замер, °C'], ['texh_i', 'ISO, °C'], ['texh_m', 'Модель, °C', 1]]],
  tc: ['Обороты ТК', [['tcrpm', 'Замер, об/мин'], ['tcrpm_i', 'ISO, об/мин'], ['tcrpm_m', 'Модель, об/мин', 1]]],
  eff: ['КПД ТК', [['eff', 'Общий'], ['eff_c', 'Компрессор'], ['eff_t', 'Турбина']]],
  load: ['Нагрузка', [['load', 'Нагрузка, % MCR'], ['rpm', 'Обороты ГД']]],
};
const gv = (r, k) => typeof k === 'function' ? k(r) : r[k];
export function isoView() {
  const R = isoRecs(); if (!R.length) return '<div class="banner">Отчётов ISO ещё нет. Пришли файл Conakry ISO (.xlsx или .pdf) — разберу.</div>';
  const m = ISO_M[C.S.isoM] || ISO_M.dev, ser = m[1].map(([k, l, dash], i) => ({ name: l, color: COL[i], dash, pts: R.map(r => [r.date, gv(r, k)]) }));
  const last = R[R.length - 1], sel = R.find(r => r.date === C.S.isoSel);
  const fl = r => r.flags && Object.keys(r.flags).length ? Object.entries(r.flags).map(([k, v]) => k + ': ' + v).join('; ') : '';
  const c3 = (r, a, b, cc, d = 1) => `<td>${num(r[a], d)}</td><td>${num(r[b], d)}</td><td class="note">${num(r[cc], d)}</td>`;
  return `<section class="card"><div class="row between"><h2>Последний отчёт · ${dd(last.date)}</h2><span class="sub">${esc(last.src || '')}</span></div>
   <div class="grid4 mt">${stat('Нагрузка', num(last.load, 1), '% MCR · ' + num(last.kw, 0) + ' кВт')}${stat('Pcomp ISO − модель', (last.pcomp_d > 0 ? '+' : '') + num(last.pcomp_d, 1), 'бар')}${stat('Pmax ISO − модель', (last.pmax_d > 0 ? '+' : '') + num(last.pmax_d, 1), 'бар')}${stat('SFOC ISO', num(last.sfoc_iso, 1), 'г/кВт·ч · модель ' + num(last.sfoc_m, 1))}</div>
   <div class="grid4 mt">${stat('Pscav', num(last.pscav, 2), 'бар · ISO ' + num(last.pscav_i, 2) + ' · модель ' + num(last.pscav_m, 2))}${stat('Т перед ТК', num(last.texh, 0), '°C · модель ' + num(last.texh_m, 0))}${stat('ТК', num(last.tcrpm, 0), 'об/мин · модель ' + num(last.tcrpm_m, 0))}${stat('КПД ТК', num(last.eff, 3), 'компр. ' + num(last.eff_c, 3) + ' · турб. ' + num(last.eff_t, 3))}</div></section>
  <section class="card"><h2>Тренд · ${m[0]}</h2>${chips('isom', C.S.isoM, Object.entries(ISO_M).map(([k, v]) => [k, v[0]]))}
   ${timeChart(ser, { label: m[0], lines: C.S.isoM === 'dev' ? [{ v: 0, color: '#3A4A5C' }] : [] })}${legend(ser)}
   <div class="note">Отчёты сняты на разных нагрузках, поэтому сами давления и температуры между собой напрямую не сравниваются. Сравнимы отклонения ISO-значений от модели MAN на той же нагрузке (вкладка «Отклонения от модели»).</div></section>
  <section class="card"><h2>Все отчёты ISO (${R.length})</h2><div class="scroll mt"><table class="mtab"><thead>
   <tr><th class="stick" rowspan="2">Дата</th><th rowspan="2">Нагр., %</th><th rowspan="2">кВт</th><th rowspan="2">об/мин</th><th colspan="3">Pscav, бар</th><th colspan="3">Т перед ТК, °C</th><th colspan="3">ТК, об/мин</th><th colspan="4">Pcomp, бар</th><th colspan="4">Pmax, бар</th><th colspan="3">SFOC ISO</th><th colspan="3">КПД ТК</th></tr>
   <tr>${'изм ISO мод изм ISO мод изм ISO мод изм ISO мод откл изм ISO мод откл ISO мод %ст общ комп турб'.split(' ').map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>
   ${R.slice().reverse().map(r => `<tr class="click${r.date === C.S.isoSel ? ' sel' : ''}" data-act="isosel" data-k="${r.date}" title="${esc(fl(r))}"><th class="stick">${dds(r.date)}${fl(r) ? ' <span class="bad">•</span>' : ''}</th><td>${num(r.load, 1)}</td><td>${num(r.kw, 0)}</td><td>${num(r.rpm, 1)}</td>
    ${c3(r, 'pscav', 'pscav_i', 'pscav_m', 2)}${c3(r, 'texh', 'texh_i', 'texh_m', 0)}${c3(r, 'tcrpm', 'tcrpm_i', 'tcrpm_m', 0)}
    ${c3(r, 'pcomp', 'pcomp_i', 'pcomp_m')}<td class="${Math.abs(r.pcomp_d) > 3 ? 'bad' : ''}">${num(r.pcomp_d, 1)}</td>${c3(r, 'pmax', 'pmax_i', 'pmax_m')}<td class="${Math.abs(r.pmax_d) > 3 ? 'bad' : ''}">${num(r.pmax_d, 1)}</td>
    <td>${num(r.sfoc_iso, 1)}</td><td class="note">${num(r.sfoc_m, 1)}</td><td>${num(r.sfoc_dev, 1)}</td><td>${num(r.eff, 3)}</td><td>${num(r.eff_c, 3)}</td><td>${num(r.eff_t, 3)}</td></tr>`).join('')}</tbody></table></div>
   <div class="note">Красная точка у даты — в листе есть пометки валидации (например «Too low»); нажми строку, чтобы открыть отчёт целиком. Отклонение Pcomp/Pmax подсвечено при |откл.| > 3 бар — это ориентир для глаза, а не лимит MAN.</div></section>
  ${sel ? isoDetail(sel) : ''}`;
}
const ISO_L = [['date', 'Дата'], ['kw', 'Мощность, кВт'], ['load', 'Нагрузка, % MCR'], ['mip', 'MIP, бар'], ['ipow', 'Индикаторная мощность, кВт'], ['mech', 'Мех. КПД, %'], ['rpm', 'Обороты, об/мин'], ['light', 'Light running, %'],
  ['tblow', 'Т на входе воздуходувки, °C'], ['pamb', 'Атм. давление, мбар'], ['dpf', 'ΔP фильтра ТК, мм вод. ст.'], ['dpf_m', 'ΔP фильтра — модель'], ['dpc', 'ΔP охладителя, мм вод. ст.'], ['dpc_m', 'ΔP охладителя — модель'], ['tsw', 'Т забортной воды, °C'],
  ['tscav', 'Т продувочного воздуха, °C'], ['tscav_m', 'Т продувочного — модель'], ['pscav', 'Pscav, бар'], ['pscav_i', 'Pscav ISO'], ['pscav_m', 'Pscav модель'], ['pexh', 'P выпускного ресивера, бар'], ['pexh_m', 'P ресивера — модель'], ['pback', 'Противодавление, мм вод. ст.'],
  ['texh', 'Т перед турбиной, °C'], ['texh_i', 'Т перед турбиной ISO'], ['texh_m', 'Т перед турбиной — модель'], ['tcrpm', 'Обороты ТК'], ['tcrpm_i', 'Обороты ТК ISO'], ['tcrpm_m', 'Обороты ТК — модель'],
  ['pcomp', 'Pcomp, бар'], ['pcomp_i', 'Pcomp ISO'], ['pcomp_m', 'Pcomp модель'], ['pcomp_d', 'Pcomp отклонение'], ['pmax', 'Pmax, бар'], ['pmax_i', 'Pmax ISO'], ['pmax_m', 'Pmax модель'], ['pmax_d', 'Pmax отклонение'], ['rise', 'Pmax − Pcomp, бар'],
  ['hours', 'Время замера расхода, ч'], ['fuel', 'Топливо на ГД, кг'], ['sfoc_raw', 'SFOC сырой, г/кВт·ч'], ['lcv', 'LCV, кДж/кг'], ['sfoc_lcv', 'SFOC с поправкой LCV'], ['sfoc_iso', 'SFOC ISO'], ['sfoc_m', 'SFOC модель'], ['sfoc_dev', 'Расход к стенду, %'],
  ['eff', 'КПД ТК общий'], ['eff_c', 'КПД компрессора'], ['eff_t', 'КПД турбины']];
function isoDetail(r) {
  return `<section class="card"><div class="row between"><h2>Отчёт ${dd(r.date)}</h2><button class="btn" data-act="isosel" data-k="">Закрыть</button></div><div class="note">${esc(r.src || '')}${r.note ? ' · ' + esc(r.note) : ''}</div>
  <div class="kv2 mt">${ISO_L.filter(([k]) => r[k] != null).map(([k, l]) => `<div><span class="lbl">${l}</span><b>${typeof r[k] === 'number' ? num(r[k], Math.abs(r[k]) < 10 ? 3 : 1) : esc(r[k])}</b>${r.flags && r.flags[k] ? ` <span class="tag warn">${esc(r.flags[k])}</span>` : ''}</div>`).join('')}</div></section>`;
}
export function pmiView() {
  const R = db.all('mehist').filter(r => r.id.startsWith('pmi-')).sort((a, b) => b.date.localeCompare(a.date));
  if (!R.length) return '<div class="banner">Отчётов PMI ещё нет.</div>';
  const ser = ['pmax', 'pcomp', 'pi'].map((k, i) => ({ name: { pmax: 'Pmax средн.', pcomp: 'Pcomp средн.', pi: 'Pi средн.' }[k], color: COL[i], pts: R.map(r => [r.date, r.cyl.Mean ? r.cyl.Mean[k] : null]) }));
  return `${R.length > 1 ? `<section class="card"><h2>Средние по двигателю</h2>${timeChart(ser, { label: 'PMI' })}${legend(ser)}</section>` : ''}
  ${R.map(r => { const M = r.cyl.Mean || {}; return `<section class="card"><div class="row between"><h2>PMI · ${dd(r.date)} ${esc(r.time || '')}</h2><span class="sub">${esc(r.src || '')}</span></div>
   <div class="grid4 mt">${stat('Обороты', num(r.rpm, 1), 'об/мин')}${stat('Pscav', num(r.pscav, 2), 'бар')}${stat('Мощность (оценка)', num(r.mw, 1), 'МВт')}${stat('Нагрузка (оценка)', num(r.load, 0), '%')}</div>
   <div class="scroll mt"><table class="mtab"><thead><tr><th class="stick">Цилиндр</th><th>Pi, бар</th><th>Pcomp, бар</th><th>Δ от средн.</th><th>Pmax, бар</th><th>Δ от средн.</th><th>Pcomp/Pscav</th></tr></thead><tbody>
   ${['1', '2', '3', '4', '5', '6', 'Mean'].filter(c => r.cyl[c]).map(c => { const x = r.cyl[c], d1 = x.pcomp - M.pcomp, d2 = x.pmax - M.pmax; return `<tr><th class="stick">${c === 'Mean' ? 'Среднее' : c}</th><td>${num(x.pi, 1)}</td><td>${num(x.pcomp, 1)}</td><td class="${c !== 'Mean' && Math.abs(d1) >= 3 ? 'bad' : 'note'}">${c === 'Mean' ? '' : (d1 > 0 ? '+' : '') + num(d1, 1)}</td><td>${num(x.pmax, 1)}</td><td class="${c !== 'Mean' && Math.abs(d2) >= 3 ? 'bad' : 'note'}">${c === 'Mean' ? '' : (d2 > 0 ? '+' : '') + num(d2, 1)}</td><td>${num(x.ratio, 1)}</td></tr>` }).join('')}</tbody></table></div></section>` }).join('')}
  <div class="note">Отклонение от среднего подсвечивается при |Δ| ≥ 3 бар — ориентир для глаза. Нагрузка и мощность в PMI — оценка системы, а не замер торсиометра.</div>`;
}

/* =================== Анализы масла (VPS OCM) =================== */
const OIL_P = [['v40', 'Вязкость 40 °C', 'мм²/с'], ['v100', 'Вязкость 100 °C', 'мм²/с'], ['vi', 'Индекс вязкости', ''], ['bn', 'BN', 'мг KOH/г'], ['tan', 'TAN', 'мг KOH/г'], ['water', 'Вода', '%'], ['waterppm', 'Вода', 'мг/кг'], ['flash', 'Т вспышки', '°C'],
  ['ox', 'Окисление', 'Abs/cm'], ['nit', 'Нитрация', 'Abs/cm'], ['sulf', 'Сульфаты', 'Abs/cm'], ['soot', 'Сажа / нерастворимые', '%'],
  ['fe', 'Железо Fe', 'мг/кг'], ['cu', 'Медь Cu', 'мг/кг'], ['al', 'Алюминий Al', 'мг/кг'], ['cr', 'Хром Cr', 'мг/кг'], ['pb', 'Свинец Pb', 'мг/кг'], ['sn', 'Олово Sn', 'мг/кг'], ['ni', 'Никель Ni', 'мг/кг'], ['ag', 'Серебро Ag', 'мг/кг'], ['mo', 'Молибден Mo', 'мг/кг'], ['ti', 'Титан Ti', 'мг/кг'], ['mn', 'Марганец Mn', 'мг/кг'], ['pq', 'PQ индекс', ''],
  ['na', 'Натрий Na', 'мг/кг'], ['v', 'Ванадий V', 'мг/кг'], ['si', 'Кремний Si', 'мг/кг'], ['k', 'Калий K', 'мг/кг'],
  ['p4', 'Частицы >4 мкм', '/мл'], ['p6', 'Частицы >6 мкм', '/мл'], ['p14', 'Частицы >14 мкм', '/мл'], ['iso', 'ISO 4406', ''],
  ['ca', 'Кальций Ca', 'мг/кг'], ['mg', 'Магний Mg', 'мг/кг'], ['zn', 'Цинк Zn', 'мг/кг'], ['p', 'Фосфор P', 'мг/кг'], ['b', 'Бор B', 'мг/кг'], ['ba', 'Барий Ba', 'мг/кг'], ['li', 'Литий Li', 'мг/кг'], ['cd', 'Кадмий Cd', 'мг/кг'], ['sb', 'Сурьма Sb', 'мг/кг'],
  ['hrs', 'Наработка агрегата', 'ч'], ['ohrs', 'Наработка масла', 'ч'], ['grade', 'Масло', ''], ['fuel', 'Топливо', '']];
const OIL_PM = Object.fromEntries(OIL_P.map(p => [p[0], p]));
const RAT = { N: ['Норма', 'var(--green)'], A: ['Внимание', 'var(--acc)'], C: ['Тревога', 'var(--red)'] };
const rbadge = r => r && RAT[r] ? `<span class="tag" style="color:${RAT[r][1]};border-color:${RAT[r][1]}">${RAT[r][0]}</span>` : '<span class="small">—</span>';
const OIL_G = [['', 'Все'], ['ME', 'ГД'], ['DG', 'ДГ и турбогенератор'], ['Механизмы', 'Механизмы'], ['Палуба', 'Палуба'], ['BoB', 'BoB']];
function oilData() {
  const eqs = db.all('oil').filter(r => r.id.startsWith('eq-')).map(r => ({ ...r, eq: r.id.slice(3) }));
  const smp = db.all('oil').filter(r => r.id.startsWith('s-'));
  const by = {}; for (const s of smp) (by[s.eq] ||= []).push(s); for (const k in by) by[k].sort((a, b) => a.date.localeCompare(b.date));
  return { eqs, by };
}
function lim(eq, k) { // "125.0 / 90.0" -> {hi:125, lo:90}; ">25 / <3"; "189 - 180"; "<1.5"
  const L = (eq.limits || {})[k]; if (!L) return null; const out = {};
  const pr = (s, lvl) => { if (!s) return; const ps = s.split('/').map(x => x.trim()); for (const p of ps) { const v = tval(p); if (v == null) continue; if (p.startsWith('<')) out[lvl + 'lo'] = v; else if (p.startsWith('>')) out[lvl + 'hi'] = v; else if (/ - /.test(p)) { const [a] = p.split(' - '); out[lvl + 'hi'] = tval(a) } else if (ps.length === 2) out[lvl + (ps.indexOf(p) === 0 ? 'hi' : 'lo')] = v; else out[lvl + 'hi'] = v } };
  pr(L[1], 'a'); pr(L[2], 'c'); out.typ = tval(L[0]); return out;
}
export function oilView() {
  const { eqs, by } = oilData(), meta = db.get('oil/meta');
  if (!eqs.length) return `<div><h1>Анализы масла</h1></div><div class="banner">Данных ещё нет. Пришли отчёты VPS OCM (PDF) — разберу.</div>`;
  const S = C.S, sel = eqs.find(e => e.eq === S.oilEq);
  if (sel) return oilEquip(sel, by[sel.eq] || []);
  const list = eqs.filter(e => !S.oilG || e.group === S.oilG).sort((a, b) => a.eq.localeCompare(b.eq));
  const lastOf = e => (by[e.eq] || []).filter(s => s.rating).slice(-1)[0] || (by[e.eq] || []).slice(-1)[0];
  const att = eqs.map(e => ({ e, s: lastOf(e) })).filter(x => x.s && (x.s.rating === 'A' || x.s.rating === 'C') && x.s.date >= '2026-01-01');
  const K = ['v40', 'bn', 'water', 'fe', 'cu', 'na', 'v', 'si', 'iso'];
  return `<div><h1>Анализы масла</h1><div class="sub">VPS OCM · ${meta ? dd(meta.from) + ' — ' + dd(meta.to) + ' · ' + meta.n + ' проб' : ''}</div></div>
  ${att.length ? `<section class="card"><h2>Требуют внимания по последней пробе</h2><div class="list mt">${att.map(({ e, s }) => `<a class="t" href="#oil" data-act="oileq" data-k="${e.eq}"><div class="tb"><span class="tt">${esc(e.name)} ${rbadge(s.rating)}</span><span class="small">${dd(s.date)} · ${esc((s.summary || '').replace(/^Oil condition requires attention\. Oil is fit for further use, but monitor trends and equipment closely\. /, ''))}</span></div></a>`).join('')}</div></section>` : ''}
  ${chips('oilg', S.oilG, OIL_G)}
  <section class="card"><h2>Последние пробы по агрегатам</h2><div class="scroll mt"><table class="mtab"><thead><tr><th class="stick">Агрегат</th><th>Дата</th><th>Оценка</th>${K.map(k => `<th>${OIL_PM[k][1].replace(/ .*$/, k === 'v40' ? ' 40' : '')}</th>`).join('')}<th>Проб</th></tr></thead><tbody>
  ${list.map(e => { const s = (by[e.eq] || []).slice(-1)[0], rs = lastOf(e); if (!s) return ''; return `<tr class="click" data-act="oileq" data-k="${e.eq}"><th class="stick">${esc(e.name)}</th><td>${dds(s.date)}</td><td>${rbadge(rs && rs.date === s.date ? rs.rating : s.rating)}</td>${K.map(k => `<td>${esc(k === 'water' ? (s.v.water ?? (s.v.waterppm != null ? s.v.waterppm + ' ppm' : '')) : s.v[k] ?? '')}</td>`).join('')}<td>${(by[e.eq] || []).length}</td></tr>` }).join('')}
  </tbody></table></div><div class="note">Нажми на агрегат — откроется полная история проб, тренд по любому показателю и пределы лаборатории. Оценка — по сводке VPS для этой пробы; у ранних проб, которые есть только как «предыдущие» в старых отчётах, оценки нет.</div></section>`;
}
function oilEquip(e, smp) {
  const S = C.S, pk = S.oilP, P = OIL_PM[pk] || OIL_PM.v40, L = lim(e, pk);
  const present = OIL_P.filter(([k]) => smp.some(s => s.v[k] != null && s.v[k] !== '' && s.v[k] !== '-'));
  const numeric = present.filter(([k]) => !['iso', 'grade', 'fuel'].includes(k));
  const lines = []; if (L) { if (L.ahi != null) lines.push({ v: L.ahi, label: 'внимание ' + L.ahi, color: 'var(--acc)' }); if (L.alo != null) lines.push({ v: L.alo, label: 'внимание ' + L.alo, color: 'var(--acc)' }); if (L.chi != null) lines.push({ v: L.chi, label: 'тревога ' + L.chi }); if (L.clo != null) lines.push({ v: L.clo, label: 'тревога ' + L.clo }) }
  const ser = [{ name: P[1] + (P[2] ? ', ' + P[2] : ''), color: COL[0], pts: smp.map(s => [s.date, tval(s.v[pk])]) }];
  const cols = smp.slice().reverse().slice(0, S.oilAll ? 999 : 12);
  const limTxt = k => { const l = (e.limits || {})[k]; return l ? [l[0] && 'тип. ' + l[0], l[1] && 'вним. ' + l[1], l[2] && 'трев. ' + l[2]].filter(Boolean).join(' · ') : '' };
  return `<div><div class="row between"><h1>${esc(e.name)}</h1><button class="btn" data-act="oileq" data-k="">← Все агрегаты</button></div><div class="sub">VPS ID ${esc(e.eq)}${e.grade ? ' · ' + esc(e.grade) : ''} · ${smp.length} проб, ${dd(smp[0]?.date)} — ${dd(smp[smp.length - 1]?.date)}</div></div>
  <section class="card"><h2>Тренд · ${esc(P[1])}</h2>${chips('oilp', pk, numeric.map(([k, l]) => [k, l.replace(/ [A-Z][a-z]?$/, '')]))}
   ${timeChart(ser, { label: P[1], lines })}${legend(ser)}${limTxt(pk) ? `<div class="note">Пределы лаборатории: ${esc(limTxt(pk))}</div>` : ''}<div class="note">Значения вида «&lt;1» показаны на графике как 1.</div></section>
  <section class="card"><h2>История проб</h2><div class="scroll mt"><table class="mtab"><thead><tr><th class="stick">Показатель</th>${cols.map(s => `<th>${dds(s.date)}</th>`).join('')}</tr></thead><tbody>
   <tr><th class="stick">Оценка</th>${cols.map(s => `<td>${rbadge(s.rating)}</td>`).join('')}</tr>
   ${present.map(([k, l, u]) => `<tr class="click" data-act="oilp" data-k="${k}"><th class="stick">${esc(l)}${u ? ', ' + u : ''}</th>${cols.map(s => { const v = s.v[k], x = tval(v), Lk = lim(e, k); const bad = Lk && x != null && ((Lk.chi != null && x >= Lk.chi && !String(v).startsWith('<')) || (Lk.clo != null && x <= Lk.clo && !String(v).startsWith('>'))) ? 'bad' : Lk && x != null && ((Lk.ahi != null && x >= Lk.ahi && !String(v).startsWith('<')) || (Lk.alo != null && x <= Lk.alo && !String(v).startsWith('>'))) ? 'warnc' : ''; return `<td class="${bad}">${esc(v ?? '')}</td>` }).join('')}</tr>`).join('')}
   <tr><th class="stick">Проба №</th>${cols.map(s => `<td class="small">${esc(s.sid || '')}</td>`).join('')}</tr>
  </tbody></table></div>${smp.length > 12 && !S.oilAll ? `<button class="btn mt" data-act="oilall">Показать все пробы (${smp.length})</button>` : ''}
  <div class="note">Жёлтым — достигнут предел «внимание», красным — «тревога» (пределы из последнего отчёта VPS для этого агрегата).</div></section>
  <section class="card"><h2>Заключения лаборатории</h2><div class="list mt">${smp.slice().reverse().filter(s => s.summary).map(s => `<div class="t"><div class="tb"><span class="tt">${dd(s.date)} ${rbadge(s.rating)}</span><span class="small">${esc(s.summary)}</span></div></div>`).join('') || '<div class="empty">Нет</div>'}</div></section>`;
}

/* =================== ДГ performance =================== */
const dgTests = () => db.all('dg').filter(r => r.id.startsWith('t-')).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
const F = (t, g, k) => t.f && t.f[g] ? t.f[g][k] : undefined;
const cylA = (t, k) => Object.values((t.cyl || {})[k] || {}).map(tval).filter(v => v != null);
function dgSum(t) {
  const pm = cylA(t, 'Pmax, bar'), ex = cylA(t, 'Exh. temp, C'), mi = cylA(t, 'MIP, bar');
  return { load: F(t, 'Load/hours', 'Load %, ISO') ?? F(t, 'Load/hours', 'Load %, form') ?? F(t, 'Load/hours', 'Load %MCR mean (Doctor)'),
    kwe: F(t, 'Load/hours', 'Electrical power, kW (ISO)') ?? F(t, 'Load/hours', 'Electrical power, kW (form)'),
    pmax: avg(pm), pspread: pm.length ? Math.max(...pm) - Math.min(...pm) : null, exh: avg(ex), espread: ex.length ? Math.max(...ex) - Math.min(...ex) : null, mip: avg(mi),
    tc: F(t, 'ISO report', 'T/C speed, rpm (ISO measured)') ?? F(t, 'Operator form', 'T/C speed, rpm (form)') ?? F(t, 'Doctor', 'Turbo speed, rpm (Doctor)'),
    scav: F(t, 'ISO report', 'Measured scav press, bar (ISO)') ?? F(t, 'Operator form', 'Charge air press, bar') ?? F(t, 'Doctor', 'Scavenge press. mean, bar (Doctor)'),
    sfoc: F(t, 'ISO report', 'ISO-corrected SFOC measured, g/kWh'), sfocDev: F(t, 'ISO report', 'SFOC deviation, %'), rh: F(t, 'Load/hours', 'Running hours, total') };
}
const DG_M = { pmax: ['Pmax средн. и разброс', [['pmax', 'Pmax средн., бар'], ['pspread', 'Разброс Pmax, бар']]], exh: ['Т выхлопа', [['exh', 'Т выхлопа средн., °C'], ['espread', 'Разброс, °C']]], mip: ['MIP', [['mip', 'MIP средн., бар']]], load: ['Нагрузка', [['load', 'Нагрузка, %']]], sfoc: ['SFOC ISO', [['sfoc', 'SFOC ISO изм., г/кВт·ч']]] };
export function dgView() {
  const all = dgTests(), meta = db.get('dg/meta') || {}, S = C.S;
  if (!all.length) return `<div><h1>ДГ performance</h1></div><div class="banner">Данных ещё нет.</div>`;
  const T = all.filter(t => t.eng === S.dgE), X = T.map(t => ({ t, s: dgSum(t) })), m = DG_M[S.dgM] || DG_M.pmax;
  const ser = m[1].map(([k, l], i) => ({ name: l, color: COL[i], pts: X.map(x => [x.t.date, x.s[k]]) }));
  const sel = all.find(t => t.id === S.dgSel);
  return `<div><h1>ДГ performance</h1><div class="sub">${all.length} тестов 2017–2026 · Doctor/Acclaim, ISO Maersk, формы оператора</div></div>
  ${tabs('dge', S.dgE, ['AE1', 'AE2', 'AE3'].map(e => [e, e + ' · ' + all.filter(t => t.eng === e).length]))}
  <div class="note">${esc((meta.rating || {})[S.dgE] || '')}</div>
  <section class="card"><h2>Тренд · ${m[0]}</h2>${chips('dgm', S.dgM, Object.entries(DG_M).map(([k, v]) => [k, v[0]]))}${timeChart(ser, { label: m[0] })}${legend(ser)}
   <div class="note">Тесты сняты на разной нагрузке (от 24 до 82 %), поэтому абсолютные значения сравнивай с оглядкой на колонку «Нагрузка». Разброс между цилиндрами от нагрузки зависит меньше.</div></section>
  <section class="card"><h2>Все тесты ${esc(S.dgE)}</h2><div class="scroll mt"><table class="mtab"><thead><tr><th class="stick">Дата</th><th>Источник</th><th>Нагр., %</th><th>кВт эл.</th><th>Pmax ср.</th><th>разброс</th><th>MIP ср.</th><th>Т вых. ср.</th><th>разброс</th><th>ТК, об/мин</th><th>Pscav</th><th>SFOC ISO</th><th>к стенду</th><th>Наработка</th></tr></thead><tbody>
  ${X.slice().reverse().map(({ t, s }) => `<tr class="click${t.id === S.dgSel ? ' sel' : ''}" data-act="dgsel" data-k="${esc(t.id)}"><th class="stick">${dds(t.date)}${t.flags ? ' <span class="bad">•</span>' : ''}</th><td class="small">${esc(t.src)}</td><td>${num(s.load, 0)}</td><td>${num(s.kwe, 0)}</td><td>${num(s.pmax, 1)}</td><td class="${s.pspread >= 10 ? 'bad' : ''}">${num(s.pspread, 0)}</td><td>${num(s.mip, 2)}</td><td>${num(s.exh, 0)}</td><td class="${s.espread >= 60 ? 'bad' : ''}">${num(s.espread, 0)}</td><td>${num(tval(s.tc), 0)}</td><td>${num(tval(s.scav), 2)}</td><td>${num(s.sfoc, 1)}</td><td>${s.sfocDev != null ? num(s.sfocDev, 1) : '—'}</td><td>${num(tval(s.rh), 0)}</td></tr>`).join('')}
  </tbody></table></div><div class="note">Красная точка у даты — есть замечания по тесту. Разброс Pmax ≥ 10 бар и Т выхлопа ≥ 60 °C подсвечен как ориентир. Нажми строку — откроется тест со всеми полями и таблицей по цилиндрам.</div></section>
  ${sel ? dgDetail(sel) : ''}
  ${meta.notes ? `<section class="card"><h2>Как собрана таблица</h2><div class="kv2 mt">${meta.notes.map(([a, b]) => `<div><span class="lbl">${esc(a)}</span><span>${esc(b)}</span></div>`).join('')}</div></section>` : ''}`;
}
const DG_TR = { 'Load/hours': 'Нагрузка и наработка', 'Operator form': 'Форма оператора', 'ISO report': 'ISO-отчёт', 'Doctor': 'Doctor / Acclaim' };
function dgDetail(t) {
  const cyls = Object.keys(t.cyl || {}), n = Math.max(0, ...cyls.map(k => Object.keys(t.cyl[k]).length)), idx = [...Array(n)].map((_, i) => String(i + 1));
  return `<section class="card"><div class="row between"><h2>${esc(t.eng)} · ${dd(t.date)} ${esc(t.time || '')}</h2><button class="btn" data-act="dgsel" data-k="">Закрыть</button></div>
   <div class="note">${esc(t.type || '')} · источники: ${esc(t.src)}${t.cylsrc ? ' · по цилиндрам: ' + esc(t.cylsrc) : ''}</div>
   ${t.flags ? `<div class="banner mt">${esc(t.flags)}</div>` : ''}
   ${cyls.length ? `<div class="scroll mt"><table class="mtab"><thead><tr><th class="stick">Параметр</th>${idx.map(i => `<th>Цил. ${i}</th>`).join('')}<th>Средн.</th></tr></thead><tbody>${cyls.map(k => { const v = idx.map(i => t.cyl[k][i]); return `<tr><th class="stick">${esc(k)}</th>${v.map(x => `<td>${esc(x ?? '')}</td>`).join('')}<td class="note">${num(avg(v.map(tval)), 1)}</td></tr>` }).join('')}</tbody></table></div>` : ''}
   ${Object.entries(t.f || {}).map(([g, o]) => `<h3 class="mt">${esc(DG_TR[g] || g)}</h3><div class="kv2">${Object.entries(o).map(([k, v]) => `<div><span class="lbl">${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>`).join('')}
   ${t.files ? `<div class="note mt">Файлы: ${esc(t.files)}</div>` : ''}</section>`;
}

/* =================== Расход топлива (StarConnect flowmeters) =================== */
const fuelDays = () => db.all('fuel').filter(r => r.id.startsWith('day-')).map(r => ({ ...r, date: r.id.slice(4) })).sort((a, b) => a.date.localeCompare(b.date));
const CNT = [['eng1', 'ENG 1'], ['aein', 'AE INLET'], ['aeout', 'AE OUTLET'], ['mgo', 'AE INLET MGO'], ['b1', 'BLR 1'], ['b2', 'BLR 2']];
export function fuelView() {
  const meta = db.get('fuel/meta'), S = C.S;
  if (!meta) return `<div><h1>Расход топлива</h1></div><div class="banner">Данных ещё нет. Пришли выгрузку StarConnect «Flowmeters» и CAMS ICS за тот же период.</div>`;
  const D = fuelDays(), T = meta.totals;
  return `<div><h1>Расход топлива</h1><div class="sub">${esc(meta.source)} · ${dd(meta.from)} — ${dd(meta.to)} (UTC)</div></div>
  ${tabs('futab', S.fuTab, [['sum', 'Итоги и кривые'], ['day', 'По суткам'], ['cnt', 'Счётчики и расчёт']])}
  ${S.fuTab === 'day' ? fuelDaily(D) : S.fuTab === 'cnt' ? fuelCounters(meta) : `
  <section class="card"><h2>За период, т</h2><div class="grid4 mt">${stat('ГД', num(T.ME, 1), 'т HFO')}${stat('ДГ', num(T['AE HFO'], 1), 'т HFO · MGO ' + num(T['AE MGO'], 3))}${stat('Котёл 1', num(T['Boiler 1'], 1), 'т')}${stat('SFOC ГД, уст. режим', num(meta.steady.sfoc, 1), 'г/кВт·ч · ' + meta.steady.h + ' ч')}</div></section>
  <section class="card"><h2>Что видно</h2><div class="list mt">${meta.findings.map(f => `<div class="t"><div class="tb"><span class="small" style="color:var(--ink)">${esc(f)}</span></div></div>`).join('')}</div></section>
  <section class="card"><h2>ГД: SFOC по нагрузке</h2>${xyChart([{ name: 'SFOC измеренный', color: COL[0], pts: meta.me_curve.map(c => [c.mcr, c.sfoc, c.h, c.conf !== 'OK']) }], { xu: '%', xmin: 0, xmax: 80, label: 'SFOC по нагрузке' })}
   <div class="note">Размер точки — число установившихся часов; бледные точки — меньше 10 часов, малая достоверность.</div>
   <div class="scroll mt"><table class="mtab"><thead><tr><th class="stick">% MCR</th><th>Часов</th><th>кВт</th><th>об/мин</th><th>Индекс</th><th>SOG</th><th>SFOC, г/кВт·ч</th><th>т/сут</th><th>Достоверность</th></tr></thead><tbody>
   ${meta.me_curve.map(c => `<tr><th class="stick">${esc(c.band)}</th><td>${c.h}</td><td>${num(c.kw, 0)}</td><td>${num(c.rpm, 1)}</td><td>${num(c.fi, 1)}</td><td>${num(c.sog, 1)}</td><td><b>${num(c.sfoc, 1)}</b></td><td>${num(c.tday, 1)}</td><td class="${c.conf === 'OK' ? '' : 'note'}">${c.conf === 'OK' ? 'ok' : 'мало часов'}</td></tr>`).join('')}</tbody></table></div></section>
  <section class="card"><h2>ДГ: SFOC по нагрузке</h2><div class="scroll mt"><table class="mtab"><thead><tr><th class="stick">ДГ</th><th>Нагрузка</th><th>Часов</th><th>кВт эл.</th><th>SFOC, г/кВт·ч эл.</th><th>кг/ч</th><th>т/сут</th></tr></thead><tbody>
   ${meta.ae_curve.map(c => `<tr><th class="stick">${esc(c.gen)} <span class="small">${c.rate} кВт</span></th><td>${esc(c.band)}</td><td>${c.h}</td><td>${num(c.kw, 0)}</td><td><b>${num(c.sfoc, 1)}</b></td><td>${num(c.kg / c.h, 0)}</td><td>${num(c.tday, 2)}</td></tr>`).join('')}</tbody></table></div>
   <div class="note">Счётчик топлива ДГ один на все генераторы, поэтому SFOC по каждому ДГ считается только по часам, когда работал ровно один генератор.</div></section>
  <section class="card"><h2>Схема счётчиков и правила расчёта</h2><div class="list mt">${meta.map.map(x => `<div class="t"><div class="tb"><span class="small" style="color:var(--ink)">${esc(x)}</span></div></div>`).join('')}</div><div class="note mt">${esc(meta.rules)}</div></section>`}`;
}
function fuelDaily(D) {
  const ser = [{ name: 'ГД, т/сут', color: COL[0], pts: D.map(d => [d.date, d.me]) }, { name: 'ДГ, т/сут', color: COL[1], pts: D.map(d => [d.date, d.ae]) }];
  const s2 = [{ name: 'SFOC ГД, г/кВт·ч', color: COL[2], pts: D.filter(d => d.sfoc && d.meh >= 20).map(d => [d.date, d.sfoc]) }];
  const s3 = [{ name: 'Плотность на счётчике ГД, кг/м³', color: COL[4], pts: D.map(d => [d.date, d.dens]) }];
  return `<section class="card"><h2>Расход по суткам</h2>${timeChart(ser, { zero: true })}${legend(ser)}</section>
  <section class="card"><h2>SFOC ГД (сутки на ходу ≥ 20 ч) и плотность топлива</h2>${timeChart(s2)}${legend(s2)}${timeChart(s3, { h: 160 })}${legend(s3)}</section>
  <section class="card"><h2>Таблица по суткам (UTC)</h2><div class="scroll mt"><table class="mtab"><thead><tr><th class="stick">Дата</th><th>ГД, т</th><th>ДГ HFO, т</th><th>Котёл, т</th><th>Всего, т</th><th>ГД, ч</th><th>ГД, кВт</th><th>об/мин</th><th>SOG</th><th>ГД, МВт·ч</th><th>SFOC ГД</th><th>ДГ, МВт·ч</th><th>SFOC ДГ</th><th>Плотн.</th><th>Нагрузки</th></tr></thead><tbody>
  ${D.slice().reverse().map(d => `<tr><th class="stick">${dds(d.date)}</th><td><b>${num(d.me, 2)}</b></td><td>${num(d.ae, 2)}</td><td>${num(d.b1, 2)}</td><td>${num(d.tot, 2)}</td><td>${num(d.meh, 1)}</td><td>${num(d.mekw, 0)}</td><td>${num(d.rpm, 1)}</td><td>${num(d.sog, 1)}</td><td>${num(d.memwh, 1)}</td><td>${d.sfoc ? '<b>' + num(d.sfoc, 1) + '</b>' : '—'}</td><td>${num(d.aemwh, 1)}</td><td>${d.aesfoc ? num(d.aesfoc, 1) : '—'}</td><td>${num(d.dens, 1)}</td><td class="small">${d.cams != null ? num(d.cams, 0) + '%' + (d.ext ? ' · ноябрь' : '') : 'нет'}</td></tr>`).join('')}
  </tbody></table></div><div class="note">Сутки по UTC. SFOC за сутки показан, если нагрузки CAMS есть не меньше чем за 95 % часов. Отрицательные сотые у ГД на стоянке — шум счётчиков (~2 кг/ч). «ноябрь» — нагрузки добавлены из выгрузки CAMS ICS 01–22.11.</div></section>`;
}
function fuelCounters(meta) {
  const mine = db.all('fuel').filter(r => r.id.startsWith('cnt-')).sort((a, b) => a.at.localeCompare(b.at));
  const base = meta.counters.slice(-1)[0], all = [...meta.counters.map(r => ({ at: r[0].slice(0, 16), eng1: r[1], aein: r[2], aeout: r[3], mgo: r[4], b1: r[5], b2: r[6], src: 'StarConnect' })), ...mine.map(r => ({ ...r, src: 'вручную' }))].sort((a, b) => a.at.localeCompare(b.at));
  const dlt = (a, b) => { const h = (Date.parse(b.at) - Date.parse(a.at)) / 36e5, d = k => b[k] != null && a[k] != null ? b[k] - a[k] : null, ae = d('aein') != null && d('aeout') != null ? d('aein') - d('aeout') : null, me = d('eng1') != null && ae != null ? d('eng1') - ae : null; return { h, me, ae, mgo: d('mgo'), b1: d('b1') } };
  const last = all[all.length - 1], prev = all[all.length - 2], dl = prev ? dlt(prev, last) : null;
  return `<section class="card"><h2>Новые показания счётчиков</h2><div class="note">Впиши показания тоталайзеров (т) с экрана StarConnect или с самих расходомеров. Расход считается от предыдущего показания: ГД = ENG 1 − (AE IN − AE OUT), ДГ = AE IN − AE OUT.</div>
   <form id="cntf" class="fg mt"><label class="f">Дата и время (UTC)<input type="datetime-local" name="at" required></label>${CNT.map(([k, l]) => `<label class="f">${l}, т<input type="number" step="any" inputmode="decimal" name="${k}" placeholder="${base ? num(base[CNT.findIndex(c => c[0] === k) + 1], 3).replace(/\s/g, '') : ''}"></label>`).join('')}<div class="f" style="justify-content:flex-end"><button class="btn pri">Сохранить показания</button></div></form></section>
  ${dl ? `<section class="card"><h2>Последний интервал · ${esc(prev.at.replace('T', ' '))} → ${esc(last.at.replace('T', ' '))}</h2><div class="grid4 mt">${stat('Интервал', num(dl.h, 1), 'ч')}${stat('ГД', num(dl.me, 3), 'т · ' + num(dl.me / dl.h * 24, 2) + ' т/сут')}${stat('ДГ HFO', num(dl.ae, 3), 'т · ' + num(dl.ae / dl.h * 24, 2) + ' т/сут')}${stat('Котёл 1', num(dl.b1, 3), 'т')}</div></section>` : ''}
  <section class="card"><h2>Показания (${all.length})</h2><div class="scroll mt"><table class="mtab"><thead><tr><th class="stick">Время UTC</th>${CNT.map(c => `<th>${c[1]}</th>`).join('')}<th>ГД за интервал</th><th>ДГ за интервал</th><th>Источник</th></tr></thead><tbody>
  ${all.slice().reverse().map((r, i, arr) => { const p = arr[i + 1], x = p ? dlt(p, r) : null; return `<tr><th class="stick">${esc(r.at.replace('T', ' '))}</th>${CNT.map(([k]) => `<td>${num(r[k], 3)}</td>`).join('')}<td>${x ? num(x.me, 2) : ''}</td><td>${x ? num(x.ae, 2) : ''}</td><td class="small">${r.src === 'вручную' ? `вручную <button class="btn ghost" data-act="cntdel" data-k="${esc(r.id)}" aria-label="Удалить">×</button>` : esc(r.src)}</td></tr>` }).join('')}
  </tbody></table></div></section>
  <section class="card"><h2>Проверка счётчиков</h2><div class="scroll mt"><table class="mtab"><tbody>${meta.checks.map(r => `<tr>${r.map((x, i) => i ? `<td>${typeof x === 'number' ? num(x, 3) : esc(x ?? '')}</td>` : `<th class="stick">${esc(x ?? '')}</th>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
}

/* =================== Заметки с диктовкой =================== */
const NCAT = ['Наблюдение', 'Неисправность', 'Сделать', 'Вопрос Claude', 'Идея', 'Разное'];
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
export function notesView() {
  const S = C.S, q = S.ntQ.toLowerCase();
  const N = db.all('notes').sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  const L = N.filter(n => (!S.ntCat || n.cat === S.ntCat) && (S.ntMoved || !n.moved) && (!q || ((n.text || '') + ' ' + (n.eq || '') + ' ' + (n.cat || '')).toLowerCase().includes(q)));
  const E = S.ntEdit || { text: '', eq: '', cat: 'Наблюдение' };
  const eqs = [...new Set([...db.all('oil').filter(r => r.id.startsWith('eq-')).map(r => r.name), 'ГД', 'ДГ1', 'ДГ2', 'ДГ3', 'Котёл', 'Сепараторы', 'Компрессоры', 'Скрубберная система', 'Рулевая машина'])];
  return `<div><h1>Заметки</h1><div class="sub">Надиктуй или напиши — потом перенесём в задачи, журнал или вопросы мне</div></div>
  <section class="card"><form id="notef">
   <label class="f" style="position:relative">Текст заметки<textarea name="text" id="nttext" rows="5" placeholder="Например: ДГ2 — подтекание топлива у ТНВД цил. 5, проверить после стоянки">${esc(E.text)}</textarea></label>
   ${SR ? `<button type="button" class="btn${S.dict ? ' pri' : ''} mt" data-act="dict" aria-pressed="${S.dict}">${S.dict ? '● Идёт запись — нажми, чтобы остановить' : '🎙 Диктовать'}</button>` : '<div class="note mt">Диктовка браузером здесь недоступна — используй микрофон на клавиатуре телефона.</div>'}
   <div class="fg mt"><label class="f">Оборудование<input name="eq" list="nteq" value="${esc(E.eq)}" placeholder="необязательно"><datalist id="nteq">${eqs.map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
   <label class="f">Тип<select name="cat">${NCAT.map(c => `<option${c === E.cat ? ' selected' : ''}>${c}</option>`).join('')}</select></label>
   <div class="f" style="justify-content:flex-end"><div class="row">${E.id ? '<button type="button" class="btn" data-act="ntcancel">Отмена</button>' : ''}<button class="btn pri">${E.id ? 'Сохранить' : 'Добавить заметку'}</button></div></div></div></form>
   <div class="note">Диктовка браузера работает через сервис распознавания Google и требует интернета. Без связи используй голосовой ввод на клавиатуре телефона — он часто работает и офлайн.</div></section>
  <section class="card"><div class="row between"><h2>Мои заметки (${L.length})</h2><div class="row"><button class="btn" data-act="ntcopy">Скопировать для Claude</button>${navigator.share ? '<button class="btn" data-act="ntshare">Поделиться</button>' : ''}</div></div>
   <input class="search mt" id="ntq" type="search" placeholder="Поиск по тексту и оборудованию" value="${esc(S.ntQ)}">
   ${chips('ntcat', S.ntCat, [['', 'Все'], ...NCAT.map(c => [c, c])])}
   <label class="row mt small"><input type="checkbox" data-act="ntmoved" ${S.ntMoved ? 'checked' : ''}> Показывать перенесённые</label>
   <div class="list mt">${L.map(n => `<div class="t${n.moved ? ' done' : ''}"><div class="tb"><span class="tt" style="white-space:pre-wrap">${esc(n.text)}</span><span class="meta"><span class="tag">${esc(n.cat || '')}</span>${n.eq ? `<span class="small">${esc(n.eq)}</span>` : ''}<span class="small">${esc((n.at || '').slice(0, 16).replace('T', ' '))}</span>${n.moved ? '<span class="small">перенесено</span>' : ''}</span>
    <span class="row mt"><button class="btn ghost" data-act="ntedit" data-k="${esc(n.id)}">Править</button><button class="btn ghost" data-act="nttask" data-k="${esc(n.id)}">В задачу</button><button class="btn ghost" data-act="ntmove" data-k="${esc(n.id)}">${n.moved ? 'Вернуть' : 'Перенесено'}</button><button class="btn ghost" data-act="ntdel" data-k="${esc(n.id)}">Удалить</button></span></div></div>`).join('') || '<div class="empty">Заметок нет</div>'}</div>
   <div class="note">«Скопировать для Claude» берёт заметки, ещё не отмеченные как перенесённые, с учётом фильтра. Вставь их в чат со мной, и я разнесу их по задачам, журналу и истории неисправностей.</div></section>`;
}
function notesText() {
  const S = C.S, N = db.all('notes').filter(n => !n.moved && (!S.ntCat || n.cat === S.ntCat)).sort((a, b) => (a.at || '').localeCompare(b.at || ''));
  return 'Заметки из MCV Workbench (' + N.length + '):\n\n' + N.map(n => `- [${(n.at || '').slice(0, 16).replace('T', ' ')}] ${n.cat || ''}${n.eq ? ' · ' + n.eq : ''}: ${n.text}`).join('\n');
}
function dict(on) {
  const S = C.S;
  if (!on) { S.dict = false; if (rec) { try { rec.stop() } catch (e) {} } rec = null; C.render(); return }
  const ta = document.getElementById('nttext'); if (!ta) return;
  S.dict = true; let base = ta.value ? ta.value.replace(/\s*$/, ' ') : '';
  const start = () => {
    rec = new SR(); rec.lang = 'ru-RU'; rec.interimResults = true; rec.continuous = true;
    rec.onresult = e => { let fin = '', tmp = ''; for (let i = 0; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) fin += r[0].transcript; else tmp += r[0].transcript } const t = document.getElementById('nttext'); if (t) { t.value = base + fin + tmp; C.S.ntEdit = { ...(C.S.ntEdit || { eq: '', cat: 'Наблюдение' }), text: t.value } } rec._fin = fin };
    rec.onend = () => { base = base + (rec && rec._fin ? rec._fin + ' ' : ''); if (C.S.dict) { try { start() } catch (e) { C.S.dict = false; C.render() } } };
    rec.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { C.S.dict = false; C.toast('Нет доступа к микрофону'); C.render() } else if (e.error === 'network') { C.S.dict = false; C.toast('Диктовка требует интернета. Используй микрофон клавиатуры'); C.render() } };
    rec.start();
  };
  try { start() } catch (e) { S.dict = false; C.toast('Микрофон недоступен') }
  C.render(); setTimeout(() => document.getElementById('nttext')?.focus(), 30);
}

/* =================== события =================== */
export function onClick(a, el, e) {
  const S = C.S, k = el.dataset.k;
  const map = { pftab: 'pfTab', isom: 'isoM', oilg: 'oilG', oilp: 'oilP', dge: 'dgE', dgm: 'dgM', futab: 'fuTab', ntcat: 'ntCat' };
  if (map[a]) { S[map[a]] = k; if (a === 'dge') S.dgSel = ''; C.render(); return true }
  if (a === 'isosel') { S.isoSel = S.isoSel === k ? '' : k; C.render(); if (S.isoSel) setTimeout(() => document.querySelector('[data-act=isosel][data-k=""]')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 50); return true }
  if (a === 'dgsel') { S.dgSel = S.dgSel === k ? '' : k; C.render(); if (S.dgSel) setTimeout(() => document.querySelector('[data-act=dgsel][data-k=""]')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 50); return true }
  if (a === 'oileq') { e.preventDefault(); S.oilEq = k; S.oilAll = false; const eq = db.get('oil/eq-' + k); if (eq && !(S.oilP in (eq.limits || {}))) S.oilP = 'v40'; C.render(); scrollTo(0, 0); return true }
  if (a === 'oilall') { S.oilAll = true; C.render(); return true }
  if (a === 'cntdel') { db.del('fuel/' + k).then(C.render); C.toast('Показание удалено'); return true }
  if (a === 'dict') { dict(!S.dict); return true }
  if (a === 'ntcancel') { S.ntEdit = null; C.render(); return true }
  if (a === 'ntmoved') { S.ntMoved = el.checked; C.render(); return true }
  if (a === 'ntedit') { const n = db.get('notes/' + k); if (n) { S.ntEdit = { id: k, ...n }; C.render(); scrollTo(0, 0) } return true }
  if (a === 'ntdel') { if (el.dataset.sure) { const body = db.get('notes/' + k); db.del('notes/' + k).then(C.render); C.toast('Заметка удалена', { _row: 'notes/' + k, body }) } else { el.dataset.sure = '1'; el.textContent = 'Точно?' } return true }
  if (a === 'ntmove') { const n = db.get('notes/' + k); if (n) C.put('notes/' + k, { ...n, moved: !n.moved }).then(C.render); return true }
  if (a === 'nttask') { const n = db.get('notes/' + k); if (n) C.openTask(n.text.split(/[.\n]/)[0].slice(0, 90), n.text + (n.eq ? '\nОборудование: ' + n.eq : '')); return true }
  if (a === 'ntcopy') { const t = notesText(); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => C.toast('Скопировано: вставь в чат с Claude')).catch(() => { prompt('Скопируй текст:', t) }); return true }
  if (a === 'ntshare') { navigator.share({ title: 'Заметки MCV', text: notesText() }).catch(() => {}); return true }
  return false;
}
export function onInput(e) {
  const S = C.S;
  if (e.target.id === 'ntq') { S.ntQ = e.target.value; clearTimeout(S.nqt); S.nqt = setTimeout(C.render, 250); return true }
  if (e.target.form && e.target.form.id === 'notef') { const f = e.target.form; S.ntEdit = { ...(S.ntEdit || {}), text: f.text.value, eq: f.eq.value, cat: f.cat.value }; return true }
  return false;
}
export function onSubmit(id, f) {
  const S = C.S;
  if (id === 'notef') {
    const text = String(f.get('text') || '').trim(); if (!text) { C.toast('Пустая заметка'); return true }
    if (S.dict) dict(false);
    const E = S.ntEdit || {}, nid = E.id || 'n-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const old = E.id ? db.get('notes/' + E.id) : null;
    C.put('notes/' + nid, { text, eq: String(f.get('eq') || '').trim(), cat: f.get('cat'), at: old ? old.at : new Date().toISOString(), edited: old ? new Date().toISOString() : undefined, moved: old ? !!old.moved : false, by: 'Ярослав' }).then(() => { S.ntEdit = null; C.render(); C.toast(old ? 'Заметка сохранена' : 'Заметка добавлена') });
    return true;
  }
  if (id === 'cntf') {
    const at = String(f.get('at') || ''); if (!at) return true; const r = { at };
    let any = false; for (const [k] of CNT) { const v = f.get(k); if (v !== '' && v != null) { r[k] = +v; any = true } }
    if (!any) { C.toast('Впиши хотя бы один счётчик'); return true }
    C.put('fuel/cnt-' + at.replace(/[:T-]/g, ''), r).then(() => { C.render(); C.toast('Показания сохранены') });
    return true;
  }
  return false;
}
export const VIEWS = { oil: oilView, dg: dgView, fuel: fuelView, notes: notesView };
