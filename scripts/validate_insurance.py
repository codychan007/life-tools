"""
檢查 data/insurance.json 格式。每次更新保障資訊後執行；有錯會列出並以非零狀態結束。

  python scripts/validate_insurance.py
"""
import json
import re
import sys
from pathlib import Path

PATH = Path(__file__).resolve().parent.parent / "data" / "insurance.json"
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
MAX_ARCHIVE = 12
CJK = re.compile(r"[\u3400-\u9fff]")


def main():
    errors = []
    try:
        raw = PATH.read_text(encoding="utf-8")
        d = json.loads(raw)
    except Exception as e:  # noqa: BLE001
        print(f"❌ JSON 格式錯誤：{e}")
        sys.exit(1)

    def need(obj, keys, where):
        for k in keys:
            if not obj.get(k):
                errors.append(f"{where}：缺少 {k}")

    def url_ok(u, where):
        if not str(u or "").startswith("https://"):
            errors.append(f"{where}：sourceUrl 必須係 https 連結")

    def review_ok(v, where):
        if not DATE.match(str(v or "")):
            errors.append(f"{where}：reviewBy 要係 YYYY-MM-DD")

    for sec in ["medicalInflation", "publicFees", "privateCosts", "cancer", "policy", "basics"]:
        if sec not in d:
            errors.append(f"缺少 {sec} 部分")

    mi = d.get("medicalInflation", {})
    for n, it in enumerate(mi.get("items", []), 1):
        w = f"醫療通脹第 {n} 項"
        need(it, ["label", "value", "source", "sourceUrl", "asOf"], w)
        url_ok(it.get("sourceUrl"), w)
        review_ok(it.get("reviewBy"), w)
    if not isinstance(mi.get("defaultRate"), (int, float)):
        errors.append("醫療通脹：defaultRate 要係數字")

    pf = d.get("publicFees", {})
    need(pf, ["title", "rows", "source", "sourceUrl", "asOf"], "公立醫院收費")
    url_ok(pf.get("sourceUrl"), "公立醫院收費")
    review_ok(pf.get("reviewBy"), "公立醫院收費")
    for n, r in enumerate(pf.get("rows", []), 1):
        if not (isinstance(r, list) and len(r) == 3):
            errors.append(f"公立醫院收費第 {n} 行：要係 [項目, 收費, 備註]")

    for n, it in enumerate(d.get("privateCosts", {}).get("highlights", []), 1):
        w = f"私家醫院第 {n} 項"
        need(it, ["label", "value", "source", "sourceUrl", "asOf"], w)
        url_ok(it.get("sourceUrl"), w)
        review_ok(it.get("reviewBy"), w)

    ca = d.get("cancer", {})
    need(ca, ["items", "source", "sourceUrl", "asOf"], "癌症")
    url_ok(ca.get("sourceUrl"), "癌症")
    review_ok(ca.get("reviewBy"), "癌症")
    for n, it in enumerate(ca.get("items", []), 1):
        need(it, ["label", "value"], f"癌症第 {n} 項")

    po = d.get("policy", {})
    review_ok(po.get("reviewBy"), "政策")
    if not DATE.match(str(po.get("asOf", ""))):
        errors.append("政策：asOf 要係 YYYY-MM-DD")
    for group in ["items", "archive"]:
        for n, it in enumerate(po.get(group, []), 1):
            w = f"政策 {group} 第 {n} 項"
            need(it, ["date", "title", "points", "source", "sourceUrl"], w)
            url_ok(it.get("sourceUrl"), w)
            if not DATE.match(str(it.get("date", ""))):
                errors.append(f"{w}：date 要係 YYYY-MM-DD")
    if len(po.get("archive", [])) > MAX_ARCHIVE:
        errors.append(f"政策 archive 最多 {MAX_ARCHIVE} 項，請刪走最舊嘅")

    # 英文版：每段文字都要有 *_en，而且唔可以有中文字
    def en(obj, keys, where):
        for k in keys:
            if obj.get(k) in (None, "", []):
                continue
            v = obj.get(f"{k}_en")
            if v in (None, "", []):
                errors.append(f"{where}：缺少英文 {k}_en")
            elif CJK.search(json.dumps(v, ensure_ascii=False)):
                errors.append(f"{where}：{k}_en 入面有中文字")
            elif isinstance(obj[k], list) and len(v) != len(obj[k]):
                errors.append(f"{where}：{k}_en 要同 {k} 一樣多項")

    en(mi, ["title", "note"], "醫療通脹")
    for n, it in enumerate(mi.get("items", []), 1):
        en(it, ["label", "source", "asOf"], f"醫療通脹第 {n} 項")
    en(pf, ["title", "intro", "rows", "source", "asOf"], "公立醫院收費")
    for n, sx in enumerate(pf.get("extraSources", []), 1):
        en(sx, ["name"], f"公立醫院收費另見第 {n} 項")
    pc = d.get("privateCosts", {})
    en(pc, ["title", "intro"], "私家醫院")
    for n, it in enumerate(pc.get("highlights", []), 1):
        en(it, ["label", "sub", "source", "asOf"], f"私家醫院第 {n} 項")
    for n, it in enumerate(pc.get("table", []), 1):
        en(it, ["procedure", "hospital"], f"私家醫院表格第 {n} 行")
    en(ca, ["title", "source", "asOf"], "癌症")
    for n, it in enumerate(ca.get("items", []), 1):
        en(it, ["label", "value", "sub"], f"癌症第 {n} 項")
    en(po, ["title"], "政策")
    for group in ["items", "archive"]:
        for n, it in enumerate(po.get(group, []), 1):
            en(it, ["title", "points", "source"], f"政策 {group} 第 {n} 項")
    b = d.get("basics", {})
    en(b, ["title", "tips", "source"], "基本保障")
    for n, it in enumerate(b.get("items", []), 1):
        en(it, ["name", "solves", "note"], f"基本保障第 {n} 項")

    visible = json.dumps({k: v for k, v in d.items() if not k.startswith("_")}, ensure_ascii=False)
    if "【" in visible or "示例" in visible or '"sample"' in visible:
        errors.append("唔可以有【】佔位、示例或 sample 數據")

    if errors:
        print("❌ 發現問題：")
        for e in errors:
            print("  -", e)
        sys.exit(1)
    print(f"✅ insurance.json 正常：政策 {len(po.get('items', []))} 項、過往 {len(po.get('archive', []))} 項")


if __name__ == "__main__":
    main()
