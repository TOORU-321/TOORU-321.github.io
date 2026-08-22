/* screen-q-day3-bridge.js : Screen Q｜価値の橋を整える（§23-D／§23-E）
 * ・初めて開いたときに自動生成文を bridgeDraft へ入れる
 * ・本人が編集したら bridgeEdited: true
 * ・L〜Pへ戻って元回答を変えていたら作り直し、bridgeEdited を false へ戻して知らせる
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;

  SC.screens = SC.screens || {};
  SC.screens.day3_bridge = {
    id: 'day3_bridge',
    render: function (ctx) {
      var c = SC.copy.day3Bridge;

      /* 開いた時点で橋を用意する。元回答が変わっていれば作り直す */
      var result = SC.day3.ensureBridge();
      var state = SC.store.getState();
      var noticeSlot = h('div', { class: 'notice-slot' });

      ctx.trackView('day3_bridge_view');

      return h('div', { class: 'screen screen--day3-bridge' }, [
        SC.ui.appHeader({ dayLabel: c.dayLabel, title: c.title, onBack: ctx.back }),

        ctx.restoreNotice ? SC.ui.saveStatus({ text: ctx.restoreNotice, tone: 'info' }) : null,

        /* 元回答を変えて戻ってきたときだけ、作り直したことを知らせる（§23-E） */
        result === 'regenerated'
          ? SC.ui.saveStatus({ text: c.updatedNotice, tone: 'info' })
          : null,

        SC.ui.card(null, [
          h('p', { class: 'card__note', text: c.note }),
          SC.ui.textInput({
            id: 'day3-bridge-text',
            label: c.inputLabel,
            maxLength: SC.config.bridgeMaxLength,
            rows: '6',
            value: state.day3.bridgeDraft || '',
            onInput: function (text) {
              var edited = text.trim() !== SC.day3.buildBridge(SC.store.getState()).trim();
              var wasEdited = SC.store.getState().day3.bridgeEdited;
              ctx.saveDay('day3', { bridgeDraft: text, bridgeEdited: edited });
              /* 本人が手を入れた瞬間だけ1回記録する（本文は送らない） */
              if (edited && !wasEdited) ctx.track('day3_bridge_edited', { day: 3 });
            }
          })
        ]),

        noticeSlot,

        SC.ui.ctaArea([
          SC.ui.primaryCta({
            label: c.primaryCta,
            onClick: function () {
              SC.dom.clear(noticeSlot);
              if (SC.day3.bridgeText(SC.store.getState()) === '') {
                noticeSlot.appendChild(SC.ui.notice(c.requireText));
                var field = global.document.getElementById('day3-bridge-text');
                if (field) field.focus();
                return;
              }
              SC.day3.complete(ctx);
              ctx.go('day3_done');
            }
          }),
          SC.ui.secondaryCta({
            label: c.secondaryCta,
            onClick: function () { ctx.go('day3_current'); }
          })
        ])
      ]);
    }
  };
})(window);
