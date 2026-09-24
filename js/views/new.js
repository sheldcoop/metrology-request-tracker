/**
 * Metrology Request Tracker - views/new.js
 *
 * New request (#/new, M2 step 4). One request = one tool (Q4). The engineer
 * picks the tool (its glyph), measurement type and BKM (Q13, Q51), the lot and
 * its panels on the panel map (Q6), says where the panels are and what step
 * they are at (M2-7, M2-8), layer (M2-9), what happens to them afterwards
 * (M2-12, FIB always scrap + a required tick, M2-11), priority with a reason
 * when it needs one (Q26), an optional needed-by date (M2-4), purpose (M2-13)
 * and the tool's extra fields (Q5). Save as a private draft (Q33) or submit:
 * warnings first (Q44), then the request ID (Q29).
 *
 *   #/new               a new request (?lot=<lot id> picks the lot, ?tool=<tool id> the tool)
 *   #/new/<draft id>    carry on with a draft
 *   #/new/<request id>  edit a submitted, open request - not its tool - with a reason (Q14, M3-5)
 *   #/new?from=<id>     copy a request (Q28)
 *   (the ?key= values arrive as ctx.params; after Submit the request page #/request/<id> opens)
 *
 * A traveller-card preview on the right shows what the quality engineer
 * will see.
 */
