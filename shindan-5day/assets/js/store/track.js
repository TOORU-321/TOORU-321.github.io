/* track.js : 計測インターフェース。Phase1は本番送信しない（ローカルログのみ）。
 * イベントに回答本文は入れない（実装依頼 v0.1 §8）。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  /* 回答本文は載せない。載せてよい補助キーだけを列挙する */
  /* step はカードの位置（何枚目まで進んだか）。本文は入れない */
  var META_WHITELIST = ['day', 'screen', 'cta', 'choice', 'step',
    /* §37-11：出し分けの補助キー。IDと分類だけで、本文やURLは入れない */
    'mode', 'axis', 'offerId', 'contentType', 'timing'];
  var MAX_LOG = 100;
  var logKey = function () {
    return SC.config.appId + ':' + SC.config.campaignId + ':_preview_event_log:' + SC.config.storageVersion;
  };

  function readLog() {
    var v = SC.storage.read(logKey());
    return Object.prototype.toString.call(v) === '[object Array]' ? v : [];
  }

  SC.track = {
    /* Phase1で使うイベント名（実装依頼 v0.1 §8） */
    EVENTS: [
      'result_view',
      'challenge_cta_click',
      'challenge_start_view',
      'reminder_window_selected',
      'day1_focus_view',
      'day1_focus_selected',
      'day1_pause_view',
      'day1_pause_selected',
      'day1_completed',
      'day2_teaser_opened',
      'preview_reset',
      /* 以下は §21-B（DAY2）と 2026-08-19 とーる指示（導入・参加意思）で追加。
         正本 §8 のイベント表へ追記してもらう必要がある */
      'lp_view',
      /* テキスト型VSL（2026-08-21 とーる相談で追加）。正本§8への追記はCodex確定後 */
      'lp_deck_step',
      'lp_deck_completed',
      'lp_deck_expanded',
    'lp_story_revealed',
    /* 再読（§36-2）。本文は送らない */
    'lp_story_restarted',
    /* DAY5（§29-F｜2026-08-21）。曜日・時刻の表示文と回答本文は送らない */
    'day5_intro_view',
    'day5_hypothesis_view', 'day5_hypothesis_selected',
    'day5_weekly_action_view', 'day5_weekly_action_selected',
    'day5_metric_view', 'day5_metric_selected',
    'day5_schedule_view', 'day5_schedule_selected',
    'day5_adjustment_view', 'day5_adjustment_selected',
    'day5_support_view', 'day5_support_selected',
    'day5_experiment_view', 'day5_experiment_edited',
    'day5_completed', 'final_sheet_opened',
    /* 希望者向けサポートと30日後の再診断（§36-4／§36-5）。
     * 商品名・URL・回答本文・自由入力は送らない。choice は self／learn／consult のみ */
    'support_recommendation_view', 'support_link_clicked',
    'reassessment_scheduled', 'reassessment_calendar_added',
    'reassessment_cta_view', 'reassessment_started', 'reassessment_completed',
    /* 次の一歩の出し分け（§37-11）。本文・URL・価格・相談内容・個人情報は送らない */
    'free_content_recommended', 'free_content_clicked',
    'course_recommendation_view', 'course_link_clicked',
    'consultation_recommendation_view', 'consultation_link_clicked',
    'offer_unavailable', 'offer_dismissed',
    /* モニター感想（本文・連絡先・掲載同意の内容は送らない） */
    'voice_invite_clicked',
      'challenge_intro_view',
      'participation_selected',
      'day2_intro_view',
      'day2_scene_view',
      'day2_scene_selected',
      'day2_voice_view',
      'day2_voice_selected',
      'day2_hope_view',
      'day2_hope_selected',
      'day2_completed',
      'day3_teaser_opened',
      /* DAY3（§23-F）。実装記録と同時に正本§8へ追記する */
      'day3_intro_view',
      'day3_current_view',
      'day3_current_selected',
      'day3_wall_view',
      'day3_wall_selected',
      'day3_first_change_view',
      'day3_first_change_selected',
      'day3_destination_view',
      'day3_destination_selected',
      'day3_role_view',
      'day3_role_selected',
      'day3_bridge_view',
      'day3_bridge_edited',
      'day3_completed',
      'day4_teaser_opened',
      /* DAY4（§26-D）。実装記録と同時に正本§8へ追記する */
      'day4_intro_view',
      'day4_entry_view',
      'day4_entry_selected',
      'day4_relevance_view',
      'day4_relevance_selected',
      'day4_action_view',
      'day4_action_selected',
      'day4_support_view',
      'day4_support_selected',
      'day4_order_view',
      'day4_order_selected',
      'day4_journey_view',
      'day4_journey_edited',
      'day4_completed',
      'day5_teaser_opened'
    ],

    event: function (name, meta) {
      var d = SC.store.getDiagnosis();
      var payload = {
        event: name,
        campaignId: d ? d.campaignId : SC.config.campaignId,
        anonymousDiagnosisId: d ? d.anonymousDiagnosisId : null,
        scoreBand: d && d.scoreBand ? d.scoreBand.key : null,
        lowestAxis: d ? d.lowestAxis : null,
        timestamp: new Date().toISOString()
      };
      /* 回答本文は載せない。許可した補助キーだけ通す */
      if (meta) {
        for (var i = 0; i < META_WHITELIST.length; i++) {
          var k = META_WHITELIST[i];
          if (meta[k] !== undefined) payload[k] = meta[k];
        }
      }
      if (SC.track.EVENTS.indexOf(name) === -1 && global.console) {
        global.console.warn('[track] 未定義のイベント名:', name);
      }
      var log = readLog();
      log.push(payload);
      if (log.length > MAX_LOG) log = log.slice(log.length - MAX_LOG);
      SC.storage.write(logKey(), log);
      if (global.console && global.console.debug) global.console.debug('[track]', payload);
      /* Phase2でGA4／GAS等へ送るのはここ。Phase1は送信しない */
      return payload;
    },

    list: function () { return readLog(); },
    clear: function () { SC.storage.remove(logKey()); }
  };
})(window);
