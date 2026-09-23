/* 詳細結果：個別の結論 → バランス → 任意の詳説 → 次の一歩。
 * 表示のみ改訂。採点・保存・参加確定・引き継ぎは変えない。 */
(function (global) {
  'use strict';
  var SC = global.SC, h = SC.dom.h;
  function fill(text, values) {
    return String(text).replace(/\{(\w+)\}/g, function (m, k) { return values[k] !== undefined ? values[k] : m; });
  }
  function details(title, children) {
    return h('details', { class: 'scan-details' }, [h('summary', { text: title }), h('div', { class: 'scan-details__body' }, children)]);
  }
  SC.screens = SC.screens || {};
  SC.screens.result = {
    id: 'result',
    render: function (ctx) {
      var c = SC.copy.result, s = SC.scanCopy.result, d = ctx.diagnosis;
      var step = SC.config.improvementStep, label = SC.axisLabel(d.lowestAxis);
      var improved = SC.ui.improvedScores(d.axisScores, d.lowestAxis, step, SC.config.axisMax);
      var total = SC.ui.totalOf(improved);
      var animate = SC.motion.once('result-intro');
      ctx.trackView('result_view');
      function goToLp(via, hash) {
        ctx.track('challenge_cta_click', { cta: via });
        SC.store.unlockLp();
        global.location.href = 'lp.html' + (hash || '');
      }
      function goNext() {
        if (ctx.state.participation === 'undecided') {
          ctx.track('challenge_cta_click', { cta: 'primary' });
          ctx.go('handover');
        } else goToLp('primary');
      }
      var screenEl = h('div', { class: 'screen screen--result scan-result' + (animate ? ' scan-result--intro' : '') }, [
        SC.ui.appHeader({ dayLabel: c.dayLabel, title: c.title, subtitle: null }),
        ctx.restoreNotice ? SC.ui.saveStatus({ text: ctx.restoreNotice, tone: 'info' }) : null,
        h('section', { class: 'scan-focus' }, [
          h('p', { class: 'scan-eyebrow', text: s.eyebrow }),
          h('h2', { class: 'scan-focus__title' }, [s.title, h('strong', { text: label })]),
          SC.ui.resultTypeImage(d.lowestAxis, { variant: 'compact', caption: false, note: false }),
          h('h3', { class: 'scan-subhead', text: s.why }),
          h('p', { class: 'scan-reason', text: SC.copy.axisReason[d.lowestAxis] }),
          h('p', { class: 'scan-note', text: '結果は見直す場所の目安です。性格や才能を決めるものではありません。' })
        ]),
        SC.ui.scoreSummary({
          caption: c.scoreCaption, totalScore: d.totalScore, max: SC.config.totalMax, band: d.scoreBand, animate: animate,
          children: [
            h('h2', { class: 'card__subtitle', text: c.radarHeading }),
            SC.ui.radarChart({ scores: d.axisScores, max: SC.config.axisMax, lowestAxis: d.lowestAxis, animate: false })
          ]
        }),
        details(s.axes, [
          h('p', { class: 'scan-note', text: c.axisNote }),
          SC.ui.axisList({ mode: 'view', scores: d.axisScores, lowestAxis: d.lowestAxis,
            lowestBadge: c.lowestBadge, lowestReason: SC.copy.axisReason[d.lowestAxis], animate: false })
        ]),
        details(s.strength, [
          h('div', { class: 'strength' }, [
            c.strength.examples.map(function (ex) {
              return h('p', { class: 'strength__example' }, [ex.lead, h('strong', { class: 'strength__em', text: ex.strong }), ex.tail]);
            }),
            h('p', { text: c.strength.turn }),
            c.strength.body.map(function (line) { return h('p', { text: line }); }),
            h('p', { class: 'strength__close', text: c.strength.close })
          ])
        ]),
        details(s.target, [
          SC.ui.prose(c.supportBody),
          h('p', { class: 'target-line', text: fill(c.improvementTarget, {
            axis: label, step: step, goal: improved[d.lowestAxis], from: d.totalScore, to: total
          }) }),
          h('p', { class: 'scan-note', text: c.improvementNote })
        ]),
        h('section', { class: 'scan-next' }, [
          h('h2', { class: 'scan-title', text: s.next }),
          h('p', { text: s.nextBody }),
          SC.ui.ctaArea([
            SC.ui.primaryCta({ label: ctx.state.participation === 'later' ? c.primaryCtaAgain : s.cta, onClick: goNext }),
            SC.ui.secondaryCta({ label: c.secondaryCta, onClick: function () { goToLp('secondary', '#blueprint'); } })
          ]),
          h('p', { class: 'scan-note', text: s.note })
        ])
      ]);
      /* 結論はすぐ読めるまま。数値とチャートは画面内に来たとき一度だけ動かす。
       * 閉じた詳説やCTAは隠さず、演出終了を操作条件にしない。 */
      if (animate) {
        var score = screenEl.querySelector('.score-summary');
        function playScore() {
          if (!SC.motion.allowed()) return;
          score.querySelector('.radar').classList.add('is-intro');
          SC.motion.countUp(score, { duration: 900, delay: 100 });
        }
        if (global.IntersectionObserver) {
          var observer = new global.IntersectionObserver(function (entries) {
            if (!entries.some(function (entry) { return entry.isIntersecting; })) return;
            observer.disconnect();
            playScore();
          }, { threshold: 0.15 });
          observer.observe(score);
        } else {
          global.requestAnimationFrame(playScore);
        }
      }
      return screenEl;
    }
  };
})(window);
