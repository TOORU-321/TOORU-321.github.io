/* screen-r-day3-done.js : Screen R｜DAY3完了（§23-D） */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;

  SC.screens = SC.screens || {};
  SC.screens.day3_done = {
    id: 'day3_done',
    render: function (ctx) {
      var c = SC.copy.day3Done;
      var d = ctx.diagnosis;

      /* 戻って回答を変えた場合も、ここで最新の値から作り直す（§23-E） */
      SC.day3.syncBlueprint();
      var state = SC.store.getState();
      var v = SC.day3.values(state);

      var celebrate = SC.day3.shouldCelebrate();
      if (celebrate) SC.day3.markCelebrated();

      return h('div', { class: 'screen screen--day3-done' + (celebrate ? ' is-celebrating' : '') }, [
        SC.ui.appHeader({ dayLabel: c.dayLabel, title: c.title, onBack: ctx.back }),

        ctx.restoreNotice ? SC.ui.saveStatus({ text: ctx.restoreNotice, tone: 'info' }) : null,

        /* 成果物：価値の橋（本人が整えた一文） */
        SC.ui.card(c.cardHeading, h('blockquote', { class: 'persona-card' }, [
          h('p', { class: 'persona-card__line', text: SC.day3.bridgeText(state) })
        ]), 'card--project'),

        /* この人を、ここへ連れていく（DAY2との接続） */
        SC.ui.card(c.linkHeading, h('ol', { class: 'journey' }, [
          h('li', { class: 'journey__step' }, [
            h('span', { class: 'journey__label', text: c.linkCustomerLabel }),
            h('span', { class: 'journey__value', text: SC.day3.customerLine(state) })
          ]),
          h('li', { class: 'journey__step' }, [
            h('span', { class: 'journey__label', text: c.linkFirstChangeLabel }),
            h('span', { class: 'journey__value', text: v.firstChange })
          ]),
          h('li', { class: 'journey__step' }, [
            h('span', { class: 'journey__label', text: c.linkDestinationLabel }),
            h('span', { class: 'journey__value', text: v.destination })
          ])
        ])),

        SC.ui.beforeAfter({
          heading: c.beforeAfterHeading,
          beforeLabel: c.beforeLabel,
          afterLabel: c.afterLabel,
          items: SC.day3.buildBeforeAfter(state)
        }),

        /* 中間地点の成長（開始時の空欄と、いまを並べる） */
        SC.ui.card(c.growthHeading, [
          h('p', { class: 'card__note', text: c.growthBefore }),
          h('ul', { class: 'growth-list' }, c.growthItems.map(function (text) {
            return h('li', { class: 'growth-list__item' }, [
              h('span', { class: 'growth-list__mark', 'aria-hidden': 'true', text: '✓' }),
              h('span', { text: text })
            ]);
          }))
        ], 'card--growth'),

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
          onOpen: function () { ctx.track('day4_teaser_opened', { day: 4 }); }
        }),

        SC.ui.ctaArea([
          SC.ui.primaryCta({ label: c.nextDayCta, onClick: function () { ctx.go('day4_intro'); } }),
          SC.ui.secondaryCta({ label: c.backToChange, onClick: function () { ctx.go('day3_current'); } })
        ])
      ]);
    }
  };
})(window);
