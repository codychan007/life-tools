"""
人生規劃通：部署時執行，將網站生成到 dist/（Cloudflare Pages：Build command `python3 scripts/build.py`，output `dist`）

  python scripts/build.py          # 生成 dist/
  SITE_URL=https://example.com python scripts/build.py

做嘅嘢（同姊妹網站「理財資訊通」同一套做法）：
  - 中文頁喺根目錄，英文頁喺 en/（同一個結構），頁首有語言切換
  - 每頁加入靜態導覽列、頁尾、免責聲明、預約按鈕
  - 每頁加入 canonical、hreflang、Open Graph、favicon、結構化資料（JSON-LD）
  - PREVIEW = True：全站 noindex、robots.txt 禁止收錄、頁頂顯示「預覽版」——合規部批准後改 False
  - 生成 sitemap.xml、robots.txt

只用 Python 標準庫，Cloudflare Pages 可以直接執行。
"""
import datetime as dt
import html
import json
import os
import re
import shutil
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):   # Windows 中文環境都印到 emoji
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
SITE_URL = (os.environ.get("SITE_URL") or "https://codychan-life.pages.dev").rstrip("/")   # 開咗 Cloudflare 項目後改做真網址
HKT = dt.timezone(dt.timedelta(hours=8))
TODAY = dt.datetime.now(HKT).date().isoformat()

# ★ 合規部未批准前保持 True（搜尋器唔收錄、頁頂顯示預覽版）
PREVIEW = True

BYLINE = "By Cody Chan"
IG = "codychan813"
IG_URL = f"https://www.instagram.com/{IG}/"
SEAL = "規"                     # 品牌印章字
SISTER_URL = "https://codychan813.pages.dev"   # 姊妹網站：理財資訊通

SITE = {
    "zh": {"prefix": "", "html": "zh-HK", "locale": "zh_HK", "brand": "香港地一站式人生規劃通", "short": "人生規劃通",
           "switch": "EN", "switch_label": "English version", "menu": "開啟選單", "job": "保險理財顧問",
           "sister": "理財資訊通", "sister_label": "姊妹網站", "sister_desc": "日常理財：儲錢、月薪分配、市場、優惠"},
    "en": {"prefix": "/en", "html": "en", "locale": "en_HK", "brand": "HK Life Compass", "short": "HK Life Compass",
           "switch": "中文", "switch_label": "中文版", "menu": "Open menu", "job": "Insurance and financial planning consultant",
           "sister": "HK Money Compass", "sister_label": "Sister site", "sister_desc": "Everyday money: saving, salary split, markets, card offers"},
}

# 目錄欄：實用資訊欄（撳開先見 4 個頁面，同理財資訊通一樣）｜姊妹網站｜預約傾談
# (路徑, 中文, 英文, 中文說明, 英文說明)
NAV_GROUP = ("實用資訊欄", "Useful info", [
    ("/compare/", "醫療及危疾比較", "Medical & CI compare", "保費、保障限額、危疾條款", "Premiums, limits, CI terms"),
    ("/reserve/", "醫療儲備", "Medical safety net", "保障缺口、要預留幾多", "Your gap and how much to set aside"),
    ("/retire/", "退休規劃", "Retirement", "要儲幾多、強積金夠唔夠", "How much you need, is MPF enough"),
    ("/insurance/", "保障資訊", "Protection facts", "醫療費、醫療通脹、政策", "Medical costs, inflation, policy"),
])
NAV = [(h, zh, en) for h, zh, en, *_ in NAV_GROUP[2]]
FOOTER_LINKS = NAV + [
    ("/book/", "預約傾談", "Book a chat"),
    ("/about/", "關於我", "About me"),
    ("/disclaimer/", "免責聲明及私隱政策", "Disclaimer & privacy"),
]
AVATAR_NAMES = ("avatar.jpg", "avatar.jpeg", "avatar.png", "avatar.webp")
NOINDEX = set()
EXCLUDE_TOP = {".git", ".github", ".claude", "dist", "scripts", "tests", "如何更新資料.md", "HANDOFF-ci.md", "給理財資訊通的連結卡.html", "__pycache__", "README.md"}

e = html.escape


def lang_of(path):
    return "en" if path == "/en/" or path.startswith("/en/") else "zh"


def base_path(path):
    return path[3:] if lang_of(path) == "en" else path


