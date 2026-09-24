/**
 * Metrology Request Tracker - views/lab.js
 *
 * Lab status (#/lab, the start page in M1): every active tool as its
 * nameplate - the tool glyph (beam on when Up, dashed amber in
 * Maintenance, off when Down), code, status with its "until" date and
 * note, primary and backup operator, and what is set up for it
 * (measurement types, BKMs). The tool's operators and admins set the
 * status here (Q27). From M3 each plate also shows its queue length, the
 * oldest open request and the typical wait (Q46).
 *
 * #/lab/<tool id> scrolls to that tool and marks it (from the search).
 */
window.MRT = window.MRT || {};
window.MRT.views = window.MRT.views || {};
window.MRT.views.lab = (function () {
  'use strict';

  var ui = window.MRT.ui;
  var store = window.MRT.store;
  var D = window.MRT.domain;

  var STATUS = {
    up:          { chip: 'ok',      glyph: 'idle',  label: 'Up' },
    maintenance: { chip: 'warning', glyph: 'maint', label: 'Maintenance' },
    down:        { chip: 'expired', glyph: 'off',   label: 'Down' }
  };

  function userName(id) { var u = id ? store.byId('users', id) : null; return u ? u.name : null; }

  function statusChip(status) {
    var s = STATUS[status] || STATUS.up;
    return ui.el('span', { class: 'chip ' + s.chip, text: s.label });
  }

  function render(main, ctx) {
    var me = store.currentUser();
    var tools = store.list('tools');
    var count = { up: 0, maintenance: 0, down: 0 };
    tools.forEach(function (t) { count[t.status] = (count[t.status] || 0) + 1; });

    main.appendChild(ui.pageHead('Lab status', 'Every tool, its state and who runs it. Queue lengths follow in M3.'));

    if (!tools.length) {
      main.appendChild(ui.emptyState({ icon: 'wrench', title: 'No tools yet', text: 'An admin adds tools in Settings.' }));
      return;
    }

    main.appendChild(ui.stagger(ui.el('div', { class: 'lab-kpis' }, [
      ui.kpiTile({ label: 'Up', value: count.up, status: 'ok', icon: 'check' }).node,
      ui.kpiTile({ label: 'Maintenance', value: count.maintenance, status: count.maintenance ? 'warning' : 'neutral', icon: 'wrench' }).node,
      ui.kpiTile({ label: 'Down', value: count.down, status: count.down ? 'expired' : 'neutral', icon: 'alert' }).node
    ])));

    var grid = ui.el('div', { class: 'lab-grid' }, tools.map(function (t) { return plate(t, me); }));
    main.appendChild(ui.stagger(grid));

    if (ctx.subpath) {
      var target = document.getElementById('tool-' + ctx.subpath);
      if (target) {
        target.classList.add('is-selected');
        requestAnimationFrame(function () { target.scrollIntoView({ block: 'center', behavior: ui.reducedMotion() ? 'auto' : 'smooth' }); });
      }
    }
  }

  /** One tool as a nameplate. */
  function plate(t, me) {
    var s = STATUS[t.status] || STATUS.up;
    var types = store.list('measurement_types').filter(function (m) { return m.tool_id === t.id; });
    var bkms = store.list('bkms').filter(function (b) { return b.tool_id === t.id; });
    var samples = types.filter(function (m) { return m.sample; }).length + bkms.filter(function (b) { return b.sample; }).length;
    var canSet = D.canSetToolStatus(me, t);

    function row(label, value, cls) {
      return [ui.el('dt', { text: label }), ui.el('dd', { class: cls || null, text: value })];
    }

    return ui.el('article', { class: 'tool-plate is-' + t.status, id: 'tool-' + t.id, 'aria-label': t.code + ', ' + s.label }, [
      ui.el('header', { class: 'tool-plate-head' }, [
        ui.toolGlyph(t.glyph, { size: 56, state: s.glyph, label: t.name }),
        ui.el('div', { class: 'tool-plate-id' }, [
          ui.el('h2', { class: 'tool-code mono', text: t.code }),
          ui.el('div', { class: 'tool-name', text: t.name })
        ]),
        statusChip(t.status)
      ]),
      t.status !== 'up' && (t.status_until || t.status_note) ? ui.el('p', { class: 'tool-plate-note' }, [
        t.status_until ? ui.el('b', { text: 'Until ' + ui.formatDate(t.status_until + 'T12:00:00Z') }) : null,
        t.status_until && t.status_note ? ' · ' : null,
        t.status_note || null
      ]) : null,
      ui.el('dl', { class: 'tool-plate-facts' }, [
        row('Primary operator', userName(t.primary_operator_id) || 'not set', t.primary_operator_id ? null : 'is-missing'),
        row('Backup operator', userName(t.backup_operator_id) || 'not set', t.backup_operator_id ? null : 'is-missing'),
        row('Measurement types', String(types.length), 'num'),
        row('BKMs', String(bkms.length), 'num'),
        row('Queue', 'from M3', 'is-missing')
      ]),
      samples ? ui.el('div', { class: 'tool-plate-sample', title: 'Made-up entries until the engineers confirm them (Settings)' },
                      [ui.icon('info', 14), ui.el('span', { text: samples + ' sample entries' })]) : null,
      canSet ? ui.el('div', { class: 'tool-plate-actions' }, [
        ui.button('Set status', { size: 'sm', icon: 'wrench', onClick: function () { statusDialog(t); } })
      ]) : null
    ]);
  }

  /** Up / Maintenance / Down, with an optional until date and note (Q27). */
  function statusDialog(t) {
    var choice = t.status;
    var seg = ui.segmented({ label: 'Status', value: t.status, onChange: function (v) { choice = v; paint(); }, options: [
      { value: 'up', label: 'Up' }, { value: 'maintenance', label: 'Maintenance' }, { value: 'down', label: 'Down' }] });
    var until = ui.field({ label: 'Until (optional)', type: 'date', value: t.status_until || '', hint: 'When you expect it back.' });
    var noteF = ui.field({ label: 'Note (optional)', value: t.status_note || '', placeholder: 'e.g. source change, waiting for service' });
    var reason = ui.field({ label: 'Reason for the audit log (optional)' });
    function paint() { until.node.hidden = choice === 'up'; noteF.node.hidden = choice === 'up'; }
    paint();

    ui.dialog({
      title: t.code + ' status', icon: 'wrench',
      body: ui.el('div', {}, [ui.el('div', { class: 'dlg-row' }, [ui.el('span', { class: 'ifield-label', text: 'Status', 'aria-hidden': 'true' }), seg.node]),
                             until.node, noteF.node, reason.node]),
      actions: [
        { label: 'Cancel', value: null },
        { label: 'Save', kind: 'primary', value: function () {
            return { status: choice, until: choice === 'up' ? null : until.value() || null,
                     note: choice === 'up' ? '' : noteF.value(), reason: reason.value() };
          } }
      ]
    }).then(function (v) {
      if (!v) return;
      return store.setToolStatus({ tool_id: t.id, status: v.status, until: v.until, note: v.note, reason: v.reason }).then(function () {
        ui.toast({ kind: 'success', message: t.code + ' is now ' + STATUS[v.status].label + '.' });
        window.MRT.app.route();
      });
    }).catch(function (e) {
      if (e && e.code === 'no_change') return ui.toast({ message: 'Nothing was changed.' });
      ui.toastError('Could not set the status: ' + e.message, e);
    });
  }

  return { render: render };
})();
