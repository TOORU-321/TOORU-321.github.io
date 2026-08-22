/* screen-f-day2-intro.js : Screen F｜DAY2導入（§21-B） */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;

  SC.screens = SC.screens || {};
  SC.screens.day2_intro = {
    id: 'day2_intro',
    render: function (ctx) {
      var c = SC.copy.day2Intro;
      var state = ctx.state;

      ctx.trackView('day2_intro_view');

      return h('div', { class: 'screen screen--day2-intro' }, [
        SC.ui.appHeader({ dayLabel: c.dayLabel, title: c.title, onBack: ctx.back }),

        ctx.restoreNotice ? SC.ui.saveStatus({ text: ctx.restoreNotice, tone: 'info' }) : null,

        /* 前回まで：DAY1の決定を小さく再掲する（§21-D） */
        SC.ui.recapList({
          heading: c.recapHeading,
          items: [
            { label: c.recapFocusLabel, value: SC.axisLabel(state.selectedFocusAxis) },
            { label: c.recapPausedLabel, value: SC.pausedActionLabel(state.pausedAction) }
          ]
        }),

        SC.ui.card(null, SC.ui.prose(c.lead), 'card--lead card--reading'),

        SC.ui.card(c.lessonHeading, SC.ui.prose(c.lessonBody)),

        SC.ui.card(null, h('p', { class: 'card__body', text: c.note })),

        SC.ui.ctaArea([
          SC.ui.primaryCta({ label: c.primaryCta, onClick: function () { ctx.go('day2_scene'); } })
        ])
      ]);
    }
  };
})(window);
