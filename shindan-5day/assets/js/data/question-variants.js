/* question-variants.js : 設問の表現バリアント
 *
 * 正本：Notion §51（Codex・あかり／2026-08-25）
 *
 * 決まり
 *  ・同じ構成概念・同じ採点を保つ。測っているものを変えない
 *  ・軸（axis）と配点は正本（diagnosis-v04.js）のまま。ここでは触らない
 *  ・置き換えてよいのは「質問文」と「選択肢の表示文」だけ
 *  ・選択肢は必ず5つ。並び順（1が低い → 5が高い）も変えない
 *  ・対象は3〜5問まで
 *
 * バリアントの種類
 *  event        出来事型      … 起きた出来事を描く
 *  emotion      感情・共感型   … そのときの気持ちを描く
 *  relationship 関係性トリガー型 … 人からの言葉・視線をきっかけに描く
 *
 * ★テスト自体は既定OFF（config-diagnosis.js の questionVariantTest.enabled）。
 *   OFFのあいだは、ここの文言は一切使われず、正本だけが出る。
 *   本番でのテスト開始は別途承認制。
 *
 * ★Q4の relationship はかなり強い言い方なので、離脱率だけで判断しない。
 *   回答時間・診断完了率・LINE CTA率まで合わせて見ること（§51）。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  /* Q8の5択（2026-08-25 §51で差し替えた正本と同じもの）。
   * 3種類すべてでこれを使う。 */
  var Q8_OPTIONS = [
    '投稿を、それぞれ単体で終わらせている',
    'プロフィールやLINEへリンクを集めている',
    '投稿から入口は作るが、どれも同じ案内につながる',
    '投稿テーマごとに、次に見せる内容が決まっている',
    '投稿から次の案内・再案内まで一覧で管理している'
  ];

  SC.questionVariants = {
    /* 文言そのものの版。差し替えたら上げる。計測へはこの値だけを載せる */
    version: 'v1',

    byQuestion: {
      /* Q1｜お客様理解（顧客解像度）。選択肢は正本のまま */
      1: {
        event: {
          text: '投稿したあと、思っていたほど反応がなかった。その次に、普段していることは？'
        },
        emotion: {
          text: '投稿しても反応がなく、「どうせ今回も……」と思ってしまうとき。普段は？'
        },
        relationship: {
          text: '同じ時期に始めた人の反応や成果を見て、自分だけ遅れているように感じたとき。普段は？'
        }
      },

      /* Q4｜育てる力（改善運用力）。選択肢は正本のまま */
      4: {
        event: {
          text: '企画を案内しても、思っていたような申込みにつながらなかった。その後は？'
        },
        emotion: {
          text: '企画が売れないと、「私には向いていないのかも」と気持ちが折れそうになる。その後は？'
        },
        relationship: {
          /* ★強い言い方。離脱率だけでなく、完了率とCTA率まで見て判断する */
          text: '同じ時期に始めた人は満席なのに、自分の企画は売れなかった。その事実を知ったあとは？'
        }
      },

      /* Q8｜届ける流れ（販売導線力）。3種類とも新しい5択を使う */
      8: {
        event: {
          text: '投稿を続けても、その場限りで流れていく。今の投稿から次の案内までの状態は？',
          options: Q8_OPTIONS
        },
        emotion: {
          text: '投稿を続けても、「頑張りが積み上がらない」と感じる。今の投稿から次の案内までの状態は？',
          options: Q8_OPTIONS
        },
        relationship: {
          text: '周りから「最近、活動どう？」と聞かれたとき、積み上げてきたことをうまく説明できない。今の投稿から次の案内までの状態は？',
          options: Q8_OPTIONS
        }
      },

      /* Q15｜学び・相談環境（成長環境力）。選択肢は正本のまま */
      15: {
        event: {
          text: '新しいノウハウや講座、ツールを知ったとき。普段は？'
        },
        emotion: {
          text: '結果を出している人を見ると、「自分も何か増やさなければ」と焦ることがある。新しい情報が出たときは？'
        },
        relationship: {
          text: '同じ時期に始めた人が、新しい学びを取り入れて成果を出していると知ったとき。普段は？'
        }
      }
    },

    /* 対象になっている設問番号の一覧 */
    questionIds: function () {
      var out = [];
      var map = SC.questionVariants.byQuestion;
      for (var k in map) {
        if (Object.prototype.hasOwnProperty.call(map, k)) out.push(parseInt(k, 10));
      }
      return out.sort(function (a, b) { return a - b; });
    },

    /* 指定の設問・種類の差し替え文。無ければ null */
    get: function (questionNo, variant) {
      var map = SC.questionVariants.byQuestion;
      var entry = map[questionNo] || map[String(questionNo)];
      if (!entry) return null;
      return entry[variant] || null;
    }
  };
})(window);