def url_for(base, lang):
    return SITE[lang]["prefix"] + base


def pick(lang, zh, en):
    return zh if lang == "zh" else en


# ------------------------------------------------------------------
# 共用版面
# ------------------------------------------------------------------
def seal(ch, cls=""):
    return f'<span class="seal{(" " + cls) if cls else ""}" aria-hidden="true">{e(ch)}</span>'


def sister_link(lang, cls="sister"):
    S = SITE[lang]
    href = SISTER_URL + ("/en/" if lang == "en" else "/")
    return (f'<a class="{cls}" href="{href}" target="_blank" rel="noopener">{seal("理", "sm")}'
            f'<span>{e(S["sister_label"])}：<b>{e(S["sister"])}</b></span></a>') if cls == "sister" else \
           f'<a class="{cls}" href="{href}" target="_blank" rel="noopener">{e(S["sister_label"])}：{e(S["sister"])}</a>'


def header(path):
    lang = lang_of(path)
    S, base = SITE[lang], base_path(path)
    other = "en" if lang == "zh" else "zh"
    cur = ' aria-current="page"'
    gname_zh, gname_en, items = NAV_GROUP
    group_on = any(base.startswith(h) for h, *_ in items)
    sublinks = "".join(
        f'<a href="{url_for(h, lang)}"{cur if base.startswith(h) else ""}><b>{e(pick(lang, zh, en))}</b><small>{e(pick(lang, dzh, den))}</small></a>'
        for h, zh, en, dzh, den in items)
    links = (f'<div class="nav-group{" is-current" if group_on else ""}">'
             f'<button class="nav-group-btn" type="button" aria-expanded="false" aria-controls="nav-sub">{e(pick(lang, gname_zh, gname_en))}<span class="caret" aria-hidden="true"></span></button>'
             f'<div class="nav-sub" id="nav-sub">{sublinks}</div></div>')
    links += sister_link(lang, "nav-sister")
    links += f'<a href="{url_for("/book/", lang)}"{cur if base == "/book/" else ""} class="nav-book">{e(pick(lang, "預約傾談", "Book a chat"))}</a>'
    bar = ""
    if PREVIEW:
        bar = (f'<div class="preview-bar">{e(pick(lang, "預覽版：內容待合規審閱，請勿分享", "Preview: pending compliance review. Please do not share."))}</div>')
    return f"""
{bar}<header class="site-header">
  <div class="wrap wide">
    <div class="bar">
      <a class="brand" href="{url_for('/', lang)}">
        {seal(SEAL, "sm brand-mark")}
        <span>{e(S["short"])}<br><small>{BYLINE}</small></span>
      </a>
      <nav class="nav" id="site-nav">{links}</nav>
      <div class="head-tools">
        <a class="lang-switch" href="{url_for(base, other)}" hreflang="{SITE[other]['html']}" lang="{SITE[other]['html']}" aria-label="{e(S['switch_label'])}">{e(S["switch"])}</a>
        <button class="menu-btn" aria-label="{e(S['menu'])}" aria-expanded="false" aria-controls="site-nav">☰</button>
      </div>
    </div>
  </div>
</header>"""


FOOTER_LEGAL = {
    "zh": """<p><strong>免責聲明：</strong>本網站所有工具及資料只作一般教育及參考用途，不構成任何保險、投資、稅務或法律建議，亦非任何產品之要約、招攬或推介。
      工具所用回報率、通脹率均為假設，並非保證；投資涉及風險，過往表現不代表將來。產品比較只作客觀資料陳列，排序只按你揀嘅數值，並不代表任何產品較好；
      保費及保障以保險公司最新公布及保單條款為準。作任何財務決定前，請按個人情況尋求合適專業意見。</p>
      <p>你喺工具輸入嘅資料只喺你部機計算，唔會儲存或上傳。<a href="/disclaimer/">完整免責聲明及私隱政策</a>・<a href="/book/">個人資料收集聲明</a></p>""",
    "en": """<p><strong>Disclaimer:</strong> All tools and information on this website are for general education and reference only.
      They are not insurance, investment, tax or legal advice, and are not an offer, solicitation or recommendation of any product.
      Rates of return and inflation are assumptions, not guarantees; investment involves risk and past performance is not indicative of future results.
      Product comparisons only list factual information, sorted by the value you choose, and do not mean any product is better.
      Premiums and benefits are subject to the insurer's latest figures and policy terms.
      Please get suitable professional advice for your own situation before making any financial decision. Where the English and Chinese versions differ, the Chinese version prevails.</p>
      <p>What you enter in the tools is calculated on your own device and is never stored or uploaded. <a href="/en/disclaimer/">Full disclaimer and privacy policy</a> · <a href="/en/book/">Personal data collection statement</a></p>""",
}


