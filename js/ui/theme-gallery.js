/**
 * Metrology Request Tracker - ui/theme-gallery.js
 *
 * The theme gallery (like a theme showcase): one card per theme of
 * js/themes.js, grouped Main / Personal. Each card is a small
 * live sample drawn IN that theme (a panel, a status lamp row, an action
 * button, a field), with the theme's name, mood and four swatches. Click
 * or Enter picks it; arrows move between cards.
 *
 *   var g = ui.themeGallery({ themes: MRT.themes, value: 'ocean', onPick: function (key) {} ,
 *                             extra: {key: '', name: 'Office default', mood: '...'} });
 *   g.node   g.set('arctic')
 *
 * Adds to MRT.ui. Reads no store; the caller says what a pick means.
 */
(function (ui) {
  'use strict';

  var el = ui.el;

  function sample(T, key) {
    var host = el('div', { class: 'tg-sample', 'aria-hidden': 'true' }, [
      el('div', { class: 'tg-s-bar' }, [el('span', { class: 'tg-s-dot' }), el('span', { class: 'tg-s-title' }), el('span', { class: 'tg-s-btn' })]),
      el('div', { class: 'tg-s-body' }, [
        el('div', { class: 'tg-s-panel' }, [
          el('div', { class: 'tg-s-line is-strong' }), el('div', { class: 'tg-s-line' }), el('div', { class: 'tg-s-field' }),
          el('div', { class: 'tg-s-lamps' }, ['ok', 'warning', 'critical', 'expired'].map(function (s) { return el('i', { class: 'is-' + s }); }))
        ]),
        el('div', { class: 'tg-s-panel is-small' }, [el('div', { class: 'tg-s-line is-strong' }), el('div', { class: 'tg-s-bar2' })])
      ])
    ]);
    T.setOn(host, key);
    return host;
  }

  function themeGallery(o) {
    var T = o.themes;
    var value = o.value;
    var cards = [];
    function card(t) {
      var b = el('button', { type: 'button', class: 'tg-card', role: 'radio', dataset: { key: t.key }, 'aria-label': t.name + ' - ' + t.mood }, [
        t.key === '' ? el('div', { class: 'tg-sample is-default' }, ui.icon('restore', 22)) : sample(T, t.key),
        el('div', { class: 'tg-text' }, [
          el('b', { text: t.name }),
          el('span', { class: 'tg-mood', text: t.mood }),
          t.swatches ? el('span', { class: 'tg-swatches' }, t.swatches.map(function (c) { return el('i', { style: { background: c }, title: c }); })) : null
        ])
      ]);
      b.addEventListener('click', function () { set(t.key); if (o.onPick) o.onPick(t.key); });
      cards.push(b);
      return b;
    }
    var groups = [];
    if (o.extra) groups.push(el('div', { class: 'tg-grid' }, card(o.extra)));
    ['Main', 'Personal'].forEach(function (g) {
      var list = T.list.filter(function (t) { return t.group === g; });
      if (!list.length) return;
      groups.push(el('div', { class: 'tg-group-title', text: g }));
      groups.push(el('div', { class: 'tg-grid' }, list.map(card)));
    });
    var node = el('div', { class: 'theme-gallery', role: 'radiogroup', 'aria-label': 'Theme' }, groups);
    node.addEventListener('keydown', function (ev) {
      var step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[ev.key];
      if (!step) return;
      var i = cards.indexOf(document.activeElement);
      if (i === -1) return;
      ev.preventDefault();
      var n = cards[(i + step + cards.length) % cards.length];
      if (n.focus) n.focus();
    });
    function set(key) {
      value = key;
      cards.forEach(function (c) {
        var on = c.dataset.key === String(key);
        c.classList.toggle('is-on', on);
        c.setAttribute('aria-checked', on ? 'true' : 'false');
        c.tabIndex = on ? 0 : -1;
      });
      if (!cards.some(function (c) { return c.tabIndex === 0; }) && cards[0]) cards[0].tabIndex = 0;
    }
    set(value);
    return { node: node, set: set, value: function () { return value; } };
  }

  ui.themeGallery = themeGallery;
})(window.MRT.ui);
