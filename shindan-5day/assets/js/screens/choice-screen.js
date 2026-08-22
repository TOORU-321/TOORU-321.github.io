/* choice-screen.js : 「選択肢5つ＋その他は自由入力」の画面を仕様表から組み立てる。
 * DAY2（Screen G・H・I）とDAY3（Screen L〜P）が同じ作りなので共通化してある。
 * DAY4以降も、仕様表を足すだけで画面が増える。
 *
 * spec:
 *   id          : 画面ID
 *   dayKey      : 保存先（'day2' / 'day3'）
 *   logic       : SC.day2 / SC.day3（value / isAnswered を持つ）
 *   copy        : SC.copy のキー
 *   field       : 選択値の保存キー
 *   customField : 自由入力の保存キー
 *   options     : SC.config のキー
 *   optionsFn   : 選択肢を毎回組み立てる場合（DAY5の仮説はDAY4の言葉で埋める）
 *   note2       : 補助文をもう一行足す場合
 *   phaseNote   : Phase1での断り書き（商品案内をしない旨など）
 *   completesDay: 進む前にそのDAYを完了させる場合はDAY番号
 *   next        : 次の画面ID
 *   viewEvent / selectEvent : 計測イベント名
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;

  SC.screens = SC.screens || {};

  SC.buildChoiceScreens = function (specs) {
    specs.forEach(function (spec) {
      SC.screens[spec.id] = {
        id: spec.id,
        render: function (ctx) {
          var c = SC.copy[spec.copy];
          var logic = spec.logic();
          var answers = ctx.state[spec.dayKey] || {};
          var selected = answers[spec.field];
          var options = spec.optionsFn ? spec.optionsFn(ctx.state) : SC.config[spec.options];
          var option = selected ? SC.optionByValue(options, selected) : null;
          var noticeSlot = h('div', { class: 'notice-slot' });

          ctx.trackView(spec.viewEvent);

          return h('div', { class: 'screen screen--choice' }, [
            SC.ui.appHeader({ dayLabel: c.dayLabel, title: c.title, onBack: ctx.back }),

            ctx.restoreNotice ? SC.ui.saveStatus({ text: ctx.restoreNotice, tone: 'info' }) : null,

            SC.ui.card(null, [
              h('p', { class: 'card__note', text: c.note }),
              SC.ui.choiceList({
                name: spec.id,
                legend: c.title,
                options: options,
                value: selected,
                selectedBadge: '選択中',
                onSelect: function (value) {
                  /* 選択のたびに即時保存。回答本文は計測へ送らない */
                  var patch = {};
                  patch[spec.field] = value;
                  ctx.saveDay(spec.dayKey, patch);
                  ctx.track(spec.selectEvent);
                  ctx.setFlash(SC.copy.common.saved);
                  ctx.rerender(spec.id + '-' + value);
                }
              }),

              /* 「その他／自分の言葉」を選んだときだけ自由入力を出す */
              option && option.custom
                ? SC.ui.textInput({
                    id: spec.id + '-custom-text',
                    label: c.customLabel,
                    placeholder: c.customPlaceholder,
                    value: answers[spec.customField] || '',
                    onInput: function (text) {
                      var patch = {};
                      patch[spec.customField] = text;
                      ctx.saveDay(spec.dayKey, patch);
                    }
                  })
                : null,

              c.note2 ? h('p', { class: 'card__note card__note--after', text: c.note2 }) : null,
              c.phaseNote ? h('p', { class: 'card__note card__note--after', text: c.phaseNote }) : null,

              ctx.flash ? SC.ui.saveStatus({ text: ctx.flash.text, tone: ctx.flash.tone }) : null
            ]),

            noticeSlot,

            SC.ui.ctaArea([
              SC.ui.primaryCta({
                label: c.primaryCta,
                onClick: function () {
                  var state = SC.store.getState();
                  var current = state[spec.dayKey] || {};
                  SC.dom.clear(noticeSlot);
                  if (!current[spec.field]) {
                    noticeSlot.appendChild(SC.ui.notice(c.requireChoice));
                    return;
                  }
                  if (!logic.isAnswered(state, spec.field)) {
                    noticeSlot.appendChild(SC.ui.notice(c.requireText));
                    var field = global.document.getElementById(spec.id + '-custom-text');
                    if (field) field.focus();
                    return;
                  }
                  if (spec.completesDay === 2) SC.day2.complete(ctx);
                  ctx.go(spec.next);
                }
              })
            ])
          ]);
        }
      };
    });
  };
})(window);
