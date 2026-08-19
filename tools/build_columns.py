#!/usr/bin/env python3
# coding: utf-8
"""
コラム量産ビルダー
  入力 : src/columns/*.md  （フロントマター + Notion流の本文）
  出力 : preview/columnNN.html（各記事）/ preview/columns.html（一覧）
本文の変換ルール：
  - 空行            … まとまり（段落）の区切り（約2行ぶんの余白）
  - まとまり内の改行 … <br> で詰める（1〜4行）
  - ## 見出し       … <h2>
  - ***             … ✦ セクション区切り
  - 「- 」で始まる行のまとまり … 箇条書き
  - **STEP n：…**   … STEP見出し
  - 行に ↓ を含むまとまり … フロー図（↓ は中央・金）
  - **強調** → <strong> / _強調_ → <em>（金）
"""
import os, re, glob, html, datetime, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(ROOT, "src", "columns")
OUT  = os.path.join(ROOT, "columns")          # 公開フォルダ（他アプリと混ざらないよう独立）
ASSETS = os.path.join(OUT, "assets")
BASE_URL = "https://columns.l-mine.com/"      # 本番の公開ドメイン（sitemap 用）

# 独自運用への移行済みヘッダー（コネワン l-mine.com 依存を撤去）。
# href=None のメニューは「準備中」表示（span.soon＝リンク無効・独自版が未整備の項目）。
NAV = [
    ("ホーム", "https://columns.l-mine.com/", False),
    ("行動経済学への想い", "https://columns.l-mine.com/behavioral-economics-lp.html", False),
    ("コラム", "index.html", True),
    ("オンラインコース一覧", None, False),  # 準備中（独自のコース一覧ページ未整備）
    ("動画・オンラインコース視聴", "https://columns.l-mine.com/elabo-plus-lp.html", False),
    ("KINDLE小説", "https://columns.l-mine.com/book-intro-dark.html", False),
    ("お問い合わせ", "https://columns.l-mine.com/contact.html", False),
    ("ログイン", "https://columns.l-mine.com/app/", False),  # エルラボ＋（Firebase認証）
]
FOOT_LINKS = [
    ("利用規約", "https://l-mine.com/term"),
    ("特定商取引法に基づく表示", "https://l-mine.com/about"),
    ("プライバシーポリシー", "https://l-mine.com/privacy"),
    ("免責事項", "https://l-mine.com/mensekizikou"),
]
CATS = ["SNS", "マーケティング", "行動経済学", "ビジネス", "コンテンツビジネス", "起業"]
INSTA = "https://www.instagram.com/tooru_lab/"
X_URL = "https://x.com/LMeta321"
LP_URL = "https://l-mine.com/business/the-3-2-1-lab"
APP_URL = "https://columns.l-mine.com/app/"           # 会員制の動画視聴Webアプリ「エルラボ＋」本体
ELABO_LP = "https://columns.l-mine.com/elabo-plus-lp.html"  # エルラボ＋の案内LP（コラム内の誘導はこちら経由）
TEMPLATE_FROM = 98                                # この番号以降のコラムに エルラボ＋ の案内を付与（オファーテンプレ）
ELABO_OPTIN_FROM = 100                            # この番号以降は「エルラボ＋」を主オプトインに（No.100=アプリリリース。99以下はメルマガ主体のまま）

# ---- SEO / アクセス解析 ----
GA4_ID = "G-TLV00VTDZL"                            # Google Analytics 4 測定ID（全ページ共通）
SITE_NAME = "L-MINE"                               # og:site_name / publisher 名
AUTHOR_NAME = "とーる"                             # 記事著者（JSON-LD author）
DEFAULT_OG_IMAGE = BASE_URL + "columns/assets/columns-top.jpg"  # ヒーロー画像が無い記事のOGP代替

# おすすめコラム（全記事の下部に表示・とーる選定）。ここに番号を並べるだけで差し替え可。存在しない番号／自分自身は自動スキップ。
RECOMMENDED = [107, 103, 89, 73, 71, 65]

