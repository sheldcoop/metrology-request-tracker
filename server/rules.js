'use strict';
/**
 * Metrology Request Tracker - server/rules.js (Node only, never in the browser).
 *
 * Re-checks every document write with the UNCHANGED js/domain.js (loaded
 * below through a tiny window shim - the file itself is never edited for
 * the server). Compares the incoming document against the stored one and
 * refuses what the writer's roles do not allow:
 *
 *   unknown / inactive writer           -> unknown_user (401/403)
 *   users, settings + all reference
 *     lists changed                     -> admins only (canUseSettings)
 *   request added                       -> engineers, for themselves (or admin)
 *   request status moved                -> the TRANSITIONS action must exist
 *                                          and canAct() must pass; cancel
 *                                          goes through canCancel()
 *   request fields edited               -> canEditSubmitted, or taking over
 *                                          via canTake for assigned_to
 *   request deleted                     -> admins only
 *   tool added/removed                  -> admins only; other tool edits ->
 *                                          the tool's own quality engineers
 *                                          (canSetToolStatus) or admin
 *   lot added                           -> canRegisterLot; edited/deleted ->
 *                                          canEditLot, except the scrapped
 *                                          panels an authorized complete
 *                                          marks (store.putBack)
 *   template added                      -> canRequest; edited/deleted -> admin
 *   audit_log / request_events          -> append-only (prefix must match)
 *
 * Returns null when the write may land, else { code, reason }. This is a
 * safety net behind the app's own gates, not a replacement for them.
 */
const fs = require('node:fs');
const path = require('node:path');

function loadDomain(root) {
  const src = fs.readFileSync(path.join(root, 'js', 'domain.js'), 'utf8');
  const window = { MRT: {} };
  new Function('window', src)(window);
  return window.MRT.domain;
}

/** Deep-equal ignoring key order (round-trips re-serialize objects). */
function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}
function same(a, b) { return canon(a) === canon(b); }

function byId(list, id) {
  return (list || []).filter(function (r) { return r && r.id === id; })[0] || null;
}

function toolFor(doc, r) {
  return byId(doc.tools, r && r.tool_id) || null;
}

/** Append-only collections: longer, with the old entries untouched. */
function appendOnly(oldList, newList) {
  const o = oldList || [], n = newList || [];
  if (n.length < o.length) return false;
  for (let i = 0; i < o.length; i++) {
    if (!same(o[i], n[i])) return false;
  }
  return true;
}

