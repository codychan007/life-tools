// ============================================================
// 網站設定：品牌、聯絡方式。改呢度就會全站更新。
// （網站名稱、IG、姊妹網站亦要喺 scripts/build.py 頂部同步改）
// ============================================================
export const SITE = {
  name: '香港地一站式保障資訊通',
  shortName: '保障資訊通',
  nameEn: 'HK Protection Compass',
  byline: 'By Cody Chan',
  ig: 'codychan813',
  phone: '46254001',
  whatsapp: '85246254001',
  whatsappText: '你好 Cody，我喺保障資訊通網站見到，想預約免費傾談。',
  whatsappTextEn: 'Hi Cody, I found you on HK Protection Compass and would like to book a free chat.',
  calendarUrl: 'https://calendar.app.google/QXA112toHCRAD5qr9',   // 同理財資訊通同一條
  sisterName: '理財資訊通',
  sisterNameEn: 'HK Money Compass',
  sisterUrl: 'https://codychan813.pages.dev/',
};

export const igUrl = `https://www.instagram.com/${SITE.ig}/`;
export const waUrl = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(SITE.whatsappText)}`;
export const waUrlEn = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(SITE.whatsappTextEn)}`;
export const telUrl = `tel:+852${SITE.phone}`;
