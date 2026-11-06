"""
下載醫務衞生局「自願醫保標準計劃標準保費一覽表」官方 Excel，轉換成網站用嘅 data/medical/vhis-standard.json

  python scripts/fetch_vhis_standard.py                 # 由官方網站下載（GitHub Actions 每月 1 號自動執行）
  python scripts/fetch_vhis_standard.py --from DIR      # 用已下載嘅檔案（DIR 入面要有 male.xlsx、female.xlsx、standard-plans.json）

來源（全部公開、唔使登入）：
  - 保費：https://www.vhis.gov.hk/doc/en/information_centre/Standard_Plan_Premium_Summary_{Male,Female}.xlsx
  - 計劃名單（中英文名、認可編號、條款及保費表 PDF）：https://www.vhis.gov.hk/public/data/standard-plans.json
    （即「標準計劃名單」網頁 https://www.vhis.gov.hk/tc/consumer_corner/standard-plan.html 背後嘅資料）

只用 Python 標準庫。任何一步對唔上（例如保險公司配對唔到），程式會停低報錯，唔會寫入半套數據。
"""
import argparse
import datetime as dt
import html
import io
import json
import re
import sys
import urllib.request
import zipfile
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "medical" / "vhis-standard.json"
BASE = "https://www.vhis.gov.hk"
XLSX = {"male": f"{BASE}/doc/en/information_centre/Standard_Plan_Premium_Summary_Male.xlsx",
        "female": f"{BASE}/doc/en/information_centre/Standard_Plan_Premium_Summary_Female.xlsx"}
PLANS_JSON = f"{BASE}/public/data/standard-plans.json"
LIST_PAGE = {"zh": f"{BASE}/tc/consumer_corner/standard-plan.html", "en": f"{BASE}/en/consumer_corner/standard-plan.html"}
UA = "HK-Life-Compass-data-check/1.0 (monthly; public data only)"


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


# ------------------------------------------------------------------
# 讀 xlsx（標準庫：xlsx 其實係 zip + XML）
# ------------------------------------------------------------------
def col_index(letters):
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - 64
    return n - 1


def read_sheet(data):
    z = zipfile.ZipFile(io.BytesIO(data))
    ss = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in re.findall(r"<si>(.*?)</si>", z.read("xl/sharedStrings.xml").decode("utf-8"), re.S):
            ss.append(html.unescape("".join(re.findall(r"<t[^>]*>(.*?)</t>", si, re.S))))
    xml = z.read("xl/worksheets/sheet1.xml").decode("utf-8")
    grid = {}
    for rnum, body in re.findall(r'<row [^>]*?r="(\d+)"[^>]*>(.*?)</row>', xml, re.S):
        row = {}
        for ref, attrs, inner in re.findall(r'<c r="([A-Z]+)\d+"([^>]*?)(?:/>|>(.*?)</c>)', body, re.S):
            v = re.search(r"<v>(.*?)</v>", inner or "")
            if not v:
                continue
            v = v.group(1)
            if 't="s"' in attrs:
                v = ss[int(v)]
            row[col_index(ref)] = v.strip()
        grid[int(rnum)] = row
    merges = re.findall(r'<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"', xml)
    return grid, merges


def ffill_row(grid, r, ncols, merges):
    """表頭（保險公司、提供形式）有合併儲存格：向右填返"""
    row = dict(grid.get(r, {}))
    for c1, r1, c2, r2 in merges:
        if int(r1) <= r <= int(r2):
            v = row.get(col_index(c1)) or grid.get(int(r1), {}).get(col_index(c1))
            for c in range(col_index(c1), col_index(c2) + 1):
                if v and not row.get(c):
                    row[c] = v
    return row


