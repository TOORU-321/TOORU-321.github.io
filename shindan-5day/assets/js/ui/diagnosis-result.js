/* diagnosis-result.js : 簡易結果の見た目。診断ページとLINE復元画面で共用する。
 * 表示順は v0.4 §8：総合点 → スコア帯 → 5軸レーダー → 最低軸 → 改善幅 → 補助フラグ。
 * （推奨コラム・はじめてシリーズ・L-MINE2.0の接続は未確定のため出さない）
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;

  function c() { return SC.diagnosisCopy; }

  function flagCard(heading, body) {
    return h('section', { class: 'dg-card dg-flag' }, [
      h('h2', { class: 'dg-flag__title', text: heading }),
      h('p', { class: 'dg-flag__body', text: body })
    ]);
  }

  /* record : SC.diagnosisScore.toDiagnosisRecord() の形
   * opts   : { animate: bool, withLead: bool } */
  SC.ui.diagnosisResult = function (record, opts) {
    opts = opts || {};
    var d = SC.diagnosisData;
    var scores = record.axisScores;
    var axisMax = d.scoring.axisMax;
    var step = SC.config.improvementStep;
    var improved = SC.ui.improvedScores(scores, record.lowestAxis, step, axisMax);
    var lowestLabel = SC.axisLabel(record.lowestAxis);
    var animate = !!opts.animate;

    return h('div', { class: 'dg-result' }, [
      /* 1. 診断完了（第一声｜v0.4 §8） */
      opts.withLead === false
        ? null
        : h('section', { class: 'dg-card dg-card--lead' }, SC.ui.prose(d.resultLead)),

      /* 2〜3. 総合スコア → スコア帯 */
      SC.ui.scoreSummary({
        caption: c().scoreCaption,
        totalScore: record.totalScore,
        max: d.scoring.totalMax,
        band: record.scoreBand,
        animate: animate,
        children: SC.ui.scoreMeter({
          value: record.totalScore,
          max: d.scoring.totalMax,
          marks: SC.config.scoreMarks,
          animate: animate
        })
      }),

      /* 4〜7. 見出し → 一言 → イラスト → 短い現在地説明
       * （2026-08-24 Codex・あかり確定の並び。レーダーはこの後ろへ移した） */
      SC.ui.card(c().lowestHeading, [
        SC.ui.resultTypeImage(record.lowestAxis),
        SC.ui.axisMeter({
          label: lowestLabel,
          value: scores[record.lowestAxis],
          target: Math.min(axisMax, scores[record.lowestAxis] + step),
          max: axisMax,
          nowLabel: '診断時',
          targetLabel: '改善仮説',
          animate: animate
        }),
        h('p', { class: 'card__note', text: c().lowestNote }),
        record.tiedLowestAxes && record.tiedLowestAxes.length > 1
          ? h('p', { class: 'card__note', text: c().tiedNote })
          : null
      ]),

      /* 8. 5軸レーダーチャート */
      SC.ui.card(c().radarHeading, [
        SC.ui.radarChart({
          scores: scores,
          max: axisMax,
          lowestAxis: record.lowestAxis,
          improved: improved,
          animate: animate
        }),
        SC.ui.axisList({ scores: scores, lowestAxis: record.lowestAxis, animate: animate })
      ]),

      record.structuralRiskFlag ? flagCard(c().riskHeading, c().riskNote) : null,
      record.fatigueFlag ? flagCard(c().fatigueHeading, c().fatigueNote) : null,
      record.environmentMismatchFlag ? flagCard(c().environmentHeading, c().environmentNote) : null
    ]);
  };
})(window);
