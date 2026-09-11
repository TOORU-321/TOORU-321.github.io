/* admin.js : 進み具合の一覧（とーる専用）
 *
 * 「誰がどこまで進んだか」「どんな結果だったか」を、スプレッドシートから読んで並べる。
 *
 * ・合言葉はコードに書かない。開いたときに入れてもらい、この端末にだけ覚えさせる
 * ・名前は持っていない。分かるのは匿名診断IDとLINEの識別子（uid）まで
 * ・書いた中身（一本線・回答）は、その人を開いたときにだけ取りに行く
 *   （一覧に全員ぶんを持ってこない。見るつもりのないものを画面に置かないため）
 */
(function (global) {
  'use strict';
  var SC = global.SC;
  var doc = global.document;
  var h = SC.dom.h;
  var c = SC.adminCopy;

  var KEY_STORE = 'sc_admin_key';
  var STALL_DAYS = 3;

  var state = { rows: [], summary: null, total: 0, filter: 'all', loaded: false };

  function el(id) { return doc.getElementById(id); }

  /* 軸のキー（productStructure など）を、画面の言葉へ */
  function axisLabel(key) {
    if (!key) return '';
    var list = SC.axes || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].key === key) return list[i].label;
    }
    return key;
  }

  function savedKey() {
    try { return global.localStorage.getItem(KEY_STORE) || ''; } catch (e) { return ''; }
  }
  function storeKey(v) {
    try { global.localStorage.setItem(KEY_STORE, v); } catch (e) { /* 保存できなくても動く */ }
  }
  function forgetKey() {
    try { global.localStorage.removeItem(KEY_STORE); } catch (e) { /* noop */ }
  }

  function setStatus(text) { el('admin-status').textContent = text || ''; }

  function currentKey() {
    return (el('admin-key').value || '').trim() || savedKey();
  }

  /* 日時は「9/10 14:03」の形にする。年は今年なら省く */
  function shortTime(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    var now = new Date();
    var head = (d.getFullYear() === now.getFullYear() ? '' : d.getFullYear() + '/');
    return head + (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
      d.getHours() + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  function daysSince(iso) {
    if (!iso) return null;
    var t = new Date(iso).getTime();
    if (!t || isNaN(t)) return null;
    return Math.floor((Date.now() - t) / 86400000);
  }

  /* 参加したのに、しばらくさわっていない人 */
  function stalled(row) {
    if (row.participation !== 'joined' || row.day5At) return false;
    var d = daysSince(row.updatedAt || row.at);
    return d !== null && d >= STALL_DAYS;
  }

  function visibleRows() {
    if (state.filter === 'joined') {
      return state.rows.filter(function (r) { return r.participation === 'joined'; });
    }
    if (state.filter === 'completed') {
      return state.rows.filter(function (r) { return !!r.day5At; });
    }
    if (state.filter === 'stalled') return state.rows.filter(stalled);
    return state.rows;
  }

  /* --- まとめ --------------------------------------------------------- */
  function summaryBlock() {
    var s = state.summary;
    if (!s) return null;
    var t = c.summary;

    function stat(label, value) {
      return h('div', { class: 'adm-stat' }, [
        h('span', { class: 'adm-stat__num', text: String(value) + t.unit }),
        h('span', { class: 'adm-stat__label', text: label })
      ]);
    }

    var bars = [1, 2, 3, 4, 5].map(function (d) {
      var n = (s.day && s.day[d]) || 0;
      var base = s.joined || s.diagnoses || 1;
      var pct = Math.max(0, Math.min(100, Math.round((n / base) * 100)));
      return h('div', { class: 'adm-bar' }, [
        h('span', { class: 'adm-bar__label', text: t.dayLabel.replace('{day}', String(d)) }),
        h('span', { class: 'adm-bar__track' }, [
          h('span', { class: 'adm-bar__fill', style: 'width:' + pct + '%' })
        ]),
        h('span', { class: 'adm-bar__num', text: String(n) })
      ]);
    });

    return h('section', { class: 'adm-summary' }, [
      h('div', { class: 'adm-stats' }, [
        stat(t.diagnoses, s.diagnoses),
        /* 受け直した人がいると、回数と人数がずれる。ずれたときだけ出す（2026-09-11） */
        (s.people && s.people !== s.diagnoses) ? stat(t.people, s.people) : null,
        stat(t.linked, s.linked),
        stat(t.joined, s.joined),
        stat(t.completed, s.completed)
      ]),
      h('h2', { class: 'adm-subhead', text: t.dayHeading }),
      h('div', { class: 'adm-bars' }, bars)
    ]);
  }

  /* --- 一覧の1件 ------------------------------------------------------ */
  function dayDots(row) {
    return h('span', { class: 'adm-dots' }, [1, 2, 3, 4, 5].map(function (d) {
      var done = row.days && row.days.indexOf(String(d)) > -1;
      return h('span', {
        class: 'adm-dot' + (done ? ' adm-dot--on' : ''),
        title: c.summary.dayLabel.replace('{day}', String(d))
      }, String(d));
    }));
  }

  function rowCard(row) {
    var badge = row.day5At ? c.row.completed
      : (row.participation === 'joined' ? c.row.joined : c.row.noJoin);

    return h('article', {
      class: 'adm-row' + (stalled(row) ? ' adm-row--stalled' : ''),
      on: { click: function () { openDetail(row); } }
    }, [
      /* LINEの表示名（2026-09-11 とーる指示）。
       * プロラインの友だち一覧と同じ名前なので、そのまま突き合わせられる。
       * ★ここ以外には出さない（計測・コンソールへは渡していない）。 */
      h('div', { class: 'adm-row__name' + (row.name ? '' : ' is-missing'),
                 text: row.name || c.row.noName }),

      h('div', { class: 'adm-row__head' }, [
        h('span', { class: 'adm-row__score', text: String(row.score) + c.row.score }),
        h('span', { class: 'adm-row__band', text: row.band || '' }),
        /* 同じ方の2回目以降だけ、回数を出す（2026-09-11 とーる指示）。
         * 受け直した人の行が「別の人」に見えないようにするため。 */
        row.nth > 1
          ? h('span', { class: 'adm-row__repeat',
                        text: c.row.repeat.replace('{n}', String(row.nth)) })
          : null,
        h('span', { class: 'adm-row__badge', text: badge })
      ]),
      h('div', { class: 'adm-row__mid' }, [
        dayDots(row),
        h('span', { class: 'adm-row__axis', text: axisLabel(row.lowestAxis) })
      ]),
      h('div', { class: 'adm-row__foot' }, [
        h('span', { text: c.row.lastAt + '：' + shortTime(row.updatedAt || row.at) }),
        h('span', { class: 'adm-row__uid', text: row.uid ? c.row.uid : c.row.noUid }),
        h('span', { class: 'adm-row__open', text: c.row.openDetail })
      ])
    ]);
  }

  /* --- 詳細 ----------------------------------------------------------- */
  function openDetail(row) {
    var box = el('admin-detail');
    SC.dom.clear(box);
    box.hidden = false;
    box.appendChild(h('p', { class: 'adm-status', text: c.detail.loading }));

    post({ action: 'admin_detail', key: currentKey(), id: row.id })
      .then(function (res) {
        SC.dom.clear(box);
        if (!res || !res.ok) {
          box.appendChild(h('p', { class: 'adm-status', text: c.error }));
          return;
        }
        renderDetail(box, row, res);
      })
      ['catch'](function () {
        SC.dom.clear(box);
        box.appendChild(h('p', { class: 'adm-status', text: c.errorNetwork }));
      });
  }

  function renderDetail(box, row, res) {
    var d = c.detail;
    var lines = [];

    var blueprint = (res.blueprint || '').trim();
    var answers = res.challenge || null;

    function section(title, children) {
      return h('section', { class: 'adm-detail__sec' }, [
        h('h3', { class: 'adm-subhead', text: title })
      ].concat(children));
    }

    /* 一本線 */
    var bpNode = blueprint
      ? h('p', { class: 'adm-detail__body', text: blueprint })
      : h('p', { class: 'adm-status', text: d.none });
    if (blueprint) lines.push(blueprint);

    /* 診断の内訳 */
    var r = res.result;
    var diagNodes = [];
    if (r) {
      diagNodes.push(h('p', { class: 'adm-detail__body',
        text: String(r.totalScore) + c.row.score + '／' + (r.scoreBand && r.scoreBand.label || '') }));
      var axes = r.axisScores || {};
      var axisRows = Object.keys(axes).map(function (k) {
        return h('li', { text: axisLabel(k) + '：' + axes[k] });
      });
      if (axisRows.length) diagNodes.push(h('ul', { class: 'adm-detail__list' }, axisRows));
      lines.push('診断：' + r.totalScore + '点');
    } else {
      diagNodes.push(h('p', { class: 'adm-status', text: d.none }));
    }

    /* 回答（書いたものだけを拾って読みやすく並べる） */
    var answerNodes = [];
    if (answers) {
      var texts = collectTexts(answers);
      if (texts.length) {
        answerNodes.push(h('ul', { class: 'adm-detail__list' }, texts.map(function (t) {
          lines.push(t);
          return h('li', { text: t });
        })));
      } else {
        answerNodes.push(h('p', { class: 'adm-status', text: d.none }));
      }
    } else {
      answerNodes.push(h('p', { class: 'adm-status', text: d.none }));
    }

    var copyBtn = h('button', {
      type: 'button', class: 'btn btn--ghost', text: d.copy,
      on: { click: function () {
        var text = lines.join('\n\n');
        if (global.navigator.clipboard && global.navigator.clipboard.writeText) {
          global.navigator.clipboard.writeText(text).then(function () {
            copyBtn.textContent = d.copied;
            global.setTimeout(function () { copyBtn.textContent = d.copy; }, 1600);
          });
        }
      } }
    });

    box.appendChild(h('div', { class: 'adm-detail' }, [
      h('div', { class: 'adm-detail__head' }, [
        h('h2', { class: 'adm-subhead', text: d.heading }),
        h('button', {
          type: 'button', class: 'btn btn--ghost', text: d.close,
          on: { click: function () { box.hidden = true; SC.dom.clear(box); } }
        })
      ]),
      h('p', { class: 'adm-detail__meta',
        text: (row.name ? row.name + '／' : '') +
              shortTime(row.at) + '／' + (row.uid ? c.row.uid : c.row.noUid) }),
      section(d.blueprint, [bpNode]),
      section(d.diagnosis, diagNodes),
      section(d.answers, answerNodes),
      h('div', { class: 'adm-detail__foot' }, [copyBtn])
    ]));
  }

  /* 回答のかたまりから、本人が書いた文だけを拾う。
   * 内部の目印（日時・版・画面名）は出さない。 */
  function collectTexts(obj, out, depth) {
    out = out || [];
    depth = depth || 0;
    if (!obj || typeof obj !== 'object' || depth > 4) return out;
    Object.keys(obj).forEach(function (k) {
      var v = obj[k];
      if (typeof v === 'string') {
        if (!v) return;
        if (/At$|Version|Id$|screen|campaign|schema/i.test(k)) return;
        if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return;
        if (v.length < 2) return;
        out.push(v);
      } else if (v && typeof v === 'object') {
        collectTexts(v, out, depth + 1);
      }
    });
    return out;
  }

  /* --- 描画 ----------------------------------------------------------- */
  function render() {
    var host = el('admin-body');
    SC.dom.clear(host);
    el('admin-detail').hidden = true;

    if (!state.loaded) {
      el('admin-count').textContent = '';
      host.appendChild(h('p', { class: 'adm-status', text: c.beforeLoad }));
      return;
    }

    var rows = visibleRows();
    el('admin-count').textContent = c.countTemplate
      .replace('{shown}', String(rows.length))
      .replace('{total}', String(state.total));

    var sum = summaryBlock();
    if (sum) host.appendChild(sum);

    host.appendChild(filterBar());

    if (state.filter === 'stalled') {
      host.appendChild(h('p', { class: 'adm-status', text: c.stalledNote }));
    }

    if (!rows.length) {
      host.appendChild(h('p', { class: 'adm-status', text: c.empty }));
    } else {
      host.appendChild(h('div', { class: 'adm-list' }, rows.map(rowCard)));
    }

    host.appendChild(h('p', { class: 'adm-note', text: c.note }));
  }

  function filterBar() {
    var keys = ['all', 'joined', 'completed', 'stalled'];
    return h('div', { class: 'adm-filters' }, keys.map(function (k) {
      return h('button', {
        type: 'button',
        class: 'btn btn--ghost' + (state.filter === k ? ' is-on' : ''),
        text: c.filters[k],
        'aria-pressed': state.filter === k ? 'true' : 'false',
        on: { click: function () { state.filter = k; render(); } }
      });
    }));
  }

  /* --- 通信 ----------------------------------------------------------- */
  function post(payload) {
    return global.fetch(SC.endpoints.diagnosis, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      referrerPolicy: 'no-referrer'
    }).then(function (r) {
      if (!r.ok) { var e = new Error('network'); e.kind = 'network'; throw e; }
      return r.json();
    });
  }

  function load(key) {
    if (!key) return;
    setStatus(c.loading);
    post({ action: 'admin', key: key })
      .then(function (res) {
        if (!res || !res.ok) throw new Error('denied');
        state.rows = res.rows || [];
        state.summary = res.summary || null;
        state.total = res.total || state.rows.length;
        state.loaded = true;
        storeKey(key);
        setStatus('');
        render();
      })
      ['catch'](function (err) {
        setStatus(err && (err.kind === 'network' || err.name === 'TypeError')
          ? c.errorNetwork : c.error);
      });
  }

  /* --- 起動 ----------------------------------------------------------- */
  function boot() {
    doc.title = c.pageTitle;
    el('admin-heading').textContent = c.heading;
    el('admin-key-label').textContent = c.keyLabel;
    el('admin-key').setAttribute('placeholder', c.keyPlaceholder);
    el('admin-key-note').textContent = c.keyNote;
    el('admin-load').textContent = c.loadLabel;
    el('admin-reload').textContent = c.reload;
    el('admin-forget').textContent = c.clearKeyLabel;

    el('admin-load').addEventListener('click', function () { load(currentKey()); });
    el('admin-reload').addEventListener('click', function () { load(currentKey()); });
    el('admin-forget').addEventListener('click', function () {
      forgetKey();
      el('admin-key').value = '';
      state.rows = [];
      state.summary = null;
      state.loaded = false;
      setStatus('');
      render();
    });

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