# 記事末尾のオプトイン枠。n>=ELABO_OPTIN_FROM でエルラボ＋主体、それ未満はメルマガ主体（n>=TEMPLATE_FROM でエルラボ＋の控えめ1行を追記）
def optin_footer(n):
    # 全コラム統一：記事末尾は「エルラボ＋」案内に統一（旧『3-2-1ラボ』メルマガ＝停止中のため撤去）。
    # メルマガ（消えないマーケティング 7日間無料レター）の登録は、各コラムの optin-popup.js が担当。
    return f'''    <aside class="optin">
      <div class="optin-k">動画で学ぶ｜エルラボ＋</div>
      <p>行動経済学 × SNSビジネスを、体系立てた動画講座で。定期オンライン講義（アーカイブ視聴可）も開催中。まずは、無料の講座から。</p>
      <a class="optin-btn" href="{ELABO_LP}" target="_blank" rel="noopener">エルラボ＋を見てみる →</a>
    </aside>'''

# スクロール追従ポップアップ。n>=ELABO_OPTIN_FROM でエルラボ＋を主ボタン、それ未満はメルマガ主体
def popup_html(n):
    if n >= ELABO_OPTIN_FROM:
        # アプリ（主）→ メルマガ → インスタ の順で全3ボタンを表示
        txt = 'コラムでは書ききれない話を、動画・メルマガ・SNSでも発信しています。気が向いたら、こちらも。'
        btns = (f'      <a class="lm-pop-app lm-pop-app-primary" href="{ELABO_LP}" target="_blank" rel="noopener">エルラボ＋を見てみる</a>\n'
                f'      <a class="lm-pop-mag" href="{LP_URL}" target="_blank" rel="noopener">メルマガ『3-2-1ラボ』</a>\n'
                f'      <a class="lm-pop-insta" href="{INSTA}" target="_blank" rel="noopener">Instagramを見てみる</a>')
    else:
        txt = 'コラムでは書ききれない話を、SNSとメルマガでも発信しています。気が向いたら、覗いてみてください。'
        app_btn = (f'\n      <a class="lm-pop-app" href="{ELABO_LP}" target="_blank" rel="noopener">動画で学ぶ｜エルラボ＋</a>'
                   if n >= TEMPLATE_FROM else '')
        btns = (f'      <a class="lm-pop-insta" href="{INSTA}" target="_blank" rel="noopener">Instagramを見てみる</a>\n'
                f'      <a class="lm-pop-mag" href="{LP_URL}" target="_blank" rel="noopener">メルマガ『3-2-1ラボ』</a>{app_btn}')
    return f'''<div id="lm-popup" class="lm-popup" aria-hidden="true">
    <button class="lm-pop-close" type="button" aria-label="閉じる">&times;</button>
    <div class="lm-pop-head">
      <img class="lm-pop-ico" src="assets/pop-icon.png" alt="とーる" loading="lazy">
      <div class="lm-pop-head-tx">
        <div class="lm-pop-eyebrow">もっと、とーるの話</div>
        <div class="lm-pop-ttl">よかったら、こちらも</div>
      </div>
    </div>
    <p class="lm-pop-txt">{txt}</p>
    <div class="lm-pop-btns">
{btns}
    </div>
  </div>'''

def nav_html():
    out = []
    for label, href, active in NAV:
        if href is None:  # 準備中（独自版なし）＝リンクにせず span.soon
            out.append(f'      <span class="soon">{label}</span>')
            continue
        cls = ' class="active"' if active else ''
        out.append(f'      <a href="{href}"{cls}>{label}</a>')
    return "\n".join(out)

def foot_html():
    links = "".join(f'<a href="{h}">{l}</a>' for l, h in FOOT_LINKS)
    return links

# ---- SEO / GA4 ヘルパー ----
def ga4_head():
    """Google Analytics 4（gtag.js）。全ページ共通で head 上部に置く。"""
    return f'''<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id={GA4_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){{dataLayer.push(arguments);}}
  gtag('js', new Date());
  gtag('config', '{GA4_ID}');
</script>'''

