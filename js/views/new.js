/**
 * Metrology Request Tracker - views/new.js
 *
 * New request (#/new), the guided form (DECISIONS F-1..F-5). One request =
 * one tool (Q4). Tool first, then five steps that open one after the other;
 * a finished step folds into one line that says what was given:
 *
 *   1 Tool           the tool (its glyph), measurement type, BKM (Q13, Q51, M2-10)
 *   2 Lot & panels   Project · Lot · Build-up on one line, three separate
 *                    choices (F-6): a lot runs through every build-up. Pick a
 *                    lot or type a new one (registered on Submit, F-5); the
 *                    build-up is optional; part number (optional, of the
 *                    project); the panels by Hirata ID or just how many (F-1);
 *                    layers from the build-up (F-2); process step (M2-8)
 *   3 Where          the magazine and its slots on a front view, or a note
 *                    (F-3); where they go afterwards (M2-12, FIB always scrap
 *                    + a required tick, M2-11)
 *   4 Urgency        priority with a reason when it needs one (Q26), an
 *                    optional needed-by date (M2-4)
 *   5 Details        purpose (M2-13) and the tool's own fields (Q5)
 *   Review           what is still missing, step by step; then Submit
 *
 * Save as a private draft any time (Q33) or submit: warnings first (Q44),
 * then the request ID (Q29) and the request page.
 *
 *   #/new               a new request (?lot=<lot id> picks the lot, ?tool=<tool id> the tool)
 *   #/new/<draft id>    carry on with a draft
 *   #/new/<request id>  edit a submitted, open request - not its tool - with a reason (Q14, M3-5)
 *   #/new?from=<id>     copy a request (Q28)
 *
 * The traveller card on the right builds up live: what the quality engineer
 * will see. User text only ever goes through textContent.
 */
