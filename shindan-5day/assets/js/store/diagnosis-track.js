/* diagnosis-track.js : 診断・引き継ぎの計測インターフェース（依頼19）
 *
 * 5DAY本体の track.js とは分ける。理由は、あちらは匿名診断IDを
 * 自動で載せる作りになっており、診断側の禁止事項に反するため。
 *
 * 外部へは送らない。この端末のログに残すだけ。
 *
 * 送らないもの
 *   質問文／選択肢の表示文／回答本文／uid／匿名診断ID／引き継ぎキー／GAS URL
 * 載せてよい補助キー
 *   question（Q1〜Q20の番号だけ）／screen／cta
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  var META_WHITELIST = ['question', 'screen', 'cta'];
  var MAX_LOG = 120;

  /* --- 設問バリアントの計測（§51｜2026-08-25 Codex・あかり承認）----------
   * すべてID・列挙値・真偽値・時間帯区分だけ。
   * 回答本文・設問文全文・選択肢本文・自由入力・個人情報・URLは入れない。
   *
   * ★不採用（§51）：completed / lineCtaClicked / challengeReached
   *   これらはイベントの発生有無から数える。
   *   同じことをイベントと真偽値の両方で持つと、食い違いが起きるため。 */
  var VARIANT_META = [
    'questionId',          /* 数値。Q1〜Q20 */
    'variant',             /* 'control' / 'event' / 'emotion' / 'relationship' */
    'variantVersion',      /* 文言の版。'v1' など */
    'answerScore',         /* 0〜4。選んだ選択肢の点数だけ（表示文は入れない） */
    'responseTimeBand',    /* 'under5s' / '5to15s' / '15to30s' / 'over30s' */
    'changedAnswer',       /* 真偽。戻って選び直したか */
    /* 時刻と読み違えないよう abandonedAt から改名（§51） */
    'abandonedQuestionId'  /* 数値。どの設問で離脱したか */
  ];

  /* 採用イベントは実装記録へ「判断待ち」として整理する（依頼19） */
  var EVENTS = [
    /* 診断前LP（§47／§51で正本§8へ正式追記） */
    'diagnosis_lp_view',
    'diagnosis_lp_cta_click',
    'diagnosis_lp_faq_opened',
    /* 診断のはじめかた（2026-08-24 とーる指示で追加した画面） */
    'diagnosis_intro_view',
    'diagnosis_intro_step',
    'diagnosis_intro_started',
    'diagnosis_started',
    'diagnosis_question_view',
    'diagnosis_answer_selected',
    'diagnosis_back_clicked',
    'diagnosis_completed',
    'diagnosis_scoring_view',
    'diagnosis_result_view',
    'handoff_copy_attempted',
    'handoff_copy_succeeded',
    'handoff_copy_failed',
    'handoff_restore_view',
    'handoff_clipboard_attempted',
    'handoff_clipboard_succeeded',
    'handoff_clipboard_failed',
    'handoff_manual_paste_used',
    'handoff_bind_succeeded',
    'handoff_bind_failed'
  ];

  function logKey() {
    var c = SC.diagnosisConfig;
    return [c.appId, c.storageVersion, '_dev_event_log'].join(':');
  }

  function readLog() {
    var v = SC.storage.read(logKey());
    return Object.prototype.toString.call(v) === '[object Array]' ? v : [];
  }

  SC.diagnosisTrack = {
    EVENTS: EVENTS,

    /* §51で正本§8へ追記が承認された補助キー */
    VARIANT_META: VARIANT_META,

    event: function (name, meta) {
      var payload = {
        event: name,
        diagnosisVersion: SC.diagnosisData.version,
        timestamp: new Date().toISOString()
      };
      if (meta) {
        var allowed = META_WHITELIST.concat(VARIANT_META);
        for (var i = 0; i < allowed.length; i++) {
          var k = allowed[i];
          if (meta[k] === undefined) continue;
          /* question は番号だけ。文字列が来ても数値以外は載せない */
          if (k === 'question') {
            var n = parseInt(meta[k], 10);
            if (isNaN(n) || n < 1 || n > SC.diagnosisData.questions.length) continue;
            payload.question = n;
            continue;
          }
          payload[k] = meta[k];
        }
      }
      if (EVENTS.indexOf(name) === -1 && global.console) {
        global.console.warn('[diagnosis-track] 未定義のイベント名:', name);
      }
      var log = readLog();
      log.push(payload);
      if (log.length > MAX_LOG) log = log.slice(log.length - MAX_LOG);
      SC.storage.write(logKey(), log);
      /* ★uid・匿名診断ID・引き継ぎキーはここまで一切入らない。
       *   ブラウザのログにも平文キーを出さない（依頼8）。 */
      return payload;
    },

    list: function () { return readLog(); },
    clear: function () { SC.storage.remove(logKey()); }
  };
})(window);
