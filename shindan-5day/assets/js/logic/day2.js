/* day2.js : DAY2「ひとりの心が動く場面をつかむ」の成果物ロジック。
 * 正本：Notion §21-B／§21-C（2026-08-19 Codex／あかり確定）
 * day1.js と同じ形（complete／syncBlueprint／buildBeforeAfter）にそろえてある。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  function fill(template, values) {
    return String(template).replace(/\{(\w+)\}/g, function (m, key) {
      return values[key] !== undefined ? values[key] : m;
    });
  }

  /* 選択肢ラベルの外側の「」を外す（カード文で二重にしないため） */
  function stripQuotes(text) {
    return String(text).replace(/^「/, '').replace(/」$/, '');
  }

  var FIELDS = [
    { key: 'scene', customKey: 'sceneCustom', options: 'day2Scenes' },
    { key: 'voice', customKey: 'voiceCustom', options: 'day2Voices' },
    { key: 'hope', customKey: 'hopeCustom', options: 'day2Hopes' }
  ];

  function fieldDef(key) {
    for (var i = 0; i < FIELDS.length; i++) if (FIELDS[i].key === key) return FIELDS[i];
    return null;
  }

  SC.day2 = {
    DAY: 2,
    SECTION_KEY: 'customerEmotion',
    FIELDS: FIELDS,

    options: function (key) { return SC.config[fieldDef(key).options]; },

    /* いま選ばれている値を文字列で返す。
     * custom を選んだときだけ自由入力を使う（§21-C：既定選択肢へ戻したら入力は使わない） */
    value: function (state, key) {
      var def = fieldDef(key);
      var answers = state.day2 || {};
      var selected = answers[def.key];
      if (!selected) return '';
      var option = SC.optionByValue(SC.config[def.options], selected);
      if (!option) return '';
      if (option.custom) return String(answers[def.customKey] || '').trim();
      return stripQuotes(option.label);
    },

    /* その項目の回答が成立しているか（customは本文が必要） */
    isAnswered: function (state, key) {
      return SC.day2.value(state, key) !== '';
    },

    isComplete: function (state) {
      return FIELDS.every(function (f) { return SC.day2.isAnswered(state, f.key); });
    },

    values: function (state) {
      return {
        scene: SC.day2.value(state, 'scene'),
        voice: SC.day2.value(state, 'voice'),
        hope: SC.day2.value(state, 'hope'),
        focus: SC.axisLabel(state.selectedFocusAxis)
      };
    },

    /* ひとりのお客様カード（3行） */
    buildCard: function (state) {
      var t = SC.copy.day2Done.templates;
      var v = SC.day2.values(state);
      return [fill(t.cardLine1, v), fill(t.cardLine2, v), fill(t.cardLine3, v)];
    },

    /* DAY1の改善軸との接続文 */
    linkText: function (state) {
      return fill(SC.copy.day2Done.templates.link, SC.day2.values(state));
    },

    buildBeforeAfter: function (state) {
      var t = SC.copy.day2Done.templates;
      var v = SC.day2.values(state);
      return [{ before: t.before, after: fill(t.after, v) }];
    },

    summary: function (state) {
      return fill(SC.copy.day2Done.templates.blueprintSummary, SC.day2.values(state));
    },

    /* 一本線シートの「ひとりのお客様の感情」だけを完了にする */
    syncBlueprint: function () {
      var state = SC.store.getState();
      if (state.completedDays.indexOf(SC.day2.DAY) === -1) return state;
      return SC.store.setBlueprintSection(SC.day2.SECTION_KEY, {
        status: 'done',
        summary: SC.day2.summary(state)
      });
    },

    /* DAY2完了。スコアには一切加点しない（絶対条件2） */
    complete: function (ctx) {
      var state = SC.store.getState();
      var first = state.completedDays.indexOf(SC.day2.DAY) === -1;
      if (first) {
        var days = state.completedDays.slice();
        days.push(SC.day2.DAY);
        ctx.save({ completedDays: days, day2CompletedAt: new Date().toISOString() });
        /* 初回のみ記録。回答を変えて再完了しても重複させない（§21-C） */
        ctx.track('day2_completed', { day: SC.day2.DAY });
      }
      SC.day2.syncBlueprint();
      return SC.store.getState();
    },

    shouldCelebrate: function () {
      var state = SC.store.getState();
      return state.completedDays.indexOf(SC.day2.DAY) !== -1 &&
             state.celebratedDays.indexOf(SC.day2.DAY) === -1;
    },

    markCelebrated: function () {
      var state = SC.store.getState();
      if (state.celebratedDays.indexOf(SC.day2.DAY) !== -1) return state;
      var list = state.celebratedDays.slice();
      list.push(SC.day2.DAY);
      return SC.store.saveChallengeState({ celebratedDays: list });
    }
  };
})(window);
