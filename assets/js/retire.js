// ============================================================
// 工具三：退休規劃（一頁一題；簡易／詳細兩個模式；結果頁可以改假設、試補缺口方法即時重計）
// 假設：data/assumptions.json → retire；強積金上下限：data/statutory.json
// ============================================================
import { t } from './i18n.js';
import { money, loadJSON } from './layout.js';
import { wizard } from './wizard.js';
import { retirePlan, mpfMonthly, gapLevers, applyLevers } from './calc/retire.js';
import { lineChart, COLORS } from './chart.js';

const box = document.getElementById('wizard');
const [ASSUME, STAT] = await Promise.all([loadJSON('/data/assumptions.json'), loadJSON('/data/statutory.json')]);
const R = ASSUME.retire, MPF = STAT.mpf;
const pctTxt = r => `${+(r * 100).toFixed(1)}%`;
const RET_LBL = { conservative: t('保守', 'Conservative'), balanced: t('平衡', 'Balanced'), aggressive: t('進取', 'Growth') };
const retOpts = () => Object.entries(R.returns).map(([k, v]) => [k, `${RET_LBL[k]}　${pctTxt(v)}`]);
const detailed = a => a.mode === 'detailed';

const Q = [
  { key: 'mode', q: t('想計得快啲定仔細啲？', 'Quick or detailed?'), type: 'options',
    help: t('詳細模式會多問人工增長、強積金回報、自願供款、退休後收入', 'Detailed mode also asks about pay rises, MPF returns, voluntary contributions and retirement income'),
    opts: [['quick', t('簡易（約 10 題，1 分鐘）', 'Quick (about 10 questions, 1 minute)')], ['detailed', t('詳細（多 5 題，計得更貼近你）', 'Detailed (5 more questions, closer to your situation)')]] },
  { key: 'age', q: t('你今年幾多歲？', 'How old are you?'), type: 'number', min: 18, max: 70, def: () => 30 },
  { key: 'retireAge', q: t('你想幾多歲退休？', 'At what age do you want to retire?'), type: 'number', min: 40, max: 80, def: () => R.defaultRetireAge,
    check: (v, a) => (v <= a.age ? t('退休年齡要大過而家年齡', 'Retirement age must be above your current age') : '') },
  { key: 'monthlySpend', q: t('退休後每個月想用幾多錢？（按今日物價）', 'How much a month do you want to spend in retirement? (Today’s prices)'),
    help: t('例如今日 $15,000 嘅生活水平；之後會自動加通脹。醫療開支下一題另外計', 'e.g. a $15,000 lifestyle today; inflation is added for you. Medical costs come in the next question'), type: 'money', min: 1, def: () => 15000 },
  { key: 'medicalYearly', q: t('退休後每年想另外預留幾多醫療開支？（按今日物價）', 'How much a year do you want to set aside for medical costs in retirement? (Today’s prices)'),
    help: t(`例如醫保保費、睇醫生、自付部分。醫療開支一般升得快過物價，所以另外用醫療通脹計（預設每年 ${pctTxt(R.medInflation)}，結果頁可以改）`, `e.g. medical insurance premiums, doctor visits, out-of-pocket costs. Medical costs usually rise faster than prices, so they use a separate medical inflation rate (${pctTxt(R.medInflation)} a year by default; change it on the results page)`),
    type: 'money', min: 0, optional: true, skipLabel: t('唔另計（已包含喺上面每月開支）', 'Don’t count separately (already in monthly spending)') },
  { key: 'mpfBalance', q: t('你而家強積金結餘大約幾多？', 'Roughly how much is in your MPF now?'), help: t('睇 eMPF 平台或者周年權益報表', 'Check the eMPF platform or your annual benefit statement'), type: 'money', min: 0, optional: true, skipLabel: t('唔知，當 $0', 'Not sure, count as $0') },
  { key: 'mpfMode', q: t('你每月強積金供款（你＋僱主）係幾多？', 'What are your monthly MPF contributions (you + employer)?'), type: 'options',
    opts: [['know', t('我知道，自己輸入', 'I know, let me enter it')], ['salary', t('唔知，用月薪幫我計（5%＋5%）', 'Not sure, work it out from my salary (5% + 5%)')], ['none', t('冇供（例如自僱冇供／退休咗）', 'None (e.g. not contributing)')]] },
  { key: 'mpfMonthly', when: a => a.mpfMode === 'know', q: t('每月強積金供款合共（你＋僱主）', 'Total monthly MPF contributions (you + employer)'), type: 'money', min: 0, def: () => 3000 },
  { key: 'salary', when: a => a.mpfMode === 'salary', q: t('你嘅月薪（有關入息）大約幾多？', 'What is your monthly salary (relevant income)?'),
    help: t(`按法定：月入 ${money(MPF.minIncome)} 以下僱員唔使供；${money(MPF.maxIncome)} 以上按上限計`, `By law: employees earning under ${money(MPF.minIncome)} don’t contribute; above ${money(MPF.maxIncome)} the cap applies`), type: 'money', min: 0, def: () => 25000 },
  { key: 'tvc', when: detailed, q: t('你每月有冇額外自願性供款（例如可扣稅自願性供款 TVC）？', 'Do you make extra voluntary MPF contributions each month (e.g. tax-deductible TVC)?'),
    help: t('放喺強積金入面、跟強積金回報計', 'Counted inside MPF, at the MPF return'), type: 'money', min: 0, optional: true, skipLabel: t('冇', 'None') },
  { key: 'otherAssets', q: t('除咗強積金，你有幾多儲蓄或投資留俾退休用？', 'Apart from MPF, how much savings or investments are set aside for retirement?'), type: 'money', min: 0, optional: true, skipLabel: t('冇／跳過', 'None / skip') },
  { key: 'extraMonthly', q: t('你而家每個月另外儲幾多俾退休？', 'How much extra do you save each month for retirement now?'), type: 'money', min: 0, optional: true, skipLabel: t('冇／跳過', 'None / skip') },
  { key: 'growth', when: detailed, q: t('你預計人工同每月儲蓄每年加幾多？', 'How much do you expect your pay and monthly saving to grow each year?'),
    help: t('會用嚟加強積金供款（有上限）同每月儲蓄；唔肯定揀 0%', 'Used to grow MPF contributions (within the cap) and monthly saving; pick 0% if unsure'), type: 'options',
    opts: R.growthOptions.map(v => [String(v), v ? t(`每年 ${pctTxt(v)}`, `${pctTxt(v)} a year`) : t('唔加（0%）', 'No growth (0%)')]) },
  { key: 'ret', q: t('你預計退休前嘅每年回報率？', 'What yearly return do you expect before retirement?'),
    help: a => (detailed(a) ? t('呢個係強積金以外嘅儲蓄／投資；強積金下一題另外揀。回報率係假設，並非保證', 'This is for savings and investments outside MPF; MPF is next. Returns are assumptions, not guarantees') : t('回報率係假設，並非保證', 'Returns are assumptions, not guarantees')),
    type: 'options', opts: retOpts() },
  { key: 'mpfRet', when: a => detailed(a) && (a.mpfMode !== 'none' || a.mpfBalance || a.tvc), q: t('強積金預計每年回報率？', 'What yearly return do you expect on your MPF?'),
    help: t('睇吓你揀嘅強積金基金類別；回報率係假設，並非保證', 'Think about the MPF funds you hold; returns are assumptions, not guarantees'), type: 'options',
    opts: [['same', t('同上一題一樣', 'Same as the last answer')], ...retOpts()] },
  { key: 'postIncome', when: detailed, q: t('退休後每個月仲會有幾多收入？（按今日幣值）', 'How much monthly income will you still have in retirement? (Today’s money)'),
    help: t('例如長俸、租金、兼職、年金；假設跟通脹加', 'e.g. pension, rent, part-time work, annuity; assumed to rise with inflation'), type: 'money', min: 0, optional: true, skipLabel: t('冇', 'None') },
  { key: 'lumpAtRetire', when: detailed, q: t('退休嗰時會唔會一筆過收到錢？', 'Will you receive a lump sum when you retire?'),
    help: t('例如約滿酬金、長俸一筆過、儲蓄保單到期；填退休嗰時嘅金額', 'e.g. gratuity, pension lump sum, a maturing savings policy; enter the amount at that time'), type: 'money', min: 0, optional: true, skipLabel: t('冇', 'None') },
];

