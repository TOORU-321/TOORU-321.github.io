/* radar-chart.js : 5軸レーダーチャート（共通UI部品）
 * 目的：数値の羅列ではなく「かたちのいびつさ」を一目で感じてもらう。
 *       出典：Notion「診断ファネル｜SNS事業の現在地診断」§結果画面 3・7
 *       （5軸のレーダーチャート／改善前後のレーダーを重ねて表示）
 * ラベルはSVGの外（HTML）に置く。SVG内テキストはviewBoxの拡大縮小で
 * 実寸が14pxを下回るため、本文14px未満にしない条件を満たせなくなる。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;
  var s = SC.dom.svg;

  var SIZE = 200;          /* viewBox の一辺 */
  var C = SIZE / 2;        /* 中心 */
  var R = 84;              /* 外周（20点）の半径 */
  var RINGS = [0.25, 0.5, 0.75, 1];

  /* i番目の軸の角度（真上から時計回り） */
  function angle(i, total) {
    return (-90 + (360 / total) * i) * Math.PI / 180;
  }

  function point(i, total, ratio) {
    var a = angle(i, total);
    return {
      x: C + R * ratio * Math.cos(a),
      y: C + R * ratio * Math.sin(a)
    };
  }

  function polygonPoints(values, max) {
    return values.map(function (v, i) {
      var p = point(i, values.length, Math.max(0, Math.min(1, v / max)));
      return p.x.toFixed(1) + ',' + p.y.toFixed(1);
    }).join(' ');
  }

  /* ラベルは plot ボックスに対する％で置く（はみ出しは外側の余白で受ける） */
  function labelPosition(i, total) {
    var a = angle(i, total);
    return {
      left: (50 + 50 * Math.cos(a)).toFixed(2) + '%',
      top: (50 + 50 * Math.sin(a)).toFixed(2) + '%'
    };
  }

  /* opts:
   *   axes         : [{key,label}]（既定は SC.axes）
   *   scores       : {key: 点数}
   *   max          : 1軸の満点
   *   lowestAxis   : 強調する軸のキー
   *   improved     : {key: 点数}（点線で重ねる改善後のかたち。省略可）
   *   animate      : 導入アニメーションを再生するか
   *   describedBy  : 補足テキストのid（省略可）
   */
  SC.ui.radarChart = function (opts) {
    var axes = opts.axes || SC.axes;
    var max = opts.max || SC.config.axisMax;
    var total = axes.length;
    var values = axes.map(function (a) { return opts.scores[a.key] || 0; });

    /* 読み上げ用の説明文（色・かたちだけに頼らない） */
    var summary = axes.map(function (a, i) {
      return a.label + ' ' + values[i] + '点';
    }).join('、');

    var grid = RINGS.map(function (ratio) {
      return s('polygon', {
        class: 'radar__ring',
        points: axes.map(function (a, i) {
          var p = point(i, total, ratio);
          return p.x.toFixed(1) + ',' + p.y.toFixed(1);
        }).join(' ')
      });
    });

    var spokes = axes.map(function (a, i) {
      var p = point(i, total, 1);
      return s('line', { class: 'radar__spoke', x1: C, y1: C, x2: p.x.toFixed(1), y2: p.y.toFixed(1) });
    });

    var children = [
      s('g', { class: 'radar__grid' }, grid.concat(spokes))
    ];

    /* 改善後のかたち（点線） */
    if (opts.improved) {
      var improvedValues = axes.map(function (a) { return opts.improved[a.key] || 0; });
      children.push(s('polygon', {
        class: 'radar__improved',
        points: polygonPoints(improvedValues, max)
      }));
      /* 改善後の到達点を、線種の違う丸で示す */
      axes.forEach(function (a, i) {
        if (improvedValues[i] === values[i]) return;
        var p = point(i, total, improvedValues[i] / max);
        children.push(s('circle', {
          class: 'radar__target', cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: 5
        }));
      });
    }

    /* 現在のかたち */
    var shape = [
      s('polygon', { class: 'radar__area', points: polygonPoints(values, max) })
    ];
    axes.forEach(function (a, i) {
      var p = point(i, total, values[i] / max);
      var isLowest = opts.lowestAxis === a.key;
      shape.push(s('circle', {
        class: 'radar__dot' + (isLowest ? ' radar__dot--lowest' : ''),
        cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: isLowest ? 5 : 3.5
      }));
      if (isLowest) {
        shape.push(s('circle', {
          class: 'radar__pulse', cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: 5,
          /* transform の基点を頂点に置く（SVGのrをCSSで動かすより互換性が高い） */
          style: 'transform-origin:' + p.x.toFixed(1) + 'px ' + p.y.toFixed(1) + 'px'
        }));
      }
    });
    children.push(s('g', { class: 'radar__shape' }, shape));

    var svgEl = s('svg', {
      class: 'radar__svg',
      viewBox: '0 0 ' + SIZE + ' ' + SIZE,
      role: 'img',
      'aria-label': '5軸のかたち：' + summary
    }, children);

    var labels = axes.map(function (a, i) {
      var pos = labelPosition(i, total);
      return h('span', {
        class: 'radar__label radar__label--' + i + (opts.lowestAxis === a.key ? ' is-lowest' : ''),
        style: 'left:' + pos.left + ';top:' + pos.top,
        text: a.label
      });
    });

    return h('div', {
      class: 'radar' + (opts.animate ? ' is-intro' : '')
    }, [
      h('div', { class: 'radar__plot' }, [svgEl].concat(labels))
    ]);
  };

  /* 最低軸だけを step 点引き上げた「改善後」のスコアを作る */
  SC.ui.improvedScores = function (scores, axisKey, step, max) {
    var out = {};
    for (var k in scores) {
      if (Object.prototype.hasOwnProperty.call(scores, k)) out[k] = scores[k];
    }
    out[axisKey] = Math.min(max, (scores[axisKey] || 0) + step);
    return out;
  };

  SC.ui.totalOf = function (scores) {
    var sum = 0;
    SC.axes.forEach(function (a) { sum += scores[a.key] || 0; });
    return sum;
  };
})(window);
