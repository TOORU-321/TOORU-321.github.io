/* axes.js : 5軸マスタ。表示名・専門名はNotion「診断ファネル｜SNS事業の現在地診断」に合わせる。 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  SC.axes = [
    {
      key: 'customerInsight',
      label: 'お客様理解',
      formalName: '顧客解像度',
      hint: 'どんな場面の、どんな気持ちの人かが見えているか'
    },
    {
      key: 'productStructure',
      label: '商品の土台',
      formalName: '商品構造力',
      hint: '誰の、どの悩みを、どの商品で解決するかが決まっているか'
    },
    {
      key: 'salesJourney',
      label: '届ける流れ',
      formalName: '販売導線力',
      hint: '知ってから申し込むまでの順番がつながっているか'
    },
    {
      key: 'growthEnvironment',
      label: '学び・相談環境',
      formalName: '成長環境力',
      hint: '迷ったときに相談でき、実行後の修正まで戻れる場所があるか'
    },
    {
      key: 'improvementOperation',
      label: '育てる力',
      formalName: '改善運用力',
      hint: '出した結果を見て、一か所ずつ直し続けられるか'
    }
  ];

  SC.axisByKey = function (key) {
    for (var i = 0; i < SC.axes.length; i++) {
      if (SC.axes[i].key === key) return SC.axes[i];
    }
    return null;
  };

  SC.axisLabel = function (key) {
    var a = SC.axisByKey(key);
    return a ? a.label : '';
  };
})(window);
