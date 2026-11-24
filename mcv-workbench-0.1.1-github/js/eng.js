import { t as tr, original as orig, label as displayLabel, localized, language, locale, formatNumber, formatDate } from "./i18n.js";
/* Разделы инженерных данных: ME ISO/PMI, анализы масла, ДГ, расход топлива, заметки */
import * as db from './store.js';

let C; // контекст из app.js: { S, render, toast, put, openTask, feed }
export function init(ctx) { C = ctx; Object.assign(C.S, { pfTab: 'sc', isoM: 'dev', isoSel: '', oilG: '', oilEq: '', oilP: 'v40', dgE: 'AE1', dgM: 'pmax', dgSel: '', fuTab: 'sum', ntQ: '', ntCat: '', ntMoved: false, ntEdit: null, dict: false, lcTab: 'gr', lcG: '', lcQ: '' }) }

const COL = ['#5BB8F5', '#3FB68B', '#F2A93B', '#F0616D', '#B49CF5', '#4FD1C5', '#E6EDF3', '#FF9F7A'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (x, d = 2) => x == null || x === '' || isNaN(x) ? '—' : formatNumber(Number(x), d);
const MS = localized(() => ([tr("s701"), tr("s702"), tr("s703"), tr("s704"), tr("s36"), tr("s705"), tr("s706"), tr("s707"), tr("s708"), tr("s709"), tr("s710"), tr("s711")]));
const dd = s => language() === 'en' ? formatDate(s) : s ? (+s.slice(8, 10)) + ' ' + MS[+s.slice(5, 7) - 1] + ' ' + s.slice(0, 4) : '';
const dds = s => language() === 'en' ? formatDate(s) : s ? s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(2, 4) : '';
const avg = a => { const v = a.filter(x => x != null && !isNaN(x)); return v.length ? v.reduce((p, q) => p + +q, 0) / v.length : null };
const tval = s => { if (s == null) return null; if (typeof s === 'number') return s; const m = String(s).replace(',', '.').match(/-?\d+(\.\d+)?/); return m ? +m[0] : null };
const stat = (l, v, u) => `<div class="stat"><span class="lbl">${l}</span><b>${v}</b><span class="lbl">${u || ''}</span></div>`;
const tabs = (act, cur, items) => `<div class="tabs" role="tablist">${items.map(([k, l]) => `<button role="tab" data-act="${act}" data-k="${k}" aria-selected="${cur === k}">${l}</button>`).join('')}</div>`;
const chips = (act, cur, items) => `<div class="chips mt">${items.map(([k, l]) => `<button class="chip" data-act="${act}" data-k="${k}" aria-pressed="${cur === k}">${l}</button>`).join('')}</div>`;
const legend = ser => `<div class="legend">${ser.map(s => `<span><i style="background:${s.color}${s.dash ? ';opacity:.6' : ''}"></i>${esc(s.name)}</span>`).join('')}</div>`;

/* ---------- универсальный график по датам ---------- */
function timeChart(series, o = {}) {
  const W = 680, H = o.h || 240, P = 52, all = series.flatMap(s => s.pts).filter(p => p[1] != null && !isNaN(p[1]));
  if (all.length < 1) return ("<div class=\"empty\">" + tr("s712") + "</div>");
  const t = s => Date.parse(s.length === 7 ? s + '-15' : s.slice(0, 10));
  const t0 = Math.min(...all.map(p => t(p[0]))), t1 = Math.max(...all.map(p => t(p[0])));
  const lv = (o.lines || []).map(l => l.v);
  let mn = Math.min(...all.map(p => p[1]), ...lv), mx = Math.max(...all.map(p => p[1]), ...lv); const pad = (mx - mn) * .08 || Math.abs(mx) * .05 || 1; mn -= pad; mx += pad;
  if (o.zero && mn > 0) mn = 0;
  const x = v => P + (t1 === t0 ? (W - P) / 2 : (t(v) - t0) / (t1 - t0) * (W - P - 14)), y = v => H - 26 - (v - mn) / (mx - mn) * (H - 44);
  const ticks = [0, .25, .5, .75, 1].map(f => mn + (mx - mn) * f), span = mx - mn, dp = span < 1 ? 2 : span < 10 ? 1 : 0;
  const y0 = new Date(t0).getFullYear(), y1 = new Date(t1).getFullYear(), yrs = []; for (let yy = y0; yy <= y1 + 1; yy++) yrs.push(yy);
  const xt = (y1 - y0 >= 2) ? yrs.map(yy => [Date.parse(yy + '-01-01'), String(yy)]) : (() => { const r = []; const d = new Date(t0); d.setDate(1); while (d.getTime() <= t1) { r.push([d.getTime(), MS[d.getMonth()] + (d.getMonth() === 0 || !r.length ? ' ' + d.getFullYear() : '')]); d.setMonth(d.getMonth() + (t1 - t0 > 2e10 ? 3 : 1)) } return r })();
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || tr("s713"))}">
  ${ticks.map(v => `<line x1="${P}" x2="${W - 10}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${P - 6}" y="${y(v) + 4}" text-anchor="end">${num(v, dp)}</text>`).join('')}
  ${xt.filter(([v]) => v >= t0 - 1 && v <= t1 + 1).map(([v, l]) => `<text x="${(P + (t1 === t0 ? 0 : (v - t0) / (t1 - t0) * (W - P - 14))).toFixed(1)}" y="${H - 6}" text-anchor="middle">${l}</text>`).join('')}
  ${(o.lines || []).map(l => `<line x1="${P}" x2="${W - 10}" y1="${y(l.v)}" y2="${y(l.v)}" stroke="${l.color || 'var(--red)'}" stroke-dasharray="5 4"/><text x="${W - 12}" y="${y(l.v) - 4}" text-anchor="end" fill="${l.color || 'var(--red)'}">${esc(l.label || '')}</text>`).join('')}
  ${series.map(s => { const pts = s.pts.filter(p => p[1] != null && !isNaN(p[1])).sort((a, b) => t(a[0]) - t(b[0])); const d = pts.map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1)).join('');
    return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" ${s.dash ? 'stroke-dasharray="6 4" opacity=".75"' : ''} stroke-linejoin="round"/>${pts.map(p => `<circle cx="${x(p[0]).toFixed(1)}" cy="${y(p[1]).toFixed(1)}" r="${pts.length > 60 ? 1.8 : 3}" fill="${s.color}"><title>${esc(s.name)} · ${dds(p[0])}: ${num(p[1], dp + 1)}</title></circle>`).join('')}` }).join('')}</svg>`;
}
function xyChart(series, o = {}) {
  const W = 680, H = o.h || 240, P = 52, all = series.flatMap(s => s.pts);
  if (!all.length) return ("<div class=\"empty\">" + tr("s537") + "</div>");
  let xmn = o.xmin ?? Math.min(...all.map(p => p[0])), xmx = o.xmax ?? Math.max(...all.map(p => p[0]));
  let mn = Math.min(...all.map(p => p[1])), mx = Math.max(...all.map(p => p[1])); const pad = (mx - mn) * .1 || 1; mn -= pad; mx += pad;
  const x = v => P + (v - xmn) / (xmx - xmn || 1) * (W - P - 14), y = v => H - 26 - (v - mn) / (mx - mn) * (H - 44);
  const ticks = [0, .25, .5, .75, 1].map(f => mn + (mx - mn) * f), dp = mx - mn < 10 ? 1 : 0, xs = []; for (let v = Math.ceil(xmn / 10) * 10; v <= xmx; v += 10) xs.push(v);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || tr("s713"))}">
  ${ticks.map(v => `<line x1="${P}" x2="${W - 10}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${P - 6}" y="${y(v) + 4}" text-anchor="end">${num(v, dp)}</text>`).join('')}
  ${xs.map(v => `<text x="${x(v)}" y="${H - 6}" text-anchor="middle">${v}${o.xu || ''}</text>`).join('')}
  ${series.map(s => `${s.line ? `<path d="${s.pts.map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1)).join('')}" fill="none" stroke="${s.color}" stroke-width="1.5" opacity=".6"/>` : ''}${s.pts.map(p => `<circle cx="${x(p[0]).toFixed(1)}" cy="${y(p[1]).toFixed(1)}" r="${p[2] ? Math.max(3, Math.min(14, Math.sqrt(p[2]) * 1.1)) : 3.5}" fill="${s.color}" fill-opacity="${p[3] ? .35 : .8}" stroke="${s.color}"><title>${esc(s.name)} · ${num(p[0], 1)}${o.xu || ''}: ${num(p[1], 1)}${p[2] ? ' · ' + p[2] + tr("s415") : ''}</title></circle>`).join('')}`).join('')}</svg>`;
}

/* =================== ME performance: вкладки =================== */
export function perfTabs() { return tabs('pftab', C.S.pfTab, [['sc', tr("s714")], ['iso', tr("s715")], ['pmi', tr("s716")]]) }
const isoRecs = () => db.all('mehist').filter(r => r.id.startsWith('iso-')).sort((a, b) => a.date.localeCompare(b.date));
const ISO_M = localized(() => ({
  dev: [tr("s717"), [['pcomp_d', tr("s718")], ['pmax_d', tr("s719")], [r => r.pscav_i != null && r.pscav_m != null ? (r.pscav_i - r.pscav_m) * 10 : null, tr("s720")], ['sfoc_dev', tr("s721")]]],
  sfoc: ['SFOC ISO', [['sfoc_iso', tr("s722")], ['sfoc_m', tr("s723"), 1]]],
  pcomp: ['Pcomp', [['pcomp', tr("s724")], ['pcomp_i', tr("s725")], ['pcomp_m', tr("s726"), 1]]],
  pmax: ['Pmax', [['pmax', tr("s724")], ['pmax_i', tr("s725")], ['pmax_m', tr("s726"), 1]]],
  pscav: ['Pscav', [['pscav', tr("s724")], ['pscav_i', tr("s725")], ['pscav_m', tr("s726"), 1]]],
  texh: [tr("s727"), [['texh', tr("s728")], ['texh_i', 'ISO, °C'], ['texh_m', tr("s729"), 1]]],
  tc: [tr("s730"), [['tcrpm', tr("s731")], ['tcrpm_i', tr("s732")], ['tcrpm_m', tr("s733"), 1]]],
  eff: [tr("s734"), [['eff', tr("s735")], ['eff_c', tr("s736")], ['eff_t', tr("s737")]]],
  load: [tr("s511"), [['load', tr("s738")], ['rpm', tr("s739")]]],
}));
const gv = (r, k) => typeof k === 'function' ? k(r) : r[k];
export function isoView() {
  const R = isoRecs(); if (!R.length) return ("<div class=\"banner\">" + tr("s740") + "</div>");
  const m = ISO_M[C.S.isoM] || ISO_M.dev, ser = m[1].map(([k, l, dash], i) => ({ name: l, color: COL[i], dash, pts: R.map(r => [r.date, gv(r, k)]) }));
  const last = R[R.length - 1], sel = R.find(r => r.date === C.S.isoSel);
  const fl = r => r.flags && Object.keys(r.flags).length ? Object.entries(r.flags).map(([k, v]) => k + ': ' + v).join('; ') : '';
  const c3 = (r, a, b, cc, d = 1) => `<td>${num(r[a], d)}</td><td>${num(r[b], d)}</td><td class="note">${num(r[cc], d)}</td>`;
  return `<section class="card"><div class="row between"><h2>${tr("s752", {0: (dd(last.date))})}</h2><span class="sub">${esc(last.src || '')}</span></div>
   <div class="grid4 mt">${stat(tr("s511"), num(last.load, 1), '% MCR · ' + num(last.kw, 0) + tr("s528"))}${stat(tr("s741"), (last.pcomp_d > 0 ? '+' : '') + num(last.pcomp_d, 1), tr("s526"))}${stat(tr("s742"), (last.pmax_d > 0 ? '+' : '') + num(last.pmax_d, 1), tr("s526"))}${stat('SFOC ISO', num(last.sfoc_iso, 1), tr("s743") + num(last.sfoc_m, 1))}</div>
   <div class="grid4 mt">${stat('Pscav', num(last.pscav, 2), tr("s744") + num(last.pscav_i, 2) + tr("s745") + num(last.pscav_m, 2))}${stat(tr("s727"), num(last.texh, 0), tr("s746") + num(last.texh_m, 0))}${stat(tr("s747"), num(last.tcrpm, 0), tr("s748") + num(last.tcrpm_m, 0))}${stat(tr("s734"), num(last.eff, 3), tr("s749") + num(last.eff_c, 3) + tr("s750") + num(last.eff_t, 3))}</div></section>
  <section class="card"><h2>${tr("s753", {10: (m[0])})}</h2>${chips('isom', C.S.isoM, Object.entries(ISO_M).map(([k, v]) => [k, v[0]]))}
   ${timeChart(ser, { label: m[0], lines: C.S.isoM === 'dev' ? [{ v: 0, color: '#3A4A5C' }] : [] })}${legend(ser)}
   <div class="note">${tr("s754")}</div></section>
  <section class="card"><h2>${tr("s755", {14: (R.length)})}</h2><div class="scroll mt"><table class="mtab"><thead>
   <tr><th class="stick" rowspan="2">${tr("s147")}</th><th rowspan="2">${tr("s756")}</th><th rowspan="2">${tr("s522")}</th><th rowspan="2">${tr("s524")}</th><th colspan="3">${tr("s491")}</th><th colspan="3">${tr("s757")}</th><th colspan="3">${tr("s758")}</th><th colspan="4">${tr("s514")}</th><th colspan="4">${tr("s513")}</th><th colspan="3">SFOC ISO</th><th colspan="3">${tr("s734")}</th></tr>
   <tr>${tr("s751").split(' ').map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>
   ${R.slice().reverse().map(r => `<tr class="click${r.date === C.S.isoSel ? ' sel' : ''}" data-act="isosel" data-k="${r.date}" title="${esc(fl(r))}"><th class="stick">${dds(r.date)}${fl(r) ? ' <span class="bad">•</span>' : ''}</th><td>${num(r.load, 1)}</td><td>${num(r.kw, 0)}</td><td>${num(r.rpm, 1)}</td>
    ${c3(r, 'pscav', 'pscav_i', 'pscav_m', 2)}${c3(r, 'texh', 'texh_i', 'texh_m', 0)}${c3(r, 'tcrpm', 'tcrpm_i', 'tcrpm_m', 0)}
    ${c3(r, 'pcomp', 'pcomp_i', 'pcomp_m')}<td class="${Math.abs(r.pcomp_d) > 3 ? 'bad' : ''}">${num(r.pcomp_d, 1)}</td>${c3(r, 'pmax', 'pmax_i', 'pmax_m')}<td class="${Math.abs(r.pmax_d) > 3 ? 'bad' : ''}">${num(r.pmax_d, 1)}</td>
    <td>${num(r.sfoc_iso, 1)}</td><td class="note">${num(r.sfoc_m, 1)}</td><td>${num(r.sfoc_dev, 1)}</td><td>${num(r.eff, 3)}</td><td>${num(r.eff_c, 3)}</td><td>${num(r.eff_t, 3)}</td></tr>`).join('')}</tbody></table></div>
   <div class="note">${tr("s759")}</div></section>
  ${sel ? isoDetail(sel) : ''}`;
}
const ISO_L = localized(() => ([['date', tr("s147")], ['kw', tr("s760")], ['load', tr("s738")], ['mip', tr("s761")], ['ipow', tr("s762")], ['mech', tr("s763")], ['rpm', tr("s481")], ['light', 'Light running, %'],
  ['tblow', tr("s764")], ['pamb', tr("s765")], ['dpf', tr("s766")], ['dpf_m', tr("s767")], ['dpc', tr("s768")], ['dpc_m', tr("s769")], ['tsw', tr("s770")],
  ['tscav', tr("s771")], ['tscav_m', tr("s772")], ['pscav', tr("s491")], ['pscav_i', 'Pscav ISO'], ['pscav_m', tr("s773")], ['pexh', tr("s774")], ['pexh_m', tr("s775")], ['pback', tr("s776")],
  ['texh', tr("s777")], ['texh_i', tr("s778")], ['texh_m', tr("s779")], ['tcrpm', tr("s730")], ['tcrpm_i', tr("s780")], ['tcrpm_m', tr("s781")],
  ['pcomp', tr("s514")], ['pcomp_i', 'Pcomp ISO'], ['pcomp_m', tr("s782")], ['pcomp_d', tr("s783")], ['pmax', tr("s513")], ['pmax_i', 'Pmax ISO'], ['pmax_m', tr("s784")], ['pmax_d', tr("s785")], ['rise', tr("s786")],
  ['hours', tr("s787")], ['fuel', tr("s788")], ['sfoc_raw', tr("s789")], ['lcv', tr("s790")], ['sfoc_lcv', tr("s791")], ['sfoc_iso', 'SFOC ISO'], ['sfoc_m', tr("s792")], ['sfoc_dev', tr("s793")],
  ['eff', tr("s794")], ['eff_c', tr("s795")], ['eff_t', tr("s796")]]));
function isoDetail(r) {
  return `<section class="card"><div class="row between"><h2>${tr("s797", {0: (dd(r.date))})}</h2><button class="btn" data-act="isosel" data-k="">${tr("s570")}</button></div><div class="note">${esc(r.src || '')}${r.note ? ' · ' + esc(r.note) : ''}</div>
  <div class="kv2 mt">${ISO_L.filter(([k]) => r[k] != null).map(([k, l]) => `<div><span class="lbl">${l}</span><b>${typeof r[k] === 'number' ? num(r[k], Math.abs(r[k]) < 10 ? 3 : 1) : esc(r[k])}</b>${r.flags && r.flags[k] ? ` <span class="tag warn">${esc(r.flags[k])}</span>` : ''}</div>`).join('')}</div></section>`;
}
export function pmiView() {
  const R = db.all('mehist').filter(r => r.id.startsWith('pmi-')).sort((a, b) => b.date.localeCompare(a.date));
  if (!R.length) return ("<div class=\"banner\">" + tr("s798") + "</div>");
  const ser = ['pmax', 'pcomp', 'pi'].map((k, i) => ({ name: { pmax: tr("s799"), pcomp: tr("s800"), pi: tr("s801") }[k], color: COL[i], pts: R.map(r => [r.date, r.cyl.Mean ? r.cyl.Mean[k] : null]) }));
  return `${R.length > 1 ? `<section class="card"><h2>${tr("s802")}</h2>${timeChart(ser, { label: 'PMI' })}${legend(ser)}</section>` : ''}
  ${R.map(r => { const M = r.cyl.Mean || {}; return `<section class="card"><div class="row between"><h2>PMI · ${dd(r.date)} ${esc(r.time || '')}</h2><span class="sub">${esc(r.src || '')}</span></div>
   <div class="grid4 mt">${stat(tr("s523"), num(r.rpm, 1), tr("s524"))}${stat('Pscav', num(r.pscav, 2), tr("s526"))}${stat(tr("s803"), num(r.mw, 1), tr("s804"))}${stat(tr("s805"), num(r.load, 0), '%')}</div>
   <div class="scroll mt"><table class="mtab"><thead><tr><th class="stick">${tr("s806")}</th><th>${tr("s807")}</th><th>${tr("s514")}</th><th>${tr("s808")}</th><th>${tr("s513")}</th><th>${tr("s808")}</th><th>Pcomp/Pscav</th></tr></thead><tbody>
   ${['1', '2', '3', '4', '5', '6', 'Mean'].filter(c => r.cyl[c]).map(c => { const x = r.cyl[c], d1 = x.pcomp - M.pcomp, d2 = x.pmax - M.pmax; return `<tr><th class="stick">${c === 'Mean' ? tr("s380") : c}</th><td>${num(x.pi, 1)}</td><td>${num(x.pcomp, 1)}</td><td class="${c !== 'Mean' && Math.abs(d1) >= 3 ? 'bad' : 'note'}">${c === 'Mean' ? '' : (d1 > 0 ? '+' : '') + num(d1, 1)}</td><td>${num(x.pmax, 1)}</td><td class="${c !== 'Mean' && Math.abs(d2) >= 3 ? 'bad' : 'note'}">${c === 'Mean' ? '' : (d2 > 0 ? '+' : '') + num(d2, 1)}</td><td>${num(x.ratio, 1)}</td></tr>` }).join('')}</tbody></table></div></section>` }).join('')}
  <div class="note">${tr("s809")}</div>`;
}

/* =================== Анализы масла (VPS OCM) =================== */
const OIL_P = localized(() => ([['v40', tr("s810"), tr("s811")], ['v100', tr("s812"), tr("s811")], ['vi', tr("s813"), ''], ['bn', 'BN', tr("s814")], ['tan', 'TAN', tr("s814")], ['water', tr("s289"), '%'], ['waterppm', tr("s289"), tr("s815")], ['flash', tr("s816"), '°C'],
  ['ox', tr("s817"), 'Abs/cm'], ['nit', tr("s818"), 'Abs/cm'], ['sulf', tr("s819"), 'Abs/cm'], ['soot', tr("s820"), '%'],
  ['fe', tr("s821"), tr("s815")], ['cu', tr("s822"), tr("s815")], ['al', tr("s823"), tr("s815")], ['cr', tr("s824"), tr("s815")], ['pb', tr("s825"), tr("s815")], ['sn', tr("s826"), tr("s815")], ['ni', tr("s827"), tr("s815")], ['ag', tr("s828"), tr("s815")], ['mo', tr("s829"), tr("s815")], ['ti', tr("s830"), tr("s815")], ['mn', tr("s831"), tr("s815")], ['pq', tr("s832"), ''],
  ['na', tr("s833"), tr("s815")], ['v', tr("s834"), tr("s815")], ['si', tr("s835"), tr("s815")], ['k', tr("s836"), tr("s815")],
  ['p4', tr("s837"), tr("s838")], ['p6', tr("s839"), tr("s838")], ['p14', tr("s840"), tr("s838")], ['iso', 'ISO 4406', ''],
  ['ca', tr("s841"), tr("s815")], ['mg', tr("s842"), tr("s815")], ['zn', tr("s843"), tr("s815")], ['p', tr("s844"), tr("s815")], ['b', tr("s845"), tr("s815")], ['ba', tr("s846"), tr("s815")], ['li', tr("s847"), tr("s815")], ['cd', tr("s848"), tr("s815")], ['sb', tr("s849"), tr("s815")],
  ['hrs', tr("s850"), tr("s851")], ['ohrs', tr("s852"), tr("s851")], ['grade', tr("s290"), ''], ['fuel', tr("s291"), '']]));
const OIL_PM = localized(() => Object.fromEntries(OIL_P.map(p => [p[0], p])));
const RAT = localized(() => ({ N: [tr("s260"), 'var(--green)'], A: [tr("s853"), 'var(--acc)'], C: [tr("s854"), 'var(--red)'] }));
const rbadge = r => r && RAT[r] ? `<span class="tag" style="color:${RAT[r][1]};border-color:${RAT[r][1]}">${RAT[r][0]}</span>` : '<span class="small">—</span>';
const OIL_G = localized(() => ([['', tr("s114")], ['ME', tr("s855")], ['DG', tr("s856")], [orig("s857"), tr("s857")], [orig("s858"), tr("s858")], ['BoB', 'BoB']]));
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
  if (!eqs.length) return `<div><h1>${tr("s582")}</h1></div><div class="banner">${tr("s859")}</div>`;
  const S = C.S, sel = eqs.find(e => e.eq === S.oilEq);
  if (sel) return oilEquip(sel, by[sel.eq] || []);
  const list = eqs.filter(e => !S.oilG || e.group === S.oilG).sort((a, b) => a.eq.localeCompare(b.eq));
  const lastOf = e => (by[e.eq] || []).filter(s => s.rating).slice(-1)[0] || (by[e.eq] || []).slice(-1)[0];
  const att = eqs.map(e => ({ e, s: lastOf(e) })).filter(x => x.s && (x.s.rating === 'A' || x.s.rating === 'C') && x.s.date >= '2026-01-01');
  const K = ['v40', 'bn', 'water', 'fe', 'cu', 'na', 'v', 'si', 'iso'];
  return `<div><h1>${tr("s582")}</h1><div class="sub">VPS OCM · ${meta ? dd(meta.from) + ' — ' + dd(meta.to) + ' · ' + meta.n + tr("s860") : ''}</div></div>
  ${att.length ? `<section class="card"><h2>${tr("s861")}</h2><div class="list mt">${att.map(({ e, s }) => `<a class="t" href="#oil" data-act="oileq" data-k="${e.eq}"><div class="tb"><span class="tt">${esc(e.name)} ${rbadge(s.rating)}</span><span class="small">${dd(s.date)} · ${esc((s.summary || '').replace(/^Oil condition requires attention\. Oil is fit for further use, but monitor trends and equipment closely\. /, ''))}</span></div></a>`).join('')}</div></section>` : ''}
  ${chips('oilg', S.oilG, OIL_G)}
  <section class="card"><h2>${tr("s862")}</h2><div class="scroll mt"><table class="mtab"><thead><tr><th class="stick">${tr("s863")}</th><th>${tr("s147")}</th><th>${tr("s864")}</th>${K.map(k => `<th>${OIL_PM[k][1].replace(/ .*$/, k === 'v40' ? ' 40' : '')}</th>`).join('')}<th>${tr("s865")}</th></tr></thead><tbody>
  ${list.map(e => { const s = (by[e.eq] || []).slice(-1)[0], rs = lastOf(e); if (!s) return ''; return `<tr class="click" data-act="oileq" data-k="${e.eq}"><th class="stick">${esc(e.name)}</th><td>${dds(s.date)}</td><td>${rbadge(rs && rs.date === s.date ? rs.rating : s.rating)}</td>${K.map(k => `<td>${esc(k === 'water' ? (s.v.water ?? (s.v.waterppm != null ? s.v.waterppm + ' ppm' : '')) : s.v[k] ?? '')}</td>`).join('')}<td>${(by[e.eq] || []).length}</td></tr>` }).join('')}
  </tbody></table></div><div class="note">${tr("s866")}</div></section>`;
}
function oilEquip(e, smp) {
  const S = C.S, pk = S.oilP, P = OIL_PM[pk] || OIL_PM.v40, L = lim(e, pk);
  const present = OIL_P.filter(([k]) => smp.some(s => s.v[k] != null && s.v[k] !== '' && s.v[k] !== '-'));
  const numeric = present.filter(([k]) => !['iso', 'grade', 'fuel'].includes(k));
  const lines = []; if (L) { if (L.ahi != null) lines.push({ v: L.ahi, label: tr("s867") + L.ahi, color: 'var(--acc)' }); if (L.alo != null) lines.push({ v: L.alo, label: tr("s867") + L.alo, color: 'var(--acc)' }); if (L.chi != null) lines.push({ v: L.chi, label: tr("s868") + L.chi }); if (L.clo != null) lines.push({ v: L.clo, label: tr("s868") + L.clo }) }
  const ser = [{ name: P[1] + (P[2] ? ', ' + P[2] : ''), color: COL[0], pts: smp.map(s => [s.date, tval(s.v[pk])]) }];
  const cols = smp.slice().reverse().slice(0, S.oilAll ? 999 : 12);
  const limTxt = k => { const l = (e.limits || {})[k]; return l ? [l[0] && tr("s869") + l[0], l[1] && tr("s870") + l[1], l[2] && tr("s871") + l[2]].filter(Boolean).join(' · ') : '' };
  return `<div><div class="row between"><h1>${esc(e.name)}</h1><button class="btn" data-act="oileq" data-k="">${tr("s874")}</button></div><div class="sub">${tr("s875", {1: (esc(e.eq)), 2: (e.grade ? ' · ' + esc(e.grade) : ''), 3: (smp.length), 4: (dd(smp[0]?.date)), 5: (dd(smp[smp.length - 1]?.date))})}</div></div>
  <section class="card"><h2>${tr("s876", {6: (esc(P[1]))})}</h2>${chips('oilp', pk, numeric.map(([k, l]) => [k, l.replace(/ [A-Z][a-z]?$/, '')]))}
   ${timeChart(ser, { label: P[1], lines })}${legend(ser)}${limTxt(pk) ? `<div class="note">${tr("s872", {0: (esc(limTxt(pk)))})}</div>` : ''}<div class="note">${tr("s877")}</div></section>
  <section class="card"><h2>${tr("s878")}</h2><div class="scroll mt"><table class="mtab"><thead><tr><th class="stick">${tr("s879")}</th>${cols.map(s => `<th>${dds(s.date)}</th>`).join('')}</tr></thead><tbody>
   <tr><th class="stick">${tr("s864")}</th>${cols.map(s => `<td>${rbadge(s.rating)}</td>`).join('')}</tr>
   ${present.map(([k, l, u]) => `<tr class="click" data-act="oilp" data-k="${k}"><th class="stick">${esc(l)}${u ? ', ' + u : ''}</th>${cols.map(s => { const v = s.v[k], x = tval(v), Lk = lim(e, k); const bad = Lk && x != null && ((Lk.chi != null && x >= Lk.chi && !String(v).startsWith('<')) || (Lk.clo != null && x <= Lk.clo && !String(v).startsWith('>'))) ? 'bad' : Lk && x != null && ((Lk.ahi != null && x >= Lk.ahi && !String(v).startsWith('<')) || (Lk.alo != null && x <= Lk.alo && !String(v).startsWith('>'))) ? 'warnc' : ''; return `<td class="${bad}">${esc(v ?? '')}</td>` }).join('')}</tr>`).join('')}
   <tr><th class="stick">${tr("s880")}</th>${cols.map(s => `<td class="small">${esc(s.sid || '')}</td>`).join('')}</tr>
  </tbody></table></div>${smp.length > 12 && !S.oilAll ? `<button class="btn mt" data-act="oilall">${tr("s873", {0: (smp.length)})}</button>` : ''}
  <div class="note">${tr("s881")}</div></section>
  <section class="card"><h2>${tr("s882")}</h2><div class="list mt">${smp.slice().reverse().filter(s => s.summary).map(s => `<div class="t"><div class="tb"><span class="tt">${dd(s.date)} ${rbadge(s.rating)}</span><span class="small">${esc(s.summary)}</span></div></div>`).join('') || ("<div class=\"empty\">" + tr("s21") + "</div>")}</div></section>`;
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
const DG_M = localized(() => ({ pmax: [tr("s883"), [['pmax', tr("s884")], ['pspread', tr("s885")]]], exh: [tr("s886"), [['exh', tr("s887")], ['espread', tr("s888")]]], mip: ['MIP', [['mip', tr("s889")]]], load: [tr("s511"), [['load', tr("s890")]]], sfoc: ['SFOC ISO', [['sfoc', tr("s891")]]] }));
export function dgView() {
  const all = dgTests(), meta = db.get('dg/meta') || {}, S = C.S;
  if (!all.length) return `<div><h1>${tr("s584")}</h1></div><div class="banner">${tr("s892")}</div>`;
  const T = all.filter(t => t.eng === S.dgE), X = T.map(t => ({ t, s: dgSum(t) })), m = DG_M[S.dgM] || DG_M.pmax;
  const ser = m[1].map(([k, l], i) => ({ name: l, color: COL[i], pts: X.map(x => [x.t.date, x.s[k]]) }));
  const sel = all.find(t => t.id === S.dgSel);
  return `<div><h1>${tr("s584")}</h1><div class="sub">${tr("s894", {0: (all.length)})}</div></div>
  ${tabs('dge', S.dgE, ['AE1', 'AE2', 'AE3'].map(e => [e, e + ' · ' + all.filter(t => t.eng === e).length]))}
  <div class="note">${esc((meta.rating || {})[S.dgE] || '')}</div>
  <section class="card"><h2>${tr("s895", {3: (m[0])})}</h2>${chips('dgm', S.dgM, Object.entries(DG_M).map(([k, v]) => [k, v[0]]))}${timeChart(ser, { label: m[0] })}${legend(ser)}
   <div class="note">${tr("s896")}</div></section>
  <section class="card"><h2>${tr("s897", {7: (esc(S.dgE))})}</h2><div class="scroll mt"><table class="mtab"><thead><tr><th class="stick">${tr("s147")}</th><th>${tr("s257")}</th><th>${tr("s756")}</th><th>${tr("s898")}</th><th>${tr("s899")}</th><th>${tr("s900")}</th><th>${tr("s901")}</th><th>${tr("s902")}</th><th>${tr("s900")}</th><th>${tr("s758")}</th><th>Pscav</th><th>SFOC ISO</th><th>${tr("s903")}</th><th>${tr("s389")}</th></tr></thead><tbody>
  ${X.slice().reverse().map(({ t, s }) => `<tr class="click${t.id === S.dgSel ? ' sel' : ''}" data-act="dgsel" data-k="${esc(t.id)}"><th class="stick">${dds(t.date)}${t.flags ? ' <span class="bad">•</span>' : ''}</th><td class="small">${esc(t.src)}</td><td>${num(s.load, 0)}</td><td>${num(s.kwe, 0)}</td><td>${num(s.pmax, 1)}</td><td class="${s.pspread >= 10 ? 'bad' : ''}">${num(s.pspread, 0)}</td><td>${num(s.mip, 2)}</td><td>${num(s.exh, 0)}</td><td class="${s.espread >= 60 ? 'bad' : ''}">${num(s.espread, 0)}</td><td>${num(tval(s.tc), 0)}</td><td>${num(tval(s.scav), 2)}</td><td>${num(s.sfoc, 1)}</td><td>${s.sfocDev != null ? num(s.sfocDev, 1) : '—'}</td><td>${num(tval(s.rh), 0)}</td></tr>`).join('')}
  </tbody></table></div><div class="note">${tr("s904")}</div></section>
  ${sel ? dgDetail(sel) : ''}
  ${meta.notes ? `<section class="card"><h2>${tr("s893")}</h2><div class="kv2 mt">${meta.notes.map(([a, b]) => `<div><span class="lbl">${esc(a)}</span><span>${esc(b)}</span></div>`).join('')}</div></section>` : ''}`;
}
const DG_TR = localized(() => ({ 'Load/hours': tr("s905"), 'Operator form': tr("s906"), 'ISO report': tr("s907"), 'Doctor': 'Doctor / Acclaim' }));
function dgDetail(t) {
  const cyls = Object.keys(t.cyl || {}), n = Math.max(0, ...cyls.map(k => Object.keys(t.cyl[k]).length)), idx = [...Array(n)].map((_, i) => String(i + 1));
  return `<section class="card"><div class="row between"><h2>${esc(t.eng)} · ${dd(t.date)} ${esc(t.time || '')}</h2><button class="btn" data-act="dgsel" data-k="">${tr("s570")}</button></div>
   <div class="note">${tr("s912", {3: (esc(t.type || '')), 4: (esc(t.src)), 5: (t.cylsrc ? tr("s908") + esc(t.cylsrc) : '')})}</div>
   ${t.flags ? `<div class="banner mt">${esc(t.flags)}</div>` : ''}
   ${cyls.length ? `<div class="scroll mt"><table class="mtab"><thead><tr><th class="stick">${tr("s909")}</th>${idx.map(i => `<th>${tr("s374", {0: (i)})}</th>`).join('')}<th>${tr("s910")}</th></tr></thead><tbody>${cyls.map(k => { const v = idx.map(i => t.cyl[k][i]); return `<tr><th class="stick">${esc(k)}</th>${v.map(x => `<td>${esc(x ?? '')}</td>`).join('')}<td class="note">${num(avg(v.map(tval)), 1)}</td></tr>` }).join('')}</tbody></table></div>` : ''}
   ${Object.entries(t.f || {}).map(([g, o]) => `<h3 class="mt">${esc(DG_TR[g] || g)}</h3><div class="kv2">${Object.entries(o).map(([k, v]) => `<div><span class="lbl">${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>`).join('')}
   ${t.files ? `<div class="note mt">${tr("s911", {0: (esc(t.files))})}</div>` : ''}</section>`;
}

/* =================== Расход топлива (StarConnect flowmeters) =================== */
const fuelDays = () => db.all('fuel').filter(r => r.id.startsWith('day-')).map(r => ({ ...r, date: r.id.slice(4) })).sort((a, b) => a.date.localeCompare(b.date));
const CNT = [['eng1', 'ENG 1'], ['aein', 'AE INLET'], ['aeout', 'AE OUTLET'], ['mgo', 'AE INLET MGO'], ['b1', 'BLR 1'], ['b2', 'BLR 2']];
export function fuelView() {
  const meta = db.get('fuel/meta'), S = C.S;
  if (!meta) return `<div><h1>${tr("s586")}</h1></div><div class="banner">${tr("s913")}</div>`;
  const D = fuelDays(), T = meta.totals;
  return `<div><h1>${tr("s586")}</h1><div class="sub">${esc(meta.source)} · ${dd(meta.from)} — ${dd(meta.to)} (UTC)</div></div>
  ${tabs('futab', S.fuTab, [['sum', tr("s914")], ['day', tr("s915")], ['cnt', tr("s916")]])}
  ${S.fuTab === 'day' ? fuelDaily(D) : S.fuTab === 'cnt' ? fuelCounters(meta) : `
  <section class="card"><h2>${tr("s926")}</h2><div class="grid4 mt">${stat(tr("s855"), num(T.ME, 1), tr("s917"))}${stat(tr("s527"), num(T['AE HFO'], 1), tr("s918") + num(T['AE MGO'], 3))}${stat(tr("s919"), num(T['Boiler 1'], 1), tr("s186"))}${stat(tr("s920"), num(meta.steady.sfoc, 1), tr("s921") + meta.steady.h + tr("s415"))}</div></section>
  <section class="card"><h2>${tr("s927")}</h2><div class="list mt">${meta.findings.map(f => `<div class="t"><div class="tb"><span class="small" style="color:var(--ink)">${esc(f)}</span></div></div>`).join('')}</div></section>
  <section class="card"><h2>${tr("s928")}</h2>${xyChart([{ name: tr("s922"), color: COL[0], pts: meta.me_curve.map(c => [c.mcr, c.sfoc, c.h, c.conf !== 'OK']) }], { xu: '%', xmin: 0, xmax: 80, label: tr("s923") })}
   <div class="note">${tr("s929")}</div>
   <div class="scroll mt"><table class="mtab"><thead><tr><th class="stick">% MCR</th><th>${tr("s930")}</th><th>${tr("s522")}</th><th>${tr("s524")}</th><th>${tr("s931")}</th><th>SOG</th><th>${tr("s932")}</th><th>${tr("s933")}</th><th>${tr("s934")}</th></tr></thead><tbody>
   ${meta.me_curve.map(c => `<tr><th class="stick">${esc(c.band)}</th><td>${c.h}</td><td>${num(c.kw, 0)}</td><td>${num(c.rpm, 1)}</td><td>${num(c.fi, 1)}</td><td>${num(c.sog, 1)}</td><td><b>${num(c.sfoc, 1)}</b></td><td>${num(c.tday, 1)}</td><td class="${c.conf === 'OK' ? '' : 'note'}">${c.conf === 'OK' ? 'ok' : tr("s924")}</td></tr>`).join('')}</tbody></table></div></section>
  <section class="card"><h2>${tr("s935")}</h2><div class="scroll mt"><table class="mtab"><thead><tr><th class="stick">${tr("s527")}</th><th>${tr("s511")}</th><th>${tr("s930")}</th><th>${tr("s898")}</th><th>${tr("s936")}</th><th>${tr("s937")}</th><th>${tr("s933")}</th></tr></thead><tbody>
   ${meta.ae_curve.map(c => `<tr><th class="stick">${esc(c.gen)} <span class="small">${tr("s925", {1: (c.rate)})}</span></th><td>${esc(c.band)}</td><td>${c.h}</td><td>${num(c.kw, 0)}</td><td><b>${num(c.sfoc, 1)}</b></td><td>${num(c.kg / c.h, 0)}</td><td>${num(c.tday, 2)}</td></tr>`).join('')}</tbody></table></div>
   <div class="note">${tr("s938")}</div></section>
  <section class="card"><h2>${tr("s939")}</h2><div class="list mt">${meta.map.map(x => `<div class="t"><div class="tb"><span class="small" style="color:var(--ink)">${esc(x)}</span></div></div>`).join('')}</div><div class="note mt">${esc(meta.rules)}</div></section>`}`;
}
function fuelDaily(D) {
  const ser = [{ name: tr("s940"), color: COL[0], pts: D.map(d => [d.date, d.me]) }, { name: tr("s941"), color: COL[1], pts: D.map(d => [d.date, d.ae]) }];
  const s2 = [{ name: tr("s942"), color: COL[2], pts: D.filter(d => d.sfoc && d.meh >= 20).map(d => [d.date, d.sfoc]) }];
  const s3 = [{ name: tr("s943"), color: COL[4], pts: D.map(d => [d.date, d.dens]) }];
  return `<section class="card"><h2>${tr("s946")}</h2>${timeChart(ser, { zero: true })}${legend(ser)}</section>
  <section class="card"><h2>${tr("s947")}</h2>${timeChart(s2)}${legend(s2)}${timeChart(s3, { h: 160 })}${legend(s3)}</section>
  <section class="card"><h2>${tr("s948")}</h2><div class="scroll mt"><table class="mtab"><thead><tr><th class="stick">${tr("s147")}</th><th>${tr("s949")}</th><th>${tr("s950")}</th><th>${tr("s951")}</th><th>${tr("s952")}</th><th>${tr("s953")}</th><th>${tr("s954")}</th><th>${tr("s524")}</th><th>SOG</th><th>${tr("s955")}</th><th>${tr("s956")}</th><th>${tr("s957")}</th><th>${tr("s958")}</th><th>${tr("s959")}</th><th>${tr("s960")}</th></tr></thead><tbody>
  ${D.slice().reverse().map(d => `<tr><th class="stick">${dds(d.date)}</th><td><b>${num(d.me, 2)}</b></td><td>${num(d.ae, 2)}</td><td>${num(d.b1, 2)}</td><td>${num(d.tot, 2)}</td><td>${num(d.meh, 1)}</td><td>${num(d.mekw, 0)}</td><td>${num(d.rpm, 1)}</td><td>${num(d.sog, 1)}</td><td>${num(d.memwh, 1)}</td><td>${d.sfoc ? '<b>' + num(d.sfoc, 1) + '</b>' : '—'}</td><td>${num(d.aemwh, 1)}</td><td>${d.aesfoc ? num(d.aesfoc, 1) : '—'}</td><td>${num(d.dens, 1)}</td><td class="small">${d.cams != null ? num(d.cams, 0) + '%' + (d.ext ? tr("s944") : '') : tr("s945")}</td></tr>`).join('')}
  </tbody></table></div><div class="note">${tr("s961")}</div></section>`;
}
function fuelCounters(meta) {
  const mine = db.all('fuel').filter(r => r.id.startsWith('cnt-')).sort((a, b) => a.at.localeCompare(b.at));
  const base = meta.counters.slice(-1)[0], all = [...meta.counters.map(r => ({ at: r[0].slice(0, 16), eng1: r[1], aein: r[2], aeout: r[3], mgo: r[4], b1: r[5], b2: r[6], src: 'StarConnect' })), ...mine.map(r => ({ ...r, src: tr("s962") }))].sort((a, b) => a.at.localeCompare(b.at));
  const dlt = (a, b) => { const h = (Date.parse(b.at) - Date.parse(a.at)) / 36e5, d = k => b[k] != null && a[k] != null ? b[k] - a[k] : null, ae = d('aein') != null && d('aeout') != null ? d('aein') - d('aeout') : null, me = d('eng1') != null && ae != null ? d('eng1') - ae : null; return { h, me, ae, mgo: d('mgo'), b1: d('b1') } };
  const last = all[all.length - 1], prev = all[all.length - 2], dl = prev ? dlt(prev, last) : null;
  return `<section class="card"><h2>${tr("s969")}</h2><div class="note">${tr("s970")}</div>
   <form id="cntf" class="fg mt"><label class="f">${tr("s971")}<input type="datetime-local" name="at" required></label>${CNT.map(([k, l]) => `<label class="f">${tr("s963", {0: (l)})}<input type="number" step="any" inputmode="decimal" name="${k}" placeholder="${base ? num(base[CNT.findIndex(c => c[0] === k) + 1], 3).replace(/\s/g, '') : ''}"></label>`).join('')}<div class="f" style="justify-content:flex-end"><button class="btn pri">${tr("s972")}</button></div></form></section>
  ${dl ? `<section class="card"><h2>${tr("s968", {0: (esc(prev.at.replace('T', ' '))), 1: (esc(last.at.replace('T', ' ')))})}</h2><div class="grid4 mt">${stat(tr("s964"), num(dl.h, 1), tr("s851"))}${stat(tr("s855"), num(dl.me, 3), tr("s965") + num(dl.me / dl.h * 24, 2) + tr("s966"))}${stat(tr("s967"), num(dl.ae, 3), tr("s965") + num(dl.ae / dl.h * 24, 2) + tr("s966"))}${stat(tr("s919"), num(dl.b1, 3), tr("s186"))}</div></section>` : ''}
  <section class="card"><h2>${tr("s973", {2: (all.length)})}</h2><div class="scroll mt"><table class="mtab"><thead><tr><th class="stick">${tr("s974")}</th>${CNT.map(c => `<th>${c[1]}</th>`).join('')}<th>${tr("s975")}</th><th>${tr("s976")}</th><th>${tr("s257")}</th></tr></thead><tbody>
  ${all.slice().reverse().map((r, i, arr) => { const p = arr[i + 1], x = p ? dlt(p, r) : null; return `<tr><th class="stick">${esc(r.at.replace('T', ' '))}</th>${CNT.map(([k]) => `<td>${num(r[k], 3)}</td>`).join('')}<td>${x ? num(x.me, 2) : ''}</td><td>${x ? num(x.ae, 2) : ''}</td><td class="small">${r.src === tr("s962") ? `${tr("s962")} <button class="btn ghost" data-act="cntdel" data-k="${esc(r.id)}" aria-label="${tr("s239")}">×</button>` : esc(r.src)}</td></tr>` }).join('')}
  </tbody></table></div></section>
  <section class="card"><h2>${tr("s977")}</h2><div class="scroll mt"><table class="mtab"><tbody>${meta.checks.map(r => `<tr>${r.map((x, i) => i ? `<td>${typeof x === 'number' ? num(x, 3) : esc(x ?? '')}</td>` : `<th class="stick">${esc(x ?? '')}</th>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
}

/* =================== Заметки с диктовкой =================== */
const noteCategoryKeys = ["s978", "s979", "s980", "s981", "s982", "s983"];
const noteCategory = value => displayLabel(value, noteCategoryKeys);
const NCAT = [orig("s978"), orig("s979"), orig("s980"), orig("s981"), orig("s982"), orig("s983")];
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
export function notesView() {
  const S = C.S, q = S.ntQ.toLowerCase();
  const N = db.all('notes').sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  const L = N.filter(n => (!S.ntCat || n.cat === S.ntCat) && (S.ntMoved || !n.moved) && (!q || ((n.text || '') + ' ' + (n.eq || '') + ' ' + (n.cat || '')).toLowerCase().includes(q)));
  const E = S.ntEdit || { text: '', eq: '', cat: orig("s978") };
  const eqs = [...new Set([...db.all('oil').filter(r => r.id.startsWith('eq-')).map(r => r.name), orig("s855"), orig("s984"), orig("s985"), orig("s986"), orig("s987"), orig("s988"), orig("s989"), orig("s990"), orig("s991")])];
  return `<div><h1>${tr("s575")}</h1><div class="sub">${tr("s1003")}</div></div>
  <section class="card"><form id="notef">
   <label class="f" style="position:relative">${tr("s1004")}<textarea name="text" id="nttext" rows="5" placeholder="${tr("s1005")}">${esc(E.text)}</textarea></label>
   ${SR ? `<button type="button" class="btn${S.dict ? ' pri' : ''} mt" data-act="dict" aria-pressed="${S.dict}">${S.dict ? tr("s992") : tr("s993")}</button>` : ("<div class=\"note mt\">" + tr("s994") + "</div>")}
   <div class="fg mt"><label class="f">${tr("s1006")}<input name="eq" list="nteq" value="${esc(E.eq)}" placeholder="${tr("s1007")}"><datalist id="nteq">${eqs.map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
   <label class="f">${tr("s1008")}<select name="cat">${NCAT.map(c => `<option value="${esc(c)}"${c === E.cat ? ' selected' : ''}>${esc(noteCategory(c))}</option>`).join('')}</select></label>
   <div class="f" style="justify-content:flex-end"><div class="row">${E.id ? ("<button type=\"button\" class=\"btn\" data-act=\"ntcancel\">" + tr("s240") + "</button>") : ''}<button class="btn pri">${E.id ? tr("s241") : tr("s995")}</button></div></div></div></form>
   <div class="note">${tr("s1009")}</div></section>
  <section class="card"><div class="row between"><h2>${tr("s1010", {7: (L.length)})}</h2><div class="row"><button class="btn" data-act="ntcopy">${tr("s1011")}</button>${navigator.share ? ("<button class=\"btn\" data-act=\"ntshare\">" + tr("s996") + "</button>") : ''}</div></div>
   <input class="search mt" id="ntq" type="search" placeholder="${tr("s1012")}" value="${esc(S.ntQ)}">
   ${chips('ntcat', S.ntCat, [['', tr("s114")], ...NCAT.map(c => [c, noteCategory(c)])])}
   <label class="row mt small"><input type="checkbox" data-act="ntmoved" ${S.ntMoved ? 'checked' : ''}> ${tr("s1013")}</label>
   <div class="list mt">${L.map(n => `<div class="t${n.moved ? ' done' : ''}"><div class="tb"><span class="tt" style="white-space:pre-wrap">${esc(n.text)}</span><span class="meta"><span class="tag">${esc(noteCategory(n.cat || ''))}</span>${n.eq ? `<span class="small">${esc(n.eq)}</span>` : ''}<span class="small">${esc((n.at || '').slice(0, 16).replace('T', ' '))}</span>${n.moved ? ("<span class=\"small\">" + tr("s997") + "</span>") : ''}</span>
    <span class="row mt"><button class="btn ghost" data-act="ntedit" data-k="${esc(n.id)}">${tr("s1000")}</button><button class="btn ghost" data-act="nttask" data-k="${esc(n.id)}">${tr("s1001")}</button><button class="btn ghost" data-act="ntmove" data-k="${esc(n.id)}">${n.moved ? tr("s998") : tr("s999")}</button><button class="btn ghost" data-act="ntdel" data-k="${esc(n.id)}">${tr("s239")}</button></span></div></div>`).join('') || ("<div class=\"empty\">" + tr("s1002") + "</div>")}</div>
   <div class="note">${tr("s1014")}</div></section>`;
}
function notesText() {
  const S = C.S, N = db.all('notes').filter(n => !n.moved && (!S.ntCat || n.cat === S.ntCat)).sort((a, b) => (a.at || '').localeCompare(b.at || ''));
  return tr("s1015", undefined, 'en') + N.length + '):\n\n' + N.map(n => `- [${(n.at || '').slice(0, 16).replace('T', ' ')}] ${displayLabel(n.cat || '', noteCategoryKeys, 'en')}${n.eq ? ' · ' + n.eq : ''}: ${n.text}`).join('\n');
}
function dict(on) {
  const S = C.S;
  if (!on) { S.dict = false; if (rec) { try { rec.stop() } catch (e) {} } rec = null; C.render(); return }
  const ta = document.getElementById('nttext'); if (!ta) return;
  S.dict = true; let base = ta.value ? ta.value.replace(/\s*$/, ' ') : '';
  const start = () => {
    rec = new SR(); rec.lang = locale(); rec.interimResults = true; rec.continuous = true;
    rec.onresult = e => { let fin = '', tmp = ''; for (let i = 0; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) fin += r[0].transcript; else tmp += r[0].transcript } const t = document.getElementById('nttext'); if (t) { t.value = base + fin + tmp; C.S.ntEdit = { ...(C.S.ntEdit || { eq: '', cat: orig("s978") }), text: t.value } } rec._fin = fin };
    rec.onend = () => { base = base + (rec && rec._fin ? rec._fin + ' ' : ''); if (C.S.dict) { try { start() } catch (e) { C.S.dict = false; C.refresh() } } };
    rec.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { C.S.dict = false; C.toast(tr("s623")); C.refresh() } else if (e.error === 'network') { C.S.dict = false; C.toast(tr("s1016")); C.refresh() } };
    rec.start();
  };
  try { start() } catch (e) { S.dict = false; C.toast(tr("s625")) }
  C.render(); setTimeout(() => document.getElementById('nttext')?.focus(), 30);
}

/* =================== события =================== */
export function onClick(a, el, e) {
  const S = C.S, k = el.dataset.k;
  const map = { pftab: 'pfTab', isom: 'isoM', oilg: 'oilG', oilp: 'oilP', dge: 'dgE', dgm: 'dgM', futab: 'fuTab', ntcat: 'ntCat', lctab: 'lcTab' };
  if (map[a]) { S[map[a]] = k; if (a === 'dge') S.dgSel = ''; C.render(); return true }
  if (a === 'isosel') { S.isoSel = S.isoSel === k ? '' : k; C.render(); if (S.isoSel) setTimeout(() => document.querySelector('[data-act=isosel][data-k=""]')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 50); return true }
  if (a === 'dgsel') { S.dgSel = S.dgSel === k ? '' : k; C.render(); if (S.dgSel) setTimeout(() => document.querySelector('[data-act=dgsel][data-k=""]')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 50); return true }
  if (a === 'oileq') { e.preventDefault(); S.oilEq = k; S.oilAll = false; const eq = db.get('oil/eq-' + k); if (eq && !(S.oilP in (eq.limits || {}))) S.oilP = 'v40'; C.render(); scrollTo(0, 0); return true }
  if (a === 'lcg') { S.lcG = S.lcG === k ? '' : k; C.render(); return true }
  if (a === 'oilall') { S.oilAll = true; C.render(); return true }
  if (a === 'cntdel') { db.del('fuel/' + k).then(C.refresh); C.toast(tr("s1017")); return true }
  if (a === 'dict') { dict(!S.dict); return true }
  if (a === 'ntcancel') { S.ntEdit = null; C.render(); return true }
  if (a === 'ntmoved') { S.ntMoved = el.checked; C.render(); return true }
  if (a === 'ntedit') { const n = db.get('notes/' + k); if (n) { S.ntEdit = { id: k, ...n }; C.render(); scrollTo(0, 0) } return true }
  if (a === 'ntdel') { if (el.dataset.sure) { const body = db.get('notes/' + k); db.del('notes/' + k).then(C.refresh); C.toast(tr("s1018"), { _row: 'notes/' + k, body }) } else { el.dataset.sure = '1'; el.textContent = tr("s1019") } return true }
  if (a === 'ntmove') { const n = db.get('notes/' + k); if (n) C.put('notes/' + k, { ...n, moved: !n.moved }).then(C.refresh); return true }
  if (a === 'nttask') { const n = db.get('notes/' + k); if (n) C.openTask(n.text.split(/[.\n]/)[0].slice(0, 90), n.text + (n.eq ? tr("s1020") + n.eq : '')); return true }
  if (a === 'ntcopy') { const t = notesText(); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => C.toast(tr("s1021"))).catch(() => { prompt(tr("s1022"), t) }); return true }
  if (a === 'ntshare') { navigator.share({ title: tr("s1023", undefined, 'en'), text: notesText() }).catch(() => {}); return true }
  return false;
}
export function onInput(e) {
  const S = C.S;
  if (updateSearch(e.target)) return true;
  if (e.target.form && e.target.form.id === 'notef') { const f = e.target.form; S.ntEdit = { ...(S.ntEdit || {}), text: f.text.value, eq: f.eq.value, cat: f.cat.value }; return true }
  return false;
}
function updateSearch(field) {
  if (field.id === 'lcq') C.S.lcQ = field.value;
  else if (field.id === 'ntq') C.S.ntQ = field.value;
  else return false;
  return true;
}
export function onChange(e) { return updateSearch(e.target) }
export function onSubmit(id, f) {
  const S = C.S;
  if (id === 'notef') {
    const text = String(f.get('text') || '').trim(); if (!text) { C.toast(tr("s1024")); return true }
    if (S.dict) dict(false);
    const E = S.ntEdit || {}, nid = E.id || 'n-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const old = E.id ? db.get('notes/' + E.id) : null;
    C.put('notes/' + nid, { text, eq: String(f.get('eq') || '').trim(), cat: f.get('cat'), at: old ? old.at : new Date().toISOString(), edited: old ? new Date().toISOString() : undefined, moved: old ? !!old.moved : false, by: orig("s58") }).then(() => { S.ntEdit = null; C.refresh(); C.toast(old ? tr("s1025") : tr("s1026")) });
    return true;
  }
  if (id === 'cntf') {
    const at = String(f.get('at') || ''); if (!at) return true; const r = { at };
    let any = false; for (const [k] of CNT) { const v = f.get(k); if (v !== '' && v != null) { r[k] = +v; any = true } }
    if (!any) { C.toast(tr("s1027")); return true }
    C.put('fuel/cnt-' + at.replace(/[:T-]/g, ''), r).then(() => { C.refresh(); C.toast(tr("s1028")) });
    return true;
  }
  return false;
}

/* =================== Заправка систем (Lubricating Oil Chart) =================== */
const LV = localized(() => ({ exact: ['●', tr("s1029")], eq: ['○', tr("s1030")], check: ['?', tr("s1031")] }));
function lcStock(eqs) {
  let ok = 0, ck = 0; const list = [];
  for (const e of eqs || []) { const r = db.get('lube/' + e.pk); if (!r) continue; const v = (+r.drum || 0) * (+r.full || 0) + (+r.inuse || 0); list.push({ ...e, name: r.name, v, unit: r.cat === orig("s161") ? tr("s201") : tr("s229") }); if (e.lvl === 'check') ck += v; else ok += v }
  return { ok, ck, list };
}
export function lochartView() {
  const S = C.S, G = db.all('lochart').filter(x => x.id.startsWith('g-')).sort((a, b) => a.no - b.no), M = db.all('lochart').filter(x => x.id.startsWith('m-')).sort((a, b) => a.n - b.n);
  const head = `<div><h1>${tr("s580")}</h1><div class="sub">${tr("s1032")}</div></div>`;
  if (!G.length) return head + `<div class="banner">${tr("s1033")}</div>`;
  const tb = tabs('lctab', S.lcTab, [['gr', tr("s1034")], ['mc', tr("s1035")], ['sys', tr("s1036")]]);
  let body = '';
  if (S.lcTab === 'gr') {
    const rows = G.map(g => ({ g, st: lcStock(g.equiv) }));
    const low = rows.filter(x => !x.g.bulk && x.g.fill > 0 && x.st.ok < x.g.fill && x.g.equiv?.length).length;
    body = `<div class="banner">${tr("s1045")}</div>
    <section class="card"><div class="row between"><h2>${tr("s1046")}</h2><span class="sub">${tr("s1047", {0: (G.length), 1: (low ? tr("s1037") + low : '')})}</span></div><div class="scroll mt"><table class="stack"><thead><tr><th>${tr("s149")}</th><th>${tr("s1042")}</th><th>${tr("s1048")}</th><th>${tr("s1044")}</th><th>%</th></tr></thead><tbody>
    ${rows.map(({ g, st }) => { const u = g.unit === 'KG' ? tr("s201") : tr("s229"), pc = g.fill > 0 && g.equiv?.length ? Math.round(st.ok / g.fill * 100) : null, lowr = pc != null && pc < 100; const open = S.lcG === g.grade;
      return `<tr class="click${lowr ? ' lowrow' : ''}" data-act="lcg" data-k="${esc(g.grade)}"><td data-l="${tr("s149")}"><b>${esc(g.grade)}</b>${g.bulk ? `<div class="small">${esc(g.bulk)}</div>` : ''}</td><td data-l="${tr("s1042")}">${num(g.fill, Number.isInteger(g.fill) ? 0 : 1)} ${u}</td><td data-l="${tr("s1043")}">${esc(g.largest_where)}: ${num(g.largest, Number.isInteger(g.largest) ? 0 : 1)}</td><td data-l="${tr("s1044")}">${g.equiv?.length ? `<b>${num(st.ok, 0)}</b> ${u}${st.ck ? ` <span class="small">+${num(st.ck, 0)}?</span>` : ''}` : '—'}</td><td data-l="%">${pc != null ? pc + '%' : ''}</td></tr>
      ${open ? `<tr><td colspan="5"><div class="kv2"><div><b>${tr("s1039")}</b><ul>${g.points.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><div><b>${tr("s1040")}</b>${st.list.length ? `<ul>${st.list.map(e => `<li>${LV[e.lvl][0]} ${esc(e.name)} — <b>${num(e.v, 0)}</b> ${e.unit} <span class="small">(${LV[e.lvl][1]})</span></li>`).join('')}</ul>` : ("<div class=\"small\">" + tr("s1038") + "</div>")}<div class="small">${tr("s1041")}</div>${g.note ? `<div class="small mt">${esc(g.note)}</div>` : ''}</div></div></td></tr>` : ''}`; }).join('')}
    </tbody></table></div></section>`;
  } else if (S.lcTab === 'mc') {
    const q = S.lcQ.trim().toLowerCase(), f = M.filter(m => !q || (m.machine + ' ' + (m.sub || '') + ' ' + m.point + ' ' + m.grade + ' ' + m.no + ' ' + (m.maker || '')).toLowerCase().includes(q));
    body = `<div class="row mt"><input id="lcq" class="search" type="search" placeholder="${tr("s1052")}" value="${esc(S.lcQ)}"></div>
    <section class="card"><div class="row between"><h2>${tr("s1053")}</h2><span class="sub">${tr("s1054", {1: (f.length), 2: (M.length)})}</span></div><div class="scroll mt"><table class="stack"><thead><tr><th>№</th><th>${tr("s1050")}</th><th>${tr("s1051")}</th><th>${tr("s1042")}</th><th>${tr("s149")}</th></tr></thead><tbody>
    ${f.map(m => `<tr${m.repl ? ' style="opacity:.55"' : ''}><td data-l="№">${esc(m.no)}</td><td data-l="${tr("s1050")}"><b>${esc(m.machine)}</b>${m.sub ? ' — ' + esc(m.sub) : ''}<div class="small">${esc(m.maker || '')}${m.qty ? ' · ×' + esc(m.qty) : ''}</div></td><td data-l="${tr("s1051")}">${esc(m.point)}${m.repl ? (" <span class=\"tag\">" + tr("s1049") + "</span>") : ''}${m.remark ? `<div class="small">${esc(m.remark)}</div>` : ''}</td><td data-l="${tr("s1042")}"><b>${esc(m.fill)}</b></td><td data-l="${tr("s149")}">${esc(m.grade)}</td></tr>`).join('')}
    </tbody></table></div></section>`;
  } else {
    const grp = new Map();
    for (const m of M) { const k = m.no + '|' + m.machine + (m.sub ? ' — ' + m.sub : ''); if (!grp.has(k)) grp.set(k, { no: m.no, name: m.machine + (m.sub ? ' — ' + m.sub : ''), L: 0, K: 0, big: [] }); const g = grp.get(k); if (m.repl || m.amount == null) continue; if (m.unit === 'L') g.L += m.amount; else g.K += m.amount; g.big.push(m) }
    const arr = [...grp.values()], tl = arr.reduce((a, x) => a + x.L, 0), tk = arr.reduce((a, x) => a + x.K, 0);
    body = `<div class="grid">${stat(tr("s1055"), num(tl, 0), tr("s229"))}${stat(tr("s161"), num(tk, 0), tr("s201"))}</div>
    <section class="card"><h2>${tr("s1060")}</h2><div class="note">${tr("s1061")}</div><div class="scroll mt"><table class="stack"><thead><tr><th>№</th><th>${tr("s1056")}</th><th>${tr("s1057")}</th><th>${tr("s1058")}</th><th>${tr("s1062")}</th></tr></thead><tbody>
    ${arr.map(x => `<tr><td data-l="№">${esc(x.no)}</td><td data-l="${tr("s1056")}"><b>${esc(x.name)}</b></td><td data-l="${tr("s1057")}">${x.L ? '<b>' + num(x.L, x.L < 10 ? 1 : 0) + '</b>' : ''}</td><td data-l="${tr("s1058")}">${x.K ? num(x.K, x.K < 10 ? 2 : 0) : ''}</td><td data-l="${tr("s1059")}" class="small">${x.big.sort((a, b) => b.amount - a.amount).slice(0, 3).map(m => esc(m.point) + ': ' + esc(m.fill) + ' · ' + esc(m.grade)).join('<br>')}</td></tr>`).join('')}
    </tbody></table></div></section>`;
  }
  return head + tb + body;
}
export const VIEWS = { oil: oilView, dg: dgView, fuel: fuelView, notes: notesView, lochart: lochartView };
