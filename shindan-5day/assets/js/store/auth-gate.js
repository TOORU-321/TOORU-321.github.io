/* auth-gate.js : サーバーが断ってきたとき、どの画面を出すかを決める
 *
 * （2026-09-19 とーる指示／Codex §4。GAS控え v1.11.0 と対になる）
 *
 * 【分けていること】
 *  ・券が無い・期限切れ・失効（'reauth'）
 *      → 確認のやり直しへ案内する
 *  ・券は使えるが、その記録への権限が無い（'forbidden' / 'denied'）
 *      → 権限不足として知らせる。やり直しても変わらないので、そこへは送らない
 *  ・通信できなかった・一時的に受け付けられない（'unavailable' / 'busy'）
 *      → ★確認のやり直しへ誤って誘導しない。通信の案内にする
 *
 * 【ループを作らないために】
 *  ・確認のやり直しは、1ページの中で MAX 回まで。
 *    それ以上は権限不足として扱い、行き止まりにせず戻れるようにする。
 *  ・コードが通ったあとも同じ断り方が続くなら、
 *    それは「券が古い」のではなく「その記録との関係がまだ無い」ということ。
 *    もう一度コードを求めても直らない。
 *
 * ★ここは判断だけ。画面も通信も持たない。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  /* 1ページの中で、確認のやり直しへ送ってよい回数。
   * 1回目でうまくいかなかったときの入れ直しを見込んで2回。 */
  var MAX_REAUTH = 2;
  var shown = 0;
  var redeemed = 0;

  SC.authGate = {
    /* サーバーの status から、出すべき画面を決める。
     *   'reauth'    … 確認のやり直し
     *   'forbidden' … 権限不足の案内
     *   'retry'     … 通信・一時停止の案内（やり直しへは送らない）
     *   null        … 券の話ではない（これまでどおりの扱い） */
    decide: function (status) {
      if (status === 'reauth') {
        return SC.authGate.canReauth() ? 'reauth' : 'forbidden';
      }
      if (status === 'forbidden' || status === 'denied') return 'forbidden';
      if (status === 'unavailable' || status === 'busy') return 'retry';
      return null;
    },

    canReauth: function () { return shown < MAX_REAUTH; },

    /* 確認のやり直しの画面を出した */
    noteReauthShown: function () { shown++; return shown; },

    /* コードが通って、券を受け取れた */
    noteRedeemed: function () { redeemed++; return redeemed; },

    _state: function () {
      return { shown: shown, redeemed: redeemed, max: MAX_REAUTH };
    },

    /* 検証・テスト用 */
    _reset: function () { shown = 0; redeemed = 0; }
  };
})(window);
