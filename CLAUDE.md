# CLAUDE.md

このリポジトリで作業する際の指示・メモ。

## セッション長期化の通知（重要）
会話が長く・重くなってきたと判断したら（やり取りが多い／大きな処理を何度も行った 等）、
作業の区切り（コミット・プッシュ済みの地点）で、こちらから
「新しいチャットに移ると軽くなります（トークン節約）」と提案する。
その際、続きをスムーズに再開できる短い引き継ぎメモも必ず添える。
※正確なトークン数は見えないため、判断は目安（ヒューリスティック）でよい。

## プロジェクト概要：コラム（columns.l-mine.com/columns/）
- このリポジトリは GitHub Pages で **`columns.l-mine.com`**（`CNAME`）として公開される静的サイト。
- **重要：各独立サイト/アプリは専用フォルダに隔離**し、リポジトリ直下（root）で他アプリと混ぜない。
  コラムは **`columns/` フォルダ**にまとまっている（root には置かない）。
- 公開URL：一覧＝**`https://columns.l-mine.com/columns/`**（＝`columns/index.html`）、各記事＝`columns/columnNN.html`。
- コラムは「**Markdown原稿 → 自動HTML生成**」方式：
  - 原稿：`src/columns/NN.md`（フロントマター ＋ 本文）
  - 生成器：`tools/build_columns.py` → `python tools/build_columns.py` で
    `columns/columnNN.html`（各記事）と `columns/index.html`＋`columns/columns-N.html`（一覧・ページ送り）を生成
  - 共有CSS：`columns/assets/column.css`／画像：`columns/assets/columnNN-hero.jpg` 等
  - 一覧1ページ目は **`index.html`**、2ページ目以降が `columns-2.html`〜。**日付の新しい順・12本/ページ**。**画像が無いコラムは枠なし・本文のみ**で表示。
- 本文の書式ルール（src原稿）：
  - 空行＝まとまり（段落）区切り／段落内の改行は `<br>` 化
  - `## 見出し`／`***`＝区切り（✦）／`**強調**`／`- `箇条書き
  - `↓` を含む塊＝フロー図／`**STEP n：…**`＝STEP見出し
- 既存20ページ（リポジトリ直下の `*.html`：タマゴヤキ等）は **触らない**（URL不変）。

## コラム更新ワークフロー（重要）
ユーザーが新チャットで「**コラム更新して**」と原稿を渡したら、以下の作法で進める（指示文の貼り付け不要）。
- **原稿元**：Notion「独自サイトプロジェクト > コラム」配下のストック、または貼り付けされた Markdown。
- **手順**：原稿を `src/columns/NN.md` に整える → `python tools/build_columns.py` で生成 → **生成結果を見せて確認** → OKで main に反映（公開）。
- **1本ずつ**進める。**公開前に必ず確認を取る**。勝手に複数本を一気に公開しない。
- **番号採番**：既存の最大番号の続き（max+1）。ストック側に指定番号があればそれを優先。
- **本文ルール**：上記「本文の書式ルール」に従う。加えて：
  - フロントマター：`number / title / date / date_disp / category / tags / excerpt / sign`。**Act回**は `series: Act` と `series_no: N` を付ける。
  - メルマガ/オプトインの案内は集約LP（`https://l-mine.com/business/the-3-2-1-lab`）へ。ポップアップ前提の誘導は `[準備中]` マーカーにして LPリンク化。
  - 他コラム参照（`#NN` / `#コラムNN`）・本文中URLは自動でリンク化される（そのまま書く）。
  - 画像が無いコラムは画像なし・本文のみ（一覧でも枠を作らない）。
- **デプロイ**：管理プロキシは読み取り専用。`github.com` へ **PAT で push**（PATは Notion「🏛 WEBアプリ開発プロジェクト」ページに保管）。必ず**最新 main を基点**にし、**コラム関連ファイルのみ**を push（他アプリ・root既存HTMLは触らない）。複数チャットが並行作業しているため、push前に `git fetch origin main` で最新を確認すること。

## 画像
- 画像処理は Pillow を使用（`pip install Pillow` 済みでなければ導入）。Web用に長辺〜1360px・JPEG q85 程度へ圧縮してから配置。
- 元画像は Google Drive の「画像」フォルダ等にある。大きすぎる画像（8MB超）はコネクタ転送上限で取得できないことがある。

## 連携
- **Notion** / **Google Drive** 連携あり。コラム原稿・画像の元ネタはここから取得する。
- メルマガ等のオプトインはコネクティッドワン機能で、GitHub側ではリンク不可（将来 簡易LP で代替予定）。

## Git
- 開発ブランチ：`claude/hopeful-knuth-2xWxq`（指定ブランチ以外へは push しない）。
