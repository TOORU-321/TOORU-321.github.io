/* restore.js : LINE内の診断結果 復元画面（依頼10）
 *
 * 流れ
 *   1. 「診断結果を確認しています」
 *   2. uidをURLから取得
 *   3. uidだけで既存結合を検索
 *   4. 既に結合済みなら結果を復元
 *   5. 未結合ならクリップボード自動読取を試す
 *   6. 有効な内容が見つかれば、復元確認を表示
 *   7. 確認後に結合
 *   8. 読めない場合は貼り付け欄を表示
 *   9. 成功後に詳細結果へ進む
 *
 * ★「コード」「認証コード」「トークン」という言葉を画面に出さない（§41-A）
 * ★uidをHTML・エラー表示・コンソール・計測へ残さない（依頼11・19）
 * ★自動読取が拒否されても、貼り付けだけで完了できる（依頼12）
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;
  var doc = global.document;

  /* uidはこの閉じた変数の中だけに置く。DOM・URL・ログへ書かない */
  var uid = null;
  /* LINEの表示名（2026-09-11）。uidと同じ扱い。
   * 画面・計測・コンソールへは出さない。渡す先は結合の記録だけ。 */
  var lineName = null;
  var root = null;
  var clipboardTried = 0;

  function c() { return SC.diagnosisCopy; }
  function track(name, meta) { return SC.diagnosisTrack.event(name, meta); }

  /* 復元のときに一緒に返ってきた、5日間チャレンジの続き */
  var carriedChallenge = null;

  function readUidFromUrl() {
    var m = /[?&]uid=([^&#]*)/.exec(global.location.search);
    if (!m) return null;
    var v = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim();
    if (!v) return null;
    /* プロラインのuidは英数字と記号少々。長すぎるものは受け取らない */
    if (v.length > 120) return null;
    return v;
  }

  /* LINEの表示名を取り出す（2026-09-11）。
   * プロラインが `&name=%%snsname%%` で入れてくれる。
   * ★長すぎるもの・制御文字は受け取らない。 */
  function readNameFromUrl() {
    var m = /[?&]name=([^&#]*)/.exec(global.location.search);
    if (!m) return null;
    var v;
    try {
      v = decodeURIComponent(m[1].replace(/\+/g, ' '));
    } catch (e) {
      return null;
    }
    v = String(v).replace(/[\u0000-\u001f\u007f]/g, '').trim();
    if (!v) return null;
    /* 置き換えられなかったとき（変数のまま来たとき）は受け取らない */
    if (v.indexOf('%%') > -1) return null;
    return v.slice(0, 60);
  }

  /* URLからuidを外す（依頼11）。戻る操作でも復活しないよう置き換える */
  function stripUidFromUrl() {
    if (!global.history || !global.history.replaceState) return;
    var clean = global.location.pathname + global.location.hash;
    global.history.replaceState(null, '', clean);
  }

  function head(title) {
    return h('header', { class: 'dg-head' }, [
      h('p', { class: 'dg-head__eyebrow' }, [
        SC.config.devTools() ? h('span', { class: 'dg-badge', text: c().devBadge }) : null,
        h('span', { class: 'dg-head__program', text: c().programName })
      ]),
      h('h1', { class: 'dg-head__title', text: title })
    ]);
  }

  function show(children) {
    SC.dom.clear(root);
    SC.dom.append(root, children);
    var title = root.querySelector('.dg-head__title');
    if (title) { title.setAttribute('tabindex', '-1'); title.focus({ preventScroll: true }); }
  }

  /* --- 1. 確認中 -------------------------------------------------------- */
  function viewChecking() {
    show([
      head(c().restoreChecking),
      h('section', { class: 'dg-card dg-checking', role: 'status', 'aria-live': 'polite' }, [
        h('span', { class: 'dg-spinner', 'aria-hidden': 'true' }),
        h('p', { class: 'dg-checking__text', text: c().restoreChecking })
      ])
    ]);
  }

  /* --- uidが無い（LINEのメッセージ以外から開かれた）--------------------- */
  function viewNoUid() {
    show([
      head(c().restoreHeading),
      h('section', { class: 'dg-card' }, [
        h('p', { class: 'dg-handoff__body', text: c().restoreNoUid })
      ])
    ]);
  }

  /* --- 6. 復元確認 ------------------------------------------------------ */
  function viewConfirm(key) {
    show([
      head(c().restoreConfirmHeading),
      h('section', { class: 'dg-card' }, [
        h('p', { class: 'dg-handoff__body', text: c().restoreConfirmBody }),
        h('div', { class: 'dg-nav dg-nav--stack' }, [
          h('button', {
            type: 'button', class: 'btn btn--primary',
            on: { click: function () { bind(key, 'clipboard'); } }
          }, c().restoreConfirmCta),
          h('button', {
            type: 'button', class: 'btn btn--ghost',
            on: { click: function () { viewPaste(null); } }
          }, c().restoreConfirmCancel)
        ])
      ])
    ]);
  }

  /* --- 8. 貼り付け欄（常に到達できる保険｜依頼12）----------------------- */
  function viewPaste(errorMessage) {
    var field = h('textarea', {
      id: 'dg-paste', class: 'dg-handoff__field', rows: '3',
      autocapitalize: 'characters', autocorrect: 'off', spellcheck: 'false'
    });
    var status = h('p', {
      class: 'dg-warn', role: 'status', 'aria-live': 'polite',
      text: errorMessage || '', hidden: !errorMessage
    });

    /* 手で貼り付ける欄は、最初は隠しておく（2026-09-01 とーる指摘）。
     * まず下のボタン一つで済ませてもらい、だめだったときだけ出す。 */
    var manualCta = h('button', {
      type: 'button', class: 'btn btn--ghost',
      on: { click: function () {
        /* 空のまま押されたときに「もう一度貼り付けて」と言わない（2026-09-01）。
         * 一度も貼っていない人に「もう一度」は通じないため、分けて伝える。 */
        if (!field.value || !field.value.replace(/\s+/g, '')) {
          status.hidden = false;
          status.textContent = c().restorePasteEmpty;
          field.focus();
          return;
        }
        var key = SC.handoffKey.normalize(field.value);
        if (!key) {
          track('handoff_bind_failed');
          status.hidden = false;
          status.textContent = SC.diagnosisRemote.MESSAGES.handoff_rejected;
          return;
        }
        track('handoff_manual_paste_used');
        bind(key, 'paste');
      } }
    }, c().restoreCta);

    var manualArea = h('div', { class: 'dg-handoff__manual', hidden: !errorMessage }, [
      h('label', { class: 'dg-handoff__manual-label', for: 'dg-paste', text: c().restoreInputLabel }),
      field,
      status,
      h('div', { class: 'dg-nav dg-nav--single' }, [manualCta])
    ]);

    function showManual(message) {
      manualArea.hidden = false;
      status.hidden = false;
      status.textContent = message;
      field.focus();
    }

    /* ★ボタンを押した流れの中でクリップボードを読む（2026-09-01）。
     *
     * これまでは画面を開いた瞬間に読んでいた。ユーザーが何も押していない
     * ところでの読み取りは、iOSのLINE内ブラウザでは拒否される。
     * とーるの実機確認でも、毎回「長押し→ペースト」が必要になっていた。
     *
     * 押した直後なら許可されることがあるので、ここで読み直す。
     * だめでも従来どおり手で貼り付ける道を残す。 */
    var autoPaste = h('button', {
      type: 'button', class: 'btn btn--primary',
      on: { click: function () {
        if (!(global.navigator.clipboard && global.navigator.clipboard.readText)) {
          track('handoff_clipboard_failed');
          showManual(c().restoreAutoPasteUnsupported);
          return;
        }
        track('handoff_clipboard_attempted');
        global.navigator.clipboard.readText().then(function (text) {
          var key = SC.handoffKey.normalize(text);
          if (!key) {
            track('handoff_clipboard_failed');
            showManual(c().restoreAutoPasteNotFound);
            return;
          }
          track('handoff_clipboard_succeeded');
          bind(key, 'auto-paste');
        })['catch'](function () {
          track('handoff_clipboard_failed');
          showManual(c().restoreAutoPasteDenied);
        });
      } }
    }, c().restoreAutoPasteCta);

    show([
      head(c().restoreHeading),
      h('section', { class: 'dg-card' }, [
        h('p', { class: 'dg-handoff__body', text: c().restoreAutoPasteBody }),
        h('div', { class: 'dg-nav dg-nav--single' }, [autoPaste]),
        manualArea
      ]),

      /* 診断をまだ受けていない人の行き止まりをなくす（2026-09-01）。
       * 貼るものを持っていない人が、ここで詰まらないようにする。 */
      h('section', { class: 'dg-card dg-card--quiet' }, [
        h('h2', { class: 'dg-subhead', text: c().restoreNotYetHeading }),
        h('p', { class: 'dg-handoff__body', text: c().restoreNotYetBody }),
        h('div', { class: 'dg-nav dg-nav--single' }, [
          /* uid付きURLを外部リンクへ引き継がない（依頼11） */
          h('a', {
            class: 'btn btn--ghost', href: 'shindan-lp.html', rel: 'noreferrer'
          }, c().restoreNotYetCta)
        ])
      ])
    ]);
  }

  /* --- 9. 復元できた ---------------------------------------------------- */
  function viewResult(record) {
    /* 5DAY本体がこの結果を読めるようにしておく（2026-08-31）。
     * これをしないと「詳しい結果を見る」の先でサンプルの47点が出る。
     *
     * uidも一緒に渡す。5DAY側からLINEへ通知を送るのに要るため。
     * uidは画面・URL・計測・コンソールへは出さない（依頼11）。 */
    SC.diagnosisBridge.handOverRecord(record, uid);

    /* 別の端末で進めていた続きがあれば、この端末へ持ってくる（2026-09-10）。
     * この端末にすでに続きがあるときは、何もしない（store側で判断する）。 */
    if (carriedChallenge && SC.store && SC.store.adoptChallengeState) {
      SC.store.adoptChallengeState(carriedChallenge);
    }

    var animate = SC.motion.once('restore-result');
    var el = h('div', { class: 'dg-screen dg-screen--result' }, [
      head(c().resultTitle),
      SC.config.devTools() ? h('p', { class: 'dg-devnote', text: c().devNotice }) : null,
      h('p', { class: 'dg-notice', role: 'status', 'aria-live': 'polite', text: c().restoreDone }),
      SC.ui.diagnosisResult(record, { animate: animate }),
      h('div', { class: 'dg-nav dg-nav--single' }, [
        /* uid付きURLを外部リンクへ引き継がない（依頼11） */
        h('a', {
          class: 'btn btn--primary', href: 'index.html', rel: 'noreferrer'
        }, c().restoreNextCta)
      ]),

      /* もう一度診断を受けた人のための切り替え（2026-09-10）。
       *
       * ふつうは、診断が終わった時点でLINE側も自動で新しくなる。
       * ここが要るのは、端末の保存が消えた人・別の端末で受け直した人。
       * その端末はもうuidを知らないので、自動では張り替えられない。
       *
       * ★小さな注記では気づかれない（2026-09-10 見直し）。
       *   最初はカードとして出し、押した流れの中でだけ合図を読む。
       *   開いた瞬間に読むと、iOSのLINE内ブラウザで必ず拒否される。 */
      h('section', { class: 'dg-card dg-card--quiet' }, [
        h('h2', { class: 'dg-subhead', text: c().restoreSwitchHeading }),
        h('div', { class: 'dg-switch__body' },
          SC.dom.lines(c().restoreSwitchNote, 'dg-handoff__body')),
        h('div', { class: 'dg-nav dg-nav--single' }, [
          h('button', {
            type: 'button', class: 'btn btn--ghost',
            on: { click: function (e) { switchToNewest(e.currentTarget); } }
          }, c().restoreSwitchCta)
        ])
      ])
    ]);
    show([el]);
    if (animate) SC.motion.countUp(el, { duration: 900, stagger: 90, delay: 120 });
  }

  /* もう一度受けた診断へ切り替える（2026-09-10）。
   *
   * 新しい合図を持っていることが、本人が受け直した証拠になる。
   * GAS側は、その合図を確かめてから結合の行き先を書き換える。 */
  function switchToNewest(btn) {
    if (btn) { btn.disabled = true; btn.textContent = c().restoreChecking; }
    var done = function (label) {
      if (!btn) return;
      btn.disabled = false;
      btn.textContent = label;
    };

    if (!(global.navigator.clipboard && global.navigator.clipboard.readText)) {
      done(c().restoreSwitchFailed);
      return;
    }
    global.navigator.clipboard.readText().then(function (text) {
      var key = (text || '').trim();
      if (!key) { done(c().restoreSwitchFailed); return; }
      SC.diagnosisRemote.bindWithKey(uid, key, lineName, ticketForKey()).then(function (res) {
        if (res.ok && res.result) {
          track('handoff_switch_succeeded');
          viewResult(res.result);
          return;
        }
        track('handoff_switch_failed');
        done(c().restoreSwitchFailed);
      });
    })['catch'](function () {
      done(c().restoreSwitchFailed);
    });
  }

  /* --- 7. 結合 ---------------------------------------------------------- */
  function bind(key, from) {
    viewChecking();
    SC.diagnosisRemote.bindWithKey(uid, key, lineName, ticketForKey()).then(function (res) {
      if (res.ok) {
        track('handoff_bind_succeeded', { cta: from });
        stripUidFromUrl();
        SC.diagnosisStore.setHandoff('bound');
        viewResult(res.result);
        return;
      }
      track('handoff_bind_failed', { cta: from });
      /* 券が要る断り方なら、確認のやり直し・権限不足の画面へ（2026-09-19）。
       * 戻り先は、いま来た貼り付け画面 */
      if (handleDenied(res, viewPaste)) return;
      viewPaste(res.message);
    });
  }

  /* --- 4-B. 確認コード（2026-09-19 とーる指示／Codex確定本文）-----------
   *
   * ★この画面は「必要になったとき」だけ出す。
   *   新規の人みんなに、無条件で入力を求めない。
   * ★自動でコードを送る仕組みは無い。「コードを送りました」とは出さない。
   * ★コードが通っただけでは「復元しました」と言わない。
   *   記録を取り出せたときに、はじめて復元完了。
   * -------------------------------------------------------------------- */

  /* サーバーに断られたときに、どの画面を出すか（2026-09-19 Codex §4）。
   *
   * ★通信できなかったこと（unavailable／busy）を、
   *   確認のやり直しへ誤って誘導しない。
   * ★券は使えるのに権限が足りないときは、やり直しへ送らない。
   *   もう一度コードを入れても結果は変わらないため。
   * ★券の話でないときは false を返し、これまでどおりの画面に任せる。
   *
   * 戻り値：この関数が画面を出したら true */
  function handleDenied(res, backTo) {
    var kind = SC.authGate ? SC.authGate.decide(res && res.status) : null;
    if (kind === 'reauth') {
      viewReauth(backTo);
      return true;
    }
    if (kind === 'forbidden') {
      track('record_not_allowed');
      viewRecordNotAllowed();
      return true;
    }
    return false;   /* 'retry'（通信・一時停止）も、これまでどおりの案内に任せる */
  }

  /* いま持っている、その診断記録の券（あれば） */
  function ticketForKey() {
    if (!SC.credentials) return null;
    var st = SC.diagnosisStore.get();
    return SC.credentials.diagnosisTicket(st && st.anonymousDiagnosisId);
  }

  /* 再認証のご案内。ここから入力へ進む。
   * ★戻れる道（backTo）を必ず残す。行き止まりにしない。 */
  function viewReauth(backTo) {
    track('reauth_view');
    if (SC.authGate) SC.authGate.noteReauthShown();
    var back = backTo || viewPaste;
    show([
      head(c().reauthHeading),
      h('section', { class: 'dg-card' }, [
        SC.ui.prose ? SC.ui.prose(c().reauthBody)
                    : h('p', { class: 'dg-handoff__body', text: c().reauthBody }),
        h('div', { class: 'dg-nav dg-nav--stack' }, [
          h('button', {
            type: 'button', class: 'btn btn--primary',
            on: { click: function () { viewCode(null, back); } }
          }, c().reauthPrimaryCta),
          h('button', {
            type: 'button', class: 'btn btn--ghost',
            on: { click: function () { back(null); } }
          }, c().reauthSecondaryCta)
        ]),
        h('p', { class: 'dg-handoff__note', text: c().reauthNote })
      ])
    ]);
  }

  /* コードの入力。エラーは、サーバーが返した区分にそろえる。
   * backTo …「前の画面に戻る」の行き先（再認証から受け取る） */
  function viewCode(errorMessage, backTo) {
    var input = h('input', {
      type: 'text', id: 'dg-code', class: 'dg-input',
      autocomplete: 'one-time-code', inputmode: 'latin',
      autocapitalize: 'characters', spellcheck: 'false',
      placeholder: c().codePlaceholder, 'aria-describedby': 'dg-code-error'
    });
    var errorBox = h('p', {
      id: 'dg-code-error', class: 'dg-handoff__warn',
      role: 'status', 'aria-live': 'polite',
      text: errorMessage || '', hidden: !errorMessage
    });
    var button = h('button', {
      type: 'button', class: 'btn btn--primary',
      on: { click: function () { submitCode(input, button, errorBox, backTo); } }
    }, c().codePrimaryCta);

    show([
      head(c().codeHeading),
      h('section', { class: 'dg-card' }, [
        h('p', { class: 'dg-handoff__body', text: c().codeBody }),
        h('label', { class: 'dg-label', 'for': 'dg-code' }, c().codeInputLabel),
        input,
        errorBox,
        h('div', { class: 'dg-nav dg-nav--stack' }, [
          button,
          h('button', {
            type: 'button', class: 'btn btn--ghost',
            on: { click: function () { viewReauth(backTo); } }
          }, c().reauthSecondaryCta)
        ])
      ])
    ]);
    input.focus();
  }

  /* サーバーの答えを、画面の言い方へ移す。
   * ★存在しない・使用済み・期限切れは言い分けない（同じ 'code_rejected'）
   * ★通信できなかったことを、コードの問題にしない */
  function codeMessage(status) {
    if (status === 'unavailable') return c().codeNetworkError;
    if (status === 'busy') return c().codeTemporarilyUnavailable;
    return c().codeInvalid;
  }

  function submitCode(input, button, errorBox, backTo) {
    var code = String(input.value || '').trim();
    if (!code) { showCodeError(errorBox, c().codeInvalid); return; }

    button.disabled = true;
    button.textContent = c().codePending;
    errorBox.hidden = true;
    track('code_redeem_attempt');

    SC.diagnosisRemote.redeemCode(code).then(function (res) {
      if (!res || !res.ok || !res.token) {
        button.disabled = false;
        button.textContent = c().codePrimaryCta;
        showCodeError(errorBox, codeMessage(res && res.status));
        track('code_redeem_failed', { cta: (res && res.status) || 'unavailable' });
        return;
      }
      /* ★券は受け取れた。でも、まだ「復元しました」とは言わない。
       *   記録を取り出せたときに、はじめて復元完了。 */
      if (SC.credentials) SC.credentials.saveLineTicket(res.token);
      if (SC.authGate) SC.authGate.noteRedeemed();
      track('code_redeem_succeeded');
      viewChecking();

      SC.diagnosisRemote.restoreByTicket(res.token).then(function (r2) {
        if (r2 && r2.ok && r2.result) {
          stripUidFromUrl();
          /* 別の端末で進めていた続きも、一緒に受け取る（2026-09-19）。
           * ★取ってくるだけ。採用するかは store が決める */
          carriedChallenge = (r2.challenge && r2.challenge.answers) || null;
          SC.diagnosisStore.setHandoff('bound');
          viewResult(r2.result);
          return;
        }
        /* 通信できなかっただけなら、コードの入力へ戻して言い直す。
         * ★「確認できませんでした」を「権限がありません」と言い換えない */
        var kind = SC.authGate ? SC.authGate.decide(r2 && r2.status) : null;
        if (kind === 'retry') {
          viewCode(codeMessage(r2 && r2.status), backTo);
          return;
        }
        /* LINEの確認はできたが、この記録を開く権限が無い。
         * ★ここで確認のやり直しへ戻さない。同じところを回り続けるため */
        track('record_not_allowed');
        viewRecordNotAllowed();
      });
    });
  }

  function showCodeError(box, message) {
    box.textContent = message;
    box.hidden = false;
  }

  /* LINEの確認後、診断記録を開く権限が無いとき。
   * ★この画面では、記録の削除も結び付けの変更もしない */
  function viewRecordNotAllowed() {
    show([
      head(c().recordNotAllowedHeading),
      h('section', { class: 'dg-card' }, [
        SC.ui.prose ? SC.ui.prose(c().recordNotAllowedBody)
                    : h('p', { class: 'dg-handoff__body', text: c().recordNotAllowedBody }),
        h('p', { class: 'dg-handoff__note', text: c().recordNotAllowedNote })
      ])
    ]);
  }

  /* --- 5. クリップボード自動読取 ---------------------------------------- */
  function tryClipboard() {
    var limit = SC.diagnosisConfig.handoff.clipboardAttempts;
    /* 権限要求を繰り返さない（依頼12） */
    if (clipboardTried >= limit) { viewPaste(null); return; }
    clipboardTried++;

    if (!(global.navigator.clipboard && global.navigator.clipboard.readText)) {
      track('handoff_clipboard_failed');
      viewPaste(null);
      return;
    }
    track('handoff_clipboard_attempted');
    global.navigator.clipboard.readText().then(function (text) {
      var key = SC.handoffKey.normalize(text);
      if (!key) {
        /* 読めたが、別のものがコピーされていた（上書き）。止めずに貼り付けへ */
        track('handoff_clipboard_failed');
        viewPaste(null);
        return;
      }
      track('handoff_clipboard_succeeded');
      viewConfirm(key);
    })['catch'](function () {
      /* 拒否されてもエラーで止めない（依頼12） */
      track('handoff_clipboard_failed');
      viewPaste(null);
    });
  }

  /* --- 起動 -------------------------------------------------------------- */

  /* 5DAY側から「確認のやり直し」で来たとき（restore.html#reauth）。
   * ★#reauth は画面の指定だけ。コードも券も合図もURLに載せない。 */
  function wantsReauth() {
    return String(global.location.hash || '').indexOf('reauth') > -1;
  }

  function boot() {
    root = doc.getElementById('dg-app');
    track('handoff_restore_view');

    uid = readUidFromUrl();
    lineName = readNameFromUrl();
    /* 名前だけでも、URLからはすぐ消す（履歴・共有で漏れないように） */
    if (lineName && !uid) stripUidFromUrl();

    /* 5DAYから案内されて来た人。uid が無くてもここから入れる */
    if (wantsReauth()) {
      viewReauth(function () { global.location.href = 'index.html'; });
      return;
    }
    if (!uid) { viewNoUid(); return; }

    viewChecking();

    /* 3〜4. まずuidだけで探す。結合済みならクリップボードに触らない。
     * ★券を持っていれば添える（uid だけでは返らない段があるため） */
    SC.diagnosisRemote.restoreByUid(uid, lineName,
      (SC.credentials && SC.credentials.lineTicket()) || ticketForKey()
    ).then(function (res) {
      if (res.ok && res.result) {
        stripUidFromUrl();
        /* 5日間チャレンジの続き。無ければ null のまま */
        carriedChallenge = (res.challenge && res.challenge.answers) || null;
        viewResult(res.result);
        return;
      }
      /* 券が要る断り方なら、確認のやり直しへ。
       * ★ここでは戻り先を貼り付け画面にする（行き止まりにしない） */
      if (handleDenied(res, viewPaste)) return;
      tryClipboard();
    });
  }

  SC.restoreApp = {
    boot: boot, _tryClipboard: tryClipboard, viewPaste: viewPaste,
    /* 券が要る場面から呼ぶ入口（2026-09-19） */
    viewReauth: viewReauth, viewCode: viewCode,
    viewRecordNotAllowed: viewRecordNotAllowed,
    _codeMessage: codeMessage,
    _handleDenied: handleDenied
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
