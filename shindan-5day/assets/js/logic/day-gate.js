/* day-gate.js : 1日にひとつのDAYだけ開く（2026-09-11 とーる判断）
 *
 * 【なぜ】
 * それまでは、DAYを終えたらそのまま次のDAYへ進めた。
 * ところがLINEのシナリオは、もともと1日1DAYで書かれている。
 *
 *   DAY1完了直後 「明日のDAY2は…明日の朝、ご案内しますね」
 *   その1日後の9時 「今日はDAY2のご案内です」
 *
 * つまり、アプリだけが約束を破っていた。
 *
 * もうひとつ、企画としての理由がある。
 * 一気に終える人は、こちらと接する「日数」が1日で終わってしまう。
 * 5日間かけて毎日会うことに意味がある企画なので、日をまたいでもらう。
 *
 * 【決めごと】
 * ・次のDAYは、日付が変わったら開く（完了から24時間ではない）
 *   → LINEの案内は翌日の9時・20時に届くので、必ず開いたあとに届く
 * ・端末の時計をそのまま使う。ずれていても、本人の体感と一致するほうを選ぶ
 * ・?dev=1 のときは通す（校正で5日ぶんを続けて見るため）
 *
 * ★ここは「開いてよいか」を答えるだけ。画面の出し分けは app.js と画面側で行う。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  var LAST_DAY = 5;

  /* その日のうちかどうかは、時刻ではなく日付で見る。
   * 23:50にDAY1を終えた人は、10分後に日付が変われば次へ進める。
   * 「24時間待て」より分かりやすく、LINEの案内とも噛み合う。 */
  function dateKey(d) {
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function completedAtOf(state, day) {
    var v = state && state['day' + day + 'CompletedAt'];
    if (!v) return null;
    var t = Date.parse(v);
    return isNaN(t) ? null : new Date(t);
  }

  function lastCompletedDay(state) {
    var days = (state && state.completedDays) || [];
    var last = 0;
    for (var i = 0; i < days.length; i++) {
      var n = parseInt(days[i], 10);
      if (!isNaN(n) && n > last) last = n;
    }
    return last;
  }

  SC.dayGate = {
    LAST_DAY: LAST_DAY,

    /* 決まりが効いているか。切りたくなったら config を false にする */
    isOn: function () {
      if (SC.config.devTools && SC.config.devTools()) return false;
      return SC.config.oneDayPerDay !== false;
    },

    /* いま開いてよいいちばん先のDAY。
     *   まだ何も終えていない          → 1
     *   今日DAY2を終えた              → 2（DAY3は明日）
     *   昨日までにDAY2を終えた        → 3 */
    openDay: function (state) {
      /* 決まりが切れているときは、いちばん先まで開いている扱いにする。
       * ★ここを先に見ること。あとに置くと、まだ何も終えていない人にも
       *   DAY1しか開かない答えを返してしまう（2026-09-11 自己テストで検出）。 */
      if (!SC.dayGate.isOn()) return LAST_DAY;

      var last = lastCompletedDay(state);
      if (!last) return 1;
      if (last >= LAST_DAY) return LAST_DAY;

      var at = completedAtOf(state, last);
      /* 完了の時刻が残っていない古い保存は、止めない（閉じ込めないほうを選ぶ） */
      if (!at) return Math.min(last + 1, LAST_DAY);

      var sameDay = dateKey(at) === dateKey(new Date());
      return sameDay ? last : Math.min(last + 1, LAST_DAY);
    },

    /* そのDAYは、いま閉じているか */
    isLocked: function (day, state) {
      return day > SC.dayGate.openDay(state);
    },

    /* 画面IDが何日目のものか。診断結果など、DAYに属さないものは0 */
    dayOfScreen: function (screenId) {
      var m = /^day([1-5])_/.exec(String(screenId || ''));
      return m ? parseInt(m[1], 10) : 0;
    },

    /* 次に開くのはいつか。開いているなら null */
    opensAt: function (state) {
      var last = lastCompletedDay(state);
      if (!last || last >= LAST_DAY || !SC.dayGate.isOn()) return null;
      var at = completedAtOf(state, last);
      if (!at || dateKey(at) !== dateKey(new Date())) return null;
      var next = new Date();
      next.setHours(24, 0, 0, 0);   /* 今日の終わり＝明日の0時 */
      return next;
    }
  };
})(window);
