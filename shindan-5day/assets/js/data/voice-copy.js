/* voice-copy.js : モニター感想フォームと管理ページの文言
 *
 * 掲載条件は §38-F（Codex／あかり確定）をそのまま項目にしている。
 *  1. 発言原文を保存        2. LP掲載への同意
 *  3. 実名／イニシャル／匿名  4. 肩書き・写真・成果数字の掲載範囲
 *  5. 編集後文面の再確認      6. 同意日・確認者の記録
 *  7. 同意撤回時の非表示手順
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  SC.copy = SC.copy || {};

  SC.copy.voice = {
    pageTitle: '5日間チャレンジ｜感想のお願い',

    /* 招待コードがないときの案内 */
    gate: {
      title: 'このページは、ご案内した方だけのものです',
      body: 'お送りしたリンクからもう一度開いてください。リンクが見つからない場合は、ご案内した経路からお知らせください。'
    },

    eyebrow: 'モニターのみなさまへ',
    heading: '5日間を終えて、感じたことを聞かせてください',
    lead: '正直な感想がいちばん役に立ちます。よかったところだけでなく、分かりにくかったところや、途中で止まりそうになったところも書いていただけると助かります。',

    /* 何に使うかを先に伝える */
    useHeading: 'いただいた感想の使いみち',
    useItems: [
      'このアプリと5日間の内容を直すために使います',
      '掲載に同意いただいた場合のみ、案内ページへ掲載することがあります',
      '掲載する前に、編集した文面を必ずご本人へ確認します',
      'あとから取り下げたくなった場合は、いつでも取り下げられます'
    ],

    bodyLabel: '5日間を終えての感想',
    bodyPlaceholder: '例：DAY3で、自分の商品が誰の何を変えるものなのか、はじめて一文で書けました。DAY4の順番を決めるところは少し迷いました。',
    bodyNote: 'そのままの言葉で大丈夫です。整えるのはこちらで行い、必ず確認をお願いします。',

    /* --- 掲載同意 --- */
    consentHeading: '掲載について',
    consentNote: '掲載を希望されない場合も、感想は改善のために大切に使わせていただきます。',

    publishLabel: '案内ページへの掲載',
    publishOptions: [
      { value: 'はい', label: '掲載してよい' },
      { value: 'いいえ', label: '掲載しない（改善にだけ使ってほしい）' }
    ],

    displayLabel: 'お名前の出し方',
    displayOptions: [
      { value: '匿名', label: '匿名でよい' },
      { value: 'イニシャル', label: 'イニシャルにしてほしい' },
      { value: '実名', label: '実名でよい' }
    ],
    displayNameLabel: '表示するお名前',
    displayNamePlaceholder: '例：T.Y／田中 太郎',
    displayNameNote: 'イニシャルまたは実名を選んだ場合だけ、ここに書いてください。',

    rangeHeading: '一緒に載せてよいもの',
    rangeNote: '載せてほしくないものは「載せない」を選んでください。',
    titleLabel: '肩書き・お仕事',
    photoLabel: 'お顔写真',
    numbersLabel: '数字（フォロワー数・売上など）',
    rangeOptions: [
      { value: '不可', label: '載せない' },
      { value: '可', label: '載せてよい' }
    ],

    contactLabel: '連絡先（任意）',
    contactPlaceholder: '例：メールアドレス、LINEのお名前',
    contactNote: '掲載前の確認にだけ使います。掲載はしません。',

    /* 送信 */
    privacyNote: 'このフォームで送った内容は、とーるの管理するスプレッドシートへ保存されます。5日間チャレンジの回答そのものは送信されません。',
    submitLabel: '感想を送る',
    sending: '送信しています…',
    requireBody: '感想を書いてください。',
    requirePublish: '掲載についてお選びください。',
    requireDisplayName: '表示するお名前を書いてください。',
    error: 'うまく送れませんでした。時間をおいてもう一度お試しください。',

    doneHeading: 'ありがとうございました',
    doneBody: '感想を受け取りました。掲載に同意いただいた場合は、掲載前に編集後の文面を必ずご確認いただきます。',
    backToApp: '5日間の設計図へ戻る'
  };

  /* 管理ページ（とーる専用） */
  SC.copy.voicesAdmin = {
    pageTitle: '5DAY モニター感想｜一覧',
    heading: 'モニター感想の一覧',
    keyLabel: '合言葉',
    keyPlaceholder: 'GASの setup で発行された32文字',
    keyNote: 'この端末にだけ記憶します。人に見せないでください。',
    loadLabel: '読み込む',
    clearKeyLabel: '合言葉を消す',
    loading: '読み込んでいます…',
    empty: 'まだ感想は届いていません。',
    error: '読み込めませんでした。合言葉を確認してください。',
    countTemplate: '{count}件',
    filterAll: 'すべて',
    filterPublishable: '掲載してよい人だけ',
    copyForLp: 'LP用にコピー',
    copied: 'コピーしました',
    openSheet: 'スプレッドシートを開く',
    reload: '再読み込み',
    labels: {
      monitor: 'モニターID',
      received: '受付',
      display: '表示名',
      publish: '掲載',
      title: '肩書き',
      photo: '写真',
      numbers: '数字',
      status: '状態',
      edited: '編集後の文面',
      rechecked: '再確認日',
      contact: '連絡先'
    }
  };
})(window);
