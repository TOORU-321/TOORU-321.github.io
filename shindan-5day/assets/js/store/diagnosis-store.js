/* diagnosis-store.js : 診断（21問）の保存。画面はここだけを呼ぶ（依頼6）。
 * 保存の実体は storage-adapter.js（5DAY本体と共用）だが、
 * キーの名前空間は分けてあるので、モニター版の保存とは混ざらない。
 *
 * 保存する内容
 *   diagnosisVersion / anonymousDiagnosisId / answers / currentQuestion
 *   startedAt / completedAt / totalScore / scoreBand / axisScores
 *   lowestAxis / tiedLowestAxes / fatigueFlag / environmentMismatchFlag
 *   businessFitIndex / confidenceEvidenceGapScore / handoffStatus / updatedAt
 *
 * 破損・不正値・旧バージョンは、黙って捨てて最初からやり直せる状態へ戻す。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  var SCHEMA_VERSION = 1;
  var cache = null;
  var lastStatus = 'none';   /* 'new' | 'restored' | 'recovered' */

  /* 引き継ぎの進み具合 */
  var HANDOFF = ['none', 'issued', 'copied', 'bound'];

  function cfg() { return SC.diagnosisConfig; }
  function nowIso() { return new Date().toISOString(); }

  function isPlainObject(v) {
    return v !== null && typeof v === 'object' &&
      Object.prototype.toString.call(v) !== '[object Array]';
  }

  function readPointer() {
    var v = SC.storage.read(cfg().pointerKey());
    return (isPlainObject(v) && typeof v.anonymousDiagnosisId === 'string')
      ? v.anonymousDiagnosisId : null;
  }

  function writePointer(id) {
    SC.storage.write(cfg().pointerKey(), { anonymousDiagnosisId: id, updatedAt: nowIso() });
  }

  function createInitial(id) {
    return {
      schemaVersion: SCHEMA_VERSION,
      diagnosisVersion: SC.diagnosisData.version,
      anonymousDiagnosisId: id,
      /* { 問番号: 選択肢インデックス(0始まり) } */
      answers: {},
      /* 最初の設問番号。並び順の先頭であって、定数の1ではない */
      currentQuestion: SC.diagnosisData.firstNo(),
      startedAt: null,
      completedAt: null,
      /* 採点結果。全問そろうまでは null */
      totalScore: null,
      scoreBand: null,
      axisScores: null,
      lowestAxis: null,
      tiedLowestAxes: [],
      structuralRiskFlag: false,
      fatigueFlag: false,
      environmentMismatchFlag: false,
      businessFitIndex: null,
      /* Q21の回答値（0〜4）。観察用で、本人向けの画面には出さない（2026-08-28） */
      confidenceEvidenceGapScore: null,
      /* 引き継ぎ（依頼7）。キーの平文はここに保存しない。
       * 平文は発行直後に一度だけ画面へ渡し、handoffKeyPreview に保持する。
       * （保存すると端末に残り続けるため、期限切れで自動的に消す） */
      handoffStatus: 'none',
      handoffIssuedAt: null,
      handoffKeyPreview: null,
      updatedAt: nowIso()
    };
  }

  /* 回答の妥当性チェック。範囲外・数値でないものは捨てる */
  function sanitizeAnswers(raw) {
    var out = {};
    if (!isPlainObject(raw)) return out;
    var max = SC.diagnosisData.scoring.pointsPerOption.length;
    SC.diagnosisData.questions.forEach(function (q) {
      var v = raw[q.no];
      if (v === null || v === undefined) return;
      var n = typeof v === 'number' ? v : parseInt(v, 10);
      if (isNaN(n) || n < 0 || n >= max) return;
      out[q.no] = n;
    });
    return out;
  }

  function validate(state) {
    if (!isPlainObject(state)) return null;
    if (state.schemaVersion !== SCHEMA_VERSION) return null;
    /* 診断の版が変わったら、前の回答は使わない（校正でv0.5へ上げたとき） */
    if (state.diagnosisVersion !== SC.diagnosisData.version) return null;
    if (typeof state.anonymousDiagnosisId !== 'string' || !state.anonymousDiagnosisId) return null;

    state.answers = sanitizeAnswers(state.answers);

    /* 番号の範囲ではなく、並び順に実在する番号かで見る（2026-08-28）。
     * Q21のように、順番と番号が一致しない設問があるため。 */
    var cur = parseInt(state.currentQuestion, 10);
    state.currentQuestion =
      (isNaN(cur) || SC.diagnosisData.positionOf(cur) === 0) ? SC.diagnosisData.firstNo() : cur;

    if (HANDOFF.indexOf(state.handoffStatus) === -1) state.handoffStatus = 'none';
    if (Object.prototype.toString.call(state.tiedLowestAxes) !== '[object Array]') {
      state.tiedLowestAxes = [];
    }
    ['structuralRiskFlag', 'fatigueFlag', 'environmentMismatchFlag'].forEach(function (k) {
      if (typeof state[k] !== 'boolean') state[k] = false;
    });
    if (state.lowestAxis !== null && !SC.axisByKey(state.lowestAxis)) state.lowestAxis = null;

    /* 期限の切れた引き継ぎキーは、端末からも消す（依頼8） */
    if (state.handoffKeyPreview &&
        SC.handoffKey.isExpired(state.handoffIssuedAt, cfg().handoff.ttlMinutes)) {
      state.handoffKeyPreview = null;
      if (state.handoffStatus !== 'bound') state.handoffStatus = 'none';
    }
    return state;
  }

  SC.diagnosisStore = {
    SCHEMA_VERSION: SCHEMA_VERSION,

    /* 前回の途中結果があれば復元し、無ければ新しく始める */
    load: function () {
      var id = readPointer();
      if (!id) {
        lastStatus = 'new';
        cache = createInitial(cfg().newAnonymousDiagnosisId());
        writePointer(cache.anonymousDiagnosisId);
        SC.storage.write(cfg().storageKey('session', cache.anonymousDiagnosisId), cache);
        return cache;
      }
      var entry = SC.storage.readEntry(cfg().storageKey('session', id));
      var valid = entry.status === 'ok' ? validate(entry.value) : null;
      if (!valid) {
        /* 破損・非互換 → 安全に最初から */
        lastStatus = entry.status === 'missing' ? 'new' : 'recovered';
        SC.storage.remove(cfg().storageKey('session', id));
        cache = createInitial(cfg().newAnonymousDiagnosisId());
        writePointer(cache.anonymousDiagnosisId);
        SC.storage.write(cfg().storageKey('session', cache.anonymousDiagnosisId), cache);
        return cache;
      }
      lastStatus = 'restored';
      cache = valid;
      return cache;
    },

    get: function () { return cache || SC.diagnosisStore.load(); },

    lastLoadStatus: function () { return lastStatus; },

    save: function (patch) {
      var state = SC.diagnosisStore.get();
      if (patch) {
        for (var k in patch) {
          if (Object.prototype.hasOwnProperty.call(patch, k)) state[k] = patch[k];
        }
      }
      state.updatedAt = nowIso();
      SC.storage.write(cfg().storageKey('session', state.anonymousDiagnosisId), state);
      cache = state;
      return state;
    },

    /* 1問の回答を保存する。戻って選び直しても同じ入口を使う（依頼1） */
    setAnswer: function (no, optionIndex) {
      var state = SC.diagnosisStore.get();
      var max = SC.diagnosisData.scoring.pointsPerOption.length;
      var n = parseInt(optionIndex, 10);
      if (isNaN(n) || n < 0 || n >= max) return state;
      if (!SC.diagnosisData.questionByNo(no)) return state;

      var answers = {};
      for (var k in state.answers) {
        if (Object.prototype.hasOwnProperty.call(state.answers, k)) answers[k] = state.answers[k];
      }
      answers[no] = n;

      var patch = { answers: answers };
      if (!state.startedAt) patch.startedAt = nowIso();
      /* 回答を変えたら、前の採点結果は無効にする（古い結果を残さない） */
      if (state.completedAt) {
        patch.completedAt = null;
        patch.totalScore = null;
        patch.scoreBand = null;
        patch.axisScores = null;
        patch.lowestAxis = null;
        patch.tiedLowestAxes = [];
        patch.structuralRiskFlag = false;
        patch.fatigueFlag = false;
        patch.environmentMismatchFlag = false;
        patch.businessFitIndex = null;
        patch.confidenceEvidenceGapScore = null;
      }
      return SC.diagnosisStore.save(patch);
    },

    setCurrentQuestion: function (no) {
      var n = parseInt(no, 10);
      /* 並び順に実在する番号かで見る（2026-08-28） */
      if (isNaN(n) || SC.diagnosisData.positionOf(n) === 0) return SC.diagnosisStore.get();
      return SC.diagnosisStore.save({ currentQuestion: n });
    },

    /* 採点して保存する。全問そろっていなければ何もしない（依頼1） */
    complete: function () {
      var state = SC.diagnosisStore.get();
      if (!SC.diagnosisScore.isComplete(state.answers)) return null;
      /* 二重送信防止：すでに採点済みなら、そのまま返す */
      if (state.completedAt && state.totalScore !== null) return state;

      var r = SC.diagnosisScore.score(state.answers);
      return SC.diagnosisStore.save({
        completedAt: nowIso(),
        totalScore: r.totalScore,
        scoreBand: r.scoreBand,
        axisScores: r.axisScores,
        lowestAxis: r.lowestAxis,
        tiedLowestAxes: r.tiedLowestAxes,
        structuralRiskFlag: r.structuralRiskFlag,
        fatigueFlag: r.fatigueFlag,
        environmentMismatchFlag: r.environmentMismatchFlag,
        businessFitIndex: r.businessFitIndex,
        /* 観察用。0〜4かnull。画面には出さず、5DAY本体へも渡さない（2026-08-28） */
        confidenceEvidenceGapScore: r.confidenceEvidenceGapScore
      });
    },

    /* 採点済みの結果を、5DAY本体が読める形で取り出す */
    toDiagnosisRecord: function () {
      var state = SC.diagnosisStore.get();
      if (!state.completedAt) return null;
      return SC.diagnosisScore.toDiagnosisRecord({
        diagnosisVersion: state.diagnosisVersion,
        totalScore: state.totalScore,
        scoreBand: state.scoreBand,
        axisScores: state.axisScores,
        lowestAxis: state.lowestAxis,
        tiedLowestAxes: state.tiedLowestAxes,
        structuralRiskFlag: state.structuralRiskFlag,
        fatigueFlag: state.fatigueFlag,
        environmentMismatchFlag: state.environmentMismatchFlag,
        businessFitIndex: state.businessFitIndex
      }, { anonymousDiagnosisId: state.anonymousDiagnosisId });
    },

    /* --- 引き継ぎ（依頼7・8）------------------------------------------- */
    setHandoff: function (status, key) {
      if (HANDOFF.indexOf(status) === -1) return SC.diagnosisStore.get();
      var patch = { handoffStatus: status };
      if (status === 'issued') {
        patch.handoffIssuedAt = nowIso();
        patch.handoffKeyPreview = key || null;
      }
      if (status === 'bound') patch.handoffKeyPreview = null;
      return SC.diagnosisStore.save(patch);
    },

    /* 期限内の引き継ぎキーを返す。切れていれば null */
    activeHandoffKey: function () {
      var state = SC.diagnosisStore.get();
      if (!state.handoffKeyPreview) return null;
      if (SC.handoffKey.isExpired(state.handoffIssuedAt, cfg().handoff.ttlMinutes)) return null;
      return state.handoffKeyPreview;
    },

    handoffRemainingMinutes: function () {
      var state = SC.diagnosisStore.get();
      return SC.handoffKey.remainingMinutes(state.handoffIssuedAt, cfg().handoff.ttlMinutes);
    },

    /* --- 開発版リセット（依頼1）----------------------------------------
     * 診断側のキーだけを消す。5DAY本体の保存には触らない。 */
    reset: function () {
      var prefix = cfg().appId + ':';
      var all = [];
      try {
        if (SC.storage.driver === 'localStorage') {
          for (var i = 0; i < global.localStorage.length; i++) {
            var k = global.localStorage.key(i);
            if (k && k.indexOf(prefix) === 0) all.push(k);
          }
        }
      } catch (e) { /* 読めない環境では下のキーだけ消す */ }
      /* 保存先が memory の場合も含め、既知のキーは確実に消す */
      var state = cache;
      if (state) all.push(cfg().storageKey('session', state.anonymousDiagnosisId));
      all.push(cfg().pointerKey());
      all.forEach(function (k) { SC.storage.remove(k); });
      cache = null;
      lastStatus = 'none';
    },

    /* 校正・テスト用に、想定回答をまとめて入れる（依頼14）。
     * caseId は匿名の識別子だけ。個人名や相談内容は保存しない。 */
    applyAnswerSet: function (answers, caseId) {
      SC.diagnosisStore.reset();
      var state = SC.diagnosisStore.load();
      var clean = sanitizeAnswers(answers);
      SC.diagnosisStore.save({
        answers: clean,
        startedAt: nowIso(),
        /* 最後の設問番号。問数ではない（Q21があるので一致しない・2026-08-28） */
        currentQuestion: SC.diagnosisData.lastNo(),
        caseId: typeof caseId === 'string' ? caseId.slice(0, 40) : null
      });
      return SC.diagnosisStore.complete() || SC.diagnosisStore.get();
    },

    _internal: {
      createInitial: createInitial,
      validate: validate,
      sanitizeAnswers: sanitizeAnswers,
      resetCache: function () { cache = null; lastStatus = 'none'; }
    }
  };
})(window);
