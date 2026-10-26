/* =====================================================================
   エルラボ＋ 加入のご案内ポップアップ（動画つき）
   ---------------------------------------------------------------------
   無料登録だけの方が「メンバー限定の講義」を開いたとき、
   またはライブ会場に数分いたときに、ご案内の動画を出します。

   使い方：各ページの </body> 直前に次の1行を入れる
     <script src="/join-popup.js" defer></script>

   呼び出し
     LMJoin.arm({ key:"video", delaySec:1.6, onCta:openSubJoin })
       … 少し待ってから出す（同じ key の予約は上書き）
     LMJoin.show({ key:"live", email:"..." })
       … すぐ出す
     LMJoin.cancel()      … 予約を取り消す
     LMJoin.reset()       … 再表示しない設定を消す（確認用）

   ・会員かどうかは呼び出す側で判定してください（ここでは見ません）
   ・「あとで」で閉じたら SNOOZE_DAYS 日、加入ページへ進んだら
     CTA_SNOOZE_DAYS 日は再表示しません（key ごと）
   ・アプリ内では価格を出しません（受講料は加入ページで提示）
   ===================================================================== */
(function () {
  "use strict";

  var CFG = {
    video:  "/assets/videos/elabo-member-vsl-v1.mp4",
    poster: "/assets/videos/elabo-member-vsl-v1.jpg",
    joinUrl: "https://columns.l-mine.com/elabo-plus-join.html",
    snoozeDays: 7,        // 「あとで」で閉じたとき
    ctaSnoozeDays: 60,    // 加入ページへ進んだとき（あちらで判断してもらうので長め）
    title: "月に何度か、<br>一緒に考える場所です。",
    lead:  "講義のアーカイブと、メンバー限定コラム。<br>3分ほどの動画でご案内しています。",
    cta:   "ご案内のページを見る →",
    later: "あとで",
    barText: "メンバーなら、このライブもあとで見返せます。",
    barCta:  "くわしく"
  };

  var pending = null;   // 予約中のタイマー
  var openNow = false;  // 今開いているか

  function skey(k){ return "lmjoinpop_" + (k || "default"); }
  function snoozed(k){
    try{ var v = localStorage.getItem(skey(k)); return !!(v && Number(v) > Date.now()); }
    catch(e){ return false; }
  }
  function snooze(k, days){
    try{ localStorage.setItem(skey(k), String(Date.now() + days * 864e5)); }catch(e){}
  }

  function injectCss(){
    if(document.getElementById("jnp-css")) return;
    var css = ''
      + '.jnp-ov{position:fixed;inset:0;z-index:99997;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(8,8,11,.78);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);opacity:0;transition:opacity .3s ease}'
      + '.jnp-ov.on{opacity:1}'
      + '.jnp-card{position:relative;width:100%;max-width:520px;max-height:92vh;overflow:hidden auto;background:#14120e;color:#f2eede;border:1px solid rgba(227,195,129,.22);border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.6);transform:translateY(14px) scale(.985);transition:transform .3s ease;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif}'
      + '.jnp-ov.on .jnp-card{transform:none}'
      + '.jnp-close{position:absolute;top:9px;right:10px;width:32px;height:32px;border:0;background:rgba(0,0,0,.45);color:#fff;font-size:19px;line-height:1;cursor:pointer;border-radius:50%;z-index:2}'
      + '.jnp-close:hover{background:rgba(0,0,0,.65)}'
      + '.jnp-video{display:block;width:100%;aspect-ratio:16/9;background:#000;border-radius:16px 16px 0 0}'
      + '.jnp-body{padding:20px 22px 22px}'
      + '.jnp-tag{font-size:10.5px;letter-spacing:.18em;color:#e3c381;font-weight:800;margin:0 0 9px}'
      + '.jnp-title{font-size:19px;line-height:1.55;font-weight:800;margin:0 0 10px;font-family:"Hiragino Mincho ProN","Yu Mincho",serif}'
      + '.jnp-lead{font-size:13px;line-height:1.9;color:#c0bbac;margin:0 0 18px}'
      + '.jnp-cta{display:block;width:100%;text-align:center;padding:14px;border:0;border-radius:11px;background:linear-gradient(135deg,#e3c381,#c9a961);color:#241a06;font-weight:800;font-size:15px;text-decoration:none;cursor:pointer}'
      + '.jnp-cta:hover{filter:brightness(1.05)}'
      + '.jnp-later{display:block;width:100%;margin-top:10px;padding:10px;border:0;background:none;color:#8f8b80;font-size:12.5px;cursor:pointer}'
      + '.jnp-later:hover{color:#c9c3b4}'
      + '.jnp-bar{position:fixed;left:50%;bottom:14px;transform:translate(-50%,14px);z-index:99996;display:flex;align-items:center;gap:12px;max-width:min(560px,calc(100vw - 24px));padding:11px 12px 11px 16px;background:rgba(20,18,14,.96);color:#f2eede;border:1px solid rgba(227,195,129,.26);border-radius:12px;box-shadow:0 14px 36px rgba(0,0,0,.5);opacity:0;transition:opacity .3s ease,transform .3s ease;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif}'
      + '.jnp-bar.on{opacity:1;transform:translate(-50%,0)}'
      + '.jnp-bt{margin:0;font-size:12.5px;line-height:1.6;flex:1 1 auto}'
      + '.jnp-bgo{flex:0 0 auto;border:0;border-radius:999px;padding:8px 15px;background:linear-gradient(135deg,#e3c381,#c9a961);color:#241a06;font-weight:800;font-size:12.5px;white-space:nowrap;cursor:pointer}'
      + '.jnp-bx{flex:0 0 auto;width:28px;height:28px;border:0;background:none;color:#8f8b80;font-size:17px;line-height:1;cursor:pointer}'
      + '.jnp-bx:hover{color:#e2c788}'
      + '@media(max-width:520px){ .jnp-card{max-width:none} .jnp-title{font-size:17.5px} .jnp-body{padding:17px 17px 19px} .jnp-bar{left:10px;right:10px;gap:9px;padding:10px 8px 10px 13px;transform:translateY(14px);max-width:none} .jnp-bar.on{transform:none} .jnp-bt{font-size:12px;line-height:1.55} .jnp-bgo{padding:8px 12px;font-size:12px} }';
    var st = document.createElement("style");
    st.id = "jnp-css"; st.textContent = css;
    document.head.appendChild(st);
  }

  function close(o, days){
    var ov = document.getElementById("jnp-ov");
    if(!ov) return;
    try{ var vd = ov.querySelector("video"); if(vd) vd.pause(); }catch(e){}
    ov.classList.remove("on");
    setTimeout(function(){ try{ ov.remove(); }catch(e){} }, 300);
    openNow = false;
    snooze(o.key, days);
    if(typeof o.onClose === "function"){ try{ o.onClose(); }catch(e){} }
  }

  function show(o){
    o = o || {};
    if(openNow) return false;
    if(!o.force && snoozed(o.key)) return false;
    // 他のポップアップ（お知らせ案内）が出ているときは譲る
    if(document.querySelector(".nsp-ov")) return false;
    injectCss();

    var url = o.joinUrl || CFG.joinUrl;
    if(o.email) url += (url.indexOf("?") < 0 ? "?" : "&") + "email=" + encodeURIComponent(o.email);

    var ov = document.createElement("div");
    ov.className = "jnp-ov"; ov.id = "jnp-ov";
    ov.innerHTML = ''
      + '<div class="jnp-card" role="dialog" aria-modal="true" aria-label="エルラボ＋ メンバーのご案内">'
      +   '<button class="jnp-close" type="button" aria-label="閉じる">×</button>'
      +   '<video class="jnp-video" controls playsinline preload="none" poster="' + (o.poster || CFG.poster) + '">'
      +     '<source src="' + (o.video || CFG.video) + '" type="video/mp4">'
      +   '</video>'
      +   '<div class="jnp-body">'
      +     '<p class="jnp-tag">MEMBERS</p>'
      +     '<h2 class="jnp-title">' + (o.title || CFG.title) + '</h2>'
      +     '<p class="jnp-lead">' + (o.lead || CFG.lead) + '</p>'
      +     '<a class="jnp-cta" href="' + url + '">' + (o.cta || CFG.cta) + '</a>'
      +     '<button class="jnp-later" type="button">' + CFG.later + '</button>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(ov);
    openNow = true;
    requestAnimationFrame(function(){ ov.classList.add("on"); });

    ov.querySelector(".jnp-close").onclick = function(){ close(o, CFG.snoozeDays); };
    ov.querySelector(".jnp-later").onclick = function(){ close(o, CFG.snoozeDays); };
    ov.addEventListener("click", function(ev){ if(ev.target === ov) close(o, CFG.snoozeDays); });
    ov.querySelector(".jnp-cta").onclick = function(ev){
      snooze(o.key, CFG.ctaSnoozeDays);
      if(typeof o.onCta === "function"){ ev.preventDefault(); openNow = false; o.onCta(); }
    };
    return true;
  }

  /* 画面下の細い帯。視聴を止めないご案内。押したら動画のポップを出す */
  function bar(o){
    o = o || {};
    if(!o.force && snoozed(o.key)) return false;
    if(document.getElementById("jnp-bar") || openNow) return false;
    injectCss();
    var el = document.createElement("div");
    el.className = "jnp-bar"; el.id = "jnp-bar";
    el.innerHTML = ''
      + '<p class="jnp-bt">' + (o.barText || CFG.barText) + '</p>'
      + '<button class="jnp-bgo" type="button">' + (o.barCta || CFG.barCta) + '</button>'
      + '<button class="jnp-bx" type="button" aria-label="閉じる">×</button>';
    document.body.appendChild(el);
    requestAnimationFrame(function(){ el.classList.add("on"); });
    function hide(){
      el.classList.remove("on");
      setTimeout(function(){ try{ el.remove(); }catch(e){} }, 300);
      snooze(o.key, CFG.snoozeDays);
    }
    el.querySelector(".jnp-bx").onclick = hide;
    el.querySelector(".jnp-bgo").onclick = function(){
      hide();
      show({ key:o.key + "_pop", email:o.email, force:true });   // 押した本人の意思なので出す
    };
    return true;
  }

  function cancel(){ if(pending){ clearTimeout(pending); pending = null; } }

  function arm(o){
    o = o || {};
    cancel();
    if(!o.force && snoozed(o.key)) return false;
    pending = setTimeout(function(){ pending = null; show(o); }, (o.delaySec || 2) * 1000);
    return true;
  }

  function reset(k){
    try{
      if(k){ localStorage.removeItem(skey(k)); return; }
      for(var i = localStorage.length - 1; i >= 0; i--){
        var n = localStorage.key(i);
        if(n && n.indexOf("lmjoinpop_") === 0) localStorage.removeItem(n);
      }
    }catch(e){}
  }

  window.LMJoin = { show: show, bar: bar, arm: arm, cancel: cancel,
                    reset: reset, config: CFG };
})();
