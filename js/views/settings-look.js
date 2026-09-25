/**
 * Metrology Request Tracker - views/settings-look.js
 *
 * Settings > Look (admins): the theme everyone starts with. Every theme of
 * js/themes.js is shown as a live sample; a click sets it as the office
 * default (audited). Each person can still pick their own in the user menu
 * (Theme...), kept on their PC. The themes themselves - names, colours,
 * swatches - live only in js/themes.js.
 */
(function () {
  'use strict';

  var ui = window.MRT.ui;
  var store = window.MRT.store;
  var TH = window.MRT.themes;

  function K() { return window.MRT.settingsKit; }

  function render(body) {
    var k = K();
    var current = store.getSetting('default_theme');
    var now = TH.byKey(current) || TH.byKey(TH.DEFAULT);
    var g = ui.themeGallery({ themes: TH, value: TH.byKey(current) ? current : TH.DEFAULT, onPick: function (key) {
      if (key === (current || TH.DEFAULT)) return;
      store.setDefaultTheme(key === TH.DEFAULT ? null : key, 'Settings > Look').then(function () {
        ui.toast({ kind: 'success', message: 'Everyone now starts with ' + TH.byKey(key).name + ' (unless they picked their own).' });
        window.MRT.app.refreshTheme();
        window.MRT.app.route();
      }).catch(function (e) { if (e && e.code === 'no_change') return; ui.toastError(e.message, e); });
    } });
    body.appendChild(k.panel('Look - the office theme', 'contrast', [], [
      ui.el('p', { class: 'muted', text: 'The theme everyone starts with: now ' + now.name + '. Click another to change it for the whole office. ' +
        'Each person can still pick their own in the user menu (Theme...) - that is kept on their PC. ' +
        'Status colours (green OK, amber warning, orange critical, red late) mean the same in every theme.' }),
      g.node,
      ui.el('p', { class: 'fine', text: 'All themes live in one file, js/themes.js: names, colours and swatches. A new theme is one entry there ' +
        '(tests/contrast.js checks it reads well).' })
    ]));
  }

  window.MRT.settingsTabs.push({ key: 'look', label: 'Look', icon: 'contrast', order: 65, render: render });
})();
