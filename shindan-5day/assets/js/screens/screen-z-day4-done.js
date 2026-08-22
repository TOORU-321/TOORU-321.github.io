/* screen-z-day4-done.js : Screen Z｜DAY4完了（§26-B） */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;

  SC.screens = SC.screens || {};
  SC.screens.day4_done = {
    id: 'day4_done',
    render: function (ctx) {
      var c = SC.copy.day4Done;
      var d = ctx.diagnosis;

      /* 戻って回答や順番を変えた場合も、ここで最新の値から作り直す（§26-C） */
      SC.day4.syncBlueprint();
      var state = SC.store.getState();
      var celebrate = SC.day4.shouldCelebrate();
      if (celebrate) SC.day4.markCelebrated();

      return h('div', { class: 'screen screen--day4-done' + (celebrate ? ' is-celebrating' : '') }, [
        SC.ui.appHeader({ dayLabel: c.dayLabel, title: c.title, onBack: ctx.back }),

        ctx.restoreNotice ? SC.ui.saveStatus({ text: ctx.restoreNotice, tone: 'info' }) : null,

        /* 成果物：4地点＋矢印＋感情ラベル と、本人が整えた導線文 */
        SC.ui.card(c.cardHeading, [
          SC.ui.journeyMap({ state: state, withEmotion: true }),
          h('blockquote', { class: 'persona-card journey-card' }, [
            h('p', { class: 'persona-card__line', text: SC.day4.journeyText(state) })
          ])
        ], 'card--project'),

        /* 価値の橋を、この順番で届ける（DAY3との接続） */
        SC.ui.card(c.linkHeading, h('ol', { class: 'journey' }, [
          h('li', { class: 'journey__step' }, [
            h('span', { class: 'journey__label', text: c.linkBridgeLabel }),
            h('span', { class: 'journey__value', text: SC.day3.bridgeText(state) })
          ]),
          h('li', { class: 'journey__step' }, [
            h('span', { class: 'journey__label', text: c.linkJourneyLabel }),
            h('span', { class: 'journey__value', text: SC.day4.journeyText(state) })
          ])
        ])),

        SC.ui.beforeAfter({
          heading: c.beforeAfterHeading,
          beforeLabel: c.beforeLabel,
          afterLabel: c.afterLabel,
          items: SC.day4.buildBeforeAfter(state)
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
          onOpen: function () { ctx.track('day5_teaser_opened', { day: 5 }); }
        }),

        SC.ui.ctaArea([
          SC.ui.primaryCta({
            label: c.nextDayCta,
            /* DAY5実装済み（§29-C）。Screen AAへ進む */
            onClick: function () { ctx.go('day5_intro'); }
          }),
          SC.ui.secondaryCta({ label: c.backToChange, onClick: function () { ctx.go('day4_entry'); } })
        ])
      ]);
    }
  };
})(window);
