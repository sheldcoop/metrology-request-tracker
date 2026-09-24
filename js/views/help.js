/**
 * Metrology Request Tracker - views/help.js
 *
 * The user manual inside the app (#/help, the ? button in the top bar).
 * Written in M1 step 5, on the pattern of ABF Tracker's help page. Until
 * then this page says so.
 */
window.MRT = window.MRT || {};
window.MRT.views = window.MRT.views || {};
window.MRT.views.help = (function () {
  'use strict';
  var ui = window.MRT.ui;

  function render(main) {
    main.appendChild(ui.pageHead('Help', 'How to use the app'));
    main.appendChild(ui.emptyState({ icon: 'help', title: 'The manual comes in step 5',
      text: 'Step-by-step guides for every task, searchable and printable, are written in M1 step 5.' }));
  }

  return { render: render };
})();