const BANDS = [
  [20, 29, t('20–29 歲', '20s'), t('時間係你最大優勢：先建立備用金，強積金揀適合嘅基金，每月定額儲少少都會滾大。', 'Time is your biggest edge: build an emergency fund, pick suitable MPF funds, and small regular savings compound.')],
  [30, 39, t('30–39 歲', '30s'), t('開支最多嘅年紀：保障同儲蓄要平衡，加人工時順手提高儲蓄比例。', 'Peak spending years: balance protection and saving, and raise your savings rate with each pay rise.')],
  [40, 49, t('40–49 歲', '40s'), t('缺口要認真處理：檢查強積金表現，考慮扣稅嘅自願供款（TVC）同年金。', 'Time to close the gap: review MPF performance and consider tax-deductible TVC and annuities.')],
  [50, 99, t('50 歲或以上', '50+'), t('準備由「儲」轉「用」：諗清楚退休後穩定現金流同醫療開支，降低大起大跌嘅風險。', 'Shift from saving to spending: plan steady income and medical costs, and reduce big swings.')],
];

const yFmt = v => (v === 0 ? '$0' : v >= 1e6 ? `$${+(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1000)}k`);
const ageTxt = x => (x == null ? t('110 歲以上', 'beyond 110') : t(`${x} 歲`, `age ${x}`));

