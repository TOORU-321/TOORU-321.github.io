/* diagnosis-v04.js : 診断設問のデータ正本（現在 v0.6）。
 *
 * 出典：Notion「🧭 診断設計書 v0.4｜感情曲線・短文化20問」
 *       https://app.notion.com/p/3bbe5e7c030781d0bb3ef453597b8448
 * 判断：Notion §41-B「条件付きで実装可能」（2026-08-23 Codex／あかり）
 *
 * ★2026-08-25（§51）：Q8をSNS投稿中心の言い方へ差し替え、version を 0.5 へ上げた。
 * ★2026-08-28（診断v0.6）：Q21（非加点）を追加し、診断名を変えた。version は 0.6。
 *   version が上がると、保存済みの回答は使わずに最初からやり直しになる（意図どおり）。
 *   ファイル名は据え置き（読み込み箇所が多いため）。中身の版は version を見ること。
 *
 * ここは「文言と数値の置き場」であり、判定ロジックは持たない（依頼4）。
 * 画面ファイルと採点関数へ、質問文・選択肢・境界値を直書きしないこと。
 *
 * ★「設問番号（no）」と「画面に出る順番」は別物。
 *   Q21 は番号こそ21だが、画面ではQ6の次（7問目）に出る。
 *   順番が要る処理は、必ず order／positionOf／nextNo／prevNo を通すこと。
 *   no へ 1 を足して次の設問を求めるような書き方をしない。
 *
 * ★ 校正前の開発版。設問の順番・質問文・選択肢・測定軸・配点は
 *   独自に変更しない。変更が要るときはCodex／あかりの判断を経て version を上げる。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  /* 5段階の感情曲線（v0.4 §3）。画面の進み具合の表示に使う。
   *
   * ここに並べた順番が、そのまま画面に出る順番になる。
   * Q21 は 2026-08-28 の判断で Phase2 の Q6 の次に置いた。
   * 最後に置かないのは、Q18〜Q20 の前向きな着地を保つため。 */
  var PHASES = [
    { no: 1, questions: [1, 2, 3, 4], title: 'これ、私のことだ' },
    { no: 2, questions: [5, 6, 21, 7, 8], title: '頑張っているのに、なぜ？' },
    { no: 3, questions: [9, 10, 11, 12], title: '能力不足だけが原因ではない' },
    { no: 4, questions: [13, 14, 15, 16], title: '直す場所が分かれば、まだいけそう' },
    { no: 5, questions: [17, 18, 19, 20], title: 'ちゃんと事業として育てたい' }
  ];

  /* 5択の種類（v0.4 §4）
   *   anchor    : 構造・行動アンカー型（採点15問）
   *   frequency : 頻度型（疲労・環境不一致）
   *   agreement : 同意型（責任感・継続意思・行動意思）
   */

  /* 非加点の内訳。scored:false の問がどの指標に属するか */
  /*   fatigue / environmentMismatch / businessFit */

  var QUESTIONS = [
    /* ---- Phase 1｜これ、私のことだ ---------------------------------- */
    {
      no: 1, phase: 1, kind: 'anchor', scored: true, axis: 'customerInsight',
      text: '投稿しても反応がなく、「どうせ今回も……」と思ってしまうとき。普段は？',
      options: [
        '投稿する前から少し諦めてしまう',
        '投稿回数や、使う型を変えたくなる',
        '過去に反応のあったテーマを探す',
        'DMや相談で出た言葉を見直す',
        '反応の違いを比べ、次の仮説を立てる'
      ],
      measure: '停滞時に、原因を露出量・流行だけでなく顧客反応まで戻して考えられるか。'
    },
    {
      no: 2, phase: 1, kind: 'anchor', scored: true, axis: 'salesJourney',
      text: 'プロフィールやLINEまでは見られるのに、「またここで止まった」と感じる。今の状態は？',
      options: [
        '投稿から相談・本命商品へ直接案内している',
        'LPやLINEはあるが、案内を並べている状態',
        '情報提供後の次の行動がいくつもある',
        '知る・理解する・試す・購入の順番がある',
        '止まる場所を数値で確認し、改善している'
      ],
      measure: '購入までの段階、次行動、離脱確認の有無。'
    },
    {
      no: 3, phase: 1, kind: 'anchor', scored: true, axis: 'productStructure',
      text: '商品を案内するとき、「これ、本当に今の人に必要かな」と自信が揺らぐ。近いのは？',
      options: [
        'まだ商品がない／案内したことがない',
        '不安になるほど、内容や特典を足している',
        '対象はいるが、変化を一言で言いにくい',
        '誰をどこまで変える商品か説明できる',
        '対象・変化・範囲・価格まで一貫している'
      ],
      measure: '商品が約束する変化と範囲の明確さ。'
    },
    {
      no: 4, phase: 1, kind: 'anchor', scored: true, axis: 'improvementOperation',
      text: '企画が売れないと、「私には向いてないのかも」と気持ちが折れそうになる。その後は？',
      options: [
        '別の方法へ移りたくなる',
        'タイミングが悪かったと思う',
        '数字を見るが、何を変えるかは決まらない',
        '止まった場所を一つだけ変えて試す',
        '仮説・数字・反応を残し、次へ反映する'
      ],
      measure: '失敗から自己否定や手法変更へ逃げず、小さな改善へ進めるか。'
    },

    /* ---- Phase 2｜頑張っているのに、なぜ？ ---------------------------- */
    {
      no: 5, phase: 2, kind: 'frequency', scored: false, indicator: 'fatigue',
      text: 'やることが増えすぎて、大事なことほど後回しになっている気がする。',
      options: [
        'ほとんどない',
        'あまりない',
        'ときどきある',
        'よくある',
        'ほぼいつもそう'
      ],
      measure: '3以上で「増やす前に減らす」。4は商品提案より負担削減を優先。'
    },
    {
      no: 6, phase: 2, kind: 'frequency', scored: false, indicator: 'environmentMismatch',
      text: '教わった通りにしているのに、進むほど自分の判断に自信がなくなる。',
      options: [
        '当てはまらない／今は相談相手がいない',
        '少し違和感がある',
        '自分への落とし込みで迷う',
        '話がかみ合わないことが多い',
        '続けるほど自信がなくなる'
      ],
      measure: '3以上で成長環境の補足を表示。ただし「今の環境を辞めるべき」と断定しない。'
    },
    {
      /* 2026-08-28 追加（とーる発案・Codex／あかり判断）。
       *
       * 番号は21だが、画面ではここ（Q6の次・7問目）に出る。
       * 総合点・5軸・最低軸・スコア帯・businessFit のいずれにも入れない。
       * 本人向けの結果画面にも出さない。回答値だけを内部の観察用に残す。
       *
       * ★この1問だけで「過信している」「根拠のない自信が強い」とは判断しない。
       *   閾値も high／low フラグも、いまは設けない。 */
      no: 21, phase: 2, kind: 'agreement', scored: false, indicator: 'confidenceEvidenceGap',
      text: 'うまくいく根拠をまだ具体的に説明できなくても、「自分ならきっとうまくいく」と感じることがあります。',
      options: [
        'そうは思わない',
        'あまり思わない',
        'どちらともいえない',
        'そう思う',
        '強くそう思う'
      ],
      measure: '成功見込みへの自己評価と、説明できる根拠との間にある差を観察する。総合点へは加算せず、本人向け結果には表示しない。'
    },
    {
      no: 7, phase: 2, kind: 'anchor', scored: true, axis: 'growthEnvironment',
      text: '「これで合っていますか？」と聞きたいのに、何をどう相談すればよいか分からない。普段は？',
      options: [
        '相談相手がいない／別の情報を探す',
        '疑問があっても、そのまま続ける',
        '違和感はあるが、言葉にできない',
        '目的・実行・結果を整理して聞く',
        'ズレと次の検証まで一緒に確認する'
      ],
      measure: '相談可能性と、相談前に状況を整理する力。'
    },
    {
      /* 2026-08-25（§51）差し替え。コラム・動画を前提にせず、
       * 投稿を続けている層へ寄せた。軸・配点・測るものは変えていない。 */
      no: 8, phase: 2, kind: 'anchor', scored: true, axis: 'salesJourney',
      text: '投稿を続けても、その場限りで流れていき、「頑張りが積み上がらない」と感じる。今の状態は？',
      options: [
        '投稿を、それぞれ単体で終わらせている',
        'プロフィールやLINEへリンクを集めている',
        '投稿から入口は作るが、どれも同じ案内につながる',
        '投稿テーマごとに、次に見せる内容が決まっている',
        '投稿から次の案内・再案内まで一覧で管理している'
      ],
      measure: '複数コンテンツ・媒体・商品の接続状態。'
    },

    /* ---- Phase 3｜能力不足だけが原因ではない -------------------------- */
    {
      no: 9, phase: 3, kind: 'anchor', scored: true, axis: 'customerInsight',
      text: '反応が弱いのは、発信力より「相手の悩みをつかみきれていないからかも」。今できているのは？',
      options: [
        '年齢・職業などで相手を想像している',
        '過去の自分を中心に考えている',
        'コメントやアンケートで悩みを集める',
        '困る場面と、そのときの気持ちまで聞く',
        '購入・見送り理由まで集め、更新している'
      ],
      measure: '属性から、場面・感情・購入理由まで顧客理解を深めているか。'
    },
    {
      no: 10, phase: 3, kind: 'anchor', scored: true, axis: 'productStructure',
      text: '売るのがしんどいのは、価値不足より「誰をどこまで助けるか」が曖昧だからかも。今の商品は？',
      options: [
        'まだ商品がない／内容が毎回変わる',
        '喜ばれそうな内容をできるだけ入れている',
        '範囲はあるが、追加対応が多い',
        '到達点と、対応する範囲が決まっている',
        '顧客の変化と自分の負担を両方見ている'
      ],
      measure: '提供範囲と持続可能性。'
    },
    {
      no: 11, phase: 3, kind: 'anchor', scored: true, axis: 'salesJourney',
      text: '「人が来ない」より、来た人が次へ進めないことが問題かも。今の導線は？',
      options: [
        '投稿を止めると、新しい動きも止まる',
        '過去投稿はあるが、見る順番は分かりにくい',
        '固定投稿・LP・LINEに情報は置いている',
        '初めての人が順番に理解できる導線がある',
        '常設導線を数値で見て、更新している'
      ],
      measure: '投稿へ依存しない常設性と改善状況。'
    },
    {
      no: 12, phase: 3, kind: 'anchor', scored: true, axis: 'improvementOperation',
      text: '一度の失敗より、「なぜ売れなかったかが残っていない」ことが怖い。振り返りは？',
      options: [
        '売上が落ちたときだけ行う',
        '気になった数字を、その都度見る',
        '月末に売上やフォロワー数を見る',
        '決めた日に数字と顧客反応を確認する',
        '続ける・やめる・一つ変えるを残す'
      ],
      measure: '定期的な振り返りを、具体的な意思決定までつなげているか。'
    },

    /* ---- Phase 4｜直す場所が分かれば、まだいけそう -------------------- */
    {
      no: 13, phase: 4, kind: 'anchor', scored: true, axis: 'customerInsight',
      text: '相談やDMで、「この言葉は刺さった」と感じた経験がある。普段どこまで活かせている？',
      options: [
        'その場で参考にする程度',
        '印象に残った言葉を思い出して使う',
        'よくある質問を発信テーマにしている',
        '困る場面と感情から発信を作っている',
        '選ぶ理由や購入後の変化までつなげている'
      ],
      measure: '顧客の言葉を、平常時の発信企画へ反映する力。'
    },
    {
      no: 14, phase: 4, kind: 'anchor', scored: true, axis: 'productStructure',
      text: '全部を作り直さなくても、「誰をどこまで」を整えれば商品はよくなりそう。商品同士の関係は？',
      options: [
        'まだ商品がない／一つだけある',
        '無料と有料の内容がほぼ同じ',
        '内容は違うが、次へ進む理由が弱い',
        '無料・入口・本命の役割が分かれている',
        '一つの変化から次の課題へ自然につながる'
      ],
      measure: '無料・入口・本命商品の役割と商品階段。'
    },
    {
      no: 15, phase: 4, kind: 'anchor', scored: true, axis: 'growthEnvironment',
      text: '正解を増やすより、「自分に必要か」を判断できるようになりたい。新しい情報が出たときは？',
      options: [
        '乗り遅れないよう、まず試す',
        '信頼する人のおすすめなら取り入れる',
        '情報は集めるが、必要か決めきれない',
        '今の課題を解決するかで小さく試す',
        '費用・時間・既存導線への影響まで見る'
      ],
      measure: '情報・ノウハウ・AIツールを目的基準で選別する力。'
    },
    {
      no: 16, phase: 4, kind: 'anchor', scored: true, axis: 'improvementOperation',
      text: '小さく直していけば、今までの経験も無駄ではないと思う。うまくいった企画は？',
      options: [
        '前回と同じ形で、もう一度行う',
        '今の流行に合わせて大きく変える',
        '前回の売上を基準に規模を増やす',
        '売れた入口や購入理由を確認する',
        '売れた条件を残し、一つずつ再検証する'
      ],
      measure: '成功条件の記録と再現性。'
    },

    /* ---- Phase 5｜ちゃんと事業として育てたい -------------------------- */
    {
      no: 17, phase: 5, kind: 'anchor', scored: true, axis: 'growthEnvironment',
      text: '誰かの答えを借りるより、理由を理解して自分で選べるようになりたい。助言を受けたときは？',
      options: [
        '別の人の方法も同時に試す',
        '詳しい人の助言なので、そのまま続ける',
        '違和感は伝えるが、感覚で終わる',
        'その方法が有効になる条件を確認する',
        '前提と自分の顧客を比べ、採否を決める'
      ],
      measure: '助言へ依存せず、自分の事業へ合わせて判断する力。'
    },
    {
      no: 18, phase: 5, kind: 'agreement', scored: false, indicator: 'businessFit',
      text: '売れれば終わりではなく、買ってくれた人の変化まで大切にしたい。',
      options: [
        'そうは思わない',
        'あまり思わない',
        'どちらともいえない',
        'そう思う',
        '強くそう思う'
      ],
      measure: '伴走支援との価値観適合。総合点へは加算しない。'
    },
    {
      no: 19, phase: 5, kind: 'agreement', scored: false, indicator: 'businessFit',
      text: '派手な近道より、必要なことを順番に整えて、自分の事業として育てたい。',
      options: [
        'そうは思わない',
        'あまり思わない',
        'どちらともいえない',
        'そう思う',
        '強くそう思う'
      ],
      measure: '地味な改善を続ける意思。総合点へは加算しない。'
    },
    {
      no: 20, phase: 5, kind: 'agreement', scored: false, indicator: 'businessFit',
      text: '今の自分に必要な順番が分かるなら、ひとつずつ試してみたい。',
      options: [
        'そうは思わない',
        'あまり思わない',
        'どちらともいえない',
        'そう思う',
        '強くそう思う'
      ],
      measure: '結果後の行動準備度。総合点へは加算しない。'
    }
  ];

  /* スコア帯（v0.4 §6）。境界値はここだけに置く。
   * meaning は v0.4 §12-4「v0.5で結果文を部品方式へ展開」のため未確定。
   * 未確定のあいだは画面に出さない（独自の説明文を作らない）。 */
  var SCORE_BANDS = [
    { key: 'band_0_29', min: 0, max: 29, range: '0〜29', label: '事業以前の整理ゾーン', meaning: null },
    { key: 'band_30_39', min: 30, max: 39, range: '30〜39', label: '土台形成ゾーン', meaning: null },
    { key: 'band_40_59', min: 40, max: 59, range: '40〜59', label: '成長準備ゾーン', meaning: null },
    { key: 'band_60_79', min: 60, max: 79, range: '60〜79', label: '持続成長ゾーン', meaning: null },
    { key: 'band_80_100', min: 80, max: 100, range: '80〜100', label: '拡張・最適化ゾーン', meaning: null }
  ];

  SC.diagnosisData = {
    /* 診断結果へ保存するバージョン。設問を直したら上げる（依頼4）。
     * 0.4 → 0.5：Q8の差し替え（2026-08-25 §51）
     * 0.5 → 0.6：Q21の追加と診断名の変更（2026-08-28）
     *
     * ★0.5で保存された回答は0.6へ移行しない。新しい診断として始め直す。 */
    version: '0.6',
    /* 参照した正本の版。校正記録の突き合わせに使う */
    sourceTitle: '診断設計書 v0.4｜感情曲線・短文化20問（Q8は§51で差し替え／Q21は2026-08-28に追加）',

    phases: PHASES,
    questions: QUESTIONS,
    scoreBands: SCORE_BANDS,

    /* --- 採点の数値仕様（v0.4 §6）。ロジックはここを読むだけにする ---- */
    scoring: {
      /* 選択肢1=0点 … 選択肢5=4点 */
      pointsPerOption: [0, 1, 2, 3, 4],
      questionMax: 4,
      /* 1軸あたりの採点問数 */
      questionsPerAxis: 3,
      /* 素点の満点（3問 × 4点） */
      axisRawMax: 12,
      /* 換算後の満点。素点 ÷ 12 × 20 を四捨五入 */
      axisMax: 20,
      totalMax: 100
    },

    /* 非加点6問（v0.4 §6 ＋ 2026-08-28 のQ21）。総合点へ加算しない */
    fatigue: {
      question: 5,
      /* 選択肢3以上（＝1始まりの選択番号）でフラグ */
      threshold: 3,
      /* 選択肢4以上は「商品提案より負担削減を優先」 */
      strongThreshold: 4
    },
    environmentMismatch: {
      question: 6,
      threshold: 3
    },
    businessFit: {
      questions: [18, 19, 20],
      /* 0〜12。総合点へ加算しない */
      max: 12,
      /* v0.4 §6：60〜79帯で8以上ならL-MINE2.0主提案候補。
       * 商品接続は未確定のため、判定値の保持だけ行い画面には出さない */
      candidateThreshold: 8
    },

    /* 説明できる根拠と、成功見込みへの自己評価との差（2026-08-28 追加）。
     *
     * 回答値をそのまま残すだけ。しきい値も high／low の区分も置かない。
     * 1問の答えから「過信している」と決めつけないための、意図的な空白。
     * 扱いを変えるときは、十分なデータをもとにCodex・あかりの判断を経ること。 */
    confidenceEvidenceGap: {
      question: 21
    },

    /* 最低軸が5点以下なら、総合点にかかわらず構造リスクを立てる（v0.4 §6） */
    structuralRisk: { axisThreshold: 5 },

    /* --- 同点最低軸の規則（依頼3）------------------------------------
     * ★未校正の暫定規則。実在事例5〜10名の二次校正で変更しうる。
     * 画面ロジックへ直接書かず、必ずこの配列を参照する。 */
    lowestAxisPriority: [
      'productStructure',
      'customerInsight',
      'salesJourney',
      'improvementOperation',
      'growthEnvironment'
    ],
    lowestAxisPriorityStatus: 'provisional_uncalibrated',

    /* 結果直前の心理接続（v0.4 §7）。この3文以外を出さない */
    scoringMessages: [
      '今ある強みを整理しています',
      '少し変えると伸びやすい場所を確認しています',
      'あなたの次の一歩を組み立てています'
    ],
    /* 1文あたりの表示時間（動きを減らす設定では待たせない） */
    scoringMessageMs: 1100,

    /* 採点中の段階表示（2026-08-24 とーる指示）。
     * 上の3文（v0.4 §7の正本）を必ず真ん中に置き、前後は事実の進み具合だけを足す。
     * done は語尾を「〜しました」へ変えただけで、意味は変えていない。
     * ★禁止表現（弱点を分析中／失敗原因を算出中／足りないものを探す）は使わない。
     * ★done文と前後2段階の文言は、Codex・あかりの確認待ち。 */
    scoringSteps: [
      { doing: '21問の回答を読み込んでいます', done: '21問の回答を読み込みました' },
      { doing: '今ある強みを整理しています', done: '今ある強みを整理しました' },
      { doing: '少し変えると伸びやすい場所を確認しています', done: '少し変えると伸びやすい場所を確認しました' },
      { doing: 'あなたの次の一歩を組み立てています', done: 'あなたの次の一歩を組み立てました' },
      /* 締めだけ、自然さを優先した言い方にする（2026-08-25 §51） */
      { doing: '結果を用意しています', done: 'あなたの診断結果がまとまりました' }
    ],
    /* 全体でこれくらい待たせる（ミリ秒） */
    scoringTotalMs: 5000,

    /* 結果画面の第一声（v0.4 §8）。点数の良し悪しではなく現在地を伝える */
    resultLead: 'お疲れさまでした。今の回答から、すでに持っている力と、少し整えるだけで変化が出やすい場所が見えてきました。',

    /* 引き当て用のヘルパー（データ側に置き、ロジック側で再実装しない） */
    questionByNo: function (no) {
      for (var i = 0; i < QUESTIONS.length; i++) {
        if (QUESTIONS[i].no === no) return QUESTIONS[i];
      }
      return null;
    },
    scoredQuestions: function () {
      return QUESTIONS.filter(function (q) { return q.scored; });
    },
    questionsOfAxis: function (axisKey) {
      return QUESTIONS.filter(function (q) { return q.scored && q.axis === axisKey; });
    },
    phaseOf: function (no) {
      for (var i = 0; i < PHASES.length; i++) {
        if (PHASES[i].questions.indexOf(no) !== -1) return PHASES[i];
      }
      return null;
    },
    bandOf: function (total) {
      for (var i = 0; i < SCORE_BANDS.length; i++) {
        if (total >= SCORE_BANDS[i].min && total <= SCORE_BANDS[i].max) return SCORE_BANDS[i];
      }
      return null;
    },

    /* --- 画面に出る順番（2026-08-28）---------------------------------------
     * 設問番号（no）と、画面に出る順番は別物。
     * Q21 は番号こそ21だが、7問目に出る。
     *
     * 順番が要る処理は、必ずここを通すこと。
     * no へ 1 を足して次の設問を求めると、Q6の次がQ7になって順番が崩れる。 */

    /* 画面に出る順番の設問番号一覧。[1,2,3,4,5,6,21,7,…,20] */
    order: function () {
      var out = [];
      PHASES.forEach(function (p) {
        p.questions.forEach(function (no) { out.push(no); });
      });
      return out;
    },

    /* その設問が何問目か。1始まり。無ければ0 */
    positionOf: function (no) {
      return SC.diagnosisData.order().indexOf(no) + 1;
    },

    /* 何問目かから設問番号を引く。1始まり。無ければnull */
    noAt: function (position) {
      var order = SC.diagnosisData.order();
      var i = position - 1;
      return (i >= 0 && i < order.length) ? order[i] : null;
    },

    /* 次／前の設問番号。端まで来たらnull */
    nextNo: function (no) {
      return SC.diagnosisData.noAt(SC.diagnosisData.positionOf(no) + 1);
    },
    prevNo: function (no) {
      var pos = SC.diagnosisData.positionOf(no);
      return pos > 1 ? SC.diagnosisData.noAt(pos - 1) : null;
    },

    /* 最初と最後の設問番号 */
    firstNo: function () { return SC.diagnosisData.noAt(1); },
    lastNo: function () { return SC.diagnosisData.noAt(QUESTIONS.length); }
  };
})(window);
