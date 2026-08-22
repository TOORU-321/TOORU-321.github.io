/* day1.js : DAY1の成果物ロジック（完了処理・一本線シート反映・Before／After生成）。
 * 画面から切り離してあるので、DAY2以降も同じ形（SC.day2 …）で足せる。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  function fill(template, values) {
    return String(template).replace(/\{(\w+)\}/g, function (m, key) {
      return values[key] !== undefined ? values[key] : m;
    });
  }

  function labels(state) {
    return {
      focus: SC.axisLabel(state.selectedFocusAxis),
      paused: SC.pausedActionLabel(state.pausedAction)
    };
  }

  SC.day1 = {
    DAY: 1,
    SECTION_KEY: 'focusPoint',

    /* 本人の選択値からBefore／After文を生成する */
    buildBeforeAfter: function (state) {
      var t = SC.copy.day1Done.templates;
      var v = labels(state);
      return [
        { before: fill(t.focus.before, v), after: fill(t.focus.after, v) },
        { before: fill(t.paused.before, v), after: fill(t.paused.after, v) }
      ];
    },

    summary: function (state) {
      return fill(SC.copy.day1Done.templates.blueprintSummary, labels(state));
    },

    /* 一本線シートの「今直す場所」だけを完了にする（他DAYは未記入のまま） */
    syncBlueprint: function () {
      var state = SC.store.getState();
      if (state.completedDays.indexOf(SC.day1.DAY) === -1) return state;
      return SC.store.setBlueprintSection(SC.day1.SECTION_KEY, {
        status: 'done',
        summary: SC.day1.summary(state)
      });
    },

    /* DAY1完了。スコアには一切加点しない（絶対条件2） */
    complete: function (ctx) {
      var state = SC.store.getState();
      var first = state.completedDays.indexOf(SC.day1.DAY) === -1;
      if (first) {
        var days = state.completedDays.slice();
        days.push(SC.day1.DAY);
        ctx.save({ completedDays: days, day1CompletedAt: new Date().toISOString() });
        ctx.track('day1_completed', { day: SC.day1.DAY });
      }
      SC.day1.syncBlueprint();
      return SC.store.getState();
    },

    /* 完了演出は1回だけ */
    shouldCelebrate: function () {
      var state = SC.store.getState();
      return state.completedDays.indexOf(SC.day1.DAY) !== -1 &&
             state.celebratedDays.indexOf(SC.day1.DAY) === -1;
    },

    markCelebrated: function () {
      var state = SC.store.getState();
      if (state.celebratedDays.indexOf(SC.day1.DAY) !== -1) return state;
      var list = state.celebratedDays.slice();
      list.push(SC.day1.DAY);
      return SC.store.saveChallengeState({ celebratedDays: list });
    }
  };
})(window);
