/* offer-catalog.js : 商品・サービスのカタログ（§37-6／§37-7）
 *
 * ★ここは「差し替え口」です。正式な商品マスタが届いたら、このファイルだけを
 *   入れ替えれば画面側は変更不要です。画面ファイルへURLを直書きしないこと。
 *
 * ★正式な商品名・価格・URLが未確定のため、offers は空のままにしてあります。
 *   実在しない商品情報を仮置きしてユーザー画面へ出さない（§37-13）。
 *   offers が空のあいだ、画面は「準備中」の非操作表示になります。
 *
 * axes には、軸ごとの教育テーマと候補の分類だけを置いています。
 * これは§37-6で確定した「分類名とテーマの正本」であり、商品名ではありません。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  SC.offerCatalog = {
    /* 軸ごとの教育テーマと、候補になるコンテンツの分類（商品名ではない） */
    axes: {
      customerInsight: {
        label: '顧客解像度',
        theme: '顧客心理、行動経済学、顧客理解',
        candidates: ['行動経済学の学び', '顧客理解の解説']
      },
      productStructure: {
        label: '商品構造力',
        theme: '誰に何を届けるか、商品の組み立て、コンテンツ化',
        candidates: ['商品設計の学び', '電子書籍づくり', '講座づくりの解説']
      },
      salesJourney: {
        label: '販売導線力',
        theme: 'SNSからLINE、商品までの順番',
        candidates: ['LINE構築の学び', '集客導線の解説']
      },
      growthEnvironment: {
        label: '成長環境力',
        theme: '一人で止まらず継続する環境',
        candidates: ['起業初心者の支援', '伴走', 'コミュニティ']
      },
      improvementOperation: {
        label: '改善運用力',
        theme: '数字を見て小さく改善する方法',
        candidates: ['改善運用の学び', '仕組み化', '計測の解説']
      }
    },

    /* コンテンツの種類。オファー強度（§37-10）と対応する */
    contentTypes: {
      free_content: { level: 1, label: '無料動画・無料教材' },
      course: { level: 2, label: 'オンデマンド講座の内容確認' },
      consultation: { level: 3, label: '個別相談の内容確認' },
      /* レベル4（相談後の個別サービス提案）は画面から出さない。§37-8 */
      high_involvement: { level: 4, label: '相談後の個別サービス提案' }
    },

    /* 個別見積もり・要件確認が必要なサービス。DAY5から直接購入させない（§37-8） */
    highInvolvement: [
      'LINE構築代行', '集客導線の個別構築', '電子書籍出版サポート', 'アプリ開発'
    ],

    /* 実際のオファー。正式な商品マスタが届くまで空のままにする。
     *
     * 1件の形：
     *   {
     *     id: 'free_product_structure',   // 一意のID。計測にはこのIDだけを送る
     *     mode: 'learn',                  // self / learn / consult
     *     axis: 'productStructure',       // 対応する最低軸。全軸共通なら null
     *     contentType: 'free_content',    // free_content / course / consultation
     *     heading: '…',
     *     body: '…',
     *     ctaLabel: '…',
     *     url: 'https://…'                // 未確定なら null（CTAを出さない）
     *   }
     */
    offers: []
  };
})(window);
