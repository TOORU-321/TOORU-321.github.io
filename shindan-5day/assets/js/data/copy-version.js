/* copy-version.js : 文言の版を決めて、その版の言葉を返す。
 * 正本：Notion §21-C「2026-09-12 保存互換承認追補」（Codex承認）
 *
 * なぜ要るか：
 *   2026-09-12 に DAY2〜DAY5 の選択肢と設問を書き直した。value は変えていないので
 *   記録は読めるが、そのままだと「すでに回答した人が選んだ言葉」が別の言葉に変わる。
 *   保存済みの価値の橋・導線文は旧い言葉のままなので、画面の中で新旧が混ざる。
 *
 * どう決めるか：
 *   ・保存された state に copyVersion が無ければ【旧版】。今まで見ていた言葉のまま出す
 *   ・新しく始める人の state にだけ copyVersion を入れる＝【新版】
 *   ・移行のために保存内容を書き換えない。再読み込み・復元・carryOver でも版は保たれる
 *   ・知らない版が来たら、元データには触らず、いまの言葉で出して記録だけ残す
 *
 * 使うところ：
 *   ・選択肢の一覧 …… SC.copyVersion.list(リスト名, state)
 *   ・設問文・例文 …… 画面を描く前に SC.copyVersion.use(state) を呼ぶと SC.copy が版に合う
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  var CURRENT = '2026-09-12';

  var listCache = {};     /* 版 + リスト名 → 選択肢の配列 */
  var copyCache = {};     /* 版 → SC.copy の姿 */
  var baseCopy = null;    /* いまの版の SC.copy（原本） */
  var unknown = {};       /* 見たことのない版。報告のために残す */

  function legacyVersion() {
    return SC.legacyCopy ? SC.legacyCopy.version : null;
  }

  /* 文字列を旧版の言い回しに置き換えながら、copy をまるごと写す */
  function retell(node, texts) {
    var i, key, out;
    if (typeof node === 'string') return texts[node] !== undefined ? texts[node] : node;
    if (node instanceof Array) {
      out = [];
      for (i = 0; i < node.length; i++) out.push(retell(node[i], texts));
      return out;
    }
    if (node && typeof node === 'object') {
      out = {};
      for (key in node) if (Object.prototype.hasOwnProperty.call(node, key)) {
        out[key] = retell(node[key], texts);
      }
      return out;
    }
    return node;
  }

  SC.copyVersion = {
    CURRENT: CURRENT,

    /* この state をどの版で読むか。無ければ旧版 */
    of: function (state) {
      var v = state && state.copyVersion;
      if (!v) return legacyVersion() || CURRENT;
      if (v !== CURRENT && v !== legacyVersion()) unknown[v] = (unknown[v] || 0) + 1;
      return v;
    },

    isLegacy: function (state) {
      var lv = legacyVersion();
      return !!lv && SC.copyVersion.of(state) === lv;
    },

    /* 知らない版を見かけた記録。中身があれば、対応が要るということ */
    unknownSeen: function () { return unknown; },

    /* この state の言葉を、正しく用意できないとき true。
     *
     * ・知らない版（あとで作られた版など）
     * ・旧版なのに、旧版の言葉の控え（copy-legacy.js）を読み込めていない
     *
     * どちらも、新旧どちらかの言葉へ推測で当てはめると、
     * 画面・作り直し・送信する要約の意味が変わってしまう。
     * 当てはめず、手を止めて案内を出す（Codex回答 2026-09-12 §5）。 */
    isUnsupported: function (state) {
      var v = state && state.copyVersion;
      var lv = legacyVersion();
      if (!v) return !lv || !SC.legacyCopy.labels || !SC.legacyCopy.texts;
      if (v === CURRENT) return false;
      if (lv && v === lv) return !SC.legacyCopy.labels || !SC.legacyCopy.texts;
      return true;
    },

    /* 選択肢の一覧を、その版の言葉で返す。
     * value・並び・個数は変えない。ラベルだけ差し替える */
    list: function (listName, state) {
      var base = SC.config[listName];
      if (!base) return base;
      if (!SC.copyVersion.isLegacy(state)) return base;

      var table = SC.legacyCopy.labels[listName];
      if (!table) return base;                     /* この版で変わっていないリスト */

      var cacheKey = legacyVersion() + '/' + listName;
      if (listCache[cacheKey]) return listCache[cacheKey];

      var out = base.map(function (option) {
        if (table[option.value] === undefined) return option;
        var copied = {};
        for (var k in option) if (Object.prototype.hasOwnProperty.call(option, k)) copied[k] = option[k];
        copied.label = table[option.value];
        return copied;
      });
      listCache[cacheKey] = out;
      return out;
    },

    /* 画面を描く前に呼ぶ。SC.copy をこの state の版に合わせる */
    use: function (state) {
      if (!baseCopy) baseCopy = SC.copy;
      if (!baseCopy) return;
      if (!SC.copyVersion.isLegacy(state) || !SC.legacyCopy) {
        SC.copy = baseCopy;
        return;
      }
      var v = legacyVersion();
      if (!copyCache[v]) copyCache[v] = retell(baseCopy, SC.legacyCopy.texts);
      SC.copy = copyCache[v];
    },

    /* いまの版へ戻す（撮影や自動テストの後始末用） */
    reset: function () {
      if (baseCopy) SC.copy = baseCopy;
    }
  };
}(this));