def footer(lang):
    S = SITE[lang]
    links = "".join(f'<a href="{url_for(h, lang)}">{e(pick(lang, zh, en))}</a>' for h, zh, en in FOOTER_LINKS)
    return f"""
<footer class="site-footer">
  <div class="wrap wide">
    <h4>{seal(SEAL, "sm")} {e(S["brand"])} – {BYLINE}</h4>
    <div>IG: <a href="{IG_URL}" target="_blank" rel="noopener">@{IG}</a></div>
    <div class="links">{links}</div>
    <div>{sister_link(lang)}<br><small>{e(S["sister_desc"])}</small></div>
    <div class="legal">
      {FOOTER_LEGAL[lang]}
      <p>© {TODAY[:4]} {e(S["brand"])}</p>
    </div>
  </div>
</footer>"""


TOOL_DISCLAIMER = {
    "zh": """<div class="disclaimer" data-disclaimer="tool">
  <strong>重要提示：</strong>本工具結果僅供參考，不構成保險、投資或稅務建議。回報率為假設，並非保證；保費以保險公司最新公布為準。
  你輸入嘅資料只會喺你部手機／電腦內計算，<strong>唔會儲存或上傳</strong>。</div>""",
    "en": """<div class="disclaimer" data-disclaimer="tool">
  <strong>Important:</strong> Results are for reference only and are not insurance, investment or tax advice. Rates of return are assumptions, not guarantees;
  premiums are subject to the insurer's latest figures. What you enter is calculated on your own device and is <strong>never stored or uploaded</strong>.</div>""",
}

CTA = {
    "zh": """<div data-cta><div class="cta-seal">
  <p class="cta-lead">想有人幫你睇清楚？</p>
  <p class="cta-sub">預約免費傾談，傾下你嘅醫療、危疾同退休規劃，冇購買責任。</p>
  <a class="cta-btn" href="/book/">預約免費傾談 <span class="arrow">→</span></a>
  <p class="cta-fine">WhatsApp・電話・Google 日曆，揀你方便嘅</p>
</div></div>""",
    "en": """<div data-cta><div class="cta-seal">
  <p class="cta-lead">Want someone to go through it with you?</p>
  <p class="cta-sub">Book a free chat about your medical, critical illness or retirement planning. No obligation to buy anything.</p>
  <a class="cta-btn" href="/en/book/">Book a free chat <span class="arrow">→</span></a>
  <p class="cta-fine">WhatsApp, phone or Google Calendar, whichever suits you</p>
</div></div>""",
}


def avatar(lang):
    """頭像：印章框，撳落去開 IG。未放相就用「我」字印章頂住。"""
    found = next((n for n in AVATAR_NAMES if (ROOT / "assets" / n).exists()), None)
    alt = "Cody Chan" + ("（IG @codychan813）" if lang == "zh" else " (IG @codychan813)")
    inner = (f'<img src="/assets/{found}" alt="{e(alt)}" width="320" height="320" loading="lazy">' if found
             else '<span class="avatar-fallback" aria-hidden="true">我</span>')
    return (f'<a class="avatar-seal" href="{IG_URL}" target="_blank" rel="noopener" aria-label="{e(alt)}">'
            f'<span class="frame">{inner}</span><span class="cap">IG @codychan813</span></a>')


def person_ld(lang="zh"):
    return {"@type": "Person", "name": "Cody Chan", "url": f"{SITE_URL}{url_for('/about/', lang)}", "sameAs": [IG_URL],
            "jobTitle": SITE[lang]["job"]}


FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+HK:wght@400;700&family=Noto+Serif+HK:wght@600;700&display=swap">')


