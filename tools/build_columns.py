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
import os, re, glob, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(ROOT, "src", "columns")
OUT  = os.path.join(ROOT, "columns")          # 公開フォルダ（他アプリと混ざらないよう独立）
ASSETS = os.path.join(OUT, "assets")

NAV = [
    ("ホーム", "https://l-mine.com/home", False),
    ("行動経済学への想い", "https://columns.l-mine.com/behavioral-economics-lp.html", False),
    ("コラム", "index.html", True),
    ("オンラインコース一覧", "https://l-mine.com/onlinecourse", False),
    ("動画・オンラインコース視聴", "https://l-mine.com/onlinecourse-oshirase", False),
    ("KINDLE小説", "https://columns.l-mine.com/book-intro-dark.html", False),
    ("お問い合わせ", "https://l-mine.com/contact-us", False),
    ("エルラボ2.0", "https://l-mine.com/l-mine-2.0", False),
    ("ログイン", "https://l-mine.com/signin", False),
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
OPTIN_FOOTER = f'''    <aside class="optin">
      <div class="optin-k">とーるの無料メルマガ『3-2-1ラボ』</div>
      <p>行動経済学 × SNSビジネスの“本質”を、ここだけの実践編としてお届け。各メルマガ・無料講座のご案内もこちらから。</p>
      <a class="optin-btn" href="{LP_URL}" target="_blank" rel="noopener">メルマガ・講座を見てみる →</a>
    </aside>'''

# スクロール追従ポップアップ（インスタ誘引＋メルマガ送客）。PC=右下カード／スマホ=下部バー
POPUP_HTML = f'''<div id="lm-popup" class="lm-popup" aria-hidden="true">
    <button class="lm-pop-close" type="button" aria-label="閉じる">&times;</button>
    <div class="lm-pop-head">
      <img class="lm-pop-ico" src="assets/pop-icon.png" alt="とーる" loading="lazy">
      <div class="lm-pop-head-tx">
        <div class="lm-pop-eyebrow">もっと、とーるの話</div>
        <div class="lm-pop-ttl">よかったら、こちらも</div>
      </div>
    </div>
    <p class="lm-pop-txt">コラムでは書ききれない話を、SNSとメルマガでも発信しています。気が向いたら、覗いてみてください。</p>
    <div class="lm-pop-btns">
      <a class="lm-pop-insta" href="{INSTA}" target="_blank" rel="noopener">Instagramを見てみる</a>
      <a class="lm-pop-mag" href="{LP_URL}" target="_blank" rel="noopener">メルマガ『3-2-1ラボ』</a>
    </div>
  </div>'''

def nav_html():
    out = []
    for label, href, active in NAV:
        cls = ' class="active"' if active else ''
        out.append(f'      <a href="{href}"{cls}>{label}</a>')
    return "\n".join(out)

def foot_html():
    links = "".join(f'<a href="{h}">{l}</a>' for l, h in FOOT_LINKS)
    return links

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

def convert_body(body, sign):
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
        # 通常まとまり（<br>で詰める）
        out.append("<p>" + "<br>".join(inline(l.strip()) for l in lines) + "</p>")
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
        hero_block = f'<figure class="hero"><div class="frame"><img src="assets/column{n}-hero.jpg" alt=""></div></figure>'
    else:
        hero_block = ''
    tags = "".join(f'<a href="#">{t}</a>' for t in c["tags"])
    body = convert_body(c["body"], c.get("sign", ""))
    title_html = c.get("title_html", html.escape(c["title"]))
    return f'''<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{html.escape(c["title"])}｜L-MINE COLUMN</title>
<link rel="icon" href="assets/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@500;600;700;800&family=Noto+Sans+JP:wght@400;500;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/column.css">
</head>
<body>
<div class="top-rule"></div>
<header class="masthead">
  <div class="mast-inner">
    <a class="brand" href="https://l-mine.com/home"><img class="logo" src="assets/logo.png" alt="L-MINE 2.0｜L-MINE ON-LINE SCHOOL"></a>
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

{OPTIN_FOOTER}

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

<footer><div class="foot-inner"><div class="foot-links">{foot_html()}</div><div class="foot-cc">© 2026 L-MINE</div></div></footer>

{POPUP_HTML}
<script src="assets/popup.js"></script>
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
<title>コラム｜L-MINE COLUMN</title>
<link rel="icon" href="assets/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@500;600;700;800&family=Noto+Sans+JP:wght@400;500;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/column.css">
</head>
<body>
<div class="top-rule"></div>
<header class="masthead">
  <div class="mast-inner">
    <a class="brand" href="https://l-mine.com/home"><img class="logo" src="assets/logo.png" alt="L-MINE 2.0｜L-MINE ON-LINE SCHOOL"></a>
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
</body>
</html>'''

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
    print(f"生成完了: {len(cols)}記事 + 一覧{pages}ページ -> {OUT}")
    for c in sorted(cols, key=lambda z:-z["number"]):
        print(f"  No.{c['number']:>3}  column{c['number']}.html  {c['title']}")

if __name__ == "__main__":
    main()
