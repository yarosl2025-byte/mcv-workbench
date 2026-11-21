// Tank calculations — ported 1:1 from the vessel workbooks (see README_MCV_Tanks.md):
//  • daily ER soundings book: FORECAST(x, OFFSET(vol, MATCH(x, sound, 1)-1, 0, 2), OFFSET(sound, …)) with x = cm/100
//  • FO/DO/LO ROB workbook (30-10-2026 FO soundings.xlsx): trim-corrected calibration, cells M2..P9 of each tank sheet
// Calibration tables are data (cal/* documents), not code, so they stay out of the public repository.

// Excel MATCH(x, col, 1): index of the largest value <= x (ascending column); -1 if x is below the table
function matchLE(arr, x, get = a => a) {
  let lo = 0, hi = arr.length - 1, ans = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (get(arr[m]) <= x) { ans = m; lo = m + 1 } else hi = m - 1 }
  return ans;
}

// Daily book: points = [[sounding m, volume m3], ...]; value in cm
export function dailyVolume(points, cm) {
  if (!points || cm === '' || cm == null || isNaN(cm)) return null;
  const x = cm / 100, i = matchLE(points, x, p => p[0]);
  if (i < 0) return null;
  const a = points[i], b = points[i + 1];
  if (!b) return a[1];                                   // Excel would show #N/A beyond the last row
  if (b[0] === a[0]) return a[1];
  return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
}

// ROB workbook: rows = [[x, trim+2, +1, 0, -1, -2, -3, -4, -5], ...]
function vlookup(rows, x, col) { const i = matchLE(rows, x, r => r[0]); if (i < 0) throw new Error('ниже таблицы'); return rows[i][col - 1] }
export function trimOf(fwd, aft) { const t = fwd - aft; return t <= -5 ? -5 : t > 2 ? 2 : t }
export function calibVolume(rows, x, trim) {
  const M3 = trim, M2 = Math.floor(M3) + 1, M4 = Math.floor(M3);
  const N2 = vlookup(rows, x, 1), N4 = N2, P2 = N2 + 2, P4 = N4 + 2;
  const M7 = M2, M9 = M4;
  const N7 = vlookup(rows, N2, 4 - M2), P7 = vlookup(rows, P2, 4 - M2);
  const N9 = vlookup(rows, N4, 4 - M4), P9 = vlookup(rows, P4, 4 - M4);
  const N8 = N9 + ((N7 - N9) / (M7 - M9)) * (M3 - M9);
  const P8 = P9 + ((P7 - P9) / (M7 - M9)) * (M3 - M9);
  return N8 - (N8 - P8) / (P2 - N2) * (x - N2);
}
// ASTM D1250 Table 54B — for comparison with a surveyor's figure (same constants as the BV sheet)
export function vcf54b(rho15, temp) {
  const m = Math.round(1000 * rho15 * 100) / 100;
  const a = rho15 < 0.7705 ? 346.4228 / m ** 2 + 0.4388 / m : rho15 < 0.7875 ? -0.00336312 + 2680.3206 / m ** 2 : rho15 < 0.839 ? 594.5418 / m ** 2 : 186.9696 / m ** 2 + 0.4862 / m;
  const dT = temp - 15;
  return Math.round(Math.exp(-a * dT - 0.8 * a * a * dT * dT) * 1e4) / 1e4;
}
// One ROB calculation: meta = cal/fo-meta tanks, cal = {sheet: rows}, inp = {fwd, aft, tanks: {KEY: {value, density, temp, ignore}}}
export function computeROB(meta, cal, inp) {
  const trim = trimOf(+inp.fwd, +inp.aft), out = [];
  const sum = { HFO: { m3: 0, t: 0 }, DO: { m3: 0, t: 0 }, LO: { m3: 0, t: 0 } };
  for (const m of meta) {
    const d = (inp.tanks || {})[m.key] || {};
    const r = { key: m.key, group: m.group, kind: m.kind, capacity: m.capacity, maxpct: m.maxpct };
    if (d.ignore || d.value === '' || d.value == null) { r.empty = true; out.push(r); continue }
    try {
      r.value = +d.value;
      r.m3 = m.kind === 'volume' ? +d.value : calibVolume(cal[m.sheet], +d.value, trim);
      r.rho = d.density !== '' && d.density != null ? +d.density : m.density;
      r.pct = m.capacity ? r.m3 / m.capacity * 100 : null;
      if (m.group === 'HFO') {
        r.temp = d.temp !== '' && d.temp != null ? +d.temp : m.temp; r.k = m.k;
        r.t = r.m3 * (r.rho - m.k * (r.temp - 15)); r.t54b = r.m3 * vcf54b(r.rho, r.temp) * r.rho;
      } else r.t = r.m3 * r.rho;
      const g = m.group === 'LO' ? 'LO' : m.k === 0.0008 ? 'DO' : 'HFO';
      r.sum = g; sum[g].m3 += r.m3; sum[g].t += r.t;
    } catch (e) { r.error = 'Значение вне таблицы' }
    out.push(r);
  }
  return { trim, rows: out, sum };
}

