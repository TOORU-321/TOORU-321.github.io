/* screen-handover.js : 診断 → 企画 の切り替わりを見せる一枚（2026-09-11 とーる判断C）
 *
 * 【なぜ要るか】
 * 診断結果のボタンを押すと、そのまま参加案内LPへ滑り込んでいた。
 * 画面が切り替わった感じがないので、「診断の続きの解説ページ」に見える。
 * 企画が始まったことが伝わらない。
 *
 * 【この一枚の役目】
 * ・ここまでが「現在地を知る」だったと区切る
 * ・ここからは5日間の企画だと告げる
 * ・進むか、今日は持ち帰るかを選んでもらう
 *
 * ★説明はしない。説明はLPの仕事。ここは区切りだけ。
 * ★1画面で終わる長さにする。スクロールさせない。
 * ★一枚増やすぶん離脱は増える。それを承知のうえでの判断（2026-09-11）。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;

  SC.screens = SC.screens || {};
  SC.screens.handover = {
    id: 'handover',
    render: function (ctx) {
      var c = SC.copy.handover;

      ctx.trackView('handover_view');

      function goToLp(via) {
        ctx.track('challenge_cta_click', { cta: via });
        SC.store.unlockLp();
        global.location.href = 'lp.html';
      }

      return h('div', { class: 'screen screen--handover' }, [
        h('div', { class: 'handover' }, [
          h('p', { class: 'handover__done', text: c.done }),

          /* 区切りの線。飾りなので読み上げには渡さない */
          h('div', { class: 'handover__rule', 'aria-hidden': 'true' }),

          h('h1', { class: 'handover__title' },
            SC.dom.lines(c.title, 'handover__title-line')),

          h('div', { class: 'handover__body prose' },
            SC.dom.lines(c.body, 'prose__line')),

          SC.ui.ctaArea([
            SC.ui.primaryCta({
              label: c.primaryCta,
              onClick: function () { goToLp('handover'); }
            }),
            SC.ui.secondaryCta({
              label: c.secondaryCta,
              onClick: function () {
                ctx.track('challenge_cta_click', { cta: 'handover_later' });
                ctx.go('result');
              }
            })
          ]),

          h('p', { class: 'handover__note', text: c.note })
        ])
      ]);
    }
  };
})(window);
