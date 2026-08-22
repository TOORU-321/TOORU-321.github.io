/* day3.js : DAY3「届ける変化を一本の橋にする」の成果物ロジック。
 * 正本：Notion §23-D／§23-E（2026-08-20 Codex／あかり確定）
 * day1.js / day2.js と同じ形（value／isComplete／syncBlueprint／complete）にそろえてある。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  function fill(template, values) {
    return String(template).replace(/\{(\w+)\}/g, function (m, key) {
      return values[key] !== undefined ? values[key] : m;
    });
  }

  function stripQuotes(text) {
    return String(text).replace(/^「/, '').replace(/」$/, '');
  }

  var FIELDS = [
    { key: 'currentState', customKey: 'currentStateCustom', options: 'day3CurrentStates' },
    { key: 'wall', customKey: 'wallCustom', options: 'day3Walls' },
    { key: 'firstChange', customKey: 'firstChangeCustom', options: 'day3FirstChanges' },
    { key: 'destination', customKey: 'destinationCustom', options: 'day3Destinations' },
    { key: 'productRole', customKey: 'productRoleCustom', options: 'day3Roles' }
  ];

  function fieldDef(key) {
    for (var i = 0; i < FIELDS.length; i++) if (FIELDS[i].key === key) return FIELDS[i];
    return null;
  }

  SC.day3 = {
    DAY: 3,
    SECTION_KEY: 'valueBridge',
    FIELDS: FIELDS,

    options: function (key) { return SC.config[fieldDef(key).options]; },

    /* いま選ばれている値を文字列で返す（custom のときだけ自由入力を使う） */
    value: function (state, key) {
      var def = fieldDef(key);
      var answers = state.day3 || {};
      var selected = answers[def.key];
      if (!selected) return '';
      var option = SC.optionByValue(SC.config[def.options], selected);
      if (!option) return '';
      if (option.custom) return String(answers[def.customKey] || '').trim();
      return stripQuotes(option.label);
    },

    isAnswered: function (state, key) { return SC.day3.value(state, key) !== ''; },

    /* 5つの問いがすべて答えられているか（価値の橋を作れる状態か） */
    isAnswersComplete: function (state) {
      return FIELDS.every(function (f) { return SC.day3.isAnswered(state, f.key); });
    },

    /* 価値の橋まで含めて完了できるか */
    isComplete: function (state) {
      return SC.day3.isAnswersComplete(state) &&
             String((state.day3 || {}).bridgeDraft || '').trim() !== '';
    },

    values: function (state) {
      var day2 = SC.day2.values(state);
      return {
        scene: day2.scene,
        voice: day2.voice,
        hope: day2.hope,
        focus: day2.focus,
        current: SC.day3.value(state, 'currentState'),
        wall: SC.day3.value(state, 'wall'),
        firstChange: SC.day3.value(state, 'firstChange'),
        destination: SC.day3.value(state, 'destination'),
        role: SC.day3.value(state, 'productRole')
      };
    },

    /* 5つの回答から自動生成した価値の橋 */
    buildBridge: function (state) {
      return fill(SC.copy.day3Done.templates.bridge, SC.day3.values(state));
    },

    /* 元の回答が変わったかを見分けるための鍵（§23-E） */
    sourceKey: function (state) {
      var a = state.day3 || {};
      return FIELDS.map(function (f) {
        return (a[f.key] || '') + ':' + (a[f.key] === 'custom' ? (a[f.customKey] || '') : '');
      }).join('|');
    },

    /* Screen Q を開いたときに橋を用意する。
     * 戻って元回答を変えていたら作り直し、本人の編集フラグを戻す（§23-E）。
     * 返り値: 'created' | 'regenerated' | 'kept' */
    ensureBridge: function () {
      var state = SC.store.getState();
      if (!SC.day3.isAnswersComplete(state)) return 'incomplete';
      var key = SC.day3.sourceKey(state);
      var a = state.day3;
      if (!a.bridgeDraft) {
        SC.store.setDayAnswer('day3', {
          bridgeDraft: SC.day3.buildBridge(state), bridgeEdited: false, bridgeSourceKey: key
        });
        return 'created';
      }
      if (a.bridgeSourceKey !== key) {
        SC.store.setDayAnswer('day3', {
          bridgeDraft: SC.day3.buildBridge(state), bridgeEdited: false, bridgeSourceKey: key
        });
        return 'regenerated';
      }
      return 'kept';
    },

    bridgeText: function (state) {
      return String((state.day3 || {}).bridgeDraft || '').trim();
    },

    buildBeforeAfter: function (state) {
      var t = SC.copy.day3Done.templates;
      var v = SC.day3.values(state);
      return [{ before: t.before, after: fill(t.after, v) }];
    },

    customerLine: function (state) {
      return fill(SC.copy.day3Done.templates.customer, SC.day3.values(state));
    },

    summary: function (state) {
      return fill(SC.copy.day3Done.templates.blueprintSummary, SC.day3.values(state));
    },

    /* 一本線シートの「届けたい変化」だけを完了にする */
    syncBlueprint: function () {
      var state = SC.store.getState();
      if (state.completedDays.indexOf(SC.day3.DAY) === -1) return state;
      return SC.store.setBlueprintSection(SC.day3.SECTION_KEY, {
        status: 'done',
        summary: SC.day3.summary(state)
      });
    },

    /* DAY3完了。スコアには一切加点しない（絶対条件2） */
    complete: function (ctx) {
      var state = SC.store.getState();
      var first = state.completedDays.indexOf(SC.day3.DAY) === -1;
      if (first) {
        var days = state.completedDays.slice();
        days.push(SC.day3.DAY);
        ctx.save({ completedDays: days, day3CompletedAt: new Date().toISOString() });
        /* 初回のみ記録。回答を変えて再完了しても重複させない（§23-E） */
        ctx.track('day3_completed', { day: SC.day3.DAY });
      }
      SC.day3.syncBlueprint();
      return SC.store.getState();
    },

    shouldCelebrate: function () {
      var state = SC.store.getState();
      return state.completedDays.indexOf(SC.day3.DAY) !== -1 &&
             state.celebratedDays.indexOf(SC.day3.DAY) === -1;
    },

    markCelebrated: function () {
      var state = SC.store.getState();
      if (state.celebratedDays.indexOf(SC.day3.DAY) !== -1) return state;
      var list = state.celebratedDays.slice();
      list.push(SC.day3.DAY);
      return SC.store.saveChallengeState({ celebratedDays: list });
    }
  };
})(window);
