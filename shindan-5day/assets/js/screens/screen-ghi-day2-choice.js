/* screen-ghi-day2-choice.js : Screen G・H・I｜DAY2の3つの問い（§21-B）
 * 画面の作りは choice-screen.js に共通化してあるので、ここは仕様表だけ。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  SC.buildChoiceScreens([
    {
      id: 'day2_scene', dayKey: 'day2', logic: function () { return SC.day2; },
      copy: 'day2Scene', field: 'scene', customField: 'sceneCustom',
      options: 'day2Scenes', next: 'day2_voice',
      viewEvent: 'day2_scene_view', selectEvent: 'day2_scene_selected'
    },
    {
      id: 'day2_voice', dayKey: 'day2', logic: function () { return SC.day2; },
      copy: 'day2Voice', field: 'voice', customField: 'voiceCustom',
      options: 'day2Voices', next: 'day2_hope',
      viewEvent: 'day2_voice_view', selectEvent: 'day2_voice_selected'
    },
    {
      id: 'day2_hope', dayKey: 'day2', logic: function () { return SC.day2; },
      copy: 'day2Hope', field: 'hope', customField: 'hopeCustom',
      options: 'day2Hopes', next: 'day2_done', completesDay: 2,
      viewEvent: 'day2_hope_view', selectEvent: 'day2_hope_selected'
    }
  ]);
})(window);
