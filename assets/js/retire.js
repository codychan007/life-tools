// ============================================================
// 工具三：退休規劃（一頁一題；結果頁可以改進階假設即時重計）
// 假設：data/assumptions.json → retire；強積金上下限：data/statutory.json
// ============================================================
import { t } from './i18n.js';
import { money, loadJSON } from './layout.js';
import { wizard } from './wizard.js';
import { retirePlan, mpfMonthly } from './calc/retire.js';
import { lineChart, COLORS } from './chart.js';

const box = document.getElementById('wizard');
const [ASSUME, STAT] = await Promise.all([loadJSON('/data/assumptions.json'), loadJSON('/data/statutory.json')]);
const R = ASSUME.retire, MPF = STAT.mpf;
const pctTxt = r => `${+(r * 100).toFixed(1)}%`;

const Q = [
  { key: 'age', q: t('你今年幾多歲？', 'How old are you?'), type: 'number', min: 18, max: 70, def: () => 30 },
  { key: 'retireAge', q: t('你想幾多歲退休？', 'At what age do you want to retire?'), type: 'number', min: 40, max: 80, def: () => R.defaultRetireAge,
    check: (v, a) => (v <= a.age ? t('退休年齡要大過而家年齡', 'Retirement age must be above your current age') : '') },
  { key: 'monthlySpend', q: t('退休後每個月想用幾多錢？（按今日物價）', 'How much a month do you want to spend in retirement? (Today’s prices)'), help: t('例如今日 $15,000 嘅生活水平；之後會自動加通脹', 'e.g. a $15,000 lifestyle today; inflation is added for you'), type: 'money', min: 1, def: () => 15000 },
  { key: 'mpfBalance', q: t('你而家強積金結餘大約幾多？', 'Roughly how much is in your MPF now?'), help: t('睇 eMPF 平台或者周年權益報表', 'Check the eMPF platform or your annual benefit statement'), type: 'money', min: 0, optional: true, skipLabel: t('唔知，當 $0', 'Not sure, count as $0') },
  { key: 'mpfMode', q: t('你每月強積金供款（你＋僱主）係幾多？', 'What are your monthly MPF contributions (you + employer)?'), type: 'options',
    opts: [['know', t('我知道，自己輸入', 'I know, let me enter it')], ['salary', t('唔知，用月薪幫我計（5%＋5%）', 'Not sure, work it out from my salary (5% + 5%)')], ['none', t('冇供（例如自僱冇供／退休咗）', 'None (e.g. not contributing)')]] },
  { key: 'mpfMonthly', when: a => a.mpfMode === 'know', q: t('每月強積金供款合共（你＋僱主）', 'Total monthly MPF contributions (you + employer)'), type: 'money', min: 0, def: () => 3000 },
  { key: 'salary', when: a => a.mpfMode === 'salary', q: t('你嘅月薪（有關入息）大約幾多？', 'What is your monthly salary (relevant income)?'),
    help: t(`按法定：月入 ${money(MPF.minIncome)} 以下僱員唔使供；${money(MPF.maxIncome)} 以上按上限計`, `By law: employees earning under ${money(MPF.minIncome)} don’t contribute; above ${money(MPF.maxIncome)} the cap applies`), type: 'money', min: 0, def: () => 25000 },
  { key: 'otherAssets', q: t('除咗強積金，你有幾多儲蓄或投資留俾退休用？', 'Apart from MPF, how much savings or investments are set aside for retirement?'), type: 'money', min: 0, optional: true, skipLabel: t('冇／跳過', 'None / skip') },
  { key: 'extraMonthly', q: t('你而家每個月另外儲幾多俾退休？', 'How much extra do you save each month for retirement now?'), type: 'money', min: 0, optional: true, skipLabel: t('冇／跳過', 'None / skip') },
  { key: 'ret', q: t('你預計退休前嘅每年回報率？', 'What yearly return do you expect before retirement?'), help: t('回報率係假設，並非保證', 'Returns are assumptions, not guarantees'), type: 'options',
    opts: Object.entries(R.returns).map(([k, v]) => [k, `${{ conservative: t('保守', 'Conservative'), balanced: t('平衡', 'Balanced'), aggressive: t('進取', 'Growth') }[k]}　${pctTxt(v)}`]) },
];

