/* lp.js : 参加表明LP（結果 → 参加 → アプリ）
 * 正本：Notion §23-A/B（2026-08-20 Codex／あかり確定）
 * ・型：診断連動型・価値提案登録LP
 * ・参加が確定するのは最終CTAだけ。ヒーローと中間CTAは最終参加表明へスクロールする
 * ・診断結果を見た人だけに本編を見せる（ソフトな出し分け。静的公開では完全には塞げない）
 * ・動画枠は、動画が用意できるまでLPへ出さない（§23-B 動画枠の扱い）
 */
(function (global) {
  'use strict';
  var SC = global.SC;
  var doc = global.document;
  var h = SC.dom.h;

  var APP_URL = 'index.html';

  function slot(name) { return doc.querySelector('[data-lp="' + name + '"]'); }

  function setText(name, text) {
    var el = slot(name);
    if (el) el.textContent = text;
    return el;
  }

  /* 長い本文は句点で段落に分ける（文章は変えず、読む区切りだけ増やす） */
  function setProse(name, text) {
    var el = slot(name);
    if (!el) return null;
    SC.dom.clear(el);
    SC.dom.sentences(text, 'lp-prose__line').forEach(function (line) { el.appendChild(line); });
    el.classList.add('lp-prose');
    return el;
  }

  function fill(template, values) {
    return String(template).replace(/\{(\w+)\}/g, function (m, key) {
      return values[key] !== undefined ? values[key] : m;
    });
  }

  function list(name, items, className) {
    var el = slot(name);
    if (!el) return;
    items.forEach(function (text) {
      el.appendChild(h('li', { class: className || 'lp-list__item', text: text }));
    });
  }

  /* --- 読み切ると、この先が現れる（2026-08-21 とーる指示）-----------------
   * 最後まで送る／まとめて読む／CTAを押す、のどれかで開く。
   * 一度開いたら保存し、次に来たときは最初から開いた状態にする。 */
  /* この表示セッションで lp_story_revealed を送ったか（重複送出を防ぐ・§36-1-3） */
  var revealedThisSession = false;

  function revealAfter() {
    var after = doc.getElementById('lp-after');
    if (!after) return;
    if (after.hidden) {
      after.hidden = false;
      if (SC.motion.allowed()) after.classList.add('is-revealing');
      SC.store.markStoryRead();
      if (!revealedThisSession) {
        revealedThisSession = true;
        SC.track.event('lp_story_revealed');
      }
    }
    startScrollReveal();
    var first = after.querySelector('.lp-section');
    if (first) first.scrollIntoView({ block: 'start' });
    var heading = first && first.querySelector('.lp-section__title');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  }

  /* ヒーロー主CTA：読み進めるブロックの1枚目へ運ぶだけ（§36-1-1）。
   * 後半は開かず、既読の印も付けず、参加状態にも触れない。 */
  function goToStory() {
    var story = doc.getElementById('story');
    if (story) story.scrollIntoView({ block: 'start' });
    focusStoryStart();
  }

  function focusStoryStart() {
    var deck = doc.getElementById('lp-story-deck');
    if (!deck) return;
    var heading = deck.querySelector('.deck__chapter');
    var target = heading || deck.querySelector('.deck__body');
    if (!target) return;
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }

  /* 読み切ったあとの部分は、スクロールに合わせて1行ずつ現れる（とーる指示）*/
  var revealStarted = false;
  function startScrollReveal() {
    if (revealStarted) return;
    revealStarted = true;
    var after = doc.getElementById('lp-after');
    if (!after) return;
    var targets = after.querySelectorAll([
      '.lp-section__title',
      '.lp-prose__line',
      '.lp-section__body',
      '.lp-section__note',
      '.lp-subtitle',
      '.lp-list__item',
      '.lp-before__item',
      '.lp-faq__item',
      '.lp-author__credential',
      '.lp-free__body .lp-prose__line',
      '.lp-offer__eyebrow',
      '.lp-offer__heading',
      '.lp-offer__lead',
      '.lp-offer__label',
      '.lp-offer__state-text',
      '.lp-offer__chart-label',
      '.lp-offer__note',
      '.lp-offer__bridge-heading',
      '.lp-offer__cta',
      '.lp-join__title',
      '.lp-join__body .lp-prose__line',
      '.lp-join__reminder',
      '.lp-join__cta'
    ].join(','));
    SC.ui.scrollReveal(targets, { stagger: 120 });
  }

  /* 参加表明へ移動する（参加が確定するのは最終CTAのボタンだけ）*/
  function goToJoin() {
    var join = doc.getElementById('join');
    if (join) join.scrollIntoView({ block: 'start' });
    var btn = doc.getElementById('lp-join-btn');
    if (btn) btn.focus({ preventScroll: true });
  }

  /* --- LP専用テキストVSL｜22カード（正本§29-B）--------------------------
   * 句点による機械的な分割は廃止した。カードの並びと文言は正本そのまま。
   * 診断連動はCard 2〜3だけ（{score}／{axis}）。 */
  function buildCards(lp, diagnosis, lowestLabel) {
    var values = {
      score: String(diagnosis.totalScore) + '／' + SC.config.totalMax,
      axis: lowestLabel
    };
    var out = [];
    lp.vsl.chapters.forEach(function (chapter) {
      var meta = { key: chapter.key, title: chapter.title };
      chapter.cards.forEach(function (card) {
        var step = {
          chapter: meta,
          eyebrow: card.eyebrow || null,
          body: card.linked ? fill(card.body, values) : card.body
        };
        out.push(step);
      });
    });
    return out;
  }

  /* 「まとめて読む」も同じ22カードを、同じ順番で縦に展開する（§29-B） */
  function renderCardsFlat(cards) {
    var blocks = [];
    var current = null;
    cards.forEach(function (card) {
      if (!current || current.key !== card.chapter.key) {
        current = { key: card.chapter.key, items: [] };
        blocks.push(current);
        current.title = card.chapter.title;
      }
      current.items.push(card);
    });
    return h('div', { class: 'lp-story__flat' }, blocks.map(function (block) {
      return section(block.title, [
        h('div', { class: 'lp-story__flat-cards' }, block.items.map(function (card) {
          return h('p', { class: 'lp-story__flat-card' }, [
            card.eyebrow ? h('span', { class: 'lp-story__flat-eyebrow', text: card.eyebrow }) : null,
            h('span', { class: 'lp-story__flat-body', text: card.body })
          ]);
        }))
      ]);
    }));
  }

  function section(title, children) {
    return h('section', { class: 'lp-section' }, [
      h('h2', { class: 'lp-section__title', text: title })
    ].concat(children));
  }

  function prose(text) {
    return h('div', { class: 'lp-section__body lp-prose' }, SC.dom.sentences(text, 'lp-prose__line'));
  }

  var revealAfterReady = false;

  function boot() {
    var lp = SC.copy.lp;
    var diagnosis = SC.store.loadDiagnosis();
    var state = SC.store.loadChallengeState();
    var lowestLabel = SC.axisLabel(diagnosis.lowestAxis);

    setText('diagnosisName', SC.copy.diagnosisName);

    /* --- 0. ソフトな出し分け ------------------------------------------
     * 診断結果画面のCTAを押すと state.lpUnlocked が立つ。
     * 直接URLを開いた人には、先に診断結果を見てもらう案内だけを出す。 */
    if (!state.lpUnlocked) {
      setText('gateTitle', lp.gate.title);
      setText('gateBody', lp.gate.body);
      setText('gateCta', lp.gate.cta);
      doc.getElementById('lp-gate').hidden = false;
      return;
    }
    doc.getElementById('lp-main').hidden = false;
    SC.track.event('lp_view');

    /* --- 1. ヒーロー ---------------------------------------------------- */
    setText('heroEyebrow', lp.hero.eyebrow);
    setText('heroTitle', lp.hero.title);
    setText('heroSubtitle', lp.hero.subtitle);
    setProse('heroBody', lp.hero.body);
    setText('heroPrimaryCta', lp.hero.primaryCta);
    setText('heroSecondaryCta', lp.hero.secondaryCta);
    setText('heroMicro', lp.hero.micro);

    var scoreSlot = slot('scoreSlot');
    if (scoreSlot) {
      scoreSlot.appendChild(h('div', { class: 'lp-score' }, [
        h('span', { class: 'lp-score__value' }, [
          h('span', { class: 'lp-score__caption', text: '総合' }),
          h('span', { class: 'lp-score__num', text: String(diagnosis.totalScore) }),
          h('span', { class: 'lp-score__max', text: '／' + SC.config.totalMax })
        ]),
        h('span', { class: 'tag tag--band', text: diagnosis.scoreBand.label }),
        h('span', {
          class: 'lp-score__lowest',
          text: fill(lp.hero.lowestTemplate, { axis: lowestLabel })
        })
      ]));
    }

    /* --- 2〜7. 読み進めるブロック（テキスト型VSL）------------------------
     * 2026-08-21 とーる判断：ここがLPの教育部分なので、並べて読ませるのではなく
     * 順番に1枚ずつ送る。文言は§23-Bの確定分をそのまま使い、句点で区切っているだけ。
     * どこで区切るか・章ごとの本数はCodex／あかりが決め直せる（機械的な分割）。 */
    var cards = buildCards(lp, diagnosis, lowestLabel);
    var storySlot = slot('storyDeck');
    var deckApi = null;
    if (storySlot) {
      /* lp_deck_step は「その表示セッションで初めて到達したカード」だけ記録する（§29-A-2）。
         戻って進み直しても二重に記録しない。 */
      var reachedSteps = {};
      storySlot.appendChild(SC.ui.storyDeck({
        id: 'lp-story-deck',
        label: lp.vsl.chapters[0].title,
        steps: cards,
        finalCta: { label: lp.deck.more, onClick: function () { revealAfter(); } },
        renderAll: function () { return renderCardsFlat(cards); },
        expose: function (api) { deckApi = api; },
        onStep: function (i) {
          if (reachedSteps[i]) return;
          reachedSteps[i] = true;
          SC.track.event('lp_deck_step', { step: i + 1 });
        },
        onComplete: function () { SC.track.event('lp_deck_completed'); },
        onExpand: function () { SC.track.event('lp_deck_expanded'); revealAfter(); }
      }));

      /* ヒーローの「5日後に残るものを見る」は、成果物の章へ飛ばす */
      [].slice.call(doc.querySelectorAll('[data-lp-chapter]')).forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (!deckApi) return;
          deckApi.goToChapter(btn.getAttribute('data-lp-chapter'));
          var story = doc.getElementById('story');
          if (story) story.scrollIntoView({ block: 'start' });
        });
      });
    }

    /* --- 8. 適合性 ------------------------------------------------------ */
    setText('fitHeading', lp.fit.heading);
    list('fitFor', lp.fit.forItems);
    setText('fitNotForHeading', lp.fit.notForHeading);
    list('fitNotFor', lp.fit.notForItems);
    setText('fitNote', lp.fit.note);

    /* --- 9. 設計者プロフィール（実績が届くまで思想紹介のみ）-------------- */
    setText('authorHeading', lp.author.heading);
    setProse('authorBody', lp.author.body);
    setText('authorName', lp.author.name);
    setText('authorRole', lp.author.role);
    setText('authorCredential', lp.author.credential);
    setText('authorCredentialNote', lp.author.credentialNote);
    setText('authorQualification', lp.author.qualification);

    /* --- 10. 参加前の4項目 ---------------------------------------------- */
    setText('beforeHeading', lp.before.heading);
    var before = slot('beforeItems');
    if (before) {
      lp.before.items.forEach(function (item) {
        before.appendChild(h('li', { class: 'lp-before__item' }, [
          h('span', { class: 'lp-before__title', text: item.title }),
          h('span', { class: 'lp-before__body', text: item.body })
        ]));
      });
    }

    /* --- 11. よくある質問 ------------------------------------------------ */
    setText('faqHeading', lp.faq.heading);
    var faq = slot('faqItems');
    if (faq) {
      lp.faq.items.forEach(function (item) {
        faq.appendChild(h('details', { class: 'lp-faq__item' }, [
          h('summary', { class: 'lp-faq__q', text: item.q }),
          h('p', { class: 'lp-faq__a', text: item.a })
        ]));
      });
    }

    /* --- 11.4 参加費の説明（§36-3）--------------------------------------- */
    setText('freeHeading', lp.freeReason.heading);
    var freeSlot = slot('freeBody');
    if (freeSlot) {
      freeSlot.appendChild(SC.ui.prose(lp.freeReason.body, 'lp-prose__line'));
      freeSlot.appendChild(SC.ui.prose(lp.freeReason.body2, 'lp-prose__line'));
    }
    setText('freeNote', lp.freeReason.note);

    /* --- 11.5 参加直前の後押し（§34-D／§34-E）--------------------------
     * 順番は固定：現在地 → 向かう先 → 5日間の役割 → 負担・不安の軽減 → 次の行動。
     * 現在地と向かう先の本文は§17確定の axisReason／axisGoal をそのまま使う。
     * メーターは「診断時／改善仮説」と書き、5日後のスコアと読み違えられないようにする。 */
    var offerSlot = slot('offerSlot');
    if (offerSlot) {
      var o = lp.offer;
      var step = SC.config.improvementStep;
      var axisMax = SC.config.axisMax;
      var lowestNow = diagnosis.axisScores[diagnosis.lowestAxis] || 0;
      /* 改善仮説は20が上限（§34-E-3） */
      var lowestGoal = Math.min(axisMax, lowestNow + step);
      var improved = SC.ui.improvedScores(
        diagnosis.axisScores, diagnosis.lowestAxis, step, axisMax);

      offerSlot.appendChild(h('div', { class: 'lp-offer__inner' }, [
        /* 0. 導入 */
        h('p', { class: 'lp-offer__eyebrow', text: o.eyebrow }),
        h('h2', {
          class: 'lp-section__title lp-offer__heading',
          text: fill(o.headingTemplate, { axis: lowestLabel })
        }),
        h('p', { class: 'lp-offer__lead', text: o.lead }),

        /* 1. 現在地 */
        h('div', { class: 'lp-offer__step lp-offer__step--current' }, [
          h('p', { class: 'lp-offer__label', text: o.currentLabel }),
          h('p', { class: 'lp-offer__state-text', text: SC.copy.axisReason[diagnosis.lowestAxis] }),
          h('p', { class: 'lp-offer__chart-label', text: o.chartLabel }),
          SC.ui.radarChart({
            scores: diagnosis.axisScores,
            max: axisMax,
            lowestAxis: diagnosis.lowestAxis,
            improved: improved,
            animate: SC.motion.allowed()
          }),
          h('p', { class: 'lp-offer__note', text: o.chartNote })
        ]),

        /* 2. 向かう先 */
        h('div', { class: 'lp-offer__step lp-offer__step--target' }, [
          h('p', { class: 'lp-offer__label', text: o.targetLabel }),
          SC.ui.axisMeter({
            label: lowestLabel,
            value: lowestNow,
            target: lowestGoal,
            max: axisMax,
            nowLabel: o.meterNowLabel,
            targetLabel: o.meterGoalLabel,
            animate: SC.motion.allowed()
          }),
          h('p', { class: 'lp-offer__state-text', text: SC.copy.axisGoal[diagnosis.lowestAxis] })
        ]),

        /* 3. 5日間の役割 */
        h('div', { class: 'lp-offer__step lp-offer__step--bridge' }, [
          h('h3', { class: 'lp-offer__bridge-heading', text: o.bridgeHeading }),
          SC.ui.prose(o.bridgeBody, 'lp-prose__line')
        ]),

        /* 4. 負担・不安の軽減 */
        h('div', { class: 'lp-offer__step lp-offer__step--friction' }, [
          SC.ui.prose(o.frictionBody, 'lp-prose__line')
        ]),

        /* 5. 次の行動。ここでは参加を確定させない（§34-E-6） */
        h('div', { class: 'lp-offer__cta' }, [
          h('button', {
            type: 'button', class: 'btn btn--primary', id: 'lp-offer-btn', text: o.cta,
            on: { click: goToJoin }
          }),
          h('p', { class: 'lp-offer__cta-note', text: o.ctaNote })
        ])
      ]));
    }

    /* --- 12. 最終参加表明 ------------------------------------------------ */
    setText('joinHeading', lp.join.heading);
    setProse('joinBody', lp.join.body);

    /* 前に読み切っている人には、最初から先を見せる（毎回めくり直させない） */
    if (state.lpStoryRead) {
      doc.getElementById('lp-after').hidden = false;
      revealAfterReady = true;
    }

    var reminderSlot = slot('reminderSlot');
    var statusEl = doc.getElementById('lp-status');

    function renderReminder() {
      SC.dom.clear(reminderSlot);
      reminderSlot.appendChild(h('p', { class: 'lp-join__label', text: lp.join.reminderHeading }));
      reminderSlot.appendChild(SC.ui.choiceList({
        name: 'lp-reminder',
        legend: lp.join.reminderHeading,
        variant: 'inline',
        options: SC.config.reminderWindows,
        value: SC.store.getState().reminderWindow,
        selectedBadge: '選択中',
        onSelect: function (value) {
          SC.store.saveChallengeState({ reminderWindow: value });
          SC.track.event('reminder_window_selected');
          renderReminder();
          var again = doc.getElementById('lp-reminder-' + value);
          if (again) again.focus();
          statusEl.textContent = SC.copy.common.saved;
        }
      }));
    }
    if (reminderSlot) renderReminder();

    var joinBtn = doc.getElementById('lp-join-btn');
    var laterBtn = doc.getElementById('lp-later-btn');
    joinBtn.textContent = lp.join.primaryCta;
    laterBtn.textContent = lp.join.secondaryCta;

    joinBtn.addEventListener('click', function () {
      SC.store.setParticipation('joined', 'day1_focus');
      SC.track.event('participation_selected', { choice: 'joined' });
      global.location.href = APP_URL + '#/day1-focus';
    });

    laterBtn.addEventListener('click', function () {
      SC.store.setParticipation('later', 'result');
      SC.track.event('participation_selected', { choice: 'later' });
      global.location.href = APP_URL + '#/result';
    });

    /* --- ヒーロー・中間CTAは参加表明へスクロールするだけ ----------------- */
    /* ヒーロー主CTAは、読み進めるブロックの入口へ運ぶだけ（§36-1-1）*/
    [].slice.call(doc.querySelectorAll('[data-lp-vsl]')).forEach(function (btn) {
      btn.addEventListener('click', function () { goToStory(); });
    });

    /* 最初から開いている人にも、行ごとの出現を仕込む */
    if (revealAfterReady) startScrollReveal();

    /* --- 既読の人だけに出す「もう一度はじめから読む」（§36-2）--------------
     * 表示セッションのあいだだけ後半を閉じ、1枚目へ戻す。
     * 端末に残した既読の印（lpStoryRead）や、参加状態・DAY1〜5の回答は消さない。 */
    var restartSlot = slot('restartSlot');
    if (restartSlot && state.lpStoryRead) {
      restartSlot.appendChild(h('button', {
        type: 'button', class: 'btn btn--ghost lp-restart__btn', id: 'lp-restart-btn',
        text: lp.deck.restart,
        on: {
          click: function () {
            var after = doc.getElementById('lp-after');
            if (after) {
              after.hidden = true;
              after.classList.remove('is-revealing');
            }
            if (deckApi) deckApi.go(0);
            var story = doc.getElementById('story');
            if (story) story.scrollIntoView({ block: 'start' });
            focusStoryStart();
            SC.track.event('lp_story_restarted');
          }
        }
      }));
    }

    /* --- プレビュー用メニュー（本番では出さない）------------------------- */
    var previewSlot = doc.getElementById('preview-slot');
    if (previewSlot) {
      previewSlot.appendChild(h('details', { class: 'preview' }, [
        h('summary', { class: 'preview__summary', text: SC.copy.common.previewMenu }),
        h('p', { class: 'preview__note', text: SC.copy.common.previewNote }),
        h('div', { class: 'preview__actions' }, [
          h('button', {
            type: 'button', class: 'btn btn--ghost',
            on: { click: function () { SC.store.clearPreviewState(); global.location.href = APP_URL; } }
          }, SC.copy.common.previewReset)
        ])
      ]));
    }
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();

  SC.lp = { boot: boot };
})(window);
