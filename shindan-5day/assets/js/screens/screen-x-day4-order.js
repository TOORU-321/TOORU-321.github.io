/* screen-x-day4-order.js : Screen X｜真ん中の順番を決める（§26-B）
 * ドラッグ操作は必須にしない。2択のラジオなので、タップ・キーボード・読み上げで選べる。
 * 選んだあとは、4地点をその順番に並べて表示する。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;

  SC.screens = SC.screens || {};
  SC.screens.day4_order = {
    id: 'day4_order',
    render: function (ctx) {
      var c = SC.copy.day4Order;
      var state = ctx.state;
      var selected = SC.day4.order(state);

      ctx.trackView('day4_order_view');

      /* 2択の中身を、その順番の並びで説明する */
      var options = SC.config.day4Orders.map(function (o) {
        var labels = SC.copy.day4Done.pointLabels;
        var middles = o.value === 'action_first'
          ? [labels.action, labels.relevance]
          : [labels.relevance, labels.action];
        return {
          value: o.value,
          label: o.label,
          time: [labels.entry].concat(middles, [labels.support]).join(' → ')
        };
      });

      return h('div', { class: 'screen screen--day4-order' }, [
        SC.ui.appHeader({ dayLabel: c.dayLabel, title: c.title, onBack: ctx.back }),

        ctx.restoreNotice ? SC.ui.saveStatus({ text: ctx.restoreNotice, tone: 'info' }) : null,

        SC.ui.card(null, [
          h('p', { class: 'card__note', text: c.note }),
          SC.ui.choiceList({
            name: 'day4_order',
            legend: c.title,
            options: options,
            value: selected,
            selectedBadge: '選択中',
            onSelect: function (value) {
              ctx.saveDay('day4', { middleOrder: value });
              /* 内部値だけを計測へ送る（§26-D） */
              ctx.track('day4_order_selected', { choice: value });
              ctx.setFlash(SC.copy.common.saved);
              ctx.rerender('day4_order-' + value);
            }
          }),
          h('p', { class: 'card__note', text: c.accessNote }),
          ctx.flash ? SC.ui.saveStatus({ text: ctx.flash.text, tone: ctx.flash.tone }) : null
        ]),

        /* 選んだ順番で4地点を並べて見せる */
        SC.ui.card(c.orderPreviewHeading, SC.ui.journeyMap({ state: state })),

        SC.ui.ctaArea([
          SC.ui.primaryCta({
            label: c.primaryCta,
            onClick: function () { ctx.go('day4_journey'); }
          })
        ])
      ]);
    }
  };
})(window);
