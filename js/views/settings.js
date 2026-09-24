/**
 * Metrology Request Tracker - views/settings.js
 *
 * Settings (#/settings/<tab>): admins only, and the admin PIN once per
 * visit. This file is the page frame - the lock, the tab bar - and a small
 * kit the tabs share (MRT.settingsKit). Each tab is its own file,
 * js/views/settings-*.js, and registers itself in MRT.settingsTabs:
 *   { key, label, icon, order, render(body, ctx) }
 *
 * Every write goes through store.js (which checks the Admin role again);
 * dialogs stay open on an error and show it inside (ui.dialog submit).
 */
window.MRT = window.MRT || {};
window.MRT.views = window.MRT.views || {};
window.MRT.settingsTabs = window.MRT.settingsTabs || [];
window.MRT.views.settings = (function () {
  'use strict';

  var ui = window.MRT.ui;
  var store = window.MRT.store;
  var D = window.MRT.domain;

  var unlockedFor = null;       // the user who entered the PIN this visit
  var lastTab = 'health';

  function tabs() {
    return window.MRT.settingsTabs.slice().sort(function (a, b) { return a.order - b.order; });
  }

  function render(main, ctx) {
    var me = store.currentUser();
    main.appendChild(ui.pageHead('Settings', 'Tools, lists, people, lab calendar and the health of the data file'));

    if (!D.hasRole(me, 'admin')) return renderNotAdmin(main);
    if (unlockedFor !== me.id) return renderLock(main);

    var all = tabs();
    var want = (ctx.subpath || '').split('/')[0] || lastTab;
    var active = all.filter(function (t) { return t.key === want; })[0] || all[0];
    lastTab = active.key;

    var body = ui.el('div', { class: 'tab-body settings-body', role: 'tabpanel' });
    var bar = ui.tabs(all.map(function (t) { return { key: t.key, label: t.label, icon: t.icon }; }), function (key) {
      history.replaceState(null, '', '#/settings/' + key);
      lastTab = key;
      draw(key, null);
    });
    bar.setActive(active.key);
    main.appendChild(bar.node);
    main.appendChild(body);

    function draw(key, focusId) {
      var tab = all.filter(function (t) { return t.key === key; })[0];
      ui.clear(body);
      try {
        tab.render(body, { focusId: focusId });
      } catch (e) {
        console.error('MRT: settings tab "' + key + '" failed', e);
        ui.mount(body, ui.emptyState({ icon: 'alert', title: 'This tab could not be shown', text: e.message }));
      }
      ui.linkLabels(body);
    }
    draw(active.key, (ctx.subpath || '').split('/')[1] || null);
  }

  function renderNotAdmin(main) {
    var admins = store.list('users').filter(function (u) { return D.hasRole(u, 'admin'); });
    main.appendChild(ui.emptyState({ icon: 'lock', title: 'Settings are for admins',
      text: 'Ask an admin to change tools, lists or people: ' + (admins.map(function (u) { return u.name; }).join(', ') || 'none set') + '.' }));
  }

  function renderLock(main) {
    var pin = ui.field({ label: 'Admin PIN', type: 'password', inputmode: 'numeric', hint: 'Asked once per visit.' });
    var err = ui.el('div');
    var btn = ui.button('Unlock', { kind: 'primary', icon: 'lock', type: 'submit' });
    var formNode = ui.el('form', { class: 'lock-form', novalidate: true }, [pin.node, err, btn]);
    formNode.addEventListener('submit', function (ev) {
      ev.preventDefault();
      ui.clear(err);
      store.verifyPin(pin.value()).then(function (ok) {
        if (!ok) { pin.setState('invalid', 'Wrong PIN'); pin.input.select(); return; }
        unlockedFor = store.currentUser().id;
        window.MRT.app.route();
      }).catch(function (e) { ui.toastError('Could not check the PIN: ' + e.message, e); });
    });
    main.appendChild(ui.panel({ title: 'Admin area', icon: 'lock', cls: 'lock-panel', body: [
      ui.el('p', { class: 'muted', text: 'Changes here affect everyone. Enter the admin PIN to continue.' }),
      formNode,
      ui.el('p', { class: 'fine', text: 'Soft protection: anyone who can open the data folder could edit the file directly. ' +
        'Every change made here is in the audit log.' })
    ] }).node);
    setTimeout(function () { pin.input.focus(); }, 0);
  }

  /* ================================================================== *
   * The kit the tabs share
   * ================================================================== */

  var NO_CHANGE = { no_change: true };

  var kit = {
    /** A panel with a title, icon, actions (right) and content. */
    panel: function (title, icon, actions, body, cls) {
      return ui.panel({ title: title, icon: icon, actions: actions, body: body, cls: cls }).node;
    },

    /** A data table. heads: ['Name', {label, cls}]; rows: arrays of cells (text or Node). */
    table: function (heads, rows, empty) {
      if (!rows.length) return ui.el('p', { class: 'muted table-empty', text: empty || 'Nothing here yet.' });
      return ui.el('div', { class: 'table-wrap' }, ui.el('table', { class: 'grid' }, [
        ui.el('thead', {}, ui.el('tr', {}, heads.map(function (h) {
          return ui.el('th', { class: h.cls || null, scope: 'col', text: typeof h === 'string' ? h : h.label });
        }))),
        ui.el('tbody', {}, rows.map(function (r) {
          var tr = ui.el('tr', { class: r.cls || null, id: r.id || null }, (r.cells || r).map(function (c, i) {
            var h = heads[i] || {};
            return ui.el('td', { class: h.cls || null }, c === null || c === undefined ? '' : c);
          }));
          return tr;
        }))
      ]));
    },

    chip: function (text, kind) { return ui.el('span', { class: 'chip ' + (kind || 'neutral'), text: text }); },

    /** The "Sample" tag for made-up entries (M1-8). */
    sampleTag: function () {
      return ui.el('span', { class: 'sample-tag', title: 'Made up until the engineers confirm it - edit or delete it' }, 'Sample');
    },

    muted: function (text) { return ui.el('span', { class: 'muted', text: text }); },

    userName: function (id) { var u = id ? store.byId('users', id) : null; return u ? u.name : null; },

    /** Options for a "pick a person" select, with an empty first choice. */
    userOptions: function (filter, emptyLabel) {
      return [{ value: '', label: emptyLabel || '- none -' }].concat(store.list('users').filter(filter || function () { return true; })
        .map(function (u) { return { value: u.id, label: u.name }; }));
    },

    /**
     * Add / edit dialog around ui.form. save(values) returns the store's
     * Promise; on an error the dialog stays open and shows it.
     * o: {title, icon, intro, wide, values, fields, check(v) -> [key, msg] | null,
     *     save(v) -> Promise, after(saved row), done: toast text, onForm(form)}
     */
    editDialog: function (o) {
      var f = ui.form(o.fields, o.values || {});
      if (o.onForm) o.onForm(f);     // e.g. a select that fills another one
      return ui.dialog({
        title: o.title, icon: o.icon || 'edit', wide: !!o.wide,
        body: [o.intro ? ui.el('p', { text: o.intro }) : null, f.node, o.extra || null],
        actions: [
          { label: 'Cancel', value: null },
          { label: o.saveLabel || 'Save', kind: 'primary', value: function () { return f.values(); },
            submit: function (v) {
              f.clearErrors();
              if (o.check) { var bad = o.check(v); if (bad) { f.setError(bad[0], bad[1]); return Promise.reject(new Error(bad[1])); } }
              return o.save(v).catch(function (e) {
                if (e && e.code === 'no_change') return NO_CHANGE;   // closes quietly
                throw e;
              });
            } }
        ]
      }).then(function (res) {
        if (res === NO_CHANGE) { ui.toast({ message: 'Nothing was changed.', timeout_ms: 2000 }); return null; }
        if (res) {
          if (o.after) o.after(res);
          ui.toast({ kind: 'success', message: o.done || 'Saved.' });
          window.MRT.app.route();
        }
        return res;
      });
    },

    /**
     * Delete, only while nothing uses the entry (Q47); otherwise it says
     * what uses it and to hide it instead.
     */
    deleteButton: function (collection, row, name) {
      return ui.button('', { kind: 'ghost', size: 'sm', icon: 'trash', ariaLabel: 'Delete ' + name, title: 'Delete ' + name,
        onClick: function () {
          var usage = store.entryUsage(collection, row.id);
          if (usage.count) {
            ui.dialog({ title: 'Cannot delete ' + name, icon: 'lock', body: ui.el('p', { text: name + ' is still used by ' + usage.text +
              '. Hide it instead (Edit, untick Active): hidden entries keep their history but are no longer offered.' }) });
            return;
          }
          ui.promptReason({ title: 'Delete ' + name, confirmLabel: 'Delete',
            message: name + ' is not used anywhere. Deleting removes it for good; the audit log keeps a record. Why?'
          }).then(function (reason) {
            if (!reason) return;
            return store.deleteEntry(collection, row.id, reason).then(function () {
              ui.toast({ kind: 'success', message: name + ' deleted.' });
              window.MRT.app.route();
            });
          }).catch(function (e) { ui.toastError('Could not delete: ' + e.message, e); });
        } });
    },

    /**
     * Add / edit an admin-defined field (tool extra field or lot field).
     * o: {collection, f (the field or null), titleNew, base (fields for a new one, e.g. {tool_id}),
     *     typeOptions ([{value, label}] for "Only for these measurement types"; omit for lot fields)}
     */
    fieldDialog: function (o) {
      var f = o.f, edit = !!f, hasTypes = !!o.typeOptions;
      var isChoice = function (v) { return v.type === 'choice' || v.type === 'multichoice'; };
      var specs = [
        { key: 'label', label: 'Label', kind: 'text', placeholder: 'e.g. Cut depth' },
        { key: 'type', label: 'Type', kind: 'select', cls: 'half', options: D.FIELD_TYPES.map(function (t) { return { value: t, label: D.FIELD_TYPE_LABEL[t] }; }) },
        { key: 'required', label: 'Required', kind: 'check', cls: 'half' },
        { key: 'unit', label: 'Unit', kind: 'text', cls: 'half', placeholder: 'e.g. µm', showIf: function (v) { return v.type === 'number'; } },
        { key: 'min', label: 'Min (optional)', kind: 'number', cls: 'half', showIf: function (v) { return v.type === 'number'; } },
        { key: 'max', label: 'Max (optional)', kind: 'number', cls: 'half', showIf: function (v) { return v.type === 'number'; } },
        { key: 'choices', label: 'Choices, one per line', kind: 'longtext', showIf: isChoice,
          hint: 'Renaming keeps old answers. A removed choice is hidden, not deleted.' },
        { key: 'help', label: 'Help text (optional)', kind: 'text', placeholder: 'Shown under the field on the form' }
      ];
      if (hasTypes) specs.push({ key: 'type_ids', label: 'Only for these measurement types (none ticked = all)', kind: 'checks', options: o.typeOptions });
      specs.push({ key: 'active', label: 'Active (untick to hide)', kind: 'check' });
      return kit.editDialog({
        title: edit ? 'Edit field ' + f.label : o.titleNew, icon: 'sliders', wide: true,
        intro: edit && f.sample ? 'A sample field (first ideas). Change it, or save it as it is to confirm it as real.' : null,
        values: edit ? { label: f.label, type: f.type, required: !!f.required, help: f.help || '', unit: f.unit || '',
                         min: f.min, max: f.max, choices: (f.choices || []).filter(function (c) { return c.active !== false; }).map(function (c) { return c.label; }).join('\n'),
                         type_ids: f.type_ids || [], active: f.active !== false }
                     : { type: 'text', active: true, type_ids: [] },
        fields: specs,
        check: function (v) {
          if (!v.label) return ['label', 'Enter a label'];
          if (v.type === 'number' && (isNaN(v.min) || isNaN(v.max))) return [isNaN(v.min) ? 'min' : 'max', 'Enter a number or leave it empty'];
          if (isChoice(v) && v.choices.split('\n').filter(function (x) { return x.trim(); }).length < 2) return ['choices', 'Enter at least two choices, one per line'];
          return null;
        },
        save: function (v) {
          var fields = { label: v.label, type: v.type, required: v.required, help: v.help, active: v.active };
          if (hasTypes) fields.type_ids = v.type_ids;
          if (v.type === 'number') { fields.unit = v.unit; fields.min = v.min; fields.max = v.max; }
          if (isChoice(v)) {
            // match lines to existing choices by name, so their IDs (and old answers) stay
            var old = (edit && f.choices) || [];
            fields.choices = v.choices.split('\n').map(function (x) { return x.trim(); }).filter(Boolean).map(function (label) {
              var same = old.filter(function (c) { return D.normalizeName(c.label) === D.normalizeName(label); })[0];
              return { id: same ? same.id : undefined, label: label, active: true };
            });
          }
          return store.saveEntry(o.collection, { id: edit ? f.id : undefined, version: edit ? f.version : undefined,
            fields: edit ? fields : Object.assign({}, o.base || {}, fields), reason: 'Settings' });
        },
        done: edit ? 'Saved.' : 'Field added.'
      });
    },

    /** "Short text", "Number (µm)", "One choice: A / B" for a field list. */
    fieldKind: function (f) {
      var extra = f.type === 'number' && f.unit ? ' (' + f.unit + ')' : (f.type === 'choice' || f.type === 'multichoice')
        ? ': ' + (f.choices || []).filter(function (c) { return c.active !== false; }).map(function (c) { return c.label; }).join(' / ') : '';
      return D.FIELD_TYPE_LABEL[f.type] + extra;
    },

    /** Edit button that opens a dialog. */
    editButton: function (label, onClick) {
      return ui.button('', { kind: 'ghost', size: 'sm', icon: 'edit', ariaLabel: 'Edit ' + label, title: 'Edit ' + label, onClick: onClick });
    },

    /** Copy button for a share path. */
    copyButton: function (text, what) {
      return ui.button('', { kind: 'ghost', size: 'sm', icon: 'copy', ariaLabel: 'Copy ' + (what || 'path'), title: 'Copy ' + (what || 'path'),
        onClick: function () { ui.copyText(text, (what || 'Path') + ' copied'); } });
    },

    /** Mark and scroll to a row that a Health link points at. */
    focusRow: function (body, id) {
      if (!id) return;
      var row = body.querySelector('#row-' + id);
      if (!row) return;
      row.classList.add('is-selected');
      requestAnimationFrame(function () { row.scrollIntoView({ block: 'center' }); });
    },

    /** Store refusals ("Nothing was changed") that need no red toast. */
    quiet: function (e) { return e && e.code === 'no_change'; }
  };

  window.MRT.settingsKit = kit;

  return { render: render };
})();
