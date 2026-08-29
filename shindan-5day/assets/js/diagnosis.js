/* diagnosis.js : 21問診断ページ（開発版）の画面と進行。
 *
 * 正本：診断設計書 v0.4（data/diagnosis-v04.js）／Notion §41-B
 * 保存：SC.diagnosisStore（画面から localStorage を直接触らない）
 * 通信：SC.diagnosisRemote（画面から GAS を直接呼ばない）
 *
 * ★校正前の開発版。一般公開・正式LINE接続はとーるの追加承認後。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;
  var doc = global.document;

  var root = null;
  var notice = null;          /* 起動直後に1回だけ出す案内 */
  var viewed = {};            /* *_view の二重発火防止 */

  function c() { return SC.diagnosisCopy; }
  function data() { return SC.diagnosisData; }
  function track(name, meta) { return SC.diagnosisTrack.event(name, meta); }

  function trackView(name, meta) {
    var k = name + ':' + (meta && meta.question ? meta.question : '');
    if (viewed[k]) return null;
    viewed[k] = true;
    return track(name, meta);
  }

  /* --- ルーティング ---------------------------------------------------- */
  function hashOf(view, no) {
    if (view === 'question') return '#/q' + no;
    if (view === 'scoring') return '#/scoring';
    return '#/result';
  }

  function parseHash() {
    var hash = global.location.hash || '';
    var m = /^#\/q(\d+)$/.exec(hash);
    if (m) return { view: 'question', no: parseInt(m[1], 10) };
    if (hash === '#/scoring') return { view: 'scoring' };
    if (hash === '#/result') return { view: 'result' };
    return null;
  }

  /* 到達してよい画面か確かめ、だめなら安全な場所へ落とす */
  function guard(target) {
    var state = SC.diagnosisStore.get();
    if (!target) target = { view: 'question', no: state.currentQuestion };

    if (target.view === 'question') {
      var no = target.no;
      /* 番号の範囲では見ない。並び順に実在する番号かで見る（2026-08-28）。
       * Q21のように、順番と番号が一致しない設問があるため。 */
      if (isNaN(no) || data().positionOf(no) === 0) {
        return { view: 'question', no: state.currentQuestion };
      }
      return { view: 'question', no: no };
    }
    /* 採点・結果は全問そろってから */
    if (!SC.diagnosisScore.isComplete(state.answers)) {
      var missing = SC.diagnosisScore.unanswered(state.answers);
      return { view: 'question', no: missing[0] };
    }
    if (target.view === 'result' && !state.completedAt) return { view: 'scoring' };
    return target;
  }

  function go(view, no) {
    var hash = hashOf(view, no);
    if (global.location.hash === hash) render();
    else global.location.hash = hash;
  }

  /* --- 共通パーツ ------------------------------------------------------ */
  function pageHeader(title, subtitle) {
    return h('header', { class: 'dg-head' }, [
      h('p', { class: 'dg-head__eyebrow' }, [
        h('span', { class: 'dg-badge', text: c().devBadge }),
        h('span', { class: 'dg-head__program', text: c().programName })
      ]),
      h('h1', { class: 'dg-head__title', text: title }),
      subtitle ? h('p', { class: 'dg-head__sub', text: subtitle }) : null
    ]);
  }

  /* 選ばれている項目の見た目だけを合わせ直す（作り直さない） */
  function syncSelected(fieldset) {
    var inputs = [].slice.call(fieldset.querySelectorAll('.choice__input'));
    inputs.forEach(function (input) {
      var li = input.parentNode;
      if (!li || !li.classList) return;
      if (input.checked) li.classList.add('is-selected');
      else li.classList.remove('is-selected');
    });
  }

  /* 進み具合は「何問目か」で出す。設問番号ではない。
   * Q21 は番号こそ21だが7問目なので、ここで取り違えると
   * 「21問中21問目」と出てしまう（2026-08-28）。 */
  function progressBar(no) {
    var total = data().questions.length;
    var phase = data().phaseOf(no);
    var position = data().positionOf(no);
    var pct = (position / total) * 100;
    return h('div', { class: 'dg-progress' }, [
      h('div', {
        class: 'dg-progress__track', role: 'img',
        'aria-label': '全' + total + '問中 ' + position + '問目' + (phase ? '（' + phase.title + '）' : '')
      }, [
        h('div', { class: 'dg-progress__fill', style: 'width:' + pct + '%' })
      ]),
      h('p', { class: 'dg-progress__meta' }, [
        h('span', {
          class: 'dg-progress__count',
          text: c().progress.replace('{current}', String(position)).replace('{total}', String(total))
        }),
        phase ? h('span', { class: 'dg-progress__phase', text: phase.title }) : null
      ])
    ]);
  }

  /* --- 画面①：質問 -----------------------------------------------------
   * 2026-08-24 とーる指示：「答えてから次へ」の2タップをやめる。
   * 選んだら自動で次の質問へ進み、戻るボタンだけを残す。
   * 選んだことが見えないまま切り替わらないよう、ごく短い間を置く。 */
  var ADVANCE_MS = 320;

  function renderQuestion(no) {
    var state = SC.diagnosisStore.get();
    /* 表現バリアントを通す。テストOFFのあいだは正本がそのまま返る（2026-08-25） */
    var q = SC.questionVariant.resolve(data().questionByNo(no));
    var answered = state.answers[no];
    var hasAnswer = answered !== undefined && answered !== null;
    var moving = false;   /* 続けて押しても飛ばしすぎないように */

    trackView('diagnosis_question_view', { question: no });

    var choices = SC.ui.choiceList({
      name: 'q' + no,
      legend: q.text,
      value: hasAnswer ? answered : null,
      options: q.options.map(function (label, i) {
        return { value: i, label: label };
      }),
      onSelect: function (value) {
        if (moving) return;
        SC.diagnosisStore.setAnswer(no, value);
        track('diagnosis_answer_selected', { question: no });
        syncSelected(choices);
        moving = true;
        global.setTimeout(function () {
          /* 次の設問は番号を足して求めない。並び順から引く（2026-08-28） */
          var next = data().nextNo(no);
          if (next === null) {
            SC.diagnosisStore.setCurrentQuestion(no);
            go('scoring');
            return;
          }
          SC.diagnosisStore.setCurrentQuestion(next);
          go('question', next);
        }, ADVANCE_MS);
      }
    });

    /* 文字と選択肢が順に現れるよう、並び順を持たせる（2026-08-24 とーる指示） */
    var order = 0;
    [].slice.call(choices.querySelectorAll('.choice')).forEach(function (li) {
      order += 1;
      li.style.setProperty('--i', String(order));
    });

    return h('div', { class: 'dg-screen dg-screen--question' }, [
      pageHeader(c().title, null),
      progressBar(no),

      notice ? h('p', { class: 'dg-notice', role: 'status', 'aria-live': 'polite', text: notice }) : null,

      h('section', { class: 'dg-card' }, [
        h('h2', { class: 'dg-question', text: q.text }),
        choices
      ]),

      /* 進むボタンは置かない。戻るときだけ押してもらう。
       * 戻り先も番号を引き算せず、並び順から求める（2026-08-28） */
      data().prevNo(no) !== null
        ? h('div', { class: 'dg-nav dg-nav--back' }, [
            h('button', {
              type: 'button', class: 'btn btn--ghost', id: 'dg-back',
              on: { click: function () {
                var prev = data().prevNo(no);
                track('diagnosis_back_clicked', { question: no });
                SC.diagnosisStore.setCurrentQuestion(prev);
                go('question', prev);
              } }
            }, c().back)
          ])
        : null,

      h('p', { class: 'dg-foot-note', text: c().autoAdvanceNote }),
      h('p', { class: 'dg-foot-note', text: c().savedNote })
    ]);
  }

  /* --- 画面②：採点中（結果直前の3文｜v0.4 §7 ＋ 2026-08-24 とーる指示）----
   * 「ちゃんと見てくれている」と伝わるよう、段階を順に済ませていく。
   * 進み具合のバーで、あとどれくらいかも見えるようにする。
   * ★v0.4 §9の禁止表現（弱点／失敗原因／足りないもの）は使わない。 */
  var scoringTimers = [];

  function clearScoringTimers() {
    scoringTimers.forEach(function (t) { global.clearTimeout(t); global.clearInterval(t); });
    scoringTimers = [];
  }

  function renderScoring() {
    trackView('diagnosis_scoring_view');
    clearScoringTimers();

    var steps = data().scoringSteps;
    var totalMs = data().scoringTotalMs;
    var stepMs = Math.round(totalMs / steps.length);
    var reduced = !SC.motion.allowed();

    var items = steps.map(function (step, i) {
      return h('li', {
        class: 'dg-step' + (reduced ? ' is-done' : (i === 0 ? ' is-doing' : '')),
        dataset: { step: String(i) }
      }, [
        h('span', { class: 'dg-step__mark', 'aria-hidden': 'true' }),
        h('span', { class: 'dg-step__text', text: reduced ? step.done : step.doing })
      ]);
    });

    var fill = h('div', { class: 'dg-bar__fill', style: 'width:' + (reduced ? '100%' : '0%') });
    var remain = h('p', { class: 'dg-bar__remain', text: reduced ? c().scoringDone : '' });

    var bar = h('div', { class: 'dg-bar' }, [
      h('div', {
        class: 'dg-bar__track', role: 'progressbar',
        'aria-valuemin': '0', 'aria-valuemax': '100',
        'aria-valuenow': reduced ? '100' : '0',
        'aria-label': c().scoringTitle
      }, [fill]),
      remain
    ]);

    var el = h('div', { class: 'dg-screen dg-screen--scoring' }, [
      pageHeader(c().scoringTitle, c().scoringStatic),
      h('section', { class: 'dg-card dg-scoring' }, [
        bar,
        h('ol', { class: 'dg-scoring__list', role: 'status', 'aria-live': 'polite' }, items)
      ]),
      /* 動きを減らす設定では待たせない。押せばすぐ結果へ進める（依頼5） */
      reduced
        ? h('div', { class: 'dg-nav dg-nav--single' }, [
            h('button', {
              type: 'button', class: 'btn btn--primary',
              on: { click: function () { finishScoring(); } }
            }, c().toResult)
          ])
        : null
    ]);

    if (reduced) return el;

    var startedAt = Date.now();

    /* 進み具合。時間で計算するので、裏で描画が止まっても数字がずれない */
    var tick = global.setInterval(function () {
      var ratio = Math.min(1, (Date.now() - startedAt) / totalMs);
      fill.style.width = (ratio * 100).toFixed(1) + '%';
      bar.firstChild.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
      var left = Math.max(0, Math.ceil((totalMs - (Date.now() - startedAt)) / 1000));
      remain.textContent = left > 0
        ? c().scoringRemaining.replace('{sec}', String(left))
        : c().scoringDone;
    }, 120);
    scoringTimers.push(tick);

    /* 段階を順に「済み」へ変えていく */
    steps.forEach(function (step, i) {
      var t = global.setTimeout(function () {
        var li = items[i];
        li.className = 'dg-step is-done';
        li.querySelector('.dg-step__text').textContent = step.done;
        if (items[i + 1]) items[i + 1].className = 'dg-step is-doing';
      }, (i + 1) * stepMs);
      scoringTimers.push(t);
    });

    scoringTimers.push(global.setTimeout(finishScoring, totalMs + 350));
    return el;
  }

  function finishScoring() {
    clearScoringTimers();
    var state = SC.diagnosisStore.get();
    if (!SC.diagnosisScore.isComplete(state.answers)) { render(); return; }
    /* 二重送信防止：complete() は採点済みならそのまま返す */
    var before = state.completedAt;
    SC.diagnosisStore.complete();
    if (!before) track('diagnosis_completed');
    go('result');
  }

  /* --- 画面③：簡易結果 -------------------------------------------------- */
  function renderResult() {
    var state = SC.diagnosisStore.get();
    trackView('diagnosis_result_view');

    var record = SC.diagnosisStore.toDiagnosisRecord();
    var animate = SC.motion.once('diagnosis-result');

    var el = h('div', { class: 'dg-screen dg-screen--result' }, [
      pageHeader(c().resultTitle, null),
      h('p', { class: 'dg-devnote', text: c().devNotice }),
      SC.ui.diagnosisResult(record, { animate: animate }),
      handoffBlock()
    ]);

    if (animate) SC.motion.countUp(el, { duration: 900, stagger: 90, delay: 120 });
    return el;
  }

  /* --- 引き継ぎブロック（依頼7 ＋ 2026-08-24 とーる指示）------------------
   * 直したところ：
   *  ・結果画面を開いた時点で保存とキー発行を済ませておく（押してから待たせない）
   *  ・ボタンは押した瞬間にコピーする。iOSは「押した流れ」から外れるとコピーできないため、
   *    先に用意しておくこの形でないと失敗しやすい（実機で失敗を確認済み）
   *  ・「コピーしてください」と頼まない。押せば自然に済んでいる形にする
   *  ・「あと◯分◯秒とっておきます」を出して、急かさずに期限を伝える
   */
  var handoffTimer = null;

  function clearHandoffTimer() {
    if (handoffTimer) { global.clearInterval(handoffTimer); handoffTimer = null; }
  }

  function timeText(totalSec) {
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    if (m <= 0) return s + '秒';
    return m + '分' + (s > 0 ? s + '秒' : '');
  }

  function handoffSecondsLeft() {
    var state = SC.diagnosisStore.get();
    if (!state.handoffIssuedAt) return 0;
    var ttl = SC.diagnosisConfig.handoff.ttlMinutes * 60 * 1000;
    var left = ttl - (Date.now() - Date.parse(state.handoffIssuedAt));
    return Math.max(0, Math.floor(left / 1000));
  }

  function handoffBlock() {
    var box = h('section', { class: 'dg-card dg-handoff' });
    prepareHandoff(box);
    return box;
  }

  /* 画面を開いた時点で、保存とキー発行を済ませておく */
  function prepareHandoff(box) {
    var existing = SC.diagnosisStore.activeHandoffKey();
    if (existing) { renderHandoff(box); return; }

    var record = SC.diagnosisStore.toDiagnosisRecord();
    if (!record) return;

    SC.dom.clear(box);
    SC.dom.append(box, [
      h('h2', { class: 'dg-card__title', text: c().handoffHeading }),
      h('p', { class: 'dg-handoff__status', role: 'status', 'aria-live': 'polite', text: c().handoffSaving })
    ]);

    SC.diagnosisRemote.saveResultAndIssueKey(record).then(function (res) {
      if (!res.ok || !res.handoffKey) {
        SC.dom.clear(box);
        SC.dom.append(box, [
          h('h2', { class: 'dg-card__title', text: c().handoffHeading }),
          h('p', { class: 'dg-handoff__warn', text: c().handoffSaveFailed }),
          h('button', {
            type: 'button', class: 'btn btn--ghost',
            on: { click: function () { prepareHandoff(box); } }
          }, c().handoffRetry)
        ]);
        return;
      }
      SC.diagnosisStore.setHandoff('issued', res.handoffKey);
      renderHandoff(box);
    });
  }

  function renderHandoff(box) {
    clearHandoffTimer();
    var state = SC.diagnosisStore.get();
    var key = SC.diagnosisStore.activeHandoffKey();

    SC.dom.clear(box);

    /* 期限切れ。もう一度用意し直す */
    if (!key) {
      SC.dom.append(box, [
        h('h2', { class: 'dg-card__title', text: c().handoffHeading }),
        h('p', { class: 'dg-handoff__warn', text: c().handoffExpired }),
        h('button', {
          type: 'button', class: 'btn btn--primary',
          on: { click: function () { prepareHandoff(box); } }
        }, c().handoffRetry)
      ]);
      return;
    }

    var copied = state.handoffStatus === 'copied';
    var keep = h('p', { class: 'dg-handoff__keep' });

    function refreshKeep() {
      var left = handoffSecondsLeft();
      if (left <= 0) { renderHandoff(box); return; }
      var warnSec = SC.diagnosisConfig.handoff.warnMinutes * 60;
      var template = left <= warnSec ? c().handoffKeepShort : c().handoffKeep;
      keep.textContent = template.replace('{time}', timeText(left));
      keep.className = 'dg-handoff__keep' + (left <= warnSec ? ' is-soon' : '');
    }
    refreshKeep();
    handoffTimer = global.setInterval(refreshKeep, 1000);

    var status = h('p', { class: 'dg-handoff__status', role: 'status', 'aria-live': 'polite' });
    var manual = h('div', { class: 'dg-handoff__manual', hidden: true });

    var cta = h('button', {
      type: 'button', class: 'btn btn--primary',
      on: { click: function () {
        /* ★押した流れの中で、そのままコピーする（間に通信を挟まない） */
        track('handoff_copy_attempted');
        copyText(key, function (ok) {
          if (ok) {
            SC.diagnosisStore.setHandoff('copied');
            track('handoff_copy_succeeded');
            status.className = 'dg-handoff__done';
            status.textContent = c().handoffCopied;
            SC.dom.clear(manual);
            SC.dom.append(manual, h('p', { class: 'dg-handoff__note', text: c().handoffCopiedNote }));
            manual.hidden = false;
            cta.disabled = true;
          } else {
            track('handoff_copy_failed');
            status.className = 'dg-handoff__warn';
            status.textContent = c().handoffCopyFailed;
            SC.dom.clear(manual);
            SC.dom.append(manual, manualBox(key));
            manual.hidden = false;
          }
        });
      } }
    }, c().handoffCta);

    if (copied) {
      cta.disabled = true;
      status.className = 'dg-handoff__done';
      status.textContent = c().handoffCopied;
      SC.dom.append(manual, h('p', { class: 'dg-handoff__note', text: c().handoffCopiedNote }));
      manual.hidden = false;
    }

    SC.dom.append(box, [
      h('h2', { class: 'dg-card__title', text: c().handoffHeading }),
      h('p', { class: 'dg-handoff__body', text: c().handoffBody }),
      cta,
      keep,
      status,
      manual
    ]);
  }

  /* 自動で用意できなかったときだけ出す保険。
   * ★ここが唯一の平文の置き場。URL・ログ・計測へは出さない（依頼8） */
  function manualBox(key) {
    var field = h('textarea', {
      class: 'dg-handoff__field', rows: '2', readonly: true,
      'aria-label': c().handoffManualLabel
    });
    field.value = key;
    return h('div', {}, [
      h('p', { class: 'dg-handoff__manual-label', text: c().handoffManualLabel }),
      field
    ]);
  }

  /* コピー。押した流れの中で同期的に走らせる */
  function copyText(text, done) {
    function fallback() {
      var ta = doc.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      doc.body.appendChild(ta);
      ta.select();
      try { ta.setSelectionRange(0, text.length); } catch (e) { /* noop */ }
      var ok = false;
      try { ok = doc.execCommand('copy'); } catch (e2) { ok = false; }
      doc.body.removeChild(ta);
      done(ok);
    }
    if (global.navigator.clipboard && global.navigator.clipboard.writeText) {
      global.navigator.clipboard.writeText(text)
        .then(function () { done(true); })['catch'](fallback);
    } else {
      fallback();
    }
  }

  /* --- 開発版メニュー（本番公開物には出さない）-------------------------- */
  function buildDevPanel() {
    var logBox = h('pre', { class: 'preview__log', hidden: true });
    var open = false;

    function fill(pick) {
      var answers = {};
      data().questions.forEach(function (q) { answers[q.no] = pick(q); });
      SC.diagnosisStore.applyAnswerSet(answers, 'devfill');
      viewed = {};
      go('result');
    }

    return h('details', { class: 'preview' }, [
      h('summary', { class: 'preview__summary', text: c().devPanel }),
      h('p', { class: 'preview__note', text: c().devNotice }),
      h('p', { class: 'preview__meta',
        text: '診断 v' + data().version + ' ／ 保存先 ' + SC.storage.driver +
              ' ／ 通信 ' + SC.diagnosisRemote.driverName() +
              ' ／ 乱数 ' + (SC.handoffKey.hasSecureRandom() ? 'OK' : '簡易') }),
      h('div', { class: 'preview__actions' }, [
        h('button', {
          type: 'button', class: 'btn btn--ghost',
          on: { click: function () {
            SC.diagnosisStore.reset();
            SC.diagnosisRemote._devClear();
            SC.diagnosisStore.load();
            notice = c().devResetDone;
            viewed = {};
            go('question', 1);
          } }
        }, c().devReset),
        h('button', {
          type: 'button', class: 'btn btn--ghost',
          on: { click: function () { fill(function () { return 0; }); } }
        }, '全部いちばん上'),
        h('button', {
          type: 'button', class: 'btn btn--ghost',
          on: { click: function () { fill(function () { return 4; }); } }
        }, '全部いちばん下'),
        h('button', {
          type: 'button', class: 'btn btn--ghost',
          on: { click: function () { fill(function (q) { return q.no % 5; }); } }
        }, 'ばらばら'),
        h('button', {
          type: 'button', class: 'btn btn--ghost',
          on: { click: function () {
            open = !open;
            logBox.hidden = !open;
            logBox.textContent = JSON.stringify(SC.diagnosisTrack.list(), null, 2);
          } }
        }, '計測ログを見る')
      ]),
      logBox
    ]);
  }

  /* --- 描画 ------------------------------------------------------------- */
  function render(focusId) {
    var target = guard(parseHash());
    var el;
    if (target.view === 'question') el = renderQuestion(target.no);
    else if (target.view === 'scoring') el = renderScoring();
    else el = renderResult();

    SC.dom.clear(root);
    /* 画面が入れ替わるたび、文字と選択肢を順に浮かび上がらせる。
     * 動きが苦手な設定では付けない（最初から見えたまま）。 */
    if (SC.motion.allowed()) el.classList.add('is-entering');
    root.appendChild(el);
    notice = null;

    var wanted = hashOf(target.view, target.no);
    if (global.location.hash !== wanted) {
      global.history.replaceState(null, '', wanted);
    }

    if (focusId) {
      var f = doc.getElementById(focusId);
      if (f) { f.focus({ preventScroll: true }); return; }
    }
    var title = el.querySelector('.dg-head__title');
    if (title) { title.setAttribute('tabindex', '-1'); title.focus({ preventScroll: true }); }
    global.scrollTo(0, 0);
  }

  function onHashChange() { viewed = {}; render(); }

  /* はじめかた画面の光から、そのままつながって見えるようにする。
   * 白い幕をかぶせた状態で始め、すぐに晴らす。 */
  function fadeFromFlash() {
    var came = false;
    try {
      came = global.sessionStorage.getItem('sc_from_intro') === '1';
      global.sessionStorage.removeItem('sc_from_intro');
    } catch (e) { came = false; }
    if (!came || !SC.motion.allowed()) return;

    var veil = h('div', { class: 'dg-veil is-on', 'aria-hidden': 'true' });
    doc.body.appendChild(veil);
    global.setTimeout(function () { veil.classList.remove('is-on'); }, 30);
    global.setTimeout(function () {
      if (veil.parentNode) veil.parentNode.removeChild(veil);
    }, 1200);
  }

  function boot() {
    root = doc.getElementById('dg-app');
    var slot = doc.getElementById('dg-dev-slot');
    fadeFromFlash();

    var state = SC.diagnosisStore.load();
    var status = SC.diagnosisStore.lastLoadStatus();
    if (status === 'restored') notice = c().restoredNote;
    else if (status === 'recovered') notice = c().recoveredNote;
    else if (status === 'new') track('diagnosis_started');

    if (slot) slot.appendChild(buildDevPanel());
    global.addEventListener('hashchange', onHashChange);

    if (!parseHash()) {
      global.history.replaceState(null, '', hashOf('question', state.currentQuestion));
    }
    render();
  }

  SC.diagnosisApp = { boot: boot, render: render, guard: guard, go: go };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
