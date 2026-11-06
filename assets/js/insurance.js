// 保障資訊頁：各部分內容已由 scripts/build.py 按 data/insurance.json 直接寫入 HTML。
// 呢度只負責：① 醫療通脹計算機 ② 按今日日期顯示「資料或已過時」提示。
import { mountLayout, money, readNum, moneyInput, isStale } from './layout.js';
import { t } from './i18n.js';

mountLayout();
const $ = id => document.getElementById(id);

document.querySelectorAll('[data-review-by]').forEach(el => {
  if (isStale(el.dataset.reviewBy)) { el.textContent = el.dataset.staleText; el.hidden = false; }
});

moneyInput($('cost'));
function calc() {
  const c = readNum($('cost')), r = parseFloat($('infl').value) / 100 || 0, n = Math.max(0, Math.min(50, parseInt($('yrs').value) || 0));
  const fv = c * Math.pow(1 + r, n);
  $('infl-result').innerHTML = t(`如果每年升 ${(r * 100).toFixed(1)}%，今日 ${money(c)} 嘅醫療開支，${n} 年後大約要 <span class="hl">${money(fv)}</span>（約 ${(fv / (c || 1)).toFixed(1)} 倍）。`,
    `If costs rise ${(r * 100).toFixed(1)}% a year, a ${money(c)} medical bill today would be about <span class="hl">${money(fv)}</span> in ${n} years (about ${(fv / (c || 1)).toFixed(1)} times).`);
}
['cost', 'infl', 'yrs'].forEach(id => $(id).addEventListener('input', calc));
calc();
