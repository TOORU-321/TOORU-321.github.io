/* track-remote.js : 計測をスプレッドシートへ送る（2026-09-10 とーる指示）
 *
 * これまで track.js は端末の中にログを残すだけだった。
 * それだと「DAY3のどの問いで止まったか」「オファーを何人が見たか」が分からない。
 *
 * 【守っていること】
 *  ・送るのは track.js が作った payload だけ。回答本文は入っていない
 *    （track.js が、決めた補助キーだけを通してから渡してくる）
 *  ・念のため、ここでも長い文字とURLらしきものは落とす
 *  ・本物の診断結果を持っている人だけ送る。プレビューは送らない
 *  ・1件ずつ送らない。少し溜めてから、まとめて送る
 *  ・画面を閉じるときに、残りを送る
 *  ・送れなくても画面は普段どおり動く
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  var FLUSH_DELAY = 3000;   /* これだけ待ってから、まとめて送る */
  var MAX_BATCH = 50;       /* 1回に送る上限。GAS側と同じ数 */
  var MAX_QUEUE = 200;      /* 溜めすぎない。あふれたら古いものから捨てる */

  var queue = [];
  var timer = null;

  function endpoint() {
    return (SC.endpoints && SC.endpoints.diagnosis) || null;
  }

  /* 長い文字とURLは落とす。回答本文が紛れ込んでも外へ出さないため */
  function safeMeta(payload) {
    var out = {};
    for (var k in payload) {
      if (!payload.hasOwnProperty(k)) continue;
      if (k === 'event' || k === 'timestamp' || k === 'day' || k === 'screen') continue;
      var v = payload[k];
      if (typeof v === 'string') {
        if (v.length > 120 || v.indexOf('http') > -1) continue;
        out[k] = v;
      } else if (typeof v === 'number' || typeof v === 'boolean') {
        out[k] = v;
      }
    }
    return out;
  }

  function identity() {
    var d = (SC.store && SC.store.loadDiagnosis) ? SC.store.loadDiagnosis() : null;
    return {
      anonymousDiagnosisId: (d && d.anonymousDiagnosisId) || null,
      uid: (d && d.lineUid) || null
    };
  }

  SC.trackRemote = {
    isEnabled: function () {
      return !!(SC.config && SC.config.trackingEnabled) && !!endpoint() && !!global.fetch &&
        !!(SC.store && SC.store.hasRealDiagnosis && SC.store.hasRealDiagnosis());
    },

    /* track.js から呼ばれる。ここでは溜めるだけ */
    push: function (payload) {
      if (!payload || !SC.trackRemote.isEnabled()) return false;
      queue.push({
        name: payload.event,
        at: payload.timestamp,
        day: (payload.day === 0 || payload.day) ? payload.day : null,
        screen: payload.screen || null,
        meta: safeMeta(payload)
      });
      if (queue.length > MAX_QUEUE) queue = queue.slice(queue.length - MAX_QUEUE);
      if (timer) global.clearTimeout(timer);
      timer = global.setTimeout(function () { SC.trackRemote.flush(); }, FLUSH_DELAY);
      return true;
    },

    /* 溜まっているぶんを送る。画面は待たない */
    flush: function () {
      if (timer) { global.clearTimeout(timer); timer = null; }
      if (!queue.length || !SC.trackRemote.isEnabled()) {
        return Promise.resolve({ ok: false, status: 'skipped' });
      }
      var events = queue.slice(0, MAX_BATCH);
      var rest = queue.slice(MAX_BATCH);
      queue = rest;

      var who = identity();
      return global.fetch(endpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'track',
          anonymousDiagnosisId: who.anonymousDiagnosisId,
          uid: who.uid,
          events: events
        }),
        referrerPolicy: 'no-referrer',
        keepalive: true
      }).then(function (res) {
        return res.ok ? res.json() : { ok: false, status: 'unavailable' };
      })['catch'](function () {
        /* 送れなかったぶんは戻して、次の機会に送る */
        queue = events.concat(queue).slice(-MAX_QUEUE);
        return { ok: false, status: 'unavailable' };
      });
    },

    /* 検証・テスト用 */
    _queue: function () { return queue.slice(); },
    _clear: function () {
      queue = [];
      if (timer) { global.clearTimeout(timer); timer = null; }
    }
  };

  /* 画面を閉じる・別のページへ移るときに、残りを送る。
   * pagehide はスマホでも呼ばれる（unload は呼ばれないことがある） */
  if (global.addEventListener) {
    global.addEventListener('pagehide', function () { SC.trackRemote.flush(); });
    global.addEventListener('visibilitychange', function () {
      if (global.document && global.document.visibilityState === 'hidden') {
        SC.trackRemote.flush();
      }
    });
  }
})(window);
