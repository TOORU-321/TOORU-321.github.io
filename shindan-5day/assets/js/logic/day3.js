/* day3.js : DAY3「届ける変化を一本の橋にする」の成果物ロジック。
 * 正本：Notion §23-D／§23-E（2026-08-20 Codex／あかり確定）
 * day1.js / day2.js と同じ形（value／isComplete／syncBlueprint／complete）にそろえてある。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  function fill(template, values) {
    return String(template).replace(/\{(\w+)\}/g, function (m, key) {
      return values[key] !== undefined ? values[key] : m;
    });
  }

  function stripQuotes(text) {
    return String(text).replace(/^「/, '').replace(/」$/, '');
  }

  var FIELDS = [
    { key: 'currentState', customKey: 'currentStateCustom', options: 'day3CurrentStates' },
    { key: 'wall', customKey: 'wallCustom', options: 'day3Walls' },
    { key: 'firstChange', customKey: 'firstChangeCustom', options: 'day3FirstChanges' },
    { key: 'destination', customKey: 'destinationCustom', options: 'day3Destinations' },
    { key: 'productRole', customKey: 'productRoleCustom', options: 'day3Roles' }
  ];

  function fieldDef(key) {
    for (var i = 0; i < FIELDS.length; i++) if (FIELDS[i].key === key) return FIELDS[i];
    return null;
  }

  /* 価値の橋の文が引用しているDAY2の回答。ここが変われば橋も変わる */
  var BRIDGE_DAY2_KEYS = ['scene', 'voice'];

  /* 本人が作り直した／戻したことを、その場で一度だけ知らせるための控え */
  var notice = null;

  SC.day3 = {
    DAY: 3,
    SECTION_KEY: 'valueBridge',
    FIELDS: FIELDS,

    options: function (key, state) {
      return SC.copyVersion.list(fieldDef(key).options, state || SC.store.getState());
    },

    /* いま選ばれている値を文字列で返す（custom のときだけ自由入力を使う） */
    value: function (state, key) {
      var def = fieldDef(key);
      var answers = state.day3 || {};
      var selected = answers[def.key];
      if (!selected) return '';
      var option = SC.optionByValue(SC.copyVersion.list(def.options, state), selected);
      if (!option) return '';
      if (option.custom) return String(answers[def.customKey] || '').trim();
      return stripQuotes(option.label);
    },

    isAnswered: function (state, key) { return SC.day3.value(state, key) !== ''; },

    /* 5つの問いがすべて答えられているか（価値の橋を作れる状態か） */
    isAnswersComplete: function (state) {
      return FIELDS.every(function (f) { return SC.day3.isAnswered(state, f.key); });
    },

    /* 価値の橋まで含めて完了できるか */
    isComplete: function (state) {
      return SC.day3.isAnswersComplete(state) &&
             String((state.day3 || {}).bridgeDraft || '').trim() !== '';
    },

    values: function (state) {
      var day2 = SC.day2.values(state);
      return {
        scene: day2.scene,
        voice: day2.voice,
        hope: day2.hope,
        focus: day2.focus,
        current: SC.day3.value(state, 'currentState'),
        wall: SC.day3.value(state, 'wall'),
        firstChange: SC.day3.value(state, 'firstChange'),
        destination: SC.day3.value(state, 'destination'),
        role: SC.day3.value(state, 'productRole')
      };
    },

    /* 5つの回答から自動生成した価値の橋 */
    buildBridge: function (state) {
      return fill(SC.copy.day3Done.templates.bridge, SC.day3.values(state));
    },

    /* 元の回答が変わったかを見分けるための鍵（§23-E）。
     *
     * 2026-09-12：DAY3の5問だけを見ていたので、DAY2の場面や心の一言を変えても
     * 橋が作り直されず、カードと橋で別のことを言う状態になっていた。
     * 橋が引用しているDAY2の回答と、文言の版まで含めるようにした。
     *
     * 区切り文字は使わない。自由入力に記号が入っても鍵がぶつからないよう、
     * 配列をそのまま JSON にする。先頭の v2 は鍵の形を見分けるための目印。 */
    sourceKey: function (state) {
      var a = state.day3 || {};
      var d2 = state.day2 || {};
      var parts = [SC.copyVersion ? SC.copyVersion.of(state) : ''];
      /* 橋が引用するDAY2の回答。custom を選んでいるときだけ自由入力も見る
         （既定選択肢に戻した人の控え入力は、変わったことにしない） */
      BRIDGE_DAY2_KEYS.forEach(function (k) {
        parts.push(d2[k] || '');
        parts.push(d2[k] === 'custom' ? (d2[k + 'Custom'] || '') : '');
      });
      FIELDS.forEach(function (f) {
        parts.push(a[f.key] || '');
        parts.push(a[f.key] === 'custom' ? (a[f.customKey] || '') : '');
      });
      return 'v2' + JSON.stringify(parts);
    },

    /* 2026-09-12より前の鍵の形。回答が本当に変わったのか、
     * 鍵の形が変わっただけなのかを見分けるために残してある */
    legacySourceKey: function (state) {
      var a = state.day3 || {};
      return FIELDS.map(function (f) {
        return (a[f.key] || '') + ':' + (a[f.key] === 'custom' ? (a[f.customKey] || '') : '');
      }).join('|');
    },

    isLegacyKey: function (key) {
      return String(key || '').slice(0, 2) !== 'v2';
    },

    /* Screen Q を開いたときに橋を用意する。
     * 戻って元回答を変えていたら作り直し、本人の編集フラグを戻す（§23-E）。
     * ただし本人が手を入れた文章は、黙って作り直さない（§21-C 2026-09-12）。
     * 返り値: 'created' | 'regenerated' | 'kept' | 'needs-choice' | 'incomplete' */
    ensureBridge: function () {
      var state = SC.store.getState();
      /* 言葉を用意できない版では、作り直しも判定もしない */
      if (SC.copyVersion && SC.copyVersion.isUnsupported(state)) return 'unsupported-version';
      if (!SC.day3.isAnswersComplete(state)) return 'incomplete';
      var key = SC.day3.sourceKey(state);
      var a = state.day3;

      if (!a.bridgeDraft) {
        SC.store.setDayAnswer('day3', {
          bridgeDraft: SC.day3.buildBridge(state), bridgeEdited: false,
          bridgeSourceKey: key, bridgeAckedSourceKey: ''
        });
        return 'created';
      }
      if (a.bridgeSourceKey === key) return 'kept';
      if (a.bridgeAckedSourceKey === key) return 'kept';   /* 本人が「残す」を選んだあと */

      /* --- B：2026-09-12より前に保存された文章 ---------------------------
       * 旧形式の鍵はDAY3の5問しか含まない。一致しても、DAY2が変わっていない
       * 証拠にはならない（Codex回答 2026-09-12 §3）。
       * いまの回答から作った文と保存文が同じなら整合しているので、鍵だけ移す。
       * 確かめられないときは、編集の有無にかかわらず本人に選んでもらう。 */
      if (SC.day3.isLegacyKey(a.bridgeSourceKey)) {
        if (String(a.bridgeDraft).trim() === SC.day3.buildBridge(state).trim()) {
          SC.store.setDayAnswer('day3', { bridgeSourceKey: key });
          return 'kept';
        }
        return a.bridgeEdited ? 'needs-choice' : 'needs-choice-stale';
      }

      /* --- A：新しい鍵で、実際に回答が変わったと分かったとき --------------- */
      if (a.bridgeEdited) return 'needs-choice';

      SC.store.setDayAnswer('day3', {
        bridgeDraft: SC.day3.buildBridge(state), bridgeEdited: false,
        bridgeSourceKey: key, bridgeAckedSourceKey: ''
      });
      return 'regenerated';
    },

    /* 「文章を残す」を選んだとき。文章は触らず、聞いたことだけ覚える */
    keepEditedBridge: function () {
      var state = SC.store.getState();
      SC.store.setDayAnswer('day3', { bridgeAckedSourceKey: SC.day3.sourceKey(state) });
      SC.track.event('day3_bridge_kept_edited');
    },

    /* 「今の回答から作り直す」を選んだとき。前の文章と、その文章が対応していた鍵を取っておく */
    regenerateBridge: function () {
      var state = SC.store.getState();
      var a = state.day3 || {};
      SC.store.setDayAnswer('day3', {
        bridgePrevDraft: String(a.bridgeDraft || ''),
        bridgePrevSourceKey: String(a.bridgeSourceKey || ''),
        bridgePrevEdited: !!a.bridgeEdited,
        bridgeDraft: SC.day3.buildBridge(state),
        bridgeEdited: false,
        bridgeSourceKey: SC.day3.sourceKey(state),
        bridgeAckedSourceKey: ''
      });
      notice = 'rebuilt';
      SC.track.event('day3_bridge_regenerated');
    },

    /* 作り直す前の文章へ戻す。
     * ★戻した文章は、いまの回答ではなく「前の回答」に対応している。
     *   鍵も当時のものへ戻し、ずれていることを注記で出せるようにする
     *   （Codex回答 2026-09-12 §4）。 */
    restorePrevBridge: function () {
      var state = SC.store.getState();
      var a = state.day3 || {};
      var prev = String(a.bridgePrevDraft || '');
      if (!prev) return false;
      SC.store.setDayAnswer('day3', {
        bridgeDraft: prev,
        bridgeEdited: a.bridgePrevEdited !== false,
        bridgeSourceKey: String(a.bridgePrevSourceKey || ''),
        bridgeAckedSourceKey: SC.day3.sourceKey(state),
        bridgePrevDraft: '', bridgePrevSourceKey: '', bridgePrevEdited: false
      });
      notice = 'restored';
      SC.track.event('day3_bridge_restored');
      return true;
    },

    /* 画面で一度だけ出す知らせ。読んだら消す（再表示のたびには出さない） */
    takeBridgeNotice: function () {
      var n = notice;
      notice = null;
      return n;
    },

    /* 保存されている文章が、いまの回答とずれたままかどうか。注記を出す判断に使う */
    isBridgeBehindAnswers: function (state) {
      var a = state.day3 || {};
      if (!a.bridgeDraft) return false;
      var key = SC.day3.sourceKey(state);
      if (a.bridgeSourceKey === key) return false;
      if (a.bridgeAckedSourceKey !== key) return false;
      /* 鍵は違っても、文章がいまの回答から作れるものと同じなら、ずれていない */
      return String(a.bridgeDraft).trim() !== SC.day3.buildBridge(state).trim();
    },

    /* 出す注記の種類。'edited'（本人の編集を残した）か 'stale'（古い保存文を残した） */
    bridgeBehindKind: function (state) {
      if (!SC.day3.isBridgeBehindAnswers(state)) return null;
      return (state.day3 || {}).bridgeEdited ? 'edited' : 'stale';
    },

    /* 旧名。本人の編集を残しているときだけ true（既存の呼び出し・テスト用） */
    isEditedBehindAnswers: function (state) {
      return SC.day3.bridgeBehindKind(state) === 'edited';
    },

    bridgeText: function (state) {
      return String((state.day3 || {}).bridgeDraft || '').trim();
    },

    buildBeforeAfter: function (state) {
      var t = SC.copy.day3Done.templates;
      var v = SC.day3.values(state);
      return [{ before: t.before, after: fill(t.after, v) }];
    },

    customerLine: function (state) {
      return fill(SC.copy.day3Done.templates.customer, SC.day3.values(state));
    },

    summary: function (state) {
      return fill(SC.copy.day3Done.templates.blueprintSummary, SC.day3.values(state));
    },

    /* 一本線シートの「届けたい変化」だけを完了にする */
    syncBlueprint: function () {
      var state = SC.store.getState();
      if (state.completedDays.indexOf(SC.day3.DAY) === -1) return state;
      return SC.store.setBlueprintSection(SC.day3.SECTION_KEY, {
        status: 'done',
        summary: SC.day3.summary(state)
      });
    },

    /* DAY3完了。スコアには一切加点しない（絶対条件2） */
    complete: function (ctx) {
      var state = SC.store.getState();
      var first = state.completedDays.indexOf(SC.day3.DAY) === -1;
      if (first) {
        var days = state.completedDays.slice();
        days.push(SC.day3.DAY);
        ctx.save({ completedDays: days, day3CompletedAt: new Date().toISOString() });
        /* 初回のみ記録。回答を変えて再完了しても重複させない（§23-E） */
        ctx.track('day3_completed', { day: SC.day3.DAY });
      }
      SC.day3.syncBlueprint();
      return SC.store.getState();
    },

    shouldCelebrate: function () {
      var state = SC.store.getState();
      return state.completedDays.indexOf(SC.day3.DAY) !== -1 &&
             state.celebratedDays.indexOf(SC.day3.DAY) === -1;
    },

    markCelebrated: function () {
      var state = SC.store.getState();
      if (state.celebratedDays.indexOf(SC.day3.DAY) !== -1) return state;
      var list = state.celebratedDays.slice();
      list.push(SC.day3.DAY);
      return SC.store.saveChallengeState({ celebratedDays: list });
    }
  };
})(window);
