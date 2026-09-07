/* notify.js : 進み具合をLINEへ知らせる（2026-09-07）
 *
 * 「参加した」「DAY◯が終わった」をGASへ伝えると、
 * GASがプロラインのシナリオを起動して、LINEへ案内が届く。
 *
 * ★call-beacon のURLはここには無い。GASのスクリプトプロパティにある。
 *   ブラウザへ置くと、知った人が誰の配信でも起こせてしまうため
 *   （[[proline_dev_reference]] の決まり）。
 *
 * ★このファイルは診断側のファイルに依存しない。
 *   5DAY本体は診断の内部構造を知らないままでいる（診断→5DAYの受け渡しと同じ方針）。
 *
 * ★送れるのは、LINEと結合できた人だけ。
 *   uid は diagnosisBridge が記録した lineUid を使う。
 *   結合していない人（LINEを経由していない人）には送らない。
 *
 * ★二重送信はGAS側で止める（uid × きっかけ で1回だけ）。
 *   ここでも同じ端末では送ったことを覚えておき、無駄な通信をしない。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  /* GASが受け付けるきっかけ。ここに無いものは送らない */
  var EVENTS = [
    'joined',      /* 5日間に参加した   → DAY1案内 */
    'day1_done',   /* DAY1が終わった    → DAY2案内 */
    'day2_done',
    'day3_done',
    'day4_done',
    'day5_done'    /* DAY5が終わった    → 完了者向け */
  ];

  function sentKey() {
    var c = SC.config;
    return [c.appId, c.campaignId, c.storageVersion, 'notified'].join(':');
  }

  function readSent() {
    var v = SC.storage.read(sentKey());
    return (v && typeof v === 'object') ? v : {};
  }

  function endpoint() {
    return (SC.endpoints && SC.endpoints.diagnosis) || null;
  }

  SC.notify = {
    EVENTS: EVENTS,

    /* この端末で、そのきっかけを送り終えているか */
    alreadySent: function (event) { return readSent()[event] === true; },

    /* 進み具合を知らせる。
     * 送れなくても画面は止めない（通知はおまけで、体験の本筋ではない）。 */
    send: function (event) {
      if (EVENTS.indexOf(event) === -1) {
        return Promise.resolve({ ok: false, status: 'invalid' });
      }
      if (SC.notify.alreadySent(event)) {
        return Promise.resolve({ ok: true, status: 'skipped' });
      }

      var d = SC.store.loadDiagnosis();
      var uid = d && d.lineUid;
      /* LINEを経由していない人には送らない（uidを持っていない） */
      if (!uid) return Promise.resolve({ ok: false, status: 'no_uid' });

      var url = endpoint();
      if (!url || !global.fetch) {
        return Promise.resolve({ ok: false, status: 'unavailable' });
      }

      return global.fetch(url, {
        method: 'POST',
        /* text/plain にすると事前確認の通信が起きず、GAS側でそのまま受け取れる */
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'notify', uid: uid, event: event }),
        referrerPolicy: 'no-referrer'
      }).then(function (res) {
        return res.ok ? res.json() : { ok: false, status: 'unavailable' };
      }).then(function (json) {
        /* 送れた／すでに送ってあった、のどちらでも覚えておく */
        if (json && json.ok) {
          var sent = readSent();
          sent[event] = true;
          SC.storage.write(sentKey(), sent);
        }
        return json || { ok: false, status: 'unavailable' };
      })['catch'](function () {
        /* 失敗しても覚えない。次に開いたときに送り直せる */
        return { ok: false, status: 'unavailable' };
      });
      /* ★uid はここまで一度も画面・URL・計測へ出していない */
    },

    /* 開発・テスト用。送った記録を消す */
    _clearSent: function () { SC.storage.remove(sentKey()); }
  };
})(window);