function checkWrite(D, oldDoc, newDoc, writerId, nowTs) {
  const now = nowTs || Date.now();
  // The writer usually joins an earlier save - but first setup and
  // self-registration join IN this save, so fall back to the incoming users.
  // Rights always come from the STORED record: a forged self-promotion in
  // the incoming document grants nothing (see the users branch below).
  const known = byId((oldDoc || {}).users, writerId);
  const joining = known ? null : byId((newDoc || {}).users, writerId);
  const writer = known || joining;
  if (!writer || writer.active === false) return { code: 'unknown_user', reason: 'unknown or inactive user' };
  // No users yet: first setup on an empty database (import fills users in
  // production, so this only runs on a box nobody has touched). Allow it.
  if (!((oldDoc || {}).users || []).length) return null;
  const admin = !!known && D.canUseSettings(known);
  const deny = (reason) => {
    if (process.env.MRT_DEBUG_RULES) {
      const diff = Object.keys(keys).filter((k) => !same(oldC(k), newC(k)));
      process.stderr.write('RULES-DEBUG deny ' + reason + ' writer=' + writerId + ' admin=' + admin +
        ' knownRoles=' + JSON.stringify((byId((oldDoc || {}).users, writerId) || {}).roles) + ' changed=' + diff.join(',') + '\n');
    }
    return { code: 'forbidden', reason: reason };
  };

  const oldC = function (k) { return (oldDoc && oldDoc[k]) || []; };
  const newC = function (k) { return (newDoc && newDoc[k]) || []; };
  const keys = {};
  Object.keys(oldDoc || {}).concat(Object.keys(newDoc || {})).forEach((k) => { keys[k] = true; });

  // Admins own the data wholesale (restore, demo fill, imports): every such
  // write is audit-trailed. Until login lands the writer rides a dev header,
  // so this proves the checking machinery, not a trust boundary (D-SRV-4).
  if (admin) return null;
  // Undo restores the exact pre-change snapshot (every collection back,
  // audit log plus one trailing 'undo' entry) - the one wholesale write a
  // non-admin may land. A forged marker leaves a permanent, named audit
  // entry pointing at the forger's own user id.
  const oldAudit = oldC('audit_log'), newAudit = newC('audit_log');
  if (newAudit.length === oldAudit.length + 1 && appendOnly(oldAudit, newAudit.slice(0, -1))) {
    const marker = newAudit[newAudit.length - 1] || {};
    if (marker.entity === 'undo' && marker.action === 'undo') return null;
  }

  const names = Object.keys(keys);
  for (let i = 0; i < names.length; i++) {
    const k = names[i];
    if (k === 'revision' || k === 'schema_version' || k === 'saved_ts' || k === 'saved_by' || k === 'created_ts') continue;
    const o = oldC(k), n = newC(k);
    if (same(o, n)) continue;

    if (k === 'audit_log' || k === 'request_events') {
      if (!appendOnly(o, n)) return deny(k + ' is append-only');
      continue;
    }
    if (k === 'users') {
      if (admin) continue;
      if (!o.length) continue;   // no users yet: first setup (import fills users in production)
      if (removed(o, n).length) return deny('users needs an admin');
      const ch = changed(o, n);
      const add = added(o, n);
      // Joining yourself as an engineer (self-registration): exactly one
      // added record, your own id, engineer role only, nothing else touched.
      if (!ch.length && add.length === 1 && add[0].id === writer.id &&
          (add[0].roles || []).length > 0 && (add[0].roles || []).every((r) => r === 'engineer')) continue;
      // Linking your Windows ID: only your own record, only login fields.
      if (!add.length && ch.length === 1 && ch[0].old.id === writer.id &&
          Object.keys(ch[0].rec).filter((f) => !same(ch[0].rec[f], ch[0].old[f]))
            .every((f) => f === 'windows_id' || f === 'domain' || f === 'version')) continue;
      return deny('users needs an admin');
    }
    if (k === 'settings') {
      if (!admin) return deny(k + ' needs an admin');
      continue;
    }
    if (k === 'requests') {
      const r = checkRequests(D, o, n, writer, admin, newDoc, now);
      if (r) return r;
      continue;
    }
    if (k === 'tools') {
      const r = checkTools(D, o, n, writer, admin);
      if (r) return r;
      continue;
    }
    if (k === 'lots') {
      for (const rec of added(o, n)) {
        if (!D.canRegisterLot(writer) && !admin) return deny('registering lots needs an engineer');
      }
      for (const rec of removed(o, n)) {
        if (!D.canEditLot(writer, rec) && !admin) return deny('deleting this lot is not allowed');
      }
      // Completing on a destructive tool marks the request's panels scrapped
      // on the lot (store.putBack) - allowed for whoever may complete it.
      const scrap = (!admin && changed(o, n).some((ch) => !D.canEditLot(writer, ch.old)))
        ? allowedScrap(D, oldDoc, newDoc, writer, now) : {};
      for (const ch of changed(o, n)) {
        if (D.canEditLot(writer, ch.old) || admin) continue;
        if (scrapOf(ch.old, ch.rec, scrap[ch.old.id] || [])) continue;
        return deny('editing this lot is not allowed');
      }
      continue;
    }
    if (k === 'templates') {
      for (const rec of added(o, n)) {
        if (!D.canRequest(writer) && !admin) return deny('saving templates needs an engineer');
      }
      if ((removed(o, n).length || changed(o, n).length) && !admin) return deny('templates need an admin');
      continue;
    }
    if (!admin) return deny(k + ' needs an admin');
  }
  return null;
}

function added(o, n) {
  return n.filter((r) => r && !byId(o, r.id));
}
function removed(o, n) {
  return o.filter((r) => r && !byId(n, r.id));
}
function changed(o, n) {
  const out = [];
  n.forEach((r) => {
    if (!r) return;
    const old = byId(o, r.id);
    if (old && !same(old, r)) out.push({ old: old, rec: r });
  });
  return out;
}

/**
 * The workflow action carrying a status move, or null when the writer may
 * not make it ('cancel' when canCancel passes). No-move pairs return null.
 */
function allowedAction(D, oldR, newR, doc, writer, now) {
  if (!oldR || !newR || newR.status === oldR.status) return null;
  if (newR.status === 'cancelled') {
    const tool = toolFor(doc, newR) || toolFor(doc, oldR);
    return D.canCancel(writer, oldR, tool) ? 'cancel' : null;
  }
  const actions = Object.keys(D.TRANSITIONS).filter((a) => {
    const t = D.TRANSITIONS[a];
    if (t.from.indexOf(oldR.status) === -1) return false;
    if (t.to) return t.to === newR.status;
    return newR.status === oldR.return_to;   // back: true returns where it came from
  });
  if (!actions.length) return null;
  const tool = toolFor(doc, newR) || toolFor(doc, oldR);
  return actions.filter((a) => D.canAct(writer, a, oldR, tool, now))[0] || null;
}