// Lube uplift — MLFMT "InventoryMgt Calc-Guidelines 03-08-2026", tab BOB-Vessels (exact replica)
export const ADDITIVES = { 'Castrol Cyltech 140': [140, .97], 'Chevron Taro Ultra 140': [140, .974], 'Chevron MCLA 7050 [312]': [312, 1.12], 'Chevron MCLA [400]': [400, 1.18],
  'Exxon Mobilgard 5145': [145, .975], 'GulfSea Cylcare 50140': [140, .97], 'Lukoil Navigo 140 MCL': [140, .982], 'Opt-Max Flexguard 140': [140, .986],
  'Opt-Max BoB 300': [304, 1.1058], 'Shell Alexia 140': [140, .974], 'Total Talusia HR 140': [140, .976], 'MDCL 100 BN': [100, .943], 'MDCL 70 BN': [70, .939] };
const MDCL_DENS = { 40: .92, 70: .939, 100: .943, 140: .975 };
export function lubeBOB(p) {
  const C8 = Math.round((Date.parse(p.forward_date) - Date.parse(p.delivery_date)) / 864e5), w = [];
  if (C8 < 90) w.push(`До следующего основного порта меньше 90 дней (${C8})`);
  const a = p.additive, [C47, C11] = ADDITIVES[a.product], meso = p.meso;
  const C58 = +(meso.bn ?? 6), C12 = +(meso.density ?? .899), C19 = +a.target_bn;
  const C48 = (C19 - C58) / (C47 - C58), C60 = 1 - C48;
  const blend = +a.blend_consumption_kg_month, C17 = +(a.blended_stock_kg || 0), C20 = 0;
  const C49 = blend * C48, G44 = +(a.unusable_kg || 0), G46 = C49, G47 = G44 + G46;
  const G48 = C17 * C48 > G46 ? -G46 : -C17 * C48, G49 = G47 + G48;
  const K45 = C8 + C20, K46 = K45 * C49 / 30;
  const K48 = C17 * C48 > -G48 + K46 ? -K46 : C17 * C48 < -G48 ? 0 : -(C17 * C48) - G48, K49 = K46 + K48;
  const addOrder = Math.max(0, Math.ceil((G49 + K49 - a.stock_kg) / C11));
  if (+a.stock_kg < G49) w.push('Присадка: ROB ниже страхового запаса');
  if (a.tank_kg && addOrder > a.tank_kg * .95 - a.stock_kg) w.push('Присадка: заказ может не поместиться в танк (95 %)');
  const C61 = blend * C60, G55 = +meso.safety_stock_kg, G57 = C61, G58 = G55 + G57;
  const G59 = C17 * C60 > G57 ? -G57 : -C17 * C60, G60 = G58 + G59;
  const K55 = C8, K56 = K55 * meso.consumption_kg_month / 30, K57 = K45 * C61 / 30, K58 = K56 + K57;
  const K59 = C17 * C60 > -G59 + K57 ? -K57 : C17 * C60 < -G59 ? 0 : -(C17 * C60) - G59, K60 = K58 + K59;
  const mesoOrder = G60 + K60 > meso.stock_kg ? (G60 + K60 - meso.stock_kg) / C12 : 0;
  if (+meso.stock_kg < G60) w.push('MESO: ROB ниже страхового запаса');
  if (meso.tank_kg && mesoOrder > meso.tank_kg * .95 - meso.stock_kg) w.push('MESO: заказ может не поместиться в танк (95 %)');
  const t = p.tpeo, C13 = +(t.density ?? .913), G70 = +t.sump_kg + +t.consumption_kg_month, K68 = C8;
  const K70 = (+t.changeouts || 0) * t.sump_kg + t.consumption_kg_month / 30 * K68;
  const tpeoOrder = Math.max(0, Math.ceil((K70 + G70 - t.stock_kg) / C13));
  if (+t.stock_kg < G70) w.push('TPEO (масло ДГ): ROB ниже страхового запаса');
  if (t.tank_kg && tpeoOrder > t.tank_kg * .95 - t.stock_kg) w.push('TPEO: заказ может не поместиться в танк (95 %)');
  let mdcl = null;
  if (p.mdcl2 && p.mdcl2.bn) { const m = p.mdcl2, dens = MDCL_DENS[m.bn], cons = +m.consumption_kg_month;
    mdcl = Math.max(0, Math.ceil((cons / 30 * C8 + cons - m.stock_kg) / dens)); if (+m.stock_kg < cons) w.push('MDCL: ROB ниже страхового запаса') }
  return { days: C8, ratioAdd: C48, ratioMeso: C60, add: { safety: G49, forward: K49, order: addOrder, unit: a.product === 'GulfSea Cylcare 50140' ? 'кг' : 'л' },
    meso: { safety: G60, forward: K60, order: mesoOrder }, tpeo: { safety: G70, forward: K70, order: tpeoOrder }, mdcl, warnings: w };
}