def head_extra(path, title, desc, ld, noindex=False):
    lang = lang_of(path)
    base = base_path(path)
    url = SITE_URL + path
    og = ROOT / "assets" / "og" / f"home{'-en' if lang == 'en' else ''}.png"
    parts = [
        FONTS,
        f'<link rel="canonical" href="{url}">',
        f'<link rel="alternate" hreflang="zh-HK" href="{SITE_URL}{url_for(base, "zh")}">',
        f'<link rel="alternate" hreflang="en" href="{SITE_URL}{url_for(base, "en")}">',
        f'<link rel="alternate" hreflang="x-default" href="{SITE_URL}{url_for(base, "zh")}">',
        '<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">',
        '<link rel="icon" href="/assets/favicon-32.png" sizes="32x32" type="image/png">',
        '<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">',
        f'<meta property="og:site_name" content="{e(SITE[lang]["brand"])}">',
        f'<meta property="og:locale" content="{SITE[lang]["locale"]}">',
        '<meta property="og:type" content="website">',
        f'<meta property="og:title" content="{e(title)}">',
        f'<meta property="og:description" content="{e(desc)}">',
        f'<meta property="og:url" content="{url}">',
    ]
    if og.exists():
        parts += [f'<meta property="og:image" content="{SITE_URL}/assets/og/{og.name}">',
                  '<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">',
                  '<meta name="twitter:card" content="summary_large_image">']
    if noindex or PREVIEW:
        parts.append('<meta name="robots" content="noindex, nofollow">')
    for block in ld:
        block = {"@context": "https://schema.org", **block}
        parts.append('<script type="application/ld+json">' + json.dumps(block, ensure_ascii=False).replace("</", "<\\/") + "</script>")
    return "\n  ".join(parts)


def finish_page(src, path, extra_ld=None, noindex=False):
    """將來源 HTML 變成完整靜態頁"""
    lang = lang_of(path)
    title = re.search(r"<title>(.*?)</title>", src, re.S).group(1).strip()
    m = re.search(r'<meta name="description" content="([^"]*)"', src)
    desc = html.unescape(m.group(1)) if m else ""
    src = src.replace('<div data-disclaimer="tool"></div>', TOOL_DISCLAIMER[lang])
    src = src.replace("<div data-cta></div>", CTA[lang])
    src = src.replace("<div data-avatar></div>", avatar(lang))
    src = src.replace("<div data-sister></div>", sister_link(lang))
    src = re.sub(r'<span data-seal="(.)"></span>', lambda mm: seal(mm.group(1), "sm"), src)
    src = re.sub(r'<meta name="theme-color" content="[^"]*">', '<meta name="theme-color" content="#F3ECDD">', src)
    src = src.replace('<link rel="stylesheet" href="/assets/css/style.css">',
                      '<link rel="stylesheet" href="/assets/css/style.css">\n  ' + head_extra(path, title, desc, extra_ld or [], noindex), 1)
    src = src.replace("<body>", "<body>" + header(path), 1)
    src = src.replace("</main>", "</main>" + footer(lang), 1)
    leftover = re.findall(r'data-(?:cta|avatar|sister|disclaimer="tool")></div>|\{\{[A-Z_]+\}\}', src)
    if leftover:
        raise SystemExit(f"{path}：未替換嘅佔位 {leftover}")
    return src


# ------------------------------------------------------------------
# 保障資訊頁：由 data/insurance.json 直接生成 HTML（2026-11 由理財資訊通搬過嚟，英文用 *_en 欄位）
# ------------------------------------------------------------------
def load(name):
    return json.loads((ROOT / "data" / name).read_text(encoding="utf-8"))


def L(obj, key, lang):
    """英文頁用 key_en，冇就用中文"""
    if lang == "en" and obj.get(f"{key}_en") not in (None, "", []):
        return obj[f"{key}_en"]
    return obj.get(key)


TXT = {
    "zh": {"source": "來源：", "asof": "｜資料截至：", "stale": "資料或已過時，請以官方最新公布為準", "stale_short": "資料或已過時",
           "see_also": "另見：", "fees_head": ("項目", "收費", "備註"), "costs_head": ("手術", "醫院", "P50", "P90", "資料期"),
           "tip_private": "小貼士：入院前可以要求醫院提供書面費用預算，亦可以喺醫院網站搵「過往收費統計」比較。",
           "no_policy": "最近三個月未有新嘅重要醫療政策。", "archive": "過往政策更新",
           "archive_note": "以下係較早嘅政策消息，部分內容可能已有變化，請以最新公布為準。",
           "policy_asof": "本部分最後整理：{d}（每月 1 號更新）", "solves": "解決："},
    "en": {"source": "Source: ", "asof": " | Data as of: ", "stale": "May be out of date; the latest official figures prevail", "stale_short": "May be out of date",
           "see_also": "See also: ", "fees_head": ("Item", "Fee", "Notes"), "costs_head": ("Procedure", "Hospital", "P50", "P90", "Period"),
           "tip_private": "Tip: before admission you can ask the hospital for a written fee estimate, and compare the “historical bill statistics” on hospital websites.",
           "no_policy": "No major new healthcare policy in the last three months.", "archive": "Earlier policy updates",
           "archive_note": "These are older policy updates; some details may have changed since. The latest announcements prevail.",
           "policy_asof": "This section last reviewed: {d} (updated on the 1st of each month)", "solves": "Covers: "},
}


