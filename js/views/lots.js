/**
 * Metrology Request Tracker - views/lots.js
 *
 * Lots (#/lots, DECISIONS M2-1): every registered lot - lot number, project,
 * part number (of that project), build-up, panel count, owner, note, plus
 * the admin-defined lot fields (Settings > Lists > Lot fields). Any
 * engineer registers a lot (Q7); its owner or an admin changes it or deletes
 * it while no request uses it. Newest first, 100 rows per page.
 *
 * #/lots/<lot id> marks that lot (from the search or a Health link).
 */
window.MRT = window.MRT || {};
window.MRT.views = window.MRT.views || {};
window.MRT.views.lots = (function () {
  'use strict';

  var ui = window.MRT.ui;
  var store = window.MRT.store;
  var D = window.MRT.domain;

  var PAGE = 100;
  var view = { filter: '', mine: false, shown: PAGE };

  function K() { return window.MRT.settingsKit; }
  function code(coll, id) { var r = id ? store.byId(coll, id) : null; return r ? r.code : null; }
  function userName(id) { var u = id ? store.byId('users', id) : null; return u ? u.name : null; }

  /* --- Lot fields (admin-defined, js/views/extra-fields.js) ------------ */

  var X = window.MRT.extraFields;
  function lotFields() { return store.list('lot_fields', { all: true }); }
  function answerText(f, v) { return X.answerText(f, v); }
  function extraSpecs(lot) { return X.specs(lotFields(), lot && lot.extra); }
  function extraValues(lot) { return X.values(lotFields(), lot && lot.extra); }
  function extraFrom(v) { return X.answers(lotFields(), v); }

  function render(main, ctx) {
    var me = store.currentUser();
    var canAdd = D.canRegisterLot(me);
    main.appendChild(ui.pageHead('Lots', 'Every registered lot. A request picks its lot and panels from here.',
      canAdd ? [ui.button('Register lot', { kind: 'primary', icon: 'plus', onClick: function () { lotDialog(null); } })] : null));

    var all = store.data().lots || [];
    if (!all.length) {
      main.appendChild(ui.emptyState({ icon: 'lots', title: 'No lots yet',
        text: canAdd ? 'Register the first lot: lot number, project, part number, build-up and panel count.'
                     : 'Engineers register lots.' }));
      return;
    }

    var box = ui.field({ label: 'Filter', placeholder: 'Lot, project, part number, build-up, owner', value: view.filter });
    var mine = ui.toggle({ kind: 'switch', label: 'Only my lots', checked: view.mine });
    var holder = ui.el('div');
    main.appendChild(ui.el('div', { class: 'lots-tools' }, [box.node, mine.node]));
    main.appendChild(holder);

    function draw() {
      var rows = matching(me);
      var more = rows.length > view.shown;
      ui.mount(holder, [
        ui.el('p', { class: 'muted', text: rows.length + ' of ' + all.length + ' lots' + (more ? ' - showing the newest ' + view.shown : '') }),
        table(rows.slice(0, view.shown), me),
        more ? ui.button('Show ' + Math.min(PAGE, rows.length - view.shown) + ' more', { size: 'sm', onClick: function () { view.shown += PAGE; draw(); } }) : null
      ]);
    }
    box.input.addEventListener('input', function () { view.filter = box.value(); view.shown = PAGE; draw(); });
    mine.input.addEventListener('change', function () { view.mine = mine.input.checked; view.shown = PAGE; draw(); });
    draw();

    if (ctx.subpath) {
      var hit = store.byId('lots', ctx.subpath);
      if (hit && !holder.querySelector('#row-' + hit.id)) { view.filter = hit.lot_number; box.input.value = hit.lot_number; view.mine = false; mine.input.checked = false; draw(); }
      K().focusRow(holder, ctx.subpath);
    }
  }

  /** Lots matching the filter, newest first. */
  function matching(me) {
    var q = D.normalizeName(view.filter || '');
    return (store.data().lots || []).filter(function (l) {
      if (view.mine && (!me || l.owner_id !== me.id)) return false;
      if (!q) return true;
      var hay = [l.lot_number, code('projects', l.project_id), code('part_numbers', l.part_number_id),
                 code('buildups', l.buildup_id), userName(l.owner_id), l.note].concat(store.list('lot_fields', { all: true }).map(function (f) {
                   return answerText(f, (l.extra || {})[f.id]); })).join(' ');
      return D.normalizeName(hay).indexOf(q) !== -1;
    }).sort(function (a, b) { return a.created_ts < b.created_ts ? 1 : a.created_ts > b.created_ts ? -1 : 0; });
  }

  function table(rows, me) {
    var k = K();
    return k.table(['Lot', 'Project', 'Part number', 'Build-up', { label: 'Panels', cls: 'num' }, 'Owner', 'Registered', 'Note', { label: '', cls: 'actions' }],
      rows.map(function (l) {
        var edit = D.canEditLot(me, l);
        return { id: 'row-' + l.id, cells: [
          ui.el('span', { class: 'cell-main' }, [
            ui.el('a', { class: 'mono lot-link', href: '#/lots/' + l.id, text: l.lot_number, title: 'All details of lot ' + l.lot_number,
              onclick: function (ev) { ev.preventDefault(); detailsDialog(l); } }),
            l.sample ? k.sampleTag() : null]),
          code('projects', l.project_id) || k.muted('?'),
          l.part_number_id ? ui.el('span', { class: 'mono', text: code('part_numbers', l.part_number_id) || '?' }) : k.muted('-'),
          code('buildups', l.buildup_id) || k.muted('?'),
          ui.el('span', { class: 'num', text: l.panel_count ? String(l.panel_count) : '-' }),
          userName(l.owner_id) || k.muted('?'),
          ui.el('span', { class: 'num', text: ui.formatDate(l.created_ts) }),
          l.note ? ui.el('span', { class: 'cell-note', text: l.note, title: l.note }) : k.muted('-'),
          edit ? ui.el('span', { class: 'row-actions' }, [k.editButton('lot ' + l.lot_number, function () { lotDialog(l); }), deleteButton(l)]) : ''
        ] };
      }), 'No lot matches the filter.');
  }

  /* --- Register / edit ------------------------------------------------ */

  /** Active entries, plus the one already picked (so a hidden one still shows). */
  function options(coll, current, empty) {
    return [{ value: '', label: empty }].concat(store.list(coll, { all: true })
      .filter(function (r) { return r.active !== false || r.id === current; })
      .map(function (r) { return { value: r.id, label: r.code + (r.name ? ' - ' + r.name : '') + (r.active === false ? ' (hidden)' : '') }; }));
  }

  /** The part numbers of a project (M2-1): one is picked for you when there is only one. */
  function pnOptions(projectId, current) {
    var list = store.list('part_numbers', { all: true }).filter(function (p) {
      return (p.project_ids || []).indexOf(projectId) !== -1 && (p.active !== false || p.id === current);
    }).map(function (p) { return { value: p.id, label: p.code + (p.description ? ' - ' + p.description : '') }; });
    if (!projectId) return { options: [{ value: '', label: '- pick the project first -' }], value: '' };
    if (!list.length) return { options: [{ value: '', label: '- none for this project -' }], value: '' };
    var opts = [{ value: '', label: '- none -' }].concat(list);
    return { options: opts, value: current || (list.length === 1 ? list[0].value : '') };
  }

  function lotDialog(l) {
    var edit = !!l;
    var start = pnOptions(edit ? l.project_id : '', edit ? l.part_number_id : null);
    return K().editDialog({
      title: edit ? 'Edit lot ' + l.lot_number : 'Register a lot', icon: 'lots', wide: true,
      values: Object.assign(edit ? { lot_number: l.lot_number, panel_count: l.panel_count, project_id: l.project_id, part_number_id: start.value,
                       buildup_id: l.buildup_id, note: l.note || '' }
                   : { lot_number: '', panel_count: null, project_id: '', part_number_id: '', buildup_id: '', note: '' }, extraValues(l)),
      fields: [
        { key: 'lot_number', label: 'Lot number', kind: 'text', mono: true, cls: 'half', placeholder: 'e.g. 18178 or 18178.01',
          hint: 'A split lot adds .01, .02 ...' },
        { key: 'panel_count', label: 'Panels in the lot (optional)', kind: 'number', cls: 'half', hint: 'Requests name their panels by Hirata ID.' },
        { key: 'project_id', label: 'Project', kind: 'select', cls: 'half', options: options('projects', edit ? l.project_id : null, '- pick a project -') },
        { key: 'part_number_id', label: 'Part number', kind: 'select', cls: 'half', options: start.options,
          hint: 'The part numbers of the project (Settings > Lists).' },
        { key: 'buildup_id', label: 'Build-up', kind: 'select', cls: 'half', options: options('buildups', edit ? l.buildup_id : null, '- pick a build-up -') },
        { key: 'note', label: 'Note (optional)', kind: 'longtext', placeholder: 'e.g. panels 3-4 have a known scratch' }
      ].concat(extraSpecs(l)),
      onForm: function (f) {
        var prj = f.control('project_id');
        prj.addEventListener('change', function () {
          var o = pnOptions(prj.value, null);
          f.setOptions('part_number_id', o.options, o.value);
        });
      },
      check: function (v) {
        if (!D.isLotNumber(v.lot_number)) return ['lot_number', 'Digits, a split lot adds .01 - e.g. 18178 or 18178.01'];
        if (v.panel_count !== null && (!(v.panel_count >= 1 && v.panel_count <= D.LOT_MAX_PANELS) || Math.floor(v.panel_count) !== v.panel_count)) {
          return ['panel_count', 'Empty, or a whole number from 1 to ' + D.LOT_MAX_PANELS];
        }
        if (!v.project_id) return ['project_id', 'Pick a project'];
        if (!v.buildup_id) return ['buildup_id', 'Pick a build-up'];
        return null;
      },
      save: function (v) {
        var core = { lot_number: v.lot_number, panel_count: v.panel_count, project_id: v.project_id, part_number_id: v.part_number_id,
                     buildup_id: v.buildup_id, note: v.note, extra: extraFrom(v) };
        return store.saveLot({ id: edit ? l.id : undefined, version: edit ? l.version : undefined, fields: core });
      },
      done: edit ? 'Saved.' : 'Lot registered.'
    }).catch(function (e) { if (!K().quiet(e)) ui.toastError(e.message, e); });
  }

  /** Everything about a lot, lot fields included (the table shows only the core). */
  function detailsDialog(l) {
    var ex = l.extra || {};
    function row(label, value) { return [ui.el('dt', { text: label }), ui.el('dd', {}, value === null || value === '' ? K().muted('-') : value)]; }
    var rows = [
      row('Project', code('projects', l.project_id)), row('Part number', code('part_numbers', l.part_number_id)),
      row('Build-up', code('buildups', l.buildup_id)), row('Panels in the lot', l.panel_count ? String(l.panel_count) : null),
      row('Scrapped panels', (l.scrapped || []).length ? l.scrapped.join(', ') : null),
      row('Owner', userName(l.owner_id)), row('Registered', ui.formatTs(l.created_ts)), row('Note', l.note || null)
    ].concat(store.list('lot_fields', { all: true }).filter(function (f) { return f.active !== false || !D.isEmptyAnswer(ex[f.id]); }).map(function (f) {
      return row(f.label, answerText(f, ex[f.id]) || null);
    }));
    var me = store.currentUser();
    var reqs = store.visibleRequests(function (r) { return r.lot_id === l.id; });
    var reqList = reqs.length ? ui.el('ul', { class: 'req-list' }, reqs.map(function (r) {
      var t = store.byId('tools', r.tool_id);
      return ui.el('li', {}, [
        ui.el('a', { class: 'mono', href: r.status === 'draft' ? '#/new/' + r.id : '#/request/' + r.id, text: r.request_no || ((t ? t.code : '?') + ' draft') }),
        ui.el('span', { class: 'muted', text: ' · ' + D.REQUEST_STATUS_LABEL[r.status] + ' · panels ' + D.panelsText(r) })
      ]);
    })) : ui.el('p', { class: 'muted', text: 'No requests on this lot yet.' });
    var acts = [{ label: 'Close', value: null }];
    if (D.canRequest(me)) acts.push({ label: 'New request on this lot', value: 'new' });
    if (D.canEditLot(me, l)) acts.push({ label: 'Edit', kind: 'primary', value: 'edit' });
    ui.dialog({ title: 'Lot ' + l.lot_number + (l.sample ? ' (sample)' : ''), icon: 'lots', wide: true,
      body: [ui.el('dl', { class: 'facts' }, [].concat.apply([], rows)), ui.el('div', { class: 'ifield-label', text: 'Requests' }), reqList],
      actions: acts
    }).then(function (v) {
      if (v === 'edit') lotDialog(l);
      if (v === 'new') location.hash = '#/new?lot=' + l.id;
    });
  }

  function deleteButton(l) {
    var name = 'lot ' + l.lot_number;
    return ui.button('', { kind: 'ghost', size: 'sm', icon: 'trash', ariaLabel: 'Delete ' + name, title: 'Delete ' + name,
      onClick: function () {
        var usage = store.lotUsage(l.id);
        if (usage.count) {
          ui.dialog({ title: 'Cannot delete ' + name, icon: 'lock', body: ui.el('p', { text: 'Lot ' + l.lot_number + ' is used by ' + usage.text + '.' }) });
          return;
        }
        ui.promptReason({ title: 'Delete ' + name, confirmLabel: 'Delete',
          message: 'No request uses lot ' + l.lot_number + '. Deleting removes it for good; the audit log keeps a record. Why?'
        }).then(function (reason) {
          if (!reason) return;
          return store.deleteLot(l.id, reason).then(function () {
            ui.toast({ kind: 'success', message: 'Lot ' + l.lot_number + ' deleted.' });
            window.MRT.app.route();
          });
        }).catch(function (e) { ui.toastError('Could not delete: ' + e.message, e); });
      } });
  }

  // Settings > Lots (admins) reuses these, so both doors open the same list
  return { render: render, lotDialog: lotDialog, deleteButton: deleteButton, detailsDialog: detailsDialog,
           projectOptions: options, pnOptions: pnOptions, extraSpecs: extraSpecs, extraFrom: extraFrom };
})();
