# 每月強積金法定數字檢查：自動程序指示

> 每月 2 號早上 11:00（香港時間）由 Claude 雲端定時任務執行。人手檢查都可以照住做。
> 2026-11-15：醫療及危疾產品比較已經搬去 TC Team專屬AI工具箱（repo advisor-tools，指示喺嗰邊 `scripts/compare/monthly-check-prompt.md`），呢度唔再檢查產品。

## 目標

退休工具用嘅強積金法定數字**唔可以有錯**，所以呢個任務**只係偵測同草擬，唔會直接改網站**：
發現有變 → 喺匯報列清楚，需要嘅話推一條 branch 等 Cody 核實；**永遠唔好推 main**。

## 強積金法定數字

1. 開積金局「強制性供款」頁 https://www.mpfa.org.hk/en/mpf-system/mandatory-contributions/employees（同中文版）。
2. 同 `data/statutory.json` 嘅 `mpf.minIncome`（$7,100）、`mpf.maxIncome`（$30,000）、`mpf.rate`（5%）比較。
3. **只有已經立法生效（有生效日期）**先算改動；建議、諮詢唔算。有改動 → 喺 branch 改 `data/statutory.json`，`verifiedOn` 填今日，喺匯報寫明生效日期同官方連結。

## 提交

- 全部冇變 → 唔使提交，只匯報「冇變」。
- 有要改／草擬 → `git checkout -b monthly-check-YYYY-MM`，只改 `data/statutory.json`；執行 `python3 scripts/validate_data.py`（必須 ✅）同 `python3 scripts/build.py`；commit 訊息 `data: monthly check YYYY-MM`；`git push origin monthly-check-YYYY-MM`。**唔好推 main，唔好 force push。**
- 匯報附上 `https://github.com/codychan007/life-tools/compare/main...monthly-check-YYYY-MM`。

## 必須遵守

- **絕對唔可以編造**任何保費、條款、數字或日期；唔肯定就寫「需人手核實」。
- 唔好抓要登入或者 robots.txt 禁止嘅網頁。
- 唔好用「最好／最抵／推介」等字眼。
- 完成後用繁體中文（廣東話）簡短匯報，有咩變、邊啲要 Cody 核實、branch 連結。
