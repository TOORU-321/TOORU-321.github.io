/* diagnosis-score.js : 診断v0.4の採点。数値と境界値は data/diagnosis-v04.js から読む。
 * この関数の中に、質問文・選択肢・境界値を書かない（依頼4）。
 *
 * 入力 answers : { 1: 0..4, 2: 0..4, ... } 選択肢のインデックス（0始まり）
 *                未回答は undefined / null。
 * 出力 result  : 保存構造そのまま（依頼6）
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  function data() { return SC.diagnosisData; }

  /* 回答値の正規化。範囲外・数値でないものは未回答として扱う */
  function optionIndex(answers, no) {
    if (!answers) return null;
    var v = answers[no];
    if (v === null || v === undefined || v === '') return null;
    var n = typeof v === 'number' ? v : parseInt(v, 10);
    if (isNaN(n)) return null;
    if (n < 0 || n >= data().scoring.pointsPerOption.length) return null;
    return n;
  }

  /* 選択肢インデックス（0始まり）→ 得点 */
  function pointOf(index) {
    if (index === null) return 0;
    return data().scoring.pointsPerOption[index];
  }

  /* 選択肢インデックス（0始まり）→ 表示上の選択番号（1始まり）。
   * v0.4の判定条件は「選択肢3以上」のように1始まりで書かれている */
  function choiceNumber(index) {
    return index === null ? null : index + 1;
  }

  /* 素点 → 20点満点へ換算（素点 ÷ 12 × 20 を四捨五入） */
  function convertAxis(raw) {
    var s = data().scoring;
    return Math.round((raw / s.axisRawMax) * s.axisMax);
  }

  /* 同点最低軸の決定（依頼3）。優先順は設定データ側に置く */
  function resolveLowest(axisScores) {
    var min = null;
    var tied = [];
    SC.axes.forEach(function (a) {
      var v = axisScores[a.key];
      if (min === null || v < min) { min = v; tied = [a.key]; }
      else if (v === min) tied.push(a.key);
    });
    var priority = data().lowestAxisPriority;
    var lowest = tied[0];
    for (var i = 0; i < priority.length; i++) {
      if (tied.indexOf(priority[i]) !== -1) { lowest = priority[i]; break; }
    }
    /* 同点一覧も、優先順にそろえて保存しておく（表示側で使い分けられる） */
    var orderedTied = priority.filter(function (k) { return tied.indexOf(k) !== -1; });
    tied.forEach(function (k) { if (orderedTied.indexOf(k) === -1) orderedTied.push(k); });
    return { lowestAxis: lowest, tiedLowestAxes: orderedTied, lowestScore: min };
  }

  SC.diagnosisScore = {
    /* 未回答の問番号を返す（依頼1：未回答時の安全な制御） */
    unanswered: function (answers) {
      return data().questions
        .filter(function (q) { return optionIndex(answers, q.no) === null; })
        .map(function (q) { return q.no; });
    },

    isComplete: function (answers) {
      return SC.diagnosisScore.unanswered(answers).length === 0;
    },

    /* 1問だけの得点（テスト・校正用） */
    pointOfAnswer: function (answers, no) {
      var q = data().questionByNo(no);
      if (!q || !q.scored) return 0;
      return pointOf(optionIndex(answers, no));
    },

    /* 採点本体。未回答があっても落とさず、0点として計算した結果を返す。
     * 呼び出し側は isComplete() で先に確認すること。 */
    score: function (answers) {
      var d = data();
      var axisRaw = {};
      var axisScores = {};

      SC.axes.forEach(function (a) {
        var raw = 0;
        d.questionsOfAxis(a.key).forEach(function (q) {
          raw += pointOf(optionIndex(answers, q.no));
        });
        axisRaw[a.key] = raw;
        axisScores[a.key] = convertAxis(raw);
      });

      var totalScore = 0;
      SC.axes.forEach(function (a) { totalScore += axisScores[a.key]; });

      var low = resolveLowest(axisScores);

      /* 非加点：疲労・環境不一致（1始まりの選択番号でしきい値判定） */
      var fatigueChoice = choiceNumber(optionIndex(answers, d.fatigue.question));
      var envChoice = choiceNumber(optionIndex(answers, d.environmentMismatch.question));

      /* 非加点：事業適合指数（Q18〜Q20の素点合計 0〜12） */
      var businessFitIndex = 0;
      d.businessFit.questions.forEach(function (no) {
        businessFitIndex += pointOf(optionIndex(answers, no));
      });

      /* 非加点：根拠と自己評価の差（2026-08-28）。
       * 回答値をそのまま持つだけ。判定もフラグも作らない。
       * businessFit・fatigue・environmentMismatch のどれにも混ぜない。 */
      var confidenceGap = optionIndex(answers, d.confidenceEvidenceGap.question);

      return {
        diagnosisVersion: d.version,
        axisRaw: axisRaw,
        axisScores: axisScores,
        totalScore: totalScore,
        scoreBand: d.bandOf(totalScore),
        lowestAxis: low.lowestAxis,
        tiedLowestAxes: low.tiedLowestAxes,
        /* 最低軸が5点以下なら、総合点にかかわらず構造リスク */
        structuralRiskFlag: low.lowestScore <= d.structuralRisk.axisThreshold,
        fatigueFlag: fatigueChoice !== null && fatigueChoice >= d.fatigue.threshold,
        fatigueStrong: fatigueChoice !== null && fatigueChoice >= d.fatigue.strongThreshold,
        environmentMismatchFlag: envChoice !== null && envChoice >= d.environmentMismatch.threshold,
        businessFitIndex: businessFitIndex,
        /* 商品接続は未確定のため、判定値の保持だけ行い画面には出さない */
        businessFitCandidate: businessFitIndex >= d.businessFit.candidateThreshold,
        /* 0〜4、未回答ならnull。本人向けの画面には出さない（2026-08-28） */
        confidenceEvidenceGapScore: confidenceGap
      };
    },

    /* 5DAY本体（challenge-store）が読める形へそろえる。
     * sample-diagnosis.js と同じ形にしておき、差し替え口を変えずに済ませる。 */
    toDiagnosisRecord: function (result, meta) {
      meta = meta || {};
      return {
        campaignId: meta.campaignId || SC.config.campaignId,
        anonymousDiagnosisId: meta.anonymousDiagnosisId || null,
        lineUid: meta.lineUid || null,
        diagnosisVersion: result.diagnosisVersion,
        totalScore: result.totalScore,
        scoreBand: result.scoreBand,
        axisScores: result.axisScores,
        lowestAxis: result.lowestAxis,
        tiedLowestAxes: result.tiedLowestAxes,
        businessFitFlags: [],
        businessFitIndex: result.businessFitIndex,
        structuralRiskFlag: result.structuralRiskFlag,
        fatigueFlag: result.fatigueFlag,
        environmentMismatchFlag: result.environmentMismatchFlag
      };
    },

    /* テスト・校正用に内部関数を公開 */
    _internal: {
      optionIndex: optionIndex,
      pointOf: pointOf,
      choiceNumber: choiceNumber,
      convertAxis: convertAxis,
      resolveLowest: resolveLowest
    }
  };
})(window);
