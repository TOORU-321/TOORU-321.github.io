/* コラム追従ポップアップ：一定スクロールで出現／×で閉じたら一定期間抑制 */
(function () {
  var KEY = 'lm_popup_closed_at';
  var SUPPRESS_DAYS = 7;          // 閉じたら7日間は出さない
  var SHOW_RATIO = 0.4;           // 記事の40%スクロールで出現
  var SHOW_ABS_PX = 1200;         // ↑に達しなくても1200px（画面約2〜3枚）スクロールで出現（長文記事対策）

  var el = document.getElementById('lm-popup');
  if (!el) return;

  // 直近で閉じていれば出さない
  try {
    var t = localStorage.getItem(KEY);
    if (t && (Date.now() - parseInt(t, 10)) < SUPPRESS_DAYS * 86400000) return;
  } catch (e) {}

  var shown = false;
  function maybeShow() {
    if (shown) return;
    var sc = window.scrollY || document.documentElement.scrollTop;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    if (h > 0 && (sc / h >= SHOW_RATIO || sc >= SHOW_ABS_PX)) {
      shown = true;
      el.classList.add('show');
      el.setAttribute('aria-hidden', 'false');
      window.removeEventListener('scroll', maybeShow);
    }
  }
  window.addEventListener('scroll', maybeShow, { passive: true });
  maybeShow();

  var closeBtn = el.querySelector('.lm-pop-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      el.classList.remove('show');
      el.setAttribute('aria-hidden', 'true');
      try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
    });
  }
})();
