// ============================================================
// 醫療儲備規劃（純函數，tests/verify.html 會驗算）
// A = data/assumptions.json 嘅 reserve 部分（規劃假設，Cody 可以改）
// ============================================================

/** 缺口計分 → { score, level: 'low'|'mid'|'high', reasons: [key…] } */
export function gapScore(ans, A) {
  const S = A.score;
  let score = 0;
  const reasons = [];
  const add = (pts, key) => { if (pts) { score += pts; reasons.push(key); } };
  if (ans.group === 'no') add(S.noGroup, 'noGroup');
  else if (ans.groupLimit === 'unknown' || ans.groupLimit === 'lt50k') add(S.groupLowOrUnknown, 'groupLow');
  if (ans.personal === 'none') add(S.noPersonal, 'noPersonal');
  else if (ans.personal === 'basic' && ans.pref === 'private') add(S.basicButPrivate, 'basicButPrivate');
  if (ans.ci === 'none') {
    add(S.noCI, 'noCI');
    if (ans.dependants === 'yes') add(S.noCIDependants, 'noCIDependants');
  }
  if (ans.fund === 'lt3') add(S.fundUnder3, 'fundUnder3');
  else if (ans.fund === '3to6') add(S.fund3to6, 'fund3to6');
  const L = A.gapLevels;
  const level = score <= L.low[1] ? 'low' : score <= L.mid[1] ? 'mid' : 'high';
  return { score, level, reasons };
}

/** 醫療儲備金 = 墊底費 + 緩衝（按病房偏好）+（冇危疾 ? N 個月開支 : 0）；每月預留 = ÷ spreadMonths */
export function reserveFund(ans, A) {
  const deductible = ans.personal === 'none' ? 0 : (ans.deductible || 0);
  const buffer = A.buffer[ans.pref] ?? 0;
  const monthlyExp = A.incomeMid[ans.income] ?? 0;
  const ciPart = ans.ci === 'none' ? A.ciMonthsOfExpenses * monthlyExp : 0;
  const total = deductible + buffer + ciPart;
  return { deductible, buffer, ciPart, total, perMonth: total / A.spreadMonths };
}

/** 中位數 */
export function median(xs) {
  const v = xs.filter(x => x != null && isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
