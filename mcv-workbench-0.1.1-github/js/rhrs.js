// ME component running hours — replica of "ME_RHRS_Cabo_Verde.xls" (sheet formulas):
//  std : running = RH − installed at RH;  to overhaul = interval − RH + installed;  total = running + hours when installed (if given)
//  fv  : fuel valves — running since test = RH − installed; to pressure test/nozzle = 8000 − running; to spindle guide = 16000 − (valve hours when installed + running)
//  run : running only (sigma pipe);  own: own counter (HPS pumps) — running = present counter − installed
export function calcRow(g, r, RH) {
  const inst = num(r.rhInst);
  if (g.kind === 'own') { const pres = num(r.own); const run = pres != null && inst != null ? pres - inst : null; return { run, left: run != null && g.interval ? g.interval - run : null } }
  if (inst == null || RH == null) return { run: null, left: null };
  const run = RH - inst;
  if (g.kind === 'fv') return { run, left: g.interval - run, left2: g.interval2 - ((num(r.prior) || 0) + run) };
  if (g.kind === 'run') return { run, left: null };
  return { run, left: g.interval ? g.interval - RH + inst : null, total: g.total ? run + (num(r.prior) || 0) : null };
}
const num = v => v === '' || v == null || isNaN(v) ? null : +v;
// Reefer energy when the kWh meter is not working ("Reefer_Consumption_Calculator.xlsx"):
// kWh = (1.787 + 0.054 × SW temp [clamped 5…35 °C]) × number of reefers × hours
export function reeferKWh(sw, n, hh, mm) { const t = Math.min(35, Math.max(5, +sw)); return (1.787 + 0.054 * t) * (+n) * ((+hh || 0) + (+mm || 0) / 60) }
