// ============================================================
// 工具二：醫療儲備規劃（一頁一題，唔問病歷；結果全部用規則＋模板）
// 假設數字：data/assumptions.json → reserve（Cody 可以改）
// ============================================================
import { t, P } from './i18n.js';
import { money, loadJSON, esc } from './layout.js';
import { wizard } from './wizard.js';
import { gapScore, reserveFund, median } from './calc/reserve.js';
import { stdPremium } from './calc/premium.js';

const box = document.getElementById('wizard');
const [ASSUME, STD] = await Promise.all([loadJSON('/data/assumptions.json'), loadJSON('/data/medical/vhis-standard.json')]);
const A = ASSUME.reserve;

const Q = [
  { key: 'age', q: t('你今年幾多歲？', 'How old are you?'), type: 'number', min: 18, max: 80, def: () => 30, unit: t('用嚟計「遲 10 年先買」嘅保費分別', 'Used for the “buy 10 years later” comparison') },
  { key: 'sex', q: t('你嘅性別？', 'Your sex?'), help: t('醫保保費按性別定價', 'Medical premiums are priced by sex'), type: 'options', opts: [['M', t('男', 'Male')], ['F', t('女', 'Female')]] },
  { key: 'group', q: t('公司有冇幫你買團體醫保？', 'Does your employer give you group medical cover?'), type: 'options', opts: [['yes', t('有', 'Yes')], ['no', t('冇／自僱', 'No / self-employed')]] },
  { key: 'groupLimit', when: a => a.group === 'yes', q: t('公司醫保每次住院大約賠幾多？', 'Roughly how much does work cover pay per hospital stay?'), help: t('睇員工手冊或者問 HR；唔知都冇問題', 'Check your staff handbook or ask HR; “not sure” is fine'), type: 'options',
    opts: [['unknown', t('唔知', 'Not sure')], ['lt50k', t('少過 $5 萬', 'Under $50,000')], ['50to200k', t('$5 萬至 $20 萬', '$50,000–200,000')], ['gt200k', t('多過 $20 萬', 'Over $200,000')]] },
  { key: 'personal', q: t('你有冇自己買醫療保險？（公司嗰份唔計）', 'Do you have your own medical insurance? (Work cover doesn’t count)'), type: 'options',
    opts: [['none', t('冇', 'No')], ['basic', t('有，基本（例如自願醫保標準計劃）', 'Yes, basic (e.g. VHIS Standard Plan)')], ['premium', t('有，高端／全數賠償', 'Yes, high-end / full cover')]] },
  { key: 'deductible', when: a => a.personal !== 'none', q: t('你份醫保有冇墊底費（自付費）？', 'Does your plan have a deductible?'), type: 'options',
    opts: [['0', t('冇', 'No')], ['10000', t('$1 萬或以下', '$10,000 or less')], ['25000', t('大約 $2–3 萬', 'About $20,000–30,000')], ['50000', t('大約 $5 萬', 'About $50,000')], ['100000', t('$10 萬或以上', '$100,000 or more')], ['u', t('唔知', 'Not sure')]] },
  { key: 'pref', q: t('如果要入院，你想住邊種病房？', 'If you need a hospital stay, which ward would you want?'), help: t('同工具一嘅病房級別一樣', 'Same ward levels as the compare tool'), type: 'options',
    opts: [['public', t('公立醫院', 'Public hospital')], ['semi', t('私家醫院半私家房', 'Private hospital, semi-private room')], ['private', t('私家醫院私家房', 'Private hospital, private room')]] },
  { key: 'ci', q: t('你有冇危疾保障？（確診一筆過賠嗰種）', 'Do you have critical illness cover? (Lump sum on diagnosis)'), type: 'options',
    opts: [['none', t('冇', 'No')], ['lt500k', t('有，少過 $50 萬', 'Yes, under $500,000')], ['500kto1m', t('有，$50 萬至 $100 萬', 'Yes, $500,000–1M')], ['gt1m', t('有，多過 $100 萬', 'Yes, over $1M')]] },
  { key: 'dependants', q: t('有冇屋企人靠你份收入生活？', 'Does anyone at home depend on your income?'), type: 'options', opts: [['yes', t('有', 'Yes')], ['no', t('冇', 'No')]] },
  { key: 'budget', q: t('每個月最多可以預留幾多做醫療預算？', 'How much could you set aside each month for medical costs?'), type: 'options',
    opts: [['500', t('$500 以下', 'Under $500')], ['1000', t('$500–1,000', '$500–1,000')], ['2000', t('$1,000–2,000', '$1,000–2,000')], ['3000', t('$2,000 以上', 'Over $2,000')]] },
  { key: 'fund', q: t('你嘅緊急備用金夠用幾多個月？', 'How many months would your emergency fund last?'), type: 'options',
    opts: [['lt3', t('少過 3 個月', 'Under 3 months')], ['3to6', t('3 至 6 個月', '3–6 months')], ['gt6', t('多過 6 個月', 'Over 6 months')]] },
  { key: 'income', q: t('你每月收入大約幾多？', 'Roughly what is your monthly income?'), help: t('只用嚟估算幾個月生活費', 'Only used to estimate a few months of living costs'), type: 'options',
    opts: [['lt15k', t('$15,000 以下', 'Under $15,000')], ['15to30k', t('$15,000–30,000', '$15,000–30,000')], ['30to50k', t('$30,000–50,000', '$30,000–50,000')], ['50to80k', t('$50,000–80,000', '$50,000–80,000')], ['gt80k', t('$80,000 以上', 'Over $80,000')]] },
];