function result(a, api) {
  const s = {
    age: a.age, retireAge: a.retireAge, monthlySpend: a.monthlySpend, medicalYearly: a.medicalYearly || 0,
    mpfBalance: a.mpfBalance || 0, otherAssets: a.otherAssets || 0, extraMonthly: a.extraMonthly || 0,
    mpfMonthly: a.mpfMode === 'know' ? a.mpfMonthly || 0 : a.mpfMode === 'salary' ? mpfMonthly(a.salary || 0, MPF) : 0,
    ret: R.returns[a.ret] ?? R.returns[R.defaultReturn], inflation: R.inflation, endAge: R.endAge, postReturn: R.postReturn, medInflation: R.medInflation,
  };
  if (detailed(a)) {
    Object.assign(s, { growth: Number(a.growth) || 0, tvc: a.tvc || 0, postIncome: a.postIncome || 0, lumpAtRetire: a.lumpAtRetire || 0 });
    if (a.mpfMode === 'salary') Object.assign(s, { salary: a.salary || 0, mpf: MPF });
    if (a.mpfRet && a.mpfRet !== 'same') s.mpfRet = R.returns[a.mpfRet];
  }
  const mix = { delay: 0, cut: 0, add: 0, bump: 0 };
  const sel = (id, opts, cur) => `<select id="${id}" class="field-select">${opts.map(([v, l]) => `<option value="${v}" ${v == cur ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const range = (id, label, min, max, step, val) => `<label class="field"><span>${label}：<b id="${id}-v"></b></span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></label>`;
  const sub = (label, val) => `<div class="report-row" style="font-size:14px"><span>　${label}</span><span>${val}</span></div>`;

  const draw = () => {
    const r = retirePlan(s);
    const L = gapLevers(s);
    const pctReady = Math.min(100, Math.round(r.ratio * 100));
    const readyTxt = r.gap <= 0 ? t('已經夠', 'On track') : pctReady >= 50 ? t('過半', 'Over halfway') : t('未夠一半', 'Under halfway');
    const bandIdx = BANDS.findIndex(b => s.age >= b[0] && s.age <= b[1]);
    const lastsOk = r.runOut == null || r.runOut >= s.endAge;
    const np = r.needParts, showParts = np.med > 0 || np.inc > 0;
    const addMax = Math.max(5000, Math.ceil(((r.perMonth || 0) * 1.5) / 1000) * 1000);
    const delayMax = Math.max(0, Math.min(10, s.endAge - s.retireAge - 1));
    mix.delay = Math.min(mix.delay, delayMax); mix.add = Math.min(mix.add, addMax);
    box.innerHTML = `
      <div class="stack">
        <div>
          <div class="q-step">${t('退休準備', 'Retirement readiness')}${detailed(a) ? t('（詳細模式）', ' (detailed)') : ''}</div>
          <div class="big-result">${readyTxt}・${pctReady}%</div>
          <div class="progress" aria-hidden="true" style="height:12px;margin-top:8px"><i style="width:${pctReady}%;background:var(--matcha)"></i></div>
        </div>
        <p class="callout ${lastsOk ? 'green' : ''}">
          <b>${t('你嘅錢預計用到：', 'Your money is expected to last to: ')}${ageTxt(r.runOut)}</b><br>
          ${lastsOk ? t(`夠用到你計劃嘅 ${s.endAge} 歲。`, `That covers your plan to age ${s.endAge}.`) : t(`比你計劃嘅 ${s.endAge} 歲早 ${s.endAge - r.runOut} 年用完。`, `That is ${s.endAge - r.runOut} years short of your plan to age ${s.endAge}.`)}
        </p>
        <div>
          <div class="report-row"><span>${t(`${s.retireAge} 歲退休時需要（用到 ${s.endAge} 歲）`, `Needed at ${s.retireAge} (to age ${s.endAge})`)}</span><b>${money(r.need)}</b></div>
          ${showParts ? sub(t('生活開支', 'Living costs'), money(np.spend)) : ''}
          ${np.med > 0 ? sub(t(`醫療開支（醫療通脹 ${pctTxt(s.medInflation)}）`, `Medical costs (medical inflation ${pctTxt(s.medInflation)})`), money(np.med)) : ''}
          ${np.inc > 0 ? sub(t('減：退休後其他收入', 'Less: other retirement income'), `−${money(np.inc)}`) : ''}
          <div class="report-row"><span>${t('預計到時累積', 'Expected savings by then')}${s.lumpAtRetire ? t('（包括一筆過）', ' (incl. lump sum)') : ''}</span><b>${money(r.acc)}</b></div>
          <div class="report-row"><span>${t('缺口', 'Gap')}</span><b>${money(r.gap)}</b></div>
          <p class="muted" style="font-size:14px">${t(`相當於今日幣值：需要 ${money(r.needToday)}、預計累積 ${money(r.accToday)}（通脹 ${pctTxt(s.inflation)}）。`, `In today’s money: need ${money(r.needToday)}, expected ${money(r.accToday)} (inflation ${pctTxt(s.inflation)}).`)}</p>
        </div>
        <div>
          <h3>${t('一生嘅結餘：儲到幾多、用到幾時', 'Your balance over a lifetime: how much you build, how long it lasts')}</h3>
          <div id="rt-chart"></div>
          <p class="muted" style="font-size:13px">${t('退休前：儲蓄同強積金累積；退休後：每年年頭攞錢用，剩低嘅繼續按退休後回報滾。', 'Before retiring, savings and MPF build up. After, money is taken out at the start of each year and the rest keeps earning the after-retirement return.')}</p>
        </div>
        ${r.gap > 0 ? `<div>
          <h3>${t('四個補缺口方法（每個單獨做就夠）', 'Four ways to close the gap (each one alone is enough)')}</h3>
          <div class="stat-row">
            <div class="stat"><span>${t('每月額外儲', 'Save extra each month')}</span><b>${money(r.perMonth)}</b></div>
            <div class="stat"><span>${t('延遲退休到', 'Retire later, at')}</span><b>${L.laterAge ? t(`${L.laterAge} 歲`, `${L.laterAge}`) : t('遲 15 年都未夠', 'Not enough even 15 years later')}</b></div>
            <div class="stat"><span>${t('每月開支減到（今日物價）', 'Cut monthly spending to (today’s prices)')}</span><b>${L.spendTo ? money(L.spendTo) : t('減到 $0 都未夠', 'Not enough even at $0')}</b></div>
            <div class="stat"><span>${t('退休前回報要達到每年', 'Pre-retirement return needed')}</span><b>${L.retTo == null ? t('高到唔實際', 'Unrealistically high') : pctTxt(L.retTo)}</b></div>
          </div>
          <p class="muted" style="font-size:13px">${t('追高回報即係承受更大風險，唔建議單靠呢個方法。', 'Chasing higher returns means taking more risk; relying on that alone is not advisable.')}</p>
          <div class="stat-row" style="margin-top:10px">
            <div class="stat"><span>${t('如果早 5 年開始，每月要儲', 'Had you started 5 years earlier, monthly')}</span><b>${money(r.earlier5)}</b></div>
            <div class="stat"><span>${t('如果遲 5 年先開始，每月要儲', 'If you start 5 years later, monthly')}</span><b>${r.later5 == null ? t('嚟唔切', 'Too late') : money(r.later5)}</b></div>
          </div>
        </div>` : `<p class="callout green">${t('按你嘅假設，預計累積已經夠退休所需。', 'On your assumptions, your savings cover what you need.')}</p>`}
        <div>
          <h3>${t('自己試吓：幾個方法一齊用', 'Try it: combine the methods')}</h3>
          ${delayMax ? range('mx-delay', t('遲幾年退休', 'Retire later by'), 0, delayMax, 1, mix.delay) : ''}
          ${range('mx-cut', t('每月開支減少', 'Cut monthly spending by'), 0, 40, 5, mix.cut * 100)}
          ${range('mx-add', t('每月多儲', 'Save extra each month'), 0, addMax, 500, mix.add)}
          ${range('mx-bump', t('回報提高', 'Raise return by'), 0, 3, 0.5, mix.bump * 100)}
          <div class="stat-row" style="margin-top:8px">
            <div class="stat"><span>${t('退休準備', 'Readiness')}</span><b id="mx-ready"></b></div>
            <div class="stat"><span>${t('錢用到', 'Money lasts to')}</span><b id="mx-last"></b></div>
          </div>
        </div>
        <div>
          <h3>${t('改假設（即時重計）', 'Change assumptions (instant)')}</h3>
          <div class="who-grid">
            <label class="field"><span>${detailed(a) ? t('退休前回報（強積金以外）', 'Return before retiring (non-MPF)') : t('退休前回報', 'Return before retiring')}</span>${sel('rt-ret', Object.values(R.returns).map(v => [v, pctTxt(v)]), s.ret)}</label>
            <label class="field"><span>${t('通脹', 'Inflation')}</span>${sel('rt-inf', [0.015, 0.02, 0.025, 0.03, 0.035].map(v => [v, pctTxt(v)]), s.inflation)}</label>
            ${s.medicalYearly ? `<label class="field"><span>${t('醫療通脹', 'Medical inflation')}</span>${sel('rt-med', R.medInflationOptions.map(v => [v, pctTxt(v)]), s.medInflation)}</label>` : ''}
            <label class="field"><span>${t('退休後回報', 'Return after retiring')}</span>${sel('rt-post', [0, 0.02, 0.03, 0.04].map(v => [v, pctTxt(v)]), s.postReturn)}</label>
            <label class="field"><span>${t('計到幾多歲', 'Plan to age')}</span>${sel('rt-end', R.endAgeOptions.map(v => [v, t(`${v} 歲`, `${v}`)]), s.endAge)}</label>
          </div>
          <p class="muted" style="font-size:13px">${t(
            `計法：退休後每年年頭提款，生活開支跟通脹加${s.medicalYearly ? '、醫療開支跟醫療通脹加（預設 9%，跟顧問公司對香港短期醫療成本嘅預測；長遠升幅無人知，可以改低）' : ''}；供款按月計；強積金每月 ${money(s.mpfMonthly)}${a.mpfMode === 'salary' ? '（按月薪計）' : ''}${detailed(a) ? `；人工同儲蓄每年加 ${pctTxt(s.growth)}（強積金供款按法定上限，上限唔假設會加）${s.mpfRet != null ? `；強積金回報 ${pctTxt(s.mpfRet)}` : ''}` : '；簡易模式唔假設人工同供款增長'}。回報率為假設，並非保證。`,
            `Method: withdrawals at the start of each retirement year; living costs rise with inflation${s.medicalYearly ? ', medical costs with medical inflation (9% by default, in line with consultancies’ short-term forecasts for Hong Kong medical costs; the long run is unknown, so you can lower it)' : ''}; contributions monthly; MPF ${money(s.mpfMonthly)} a month${a.mpfMode === 'salary' ? ' (from salary)' : ''}${detailed(a) ? `; pay and saving grow ${pctTxt(s.growth)} a year (MPF within the statutory cap, which is not assumed to rise)${s.mpfRet != null ? `; MPF return ${pctTxt(s.mpfRet)}` : ''}` : '; quick mode assumes no pay or contribution growth'}. Returns are assumptions, not guarantees.`)}</p>
          ${detailed(a) ? '' : `<button type="button" class="btn secondary" data-detailed>${t('想計得仔細啲？轉詳細模式 →', 'Want more detail? Switch to detailed mode →')}</button>`}
        </div>
        <div>
          <h3>${t('唔同年紀嘅一般方向', 'General direction by age')}</h3>
          <div class="age-bands">${BANDS.map((b, k) => `<div class="${k === bandIdx ? 'on' : ''}"><b>${b[2]}</b>${b[3]}</div>`).join('')}</div>
        </div>
        <div class="q-nav"><button type="button" class="btn secondary" data-edit>${t('← 改答案', '← Change answers')}</button>
          <button type="button" class="btn secondary" data-restart>${t('重新答過', 'Start over')}</button></div>
      </div>`;

    // 一生結餘圖：而家計劃、（有缺口）每月多儲之後、目標歲數
    const xMax = Math.max(s.endAge + 3, (r.runOut || 0) + 1);
    const clip = pts => pts.filter(pt => pt[0] <= xMax);
    const series = [{ name: t('按而家計劃', 'Current plan'), color: COLORS[0], points: clip(r.lifeCurve) }];
    if (r.gap > 0) series.push({ name: t(`每月多儲 ${money(r.perMonth)}`, `Saving ${money(r.perMonth)} more a month`), color: COLORS[2], points: clip(retirePlan(applyLevers(s, { add: r.perMonth })).lifeCurve) });
    const top = Math.max(...series.flatMap(x => x.points.map(pt => pt[1])));
    series.push({ name: t(`目標：用到 ${s.endAge} 歲`, `Goal: to age ${s.endAge}`), color: COLORS[3], points: [[s.endAge, 0], [s.endAge, top]] });
    lineChart(box.querySelector('#rt-chart'), { series, dashed: [series.length - 1], yFmt, xFmt: v => v, xLabel: t('歲', 'Age') });

    // 自己試：拉桿即時重計（唔重畫成頁）
    const $ = id => box.querySelector(id);
    const mixDraw = () => {
      const m = retirePlan(applyLevers(s, mix));
      if ($('#mx-delay-v')) $('#mx-delay-v').textContent = t(`${mix.delay} 年（${s.retireAge + mix.delay} 歲退休）`, `${mix.delay} yrs (retire at ${s.retireAge + mix.delay})`);
      $('#mx-cut-v').textContent = t(`${Math.round(mix.cut * 100)}%（${money(s.monthlySpend * (1 - mix.cut))}）`, `${Math.round(mix.cut * 100)}% (${money(s.monthlySpend * (1 - mix.cut))})`);
      $('#mx-add-v').textContent = money(mix.add);
      $('#mx-bump-v').textContent = `+${+(mix.bump * 100).toFixed(1)}%`;
      $('#mx-ready').textContent = `${Math.min(100, Math.round(m.ratio * 100))}%`;
      $('#mx-last').textContent = ageTxt(m.runOut);
    };
    const onR = (id, k, f) => $(id)?.addEventListener('input', e => { mix[k] = f(Number(e.target.value)); mixDraw(); });
    onR('#mx-delay', 'delay', v => v); onR('#mx-cut', 'cut', v => v / 100); onR('#mx-add', 'add', v => v); onR('#mx-bump', 'bump', v => v / 100);
    mixDraw();

    const on = (id, k) => $(id)?.addEventListener('change', e => { s[k] = Number(e.target.value); draw(); });
    on('#rt-ret', 'ret'); on('#rt-inf', 'inflation'); on('#rt-med', 'medInflation'); on('#rt-post', 'postReturn'); on('#rt-end', 'endAge');
    $('[data-edit]').addEventListener('click', api.edit);
    $('[data-restart]').addEventListener('click', api.restart);
    $('[data-detailed]')?.addEventListener('click', () => wizard(box, Q, result, { ...a, mode: 'detailed' }, true));
  };
  draw();
}

wizard(box, Q, result);
