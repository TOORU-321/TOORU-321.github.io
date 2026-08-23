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
    voices: 'https://script.google.com/macros/s/AKfycbxSCo5pmW4bjtOGhPN2evqjFX66MlOHLp5MvAzxoGx6KuF8WQfADF22Y5_2fzdSfNjinA/exec'
  };
})(window);
