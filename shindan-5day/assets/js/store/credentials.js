/* credentials.js : アクセス資格（券）と、新規保存のやり直しの合図（nonce）を、
 * この端末の中だけで持っておく場所。
 *
 * （2026-09-19 とーる指示／Codex設計。GAS控え v1.10.0 と対になる）
 *
 * 【守っていること】
 *  ・券・コード・nonce は**秘密情報**。
 *    URL・計測・回答本文・ログのどれにも混ぜない
 *  ・回答や成果物とは**別のキー**に置く。
 *    （チャレンジの保存はまるごとサーバーへ送られるので、そこへ入れない）
 *  ・券は2種類ある。確かめた範囲が違うので、置き場所も分ける
 *      diagnosis … 対象の診断記録へのアクセス資格（診断ごと）
 *      line      … 確認したLINEアカウントへのアクセスに基づく資格（この端末に1つ）
 *  ・消すのは、本人の操作か、サーバーが「もう使えない」と答えたときだけ
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  /* 券の置き場所は、ここで決める（2026-09-19）。
   *
   * ★どのページでも同じ名前にする。
   *   診断ページと5DAYでは SC.config の appId が違うので、
   *   どちらかの設定に寄せると、片方で保存した券を
   *   もう片方が見つけられなくなる。
   * ★設問の版は混ぜない。
   *   券はサーバーの診断記録に結びつくもので、設問の版とは関係がない。
   *   混ぜると、設問を差し替えただけで券が行方不明になる。
   * ★ページごとの設定（SC.diagnosisConfig）に頼らない。
   *   5DAY本体には読み込まれておらず、そこで読もうとすると落ちていた。 */
  var CRED_APP = 'lmine-shindan';
  var CRED_VER = 'v1';

  function credKey(id) { return [CRED_APP, CRED_VER, 'cred', id || 'draft'].join(':'); }
  function lineKey() { return [CRED_APP, CRED_VER, 'line_cred'].join(':'); }

  function readObj(key) {
    var entry = SC.storage.readEntry(key);
    return (entry.status === 'ok' && entry.value && typeof entry.value === 'object')
      ? entry.value : null;
  }

  /* 意味のない文字列を作る。ブラウザの乱数を使い、無ければ作れないと答える */
  function randomText(bytes) {
    var crypto = global.crypto || global.msCrypto;
    var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var out = '';
    var i;
    if (crypto && crypto.getRandomValues) {
      var buf = new Uint8Array(bytes);
      crypto.getRandomValues(buf);
      for (i = 0; i < bytes; i++) out += chars.charAt(buf[i] % chars.length);
      return out;
    }
    /* 乱数が使えない環境。やり直しの合図は作らない（推測できる値を使わない） */
    return null;
  }

  SC.credentials = {
    /* ---------- 診断ごとの券 ---------- */

    /* その診断の券を出す。無ければ null */
    diagnosisTicket: function (id) {
      if (!id) return null;
      var v = readObj(credKey(id));
      return (v && typeof v.token === 'string' && v.token) ? v.token : null;
    },

    /* 券をしまう。
     * ★前の券は上書きするが、**サーバー側では失効していない**。
     *   応答が前後して届いても、どちらを持っていても通る作りになっている。 */
    saveDiagnosisTicket: function (id, token) {
      if (!id || !token) return false;
      var v = readObj(credKey(id)) || {};
      v.token = String(token);
      v.level = 'diagnosis';
      v.savedAt = new Date().toISOString();
      return SC.storage.write(credKey(id), v) !== false;
    },

    /* その診断の券だけを捨てる（2026-09-19）。
     * ★サーバーが「もう使えない」と答えたときだけ呼ぶ。
     * ★合図（nonce）は残す。消すと同じ内容が別の記録として増えてしまう。 */
    clearDiagnosisTicket: function (id) {
      if (!id) return false;
      var v = readObj(credKey(id));
      if (!v) return false;
      delete v.token;
      delete v.level;
      return SC.storage.write(credKey(id), v) !== false;
    },

    /* ---------- やり直しの合図（nonce） ---------- */

    /* その下書きに使う合図。無ければ作る。
     * ★同じ合図で送り直すと、サーバーは同じ診断IDを返す（記録が増えない） */
    nonceFor: function (id) {
      if (!id) return null;
      var v = readObj(credKey(id)) || {};
      if (typeof v.nonce === 'string' && v.nonce) return v.nonce;
      var made = randomText(24);
      if (!made) return null;
      v.nonce = made;
      SC.storage.write(credKey(id), v);
      return made;
    },

    /* ---------- LINEアカウントの券（この端末に1つ） ---------- */

    lineTicket: function () {
      var v = readObj(lineKey());
      return (v && typeof v.token === 'string' && v.token) ? v.token : null;
    },

    saveLineTicket: function (token) {
      if (!token) return false;
      return SC.storage.write(lineKey(), {
        token: String(token), level: 'line', savedAt: new Date().toISOString()
      }) !== false;
    },

    clearLineTicket: function () { return SC.storage.remove(lineKey()); },

    /* ---------- 読み替え（下書きID → サーバーが決めたID） ---------- */

    /* 券と合図を、新しいIDの下へ移す。
     * ★元のほうは消さない。消すのは診断の保存を移し終えたあと（store 側）。 */
    moveTo: function (fromId, toId) {
      if (!fromId || !toId || fromId === toId) return false;
      var from = readObj(credKey(fromId));
      if (!from) return false;
      /* ★移す先にすでに券があれば、そちらを残す。
       *   保存より先に券を受け取っていることがあるので、上書きすると消えてしまう
       *   （2026-09-19：テストで見つけた不具合）。 */
      var to = readObj(credKey(toId)) || {};
      var merged = {};
      var k;
      for (k in from) if (Object.prototype.hasOwnProperty.call(from, k)) merged[k] = from[k];
      for (k in to) if (Object.prototype.hasOwnProperty.call(to, k)) merged[k] = to[k];
      return SC.storage.write(credKey(toId), merged) !== false;
    },

    forget: function (id) { if (id) SC.storage.remove(credKey(id)); },

    /* ---------- 検証用 ---------- */
    _keys: function (id) { return { cred: credKey(id), line: lineKey() }; }
  };
})(window);
