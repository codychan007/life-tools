# ✅ 已完成（2026-11-06）：網站改名「保障資訊通」並正式公開，互換完成，保障資訊兩個雲端任務已轉去 life-tools。以下保留做紀錄。

# 上線當日：人生規劃通 ⇄ 理財資訊通 互換清單

2026-11-06 Cody 決定：「慳稅規劃」搬去理財資訊通；「保障資訊」搬嚟人生規劃通（實用資訊欄入面獨立一頁）。
本機兩邊已經準備好，**要等人生規劃通公開當日先一齊切換**，咁兩邊都唔會有空窗期。

## 已經做好（本機，未 commit／未上網）
- 人生規劃通：`/insurance/`（中英）、`data/insurance.json`、`assets/js/insurance.js`、`scripts/validate_insurance.py`、兩份自動更新指示（`scripts/insurance-*-prompt.md`）；目錄改做「實用資訊欄」下拉；拎走 `/tax/`，`_redirects` 轉去理財資訊通 `/tax/`；首頁問答「交稅」→ 姊妹網站慳稅規劃。
- 理財資訊通（`site/`，**2026-11-06 已上載 8174b27**，`/tax/` 隱藏中）：課稅年度清單 `data/tax/index.json`、`scripts/validate_tax.py`、每年稅務更新雲端任務 `trig_01J4Q58RReDg1WgJG68ADPjN`（3 月 1 日草擬／6 月 1 日核實，推 branch 等 Cody Merge）；`/tax/`（中英）、`assets/js/tax.js`、`assets/js/wizard.js`、`assets/js/calc/tax.js`、`data/tax/*.json`、CSS、`tests/verify.html` 加 7 項慳稅驗算；`/tax/` 暫時喺 `NOINDEX`、冇放入目錄。

## 公開當日要做（按次序）
1. **人生規劃通**：開 GitHub repo＋Cloudflare Pages 項目（Cody 自己登入），合規批准後 `build.py` 改 `PREVIEW = False`。
2. **抄最新保障資訊**：將 `site/data/insurance.json`（雲端定時任務一直喺 money-tools 更新緊）覆蓋去 `life-site/data/insurance.json`，再跑 `python scripts/validate_insurance.py`。
3. **改兩個雲端定時任務**（RemoteTrigger）：
   - `trig_01HLpACzLS54x4Mk9TvwA9qP`「money-tools 醫療政策每月更新」
   - `trig_019Ayq8DrUG6CBMRGynH7dAF`「money-tools 保障數據每半年更新」
   把 `sources` 嘅 repo 由 `codychan007/money-tools` 改做人生規劃通新 repo；prompt 第一句改做 "You are maintaining HK Life Compass (人生規劃通) in this repository (…新 repo…)"；名改「人生規劃通 …」。其餘步驟（讀 `scripts/insurance-*-prompt.md`、validate、pull --rebase 再 push）唔使改。
4. **理財資訊通**（`site/`）：
   - `scripts/build.py`：`NOINDEX` 拎走 `"/tax/"`；`NAV_GROUP` 同 `FOOTER_LINKS` 拎走 `/insurance/`、加入 `/tax/`（慳稅規劃）；`PAGE_OG` 拎走 `/insurance/`；`build_insurance` 相關程式可以刪。
   - 刪 `insurance/`、`en/insurance/`、`assets/js/insurance.js`、`data/insurance.json`、`scripts/validate_insurance.py`、`scripts/insurance-*-prompt.md`；`.github/workflows/check-deals.yml` 拎走 `validate_insurance.py` 同 `data/insurance.json` 路徑。
   - 加 `_redirects`：`/insurance/ → https://（人生規劃通網址）/insurance/ 301`、`/en/insurance/ → …/en/insurance/ 301`。
   - 首頁／理財體檢有連去 `/insurance/` 嘅地方改連人生規劃通；`如何更新內容.md` 第 3 節改寫。
   - `health.js` 等如有引用 `insurance.json`（醫療通脹預設值）要改，先 `grep -rn insurance` 確認。
5. 兩邊都 build、驗算（理財資訊通 `/tests/verify.html`、人生規劃通 `/tests/verify.html`），375px 手機檢查，再 push。

## 已設立嘅雲端定時任務（2026-11-06）
- `trig_01J4Q58RReDg1WgJG68ADPjN` money-tools 稅務數字每年更新（3/1、6/1 10:00 HKT）
- `trig_01FpweaXdeDmHpdcqRbNKaXi` life-tools 每月產品及強積金檢查（每月 2 號 11:00 HKT，只推 branch）
- 保障資訊兩個（`trig_01HLpACzLS54x4Mk9TvwA9qP`、`trig_019Ayq8DrUG6CBMRGynH7dAF`）仲係 money-tools，公開當日照上面第 3 步改。
