/* question-variant.js : 設問の表現バリアントの割り当てと解決（2026-08-25）
 *
 * ★既定は OFF。OFFのあいだは、これまでとまったく同じ文言だけが出ます。
 *   本番でのテスト開始は別途承認制（Codex・あかり指示）。
 *
 * 割り当ての決まり
 *  ・毎回ランダムにしない
 *  ・利用者ごとに1回だけ決め、その端末では以後ずっと同じものを出す
 *  ・1回の診断の途中では絶対に変えない
 *  ・設問順のランダム化とは同時にやらない（今は設問順の入れ替え機能そのものが無い）
 *
 * 変えないもの
 *  ・採点、最低軸の判定、スコア帯、補助フラグ
 *  ・軸への割り当て、配点、選択肢の並び順
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  var CONTROL = 'control';   /* 正本の文言。割り当てにも使う */

  function cfg() { return SC.diagnosisConfig.questionVariantTest; }

  /* 利用者ごとの割り当ての置き場。
   * 匿名診断IDとは別（診断をやり直しても同じものが出るようにする）。 */
  function assignmentKey() {
    var c = SC.diagnosisConfig;
    return [c.appId, c.storageVersion, '_variant'].join(':');
  }

  function randomIndex(max) {
    var crypto = global.crypto || global.msCrypto;
    if (crypto && crypto.getRandomValues) {
      var buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return buf[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  SC.questionVariant = {
    CONTROL: CONTROL,

    isEnabled: function () { return cfg().enabled === true; },

    /* いま割り当てられている種類。テストOFFなら常に control */
    current: function () {
      if (!SC.questionVariant.isEnabled()) return CONTROL;

      var saved = SC.storage.read(assignmentKey());
      var list = cfg().variants;
      if (saved && typeof saved.variant === 'string' &&
          (saved.variant === CONTROL || list.indexOf(saved.variant) !== -1)) {
        return saved.variant;
      }

      /* 初回だけ決めて、この端末に覚えさせる（再読み込みしても変わらない） */
      var pool = cfg().includeControl ? [CONTROL].concat(list) : list.slice();
      var picked = pool[randomIndex(pool.length)];
      SC.storage.write(assignmentKey(), {
        variant: picked,
        variantVersion: SC.questionVariants.version,
        assignedAt: new Date().toISOString()
      });
      return picked;
    },

    /* 計測へ載せる版。文言を差し替えたら上がる */
    version: function () { return SC.questionVariants.version; },

    /* この設問がテスト対象かどうか */
    isTarget: function (questionNo) {
      if (!SC.questionVariant.isEnabled()) return false;
      return SC.questionVariants.questionIds().indexOf(questionNo) !== -1;
    },

    /* 画面へ出す設問を返す。
     * ★必ず正本のコピーを土台にし、質問文と選択肢の表示文だけを差し替える。
     *   軸・配点・採点対象かどうかは、正本のまま持ち越す。
     *   差し替えが無ければ正本をそのまま返す（フォールバック）。 */
    resolve: function (question) {
      if (!question) return question;
      if (!SC.questionVariant.isEnabled()) return question;

      var v = SC.questionVariant.current();
      if (v === CONTROL) return question;

      var alt = SC.questionVariants.get(question.no, v);
      if (!alt) return question;

      /* 選択肢の数が合わないものは使わない（採点が崩れるため） */
      var options = question.options;
      if (alt.options) {
        if (alt.options.length !== question.options.length) return question;
        options = alt.options;
      }

      var out = {};
      for (var k in question) {
        if (Object.prototype.hasOwnProperty.call(question, k)) out[k] = question[k];
      }
      out.text = alt.text || question.text;
      out.options = options;
      /* 元の文言も残しておく（校正時の突き合わせ用。画面には出さない） */
      out.variant = v;
      out.originalText = question.text;
      return out;
    },

    /* 回答にかかった時間の区分。実測値そのものは計測へ送らない */
    responseTimeBand: function (ms) {
      var bands = cfg().responseTimeBands;
      for (var i = 0; i < bands.length; i++) {
        if (ms < bands[i].maxMs) return bands[i].key;
      }
      return bands[bands.length - 1].key;
    },

    /* 検証・やり直し用。割り当てを捨てる */
    reset: function () { SC.storage.remove(assignmentKey()); },

    _internal: { assignmentKey: assignmentKey }
  };
})(window);