window.MRT = window.MRT || {};
window.MRT.views = window.MRT.views || {};
window.MRT.views['new'] = (function () {
  'use strict';

  var ui = window.MRT.ui;
  var store = window.MRT.store;
  var D = window.MRT.domain;
  var X = window.MRT.extraFields;

  var STEPS = [
    { key: 'tool', title: 'Tool' },
    { key: 'lot', title: 'Lot and panels' },
    { key: 'where', title: 'Where the panels are' },
    { key: 'urgency', title: 'Priority and date' },
    { key: 'details', title: 'Purpose and tool fields' },
    { key: 'review', title: 'Review and send' }
  ];

  function byId(coll, id) { return id ? store.byId(coll, id) : null; }

  /** The fields a copy takes over (Q28): not the date, reason or where the panels are now. */
  function copyOf(r) {
    return { tool_id: r.tool_id, type_id: r.type_id, project_id: r.project_id || null, part_number_id: r.part_number_id || null, buildup_id: r.buildup_id || null,
             lot_id: r.lot_id, panels: (r.panels || []).slice(), panel_count: r.panel_count || null,
             layers: (r.layers || []).slice(), priority_id: r.priority_id, bkm_id: r.bkm_id, bkm_path: r.bkm_path, purpose: r.purpose,
             process_step_id: r.process_step_id, process_step_other: r.process_step_other, after: r.after, after_other: r.after_other,
             extra: JSON.parse(JSON.stringify(r.extra || {})), duplicated_from: r.id };
  }

  function defaultPriority() {
    var p = store.list('priorities').filter(function (x) { return x.is_default; })[0] || store.list('priorities')[0];
    return p ? p.id : null;
  }

  /** Which step a problem from D.requestProblems belongs to (to show it there). */
  function stepOfProblem(t) {
    if (/where the panels|[Ss]lot|[Mm]agazine|destroys|afterwards/.test(t)) return 'where';
    if (/tool|[Mm]easurement type|BKM|offered/.test(t) && !/purpose/.test(t)) return 'tool';
    if (/[Ll]ot|[Pp]anel|[Ll]ayer|[Bb]uild-up|[Pp]roject|[Pp]art number|[Pp]rocess step|Hirata/.test(t)) return 'lot';
    if (/[Pp]riority|needs a reason|[Nn]eeded by/.test(t)) return 'urgency';
    return 'details';
  }

  function render(main, ctx) {
    var me = store.currentUser();
    var q = ctx.params || {};
    if (!D.canRequest(me)) {
      main.appendChild(ui.pageHead('New request', 'Engineers request measurements.'));
      main.appendChild(ui.emptyState({ icon: 'request_new', title: 'Only engineers request measurements',
        text: 'Ask an admin to tick the Engineer role for you (Settings > People).' }));
      return;
    }
    if (q.done) { location.hash = '#/request/' + q.done; return; }     // older links: the request page

    var draft = ctx.subpath ? byId('requests', ctx.subpath) : null;
    var editing = !!draft && draft.status !== 'draft' && D.canEditSubmitted(me, draft);
    if (ctx.subpath && !D.canEditDraft(me, draft) && !editing) {
      main.appendChild(ui.pageHead('New request'));
      main.appendChild(ui.emptyState({ icon: 'lock', title: draft ? 'This is not your draft, or it is submitted already' : 'Draft not found',
        text: 'Start a new request instead.', actionLabel: 'New request', onAction: function () { location.hash = '#/new'; } }));
      return;
    }
    var src = draft ? JSON.parse(JSON.stringify(draft)) : null;
    var from = q.from ? byId('requests', q.from) : null;
    if (!src && from && D.canSeeRequest(me, from)) src = copyOf(from);
    // start from a personal template (Q28): what is no longer available is left empty, with a note (T-3)
    var tpl = !src && q.template ? byId('templates', q.template) : null, tplNotes = [];
    if (tpl && tpl.owner_id === me.id) {
      var ck = D.templateCheck(tpl, store.data());
      if (ck.usable) { src = ck.fields; tplNotes = ck.notes; if (!src.priority_id) delete src.priority_id; }   // the default priority then
      else tplNotes = [ck.reason + ' - this template cannot be started.'];
    } else tpl = null;
    var st = Object.assign({ tool_id: null, type_id: null, project_id: null, part_number_id: null, buildup_id: null, lot_id: null, new_lot: null, panels: [], panel_count: null, layers: [],
      priority_id: defaultPriority(), priority_reason: '', needed_by: null, bkm_id: null, bkm_path: '', purpose: '',
      process_step_id: null, process_step_other: '', panel_location: '', magazine_id: null, slots: [], destructive_ok: false,
      after: 'back_to_me', after_other: '', extra: {}, duplicated_from: null }, src || {});
    if (!src && q.lot && byId('lots', q.lot)) st.lot_id = q.lot;
    if (!src && q.tool && byId('tools', q.tool)) st.tool_id = q.tool;
    if (!st.panels) st.panels = [];
    if (!st.layers) st.layers = [];
    if (!st.slots) st.slots = [];

    // the lot number in the lot line: a registered lot's, or the one typed as new
    var lotNow = byId('lots', st.lot_id);
    var lotNumber = lotNow ? lotNow.lot_number : st.new_lot ? st.new_lot.lot_number : '';
    var panelMode = st.panels.length || !st.panel_count ? 'ids' : 'count';

    var title = editing ? 'Edit ' + draft.request_no : draft ? 'Draft' : from ? 'Copy of ' + (from.request_no || 'a draft') : tpl ? 'New request from "' + tpl.name + '"' : 'New request';
    main.appendChild(ui.pageHead(title, editing ? 'Change what is needed and save with a reason; the quality engineer sees each change in the timeline. The tool stays.'
      : 'Tool first, then step by step. Save a draft any time; Submit sends it to the tool\'s quality engineers.'));

    if (tplNotes.length) main.appendChild(ui.el('div', { class: 'setup-note', role: 'status' }, [ui.icon('info', 14),
      ui.el('span', { text: tplNotes.join(' · ') })]));
    // a new, empty form: offer the person's templates first (Q28)
    if (!src && !draft && !q.lot && !q.tool) { var chooserNode = window.MRT.templates.chooser(me); if (chooserNode) main.appendChild(chooserNode); }
    var errorBox = ui.el('div', { class: 'req-errors', role: 'alert', hidden: true });
    var progress = ui.el('ol', { class: 'wz-progress', 'aria-label': 'Steps' });
    var formCol = ui.el('div', { class: 'wz-steps' });
    var side = ui.el('aside', { class: 'req-side' });
    main.appendChild(ui.el('div', { class: 'req-layout req-wizard' }, [ui.el('div', { class: 'wz-main' }, [progress, errorBox, formCol]), side]));

    /* --- the steps: a head that folds to one line, and a body ----------- */
    var open = null, shown = {};                        // shown: steps the person has opened (done ones get a tick)
    var steps = {};
    STEPS.forEach(function (s, i) {
      var summary = ui.el('span', { class: 'wz-sum' });
      var badge = ui.el('span', { class: 'wz-no num', text: s.key === 'review' ? '' : String(i + 1) }, s.key === 'review' ? ui.icon('check', 14) : null);
      var head = ui.el('button', { type: 'button', class: 'wz-head', 'aria-expanded': 'false' }, [badge,
        ui.el('span', { class: 'wz-title' }, [ui.el('b', { text: s.title }), summary])]);
      var body = ui.el('div', { class: 'wz-body', hidden: true });
      var node = ui.el('section', { class: 'wz-step', dataset: { step: s.key } }, [head, body]);
      head.addEventListener('click', function () { go(open === s.key ? null : s.key); });
      var dot = ui.el('button', { type: 'button', class: 'wz-dot', title: s.title }, [ui.el('span', { class: 'wz-dot-no num', text: s.key === 'review' ? '' : String(i + 1) }),
        ui.el('span', { class: 'wz-dot-label', text: s.title })]);
      dot.addEventListener('click', function () { go(s.key); });
      progress.appendChild(ui.el('li', {}, dot));
      steps[s.key] = { node: node, head: head, body: body, summary: summary, dot: dot, index: i };
      formCol.appendChild(node);
    });

    function go(key) {
      if (open) shown[open] = true;
      open = key;
      STEPS.forEach(function (s) {
        var x = steps[s.key], on = s.key === key;
        x.body.hidden = !on;
        x.node.classList.toggle('is-open', on);
        x.head.setAttribute('aria-expanded', on ? 'true' : 'false');
        x.dot.classList.toggle('is-now', on);
      });
      if (key === 'review') paintReview();
      refreshHeads();
      var n = key && steps[key].node;
      if (n && n.scrollIntoView) n.scrollIntoView({ block: 'nearest' });
    }
    function next(key) {
      var i = STEPS.map(function (s) { return s.key; }).indexOf(key);
      return ui.el('div', { class: 'wz-next' }, ui.button(i === STEPS.length - 2 ? 'Review' : 'Next: ' + STEPS[i + 1].title, { kind: 'primary', icon: 'chevron_right',
        onClick: function () { go(STEPS[i + 1].key); } }));
    }

    /** Problems for a submit, by step. */
    function problemsByStep() {
      var list = D.requestProblems(probe(), store.data(), { submit: true });
      var out = { tool: [], lot: [], where: [], urgency: [], details: [], review: [] };
      list.forEach(function (t) { out[stepOfProblem(t)].push(t); });
      return out;
    }

    /** Each head: its one-line summary, and a tick or a count of what is missing. */
    function refreshHeads() {
      var pb = problemsByStep();
      var sums = summaries();
      STEPS.forEach(function (s) {
        var x = steps[s.key], miss = pb[s.key] || [];
        var all = s.key === 'review' ? [].concat(pb.tool, pb.lot, pb.where, pb.urgency, pb.details) : miss;
        x.summary.textContent = s.key === 'review' ? (all.length ? all.length + ' thing' + (all.length === 1 ? '' : 's') + ' still missing' : 'Ready to submit') : sums[s.key] || '';
        var ok = !all.length, seen = shown[s.key] || s.key === 'review';
        x.node.classList.toggle('is-done', ok && seen);
        x.node.classList.toggle('is-missing', !ok && !!shown[s.key]);
        x.dot.classList.toggle('is-done', ok && seen);
        x.dot.classList.toggle('is-missing', !ok && !!shown[s.key]);
      });
    }

    function summaries() {
      var tool = byId('tools', st.tool_id), type = byId('measurement_types', st.type_id), bkm = byId('bkms', st.bkm_id);
      var prio = byId('priorities', st.priority_id), bu = byId('buildups', st.buildup_id), proj = byId('projects', st.project_id);
      var mags = magsById();
      var n = D.panelCountOf(st);
      return {
        tool: tool ? [tool.code, type ? type.name : null, bkm ? 'BKM ' + bkm.name : st.bkm_path ? 'own BKM' : null].filter(Boolean).join('  ·  ') : 'Pick the tool',
        lot: lotNumber || proj ? [proj ? proj.code : null, lotNumber ? 'lot ' + lotNumber + (st.new_lot ? ' (new)' : '') : null, bu ? bu.code : null,
          n ? (st.panels.length ? st.panels.join(', ') : n + ' panel' + (n === 1 ? '' : 's')) : null, st.layers.length ? st.layers.join(' ') : null].filter(Boolean).join('  ·  ') : '',
        where: [D.placeText(st, mags) || null, D.AFTER_LABEL[st.after] ? 'then ' + D.AFTER_LABEL[st.after].toLowerCase() : null].filter(Boolean).join('  ·  '),
        urgency: prio ? prio.name + (st.needed_by ? '  ·  by ' + st.needed_by : '') : '',
        details: [st.purpose ? (st.purpose.length > 60 ? st.purpose.slice(0, 60) + '...' : st.purpose) : null,
          Object.keys(st.extra || {}).length ? Object.keys(st.extra).length + ' tool field' + (Object.keys(st.extra).length === 1 ? '' : 's') : null].filter(Boolean).join('  ·  ')
      };
    }

    function magsById() {
      var m = {};
      store.list('magazines', { all: true }).forEach(function (x) { m[x.id] = x; });
      return m;
    }

    /** Something changed: the heads and the traveller card follow. */
    function changed() { refreshHeads(); paintPreview(); if (open === 'review') paintReview(); }

    /* 1. Tool ------------------------------------------------------------ */
    var toolTypeHost = ui.el('div', { class: 'req-part' });
    function paintTool() {
      var tools = store.list('tools');
      var pick = ui.el('div', { class: 'tool-bank', role: 'radiogroup', 'aria-label': 'Tool' }, tools.map(function (t) {
        var on = t.id === st.tool_id;
        var b = ui.el('button', { type: 'button', class: 'tool-pick-opt is-' + t.status + (on ? ' is-on' : ''), role: 'radio',
          'aria-checked': on ? 'true' : 'false', title: t.name + (t.status !== 'up' ? ' - ' + D.TOOL_STATUS_LABEL[t.status] : '') }, [
          ui.led(t.status === 'up' ? 'ok' : t.status === 'down' ? 'critical' : 'warning', D.TOOL_STATUS_LABEL[t.status]),   // the tool's lamp, top right
          ui.toolGlyph(t.glyph, { size: 40, state: t.status === 'up' ? 'idle' : t.status === 'down' ? 'off' : 'maint' }),
          ui.el('b', { class: 'mono', text: t.code }),
          t.name && t.name !== t.code ? ui.el('span', { class: 'tool-pick-name', text: t.name, title: t.name }) : null,   // no "AOI / AOI"
          t.status !== 'up' ? ui.statusBadge(t.status === 'down' ? 'expired' : 'warning', D.TOOL_STATUS_LABEL[t.status]) : null
        ]);
        if (editing && !on) b.disabled = true;
        b.addEventListener('click', function () {
          if (st.tool_id === t.id || editing) return;
          st.tool_id = t.id; st.type_id = null; st.bkm_id = null; st.extra = {}; st.destructive_ok = false;
          st.after = t.destructive ? 'scrap' : (st.after === 'scrap' ? 'back_to_me' : st.after);
          paintTool(); paintWhere(); paintDetails(); changed();
        });
        return b;
      }));
      var bench = ui.el('div', { class: 'tool-bench' }, [ui.el('span', { class: 'tool-bench-label', text: 'Lab bench' }), pick]);   // the tools standing on the bench
      ui.mount(steps.tool.body, [bench, toolTypeHost, st.tool_id ? next('tool') : null]);
      paintType();
    }

    function paintType() {
      var tool = byId('tools', st.tool_id);
      if (!tool) { ui.mount(toolTypeHost, ui.el('p', { class: 'muted', text: 'Pick the tool first - the rest of the form follows it.' })); return; }
      var types = store.list('measurement_types').filter(function (m) { return m.tool_id === tool.id || m.id === st.type_id; });
      if (types.length === 1 && !st.type_id) st.type_id = types[0].id;
      var typeF = ui.field({ label: 'Measurement type', cls: 'half', value: st.type_id || '',
        options: [{ value: '', label: '- pick -' }].concat(types.map(function (m) { return { value: m.id, label: m.name }; })) });
      typeF.input.addEventListener('change', function () {
        st.type_id = typeF.value() || null;
        var b = byId('bkms', st.bkm_id);
        if (b && st.type_id && b.type_id && b.type_id !== st.type_id) st.bkm_id = null;
        paintType(); paintDetails(); changed();
      });
      var bkms = store.list('bkms').filter(function (b) { return b.tool_id === tool.id && (!st.type_id || !b.type_id || b.type_id === st.type_id); });
      var bkmF = ui.field({ label: 'BKM from the library', cls: 'half', value: st.bkm_id || '',
        options: [{ value: '', label: bkms.length ? '- none / my own path -' : '- no BKMs for this type -' }].concat(bkms.map(function (b) {
          return { value: b.id, label: b.name + (b.doc_version ? ' (' + b.doc_version + ')' : '') }; })) });
      bkmF.input.addEventListener('change', function () { st.bkm_id = bkmF.value() || null; changed(); });
      var pathF = ui.field({ label: 'Or the path of your own BKM (PowerPoint)', mono: true, value: st.bkm_path || '',
        placeholder: '\\\\server\\share\\...\\my BKM.pptx', hint: 'The BKM says where and what to measure (M2-10). Without one, say it in the purpose (step 5).' });
      pathF.input.addEventListener('input', function () { st.bkm_path = pathF.value().trim(); changed(); });
      ui.mount(toolTypeHost, [ui.el('div', { class: 'form-grid' }, [typeF.node, bkmF.node]), pathF.node]);
    }

    /* 2. Lot and panels -------------------------------------------------- */
    // Project, lot and build-up are three separate choices (F-6): one lot runs through every
    // build-up, so the request - not the lot - says which project, part number and build-up.
    var layersHost = ui.el('div', { class: 'req-part' });
    var lotNote = ui.el('p', { class: 'muted lot-info', 'aria-live': 'polite' });
    var lotF, pnHost = ui.el('div');
    function paintLot() {
      var projects = store.list('projects', { all: true }).filter(function (p) { return p.active !== false || p.id === st.project_id; });
      var bus = store.list('buildups', { all: true }).filter(function (b) { return b.active !== false || b.id === st.buildup_id; });
      var lots = (store.data().lots || []).slice().sort(function (a, b) { return a.created_ts < b.created_ts ? 1 : -1; }).slice(0, 300);
      if (!st.project_id && projects.length === 1 && !editing) st.project_id = projects[0].id;
      var projF = ui.field({ label: 'Project', value: st.project_id || '',
        options: [{ value: '', label: '- pick -' }].concat(projects.map(function (p) { return { value: p.id, label: p.code + (p.name ? '  ·  ' + p.name : '') }; })) });
      lotF = ui.field({ label: 'Lot', mono: true, value: lotNumber || '', placeholder: 'e.g. 18178 or 18178.01', inputmode: 'decimal',
        list: lots.map(function (l) { return { value: l.lot_number, label: l.note || null }; }) });
      var buF = ui.field({ label: 'Build-up (optional)', value: st.buildup_id || '',
        options: [{ value: '', label: '- none -' }].concat(bus.map(function (b) { return { value: b.id, label: b.code + (b.name ? '  ·  ' + b.name : '') }; })) });
      projF.input.addEventListener('change', function () {
        st.project_id = projF.value() || null;
        var pn = byId('part_numbers', st.part_number_id);
        if (pn && (pn.project_ids || []).indexOf(st.project_id) === -1) st.part_number_id = null;
        paintPartNumber(); changed();
      });
      buF.input.addEventListener('change', function () { st.buildup_id = buF.value() || null; paintLayers(); changed(); });
      lotF.input.addEventListener('input', function () { lotTyped(lotF.value().trim()); });
      lotF.input.addEventListener('change', function () { lotTyped(lotF.value().trim()); });

      var stepsL = store.list('process_steps');
      var stepVal = st.process_step_other ? '__other' : (st.process_step_id || '');
      var stepF = ui.field({ label: 'The panels are after (process step, optional)', cls: 'half', value: stepVal,
        options: [{ value: '', label: stepsL.length ? '- pick -' : '- no list yet, use Other -' }].concat(stepsL.map(function (s) { return { value: s.id, label: s.name }; }))
          .concat([{ value: '__other', label: 'Other (type it)' }]) });
      var stepOtherF = ui.field({ label: 'Process step', cls: 'half', value: st.process_step_other || '', placeholder: 'e.g. after desmear' });
      stepOtherF.node.hidden = stepVal !== '__other';
      function readStep() {
        var sv = stepF.value();
        stepOtherF.node.hidden = sv !== '__other';
        st.process_step_id = sv && sv !== '__other' ? sv : null;
        st.process_step_other = sv === '__other' ? stepOtherF.value().trim() : '';
        changed();
      }
      stepF.input.addEventListener('change', readStep);
      stepOtherF.input.addEventListener('input', readStep);

      ui.mount(steps.lot.body, [
        ui.el('div', { class: 'lot-line' }, [projF.node, ui.el('span', { class: 'lot-line-dot', 'aria-hidden': 'true', text: '·' }), lotF.node,
          ui.el('span', { class: 'lot-line-dot', 'aria-hidden': 'true', text: '·' }), buF.node]),
        lotNote, pnHost,
        panelsPart(),
        layersHost,
        ui.el('div', { class: 'form-grid' }, [stepF.node, stepOtherF.node]),
        next('lot')
      ]);
      paintLotNote(); paintPartNumber(); paintLayers();
    }

    /** The lot number typed: a registered lot, a new one (registered on Submit), or not a lot number yet. */
    function lotTyped(num) {
      var hit = (store.data().lots || []).filter(function (l) { return l.lot_number === num; })[0];
      lotNumber = num;
      st.lot_id = hit ? hit.id : null;
      st.new_lot = !hit && num && D.isLotNumber(num) ? { lot_number: num } : null;
      paintLotNote(); changed();
    }

    function paintLotNote() {
      var lot = byId('lots', st.lot_id);
      if (lot) {
        var owner = byId('users', lot.owner_id);
        ui.mount(lotNote, [ui.statusBadge('ok', 'Lot found'), '  ',
          lot.panel_count ? lot.panel_count + ' panels  ·  ' : null,
          (lot.scrapped || []).length ? ['Scrapped: ', ui.el('span', { class: 'mono', text: lot.scrapped.join(', ') }), '  ·  '] : null,
          owner ? 'Registered by ' + owner.name : null]);
        lotF.setState('valid');
      } else if (lotNumber && !D.isLotNumber(lotNumber)) {
        ui.mount(lotNote, null);
        lotF.setState('invalid', 'Lot numbers are digits; a split lot adds .01, e.g. 18178.01');
      } else if (lotNumber) {
        ui.mount(lotNote, [ui.statusBadge('warning', 'New lot'), '  ',
          'Lot ' + lotNumber + ' is not registered yet - it is registered when you submit.']);
        lotF.setState(null);
      } else {
        ui.mount(lotNote, 'Type the lot number, or pick it from the list.');
        lotF.setState(null);
      }
    }

    function paintPartNumber() {
      var pns = store.list('part_numbers').filter(function (p) { return st.project_id && (p.project_ids || []).indexOf(st.project_id) !== -1 || p.id === st.part_number_id; });
      if (!pns.length) { ui.mount(pnHost, null); return; }
      var pnF = ui.field({ label: 'Part number (optional)', cls: 'half', value: st.part_number_id || '',
        options: [{ value: '', label: '- none -' }].concat(pns.map(function (p) { return { value: p.id, label: p.code + (p.description ? '  ·  ' + p.description : '') }; })) });
      pnF.input.addEventListener('change', function () { st.part_number_id = pnF.value() || null; changed(); });
      ui.mount(pnHost, ui.el('div', { class: 'form-grid' }, pnF.node));
    }

    /** One typed Hirata ID: the chip, and to its right the copper panel it is drilled into (H-3). */
    var shownPanels = [];   // P4: a panel typed just now lights up once
    function panelChip(id, dead, fresh) {
      return ui.el('span', { class: 'panel-hirata-item' + (fresh ? ' is-new' : '') }, [
        ui.el('span', { class: 'panel-chip mono' + (dead ? ' is-scrapped' : ''), title: dead ? 'Scrapped' : null, text: id }),
        window.MRT.views.hirata.copper(id, 'sm')
      ]);
    }

    /** The panels: their Hirata IDs (chips as you type), or just how many (F-1). */
    function panelsPart() {
      var host = ui.el('div', { class: 'req-part' });
      var modeSeg = ui.segmented({ label: 'Panels', value: panelMode, options: [{ value: 'ids', label: 'Hirata IDs' }, { value: 'count', label: 'Just how many' }],
        onChange: function (v) { panelMode = v; paintInner(); readPanels(); } });
      var inner = ui.el('div', { class: 'req-part' });
      var idsF, countF, chips;
      function paintInner() {
        if (panelMode === 'ids') {
          idsF = ui.field({ label: 'Hirata IDs of the panels', mono: true, value: st.panels.join(', '), placeholder: 'e.g. 3252, 3253  or  3252-3255',
            hint: 'Commas or spaces between them; a dash for a run.' });
          chips = ui.el('div', { class: 'panel-chips', 'aria-live': 'polite' });
          idsF.input.addEventListener('input', readPanels);
          ui.mount(inner, [idsF.node, chips]);
          countF = null;
        } else {
          countF = ui.field({ label: 'How many panels', type: 'number', cls: 'half', min: 1, max: 99, step: 1, value: st.panel_count || 2,
            hint: 'Usually 2. The quality engineer notes the IDs.' });
          countF.input.addEventListener('input', readPanels);
          ui.mount(inner, countF.node);
          idsF = null; chips = null;
        }
      }
      function readPanels() {
        if (panelMode === 'ids') {
          var p = D.parsePanelIds(idsF.value());
          st.panels = p.ids; st.panel_count = p.ids.length || null;
          var lot = byId('lots', st.lot_id), gone = lot ? lot.scrapped || [] : [];
          ui.mount(chips, p.ids.map(function (id) {
            var dead = gone.indexOf(id) !== -1;
            return panelChip(id, dead, shownPanels.indexOf(id) === -1);
          }).concat(p.ids.length ? [ui.el('span', { class: 'muted', text: p.ids.length + ' panel' + (p.ids.length === 1 ? '' : 's') })] : []));
          shownPanels = p.ids.slice();
          idsF.setState(p.errors.length ? 'invalid' : null, p.errors[0] || null);
        } else {
          var n = Number(countF.value());
          st.panels = []; st.panel_count = n >= 1 && n <= 99 && Math.floor(n) === n ? n : null;
          countF.setState(st.panel_count ? null : 'invalid', st.panel_count ? null : 'A whole number, 1-99');
        }
        if (slotPicker) slotPicker.setLabels(window.MRT.requestActions.slotLabels(st.panels, st.slots));
        changed();
      }
      paintInner();
      if (panelMode === 'ids' && st.panels.length) readPanelsQuiet();
      function readPanelsQuiet() {
        var lot = byId('lots', st.lot_id), gone = lot ? lot.scrapped || [] : [];
        shownPanels = st.panels.slice();
        ui.mount(chips, st.panels.map(function (id) { return panelChip(id, gone.indexOf(id) !== -1); }));
      }
      ui.mount(host, [ui.el('div', { class: 'dlg-row' }, [ui.el('span', { class: 'ifield-label', text: 'Panels', 'aria-hidden': 'true' }), modeSeg.node]), inner]);
      return host;
    }

    /** The layers of the build-up as chips to tick (F-2, optional). */
    function paintLayers() {
      var bu = byId('buildups', st.buildup_id);
      var all = D.layersFor(bu);
      st.layers = st.layers.filter(function (x) { return all.indexOf(x) !== -1; });
      var chips = all.map(function (ly) {
        var on = st.layers.indexOf(ly) !== -1;
        var b = ui.el('button', { type: 'button', class: 'layer-chip mono' + (on ? ' is-on' : '') + (/CO$/.test(ly) ? ' is-core' : ''),
          'aria-pressed': on ? 'true' : 'false', text: ly });
        b.addEventListener('click', function () {
          var i = st.layers.indexOf(ly);
          if (i === -1) st.layers.push(ly); else st.layers.splice(i, 1);
          st.layers.sort(function (a, c) { return all.indexOf(a) - all.indexOf(c); });
          paintLayers(); changed();
        });
        return b;
      });
      ui.mount(layersHost, [
        ui.el('div', { class: 'ifield-label', text: 'Layers (optional)' + (bu ? ' - ' + bu.code : '') }),
        ui.el('div', { class: 'layer-chips', role: 'group', 'aria-label': 'Layers' }, chips),
        ui.el('p', { class: 'muted', text: bu ? '1FCO / 1BCO is the core, front and back; each build-up layer adds F and B.' : 'Pick the build-up to see its layers; until then up to 5F / 5B.' })
      ]);
    }

    /* 3. Where the panels are, and afterwards ---------------------------- */
    var slotPicker = null;
    function paintWhere() {
      var tool = byId('tools', st.tool_id);
      var mags = store.list('magazines', { all: true }).filter(function (m) { return m.active !== false || m.id === st.magazine_id; });
      var magF = ui.field({ label: 'Magazine', cls: 'half', value: st.magazine_id || '',
        options: [{ value: '', label: '- not in a magazine -' }].concat(mags.map(function (m) { return { value: m.id, label: m.code + '  (' + (m.slots || 24) + ' slots)' }; })) });
      var slotsHost = ui.el('div', { class: 'wz-mag' });
      var fit = ui.el('p', { class: 'muted', 'aria-live': 'polite' });
      function fitText() {
        var n = D.panelCountOf(st), k = st.slots.length;
        fit.textContent = !st.magazine_id ? '' : !k ? 'Click the slots the panels sit in - or press and drag over several.'
          : n && k !== n ? k + ' slot' + (k === 1 ? '' : 's') + ' picked for ' + n + ' panel' + (n === 1 ? '' : 's') + ' - one panel per slot.' : 'Slot order = panel order.';
      }
      function paintSlots() {
        var m = byId('magazines', st.magazine_id);
        if (!m) { slotPicker = null; ui.mount(slotsHost, null); fitText(); return; }
        slotPicker = ui.magazineSlots({ magazine: m, picked: st.slots, labels: window.MRT.requestActions.slotLabels(st.panels, st.slots),
          taken: D.takenSlots(store.data().requests, m.id, draft ? draft.id : null),
          onChange: function (slots) { st.slots = slots; slotPicker.setLabels(window.MRT.requestActions.slotLabels(st.panels, slots)); fitText(); changed(); } });
        ui.mount(slotsHost, slotPicker.node);
        fitText();
      }
      magF.input.addEventListener('change', function () { st.magazine_id = magF.value() || null; st.slots = []; paintSlots(); changed(); });
      var noteF = ui.field({ label: 'Or a note (where they are, who has them)', value: st.panel_location || '',
        placeholder: 'e.g. in MES  /  with Anna  /  top shelf', hint: 'The magazine slots, or this note - the quality engineer picks the panels up there.' });
      noteF.input.addEventListener('input', function () { st.panel_location = noteF.value().trim(); changed(); });

      var destructive = tool && tool.destructive;
      var afterF = ui.field({ label: 'After measuring, the panels go', cls: 'half', value: destructive ? 'scrap' : (st.after || 'back_to_me'),
        options: D.AFTER_OPTIONS.map(function (a) { return { value: a, label: D.AFTER_LABEL[a] }; }), disabled: !!destructive,
        hint: destructive ? tool.code + ' destroys the panels: always scrap.' : null });
      var afterOtherF = ui.field({ label: 'Where then?', cls: 'half', value: st.after_other || '', placeholder: 'e.g. to Anna for SEM' });
      afterOtherF.node.hidden = (destructive ? 'scrap' : st.after) !== 'other';
      if (destructive) st.after = 'scrap';
      afterF.input.addEventListener('change', function () { st.after = afterF.value(); afterOtherF.node.hidden = st.after !== 'other'; if (st.after !== 'other') st.after_other = ''; changed(); });
      afterOtherF.input.addEventListener('input', function () { st.after_other = afterOtherF.value().trim(); changed(); });
      var destructiveT = destructive ? ui.toggle({ label: 'I know ' + tool.code + ' destroys these panels - they may be scrapped', checked: !!st.destructive_ok,
        onChange: function (v) { st.destructive_ok = v; changed(); } }) : null;
      if (!destructive) st.destructive_ok = false;

      ui.mount(steps.where.body, [
        ui.el('div', { class: 'wz-where' }, [
          ui.el('div', { class: 'req-part' }, [ui.el('div', { class: 'form-grid' }, magF.node), fit, noteF.node]),
          slotsHost
        ]),
        ui.el('div', { class: 'form-grid' }, [afterF.node, afterOtherF.node]),
        destructiveT ? ui.el('div', { class: 'req-destructive' }, [ui.icon('alert', 16), destructiveT.node]) : null,
        next('where')
      ]);
      paintSlots();
    }

    /* 4. Priority and date ----------------------------------------------- */
    function paintUrgency() {
      var prios = store.list('priorities');
      var prioSeg = ui.segmented({ label: 'Priority', value: st.priority_id, options: prios.map(function (p) { return { value: p.id, label: p.name }; }),
        onChange: function (v) { st.priority_id = v; paintUrgency(); changed(); } });
      var prio = byId('priorities', st.priority_id);
      var reasonF = prio && prio.needs_reason ? ui.field({ label: 'Why ' + prio.name + '?', value: st.priority_reason || '',
        placeholder: 'e.g. line 2 stopped, customer audit on Friday', hint: 'Required for ' + prio.name + '; managers see it.' }) : null;
      if (reasonF) reasonF.input.addEventListener('input', function () { st.priority_reason = reasonF.value().trim(); changed(); });
      else st.priority_reason = '';
      var neededF = ui.field({ label: 'Needed by (optional)', type: 'date', cls: 'half', value: st.needed_by || '',
        hint: 'With a date there is a countdown; without one the priority says how urgent it is.' });
      neededF.input.addEventListener('change', function () { st.needed_by = neededF.value() || null; changed(); });
      ui.mount(steps.urgency.body, [ui.el('div', { class: 'dlg-row' }, [ui.el('span', { class: 'ifield-label', text: 'Priority', 'aria-hidden': 'true' }), prioSeg.node]),
        prio && prio.description ? ui.el('p', { class: 'muted', text: prio.description }) : null,
        reasonF ? reasonF.node : null, neededF.node, next('urgency')]);
    }

    /* 5. Purpose and the tool's own fields (Q5) -------------------------- */
    var extraForm = null, extraFieldsNow = [];
    function paintDetails() {
      var tool = byId('tools', st.tool_id);
      var purposeF = ui.field({ label: 'Purpose', multiline: true, value: st.purpose || '', hint: 'Optional with a BKM; without one it says what to measure.',
        placeholder: 'Why this measurement, what decision it feeds. Without a BKM: what to measure, and where.' });
      purposeF.input.addEventListener('input', function () { st.purpose = purposeF.value().trim(); changed(); });
      extraFieldsNow = tool ? D.fieldsForType(store.list('tool_fields', { all: true }), tool.id, st.type_id) : [];
      var specs = X.specs(extraFieldsNow, st.extra);
      extraForm = tool && specs.length ? ui.form(specs, X.values(extraFieldsNow, st.extra)) : null;
      if (extraForm) {
        var read = function () { st.extra = X.answers(extraFieldsNow, extraForm.values()); changed(); };
        extraForm.node.addEventListener('input', read);
        extraForm.node.addEventListener('change', read);
      } else if (tool) st.extra = {};
      ui.mount(steps.details.body, [purposeF.node,
        extraForm ? [ui.el('div', { class: 'ifield-label', text: (tool ? tool.code : '') + ' asks for' }), extraForm.node]
          : ui.el('p', { class: 'muted', text: tool ? tool.code + ' asks nothing more.' : 'Pick the tool first.' }),
        next('details')]);
    }

    /* Review ------------------------------------------------------------- */
    function paintReview() {
      var pb = problemsByStep();
      var rows = STEPS.filter(function (s) { return s.key !== 'review'; }).map(function (s) {
        var miss = pb[s.key];
        var jump = ui.button(miss.length ? 'Fix' : 'Change', { kind: 'ghost', size: 'sm', onClick: function () { go(s.key); } });
        return ui.el('li', { class: 'wz-rev' + (miss.length ? ' is-missing' : ' is-done') }, [
          ui.icon(miss.length ? 'alert' : 'check', 16),
          ui.el('div', {}, [ui.el('b', { text: s.title }),
            miss.length ? ui.el('ul', {}, miss.map(function (t) { return ui.el('li', { text: t }); })) : ui.el('div', { class: 'muted', text: summaries()[s.key] || 'Nothing needed.' })]),
          jump]);
      });
      var total = [].concat(pb.tool, pb.lot, pb.where, pb.urgency, pb.details).length;
      ui.mount(steps.review.body, [
        ui.el('p', { class: total ? 'muted' : 'wz-ready', text: total ? 'Still missing before you can submit - a draft can be saved any time:'
          : editing ? 'All there. Save the changes with a reason.' : 'All there. Submit sends it to the ' + ((byId('tools', st.tool_id) || {}).code || '') + ' quality engineers.' }),
        ui.el('ul', { class: 'wz-review' }, rows)
      ]);
    }

    /* --- what goes to the store ---------------------------------------- */
    function fields() {
      var nl = !st.lot_id && lotNumber ? { lot_number: lotNumber } : null;
      return { tool_id: st.tool_id, type_id: st.type_id, project_id: st.project_id, part_number_id: st.part_number_id, buildup_id: st.buildup_id,
        lot_id: st.lot_id, new_lot: nl, panels: st.panels.slice(), panel_count: st.panel_count,
        layers: st.layers.slice(), priority_id: st.priority_id, priority_reason: st.priority_reason, needed_by: st.needed_by,
        bkm_id: st.bkm_id, bkm_path: st.bkm_path, purpose: st.purpose, process_step_id: st.process_step_id, process_step_other: st.process_step_other,
        panel_location: st.panel_location, magazine_id: st.magazine_id, slots: st.magazine_id ? st.slots.slice() : [],
        destructive_ok: st.destructive_ok, after: st.after, after_other: st.after === 'other' ? st.after_other : '', extra: st.extra, duplicated_from: st.duplicated_from };
    }
    function probe() { return Object.assign({}, editing ? draft : {}, { id: draft ? draft.id : null }, fields()); }

    /* --- the traveller card, building up live -------------------------- */
    var preview = ui.el('div');
    function paintPreview() {
      var tool = byId('tools', st.tool_id), prio = byId('priorities', st.priority_id), type = byId('measurement_types', st.type_id);
      var bu = byId('buildups', st.buildup_id), proj = byId('projects', st.project_id), pn = byId('part_numbers', st.part_number_id);
      var where = D.placeText(st, magsById());
      function fact(label, value, cls) { return { label: label, value: value, cls: cls || null }; }
      ui.mount(preview, ui.traveller({
        id: editing ? draft.request_no : tool ? tool.code + '-YYMMDD-NN' : 'Pick a tool',
        subtitle: type ? type.name : 'measurement type',
        glyph: tool ? { key: tool.glyph } : null, icon: 'request_new',
        level: prio ? prio.level : 3, prio: prio ? { name: prio.name, code: prio.code } : null,
        fields: [
          fact('Project', [proj ? proj.code : null, pn ? pn.code : null].filter(Boolean).join('  ·  ') || '-', 'mono'),
          fact('Lot', [lotNumber || '-', st.new_lot && lotNumber ? ui.statusBadge('warning', 'new') : null], 'mono'),
          fact('Build-up', bu ? bu.code : '-', 'mono'),
          fact('Panels', D.panelsText(st), 'mono'),
          fact('Layers', st.layers.length ? st.layers.join(' ') : '-', 'mono'),
          fact('Where', where || '-'),
          fact('Needed by', st.needed_by || 'no date', 'num'),
          fact('BKM', st.bkm_id || st.bkm_path ? 'yes' : ui.statusBadge('warning', 'No BKM')),
          fact('Afterwards', D.AFTER_LABEL[st.after] || '-')
        ],
        footer: st.magazine_id && byId('magazines', st.magazine_id) && st.slots.length ? ui.magazineSlots({ magazine: byId('magazines', st.magazine_id),
          picked: st.slots, labels: window.MRT.requestActions.slotLabels(st.panels, st.slots), readOnly: true }).node : null
      }, { size: 'mini' }));
    }

    /* --- actions ------------------------------------------------------- */
    function showProblems(list) {
      errorBox.hidden = !list.length;
      ui.mount(errorBox, list.length ? [ui.el('b', { text: 'Not ready to submit yet:' }), ui.el('ul', {}, list.map(function (t) { return ui.el('li', { text: t }); }))] : null);
      if (list.length && errorBox.scrollIntoView) errorBox.scrollIntoView({ block: 'nearest' });
    }
    /** Show what is missing and open the first step that needs something. */
    function blockSubmit(problems) {
      showProblems(problems);
      STEPS.forEach(function (s) { shown[s.key] = true; });
      var keys = problems.map(stepOfProblem);
      go(STEPS.filter(function (s) { return keys.indexOf(s.key) !== -1; })[0].key);     // the earliest step that needs something
    }

    function saveDraft() {
      var f = fields();
      if (!f.tool_id) { showProblems(['Pick a tool - a draft needs at least that']); go('tool'); return; }
      showProblems([]);
      store.saveDraft({ id: draft ? draft.id : undefined, version: draft ? draft.version : undefined, fields: f }).then(function (r) {
        ui.toast({ kind: 'success', message: 'Draft saved. Only you see it.' });
        location.hash = '#/new/' + r.id;
        if (draft) window.MRT.app.route();
      }).catch(function (e) {
        if (e && e.code === 'no_change') return ui.toast({ message: 'Nothing was changed.', timeout_ms: 2000 });
        if (e && e.problems) return blockSubmit(e.problems);
        ui.toastError(e.message, e);
      });
    }

    function submit() {
      var f = fields();
      var pr = Object.assign({ id: draft ? draft.id : null }, f);
      var problems = D.requestProblems(pr, store.data(), { submit: true });
      if (problems.length) { blockSubmit(problems); return; }
      showProblems([]);
      var warnings = D.submitWarnings(pr, store.data());
      var ask = warnings.length ? ui.dialog({ title: 'Submit anyway?', icon: 'alert',
        body: [ui.el('p', { text: 'Please check before you submit:' }), ui.el('ul', {}, warnings.map(function (w) { return ui.el('li', { text: w.text }); }))],
        actions: [{ label: 'Back to the form', value: null }, { label: 'Submit anyway', kind: 'primary', value: true }] }) : Promise.resolve(true);
      ask.then(function (ok) {
        if (!ok) return;
        return store.submitRequest({ id: draft ? draft.id : undefined, version: draft ? draft.version : undefined, fields: f }).then(function (r) {
          var offer = window.MRT.requestActions.emailOffer(r, 'submit');
          ui.toast({ kind: 'success', message: 'Submitted ' + r.request_no + '.', actions: offer ? [offer] : null, timeout_ms: offer ? 8000 : undefined });
          location.hash = '#/request/' + r.id;
        });
      }).catch(function (e) { ui.toastError('Could not submit: ' + e.message, e); });
    }

    function saveChanges() {
      var f = fields();
      var problems = D.requestProblems(Object.assign({}, draft, f), store.data(), { submit: true });
      if (problems.length) { blockSubmit(problems); return; }
      showProblems([]);
      ui.promptReason({ title: 'Save changes to ' + draft.request_no, confirmLabel: 'Save changes',
        message: 'Each change shows in the timeline with your reason. Why the change?' })
        .then(function (reason) {
          if (!reason) return;
          delete f.tool_id; delete f.duplicated_from;
          return store.editRequest({ id: draft.id, version: draft.version, fields: f, reason: reason }).then(function (r) {
            ui.toast({ kind: 'success', message: r.request_no + ' changed.' });
            location.hash = '#/request/' + r.id;
          });
        }).catch(function (e) {
          if (e && e.code === 'no_change') return ui.toast({ message: 'Nothing was changed.', timeout_ms: 2000 });
          ui.toastError('Could not save: ' + e.message, e);
        });
    }

    function deleteDraft() {
      ui.confirm({ title: 'Delete this draft?', message: 'The draft is removed for good. Nobody else has seen it.', confirmLabel: 'Delete', danger: true })
        .then(function (ok) {
          if (!ok) return;
          return store.deleteDraft(draft.id).then(function () { ui.toast({ kind: 'success', message: 'Draft deleted.' }); location.hash = '#/new'; });
        }).catch(function (e) { ui.toastError(e.message, e); });
    }

    formCol.appendChild(editing ? ui.el('div', { class: 'req-actions' }, [
      ui.button('Back to the request', { kind: 'ghost', icon: 'chevron_left', onClick: function () { location.hash = '#/request/' + draft.id; } }),
      ui.el('span', { class: 'spacer' }),
      ui.button('Save changes', { kind: 'primary', icon: 'save', onClick: saveChanges })
    ]) : ui.el('div', { class: 'req-actions' }, [
      draft ? ui.button('Delete draft', { kind: 'ghost', icon: 'trash', onClick: deleteDraft }) : null,
      ui.el('span', { class: 'spacer' }),
      ui.button('Save as template', { kind: 'ghost', icon: 'requests', title: 'Keep what stays the same for next time (not the lot, panels, place or dates)',
        onClick: function () {
          if (!st.tool_id) return ui.toast({ kind: 'warning', message: 'Pick the tool first - a template needs one.' });
          var t = byId('tools', st.tool_id), ty = byId('measurement_types', st.type_id);
          window.MRT.templates.save([t ? t.code : '', ty ? ty.name : ''].filter(Boolean).join(' '), { fields: fields() });
        } }),
      ui.button('Save draft', { icon: 'save', onClick: saveDraft }),
      ui.button('Submit', { kind: 'primary', icon: 'check', onClick: submit })
    ]));

    paintTool(); paintLot(); paintWhere(); paintUrgency(); paintDetails(); paintPreview();
    // where to start: the tool when there is none yet, a draft or copy opens at the first step that needs something
    if (src) {
      STEPS.forEach(function (s) { shown[s.key] = true; });
      var pb = problemsByStep();
      var first = STEPS.filter(function (s) { return s.key !== 'review' && pb[s.key].length; })[0];
      go(first ? first.key : 'review');
    } else if (st.tool_id) { shown.tool = true; go('lot'); }
    else go('tool');

    ui.mount(side, [
      ui.panel({ title: 'What the lab will see', icon: 'requests', body: preview }).node,
      myList(me)
    ]);
  }

  /** Your drafts and your latest submitted requests. */
  function myList(me) {
    var mine = store.visibleRequests(function (r) { return r.requester_id === me.id; });
    var drafts = mine.filter(function (r) { return r.status === 'draft'; });
    var sent = mine.filter(function (r) { return r.status !== 'draft'; }).slice(0, 8);
    function line(r) {
      var tool = byId('tools', r.tool_id), lot = byId('lots', r.lot_id);
      var label = r.request_no || ((tool ? tool.code : '?') + ' draft');
      var old = D.isOldDraft(r, Date.now());
      return ui.el('li', {}, [
        ui.el('a', { class: 'mono', href: r.status === 'draft' ? '#/new/' + r.id : '#/request/' + r.id, text: label }),
        ui.el('span', { class: 'muted', text: (lot ? ' · lot ' + lot.lot_number : r.new_lot ? ' · lot ' + r.new_lot.lot_number + ' (new)' : '') + ' · ' + D.REQUEST_STATUS_LABEL[r.status] }),
        old ? ui.statusBadge('warning', '30+ days') : null
      ]);
    }
    return ui.panel({ title: 'Your requests', icon: 'inbox', body: [
      ui.el('div', { class: 'ifield-label', text: 'Drafts (only you see them)' }),
      drafts.length ? ui.el('ul', { class: 'req-list' }, drafts.map(line)) : ui.el('p', { class: 'muted', text: 'None.' }),
      ui.el('div', { class: 'ifield-label', text: 'Submitted, newest first' }),
      sent.length ? ui.el('ul', { class: 'req-list' }, sent.map(line)) : ui.el('p', { class: 'muted', text: 'None yet.' }),
      ui.el('p', { class: 'muted' }, ['All of them, with filters: ', ui.el('a', { href: '#/requests', text: 'My requests' }), '.'])
    ] }).node;
  }

  return { render: render, stepOfProblem: stepOfProblem };
})();