def _attr(s):
    return html.escape(str(s), quote=True)

def article_seo(c):
    """記事ページの description / canonical / OGP / Twitter / 構造化データ。"""
    n = c["number"]
    url = BASE_URL + f"columns/column{n}.html"
    title = c["title"]
    desc = (c.get("excerpt") or "").strip() or title
    img = (BASE_URL + f"columns/assets/column{n}-hero.jpg") if hero_exists(n) else DEFAULT_OG_IMAGE
    article_ld = {
        "@context": "https://schema.org",
        "@type": "Article",
        "mainEntityOfPage": {"@type": "WebPage", "@id": url},
        "headline": title,
        "description": desc,
        "image": img,
        "datePublished": c["date"],
        "dateModified": c["date"],
        "author": {"@type": "Person", "name": AUTHOR_NAME, "url": BASE_URL},
        "publisher": {"@type": "Organization", "name": SITE_NAME,
                      "logo": {"@type": "ImageObject", "url": BASE_URL + "assets/logo.png"}},
        "articleSection": c.get("category", ""),
        "keywords": ", ".join(c.get("tags", [])),
    }
    crumb_ld = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "ホーム", "item": BASE_URL},
            {"@type": "ListItem", "position": 2, "name": "コラム", "item": BASE_URL + "columns/"},
            {"@type": "ListItem", "position": 3, "name": title, "item": url},
        ],
    }
    return f'''<meta name="description" content="{_attr(desc)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="article">
<meta property="og:title" content="{_attr(title)}">
<meta property="og:description" content="{_attr(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{img}">
<meta property="og:site_name" content="{_attr(SITE_NAME)}">
<meta property="article:published_time" content="{c["date"]}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{_attr(title)}">
<meta name="twitter:description" content="{_attr(desc)}">
<meta name="twitter:image" content="{img}">
<script type="application/ld+json">{json.dumps(article_ld, ensure_ascii=False)}</script>
<script type="application/ld+json">{json.dumps(crumb_ld, ensure_ascii=False)}</script>'''

def index_seo(page):
    """コラム一覧ページの description / canonical / OGP。"""
    url = BASE_URL + "columns/" + page_file(page)
    title = "コラム｜とーる 猫好きの行動経済アナリスト"
    base_desc = "行動経済学 × SNSビジネスの視点で、売れる「考え方の型」を綴るコラム一覧。とーる（行動経済アナリスト）が発信しています。"
    desc = base_desc if page == 1 else f"（{page}ページ目）{base_desc}"
    return f'''<meta name="description" content="{_attr(desc)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:title" content="{_attr(title)}">
<meta property="og:description" content="{_attr(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{DEFAULT_OG_IMAGE}">
<meta property="og:site_name" content="{_attr(SITE_NAME)}">
<meta name="twitter:card" content="summary_large_image">'''

def contrib_html():
    return f'''    <div class="contrib">
      <div class="ph"><img src="assets/toru.jpg" alt="とーる"></div>
      <div class="pad">
        <div class="lab">Columnist</div>
        <h4>とーる</h4>
        <div class="role">行動経済アナリスト / デジタルクリエイター</div>
        <p>1985年生まれ、名古屋市在住。第1回行動経済学検定1級合格者で、日本営業科学協会認定の行動経済アナリスト。知識を活かしてビジネスをする起業初心者を全般サポートしています。</p>
        <div class="links"><a href="{INSTA}" target="_blank" rel="noopener">Instagram</a><a href="{X_URL}" target="_blank" rel="noopener">X</a></div>
      </div>
    </div>'''

# ---------- 本文変換 ----------
VALID_NUMS = set()  # 存在するコラム番号（main で投入）

