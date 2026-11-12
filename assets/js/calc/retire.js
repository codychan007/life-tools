// ============================================================
// 退休計算（純函數，tests/verify.html 會驗算）
// 回報率、通脹全部係年率；供款按月、每月尾供
// ============================================================

/** 年率 → 月率 */
export const monthlyRate = r => Math.pow(1 + r, 1 / 12) - 1;

/** 退休所需總額（退休嗰日嘅金額）：每年年頭提款，開支跟通脹加，退休後回報 rp */
export function needAtRetire({ monthlySpend, years, inflation, retireYears, postReturn }) {
  const eR = monthlySpend * Math.pow(1 + inflation, years);
  const q = (1 + inflation) / (1 + postReturn);
  let s = 0;
  for (let k = 0; k < retireYears; k++) s += Math.pow(q, k);
  return 12 * eR * s;
}

/** 年金終值系數：每月供 1 蚊，供 n 個月 */
export function fvFactor(j, months) {
  return j === 0 ? months : (Math.pow(1 + j, months) - 1) / j;
}

/** 預計累積（退休嗰日）：現有資產複息 + 每月供款 */
export function accumulated({ lump, monthly, years, ret }) {
  const j = monthlyRate(ret), n = Math.round(years * 12);
  return lump * Math.pow(1 + j, n) + monthly * fvFactor(j, n);
}

/** 要補一個缺口，每月要額外儲幾多（years ≤ 0 → null：嚟唔切） */
export function monthlyToClose(gap, years, ret) {
  if (years <= 0) return null;
  if (gap <= 0) return 0;
  return gap / fvFactor(monthlyRate(ret), Math.round(years * 12));
}

/** 強積金每月供款（僱主＋僱員），按月薪同法定上下限 */
export function mpfMonthly(salary, mpf) {
  const capped = Math.min(salary, mpf.maxIncome);
  const employee = salary < mpf.minIncome ? 0 : capped * mpf.rate;
  const employer = capped * mpf.rate;
  return employee + employer;
}

/**
 * 退休前累積（按月模擬）：強積金同其他儲蓄分開計回報
 * 詳細模式：人工／供款每年加 growth；強積金可以用另一個回報 mpfRet；TVC 每月 tvc
 * 簡易模式（growth 0、mpfRet = ret）結果同 accumulated() 一樣
 * 回傳 { acc, curve: [[歲, 結餘], …] }（每年一點）
 */
export function project(p) {
  const years = Math.max(0, Math.round(p.retireAge - p.age));
  const g = p.growth || 0, jm = monthlyRate(p.mpfRet ?? p.ret), jo = monthlyRate(p.ret);
  let mpf = p.mpfBalance || 0, oth = p.otherAssets || 0;
  const curve = [[p.age, mpf + oth]];
  for (let y = 0; y < years; y++) {
    const f = Math.pow(1 + g, y);
    const mpfC = p.salary != null && p.mpf ? mpfMonthly(p.salary * f, p.mpf) : (p.mpfMonthly || 0) * f;
    const othC = (p.extraMonthly || 0) * f + (p.addMonthly || 0);
    for (let m = 0; m < 12; m++) {
      mpf = mpf * (1 + jm) + mpfC + (p.tvc || 0);
      oth = oth * (1 + jo) + othC;
    }
    curve.push([p.age + y + 1, mpf + oth]);
  }
  return { acc: mpf + oth, curve };
}

/** 退休後第 k 年（0 = 退休嗰年）要由儲蓄攞出嚟嘅錢：生活費＋醫療－其他收入（全部年頭攞） */
function yearParts(p, k) {
  const n = Math.max(0, p.retireAge - p.age) + k;
  const spend = 12 * p.monthlySpend * Math.pow(1 + p.inflation, n);
  const med = (p.medicalYearly || 0) * Math.pow(1 + (p.medInflation ?? p.inflation), n);
  const inc = 12 * (p.postIncome || 0) * Math.pow(1 + p.inflation, n);
  return { spend, med, inc, net: spend + med - inc };
}

