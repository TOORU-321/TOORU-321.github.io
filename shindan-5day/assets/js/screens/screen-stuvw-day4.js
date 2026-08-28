/* screen-stuvw-day4.js : Screen S｜DAY4導入 と Screen T〜W｜4地点の選択（§26-B）
 * T〜W は choice-screen.js の共通部品で組み立てる。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;

  SC.screens = SC.screens || {};

  /* --- Screen S｜DAY4導入 ------------------------------------------------ */
  SC.screens.day4_intro = {
    id: 'day4_intro',
    render: function (ctx) {
      var c = SC.copy.day4Intro;
      var state = ctx.state;

      ctx.trackView('day4_intro_view');

      return h('div', { class: 'screen screen--day4-intro' }, [
        SC.ui.appHeader({ dayLabel: c.dayLabel, title: c.title, onBack: ctx.back }),

        ctx.restoreNotice ? SC.ui.saveStatus({ text: ctx.restoreNotice, tone: 'info' }) : null,

        /* 前回まで：DAY2のお客様カードとDAY3の価値の橋を再掲する（§26-B） */
        SC.ui.card(c.recapHeading, [
          h('p', { class: 'card__note recap__caption', text: c.recapCustomerLabel }),
          h('blockquote', { class: 'persona-card persona-card--recap' },
            SC.day2.buildCard(state).map(function (line) {
              return h('p', { class: 'persona-card__line', text: line });
            })
          ),
          h('p', { class: 'card__note recap__caption', text: c.recapBridgeLabel }),
          h('blockquote', { class: 'persona-card persona-card--recap' }, [
            h('p', { class: 'persona-card__line', text: SC.day3.bridgeText(state) })
          ])
        ], 'card--recap'),

        SC.ui.card(null, SC.ui.prose(c.lead), 'card--lead card--reading'),

        SC.ui.card(c.lessonHeading, SC.ui.prose(c.lessonBody)),

        /* 共通動画（§41-C）。回答を始める前に置く。素材が無いあいだは出ない */
        SC.ui.videoBlock({ day: 4, screen: 'day4_intro', track: ctx.track }),

        SC.ui.ctaArea([
          SC.ui.primaryCta({ label: c.primaryCta, onClick: function () { ctx.go('day4_entry'); } })
        ])
      ]);
    }
  };

  /* --- Screen T〜W｜4地点の選択 ------------------------------------------ */
  function day4() { return SC.day4; }

  SC.buildChoiceScreens([
    {
      id: 'day4_entry', dayKey: 'day4', logic: day4,
      copy: 'day4Entry', field: 'entry', customField: 'entryCustom',
      options: 'day4Entries', next: 'day4_relevance',
      viewEvent: 'day4_entry_view', selectEvent: 'day4_entry_selected'
    },
    {
      id: 'day4_relevance', dayKey: 'day4', logic: day4,
      copy: 'day4Relevance', field: 'relevanceExperience', customField: 'relevanceExperienceCustom',
      options: 'day4Relevance', next: 'day4_action',
      viewEvent: 'day4_relevance_view', selectEvent: 'day4_relevance_selected'
    },
    {
      id: 'day4_action', dayKey: 'day4', logic: day4,
      copy: 'day4Action', field: 'smallAction', customField: 'smallActionCustom',
      options: 'day4Actions', next: 'day4_support',
      viewEvent: 'day4_action_view', selectEvent: 'day4_action_selected'
    },
    {
      id: 'day4_support', dayKey: 'day4', logic: day4,
      copy: 'day4Support', field: 'support', customField: 'supportCustom',
      options: 'day4Supports', next: 'day4_order',
      viewEvent: 'day4_support_view', selectEvent: 'day4_support_selected'
    }
  ]);
})(window);
