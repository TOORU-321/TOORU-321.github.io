/* screen-abcdfg-day5-choice.js : Screen AB・AC・AD・AF・AG（§29-D）
 * DAY2〜DAY4と同じ「選択肢＋自分の言葉」の作りなので、共通の組み立てを使う。
 * ・AB（仮説）だけは、DAY4で決めた4地点の言葉を入れてから選択肢を出す
 * ・AG（進み方）は自由入力なし・3択のみ。Phase1では商品リンクを出さない
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  function day5() { return SC.day5; }

  SC.buildChoiceScreens([
    {
      id: 'day5_hypothesis', dayKey: 'day5', logic: day5, copy: 'day5Hypothesis',
      field: 'hypothesis', customField: 'hypothesisCustom',
      options: 'day5Hypotheses',
      optionsFn: function (state) { return SC.day5.options('hypothesis', state); },
      next: 'day5_weekly_action',
      viewEvent: 'day5_hypothesis_view', selectEvent: 'day5_hypothesis_selected'
    },
    {
      id: 'day5_weekly_action', dayKey: 'day5', logic: day5, copy: 'day5WeeklyAction',
      field: 'weeklyAction', customField: 'weeklyActionCustom',
      options: 'day5WeeklyActions',
      next: 'day5_metric',
      viewEvent: 'day5_weekly_action_view', selectEvent: 'day5_weekly_action_selected'
    },
    {
      id: 'day5_metric', dayKey: 'day5', logic: day5, copy: 'day5Metric',
      field: 'metric', customField: 'metricCustom',
      options: 'day5Metrics',
      next: 'day5_schedule',
      viewEvent: 'day5_metric_view', selectEvent: 'day5_metric_selected'
    },
    {
      id: 'day5_adjustment', dayKey: 'day5', logic: day5, copy: 'day5Adjustment',
      field: 'adjustmentPoint', customField: 'adjustmentPointCustom',
      options: 'day5AdjustmentPoints',
      next: 'day5_support',
      viewEvent: 'day5_adjustment_view', selectEvent: 'day5_adjustment_selected'
    },
    {
      id: 'day5_support', dayKey: 'day5', logic: day5, copy: 'day5Support',
      field: 'supportMode', customField: null,
      options: 'day5SupportModes',
      next: 'day5_experiment',
      viewEvent: 'day5_support_view', selectEvent: 'day5_support_selected'
    }
  ]);
})(window);
