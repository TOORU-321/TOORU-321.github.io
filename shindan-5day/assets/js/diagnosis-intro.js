/* diagnosis-intro.js : 診断のはじめかた（LP → 設問 のあいだ）
 *
 * 2026-08-24 とーる指示。結果ページで使っているテキスト型VSLと同じ見せ方で、
 * 1タップ＝1メッセージ。読み切ったら「診断をはじめる」で光に包まれ、設問へ移る。
 *
 * ★同日の追加指示：
 *   「その文字演出以外『なし』がいいです。シンプルに案内メッセージと次へボタン。
 *     プログレスもタイトルも下部の補足文も不要です」
 *   「なので枠もいりません！それだけに集中させたいです！」
 *
 *   → 見出し・進み具合・戻る・補足文・逃げ道・カードの枠は、すべて置かない。
 *     画面にあるのは「文章」と「次へ」だけ。
 *
 * ★この画面にライティング要素をまとめ、設問ページは設問だけにしておく。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;
  var doc = global.document;

  var QUESTION_URL = 'shindan.html';
  var FLASH_MS = 1000;

  function c() { return SC.diagnosisIntroCopy; }
  function track(name, meta) { return SC.diagnosisTrack.event(name, meta); }

  /* 光に包まれてから設問へ移る。
   * 動きが苦手な設定と、演出が動かない環境では、待たせずそのまま移る。 */
  function startDiagnosis(via) {
    track('diagnosis_intro_started', { cta: via });

    if (!SC.motion.allowed()) { global.location.href = QUESTION_URL; return; }

    /* 設問ページで「光の続き」から始めるための印。
     * この場かぎりの合図なので sessionStorage（タブを閉じれば消える）。
     * Referrer-Policy を no-referrer にしているため、referrer では判定できない。 */
    try { global.sessionStorage.setItem('sc_from_intro', '1'); } catch (e) { /* noop */ }

    var flash = h('div', { class: 'dg-flash', 'aria-hidden': 'true' });
    doc.body.appendChild(flash);
    /* requestAnimationFrame は画面が裏だと動かないので、短いタイマーで付ける */
    global.setTimeout(function () { flash.classList.add('is-on'); }, 20);
    /* 光が届かなくても必ず移る */
    global.setTimeout(function () { global.location.href = QUESTION_URL; }, FLASH_MS);
  }

  function boot() {
    var root = doc.getElementById('dg-app');
    var copy = c();

    track('diagnosis_intro_view');

    var deck = SC.ui.storyDeck({
      id: 'dg-intro-deck',
      label: copy.title,
      /* 文章だけに集中させる。進み具合・戻る・まとめて読むは出さない */
      progress: 'none',
      prev: false,
      toggle: false,
      steps: copy.cards.map(function (card) {
        return { body: card.body, note: card.sign || null };
      }),
      finalCta: {
        label: copy.startCta,
        onClick: function () { startDiagnosis('deck'); }
      },
      onStep: function (index) {
        track('diagnosis_intro_step', { cta: 'card' + (index + 1) });
      }
    });

    /* 枠も見出しも置かない。文章と次へだけ */
    SC.dom.append(root, [h('div', { class: 'dg-intro' }, [deck])]);

    var first = root.querySelector('.deck__body, .deck__step');
    if (first) { first.setAttribute('tabindex', '-1'); first.focus({ preventScroll: true }); }
  }

  SC.diagnosisIntroApp = { boot: boot, start: startDiagnosis, QUESTION_URL: QUESTION_URL };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
