/* screen-e-day1-done.js : Screen E｜DAY1完了・成長を確認する（画面5） */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;

  SC.screens = SC.screens || {};
  SC.screens.day1_done = {
    id: 'day1_done',
    render: function (ctx) {
      var c = SC.copy.day1Done;
      var d = ctx.diagnosis;

      /* 戻って選択を変えた場合も、ここで最新の選択値を設計図へ反映し直す */
      SC.day1.syncBlueprint();
      var state = SC.store.getState();

      var focusLabel = SC.axisLabel(state.selectedFocusAxis);
      var pausedLabel = SC.pausedActionLabel(state.pausedAction);
      var celebrate = SC.day1.shouldCelebrate();
      if (celebrate) SC.day1.markCelebrated();

      function row(label, value) {
        return h('div', { class: 'kv' }, [
          h('dt', { class: 'kv__key', text: label }),
          h('dd', { class: 'kv__value', text: value })
        ]);
      }

      return h('div', { class: 'screen screen--day1-done' + (celebrate ? ' is-celebrating' : '') }, [
        SC.ui.appHeader({ dayLabel: c.dayLabel, title: c.title, onBack: ctx.back }),

        ctx.restoreNotice ? SC.ui.saveStatus({ text: ctx.restoreNotice, tone: 'info' }) : null,

        SC.ui.card(c.cardHeading, h('dl', { class: 'kv-list' }, [
          row(c.focusLabel, focusLabel +
            (state.focusAxisChosenByUser ? '（あなたが選びました）' : '（診断からのおすすめのまま）')),
          row(c.reasonLabel, SC.copy.axisReason[state.selectedFocusAxis]),
          row(c.pausedLabel, pausedLabel),
          row(c.goalLabel, SC.copy.axisGoal[state.selectedFocusAxis])
        ]), 'card--project'),

        SC.ui.beforeAfter({
          heading: c.beforeAfterHeading,
          beforeLabel: c.beforeLabel,
          afterLabel: c.afterLabel,
          items: SC.day1.buildBeforeAfter(state)
        }),

        SC.ui.blueprintProgress({
          state: state,
          heading: c.progressHeading
        }),

        /* 生存力スコアと設計図進捗を混ぜない（絶対条件1・2） */
        SC.ui.card(null, [
          h('p', { class: 'score-keep' }, [
            h('span', { class: 'score-keep__label', text: SC.copy.diagnosisName }),
            h('span', { class: 'score-keep__value', text: d.totalScore + ' / ' + SC.config.totalMax }),
            h('span', { class: 'score-keep__band', text: d.scoreBand.label })
          ]),
          SC.ui.prose(c.scoreNote, 'card__note prose__line')
        ], 'card--score-keep'),

        SC.ui.card(null, SC.ui.prose(c.completeText), 'card--complete card--reading'),

        SC.ui.dayTeaser({
          title: c.teaserTitle,
          body: c.teaserBody,
          onOpen: function () { ctx.track('day2_teaser_opened', { day: 2 }); }
        }),

        SC.ui.ctaArea([
          SC.ui.primaryCta({ label: c.nextDayCta, onClick: function () { ctx.go('day2_intro'); } }),
          SC.ui.secondaryCta({ label: c.backToChange, onClick: function () { ctx.go('day1_focus'); } })
        ])
      ]);
    }
  };
})(window);
