/* sample-diagnosis.js : Phase1の確認用サンプル診断データ。
 * 実採点ロジック・20問入力はPhase1の対象外（実装依頼 v0.1 §11）。
 * Phase2ではこの読み込み口をGAS／スプレッドシートへ差し替える。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  SC.sampleDiagnosis = {
    campaignId: SC.config.campaignId,
    anonymousDiagnosisId: 'preview-0001',
    lineUid: null,
    totalScore: 47,
    scoreBand: {
      key: 'band_40_59',
      range: '40〜59',
      label: '成長準備ゾーン',
      meaning: '一定の成功確率がありますが、伸びしろが多い段階です。'
    },
    axisScores: {
      customerInsight: 10,
      productStructure: 5,
      salesJourney: 8,
      growthEnvironment: 12,
      improvementOperation: 12
    },
    lowestAxis: 'productStructure',
    businessFitFlags: [],
    fatigueFlag: false,
    environmentMismatchFlag: false
  };
})(window);
