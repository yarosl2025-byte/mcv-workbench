// Cylinder lubrication — logic ported 1:1 from "A603 - CLO Matrix Aug 2024.xlsx"
// (sheets "User interface", "Model", "BoB calculator_conventional", "BoB calculator_Thin Lube").
// Vessel row of the "Matrix" sheet comes from the data document cal/clo-vessel (kept out of the public code):
// {name, engine, smcr, mop, lubSystem, bob, ldcl, frSmcr, pts:[[load%, g/kWh]x4], sFactor, bobModel}

const mround = (x, m) => Math.round(x / m) * m;

// BN of cylinder oil to blend on board — Model!B75..B78
export function bnToBlend(s, model = 4) {
  if (s <= 0.5) return 50;
  if (s < 1.5) return 70;
  if (model === 4) return s < 2.25 ? 100 : s < 3 ? 120 : 140;
  return s < 2.75 ? 100 : 120;
}
// BN step curve shown in the Matrix (x = sulphur %, y = BN) for model M4
export const BN_CURVE = [[0, 50], [0.5, 50], [0.5, 70], [1.5, 70], [1.5, 100], [2.25, 100], [2.25, 120], [3, 120], [3, 140], [3.5, 140]];

// Main calculation — mirrors "User interface" F31..F37 and Model B22/B23
export function calc({ s, sw, load }, v) {
  const hot = sw > 28, hiS = s > 1.5;
  const sf = v.sFactor;                                   // Model!B100 with BoB = 1
  // MOP set-points (User interface F35, F37)
  let frf, minFr;
  if (v.mop) {
    frf = v.bob ? (v.ldcl ? (hiS ? minFeed(v, hot, hiS) / 3 : 0.2) : 0.2) : (hot ? (hiS ? sf * 0.7 * 1.1 : sf * 0.7) : sf * 0.7);
    minFr = v.bob ? (hot && hiS ? v.frSmcr * 1.1 : v.frSmcr) : v.frSmcr;
  }
  // S-corrected feed-rate curve (Model column C)
  const B6 = v.pts[0][1];
  const corr = v.pts.map(([l, b]) => {
    let x = sf * s <= B6 ? b : sf * s * b / B6;
    if (hot && hiS) x *= 1.1;
    return [l, mround(x, 0.05)];
  });
  const curve = corr[0][1] < B6 ? v.pts : corr;          // Model!B22: use basic curve if corrected < basic
  const fr = interp(curve, load);
  const cons = load / 100 * v.smcr * fr * 24 / 1000;    // kg / 24 h
  return {
    bn: v.bob ? bnToBlend(s, v.bobModel) : null,
    frf: v.mop ? frf : null, minFr: v.mop ? minFr : null,
    setFr: v.mop ? null : mround(corr[0][1], 0.05),
    fr, cons, curve,
  };
}
function minFeed(v, hot, hiS) { return hot && hiS ? v.frSmcr * 1.1 : v.frSmcr }
// Piecewise-linear exactly as the Excel IF chain (extrapolates below 10 % with the 10–17 % segment)
function interp(c, L) {
  const [[A6, B6], [A7, B7], [A8, B8], [A9, B9]] = c;
  if (L < A8) return (B9 - B8) / (A9 - A8) * (L - A9) + B9;
  if (L < A7) return (B8 - B7) / (A8 - A7) * (L - A8) + B8;
  return (B7 - B6) / (A7 - A6) * (L - A7) + B7;
}

// "BoB calculator, conventional"
export function bobConventional({ total, bnBlend, bnAdd, bnSys }) {
  const add = (bnBlend - bnSys) / (bnAdd - bnSys) * total;
  return { additive: add, system: total - add };
}

// "BoB calculator, Thin Lube" — input ratios [ME system oil, thin base oil, additive], target viscosity 13.5 cSt
export const THIN = {
  'Richful-RF6312-BN365': { 50: [.81, .07, .12], 70: [.65, .17, .18], 100: [.43, .30, .27], 120: [.27, .40, .33], 140: [.17, .45, .38] },
  'Chevron-MCLA-BN400':   { 50: [.83, .05, .12], 70: [.71, .12, .17], 100: [.53, .22, .25], 120: [.40, .30, .30], 140: [.28, .36, .36] },
  'Premier 6-BOB300-BN304': { 50: [.75, .10, .15], 70: [.54, .24, .22], 100: [.22, .45, .33] },
};
export function thinLube({ pkg, batch, bn }) {
  const r = THIN[pkg] && THIN[pkg][bn];
  if (!r) return null;
  return { system: r[0] * batch, thin: r[1] * batch, additive: r[2] * batch, ratio: r };
}