def a(url, text):
    return f'<a href="{e(url)}" target="_blank" rel="noopener">{e(text)}</a>'


def stale_badge(review_by, text):
    # 空白佔位：由瀏覽器按當日日期決定要唔要加入提示文字（insurance.js），
    # 咁爬蟲唔會誤讀一段隱藏嘅「過時」字眼
    return f' <span class="badge stale" data-review-by="{e(review_by or "")}" data-stale-text="{e(text)}" hidden></span>' if review_by else ""


def source_line(it, lang):
    T = TXT[lang]
    src_name = L(it, "source", lang)
    src = a(L(it, "sourceUrl", lang), src_name) if it.get("sourceUrl") else e(src_name or "")
    asof = f"{T['asof']}{e(L(it, 'asOf', lang))}" if it.get("asOf") else ""
    return f'<div class="source">{T["source"]}{src}{asof}{stale_badge(it.get("reviewBy"), T["stale"])}</div>'


def stat_cards(items, lang):
    out = []
    for it in items:
        sub = f"<span>{e(L(it, 'sub', lang))}</span>" if it.get("sub") else ""
        src = source_line(it, lang) if it.get("source") else ""
        out.append(f'<div class="stat"><span>{e(L(it, "label", lang))}</span>'
                   f'<b class="num" style="font-size:1.5rem">{e(L(it, "value", lang))}</b>{sub}{src}</div>')
    return f'<div class="grid cols-2">{"".join(out)}</div>'


def extra_sources(lst, lang):
    sep = "、" if lang == "zh" else ", "
    return sep.join(a(L(s, "url", lang), L(s, "name", lang)) for s in lst or [])


def policy_item(it, lang):
    pts = "".join(f"<li>{e(p)}</li>" for p in L(it, "points", lang))
    return (f'<div class="policy-item"><span class="badge">{e(it["date"])}</span><h3>{e(L(it, "title", lang))}</h3>'
            f'<ul>{pts}</ul><div class="source">{TXT[lang]["source"]}{a(L(it, "sourceUrl", lang), L(it, "source", lang))}</div></div>')


