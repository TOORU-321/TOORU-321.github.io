/* screen-ah-day5-experiment.js : Screen AH｜30日実験カードを整える（§29-D／§29-E）
 * ・初回表示で自動生成文を experimentDraft へ入れる
 * ・本人が編集したら experimentEdited: true
 * ・AB〜AGへ戻って回答・曜日・時間帯を変えていたら作り直し、フラグを false へ戻して知らせる
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;

  SC.screens = SC.screens || {};
  SC.screens.day5_experiment = {
    id: 'day5_experiment',
    render: function (ctx) {
      var c = SC.copy.day5Experiment;

      var result = SC.day5.ensureExperiment();
      var state = SC.store.getState();
      var noticeSlot = h('div', { class: 'notice-slot' });

      ctx.trackView('day5_experiment_view');

      return h('div', { class: 'screen screen--day5-experiment' }, [
        SC.ui.appHeader({ dayLabel: c.dayLabel, title: c.title, onBack: ctx.back }),

        ctx.restoreNotice ? SC.ui.saveStatus({ text: ctx.restoreNotice, tone: 'info' }) : null,

        /* 回答を変えて戻ってきたときだけ、作り直したことを知らせる（§29-E） */
        result === 'regenerated'
          ? SC.ui.saveStatus({ text: c.updatedNotice, tone: 'info' })
          : null,

        SC.ui.card(c.cardHeading, [
          SC.ui.recapList({ items: SC.day5.cardItems(state) })
        ]),

        SC.ui.card(null, [
          h('p', { class: 'card__note', text: c.note }),
          SC.ui.textInput({
            id: 'day5-experiment-text',
            label: c.inputLabel,
            maxLength: SC.config.experimentMaxLength,
            rows: '8',
            value: state.day5.experimentDraft || '',
            onInput: function (text) {
              var edited = text.trim() !== SC.day5.buildExperiment(SC.store.getState()).trim();
              var wasEdited = SC.store.getState().day5.experimentEdited;
              ctx.saveDay('day5', { experimentDraft: text, experimentEdited: edited });
              /* 本人が手を入れた瞬間だけ1回記録する（本文は送らない） */
              if (edited && !wasEdited) ctx.track('day5_experiment_edited', { day: 5 });
            }
          })
        ]),

        noticeSlot,

        SC.ui.ctaArea([
          SC.ui.primaryCta({
            label: c.primaryCta,
            onClick: function () {
              SC.dom.clear(noticeSlot);
              if (SC.day5.experimentText(SC.store.getState()) === '') {
                noticeSlot.appendChild(SC.ui.notice(c.requireText));
                var field = global.document.getElementById('day5-experiment-text');
                if (field) field.focus();
                return;
              }
              SC.day5.complete(ctx);
              ctx.go('day5_done');
            }
          }),
          SC.ui.secondaryCta({
            label: c.secondaryCta,
            onClick: function () { ctx.go('day5_hypothesis'); }
          })
        ])
      ]);
    }
  };
})(window);
