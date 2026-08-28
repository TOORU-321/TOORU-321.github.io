/* diagnosis-remote.js : 診断保存アダプター（依頼13）
 *
 * 画面からGASを直接呼ばない。診断の保存・結合・復元は必ずここを通す。
 *
 * driver
 *   'remote' … SC.endpoints.diagnosis が入っているとき。GASへHTTPで送る
 *   'local'  … 未接続のとき。この端末の中だけで同じ振る舞いを再現する（開発モード）
 *              外部へは一切送らない。結合の競合規則も同じように動く。
 *
 * 応答形式は driver によらず同じ（依頼13「応答形式の統一」）
 *   { ok: true,  status: '…', … }
 *   { ok: false, status: '…', message: '…' }
 *
 * status の種類
 *   saved             保存できた
 *   bound             初めて結合できた
 *   already_bound     同じ組み合わせで既に結合済み（再送・再訪はこれ）
 *   conflict          別の組み合わせが既にある（自動で上書きしない）
 *   handoff_rejected  引き継ぎ内容が使えない（見つからない／期限切れ／使用済み）
 *   not_found         このuidに結びついた診断結果がまだ無い
 *   unavailable       通信できなかった
 *
 * ★エラー文にuid・匿名診断ID・引き継ぎキーを含めない（依頼9）。
 * ★「見つからない」と「期限切れ」を外から区別できないよう、
 *   どちらも handoff_rejected と同じ文言で返す（依頼9）。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  var MESSAGES = {
    handoff_rejected: '先ほどの診断結果を確認できませんでした。もう一度貼り付けてお試しください。',
    conflict: 'この画面には、すでに別の診断結果が結びついています。お手数ですが、そのままお問い合わせください。',
    not_found: 'まだ診断結果が結びついていません。',
    unavailable: '通信が混み合っているようです。少し時間をおいてお試しください。',
    invalid: '内容を確認できませんでした。もう一度お試しください。'
  };

  function fail(status) {
    return { ok: false, status: status, message: MESSAGES[status] || MESSAGES.invalid };
  }

  function endpoint() {
    return (SC.endpoints && SC.endpoints.diagnosis) || null;
  }

  function keyRefOf(transport) {
    if (!transport) return null;
    if (transport.keyHash) return transport.keyHash;
    /* ハッシュを作れない環境。開発モードでのみ使う値。
     * 通信モードではサーバー側がハッシュ化して保存する。 */
    if (transport.key) return 'plain:' + transport.key;
    return null;
  }

  /* ================= 開発モード（この端末の中だけ）===================== */

  function devRead() {
    var v = SC.storage.read(SC.diagnosisConfig.devServerKey());
    if (!v || typeof v !== 'object') v = {};
    if (!v.records) v.records = {};
    if (!v.handoffs) v.handoffs = {};
    if (!v.bindings) v.bindings = {};
    return v;
  }

  function devWrite(db) {
    SC.storage.write(SC.diagnosisConfig.devServerKey(), db);
  }

  var devDriver = {
    name: 'local',

    saveResult: function (record, transport) {
      var db = devRead();
      var id = record.anonymousDiagnosisId;
      db.records[id] = { result: record, savedAt: new Date().toISOString() };
      var ref = keyRefOf(transport);
      if (ref) {
        db.handoffs[ref] = {
          anonymousDiagnosisId: id,
          issuedAt: new Date().toISOString(),
          usedByUid: null
        };
      }
      devWrite(db);
      return Promise.resolve({ ok: true, status: 'saved', anonymousDiagnosisId: id });
    },

    bind: function (uid, transport) {
      var db = devRead();
      var ref = keyRefOf(transport);
      if (!uid || !ref) return Promise.resolve(fail('invalid'));

      var entry = db.handoffs[ref];
      var ttl = SC.diagnosisConfig.handoff.ttlMinutes;

      /* 使用済みのキーでも、同じuidからの再送なら成功として返す（冪等） */
      if (entry && entry.usedByUid) {
        if (entry.usedByUid === uid && db.bindings[uid] === entry.anonymousDiagnosisId) {
          return Promise.resolve({
            ok: true, status: 'already_bound',
            result: db.records[entry.anonymousDiagnosisId] &&
                    db.records[entry.anonymousDiagnosisId].result
          });
        }
        /* 別のuidが使ったキーは、見つからないのと同じ扱いにする */
        return Promise.resolve(fail('handoff_rejected'));
      }

      /* 見つからない／期限切れは同じ返し方にする（外から区別させない） */
      if (!entry || SC.handoffKey.isExpired(entry.issuedAt, ttl)) {
        return Promise.resolve(fail('handoff_rejected'));
      }

      var already = db.bindings[uid];
      if (already && already !== entry.anonymousDiagnosisId) {
        /* 同じuidに別の診断IDがある → 自動で上書きしない */
        return Promise.resolve(fail('conflict'));
      }
      /* 同じ診断IDに別のuidがある → 自動で結合しない */
      for (var u in db.bindings) {
        if (db.bindings[u] === entry.anonymousDiagnosisId && u !== uid) {
          return Promise.resolve(fail('conflict'));
        }
      }

      db.bindings[uid] = entry.anonymousDiagnosisId;
      entry.usedByUid = uid;
      devWrite(db);
      return Promise.resolve({
        ok: true,
        status: already ? 'already_bound' : 'bound',
        result: db.records[entry.anonymousDiagnosisId] &&
                db.records[entry.anonymousDiagnosisId].result
      });
    },

    restoreByUid: function (uid) {
      var db = devRead();
      var id = uid ? db.bindings[uid] : null;
      if (!id || !db.records[id]) return Promise.resolve(fail('not_found'));
      return Promise.resolve({ ok: true, status: 'already_bound', result: db.records[id].result });
    },

    /* 検証・テスト用。開発モードの保存だけを消す */
    _clear: function () { SC.storage.remove(SC.diagnosisConfig.devServerKey()); }
  };

  /* ================= 通信モード（GAS）================================= */

  function post(payload) {
    var url = endpoint();
    if (!url || !global.fetch) return Promise.resolve(fail('unavailable'));
    return global.fetch(url, {
      method: 'POST',
      /* text/plain にすると事前確認の通信が起きず、GAS側でそのまま受け取れる */
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      referrerPolicy: 'no-referrer'
    }).then(function (res) {
      if (!res.ok) return fail('unavailable');
      return res.json();
    }).then(function (json) {
      if (!json || typeof json !== 'object') return fail('unavailable');
      if (json.ok) return json;
      /* サーバーが返した status だけを使い、こちらで文言を作る */
      return fail(MESSAGES[json.status] ? json.status : 'invalid');
    })['catch'](function () {
      return fail('unavailable');
    });
  }

  var remoteDriver = {
    name: 'remote',
    saveResult: function (record, transport) {
      return post({ action: 'save', record: record, handoff: transport });
    },
    bind: function (uid, transport) {
      return post({ action: 'bind', uid: uid, handoff: transport });
    },
    restoreByUid: function (uid) {
      return post({ action: 'restore', uid: uid });
    }
  };

  /* ==================================================================== */

  function driver() { return endpoint() ? remoteDriver : devDriver; }

  SC.diagnosisRemote = {
    MESSAGES: MESSAGES,
    driverName: function () { return driver().name; },
    isConnected: function () { return !!endpoint(); },

    /* 採点結果を保存し、引き継ぎキーを1本発行する。
     * 平文キーは呼び出し元へ返すだけで、保存も送信もしない（ハッシュだけ送る）。 */
    saveResultAndIssueKey: function (record) {
      var key = SC.handoffKey.issue();
      return SC.handoffKey.forTransport(key).then(function (transport) {
        return driver().saveResult(record, transport).then(function (res) {
          if (!res.ok) return res;
          res.handoffKey = key;
          return res;
        });
      });
    },

    /* uidと匿名診断IDを結合する。初回だけ成立し、以後は already_bound */
    bindWithKey: function (uid, key) {
      var normalized = SC.handoffKey.normalize(key);
      if (!normalized) return Promise.resolve(fail('handoff_rejected'));
      return SC.handoffKey.forTransport(normalized).then(function (transport) {
        return driver().bind(uid, transport);
      });
    },

    /* 結合済みなら、uidだけで診断結果を取り出す */
    restoreByUid: function (uid) {
      if (!uid) return Promise.resolve(fail('not_found'));
      return driver().restoreByUid(uid);
    },

    /* テスト・検証用（開発モードのときだけ効く） */
    _devClear: function () { devDriver._clear(); },
    _devDriver: devDriver
  };
})(window);
