/* handoff-test.js : 「診断ページ → LINE内の詳しい結果ページ」の引き継ぎ検証
 *
 * 本当に確かめたいこと（診断ファネル §LINE連携と本人紐付け）
 *   ・普通のブラウザ（診断ページ）と、LINE内ブラウザ（結果ページ）は別の入れ物。
 *     保存したものは引き継がれない。そこで「引き継ぎキー」をコピーして渡す設計になっている。
 *   ・その「コピー → LINEで自動読み取り」が、実機で本当に成立するか。
 *
 * STEP 1（普通のブラウザ）：保存する ＋ キーをコピーする
 * STEP 2（LINEの中）      ：保存が残っているか ＋ キーを読み取れるか ＋ URLで渡せるか
 *
 * 個人情報は集めない。どこへも送信しない。
 */
(function (global) {
  'use strict';
  var doc = global.document;

  var STORE_KEY = 'sc_handoff_test';
  var PAGE_URL = global.location.origin + global.location.pathname;

  var r = {};   /* 結果をためる */

  function el(id) { return doc.getElementById(id); }

  function row(dl, label, value, tone) {
    var dt = doc.createElement('dt');
    dt.textContent = label;
    var dd = doc.createElement('dd');
    dd.textContent = value;
    if (tone) dd.className = 'ht-' + tone;
    dl.appendChild(dt);
    dl.appendChild(dd);
  }

  function param(name) {
    var m = new RegExp('[?&]' + name + '=([^&#]*)').exec(global.location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
  }

  function isInLine() { return /Line\//i.test(global.navigator.userAgent); }

  function browserName() {
    var ua = global.navigator.userAgent;
    if (/Line\//i.test(ua)) return 'LINEの中のブラウザ';
    if (/FBAN|FBAV|Instagram/i.test(ua)) return 'SNSアプリの中のブラウザ';
    if (/CriOS/i.test(ua)) return 'iPhoneのChrome';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhoneのSafari';
    if (/Android/i.test(ua)) return 'AndroidのChrome等';
    return 'パソコンのブラウザ';
  }

  /* --- どちらのSTEPをやればいいか案内する ------------------------------- */
  function showGuide() {
    var inLine = isInLine();
    r.browser = browserName();
    r.inLine = inLine;

    el('now').textContent = 'いま開いているのは：' + r.browser;

    if (inLine) {
      el('guide-title').textContent = 'いまLINEの中です → STEP 2 をやってください';
      el('guide-text').textContent =
        '先に普通のブラウザで STEP 1 を済ませてから、ここへ来てください。まだなら、いったんSafariなどでこのページを開いて STEP 1 を押してから戻ってきてください。';
      el('step1').classList.add('is-dim');
      el('step2').classList.add('is-active');
    } else {
      el('guide-title').textContent = 'いま普通のブラウザです → STEP 1 をやってください';
      el('guide-text').textContent =
        'STEP 1 を押したあと、出てきたURLをLINEの自分あてトークへ貼って送り、そこからタップして開いてください。';
      el('step1').classList.add('is-active');
      el('step2').classList.add('is-dim');
    }
  }

  /* --- STEP 1：保存する ＋ キーをコピーする ------------------------------ */
  function runStep1() {
    var dl = el('step1-result');
    dl.textContent = '';

    var key = 'SC-' + Math.random().toString(36).slice(2, 10).toUpperCase();
    r.key = key;

    /* 保存できるか */
    var saved = false;
    try {
      global.localStorage.setItem(STORE_KEY, key);
      saved = global.localStorage.getItem(STORE_KEY) === key;
    } catch (e) { saved = false; }
    r.step1Save = saved;
    row(dl, 'このブラウザに保存できた', saved ? 'はい' : 'いいえ', saved ? 'ok' : 'ng');

    /* キーをコピーできるか */
    copyText(key, function (ok, how) {
      r.step1Copy = ok;
      r.step1CopyHow = how;
      row(dl, 'キーをコピーできた', ok ? 'はい（' + how + '）' : 'いいえ', ok ? 'ok' : 'ng');
      row(dl, 'このときのキー', key);

      /* LINEへ送るURL。URLでも渡せるかを同時に試すため k= を付ける */
      var url = PAGE_URL + '?k=' + encodeURIComponent(key);
      el('url-box').value = url;
      el('step1-url').hidden = false;
      el('step1-hint').hidden = false;
    });
  }

  /* --- STEP 2：引き継げているか調べる ------------------------------------ */
  function runStep2() {
    var dl = el('step2-result');
    dl.textContent = '';

    /* ① 保存は残っているか（別の入れ物なので、普通は残らない） */
    var saved = '';
    try { saved = global.localStorage.getItem(STORE_KEY) || ''; } catch (e) { saved = ''; }
    var fromUrl = param('k');
    r.step2Saved = !!saved;
    r.step2SavedKey = saved;
    r.step2UrlKey = fromUrl;

    /* 保存が「本当に引き継がれた」のか「前の残り」なのかを見分ける。
     * URLのキーと一致すれば引き継ぎ、違えば前回の残り。 */
    var carried = !!(saved && fromUrl && saved === fromUrl);
    var leftover = !!(saved && fromUrl && saved !== fromUrl);
    r.step2Carried = carried;
    r.step2Leftover = leftover;

    row(dl, '① 保存が引き継がれた',
      carried ? 'はい（URLのキーと一致）'
        : leftover ? 'いいえ（前に開いたときの残り）'
        : saved ? 'はい？（URLにkが無いので判別できず）'
        : 'いいえ（別の入れ物）',
      carried ? 'ok' : 'ng');
    if (saved) row(dl, '　 見えたキー', saved);

    /* ② URLで渡せたか */
    r.step2Url = !!fromUrl;
    row(dl, '② URLで渡せた', fromUrl ? 'はい' : 'いいえ（URLにkが無い）',
      fromUrl ? 'ok' : 'ng');
    if (fromUrl) row(dl, '　 URLのキー', fromUrl);

    var uid = param('uid');
    if (uid) {
      r.uid = uid;
      row(dl, '　 URLのuid', uid, 'ok');
    }

    /* ③ クリップボードから読めるか（ここが本命） */
    if (!(global.navigator.clipboard && global.navigator.clipboard.readText)) {
      r.step2Read = false;
      r.step2ReadReason = '読み取り機能そのものが無い';
      row(dl, '③ コピーから自動で読めた', 'いいえ', 'ng');
      row(dl, '　 理由', 'このブラウザに読み取り機能がありません', 'ng');
      return;
    }

    global.navigator.clipboard.readText().then(function (text) {
      r.step2Read = true;
      r.step2ReadText = (text || '').slice(0, 30);
      var looksKey = /^SC-[A-Z0-9]{8}$/.test((text || '').trim());
      r.step2ReadIsKey = looksKey;
      row(dl, '③ コピーから自動で読めた', 'はい', 'ok');
      row(dl, '　 中身がキーだった', looksKey ? 'はい' : 'いいえ（別のもの）',
        looksKey ? 'ok' : 'ng');
      row(dl, '　 読めた文字', (text || '').slice(0, 30));
    }).catch(function (e) {
      r.step2Read = false;
      r.step2ReadReason = String(e && e.name ? e.name : e);
      row(dl, '③ コピーから自動で読めた', 'いいえ', 'ng');
      row(dl, '　 理由', '許可されませんでした（' + r.step2ReadReason + '）', 'ng');
    });
  }

  /* --- コピー（新しい方法 → だめなら昔ながらの方法）---------------------- */
  function copyText(text, done) {
    function fallback() {
      var ta = doc.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      doc.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      var ok = false;
      try { ok = doc.execCommand('copy'); } catch (e) { ok = false; }
      doc.body.removeChild(ta);
      done(ok, ok ? '昔ながらの方法' : '両方だめ');
    }
    if (global.navigator.clipboard && global.navigator.clipboard.writeText) {
      global.navigator.clipboard.writeText(text)
        .then(function () { done(true, '新しい方法'); })
        .catch(fallback);
    } else {
      fallback();
    }
  }

  /* --- 結果をまとめる ---------------------------------------------------- */
  function yn(v) {
    if (v === true) return 'はい';
    if (v === false) return 'いいえ';
    return '未実行';
  }

  function buildReport() {
    return [
      '── 引き継ぎ検証 ──',
      '日時：' + new Date().toLocaleString('ja-JP'),
      '開いた場所：' + (r.browser || '—'),
      '',
      '【STEP 1｜診断ページの役】',
      '　保存できた：' + yn(r.step1Save),
      '　キーをコピーできた：' + yn(r.step1Copy) + '（' + (r.step1CopyHow || '未実行') + '）',
      '',
      '【STEP 2｜LINE内の結果ページの役】',
      '　① 保存が引き継がれた：' + (r.step2Carried ? 'はい（一致）'
        : r.step2Leftover ? 'いいえ（前回の残り）' : yn(r.step2Saved)),
      '　　 見えたキー：' + (r.step2SavedKey || '—'),
      '　　 URLのキー：' + (r.step2UrlKey || '—'),
      '　② URLで渡せた：' + yn(r.step2Url),
      '　③ コピーから自動で読めた：' + yn(r.step2Read),
      '　　 中身がキーだった：' + yn(r.step2ReadIsKey),
      '　　 だめな理由：' + (r.step2ReadReason || '—'),
      '　　 読めた文字：' + (r.step2ReadText || '—'),
      '　 URLのuid：' + (r.uid || '（なし）'),
      '',
      'UA：' + global.navigator.userAgent
    ].join('\n');
  }

  function copyReport() {
    var text = buildReport();
    el('report').value = text;
    copyText(text, function (ok) {
      el('report-status').textContent = ok
        ? 'コピーしました。そのまま貼って送ってください。'
        : '下の枠を長押しして選択し、コピーしてください。';
    });
  }

  /* --- 起動 -------------------------------------------------------------- */
  function boot() {
    showGuide();
    el('btn-step1').addEventListener('click', runStep1);
    el('btn-step2').addEventListener('click', runStep2);
    el('btn-report').addEventListener('click', copyReport);
    el('btn-reset').addEventListener('click', function () {
      try { global.localStorage.removeItem(STORE_KEY); } catch (e) { /* noop */ }
      el('reset-status').textContent = 'この端末の保存を消しました。まっさらな状態で試せます。';
    });
    el('btn-copy-url').addEventListener('click', function () {
      copyText(el('url-box').value, function (ok) {
        el('btn-copy-url').textContent = ok ? 'コピーしました' : '長押しで選択してください';
      });
    });
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
