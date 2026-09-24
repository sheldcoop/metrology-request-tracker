/**
 * Metrology Request Tracker - views/settings-lots.js
 *
 * Settings > Lots (admins): the SAME list as the Lots page - one list, two
 * doors; a lot registered in either place shows in both. Admin extras:
 * add many lots at once (same project, part number, build-up, panels),
 * give a lot to another owner, delete any unused lot (with a reason).
 */
(function () {
  'use strict';

  var ui = window.MRT.ui;
  var store = window.MRT.store;
  var D = window.MRT.domain;

  function K() { return window.MRT.settingsKit; }
  function L() { return window.MRT.views.lots; }
  function code(coll, id) { var r = id ? store.byId(coll, id) : null; return r ? r.code : null; }

  var PAGE = 100;
  var shown = PAGE;

  function render(body, ctx) {
    var k = K();
    var lots = (store.data().lots || []).slice().sort(function (a, b) { return a.created_ts < b.created_ts ? 1 : a.created_ts > b.created_ts ? -1 : 0; });
    var rows = lots.slice(0, shown);
    body.appendChild(k.panel('Lots', 'lots', [
      ui.button('Add several lots', { kind: 'primary', size: 'sm', icon: 'plus', onClick: bulkDialog }),
      ui.button('Register one lot', { size: 'sm', icon: 'plus', onClick: function () { L().lotDialog(null); } })
    ], [
      ui.el('p', { class: 'muted' }, ['The same list as the ', ui.el('a', { href: '#/lots', text: 'Lots page' }),
        ' - a lot added here shows there and in the request form, and the other way round. ' + lots.length + ' lots.']),
      k.table(['Lot', 'Project', 'Part number', 'Build-up', { label: 'Panels', cls: 'num' }, 'Owner', 'Requests', { label: '', cls: 'actions' }], rows.map(function (l) {
        var owner = store.byId('users', l.owner_id);
        return { id: 'row-' + l.id, cells: [
          ui.el('span', { class: 'cell-main' }, [ui.el('a', { class: 'mono lot-link', href: '#/lots/' + l.id, text: l.lot_number,
            onclick: function (ev) { ev.preventDefault(); L().detailsDialog(l); } }), l.sample ? k.sampleTag() : null]),
          code('projects', l.project_id) || k.muted('?'),
          l.part_number_id ? ui.el('span', { class: 'mono', text: code('part_numbers', l.part_number_id) || '?' }) : k.muted('-'),
          code('buildups', l.buildup_id) || k.muted('?'),
          ui.el('span', { class: 'num', text: l.panel_count ? String(l.panel_count) : '-' }),
          owner ? owner.name + (owner.active === false ? ' (switched off)' : '') : k.muted('?'),
          ui.el('span', { class: 'num', text: String(store.lotUsage(l.id).count) }),
          ui.el('span', { class: 'row-actions' }, [
            ui.button('', { kind: 'ghost', size: 'sm', icon: 'user', ariaLabel: 'Change owner of lot ' + l.lot_number, title: 'Change owner',
              onClick: function () { ownerDialog(l); } }),
            k.editButton('lot ' + l.lot_number, function () { L().lotDialog(l); }),
            L().deleteButton(l)
          ])
        ] };
      }), 'No lots yet. Engineers register them on the Lots page; you can add several at once here.'),
      lots.length > shown ? ui.button('Show ' + Math.min(PAGE, lots.length - shown) + ' more', { size: 'sm', onClick: function () { shown += PAGE; window.MRT.app.route(); } }) : null
    ]));
    k.focusRow(body, ctx.focusId);
  }

  /** Several lots at once: same project, part number, build-up, panels (and lot fields). */
  function bulkDialog() {
    var lots = L();
    var start = lots.pnOptions('', null);
    return K().editDialog({
      title: 'Add several lots', icon: 'lots', wide: true, saveLabel: 'Add lots',
      intro: 'For lots that start together with the same set-up. Each gets its own lot number; you are the owner (change it per lot afterwards).',
      values: { numbers: '', panel_count: null, project_id: '', part_number_id: '', buildup_id: '', note: '' },
      fields: [
        { key: 'numbers', label: 'Lot numbers', kind: 'longtext', placeholder: 'e.g. 18178, 18179, 18180  or  18178-18180  or one per line',
          hint: 'Commas, spaces or new lines. A run like 18178-18180 adds every number in it.' },
        { key: 'panel_count', label: 'Panels per lot (optional)', kind: 'number', cls: 'half' },
        { key: 'project_id', label: 'Project', kind: 'select', cls: 'half', options: lots.projectOptions('projects', null, '- pick a project -') },
        { key: 'part_number_id', label: 'Part number', kind: 'select', cls: 'half', options: start.options },
        { key: 'buildup_id', label: 'Build-up', kind: 'select', cls: 'half', options: lots.projectOptions('buildups', null, '- pick a build-up -') },
        { key: 'note', label: 'Note (optional, on every lot)', kind: 'longtext' }
      ].concat(lots.extraSpecs(null)),
      onForm: function (f) {
        var prj = f.control('project_id');
        prj.addEventListener('change', function () { var o = lots.pnOptions(prj.value, null); f.setOptions('part_number_id', o.options, o.value); });
      },
      check: function (v) {
        var p = D.parseLotNumbers(v.numbers);
        if (p.errors.length) return ['numbers', p.errors[0]];
        if (!p.numbers.length) return ['numbers', 'Enter at least one lot number'];
        if (v.panel_count !== null && (!(v.panel_count >= 1 && v.panel_count <= D.LOT_MAX_PANELS) || Math.floor(v.panel_count) !== v.panel_count)) return ['panel_count', 'Empty, or a whole number from 1 to ' + D.LOT_MAX_PANELS];
        if (!v.project_id) return ['project_id', 'Pick a project'];
        if (!v.buildup_id) return ['buildup_id', 'Pick a build-up'];
        return null;
      },
      save: function (v) {
        return store.addLots({ numbers: D.parseLotNumbers(v.numbers).numbers, fields: { project_id: v.project_id, part_number_id: v.part_number_id,
          buildup_id: v.buildup_id, panel_count: v.panel_count, note: v.note, extra: lots.extraFrom(v) } });
      },
      done: 'Lots added.'
    }).catch(function (e) { if (!K().quiet(e)) ui.toastError(e.message, e); });
  }

  function ownerDialog(l) {
    var k = K();
    var people = store.list('users').filter(function (u) { return u.active !== false; });
    return k.editDialog({
      title: 'Owner of lot ' + l.lot_number, icon: 'user',
      values: { owner_id: l.owner_id, reason: '' },
      fields: [
        { key: 'owner_id', label: 'New owner', kind: 'select', options: people.map(function (u) { return { value: u.id, label: u.name }; }) },
        { key: 'reason', label: 'Reason', kind: 'text', placeholder: 'e.g. Erik left the team' }
      ],
      check: function (v) { return v.reason ? null : ['reason', 'Give a reason for the audit log']; },
      save: function (v) { return store.setLotOwner(l.id, v.owner_id, v.reason); },
      done: 'Owner changed.'
    }).catch(function (e) { if (!k.quiet(e)) ui.toastError(e.message, e); });
  }

  window.MRT.settingsTabs.push({ key: 'lots', label: 'Lots', icon: 'lots', order: 45, render: render });
})();
