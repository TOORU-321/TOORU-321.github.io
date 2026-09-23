/* screen-ai-day5-done.js : Screen AI｜DAY5・5日間完了（§29-D／§36-3〜5）
 *
 * 表示順（§36-3）
 *   1. 5日間完了      2. 設計図5／5        3. 30日実験の確認
 *   4. 30日後の再診断  5. 希望者向けサポート  6. 次のCTA
 *
 * ・現在地スコア47は変えない。設計図だけ5／5（絶対条件1・2）
 * ・主導線は商品案内ではなく「30日実験に進む」
 * ・サポートは本人が選んだ進み方に対応するものを一つだけ。使わなくても先へ進める
 * ・接続先URLが未確定のあいだはボタンを出さない（壊れたCTAを見せない）
 * ・Phase1ではPDF保存・LINE復元・30日後の自動通知・GAS連携を実装しない
 */
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
  SC.screens.day5_done = {
    id: 'day5_done',
    render: function (ctx) {
      var c = SC.copy.day5Done;
      var d = ctx.diagnosis;

      /* 戻って回答を変えた場合も、ここで最新の値から作り直す（§29-E） */
      SC.day5.syncBlueprint();
      var state = SC.store.getState();

      var celebrate = SC.day5.shouldCelebrate();
      if (celebrate) SC.day5.markCelebrated();

      /* --- 2. 完成した一本線シート：各DAYの最新の要約を、欠けずに並べる ---- */
      var sheetCard = SC.ui.card(c.sheetHeading,
        h('ol', { class: 'final-sheet' }, SC.config.blueprintSections.map(function (section) {
          var saved = (state.blueprintSections || {})[section.key] || {};
          return h('li', { class: 'final-sheet__item' }, [
            h('span', { class: 'final-sheet__day', text: 'DAY' + section.day }),
            h('span', { class: 'final-sheet__label', text: section.label }),
            h('span', { class: 'final-sheet__value', text: saved.summary || '' })
          ]);
        })), 'card--project');
      sheetCard.setAttribute('id', 'final-sheet');
      sheetCard.setAttribute('tabindex', '-1');

      /* --- 3. 30日実験カード：Screen AHで確定した文 ------------------------ */
      var experimentCard = SC.ui.card(c.experimentHeading, [
        SC.ui.recapList({ items: SC.day5.cardItems(state) }),
        h('blockquote', { class: 'persona-card journey-card' }, [
          h('p', { class: 'persona-card__line', text: SC.day5.experimentText(state) })
        ])
      ]);
      experimentCard.setAttribute('id', 'experiment-card');
      experimentCard.setAttribute('data-section', 'experiment');
      experimentCard.setAttribute('tabindex', '-1');

      /* --- 4. 30日後の再診断（§36-5）-------------------------------------- */
      var r = SC.copy.reassessment;
      var due = SC.day5.reassessmentDue(state);
      var reassessCard = SC.ui.card(r.heading, [
        SC.ui.prose(r.body),
        due
          ? h('p', { class: 'reassess__due' }, [
              h('span', { class: 'reassess__due-label', text: r.dueLabel }),
              h('span', { class: 'reassess__due-date', text: fill(r.dueTemplate, due) })
            ])
          : null,
        h('p', { class: 'card__note card__note--after', text: r.pending })
      ], 'card--reading');

      return h('div', { class: 'screen screen--day5-done' + (celebrate ? ' is-celebrating' : '') }, [
        SC.ui.appHeader({ dayLabel: c.dayLabel, title: c.title, onBack: ctx.back }),

        ctx.restoreNotice ? SC.ui.saveStatus({ text: ctx.restoreNotice, tone: 'info' }) : null,

        /* 1. 5日間完了 */
        SC.ui.card(null, SC.ui.prose(c.lead), 'card--lead card--reading'),

        /* 2. 設計図5／5 */
        sheetCard,
        SC.ui.card(SC.offerViewCopy.entryTitle, [
          h('p', { class: 'card__note', text: SC.offerViewCopy.entryBody }),
          h('a', { class: 'btn btn--primary', href: 'next-step.html', text: SC.offerViewCopy.entryCta })
        ], 'next-step-entry'),
        SC.ui.blueprintProgress({
          state: state,
          heading: c.progressHeading
        }),

        /* 3. 30日実験の確認 */
        experimentCard,

        SC.ui.beforeAfter({
          heading: c.beforeAfterHeading,
          beforeLabel: c.beforeLabel,
          afterLabel: c.afterLabel,
          items: SC.day5.buildBeforeAfter(state)
        }),

        /* 現在地スコアと設計図進捗を混ぜない（絶対条件1・2） */
        SC.ui.card(null, [
          h('p', { class: 'score-keep' }, [
            h('span', { class: 'score-keep__label', text: c.scoreHeading }),
            h('span', { class: 'score-keep__value', text: d.totalScore + ' / ' + SC.config.totalMax }),
            h('span', { class: 'score-keep__band', text: d.scoreBand.label })
          ]),
          SC.ui.prose(c.scoreNote, 'card__note prose__line')
        ], 'card--score-keep'),

        /* 4. 30日後の再診断 */
        reassessCard,

        /* 5. 希望者向けサポート */


        /* モニターへの感想のお願い。招待コードを持っている人にだけ出す */
        state.voiceMonitorId ? (function () {
          var v = SC.copy.voiceInvite;
          return SC.ui.card(v.heading, [
            SC.ui.prose(v.body),
            SC.ui.ctaArea([
              SC.ui.secondaryCta({
                label: v.cta,
                onClick: function () {
                  ctx.track('voice_invite_clicked', { day: 5 });
                  global.location.href = 'voice.html?m=' +
                    encodeURIComponent(state.voiceMonitorId);
                }
              })
            ]),
            h('p', { class: 'card__note card__note--after', text: v.note })
          ], 'card--reading');
        })() : null,

        SC.ui.card(null, SC.ui.prose(c.completeText), 'card--complete card--reading'),

        /* 6. 次のCTA。主導線は一本線シートを見返すこと */
        SC.ui.ctaArea([
          SC.ui.primaryCta({
            label: c.primaryCta,
            onClick: function () {
              ctx.track('final_sheet_opened', { day: 5 });
              var target = global.document.getElementById('final-sheet');
              if (!target) return;
              target.scrollIntoView({ block: 'start' });
              target.focus({ preventScroll: true });
            }
          }),
          SC.ui.secondaryCta({
            label: c.secondaryCta,
            onClick: function () { ctx.go('result'); }
          })
        ])
      ]);
    }
  };
})(window);
