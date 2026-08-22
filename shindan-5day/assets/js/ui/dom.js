/* dom.js : 最小のDOMヘルパー。innerHTMLは使わない（文言は必ずtextContent経由）。 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var doc = global.document;

  function append(el, children) {
    if (children === null || children === undefined || children === false) return;
    if (Object.prototype.toString.call(children) === '[object Array]') {
      children.forEach(function (c) { append(el, c); });
      return;
    }
    if (typeof children === 'string' || typeof children === 'number') {
      el.appendChild(doc.createTextNode(String(children)));
      return;
    }
    el.appendChild(children);
  }

  function h(tag, props, children) {
    var el = doc.createElement(tag);
    props = props || {};
    for (var k in props) {
      if (!Object.prototype.hasOwnProperty.call(props, k)) continue;
      var v = props[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'on') { for (var ev in v) el.addEventListener(ev, v[ev]); }
      else if (k === 'dataset') { for (var dk in v) el.setAttribute('data-' + dk, v[dk]); }
      else el.setAttribute(k, v === true ? '' : v);
    }
    append(el, children);
    return el;
  }

  /* 改行入りの文言を段落に分ける */
  function lines(text, className) {
    return String(text).split('\n').map(function (line) {
      return h('p', { class: className || 'lead-line', text: line });
    });
  }

  /* 本文を句点で1文ずつに分ける。文章そのものは変えない（区切る位置を返すだけ） */
  function splitSentences(text) {
    return String(text)
      .split('。')
      .map(function (t) { return t.trim(); })
      .filter(function (t) { return t !== ''; })
      .map(function (t) { return t + '。'; });
  }

  /* 長い本文を句点で段落に分ける。文章そのものは変えない（改行位置だけ増やす） */
  function sentences(text, className) {
    return splitSentences(text).map(function (t) {
      return h('p', { class: className || 'sentence', text: t });
    });
  }

  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  /* SVG用。属性はそのまま setAttribute する（createElementNS が必要なため h とは別にする） */
  var SVG_NS = 'http://www.w3.org/2000/svg';
  function svg(tag, props, children) {
    var el = doc.createElementNS(SVG_NS, tag);
    props = props || {};
    for (var k in props) {
      if (!Object.prototype.hasOwnProperty.call(props, k)) continue;
      var v = props[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    append(el, children);
    return el;
  }

  SC.dom = {
    h: h, svg: svg, lines: lines,
    sentences: sentences, splitSentences: splitSentences,
    clear: clear, append: append
  };
})(window);
