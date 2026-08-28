/* screen-b-day1-intro.js : DAY1導入（§41-C）
 * 参加表明の完了直後、改善軸を選ぶ Screen C の前に置く。
 * 他のDAYと同じリズム（導入 → 動画 → ワーク）にするための軽量な画面。
 * 動画素材が未登録のあいだは、動画の枠自体が出ない。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;

  SC.screens = SC.screens || {};
  SC.screens.day1_intro = {
    id: 'day1_intro',
    render: function (ctx) {
      var c = SC.copy.day1Intro;

      ctx.trackView('day1_intro_view');

      return h('div', { class: 'screen screen--day1-intro' }, [
        SC.ui.appHeader({ dayLabel: c.dayLabel, title: c.title, onBack: ctx.back }),

        ctx.restoreNotice ? SC.ui.saveStatus({ text: ctx.restoreNotice, tone: 'info' }) : null,

        SC.ui.card(null, SC.ui.prose(c.lead), 'card--lead card--reading'),

        /* 共通動画。素材が無いあいだは null（空枠を出さない） */
        SC.ui.videoBlock({ day: 1, screen: 'day1_intro', track: ctx.track }),

        SC.ui.ctaArea([
          SC.ui.primaryCta({ label: c.primaryCta, onClick: function () { ctx.go('day1_focus'); } })
        ])
      ]);
    }
  };
})(window);
