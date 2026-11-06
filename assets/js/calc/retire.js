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

/** 全套計算 */
export function retirePlan(p) {
  const years = p.retireAge - p.age;
  const retireYears = p.endAge - p.retireAge;
  const need = needAtRetire({ monthlySpend: p.monthlySpend, years: Math.max(0, years), inflation: p.inflation, retireYears, postReturn: p.postReturn });
  const lump = (p.mpfBalance || 0) + (p.otherAssets || 0);
  const monthly = (p.mpfMonthly || 0) + (p.extraMonthly || 0);
  const acc = accumulated({ lump, monthly, years: Math.max(0, years), ret: p.ret });
  const gap = Math.max(0, need - acc);
  const todayValue = x => x / Math.pow(1 + p.inflation, Math.max(0, years));
  // 每年累積曲線（由今年到退休）
  const curve = [];
  for (let y = 0; y <= Math.max(0, years); y++) curve.push([p.age + y, accumulated({ lump, monthly, years: y, ret: p.ret })]);
  return {
    years, retireYears, need, acc, gap, ratio: need > 0 ? acc / need : 1,
    perMonth: monthlyToClose(gap, years, p.ret),
    earlier5: monthlyToClose(gap, years + 5, p.ret),
    later5: monthlyToClose(gap, years - 5, p.ret),
    needToday: todayValue(need), accToday: todayValue(acc), curve,
  };
}
