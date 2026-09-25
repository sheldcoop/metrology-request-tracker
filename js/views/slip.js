/**
 * Metrology Request Tracker - views/slip.js
 *
 * The printable traveller slip (#/slip/<request id>, Q38): an A6 card that
 * travels with the panels - big request ID and its Code 128 barcode (a hand
 * scanner types the ID into the search box, which jumps to the request),
 * tool, lot, panels, priority, needed-by, requester, where the panels go.
 * Print from the browser (A6, or A4 - the card sits top left).
 */
window.MRT = window.MRT || {};
window.MRT.views = window.MRT.views || {};
window.MRT.views.slip = (function () {
  'use strict';

  var ui = window.MRT.ui;
  var store = window.MRT.store;
  var D = window.MRT.domain;

  function byId(coll, id) { return id ? store.byId(coll, id) : null; }

  function render(main, ctx) {
    var me = store.currentUser();
    var r = byId('requests', ctx.subpath);
    if (!r || !D.canSeeRequest(me, r) || r.status === 'draft') {
      main.appendChild(ui.emptyState({ icon: 'requests', title: 'No slip', text: 'Only submitted requests have a traveller slip.' }));
      return;
    }
    var tool = byId('tools', r.tool_id), lot = byId('lots', r.lot_id), prio = byId('priorities', r.priority_id);
    var type = byId('measurement_types', r.type_id), who = byId('users', r.requester_id), bkm = byId('bkms', r.bkm_id);
    main.appendChild(ui.pageHead('Traveller slip', 'Print it and put it with the panels. A6 paper, or A4 (the card sits top left).', [
      ui.button('Back to the request', { kind: 'ghost', icon: 'chevron_left', onClick: function () { location.hash = '#/request/' + r.id; } }),
      ui.button('Print', { kind: 'primary', icon: 'download', onClick: function () { window.print(); } })
    ]));
    function f(label, value, cls) { return { label: label, value: value || '-', cls: cls || null }; }
    main.appendChild(ui.traveller({
      id: r.request_no, level: prio ? prio.level : 3, prio: prio ? { name: prio.name, code: prio.code } : null,
      glyph: tool ? { key: tool.glyph } : null,
      code: ui.code128(r.request_no, { height: 44, module: 2, label: r.request_no }),
      fields: [
        f('Tool', tool ? tool.code + (type ? ' - ' + type.name : '') : null),
        f('Lot', lot ? lot.lot_number + '  ' + [(byId('projects', r.project_id) || {}).code, r.part_number_id ? (byId('part_numbers', r.part_number_id) || {}).code : null,
          (byId('buildups', r.buildup_id) || {}).code].filter(Boolean).join(' · ') : null),
        f('Panels', D.panelsText(r) + ((r.panels || []).length ? '  (' + r.panels.length + ')' : ''), 'wide'),
        f('Layers', (r.layers || []).join(', ') || null),
        f('Panels are', window.MRT.requestActions.whereOf(r) || null, 'wide'),
        f('Needed by', r.needed_by || 'no date'),
        f('Requested by', who ? who.name : null),
        f('Submitted', ui.formatDate(r.submitted_ts)),
        f('Afterwards', D.AFTER_LABEL[r.after] + (r.after_other ? ': ' + r.after_other : '')),
        f('BKM', bkm ? bkm.name : r.bkm_path ? 'own BKM (path on the request)' : 'none - see the purpose', 'wide')
      ],
      warn: tool && tool.destructive ? tool.code + ' DESTROYS THESE PANELS - confirmed by the requester' : null
    }, { size: 'slip' }));
  }

  return { render: render };
})();