def inline(s):
    s = html.escape(s, quote=False)
    stash = []
    def hold(frag):
        stash.append(frag)
        return f'\x00{len(stash)-1}\x00'
    # <url> の角括弧を除去
    s = re.sub(r'&lt;(https?://[^&\s]+?)&gt;', r'\1', s)
    # 生URL → リンク（プレースホルダに退避して bold/em の影響を受けないように）
    s = re.sub(r'https?://[^\s<>「」（）、。&]+',
               lambda m: hold(f'<a href="{m.group(0)}" target="_blank" rel="noopener">{m.group(0)}</a>'), s)
    # コラム間参照 #NN / #コラムNN → 該当記事へリンク（存在する番号のみ・退避）
    def xref(m, disp):
        n = int(m.group(1))
        return hold(f'<a href="column{n}.html">{disp}</a>') if n in VALID_NUMS else m.group(0)
    s = re.sub(r'#コラム(\d+)', lambda m: xref(m, f'#コラム{m.group(1)}'), s)
    s = re.sub(r'(?<![">\d\x00])#(\d+)', lambda m: xref(m, f'#{m.group(1)}'), s)
    # 強調
    s = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', s)
    s = re.sub(r'_(.+?)_', r'<em>\1</em>', s)
    # プレースホルダ復元
    s = re.sub(r'\x00(\d+)\x00', lambda m: stash[int(m.group(1))], s)
    return s

