/**
 * Metrology Request Tracker - views/settings.js
 *
 * Settings (#/settings, admin PIN). Built in M1 step 4: users, tools with
 * measurement types / extra fields / BKMs, projects, build-ups,
 * priorities, lab calendar and holidays, Health, audit log, backups.
 * Until then this page says so.
 */
window.MRT = window.MRT || {};
window.MRT.views = window.MRT.views || {};
window.MRT.views.settings = (function () {
  'use strict';
  var ui = window.MRT.ui;

  function render(main) {
    main.appendChild(ui.pageHead('Settings', 'Admin only - protected by the PIN'));
    main.appendChild(ui.emptyState({ icon: 'settings', title: 'Settings come in the next step',
      text: 'Users, tools, measurement types, fields, BKMs, lists, lab calendar, Health, audit log and backups are built in M1 step 4.' }));
  }

  return { render: render };
})();
