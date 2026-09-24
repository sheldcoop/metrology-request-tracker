/**
 * Metrology Request Tracker - views/settings-tools.js
 *
 * Settings > Tools: the tools (code, name, glyph, destructive, primary and
 * backup quality engineer, results root),
 * and per tool its measurement types (Q51), extra fields (Q5, M1-7) and BKM
 * library (Q13). A new tool or field needs no code change. The status
 * (Up / Down / Maintenance) is set on Lab status, by the tool's quality
 * engineers too. (Stored as primary_operator_id / backup_operator_id.)
 */
(function () {
  'use strict';

  var ui = window.MRT.ui;
  var store = window.MRT.store;
  var D = window.MRT.domain;

  var selectedToolId = null;

  function K() { return window.MRT.settingsKit; }
  function oops(e) { if (!K().quiet(e)) ui.toastError(e.message, e); }
  function ofTool(collection, toolId) { return store.list(collection, { all: true }).filter(function (r) { return r.tool_id === toolId; }); }
  function activeChip(r) { return K().chip(r.active === false ? 'Hidden' : 'Active', r.active === false ? 'neutral' : 'ok'); }

  function render(body, ctx) {
    var k = K();
    var tools = store.list('tools', { all: true });

    // a Health link can point at a tool, type, field or BKM: open its tool
    if (ctx.focusId) {
      var hit = store.byId('tools', ctx.focusId) ? { tool_id: ctx.focusId }
        : store.byId('measurement_types', ctx.focusId) || store.byId('tool_fields', ctx.focusId) || store.byId('bkms', ctx.focusId);
      if (hit && hit.tool_id) selectedToolId = hit.tool_id;
    }
    if (!tools.some(function (t) { return t.id === selectedToolId; })) selectedToolId = tools.length ? tools[0].id : null;

    body.appendChild(k.panel('Tools', 'wrench', [ui.button('Add tool', { kind: 'primary', icon: 'plus', size: 'sm', onClick: function () { toolDialog(null); } })], [
      ui.el('p', { class: 'muted', text: 'The code starts every request ID (FIB-260924-03). Status is set on Lab status.' }),
      k.table([{ label: 'Tool' }, 'Name', 'Primary QE', 'Backup QE', 'Results root', 'Setup', 'Status', { label: '', cls: 'actions' }], tools.map(function (t) {
        var types = ofTool('measurement_types', t.id).length, fields = ofTool('tool_fields', t.id).length, bkms = ofTool('bkms', t.id).length;
        return { id: 'row-' + t.id, cls: t.active === false ? 'is-off' : null, cells: [
          ui.el('span', { class: 'cell-tool' }, [ui.toolGlyph(t.glyph, { size: 28 }), ui.el('b', { class: 'mono', text: t.code }),
            t.destructive ? k.chip('Destructive', 'warning') : null]),
          t.name,
          k.userName(t.primary_operator_id) || k.muted('not set'),
          k.userName(t.backup_operator_id) || k.muted('not set'),
          t.results_root ? ui.el('span', { class: 'cell-path' }, [ui.el('span', { class: 'mono', text: t.results_root }), k.copyButton(t.results_root, 'Results root')]) : k.muted('not set'),
          ui.el('span', { class: 'muted num', text: types + ' types · ' + fields + ' fields · ' + bkms + ' BKMs' }),
          activeChip(t),
          ui.el('span', { class: 'row-actions' }, [k.editButton(t.code, function () { toolDialog(t); }), k.deleteButton('tools', t, t.code)])
        ] };
      }), 'No tools yet. Add the first one.')
    ]));

    if (!selectedToolId) return;
    var tool = store.byId('tools', selectedToolId);
    var picker = ui.segmented({ label: 'Tool', value: tool.id, options: tools.map(function (t) { return { value: t.id, label: t.code }; }),
      onChange: function (id) { selectedToolId = id; window.MRT.app.route(); } });
    body.appendChild(ui.el('div', { class: 'tool-picker' }, [ui.el('span', { class: 'ifield-label', text: 'Set up', 'aria-hidden': 'true' }), picker.node,
      ui.el('span', { class: 'muted', text: tool.name })]));

    body.appendChild(typesPanel(tool));
    body.appendChild(fieldsPanel(tool));
    body.appendChild(bkmsPanel(tool));
    K().focusRow(body, ctx.focusId);
  }

  /* --- Tool ---------------------------------------------------------- */

  function toolDialog(t) {
    var k = K(), edit = !!t;
    // quality engineers, plus whoever is set now (so an old choice still shows)
    var measurers = function (u) { return u.active && (D.canMeasure(u) || (edit && (u.id === t.primary_operator_id || u.id === t.backup_operator_id))); };
    return k.editDialog({
      title: edit ? 'Edit ' + t.code : 'Add a tool', icon: 'wrench',
      values: edit ? { code: t.code, name: t.name, glyph: t.glyph, primary_operator_id: t.primary_operator_id || '', backup_operator_id: t.backup_operator_id || '',
                       results_root: t.results_root || '', destructive: !!t.destructive, active: t.active !== false }
                   : { glyph: 'generic', destructive: false, active: true },
      fields: [
        { key: 'code', label: 'Code', kind: 'text', mono: true, cls: 'half', hint: '1-6 capitals, e.g. FIB. Starts every request ID.' },
        { key: 'glyph', label: 'Glyph', kind: 'select', cls: 'half', options: ui.GLYPHS.map(function (g) { return { value: g.key, label: g.label }; }) },
        { key: 'name', label: 'Name', kind: 'text', placeholder: 'e.g. FIB (focused ion beam)' },
        { key: 'primary_operator_id', label: 'Primary quality engineer', kind: 'select', cls: 'half', options: k.userOptions(measurers),
          hint: 'People with the Quality engineer role (People tab).' },
        { key: 'backup_operator_id', label: 'Backup quality engineer', kind: 'select', cls: 'half', options: k.userOptions(measurers) },
        { key: 'results_root', label: 'Results root folder', kind: 'path', placeholder: '\\\\server\\share\\Lab\\FIB',
          hint: 'The app proposes <root>\\YYYY\\<request ID>\\ for results (Q30).' },
        { key: 'destructive', label: 'Destructive - measuring destroys the panels (e.g. FIB). Requests must confirm it.', kind: 'check' },
        { key: 'active', label: 'Active (untick to hide the tool - it stays in the history)', kind: 'check' }
      ],
      check: function (v) {
        if (!D.isCode(v.code.toUpperCase(), 6)) return ['code', '1-6 capital letters or digits, e.g. FIB'];
        if (!v.name) return ['name', 'Enter a name'];
        if (v.primary_operator_id && v.primary_operator_id === v.backup_operator_id) return ['backup_operator_id', 'Pick a different person than the primary'];
        if (v.results_root && !D.isSharePath(v.results_root)) return ['results_root', 'A share path like \\\\server\\share\\... or Z:\\...'];
        return null;
      },
      save: function (v) { return store.saveEntry('tools', { id: edit ? t.id : undefined, version: edit ? t.version : undefined, fields: v, reason: 'Settings' }); },
      after: function (row) { if (row && row.id) selectedToolId = row.id; },
      done: edit ? 'Saved.' : 'Tool added.'
    }).catch(oops);
  }

  /* --- Measurement types ----------------------------------------------- */

  function typesPanel(tool) {
    var k = K();
    var types = ofTool('measurement_types', tool.id);
    var bkms = ofTool('bkms', tool.id);
    return k.panel('Measurement types - ' + tool.code, 'ruler', [ui.button('Add type', { size: 'sm', icon: 'plus', onClick: function () { typeDialog(tool, null); } })], [
      ui.el('p', { class: 'muted', text: 'The engineer picks the tool, then one of these (Q51).' }),
      k.table(['Name', 'BKMs', 'Status', { label: '', cls: 'actions' }], types.map(function (m) {
        return { id: 'row-' + m.id, cls: m.active === false ? 'is-off' : null, cells: [
          ui.el('span', { class: 'cell-main' }, [ui.el('span', { text: m.name }), m.sample ? k.sampleTag() : null]),
          ui.el('span', { class: 'num', text: String(bkms.filter(function (b) { return b.type_id === m.id; }).length) }),
          activeChip(m),
          ui.el('span', { class: 'row-actions' }, [k.editButton(m.name, function () { typeDialog(tool, m); }), k.deleteButton('measurement_types', m, m.name)])
        ] };
      }), 'No measurement types for ' + tool.code + ' yet.')
    ]);
  }

  function typeDialog(tool, m) {
    var edit = !!m;
    return K().editDialog({
      title: edit ? 'Edit ' + m.name : 'Add a measurement type to ' + tool.code, icon: 'ruler',
      intro: edit && m.sample ? 'This is a sample (made-up) entry. Save it - changed or not - to confirm it as a real one.' : null,
      values: edit ? { name: m.name, active: m.active !== false } : { active: true },
      fields: [
        { key: 'name', label: 'Name', kind: 'text', placeholder: 'e.g. Via cross-section' },
        { key: 'active', label: 'Active (untick to hide)', kind: 'check' }
      ],
      check: function (v) { return v.name ? null : ['name', 'Enter a name']; },
      save: function (v) {
        return store.saveEntry('measurement_types', { id: edit ? m.id : undefined, version: edit ? m.version : undefined,
          fields: edit ? v : Object.assign({ tool_id: tool.id }, v), reason: 'Settings' });
      },
      done: edit ? 'Saved.' : 'Type added.'
    }).catch(oops);
  }

  /* --- Extra fields ---------------------------------------------------- */

  function fieldsPanel(tool) {
    var k = K();
    var fields = ofTool('tool_fields', tool.id);
    function typeNames(ids) {
      return (ids || []).map(function (id) { var t = store.byId('measurement_types', id); return t ? t.name : '?'; }).join(', ');
    }
    return k.panel('Extra fields - ' + tool.code, 'sliders', [ui.button('Add field', { size: 'sm', icon: 'plus', onClick: function () { fieldDialog(tool, null); } })], [
      ui.el('p', { class: 'muted', text: 'Asked on every ' + tool.code + ' request, next to the core fields (Q5). Old requests keep their answers when a field changes.' }),
      k.table(['Label', 'Type', 'Required', 'Only for', 'Status', { label: '', cls: 'actions' }], fields.map(function (f) {
        return { id: 'row-' + f.id, cls: f.active === false ? 'is-off' : null, cells: [
          ui.el('span', { class: 'cell-main' }, [ui.el('span', { text: f.label }), f.sample ? k.sampleTag() : null]),
          k.fieldKind(f),
          f.required ? 'Yes' : k.muted('No'),
          f.type_ids && f.type_ids.length ? typeNames(f.type_ids) : k.muted('all types'),
          activeChip(f),
          ui.el('span', { class: 'row-actions' }, [k.editButton(f.label, function () { fieldDialog(tool, f); }), k.deleteButton('tool_fields', f, f.label)])
        ] };
      }), 'No extra fields for ' + tool.code + '. Add real ones when the engineers name them (OPEN_QUESTIONS #5).')
    ]);
  }

  function fieldDialog(tool, f) {
    var types = ofTool('measurement_types', tool.id).filter(function (m) { return m.active !== false || (f && (f.type_ids || []).indexOf(m.id) !== -1); });
    return K().fieldDialog({ collection: 'tool_fields', f: f, titleNew: 'Add a field to ' + tool.code, base: { tool_id: tool.id },
      typeOptions: types.map(function (m) { return { value: m.id, label: m.name }; }) }).catch(oops);
  }

  /* --- BKMs ------------------------------------------------------------ */

  function bkmsPanel(tool) {
    var k = K();
    var bkms = ofTool('bkms', tool.id);
    return k.panel('BKM library - ' + tool.code, 'requests', [ui.button('Add BKM', { size: 'sm', icon: 'plus', onClick: function () { bkmDialog(tool, null); } })], [
      ui.el('p', { class: 'muted', text: 'The engineer picks one of these on the request, or pastes a one-off path (Q13).' }),
      k.table(['Name', 'Measurement type', 'Path', 'Version', 'Status', { label: '', cls: 'actions' }], bkms.map(function (b) {
        var t = b.type_id ? store.byId('measurement_types', b.type_id) : null;
        return { id: 'row-' + b.id, cls: b.active === false ? 'is-off' : null, cells: [
          ui.el('span', { class: 'cell-main' }, [ui.el('span', { text: b.name }), b.sample ? k.sampleTag() : null]),
          t ? t.name : k.muted('any'),
          ui.el('span', { class: 'cell-path' }, [ui.el('span', { class: 'mono', text: b.path }), k.copyButton(b.path, 'BKM path')]),
          b.doc_version || k.muted('-'),
          activeChip(b),
          ui.el('span', { class: 'row-actions' }, [k.editButton(b.name, function () { bkmDialog(tool, b); }), k.deleteButton('bkms', b, b.name)])
        ] };
      }), 'No BKMs for ' + tool.code + ' yet.')
    ]);
  }

  function bkmDialog(tool, b) {
    var edit = !!b;
    var types = [{ value: '', label: '- any type -' }].concat(ofTool('measurement_types', tool.id)
      .filter(function (m) { return m.active !== false || (b && b.type_id === m.id); })
      .map(function (m) { return { value: m.id, label: m.name }; }));
    return K().editDialog({
      title: edit ? 'Edit BKM' : 'Add a BKM for ' + tool.code, icon: 'requests', wide: true,
      intro: edit && b.sample ? 'This is a sample entry with a fake path. Put in the real path; saving confirms it as a real one.' : null,
      values: edit ? { name: b.name, type_id: b.type_id || '', path: b.path, doc_version: b.doc_version || '', active: b.active !== false } : { type_id: '', active: true },
      fields: [
        { key: 'name', label: 'Name', kind: 'text', placeholder: 'e.g. FIB via cross-section BKM' },
        { key: 'type_id', label: 'Measurement type', kind: 'select', cls: 'half', options: types },
        { key: 'doc_version', label: 'Version', kind: 'text', cls: 'half', placeholder: 'e.g. v3' },
        { key: 'path', label: 'Path on the share', kind: 'path', placeholder: '\\\\server\\share\\BKM\\FIB\\...' },
        { key: 'active', label: 'Active (untick to hide)', kind: 'check' }
      ],
      check: function (v) {
        if (!v.name) return ['name', 'Enter a name'];
        if (!D.isSharePath(v.path)) return ['path', 'A share path like \\\\server\\share\\... or Z:\\...'];
        return null;
      },
      save: function (v) {
        var fields = { name: v.name, type_id: v.type_id || null, path: v.path, doc_version: v.doc_version, active: v.active };
        return store.saveEntry('bkms', { id: edit ? b.id : undefined, version: edit ? b.version : undefined,
          fields: edit ? fields : Object.assign({ tool_id: tool.id }, fields), reason: 'Settings' });
      },
      done: edit ? 'Saved.' : 'BKM added.'
    }).catch(oops);
  }

  window.MRT.settingsTabs.push({ key: 'tools', label: 'Tools', icon: 'wrench', order: 30, render: render });
})();