window.MRT = window.MRT || {};
window.MRT.views = window.MRT.views || {};
window.MRT.views['new'] = (function () {
  'use strict';

  var ui = window.MRT.ui;
  var store = window.MRT.store;
  var D = window.MRT.domain;
  var X = window.MRT.extraFields;

  function byId(coll, id) { return id ? store.byId(coll, id) : null; }

  /** The fields a copy takes over (Q28): not the date, reason or where the panels are now. */
  function copyOf(r) {
    return { tool_id: r.tool_id, type_id: r.type_id, lot_id: r.lot_id, panels: (r.panels || []).slice(), priority_id: r.priority_id,
             bkm_id: r.bkm_id, bkm_path: r.bkm_path, purpose: r.purpose, process_step_id: r.process_step_id,
             process_step_other: r.process_step_other, layer: r.layer, after: r.after, after_other: r.after_other,
             extra: JSON.parse(JSON.stringify(r.extra || {})), duplicated_from: r.id };
  }

  function defaultPriority() {
    var p = store.list('priorities').filter(function (x) { return x.is_default; })[0] || store.list('priorities')[0];
    return p ? p.id : null;
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
    var st = Object.assign({ tool_id: null, type_id: null, lot_id: null, panels: [], priority_id: defaultPriority(), priority_reason: '',
      needed_by: null, bkm_id: null, bkm_path: '', purpose: '', process_step_id: null, process_step_other: '', layer: '',
      panel_location: '', destructive_ok: false, after: 'back_to_me', after_other: '', extra: {}, duplicated_from: null }, src || {});
    if (!src && q.lot && byId('lots', q.lot)) st.lot_id = q.lot;
    if (!src && q.tool && byId('tools', q.tool)) st.tool_id = q.tool;

    var title = editing ? 'Edit ' + draft.request_no : draft ? 'Draft' : from ? 'Copy of ' + (from.request_no || 'a draft') : 'New request';
    main.appendChild(ui.pageHead(title, editing ? 'Change what is needed and save with a reason; the quality engineer sees each change in the timeline. The tool stays.'
      : 'One request = one tool. Save a draft any time; Submit sends it to the tool\'s quality engineers.'));

    var errorBox = ui.el('div', { class: 'req-errors', role: 'alert', hidden: true });
    var formCol = ui.el('div', { class: 'req-form' });
    var side = ui.el('aside', { class: 'req-side' });
    main.appendChild(ui.el('div', { class: 'req-layout' }, [ui.el('div', {}, [errorBox, formCol]), side]));

    // --- parts that are rebuilt when the tool / lot / priority change
    var parts = {};
    function part(key) { parts[key] = ui.el('div', { class: 'req-part' }); return parts[key]; }
    var panelMap = null, extraForm = null, extraFieldsNow = [];

    /* 1. Tool */
    function toolPicker() {
      var tools = store.list('tools');
      return ui.el('div', { class: 'tool-pick', role: 'radiogroup', 'aria-label': 'Tool' }, tools.map(function (t) {
        var on = t.id === st.tool_id;
        var b = ui.el('button', { type: 'button', class: 'tool-pick-opt is-' + t.status + (on ? ' is-on' : ''), role: 'radio',
          'aria-checked': on ? 'true' : 'false', title: t.name + (t.status !== 'up' ? ' - ' + D.TOOL_STATUS_LABEL[t.status] : '') }, [
          ui.toolGlyph(t.glyph, { size: 40, state: t.status === 'up' ? 'idle' : t.status === 'down' ? 'off' : 'maint' }),
          ui.el('b', { class: 'mono', text: t.code }),
          t.status !== 'up' ? ui.el('span', { class: 'chip ' + (t.status === 'down' ? 'expired' : 'warning'), text: D.TOOL_STATUS_LABEL[t.status] }) : null
        ]);
        if (editing && !on) b.disabled = true;
        b.addEventListener('click', function () {
          if (st.tool_id === t.id || editing) return;
          collect();
          st.tool_id = t.id; st.type_id = null; st.bkm_id = null; st.extra = {}; st.destructive_ok = false;
          st.after = t.destructive ? 'scrap' : (st.after === 'scrap' ? 'back_to_me' : st.after);
          paintAll();
        });
        return b;
      }));
    }

    /* 2. What to measure */
    var typeF, bkmF, bkmPathF, purposeF;
    function paintWhat() {
      var el = parts.what;
      var tool = byId('tools', st.tool_id);
      if (!tool) { ui.mount(el, ui.el('p', { class: 'muted', text: 'Pick the tool first.' })); return; }
      var types = store.list('measurement_types').filter(function (m) { return m.tool_id === tool.id || m.id === st.type_id; });
      typeF = ui.field({ label: 'Measurement type', cls: 'half', value: st.type_id || '',
        options: [{ value: '', label: '- pick -' }].concat(types.map(function (m) { return { value: m.id, label: m.name }; })) });
      typeF.input.addEventListener('change', function () { collect(); st.bkm_id = matchingBkm(st.bkm_id); paintWhat(); paintExtra(); paintPreview(); });
      var bkms = store.list('bkms').filter(function (b) { return b.tool_id === tool.id && (!st.type_id || !b.type_id || b.type_id === st.type_id); });
      bkmF = ui.field({ label: 'BKM from the library', cls: 'half', value: st.bkm_id || '',
        options: [{ value: '', label: bkms.length ? '- none / my own path -' : '- no BKMs for this type -' }].concat(bkms.map(function (b) {
          return { value: b.id, label: b.name + (b.doc_version ? ' (' + b.doc_version + ')' : '') }; })) });
      bkmPathF = ui.field({ label: 'Or the path of your own BKM (PowerPoint)', mono: true, value: st.bkm_path || '',
        placeholder: '\\\\server\\share\\...\\my BKM.pptx', hint: 'The BKM says where and what to measure (M2-10).' });
      purposeF = ui.field({ label: 'Purpose (optional)', multiline: true, value: st.purpose || '',
        placeholder: 'Why this measurement, what decision it feeds. Without a BKM: what to measure.' });
      [bkmF.input, bkmPathF.input, purposeF.input].forEach(function (c) { c.addEventListener('change', function () { collect(); paintPreview(); }); });
      ui.mount(el, [ui.el('div', { class: 'form-grid' }, [typeF.node, bkmF.node]), bkmPathF.node, purposeF.node]);
    }
    function matchingBkm(id) {
      var b = byId('bkms', id);
      return b && (!st.type_id || !b.type_id || b.type_id === st.type_id) ? id : null;
    }

    /* 3. Lot and panels */
    var lotF;
    function paintLot() {
      var el = parts.lot;
      var lots = (store.data().lots || []).slice().sort(function (a, b) { return a.created_ts < b.created_ts ? 1 : -1; });
      if (!lots.length) {
        ui.mount(el, ui.el('p', { class: 'muted' }, ['No lots yet. ', ui.el('a', { href: '#/lots', text: 'Register the lot first' }), ' (Lots > Register lot).']));
        return;
      }
      lotF = ui.field({ label: 'Lot', cls: 'half', value: st.lot_id || '', options: [{ value: '', label: '- pick the lot -' }].concat(lots.map(function (l) {
        var p = byId('projects', l.project_id);
        return { value: l.id, label: l.lot_number + '  ·  ' + (p ? p.code : '?') + '  ·  ' + l.panel_count + ' panels' + (l.sample ? '  (sample)' : '') };
      })) });
      lotF.input.addEventListener('change', function () {
        collect();
        st.lot_id = lotF.value() || null; st.panels = [];
        paintLot(); paintPreview();
      });
      var lot = byId('lots', st.lot_id);
      var info = lot ? ui.el('p', { class: 'muted lot-info' }, [
        'Project ', ui.el('b', { text: (byId('projects', lot.project_id) || {}).code || '?' }),
        lot.part_number_id ? ['  ·  Part number ', ui.el('b', { class: 'mono', text: (byId('part_numbers', lot.part_number_id) || {}).code || '?' })] : null,
        '  ·  Build-up ', ui.el('b', { text: (byId('buildups', lot.buildup_id) || {}).code || '?' }),
        lot.note ? ['  ·  ', ui.el('span', { text: lot.note })] : null
      ]) : null;
      panelMap = lot ? ui.panelMap({ count: lot.panel_count, selected: st.panels, label: 'Panels to measure', parse: D.parsePanels, format: D.formatPanels,
        onChange: function (list) { st.panels = list; paintPreview(); } }) : null;
      ui.mount(el, [lotF.node, info, panelMap ? panelMap.node : ui.el('p', { class: 'muted', text: 'Pick the lot to see its panel map.' })]);
    }

    /* 4. The panels: where they are, step, layer, afterwards */
    var stepF, stepOtherF, layerF, whereF, afterF, afterOtherF, destructiveT;
    function paintPanels() {
      var el = parts.panels;
      var tool = byId('tools', st.tool_id);
      var steps = store.list('process_steps');
      var stepVal = st.process_step_other ? '__other' : (st.process_step_id || '');
      stepF = ui.field({ label: 'The panels are after (process step, optional)', cls: 'half', value: stepVal,
        options: [{ value: '', label: steps.length ? '- pick -' : '- no list yet, use Other -' }].concat(steps.map(function (s) { return { value: s.id, label: s.name }; }))
          .concat([{ value: '__other', label: 'Other (type it)' }]) });
      stepOtherF = ui.field({ label: 'Process step', cls: 'half', value: st.process_step_other || '', placeholder: 'e.g. after desmear' });
      stepOtherF.node.hidden = stepVal !== '__other';
      stepF.input.addEventListener('change', function () { stepOtherF.node.hidden = stepF.value() !== '__other'; collect(); });
      layerF = ui.field({ label: 'Layer (optional)', cls: 'half', value: st.layer || '', placeholder: 'e.g. L3, top SR' });
      whereF = ui.field({ label: 'Where are the panels now?', value: st.panel_location || '',
        placeholder: 'e.g. Magazine 14, rack B2  /  in MES  /  with Anna', hint: 'Required - the quality engineer picks them up there.' });
      var destructive = tool && tool.destructive;
      afterF = ui.field({ label: 'After measuring, the panels go', cls: 'half', value: destructive ? 'scrap' : (st.after || 'back_to_me'),
        options: D.AFTER_OPTIONS.map(function (a) { return { value: a, label: D.AFTER_LABEL[a] }; }), disabled: !!destructive,
        hint: destructive ? tool.code + ' destroys the panels: always scrap.' : null });
      afterOtherF = ui.field({ label: 'Where then?', cls: 'half', value: st.after_other || '', placeholder: 'e.g. to Anna for SEM' });
      afterOtherF.node.hidden = (destructive ? 'scrap' : st.after) !== 'other';
      afterF.input.addEventListener('change', function () { afterOtherF.node.hidden = afterF.value() !== 'other'; collect(); paintPreview(); });
      destructiveT = destructive ? ui.toggle({ label: 'I know ' + tool.code + ' destroys these panels - they may be scrapped', checked: !!st.destructive_ok }) : null;
      if (destructiveT) destructiveT.input.addEventListener('change', function () { collect(); });
      ui.mount(el, [
        whereF.node,
        ui.el('div', { class: 'form-grid' }, [stepF.node, stepOtherF.node, layerF.node, afterF.node, afterOtherF.node]),
        destructiveT ? ui.el('div', { class: 'req-destructive' }, [ui.icon('alert', 16), destructiveT.node]) : null
      ]);
    }

    /* 5. Urgency */
    var prioSeg, reasonF, neededF;
    function paintUrgency() {
      var el = parts.urgency;
      var prios = store.list('priorities');
      prioSeg = ui.segmented({ label: 'Priority', value: st.priority_id, options: prios.map(function (p) { return { value: p.id, label: p.name }; }),
        onChange: function (v) { collect(); st.priority_id = v; paintUrgency(); paintPreview(); } });
      var prio = byId('priorities', st.priority_id);
      reasonF = prio && prio.needs_reason ? ui.field({ label: 'Why ' + prio.name + '?', value: st.priority_reason || '',
        placeholder: 'e.g. line 2 stopped, customer audit on Friday', hint: 'Required for ' + prio.name + '; managers see it.' }) : null;
      neededF = ui.field({ label: 'Needed by (optional)', type: 'date', cls: 'half', value: st.needed_by || '',
        hint: 'With a date there is a countdown; without one the priority says how urgent it is.' });
      neededF.input.addEventListener('change', function () { collect(); paintPreview(); });
      ui.mount(el, [ui.el('div', { class: 'dlg-row' }, [ui.el('span', { class: 'ifield-label', text: 'Priority', 'aria-hidden': 'true' }), prioSeg.node]),
                    reasonF ? reasonF.node : null, neededF.node]);
    }

    /* 6. The tool's extra fields (Q5) */
    function paintExtra() {
      var el = parts.extra;
      var tool = byId('tools', st.tool_id);
      extraFieldsNow = tool ? D.fieldsForType(store.list('tool_fields', { all: true }), tool.id, st.type_id) : [];
      var specs = X.specs(extraFieldsNow, st.extra);
      if (!tool || !specs.length) { extraForm = null; ui.mount(el, ui.el('p', { class: 'muted', text: tool ? tool.code + ' asks nothing more.' : 'Pick the tool first.' })); return; }
      extraForm = ui.form(specs, X.values(extraFieldsNow, st.extra));
      ui.mount(el, extraForm.node);
    }

    /** Read every control back into st. */
    function collect() {
      var tool = byId('tools', st.tool_id);
      if (typeF && tool) { st.type_id = typeF.value() || null; st.bkm_id = bkmF.value() || null; st.bkm_path = bkmPathF.value(); st.purpose = purposeF.value(); }
      if (panelMap) st.panels = panelMap.value();
      if (stepF) {
        var sv = stepF.value();
        st.process_step_id = sv && sv !== '__other' ? sv : null;
        st.process_step_other = sv === '__other' ? stepOtherF.value() : '';
        st.layer = layerF.value(); st.panel_location = whereF.value();
        st.after = tool && tool.destructive ? 'scrap' : afterF.value();
        st.after_other = st.after === 'other' ? afterOtherF.value() : '';
        st.destructive_ok = destructiveT ? destructiveT.input.checked : false;
      }
      if (reasonF) st.priority_reason = reasonF.value(); else if (prioSeg) st.priority_reason = '';
      if (neededF) st.needed_by = neededF.value() || null;
      if (extraForm) st.extra = X.answers(extraFieldsNow, extraForm.values());
      else if (tool) st.extra = {};
    }

    function fields() {
      collect();
      return { tool_id: st.tool_id, type_id: st.type_id, lot_id: st.lot_id, panels: st.panels, priority_id: st.priority_id,
        priority_reason: st.priority_reason, needed_by: st.needed_by, bkm_id: st.bkm_id, bkm_path: st.bkm_path, purpose: st.purpose,
        process_step_id: st.process_step_id, process_step_other: st.process_step_other, layer: st.layer, panel_location: st.panel_location,
        destructive_ok: st.destructive_ok, after: st.after, after_other: st.after_other, extra: st.extra, duplicated_from: st.duplicated_from };
    }

    /* --- the traveller-card preview ------------------------------------ */
    var preview = ui.el('div');
    function paintPreview() {
      var tool = byId('tools', st.tool_id), lot = byId('lots', st.lot_id), prio = byId('priorities', st.priority_id);
      var type = byId('measurement_types', st.type_id);
      ui.mount(preview, ui.el('div', { class: 'traveller-mini prio-' + (prio ? prio.level : 3) }, [
        ui.el('div', { class: 'tm-head' }, [
          tool ? ui.toolGlyph(tool.glyph, { size: 32 }) : ui.icon('request_new', 24),
          ui.el('div', {}, [ui.el('div', { class: 'tm-id mono', text: tool ? tool.code + '-YYMMDD-NN' : 'Pick a tool' }),
                            ui.el('div', { class: 'muted', text: type ? type.name : 'measurement type' })]),
          prio ? ui.el('span', { class: 'tm-prio' }, [ui.el('b', { text: prio.name }), ui.el('span', { class: 'mono', text: prio.code })]) : null
        ]),
        ui.el('dl', { class: 'facts' }, [
          ui.el('dt', { text: 'Lot' }), ui.el('dd', { class: 'mono', text: lot ? lot.lot_number : '-' }),
          ui.el('dt', { text: 'Panels' }), ui.el('dd', { class: 'mono', text: st.panels.length ? D.formatPanels(st.panels) + '  (' + st.panels.length + ')' : '-' }),
          ui.el('dt', { text: 'Needed by' }), ui.el('dd', { class: 'num', text: st.needed_by || 'no date' }),
          ui.el('dt', { text: 'BKM' }), ui.el('dd', {}, st.bkm_id || st.bkm_path ? 'yes' : ui.el('span', { class: 'chip warning', text: 'No BKM' })),
          ui.el('dt', { text: 'Afterwards' }), ui.el('dd', { text: D.AFTER_LABEL[st.after] || '-' })
        ])
      ]));
    }

    /* --- actions ------------------------------------------------------- */
    function showProblems(list) {
      errorBox.hidden = !list.length;
      ui.mount(errorBox, list.length ? [ui.el('b', { text: 'Not ready to submit yet:' }), ui.el('ul', {}, list.map(function (t) { return ui.el('li', { text: t }); }))] : null);
      if (list.length && errorBox.scrollIntoView) errorBox.scrollIntoView({ block: 'nearest' });
    }

    function saveDraft() {
      var f = fields();
      if (!f.tool_id) { showProblems(['Pick a tool - a draft needs at least that']); return; }
      showProblems([]);
      store.saveDraft({ id: draft ? draft.id : undefined, version: draft ? draft.version : undefined, fields: f }).then(function (r) {
        ui.toast({ kind: 'success', message: 'Draft saved. Only you see it.' });
        location.hash = '#/new/' + r.id;
        if (draft) window.MRT.app.route();
      }).catch(function (e) {
        if (e && e.code === 'no_change') return ui.toast({ message: 'Nothing was changed.', timeout_ms: 2000 });
        ui.toastError(e.message, e);
      });
    }

    function submit() {
      var f = fields();
      var probe = Object.assign({ id: draft ? draft.id : null }, f);
      var problems = D.requestProblems(probe, store.data(), { submit: true });
      showProblems(problems);
      if (problems.length) return;
      var warnings = D.submitWarnings(probe, store.data());
      var ask = warnings.length ? ui.dialog({ title: 'Submit anyway?', icon: 'alert',
        body: [ui.el('p', { text: 'Please check before you submit:' }), ui.el('ul', {}, warnings.map(function (w) { return ui.el('li', { text: w.text }); }))],
        actions: [{ label: 'Back to the form', value: null }, { label: 'Submit anyway', kind: 'primary', value: true }] }) : Promise.resolve(true);
      ask.then(function (ok) {
        if (!ok) return;
        return store.submitRequest({ id: draft ? draft.id : undefined, version: draft ? draft.version : undefined, fields: f }).then(function (r) {
          ui.toast({ kind: 'success', message: 'Submitted ' + r.request_no + '.' });
          location.hash = '#/request/' + r.id;
        });
      }).catch(function (e) { ui.toastError('Could not submit: ' + e.message, e); });
    }

    function saveChanges() {
      var f = fields();
      var problems = D.requestProblems(Object.assign({}, draft, f), store.data(), { submit: true });
      showProblems(problems);
      if (problems.length) return;
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

    function section(n, title, body, icon) {
      return ui.panel({ title: n + '  ' + title, icon: icon, body: body }).node;
    }

    function paintAll() {
      ui.mount(parts.tool, toolPicker());
      paintWhat(); paintPanels(); paintExtra(); paintPreview();
    }

    ui.mount(formCol, [
      section('1', 'Tool', part('tool'), 'wrench'),
      section('2', 'What to measure', part('what'), 'ruler'),
      section('3', 'Lot and panels', part('lot'), 'lots'),
      section('4', 'The panels', part('panels'), 'grid'),
      section('5', 'Priority and date', part('urgency'), 'alert'),
      section('6', 'Tool fields', part('extra'), 'sliders'),
      editing ? ui.el('div', { class: 'req-actions' }, [
        ui.button('Back to the request', { kind: 'ghost', icon: 'chevron_left', onClick: function () { location.hash = '#/request/' + draft.id; } }),
        ui.el('span', { class: 'spacer' }),
        ui.button('Save changes', { kind: 'primary', icon: 'save', onClick: saveChanges })
      ]) : ui.el('div', { class: 'req-actions' }, [
        draft ? ui.button('Delete draft', { kind: 'ghost', icon: 'trash', onClick: deleteDraft }) : null,
        ui.el('span', { class: 'spacer' }),
        ui.button('Save draft', { icon: 'save', onClick: saveDraft }),
        ui.button('Submit', { kind: 'primary', icon: 'check', onClick: submit })
      ])
    ]);
    paintAll(); paintLot(); paintUrgency();

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
      return ui.el('li', {}, [
        ui.el('a', { class: 'mono', href: r.status === 'draft' ? '#/new/' + r.id : '#/request/' + r.id, text: label }),
        ui.el('span', { class: 'muted', text: (lot ? ' · lot ' + lot.lot_number : '') + ' · ' + D.REQUEST_STATUS_LABEL[r.status] })
      ]);
    }
    return ui.panel({ title: 'Your requests', icon: 'inbox', body: [
      ui.el('div', { class: 'ifield-label', text: 'Drafts (only you see them)' }),
      drafts.length ? ui.el('ul', { class: 'req-list' }, drafts.map(line)) : ui.el('p', { class: 'muted', text: 'None.' }),
      ui.el('div', { class: 'ifield-label', text: 'Submitted, newest first' }),
      sent.length ? ui.el('ul', { class: 'req-list' }, sent.map(line)) : ui.el('p', { class: 'muted', text: 'None yet.' }),
      ui.el('p', { class: 'muted', text: 'My requests (all, with filters) comes in M3.' })
    ] }).node;
  }

  return { render: render };
})();
