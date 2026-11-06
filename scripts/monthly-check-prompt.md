# 每月產品及強積金檢查：自動程序指示

> 每月 2 號早上 11:00（香港時間）由 Claude 雲端定時任務執行（1 號已經有自願醫保標準計劃保費自動更新）。人手檢查都可以照住做。

## 目標

人生規劃通嘅醫療、危疾、強積金數字**唔可以有錯**，所以呢個任務**只係偵測同草擬，唔會直接改網站**：
發現有變 → 喺匯報列清楚，需要嘅話推一條 branch 等 Cody 核實；**永遠唔好推 main**。

## A. 自願醫保靈活計劃（醫療）

1. 下載官方清單 https://www.vhis.gov.hk/public/data/flexi-plans.json（公開、唔使登入）。
2. 同 `data/medical/plans.json` 比較（每個計劃 `certNo`；每個選項 `variants[].certNo` 同 `variants[].sourceUrl` 官方保費 PDF）。
   **注意**：網站**只收港元（HKD）選項**，美元／其他貨幣選項係刻意唔收，唔好當「新選項」報；另外 2026-11 有 13 個港元選項因為保費 PDF 版面讀唔到而冇收（Zurich 8、BOC Life 4、FWD 1），都唔使當新選項報，除非佢哋嘅保費 PDF 連結變咗。只報**港元**選項嘅變動：
   - 官方有、我哋冇嘅計劃或選項 → **新計劃／新選項**
   - 我哋有、官方冇 → **可能已停售**
   - 同一個選項，官方保費 PDF 連結（檔名／日期）唔同咗 → **保費可能已更新**
3. 唔好改 `data/medical/`；只喺匯報列出（計劃名、證書號碼、官方連結）。保費更新要用 `scripts/flexi/` 嘅流程人手處理，再由 Cody 對核實清單。

## B. 危疾計劃

1. **先睇每間保險公司嘅 robots.txt**：佢禁止嘅（例如宏利 `Disallow: /*.pdf$`）就**唔好下載**，只睇產品網頁（HTML）。每秒最多一個請求。
2. 對 `data/ci/plans.json` 每個計劃：開 `sourceUrl`（產品頁）同 `termsUrl`（小冊子）。
   - 打唔開（404）、產品頁冇咗、或者寫「已停售」→ **可能已停售／換咗新版**
   - 小冊子檔名或日期變咗 → **條款可能更新**（再對一次卡上嘅疾病數目、投保年齡、等候期、多次賠償，列出唔同嘅地方）
3. 對 `data/ci/_inventory.json` 每間公司：開佢嘅官方危疾產品列表頁，搵清單入面冇嘅**新危疾產品**。
4. 有新產品：可以喺 branch 草擬新項目（格式同 `data/ci/plans.json` 其他項目一樣），**`verified: false`**、`pricing: "quote"`（除非有官方保費表）、唔知嘅欄位寫 `null`、中文名由保險公司中文官網抄、`multiClaim` 文字要寫 `{"zh": …, "en": …}`。未核實嘅計劃正式網站唔會顯示。

## C. 強積金法定數字

1. 開積金局「強制性供款」頁 https://www.mpfa.org.hk/en/mpf-system/mandatory-contributions/employees（同中文版）。
2. 同 `data/statutory.json` 嘅 `mpf.minIncome`（$7,100）、`mpf.maxIncome`（$30,000）、`mpf.rate`（5%）比較。
3. **只有已經立法生效（有生效日期）**先算改動；建議、諮詢唔算。有改動 → 喺 branch 改 `data/statutory.json`，`verifiedOn` 填今日，喺匯報寫明生效日期同官方連結。

## 提交

- 全部冇變 → 唔使提交，只匯報「冇變」。
- 有要改／草擬 → `git checkout -b monthly-check-YYYY-MM`，只改 `data/ci/plans.json`（新草擬項目）、`data/ci/_inventory.json`（標 status）或 `data/statutory.json`；執行 `python3 scripts/validate_data.py`（必須 ✅）同 `python3 scripts/build.py`；commit 訊息 `data: monthly check YYYY-MM`；`git push origin monthly-check-YYYY-MM`。**唔好推 main，唔好 force push。**
- 匯報附上 `https://github.com/codychan007/life-tools/compare/main...monthly-check-YYYY-MM`。

## 必須遵守

- **絕對唔可以編造**任何保費、條款、數字或日期；唔肯定就寫「需人手核實」。
- 唔好抓要登入或者 robots.txt 禁止嘅網頁。
- 唔好用「最好／最抵／推介」等字眼。
- 完成後用繁體中文（廣東話）簡短匯報，分 A／B／C 三部分：有咩變、邊啲要 Cody 核實、branch 連結。
