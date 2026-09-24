/**
 * Metrology Request Tracker - views/request-actions.js
 *
 * The workflow buttons and their small dialogs (Q43, DECISIONS M3-1..M3-9),
 * shared by the request page, My queue, My requests and the board. One click
 * where nothing is needed; a dialog only when a reason, date or path is.
 *
 *   MRT.requestActions.buttons(r, {size: 'sm', only: ['accept', ...]}) -> [button]
 *   MRT.requestActions.run(action, r) -> Promise (resolves when saved, null when cancelled)
 *
 * Actions: accept, start, hold, resume, clarify, answer, complete, reopen,
 * results_ok (domain.TRANSITIONS), plus 'received' (Panels received) and
 * 'take' (Take it). Who may do what is decided in domain.js, never here.
 */
window.MRT = window.MRT || {};
window.MRT.requestActions = (function () {
  'use strict';

  var ui = window.MRT.ui;
  var store = window.MRT.store;
  var D = window.MRT.domain;

  var ICON = { accept: 'check', start: 'activity', hold: 'clock', resume: 'refresh', clarify: 'help', answer: 'edit',
               complete: 'check', reopen: 'restore', results_ok: 'check', received: 'inbox', take: 'user' };
  var PRIMARY = { accept: true, start: true, complete: true, answer: true, results_ok: true };

  function toolOf(r) { return store.byId('tools', r.tool_id); }

  /** Where the request's panels are: "M70345 · slots 3, 4" (+ the note), F-3. */
  function whereOf(r) {
    var mags = {};
    store.list('magazines', { all: true }).forEach(function (m) { mags[m.id] = m; });
    if (r.status === 'completed' && r.put_back) return 'back in ' + D.placeText({ magazine_id: r.put_back.magazine_id, slots: r.put_back.slots }, mags);
    return D.placeText(r, mags);
  }

  /** The Hirata ID shown in each slot: the IDs in order onto the slots in order. */
  function slotLabels(panels, slots) {
    var map = {}, s2 = (slots || []).slice().sort(function (a, b) { return a - b; });
    s2.forEach(function (sl, i) { if ((panels || [])[i]) map[sl] = panels[i]; });
    return map;
  }

  /** What this person may do on this request now, in a fixed order. */
  function available(r) {
    var me = store.currentUser(), tool = toolOf(r);
    var list = D.actionsFor(me, r, tool, Date.now());
    if (D.canReceive(me, r, tool)) list.push('received');
    if (D.canTake(me, r, tool)) list.push('take');
    return list;
  }

  function label(action) {
    return action === 'received' ? 'Panels received' : action === 'take' ? 'Take it' : D.TRANSITIONS[action].label;
  }

  function buttons(r, o) {
    o = o || {};
    return available(r).filter(function (a) { return !o.only || o.only.indexOf(a) !== -1; }).map(function (a) {
      return ui.button(label(a), { size: o.size || null, kind: PRIMARY[a] ? 'primary' : null, icon: ICON[a],
        ariaLabel: label(a) + ' ' + (r.request_no || ''), dataset: { reqAction: a },
        onClick: function () { run(a, r).then(function (res) { if (res && o.after) o.after(res); }); } });
    });
  }

  /**
   * A ready Outlook draft about a request (Q19, M4-4), offered on a toast
   * after the key events: submit -> the tool's quality engineers; clarify,
   * complete -> the requester; cancel -> the other side.
   */
  function emailOffer(r, event) {
    var me = store.currentUser(), tool = toolOf(r) || {};
    var lot = store.byId('lots', r.lot_id), prio = store.byId('priorities', r.priority_id);
    function person(id) { return id ? store.byId('users', id) : null; }
    var toQE = [person(tool.primary_operator_id), person(tool.backup_operator_id)];
    var to = event === 'submit' ? toQE : event === 'cancel' && r.requester_id === me.id ? toQE : [person(r.requester_id)];
    to = to.filter(function (u) { return u && u.id !== me.id && u.email; });
    if (!to.length) return null;
    var what = { submit: 'New request', clarify: 'Question about', complete: 'Completed', cancel: 'Cancelled' }[event];
    var last = store.requestEvents(r.id).slice(-1)[0];
    var body = [
      what + ': ' + r.request_no + (tool.code ? ' (' + tool.code + ')' : ''),
      'Lot ' + (lot ? lot.lot_number : '?') + ', panels ' + D.panelsText(r) + (whereOf(r) ? ' (' + whereOf(r) + ')' : ''),
      'Priority ' + (prio ? prio.name : '-') + (r.needed_by ? ', needed by ' + r.needed_by : ''),
      event === 'complete' && r.results_path ? 'Results: ' + r.results_path : null,
      last && last.text && event !== 'submit' ? '\n' + last.text : null,
      '\nOpen it in the Metrology Request Tracker - search ' + r.request_no + '.'
    ].filter(Boolean).join('\n');
    return { label: 'Email ' + to.map(function (u) { return u.name.split(' ')[0]; }).join(' + '), onClick: function () {
      window.MRT.adapters.mail.draft({ to: to.map(function (u) { return u.email; }), subject: '[' + r.request_no + '] ' + what, body: body });
    } };
  }

  function done(r, text, event) {
    var offer = event ? emailOffer(r, event) : null;
    ui.toast({ kind: 'success', message: r.request_no + ': ' + text, actions: offer ? [offer] : null, timeout_ms: offer ? 8000 : undefined });
    window.MRT.app.route();
    return r;
  }
  function fail(e) {
    if (e && e.code === 'no_change') { ui.toast({ message: e.message }); return null; }
    ui.toastError(e.message, e);
    return null;
  }

  /** A small form dialog; save(v) returns the store Promise. */
  function ask(title, icon, fields, values, save, check, intro) {
    var f = ui.form(fields, values || {});
    return ui.dialog({ title: title, icon: icon, body: [intro ? ui.el('p', { text: intro }) : null, f.node],
      actions: [{ label: 'Cancel', value: null }, { label: 'Save', kind: 'primary', value: function () { return f.values(); },
        submit: function (v) {
          f.clearErrors();
          var bad = check ? check(v) : null;
          if (bad) { f.setError(bad[0], bad[1]); return Promise.reject(new Error(bad[1])); }
          return save(v);
        } }] });
  }

  function act(r, action, x, text) {
    return store.requestAction(r.id, action, x).then(function (res) { return done(res, text); });
  }

  /** Run one action on a request: its dialog if it needs one, then save. */
  function run(action, r) {
    var tool = toolOf(r);
    var p;
    switch (action) {
      case 'accept':
        p = ask('Accept ' + r.request_no, 'check', [
          { key: 'expected_done', label: 'Expected done (optional)', kind: 'date', hint: r.needed_by ? 'Needed by ' + r.needed_by + '.' : 'No needed-by date given.' }
        ], {}, function (v) { return store.requestAction(r.id, 'accept', { expected_done: v.expected_done || null }); }, null,
        'The engineer sees your expected date on the traveller card and in My requests.')
          .then(function (res) { return res ? done(res, 'accepted.') : null; });
        break;
      case 'start':
        if (r.received_ts) { p = act(r, 'start', {}, 'started.'); break; }
        p = ask('Start ' + r.request_no, 'activity', [
          { key: 'received', label: 'Panels received', kind: 'check' },
          { key: 'received_where', label: 'Kept where in the lab (optional)', kind: 'text', placeholder: 'e.g. FIB cabinet, shelf 2',
            showIf: function (v) { return v.received; } }
        ], { received: true }, function (v) { return store.requestAction(r.id, 'start', v); })
          .then(function (res) { return res ? done(res, 'started.') : null; });
        break;
      case 'hold':
        p = ask('Hold ' + r.request_no, 'clock', [
          { key: 'hold_reason_id', label: 'Why on hold', kind: 'select', options: [{ value: '', label: '- pick -' }].concat(store.list('hold_reasons').map(function (h) { return { value: h.id, label: h.name }; })) },
          { key: 'note', label: 'Note (optional)', kind: 'text' }
        ], {}, function (v) { return store.requestAction(r.id, 'hold', v); }, function (v) { return v.hold_reason_id ? null : ['hold_reason_id', 'Pick why']; },
        'The turnaround clock pauses while on hold.')
          .then(function (res) { return res ? done(res, 'on hold.') : null; });
        break;
      case 'clarify':
        p = ask(r.request_no + ' needs clarification', 'help', [
          { key: 'text', label: 'What is missing or unclear?', kind: 'longtext' }
        ], {}, function (v) { return store.requestAction(r.id, 'clarify', v); }, function (v) { return v.text ? null : ['text', 'Say what is missing']; },
        'It goes back to the engineer; when they answer, it comes back to where it was.')
          .then(function (res) { return res ? done(res, 'sent back for clarification.', 'clarify') : null; });
        break;
      case 'answer':
        p = ask('Answer - ' + r.request_no, 'edit', [
          { key: 'text', label: 'Your answer', kind: 'longtext' }
        ], {}, function (v) { return store.requestAction(r.id, 'answer', v); }, function (v) { return v.text ? null : ['text', 'Write your answer']; },
        'The request goes back to the quality engineer, where it was before.')
          .then(function (res) { return res ? done(res, 'answered.') : null; });
        break;
      case 'complete': {
        var root = tool && tool.results_root ? tool.results_root.replace(/\\+$/, '') + '\\' + (r.submitted_ts || '').slice(0, 4) + '\\' + r.request_no + '\\' : '';
        var outcome = r.after === 'scrap' || (tool && tool.destructive) ? 'scrapped' : r.after === 'other' ? 'other' : 'returned';
        var f = ui.form([
          { key: 'results_path', label: 'Results folder', kind: 'path', placeholder: '\\\\server\\share\\...', hint: 'Proposed from the tool\'s results root - change it if needed.' },
          { key: 'panels_outcome', label: 'The panels', kind: 'select', cls: 'half', options: D.PANEL_OUTCOMES.map(function (x) { return { value: x, label: D.PANEL_OUTCOME_LABEL[x] }; }) },
          { key: 'note', label: 'Note (optional; required for Other)', kind: 'text', cls: 'half', placeholder: r.after === 'other' ? r.after_other : '' },
          { key: 'magazine_id', label: 'Put them back into magazine', kind: 'select', cls: 'half',
            options: [{ value: '', label: '- not into a magazine -' }].concat(store.list('magazines').map(function (m) { return { value: m.id, label: m.code }; })) }
        ], { results_path: root, panels_outcome: outcome, note: r.after === 'other' ? r.after_other : '', magazine_id: r.magazine_id || '' });
        var slotBox = ui.el('div', { class: 'mz-pick' });
        var picker = null;
        function paintSlots() {
          var v = f.values();
          var m = v.panels_outcome !== 'scrapped' && v.magazine_id ? store.byId('magazines', v.magazine_id) : null;
          if (!m) { picker = null; ui.mount(slotBox, null); return; }
          var same = m.id === r.magazine_id;
          picker = ui.magazineSlots({ magazine: m, picked: same ? r.slots : [], taken: D.takenSlots(store.data().requests, m.id, r.id),
            labels: slotLabels(r.panels, same ? r.slots : []),
            onChange: function (sl) { picker.setLabels(slotLabels(r.panels, sl)); } });
          ui.mount(slotBox, [ui.el('div', { class: 'ifield-label', text: 'Slots (the same ones are picked when it is the same magazine)' }), picker.node]);
        }
        f.node.addEventListener('change', function (ev) { if (ev.target === f.control('magazine_id') || ev.target === f.control('panels_outcome')) paintSlots(); });
        paintSlots();
        p = ui.dialog({ title: 'Complete ' + r.request_no, icon: 'check', wide: true, body: [f.node, slotBox],
          actions: [{ label: 'Cancel', value: null }, { label: 'Save', kind: 'primary', value: function () { return f.values(); },
            submit: function (v) {
              f.clearErrors();
              if (!D.isSharePath(v.results_path)) { f.setError('results_path', 'A share path like \\\\server\\share\\... or Z:\\...'); return Promise.reject(new Error('Results folder')); }
              return store.requestAction(r.id, 'complete', { results_path: v.results_path, panels_outcome: v.panels_outcome, note: v.note,
                put_back: v.panels_outcome !== 'scrapped' && v.magazine_id ? { magazine_id: v.magazine_id, slots: picker ? picker.value() : [] } : null });
            } }] })
          .then(function (res) { return res ? done(res, 'completed.', 'complete') : null; });
        break;
      }
      case 'reopen':
        p = ask('Reopen ' + r.request_no, 'restore', [
          { key: 'text', label: 'Why are the results not OK?', kind: 'longtext' }
        ], {}, function (v) { return store.requestAction(r.id, 'reopen', v); }, function (v) { return v.text ? null : ['text', 'Say why']; })
          .then(function (res) { return res ? done(res, 'reopened.') : null; });
        break;
      case 'resume':
        p = act(r, 'resume', {}, 'resumed.');
        break;
      case 'results_ok':
        p = act(r, 'results_ok', {}, 'results OK - closed.');
        break;
      case 'received':
        p = ask('Panels received - ' + r.request_no, 'inbox', [
          { key: 'where', label: 'Kept where in the lab (optional)', kind: 'text', placeholder: 'e.g. FIB cabinet, shelf 2' }
        ], {}, function (v) { return store.receivePanels(r.id, v.where); })
          .then(function (res) { return res ? done(res, 'panels received.') : null; });
        break;
      case 'take':
        p = store.takeRequest(r.id).then(function (res) { return done(res, 'yours now.'); });
        break;
      default:
        p = Promise.reject(new Error('Unknown action ' + action));
    }
    return p.catch(fail);
  }

  return { buttons: buttons, run: run, available: available, label: label, emailOffer: emailOffer, whereOf: whereOf, slotLabels: slotLabels };
})();
