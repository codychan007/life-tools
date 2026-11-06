# 每月醫療政策更新：自動程序指示

> 每月 1 號早上 10:00（香港時間）由 Claude 定時任務執行。人手更新都可以照住做。

## 目標

更新 `data/insurance.json` 入面 `policy` 部分，令「政府醫療政策：最近有咩新嘢？」只顯示**最近三個月**嘅香港政府醫療／保障相關政策消息，較舊嘅移入「過往政策更新」。

## 步驟

1. 讀取 `data/insurance.json` 嘅 `policy`（`items` 同 `archive`）。
2. 搜尋**上次更新至今**香港政府嘅醫療相關政策消息，例如：
   - 醫務衞生局、衞生署、醫管局嘅新聞公報（info.gov.hk）
   - 公營醫療收費、藥物名冊、撒瑪利亞基金、關愛基金醫療援助
   - 基層醫療、地區康健中心、長者醫療券、慢性病共同治理
   - 自願醫保計劃（VHIS）、私營醫療收費透明度、醫療相關立法
   - 施政報告、財政預算案入面嘅醫療措施
3. 只加入**已經正式公布**嘅政策或措施（唔好加入建議、傳聞、諮詢意見或議員提議）。每項必須喺政府或公營機構官方網頁核實，`sourceUrl` 要填官方連結。
4. 新項目格式：
   ```json
   { "date": "YYYY-MM-DD（公布日期）", "title": "簡短標題", "title_en": "Short title in English",
     "points": ["一句講一個重點，貼地繁體中文"], "points_en": ["The same point in plain English"],
     "source": "來源名稱", "source_en": "Source name in English", "sourceUrl": "https://官方連結" }
   ```
   每項 1–4 個重點，用打工仔睇得明嘅講法，唔好加評論或推銷字眼。
5. 整理：
   - `items`：只保留 `date` 喺今日之前三個月內嘅項目，新嘅放最前。
   - 超過三個月嘅項目移去 `archive` 最前面。
   - `archive` 最多保留 12 項，多出嘅（最舊嗰啲）直接刪走。
   - 如果某項政策已經被新政策取代或內容已過時，可以喺新項目講清楚，舊項目照樣移入 archive。
6. 更新 `policy.asOf` 為今日，`policy.reviewBy` 為今日 + 40 日。
7. 執行 `python3 scripts/validate_insurance.py`，必須見到 ✅ 先可以提交。
8. 只改 `data/insurance.json`。Commit 訊息：`chore: monthly policy update YYYY-MM-DD`。推送前先 `git pull --rebase origin main`（同一時間可能有其他自動任務推送），然後 `git push origin HEAD:main`；如果被拒絕，再 pull --rebase 重試最多 3 次，唔好 force push。

## 必須遵守

- **絕對唔可以編造**任何政策、數字或日期。核實唔到就唔好放。
- 冇新消息都照樣做第 5、6 步（將過期項目移入 archive、更新日期）。
- 唔好改動 `policy` 以外嘅內容。
- 完成後簡短匯報（繁體中文）：新增、移入過往、刪除咗邊幾項。

## 英文版（網站係中英雙語）

網站有英文版（`/en/`），英文內容直接由同一個 JSON 檔嘅 `*_en` 欄位生成。**每次新增或修改中文文字，都要同時寫好對應嘅英文欄位**，否則 `validate` 會失敗：

- 每項政策（`items` 同 `archive`）：`title_en`、`points_en`（同 `points` 一樣多句）、`source_en`
- 舊項目移入 `archive` 時，英文欄位一齊搬

英文寫法：
- 清楚、自然嘅英文，對象係喺香港生活嘅英文讀者；唔好逐字直譯。
- 數字、金額、日期、百分比必須同中文版**完全一致**。
- 政府部門、計劃名稱用官方英文名（例如 Hospital Authority、Inland Revenue Department、Voluntary Health Insurance Scheme (VHIS)、MPFA、HKMA）；銀行同信用卡用官方英文名。
- 如果來源有官方英文版網頁，可以加 `sourceUrl_en`（或 `url_en`），冇就唔使。
- 同樣唔可以有推銷字眼。
