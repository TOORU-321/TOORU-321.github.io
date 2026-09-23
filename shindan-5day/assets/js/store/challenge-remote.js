/* challenge-remote.js : 5日間チャレンジの回答を、スプレッドシートへ残す
 * （2026-09-10 とーる指示。テストリリースに向けて、書いた中身を回収できるようにする）
 *
 * これまで、チャレンジで書いたものは端末の中にしか無かった。
 * ブラウザのデータを消されると、その人の5日間は消える。
 * どこで手が止まったか、何を書いたかも回収できない。
 *
 * 【守っていること】
 *  ・本物の診断結果を持っている人だけ送る。プレビュー（サンプル47点）は送らない
 *  ・画面は待たせない。送れなくても、いつもどおり動く
 *  ・同じ内容を続けて送らない（ただし送信中・送信待ちがあるあいだは送り直す）
 *  ・外部へ残せたと確かめられないときは、画面へ伝えて本人が押せるようにする
 *  ・送り先は診断と同じGAS。ここに新しい接続先は作らない
 *  ・uid は送るが、画面・URL・計測へは出さない
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  /* 送信のいま（2026-09-15 追補2・Codex差し戻し）
   *
   * 【前の版で足りなかったこと】
   * 「サーバーが ok を返した内容（sentBody）と同じなら送らない」だけでは足りない。
   *   1. Aを送って成功する（sentBody = A）
   *   2. Bを送る。まだ返事が来ていない
   *   3. 本人がAへ戻して保存する
   *   4. A は sentBody と同じなので省略される
   *   5. B が成功し、サーバーにはBが残る（本人の最後の状態はAなのに）
   * 送信中・送信待ちがあるあいだは、サーバーの最後の中身はそちらになるので、
   * 「同じ内容へ戻した」場合も送り直さなければならない。
   *
   * 【やり方】同じページの中では、送信を1本の列にする。
   *   ・sending … いま送っている内容（つねに1つだけ）
   *   ・waiting … 次に送る内容（最新の1つだけ。古い待ちは置き換える＝まとめる）
   *   ・sentBody … サーバーが ok:true を返した内容
   *   ・blockedBody … 自動では送らない内容（サーバーが中身を断ったもの）
   *
   * ★blockedBody は「恒久的な失敗」の印ではない。
   *   自動で繰り返さないための印で、本人が「保存をもう一度試す」を押せば送る。
   *   内容が変われば、その時点で自動の送信に戻る。
   *
   * ★直列化で守れるのは「この画面が出した要求どうしの順番」まで。
   *   サーバー側の書き込み順や、別の端末との競合を保証するものではない。
   *   そちらは別の設計（アクセス券・競合解決）で扱う。 */
  var sending = null;       /* { body: '...', resolvers: [] } */
  var waiting = null;       /* { body: '...', resolvers: [] } */
  var sentBody = '';
  var blockedBody = '';

  /* サーバーが中身や資格を見て断った合図。自動で繰り返さない
   * （一時的な障害とは分ける）。
   *
   * ★2026-09-19：資格の断り（reauth／forbidden／denied）も足した。
   *   同じ券のまま送り直しても結果は変わらないので、繰り返さない。
   *   本人が確認をやり直してから、「もう一度保存する」で送る。 */
  var REFUSED = {
    invalid: true, conflict: true,
    reauth: true, forbidden: true, denied: true
  };

  /* 外部保存のようす。画面はこれを見て出す
   *  'idle'    … 送る対象がない（プレビューなど）
   *  'sending' … 送信中・送信待ちがある
   *  'saved'   … 直近の内容がサーバーに残ったと確認できた
   *  'failed'  … 直近の内容を残せたと確認できていない */
  /* 書きかけを送るまでの待ち時間 */
  var SOON_DELAY = 8000;
  var soonTimer = null;

  var phase = 'idle';
  var failStatus = '';
  var listeners = [];

  function setPhase(next, status) {
    failStatus = status || '';
    phase = next;
    /* 同じようすのままでも知らせる。
     * 端末へ書けたかどうかが途中で変わることがあり、
     * 出しているお知らせの中身もそれに合わせたいため（2026-09-15） */
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](SC.challengeRemote.status()); } catch (e) { /* 画面の都合で止めない */ }
    }
  }

  function finishJob(job, out) {
    for (var i = 0; i < job.resolvers.length; i++) {
      try { job.resolvers[i](out); } catch (e) { /* 待っている側の都合で止めない */ }
    }
  }

  /* 列から1つ取り出して送る。送り終わったら、また列を見る */
  function pump() {
    if (sending || !waiting) return;
    var job = waiting;
    waiting = null;

    /* 取り出した時点で、もうサーバーに届いている内容なら送らない */
    if (job.body === sentBody) {
      finishJob(job, { ok: true, status: 'unchanged' });
      refreshPhase({ ok: true });
      pump();
      return;
    }
    /* 断られたままの内容は、押されるまで自動では送らない */
    if (job.body === blockedBody) {
      finishJob(job, { ok: false, status: 'blocked' });
      refreshPhase({ ok: false, status: 'blocked' });
      pump();
      return;
    }

    sending = job;
    setPhase('sending');
    request(job.body).then(function (out) {
      sending = null;
      if (out.ok === true) {
        sentBody = job.body;
        if (blockedBody === job.body) blockedBody = '';
      } else {
        /* ★成功を確認できなかったら、「いま外部にある内容」が分からなくなる
         *   （2026-09-16 Codex差し戻し）。
         *
         *   1. Aが成功する（sentBody = A）
         *   2. Bを送る。サーバーはBを保存したが、応答だけ届かなかった
         *   3. 待っていたAを「sentBody と同じだから」と省略する
         *   4. 画面は saved、でも外部に残っているのはB
         *
         *   通信エラーは「サーバーが保存しなかった証明」ではない。
         *   なので、省略の根拠そのものを捨てる。
         *   待っている最新の内容は、以前の成功と同じでも送り直される。
         *
         *   ★これは、このページの中の話。応答を失った要求がサーバーで
         *     処理中である場合や、別の端末との競合を解決したわけではない。 */
        sentBody = '';
        if (REFUSED[out.status]) blockedBody = job.body;
        /* 券が使えないと返ってきたら、その券だけ捨てる（2026-09-19） */
        if (out.status === 'reauth') forgetDeadTicket(job.body);
      }
      finishJob(job, out);
      refreshPhase(out);
      pump();
    });
  }

  /* 表示は「いまの列の状態」で決める。
   * 送るものがまだ残っているあいだは、途中の結果を出さない。
   * これで、古い要求の結果が新しい内容の表示を上書きすることがなくなる */
  function refreshPhase(out) {
    if (sending || waiting) { setPhase('sending'); return; }
    if (out && out.ok === true) { setPhase('saved'); return; }
    setPhase('failed', (out && out.status) || 'unavailable');
  }

  function enqueue(body) {
    if (!waiting) waiting = { body: body, resolvers: [] };
    else waiting.body = body;   /* 古い待ちはまとめる。最後の状態だけ残す */
    var job = waiting;
    var p = new Promise(function (resolve) { job.resolvers.push(resolve); });
    setPhase('sending');
    pump();
    return p;
  }

  /* 1回ぶんの通信。成功扱いは json.ok === true を確かめたときだけ */
  function request(body) {
    return global.fetch(endpoint(), {
      method: 'POST',
      /* text/plain にすると事前確認の通信が起きず、GAS側でそのまま受け取れる */
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: body,
      referrerPolicy: 'no-referrer',
      keepalive: true
    }).then(function (res) {
      /* HTTPのエラーは成功にしない */
      if (!res || !res.ok) return { ok: false, status: 'unavailable' };
      return Promise.resolve(res.json()).then(function (json) {
        if (json && json.ok === true) {
          return { ok: true, status: json.status || 'saved' };
        }
        return { ok: false, status: (json && json.status) || 'unavailable' };
      }, function () {
        /* 返事が読めなければ、成功とは言えない */
        return { ok: false, status: 'unavailable' };
      });
    }, function () {
      return { ok: false, status: 'unavailable' };
    });
  }

  function endpoint() {
    return (SC.endpoints && SC.endpoints.diagnosis) || null;
  }

  /* 送る本文を組み立てる。★送るときと、見分けるときで同じものを使う。
   *   別々に作ると、片方だけ直したときに食い違う（2026-09-19）。 */
  function bodyOfRecord(record) {
    return JSON.stringify({
      action: 'save_challenge', record: record,
      token: ticketFor(record.anonymousDiagnosisId)
    });
  }

  /* この診断の続きを送るときに添える券（2026-09-19）。
   * ★その診断の券が先。無ければLINEの券。どちらも無ければ null。 */
  function ticketFor(id) {
    if (!SC.credentials) return null;
    return SC.credentials.diagnosisTicket(id) || SC.credentials.lineTicket() || null;
  }

  /* サーバーが「その券はもう使えない」と答えたとき（status: 'reauth'）。
   *
   * ★送った券だけを、この端末から捨てる。
   *   捨てないと、期限切れの診断の券が先に選ばれ続けて、
   *   コードを入力してLINEの券を受け取っても断られたままになる。
   * ★合図（nonce）は残す。消すと同じ内容が別の記録として増えてしまう。
   * ★回答・成果物・サーバーの記録には触れない。 */
  function forgetDeadTicket(body) {
    if (!SC.credentials) return;
    var b;
    try { b = JSON.parse(body); } catch (e) { return; }
    var id = b && b.record && b.record.anonymousDiagnosisId;
    if (!b || !b.token) return;
    if (id && SC.credentials.diagnosisTicket(id) === b.token) {
      SC.credentials.clearDiagnosisTicket(id);
      return;
    }
    if (SC.credentials.lineTicket() === b.token) SC.credentials.clearLineTicket();
  }

  /* 一本線シートの5行。スプレッドシートで一目で読めるように文字で持つ */
  function summaryOf(state) {
    var parts = [];
    ['day1', 'day2', 'day3', 'day4', 'day5'].forEach(function (key) {
      var mod = SC[key];
      if (!mod || typeof mod.summary !== 'function') return;
      try {
        var text = mod.summary(state);
        if (text) parts.push(text);
      } catch (e) { /* まだ答えていない日は飛ばす */ }
    });
    return parts.join(' / ');
  }

  SC.challengeRemote = {
    isEnabled: function () {
      return !!endpoint() && !!global.fetch &&
        !!(SC.store && SC.store.hasRealDiagnosis && SC.store.hasRealDiagnosis());
    },

    buildRecord: function (state) {
      var d = (SC.store && SC.store.loadDiagnosis) ? SC.store.loadDiagnosis() : null;
      return {
        anonymousDiagnosisId: (d && d.anonymousDiagnosisId) || null,
        uid: (d && d.lineUid) || null,
        challengeVersion: state.challengeVersion || null,
        participation: state.participation || null,
        currentScreen: state.currentScreen || null,
        completedDays: state.completedDays || [],
        day5CompletedAt: state.day5CompletedAt || null,
        supportMode: (state.day5 && state.day5.supportMode) || null,
        blueprint: summaryOf(state),
        /* 本人が書いたものは、まとめてそのまま残す。
         * 診断結果は別のシートにあるので、ここには入れない */
        answers: state
      };
    },

    /* 画面からは戻り値を待たない。失敗しても次の保存でまた送られる */
    save: function (state) {
      if (!SC.challengeRemote.isEnabled()) {
        return Promise.resolve({ ok: false, status: 'skipped' });
      }
      var record = SC.challengeRemote.buildRecord(state);
      if (!record.anonymousDiagnosisId) {
        return Promise.resolve({ ok: false, status: 'no_id' });
      }
      /* その診断記録へのアクセス資格を添える（2026-09-19）。
       * ★券は回答本文（record.answers）には入れない。別の場所で持っている。
       *
       * ★その診断の券が無ければ、LINEの券を添える（ア案）。
       *   通してよいかを決めるのはサーバー側。
       *   結合が 'verified' で、保存先がその結合先と同じときだけ通る。
       *   こちらからは「確認済みです」とは名乗らない。送るのは券だけ。 */
      var body = bodyOfRecord(record);
      var quiet = !sending && !waiting;   /* 送るものが何も動いていない */

      /* 何も動いていないときだけ、「もう届いている」と判断してよい。
       * 送信中・送信待ちがあると、サーバーの最後の中身はそちらになるので、
       * 同じ内容へ戻した場合も送り直す */
      if (quiet && body === sentBody) {
        setPhase('saved');
        return Promise.resolve({ ok: true, status: 'unchanged' });
      }
      /* いま送っている内容と同じなら、二重に送らない */
      if (sending && sending.body === body && !waiting) {
        return new Promise(function (resolve) { sending.resolvers.push(resolve); });
      }
      /* 断られたままの内容は、押されるまで自動では送らない */
      if (quiet && body === blockedBody) {
        setPhase('failed', 'blocked');
        return Promise.resolve({ ok: false, status: 'blocked' });
      }
      return enqueue(body);
    },

    /* ★いまの回答が、サーバーに残ったと確認できているか（2026-09-19）。
     *
     * 【なぜ要るか】
     *   status().phase は「**最後に送ったもの**」の状態で、
     *   「**いま書いたもの**」の状態ではない。
     *   前の保存が成功したあと、新しく書いた回答はまだ送っていないのに
     *   「保存しました」と出てしまっていた。
     *
     * 【見分け方】
     *   いまの回答から組み立てた本文が、
     *   サーバーが ok を返したと確認できた本文（sentBody）と同じかどうか。
     *   ★応答を失ったときは sentBody を捨てているので、ここも false に戻る。
     *   ★券が変わったときも本文が変わるので false になる。
     *     「確かめられないときは言わない」側に倒れる。 */
    isSaved: function (state) {
      if (!sentBody) return false;
      if (!SC.challengeRemote.isEnabled()) return false;
      var record = SC.challengeRemote.buildRecord(state);
      if (!record.anonymousDiagnosisId) return false;
      return bodyOfRecord(record) === sentBody;
    },

    /* まだ送り終えていないものがあるか。
     * ★書きかけの待ち時間（saveSoon の8秒）も「ある」と数える。 */
    isPending: function () {
      return !!sending || !!waiting || !!soonTimer;
    },

    /* 外部保存のようす。画面はこれを見て出す */
    status: function () {
      return {
        phase: phase,
        failStatus: failStatus,
        /* 送れていない中身があるか（画面の「もう一度試す」を出す判断） */
        needsRetry: phase === 'failed'
      };
    },

    /* ようすが変わったら知らせる（画面が1つだけ登録する） */
    onChange: function (fn) {
      if (typeof fn === 'function') listeners.push(fn);
      return function () {
        for (var i = 0; i < listeners.length; i++) {
          if (listeners[i] === fn) { listeners.splice(i, 1); return; }
        }
      };
    },

    /* 本人が「保存をもう一度試す」を押したとき。
     * ★押されるまでは何もしない。自動で繰り返すループは作らない。
     *
     * ★確認をやり直したあとの送り直しは、ここを通る（2026-09-19）。
     *   送る中身は、そのときの state と、そのときの診断IDと、
     *   そのとき持っている券から**作り直す**（save → buildRecord → ticketFor）。
     *   前に断られた中身をそのまま送り直すことはしない。 */
    retry: function (state) {
      blockedBody = '';
      return SC.challengeRemote.save(state);
    },

    /* サーバーに残っている続きを取りに行く（2026-09-11）。
     *
     * それまで index.html は端末の中しか見ていなかったので、
     * 途中でブラウザが変わると古いほうの画面が出ていた。
     *
     * ★取ってくるだけ。採用するかどうかは store が決める
     *   （手元のほうが新しければ、そのまま）。
     * ★LINEと結びついている人だけ。uidが無いと誰の続きか分からない。
     * ★失敗しても null を返す。画面は止めない。 */
    fetchLatest: function () {
      if (!SC.challengeRemote.isEnabled()) return Promise.resolve(null);
      var d = (SC.store && SC.store.loadDiagnosis) ? SC.store.loadDiagnosis() : null;
      var uid = d && d.lineUid;
      if (!uid) return Promise.resolve(null);

      return global.fetch(endpoint(), {
        method: 'POST',
        /* text/plain にすると事前確認の通信が起きず、GAS側でそのまま受け取れる */
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'restore', uid: uid,
          /* 券があれば添える。無ければ今までどおり uid で引く */
          token: (SC.credentials && (SC.credentials.lineTicket() ||
                  SC.credentials.diagnosisTicket(d && d.anonymousDiagnosisId))) || null
          /* 復元は、LINEの券を先に使う（別の端末から続きを取りに来るため） */
        }),
        referrerPolicy: 'no-referrer'
      }).then(function (res) {
        return res.ok ? res.json() : null;
      }).then(function (json) {
        if (!json || !json.ok || !json.challenge) return null;
        return json.challenge.answers || null;
      })['catch'](function () { return null; });
    },

    /* 書きかけの文字は、少し待ってから送る。
     * 1文字ごとに通信すると、GASの回数の上限にすぐ届いてしまう */
    saveSoon: function (state) {
      if (!SC.challengeRemote.isEnabled()) return false;
      if (soonTimer) global.clearTimeout(soonTimer);
      soonTimer = global.setTimeout(function () {
        soonTimer = null;
        SC.challengeRemote.save(state);
      }, SOON_DELAY);
      return true;
    },

    /* 検証・テスト用 */
    _reset: function () {
      sending = null;
      waiting = null;
      sentBody = '';
      blockedBody = '';
      phase = 'idle';
      failStatus = '';
      /* listeners はそのまま。画面が起動時に1つ登録しているので消さない */
      if (soonTimer) { global.clearTimeout(soonTimer); soonTimer = null; }
    },

    /* 検証・テスト用：列のようすを見る（中身は長いので有無だけ） */
    _sendState: function () {
      return {
        sent: !!sentBody,
        blocked: !!blockedBody,
        sending: !!sending,
        waiting: !!waiting,
        phase: phase
      };
    }
  };
})(window);
