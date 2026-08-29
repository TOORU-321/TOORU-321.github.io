/* screen-j-day2-done.js : Screen J｜DAY2完了（§21-B） */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;

  SC.screens = SC.screens || {};
  SC.screens.day2_done = {
    id: 'day2_done',
    render: function (ctx) {
      var c = SC.copy.day2Done;
      var d = ctx.diagnosis;

      /* 戻って回答を変えた場合も、ここで最新の値から作り直す（§21-C） */
      SC.day2.syncBlueprint();
      var state = SC.store.getState();

      var celebrate = SC.day2.shouldCelebrate();
      if (celebrate) SC.day2.markCelebrated();

      return h('div', { class: 'screen screen--day2-done' + (celebrate ? ' is-celebrating' : '') }, [
        SC.ui.appHeader({ dayLabel: c.dayLabel, title: c.title, onBack: ctx.back }),

        ctx.restoreNotice ? SC.ui.saveStatus({ text: ctx.restoreNotice, tone: 'info' }) : null,

        /* ひとりのお客様カード（本人の回答から生成） */
        SC.ui.card(c.cardHeading, h('blockquote', { class: 'persona-card' },
          SC.day2.buildCard(state).map(function (line) {
            return h('p', { class: 'persona-card__line', text: line });
          })
        ), 'card--project'),

        /* DAY1の改善軸との接続 */
        SC.ui.card(c.linkHeading, h('p', { class: 'card__body', text: SC.day2.linkText(state) })),

        SC.ui.beforeAfter({
          heading: c.beforeAfterHeading,
          beforeLabel: c.beforeLabel,
          afterLabel: c.afterLabel,
          items: SC.day2.buildBeforeAfter(state)
        }),

        SC.ui.blueprintProgress({
          state: state,
          heading: c.progressHeading
        }),

        /* 現在地スコアと設計図進捗を混ぜない（絶対条件1・2） */
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
          onOpen: function () { ctx.track('day3_teaser_opened', { day: 3 }); }
        }),

        SC.ui.ctaArea([
          SC.ui.primaryCta({ label: c.nextDayCta, onClick: function () { ctx.go('day3_intro'); } }),
          SC.ui.secondaryCta({ label: c.backToChange, onClick: function () { ctx.go('day2_scene'); } })
        ])
      ]);
    }
  };
})(window);
