/* config-diagnosis.js : 診断（21問）側の定数。
 * 5DAY本体の config.js とは分ける。保存キーも別名前空間にして、
 * 公開中のモニター版（サンプル診断）と混ざらないようにする（§41-B）。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  SC.diagnosisConfig = {
    /* 5DAY本体（lmine-shindan-challenge）とは別の名前空間 */
    appId: 'lmine-shindan-diagnosis',
    /* 保存フォーマットの版。互換が切れたら上げる（旧データは破棄して初期化） */
    storageVersion: 'v1',

    /* 開発版であることを画面に明示する（一般公開前のゲート／§41-B） */
    stage: 'development',

    /* --- 引き継ぎキー（依頼8）------------------------------------------
     * 有効期限は設定値として分離する。初期値は15分。 */
    handoff: {
      ttlMinutes: 15,
      /* 期限が近いときに画面へ出す目安（分） */
      warnMinutes: 3,
      /* クリップボード自動読取を試す回数。権限要求を繰り返さない（依頼12） */
      clipboardAttempts: 1
    },

    /* --- 設問の表現バリアント（2026-08-25 Codex・あかり指示）------------
     * ★既定は OFF。OFFのあいだは、これまでどおり正本の文言だけを出す。
     *   本番でのテスト開始は別途承認制。
     * ★採点・最低軸の判定・スコア帯・補助フラグは、ONにしても変えない。 */
    questionVariantTest: {
      enabled: false,
      /* 'persistent' … 利用者ごとに1回決めたら、以後ずっと同じものを出す。
       *                毎回ランダムにはしない */
      assignment: 'persistent',
      variants: ['event', 'emotion', 'relationship'],
      /* 正本の文言も比較対象に混ぜるか（比較の土台になるので既定は混ぜる） */
      includeControl: true,
      /* 対象は3〜5問まで。これを超える設定は入れない */
      maxQuestions: 5,
      /* 設問順の入れ替えとは同時にやらない（順の入れ替え機能そのものが無い） */
      allowWithQuestionShuffle: false,
      /* 回答時間は実測値を送らず、この区分だけを送る */
      responseTimeBands: [
        { key: 'under5s', maxMs: 5000 },
        { key: '5to15s', maxMs: 15000 },
        { key: '15to30s', maxMs: 30000 },
        { key: 'over30s', maxMs: Infinity }
      ]
    },

    /* --- 保存キー ------------------------------------------------------
     * アプリ名 : 保存版 : 診断版 : 匿名診断ID : 種別
     * anonymousDiagnosisId が未発行のあいだは 'draft' を使う。 */
    storageKey: function (kind, anonymousDiagnosisId) {
      var c = SC.diagnosisConfig;
      return [
        c.appId,
        c.storageVersion,
        'd' + SC.diagnosisData.version,
        anonymousDiagnosisId || 'draft',
        kind
      ].join(':');
    },

    /* 「いまどの診断を開いているか」を指す小さなポインタ */
    pointerKey: function () {
      var c = SC.diagnosisConfig;
      return [c.appId, c.storageVersion, 'current'].join(':');
    },

    /* 開発モードの保存先（GAS未接続のときに、通信の代わりをする場所）。
     * 本番接続時は使われない。 */
    devServerKey: function () {
      var c = SC.diagnosisConfig;
      return [c.appId, c.storageVersion, '_dev_server'].join(':');
    },

    /* 匿名診断ID。個人情報を含まない。 */
    newAnonymousDiagnosisId: function () {
      var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      var out = '';
      var crypto = global.crypto || global.msCrypto;
      var n = 16;
      if (crypto && crypto.getRandomValues) {
        var buf = new Uint8Array(n);
        crypto.getRandomValues(buf);
        for (var i = 0; i < n; i++) out += chars.charAt(buf[i] % chars.length);
      } else {
        for (var j = 0; j < n; j++) out += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return 'dg_' + out;
    }
  };
})(window);
