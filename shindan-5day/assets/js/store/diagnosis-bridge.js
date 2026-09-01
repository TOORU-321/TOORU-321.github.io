/* diagnosis-bridge.js : 診断の結果を、5DAY本体へ渡す（2026-08-31）
 *
 * 経緯
 *   5DAY本体（challenge-store.js）は Phase1 のあいだ、診断結果を
 *   sample-diagnosis.js の固定値（47点）で代用していた。
 *   そのままLINE導線をつなぐと、21問答えた人にも全員47点が表示される。
 *
 * 方針
 *   5DAY本体に診断側のファイルを読み込ませない。
 *   診断側が「5DAYが読める形」に整えたものを置き、目印で場所を伝える。
 *   5DAY本体は SC.config.storageKey / currentDiagnosisPointerKey しか知らない。
 *
 * 渡すもの
 *   SC.diagnosisScore.toDiagnosisRecord() の結果だけ。
 *   ＝ 総合点・スコア帯・5軸・最低軸・各フラグ。
 *   ★Q21の観察値（confidenceEvidenceGapScore）は含まれない（§53｜判断A）。
 *
 * uidの扱い（依頼11）
 *   結合できた場合だけ lineUid を入れる。
 *   画面・URL・計測・コンソールへは出さない。ここでも出力しない。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  function pointerKey() { return SC.config.currentDiagnosisPointerKey(); }

  SC.diagnosisBridge = {
    /* この端末で採点した結果を渡す（診断ページから呼ぶ）。
     * 採点前なら何もしない。 */
    handOver: function (lineUid) {
      return SC.diagnosisBridge.handOverRecord(SC.diagnosisStore.toDiagnosisRecord(), lineUid);
    },

    /* 受け取った記録をそのまま渡す（復元画面から呼ぶ）。
     *
     * ★復元画面では、この端末の診断ストアを読んではいけない。
     *   診断した端末とLINEを開いた端末が同じとは限らないため。
     *   サーバーから返ってきた記録だけが正しい。 */
    handOverRecord: function (record, lineUid) {
      if (!record || typeof record.totalScore !== 'number') return null;

      /* 元の記録を書き換えない */
      var out = {};
      for (var k in record) {
        if (Object.prototype.hasOwnProperty.call(record, k)) out[k] = record[k];
      }
      if (typeof lineUid === 'string' && lineUid) out.lineUid = lineUid;

      var id = out.anonymousDiagnosisId;
      if (!id) return null;

      SC.storage.write(SC.config.storageKey('diagnosis', id), out);
      SC.storage.write(pointerKey(), {
        anonymousDiagnosisId: id,
        updatedAt: new Date().toISOString()
      });
      return out;
    },

    /* 5DAY側が「いま見るべき診断結果」を取り出す。
     * 無ければ null（呼び出し側がサンプルへ落とす）。 */
    current: function () {
      var p = SC.storage.read(pointerKey());
      if (!p || typeof p.anonymousDiagnosisId !== 'string' || !p.anonymousDiagnosisId) return null;
      var rec = SC.storage.read(SC.config.storageKey('diagnosis', p.anonymousDiagnosisId));
      if (!rec || typeof rec.totalScore !== 'number') return null;
      return rec;
    },

    /* 目印だけ消す。結果そのものは残す（あとから調べられるように） */
    clearPointer: function () { SC.storage.remove(pointerKey()); }
  };
})(window);