def insurance_sections(lang):
    D = load("insurance.json")
    T = TXT[lang]
    s = {}
    mi = D["medicalInflation"]
    s["inflation"] = (f'<h2>{e(L(mi, "title", lang))}</h2>{stat_cards(mi["items"], lang)}'
                      f'<p class="muted" style="font-size:13px;margin:12px 0 0">{e(L(mi, "note", lang))}</p>')
    pf = D["publicFees"]
    rows = "".join(f'<tr><td>{e(r[0])}</td><td class="num"><b>{e(r[1])}</b></td>'
                   f'<td style="text-align:left;font-size:13px">{e(r[2])}</td></tr>' for r in L(pf, "rows", lang))
    h = T["fees_head"]
    s["public-fees"] = (f'<h2>{e(L(pf, "title", lang))}</h2><p>{e(L(pf, "intro", lang))}</p>'
                        f'<div class="table-scroll"><table class="data wrap-cells"><tr><th>{h[0]}</th><th>{h[1]}</th><th>{h[2]}</th></tr>{rows}</table></div>'
                        f'{source_line(pf, lang)}' + (f'<div class="source">{T["see_also"]}{extra_sources(pf.get("extraSources"), lang)}</div>' if pf.get("extraSources") else ""))
    pc = D["privateCosts"]
    filled = [r for r in pc.get("table", []) if r.get("p50") and "【" not in r.get("procedure", "")]
    table = ""
    if filled:
        h = T["costs_head"]
        trs = "".join(f'<tr><td>{a(r["sourceUrl"], L(r, "procedure", lang)) if r.get("sourceUrl") else e(L(r, "procedure", lang))}</td>'
                      f'<td>{e(L(r, "hospital", lang))}</td><td>{e(r["p50"])}</td><td>{e(r.get("p90", ""))}</td><td>{e(r["period"])}</td></tr>' for r in filled)
        table = (f'<div class="table-scroll" style="margin-top:12px"><table class="data"><tr><th>{h[0]}</th><th>{h[1]}</th><th>{h[2]}</th>'
                 f'<th>{h[3]}</th><th>{h[4]}</th></tr>{trs}</table></div>')
    s["private-costs"] = (f'<h2>{e(L(pc, "title", lang))}</h2><p>{e(L(pc, "intro", lang))}</p>{stat_cards(pc["highlights"], lang)}{table}'
                          f'<p class="muted" style="font-size:13px;margin:12px 0 0">{T["tip_private"]}</p>')
    ca = D["cancer"]
    s["cancer"] = (f'<h2>{e(L(ca, "title", lang))}</h2>{stat_cards(ca["items"], lang)}{source_line(ca, lang)}' +
                   (f'<div class="source">{T["see_also"]}{extra_sources(ca.get("extraSources"), lang)}</div>' if ca.get("extraSources") else ""))
    po = D["policy"]
    items = sorted(po.get("items", []), key=lambda x: x["date"], reverse=True)
    arch = sorted(po.get("archive", []), key=lambda x: x["date"], reverse=True)
    body = "".join(policy_item(i, lang) for i in items) if items else f'<p class="muted">{T["no_policy"]}</p>'
    if arch:
        body += ('<details style="margin-top:8px"><summary style="cursor:pointer;font-weight:700;min-height:44px;display:flex;align-items:center">'
                 f'{T["archive"]} ({len(arch)})</summary><p class="muted" style="font-size:13px;margin:4px 0 0">{T["archive_note"]}</p>'
                 + "".join(policy_item(i, lang) for i in arch) + "</details>")
    s["policy"] = (f'<h2>{e(L(po, "title", lang))}</h2>{body}'
                   f'<div class="source">{T["policy_asof"].format(d=e(po["asOf"]))}{stale_badge(po.get("reviewBy"), T["stale_short"])}</div>')
    b = D["basics"]
    cards = "".join(f'<div class="stat"><b>{e(L(i, "name", lang))}</b><span>{T["solves"]}{e(L(i, "solves", lang))}<br>{e(L(i, "note", lang))}</span></div>'
                    for i in b["items"])
    tips = "".join(f"<li>{e(t)}</li>" for t in L(b, "tips", lang))
    s["basics"] = (f'<h2>{e(L(b, "title", lang))}</h2><div class="grid cols-2">{cards}</div>'
                   f'<ul style="margin:14px 0 0;padding-left:1.2em">{tips}</ul>{source_line(b, lang)}')
    return s


def build_insurance(src, lang):
    for sid, inner in insurance_sections(lang).items():
        src = src.replace(f'<section class="card" id="{sid}"></section>', f'<section class="card" id="{sid}">{inner}</section>')
    return src


# ------------------------------------------------------------------
# 數據：將 plans.json + premiums/*.csv 合併成瀏覽器一次讀晒嘅 *.compiled.json
# ------------------------------------------------------------------
def read_csv(path):
    import csv
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def num(v):
    v = (v or "").replace(",", "").strip()
    return float(v) if v not in ("", "-") else None