const LEVEL = { low: t('低', 'Low'), mid: t('中', 'Medium'), high: t('高', 'High') };
const REASON = {
  noGroup: t('冇公司醫保：入院全部要靠自己或者個人保險。', 'No work cover: a hospital stay falls on you or your own policy.'),
  groupLow: t('公司醫保限額低或者唔清楚：私家醫院一次手術好易超過。', 'Work cover is low or unclear: one private-hospital surgery can exceed it.'),
  noPersonal: t('冇自己嘅醫療保險：轉工、失業或者退休嗰陣，公司醫保即時冇。', 'No personal medical plan: work cover ends the day you change jobs, lose your job or retire.'),
  basicButPrivate: t('基本醫保想住私家房：病房級別同限額可能唔夠。', 'Basic plan but want a private room: ward level and limits may fall short.'),
  noCI: t('冇危疾保障：醫保唔會補返休養期間冇咗嘅收入。', 'No critical illness cover: medical insurance does not replace lost income while you recover.'),
  noCIDependants: t('有屋企人靠你份收入：收入中斷影響更大。', 'Family depends on your income: losing it hurts more.'),
  fundUnder3: t('緊急備用金少過 3 個月。', 'Emergency fund under 3 months.'),
  fund3to6: t('緊急備用金 3 至 6 個月，仲有空間。', 'Emergency fund 3–6 months; room to build.'),
};

function structure(a) {
  const tips = [];
  if (a.personal === 'none') tips.push(t('<b>醫療保險打底</b>：先有一份自己名下、唔會因轉工而冇咗嘅醫保（例如自願醫保）。', '<b>Medical insurance first</b>: a plan in your own name that stays with you when you change jobs (e.g. VHIS).'));
  if (a.group === 'yes') tips.push(t('<b>公司醫保當額外</b>：佢係福利，唔好當係你唯一嘅保障。', '<b>Treat work cover as a bonus</b>: it is a benefit, not your only protection.'));
  if (a.personal === 'basic' && a.pref !== 'public') tips.push(t('<b>病房級別要對應</b>：想住半私家／私家房，就睇下保障級別同限額夠唔夠；揀墊底費可以慳保費。', '<b>Match the ward level</b>: if you want a semi-private or private room, check the plan’s level and limits; a deductible can lower the premium.'));
  if (a.ci === 'none') tips.push(t('<b>危疾補收入</b>：確診一筆過賠，用嚟補休養期間嘅收入同醫保唔包嘅開支。', '<b>Critical illness for income</b>: a lump sum on diagnosis covers lost income and costs medical insurance won’t.'));
  if (a.ci === 'lt500k' && a.dependants === 'yes') tips.push(t('<b>危疾保額</b>：有屋企人靠你，一般會考慮保額約等於幾年收入。', '<b>CI sum insured</b>: with dependants, people often consider a few years of income.'));
  if (a.fund !== 'gt6') tips.push(t('<b>緊急備用金</b>：慢慢儲到 3–6 個月生活費，應付墊底費同保險唔賠嘅開支。', '<b>Emergency fund</b>: build up 3–6 months of living costs for deductibles and uncovered costs.'));
  tips.push(t('<b>定期檢查</b>：結婚、生仔、轉工、置業之後再睇一次。', '<b>Review regularly</b>: look again after marriage, children, a job change or buying a home.'));
  return tips;
}

