/* screen-d-day1-pause.js : Screen D｜DAY1後半・今はやらないことを決める（画面4） */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;

  SC.screens = SC.screens || {};
  SC.screens.day1_pause = {
    id: 'day1_pause',
    render: function (ctx) {
      var c = SC.copy.day1Pause;
      var state = ctx.state;
      var focusLabel = SC.axisLabel(state.selectedFocusAxis);

      ctx.trackView('day1_pause_view');

      return h('div', { class: 'screen screen--day1-pause' }, [
        SC.ui.appHeader({ dayLabel: c.dayLabel, title: c.title, onBack: ctx.back }),

        ctx.restoreNotice ? SC.ui.saveStatus({ text: ctx.restoreNotice, tone: 'info' }) : null,

        SC.ui.card(null, h('p', { class: 'recap' }, [
          h('span', { class: 'recap__label', text: '今整える軸' }),
          h('span', { class: 'recap__value', text: focusLabel })
        ]), 'card--recap'),

        SC.ui.card(c.lessonHeading, h('p', { class: 'card__body', text: c.lessonBody })),

        SC.ui.card(c.question, [
          SC.ui.choiceList({
            name: 'paused-action',
            legend: c.question,
            options: SC.config.pausedActions,
            value: state.pausedAction,
            selectedBadge: '選択中',
            onSelect: function (value) {
              /* 選択内容を即時保存 */
              ctx.save({ pausedAction: value, pausedActionChosenByUser: true });
              ctx.track('day1_pause_selected');
              ctx.setFlash(SC.copy.common.saved);
              ctx.rerender('paused-action-' + value);
            }
          }),
          h('p', { class: 'card__note', text: c.note }),
          ctx.flash ? SC.ui.saveStatus({ text: ctx.flash.text, tone: ctx.flash.tone }) : null
        ]),

        SC.ui.ctaArea([
          SC.ui.primaryCta({
            label: c.primaryCta,
            onClick: function () {
              SC.day1.complete(ctx);
              ctx.go('day1_done');
            }
          })
        ])
      ]);
    }
  };
})(window);
