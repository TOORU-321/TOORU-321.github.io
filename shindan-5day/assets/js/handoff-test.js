/* handoff-test.js : 引き継ぎの技術検証（診断ファネル §LINE連携と本人紐付け）
 *
 * 確かめること
 *   ① どのブラウザで開いているか（LINE内ブラウザかどうか）
 *   ② localStorage が使えるか
 *   ③ クリップボードへ書けるか
 *   ④ クリップボードから読めるか      ← 「自動で復元」が成立するかの分かれ目
 *   ⑤ ページを移動しても保存が残るか
 *   ⑥ URLパラメータ（uid / k）を受け取れるか
 *
 * 個人情報は集めない。結果は画面に出すだけで、どこへも送信しない。
 */
(function (global) {
  'use strict';
  var doc = global.document;
  var STORE_KEY = 'sc_handoff_test';
  var TEST_VALUE = 'HANDOFF-TEST-';

  var results = {};

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

  /* --- ① 環境 ---------------------------------------------------------- */
  function detectBrowser() {
    var ua = global.navigator.userAgent;
    if (/Line\//i.test(ua)) return 'LINE内ブラウザ';
    if (/FBAN|FBAV|Instagram/i.test(ua)) return 'SNSアプリ内ブラウザ';
    if (/CriOS/i.test(ua)) return 'iPhoneのChrome';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhoneのSafari';
    if (/Android/i.test(ua)) return 'AndroidのChrome等';
    return 'パソコンのブラウザ';
  }

  function showEnv() {
    var dl = el('env');
    var ua = global.navigator.userAgent;
    var browser = detectBrowser();

    results.browser = browser;
    results.ua = ua;
    results.secure = global.isSecureContext === true;
    results.hasClipboardWrite = !!(global.navigator.clipboard && global.navigator.clipboard.writeText);
    results.hasClipboardRead = !!(global.navigator.clipboard && global.navigator.clipboard.readText);
    results.uid = param('uid');
    results.k = param('k');

    row(dl, 'ブラウザ', browser, 'ok');
    row(dl, '安全な接続（https）', results.secure ? 'はい' : 'いいえ', results.secure ? 'ok' : 'ng');
    row(dl, 'コピー機能がある', results.hasClipboardWrite ? 'はい' : 'いいえ',
      results.hasClipboardWrite ? 'ok' : 'ng');
    row(dl, '読み取り機能がある', results.hasClipboardRead ? 'はい' : 'いいえ',
      results.hasClipboardRead ? 'ok' : 'ng');
    row(dl, 'URLのuid', results.uid || '（付いていない）', results.uid ? 'ok' : '');
    row(dl, 'URLのk', results.k || '（付いていない）', results.k ? 'ok' : '');
    row(dl, '端末の文字', ua.slice(0, 90) + (ua.length > 90 ? '…' : ''));
  }

  /* --- ② 保存できるか --------------------------------------------------- */
  function testSave() {
    var dl = el('save-result');
    dl.textContent = '';
    var value = TEST_VALUE + new Date().getTime();
    var ok = false, readBack = '';
    try {
      global.localStorage.setItem(STORE_KEY, value);
      readBack = global.localStorage.getItem(STORE_KEY) || '';
      ok = readBack === value;
    } catch (e) {
      readBack = String(e && e.message ? e.message : e);
    }
    results.storageWrite = ok;
    row(dl, '保存して読み戻せた', ok ? 'はい' : 'いいえ', ok ? 'ok' : 'ng');
    if (!ok && readBack) row(dl, '理由', readBack, 'ng');
  }

  /* 戻ってきたときに、②の保存が残っているかを見る */
  function checkSurvived() {
    var saved = '';
    try { saved = global.localStorage.getItem(STORE_KEY) || ''; } catch (e) { saved = ''; }
    if (!saved) return;
    results.storageSurvived = true;
    var dl = el('save-result');
    row(dl, '移動後', '残っていた', 'ok');
  }

  /* --- ③ クリップボードへ書けるか -------------------------------------- */
  function testCopy() {
    var dl = el('copy-result');
    dl.textContent = '';
    var text = 'SC-KEY-' + Math.random().toString(36).slice(2, 10).toUpperCase();
    results.copiedText = text;

    function fallback() {
      /* 昔ながらの方法。iOSの一部ではこちらしか通らない */
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
      results.copyWrite = ok;
      results.copyMethod = ok ? '昔ながらの方法' : '両方だめ';
      row(dl, 'コピーできた', ok ? 'はい（昔ながらの方法）' : 'いいえ', ok ? 'ok' : 'ng');
      if (ok) row(dl, 'コピーした合言葉', text);
    }

    if (global.navigator.clipboard && global.navigator.clipboard.writeText) {
      global.navigator.clipboard.writeText(text).then(function () {
        results.copyWrite = true;
        results.copyMethod = '新しい方法';
        row(dl, 'コピーできた', 'はい（新しい方法）', 'ok');
        row(dl, 'コピーした合言葉', text);
      }).catch(function () {
        fallback();
      });
    } else {
      fallback();
    }
  }

  /* --- ④ クリップボードから読めるか（本命）------------------------------ */
  function testRead() {
    var dl = el('read-result');
    dl.textContent = '';

    if (!(global.navigator.clipboard && global.navigator.clipboard.readText)) {
      results.copyRead = false;
      results.copyReadReason = '読み取り機能そのものが無い';
      row(dl, '読み取れた', 'いいえ', 'ng');
      row(dl, '理由', 'このブラウザには読み取り機能がありません', 'ng');
      return;
    }

    global.navigator.clipboard.readText().then(function (text) {
      var matched = !!(results.copiedText && text === results.copiedText);
      results.copyRead = true;
      results.copyReadMatched = matched;
      row(dl, '読み取れた', 'はい', 'ok');
      row(dl, '中身が一致した', matched ? 'はい' : 'いいえ（別のものが入っていた）',
        matched ? 'ok' : 'ng');
      row(dl, '読み取れた文字', (text || '').slice(0, 40));
    }).catch(function (e) {
      results.copyRead = false;
      results.copyReadReason = String(e && e.name ? e.name : e);
      row(dl, '読み取れた', 'いいえ', 'ng');
      row(dl, '理由', '許可されませんでした（' + results.copyReadReason + '）', 'ng');
    });
  }

  /* --- ⑥ まとめてコピー -------------------------------------------------- */
  function buildReport() {
    var lines = [
      '── 引き継ぎ検証の結果 ──',
      '日時：' + new Date().toLocaleString('ja-JP'),
      'ブラウザ：' + (results.browser || '—'),
      'https：' + (results.secure ? 'はい' : 'いいえ'),
      '',
      '② 保存できた：' + yn(results.storageWrite),
      '⑤ 移動しても残った：' + yn(results.storageSurvived),
      '',
      '③ コピーできた：' + yn(results.copyWrite) + '（' + (results.copyMethod || '未実行') + '）',
      '④ 読み取れた：' + yn(results.copyRead),
      '　 中身が一致：' + yn(results.copyReadMatched),
      '　 だめな理由：' + (results.copyReadReason || '—'),
      '',
      '⑥ URLのuid：' + (results.uid || '（なし）'),
      '　 URLのk：' + (results.k || '（なし）'),
      '',
      'UA：' + (results.ua || '—')
    ];
    return lines.join('\n');
  }

  function yn(v) {
    if (v === true) return 'はい';
    if (v === false) return 'いいえ';
    return '未実行';
  }

  function copyReport() {
    var text = buildReport();
    el('report').value = text;
    var status = el('report-status');

    function done(msg) { status.textContent = msg; }

    if (global.navigator.clipboard && global.navigator.clipboard.writeText) {
      global.navigator.clipboard.writeText(text)
        .then(function () { done('コピーしました。そのまま貼って送ってください。'); })
        .catch(function () { done('コピーできませんでした。下の枠を長押しして選択してください。'); });
    } else {
      done('下の枠を長押しして選択し、コピーしてください。');
    }
  }

  /* --- 起動 -------------------------------------------------------------- */
  function boot() {
    showEnv();
    if (param('hop') === '1') {
      /* 別ページから戻ってきた。保存が残っているかだけ見る */
      testSave();
      checkSurvived();
    }

    el('btn-save').addEventListener('click', testSave);
    el('btn-copy').addEventListener('click', testCopy);
    el('btn-read').addEventListener('click', testRead);
    el('btn-report').addEventListener('click', copyReport);

    el('btn-hop').addEventListener('click', function () {
      /* いったん別のページへ出て、戻ってくる */
      var back = global.location.pathname + '?hop=1' +
        (results.uid ? '&uid=' + encodeURIComponent(results.uid) : '');
      global.location.href = 'lp.html#handoff-hop';
      global.setTimeout(function () { global.location.href = back; }, 400);
    });
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
