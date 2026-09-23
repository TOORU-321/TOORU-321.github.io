/* next-step.js : DAY5完了後の案内専用ページ。保存の書き換え・参加確定・決済は行わない。 */
(function(global){
  'use strict';
  var SC=global.SC,h=SC.dom.h;
  SC.nextStep={};
  SC.nextStep.build=function(d,state){
      var s = SC.copy.day5Support;
      var rec = SC.offers.resolveNextStepRecommendation(
        (state.day5 || {}).supportMode, d.lowestAxis, state.day5CompletedAt);
      var timing = SC.offers.timingFor(state) || 'day5';
      var offerMeta = {
        mode: rec.mode, axis: rec.axis, contentType: rec.contentType,
        offerId: rec.offerId, timing: timing
      };

      SC.offers.trackOfferEvent('support_recommendation_view', offerMeta);
      if (!rec.isAvailable) SC.offers.trackOfferEvent('offer_unavailable', offerMeta);
      else if (rec.contentType === 'free_content') {
        SC.offers.trackOfferEvent('free_content_recommended', offerMeta);
      } else if (rec.contentType === 'course') {
        SC.offers.trackOfferEvent('course_recommendation_view', offerMeta);
      } else if (rec.contentType === 'consultation') {
        SC.offers.trackOfferEvent('consultation_recommendation_view', offerMeta);
      }

      function onOfferClick() {
        SC.offers.trackOfferEvent('support_link_clicked', offerMeta);
        if (rec.contentType === 'free_content') {
          SC.offers.trackOfferEvent('free_content_clicked', offerMeta);
        } else if (rec.contentType === 'course') {
          SC.offers.trackOfferEvent('course_link_clicked', offerMeta);
        } else if (rec.contentType === 'consultation') {
          SC.offers.trackOfferEvent('consultation_link_clicked', offerMeta);
        }
        if (rec.internal) {
          backToExperiment();
          return;
        }
        global.open(rec.url, '_blank', 'noopener');
      }

      /* 「ほかの講座も見る」（§66-5）。
       *
       * ・推薦ではなく、通常価格の選択肢。たたんだ状態で置く
       * ・今回のとーる指示で learn / consult に任意の一覧を表示する
       * ・self には有料を表示しない。おすすめとは別の折りたたみに置く
       * ・おすすめに選ばれた講座は、この一覧から除く（重複表示しない）
       * ・つなぐのは通常版のページだけ。期限の演出がある割引版へはつながない */
      function courseListBlock() {
        if (rec.mode === 'self') return null;
        var cl = (SC.offerCatalog || {}).courseList || [];
        var copyList = s.courseList;
        if (!cl.length || !copyList) return null;

        var selectedOffer = SC.offers.getOfferById(rec.offerId);
        var recCourseId = selectedOffer && selectedOffer.courseId;
        var items = cl.filter(function (c) { return c.url && c.id !== recCourseId; });
        if (!items.length) return null;

        return h('details', { class: 'course-list' }, [
          h('summary', { class: 'course-list__summary', text: SC.offerViewCopy.other }),
          h('p', { class: 'card__note course-list__note', text: SC.offerViewCopy.otherNote }),
          h('ul', { class: 'course-list__items' }, items.map(function (c) {
            return h('li', { class: 'course-list__item' }, [
              h('a', {
                class: 'course-list__link',
                href: c.url, target: '_blank', rel: 'noopener',
                on: { click: function () {
                  /* 送るのはIDと分類だけ。商品名・URL・価格は送らない（§37-11） */
                  SC.offers.trackOfferEvent('course_list_clicked', {
                    mode: rec.mode, axis: c.axis || null,
                    offerId: c.id, contentType: 'course', timing: timing
                  });
                } }
              }, c.title),
              h('span', { class: 'course-list__summary-text', text: c.summary })
            ]);
          }))
        ]);
      }

      var view = SC.offerViewCopy;
      var kind = rec.fallbackFromCourse ? 'fallback' : rec.contentType === 'course' ? 'course' : rec.contentType === 'consultation' ? 'consult' : rec.mode === 'self' ? 'self' :
        (SC.offers.findOffer(rec.mode, d.lowestAxis) ? 'invalid' : 'pending');
      var offerCopy = view[kind];
      function backToExperiment() {
        global.location.href = 'index.html?view=experiment#/day5-done';
      }
      var supportCard = SC.ui.card(null, [
        h('p', { class: 'offer-view__eyebrow', text: view.eyebrow }),
        h('h2', { class: 'offer-view__title', text: offerCopy.title }),
        h('p', { class: 'offer-view__reason', text: offerCopy.reason }),
        offerCopy.name ? h('div', { class: 'offer-view__product' }, [
          h('img', { class: 'offer-view__photo', src: 'assets/images/challenge-planning-woman-dark-v1.jpg', alt: '', width: 1536, height: 1024, loading: 'lazy' }),
          h('p', { class: 'offer-view__name', text: offerCopy.name }),
          h('ul', { class: 'offer-view__facts' }, offerCopy.facts.map(function (fact) { return h('li', { text: fact }); }))
        ]) : null,
        offerCopy.steps ? h('ol', { class: 'offer-view__steps' }, offerCopy.steps.map(function (step) { return h('li', { text: step }); })) : null,
        /* 共通注記は案内より先（§37-4） */
        h('p', { class: 'card__note support__note', text: s.note }),
        h('h3', { class: 'support__title offer-view__detail-heading', text: rec.heading }),
        SC.ui.prose(rec.body),
        /* 接続先が決まっているものだけボタンにする。無ければ非操作の準備中表示 */
        /* 準備中の断りと、進める道は両立させる（§66追加判断-6）。
         * 対応講座が無いときも「準備中」で終わらせず、30日実験へ戻れるようにする。 */
        rec.pending
          ? h('p', { class: 'card__note card__note--after support__pending', text: rec.pending })
          : null,
        /* 外へ出る接続先があるとき（isAvailable）と、
         * 同じ画面の30日実験へ戻すとき（internal）だけボタンにする。
         * 接続先が未確定のオファーは、どちらも立たないのでボタンにならない */
        rec.isAvailable || rec.internal
          ? SC.ui.ctaArea([SC.ui.primaryCta({ label: rec.ctaLabel, onClick: onOfferClick })])
          : null,
        offerCopy.next ? h('p', { class: 'offer-view__next', text: offerCopy.next }) : null,
        rec.isAvailable && !rec.internal ? SC.ui.secondaryCta({ label: view.back, onClick: backToExperiment }) : null,
        courseListBlock(),
        h('a', { class: 'btn btn--ghost next-step-rechoose', href: 'index.html?view=choose-support#/day5-support', text: '進み方を選び直す' })
      ], 'card--reading card--support offer-view offer-view--' + kind);
      supportCard.id = 'next-step-offer';
      supportCard.setAttribute('tabindex', '-1');

      return supportCard;
  };
  SC.nextStep.boot = function () {
    var root = global.document.getElementById('next-step-app');
    if (!root) return;
    var v = SC.offerViewCopy;
    function gate(title, body) {
      SC.dom.clear(root);
      SC.dom.append(root, [h('h1', { class: 'scan-title', text: title }),h('p', { class:'scan-note', text:body }),
        h('a', { class:'btn btn--primary', href:'index.html', text:v.noRecordCta }),
        h('a', { class:'btn btn--secondary next-step-restore', href:SC.endpoints.lineDiagnosisRestore, rel:'noreferrer', text:'LINEから記録を開く' }),
        h('p', { class:'card__note', text:'診断で使ったLINEアカウントから開いてください。復元後、チャレンジの完了画面にある「次の一歩を見る」へお進みください。' })]);
    }
    /* hasRealDiagnosisはサンプルを生成しない。URLのmode/axisを判断に使わない。 */
    if (!SC.store.hasRealDiagnosis()) { gate(v.noRecordTitle,v.noRecordBody); return; }
    var d = SC.store.loadDiagnosis(), state = SC.store.loadChallengeState();
    if (SC.copyVersion && SC.copyVersion.isUnsupported(state)) { gate(v.unknownTitle,v.unknownBody); return; }
    if (state.participation !== 'joined' || state.completedDays.indexOf(5) === -1) { gate(v.noRecordTitle,v.noRecordBody); return; }
    if (SC.copyVersion) SC.copyVersion.use(state);
    SC.dom.clear(root);
    SC.dom.append(root,[h('a',{href:'index.html#/day5-done',class:'next-step-back',text:'← 完成したシートへ戻る'}),
      h('header', {class:'next-step-header'}, [h('p',{class:'scan-eyebrow',text:v.eyebrow}),
        h('h1',{class:'scan-title',text:v.pageTitle}),h('p',{class:'scan-note',text:v.pageNote})]),
      SC.nextStep.build(d,state)]);
  };
  if(global.document.readyState==='loading')global.document.addEventListener('DOMContentLoaded',SC.nextStep.boot);
  else SC.nextStep.boot();
})(window);
