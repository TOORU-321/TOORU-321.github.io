/* auth-nav.js
   ログイン状態に応じて、サイトのヘッダー「ログイン」表示を切り替える。
   ・アプリ(app/)はログイン情報を localStorage "lmine_member" に保存している。
   ・サイトとアプリは同一オリジン(columns.l-mine.com)なので localStorage を共有できる＝Firebase不要。
   ・ログイン中：「ログイン」リンク → 「マイページ」に変更し、押すとアプリのマイページ(app/?p=mypage)へ。
   ・未ログイン：何もしない（「ログイン」のまま／押すとアプリでログイン）。
   使い方：各ページに <script src="/auth-nav.js" defer></script> を1行入れるだけ。
*/
(function () {
  function run() {
    var loggedIn = false;
    try {
      var raw = localStorage.getItem("lmine_member");
      var s = raw ? JSON.parse(raw) : null;
      loggedIn = !!(s && s.email);
    } catch (e) { loggedIn = false; }
    if (!loggedIn) return; // 未ログインは「ログイン」のまま

    var MYPAGE = "https://columns.l-mine.com/app/?p=mypage";
    var links = document.querySelectorAll('a[data-nav-login], a');
    Array.prototype.forEach.call(links, function (a) {
      var isMarked = a.hasAttribute("data-nav-login");
      var isLoginText = ((a.textContent || "").trim() === "ログイン");
      if (isMarked || isLoginText) {
        a.textContent = "マイページ";
        a.setAttribute("href", MYPAGE);
      }
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
