/* diagnosis-lp.js : 診断前LP（ビジター第一接触）
 *
 * 正本：Notion §47（Codex・あかり／2026-08-25）
 *
 * このページの目的は「診断を始める」ひとつだけ。
 *  ・ナビゲーションを置かない
 *  ・主CTAはすべて同じ文言・同じ行き先（shindan-intro.html）
 *  ・商品／講座／個別相談／価格へのリンクを置かない
 *  ・設問と選択肢を先出ししない
 *  ・最低軸別イラスト5枚は診断前に見せない
 *  ・お客様の声は素材が届くまで完全非表示
 *  ・性格・才能・向き不向きを断定しない
 *
 * テキスト型VSLはこのページでは使わない（§47-D）。
 * あれは設問直前の shindan-intro.html にだけ残す。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;
  var doc = global.document;

  function c() { return SC.diagnosisLpCopy; }
  function track(name, meta) { return SC.diagnosisTrack.event(name, meta); }

  /* 主CTA。押した場所だけを計測へ載せる（本文・回答・個人情報は送らない） */
  function cta(where, extraNote) {
    var copy = c();
    return h('div', { class: 'dlp-cta' }, [
      h('a', {
        class: 'btn btn--primary dlp-cta__btn',
        href: copy.cta.href,
        on: { click: function () { track('diagnosis_lp_cta_click', { cta: where }); } }
      }, copy.cta.label),
      extraNote ? h('p', { class: 'dlp-cta__note' }, SC.dom.lines(extraNote, 'dlp-cta__note-line')) : null
    ]);
  }

  function section(id, children, extraClass) {
    return h('section', {
      class: 'dlp-section' + (extraClass ? ' ' + extraClass : ''),
      'data-section': id
    }, children);
  }

  /* 畳めるセクション（2026-08-25 とーる指示）。
   * compact のときだけ閉じた状態で出す。中身は削らない。 */
  function foldable(id, title, children, extraClass, alwaysOpen) {
    var copy = c();
    if (!copy.compact || alwaysOpen) {
      return section(id, [heading(title)].concat(children), extraClass);
    }

    var el = h('details', {
      class: 'dlp-section dlp-fold' + (extraClass ? ' ' + extraClass : ''),
      'data-section': id
    }, [
      h('summary', { class: 'dlp-fold__summary' }, [
        h('span', { class: 'dlp-fold__title', text: title }),
        h('span', { class: 'dlp-fold__more', 'aria-hidden': 'true', text: copy.moreLabel })
      ]),
      h('div', { class: 'dlp-fold__body' }, children)
    ]);
    return el;
  }

  function heading(text) {
    return h('h2', { class: 'dlp-heading' }, SC.dom.lines(text, 'dlp-heading__line'));
  }

  function body(text) {
    return h('div', { class: 'dlp-body' }, SC.dom.lines(text, 'dlp-body__line'));
  }

  /* --- 1. ヒーロー ---------------------------------------------------- */
  function heroSection() {
    var copy = c().hero;
    var img = copy.background;

    /* 2026-08-25 とーる指示：画像は前に出さず、背景へうっすら敷く。
     * 装飾なので読み上げからは外す（aria-hidden）。文字は焼き込まない。 */
    var backdrop = h('div', {
      class: 'dlp-hero__backdrop', 'aria-hidden': 'true',
      style: 'background-image:url(' + img.src + ');opacity:' + img.opacity
    });

    return h('header', { class: 'dlp-hero', 'data-section': 'hero' }, [
      backdrop,
      h('div', { class: 'dlp-hero__copy' }, [
        h('p', { class: 'dlp-hero__eyebrow', text: copy.eyebrow }),
        h('h1', { class: 'dlp-hero__title' }, SC.dom.lines(copy.title, 'dlp-hero__title-line')),
        body(copy.body),
        h('ul', { class: 'dlp-facts' }, copy.facts.map(function (t) {
          return h('li', { class: 'dlp-facts__item', text: t });
        })),
        cta('hero', copy.ctaNote)
      ])
    ]);
  }

  /* --- 2. 共感（2026-08-25 差し替え）-----------------------------------
   * 焦りを言葉にしたうえで、現在地の確認へ戻す。煽りへはつなげない。 */
  function empathySection() {
    var copy = c().empathy;
    return section('empathy', [
      heading(copy.heading),
      h('div', { class: 'dlp-blocks' }, copy.blocks.map(function (lines) {
        return h('div', { class: 'dlp-block' }, lines.map(function (line) {
          return h('p', { class: 'dlp-block__line', text: line });
        }));
      })),
      copy.showCta ? cta('empathy') : null
    ], 'dlp-section--empathy');
  }

  /* --- 3. 問題の再定義 ------------------------------------------------ */
  function reframeSection() {
    var copy = c().reframe;
    return section('reframe', [
      heading(copy.heading),
      body(copy.body),
      h('p', { class: 'dlp-note', text: copy.note })
    ], 'dlp-section--reframe');
  }

  /* --- 4. 5つの診断軸（設問は見せない）-------------------------------- */
  function axesSection() {
    var copy = c().axes;
    return foldable('axes', copy.heading, [
      h('p', { class: 'dlp-lead', text: copy.lead }),
      h('ol', { class: 'dlp-axes' }, SC.axes.map(function (axis, i) {
        return h('li', { class: 'dlp-axis' }, [
          h('span', { class: 'dlp-axis__num', 'aria-hidden': 'true', text: String(i + 1) }),
          h('div', { class: 'dlp-axis__body' }, [
            h('h3', { class: 'dlp-axis__name', text: axis.label }),
            h('p', { class: 'dlp-axis__text', text: copy.descriptions[axis.key] })
          ])
        ]);
      })),
      h('p', { class: 'dlp-close', text: copy.close })
    ]);
  }

  /* --- 5. 結果で分かること -------------------------------------------- */
  function resultSection() {
    var copy = c().result;

    /* 見本のレーダー。5軸を同じ値にして、特定の軸を強調しない。
     * 最低軸も渡さないので、どこも光らない。 */
    var sample = {};
    SC.axes.forEach(function (a) { sample[a.key] = copy.sampleScore; });

    return section('result', [
      heading(copy.heading),
      body(copy.body),
      h('ul', { class: 'dlp-list' }, copy.items.map(function (t) {
        return h('li', { class: 'dlp-list__item', text: t });
      })),
      h('div', { class: 'dlp-sample' }, [
        h('p', { class: 'dlp-sample__title', text: copy.sampleHeading }),
        SC.ui.radarChart({
          scores: sample,
          max: SC.config.axisMax,
          animate: false
        }),
        h('p', { class: 'dlp-sample__note', text: copy.sampleNote })
      ]),
      h('div', { class: 'dlp-note' }, SC.dom.lines(copy.note, 'dlp-note__line')),
      cta('middle', copy.ctaNote)
    ]);
  }

  /* --- 6. 診断の流れ -------------------------------------------------- */
  function flowSection() {
    var copy = c().flow;
    return foldable('flow', copy.heading, [
      h('ol', { class: 'dlp-steps' }, copy.steps.map(function (step) {
        return h('li', { class: 'dlp-step' }, [
          h('h3', { class: 'dlp-step__title', text: step.title }),
          h('p', { class: 'dlp-step__body', text: step.body })
        ]);
      })),
      h('p', { class: 'dlp-note', text: copy.note })
    ]);
  }

  /* --- 7. 向いている方 ------------------------------------------------ */
  function fitSection() {
    var copy = c().fit;
    return foldable('fit', copy.heading, [
      h('ul', { class: 'dlp-checks' }, copy.items.map(function (t) {
        return h('li', { class: 'dlp-checks__item', text: t });
      })),
      h('div', { class: 'dlp-limit' }, [
        h('h3', { class: 'dlp-limit__title', text: copy.limitHeading }),
        body(copy.limitBody)
      ])
    ]);
  }

  /* --- 8. 設計者プロフィール ------------------------------------------
   * 2026-08-25（§51）：診断前LPは短縮版を使う。
   * 第一接触で長い経歴を読ませない。詳しい経歴は参加表明LPに残す。
   * 顔写真は、とーる本人から直接提供された素材。 */
  function authorSection() {
    var copy = c().author;
    var src = copy;

    var photo = copy.photo;
    return foldable('author', copy.heading, [
      h('div', { class: 'dlp-author__head' }, [
        photo
          ? h('img', {
              class: 'dlp-author__photo',
              src: photo.src,
              alt: photo.alt || '',
              width: String(photo.width),
              height: String(photo.height),
              loading: 'lazy',
              decoding: 'async'
            })
          : null,
        h('div', { class: 'dlp-author__id' }, [
          h('p', { class: 'dlp-author__name', text: src.name }),
          h('p', { class: 'dlp-author__role', text: src.role })
        ])
      ]),
      h('div', { class: 'dlp-body' }, SC.dom.lines(src.body, 'dlp-body__line')),
      h('p', { class: 'dlp-close', text: copy.closing })
    ], 'dlp-section--author', copy.alwaysOpen);
  }

  /* --- 9. お客様の声（素材が届くまで作らない）------------------------- */
  function voicesSection() {
    var copy = c().voices;
    /* ★空のカードも仮名も出さない。器ごと作らない */
    if (!copy.enabled) return null;
    return section('voices', [heading(copy.heading)]);
  }

  /* --- 10. FAQ -------------------------------------------------------- */
  function faqSection() {
    var copy = c().faq;
    return foldable('faq', copy.heading, [
      h('div', { class: 'dlp-faq' }, copy.items.map(function (item, i) {
        var opened = false;
        var el = h('details', {
          class: 'dlp-faq__item',
          on: {
            toggle: function () {
              if (el.open && !opened) {
                opened = true;
                track('diagnosis_lp_faq_opened', { cta: 'q' + (i + 1) });
              }
            }
          }
        }, [
          h('summary', { class: 'dlp-faq__q', text: item.q }),
          h('p', { class: 'dlp-faq__a', text: item.a })
        ]);
        return el;
      }))
    ]);
  }

  /* --- 11. 最終CTA ---------------------------------------------------- */
  function finalSection() {
    var copy = c().finalCta;
    return section('final', [
      heading(copy.heading),
      body(copy.body),
      cta('final', copy.note)
    ], 'dlp-section--final');
  }

  /* 何度呼んでも同じ結果になるようにしておく（自動テストからも組み立てるため） */
  function boot() {
    var root = doc.getElementById('dlp');
    if (!root) return;
    SC.dom.clear(root);
    track('diagnosis_lp_view');

    var built = [
      heroSection(),
      empathySection(),
      reframeSection(),
      axesSection(),
      resultSection(),
      flowSection(),
      fitSection(),
      authorSection(),
      voicesSection(),
      faqSection(),
      finalSection()
    ];
    SC.dom.append(root, built);

    /* --- 文字の演出（2026-08-25 とーる指示）---------------------------
     * ヒーローは開いた瞬間に順に浮かび、
     * それ以降はスクロールで現れる。
     * どちらも prefers-reduced-motion では動かない（最初から見えたまま）。 */
    var hero = root.querySelector('.dlp-hero');
    if (hero && SC.motion.allowed()) hero.classList.add('is-entering');

    var targets = [];
    [].slice.call(root.children).forEach(function (el) {
      if (el === hero) return;
      var inner = el.querySelectorAll(
        '.dlp-heading, .dlp-fold__summary, .dlp-block, .dlp-body__line, ' +
        '.dlp-lead, .dlp-checks__item, .dlp-list__item, .dlp-axis, ' +
        '.dlp-step, .dlp-close, .dlp-note, .dlp-sample, .dlp-faq__item, ' +
        '.dlp-limit, .dlp-cta'
      );
      if (inner.length) {
        [].slice.call(inner).forEach(function (t) { targets.push(t); });
      } else {
        targets.push(el);
      }
    });
    SC.ui.scrollReveal(targets, { stagger: 90 });
  }

  SC.diagnosisLpApp = { boot: boot };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