def convert_body(body, sign, readable_breaks=False):
    # 見出し・区切りは、原稿側に空行がなくても独立ブロックとして扱う。
    # readable_breaks は長い改行列を最大3行の段落へ分け、文字の壁を防ぐ。
    body = re.sub(r'(?m)^(\*\*\*|## .+|> .+)$', r'\n\1\n', body)
    blocks = re.split(r'\n[ \t]*\n', body.strip("\n"))
    out = []
    for blk in blocks:
        lines = [l for l in blk.split("\n") if l.strip() != ""]
        if not lines:
            continue
        raw = "\n".join(lines).strip()
        # セクション区切り
        if raw == "***":
            out.append('<p class="sec">&#10022;</p>')
            continue
        # 引用・結論ボックス（> で始まる行）
        if all(l.lstrip().startswith("> ") for l in lines):
            quote = "<br>".join(inline(l.lstrip()[2:].strip()) for l in lines)
            out.append(f'<blockquote class="key-message">{quote}</blockquote>')
            continue
        # オプトイン案内マーカー → 集約LPへのリンク
        if raw == "[準備中]":
            out.append(f'<p class="optin-inline"><a href="{LP_URL}" target="_blank" rel="noopener">▶ メルマガ・無料講座の詳細・ご登録はこちら（3-2-1ラボ）</a></p>')
            continue
        # 本文画像  ![alt](src)
        mi = re.match(r'^!\[(.*?)\]\((.+?)\)$', lines[0]) if len(lines) == 1 else None
        if mi:
            alt = html.escape(mi.group(1))
            out.append(f'<figure class="cimg"><img src="{mi.group(2).strip()}" alt="{alt}" loading="lazy">'
                       + (f'<figcaption>{alt}</figcaption>' if alt else '') + '</figure>')
            continue
        # 見出し
        if len(lines) == 1 and lines[0].startswith("## "):
            out.append(f'<h2>{inline(lines[0][3:].strip())}</h2>')
            continue
        # STEP
        m = re.match(r'^\*\*\s*(STEP\s*\d+)\s*[：:]\s*(.+?)\s*\*\*$', lines[0]) if len(lines) == 1 else None
        if m:
            out.append(f'<p class="step-h"><span class="lab">{m.group(1)}</span><b>{inline(m.group(2))}</b></p>')
            continue
        # 箇条書き
        if all(l.lstrip().startswith("- ") for l in lines):
            items = "".join(f'<li>{inline(l.lstrip()[2:].strip())}</li>' for l in lines)
            out.append(f'<ul>{items}</ul>')
            continue
        # フロー図（↓ を含む）
        if any(l.strip() == "↓" for l in lines):
            inner = []
            for l in lines:
                if l.strip() == "↓":
                    inner.append('<p class="flow">&darr;</p>')
                else:
                    inner.append(f'<p>{inline(l.strip())}</p>')
            out.append('<div class="flowbox">' + "".join(inner) + '</div>')
            continue
        # 通常まとまり。狭いスマホ幅（日本語約18字/行）で見た目が最大4行になるよう分割する。
        # <br> の個数だけでは、長い1行が端末上で折り返して文字の壁になるため、文字数も見る。
        if readable_breaks:
            chunks, chunk, visual_lines = [], [], 0
            for line in lines:
                plain = re.sub(r'[*_]', '', line.strip())
                line_visual = max(1, (len(plain) + 17) // 18)
                if chunk and visual_lines + line_visual > 4:
                    chunks.append(chunk)
                    chunk, visual_lines = [], 0
                chunk.append(line)
                visual_lines += line_visual
            if chunk:
                chunks.append(chunk)
        else:
            chunks = [lines]
        for chunk in chunks:
            out.append("<p>" + "<br>".join(inline(l.strip()) for l in chunk) + "</p>")
    if sign:
        out.append(f'<p class="sign">{inline(sign)}</p>')
    return "\n      ".join(out)

# ---------- フロントマター ----------
def parse(path):
    txt = open(path, encoding="utf-8").read()
    m = re.match(r'^---\n(.*?)\n---\n(.*)$', txt, re.S)
    meta = {}
    for line in m.group(1).split("\n"):
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip()
    meta["body"] = m.group(2)
    meta["number"] = int(meta["number"])
    meta["tags"] = [t.strip() for t in meta.get("tags", "").split(",") if t.strip()]
    return meta

def hero_exists(n):
    return os.path.exists(os.path.join(ASSETS, f"column{n}-hero.jpg"))

def thumb_html(c, cls):
    n = c["number"]
    if hero_exists(n):
        return f'<div class="{cls}"><img src="assets/column{n}-hero.jpg" alt=""></div>'
    return f'<div class="{cls}"><span class="fb">Illustration</span></div>'

def label(c):
    if c.get("series") == "Act":
        return f'Act#{c.get("series_no", "")}'
    return f'コラム＃{c["number"]}'

# おすすめコラム（記事下部・とーる選定）。RECOMMENDED の順、存在しない番号／自分自身は自動スキップ。
def recommended_html(n, cols):
    by_num = {c["number"]: c for c in cols}
    picks = [by_num[r] for r in RECOMMENDED if r in by_num and r != n]
    if not picks:
        return ''
    cards = "\n".join(
        f'''        <a class="rec-card" href="column{c["number"]}.html">
          {thumb_html(c, "rec-thumb")}
          <div class="rec-b"><span class="rec-m">{label(c)}</span><h3 class="rec-t">{html.escape(c["title"])}</h3></div>
        </a>'''
        for c in picks)
    return f'''<style>
.reccols{{max-width:1180px;margin:0 auto;padding:54px 24px 6px;border-top:1px solid #e7e2d8}}
.reccols .rec-hd{{text-align:center;margin-bottom:26px}}
.reccols .rec-k{{display:block;font:600 12px/1 "Cormorant Garamond",serif;letter-spacing:.3em;text-transform:uppercase;color:#a98b4e}}
.reccols .rec-h2{{margin:7px 0 0;font:600 24px/1.3 "Shippori Mincho B1",serif;color:#1c1a16}}
.reccols .rec-grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px}}
.reccols .rec-card{{display:block;text-decoration:none;color:inherit;background:#fff;border:1px solid #eae5db;transition:transform .2s ease,box-shadow .2s ease}}
.reccols .rec-card:hover{{transform:translateY(-3px);box-shadow:0 14px 30px rgba(0,0,0,.08)}}
.reccols .rec-thumb{{aspect-ratio:16/10;overflow:hidden;background:#f2efe8}}
.reccols .rec-thumb img{{width:100%;height:100%;object-fit:cover;display:block}}
.reccols .rec-thumb .fb{{display:flex;align-items:center;justify-content:center;height:100%;font:500 12px "Cormorant Garamond",serif;letter-spacing:.2em;color:#b3aa98}}
.reccols .rec-b{{padding:13px 14px 15px}}
.reccols .rec-m{{font:600 11px/1 "Cormorant Garamond",serif;letter-spacing:.1em;color:#a98b4e}}
.reccols .rec-t{{margin:6px 0 0;font:600 15px/1.5 "Shippori Mincho B1",serif;color:#211f1a;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}}
@media(max-width:600px){{.reccols{{padding:40px 16px 2px}}.reccols .rec-grid{{grid-template-columns:1fr 1fr;gap:12px}}.reccols .rec-t{{font-size:13px}}}}
</style>
    <section class="reccols" aria-label="おすすめコラム">
      <div class="rec-hd"><span class="rec-k">Recommended</span><h2 class="rec-h2">おすすめコラム</h2></div>
      <div class="rec-grid">
{cards}
      </div>
    </section>'''

# ---------- 記事ページ ----------
def render_article(c, cols):
    n = c["number"]
    order = sorted(cols, key=lambda z: (z["date"], z["number"]))  # 日付昇順（古い→新しい）
    ids = [x["number"] for x in order]
    i = ids.index(n)
    older = ids[i-1] if i > 0 else None            # 前の記事（日付が古い）
    newer = ids[i+1] if i < len(ids)-1 else None   # 次の記事（日付が新しい）
    prev_html = f'<a class="prev" href="column{older}.html">&larr; 前の記事</a>' if older else '<span></span>'
    next_html = f'<a class="next" href="column{newer}.html">次の記事 &rarr;</a>' if newer else '<span></span>'
    # 最近の記事（自分以外、日付降順4件）
    recents = [x for x in sorted(cols, key=lambda z: (z["date"], z["number"]), reverse=True) if x["number"] != n][:4]
    rec_html = "\n        ".join(
        f'<a href="column{r["number"]}.html">{html.escape(r["title"])}<span class="d">{label(r)} — {r["date_disp_short"]}</span></a>'
        for r in recents)
    # ヒーロー（画像が無ければ枠ごと省略）
    if hero_exists(n):
        hero_block = f'<figure class="hero"><div class="frame"><img src="assets/column{n}-hero.jpg" alt="{html.escape(c["title"])}"></div></figure>'
    else:
        hero_block = ''
    tags = "".join(f'<a href="#">{t}</a>' for t in c["tags"])
    body = convert_body(c["body"], c.get("sign", ""), c.get("readable_breaks", "").lower() == "true")
    title_html = c.get("title_html", html.escape(c["title"]))
    return f'''<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
{ga4_head()}
<title>{html.escape(c["title"])}｜とーる 猫好きの行動経済アナリスト</title>
{article_seo(c)}
<link rel="icon" href="/lab-mark-256.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@500;600;700;800&family=Noto+Sans+JP:wght@400;500;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/column.css">
</head>
<body>
<div class="top-rule"></div>
<header class="masthead">
  <div class="mast-inner">
    <a class="brand" href="https://columns.l-mine.com/"><img class="logo" src="assets/logo.png" alt="L-MINE 2.0｜L-MINE ON-LINE SCHOOL"></a>
    <input type="checkbox" id="navtog" class="navtog" aria-hidden="true">
    <label for="navtog" class="hamb" aria-label="メニュー"><span></span><span></span><span></span></label>
    <nav class="nav">
{nav_html()}
    </nav>
  </div>
</header>

<div class="layout">
  <main class="article">
    <div class="kicker"><span class="no">{label(c)}</span><span class="div"></span><span class="cat">{html.escape(c["category"])}</span></div>
    <h1 class="title">{title_html}</h1>
    <div class="dateline"><b>文・とーる</b><span class="sep"></span><span>行動経済アナリスト</span><span class="sep"></span><span>{html.escape(c["date_disp"])}</span></div>
    <div class="rule"></div>

    {hero_block}

    <div class="body">
      {body}
    </div>

{optin_footer(n)}

    <div class="filed"><span class="lab">Filed under</span>{tags}</div>

    <nav class="pager">{prev_html}<a class="home" href="index.html">Index</a>{next_html}</nav>
  </main>

  <aside class="side">
{contrib_html()}
    <div class="swidget">
      <h3>Recent</h3>
      <div class="recent">
        {rec_html}
      </div>
    </div>
  </aside>
</div>

{recommended_html(n, cols)}

<footer><div class="foot-inner"><div class="foot-links">{foot_html()}</div><div class="foot-cc">© 2026 L-MINE</div></div></footer>

<script src="/optin-popup.js" defer></script>
</body>
</html>'''

# ---------- 一覧ページ ----------
def page_file(p):
    return "index.html" if p == 1 else f"columns-{p}.html"

def pagination_html(page, pages):
    if pages <= 1:
        return ""
    def num(p):
        return f'<span class="pn-num current">{p}</span>' if p == page else f'<a class="pn-num" href="{page_file(p)}">{p}</a>'
    prev = f'<a class="pn-side" href="{page_file(page-1)}">&larr; 前へ</a>' if page > 1 else '<span class="pn-side off">&larr; 前へ</span>'
    nxt = f'<a class="pn-side" href="{page_file(page+1)}">次へ &rarr;</a>' if page < pages else '<span class="pn-side off">次へ &rarr;</span>'
    nums = "".join(num(p) for p in range(1, pages + 1))
    return f'<nav class="pagenav">{prev}<span class="pn-nums">{nums}</span>{nxt}</nav>'

def render_index(page_cols, page, pages):
    posts = []
    for c in page_cols:
        n = c["number"]
        cat = "／".join([c["category"]] + [t for t in c["tags"] if t != c["category"]][:2])
        ex_html = f'<p class="ex">{html.escape(c["excerpt"])}</p>' if c.get("excerpt") else ''
        has_img = hero_exists(n)
        cls = "post" if has_img else "post noimg"
        thumb = f'<div class="thumb"><img src="assets/column{n}-hero.jpg" alt=""></div>' if has_img else ''
        posts.append(f'''    <a class="{cls}" href="column{n}.html">
      {thumb}
      <div class="pbody">
        <div class="meta">{label(c)} — {html.escape(c["date_disp_short"])}</div>
        <h2>{html.escape(c["title"])}</h2>
        {ex_html}
        <div class="cat"><span>{html.escape(c["category"])}</span>{("／" + html.escape("／".join([t for t in c["tags"] if t != c["category"]][:2]))) if len(c["tags"])>1 else ""}</div>
        <span class="readmore">本編を読む →</span>
      </div>
    </a>''')
    cats = "".join(f'<a href="#">{t}</a>' for t in CATS)
    return f'''<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
{ga4_head()}
<title>コラム｜とーる 猫好きの行動経済アナリスト</title>
{index_seo(page)}
<link rel="icon" href="/lab-mark-256.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@500;600;700;800&family=Noto+Sans+JP:wght@400;500;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/column.css">
</head>
<body>
<div class="top-rule"></div>
<header class="masthead">
  <div class="mast-inner">
    <a class="brand" href="https://columns.l-mine.com/"><img class="logo" src="assets/logo.png" alt="L-MINE 2.0｜L-MINE ON-LINE SCHOOL"></a>
    <input type="checkbox" id="navtog" class="navtog" aria-hidden="true">
    <label for="navtog" class="hamb" aria-label="メニュー"><span></span><span></span><span></span></label>
    <nav class="nav">
{nav_html()}
    </nav>
  </div>
</header>

<div class="page-head">
  <img class="ph-bg" src="assets/columns-top.jpg" alt="">
  <div class="ph-inner">
    <div class="ey">Column</div>
    <h1>コラム</h1>
    <p>行動経済学 × SNSビジネスの視点で、売れる「考え方の型」を綴ります。</p>
    <div class="hr"></div>
  </div>
</div>

<div class="wrap">
  <div class="feedcol">
    <section class="feed">
{chr(10).join(posts)}
    </section>
    {pagination_html(page, pages)}
  </div>
  <aside class="side">
{contrib_html()}
    <div class="swidget"><h3>Categories</h3><div class="cats">{cats}</div></div>
  </aside>
</div>

<footer><div class="foot-inner"><div class="foot-links">{foot_html()}</div><div class="foot-cc">© 2026 L-MINE</div></div></footer>
<script src="/optin-popup.js" defer></script>
</body>
</html>'''

# ---------- サイトマップ（自動生成） ----------
# ルート直下の主要ページ（集客導線）。実在するものだけ sitemap に含める
FIXED_PAGES = [
    "behavioral-economics-lp.html",   # 行動経済学への想い（LP）
    "elabo-plus-lp.html",             # エルラボ＋案内LP
    "book-intro-dark.html",           # KINDLE小説
    "kiso_quiz.html",                 # 行動経済学クイズ
]

def build_sitemap(cols, pages):
    """columns/ の実在コラム・一覧・TOP・主要ページから sitemap.xml を再生成する。
    ビルドの度に呼ぶことで、コラム追加時の登録漏れ（TOP欠落・最新記事欠落）を防ぐ。"""
    today = datetime.date.today().isoformat()
    urls = [(BASE_URL, today)]                                   # サイトのTOP（ルート）
    for p in FIXED_PAGES:                                        # 主要ページ（実在チェック）
        if os.path.exists(os.path.join(ROOT, p)):
            urls.append((BASE_URL + p, today))
    for i in range(1, pages + 1):                               # コラム一覧（index + ページ送り）
        urls.append((BASE_URL + "columns/" + page_file(i), today))
    for c in sorted(cols, key=lambda z: z["number"]):          # 各コラム記事（lastmod=投稿日）
        urls.append((BASE_URL + f'columns/column{c["number"]}.html', c["date"]))
    body = "\n".join(
        f'  <url>\n    <loc>{html.escape(u)}</loc>\n    <lastmod>{d}</lastmod>\n  </url>'
        for u, d in urls)
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
           f'{body}\n</urlset>\n')
    open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8").write(xml)
    return len(urls)

