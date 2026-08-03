/* =====================================================================
   消えないマーケティング｜7日間無料レター  ポップアップ・オプトイン
   ---------------------------------------------------------------------
   使い方：各ページの </body> 直前に次の1行を入れるだけ
     <script src="/optin-popup.js" defer></script>

   仕組み：メール入力 → GAS(action:"letter_subscribe") → Brevo専用リスト追加
           → リスト追加をトリガーにステップメール7通が自動配信
   ※ labSubscribe（3-2-1ラボ）と同じGASデプロイを流用。action だけ別。
   ===================================================================== */
(function () {
  "use strict";

  // ---- 設定 ---------------------------------------------------------
  var CONFIG = {
    gasUrl: "https://script.google.com/macros/s/AKfycbzoOGUIcrH4yOWYyC7MzhvqRdxZqhhh3svfshpSdd0ht2LVUcVQSWyZhJrAG10wVxBT/exec",
    action: "letter_subscribe",     // ← GAS側に新設する専用ルート
    showAfterSec: 20,               // 表示までの秒数
    showAtScrollPct: 50,            // または、この割合までスクロールしたら表示
    resnoozeDays: 7,               // 閉じた／登録した後、再表示しない日数
    storageKey: "kmarke_optin_v1"   // localStorageキー（内容を変えたら v2 に）
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

  // ---- スタイル（他ページと衝突しないよう全て kmo- 接頭辞＋scoped）--
  var css = ''
    + '.kmo-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;'
    + 'padding:20px;background:rgba(10,10,12,.72);backdrop-filter:blur(3px);opacity:0;transition:opacity .35s ease;}'
    + '.kmo-overlay.kmo-show{opacity:1;}'
    + '.kmo-card{position:relative;width:100%;max-width:440px;background:#141416;color:#f4f4f5;'
    + 'border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:36px 30px 30px;'
    + 'box-shadow:0 24px 60px rgba(0,0,0,.55);transform:translateY(14px) scale(.98);transition:transform .35s ease;'
    + 'font-family:-apple-system,BlinkMacSystemFont,"Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif;}'
    + '.kmo-overlay.kmo-show .kmo-card{transform:translateY(0) scale(1);}'
    + '.kmo-close{position:absolute;top:12px;right:14px;width:32px;height:32px;border:0;background:transparent;'
    + 'color:#8a8a90;font-size:22px;line-height:1;cursor:pointer;border-radius:8px;transition:.2s;}'
    + '.kmo-close:hover{background:rgba(255,255,255,.06);color:#fff;}'
    + '.kmo-over{font-size:12px;letter-spacing:.18em;color:#c9a86a;font-weight:700;margin:0 0 10px;}'
    + '.kmo-title{font-size:26px;line-height:1.3;font-weight:800;margin:0 0 4px;letter-spacing:.01em;}'
    + '.kmo-sub{font-size:15px;color:#c9a86a;font-weight:700;margin:0 0 16px;}'
    + '.kmo-lead{font-size:14px;line-height:1.75;color:#c7c7cc;margin:0 0 18px;}'
    + '.kmo-list{list-style:none;margin:0 0 22px;padding:0;}'
    + '.kmo-list li{font-size:13.5px;line-height:1.6;color:#e4e4e7;padding:7px 0 7px 26px;position:relative;'
    + 'border-top:1px solid rgba(255,255,255,.06);}'
    + '.kmo-list li:before{content:"";position:absolute;left:4px;top:14px;width:7px;height:7px;border-radius:50%;background:#c9a86a;}'
    + '.kmo-form{display:flex;flex-direction:column;gap:10px;}'
    + '.kmo-input{width:100%;box-sizing:border-box;padding:13px 15px;border-radius:10px;border:1px solid rgba(255,255,255,.14);'
    + 'background:#1d1d20;color:#fff;font-size:15px;outline:none;transition:.2s;}'
    + '.kmo-input:focus{border-color:#c9a86a;background:#212125;}'
    + '.kmo-btn{width:100%;padding:14px;border:0;border-radius:10px;cursor:pointer;font-size:15.5px;font-weight:800;'
    + 'color:#141416;background:#e9d3a0;transition:.2s;letter-spacing:.03em;}'
    + '.kmo-btn:hover{background:#f2e2bd;transform:translateY(-1px);}'
    + '.kmo-btn:disabled{opacity:.6;cursor:default;transform:none;}'
    + '.kmo-msg{font-size:13px;min-height:18px;margin:4px 2px 0;color:#c9a86a;}'
    + '.kmo-note{font-size:11.5px;color:#78787e;margin:12px 0 0;text-align:center;}'
    + '.kmo-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0;}'
    + '@media(max-width:480px){.kmo-card{padding:30px 22px 24px;}.kmo-title{font-size:22px;}}';

  // ---- マークアップ -------------------------------------------------
  var html = ''
    + '<div class="kmo-card" role="dialog" aria-modal="true" aria-label="無料メール講座のご案内">'
    +   '<button class="kmo-close" aria-label="閉じる">&times;</button>'
    +   '<p class="kmo-over">無料メール講座</p>'
    +   '<h2 class="kmo-title">消えないマーケティング</h2>'
    +   '<p class="kmo-sub">7日間無料レター</p>'
    +   '<p class="kmo-lead">流行が変わっても効き続ける、<br>原理原則と行動経済学。<br>7日間、1通ずつお届けします。</p>'
    +   '<ul class="kmo-list">'
    +     '<li>なぜ“いい商品”なのに売れないのか</li>'
    +     '<li>人は「感情」で買い、「理屈」で言い訳する</li>'
    +     '<li>流行に消えない“地盤”の作り方</li>'
    +   '</ul>'
    +   '<form class="kmo-form" novalidate>'
    +     '<input type="text" class="kmo-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">'
    +     '<input type="email" class="kmo-input" name="email" placeholder="メールアドレス" autocomplete="email" required>'
    +     '<button type="submit" class="kmo-btn">無料で受け取る</button>'
    +   '</form>'
    +   '<p class="kmo-msg" data-msg></p>'
    +   '<p class="kmo-note">※ いつでも1クリックで解除できます。</p>'
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
    requestAnimationFrame(function () { overlay.classList.add("kmo-show"); });
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

  // ---- 送信（GAS → Brevo）------------------------------------------
  overlay.querySelector(".kmo-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var form = e.currentTarget;
    var email = (form.email.value || "").trim().toLowerCase();
    var msg = overlay.querySelector("[data-msg]");
    var btn = form.querySelector("button");
    if (form.website.value) return;                       // ハニーポット（bot対策）
    if (!email || email.indexOf("@") < 0) { msg.textContent = "メールアドレスを入力してください。"; return; }
    btn.disabled = true; msg.textContent = "登録中…";
    fetch(CONFIG.gasUrl, {
      method: "POST",
      body: new URLSearchParams({ action: CONFIG.action, email: email })
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok) {
          form.style.display = "none";
          msg.textContent = "✓ ご登録ありがとうございます！まもなく1通目が届きます。";
          snooze();
          setTimeout(close, 2600);
        } else {
          btn.disabled = false;
          msg.textContent = "登録に失敗しました。時間をおいて再度お試しください。";
        }
      })
      .catch(function () {
        btn.disabled = false;
        msg.textContent = "通信エラーが発生しました。時間をおいて再度お試しください。";
      });
  });
})();
