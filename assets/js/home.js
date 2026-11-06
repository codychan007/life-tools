// ============================================================
// 首頁「唔知由邊度開始？」：3 條問題 → 推薦先用邊個工具
// 規則（改呢度就得）：
//   擔心醫療 + 冇自己買醫保／唔肯定 → 醫療儲備規劃（先睇缺口）
//   擔心醫療 + 已經有                → 醫療及危疾比較
//   擔心退休 → 退休規劃；擔心交稅 → 姊妹網站「理財資訊通」嘅慳稅規劃（2026-11 搬咗過去）
//   唔知 → 20 幾歲：醫療儲備；30 幾歲：醫療及危疾比較；40 歲或以上：退休
// 答案只喺你部機，唔會儲存或上傳。
// ============================================================
import { mountLayout } from './layout.js';
import { t, P } from './i18n.js';

mountLayout();

const TOOLS = {
  compare: {
    url: '/compare/', seal: '比', name: t('醫療及危疾比較', 'Medical & CI compare'),
    why: t('你已經有醫保，下一步係睇清楚唔同計劃嘅保費、限額同條款，同埋保費隨年紀點升。',
      'You already have medical cover. Next, see how plans differ on premiums, limits and terms, and how premiums rise with age.'),
  },
  reserve: {
    url: '/reserve/', seal: '備', name: t('醫療儲備規劃', 'Medical safety net'),
    why: t('只靠公司醫保，轉工嗰陣其實係冇保障㗎。先用 10 條問題睇清楚自己有幾大缺口。',
      'If you only rely on work cover, you have none between jobs. Ten quick questions show how big your gap is.'),
  },
  retire: {
    url: '/retire/', seal: '退', name: t('退休規劃', 'Retirement planner'),
    why: t('退休要幾多錢、強積金夠唔夠、每月要額外儲幾多，計一次就清楚。',
      'How much you need to retire, whether your MPF is enough and how much extra to save each month, worked out in one go.'),
  },
  tax: {
    url: 'https://codychan813.pages.dev' + P + '/tax/', ext: true, seal: '稅', name: t('慳稅規劃（姊妹網站：理財資訊通）', 'Tax saver (sister site: HK Money Compass)'),
    why: t('自願醫保、QDAP、TVC 呢「扣稅三寶」你用盡未？計下今年可以慳幾多。',
      'Have you used up the three big deductions: VHIS, QDAP and TVC? See how much tax you could save.'),
  },
};

export function recommend({ age, worry, own }) {
  if (worry === 'medical') return own === 'yes' ? 'compare' : 'reserve';
  if (worry === 'retire') return 'retire';
  if (worry === 'tax') return 'tax';
  return age === '20' ? 'reserve' : age === '30' ? 'compare' : 'retire';
}

const box = document.getElementById('quiz');
if (box) {
  const Q = [
    { key: 'age', q: t('你幾多歲？', 'How old are you?'),
      opts: [['20', t('20–29 歲', '20–29')], ['30', t('30–39 歲', '30–39')], ['40', t('40–49 歲', '40–49')], ['50', t('50 歲或以上', '50+')]] },
    { key: 'worry', q: t('你而家最擔心邊樣？', 'What worries you most right now?'),
      opts: [['medical', t('睇醫生、入院', 'Medical bills')], ['retire', t('退休唔夠錢', 'Retirement money')],
        ['tax', t('交稅交得多', 'Paying too much tax')], ['unsure', t('唔知，都有啲', 'Not sure, a bit of all')]] },
    { key: 'own', q: t('你有冇自己買醫療保險？（公司嗰份唔計）', 'Do you have your own medical insurance? (Work cover doesn’t count)'),
      opts: [['yes', t('有', 'Yes')], ['no', t('冇', 'No')], ['unsure', t('唔肯定', 'Not sure')]] },
  ];
  const ans = {};
  let i = 0;

  const render = () => {
    if (i >= Q.length) return showResult();
    const q = Q[i];
    box.innerHTML = `
      <div class="q-step">${t(`第 ${i + 1} / ${Q.length} 題`, `Question ${i + 1} of ${Q.length}`)}</div>
      <div class="progress" aria-hidden="true"><i style="width:${(i / Q.length) * 100}%"></i></div>
      <h3 style="margin-top:14px">${q.q}</h3>
      <div class="options">${q.opts.map(([v, l]) =>
        `<button type="button" class="option" data-v="${v}" aria-pressed="${ans[q.key] === v}">${l}</button>`).join('')}</div>
      ${i > 0 ? `<div class="q-nav"><button type="button" class="btn secondary" data-back>${t('← 返回上一題', '← Back')}</button></div>` : ''}`;
    box.querySelectorAll('.option').forEach(b => b.addEventListener('click', () => { ans[q.key] = b.dataset.v; i++; render(); }));
    box.querySelector('[data-back]')?.addEventListener('click', () => { i--; render(); });
  };

  const showResult = () => {
    const key = recommend(ans);
    const T = TOOLS[key];
    const others = Object.keys(TOOLS).filter(k => k !== key);
    box.innerHTML = `
      <div class="result">
        <div class="q-step">${t('建議你先用', 'Start with')}</div>
        <div style="display:flex;gap:12px;align-items:center"><span class="seal sm" aria-hidden="true">${T.seal}</span><h3 style="margin:0">${T.name}</h3></div>
        <p style="margin-top:10px">${T.why}</p>
        <a class="btn shu block" href="${T.ext ? T.url : P + T.url}"${T.ext ? ' target="_blank" rel="noopener"' : ''}>${t('去試吓 →', 'Try it →')}</a>
        <p class="muted" style="font-size:14px;margin:14px 0 0">${t('之後可以再睇：', 'Then try: ')}${others.filter(k => !TOOLS[k].ext).map(k => `<a href="${P}${TOOLS[k].url}">${TOOLS[k].name}</a>`).join(t('、', ', '))}</p>
        <div class="q-nav"><button type="button" class="btn secondary" data-back>${t('← 改答案', '← Change answers')}</button>
        <button type="button" class="btn secondary" data-restart>${t('重新答過', 'Start over')}</button></div>
      </div>`;
    box.querySelector('[data-back]').addEventListener('click', () => { i = Q.length - 1; render(); });
    box.querySelector('[data-restart]').addEventListener('click', () => { for (const k in ans) delete ans[k]; i = 0; render(); });
  };
  render();
}