/** 退休所需（退休嗰日嘅金額），分開生活費、醫療、其他收入 */
export function retireNeed(p) {
  const retireYears = p.endAge - p.retireAge;
  const out = { spend: 0, med: 0, inc: 0, need: 0 };
  for (let k = 0; k < retireYears; k++) {
    const d = Math.pow(1 + p.postReturn, k), y = yearParts(p, k);
    out.spend += y.spend / d; out.med += y.med / d; out.inc += y.inc / d;
  }
  out.need = Math.max(0, out.spend + out.med - out.inc);
  return out;
}

/** 退休後結餘：每年年頭攞錢，剩低嘅按退休後回報滾；錢唔夠嗰年就係「用到幾多歲」（null = 用到 maxAge 都仲有） */
export function drawdown(p, start, maxAge = 110) {
  let bal = start;
  const curve = [];
  for (let age = p.retireAge; age <= maxAge; age++) {
    curve.push([age, Math.max(0, bal)]);
    const net = yearParts(p, age - p.retireAge).net;
    if (bal < net - 1) return { runOut: age, curve: [...curve, [age + 1, 0]] };
    bal = (bal - net) * (1 + p.postReturn);
  }
  return { runOut: null, curve };
}

/** 套用「補缺口」調整：遲 delay 年退休、開支減 cut（0–1）、每月多儲 add、回報加 bump */
export function applyLevers(p, { delay = 0, cut = 0, add = 0, bump = 0 } = {}) {
  return {
    ...p, retireAge: p.retireAge + delay, monthlySpend: p.monthlySpend * (1 - cut),
    addMonthly: (p.addMonthly || 0) + add, ret: p.ret + bump, mpfRet: (p.mpfRet ?? p.ret) + bump,
  };
}

/** 全套計算 */
export function retirePlan(p) {
  const years = p.retireAge - p.age;
  const retireYears = p.endAge - p.retireAge;
  const nd = retireNeed(p);
  const { acc: accOnly, curve } = project(p);
  const acc = accOnly + (p.lumpAtRetire || 0);
  const need = nd.need;
  const gap = Math.max(0, need - acc);
  const todayValue = x => x / Math.pow(1 + p.inflation, Math.max(0, years));
  const dd = drawdown(p, acc);
  return {
    years, retireYears, need, needParts: nd, acc, gap, ratio: need > 0 ? acc / need : 1,
    perMonth: monthlyToClose(gap, years, p.ret),
    earlier5: monthlyToClose(gap, years + 5, p.ret),
    later5: monthlyToClose(gap, years - 5, p.ret),
    needToday: todayValue(need), accToday: todayValue(acc), curve,
    runOut: dd.runOut, lifeCurve: [...curve.slice(0, -1), ...dd.curve],
  };
}

/** 四個補缺口方法（每個單獨用）：遲幾年退休、開支減到幾多、每月多儲、回報要幾高 */
export function gapLevers(p) {
  const base = retirePlan(p);
  if (base.gap <= 0) return null;
  const closes = q => retirePlan(q).gap <= 0.5;
  let later = null;
  for (let d = 1; d <= 15 && p.retireAge + d < p.endAge; d++) if (closes(applyLevers(p, { delay: d }))) { later = p.retireAge + d; break; }
  // 開支：所需金額同每月開支成正比 → 直接解
  const nd = base.needParts, avail = base.acc;
  const perSpend = nd.spend / p.monthlySpend;
  const spendTo = perSpend > 0 ? (avail - nd.med + nd.inc) / perSpend : null;
  let bump = null;
  if (closes(applyLevers(p, { bump: 0.15 }))) {
    let lo = 0, hi = 0.15;
    for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (closes(applyLevers(p, { bump: mid }))) hi = mid; else lo = mid; }
    bump = hi;
  }
  return {
    laterAge: later,
    spendTo: spendTo != null && spendTo > 0 ? spendTo : null,
    perMonth: base.perMonth,
    retTo: bump == null ? null : p.ret + bump,
  };
}
