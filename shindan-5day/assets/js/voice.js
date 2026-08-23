/* voice.js : モニター感想フォーム（§38-F の掲載条件をそのまま項目にしている）
 *
 * ・招待リンク（?m=モニターID）を開いた人だけが書ける
 * ・掲載同意・表示名の範囲・肩書き／写真／数字の可否・同意日をまとめて取る
 * ・送信先は SC.endpoints.voices（新規GAS）。このファイルにURLは書かない
 * ・5日間チャレンジの回答そのものは送らない。ここで書いたものだけを送る
 */
(function (global) {
  'use strict';
  var SC = global.SC;
  var doc = global.document;
  var h = SC.dom.h;

  var c = SC.copy.voice;

  function param(name) {
    var m = new RegExp('[?&]' + name + '=([^&#]*)').exec(global.location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
  }

  function today() {
    var d = new Date();
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /* ラジオの並び。選ぶまでどれも選ばれていない状態にする */
  function radioGroup(name, legend, options, onChange, note) {
    var fields = options.map(function (o, i) {
      var id = name + '-' + i;
      return h('div', { class: 'vform__choice' }, [
        h('input', {
          type: 'radio', id: id, name: name, value: o.value,
          on: { change: function () { if (onChange) onChange(o.value); } }
        }),
        h('label', { for: id, text: o.label })
      ]);
    });
    return h('fieldset', { class: 'vform__group' }, [
      h('legend', { class: 'vform__legend', text: legend }),
      note ? h('p', { class: 'vform__note', text: note }) : null,
      h('div', { class: 'vform__choices' }, fields)
    ]);
  }

  function boot() {
    var monitorId = param('m').slice(0, 40);

    /* 招待コードが無い人には、フォームを出さない */
    if (!monitorId) {
      doc.getElementById('voice-gate').hidden = false;
      doc.querySelector('[data-voice="gateTitle"]').textContent = c.gate.title;
      doc.querySelector('[data-voice="gateBody"]').textContent = c.gate.body;
      return;
    }

    var main = doc.getElementById('voice-main');
    main.hidden = false;

    var answers = {
      displayType: '匿名',
      consentPublish: '',
      consentTitle: '不可',
      consentPhoto: '不可',
      consentNumbers: '不可'
    };

    var nameWrap = h('div', { class: 'vform__namewrap', hidden: true });
    var nameInput = h('textarea', {
      id: 'voice-display-name', class: 'vform__input', rows: '1',
      placeholder: c.displayNamePlaceholder, maxlength: '40'
    });
    nameWrap.appendChild(h('label', { class: 'vform__label', for: 'voice-display-name', text: c.displayNameLabel }));
    nameWrap.appendChild(nameInput);
    nameWrap.appendChild(h('p', { class: 'vform__note', text: c.displayNameNote }));

    var bodyInput = h('textarea', {
      id: 'voice-body', class: 'vform__input vform__input--body', rows: '8',
      placeholder: c.bodyPlaceholder, maxlength: '2000'
    });

    var contactInput = h('textarea', {
      id: 'voice-contact', class: 'vform__input', rows: '1',
      placeholder: c.contactPlaceholder, maxlength: '120'
    });

    var noticeSlot = h('div', { class: 'notice-slot' });
    var submitBtn = h('button', {
      type: 'button', class: 'btn btn--primary', id: 'voice-submit', text: c.submitLabel
    });

    var form = h('div', { class: 'vform' }, [
      /* 何に使うか */
      h('section', { class: 'vcard' }, [
        h('h2', { class: 'vcard__title', text: c.useHeading }),
        h('ul', { class: 'vlist' }, c.useItems.map(function (t) {
          return h('li', { class: 'vlist__item', text: t });
        }))
      ]),

      /* 感想 */
      h('section', { class: 'vcard' }, [
        h('label', { class: 'vform__label', for: 'voice-body', text: c.bodyLabel }),
        h('p', { class: 'vform__note', text: c.bodyNote }),
        bodyInput
      ]),

      /* 掲載について */
      h('section', { class: 'vcard' }, [
        h('h2', { class: 'vcard__title', text: c.consentHeading }),
        h('p', { class: 'vform__note', text: c.consentNote }),

        radioGroup('voice-publish', c.publishLabel, c.publishOptions, function (v) {
          answers.consentPublish = v;
        }),

        radioGroup('voice-display', c.displayLabel, c.displayOptions, function (v) {
          answers.displayType = v;
          nameWrap.hidden = (v === '匿名');
        }),
        nameWrap,

        h('h3', { class: 'vcard__subtitle', text: c.rangeHeading }),
        h('p', { class: 'vform__note', text: c.rangeNote }),
        radioGroup('voice-title', c.titleLabel, c.rangeOptions, function (v) { answers.consentTitle = v; }),
        radioGroup('voice-photo', c.photoLabel, c.rangeOptions, function (v) { answers.consentPhoto = v; }),
        radioGroup('voice-numbers', c.numbersLabel, c.rangeOptions, function (v) { answers.consentNumbers = v; })
      ]),

      /* 連絡先 */
      h('section', { class: 'vcard' }, [
        h('label', { class: 'vform__label', for: 'voice-contact', text: c.contactLabel }),
        h('p', { class: 'vform__note', text: c.contactNote }),
        contactInput
      ]),

      h('p', { class: 'vform__privacy', text: c.privacyNote }),
      noticeSlot,
      h('div', { class: 'vform__cta' }, [submitBtn])
    ]);

    doc.querySelector('[data-voice="eyebrow"]').textContent = c.eyebrow;
    doc.querySelector('[data-voice="heading"]').textContent = c.heading;
    doc.querySelector('[data-voice="lead"]').textContent = c.lead;
    doc.querySelector('[data-voice="formSlot"]').appendChild(form);

    /* --- 送信 ------------------------------------------------------- */
    var sending = false;

    submitBtn.addEventListener('click', function () {
      if (sending) return;
      SC.dom.clear(noticeSlot);

      var body = bodyInput.value.trim();
      if (!body) {
        noticeSlot.appendChild(h('p', { class: 'notice', role: 'status', text: c.requireBody }));
        bodyInput.focus();
        return;
      }
      if (!answers.consentPublish) {
        noticeSlot.appendChild(h('p', { class: 'notice', role: 'status', text: c.requirePublish }));
        return;
      }
      var displayName = nameInput.value.trim();
      if (answers.displayType !== '匿名' && !displayName) {
        noticeSlot.appendChild(h('p', { class: 'notice', role: 'status', text: c.requireDisplayName }));
        nameInput.focus();
        return;
      }

      sending = true;
      submitBtn.disabled = true;
      submitBtn.textContent = c.sending;

      var payload = {
        monitorId: monitorId,
        body: body,
        displayType: answers.displayType,
        displayName: displayName,
        consentPublish: answers.consentPublish,
        consentTitle: answers.consentTitle,
        consentPhoto: answers.consentPhoto,
        consentNumbers: answers.consentNumbers,
        contact: contactInput.value.trim(),
        consentDate: today()
      };

      /* GASのウェブアプリは、単純リクエストにすると事前確認を挟まず届く */
      global.fetch(SC.endpoints.voices, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }).then(function (r) {
        return r.json();
      }).then(function (res) {
        if (!res || !res.ok) throw new Error((res && res.error) || 'failed');
        showDone();
      }).catch(function () {
        sending = false;
        submitBtn.disabled = false;
        submitBtn.textContent = c.submitLabel;
        SC.dom.clear(noticeSlot);
        noticeSlot.appendChild(h('p', { class: 'notice', role: 'status', text: c.error }));
      });
    });

    function showDone() {
      main.hidden = true;
      var done = doc.getElementById('voice-done');
      done.hidden = false;
      doc.querySelector('[data-voice="doneHeading"]').textContent = c.doneHeading;
      doc.querySelector('[data-voice="doneBody"]').textContent = c.doneBody;
      var back = doc.querySelector('[data-voice="backToApp"]');
      back.textContent = c.backToApp;
      back.setAttribute('href', 'index.html#/day5-done');
      done.setAttribute('tabindex', '-1');
      done.focus({ preventScroll: true });
    }
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();

  SC.voice = { boot: boot };
})(window);
