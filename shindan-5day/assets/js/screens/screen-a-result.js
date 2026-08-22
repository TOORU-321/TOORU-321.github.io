/* screen-a-result.js : Screen A｜診断詳細結果（画面1｜詳細結果からの橋渡し） */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;

  function fill(template, values) {
    return String(template).replace(/\{(\w+)\}/g, function (m, key) {
      return values[key] !== undefined ? values[key] : m;
    });
  }

  SC.screens = SC.screens || {};
  SC.screens.result = {
    id: 'result',
    render: function (ctx) {
      var c = SC.copy.result;
      var d = ctx.diagnosis;
      var step = SC.config.improvementStep;
      var lowestLabel = SC.axisLabel(d.lowestAxis);

      /* 最低軸だけを step 点上げた「改善後」のかたち（診断ファネル §結果画面 7） */
      var improved = SC.ui.improvedScores(d.axisScores, d.lowestAxis, step, SC.config.axisMax);
      var improvedTotal = SC.ui.totalOf(improved);

      /* 導入アニメーションは読み込みごとに1回だけ。動きが苦手な設定では再生しない */
      var animate = SC.motion.once('result-intro');

      ctx.trackView('result_view');

      /* 参加表明は別ページのLP（lp.html）で行う（2026-08-20 とーる判断）。
         ここでは開始時刻を立てず、LPを開ける状態にして渡すだけにする */
      function goToLp(via, hash) {
        ctx.track('challenge_cta_click', { cta: via });
        SC.store.unlockLp();
        global.location.href = 'lp.html' + (hash || '');
      }

      /* 数字が増える動き＋スクロールで現れる動きは、画面が置かれたあとに始める。
       * 1枚目（スコアとレーダー）は隠さない。中でレーダーと水位が動いているので、
       * ここを隠すと動きが見えないまま終わってしまう。 */
      var screenEl = h('div', { class: 'screen screen--result' + (animate ? ' is-intro' : '') }, [
        SC.ui.appHeader({
          dayLabel: c.dayLabel,
          title: c.title,
          subtitle: SC.copy.programTagline
        }),

        ctx.restoreNotice ? SC.ui.saveStatus({ text: ctx.restoreNotice, tone: 'info' }) : null,

        SC.ui.scoreSummary({
          caption: c.scoreCaption,
          totalScore: d.totalScore,
          max: SC.config.totalMax,
          band: d.scoreBand,
          animate: animate,
          children: [
            /* かたちのいびつさを先に見せてから、水位（総合点）を見せる */
            h('h2', { class: 'card__subtitle', text: c.radarHeading }),
            SC.ui.radarChart({
              scores: d.axisScores,
              max: SC.config.axisMax,
              lowestAxis: d.lowestAxis,
              improved: improved,
              animate: animate
            }),
            SC.ui.prose(fill(c.radarNote, { axis: lowestLabel, step: step }), 'card__note card__note--center'),
            SC.ui.scoreMeter({
              value: d.totalScore,
              max: SC.config.totalMax,
              marks: SC.config.scoreMarks,
              target: improvedTotal,
              animate: animate
            })
          ]
        }),

        SC.ui.card(c.axisHeading, [
          h('p', { class: 'card__note', text: c.axisNote }),
          SC.ui.axisList({
            mode: 'view',
            scores: d.axisScores,
            lowestAxis: d.lowestAxis,
            lowestBadge: c.lowestBadge,
            lowestReason: SC.copy.axisReason[d.lowestAxis],
            animate: animate
          })
        ]),

        /* 長い説明は句点ごとに段落へ分け、上下の間隔をあけて読ませる（2026-08-21 とーる指示） */
        SC.ui.card(c.supportHeading, [
          SC.ui.prose(c.supportBody),
          SC.ui.prose(c.synergyBody),
          h('p', { class: 'target-line', text: fill(c.improvementTarget, {
            axis: lowestLabel,
            step: step,
            goal: (d.axisScores[d.lowestAxis] || 0) + step,
            from: d.totalScore,
            to: improvedTotal
          }) }),
          h('div', { class: 'prose prose--note' }, SC.dom.sentences(c.improvementNote, 'prose__line'))
        ], 'card--reading'),

        SC.ui.card(null, SC.dom.lines(c.lead), 'card--lead card--reading'),

        SC.ui.ctaArea([
          SC.ui.primaryCta({
            /* §23-C-5：見送ったあともLPへ戻れる状態を保つ */
            label: ctx.state.participation === 'later' ? c.primaryCtaAgain : c.primaryCta,
            onClick: function () { goToLp('primary'); }
          }),
          /* §17-4：商品・講座へは接続しない。5日後の完成図（LPの一本線シート）へ進む補助導線 */
          SC.ui.secondaryCta({
            label: c.secondaryCta,
            onClick: function () { goToLp('secondary', '#blueprint'); }
          })
        ])
      ]);

      /* 数字が増える動きだけ、次の描画のタイミングで始める */
      if (animate) {
        global.requestAnimationFrame(function () {
          SC.motion.countUp(screenEl, { duration: 900, delay: 200 });
        });
      }

      /* スクロール出現は、組み立てた直後にその場で仕込む。
       * requestAnimationFrame に頼ると、タブが裏にあるあいだ動かず、
       * 本文が隠れたままになりうるため。監視は画面に置かれてから働く。 */
      (function () {
        /* 1枚目（スコア・レーダー・メーター）は隠さない。中で動きがあるため。
         * 2枚目からは、カードごとではなく段落・行ごとに現れるようにする（とーる指示）。 */
        var blocks = [].slice.call(screenEl.children).filter(function (el) {
          return el.classList.contains('card') || el.classList.contains('cta-area');
        }).slice(1);
        var targets = [];
        blocks.forEach(function (block) {
          var inner = block.querySelectorAll(
            '.card__title, .prose__line, .card__body, .card__note, .target-line, .axis, .lead-line'
          );
          if (inner.length) {
            [].slice.call(inner).forEach(function (el) { targets.push(el); });
          } else {
            targets.push(block);
          }
        });
        SC.ui.scrollReveal(targets, { stagger: 120 });
      })();

      return screenEl;
    }
  };
})(window);
