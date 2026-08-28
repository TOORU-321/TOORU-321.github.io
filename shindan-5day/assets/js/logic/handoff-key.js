/* handoff-key.js : 引き継ぎキーの発行・判定（依頼8）
 *
 * 引き継ぎキーの条件（Notion §41-A）
 *   ・十分に推測困難なランダム値
 *   ・一回限り／短い有効期限
 *   ・URLへ載せない
 *   ・Notion・計測ログ・ブラウザログへ平文で出さない
 *   ・結合成功後は再利用不可、期限切れ後は利用不可
 *
 * サーバー（GAS）へはハッシュだけを送るのが既定。
 * ハッシュ計算ができない環境でだけ平文を送り、サーバー側でハッシュ化する。
 * どちらの場合もサーバーは平文を長期保存しない。
 *
 * ★ユーザー向け画面で「コード」「認証コード」「トークン」と呼ばない（§41-A）。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  /* 読み違えやすい I O 0 1 を外した32文字 */
  var ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var PREFIX = 'L5';
  var GROUPS = 4;        /* 5文字 × 4組 = 20文字 ＝ 約100ビット */
  var GROUP_LEN = 5;
  var PATTERN = new RegExp(
    '^' + PREFIX + '(?:-[' + ALPHABET + ']{' + GROUP_LEN + '}){' + GROUPS + '}$'
  );

  function randomValues(count) {
    var out = new Array(count);
    var crypto = global.crypto || global.msCrypto;
    if (crypto && crypto.getRandomValues) {
      var buf = new Uint8Array(count);
      crypto.getRandomValues(buf);
      for (var i = 0; i < count; i++) out[i] = buf[i];
      return out;
    }
    /* 暗号用の乱数が無い環境。開発版の動作確認のためだけの代替。
     * 本番接続前に必ず crypto.getRandomValues のある環境で使うこと。 */
    for (var j = 0; j < count; j++) out[j] = Math.floor(Math.random() * 256);
    return out;
  }

  SC.handoffKey = {
    PATTERN: PATTERN,

    /* この環境で暗号用の乱数が使えるか（実装記録・自己診断用） */
    hasSecureRandom: function () {
      var c = global.crypto || global.msCrypto;
      return !!(c && c.getRandomValues);
    },

    /* 新しい引き継ぎキーを作る */
    issue: function () {
      var total = GROUPS * GROUP_LEN;
      var bytes = randomValues(total);
      var chars = [];
      for (var i = 0; i < total; i++) {
        /* 32文字なので下位5ビットだけを使う（偏りが出ない） */
        chars.push(ALPHABET.charAt(bytes[i] % ALPHABET.length));
      }
      var parts = [PREFIX];
      for (var g = 0; g < GROUPS; g++) {
        parts.push(chars.slice(g * GROUP_LEN, (g + 1) * GROUP_LEN).join(''));
      }
      return parts.join('-');
    },

    /* 貼り付け・クリップボードから拾った文字列を、キーの形へそろえる。
     * 前後の空白や改行、小文字、全角ハイフンを吸収する。
     * 形が合わないときは null（＝キーではない）を返す。 */
    normalize: function (text) {
      if (typeof text !== 'string') return null;
      var t = text
        .replace(/[　\s]+/g, '')
        .replace(/[‐-―－ー]/g, '-')
        .toUpperCase();
      /* 前後に説明文が付いていても、キーの部分だけ拾う */
      var m = new RegExp(
        PREFIX + '(?:-?[' + ALPHABET + ']{' + GROUP_LEN + '}){' + GROUPS + '}'
      ).exec(t);
      if (!m) return null;
      var body = m[0].slice(PREFIX.length).replace(/-/g, '');
      if (body.length !== GROUPS * GROUP_LEN) return null;
      var parts = [PREFIX];
      for (var g = 0; g < GROUPS; g++) {
        parts.push(body.substr(g * GROUP_LEN, GROUP_LEN));
      }
      var key = parts.join('-');
      return PATTERN.test(key) ? key : null;
    },

    isValidFormat: function (key) {
      return typeof key === 'string' && PATTERN.test(key);
    },

    /* サーバーへ渡す形を作る。
     * 返り値 { keyHash: '…' }（推奨）または { key: '…' }（ハッシュ不可の環境）。
     * 平文はここから先へ持ち出さない。 */
    forTransport: function (key) {
      var subtle = global.crypto && global.crypto.subtle;
      if (!subtle || !subtle.digest || !global.TextEncoder) {
        return Promise.resolve({ key: key, hashed: false });
      }
      var bytes = new global.TextEncoder().encode(key);
      return subtle.digest('SHA-256', bytes).then(function (buf) {
        var view = new Uint8Array(buf);
        var hex = '';
        for (var i = 0; i < view.length; i++) {
          hex += (view[i] < 16 ? '0' : '') + view[i].toString(16);
        }
        return { keyHash: hex, hashed: true };
      })['catch'](function () {
        return { key: key, hashed: false };
      });
    },

    /* 有効期限の判定（サーバーが正。ここは画面の出し分け用の目安） */
    isExpired: function (issuedAtIso, ttlMinutes, nowMs) {
      if (!issuedAtIso) return true;
      var issued = Date.parse(issuedAtIso);
      if (isNaN(issued)) return true;
      var now = nowMs === undefined ? Date.now() : nowMs;
      return now - issued > (ttlMinutes * 60 * 1000);
    },

    remainingMinutes: function (issuedAtIso, ttlMinutes, nowMs) {
      var issued = Date.parse(issuedAtIso);
      if (isNaN(issued)) return 0;
      var now = nowMs === undefined ? Date.now() : nowMs;
      var left = (ttlMinutes * 60 * 1000) - (now - issued);
      return Math.max(0, Math.ceil(left / 60000));
    }
  };
})(window);
