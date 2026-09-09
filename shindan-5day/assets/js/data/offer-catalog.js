/* offer-catalog.js : 商品・サービスのカタログ（§37-6／§37-7）
 *
 * ★ここは「差し替え口」です。正式な商品マスタが届いたら、このファイルだけを
 *   入れ替えれば画面側は変更不要です。画面ファイルへURLを直書きしないこと。
 *
 * ★2026-09-09（§66）：consult（L-MINE 2.0）だけ接続先が確定したので登録した。
 *   learn の講座は、接続先が「期限なしの案内価格ページ」に決まったものの、
 *   そのページがまだ無いため未登録。url が無いあいだ、画面は「準備中」の
 *   非操作表示になる（実在しない商品情報は仮置きしない：§37-13）。
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
    offers: [
      /* --- consult：L-MINE 2.0（チャレンジ後版）---------------------------
       * 有料の継続支援であること、内容と料金がページで確認できること、
       * 参加前のZoom審査が必須であることを本文で明示する。
       * ★スコアからプランを自動推薦しない。プランは本人がページで選ぶ。 */
      {
        id: 'consult_lmine_2_0',
        mode: 'consult',
        axis: null,                       /* 軸で出し分けない。進み方だけで決まる */
        contentType: 'consultation',
        heading: '相談しながら進めたい方へ',
        body: 'L-MINEは、月ごとの有料の継続サポートです。支援内容・料金・契約条件は、'
            + 'ご案内ページで先にすべて確認できます。お申し込みの前に、'
            + 'Zoomでの参加審査を受けていただきます。予約・面談の時点では、'
            + '契約や決済は発生しません。',
        ctaLabel: '支援内容と料金を見る',
        url: 'https://columns.l-mine.com/l-mine-2.0-5day.html'
      },

      /* --- learn：最低軸に対応する講座 -------------------------------------
       * 商品の土台（productStructure）→「はじめての商品設計デザイン講座」。
       *
       * ★期限の起点は「DAY5を終えた日」（2026-09-09 とーる判断）。
       *   いつでも同じ値段なら、それは割引ではなく普通の価格になり、
       *   決める理由が無くなる、という判断。
       *   ただし「根拠のない期限」は置かない。5日間をやり切った直後が
       *   いちばん動きやすいので、そこを起点にすれば理由を言い切れる。
       *   deadlineFromDay5 を立てると、開くときに ?ofs= へその時刻が入る。
       *
       * ★URLへ渡すのは、この時刻と経路の印だけ。
       *   回答本文・診断結果・自由入力・個人情報は渡さない（§37-11）。
       * ★URLを共有されれば第三者も同じ期限で買える。
       *   だから「本人だけ」「あなただけ」とは表示しない。 */
      {
        id: 'course_product_structure',
        mode: 'learn',
        axis: 'productStructure',
        contentType: 'course',
        deadlineFromDay5: true,
        heading: '商品の土台から整えたい方へ',
        body: '5日間で決めた「誰に、どんな変化を」を、商品の形へ落とし込む講座です。'
            + '全6本・約30分のオンデマンドで、内容と価格はページで確認できます。',
        ctaLabel: '講座の内容を見る',
        url: 'https://columns.l-mine.com/course-hajimete-shohin-letter.html'
      }

      /* ★お客様理解（customerInsight）は、現ラインナップに対応講座が無い。
       *   「はじめての集客商品デザイン講座」は内容を確認したところ、
       *   商品の分解と発信からの導線設計が主で、顧客の場面・感情の理解では
       *   なかった（§66の調査結果）。タイトルの近さで登録しない。
       * ★届ける流れ（salesJourney）は対応講座が未完成のため登録しない。
       * ★学び・相談環境／育てる力は、最低軸を理由にL-MINEへ自動接続しない。
       *   進み方（supportMode）で決まる上の consult がその役割を持つ。
       */
    ],

    /* 「ほかの講座も見る」で開く一覧（§66-5）。
     *
     * ★これは推薦ではない。値引きしていない選択肢として、たたんだ状態で置く。
     * ★おすすめと同じ講座をここへ重ねて出さない（画面側で除外する）。
     * ★通常版のページには期限の演出が無い。割引版へはつながない。
     * ★価格はここに持たない。正本はページとStripe側で、二重に持つとズレる
     *   （2026-09-09：チャレンジ後LPで、実態と違う説明が3日残った件の反省）。 */
    courseList: [
      {
        id: 'course_shohin',
        axis: 'productStructure',
        title: 'はじめての商品設計デザイン講座',
        summary: '誰に、どんな価値を届ける商品なのかを組み立て直します。',
        url: 'https://columns.l-mine.com/course-hajimete-shohin.html'
      },
      {
        id: 'course_shukyaku',
        axis: null,
        title: 'はじめての集客商品デザイン講座',
        summary: '本命商品へつながる、買われやすい入口商品を設計します。',
        url: 'https://columns.l-mine.com/course-hajimete-shukyaku.html'
      },
      {
        id: 'course_sns',
        axis: null,
        title: 'はじめてのSNSマーケティング基礎講座',
        summary: '流行の手法ではなく、変わらない原理から発信を組み立てます。',
        url: 'https://columns.l-mine.com/course-hajimete-sns.html'
      },
      {
        id: 'course_uriage',
        axis: null,
        title: 'はじめての売上デザイン講座',
        summary: '売上を単価・人数・回数に分解し、動かす場所を決めます。',
        url: 'https://columns.l-mine.com/course-hajimete-uriage.html'
      }
    ]
  };
})(window);
