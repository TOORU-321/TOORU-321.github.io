/* config-endpoints.js : 外部へつなぐ先をまとめる場所
 *
 * ここ以外に外部URLを書かないこと。差し替えるときはこのファイルだけ直す。
 *
 * ★合言葉（管理ページのキー）は絶対にここへ書かないこと。
 *   管理ページを開いたときに入力してもらい、その端末にだけ覚えさせる。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  SC.endpoints = {
    /* モニター感想の受け取り（新規GAS・スタンドアロン）。
     * 送信＝POST、一覧取得＝GET（合言葉が必要）。
     * 既存のGASプロジェクトとは別物で、そちらには触れない。 */
    voices: 'https://script.google.com/macros/s/AKfycbxSCo5pmW4bjtOGhPN2evqjFX66MlOHLp5MvAzxoGx6KuF8WQfADF22Y5_2fzdSfNjinA/exec',

    /* 診断（21問）の保存と、uid ⇔ 匿名診断ID の結合（新規GAS・スタンドアロン）。
     * コード控え：tools/gas/diagnosis.gs.txt
     *
     * ★null のあいだは「開発モード」で動く。
     *   この端末の中だけで保存・結合を再現し、外部へは一切送らない。
     *   デプロイと本番接続はとーるの追加承認後（§41-J）。
     *   URLを入れるだけで通信モードへ切り替わる。画面側の変更は不要。
     *
     * 2026-08-24 デプロイ済み（バージョン1）。ここから通信モードで動く。
     * ★診断ページ・復元画面はまだ一般公開していない（公開物から除外される）。 */
    diagnosis: 'https://script.google.com/macros/s/AKfycbxB8ZFERP4cCcZTzc-RucwpEs9Y0HPCXUCxwZVcn-8iBGS4LMLEdt7ZZt2kylbioI3_bw/exec',

    /* LINE公式アカウントの友だち追加（プロライン発行・2026-09-01 とーる提供）。
     *
     * 診断結果の画面から、引き継ぎの準備ができた人だけをここへ送る。
     * ★準備できる前には出さない。キーを持たずに友だち追加へ行くと、
     *   LINE側で結果を引き継げなくなるため。
     *
     * 友だち追加のあとは、シナリオの1通目に置いた
     * 自作ページ転送URL（/cp/…?uid=[[uid]]）から restore.html へ戻ってくる。 */
    lineAddFriend: 'https://vjbsvali.autosns.app/addfriend/s/OJwYZlOe21/@956nvdmi'
  };
})(window);
