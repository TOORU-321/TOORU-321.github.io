/* 診断結果＋5日間チャレンジアプリ｜Phase1 プレビュー
 * config.js : アプリ全体の定数。保存キーの構成要素もここで一元管理する。
 * 正本: Notion「Claude Code実装依頼 v0.1｜Phase1・結果→DAY1」
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  SC.config = {
    /* 他アプリと保存キーが衝突しないための名前空間 */
    appId: 'lmine-shindan-challenge',
    /* チャレンジ体験のバージョン。状態スキーマを変えたら上げる */
    challengeVersion: 'phase1-v0.2',
    /* 保存フォーマットのバージョン。互換性が切れたら上げる（旧データは破棄して初期化） */
    storageVersion: 'v1',
    /* Phase1はプレビュー固定値。Phase2以降はURLパラメータ／LINE uidから受け取る */
    campaignId: 'preview-campaign',
    /* Phase1では本番送信しない。ローカルログのみ */
    trackingEnabled: false,
    /* 画面の並び（この順で進み、戻る） */
    screenOrder: [
      /* 結果 → 参加表明LP（lp.html）→ DAY1。LPは別ページなので画面順に含めない */
      'result',
      /* day1_intro は §41-C で追加した軽量な導入（参加表明 → 導入 → Screen C） */
      'day1_intro', 'day1_focus', 'day1_pause', 'day1_done',
      'day2_intro', 'day2_scene', 'day2_voice', 'day2_hope', 'day2_done',
      'day3_intro', 'day3_current', 'day3_wall', 'day3_first_change',
      'day3_destination', 'day3_role', 'day3_bridge', 'day3_done',
      'day4_intro', 'day4_entry', 'day4_relevance', 'day4_action',
      'day4_support', 'day4_order', 'day4_journey', 'day4_done',
      'day5_intro', 'day5_hypothesis', 'day5_weekly_action', 'day5_metric',
      'day5_schedule', 'day5_adjustment', 'day5_support', 'day5_experiment', 'day5_done'
    ],
    /* 一本線シートの構成要素（DAY2〜5を足すときはここに追記する） */
    blueprintSections: [
      { key: 'focusPoint', day: 1, label: '今直す場所' },
      { key: 'customerEmotion', day: 2, label: 'ひとりのお客様の感情' },
      { key: 'valueBridge', day: 3, label: '届けたい変化' },
      { key: 'journey', day: 4, label: 'SNSから支援までの一本道' },
      { key: 'thirtyDayPlan', day: 5, label: '30日間の育て方' }
    ],
    /* 毎日開きやすい時間 */
    reminderWindows: [
      { value: 'morning', label: '朝', time: '7:00〜9:00' },
      { value: 'noon', label: '昼', time: '12:00〜14:00' },
      { value: 'night', label: '夜', time: '19:00〜21:00' }
    ],
    defaultReminderWindow: 'night',
    /* DAY1後半「今週はいったん増やさないもの」 */
    pausedActions: [
      { value: 'post_frequency', label: '投稿回数だけ増やす' },
      { value: 'new_product', label: '新しい商品を追加する' },
      { value: 'new_sns', label: '別のSNSを始める' },
      { value: 'new_knowhow', label: 'また新しいノウハウを探す' },
      { value: 'fix_all', label: 'LP・LINE・商品を同時に直す' }
    ],
    defaultPausedAction: 'fix_all',
    /* DAY2の選択肢（§21-B｜2026-08-19 Codex／あかり確定）
       custom: true の項目を選んだときだけ自由入力欄を出す */
    day2Scenes: [
      { value: 'no_reaction', label: '投稿したのに反応がない' },
      { value: 'not_selling', label: '商品を案内したが売れない' },
      { value: 'no_result', label: '学んだ通りにやっても手応えがない' },
      { value: 'not_suited', label: '自分に向いていない気がする' },
      { value: 'custom', label: 'その他（自分の場面を書く）', custom: true }
    ],
    day2Voices: [
      { value: 'not_reaching', label: '「また届かなかった」' },
      { value: 'not_needed', label: '「私の商品って必要ないのかな」' },
      { value: 'what_to_believe', label: '「結局、何を信じればいいの」' },
      { value: 'easier_way', label: '「もう簡単な方法へ行こうかな」' },
      { value: 'custom', label: '自分の言葉で入力する', custom: true }
    ],
    day2Hopes: [
      { value: 'confidence', label: '自分の商品に自信を持ちたい' },
      { value: 'know_what_to_fix', label: '何を直せばよいか分かりたい' },
      { value: 'stable_sales', label: '売上の波を減らしたい' },
      { value: 'being_useful', label: '人の役に立っている実感がほしい' },
      { value: 'custom', label: '自分の言葉で入力する', custom: true }
    ],
    freeTextMaxLength: 120,
    /* 価値の橋（DAY3 Screen Q）だけは長めに書けるようにする（§23-D） */
    bridgeMaxLength: 300,
    /* 顧客導線（DAY4 Screen Y）（§26-B） */
    journeyMaxLength: 350,
    /* DAY4の選択肢（§26-B｜2026-08-21 Codex／あかり確定） */
    day4Entries: [
      { value: 'sns_post', label: 'SNSの投稿' },
      { value: 'search', label: '検索で見つかるコラムや記事' },
      { value: 'referral', label: '知人・お客様からの紹介' },
      { value: 'ads', label: '広告や告知' },
      { value: 'custom', label: '自分の言葉で入力する', custom: true }
    ],
    day4Relevance: [
      { value: 'diagnosis', label: '診断やチェックリスト' },
      { value: 'column', label: 'コラムや詳しい解説記事' },
      { value: 'video', label: '短い動画やミニ講座' },
      { value: 'story', label: '事例や変化のストーリー' },
      { value: 'custom', label: '自分の言葉で入力する', custom: true }
    ],
    day4Actions: [
      { value: 'answer_one', label: '質問に一つ答える' },
      { value: 'choose_one', label: '自分に合う選択肢を一つ選ぶ' },
      { value: 'small_work', label: '小さなワークを試す' },
      { value: 'save_result', label: '結果を保存し、あとで見返す' },
      { value: 'custom', label: '自分の言葉で入力する', custom: true }
    ],
    day4Supports: [
      { value: 'ondemand', label: '自分のペースで進める教材・オンデマンド講座' },
      { value: 'course', label: '正しい順番を学ぶ講座' },
      { value: 'consult', label: '状況を一緒に整理する個別相談' },
      { value: 'companion', label: '実装や改善を続ける伴走サポート' },
      { value: 'custom', label: '自分の言葉で入力する', custom: true }
    ],
    /* 真ん中の順番（§26-B Screen X）。ドラッグ操作は必須にしない */
    day4Orders: [
      { value: 'relevance_first', label: '理解してから試す' },
      { value: 'action_first', label: '試しながら理解する' }
    ],
    defaultDay4Order: 'relevance_first',
    /* 30日実験カード（DAY5 Screen AH）（§29-D） */
    experimentMaxLength: 500,
    /* DAY5の選択肢（§29-D｜2026-08-21 Codex／あかり確定）
       {entry}{relevance}{action}{support} はDAY4の4地点で埋める */
    day5Hypotheses: [
      { value: 'entry_to_relevance', label: '{entry}から{relevance}へ進む人がいるか' },
      { value: 'relevance_to_action', label: '{relevance}から{action}へ進む人がいるか' },
      { value: 'action_to_support', label: '{action}のあと、{support}を知りたい人がいるか' },
      { value: 'whole_path', label: '入口から支援まで、迷わず進める順番になっているか' },
      { value: 'custom', label: '自分の言葉で入力する', custom: true }
    ],
    day5WeeklyActions: [
      { value: 'deliver_entry', label: '入口となる投稿・記事・案内を一つ届ける' },
      { value: 'invite_experience', label: '今いるお客様やフォロワーへ、体験を一度案内する' },
      { value: 'small_work', label: '小さなワークや回答の機会を一度つくる' },
      { value: 'record_reaction', label: '届いた反応や質問を一つ記録する' },
      { value: 'custom', label: '自分の言葉で入力する', custom: true }
    ],
    day5Metrics: [
      { value: 'next_page', label: '入口から次のページへ進んだ数' },
      { value: 'completed_experience', label: '診断・動画・無料ワークを最後まで体験した数' },
      { value: 'small_move', label: '回答・保存・返信など、小さく動いた数' },
      { value: 'chose_support', label: '相談・申込み・購入など、支援を選んだ数' },
      { value: 'custom', label: '自分の言葉で入力する', custom: true }
    ],
    /* 振り返る曜日・時間帯（Screen AE）。時間帯は reminderWindows と同じ3区分を使う */
    day5ReviewDays: [
      { value: 'mon', label: '月曜日' },
      { value: 'tue', label: '火曜日' },
      { value: 'wed', label: '水曜日' },
      { value: 'thu', label: '木曜日' },
      { value: 'fri', label: '金曜日' },
      { value: 'sat', label: '土曜日' },
      { value: 'sun', label: '日曜日' }
    ],
    defaultDay5ReviewDay: 'mon',
    /* 希望者向けサポートの接続先（§36-4）。
     * ★正式なURL・講座名・価格が未確定のため、いずれも null のまま。
     *   null の間はユーザー画面にボタンを出さない（壊れたCTAを見せない）。
     *   確定したらここへ入れるだけで、画面側は変更不要。 */
    supportLinks: {
      self: null,      /* selfは商品ではなく、同じ画面の30日実験カードへ戻す */
      learn: null,     /* 無料解説動画のURL */
      consult: null    /* 個別相談ページのURL */
    },
    /* 最初に見直す場所（Screen AF）。1〜4はDAY4の4地点と対応する */
    day5AdjustmentPoints: [
      { value: 'entry', label: '気づく入口' },
      { value: 'relevance', label: '自分ごとになる体験' },
      { value: 'action', label: '小さく動く体験' },
      { value: 'support', label: '必要な支援' },
      { value: 'custom', label: '自分の言葉で入力する', custom: true }
    ],
    /* 30日実験の期間（§36-5）。DAY5完了時に再診断予定日を作るのに使う */
    experimentDays: 30,
    /* 進み方（Screen AG）。Phase1では商品リンクを出さず、選択だけ保存する */
    day5SupportModes: [
      { value: 'self', label: 'まずは自分で試し、振り返りたい' },
      { value: 'learn', label: '正しい順番を学びながら進めたい' },
      { value: 'consult', label: '実行後のずれを相談しながら直したい' }
    ],
    /* DAY3の選択肢（§23-D｜2026-08-20 Codex／あかり確定）
       custom: true の項目を選んだときだけ自由入力欄を出す */
    day3CurrentStates: [
      { value: 'no_reaction', label: '発信を続けても反応がなく、何を変えるべきか分からない' },
      { value: 'no_promise', label: '商品はあるが、誰に何を約束するか整理できていない' },
      { value: 'no_confidence', label: '案内しても売れず、商品に自信を持てない' },
      { value: 'no_fit', label: '学んだ方法を試しても、自分の事業につながらない' },
      { value: 'custom', label: '自分の言葉で入力する', custom: true }
    ],
    day3Walls: [
      { value: 'too_many', label: '直す場所が多く、優先順位を決められない' },
      { value: 'not_linked', label: 'お客様の悩みと商品内容が結びついていない' },
      { value: 'scattered', label: '発信・LINE・商品が別々で、次の一歩が見えない' },
      { value: 'no_review', label: '試した結果を、一人では振り返って修正しにくい' },
      { value: 'custom', label: '自分の言葉で入力する', custom: true }
    ],
    day3FirstChanges: [
      { value: 'one_focus', label: 'まず直す場所が一つに決まる' },
      { value: 'product_words', label: '誰のどんな悩みを扱う商品か言葉にできる' },
      { value: 'order_visible', label: '発信から商品までの順番が見える' },
      { value: 'next_fix', label: '試した結果を見て、次に直す場所を決められる' },
      { value: 'custom', label: '自分の言葉で入力する', custom: true }
    ],
    day3Destinations: [
      { value: 'confident_offer', label: '必要な人へ、自分の商品を自信を持って案内できる' },
      { value: 'stable', label: '発信と売上の波を小さくし、無理なく続けられる' },
      { value: 'connected', label: '投稿から相談・購入までが自然につながる' },
      { value: 'keep_improving', label: '一人で迷い続けず、実行と改善を続けられる' },
      { value: 'custom', label: '自分の言葉で入力する', custom: true }
    ],
    day3Roles: [
      { value: 'teach', label: '必要な知識や考え方を教える' },
      { value: 'organize', label: '状況と言葉を一緒に整理する' },
      { value: 'support', label: '手を動かすところまで支える' },
      { value: 'adjust', label: '実行後のずれを一緒に直す' },
      { value: 'custom', label: '自分の言葉で入力する', custom: true }
    ],
    /* スコアメーターの基準線 */
    scoreMarks: [
      { value: 40, label: '基準40' },
      { value: 60, label: '理想60' }
    ],
    axisMax: 20,
    totalMax: 100,
    /* 改善提案の刻み（診断ファネル 画面サンプル：最低軸を5点上げて10点を目指す＝総合47→52相当） */
    improvementStep: 5
  };

  /* 保存キー: アプリ名 : campaignId : anonymousDiagnosisId : version : 種別 */
  SC.config.storageKey = function (kind, anonymousDiagnosisId) {
    var c = SC.config;
    return [c.appId, c.campaignId, anonymousDiagnosisId || 'unknown', c.storageVersion, kind].join(':');
  };

  /* 「いま見せる診断結果はどれか」を指す目印（2026-08-31）。
   *
   * 診断ページと5DAY本体は、保存の名前空間を分けてある
   * （lmine-shindan-diagnosis と lmine-shindan-challenge）。
   * 混ざらないのは良いが、そのままでは5DAY側が診断結果を読めない。
   *
   * そこで診断側が「5DAYへ渡す形」に整えたものを5DAY側の名前空間へ置き、
   * どの診断IDを見ればよいかをこの目印で伝える。
   * こうすると5DAY本体は診断の内部構造を何も知らずに済む。 */
  SC.config.currentDiagnosisPointerKey = function () {
    var c = SC.config;
    return [c.appId, c.campaignId, c.storageVersion, 'current-diagnosis'].join(':');
  };
})(window);
