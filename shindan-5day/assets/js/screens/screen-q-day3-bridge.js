/* screen-q-day3-bridge.js : Screen Q｜価値の橋を整える（§23-D／§23-E）
 * ・初めて開いたときに自動生成文を bridgeDraft へ入れる
 * ・本人が編集したら bridgeEdited: true
 * ・L〜Pへ戻って元回答を変えていたら作り直し、bridgeEdited を false へ戻して知らせる
 * ・本人が手を入れた文章、古い保存文は黙って作り直さず、選んでもらう（2026-09-12）
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

      /* 本人が作り直した／戻した直後だけ、一度きり知らせる */
      var done = SC.day3.takeBridgeNotice();
      /* 選んでもらう必要があるとき。どちらの言い回しで聞くかを決める
         needs-choice       ：本人が手を入れた文章がある
         needs-choice-stale ：2026-09-12より前の保存で、今の回答と合うか確かめられない */
      var ask = result === 'needs-choice' ? c.changed
              : result === 'needs-choice-stale' ? c.stale
              : null;
      /* 選び終えたあと、まだ回答とずれているときに出す注記 */
      var behind = ask ? null : SC.day3.bridgeBehindKind(state);

      ctx.trackView('day3_bridge_view');

      return h('div', { class: 'screen screen--day3-bridge' }, [
        SC.ui.appHeader({ dayLabel: c.dayLabel, title: c.title, onBack: ctx.back }),

        ctx.restoreNotice ? SC.ui.saveStatus({ text: ctx.restoreNotice, tone: 'info' }) : null,

        /* 元回答を変えて戻ってきたときだけ、作り直したことを知らせる（§23-E） */
        result === 'regenerated'
          ? SC.ui.saveStatus({ text: c.updatedNotice, tone: 'info' })
          : null,
        /* 本人が押した結果の知らせ。再表示のたびには出さない */
        done === 'rebuilt' ? SC.ui.saveStatus({ text: c.changed.rebuiltNotice, tone: 'info' }) : null,
        done === 'restored' ? SC.ui.saveStatus({ text: c.changed.restoredNotice, tone: 'info' }) : null,

        /* 黙って作り直さず、どちらにするか選んでもらう（§21-C 2026-09-12） */
        ask
          ? SC.ui.card(null, [
              h('p', { class: 'card__body', text: ask.question }),
              SC.ui.ctaArea([
                SC.ui.secondaryCta({
                  label: ask.keepCta,
                  onClick: function () { SC.day3.keepEditedBridge(); ctx.rerender(); }
                }),
                SC.ui.secondaryCta({
                  label: ask.rebuildCta,
                  onClick: function () { SC.day3.regenerateBridge(); ctx.rerender(); }
                })
              ])
            ])
          : null,

        /* 残したままにした人へ。回答とずれていることを隠さない */
        behind === 'edited' ? SC.ui.saveStatus({ text: c.changed.keptNote, tone: 'info' }) : null,
        behind === 'stale' ? SC.ui.saveStatus({ text: c.stale.keptNote, tone: 'info' }) : null,

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
          /* 作り直したあとでも、前の文章へ戻せるようにしておく */
          state.day3.bridgePrevDraft
            ? SC.ui.secondaryCta({
                label: c.changed.restoreCta,
                onClick: function () { SC.day3.restorePrevBridge(); ctx.rerender(); }
              })
            : null,
          SC.ui.secondaryCta({
            label: c.secondaryCta,
            onClick: function () { ctx.go('day3_current'); }
          })
        ])
      ]);
    }
  };
})(window);
