/* app.js : 画面状態・遷移・再開の管理と、プレビュー用メニュー。
 * 画面ファイルは SC.screens[id].render(ctx) を返すだけにする。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;
  var doc = global.document;

  var root = null;
  var footerSlot = null;
  var flash = null;          /* 保存直後の一時メッセージ */
  var restoreNotice = null;  /* 再開・破損メッセージ（起動直後に1回だけ） */
  var pendingSection = null; /* 遷移先で見せたいセクション（data-section の値） */
  var viewedThisEntry = {};  /* *_view イベントの二重発火防止 */

  var HASH = {
    result: '#/result',
    day1_intro: '#/day1-intro',
    day1_focus: '#/day1-focus',
    day1_pause: '#/day1-pause',
    day1_done: '#/day1-done',
    day2_intro: '#/day2-intro',
    day2_scene: '#/day2-scene',
    day2_voice: '#/day2-voice',
    day2_hope: '#/day2-hope',
    day2_done: '#/day2-done',
    day3_intro: '#/day3-intro',
    day3_current: '#/day3-current',
    day3_wall: '#/day3-wall',
    day3_first_change: '#/day3-first-change',
    day3_destination: '#/day3-destination',
    day3_role: '#/day3-role',
    day3_bridge: '#/day3-bridge',
    day3_done: '#/day3-done',
    day4_intro: '#/day4-intro',
    day4_entry: '#/day4-entry',
    day4_relevance: '#/day4-relevance',
    day4_action: '#/day4-action',
    day4_support: '#/day4-support',
    day4_order: '#/day4-order',
    day4_journey: '#/day4-journey',
    day4_done: '#/day4-done',
    day5_intro: '#/day5-intro',
    day5_hypothesis: '#/day5-hypothesis',
    day5_weekly_action: '#/day5-weekly-action',
    day5_metric: '#/day5-metric',
    day5_schedule: '#/day5-schedule',
    day5_adjustment: '#/day5-adjustment',
    day5_support: '#/day5-support',
    day5_experiment: '#/day5-experiment',
    day5_done: '#/day5-done'
  };

  function screenFromHash(hash) {
    for (var id in HASH) if (HASH[id] === hash) return id;
    return null;
  }

  /* 到達してよい画面か検査し、だめなら安全な画面IDへ落とす */
  function guard(screenId, state) {
    if (!screenId || SC.config.screenOrder.indexOf(screenId) === -1) return 'result';

    var day1Done = state.completedDays.indexOf(1) !== -1;
    var day2Done = state.completedDays.indexOf(2) !== -1;
    var day3Done = state.completedDays.indexOf(3) !== -1;
    var day4Done = state.completedDays.indexOf(4) !== -1;
    var day5Done = state.completedDays.indexOf(5) !== -1;

    /* DAY5はDAY4完了が前提（§29-G） */
    if (screenId.indexOf('day5_') === 0 && !day4Done) {
      if (!day1Done) return state.startedAt ? 'day1_intro' : 'result';
      if (!day2Done) return 'day2_intro';
      if (!day3Done) return 'day3_intro';
      return 'day4_intro';
    }
    if (screenId === 'day5_done' && !day5Done) return 'day5_hypothesis';
    /* 30日実験カードは、AB〜AGがそろってから */
    if (screenId === 'day5_experiment' && !SC.day5.isAnswersComplete(state)) return 'day5_hypothesis';

    /* DAY4はDAY3完了が前提 */
    if (screenId.indexOf('day4_') === 0 && !day3Done) {
      if (!day1Done) return state.startedAt ? 'day1_intro' : 'result';
      if (!day2Done) return 'day2_intro';
      return 'day3_intro';
    }
    if (screenId === 'day4_done' && !day4Done) return 'day4_entry';
    /* 順番と導線図は、4地点がそろってから */
    if ((screenId === 'day4_order' || screenId === 'day4_journey') &&
        !SC.day4.isAnswersComplete(state)) return 'day4_entry';

    /* DAY3はDAY2完了が前提 */
    if (screenId.indexOf('day3_') === 0 && !day2Done) {
      if (!day1Done) return state.startedAt ? 'day1_intro' : 'result';
      return 'day2_intro';
    }
    if (screenId === 'day3_done' && !day3Done) return 'day3_current';
    /* 価値の橋は、5つの回答がそろってから */
    if (screenId === 'day3_bridge' && !SC.day3.isAnswersComplete(state)) return 'day3_current';

    /* DAY2はDAY1完了が前提 */
    if (screenId.indexOf('day2_') === 0 && !day1Done) {
      return state.startedAt ? 'day1_intro' : 'result';
    }
    if (screenId === 'day2_done' && !day2Done) return 'day2_scene';

    if (screenId === 'day1_done' && !day1Done) {
      return state.startedAt ? 'day1_intro' : 'result';
    }
    if ((screenId === 'day1_intro' || screenId === 'day1_focus' || screenId === 'day1_pause') &&
        !state.startedAt) return 'result';
    return screenId;
  }

  function buildContext(screenId, state) {
    var ctx = {
      screenId: screenId,
      state: state,
      diagnosis: SC.store.loadDiagnosis(),
      flash: flash,
      restoreNotice: restoreNotice,

      /* options.focusSection : 遷移先で最初に見せたいセクション（data-section の値） */
      go: function (nextId, options) {
        flash = null;
        pendingSection = options && options.focusSection ? options.focusSection : null;
        SC.store.saveChallengeState({ currentScreen: nextId });
        viewedThisEntry = {};
        if (global.location.hash === HASH[nextId]) render(nextId);
        else global.location.hash = HASH[nextId];
      },

      /* 画面内の「戻る」は、履歴の巻き戻しではなく体験の直前画面へ戻す。
         （完了画面から戻って回答を変えたあとも、戻る先が入れ替わらないようにするため）
         端末の戻る操作は hashchange 経由で従来どおり動く。 */
      back: function () {
        flash = null;
        pendingSection = null;
        var i = SC.config.screenOrder.indexOf(screenId);
        ctx.go(SC.config.screenOrder[Math.max(0, i - 1)]);
      },

      save: function (patch) { return SC.store.saveChallengeState(patch); },

      /* DAYごとの回答を保存する（画面から storage を直接触らせない） */
      saveDay: function (dayKey, patch) { return SC.store.setDayAnswer(dayKey, patch); },

      /* 次の画面で1回だけ出す案内（参加を見送ったときなど） */
      notify: function (text) { restoreNotice = text; },

      rerender: function (focusId) { render(screenId, focusId); },

      setFlash: function (text, tone) { flash = { text: text, tone: tone || 'ok' }; },

      track: function (name, meta) { return SC.store.trackEvent(name, meta); },

      trackView: function (name) {
        if (viewedThisEntry[name]) return null;
        viewedThisEntry[name] = true;
        return SC.store.trackEvent(name, { screen: screenId });
      }
    };
    return ctx;
  }

  function render(screenId, focusId) {
    var state = SC.store.getState();
    var target = guard(screenId, state);
    if (target !== screenId) { /* 不正な状態は安全な画面へ戻す */ screenId = target; }

    var screen = SC.screens[screenId];
    if (!screen) { screenId = 'result'; screen = SC.screens.result; }

    var ctx = buildContext(screenId, state);
    var el = screen.render(ctx);

    SC.dom.clear(root);
    /* 画面の入れ替わりだけ短くフェードさせる（選択のたびの再描画では出さない） */
    if (!focusId && SC.motion.allowed()) el.classList.add('is-entering');
    root.appendChild(el);
    restoreNotice = null; /* 再開メッセージは最初の描画だけ */

    var section = pendingSection ? el.querySelector('[data-section="' + pendingSection + '"]') : null;
    pendingSection = null;

    if (focusId) {
      var focusTarget = doc.getElementById(focusId);
      if (focusTarget) focusTarget.focus();
    } else if (section) {
      /* 補助導線から来たときは、目的のセクションを最初に見せる */
      section.setAttribute('tabindex', '-1');
      section.focus({ preventScroll: true });
      section.scrollIntoView({ block: 'start' });
    } else {
      var title = el.querySelector('.app-header__title');
      if (title) { title.setAttribute('tabindex', '-1'); title.focus({ preventScroll: true }); }
      global.scrollTo(0, 0);
    }

    if (global.location.hash !== HASH[screenId]) {
      global.history.replaceState(null, '', HASH[screenId]);
    }
  }

  function onHashChange() {
    var id = screenFromHash(global.location.hash);
    viewedThisEntry = {};
    render(id || SC.store.getState().currentScreen);
  }

  /* --- プレビュー用メニュー（本番では表示しない） ---------------------- */
  function buildPreviewMenu() {
    var logBox = h('pre', { class: 'preview__log', hidden: true });
    var showLog = false;

    return h('details', { class: 'preview' }, [
      h('summary', { class: 'preview__summary', text: SC.copy.common.previewMenu }),
      h('p', { class: 'preview__note', text: SC.copy.common.previewNote }),
      h('p', { class: 'preview__meta', text: '保存先: ' + SC.storage.driver + ' ／ ' + SC.config.challengeVersion }),
      h('div', { class: 'preview__actions' }, [
        h('button', {
          type: 'button', class: 'btn btn--ghost', on: {
            click: function () {
              SC.store.clearPreviewState();
              SC.store.loadChallengeState();
              restoreNotice = SC.copy.common.resetDone;
              viewedThisEntry = {};
              if (global.location.hash === HASH.result) render('result');
              else global.location.hash = HASH.result;
            }
          }
        }, SC.copy.common.previewReset),
        h('button', {
          type: 'button', class: 'btn btn--ghost', on: {
            click: function () {
              showLog = !showLog;
              logBox.hidden = !showLog;
              logBox.textContent = JSON.stringify(SC.track.list(), null, 2);
            }
          }
        }, SC.copy.common.previewLog)
      ]),
      logBox
    ]);
  }

  /* モニター招待コード（?m=）を拾って覚える。
   * 感想のお願いを出すかどうかの判断にだけ使い、計測へは送らない。 */
  function captureMonitorId() {
    var m = /[?&]m=([^&#]*)/.exec(global.location.search);
    if (!m) return;
    var id = decodeURIComponent(m[1].replace(/\+/g, ' ')).slice(0, 40).trim();
    if (!id) return;
    if (SC.store.getState().voiceMonitorId === id) return;
    SC.store.saveChallengeState({ voiceMonitorId: id });
  }

  function boot() {
    captureMonitorId();
    root = doc.getElementById('app');
    footerSlot = doc.getElementById('preview-slot');

    SC.store.loadDiagnosis();
    var state = SC.store.loadChallengeState();
    var status = SC.store.lastLoadStatus();

    if (status === 'restored') {
      var lastDay = state.completedDays.length
        ? Math.max.apply(null, state.completedDays)
        : 0;
      restoreNotice = lastDay
        ? SC.copy.common.restoredDayDone.replace('{day}', lastDay)
        : SC.copy.common.restored;
    } else if (status === 'recovered') {
      restoreNotice = SC.copy.common.corrupted;
    }

    /* LPで参加を見送った直後は、その案内を優先して1回だけ出す（§23-C-5） */
    if (SC.store.takePendingNotice() === 'participation_later') {
      restoreNotice = SC.copy.lp.join.laterNotice;
    }

    footerSlot.appendChild(buildPreviewMenu());
    global.addEventListener('hashchange', onHashChange);

    /* 再読み込み時：URLのハッシュ優先、無ければ最後に保存した画面へ復帰 */
    var fromHash = screenFromHash(global.location.hash);
    render(fromHash || state.currentScreen);
  }

  SC.app = { boot: boot, render: render, guard: guard, HASH: HASH };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