def parse_premiums(data, sex):
    grid, merges = read_sheet(data)
    title = grid[1][0]
    m = re.search(r"As of (\d{1,2}) (\w+) (\d{4})", title)
    as_of = None
    if m:
        d, mon, y = m.groups()
        as_of = dt.date(int(y), dt.datetime.strptime(mon[:3], "%b").month, int(d)).isoformat()
    ncols = max(max(r.keys(), default=0) for r in grid.values()) + 1
    prov = ffill_row(grid, 4, ncols, merges)
    issued = ffill_row(grid, 5, ncols, merges)
    newapp, renew = ffill_row(grid, 6, ncols, merges), ffill_row(grid, 7, ncols, merges)
    other = grid.get(109, {})
    # 合併儲存格冇覆蓋嘅空格：同一間公司嘅連續欄（例如分投保年齡組）
    last_p = last_i = None
    cols = []
    for c in range(2, ncols):
        if not newapp.get(c) and not any(grid.get(r, {}).get(c) for r in range(8, 109)):
            continue
        p = prov.get(c) or last_p
        i = issued.get(c) or last_i
        last_p, last_i = p, i
        cols.append(c)
        prov[c], issued[c] = p, i
    age_rows = {}
    for r in range(8, 109):
        a = grid.get(r, {}).get(0)
        if a is not None and re.fullmatch(r"\d+", a):
            age_rows[int(a)] = r
    out = []
    for c in cols:
        rng = newapp.get(c, "")
        basis = "attained"
        if "Nearest" in rng:
            basis = "nearest"
        elif "Next" in rng:
            basis = "next"
        nums = re.findall(r"(\d+)\s*-\s*(\d+)", rng)
        new_rng = [int(nums[-1][0]), int(nums[-1][1])] if nums else None
        ren = re.findall(r"(\d+)\s*-\s*(\d+)", renew.get(c, ""))
        prem = {}
        for a, r in age_rows.items():
            v = grid.get(r, {}).get(c)
            if v not in (None, ""):
                try:
                    prem[a] = round(float(v), 2)
                except ValueError:
                    pass
        # 合併儲存格：分組欄（例如 60–69 歲投保）對下面所有年齡用同一個值
        for c1, r1, c2, r2 in merges:
            if col_index(c1) == c and int(r1) >= 8:
                v = grid.get(int(r1), {}).get(c)
                for a, r in age_rows.items():
                    if int(r1) <= r <= int(r2) and v not in (None, ""):
                        prem[a] = round(float(v), 2)
        out.append({"col": c, "provider": prov.get(c, ""), "issuedAs": issued.get(c, ""), "basis": basis,
                    "newApp": new_rng, "renew": [int(ren[-1][0]), int(ren[-1][1])] if ren else None,
                    "premium": prem, "other": other.get(c, "")})
    return as_of, out


# ------------------------------------------------------------------
# 保險公司名配對（Excel 英文名 ↔ 計劃名單英文名）
# ------------------------------------------------------------------
def norm(name):
    name = re.sub(r"\(\s*formerly.*$", " ", name, flags=re.I | re.S)  # 去走「Formerly known as …」（一定喺最尾）
    name = name.lower().replace("company", "co").replace("limited", "ltd").replace("&", " and ")
    name = re.sub(r"[^a-z0-9 ]", " ", name)
    name = re.sub(r"\bhk\b", "hong kong", name)
    return " ".join(w for w in name.split() if w not in {"co", "ltd", "the"})


def split_provider(cell):
    """Excel 儲存格：中文名（可能有「前為……」）+ 換行 + 英文名"""
    m = re.search(r"[A-Za-z]", cell)
    i = m.start() if m else len(cell)
    zh, en = cell[:i], cell[i:]
    return re.sub(r"\s+", "", zh).strip("( "), re.sub(r"\s+", " ", en).strip()


def issued_as(text):
    s = "standalone" in text.lower()
    r = "rider" in text.lower()
    return "both" if s and r else "rider" if r else "standalone"


