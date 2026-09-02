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
  var root = null;
  var clipboardTried = 0;

  function c() { return SC.diagnosisCopy; }
  function track(name, meta) { return SC.diagnosisTrack.event(name, meta); }

  function readUidFromUrl() {
    var m = /[?&]uid=([^&#]*)/.exec(global.location.search);
    if (!m) return null;
    var v = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim();
    if (!v) return null;
    /* プロラインのuidは英数字と記号少々。長すぎるものは受け取らない */
    if (v.length > 120) return null;
    return v;
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
        h('span', { class: 'dg-badge', text: c().devBadge }),
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

    var animate = SC.motion.once('restore-result');
    var el = h('div', { class: 'dg-screen dg-screen--result' }, [
      head(c().resultTitle),
      h('p', { class: 'dg-devnote', text: c().devNotice }),
      h('p', { class: 'dg-notice', role: 'status', 'aria-live': 'polite', text: c().restoreDone }),
      SC.ui.diagnosisResult(record, { animate: animate }),
      h('div', { class: 'dg-nav dg-nav--single' }, [
        /* uid付きURLを外部リンクへ引き継がない（依頼11） */
        h('a', {
          class: 'btn btn--primary', href: 'index.html', rel: 'noreferrer'
        }, c().restoreNextCta)
      ])
    ]);
    show([el]);
    if (animate) SC.motion.countUp(el, { duration: 900, stagger: 90, delay: 120 });
  }

  /* --- 7. 結合 ---------------------------------------------------------- */
  function bind(key, from) {
    viewChecking();
    SC.diagnosisRemote.bindWithKey(uid, key).then(function (res) {
      if (res.ok) {
        track('handoff_bind_succeeded', { cta: from });
        stripUidFromUrl();
        SC.diagnosisStore.setHandoff('bound');
        viewResult(res.result);
        return;
      }
      track('handoff_bind_failed', { cta: from });
      viewPaste(res.message);
    });
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
  function boot() {
    root = doc.getElementById('dg-app');
    track('handoff_restore_view');

    uid = readUidFromUrl();
    if (!uid) { viewNoUid(); return; }

    viewChecking();

    /* 3〜4. まずuidだけで探す。結合済みならクリップボードに触らない */
    SC.diagnosisRemote.restoreByUid(uid).then(function (res) {
      if (res.ok && res.result) {
        stripUidFromUrl();
        viewResult(res.result);
        return;
      }
      tryClipboard();
    });
  }

  SC.restoreApp = { boot: boot, _tryClipboard: tryClipboard, viewPaste: viewPaste };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