/**
 * Panels a completed-as-scrapped request may mark on its lot in this same
 * write: completing on a destructive tool appends the request's panels to
 * lot.scrapped (store.putBack), which is the measurer's job, not a lot edit.
 * Returns {lotId: [panels]} for every authorized complete-with-scrapped move.
 */
function allowedScrap(D, oldDoc, newDoc, writer, now) {
  const out = {};
  const o = (oldDoc && oldDoc.requests) || [], n = (newDoc && newDoc.requests) || [];
  n.forEach((r) => {
    if (!r) return;
    const old = byId(o, r.id);
    if (!old || r.status !== 'completed' || r.panels_outcome !== 'scrapped') return;
    if (allowedAction(D, old, r, newDoc, writer, now) !== 'complete') return;
    const lotId = r.lot_id || old.lot_id;
    if (!lotId || !(r.panels || []).length) return;
    out[lotId] = (out[lotId] || []).concat(r.panels.filter((p) => (out[lotId] || []).indexOf(p) === -1));
  });
  return out;
}

/**
 * True when a lot change is exactly the scrap-marking of an authorized
 * complete: only scrapped grows (by panels the writer may scrap on this
 * lot) plus the putBack version bump. Anything else stays a lot edit.
 */
function scrapOf(oldLot, newLot, panels) {
  if (!panels.length) return false;
  const fields = Object.keys(newLot).filter((k) => !same(newLot[k], oldLot[k]));
  if (fields.filter((k) => k !== 'scrapped' && k !== 'version').length) return false;
  if (fields.indexOf('version') !== -1 && newLot.version !== (oldLot.version || 0) + 1) return false;
  const was = oldLot.scrapped || [], is = newLot.scrapped || [];
  const addedPanels = is.filter((p) => was.indexOf(p) === -1);
  if (!addedPanels.length || is.length !== was.length + addedPanels.length) return false;
  return addedPanels.every((p) => panels.indexOf(p) !== -1);
}

function checkRequests(D, o, n, writer, admin, doc, now) {
  const deny = (reason) => ({ code: 'forbidden', reason: reason });
  for (const r of added(o, n)) {
    if (admin) continue;
    if (!D.canRequest(writer)) return deny('filing requests needs an engineer');
    if (r.requester_id !== writer.id) return deny('filing for someone else is not allowed');
  }
  for (const r of removed(o, n)) {
    if (!admin) return deny('deleting requests needs an admin');
  }
  for (const ch of changed(o, n)) {
    const r = ch.rec;
    if (admin) continue;
    const tool = toolFor(doc, r) || toolFor(doc, ch.old);
    if (r.status !== ch.old.status) {
      if (r.status === 'cancelled') {
        if (!D.canCancel(writer, ch.old, tool)) return deny('cancelling this request is not allowed');
        continue;
      }
      if (process.env.MRT_DEBUG_RULES) {
        process.stderr.write('RULES-DEBUG move ' + JSON.stringify({ id: r.id, from: ch.old.status, to: r.status, return_to: ch.old.return_to }) + '\n');
      }
      if (!allowedAction(D, ch.old, r, doc, writer, now)) {
        const known = Object.keys(D.TRANSITIONS).some((a) => {
          const t = D.TRANSITIONS[a];
          if (t.from.indexOf(ch.old.status) === -1) return false;
          if (t.to) return t.to === r.status;
          return r.status === ch.old.return_to;
        });
        return deny(known ? 'this status move is not allowed' : 'no such status move');
      }
      continue;
    }
    if (!D.canEditSubmitted(writer, ch.old)) {
      const keys = Object.keys(r).filter((k) => !same(r[k], ch.old[k]));
      const takingOver = keys.length === 1 && keys[0] === 'assigned_to' &&
        D.canTake(writer, ch.old, tool);
      if (!takingOver) return deny('editing this request is not allowed');
    }
  }
  return null;
}

function checkTools(D, o, n, writer, admin) {
  const deny = (reason) => ({ code: 'forbidden', reason: reason });
  if (added(o, n).length || removed(o, n).length) {
    if (!admin) return deny('tools need an admin');
    return null;
  }
  for (const ch of changed(o, n)) {
    if (!D.canSetToolStatus(writer, ch.rec) && !admin) return deny('this tool change is not allowed');
  }
  return null;
}

module.exports = { loadDomain, checkWrite };
