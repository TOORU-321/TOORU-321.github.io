/* challenge-store.js : 保存インターフェース。画面はここだけを呼ぶ。
 * 責務: loadDiagnosis / loadChallengeState / saveChallengeState / clearPreviewState / trackEvent
 * Phase2では storage-adapter を GAS 実装へ差し替えるだけで済むようにしてある。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  var SCHEMA_VERSION = 1;
  var diagnosisCache = null;
  var stateCache = null;
  var lastLoadStatus = 'none'; /* 'new' | 'restored' | 'recovered' */

  function nowIso() { return new Date().toISOString(); }

  function diagnosisKey(id) { return SC.config.storageKey('diagnosis', id); }
  function stateKey(id) { return SC.config.storageKey('challenge', id); }

  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && Object.prototype.toString.call(v) !== '[object Array]';
  }

  function buildBlueprint() {
    var out = {};
    SC.config.blueprintSections.forEach(function (s) {
      out[s.key] = { key: s.key, day: s.day, label: s.label, status: 'empty', summary: '', updatedAt: null };
    });
    return out;
  }

  function createInitialState(diagnosis) {
    return {
      schemaVersion: SCHEMA_VERSION,
      challengeVersion: SC.config.challengeVersion,
      campaignId: diagnosis.campaignId,
      anonymousDiagnosisId: diagnosis.anonymousDiagnosisId,
      startedAt: null,
      updatedAt: nowIso(),
      reminderWindow: SC.config.defaultReminderWindow,
      currentScreen: 'result',
      /* 参加の意思表示（2026-08-19 とーる指示で追加）
         'undecided' | 'joined' | 'later' */
      participation: 'undecided',
      participationAt: null,
      /* 診断結果画面のCTAを押すとLPが開けるようになる（ソフトな出し分け） */
      lpUnlocked: false,
      lpUnlockedAt: null,
      /* LPの読み進めるブロックを最後まで見たか（2026-08-21 とーる指示で追加）。
         立つと、LPの「この5日間が合う方」以降が最初から開く。 */
      lpStoryRead: false,
      lpStoryReadAt: null,
      pendingNotice: null,
      /* 最低軸を初期選択にするが、本人が選び直せる（絶対条件3） */
      selectedFocusAxis: diagnosis.lowestAxis,
      focusAxisChosenByUser: false,
      pausedAction: SC.config.defaultPausedAction,
      pausedActionChosenByUser: false,
      completedDays: [],
      day1CompletedAt: null,
      day2CompletedAt: null,
      day3CompletedAt: null,
      day4CompletedAt: null,
      day5CompletedAt: null,
      /* 30日後の再診断（§36-5）。DAY5完了時に初回だけ決め、以後は上書きしない。
         LINE通知・GAS・自動配信はPhase1では行わない */
      experimentStartedAt: null,
      reassessmentDueAt: null,
      reassessmentReminderSelected: false,
      reassessmentCompletedAt: null,
      reassessmentDiagnosisId: null,
      /* DAY2の回答（§21-C）。custom を選んだときだけ *Custom を使う */
      day2: buildDay2(),
      /* DAY3の回答（§23-E）。bridgeDraft は自動生成文、bridgeEdited は本人が直したか */
      day3: buildDay3(),
      /* DAY4の回答（§26-C）。journeyDraft は自動生成文、middleOrder は真ん中の順番 */
      day4: buildDay4(),
      /* DAY5の回答（§29-E）。experimentDraft は自動生成文、middle は無し */
      day5: buildDay5(),
      celebratedDays: [],
      blueprintSections: buildBlueprint()
    };
  }

  function buildDay2() {
    return { scene: null, sceneCustom: '', voice: null, voiceCustom: '', hope: null, hopeCustom: '' };
  }

  function buildDay3() {
    return {
      currentState: null, currentStateCustom: '',
      wall: null, wallCustom: '',
      firstChange: null, firstChangeCustom: '',
      destination: null, destinationCustom: '',
      productRole: null, productRoleCustom: '',
      bridgeDraft: '', bridgeEdited: false, bridgeSourceKey: ''
    };
  }

  function buildDay4() {
    return {
      entry: null, entryCustom: '',
      relevanceExperience: null, relevanceExperienceCustom: '',
      smallAction: null, smallActionCustom: '',
      support: null, supportCustom: '',
      middleOrder: SC.config.defaultDay4Order,
      journeyDraft: '', journeyEdited: false, journeySourceKey: ''
    };
  }

  /* 選択肢リストから value を探す共通処理 */
  function buildDay5() {
    return {
      hypothesis: null, hypothesisCustom: '',
      weeklyAction: null, weeklyActionCustom: '',
      metric: null, metricCustom: '',
      reviewDay: SC.config.defaultDay5ReviewDay,
      reviewWindow: null,          /* 未設定ならLPの通知時間、それも無ければ既定 */
      adjustmentPoint: null, adjustmentPointCustom: '',
      supportMode: null,
      experimentDraft: '', experimentEdited: false, experimentSourceKey: ''
    };
  }

  function optionByValue(list, value) {
    for (var i = 0; i < list.length; i++) if (list[i].value === value) return list[i];
    return null;
  }

  /* 保存値の妥当性チェック。壊れていたら null を返し、呼び出し側で初期化させる */
  function validate(state, diagnosis) {
    if (!isPlainObject(state)) return null;
    if (state.schemaVersion !== SCHEMA_VERSION) return null;
    if (state.challengeVersion !== SC.config.challengeVersion) return null;
    if (state.anonymousDiagnosisId !== diagnosis.anonymousDiagnosisId) return null;
    if (SC.config.screenOrder.indexOf(state.currentScreen) === -1) return null;
    if (state.selectedFocusAxis !== null && !SC.axisByKey(state.selectedFocusAxis)) return null;
    if (state.pausedAction !== null && !pausedActionByValue(state.pausedAction)) return null;
    if (SC.config.reminderWindows.map(function (w) { return w.value; }).indexOf(state.reminderWindow) === -1) return null;
    if (Object.prototype.toString.call(state.completedDays) !== '[object Array]') return null;
    if (!isPlainObject(state.blueprintSections)) return null;
    /* 足りないセクションがあれば補う（DAY追加時の前方互換） */
    var base = buildBlueprint();
    for (var k in base) {
      if (!isPlainObject(state.blueprintSections[k])) state.blueprintSections[k] = base[k];
    }
    if (Object.prototype.toString.call(state.celebratedDays) !== '[object Array]') state.celebratedDays = [];

    /* 後から足した項目は、無ければ既定値で補う（DAY追加時の前方互換） */
    if (['undecided', 'joined', 'later'].indexOf(state.participation) === -1) state.participation = 'undecided';
    if (typeof state.lpUnlocked !== 'boolean') state.lpUnlocked = false;
    if (typeof state.lpStoryRead !== 'boolean') state.lpStoryRead = false;
    if (typeof state.reassessmentReminderSelected !== 'boolean') state.reassessmentReminderSelected = false;
    ['experimentStartedAt', 'reassessmentDueAt', 'reassessmentCompletedAt', 'reassessmentDiagnosisId']
      .forEach(function (k) { if (state[k] === undefined) state[k] = null; });
    if (typeof state.pendingNotice !== 'string') state.pendingNotice = null;
    if (!isPlainObject(state.day2)) state.day2 = buildDay2();
    else {
      var base2 = buildDay2();
      for (var k2 in base2) if (state.day2[k2] === undefined) state.day2[k2] = base2[k2];
      /* 不正な選択値は未選択へ戻す */
      if (state.day2.scene !== null && !optionByValue(SC.config.day2Scenes, state.day2.scene)) state.day2.scene = null;
      if (state.day2.voice !== null && !optionByValue(SC.config.day2Voices, state.day2.voice)) state.day2.voice = null;
      if (state.day2.hope !== null && !optionByValue(SC.config.day2Hopes, state.day2.hope)) state.day2.hope = null;
    }

    if (!isPlainObject(state.day3)) state.day3 = buildDay3();
    else {
      var base3 = buildDay3();
      for (var k3 in base3) if (state.day3[k3] === undefined) state.day3[k3] = base3[k3];
      [['currentState', 'day3CurrentStates'], ['wall', 'day3Walls'],
       ['firstChange', 'day3FirstChanges'], ['destination', 'day3Destinations'],
       ['productRole', 'day3Roles']].forEach(function (pair) {
        var v = state.day3[pair[0]];
        if (v !== null && !optionByValue(SC.config[pair[1]], v)) state.day3[pair[0]] = null;
      });
      if (typeof state.day3.bridgeDraft !== 'string') state.day3.bridgeDraft = '';
      if (typeof state.day3.bridgeEdited !== 'boolean') state.day3.bridgeEdited = false;
    }

    if (!isPlainObject(state.day5)) state.day5 = buildDay5();
    else {
      var base5 = buildDay5();
      for (var k5 in base5) if (state.day5[k5] === undefined) state.day5[k5] = base5[k5];
      [['hypothesis', 'day5Hypotheses'], ['weeklyAction', 'day5WeeklyActions'],
       ['metric', 'day5Metrics'], ['adjustmentPoint', 'day5AdjustmentPoints'],
       ['supportMode', 'day5SupportModes']].forEach(function (pair) {
        if (state.day5[pair[0]] !== null &&
            !optionByValue(SC.config[pair[1]], state.day5[pair[0]])) state.day5[pair[0]] = null;
      });
      if (!optionByValue(SC.config.day5ReviewDays, state.day5.reviewDay)) {
        state.day5.reviewDay = SC.config.defaultDay5ReviewDay;
      }
      if (state.day5.reviewWindow !== null &&
          !optionByValue(SC.config.reminderWindows, state.day5.reviewWindow)) {
        state.day5.reviewWindow = null;
      }
    }
    if (!isPlainObject(state.day4)) state.day4 = buildDay4();
    else {
      var base4 = buildDay4();
      for (var k4 in base4) if (state.day4[k4] === undefined) state.day4[k4] = base4[k4];
      [['entry', 'day4Entries'], ['relevanceExperience', 'day4Relevance'],
       ['smallAction', 'day4Actions'], ['support', 'day4Supports']].forEach(function (pair) {
        var v = state.day4[pair[0]];
        if (v !== null && !optionByValue(SC.config[pair[1]], v)) state.day4[pair[0]] = null;
      });
      if (!optionByValue(SC.config.day4Orders, state.day4.middleOrder)) {
        state.day4.middleOrder = SC.config.defaultDay4Order;
      }
      if (typeof state.day4.journeyDraft !== 'string') state.day4.journeyDraft = '';
      if (typeof state.day4.journeyEdited !== 'boolean') state.day4.journeyEdited = false;
    }
    return state;
  }

  function pausedActionByValue(value) {
    var list = SC.config.pausedActions;
    for (var i = 0; i < list.length; i++) if (list[i].value === value) return list[i];
    return null;
  }

  SC.store = {
    SCHEMA_VERSION: SCHEMA_VERSION,

    /* --- 診断データ --------------------------------------------------- */
    /* Phase1はサンプル固定。Phase2ではURLパラメータ／LINE uid／GAS取得に差し替える */
    loadDiagnosis: function () {
      if (diagnosisCache) return diagnosisCache;
      var sample = SC.sampleDiagnosis;
      var saved = SC.storage.read(diagnosisKey(sample.anonymousDiagnosisId));
      diagnosisCache = isPlainObject(saved) && saved.totalScore === sample.totalScore ? saved : sample;
      SC.storage.write(diagnosisKey(sample.anonymousDiagnosisId), diagnosisCache);
      return diagnosisCache;
    },

    getDiagnosis: function () { return diagnosisCache; },

    /* --- チャレンジ状態 ------------------------------------------------ */
    loadChallengeState: function () {
      var d = SC.store.loadDiagnosis();
      var entry = SC.storage.readEntry(stateKey(d.anonymousDiagnosisId));
      if (entry.status === 'missing') {
        lastLoadStatus = 'new';
        stateCache = createInitialState(d);
        return stateCache;
      }
      var valid = entry.status === 'ok' ? validate(entry.value, d) : null;
      if (!valid) {
        /* 破損・非互換 → 安全に開始画面へ戻す */
        lastLoadStatus = 'recovered';
        SC.storage.remove(stateKey(d.anonymousDiagnosisId));
        stateCache = createInitialState(d);
        return stateCache;
      }
      lastLoadStatus = 'restored';
      stateCache = valid;
      return stateCache;
    },

    getState: function () { return stateCache || SC.store.loadChallengeState(); },

    lastLoadStatus: function () { return lastLoadStatus; },

    /* patch をマージして保存。返り値は保存後の状態 */
    saveChallengeState: function (patch) {
      var d = SC.store.loadDiagnosis();
      var state = SC.store.getState();
      if (patch) {
        for (var k in patch) {
          if (Object.prototype.hasOwnProperty.call(patch, k)) state[k] = patch[k];
        }
      }
      state.updatedAt = nowIso();
      SC.storage.write(stateKey(d.anonymousDiagnosisId), state);
      stateCache = state;
      return state;
    },

    /* 一本線シートの1セクションを更新する（DAY2〜5も同じ入口を使う） */
    setBlueprintSection: function (key, patch) {
      var state = SC.store.getState();
      var section = state.blueprintSections[key];
      if (!section) return state;
      for (var k in patch) {
        if (Object.prototype.hasOwnProperty.call(patch, k)) section[k] = patch[k];
      }
      section.updatedAt = nowIso();
      return SC.store.saveChallengeState({ blueprintSections: state.blueprintSections });
    },

    /* 参加の意思表示。'joined' のときだけ開始時刻を立てる（LP・アプリ共通の入口） */
    setParticipation: function (choice, nextScreen) {
      var now = nowIso();
      var state = SC.store.getState();
      var patch = { participation: choice, participationAt: now };
      if (choice === 'joined') patch.startedAt = state.startedAt || now;
      if (nextScreen) patch.currentScreen = nextScreen;
      /* LPからアプリへはページ遷移するため、次の画面で出す案内を保存値で渡す */
      if (choice === 'later') patch.pendingNotice = 'participation_later';
      return SC.store.saveChallengeState(patch);
    },

    /* 次の画面で1回だけ出す案内を取り出して消す */
    takePendingNotice: function () {
      var state = SC.store.getState();
      var key = state.pendingNotice;
      if (!key) return null;
      SC.store.saveChallengeState({ pendingNotice: null });
      return key;
    },

    /* 診断結果画面から参加LPへ渡したことを記録する（LP側の出し分けに使う） */
    unlockLp: function () {
      var state = SC.store.getState();
      if (state.lpUnlocked) return state;
      return SC.store.saveChallengeState({ lpUnlocked: true, lpUnlockedAt: nowIso() });
    },

    /* 30日実験の開始日と再診断の予定日を、初回だけ決める（§36-5）。
     * 画面を開き直しても、回答を変えて再完了しても上書きしない。 */
    startExperimentWindow: function (days) {
      var state = SC.store.getState();
      if (state.experimentStartedAt) return state;
      var started = new Date();
      var due = new Date(started.getTime());
      due.setDate(due.getDate() + (days || 30));
      return SC.store.saveChallengeState({
        experimentStartedAt: started.toISOString(),
        reassessmentDueAt: due.toISOString()
      });
    },

    /* LPの読み進めるブロックを読み切った印。1回だけ記録する */
    markStoryRead: function () {
      var state = SC.store.getState();
      if (state.lpStoryRead) return state;
      return SC.store.saveChallengeState({ lpStoryRead: true, lpStoryReadAt: nowIso() });
    },

    /* DAY2の回答を1項目ずつ更新する（画面はここ経由でのみ保存する） */
    setDayAnswer: function (dayKey, patch) {
      var state = SC.store.getState();
      if (!isPlainObject(state[dayKey])) state[dayKey] = {};
      for (var k in patch) {
        if (Object.prototype.hasOwnProperty.call(patch, k)) state[dayKey][k] = patch[k];
      }
      var p = {};
      p[dayKey] = state[dayKey];
      return SC.store.saveChallengeState(p);
    },

    completedSectionCount: function () {
      var state = SC.store.getState();
      var n = 0;
      SC.config.blueprintSections.forEach(function (s) {
        if (state.blueprintSections[s.key] && state.blueprintSections[s.key].status === 'done') n++;
      });
      return n;
    },

    /* --- プレビュー用リセット ------------------------------------------ */
    clearPreviewState: function () {
      /* 先に保存を消してからイベントを出す（ログも一緒に消えてしまわないように） */
      SC.storage.keysOfApp().forEach(function (k) { SC.storage.remove(k); });
      SC.track.event('preview_reset');
      diagnosisCache = null;
      stateCache = null;
      lastLoadStatus = 'none';
    },

    /* --- 計測 ----------------------------------------------------------- */
    trackEvent: function (name, meta) { return SC.track.event(name, meta); },

    /* テスト・デバッグ用に内部関数を公開 */
    _internal: {
      createInitialState: createInitialState,
      validate: validate,
      buildBlueprint: buildBlueprint,
      buildDay2: buildDay2,
      buildDay3: buildDay3,
      buildDay4: buildDay4,
      stateKey: stateKey,
      diagnosisKey: diagnosisKey,
      resetCache: function () { diagnosisCache = null; stateCache = null; lastLoadStatus = 'none'; }
    }
  };

  SC.optionByValue = optionByValue;
  SC.pausedActionByValue = pausedActionByValue;
  SC.pausedActionLabel = function (value) {
    var a = pausedActionByValue(value);
    return a ? a.label : '';
  };
})(window);
