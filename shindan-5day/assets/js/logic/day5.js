/* day5.js : DAY5「30日実験を決める」の成果物ロジック。
 * 正本：Notion §29-D／§29-E（2026-08-21 Codex／あかり確定）
 * day2〜day4 と同じ形（value／isComplete／syncBlueprint／complete）にそろえてある。
 *
 * ・DAY5では新しいツールを増やさない。DAY4の4地点をそのまま引き継いで実験に変える
 * ・仮説の選択肢は、DAY4の4地点の言葉で埋めてから見せる
 * ・スコアには一切加点しない（絶対条件2）。設計図進捗だけ 4／5 → 5／5
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  function fill(template, values) {
    return String(template).replace(/\{(\w+)\}/g, function (m, key) {
      return values[key] !== undefined ? values[key] : m;
    });
  }

  /* 文字列全体が鉤括弧で包まれているときだけ外す。
   * 途中に鉤括弧を含む選択肢（DAY4の地点名など）を壊さないため。 */
  function stripQuotes(text) {
    var s = String(text);
    if (s.charAt(0) !== '「' || s.charAt(s.length - 1) !== '」') return s;
    if (s.indexOf('」') !== s.length - 1) return s;
    return s.slice(1, -1);
  }

  var FIELDS = [
    { key: 'hypothesis', customKey: 'hypothesisCustom', options: 'day5Hypotheses', templated: true },
    { key: 'weeklyAction', customKey: 'weeklyActionCustom', options: 'day5WeeklyActions' },
    { key: 'metric', customKey: 'metricCustom', options: 'day5Metrics' },
    { key: 'adjustmentPoint', customKey: 'adjustmentPointCustom', options: 'day5AdjustmentPoints' },
    { key: 'supportMode', customKey: null, options: 'day5SupportModes' }
  ];

  function fieldDef(key) {
    for (var i = 0; i < FIELDS.length; i++) if (FIELDS[i].key === key) return FIELDS[i];
    return null;
  }

  /* 本人が作り直した／戻したことを、その場で一度だけ知らせるための控え */
  var notice = null;

  SC.day5 = {
    DAY: 5,
    SECTION_KEY: 'thirtyDayPlan',
    FIELDS: FIELDS,

    /* 仮説の選択肢は、DAY4で決めた4地点の言葉を入れてから見せる（§29-D Screen AB） */
    options: function (key, state) {
      var def = fieldDef(key);
      var list = SC.copyVersion.list(def.options, state || SC.store.getState());
      if (!def.templated) return list;
      /* DAY4の4地点を、地点名で引ける形にする（真ん中の順番に左右されない） */
      var points = SC.day5.day4Points(state || SC.store.getState());
      return list.map(function (option) {
        return {
          value: option.value,
          label: fill(option.label, points),
          custom: option.custom
        };
      });
    },

    /* DAY4の4地点を { entry, relevance, action, support } で返す */
    day4Points: function (state) {
      var out = {};
      SC.day4.points(state).forEach(function (p) { out[p.point] = p.value; });
      return out;
    },

    value: function (state, key) {
      var def = fieldDef(key);
      var answers = state.day5 || {};
      var selected = answers[def.key];
      if (!selected) return '';
      var option = SC.optionByValue(SC.day5.options(key, state), selected);
      if (!option) return '';
      if (option.custom) return String(answers[def.customKey] || '').trim();
      return stripQuotes(option.label);
    },

    isAnswered: function (state, key) { return SC.day5.value(state, key) !== ''; },

    /* 振り返る時間帯。未設定ならLPで選んだ通知時間を初期値にする（§29-E） */
    reviewWindow: function (state) {
      var saved = (state.day5 || {}).reviewWindow;
      if (saved) return saved;
      return state.reminderWindow || SC.config.defaultReminderWindow;
    },

    reviewDay: function (state) {
      return (state.day5 || {}).reviewDay || SC.config.defaultDay5ReviewDay;
    },

    reviewDayLabel: function (state) {
      var option = SC.optionByValue(SC.config.day5ReviewDays, SC.day5.reviewDay(state));
      return option ? option.label : '';
    },

    reviewWindowLabel: function (state) {
      var option = SC.optionByValue(SC.config.reminderWindows, SC.day5.reviewWindow(state));
      return option ? option.label : '';
    },

    scheduleText: function (state) {
      return fill(SC.copy.day5Schedule.summaryTemplate, {
        day: SC.day5.reviewDayLabel(state),
        window: SC.day5.reviewWindowLabel(state)
      });
    },

    supportLabel: function (state) {
      return SC.day5.value(state, 'supportMode');
    },

    /* AB〜AGの回答がそろっているか（実験文を作れる状態か） */
    isAnswersComplete: function (state) {
      return FIELDS.every(function (f) { return SC.day5.isAnswered(state, f.key); });
    },

    isComplete: function (state) {
      return SC.day5.isAnswersComplete(state) &&
             String((state.day5 || {}).experimentDraft || '').trim() !== '';
    },

    values: function (state) {
      return {
        hypothesis: SC.day5.value(state, 'hypothesis'),
        weeklyAction: SC.day5.value(state, 'weeklyAction'),
        metric: SC.day5.value(state, 'metric'),
        adjustment: SC.day5.value(state, 'adjustmentPoint'),
        support: SC.day5.value(state, 'supportMode'),
        reviewDay: SC.day5.reviewDayLabel(state),
        reviewWindow: SC.day5.reviewWindowLabel(state)
      };
    },

    buildExperiment: function (state) {
      return fill(SC.copy.day5Experiment.templates.experiment, SC.day5.values(state));
    },

    /* 実験文が変わったかを見分ける鍵（§29-E）。
     *
     * 2026-09-12：DAY5の内部値だけを見ていたので、DAY4を変えて仮説の言葉が
     * 変わっても実験文が作り直されず、画面と保存文で別のことを言う状態になっていた。
     * 「実験文を組み立てるのに実際に使った言葉」と文言の版から鍵を作る。
     *
     * ・DAY4を変えれば仮説の言葉が変わるので、ここで拾える
     * ・選んでいない自由入力の控えは入らないので、むだな作り直しが起きない
     * ・区切り文字は使わない（自由入力の記号でぶつからないように）。先頭の v2 は形の目印 */
    sourceKey: function (state) {
      var v = SC.day5.values(state);
      return 'v2' + JSON.stringify([
        SC.copyVersion ? SC.copyVersion.of(state) : '',
        v.hypothesis, v.weeklyAction, v.metric, v.adjustment, v.support,
        v.reviewDay, v.reviewWindow
      ]);
    },

    /* 2026-09-12より前の鍵の形。鍵の形が変わっただけなのかを見分けるために残してある */
    legacySourceKey: function (state) {
      var a = state.day5 || {};
      return FIELDS.map(function (f) {
        var custom = (f.customKey && a[f.key] === 'custom') ? (a[f.customKey] || '') : '';
        return (a[f.key] || '') + ':' + custom;
      }).join('|') + '#' + SC.day5.reviewDay(state) + '#' + SC.day5.reviewWindow(state);
    },

    isLegacyKey: function (key) {
      return String(key || '').slice(0, 2) !== 'v2';
    },

    /* Screen AH を開いたときに実験文を用意する。
     * 戻って回答を変えていたら作り直し、本人の編集フラグを戻す（§29-E）。
     * ただし本人が手を入れた文章は、黙って作り直さない（2026-09-12）。
     * 返り値: 'created' | 'regenerated' | 'kept' | 'needs-choice'
     *         | 'needs-choice-stale' | 'incomplete' | 'unsupported-version' */
    ensureExperiment: function () {
      var state = SC.store.getState();
      /* 言葉を用意できない版では、作り直しも判定もしない */
      if (SC.copyVersion && SC.copyVersion.isUnsupported(state)) return 'unsupported-version';
      if (!SC.day5.isAnswersComplete(state)) return 'incomplete';
      var key = SC.day5.sourceKey(state);
      var a = state.day5;

      if (!a.experimentDraft) {
        SC.store.setDayAnswer('day5', {
          experimentDraft: SC.day5.buildExperiment(state), experimentEdited: false,
          experimentSourceKey: key, experimentAckedSourceKey: ''
        });
        return 'created';
      }
      if (a.experimentSourceKey === key) return 'kept';
      if (a.experimentAckedSourceKey === key) return 'kept';   /* 本人が「残す」を選んだあと */

      /* 2026-09-12より前に保存された文章。鍵の形が違うだけかもしれない。
       * いまの回答から作った文と同じなら整合しているので、鍵だけ移す */
      if (SC.day5.isLegacyKey(a.experimentSourceKey)) {
        if (String(a.experimentDraft).trim() === SC.day5.buildExperiment(state).trim()) {
          SC.store.setDayAnswer('day5', { experimentSourceKey: key });
          return 'kept';
        }
        return a.experimentEdited ? 'needs-choice' : 'needs-choice-stale';
      }

      /* 新しい鍵で、実際に変わったと分かったとき */
      if (a.experimentEdited) return 'needs-choice';

      SC.store.setDayAnswer('day5', {
        experimentDraft: SC.day5.buildExperiment(state), experimentEdited: false,
        experimentSourceKey: key, experimentAckedSourceKey: ''
      });
      return 'regenerated';
    },

    /* 「今の文章を残す」を選んだとき。文章は触らず、聞いたことだけ覚える */
    keepEditedExperiment: function () {
      var state = SC.store.getState();
      SC.store.setDayAnswer('day5', { experimentAckedSourceKey: SC.day5.sourceKey(state) });
      SC.track.event('day5_experiment_kept_edited');
    },

    /* 「今の回答から作り直す」を選んだとき。前の文章と、その文章の鍵を取っておく */
    regenerateExperiment: function () {
      var state = SC.store.getState();
      var a = state.day5 || {};
      SC.store.setDayAnswer('day5', {
        experimentPrevDraft: String(a.experimentDraft || ''),
        experimentPrevSourceKey: String(a.experimentSourceKey || ''),
        experimentPrevEdited: !!a.experimentEdited,
        experimentDraft: SC.day5.buildExperiment(state),
        experimentEdited: false,
        experimentSourceKey: SC.day5.sourceKey(state),
        experimentAckedSourceKey: ''
      });
      notice = 'rebuilt';
      SC.track.event('day5_experiment_regenerated');
    },

    /* 作り直す前の文章へ戻す。
     * ★戻した文章はいまの回答ではなく前の回答に対応している。
     *   鍵も当時のものへ戻し、ずれていることを注記で出せるようにする */
    restorePrevExperiment: function () {
      var state = SC.store.getState();
      var a = state.day5 || {};
      var prev = String(a.experimentPrevDraft || '');
      if (!prev) return false;
      SC.store.setDayAnswer('day5', {
        experimentDraft: prev,
        experimentEdited: a.experimentPrevEdited !== false,
        experimentSourceKey: String(a.experimentPrevSourceKey || ''),
        experimentAckedSourceKey: SC.day5.sourceKey(state),
        experimentPrevDraft: '', experimentPrevSourceKey: '', experimentPrevEdited: false
      });
      notice = 'restored';
      SC.track.event('day5_experiment_restored');
      return true;
    },

    /* 画面で一度だけ出す知らせ。読んだら消す（再表示のたびには出さない） */
    takeExperimentNotice: function () {
      var n = notice;
      notice = null;
      return n;
    },

    /* 保存されている実験文が、いまの回答とずれたままかどうか */
    isExperimentBehindAnswers: function (state) {
      var a = state.day5 || {};
      if (!a.experimentDraft) return false;
      if (!SC.day5.isAnswersComplete(state)) return false;
      var key = SC.day5.sourceKey(state);
      if (a.experimentSourceKey === key) return false;
      if (a.experimentAckedSourceKey !== key) return false;
      return String(a.experimentDraft).trim() !== SC.day5.buildExperiment(state).trim();
    },

    /* 出す注記の種類。'edited'（本人の編集を残した）／'stale'（古い保存文を残した） */
    experimentBehindKind: function (state) {
      if (!SC.day5.isExperimentBehindAnswers(state)) return null;
      return (state.day5 || {}).experimentEdited ? 'edited' : 'stale';
    },

    experimentText: function (state) {
      return String((state.day5 || {}).experimentDraft || '').trim();
    },

    /* 30日実験カードの7項目（§29-D Screen AH） */
    cardItems: function (state) {
      var c = SC.copy.day5Experiment;
      var l = c.itemLabels;
      return [
        { label: l.hypothesis, value: SC.day5.value(state, 'hypothesis') },
        { label: l.weeklyAction, value: SC.day5.value(state, 'weeklyAction') },
        { label: l.metric, value: SC.day5.value(state, 'metric') },
        { label: l.schedule, value: SC.day5.scheduleText(state) },
        { label: l.adjustment, value: SC.day5.value(state, 'adjustmentPoint') },
        { label: l.fallback, value: c.fallbackValue },
        { label: l.support, value: SC.day5.supportLabel(state) }
      ];
    },

    /* 5日前 → いま（DAY2の客・DAY3の到達点・DAY4の入口と支援・DAY5の仮説を使う） */
    buildBeforeAfter: function (state) {
      var t = SC.copy.day5Done.templates;
      var day4 = SC.day5.day4Points(state);
      return [{
        before: t.before,
        after: fill(t.after, {
          customer: SC.day3.customerLine(state),
          destination: SC.day3.value(state, 'destination'),
          entry: day4.entry,
          support: day4.support,
          hypothesis: SC.day5.value(state, 'hypothesis')
        })
      }];
    },

    summary: function (state) {
      return fill(SC.copy.day5Done.templates.blueprintSummary, SC.day5.values(state));
    },

    /* 出し分けは SC.offers へ移した（§37-7）。ここは呼び出し口だけ残す。 */
    supportRecommendation: function (state) {
      var d = SC.store.loadDiagnosis();
      return SC.offers.resolveSupportRecommendation((state.day5 || {}).supportMode, d.lowestAxis, state.day5CompletedAt);
    },

    /* 再診断の予定日（§36-5）。未設定なら null */
    reassessmentDue: function (state) {
      if (!state.reassessmentDueAt) return null;
      var d = new Date(state.reassessmentDueAt);
      if (isNaN(d.getTime())) return null;
      return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
    },

    /* 一本線シートの「30日間の育て方」だけを完了にする */
    syncBlueprint: function () {
      var state = SC.store.getState();
      if (state.completedDays.indexOf(SC.day5.DAY) === -1) return state;
      return SC.store.setBlueprintSection(SC.day5.SECTION_KEY, {
        status: 'done',
        summary: SC.day5.summary(state)
      });
    },

    /* DAY5完了。スコアには一切加点しない（絶対条件2） */
    complete: function (ctx) {
      var state = SC.store.getState();
      var first = state.completedDays.indexOf(SC.day5.DAY) === -1;
      if (first) {
        var days = state.completedDays.slice();
        days.push(SC.day5.DAY);
        ctx.save({ completedDays: days, day5CompletedAt: new Date().toISOString() });
        /* 初回のみ記録。回答を変えて再完了しても重複させない（§29-E） */
        ctx.track('day5_completed', { day: SC.day5.DAY });
      }
      /* 30日実験の開始日と再診断の予定日を初回だけ決める（§36-5）。
       * 回答を変えて再完了しても日付は動かさない。 */
      var before = SC.store.getState().experimentStartedAt;
      SC.store.startExperimentWindow(SC.config.experimentDays);
      if (!before && SC.store.getState().experimentStartedAt) {
        ctx.track('reassessment_scheduled', { day: SC.day5.DAY });
      }
      SC.day5.syncBlueprint();
      return SC.store.getState();
    },

    shouldCelebrate: function () {
      var state = SC.store.getState();
      return state.completedDays.indexOf(SC.day5.DAY) !== -1 &&
             state.celebratedDays.indexOf(SC.day5.DAY) === -1;
    },

    markCelebrated: function () {
      var state = SC.store.getState();
      if (state.celebratedDays.indexOf(SC.day5.DAY) !== -1) return state;
      var list = state.celebratedDays.slice();
      list.push(SC.day5.DAY);
      return SC.store.saveChallengeState({ celebratedDays: list });
    }
  };
})(window);
