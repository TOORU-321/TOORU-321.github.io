/* challenge-remote.js : 5日間チャレンジの回答を、スプレッドシートへ残す
 * （2026-09-10 とーる指示。テストリリースに向けて、書いた中身を回収できるようにする）
 *
 * これまで、チャレンジで書いたものは端末の中にしか無かった。
 * ブラウザのデータを消されると、その人の5日間は消える。
 * どこで手が止まったか、何を書いたかも回収できない。
 *
 * 【守っていること】
 *  ・本物の診断結果を持っている人だけ送る。プレビュー（サンプル47点）は送らない
 *  ・画面は待たせない。送れなくても、いつもどおり動く
 *  ・同じ内容を続けて送らない
 *  ・送り先は診断と同じGAS。ここに新しい接続先は作らない
 *  ・uid は送るが、画面・URL・計測へは出さない
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  /* 直前に送った内容。同じなら送らない（保存のたびに呼ばれるため） */
  var lastSent = '';
  /* 書きかけを送るまでの待ち時間 */
  var SOON_DELAY = 8000;
  var soonTimer = null;

  function endpoint() {
    return (SC.endpoints && SC.endpoints.diagnosis) || null;
  }

  /* 一本線シートの5行。スプレッドシートで一目で読めるように文字で持つ */
  function summaryOf(state) {
    var parts = [];
    ['day1', 'day2', 'day3', 'day4', 'day5'].forEach(function (key) {
      var mod = SC[key];
      if (!mod || typeof mod.summary !== 'function') return;
      try {
        var text = mod.summary(state);
        if (text) parts.push(text);
      } catch (e) { /* まだ答えていない日は飛ばす */ }
    });
    return parts.join(' / ');
  }

  SC.challengeRemote = {
    isEnabled: function () {
      return !!endpoint() && !!global.fetch &&
        !!(SC.store && SC.store.hasRealDiagnosis && SC.store.hasRealDiagnosis());
    },

    buildRecord: function (state) {
      var d = (SC.store && SC.store.loadDiagnosis) ? SC.store.loadDiagnosis() : null;
      return {
        anonymousDiagnosisId: (d && d.anonymousDiagnosisId) || null,
        uid: (d && d.lineUid) || null,
        challengeVersion: state.challengeVersion || null,
        participation: state.participation || null,
        currentScreen: state.currentScreen || null,
        completedDays: state.completedDays || [],
        day5CompletedAt: state.day5CompletedAt || null,
        supportMode: (state.day5 && state.day5.supportMode) || null,
        blueprint: summaryOf(state),
        /* 本人が書いたものは、まとめてそのまま残す。
         * 診断結果は別のシートにあるので、ここには入れない */
        answers: state
      };
    },

    /* 画面からは戻り値を待たない。失敗しても次の保存でまた送られる */
    save: function (state) {
      if (!SC.challengeRemote.isEnabled()) {
        return Promise.resolve({ ok: false, status: 'skipped' });
      }
      var record = SC.challengeRemote.buildRecord(state);
      if (!record.anonymousDiagnosisId) {
        return Promise.resolve({ ok: false, status: 'no_id' });
      }
      var body = JSON.stringify({ action: 'save_challenge', record: record });
      if (body === lastSent) {
        return Promise.resolve({ ok: true, status: 'unchanged' });
      }
      lastSent = body;

      return global.fetch(endpoint(), {
        method: 'POST',
        /* text/plain にすると事前確認の通信が起きず、GAS側でそのまま受け取れる */
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: body,
        referrerPolicy: 'no-referrer',
        keepalive: true
      }).then(function (res) {
        return res.ok ? res.json() : { ok: false, status: 'unavailable' };
      })['catch'](function () {
        /* 失敗を覚えない。次の保存で送り直せるようにする */
        lastSent = '';
        return { ok: false, status: 'unavailable' };
      });
    },

    /* サーバーに残っている続きを取りに行く（2026-09-11）。
     *
     * それまで index.html は端末の中しか見ていなかったので、
     * 途中でブラウザが変わると古いほうの画面が出ていた。
     *
     * ★取ってくるだけ。採用するかどうかは store が決める
     *   （手元のほうが新しければ、そのまま）。
     * ★LINEと結びついている人だけ。uidが無いと誰の続きか分からない。
     * ★失敗しても null を返す。画面は止めない。 */
    fetchLatest: function () {
      if (!SC.challengeRemote.isEnabled()) return Promise.resolve(null);
      var d = (SC.store && SC.store.loadDiagnosis) ? SC.store.loadDiagnosis() : null;
      var uid = d && d.lineUid;
      if (!uid) return Promise.resolve(null);

      return global.fetch(endpoint(), {
        method: 'POST',
        /* text/plain にすると事前確認の通信が起きず、GAS側でそのまま受け取れる */
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'restore', uid: uid }),
        referrerPolicy: 'no-referrer'
      }).then(function (res) {
        return res.ok ? res.json() : null;
      }).then(function (json) {
        if (!json || !json.ok || !json.challenge) return null;
        return json.challenge.answers || null;
      })['catch'](function () { return null; });
    },

    /* 書きかけの文字は、少し待ってから送る。
     * 1文字ごとに通信すると、GASの回数の上限にすぐ届いてしまう */
    saveSoon: function (state) {
      if (!SC.challengeRemote.isEnabled()) return false;
      if (soonTimer) global.clearTimeout(soonTimer);
      soonTimer = global.setTimeout(function () {
        soonTimer = null;
        SC.challengeRemote.save(state);
      }, SOON_DELAY);
      return true;
    },

    /* 検証・テスト用 */
    _reset: function () {
      lastSent = '';
      if (soonTimer) { global.clearTimeout(soonTimer); soonTimer = null; }
    }
  };
})(window);
