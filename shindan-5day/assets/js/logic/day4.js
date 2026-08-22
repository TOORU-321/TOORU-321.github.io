/* day4.js : DAY4「SNSから支援までを一本道にする」の成果物ロジック。
 * 正本：Notion §26-B／§26-C（2026-08-21 Codex／あかり確定）
 * day2.js / day3.js と同じ形（value／isComplete／syncBlueprint／complete）にそろえてある。
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
    { key: 'entry', customKey: 'entryCustom', options: 'day4Entries', point: 'entry' },
    { key: 'relevanceExperience', customKey: 'relevanceExperienceCustom', options: 'day4Relevance', point: 'relevance' },
    { key: 'smallAction', customKey: 'smallActionCustom', options: 'day4Actions', point: 'action' },
    { key: 'support', customKey: 'supportCustom', options: 'day4Supports', point: 'support' }
  ];

  function fieldDef(key) {
    for (var i = 0; i < FIELDS.length; i++) if (FIELDS[i].key === key) return FIELDS[i];
    return null;
  }

  SC.day4 = {
    DAY: 4,
    SECTION_KEY: 'journey',
    FIELDS: FIELDS,

    options: function (key) { return SC.config[fieldDef(key).options]; },

    value: function (state, key) {
      var def = fieldDef(key);
      var answers = state.day4 || {};
      var selected = answers[def.key];
      if (!selected) return '';
      var option = SC.optionByValue(SC.config[def.options], selected);
      if (!option) return '';
      if (option.custom) return String(answers[def.customKey] || '').trim();
      return stripQuotes(option.label);
    },

    isAnswered: function (state, key) { return SC.day4.value(state, key) !== ''; },

    /* 4地点がそろっているか（順番を決められる状態か） */
    isAnswersComplete: function (state) {
      return FIELDS.every(function (f) { return SC.day4.isAnswered(state, f.key); });
    },

    isComplete: function (state) {
      return SC.day4.isAnswersComplete(state) &&
             String((state.day4 || {}).journeyDraft || '').trim() !== '';
    },

    order: function (state) {
      var v = (state.day4 || {}).middleOrder;
      return v === 'action_first' ? 'action_first' : 'relevance_first';
    },

    /* 選んだ順番で4地点を並べる（§26-B Screen X） */
    points: function (state) {
      var c = SC.copy.day4Done;
      var middles = SC.day4.order(state) === 'action_first'
        ? ['action', 'relevance']
        : ['relevance', 'action'];
      var keyOf = { entry: 'entry', relevance: 'relevanceExperience', action: 'smallAction', support: 'support' };
      return ['entry'].concat(middles, ['support']).map(function (point) {
        return {
          point: point,
          label: c.pointLabels[point],
          emotion: c.emotions[point],
          value: SC.day4.value(state, keyOf[point])
        };
      });
    },

    values: function (state) {
      var points = SC.day4.points(state);
      return {
        entry: points[0].value,
        mid1: points[1].value,
        mid2: points[2].value,
        support: points[3].value
      };
    },

    buildJourney: function (state) {
      return fill(SC.copy.day4Done.templates.journey, SC.day4.values(state));
    },

    /* 元の回答・順番が変わったかを見分けるための鍵（§26-C） */
    sourceKey: function (state) {
      var a = state.day4 || {};
      return FIELDS.map(function (f) {
        return (a[f.key] || '') + ':' + (a[f.key] === 'custom' ? (a[f.customKey] || '') : '');
      }).join('|') + '#' + SC.day4.order(state);
    },

    /* Screen Y を開いたときに導線文を用意する。
     * 戻って回答や順番を変えていたら作り直し、本人の編集フラグを戻す（§26-C）。
     * 返り値: 'created' | 'regenerated' | 'kept' | 'incomplete' */
    ensureJourney: function () {
      var state = SC.store.getState();
      if (!SC.day4.isAnswersComplete(state)) return 'incomplete';
      var key = SC.day4.sourceKey(state);
      var a = state.day4;
      if (!a.journeyDraft) {
        SC.store.setDayAnswer('day4', {
          journeyDraft: SC.day4.buildJourney(state), journeyEdited: false, journeySourceKey: key
        });
        return 'created';
      }
      if (a.journeySourceKey !== key) {
        SC.store.setDayAnswer('day4', {
          journeyDraft: SC.day4.buildJourney(state), journeyEdited: false, journeySourceKey: key
        });
        return 'regenerated';
      }
      return 'kept';
    },

    journeyText: function (state) {
      return String((state.day4 || {}).journeyDraft || '').trim();
    },

    /* 選ばなかった既定候補（§26-B「今は使わない候補」）。成果物には混ぜない */
    unusedOptions: function (state) {
      var c = SC.copy.day4Done;
      var answers = state.day4 || {};
      return FIELDS.map(function (f) {
        return {
          label: c.pointLabels[f.point],
          items: SC.config[f.options].filter(function (o) {
            return !o.custom && o.value !== answers[f.key];
          }).map(function (o) { return o.label; })
        };
      });
    },

    buildBeforeAfter: function (state) {
      var t = SC.copy.day4Done.templates;
      return [{ before: t.before, after: fill(t.after, SC.day4.values(state)) }];
    },

    summary: function (state) {
      return fill(SC.copy.day4Done.templates.blueprintSummary, SC.day4.values(state));
    },

    /* 一本線シートの「SNSから支援までの一本道」だけを完了にする */
    syncBlueprint: function () {
      var state = SC.store.getState();
      if (state.completedDays.indexOf(SC.day4.DAY) === -1) return state;
      return SC.store.setBlueprintSection(SC.day4.SECTION_KEY, {
        status: 'done',
        summary: SC.day4.summary(state)
      });
    },

    /* DAY4完了。スコアには一切加点しない（絶対条件2） */
    complete: function (ctx) {
      var state = SC.store.getState();
      var first = state.completedDays.indexOf(SC.day4.DAY) === -1;
      if (first) {
        var days = state.completedDays.slice();
        days.push(SC.day4.DAY);
        ctx.save({ completedDays: days, day4CompletedAt: new Date().toISOString() });
        /* 初回のみ記録。回答を変えて再完了しても重複させない（§26-C） */
        ctx.track('day4_completed', { day: SC.day4.DAY });
      }
      SC.day4.syncBlueprint();
      return SC.store.getState();
    },

    shouldCelebrate: function () {
      var state = SC.store.getState();
      return state.completedDays.indexOf(SC.day4.DAY) !== -1 &&
             state.celebratedDays.indexOf(SC.day4.DAY) === -1;
    },

    markCelebrated: function () {
      var state = SC.store.getState();
      if (state.celebratedDays.indexOf(SC.day4.DAY) !== -1) return state;
      var list = state.celebratedDays.slice();
      list.push(SC.day4.DAY);
      return SC.store.saveChallengeState({ celebratedDays: list });
    }
  };
})(window);