def main():
    os.makedirs(OUT, exist_ok=True)
    cols = []
    for p in glob.glob(os.path.join(SRC, "*.md")):
        c = parse(p)
        # 表示用短縮日付（YYYY.MM.DD）
        y, m, d = c["date"].split("-")
        c["date_disp_short"] = f"{y}.{m}.{d}"
        cols.append(c)
    cols.sort(key=lambda z: z["number"])
    VALID_NUMS.update(c["number"] for c in cols)  # コラム間リンク用
    for c in cols:
        open(os.path.join(OUT, f'column{c["number"]}.html'), "w", encoding="utf-8").write(render_article(c, cols))
    desc = sorted(cols, key=lambda z: (z["date"], z["number"]), reverse=True)  # 投稿日の新しい順
    PER = 12
    chunks = [desc[i:i+PER] for i in range(0, len(desc), PER)] or [[]]
    pages = len(chunks)
    for f in glob.glob(os.path.join(OUT, "columns-*.html")):
        os.remove(f)
    for idx, chunk in enumerate(chunks):
        open(os.path.join(OUT, page_file(idx+1)), "w", encoding="utf-8").write(render_index(chunk, idx+1, pages))
    n_urls = build_sitemap(cols, pages)
    print(f"生成完了: {len(cols)}記事 + 一覧{pages}ページ -> {OUT}")
    print(f"sitemap.xml 更新: {n_urls} URL（TOP + 主要ページ + 一覧 + 全コラム）")
    for c in sorted(cols, key=lambda z:-z["number"]):
        print(f"  No.{c['number']:>3}  column{c['number']}.html  {c['title']}")

if __name__ == "__main__":
    main()
