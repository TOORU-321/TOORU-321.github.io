/* screen-lmnop-day3-choice.js : Screen L〜P｜DAY3の5つの問い（§23-D）
 * 現在地 → 壁 → 最初の変化 → 到達点 → 商品の役割。
 * 画面の作りは choice-screen.js に共通化してあるので、ここは仕様表だけ。
 */
(function (global) {
  'use strict';
  var SC = (global.SC = global.SC || {});

  function day3() { return SC.day3; }

  SC.buildChoiceScreens([
    {
      id: 'day3_current', dayKey: 'day3', logic: day3,
      copy: 'day3Current', field: 'currentState', customField: 'currentStateCustom',
      options: 'day3CurrentStates', next: 'day3_wall',
      viewEvent: 'day3_current_view', selectEvent: 'day3_current_selected'
    },
    {
      id: 'day3_wall', dayKey: 'day3', logic: day3,
      copy: 'day3Wall', field: 'wall', customField: 'wallCustom',
      options: 'day3Walls', next: 'day3_first_change',
      viewEvent: 'day3_wall_view', selectEvent: 'day3_wall_selected'
    },
    {
      id: 'day3_first_change', dayKey: 'day3', logic: day3,
      copy: 'day3FirstChange', field: 'firstChange', customField: 'firstChangeCustom',
      options: 'day3FirstChanges', next: 'day3_destination',
      viewEvent: 'day3_first_change_view', selectEvent: 'day3_first_change_selected'
    },
    {
      id: 'day3_destination', dayKey: 'day3', logic: day3,
      copy: 'day3Destination', field: 'destination', customField: 'destinationCustom',
      options: 'day3Destinations', next: 'day3_role',
      viewEvent: 'day3_destination_view', selectEvent: 'day3_destination_selected'
    },
    {
      id: 'day3_role', dayKey: 'day3', logic: day3,
      copy: 'day3Role', field: 'productRole', customField: 'productRoleCustom',
      options: 'day3Roles', next: 'day3_bridge',
      viewEvent: 'day3_role_view', selectEvent: 'day3_role_selected'
    }
  ]);
})(window);
