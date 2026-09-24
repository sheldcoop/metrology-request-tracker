/**
 * Metrology Request Tracker - views/settings-lists.js
 *
 * Settings > Lists: lot fields (extra fields on every lot, like a tool's
 * extra fields), projects and build-ups (the lot pickers, Q7/Q8), part
 * numbers linked to one or more projects (M1-13), process steps ("the
 * panels are after ...", M2-7) and priorities (Q26: Line stop / Hot / Normal / Low - renamable, one is the
 * default, some need a reason). Lists are referenced by ID, so a rename
 * shows everywhere; delete only while unused, otherwise hide (Q47).
 */
(function () {
  'use strict';

  var ui = window.MRT.ui;
  var store = window.MRT.store;
  var D = window.MRT.domain;

  function K() { return window.MRT.settingsKit; }
  function oops(e) { if (!K().quiet(e)) ui.toastError(e.message, e); }
  function activeChip(r) { return K().chip(r.active === false ? 'Hidden' : 'Active', r.active === false ? 'neutral' : 'ok'); }

  function render(body, ctx) {
    body.appendChild(ui.el('p', { class: 'muted' }, [ui.el('span', {}, [
      'Lots themselves are registered on the ', ui.el('a', { href: '#/lots', text: 'Lots page' }),
      ' (Register lot) - by engineers and admins. What a lot holds beyond the core fields is set here under Lot fields.'])]));
    body.appendChild(ui.el('div', { class: 'settings-cols' }, [
      codeList('projects', 'Projects', 'project', 'e.g. C4F', 'lots'),
      codeList('buildups', 'Build-ups', 'build-up', 'e.g. BU-06', 'grid')
    ]));
    body.appendChild(lotFieldsPanel());
    body.appendChild(partNumbersPanel());
    body.appendChild(magazinesPanel());
    body.appendChild(namedPanel('process_steps'));
    body.appendChild(namedPanel('hold_reasons'));
    body.appendChild(prioritiesPanel());
    K().focusRow(body, ctx.focusId);
  }

  function codeList(collection, title, label, example, icon) {
    var k = K();
    var rows = store.list(collection, { all: true });
    return k.panel(title, icon, [ui.button('Add', { size: 'sm', icon: 'plus', onClick: function () { codeDialog(collection, label, example, null); } })], [
      k.table(['Code', 'Name', 'Status', { label: '', cls: 'actions' }], rows.map(function (r) {
        return { id: 'row-' + r.id, cls: r.active === false ? 'is-off' : null, cells: [
          ui.el('b', { class: 'mono', text: r.code }), r.name || k.muted('-'), activeChip(r),
          ui.el('span', { class: 'row-actions' }, [k.editButton(r.code, function () { codeDialog(collection, label, example, r); }), k.deleteButton(collection, r, r.code)])
        ] };
      }), 'None yet.')
    ]);
  }

  function codeDialog(collection, label, example, r) {
    var edit = !!r;
    return K().editDialog({
      title: edit ? 'Edit ' + r.code : 'Add a ' + label, icon: 'edit',
      values: edit ? { code: r.code, name: r.name || '', active: r.active !== false } : { active: true },
      fields: [
        { key: 'code', label: 'Code', kind: 'text', mono: true, cls: 'half', placeholder: example, hint: 'Capitals, digits and dashes.' },
        { key: 'name', label: 'Long name (optional)', kind: 'text', cls: 'half' },
        { key: 'active', label: 'Active (untick to hide it from the pickers; lots using it keep it)', kind: 'check' }
      ],
      check: function (v) { return D.isCode(v.code.toUpperCase(), 12) ? null : ['code', 'Capitals, digits and dashes, e.g. ' + example]; },
      save: function (v) { return store.saveEntry(collection, { id: edit ? r.id : undefined, version: edit ? r.version : undefined, fields: v, reason: 'Settings' }); },
      done: edit ? 'Saved.' : 'Added.'
    }).catch(oops);
  }

  function lotFieldsPanel() {
    var k = K();
    var rows = store.list('lot_fields', { all: true });
    return k.panel('Lot fields', 'sliders', [ui.button('Add field', { size: 'sm', icon: 'plus', onClick: function () { lotFieldDialog(null); } })], [
      ui.el('p', { class: 'muted', text: 'Asked on every lot, after lot number, project, part number, build-up and panels. ' +
        'Add, rename or hide them any time - lots keep their answers. Same kinds as a tool\'s extra fields.' }),
      k.table(['Label', 'Type', 'Required', 'Status', { label: '', cls: 'actions' }], rows.map(function (f) {
        return { id: 'row-' + f.id, cls: f.active === false ? 'is-off' : null, cells: [
          ui.el('span', { class: 'cell-main' }, [ui.el('span', { text: f.label }), f.sample ? k.sampleTag() : null]),
          k.fieldKind(f), f.required ? 'Yes' : k.muted('No'), activeChip(f),
          ui.el('span', { class: 'row-actions' }, [k.editButton(f.label, function () { lotFieldDialog(f); }), k.deleteButton('lot_fields', f, f.label)])
        ] };
      }), 'No lot fields. Lots then hold only the core fields.')
    ]);
  }

  function lotFieldDialog(f) {
    return K().fieldDialog({ collection: 'lot_fields', f: f, titleNew: 'Add a lot field' }).catch(oops);
  }

  function projectCodes(ids) {
    return (ids || []).map(function (id) { var p = store.byId('projects', id); return p ? p.code : '?'; });
  }

  function partNumbersPanel() {
    var k = K();
    var rows = store.list('part_numbers', { all: true });
    var canAdd = store.list('projects').length > 0;
    return k.panel('Part numbers', 'tag', [ui.button('Add', { size: 'sm', icon: 'plus', disabled: !canAdd,
      title: canAdd ? null : 'Add a project first', onClick: function () { partNumberDialog(null); } })], [
      ui.el('p', { class: 'muted', text: 'Each part number is stored once and linked to one or more projects. ' +
        'From M2 a lot picks a project, then one of its part numbers.' }),
      k.table(['Part number', 'Description', 'Projects', 'Status', { label: '', cls: 'actions' }], rows.map(function (r) {
        return { id: 'row-' + r.id, cls: r.active === false ? 'is-off' : null, cells: [
          ui.el('b', { class: 'mono', text: r.code }), r.description || k.muted('-'),
          ui.el('span', { class: 'chip-row' }, projectCodes(r.project_ids).map(function (c) { return k.chip(c, 'neutral'); })),
          activeChip(r),
          ui.el('span', { class: 'row-actions' }, [k.editButton(r.code, function () { partNumberDialog(r); }), k.deleteButton('part_numbers', r, r.code)])
        ] };
      }), 'None yet. Add the part numbers of each project.')
    ]);
  }

  function partNumberDialog(r) {
    var edit = !!r;
    var linked = edit ? r.project_ids || [] : [];
    // active projects, plus hidden ones this part number already uses (so saving keeps them)
    var options = store.list('projects', { all: true }).filter(function (p) { return p.active !== false || linked.indexOf(p.id) !== -1; })
      .map(function (p) { return { value: p.id, label: p.code + (p.active === false ? ' (hidden)' : '') }; });
    return K().editDialog({
      title: edit ? 'Edit ' + r.code : 'Add a part number', icon: 'edit',
      values: edit ? { code: r.code, description: r.description || '', project_ids: linked.slice(), active: r.active !== false } : { project_ids: [], active: true },
      fields: [
        { key: 'code', label: 'Part number', kind: 'text', mono: true, cls: 'half', placeholder: 'e.g. PN-10234-A', hint: 'Capitals, digits and - . _ /' },
        { key: 'description', label: 'Description (optional)', kind: 'text', cls: 'half' },
        { key: 'project_ids', label: 'Projects (one or more)', kind: 'checks', options: options },
        { key: 'active', label: 'Active (untick to hide it from the pickers; lots using it keep it)', kind: 'check' }
      ],
      check: function (v) {
        if (!D.isPartNumber(String(v.code || '').trim().toUpperCase())) return ['code', 'Capitals, digits and - . _ / (up to 30), e.g. PN-10234-A'];
        if (!v.project_ids.length) return ['project_ids', 'Tick at least one project'];
        return null;
      },
      save: function (v) { return store.saveEntry('part_numbers', { id: edit ? r.id : undefined, version: edit ? r.version : undefined, fields: v, reason: 'Settings' }); },
      done: edit ? 'Saved.' : 'Added.'
    }).catch(oops);
  }

  /** Magazines (M2-23): M-number, slots, the rack it stands in now, which lots use it. */
  function magazinesPanel() {
    var k = K();
    var rows = store.list('magazines', { all: true });
    var racks = store.getSetting('rack_count');
    var lots = store.data().lots || [];
    var rackF = ui.field({ label: 'Racks', type: 'number', value: racks, cls: 'rack-count' });
    var saveRacks = ui.button('Save', { size: 'sm', onClick: function () {
      store.setRackCount(Number(rackF.value())).then(function () { ui.toast({ kind: 'success', message: 'Racks saved.' }); window.MRT.app.route(); }).catch(oops);
    } });
    return k.panel('Magazines', 'grid', [ui.button('Add', { size: 'sm', icon: 'plus', onClick: function () { magazineDialog(null); } })], [
      ui.el('p', { class: 'muted', text: 'Cassettes that hold a lot\'s panels, one panel per slot, standing in a rack. ' +
        'A lot picks its magazines; the request and the quality engineer say which rack.' }),
      ui.el('div', { class: 'lots-tools' }, [rackF.node, saveRacks]),
      k.table(['Magazine', { label: 'Slots', cls: 'num' }, { label: 'Rack now', cls: 'num' }, 'Lots', 'Status', { label: '', cls: 'actions' }], rows.map(function (m) {
        var used = lots.filter(function (l) { return (l.magazine_ids || []).indexOf(m.id) !== -1; }).map(function (l) { return l.lot_number; });
        return { id: 'row-' + m.id, cls: m.active === false ? 'is-off' : null, cells: [
          ui.el('span', { class: 'cell-main' }, [ui.el('b', { class: 'mono', text: m.code }), m.sample ? k.sampleTag() : null]),
          ui.el('span', { class: 'num', text: String(m.slots) }), ui.el('span', { class: 'num', text: m.rack ? String(m.rack) : '-' }),
          used.length ? ui.el('span', { class: 'mono', text: used.join(', ') }) : k.muted('-'), activeChip(m),
          ui.el('span', { class: 'row-actions' }, [k.editButton(m.code, function () { magazineDialog(m); }), k.deleteButton('magazines', m, m.code)])
        ] };
      }), 'No magazines yet.')
    ]);
  }

  function magazineDialog(m) {
    var edit = !!m;
    var racks = store.getSetting('rack_count');
    return K().editDialog({
      title: edit ? 'Edit ' + m.code : 'Add a magazine', icon: 'grid',
      values: edit ? { code: m.code, slots: m.slots, rack: m.rack ? String(m.rack) : '', active: m.active !== false } : { slots: 24, rack: '', active: true },
      fields: [
        { key: 'code', label: 'Magazine', kind: 'text', mono: true, cls: 'half', placeholder: 'e.g. M70365' },
        { key: 'slots', label: 'Slots', kind: 'number', cls: 'half' },
        { key: 'rack', label: 'Rack now', kind: 'select', cls: 'half', options: [{ value: '', label: '- none -' }].concat(rackOptions(racks)) },
        { key: 'active', label: 'Active (untick to hide it from the pickers)', kind: 'check' }
      ],
      check: function (v) {
        if (!D.isMagazineCode(String(v.code || '').trim().toUpperCase())) return ['code', 'M and digits, e.g. M70365'];
        if (!(v.slots >= 1 && v.slots <= 99) || Math.floor(v.slots) !== v.slots) return ['slots', 'A whole number, 1-99'];
        return null;
      },
      save: function (v) {
        return store.saveEntry('magazines', { id: edit ? m.id : undefined, version: edit ? m.version : undefined,
          fields: { code: v.code, slots: v.slots, rack: v.rack ? Number(v.rack) : null, active: v.active }, reason: 'Settings' });
      },
      done: edit ? 'Saved.' : 'Added.'
    }).catch(oops);
  }

  function rackOptions(n) { var o = []; for (var i = 1; i <= n; i++) o.push({ value: String(i), label: 'Rack ' + i }); return o; }

  /** A plain ordered list of names (process steps, on-hold reasons). */
  var NAMED = {
    process_steps: { title: 'Process steps', icon: 'activity', what: 'process step', placeholder: 'e.g. After desmear',
      intro: 'A request says which step the panels are at ("after desmear"). Listed in line order; engineers can still type another step.',
      empty: 'None yet. Add the steps of the line, e.g. After desmear.', pos: 'Position (1 = first in the line)',
      active: 'Active (untick to hide it from the request form)' },
    hold_reasons: { title: 'On-hold reasons', icon: 'clock', what: 'on-hold reason', placeholder: 'e.g. Waiting for panels',
      intro: 'A quality engineer picks one when putting a request on hold (plus an optional note). Analytics counts them (M3-4).',
      empty: 'None - a request cannot be put on hold without a reason.', pos: 'Position in the list', active: 'Active (untick to hide it)' }
  };

  function namedPanel(coll) {
    var k = K(), c = NAMED[coll];
    var rows = store.list(coll, { all: true });
    return k.panel(c.title, c.icon, [ui.button('Add', { size: 'sm', icon: 'plus', onClick: function () { namedDialog(coll, null); } })], [
      ui.el('p', { class: 'muted', text: c.intro }),
      k.table([{ label: '#', cls: 'num' }, 'Name', 'Status', { label: '', cls: 'actions' }], rows.map(function (r) {
        return { id: 'row-' + r.id, cls: r.active === false ? 'is-off' : null, cells: [
          ui.el('span', { class: 'num', text: String(r.sort || '') }), ui.el('b', { text: r.name }), activeChip(r),
          ui.el('span', { class: 'row-actions' }, [k.editButton(r.name, function () { namedDialog(coll, r); }), k.deleteButton(coll, r, r.name)])
        ] };
      }), c.empty)
    ]);
  }

  function namedDialog(coll, r) {
    var edit = !!r, c = NAMED[coll];
    return K().editDialog({
      title: edit ? 'Edit ' + r.name : 'Add a ' + c.what, icon: 'edit',
      values: edit ? { name: r.name, sort: r.sort, active: r.active !== false }
                   : { sort: store.list(coll, { all: true }).length + 1, active: true },
      fields: [
        { key: 'name', label: 'Name', kind: 'text', cls: 'half', placeholder: c.placeholder },
        { key: 'sort', label: c.pos, kind: 'number', cls: 'half' },
        { key: 'active', label: c.active, kind: 'check' }
      ],
      check: function (v) {
        if (!v.name) return ['name', 'Enter a name'];
        if (!(v.sort >= 1) || Math.floor(v.sort) !== v.sort) return ['sort', 'A whole number, 1 or more'];
        return null;
      },
      save: function (v) { return store.saveEntry(coll, { id: edit ? r.id : undefined, version: edit ? r.version : undefined, fields: v, reason: 'Settings' }); },
      done: edit ? 'Saved.' : 'Added.'
    }).catch(oops);
  }

  function prioritiesPanel() {
    var k = K();
    var rows = store.list('priorities', { all: true });
    return k.panel('Priorities', 'alert', [ui.button('Add', { size: 'sm', icon: 'plus', onClick: function () { priorityDialog(null); } })], [
      ui.el('p', { class: 'muted', text: 'Shown big as the word, small as the code. Level 1 is the most urgent. ' +
        'Priorities that need a reason ask the engineer why; managers see them in analytics.' }),
      k.table(['Priority', 'Level', 'Needs a reason', 'Default', 'Status', { label: '', cls: 'actions' }], rows.map(function (p) {
        return { id: 'row-' + p.id, cls: p.active === false ? 'is-off' : null, cells: [
          ui.el('span', { class: 'prio-label' }, [ui.el('b', { text: p.name }), ui.el('span', { class: 'mono muted', text: p.code })]),
          ui.el('span', { class: 'num', text: String(p.level) }),
          p.needs_reason ? 'Yes' : k.muted('No'),
          p.is_default ? k.chip('Default', 'ok') : '',
          activeChip(p),
          ui.el('span', { class: 'row-actions' }, [k.editButton(p.name, function () { priorityDialog(p); }), k.deleteButton('priorities', p, p.name)])
        ] };
      }))
    ]);
  }

  function priorityDialog(p) {
    var edit = !!p;
    return K().editDialog({
      title: edit ? 'Edit ' + p.name : 'Add a priority', icon: 'alert',
      values: edit ? { name: p.name, code: p.code, level: p.level, needs_reason: !!p.needs_reason, is_default: !!p.is_default, active: p.active !== false }
                   : { level: store.list('priorities', { all: true }).length + 1, active: true },
      fields: [
        { key: 'name', label: 'Name', kind: 'text', cls: 'half', placeholder: 'e.g. Line stop' },
        { key: 'code', label: 'Code', kind: 'text', mono: true, cls: 'half', placeholder: 'e.g. P1' },
        { key: 'level', label: 'Level (1 = most urgent)', kind: 'number', cls: 'half' },
        { key: 'needs_reason', label: 'The engineer must give a reason', kind: 'check' },
        { key: 'is_default', label: 'Default for new requests (only one)', kind: 'check' },
        { key: 'active', label: 'Active (untick to hide)', kind: 'check' }
      ],
      check: function (v) {
        if (!v.name) return ['name', 'Enter a name'];
        if (!D.isCode(v.code.toUpperCase(), 4)) return ['code', 'A short code, e.g. P1'];
        if (!(v.level >= 1) || Math.floor(v.level) !== v.level) return ['level', 'A whole number, 1 or more'];
        return null;
      },
      save: function (v) { return store.saveEntry('priorities', { id: edit ? p.id : undefined, version: edit ? p.version : undefined, fields: v, reason: 'Settings' }); },
      done: edit ? 'Saved.' : 'Added.'
    }).catch(oops);
  }

  window.MRT.settingsTabs.push({ key: 'lists', label: 'Lists', icon: 'lots', order: 40, render: render });
})();
