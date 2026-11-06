// 預約頁：剔咗同意個人資料收集聲明先開放聯絡方式
import { mountLayout } from './layout.js';
import { SITE, waUrl, waUrlEn, telUrl } from './config.js';
import { EN } from './i18n.js';

mountLayout();
const $ = id => document.getElementById(id);
$('phone').textContent = SITE.phone;
const links = { cal: SITE.calendarUrl, wa: EN ? waUrlEn : waUrl, tel: telUrl };
$('agree').addEventListener('change', e => {
  const ok = e.target.checked;
  for (const [id, href] of Object.entries(links)) {
    $(id).classList.toggle('disabled', !ok);
    if (ok) $(id).href = href; else $(id).removeAttribute('href');
  }
  $('hint').classList.toggle('hidden', ok);
});
