/* storage-adapter.js : 保存の実体。Phase1はlocalStorage。
 * 画面からはここを直接呼ばず、必ず challenge-store.js 経由にする。
 * Phase2でGAS／スプレッドシートへ差し替えるときは、このファイルの
 * read / write / remove を非同期実装へ置き換える（呼び出し側の責務は変えない）。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  var memory = {};
  var hasLocalStorage = (function () {
    try {
      var k = '__sc_probe__';
      global.localStorage.setItem(k, '1');
      global.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  })();

  SC.storage = {
    /* localStorageが使えない環境（プライベートモード等）でも画面は動く */
    available: hasLocalStorage,
    driver: hasLocalStorage ? 'localStorage' : 'memory',

    /* 未保存とJSON破損を区別して返す。呼び出し側で初期化・復旧を分けられる */
    readEntry: function (key) {
      var raw;
      try {
        raw = hasLocalStorage ? global.localStorage.getItem(key) : (key in memory ? memory[key] : null);
      } catch (e) {
        return { status: 'missing', value: null };
      }
      if (raw === null || raw === undefined) return { status: 'missing', value: null };
      try {
        return { status: 'ok', value: JSON.parse(raw) };
      } catch (e2) {
        return { status: 'corrupt', value: null };
      }
    },

    read: function (key) { return SC.storage.readEntry(key).value; },

    /* どこへ書けたかまで返す（2026-09-16 Codex指示）。
     *
     * これまでの write() は、このページの中だけの仮置き（memory）でも true を返していた。
     * 「この端末に残っています」と画面で言うには、それでは足りない。
     *
     *  'persisted' … localStorage へ書けて、読み戻せた（閉じても残る）
     *  'memory'    … このページの中だけ。閉じる・再読み込みで消える
     *  'failed'    … 書けなかった
     *
     * ★書いたつもりで消えていることがある（容量いっぱい・プライベート設定）ので、
     *   localStorage のときは読み戻して確かめる。 */
    writeState: function (key, value) {
      var raw = JSON.stringify(value);
      try {
        if (hasLocalStorage) {
          global.localStorage.setItem(key, raw);
          return global.localStorage.getItem(key) === raw ? 'persisted' : 'failed';
        }
        memory[key] = raw;
        return 'memory';
      } catch (e) {
        return 'failed';
      }
    },

    /* 以前からの入口。書けたかどうかだけを返す（memory も true のまま） */
    write: function (key, value) {
      return SC.storage.writeState(key, value) !== 'failed';
    },

    remove: function (key) {
      try {
        if (hasLocalStorage) global.localStorage.removeItem(key);
        else delete memory[key];
        return true;
      } catch (e) {
        return false;
      }
    },

    /* このアプリの保存キーだけを列挙（他アプリのキーは触らない） */
    keysOfApp: function () {
      var prefix = SC.config.appId + ':';
      var out = [];
      if (!hasLocalStorage) {
        for (var mk in memory) if (mk.indexOf(prefix) === 0) out.push(mk);
        return out;
      }
      for (var i = 0; i < global.localStorage.length; i++) {
        var k = global.localStorage.key(i);
        if (k && k.indexOf(prefix) === 0) out.push(k);
      }
      return out;
    }
  };
})(window);
