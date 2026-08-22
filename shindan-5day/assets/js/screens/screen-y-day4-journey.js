/* screen-y-day4-journey.js : Screen Y｜顧客導線図を整える（§26-B／§26-C）
 * ・初回表示で自動生成文を journeyDraft へ入れる
 * ・本人が編集したら journeyEdited: true
 * ・T〜Xへ戻って回答や順番を変えていたら作り直し、journeyEdited を false へ戻して知らせる
 * ・選ばなかった既定候補は「今は使わない候補」として折りたたみで残す（成果物には混ぜない）
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;

  SC.screens = SC.screens || {};
  SC.screens.day4_journey = {
    id: 'day4_journey',
    render: function (ctx) {
      var c = SC.copy.day4Journey;

      var result = SC.day4.ensureJourney();
      var state = SC.store.getState();
      var noticeSlot = h('div', { class: 'notice-slot' });

      ctx.trackView('day4_journey_view');

      return h('div', { class: 'screen screen--day4-journey' }, [
        SC.ui.appHeader({ dayLabel: c.dayLabel, title: c.title, onBack: ctx.back }),

        ctx.restoreNotice ? SC.ui.saveStatus({ text: ctx.restoreNotice, tone: 'info' }) : null,

        /* 回答や順番を変えて戻ってきたときだけ、作り直したことを知らせる（§26-C） */
        result === 'regenerated'
          ? SC.ui.saveStatus({ text: c.updatedNotice, tone: 'info' })
          : null,

        SC.ui.card(c.mapHeading, SC.ui.journeyMap({ state: state, withEmotion: true })),

        SC.ui.card(null, [
          h('p', { class: 'card__note', text: c.note }),
          SC.ui.textInput({
            id: 'day4-journey-text',
            label: c.inputLabel,
            maxLength: SC.config.journeyMaxLength,
            rows: '6',
            value: state.day4.journeyDraft || '',
            onInput: function (text) {
              var edited = text.trim() !== SC.day4.buildJourney(SC.store.getState()).trim();
              var wasEdited = SC.store.getState().day4.journeyEdited;
              ctx.saveDay('day4', { journeyDraft: text, journeyEdited: edited });
              /* 本人が手を入れた瞬間だけ1回記録する（本文は送らない） */
              if (edited && !wasEdited) ctx.track('day4_journey_edited', { day: 4 });
            }
          })
        ]),

        /* 今は使わない候補（消さずに残す） */
        h('details', { class: 'card unused' }, [
          h('summary', { class: 'unused__summary', text: c.unusedHeading }),
          h('p', { class: 'card__note', text: c.unusedNote }),
          h('div', { class: 'unused__groups' }, SC.day4.unusedOptions(state).map(function (group) {
            return h('div', { class: 'unused__group' }, [
              h('p', { class: 'unused__label', text: group.label }),
              h('ul', { class: 'unused__list' }, group.items.map(function (item) {
                return h('li', { class: 'unused__item', text: item });
              }))
            ]);
          }))
        ]),

        noticeSlot,

        SC.ui.ctaArea([
          SC.ui.primaryCta({
            label: c.primaryCta,
            onClick: function () {
              SC.dom.clear(noticeSlot);
              if (SC.day4.journeyText(SC.store.getState()) === '') {
                noticeSlot.appendChild(SC.ui.notice(c.requireText));
                var field = global.document.getElementById('day4-journey-text');
                if (field) field.focus();
                return;
              }
              SC.day4.complete(ctx);
              ctx.go('day4_done');
            }
          }),
          SC.ui.secondaryCta({
            label: c.secondaryCta,
            onClick: function () { ctx.go('day4_entry'); }
          })
        ])
      ]);
    }
  };
})(window);