/** 標準計劃中位數年保費（只計獨立保單、接受新投保），唔顯示任何產品名 */
function stdMedian(sex, entry, at) {
  const plans = STD.plans.filter(p => p.issuedAs !== 'rider' && !p.renewalOnly);
  return median(plans.map(p => stdPremium(p, sex, entry, at)));
}
function stdMedianSum(sex, entry, to) {
  let s = 0;
  for (let a = entry; a <= to; a++) { const v = stdMedian(sex, entry, a); if (v == null) return null; s += v; }
  return s;
}

function result(a, api) {
  const ans = { ...a, deductible: a.deductible === 'u' || a.deductible == null ? 0 : Number(a.deductible) };
  const g = gapScore(ans, A);
  const f = reserveFund(ans, A);
  const budget = Number(a.budget);
  const L = A.laterYears, to = A.toAge;
  const nowP = stdMedian(a.sex, a.age, a.age), lateP = stdMedian(a.sex, a.age + L, a.age + L);
  const nowSum = a.age <= to ? stdMedianSum(a.sex, a.age, to) : null;
  const lateSum = a.age + L <= to ? stdMedianSum(a.sex, a.age + L, to) : null;
  const prefName = { public: t('公立', 'public'), semi: t('半私家', 'semi-private'), private: t('私家', 'private') }[a.pref];

  box.innerHTML = `
    <div class="stack">
      <div>
        <div class="q-step">${t('你嘅醫療保障缺口', 'Your medical protection gap')}</div>
        <div class="big-result">${LEVEL[g.level]}</div>
        <div class="gap-meter" aria-hidden="true">${['low', 'mid', 'high'].map(k => `<span class="${k === g.level ? 'on' : ''}">${LEVEL[k]}</span>`).join('')}</div>
        ${g.reasons.length ? `<ul class="tips">${g.reasons.map(r => `<li>${REASON[r]}</li>`).join('')}</ul>` : `<p>${t('你嘅基本保障同備用金都齊，記得定期檢查。', 'Your basics and emergency fund are in place; review them regularly.')}</p>`}
        ${a.group === 'yes' ? `<p class="callout">${t('提提你：公司醫保喺你轉工、失業或者退休嗰日就會冇咗。', 'Remember: work cover ends the day you change jobs, lose your job or retire.')}</p>` : ''}
      </div>

      <div>
        <h3>${t('一般保障結構（唔涉及任何產品）', 'General protection structure (no products)')}</h3>
        <ol class="tips">${structure(a).map(x => `<li>${x}</li>`).join('')}</ol>
      </div>

      <div>
        <h3>${t('建議醫療儲備金', 'Suggested medical reserve')}</h3>
        <div class="big-result">${money(f.total)}</div>
        <div class="report-row"><span>${t('墊底費（自付費）', 'Deductible')}</span><b>${money(f.deductible)}</b></div>
        <div class="report-row"><span>${t(`超額／唔保開支緩衝（${prefName}）`, `Buffer for over-limit / uncovered costs (${prefName})`)}</span><b>${money(f.buffer)}</b></div>
        <div class="report-row"><span>${t(`冇危疾：${A.ciMonthsOfExpenses} 個月生活費（按月入估算）`, `No CI: ${A.ciMonthsOfExpenses} months of living costs (from income)`)}</span><b>${money(f.ciPart)}</b></div>
        <p class="result-line">${t(`分 ${A.spreadMonths} 個月儲，每月預留 <span class="hl">${money(f.perMonth)}</span>`, `Saved over ${A.spreadMonths} months: <span class="hl">${money(f.perMonth)}</span> a month`)}
        ${budget >= f.perMonth ? t('，喺你可以預留嘅預算之內。', ', within the budget you can set aside.') : t('，比你可以預留嘅預算多，可以拉長時間慢慢儲。', ', more than your budget; you could take longer.')}</p>
        ${a.deductible === 'u' ? `<p class="muted" style="font-size:14px">${t('你唔肯定墊底費，暫時當 $0 計；睇返保單就知。', 'Deductible unknown, counted as $0; check your policy.')}</p>` : ''}
        <p class="muted" style="font-size:13px">${t(`以上金額係規劃假設（緩衝：公立 ${money(A.buffer.public)}／半私家 ${money(A.buffer.semi)}／私家 ${money(A.buffer.private)}；生活費用月入範圍中間數估算），唔係醫院收費報價。`, `These are planning assumptions (buffer: public ${money(A.buffer.public)} / semi-private ${money(A.buffer.semi)} / private ${money(A.buffer.private)}; living costs estimated from the middle of your income range), not hospital quotes.`)}</p>
      </div>

      ${nowP != null && lateP != null ? `<div>
        <h3>${t(`遲 ${L} 年先買，保費會點？`, `What if you buy ${L} years later?`)}</h3>
        <p class="muted" style="font-size:14px">${t('用醫務衞生局官方「自願醫保標準計劃」保費表，同性別所有標準計劃嘅中位數（唔顯示任何產品）。', 'Median of all VHIS Standard Plans for your sex, from the Health Bureau’s official premium tables (no products shown).')}</p>
        <div class="stat-row">
          <div class="stat"><span>${t(`${a.age} 歲買，第一年`, `Buy at ${a.age}, first year`)}</span><b>${money(nowP)}</b></div>
          <div class="stat"><span>${t(`${a.age + L} 歲買，第一年`, `Buy at ${a.age + L}, first year`)}</span><b>${money(lateP)}</b></div>
          ${nowSum != null ? `<div class="stat"><span>${t(`${a.age} 歲買，供到 ${to} 歲累計`, `Buy at ${a.age}, total to ${to}`)}</span><b>${money(nowSum)}</b></div>` : ''}
          ${lateSum != null ? `<div class="stat"><span>${t(`${a.age + L} 歲買，供到 ${to} 歲累計`, `Buy at ${a.age + L}, total to ${to}`)}</span><b>${money(lateSum)}</b></div>` : ''}
        </div>
        <p style="font-size:14px">${t(`遲買累計可能少啲，因為少供 ${L} 年；但呢 ${L} 年冇保障，而且到時有新病可能唔受保或者要加費。`, `Buying later may total less because you pay ${L} fewer years, but you are unprotected for those years, and new conditions may be excluded or loaded.`)}</p>
        <p class="muted" style="font-size:13px">${t(`按現行保費表計（截至 ${esc(STD.asOf)}），續保時保費可能調整。`, `Based on current premium tables (as of ${esc(STD.asOf)}); renewal premiums may change.`)} <a href="${P}/compare/">${t('去工具一睇各計劃 →', 'See plans in the compare tool →')}</a></p>
      </div>` : ''}

      <div class="q-nav"><button type="button" class="btn secondary" data-edit>${t('← 改答案', '← Change answers')}</button>
        <button type="button" class="btn secondary" data-restart>${t('重新答過', 'Start over')}</button></div>
    </div>`;
  box.querySelector('[data-edit]').addEventListener('click', api.edit);
  box.querySelector('[data-restart]').addEventListener('click', api.restart);
}

wizard(box, Q, result);
