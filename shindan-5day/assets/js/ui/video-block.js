/* video-block.js : 各DAYの共通動画の差し込み口（依頼15）
 *
 * 素材が届くまでは何も描かない（空枠・壊れた再生ボタンを出さない）。
 * 動画を見なくてもワークへ進める。DAY完了の条件にしない。
 *
 * 用意するもの（§41-C／依頼15）
 *   再生／停止・音量・全画面・キーボード操作 … <video controls> の標準機能
 *   字幕                                     … <track kind="captions">
 *   全文テキスト                             … 折りたたみで常に到達できる
 *   スキップ／あとで見直す                   … 閉じても、いつでも開き直せる
 *   自動再生しない                           … autoplay を付けない・preload="none"
 *   prefers-reduced-motion                   … 動きで見せる演出を持たない
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});
  var h = SC.dom.h;

  var LABEL = {
    eyebrow: 'この日の動画',
    duration: '約{label}',
    skip: 'スキップする',
    later: 'あとで見直す',
    reopen: '動画をもう一度開く',
    transcript: '話している内容を文字で読む',
    note: '動画を見なくても、このまま進められます。',
    scriptOnly: '台本（開発用・本番画面には出しません）'
  };

  /* opts:
   *   day    : 1〜5
   *   screen : 計測に載せる画面ID（本文は載せない）
   *   track  : function(name, meta) 計測。省略時は SC.track.event
   */
  SC.ui.videoBlock = function (opts) {
    var day = opts.day;
    var video = SC.videoCatalog.get(day);
    if (!video) return null;

    var fire = opts.track || function (name, meta) { return SC.track.event(name, meta); };
    function ev(name) { fire(name, { day: day, screen: opts.screen }); }

    /* --- 素材がまだ無いとき ------------------------------------------- */
    if (!SC.videoCatalog.isAvailable(day)) {
      if (!SC.videoCatalog.showTranscript) return null;
      /* 開発中に台本を読みたいときだけ。動画枠は作らない */
      return h('details', { class: 'card dvid dvid--script' }, [
        h('summary', { class: 'dvid__summary', text: LABEL.scriptOnly }),
        transcriptBody(video)
      ]);
    }

    /* --- 素材があるとき ------------------------------------------------ */
    var played = false;
    var media = h('video', {
      class: 'dvid__player',
      controls: true,
      preload: 'none',
      playsinline: true,
      poster: video.posterUrl || null,
      src: video.videoUrl,
      on: {
        play: function () {
          if (played) { ev('day_video_replayed'); return; }
          played = true;
          ev('day_video_played');
        },
        ended: function () { ev('day_video_completed'); }
      }
    }, video.captionUrl
      ? [h('track', {
          kind: 'captions', srclang: 'ja', label: '日本語字幕',
          src: video.captionUrl, default: true
        })]
      : null);

    var transcript = h('details', { class: 'dvid__transcript', on: {
      toggle: function () { if (transcript.open) ev('day_video_transcript_opened'); }
    } }, [
      h('summary', { class: 'dvid__transcript-summary', text: LABEL.transcript }),
      transcriptBody(video)
    ]);

    var body = h('div', { class: 'dvid__body' }, [
      media,
      transcript,
      h('div', { class: 'dvid__actions' }, [
        h('button', {
          type: 'button', class: 'btn btn--ghost btn--small',
          on: { click: function () { collapse('day_video_skipped'); } }
        }, LABEL.skip),
        h('button', {
          type: 'button', class: 'btn btn--ghost btn--small',
          on: { click: function () { collapse(null); } }
        }, LABEL.later)
      ]),
      h('p', { class: 'dvid__note', text: LABEL.note })
    ]);

    var reopen = h('button', {
      type: 'button', class: 'btn btn--ghost btn--small', hidden: true,
      on: { click: function () {
        reopen.hidden = true;
        body.hidden = false;
        media.focus();
      } }
    }, LABEL.reopen);

    function collapse(eventName) {
      try { media.pause(); } catch (e) { /* noop */ }
      if (eventName) ev(eventName);
      body.hidden = true;
      reopen.hidden = false;
      reopen.focus();
    }

    var block = h('section', { class: 'card dvid', 'data-section': 'day-video' }, [
      h('div', { class: 'dvid__head' }, [
        h('p', { class: 'dvid__eyebrow', text: LABEL.eyebrow }),
        h('h2', { class: 'dvid__title', text: video.title }),
        video.durationLabel
          ? h('p', { class: 'dvid__duration', text: LABEL.duration.replace('{label}', video.durationLabel) })
          : null
      ]),
      body,
      reopen
    ]);

    ev('day_video_view');
    return block;
  };

  function transcriptBody(video) {
    return h('div', { class: 'dvid__script' }, video.transcript.map(function (seg) {
      return h('div', { class: 'dvid__seg' }, [
        h('p', { class: 'dvid__seg-label', text: seg.label }),
        h('div', { class: 'dvid__seg-text' },
          String(seg.text).split('\n').map(function (line) {
            return h('p', { class: 'dvid__seg-line', text: line });
          }))
      ]);
    }));
  }
})(window);
