/* offers.js : 次の一歩の出し分け（§37）
 *
 * 画面に条件分岐を書き散らかさないため、判断はここへ集める。
 * 画面側は resolveSupportRecommendation() の戻り値をそのまま描くだけ。
 *
 * 守っていること（§37-12 信頼を守る表示条件）
 *  ・DAY1〜DAY4には出さない（呼ばれるのはScreen AIだけ）
 *  ・DAY5でも案内は一つだけ
 *  ・self には有料講座も相談も自動表示しない
 *  ・高関与サービス（要見積もり・要件確認）は画面から直接出さない
 *  ・接続先が未確定なら isAvailable: false とし、外部遷移CTAを出さない
 *  ・偽の期限・残席・割引・通常価格は扱わない
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  /* 計測へ出してよい補助キー（§37-11）。本文・URL・価格は入れない */
  var OFFER_META = ['mode', 'axis', 'offerId', 'contentType', 'timing'];

  /* 進み方ごとに、画面から出してよいコンテンツの種類（§37-5／§37-10） */
  var ALLOWED = {
    self: ['free_content'],                 /* 有料講座・相談は自動表示しない */
    learn: ['free_content', 'course'],      /* まず無料動画。講座は同じ画面で強く並べない */
    consult: ['consultation']
  };

  function catalog() { return SC.offerCatalog || { axes: {}, offers: [], contentTypes: {} }; }

  function normalizeMode(mode) {
    return ALLOWED[mode] ? mode : 'self';
  }

  SC.offers = {
    OFFER_META: OFFER_META,
    ALLOWED: ALLOWED,

    loadOfferCatalog: function () { return catalog(); },

    getOfferById: function (id) {
      var list = catalog().offers || [];
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    },

    axisTheme: function (axis) {
      return (catalog().axes || {})[axis] || null;
    },

    levelOf: function (contentType) {
      var t = (catalog().contentTypes || {})[contentType];
      return t ? t.level : 0;
    },

    /* 進み方と最低軸の組み合わせで、出せるオファーを1件だけ選ぶ。
     * 軸専用のものを優先し、無ければ全軸共通（axis: null）を使う。 */
    findOffer: function (mode, axis) {
      var allowed = ALLOWED[normalizeMode(mode)];
      var list = (catalog().offers || []).filter(function (o) {
        if (o.mode !== normalizeMode(mode)) return false;
        if (allowed.indexOf(o.contentType) === -1) return false;
        /* 高関与サービスは画面から直接出さない（§37-8） */
        if (o.contentType === 'high_involvement') return false;
        return true;
      });
      /* 種類の並び順（無料 → 講座 → 相談）で、軽いものから探す */
      for (var i = 0; i < allowed.length; i++) {
        var type = allowed[i];
        var forAxis = list.filter(function (o) { return o.contentType === type && o.axis === axis; });
        if (forAxis.length) return forAxis[0];
        var common = list.filter(function (o) { return o.contentType === type && !o.axis; });
        if (common.length) return common[0];
      }
      return null;
    },

    /* 画面が使う唯一の入口。
     * 戻り値：mode / axis / contentType / offerId / heading / body / ctaLabel / url / isAvailable
     *        （ほかに internal・pending・level を添える） */
    resolveSupportRecommendation: function (supportMode, lowestAxis) {
      var mode = normalizeMode(supportMode);
      var copy = SC.copy.day5Support.modes[mode];
      var offer = SC.offers.findOffer(mode, lowestAxis);

      /* self は商品ではなく、同じ画面の30日実験カードへ戻す内部導線。
       * 正式なオファーが無くても、この導線だけは常に使える（§37-5 self） */
      if (mode === 'self' && !offer) {
        return {
          mode: mode, axis: lowestAxis, contentType: null, offerId: null,
          heading: copy.heading, body: copy.body, ctaLabel: copy.cta,
          url: null, isAvailable: true, internal: true, pending: null, level: 0
        };
      }

      if (!offer) {
        /* 接続先が未確定。文言は出すが、外部遷移CTAは出さない（§37-5／§37-13） */
        return {
          mode: mode, axis: lowestAxis, contentType: null, offerId: null,
          heading: copy.heading, body: copy.body, ctaLabel: copy.cta,
          url: null, isAvailable: false, internal: false,
          pending: copy.pending || null, level: 0
        };
      }

      return {
        mode: mode,
        axis: offer.axis || lowestAxis,
        contentType: offer.contentType,
        offerId: offer.id,
        heading: offer.heading || copy.heading,
        body: offer.body || copy.body,
        ctaLabel: offer.ctaLabel || copy.cta,
        url: offer.url || null,
        isAvailable: !!offer.url,
        internal: false,
        pending: offer.url ? null : (copy.pending || null),
        level: SC.offers.levelOf(offer.contentType)
      };
    },

    /* DAY5完了からの経過で、いまどの段階かを返す（§37-9）。
     * Phase2初期では通知を送らない。段階の判定だけを用意しておく。 */
    timingFor: function (state, now) {
      if (!state || !state.day5CompletedAt) return null;
      var done = new Date(state.day5CompletedAt);
      if (isNaN(done.getTime())) return null;
      var days = Math.floor(((now || new Date()) - done) / 86400000);
      if (days < 1) return 'day5';
      if (days < 3) return 'day_after';
      if (days < 10) return 'day3_7';
      if (days < 30) return 'day10_14';
      return 'day30';
    },

    /* 段階ごとに出してよい強度の上限（§37-10）。画面はこれを超えない */
    maxLevelFor: function (timing) {
      if (timing === 'day5') return 3;        /* supportModeに応じて0〜3 */
      if (timing === 'day_after') return 1;   /* 強い有料オファーは行わない */
      if (timing === 'day3_7') return 2;
      if (timing === 'day10_14') return 3;
      if (timing === 'day30') return 3;
      return 0;                                /* 診断結果〜DAY4 */
    },

    /* 計測。許可した補助キーだけを通す（§37-11）。
     * 本文・URL・価格・相談内容・個人情報は送らない。外部送信もしない。 */
    trackOfferEvent: function (name, meta) {
      var safe = {};
      if (meta) {
        OFFER_META.forEach(function (k) {
          if (meta[k] !== undefined && meta[k] !== null) safe[k] = meta[k];
        });
      }
      return SC.track.event(name, safe);
    }
  };
})(window);
