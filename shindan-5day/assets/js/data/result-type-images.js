/* result-type-images.js : 最低軸ごとのイメージイラスト（2026-08-24 Codex・あかり指示）
 *
 * ★これは「性格タイプ」ではない。
 *   分類しているのは **最低軸＝いま最初に整える場所** の5種類。
 *   「あなたは○○な人です」のような固定的な言い方はしない。
 *
 * 採点・最低軸判定・スコア帯・補助フラグのロジックはこのファイルと無関係。
 * 画面側に5軸の条件分岐を書かず、必ず get() 経由で引く。
 *
 * 素材：G:\マイドライブ\画像\診断チャレンジアプリ\result-types\ から
 *       assets/images/result-types/ へコピーしたもの（元は触っていない）。
 *       5枚とも 1536×1024（3:2）。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  var BASE = 'assets/images/result-types/';
  var WIDTH = 1536;
  var HEIGHT = 1024;

  var ITEMS = {
    customerInsight: {
      file: 'result-type-customer-insight-v1.jpg',
      label: 'お客様理解',
      alt: '一人のお客様の場面と感情へ焦点を合わせるイラスト'
    },
    productStructure: {
      file: 'result-type-product-structure-v1.jpg',
      label: '商品の土台',
      alt: '商品要素を一つの役割へ組み立てるイラスト'
    },
    salesJourney: {
      file: 'result-type-sales-journey-v1.jpg',
      label: '届ける流れ',
      alt: 'SNSから必要な支援までの流れをつなぐイラスト'
    },
    growthEnvironment: {
      file: 'result-type-growth-environment-v1.jpg',
      label: '学び・相談環境',
      alt: '自分の事業に合う学びと相談環境を整理するイラスト'
    },
    improvementOperation: {
      file: 'result-type-improvement-operation-v1.jpg',
      label: '育てる力',
      alt: '小さく試して記録し改善を続けるイラスト'
    }
  };

  SC.resultTypeImages = {
    version: 'v1',
    basePath: BASE,
    width: WIDTH,
    height: HEIGHT,

    /* 画像に添える一言（2026-08-24 Codex・あかり正式採用）。
     * 5軸すべて同じテンプレートで、表示名だけ差し替える。 */
    captionTemplate: 'まずは『{axis}』から',

    /* 一言の直下に置く補助文（同・正式採用）。
     * 固定的な性格分類ではないことを、その場で打ち消す。 */
    note: '能力や性格の判定ではありません。現在の回答から見えた、最初に整える候補です。',

    /* ページによって階層が違う場合の逃げ道（tools/ から見るときなど）。
     * 通常のページ（ルート直下）は既定のままでよい。 */
    prefix: '',

    /* 最低軸キー → 画像情報。知らないキー・未指定なら null を返す。
     * null のときは画像を出さないだけで、結果本文とCTAはそのまま使える。 */
    get: function (axisKey) {
      if (typeof axisKey !== 'string') return null;
      var item = Object.prototype.hasOwnProperty.call(ITEMS, axisKey) ? ITEMS[axisKey] : null;
      if (!item) return null;
      /* 表示軸名は5軸マスタ（axes.js）を正とし、無ければこちらの控えを使う */
      var label = SC.axisLabel ? (SC.axisLabel(axisKey) || item.label) : item.label;
      return {
        axis: axisKey,
        src: SC.resultTypeImages.prefix + BASE + item.file,
        file: item.file,
        label: label,
        alt: item.alt,
        width: WIDTH,
        height: HEIGHT,
        caption: SC.resultTypeImages.captionTemplate.replace('{axis}', label)
      };
    },

    /* テスト・点検用。5軸ぶんの一覧 */
    all: function () {
      var out = [];
      for (var k in ITEMS) {
        if (Object.prototype.hasOwnProperty.call(ITEMS, k)) out.push(SC.resultTypeImages.get(k));
      }
      return out;
    },

    keys: function () {
      var out = [];
      for (var k in ITEMS) {
        if (Object.prototype.hasOwnProperty.call(ITEMS, k)) out.push(k);
      }
      return out;
    }
  };
})(window);
