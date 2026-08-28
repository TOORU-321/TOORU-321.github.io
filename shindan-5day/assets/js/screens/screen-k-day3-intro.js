/* screen-k-day3-intro.js : Screen K｜DAY3導入（§23-D） */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;

  SC.screens = SC.screens || {};
  SC.screens.day3_intro = {
    id: 'day3_intro',
    render: function (ctx) {
      var c = SC.copy.day3Intro;
      var state = ctx.state;

      ctx.trackView('day3_intro_view');

      return h('div', { class: 'screen screen--day3-intro' }, [
        SC.ui.appHeader({ dayLabel: c.dayLabel, title: c.title, onBack: ctx.back }),

        ctx.restoreNotice ? SC.ui.saveStatus({ text: ctx.restoreNotice, tone: 'info' }) : null,

        /* 前回まで：DAY1の改善軸と、DAY2のお客様カードを再掲する（§23-D） */
        SC.ui.card(c.recapHeading, [
          h('dl', { class: 'recap-list' }, [
            h('div', { class: 'recap' }, [
              h('dt', { class: 'recap__label', text: c.recapFocusLabel }),
              h('dd', { class: 'recap__value', text: SC.axisLabel(state.selectedFocusAxis) })
            ])
          ]),
          h('p', { class: 'card__note recap__caption', text: c.recapCustomerLabel }),
          h('blockquote', { class: 'persona-card persona-card--recap' },
            SC.day2.buildCard(state).map(function (line) {
              return h('p', { class: 'persona-card__line', text: line });
            })
          )
        ], 'card--recap'),

        SC.ui.card(null, SC.ui.prose(c.lead), 'card--lead card--reading'),

        SC.ui.card(c.lessonHeading, SC.ui.prose(c.lessonBody)),

        /* 共通動画（§41-C）。回答を始める前に置く。素材が無いあいだは出ない */
        SC.ui.videoBlock({ day: 3, screen: 'day3_intro', track: ctx.track }),

        SC.ui.ctaArea([
          SC.ui.primaryCta({ label: c.primaryCta, onClick: function () { ctx.go('day3_current'); } })
        ])
      ]);
    }
  };
})(window);