const BANDS = [
  [20, 29, t('20–29 歲', '20s'), t('時間係你最大優勢：先建立備用金，強積金揀適合嘅基金，每月定額儲少少都會滾大。', 'Time is your biggest edge: build an emergency fund, pick suitable MPF funds, and small regular savings compound.')],
  [30, 39, t('30–39 歲', '30s'), t('開支最多嘅年紀：保障同儲蓄要平衡，加人工時順手提高儲蓄比例。', 'Peak spending years: balance protection and saving, and raise your savings rate with each pay rise.')],
  [40, 49, t('40–49 歲', '40s'), t('缺口要認真處理：檢查強積金表現，考慮扣稅嘅自願供款（TVC）同年金。', 'Time to close the gap: review MPF performance and consider tax-deductible TVC and annuities.')],
  [50, 99, t('50 歲或以上', '50+'), t('準備由「儲」轉「用」：諗清楚退休後穩定現金流同醫療開支，降低大起大跌嘅風險。', 'Shift from saving to spending: plan steady income and medical costs, and reduce big swings.')],
];

function result(a, api) {
  const s = {
    age: a.age, retireAge: a.retireAge, monthlySpend: a.monthlySpend,
    mpfBalance: a.mpfBalance || 0, otherAssets: a.otherAssets || 0, extraMonthly: a.extraMonthly || 0,
    mpfMonthly: a.mpfMode === 'know' ? a.mpfMonthly || 0 : a.mpfMode === 'salary' ? mpfMonthly(a.salary || 0, MPF) : 0,
    ret: R.returns[a.ret] ?? R.returns[R.defaultReturn], inflation: R.inflation, endAge: R.endAge, postReturn: R.postReturn,
  };
  const sel = (id, opts, cur) => `<select id="${id}" class="field-select">${opts.map(([v, l]) => `<option value="${v}" ${v == cur ? 'selected' : ''}>${l}</option>`).join('')}</select>`;

  const draw = () => {
    const r = retirePlan(s);
    const pctReady = Math.min(100, Math.round(r.ratio * 100));
    const readyTxt = r.gap <= 0 ? t('已經夠', 'On track') : pctReady >= 50 ? t('過半', 'Over halfway') : t('未夠一半', 'Under halfway');
    const bandIdx = BANDS.findIndex(b => s.age >= b[0] && s.age <= b[1]);
    box.innerHTML = `
      <div class="stack">
        <div>
          <div class="q-step">${t('退休準備', 'Retirement readiness')}</div>
          <div class="big-result">${readyTxt}・${pctReady}%</div>
          <div class="progress" aria-hidden="true" style="height:12px;margin-top:8px"><i style="width:${pctReady}%;background:var(--matcha)"></i></div>
        </div>
        <div>
          <div class="report-row"><span>${t(`${s.retireAge} 歲退休時需要（用到 ${s.endAge} 歲）`, `Needed at ${s.retireAge} (to age ${s.endAge})`)}</span><b>${money(r.need)}</b></div>
          <div class="report-row"><span>${t('預計到時累積', 'Expected savings by then')}</span><b>${money(r.acc)}</b></div>
          <div class="report-row"><span>${t('缺口', 'Gap')}</span><b>${money(r.gap)}</b></div>
          <p class="muted" style="font-size:14px">${t(`相當於今日幣值：需要 ${money(r.needToday)}、預計累積 ${money(r.accToday)}（通脹 ${pctTxt(s.inflation)}）。`, `In today’s money: need ${money(r.needToday)}, expected ${money(r.accToday)} (inflation ${pctTxt(s.inflation)}).`)}</p>
        </div>
        ${r.gap > 0 ? `<div>
          <h3>${t('要補返個缺口，每月要額外儲', 'To close the gap, save extra each month')}</h3>
          <div class="big-result">${money(r.perMonth)}</div>
          <div class="stat-row" style="margin-top:10px">
            <div class="stat"><span>${t('如果早 5 年開始', 'If you had started 5 years earlier')}</span><b>${money(r.earlier5)}</b></div>
            <div class="stat"><span>${t('如果遲 5 年先開始', 'If you start 5 years later')}</span><b>${r.later5 == null ? t('嚟唔切', 'Too late') : money(r.later5)}</b></div>
          </div>
        </div>` : `<p class="callout green">${t('按你嘅假設，預計累積已經夠退休所需。', 'On your assumptions, your savings cover what you need.')}</p>`}
        <div>
          <h3>${t('每年累積 vs 所需', 'Savings each year vs what you need')}</h3>
          <div id="rt-chart"></div>
        </div>
        <div>
          <h3>${t('改假設（即時重計）', 'Change assumptions (instant)')}</h3>
          <div class="who-grid">
            <label class="field"><span>${t('退休前回報', 'Return before retiring')}</span>${sel('rt-ret', Object.values(R.returns).map(v => [v, pctTxt(v)]), s.ret)}</label>
            <label class="field"><span>${t('通脹', 'Inflation')}</span>${sel('rt-inf', [0.015, 0.02, 0.025, 0.03, 0.035].map(v => [v, pctTxt(v)]), s.inflation)}</label>
            <label class="field"><span>${t('退休後回報', 'Return after retiring')}</span>${sel('rt-post', [0, 0.02, 0.03, 0.04].map(v => [v, pctTxt(v)]), s.postReturn)}</label>
            <label class="field"><span>${t('計到幾多歲', 'Plan to age')}</span>${sel('rt-end', R.endAgeOptions.map(v => [v, t(`${v} 歲`, `${v}`)]), s.endAge)}</label>
          </div>
          <p class="muted" style="font-size:13px">${t(`計法：退休後每年年頭提款，開支每年跟通脹加；供款按月計；強積金每月 ${money(s.mpfMonthly)}${a.mpfMode === 'salary' ? '（按月薪計）' : ''}。人工同供款唔假設增長。回報率為假設，並非保證。`, `Method: withdrawals at the start of each retirement year, rising with inflation; contributions monthly; MPF ${money(s.mpfMonthly)} a month${a.mpfMode === 'salary' ? ' (from salary)' : ''}. No pay or contribution growth assumed. Returns are assumptions, not guarantees.`)}</p>
        </div>
        <div>
          <h3>${t('唔同年紀嘅一般方向', 'General direction by age')}</h3>
          <div class="age-bands">${BANDS.map((b, k) => `<div class="${k === bandIdx ? 'on' : ''}"><b>${b[2]}</b>${b[3]}</div>`).join('')}</div>
        </div>
        <div class="q-nav"><button type="button" class="btn secondary" data-edit>${t('← 改答案', '← Change answers')}</button>
          <button type="button" class="btn secondary" data-restart>${t('重新答過', 'Start over')}</button></div>
      </div>`;
    lineChart(box.querySelector('#rt-chart'), {
      series: [
        { name: t('預計累積', 'Expected savings'), color: COLORS[2], points: r.curve },
        { name: t('退休所需', 'Needed at retirement'), color: COLORS[3], points: [[s.age, r.need], [s.retireAge, r.need]] },
      ],
      dashed: [1], yFmt: v => (v === 0 ? '$0' : v >= 1e6 ? `$${+(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1000)}k`), xFmt: v => v, xLabel: t('歲', 'Age'),
    });
    const on = (id, k) => box.querySelector(id).addEventListener('change', e => { s[k] = Number(e.target.value); draw(); });
    on('#rt-ret', 'ret'); on('#rt-inf', 'inflation'); on('#rt-post', 'postReturn'); on('#rt-end', 'endAge');
    box.querySelector('[data-edit]').addEventListener('click', api.edit);
    box.querySelector('[data-restart]').addEventListener('click', api.restart);
  };
  draw();
}

wizard(box, Q, result);
