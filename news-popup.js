/* =====================================================================
   お知らせポップアップ案内
   ---------------------------------------------------------------------
   管理者が「ポップ案内オン」にしたお知らせを、関連ページ（アプリ／コラム／LP）で
   数秒後にポップアップ表示し、CTAボタンで誘導します。

   使い方：各ページの </body> 直前に次の1行を入れるだけ
     <script src="/news-popup.js" defer></script>

   データ元：GAS action=news（pub=公開 かつ pop=オン の最新1件を表示）
   閉じたら SNOOZE_DAYS 日は再表示しません（お知らせIDごと）。
   ===================================================================== */
(function () {
  "use strict";

  var CONFIG = {
    gasUrl: "https://script.google.com/macros/s/AKfycbzoOGUIcrH4yOWYyC7MzhvqRdxZqhhh3svfshpSdd0ht2LVUcVQSWyZhJrAG10wVxBT/exec",
    showAfterSec: 15,     // 表示までの秒数
    snoozeDays: 3,        // 閉じた後、再表示しない日数（お知らせIDごと）
    appUrl: "https://columns.l-mine.com/app/",   // CTA未指定時のデフォルト遷移先
    defaultCta: "詳しく見る →"
  };

  function isOn(v){ v = String(v==null?"":v).trim().toUpperCase(); return v==="TRUE"||v==="オン"||v==="ON"||v==="1"||v==="YES"; }
  function snoozed(id){ try{ var v = localStorage.getItem("newspop_"+id); return v && Number(v) > Date.now(); }catch(e){ return false; } }
  function snooze(id){ try{ localStorage.setItem("newspop_"+id, String(Date.now() + CONFIG.snoozeDays*864e5)); }catch(e){} }
  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }

  // Googleドライブの共有URL等 → 直接表示できる画像URLへ
  function toImg(u){
    u = String(u||"").replace(/^below\|/i, "").trim();
    if(!u) return "";
    var m = u.match(/(?:drive|docs)\.google\.com\/file\/d\/([\w-]{20,})/) || (/(?:drive|docs)\.google\.com/.test(u) && u.match(/[?&]id=([\w-]{20,})/));
    if(m) return "https://drive.google.com/thumbnail?id=" + m[1] + "&sz=w1000";
    return u;
  }
  // 本文 → 短い概要（リンク記法/URLを除去して約100字）
  function summary(body){
    var s = String(body||"");
    s = s.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1");   // [text](url) → text
    s = s.replace(/https?:\/\/\S+/g, "");                     // 生URL除去
    s = s.replace(/\s+/g, " ").trim();
    return s.length > 100 ? s.slice(0,100) + "…" : s;
  }

  function injectCss(){
    if(document.getElementById("nsp-css")) return;
    var css = ''
      + '.nsp-ov{position:fixed;inset:0;z-index:99998;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(10,10,12,.72);backdrop-filter:blur(3px);opacity:0;transition:opacity .35s ease}'
      + '.nsp-ov.on{opacity:1}'
      + '.nsp-card{position:relative;width:100%;max-width:400px;background:#14120e;color:#f2eede;border:1px solid rgba(227,195,129,.2);border-radius:16px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.55);transform:translateY(14px) scale(.98);transition:transform .35s ease;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif}'
      + '.nsp-ov.on .nsp-card{transform:none}'
      + '.nsp-close{position:absolute;top:10px;right:12px;width:32px;height:32px;border:0;background:rgba(0,0,0,.35);color:#fff;font-size:20px;line-height:1;cursor:pointer;border-radius:50%;z-index:2}'
      + '.nsp-img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;background:#0f0f14}'
      + '.nsp-body{padding:22px 22px 24px}'
      + '.nsp-ov-tag{font-size:11px;letter-spacing:.16em;color:#e3c381;font-weight:800;margin:0 0 8px}'
      + '.nsp-title{font-size:19px;line-height:1.45;font-weight:800;margin:0 0 8px}'
      + '.nsp-date{font-size:12px;color:#a49f93;margin:0 0 10px}'
      + '.nsp-lead{font-size:13.5px;line-height:1.8;color:#c9c3b4;margin:0 0 18px}'
      + '.nsp-cta{display:block;width:100%;text-align:center;padding:14px;border:0;border-radius:11px;background:linear-gradient(135deg,#e3c381,#c9a961);color:#241a06;font-weight:800;font-size:15px;text-decoration:none;cursor:pointer}'
      + '.nsp-cta:active{transform:translateY(1px)}'
      + '.nsp-later{display:block;width:100%;margin-top:10px;background:none;border:0;color:#8f8a7e;font-size:12.5px;cursor:pointer}';
    var st = document.createElement("style"); st.id = "nsp-css"; st.textContent = css; document.head.appendChild(st);
  }

  function show(item){
    injectCss();
    var img = toImg(item.image);
    var url = (item.popUrl && String(item.popUrl).trim()) || (CONFIG.appUrl + "?news=" + encodeURIComponent(item.id));
    var cta = (item.popCta && String(item.popCta).trim()) || CONFIG.defaultCta;
    var lead = summary(item.body);

    var ov = document.createElement("div"); ov.className = "nsp-ov";
    ov.innerHTML =
      '<div class="nsp-card" role="dialog" aria-label="お知らせ">'
      + '<button class="nsp-close" aria-label="閉じる">×</button>'
      + (img ? '<img class="nsp-img" src="'+esc(img)+'" alt="" onerror="this.style.display=\'none\'">' : '')
      + '<div class="nsp-body">'
      +   '<div class="nsp-ov-tag">📢 お知らせ</div>'
      +   '<div class="nsp-title">'+esc(item.title||"")+'</div>'
      +   (item.date ? '<div class="nsp-date">'+esc(String(item.date).replace(/-/g,"."))+'</div>' : '')
      +   (lead ? '<div class="nsp-lead">'+esc(lead)+'</div>' : '')
      +   '<a class="nsp-cta" href="'+esc(url)+'">'+esc(cta)+'</a>'
      +   '<button class="nsp-later">あとで</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function(){ ov.classList.add("on"); });

    function close(){ snooze(item.id); ov.classList.remove("on"); setTimeout(function(){ ov.remove(); }, 350); }
    ov.querySelector(".nsp-close").addEventListener("click", close);
    ov.querySelector(".nsp-later").addEventListener("click", close);
    ov.addEventListener("click", function(e){ if(e.target === ov) close(); });
    // CTAクリックは遷移させつつスヌーズも記録
    ov.querySelector(".nsp-cta").addEventListener("click", function(){ snooze(item.id); });
  }

  // ---- お知らせを取得して、ポップ対象を探す ----
  try{
    fetch(CONFIG.gasUrl + "?action=news&_=" + Date.now())
      .then(function(r){ return r.json(); })
      .then(function(d){
        var items = (d && d.items) || [];
        var item = null;
        for(var i=0;i<items.length;i++){
          var n = items[i];
          if(n && n.pub !== false && isOn(n.pop)){ item = n; break; }   // newsListは新しい順
        }
        if(!item || snoozed(item.id)) return;
        setTimeout(function(){ show(item); }, CONFIG.showAfterSec * 1000);
      })
      .catch(function(){});
  }catch(e){}
})();
