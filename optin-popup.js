/* =====================================================================
   コラムの追従ポップアップ
   ---------------------------------------------------------------------
   使い方：各ページの </body> 直前に次の1行を入れるだけ
     <script src="/optin-popup.js" defer></script>
     （コラム記事120本＋一覧10ページに入っている）

   ★2026-09-25 とーる指示で、中身を丸ごと入れ替えた。
     ・旧：「消えないマーケティング｜7日間無料レター」のメール登録フォーム
           （メール → GAS letter_subscribe → Brevoの専用リスト → 7通）
     ・新：「SNS事業の現在地診断」への案内（ショートLPへ送るだけ）
     旧の中身が要るときは、gitの履歴 eee7d42 の時点のこのファイルにある。
     メルマガの導線は記事末尾の枠に残っているので、消えてはいない。

   ★文面は新しく書いていない。ショートLP（shindan-entry/index.html）の
     公開済みの言い回しをそのまま使っている。
   ★フォームが無くなったので、外部への通信は一切しない（GASもBrevoも呼ばない）。
   ===================================================================== */
(function () {
  "use strict";

  // ---- 設定 ---------------------------------------------------------
  var CONFIG = {
    href: "/shindan-entry/",        // 送り先はショートLP1本（診断本体のURLは配らない）
    showAfterSec: 20,               // 表示までの秒数
    showAtScrollPct: 50,            // または、この割合までスクロールしたら表示
    resnoozeDays: 7,                // 閉じた／診断へ進んだ後、再表示しない日数
    // ★キーを変えてある。旧メルマガ版を閉じて「7日間出ない」状態の人にも、
    //   入れ替えた直後からこちらが出るようにするため。
    storageKey: "shindan_popup_v1",
    thumbUrl: "/shindan-entry/ogp-v1.jpg"   // シェア画像を流用（1200×630）
  };

  // ---- 再表示の抑制 -------------------------------------------------
  try {
    var saved = localStorage.getItem(CONFIG.storageKey);
    if (saved && Number(saved) > Date.now()) return; // まだスヌーズ期間中
  } catch (e) {}

  function snooze() {
    try {
      localStorage.setItem(CONFIG.storageKey, String(Date.now() + CONFIG.resnoozeDays * 864e5));
    } catch (e) {}
  }

  // ---- スタイル（他ページと衝突しないよう全て kmo- 接頭辞）----------
  var css = ''
    // ★縦に短い画面でも中身が切れないように、はみ出したらスクロールできるようにする。
    //   flexで中央寄せしたまま溢れると上が切れるので、カード側は margin:auto にする。
    + '.kmo-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;'
    + 'padding:20px;background:rgba(10,10,12,.72);backdrop-filter:blur(3px);opacity:0;transition:opacity .5s ease;'
    + 'overflow-y:auto;-webkit-overflow-scrolling:touch;}'
    + '.kmo-overlay.kmo-show{opacity:1;}'
    + '.kmo-card{position:relative;margin:auto;width:100%;max-width:440px;background:#141416;color:#f4f4f5;'
    + 'border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:30px 30px 26px;'
    + 'box-shadow:0 24px 60px rgba(0,0,0,.55);opacity:0;transform:translateY(34px) scale(.92);'
    + 'transition:transform .6s cubic-bezier(.16,.86,.4,1),opacity .5s ease;'
    + 'font-family:-apple-system,BlinkMacSystemFont,"Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif;}'
    + '.kmo-overlay.kmo-show .kmo-card{opacity:1;transform:translateY(0) scale(1);}'
    + '.kmo-thumb{display:block;width:100%;aspect-ratio:1200/630;object-fit:cover;border-radius:12px;margin:0 0 20px;background:#1d1d20;}'
    + '@media(prefers-reduced-motion:reduce){.kmo-overlay,.kmo-card{transition-duration:.01s;}}'
    + '.kmo-close{position:absolute;top:12px;right:14px;width:32px;height:32px;border:0;background:rgba(18,18,20,.5);'
    + 'color:#e6e6e9;font-size:22px;line-height:1;cursor:pointer;border-radius:8px;transition:.2s;z-index:2;}'
    + '.kmo-close:hover{background:rgba(255,255,255,.06);color:#fff;}'
    + '.kmo-over{font-size:12px;letter-spacing:.18em;color:#c9a86a;font-weight:700;margin:0 0 10px;}'
    + '.kmo-title{font-size:26px;line-height:1.35;font-weight:800;margin:0 0 4px;letter-spacing:.01em;}'
    + '.kmo-sub{font-size:16px;color:#c9a86a;font-weight:700;margin:0 0 16px;}'
    + '.kmo-lead{font-size:14px;line-height:1.75;color:#c7c7cc;margin:0 0 18px;}'
    + '.kmo-list{list-style:none;margin:0 0 22px;padding:0;}'
    + '.kmo-list li{font-size:13.5px;line-height:1.6;color:#e4e4e7;padding:7px 0 7px 26px;position:relative;'
    + 'border-top:1px solid rgba(255,255,255,.06);}'
    + '.kmo-list li:before{content:"";position:absolute;left:4px;top:14px;width:7px;height:7px;border-radius:50%;background:#c9a86a;}'
    + '.kmo-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;box-sizing:border-box;'
    + 'min-height:54px;padding:15px;border:0;border-radius:10px;cursor:pointer;font-size:15.5px;font-weight:800;'
    + 'color:#141416;background:#e9d3a0;text-decoration:none;transition:.2s;letter-spacing:.03em;}'
    + '.kmo-btn:hover{background:#f2e2bd;transform:translateY(-1px);}'
    + '.kmo-note{font-size:11.5px;line-height:1.7;color:#78787e;margin:14px 0 0;text-align:center;}'
    + '@media(max-width:480px){.kmo-card{padding:30px 22px 22px;}.kmo-title{font-size:22px;}}'
    // ★縦に短い画面（古いiPhoneなど）では写真を省いて詰める。
    //   入れたままだと、一番大事なボタンが画面の下に隠れてしまう。
    + '@media(max-height:720px){.kmo-thumb{display:none;}.kmo-card{padding:24px 22px 18px;}'
    + '.kmo-over{margin-bottom:8px;}.kmo-title{font-size:21px;}.kmo-sub{margin-bottom:12px;}'
    + '.kmo-lead{margin-bottom:12px;}.kmo-list{margin-bottom:16px;}'
    + '.kmo-list li{padding:5px 0 5px 26px;}.kmo-list li:before{top:12px;}'
    + '.kmo-note{margin-top:10px;}}';

  // ---- マークアップ（文面はショートLPの公開済みのものと同じ）--------
  var html = ''
    + '<div class="kmo-card" role="dialog" aria-modal="true" aria-label="無料診断のご案内">'
    +   '<button class="kmo-close" type="button" aria-label="閉じる">&times;</button>'
    +   (CONFIG.thumbUrl ? '<img class="kmo-thumb" src="' + CONFIG.thumbUrl + '" alt="" onerror="this.style.display=\'none\'">' : '')
    +   '<p class="kmo-over">無料・約3分の診断</p>'
    +   '<h2 class="kmo-title">頑張ることを<br>増やす前に。</h2>'
    +   '<p class="kmo-sub">私、どこから整えよう？</p>'
    +   '<p class="kmo-lead">発信も、サービスづくりも。<br>全部が気になる今こそ、<br>最初に見直す一か所を探してみませんか。</p>'
    +   '<ul class="kmo-list">'
    +     '<li>全21問・5択。お客様・商品・届け方を5つの軸で</li>'
    +     '<li>返ってくるのは「いま、最初に整えたい一か所」</li>'
    +     '<li>登録不要・無料・スマホで完結</li>'
    +   '</ul>'
    +   '<a class="kmo-btn" href="' + CONFIG.href + '" target="_blank" rel="noopener">'
    +     '無料で診断する（約3分）<span aria-hidden="true">&rarr;</span></a>'
    +   '<p class="kmo-note">簡易結果は診断後すぐに表示。<br>詳しい結果は、LINEで友だち追加して受け取れます。</p>'
    + '</div>';

  // ---- 生成 ---------------------------------------------------------
  var styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  var overlay = document.createElement("div");
  overlay.className = "kmo-overlay";
  overlay.innerHTML = html;

  var shown = false;
  function open() {
    if (shown) return;
    shown = true;
    document.body.appendChild(overlay);
    void overlay.offsetWidth;   // 強制リフロー：初期状態(透明・下)を確定させてからアニメを発火
    requestAnimationFrame(function () { requestAnimationFrame(function () { overlay.classList.add("kmo-show"); }); });   // ふわっと登場
    unbindTriggers();
  }
  function close() {
    overlay.classList.remove("kmo-show");
    snooze();
    setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 350);
  }

  // ---- 表示トリガー（時間 / スクロール / 離脱）----------------------
  var timer = setTimeout(open, CONFIG.showAfterSec * 1000);
  function onScroll() {
    var st = window.pageYOffset || document.documentElement.scrollTop;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    if (h > 0 && (st / h) * 100 >= CONFIG.showAtScrollPct) open();
  }
  function onExit(e) { if (e.clientY <= 0) open(); }
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("mouseout", onExit);
  function unbindTriggers() {
    clearTimeout(timer);
    window.removeEventListener("scroll", onScroll);
    document.removeEventListener("mouseout", onExit);
  }

  // ---- 閉じる操作 ---------------------------------------------------
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay || e.target.classList.contains("kmo-close")) close();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && shown) close(); });

  // ---- 診断へ進んだ人にも、しばらく出さない -------------------------
  overlay.querySelector(".kmo-btn").addEventListener("click", function () { snooze(); });
})();
