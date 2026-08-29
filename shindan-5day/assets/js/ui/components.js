/* components.js : DAY2〜5でも再利用する共通UI部品。
 * 画面ファイルはここの部品を組み合わせるだけにする。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;

  var uid = 0;
  function nextId(prefix) { uid += 1; return prefix + '-' + uid; }

  /* --- 動きの制御 -------------------------------------------------------
   * ・動きが苦手な設定（prefers-reduced-motion）では再生しない
   * ・導入アニメーションは読み込みごとに1回だけ（戻ってくるたびに再生しない）
   */
  var played = {};
  SC.motion = {
    allowed: function () {
      return !(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    },
    /* 同じkeyでは最初の1回だけ true を返す */
    once: function (key) {
      if (!SC.motion.allowed()) return false;
      if (played[key]) return false;
      played[key] = true;
      return true;
    },
    reset: function () { played = {}; }
  };

  /* 数字が0から目標値まで増える動き。
     最初から最終値を入れておき、動かせるときだけ0から数え上げる。
     （描画が止まる環境でも数字が欠けない） */
  SC.motion.countUp = function (root, opts) {
    var nodes = [].slice.call(root.querySelectorAll('[data-count-to]'));
    if (!nodes.length || !SC.motion.allowed()) return;
    var duration = (opts && opts.duration) || 900;
    var stagger = (opts && opts.stagger) || 0;
    var delay = (opts && opts.delay) || 0;

    /* 画面が裏にあるあいだ requestAnimationFrame は動かない。
     * 0 から数え上げる作りのままだと、数字が 0 のまま止まって見える。
     * 裏で描かれたときは、動かさずに最終値を入れる。 */
    var doc = global.document;
    if (doc && doc.hidden) {
      nodes.forEach(function (node) {
        var v = parseInt(node.getAttribute('data-count-to'), 10);
        if (!isNaN(v)) node.textContent = String(v);
      });
      return;
    }

    nodes.forEach(function (node, i) {
      var to = parseInt(node.getAttribute('data-count-to'), 10);
      if (isNaN(to)) return;
      var startAt = null;
      var wait = delay + i * stagger;
      var done = false;
      node.textContent = '0';
      function settle() {
        if (done) return;
        done = true;
        node.textContent = String(to);
      }
      function frame(now) {
        if (done) return;
        if (startAt === null) startAt = now;
        var t = (now - startAt - wait) / duration;
        if (t < 0) { global.requestAnimationFrame(frame); return; }
        if (t >= 1) { settle(); return; }
        /* 終わりにかけてゆっくり止まる */
        var eased = 1 - Math.pow(1 - t, 3);
        node.textContent = String(Math.round(to * eased));
        global.requestAnimationFrame(frame);
      }
      global.requestAnimationFrame(frame);
      /* 保険：途中で画面が裏へ回るなどして描画が止まっても、必ず数字が出る */
      global.setTimeout(settle, wait + duration + 600);
    });
  };

  var ui = {};

  /* --- 長い本文を、句点ごとの段落にして読ませる（2026-08-21 とーる指示）------
   * 文章そのものは変えない。区切る位置と余白だけを足す。
   * LPで使っている見せ方を、アプリ側の本文にもそろえている。 */
  ui.prose = function (text, className) {
    return h('div', { class: 'prose' },
      SC.dom.sentences(text, className || 'prose__line'));
  };

  /* --- スクロールで文字が現れる（2026-08-21 とーる指示）---------------------
   * 正本§9の「スクロール連動のふわっと表示は使わない」を、とーる判断で解除した箇所。
   * 事故らないように、次の順で守る：
   *  ・prefers-reduced-motion なら何もしない（最初から見えたまま）
   *  ・IntersectionObserver が無い環境でも何もしない（最初から見えたまま）
   *  ・隠すクラスはJSからしか付けない（JSが落ちても本文は必ず読める）
   *  ・保険のタイマーで、万一観測が動かなくても数秒後に全部見せる
   *  ・一度出たら二度と隠さない（行ったり来たりでチカチカさせない）
   */
  ui.scrollReveal = function (targets, opts) {
    opts = opts || {};
    var list = [].slice.call(targets || []).filter(Boolean);
    if (!list.length) return null;
    if (!SC.motion.allowed()) return null;
    if (!global.IntersectionObserver) return null;

    var stagger = opts.stagger === undefined ? 110 : opts.stagger;
    var shown = 0;
    var observerFired = false;   /* 観測そのものが動いたか（画面内かどうかとは別）*/

    function show(el, order) {
      if (el.classList.contains('is-shown')) return;
      el.style.setProperty('--rd', (order * stagger) + 'ms');
      el.classList.add('is-shown');
      shown++;
    }

    list.forEach(function (el) { el.classList.add('sc-reveal'); });

    var io = new global.IntersectionObserver(function (entries) {
      observerFired = true;
      var order = 0;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        show(entry.target, order);
        order++;
        io.unobserve(entry.target);
      });
    }, { rootMargin: opts.rootMargin || '0px 0px -10% 0px', threshold: opts.threshold || 0.06 });

    list.forEach(function (el) { io.observe(el); });

    /* 一気にスクロールして通り過ぎた要素は、観測が拾えないことがある。
     * 画面より上に行ったものは、その場で（動きなしで）必ず見せる。
     * 全部出たら見張るのをやめる。 */
    var ticking = false;
    function sweep() {
      ticking = false;
      var remaining = 0;
      list.forEach(function (el) {
        if (el.classList.contains('is-shown')) return;
        if (el.getBoundingClientRect().bottom < 0) {
          el.style.setProperty('--rd', '0ms');
          el.classList.add('is-shown');
          shown++;
          io.unobserve(el);
          return;
        }
        remaining++;
      });
      if (remaining === 0) {
        global.removeEventListener('scroll', onScroll);
        global.removeEventListener('resize', onScroll);
        io.disconnect();
      }
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      global.requestAnimationFrame(sweep);
    }
    global.addEventListener('scroll', onScroll, { passive: true });
    global.addEventListener('resize', onScroll);

    /* 保険：観測そのものが一度も動かない環境でだけ、全部見せて終わりにする。
     * 「まだスクロールしていないから出ていない」だけのときに誤って開かないよう、
     * 表示済みの数ではなく、観測が呼ばれたかどうかで判断する。 */
    global.setTimeout(function () {
      if (observerFired) return;
      list.forEach(function (el, i) { show(el, i); io.unobserve(el); });
    }, 2500);

    return {
      showAll: function () { list.forEach(function (el, i) { show(el, i); io.unobserve(el); }); },
      count: function () { return list.length; }
    };
  };

  /* --- AppHeader / DAY表示 -------------------------------------------
   * 構成（§17-5 で確定）
   *   上段   ：診断名（SNS事業の現在地診断）
   *   企画名 ：SNS事業の一本線 5DAY
   *   DAY表示：DAY1／DAY2 など
   */
  ui.appHeader = function (opts) {
    return h('header', { class: 'app-header' }, [
      h('div', { class: 'app-header__row' }, [
        opts.onBack
          ? h('button', {
              type: 'button', class: 'btn-back', on: { click: opts.onBack },
              'aria-label': SC.copy.common.back + '：前の画面へ'
            }, [h('span', { class: 'btn-back__arrow', 'aria-hidden': 'true', text: '←' }), SC.copy.common.back])
          : h('span', { class: 'btn-back btn-back--placeholder', 'aria-hidden': 'true' }),
        h('span', { class: 'app-header__day', text: opts.dayLabel })
      ]),
      h('p', { class: 'app-header__eyebrow', text: SC.copy.diagnosisName }),
      h('p', { class: 'app-header__program', text: SC.copy.programName }),
      h('h1', { class: 'app-header__title', text: opts.title }),
      opts.subtitle ? h('p', { class: 'app-header__subtitle', text: opts.subtitle }) : null
    ]);
  };

  /* --- ScoreSummary --------------------------------------------------- */
  ui.scoreSummary = function (opts) {
    return h('section', { class: 'card score-summary', 'aria-label': '総合スコア' }, [
      h('p', { class: 'score-summary__caption', text: opts.caption || SC.copy.result.scoreCaption }),
      h('p', { class: 'score-summary__value' }, [
        h('span', {
          class: 'score-summary__num', text: String(opts.totalScore),
          dataset: opts.animate ? { 'count-to': String(opts.totalScore) } : null
        }),
        h('span', { class: 'score-summary__max', text: ' / ' + opts.max })
      ]),
      h('p', { class: 'score-summary__band' }, [
        h('span', { class: 'tag tag--band', text: opts.band.label }),
        h('span', { class: 'score-summary__range', text: opts.band.range + '点' })
      ]),
      opts.band.meaning ? h('p', { class: 'score-summary__meaning', text: opts.band.meaning }) : null,
      /* メーターは別カードにせず、現在地として同じカードへ入れる */
      opts.children || null
    ]);
  };

  /* --- ScoreMeter （基準40／理想60） ----------------------------------
   * opts.target : 改善後の目安値。到達点を点線で重ねて示す（省略可）
   * opts.animate: 水位が上がる短い導入アニメーションを再生するか
   */
  ui.scoreMeter = function (opts) {
    var pct = Math.max(0, Math.min(100, (opts.value / opts.max) * 100));
    var marks = (opts.marks || []).map(function (m) {
      var mp = Math.max(0, Math.min(100, (m.value / opts.max) * 100));
      return h('span', { class: 'meter__mark', style: 'left:' + mp + '%' }, [
        h('span', { class: 'meter__mark-line', 'aria-hidden': 'true' }),
        h('span', { class: 'meter__mark-label', text: m.label })
      ]);
    });

    var targetPct = opts.target ? Math.max(0, Math.min(100, (opts.target / opts.max) * 100)) : null;
    var label = '総合スコア ' + opts.value + ' / ' + opts.max + '（基準40・理想60）';
    if (opts.target) label += '。改善後の目安 ' + opts.target;

    return h('div', { class: 'meter' + (opts.animate ? ' is-intro' : '') }, [
      h('div', { class: 'meter__track', role: 'img', 'aria-label': label }, [
        /* 改善後の目安を先に敷き、その上に現在の水位を重ねる */
        targetPct !== null
          ? h('div', { class: 'meter__target', style: 'width:' + targetPct + '%' })
          : null,
        h('div', { class: 'meter__fill', style: 'width:' + pct + '%' }),
        marks
      ]),
      h('p', { class: 'meter__note', text: '基準は40、理想は60です。' })
    ]);
  };

  /* --- AxisMeter （1つの軸だけを取り出して、いま → 目標 を見せる）--------
   * 総合メーターと違い、基準40・理想60は出さない（軸は20点満点のため）。
   * 数字は色だけでなく文字でも出す（絶対条件：色だけで状態を表現しない）。 */
  ui.axisMeter = function (opts) {
    var max = opts.max || SC.config.axisMax;
    var pct = Math.max(0, Math.min(100, (opts.value / max) * 100));
    var targetPct = opts.target
      ? Math.max(0, Math.min(100, (opts.target / max) * 100))
      : null;

    /* 「診断時」「改善仮説」のような但し書きを付けられる（§34-E-3）。
     * 5日後のスコアと読み違えられないよう、読み上げにも同じ言葉を入れる。 */
    var nowCaption = opts.nowLabel ? opts.nowLabel + ' ' : '';
    var goalCaption = opts.targetLabel ? opts.targetLabel + ' ' : '';

    var label = opts.label + '。' + nowCaption + opts.value + ' / ' + max;
    if (opts.target) label += '。' + goalCaption + opts.target + ' / ' + max;

    return h('div', { class: 'axis-meter' + (opts.animate ? ' is-intro' : '') }, [
      h('p', { class: 'axis-meter__head' }, [
        h('span', { class: 'axis-meter__label', text: opts.label }),
        h('span', { class: 'axis-meter__value' }, [
          h('span', { class: 'axis-meter__now', text: nowCaption + opts.value + ' / ' + max }),
          opts.target ? h('span', { class: 'axis-meter__arrow', 'aria-hidden': 'true', text: '→' }) : null,
          opts.target ? h('span', { class: 'axis-meter__goal', text: goalCaption + opts.target + ' / ' + max }) : null
        ])
      ]),
      h('div', { class: 'axis-meter__track', role: 'img', 'aria-label': label }, [
        targetPct !== null
          ? h('div', { class: 'axis-meter__target', style: 'width:' + targetPct + '%' })
          : null,
        h('div', { class: 'axis-meter__fill', style: 'width:' + pct + '%' })
      ])
    ]);
  };

  /* --- AxisList （表示モード／選択モード） ---------------------------- */
  ui.axisList = function (opts) {
    var scores = opts.scores || {};
    var max = SC.config.axisMax;

    function bar(score) {
      return h('span', { class: 'axis__bar', 'aria-hidden': 'true' }, [
        h('span', { class: 'axis__bar-fill', style: 'width:' + (score / max) * 100 + '%' })
      ]);
    }

    function badges(axisKey) {
      var out = [];
      if (opts.lowestAxis === axisKey && opts.lowestBadge) {
        out.push(h('span', { class: 'tag tag--focus', text: opts.lowestBadge }));
      }
      if (opts.recommended === axisKey && opts.recommendBadge) {
        out.push(h('span', { class: 'tag tag--recommend', text: opts.recommendBadge }));
      }
      return out;
    }

    if (opts.mode !== 'select') {
      return h('ul', { class: 'axis-list' + (opts.animate ? ' is-intro' : '') }, SC.axes.map(function (axis, index) {
        var score = scores[axis.key] || 0;
        var isLowest = opts.lowestAxis === axis.key;
        return h('li', {
          class: 'axis' + (isLowest ? ' axis--lowest' : ''),
          style: '--i:' + index
        }, [
          h('div', { class: 'axis__head' }, [
            h('span', { class: 'axis__label' }, [
              axis.label,
              h('span', { class: 'axis__formal', text: '（' + axis.formalName + '）' })
            ]),
            h('span', { class: 'axis__score' }, [
              h('span', {
                text: String(score),
                dataset: opts.animate ? { 'count-to': String(score) } : null
              }),
              ' / ' + max
            ])
          ]),
          bar(score),
          h('div', { class: 'axis__badges' }, badges(axis.key)),
          isLowest && opts.lowestReason ? h('p', { class: 'axis__reason', text: opts.lowestReason }) : null
        ]);
      }));
    }

    /* 選択モード：ネイティブのradioでキーボード操作を成立させる */
    var groupName = opts.name || nextId('axis');
    return h('fieldset', { class: 'choice-group' }, [
      h('legend', { class: 'choice-group__legend', text: opts.legend || '' }),
      h('ul', { class: 'axis-list axis-list--select' }, SC.axes.map(function (axis) {
        var score = scores[axis.key] || 0;
        var checked = opts.selected === axis.key;
        var inputId = groupName + '-' + axis.key;
        return h('li', { class: 'axis axis--choice' + (checked ? ' is-selected' : '') }, [
          h('input', {
            class: 'visually-hidden choice__input', type: 'radio', name: groupName, id: inputId,
            value: axis.key, checked: checked ? true : null,
            on: { change: function () { if (opts.onSelect) opts.onSelect(axis.key); } }
          }),
          h('label', { class: 'choice__label', for: inputId }, [
            h('span', { class: 'choice__check', 'aria-hidden': 'true' }),
            h('span', { class: 'choice__body' }, [
              h('span', { class: 'axis__head' }, [
                h('span', { class: 'axis__label' }, [
                  axis.label,
                  h('span', { class: 'axis__formal', text: '（' + axis.formalName + '）' })
                ]),
                h('span', { class: 'axis__score', text: score + ' / ' + max })
              ]),
              bar(score),
              h('span', { class: 'axis__hint', text: axis.hint }),
              h('span', { class: 'axis__badges' }, badges(axis.key).concat(
                checked && opts.selectedBadge ? [h('span', { class: 'tag tag--selected', text: opts.selectedBadge })] : []
              ))
            ])
          ])
        ]);
      }))
    ]);
  };

  /* --- ChoiceList / ChoiceCard ---------------------------------------- */
  ui.choiceList = function (opts) {
    var groupName = opts.name || nextId('choice');
    return h('fieldset', { class: 'choice-group' }, [
      h('legend', { class: 'choice-group__legend', text: opts.legend || '' }),
      h('ul', { class: 'choice-list' + (opts.variant ? ' choice-list--' + opts.variant : '') },
        opts.options.map(function (option) {
          return ui.choiceCard({
            groupName: groupName,
            option: option,
            checked: opts.value === option.value,
            selectedBadge: opts.selectedBadge,
            onSelect: opts.onSelect
          });
        }))
    ]);
  };

  ui.choiceCard = function (opts) {
    var option = opts.option;
    var inputId = opts.groupName + '-' + option.value;
    return h('li', { class: 'choice' + (opts.checked ? ' is-selected' : '') }, [
      h('input', {
        class: 'visually-hidden choice__input', type: 'radio', name: opts.groupName, id: inputId,
        value: option.value, checked: opts.checked ? true : null,
        on: { change: function () { if (opts.onSelect) opts.onSelect(option.value); } }
      }),
      h('label', { class: 'choice__label', for: inputId }, [
        h('span', { class: 'choice__check', 'aria-hidden': 'true' }),
        h('span', { class: 'choice__body' }, [
          h('span', { class: 'choice__title', text: option.label }),
          option.time ? h('span', { class: 'choice__sub', text: option.time }) : null,
          opts.checked && opts.selectedBadge
            ? h('span', { class: 'tag tag--selected', text: opts.selectedBadge })
            : null
        ])
      ])
    ]);
  };

  /* --- TextInput （短い自由入力）----------------------------------------
   * 入力のたびに画面を作り直すとカーソルが飛ぶため、ここでは保存だけを行い
   * 再描画はしない。保存表示だけを直接書き換える。
   */
  ui.textInput = function (opts) {
    var id = opts.id || nextId('text');
    var max = opts.maxLength || SC.config.freeTextMaxLength;
    var status = h('span', { class: 'text-input__status', role: 'status', 'aria-live': 'polite' });
    var counter = h('span', { class: 'text-input__count' });

    function refresh(text) {
      counter.textContent = text.length + ' / ' + max;
    }

    var field = h('textarea', {
      id: id, class: 'text-input__field', rows: opts.rows || '2', maxlength: String(max),
      placeholder: opts.placeholder || '',
      on: {
        input: function () {
          refresh(field.value);
          status.textContent = '';
          if (opts.onInput) opts.onInput(field.value);
        },
        blur: function () {
          if (field.value.trim() !== '') status.textContent = SC.copy.common.saved;
        }
      }
    });
    field.value = opts.value || '';
    refresh(field.value);

    return h('div', { class: 'text-input' }, [
      h('label', { class: 'text-input__label', for: id }, [
        opts.label,
        h('span', { class: 'text-input__meta' }, [counter, status])
      ]),
      field
    ]);
  };

  /* --- Recap （前回までの振り返り）--------------------------------------- */
  ui.recapList = function (opts) {
    return h('section', { class: 'card card--recap' }, [
      opts.heading ? h('h2', { class: 'card__title', text: opts.heading }) : null,
      h('dl', { class: 'recap-list' }, opts.items.map(function (item) {
        return h('div', { class: 'recap' }, [
          h('dt', { class: 'recap__label', text: item.label }),
          h('dd', { class: 'recap__value', text: item.value })
        ]);
      }))
    ]);
  };

  /* --- JourneyMap （DAY4の顧客導線図）------------------------------------
   * 選んだ順番で4地点を縦につなぐ。矢印は装飾なので読み上げから外す。
   */
  ui.journeyMap = function (opts) {
    var points = SC.day4.points(opts.state);
    return h('ol', { class: 'jmap' }, points.map(function (p, i) {
      return h('li', { class: 'jmap__step' }, [
        h('span', { class: 'jmap__num', 'aria-hidden': 'true', text: String(i + 1) }),
        h('span', { class: 'jmap__body' }, [
          h('span', { class: 'jmap__label', text: p.label }),
          h('span', { class: 'jmap__value', text: p.value || '—' }),
          opts.withEmotion
            ? h('span', { class: 'jmap__emotion', text: '「' + p.emotion + '」' })
            : null
        ])
      ]);
    }));
  };

  /* --- BlueprintProgress （一本線シート） ------------------------------ */
  ui.blueprintProgress = function (opts) {
    var state = opts.state;
    var done = 0;
    var items = SC.config.blueprintSections.map(function (s) {
      var section = state.blueprintSections[s.key] || { status: 'empty', summary: '' };
      var isDone = section.status === 'done';
      if (isDone) done++;
      return h('li', { class: 'blueprint__item' + (isDone ? ' is-done' : '') }, [
        h('span', { class: 'blueprint__mark', 'aria-hidden': 'true', text: isDone ? '✓' : '' }),
        h('span', { class: 'blueprint__body' }, [
          h('span', { class: 'blueprint__day', text: 'DAY' + s.day }),
          h('span', { class: 'blueprint__label', text: s.label }),
          h('span', { class: 'blueprint__status', text: isDone ? '完了' : '未記入' }),
          isDone && section.summary ? h('span', { class: 'blueprint__summary', text: section.summary }) : null
        ])
      ]);
    });
    return h('section', { class: 'card blueprint', 'data-section': 'blueprint' }, [
      h('div', { class: 'blueprint__head' }, [
        h('h2', { class: 'card__title', text: opts.heading }),
        h('span', { class: 'blueprint__count', text: done + '／' + SC.config.blueprintSections.length })
      ]),
      opts.note ? h('p', { class: 'card__note', text: opts.note }) : null,
      h('ol', { class: 'blueprint__list' }, items)
    ]);
  };

  /* --- BeforeAfter ----------------------------------------------------- */
  ui.beforeAfter = function (opts) {
    return h('section', { class: 'card before-after' }, [
      h('h2', { class: 'card__title', text: opts.heading }),
      h('ul', { class: 'before-after__list' }, opts.items.map(function (item) {
        return h('li', { class: 'before-after__item' }, [
          h('p', { class: 'before-after__row before-after__row--before' }, [
            h('span', { class: 'before-after__tag', text: opts.beforeLabel }),
            h('span', { class: 'before-after__text', text: item.before })
          ]),
          h('p', { class: 'before-after__arrow', 'aria-hidden': 'true', text: '↓' }),
          h('p', { class: 'before-after__row before-after__row--after' }, [
            h('span', { class: 'before-after__tag', text: opts.afterLabel }),
            h('span', { class: 'before-after__text', text: item.after })
          ])
        ]);
      }))
    ]);
  };

  /* --- CTA -------------------------------------------------------------- */
  ui.primaryCta = function (opts) {
    return h('button', { type: 'button', class: 'btn btn--primary', on: { click: opts.onClick } }, opts.label);
  };

  ui.secondaryCta = function (opts) {
    return h('button', { type: 'button', class: 'btn btn--secondary', on: { click: opts.onClick } }, opts.label);
  };

  ui.ctaArea = function (children) { return h('div', { class: 'cta-area' }, children); };

  /* --- DayTeaser -------------------------------------------------------- */
  ui.dayTeaser = function (opts) {
    var opened = false;
    var el = h('details', {
      class: 'card teaser',
      on: {
        toggle: function () {
          if (el.open && !opened) { opened = true; if (opts.onOpen) opts.onOpen(); }
        }
      }
    }, [
      h('summary', { class: 'teaser__summary', text: opts.title }),
      h('p', { class: 'teaser__body', text: opts.body })
    ]);
    return el;
  };

  /* --- 保存・再開状態の表示 --------------------------------------------- */
  ui.saveStatus = function (opts) {
    return h('p', {
      class: 'save-status' + (opts.tone ? ' save-status--' + opts.tone : ''),
      role: 'status', 'aria-live': 'polite'
    }, [
      h('span', { class: 'save-status__mark', 'aria-hidden': 'true', text: opts.tone === 'warn' ? '!' : '✓' }),
      h('span', { text: opts.text })
    ]);
  };

  ui.card = function (title, children, extraClass) {
    return h('section', { class: 'card' + (extraClass ? ' ' + extraClass : '') }, [
      title ? h('h2', { class: 'card__title', text: title }) : null,
      children
    ]);
  };

  ui.notice = function (text) {
    return h('p', { class: 'notice', role: 'status', 'aria-live': 'polite', text: text });
  };

  SC.ui = ui;
})(window);
