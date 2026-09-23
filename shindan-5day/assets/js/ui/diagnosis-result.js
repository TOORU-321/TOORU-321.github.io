/* 簡易結果：結論とイメージ → 点数とチャート → 任意の各軸説明。
 * 引き継ぎCTAは呼び出し元の既存処理。ここでは結果の表示だけを行う。 */
(function (global) {
  'use strict';
  var SC = global.SC, h = SC.dom.h;
  function flag(title, text) {
    return h('section', { class: 'dg-card dg-flag' }, [h('h2', { class: 'dg-flag__title', text: title }), h('p', { class: 'dg-flag__body', text: text })]);
  }
  SC.ui.diagnosisResult = function (record, opts) {
    var c = SC.diagnosisCopy, s = SC.scanCopy.result;
    var max = SC.diagnosisData.scoring.axisMax;
    return h('div', { class: 'dg-result scan-result' }, [
      h('section', { class: 'scan-focus' }, [
        h('p', { class: 'scan-eyebrow', text: s.eyebrow }),
        h('h2', { class: 'scan-focus__title' }, [s.title, h('strong', { text: SC.axisLabel(record.lowestAxis) })]),
        SC.ui.resultTypeImage(record.lowestAxis, { variant: 'compact', caption: false, note: false }),
        h('p', { class: 'scan-note', text: c.lowestNote }),
        record.tiedLowestAxes && record.tiedLowestAxes.length > 1 ? h('p', { class: 'scan-note', text: c.tiedNote }) : null
      ]),
      SC.ui.scoreSummary({
        caption: c.scoreCaption, totalScore: record.totalScore, max: SC.diagnosisData.scoring.totalMax,
        band: record.scoreBand, animate: false,
        children: SC.ui.radarChart({ scores: record.axisScores, max: max, lowestAxis: record.lowestAxis, animate: false })
      }),
      h('details', { class: 'scan-details' }, [
        h('summary', { text: s.axes }),
        h('div', { class: 'scan-details__body' }, [
          SC.ui.axisList({ scores: record.axisScores, lowestAxis: record.lowestAxis, animate: false })
        ])
      ]),
      record.structuralRiskFlag ? flag(c.riskHeading, c.riskNote) : null,
      record.fatigueFlag ? flag(c.fatigueHeading, c.fatigueNote) : null,
      record.environmentMismatchFlag ? flag(c.environmentHeading, c.environmentNote) : null
    ]);
  };
})(window);
