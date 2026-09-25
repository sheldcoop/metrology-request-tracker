/**
 * Metrology Request Tracker - views/templates.js
 *
 * Personal request templates (Q28, DECISIONS T-1..T-3), the screen parts
 * shared by the form, the request page and My requests:
 *   save(sourceLabel, payload)  ask for a name, save (payload: {request_id} or {fields})
 *   chooser(me)                 "Start from a template" on a new, empty request form
 *   list(me)                    My requests > My templates: use, rename, delete
 * Only the owner sees their templates. The rules (what a template keeps,
 * what is left out when parts were hidden since) are domain.template*.
 */
window.MRT = window.MRT || {};
window.MRT.templates = (function () {
  'use strict';

  var ui = window.MRT.ui;
  var store = window.MRT.store;
  var D = window.MRT.domain;

  function codeOf(c, id) { var r = id ? store.byId(c, id) : null; return r ? (r.code || r.name) : '-'; }

  /** Ask for a name and save; the dialog stays open on an error (e.g. the name is taken). */
  function save(suggest, payload) {
    var name = ui.field({ label: 'Template name', value: suggest || '', placeholder: 'e.g. FIB via cross-section, BU-03',
      hint: 'Kept: tool, type, BKM, project, part number, build-up, layers, afterwards, priority, purpose, extra fields. Not kept: lot, panels, place, dates.' });
    return ui.dialog({ title: 'Save as template', icon: 'save', body: name.node, actions: [
      { label: 'Cancel', value: null },
      { label: 'Save template', kind: 'primary', value: function () { return name.value(); },
        submit: function (v) { return store.saveTemplate(Object.assign({ name: v }, payload)); } }
    ] }).then(function (t) {
      if (t) ui.toast({ kind: 'success', message: 'Template "' + t.name + '" saved. Start from it under New request.' });
      return t;
    });
  }

  function start(t) { location.hash = '#/new?template=' + t.id; }

  /** "Start from a template" - shown on a new, empty form when the person has templates. */
  function chooser(me) {
    var mine = store.myTemplates(me.id);
    if (!mine.length) return null;
    var data = store.data();
    return ui.panel({ title: 'Start from a template', icon: 'requests', cls: 'tpl-chooser', body: [
      ui.el('p', { class: 'muted', text: 'Fills everything that stays the same; you add the lot, panels, place and date. Or just fill the form below.' }),
      ui.el('div', { class: 'tpl-list' }, mine.map(function (t) {
        var ck = D.templateCheck(t, data), tool = store.byId('tools', t.fields.tool_id);
        return ui.el('button', { type: 'button', class: 'tpl-pick', disabled: !ck.usable, title: ck.usable ? 'Start from "' + t.name + '"' : ck.reason,
          onclick: function () { start(t); } }, [
          tool ? ui.toolGlyph(tool.glyph, { size: 24 }) : ui.icon('requests', 18),
          ui.el('span', { class: 'tpl-name', text: t.name }),
          ui.el('span', { class: 'muted', text: ck.usable ? codeOf('tools', t.fields.tool_id) + (ck.notes.length ? ' · something to pick again' : '') : ck.reason })
        ]);
      }))
    ] }).node;
  }

  /** My requests > My templates: use, rename, delete. */
  function list(me) {
    var mine = store.myTemplates(me.id), data = store.data();
    if (!mine.length) {
      return ui.emptyState({ icon: 'requests', title: 'No templates yet',
        text: 'Open one of your requests (or the form\'s last step) and click "Save as template".' });
    }
    return ui.el('div', { class: 'table-wrap' }, ui.el('table', { class: 'grid' }, [
      ui.el('thead', {}, ui.el('tr', {}, ['Template', 'Tool', 'Measurement type', 'Project', 'Saved', ''].map(function (x, i) {
        return ui.el('th', { scope: 'col', class: i === 5 ? 'actions' : null, text: x }); }))),
      ui.el('tbody', {}, mine.map(function (t) {
        var ck = D.templateCheck(t, data);
        return ui.el('tr', { class: ck.usable ? null : 'is-off' }, [
          ui.el('td', {}, [ui.el('b', { text: t.name }), ck.usable ? null : ui.el('span', { class: 'chip neutral', text: ck.reason })]),
          ui.el('td', { class: 'mono', text: codeOf('tools', t.fields.tool_id) }),
          ui.el('td', { text: codeOf('measurement_types', t.fields.type_id) }),
          ui.el('td', { class: 'mono', text: codeOf('projects', t.fields.project_id) }),
          ui.el('td', { class: 'num', text: ui.formatDate(t.updated_ts || t.created_ts) }),
          ui.el('td', { class: 'actions' }, ui.el('span', { class: 'row-actions' }, [
            ui.button('Use', { size: 'sm', icon: 'plus', disabled: !ck.usable, onClick: function () { start(t); } }),
            ui.button('', { kind: 'ghost', size: 'sm', icon: 'edit', ariaLabel: 'Rename ' + t.name, title: 'Rename', onClick: function () { rename(t); } }),
            ui.button('', { kind: 'ghost', size: 'sm', icon: 'trash', ariaLabel: 'Delete ' + t.name, title: 'Delete', onClick: function () { remove(t); } })
          ]))
        ]);
      }))
    ]));
  }

  function rename(t) {
    var name = ui.field({ label: 'Template name', value: t.name });
    ui.dialog({ title: 'Rename template', icon: 'edit', body: name.node, actions: [
      { label: 'Cancel', value: null },
      { label: 'Save', kind: 'primary', value: function () { return name.value(); },
        submit: function (v) { return store.renameTemplate(t.id, v).catch(function (e) { if (e.code === 'no_change') return null; throw e; }); } }
    ] }).then(function (res) { if (res) { ui.toast({ kind: 'success', message: 'Renamed.' }); window.MRT.app.route(); } });
  }

  function remove(t) {
    ui.confirm({ title: 'Delete template', message: 'Delete "' + t.name + '"? Requests made from it stay as they are.', confirmLabel: 'Delete', danger: true })
      .then(function (yes) {
        if (!yes) return;
        return store.deleteTemplate(t.id).then(function () { ui.toast({ kind: 'success', message: 'Template deleted.' }); window.MRT.app.route(); });
      }).catch(function (e) { ui.toastError(e.message, e); });
  }

  return { save: save, chooser: chooser, list: list };
})();