def compile_medical():
    src = ROOT / "data" / "medical"
    D = json.loads((src / "plans.json").read_text(encoding="utf-8"))
    # 未核實（verified: false）嘅計劃：正式網站唔顯示；本機預覽用 SHOW_UNVERIFIED=1 先見到（會標「待核實」）
    show_unverified = os.environ.get("SHOW_UNVERIFIED") == "1"
    D["plans"] = [p for p in D["plans"] if p.get("verified") or show_unverified]
    for p in D["plans"]:
        for v in p["variants"]:
            # CSV：entryFrom,entryTo,age,male_ns,male_s,female_ns,female_s（entryFrom/To = 投保年齡組；冇就當 0–100）
            bands = {}
            for r in read_csv(src / v["premiumFile"]):
                a = int(r["age"])
                if not 0 <= a <= 100:
                    continue
                key = (int(num(r.get("entryFrom")) or 0), int(num(r.get("entryTo")) if r.get("entryTo") else 100))
                t = bands.setdefault(key, {k: [None] * 101 for k in ("male_ns", "male_s", "female_ns", "female_s")})
                for k in t:
                    t[k][a] = num(r.get(k))
            v["bands"] = [{"from": lo, "to": hi, "premiums": t} for (lo, hi), t in sorted(bands.items())]
    out = DIST / "data" / "medical" / "plans.compiled.json"
    out.write_text(json.dumps(D, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def compile_ci():
    src = ROOT / "data" / "ci"
    D = json.loads((src / "plans.json").read_text(encoding="utf-8"))
    show_unverified = os.environ.get("SHOW_UNVERIFIED") == "1"
    D["plans"] = [p for p in D["plans"] if p.get("verified") or show_unverified]
    for p in D["plans"]:
        # CSV：age,male_ns,male_s,female_ns,female_s,renewalOnly（該保額嘅年保費）
        rates = {k: [None] * 101 for k in ("male_ns", "male_s", "female_ns", "female_s")}
        if p.get("premiumFile"):
            for r in read_csv(src / p["premiumFile"]):
                a = int(r["age"])
                if 0 <= a <= 100:
                    for k in rates:
                        rates[k][a] = num(r.get(k))
        p["rates"] = rates
    out = DIST / "data" / "ci" / "plans.compiled.json"
    out.write_text(json.dumps(D, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


# ------------------------------------------------------------------
def main():
    DIST.mkdir(exist_ok=True)
    for old in DIST.iterdir():  # 清空內容（唔刪資料夾本身，本機預覽伺服器開住都得）
        shutil.rmtree(old) if old.is_dir() else old.unlink()
    for item in ROOT.iterdir():
        if item.name in EXCLUDE_TOP:
            continue
        if item.is_dir():
            shutil.copytree(item, DIST / item.name, ignore=shutil.ignore_patterns("*.md", "__pycache__", "_*.json"))
        else:
            shutil.copy2(item, DIST / item.name)

    compile_medical()
    compile_ci()
    if os.environ.get("INCLUDE_TESTS") == "1":   # 本機驗算用：INCLUDE_TESTS=1 python scripts/build.py
        shutil.copytree(ROOT / "tests", DIST / "tests")

    pages = []
    for f in sorted(DIST.rglob("index.html")):
        rel = f.relative_to(DIST).parent.as_posix()
        path = "/" if rel == "." else f"/{rel}/"
        lang, base = lang_of(path), base_path(path)
        ld = []
        if base == "/":
            ld = [{"@type": "WebSite", "name": SITE[lang]["brand"], "url": SITE_URL + url_for("/", lang), "inLanguage": SITE[lang]["html"]},
                  person_ld(lang)]
        elif base == "/about/":
            ld = [person_ld(lang)]
        src = f.read_text(encoding="utf-8")
        if base == "/insurance/":
            src = build_insurance(src, lang).replace("{{INFL_DEFAULT}}", f'{load("insurance.json")["medicalInflation"]["defaultRate"]:g}')
        f.write_text(finish_page(src, path, ld), encoding="utf-8")
        if base not in NOINDEX:
            pages.append(path)

    nf = DIST / "404.html"
    if nf.exists():
        nf.write_text(finish_page(nf.read_text(encoding="utf-8"), "/404.html", noindex=True), encoding="utf-8")

    sm = "".join(f"<url><loc>{SITE_URL}{u}</loc><lastmod>{TODAY}</lastmod></url>" for u in pages)
    (DIST / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{sm}</urlset>\n', encoding="utf-8")
    robots = "User-agent: *\nDisallow: /\n" if PREVIEW else f"User-agent: *\nAllow: /\n\nSitemap: {SITE_URL}/sitemap.xml\n"
    (DIST / "robots.txt").write_text(robots, encoding="utf-8")
    if PREVIEW:   # Cloudflare Pages：全站加 X-Robots-Tag
        hp = DIST / "_headers"
        hp.write_text(hp.read_text(encoding="utf-8").replace("/*\n", "/*\n  X-Robots-Tag: noindex, nofollow\n", 1), encoding="utf-8")
    print(f"✅ 已生成 dist/：{len(pages)} 個頁面（中英）{'｜預覽模式（noindex）' if PREVIEW else ''}｜網址 {SITE_URL}")


if __name__ == "__main__":
    main()
