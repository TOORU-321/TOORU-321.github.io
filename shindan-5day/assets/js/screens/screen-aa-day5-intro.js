/* screen-aa-day5-intro.js : Screen AA｜DAY5導入（§29-D）
 * DAY3の価値の橋とDAY4の顧客導線図を並べてから、30日実験へ入る。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;

  SC.screens = SC.screens || {};
  SC.screens.day5_intro = {
    id: 'day5_intro',
    render: function (ctx) {
      var c = SC.copy.day5Intro;
      var state = ctx.state;

      ctx.trackView('day5_intro_view');

      return h('div', { class: 'screen screen--day5-intro' }, [
        SC.ui.appHeader({ dayLabel: c.dayLabel, title: c.title, onBack: ctx.back }),

        ctx.restoreNotice ? SC.ui.saveStatus({ text: ctx.restoreNotice, tone: 'info' }) : null,

        /* 前回まで：DAY3の橋 → DAY4の導線図 */
        SC.ui.card(c.recapHeading, [
          SC.ui.recapList({ items: [
            { label: c.recapBridgeLabel, value: SC.day3.bridgeText(state) }
          ] }),
          h('p', { class: 'card__note card__note--after', text: c.recapJourneyLabel }),
          h('div', { class: 'jmap-wrap' }, SC.ui.journeyMap({ state: state, withEmotion: false }))
        ]),

        SC.ui.card(null, SC.ui.prose(c.lead), 'card--lead card--reading'),

        SC.ui.card(c.lessonHeading, [
          SC.ui.prose(c.lessonBody)
        ]),

        /* 共通動画（§41-C）。回答を始める前に置く。素材が無いあいだは出ない */
        SC.ui.videoBlock({ day: 5, screen: 'day5_intro', track: ctx.track }),

        SC.ui.ctaArea([
          SC.ui.primaryCta({
            label: c.primaryCta,
            onClick: function () { ctx.go('day5_hypothesis'); }
          })
        ])
      ]);
    }
  };
})(window);
