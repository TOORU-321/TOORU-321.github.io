/* story-deck.js : テキスト型VSL（1メッセージずつ見せるカード）
 * 2026-08-21 とーる相談で追加／同日「順番に読ませる」方針で章立てに拡張。
 *
 * ・下に積まず、同じ場所でカードが差し替わる
 * ・1タップ＝1メッセージ。文字はフワッと出す（ページをめくる感じの横ずれ付き）
 * ・章見出し（h2）はカードの上に残り、章が変わるときだけ差し替わる
 * ・スクロール連動ではないので、正本§9の「スクロール連動のふわっと表示」には当たらない
 * ・prefers-reduced-motion では動かさず、即座に差し替える
 * ・全体像を先に見たい人のために「まとめて読む」を必ず置く
 * ・キーボード（Tab・矢印キー）と読み上げに対応する
 *
 * 使い方：
 *   SC.ui.storyDeck({
 *     id: 'lp-story',
 *     label: '読み進める',
 *     steps: [
 *       { chapter: { key: 'empathy', num: '01', title: '…' }, body: '…' },
 *       { chapter: {…}, body: '…', items: ['…'], note: '…' },
 *       { chapter: {…}, body: '…', visual: function () { return レーダー等の要素 } },
 *       { chapter: {…}, body: '…', cta: { label: '…', onClick: fn } }   // 途中CTA
 *     ],
 *     finalCta: { label: '5日間をはじめる', onClick: fn },
 *     renderAll: function () { return 展開時に見せる要素 },
 *     toggle: false,          // 「まとめて読む」を置かない（枚数が少ない画面向け）
 *     progress: 'none',       // 進み具合を出さない（文字だけ見せたい画面向け）
 *     prev: false,            // 「戻る」を置かない（同上）
 *     onStep: fn(index), onComplete: fn(), onExpand: fn(),
 *     expose: fn({ go, goToChapter, indexOf, isExpanded })
 *   })
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;
  var doc = global.document;

  var TEXT = {
    next: '次へ',
    prev: '戻る',
    expand: 'まとめて読む',
    collapse: '1つずつ読む',
    progress: '{current} / {total}',
    position: '{total}枚中{current}枚目'
  };

  SC.ui.storyDeck = function (opts) {
    var steps = opts.steps || [];
    var total = steps.length;
    var index = 0;
    var expanded = false;
    var completed = false;
    var shownChapter = null;

    /* --- 章見出し（カードが変わっても残る）----------------------------- */
    var chapterNum = h('span', { class: 'deck__chapter-num', 'aria-hidden': 'true' });
    var chapterTitle = h('span', { class: 'deck__chapter-title' });
    var chapterHead = h('h2', { class: 'deck__chapter' }, [chapterNum, chapterTitle]);

    var stage = h('div', {
      class: 'deck__stage', role: 'group',
      'aria-live': 'polite', 'aria-label': opts.label || ''
    });
    /* 枚数が多いと「1 / 22」が重荷になるので、そのときは数字と点をやめて細い線にする。
     * 読み上げには枚数を残す（見えないだけで、位置は分かるようにする）。 */
    var progressMode = opts.progress || 'auto';
    if (progressMode === 'auto') progressMode = total > 8 ? 'bar' : 'dots';
    var showPrev = opts.prev !== false;

    var progressText = h('p', { class: 'deck__progress' });
    var dots = h('div', { class: 'deck__dots', 'aria-hidden': 'true' });
    var barFill = h('span', { class: 'deck__bar-fill' });
    var bar = h('div', {
      class: 'deck__bar', role: 'progressbar',
      'aria-valuemin': '1', 'aria-valuemax': String(total)
    }, [barFill]);
    progressText.hidden = progressMode !== 'dots';
    dots.hidden = progressMode !== 'dots';
    bar.hidden = progressMode !== 'bar';
    var prevBtn = h('button', {
      type: 'button', class: 'btn btn--secondary deck__prev', text: TEXT.prev,
      on: { click: function () { go(index - 1); } }
    });
    var nextBtn = h('button', {
      type: 'button', class: 'btn btn--primary deck__next',
      on: { click: function () { onNext(); } }
    });
    var measurer = h('div', { class: 'deck__measure', 'aria-hidden': 'true' });
    var allSlot = h('div', { class: 'deck__all', hidden: true });
    var toggleBtn = h('button', {
      type: 'button', class: 'btn btn--ghost deck__toggle', text: TEXT.expand,
      on: { click: function () { toggle(); } }
    });

    function chapterKeyOf(step) {
      if (!step || !step.chapter) return null;
      return step.chapter.key || step.chapter.title || null;
    }

    function renderChapter() {
      var chapter = steps[index] && steps[index].chapter;
      var key = chapterKeyOf(steps[index]);
      if (!chapter) {
        chapterHead.hidden = true;
        shownChapter = null;
        return;
      }
      chapterHead.hidden = false;
      if (key === shownChapter) return;   /* 同じ章の中では動かさない */
      shownChapter = key;
      chapterNum.textContent = chapter.num || '';
      chapterNum.hidden = !chapter.num;
      chapterTitle.textContent = chapter.title || '';
      if (SC.motion.allowed()) {
        chapterHead.classList.remove('is-appearing');
        /* クラスを付け直してアニメーションを再生させる */
        void chapterHead.offsetWidth;
        chapterHead.classList.add('is-appearing');
      }
    }

    function buildCard(step) {
      var card = h('div', { class: 'deck__step' }, [
        step.eyebrow ? h('p', { class: 'deck__eyebrow', text: step.eyebrow }) : null,
        step.title ? h('p', { class: 'deck__title', text: step.title }) : null,
        /* 2026-09-03 とーる指示：変なところで改行させない。
         * 句読点のうしろでだけ行が変わるよう、意味の塊に分けて置く。 */
        step.body
          ? h('p', { class: 'deck__body' }, SC.dom.phrases(step.body, 'deck__phrase'))
          : null,
        step.items && step.items.length
          ? h('ul', { class: 'deck__list' }, step.items.map(function (t) {
              return h('li', { class: 'deck__list-item', text: t });
            }))
          : null,
        /* 図（レーダー・メーターなど）。毎回作り直すので関数で受け取る */
        step.visual ? h('div', { class: 'deck__visual' }, [step.visual()]) : null,
        step.note ? h('p', { class: 'deck__note', text: step.note }) : null,
        step.cta
          ? h('button', {
              type: 'button', class: 'btn btn--primary deck__step-cta', text: step.cta.label,
              on: { click: function () { if (step.cta.onClick) step.cta.onClick(); } }
            })
          : null
      ]);

      /* 1枚の中でも、上から順に置かれていくように少しずつ遅らせる */
      var delay = 0;
      [].slice.call(card.children).forEach(function (child) {
        child.style.setProperty('--d', delay + 'ms');
        delay += 90;
        if (child.classList.contains('deck__list')) {
          [].slice.call(child.children).forEach(function (li) {
            li.style.setProperty('--d', delay + 'ms');
            delay += 110;
          });
        }
      });
      return card;
    }

    /* いちばん高いカードに合わせて枠を固定する。
     * 送るたびに枠の高さが変わると、下のボタンが飛んで「めくる」感じが壊れるため。 */
    function measure() {
      if (!stage.clientWidth) return;
      var cs = global.getComputedStyle(stage);
      var padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      var padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      measurer.style.width = (stage.clientWidth - padX) + 'px';
      var max = 0;
      steps.forEach(function (s) {
        /* 図のあるカードは背が高いので、そこに全カードを合わせない。
         * そのカードだけ枠が伸びる（最低の高さを超えるぶんは自然に広がる）。 */
        if (s.visual) return;
        SC.dom.clear(measurer);
        measurer.appendChild(buildCard(s));
        var height = measurer.getBoundingClientRect().height;
        if (height > max) max = height;
      });
      SC.dom.clear(measurer);
      /* 端数で1pxはみ出すことがあるので、わずかに余裕をとる */
      stage.style.minHeight = Math.ceil(max + padY) + 2 + 'px';
    }

    function scheduleMeasure() {
      if (global.requestAnimationFrame) global.requestAnimationFrame(measure);
      else measure();
    }

    function renderStep() {
      var step = steps[index];
      renderChapter();
      SC.dom.clear(stage);
      stage.appendChild(measurer);

      var card = buildCard(step);
      /* 動かせるときだけフワッと出す */
      if (SC.motion.allowed()) card.classList.add('is-appearing');
      stage.appendChild(card);

      progressText.textContent = TEXT.progress
        .replace('{current}', String(index + 1))
        .replace('{total}', String(total));
      /* 進み具合を出さない画面では、点やバーの組み立ても飛ばす */
      if (progressMode === 'none') {
        prevBtn.disabled = index === 0;
        var lastOnly = index === total - 1;
        nextBtn.textContent = (lastOnly && opts.finalCta) ? opts.finalCta.label : TEXT.next;
        nextBtn.classList.toggle('deck__next--final', !!(lastOnly && opts.finalCta));
        if (opts.onStep) opts.onStep(index, step);
        return;
      }

      barFill.style.width = (total < 2 ? 100 : ((index + 1) / total) * 100) + '%';
      bar.setAttribute('aria-valuenow', String(index + 1));
      bar.setAttribute('aria-valuetext', TEXT.position
        .replace('{current}', String(index + 1))
        .replace('{total}', String(total)));

      SC.dom.clear(dots);
      steps.forEach(function (s, i) {
        dots.appendChild(h('span', {
          class: 'deck__dot' + (i === index ? ' is-current' : (i < index ? ' is-done' : ''))
        }));
      });

      prevBtn.disabled = index === 0;
      var last = index === total - 1;
      nextBtn.textContent = (last && opts.finalCta) ? opts.finalCta.label : TEXT.next;
      nextBtn.classList.toggle('deck__next--final', !!(last && opts.finalCta));

      if (opts.onStep) opts.onStep(index, step);
    }

    function go(next) {
      if (next < 0 || next > total - 1) return;
      index = next;
      renderStep();
    }

    /* 章の先頭カードへ飛ぶ（ヒーローの「5日後に残るものを見る」などから使う） */
    function indexOf(chapterKey) {
      for (var i = 0; i < total; i++) {
        if (chapterKeyOf(steps[i]) === chapterKey) return i;
      }
      return -1;
    }

    function goToChapter(chapterKey) {
      var i = indexOf(chapterKey);
      if (i < 0) return false;
      if (expanded) toggle();          /* まとめ表示中なら1枚ずつに戻す */
      go(i);
      return true;
    }

    function onNext() {
      if (index < total - 1) { go(index + 1); return; }
      if (!completed) {
        completed = true;
        if (opts.onComplete) opts.onComplete();
      }
      if (opts.finalCta && opts.finalCta.onClick) opts.finalCta.onClick();
    }

    function toggle() {
      expanded = !expanded;
      if (expanded && !allSlot.firstChild) {
        allSlot.appendChild(opts.renderAll ? opts.renderAll() : defaultAll());
        if (opts.onExpand) opts.onExpand();
      }
      allSlot.hidden = !expanded;
      deckBody.hidden = expanded;
      chapterHead.hidden = expanded || !steps[index].chapter;
      toggleBtn.textContent = expanded ? TEXT.collapse : TEXT.expand;
    }

    function defaultAll() {
      return h('ol', { class: 'deck__all-list' }, steps.map(function (s) {
        return h('li', { class: 'deck__all-item' }, [
          s.eyebrow ? h('span', { class: 'deck__all-eyebrow', text: s.eyebrow }) : null,
          h('span', { class: 'deck__all-body', text: s.body || '' })
        ]);
      }));
    }

    var deckBody = h('div', { class: 'deck__body-wrap' }, [
      stage,
      h('div', { class: 'deck__controls' }, [
        progressMode === 'none'
          ? null
          : h('div', { class: 'deck__meta' }, [dots, progressText, bar]),
        h('div', { class: 'deck__buttons' }, showPrev ? [prevBtn, nextBtn] : [nextBtn])
      ])
    ]);

    var root = h('div', {
      class: 'deck', id: opts.id || null,
      on: {
        keydown: function (e) {
          if (expanded) return;
          if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
          if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
        }
      }
    }, [
      chapterHead, deckBody, allSlot,
      /* 枚数が多い画面では全体像を先に見たい人のために必ず置く。
       * 数枚しかない画面（診断のはじめかたなど）では、順番に読ませたいので置かない。 */
      opts.toggle === false
        ? null
        : h('div', { class: 'deck__toggle-wrap' }, [toggleBtn])
    ]);

    renderStep();

    /* 画面に入ってから／フォントが届いてから／幅が変わったときに測り直す */
    var lastWidth = 0;
    scheduleMeasure();
    if (doc.fonts && doc.fonts.ready && doc.fonts.ready.then) doc.fonts.ready.then(measure);
    global.addEventListener('resize', function () {
      if (stage.clientWidth === lastWidth) return;
      lastWidth = stage.clientWidth;
      stage.style.minHeight = '';
      scheduleMeasure();
    });

    var api = {
      go: go,
      goToChapter: goToChapter,
      indexOf: indexOf,
      isExpanded: function () { return expanded; },
      current: function () { return index; }
    };
    root.deck = api;
    if (opts.expose) opts.expose(api);
    return root;
  };

  SC.ui.storyDeck.TEXT = TEXT;
})(window);
