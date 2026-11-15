"""
檢查自願醫保標準計劃官方保費（醫療儲備用）有冇出錯（GitHub 每次改動都會自動行；本機：python scripts/validate_data.py）

規則：官方標準計劃 JSON：日期、保費表長度 0–100 歲、至少 20 個計劃、條款連結係官方網站。
（靈活計劃、危疾嘅檢查 2026-11-15 隨醫療及危疾比較搬咗去顧問工具箱 advisor-tools/scripts/compare/validate_compare.py）
有錯會列晒出嚟，並以錯誤碼結束（GitHub 會顯示紅色 ❌）。
"""
import csv
import json
import re
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
BANNED = re.compile(r"最好|最抵|推介|首選|最佳|best|recommend", re.I)
errors, warns = [], []


def err(msg):
    errors.append(msg)


def text_of(obj):
    return json.dumps(obj, ensure_ascii=False)



def check_standard():
    f = ROOT / "data" / "medical" / "vhis-standard.json"
    D = json.loads(f.read_text(encoding="utf-8"))
    if not DATE.match(D.get("asOf") or ""):
        err("標準計劃：asOf 日期唔啱")
    if len(D["plans"]) < 20:
        err(f"標準計劃：只得 {len(D['plans'])} 個，可能轉換出錯")
    for p in D["plans"]:
        for s in p["schedules"]:
            if len(s["male"]) != 101 or len(s["female"]) != 101:
                err(f"標準計劃 {p['id']}：保費表長度唔係 0–100 歲")
        if not p["planDocUrl"]["zh"].startswith("https://www.vhis.gov.hk/"):
            err(f"標準計劃 {p['id']}：條款連結唔係官方網站")



for fn in (check_standard,):
    try:
        fn()
    except Exception as e:  # 格式錯到讀唔到
        err(f"{fn.__name__}：讀取失敗 {e!r}")

if warns:
    print(f"⚠️ 提示 {len(warns)} 項（例如：{warns[0]}）")
if errors:
    print("❌ 數據檢查唔通過：")
    for e in errors:
        print("  -", e)
    sys.exit(1)
print("✅ 數據檢查通過")
