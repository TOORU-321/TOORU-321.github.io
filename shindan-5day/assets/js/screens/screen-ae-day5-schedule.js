/* screen-ae-day5-schedule.js : Screen AE｜振り返る日時（§29-D）
 * ・曜日7択＋時間帯3択。どちらもラジオなのでタップ・キーボード・読み上げで操作できる
 * ・時間帯の初期値は、LPで選んだ通知時間。本人がここで変更できる（§29-E）
 * ・計測へは固定の内部値だけを送る。曜日名・時刻の表示文は送らない（§29-F）
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;

  SC.screens = SC.screens || {};
  SC.screens.day5_schedule = {
    id: 'day5_schedule',
    render: function (ctx) {
      var c = SC.copy.day5Schedule;
      var state = ctx.state;

      ctx.trackView('day5_schedule_view');

      function summaryText() {
        return SC.day5.scheduleText(SC.store.getState());
      }

      var summary = h('p', { class: 'schedule__summary', role: 'status', 'aria-live': 'polite', text: summaryText() });

      function select(patch, focusId) {
        ctx.saveDay('day5', patch);
        /* 内部値だけを送る（曜日・時刻の表示文は送らない） */
        ctx.track('day5_schedule_selected', { screen: 'day5_schedule' });
        ctx.setFlash(SC.copy.common.saved);
        ctx.rerender(focusId);
      }

      return h('div', { class: 'screen screen--day5-schedule' }, [
        SC.ui.appHeader({ dayLabel: c.dayLabel, title: c.title, onBack: ctx.back }),

        ctx.restoreNotice ? SC.ui.saveStatus({ text: ctx.restoreNotice, tone: 'info' }) : null,

        SC.ui.card(null, [
          h('p', { class: 'card__note', text: c.note }),

          h('p', { class: 'schedule__label', text: c.dayHeading }),
          SC.ui.choiceList({
            name: 'day5-review-day',
            legend: c.dayHeading,
            variant: 'inline',
            options: SC.config.day5ReviewDays,
            value: SC.day5.reviewDay(state),
            selectedBadge: '選択中',
            onSelect: function (value) { select({ reviewDay: value }, 'day5-review-day-' + value); }
          }),

          h('p', { class: 'schedule__label', text: c.windowHeading }),
          SC.ui.choiceList({
            name: 'day5-review-window',
            legend: c.windowHeading,
            variant: 'inline',
            options: SC.config.reminderWindows,
            value: SC.day5.reviewWindow(state),
            selectedBadge: '選択中',
            onSelect: function (value) { select({ reviewWindow: value }, 'day5-review-window-' + value); }
          }),
          h('p', { class: 'card__note card__note--after', text: c.windowNote }),

          summary,

          ctx.flash ? SC.ui.saveStatus({ text: ctx.flash.text, tone: ctx.flash.tone }) : null
        ]),

        SC.ui.ctaArea([
          SC.ui.primaryCta({
            label: c.primaryCta,
            onClick: function () { ctx.go('day5_adjustment'); }
          })
        ])
      ]);
    }
  };
})(window);