def bilingual_other(text):
    if not text or set(text) <= set("-– "):
        return {"zh": [], "en": []}
    items = [x.strip(" -\n") for x in re.split(r"\n\s*-\s*|^\s*-\s*", text) if x.strip(" -\n")]
    zh, en = [], []
    for it in items:
        z = re.split(r"[A-Za-z]", it, maxsplit=1)[0].strip()
        e = it[len(z):].strip() if z else it
        zh.append(z or e)
        en.append(re.sub(r"\s+", " ", e))
    return {"zh": zh, "en": en}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="src", help="用本機檔案（male.xlsx、female.xlsx、standard-plans.json）")
    args = ap.parse_args()
    if args.src:
        d = Path(args.src)
        raw = {"male": (d / "male.xlsx").read_bytes(), "female": (d / "female.xlsx").read_bytes()}
        plans_raw = (d / "standard-plans.json").read_bytes()
    else:
        raw = {k: fetch(u) for k, u in XLSX.items()}
        plans_raw = fetch(PLANS_JSON)

    plan_list = json.loads(plans_raw.decode("utf-8-sig"))["certified-plans"]
    by_norm = {}
    for p in plan_list:
        by_norm.setdefault(norm(p["company-name"]["en"]), []).append(p)

    parsed, as_of = {}, {}
    for sex in ("male", "female"):
        as_of[sex], parsed[sex] = parse_premiums(raw[sex], sex)
    if as_of["male"] != as_of["female"]:
        print(f"⚠️ 男女表日期唔同：{as_of}")

    female_by_col = {c["col"]: c for c in parsed["female"]}
    plans = {}
    errors = []
    for col in parsed["male"]:
        zh_p, en_p = split_provider(col["provider"])
        cands = by_norm.get(norm(en_p), [])
        cands = [p for p in cands if not p.get("de-reg") and not p.get("unavailable")]
        if len(cands) != 1:
            errors.append(f"配對唔到／有多個計劃：{en_p}（{len(cands)}）")
            continue
        p = cands[0]
        info = p["plan-info-certified"][0]
        kind = issued_as(col["issuedAs"])
        key = f'{info["certification-no"]}-{kind}'
        fcol = female_by_col.get(col["col"])
        if not fcol or norm(split_provider(fcol["provider"])[1]) != norm(en_p) or fcol["newApp"] != col["newApp"]:
            errors.append(f"女性表搵唔到對應欄：{en_p} {col['issuedAs']} {col['newApp']}")
            continue
        sched = {"newApp": col["newApp"], "renew": col["renew"],
                 "male": [col["premium"].get(a) for a in range(0, 101)],
                 "female": [fcol["premium"].get(a) for a in range(0, 101)]}
        if key not in plans:
            plans[key] = {
                "id": key.lower(),
                "certNo": info["certification-no"],
                "insurer": {"zh": p["company-name"]["zh-hk"], "en": p["company-name"]["en"]},
                "plan": {"zh": p["plan-name"]["zh-hk"], "en": p["plan-name"]["en"]},
                "issuedAs": kind,
                "ageBasis": col["basis"],
                "renewalOnly": bool(p.get("renewal-only")),
                "planDate": p["plan-date"]["en"],
                "planDocUrl": {"zh": BASE + info["plan-doc-url"]["zh-hk"], "en": BASE + info["plan-doc-url"]["en"]},
                "premiumDocUrl": {"zh": BASE + info["premium-doc-url"]["zh-hk"], "en": BASE + info["premium-doc-url"]["en"]},
                "otherBenefits": bilingual_other(col["other"]),
                "schedules": [],
            }
        plans[key]["schedules"].append(sched)

    if errors:
        print("❌ 轉換失敗，冇寫入任何檔案：\n  " + "\n  ".join(errors))
        sys.exit(1)

    out = {
        "_說明": "自動生成，唔好人手改。由 scripts/fetch_vhis_standard.py 按醫務衞生局官方 Excel 及標準計劃名單轉換。",
        "asOf": as_of["male"],
        "fetchedOn": dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date().isoformat(),
        "source": {"zh": "醫務衞生局：自願醫保標準計劃標準保費一覽表", "en": "Health Bureau: Summary of Standard Premiums of VHIS Standard Plans"},
        "sourceUrl": {"male": XLSX["male"], "female": XLSX["female"], "list": LIST_PAGE},
        "notes": {
            "zh": "官方一覽表只列年度標準保費，未包括保監局徵費、吸煙與非吸煙差額、付款方式差額、折扣及附加保費；保費一般按年齡釐定，續保時可能調整。",
            "en": "The official summary lists annual standard premiums only. It excludes the Insurance Authority levy, smoker/non-smoker differences, payment-mode differences, discounts and loadings. Premiums are usually age-banded and may be adjusted on renewal.",
        },
        "plans": sorted(plans.values(), key=lambda x: (x["insurer"]["en"], x["issuedAs"])),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    new = json.dumps(out, ensure_ascii=False, indent=1)
    old = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
    OUT.write_text(new + "\n", encoding="utf-8")
    changed = re.sub(r'"fetchedOn": "[^"]*"', "", old) != re.sub(r'"fetchedOn": "[^"]*"', "", new + "\n")
    print(f"✅ 標準計劃：{len(out['plans'])} 個（截至 {out['asOf']}）{'｜有更新' if changed else '｜同上次一樣'}")


if __name__ == "__main__":
    main()
