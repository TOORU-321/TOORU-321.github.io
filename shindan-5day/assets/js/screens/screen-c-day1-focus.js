/* screen-c-day1-focus.js : Screen C｜DAY1前半・改善軸を決める（画面3） */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;

  SC.screens = SC.screens || {};
  SC.screens.day1_focus = {
    id: 'day1_focus',
    render: function (ctx) {
      var c = SC.copy.day1Focus;
      var d = ctx.diagnosis;
      var state = ctx.state;

      ctx.trackView('day1_focus_view');

      return h('div', { class: 'screen screen--day1-focus' }, [
        SC.ui.appHeader({ dayLabel: c.dayLabel, title: c.title, onBack: ctx.back }),

        ctx.restoreNotice ? SC.ui.saveStatus({ text: ctx.restoreNotice, tone: 'info' }) : null,

        SC.ui.card(c.lessonHeading, h('p', { class: 'card__body', text: c.lessonBody })),

        /* 5軸レーダーを再表示する（5DAY設計書 v0.2 §4-2 ワーク1） */
        SC.ui.card(c.radarHeading, SC.ui.radarChart({
          scores: d.axisScores,
          max: SC.config.axisMax,
          lowestAxis: d.lowestAxis,
          animate: SC.motion.once('day1-focus-intro')
        })),

        SC.ui.card(c.question, [
          SC.ui.axisList({
            mode: 'select',
            name: 'focus-axis',
            legend: c.question,
            scores: d.axisScores,
            selected: state.selectedFocusAxis,
            /* 最低軸はおすすめとして出すが、本人は別軸を選べる（絶対条件3） */
            recommended: d.lowestAxis,
            recommendBadge: c.recommendBadge,
            /* 初期値のままか、本人が選び直したかを区別して表示する */
            selectedBadge: state.focusAxisChosenByUser ? c.selectedBadge : c.selectedBadgeDefault,
            onSelect: function (axisKey) {
              /* 選択内容を即時保存 */
              ctx.save({
                selectedFocusAxis: axisKey,
                focusAxisChosenByUser: true
              });
              ctx.track('day1_focus_selected');
              ctx.setFlash(SC.copy.common.saved);
              ctx.rerender('focus-axis-' + axisKey);
            }
          }),
          h('p', { class: 'card__note', text: c.note }),
          ctx.flash ? SC.ui.saveStatus({ text: ctx.flash.text, tone: ctx.flash.tone }) : null
        ]),

        SC.ui.ctaArea([
          SC.ui.primaryCta({ label: c.primaryCta, onClick: function () { ctx.go('day1_pause'); } })
        ])
      ]);
    }
  };
})(window);
