/* result-type-image.js : 最低軸のイメージイラストを置く共通部品
 *
 * 画面側は SC.ui.resultTypeImage(最低軸キー) を呼ぶだけにする。
 * 5軸の条件分岐は data/result-type-images.js に閉じてある。
 *
 * 並び（2026-08-24 Codex・あかり確定）
 *   一言「まずは『◯◯』から」→ 補助文 → イラスト
 *   軸名は画像へ焼き込まず、HTMLの文字として左上の余白へ重ねる。
 *
 * ・知らないキー・未指定なら null を返す（画面は壊れない）
 * ・width / height を入れてあるので、読み込み前でも高さが確保されレイアウトが動かない
 * ・意味のある結果画像なので alt は空にしない
 * ・説明の代わりではなく、理解を助ける補助として置く
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;

  /* opts:
   *   caption : 一言を添えるか（既定 true）
   *   note    : 補助文を添えるか（既定 true）
   *   badge   : 画像へ軸名を重ねるか（既定 true）
   *   loading : 'lazy'（既定）／'eager'。ファーストビューに入る位置なら 'eager'
   *   variant : 見た目の変種（'compact' など）
   */
  SC.ui.resultTypeImage = function (axisKey, opts) {
    opts = opts || {};
    if (!SC.resultTypeImages) return null;

    var item = SC.resultTypeImages.get(axisKey);
    if (!item) return null;

    var eager = opts.loading === 'eager';

    var img = h('img', {
      class: 'rti__img',
      src: item.src,
      alt: item.alt,
      width: String(item.width),
      height: String(item.height),
      loading: eager ? 'eager' : 'lazy',
      decoding: 'async',
      fetchpriority: eager ? 'high' : 'low'
    });

    /* 軸名は画像の左上の余白へ重ねる。文字は画像に焼き込まない。
     * 下に薄い影を敷いて、絵柄が明るくても読めるようにする。 */
    var badge = opts.badge === false
      ? null
      : h('span', { class: 'rti__badge', 'aria-hidden': 'true', text: item.label });

    var head = (opts.caption === false && opts.note === false)
      ? null
      : h('figcaption', { class: 'rti__head' }, [
          opts.caption === false
            ? null
            : h('p', { class: 'rti__caption', text: item.caption }),
          opts.note === false
            ? null
            : h('p', { class: 'rti__note', text: SC.resultTypeImages.note })
        ]);

    var figure = h('figure', {
      class: 'rti' + (opts.variant ? ' rti--' + opts.variant : ''),
      dataset: { axis: item.axis }
    }, [
      head,
      h('div', { class: 'rti__frame' }, [img, badge])
    ]);

    /* 読み込めなかったときは、枠ごと消す。
     * 壊れた画像アイコンを出すより、無いほうが結果本文の邪魔にならない。 */
    img.addEventListener('error', function () {
      if (figure.parentNode) figure.parentNode.removeChild(figure);
    });

    return figure;
  };
})(window);
