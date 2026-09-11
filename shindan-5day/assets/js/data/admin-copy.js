/* admin-copy.js : 進み具合の一覧（とーる専用）の文言
 *
 * 参加者には見えないページ。数字と事実だけを並べる。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  SC.adminCopy = {
    pageTitle: '5DAY 進み具合｜一覧',
    heading: '進み具合の一覧',

    keyLabel: '合言葉',
    keyPlaceholder: '設定した合言葉',
    keyNote: 'この端末にだけ記憶します。人に見せないでください。Apps Scriptのスクリプトプロパティ ADMIN_KEY と同じ文字です。',
    loadLabel: '読み込む',
    clearKeyLabel: '合言葉を消す',
    reload: '再読み込み',

    beforeLoad: '合言葉を入れて「読み込む」を押してください。',
    loading: '読み込んでいます…',
    empty: 'まだ診断を受けた方がいません。',
    error: '合言葉が違うようです。もう一度お確かめください。',
    errorNetwork: 'つながりませんでした。通信の状態を確かめて、もう一度お試しください。',

    /* まとめ */
    summary: {
      diagnoses: '診断した回数',
      /* 受け直しを1人として数えた実人数（2026-09-11 とーる指示） */
      people: 'のべ人数（受け直しを除く）',
      linked: 'LINEとつないだ人',
      joined: '5日間に参加した人',
      completed: '完走した人',
      dayHeading: 'どこまで進んだか',
      dayLabel: 'DAY{day}',
      unit: '人'
    },

    /* 絞り込み */
    filters: {
      all: 'すべて',
      joined: '参加した人だけ',
      completed: '完走した人だけ',
      stalled: '止まっている人だけ'
    },
    stalledNote: '参加したのに、3日以上さわっていない方です。',

    /* 一覧の1件 */
    row: {
      score: '点',
      noJoin: '診断だけ',
      joined: '参加',
      completed: '完走',
      lastAt: '最終更新',
      openDetail: '中身を見る',
      uid: 'LINE',
      noUid: 'LINE未連携',
      /* 同じ方が受け直したとき。{n} は回数（2026-09-11 とーる指示） */
      repeat: '{n}回目'
    },

    /* 詳細 */
    detail: {
      heading: 'この方の中身',
      close: '閉じる',
      loading: '開いています…',
      blueprint: '一本線',
      diagnosis: '診断の内訳',
      answers: '5日間の回答',
      none: 'まだありません',
      copy: 'まとめてコピー',
      copied: 'コピーしました'
    },

    countTemplate: '{shown}件を表示（全{total}件）',
    note: '名前は保存していません。どなたかを確かめるときは、LINEの識別子（uid）でプロライン側と突き合わせてください。'
  };
})(window);
