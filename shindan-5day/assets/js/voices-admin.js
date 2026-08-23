/* voices-admin.js : モニター感想の一覧（とーる専用）
 *
 * ・合言葉はコードに書かない。開いたときに入力してもらい、この端末にだけ覚えさせる
 * ・スクリーンショットしやすいカード表示
 * ・LPへ貼りやすい形にコピーできる（掲載同意のある人だけ）
 * ・編集後の文面と再確認日はスプレッドシート側で運用し、ここでは表示だけする
 */
(function (global) {
  'use strict';
  var SC = global.SC;
  var doc = global.document;
  var h = SC.dom.h;

  var c = SC.copy.voicesAdmin;
  var KEY_STORE = 'sc_voices_admin_key';

  var state = { items: [], onlyPublishable: false };

  function el(id) { return doc.getElementById(id); }

  function savedKey() {
    try { return global.localStorage.getItem(KEY_STORE) || ''; } catch (e) { return ''; }
  }
  function storeKey(v) {
    try { global.localStorage.setItem(KEY_STORE, v); } catch (e) { /* 保存できなくても動く */ }
  }
  function forgetKey() {
    try { global.localStorage.removeItem(KEY_STORE); } catch (e) { /* noop */ }
  }

  function setStatus(text) {
    var s = el('admin-status');
    s.textContent = text || '';
  }

  /* 掲載してよい人か */
  function publishable(item) {
    return item['掲載同意'] === 'はい';
  }

  /* 表示名の決め方。同意の範囲を超えないようにする */
  function displayName(item) {
    var type = item['表示名の希望'];
    var name = (item['表示名'] || '').trim();
    if (type === '実名' && name) return name;
    if (type === 'イニシャル' && name) return name;
    return '匿名';
  }

  /* LPへ貼るときの形。載せてよいものだけを含める */
  function lpText(item) {
    var lines = [];
    lines.push((item['編集後の文面'] || item['感想の原文'] || '').trim());
    var who = displayName(item);
    if (item['肩書きの掲載'] === '可' && item['備考']) who += '（' + item['備考'] + '）';
    lines.push('— ' + who + ' 様');
    return lines.join('\n\n');
  }

  function tag(label, ok) {
    return h('span', { class: 'vitem__tag' + (ok ? '' : ' vitem__tag--ng'), text: label + (ok ? '：可' : '：不可') });
  }

  function card(item) {
    var canPublish = publishable(item);
    var body = (item['感想の原文'] || '').trim();
    var edited = (item['編集後の文面'] || '').trim();

    var copyBtn = h('button', {
      type: 'button', class: 'btn btn--secondary',
      text: c.copyForLp,
      on: {
        click: function () {
          var text = lpText(item);
          if (global.navigator.clipboard && global.navigator.clipboard.writeText) {
            global.navigator.clipboard.writeText(text).then(function () {
              copyBtn.textContent = c.copied;
              global.setTimeout(function () { copyBtn.textContent = c.copyForLp; }, 1600);
            });
          }
        }
      }
    });

    return h('article', { class: 'vitem' + (canPublish ? '' : ' vitem--no-publish') }, [
      h('p', { class: 'vitem__meta' }, [
        h('span', { text: c.labels.received + '：' + (item['受付日時'] || '') }),
        h('span', { text: c.labels.monitor + '：' + (item['モニターID'] || '—') }),
        h('span', { class: 'vitem__name', text: c.labels.display + '：' + displayName(item) }),
        h('span', { class: 'vitem__tag' + (canPublish ? '' : ' vitem__tag--ng'),
          text: canPublish ? '掲載してよい' : '掲載しない' }),
        item['掲載状態'] ? h('span', { text: c.labels.status + '：' + item['掲載状態'] }) : null
      ]),

      h('p', { class: 'vitem__body', text: body }),

      edited ? h('p', { class: 'vitem__edited', text: edited }) : null,
      item['再確認日'] ? h('p', { class: 'vitem__meta', text: c.labels.rechecked + '：' + item['再確認日'] }) : null,

      h('div', { class: 'vitem__foot' }, [
        tag(c.labels.title, item['肩書きの掲載'] === '可'),
        tag(c.labels.photo, item['写真の掲載'] === '可'),
        tag(c.labels.numbers, item['成果数字の掲載'] === '可'),
        item['連絡先'] ? h('span', { class: 'vitem__meta', text: c.labels.contact + '：' + item['連絡先'] }) : null,
        canPublish ? copyBtn : null
      ])
    ]);
  }

  function render() {
    var list = el('admin-list');
    SC.dom.clear(list);

    var items = state.onlyPublishable
      ? state.items.filter(publishable)
      : state.items;

    el('admin-count').textContent = c.countTemplate.replace('{count}', String(items.length));

    if (!items.length) {
      list.appendChild(h('p', { class: 'vadmin__status', text: c.empty }));
      return;
    }
    items.forEach(function (item) { list.appendChild(card(item)); });
  }

  function load(key) {
    if (!key) return;
    setStatus(c.loading);
    var url = SC.endpoints.voices + '?key=' + encodeURIComponent(key);
    global.fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || !res.ok) throw new Error((res && res.error) || 'failed');
        state.items = res.items || [];
        storeKey(key);
        setStatus('');
        render();
      })
      .catch(function () {
        setStatus(c.error);
      });
  }

  function boot() {
    doc.title = c.pageTitle;
    el('admin-heading').textContent = c.heading;
    el('admin-key-label').textContent = c.keyLabel;
    el('admin-key').setAttribute('placeholder', c.keyPlaceholder);
    el('admin-key-note').textContent = c.keyNote;
    el('admin-load').textContent = c.loadLabel;
    el('admin-forget').textContent = c.clearKeyLabel;
    el('admin-reload').textContent = c.reload;

    var filterBtn = el('admin-filter');
    function syncFilter() {
      filterBtn.textContent = state.onlyPublishable ? c.filterAll : c.filterPublishable;
      filterBtn.setAttribute('aria-pressed', state.onlyPublishable ? 'true' : 'false');
    }
    syncFilter();

    filterBtn.addEventListener('click', function () {
      state.onlyPublishable = !state.onlyPublishable;
      syncFilter();
      render();
    });

    el('admin-load').addEventListener('click', function () {
      load(el('admin-key').value.trim());
    });
    el('admin-reload').addEventListener('click', function () {
      load(el('admin-key').value.trim() || savedKey());
    });
    el('admin-forget').addEventListener('click', function () {
      forgetKey();
      el('admin-key').value = '';
      state.items = [];
      render();
      setStatus('');
    });

    /* 前に入れた合言葉があれば、そのまま読み込む */
    var key = savedKey();
    if (key) {
      el('admin-key').value = key;
      load(key);
    } else {
      render();
    }
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
