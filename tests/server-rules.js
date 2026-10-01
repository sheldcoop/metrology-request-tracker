/**
 * tests/server-rules.js - dev only:  node tests/server-rules.js
 *
 * Server-side rule checks over the in-process harness: the unchanged
 * js/domain.js re-checks every write. Unknown writers, forged requests,
 * illegal status jumps, history rewrites and non-admin meddling are
 * refused; legitimate engineer/QE/admin writes land. /api/me never leaks
 * more than id, name, roles and login names. Exits 1 on any failure.
 */
'use strict';
const { withServer } = require('./server-harness');

let failures = 0, passed = 0;
function check(name, cond, detail) {
  if (cond) passed++;
  else { failures++; console.log('FAIL', name, detail !== undefined ? '-> ' + detail : ''); }
}

function users() {
  return [
    { id: 'u_admin', name: 'Admin', roles: ['admin'], active: true },
    { id: 'u_eng', name: 'Eng', roles: ['engineer'], active: true },
    { id: 'u_qe', name: 'Qe', roles: ['quality'], active: true },
    { id: 'u_op', name: 'Op', roles: ['operator'], active: true }
  ];
}

function base() {
  return { schema_version: 14, revision: 1, users: users(),
    tools: [{ id: 't1', code: 'HRM', primary_operator_id: 'u_qe', backup_operator_id: null }],
    requests: [{ id: 'r1', tool_id: 't1', status: 'submitted', requester_id: 'u_eng', assigned_to: null }],
    audit_log: [{ id: 'a1' }], request_events: [],
    settings: [], measurement_types: [], tool_fields: [], bkms: [], projects: [], part_numbers: [],
    buildups: [], process_steps: [], hold_reasons: [], priorities: [], holidays: [], lot_fields: [],
    magazines: [], panel_locations: [], destinations: [], lots: [], templates: [] };
}

async function setup(modify) {
  const srv = withServer();
  const d = base();
  if (modify) modify(d);
  const r = await srv.fetch('/api/doc', { method: 'PUT', body: JSON.stringify({ expected_revision: 0, doc: d }) });
  if (r.status !== 200) throw new Error('setup failed: ' + r.status + ' ' + await r.text());
  return srv;
}

async function current(srv) {
  const r = await srv.fetch('/api/doc');
  return JSON.parse((await r.json()).doc);
}

async function putAs(srv, userId, d) {
  const headers = userId ? { 'X-MRT-User': userId } : {};
  const r = await srv.fetch('/api/doc', { method: 'PUT', headers: headers,
    body: JSON.stringify({ expected_revision: d.revision - 1, doc: d }) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

function withRev(d, revision) { d.revision = revision; return d; }

(async function run() {
  // Unknown and missing writers.
  let srv = await setup();
  let r = await putAs(srv, null, withRev(base(), 2));
  check('no header is 401', r.status === 401 && r.body.code === 'unknown_user', r.status);
  r = await putAs(srv, 'ghost', withRev(base(), 2));
  check('unknown user is 403', r.status === 403 && r.body.code === 'unknown_user', r.status);
  srv.close();

  // /api/me.
  srv = await setup();
  const me = await (await srv.fetch('/api/me', { headers: { 'X-MRT-User': 'u_eng' } })).json();
  check('me returns the engineer', me.ok === true && me.me.id === 'u_eng' && me.me.roles.join() === 'engineer', JSON.stringify(me));
  check('...and nothing else', Object.keys(me.me).sort().join() === 'active,domain,email,id,name,roles,windows_id', Object.keys(me.me).join());
  const anon = await srv.fetch('/api/me');
  check('me without a header is 401', anon.status === 401);
  srv.close();

  // Forged requests.
  srv = await setup();
  let d = base();
  d.requests.push({ id: 'r2', tool_id: 't1', status: 'draft', requester_id: 'u_qe', assigned_to: null });
  r = await putAs(srv, 'u_eng', withRev(d, 2));
  check('filing for someone else is refused', r.status === 403, r.status);
  d = base();
  d.requests.push({ id: 'r2', tool_id: 't1', status: 'draft', requester_id: 'u_eng', assigned_to: null });
  r = await putAs(srv, 'u_eng', withRev(d, 2));
  check('filing for yourself lands', r.status === 200, r.status + ' ' + JSON.stringify(r.body));
  srv.close();

  // Status moves.
  srv = await setup();
  d = base(); d.requests[0].status = 'completed';
  r = await putAs(srv, 'u_eng', withRev(d, 2));
  check('submitted straight to completed is refused', r.status === 403, r.status);
  d = base(); d.requests[0].status = 'accepted';
  r = await putAs(srv, 'u_eng', withRev(d, 2));
  check('an engineer cannot accept (not the measurer)', r.status === 403, r.status);
  d = base(); d.requests[0].status = 'accepted';
  r = await putAs(srv, 'u_qe', withRev(d, 2));
  check('the tool QE accepts', r.status === 200, r.status + ' ' + JSON.stringify(r.body));
  srv.close();

  // request_events: appends land, standalone rewrites are refused.
  srv = await setup();
  d = await current(srv);
  d.request_events.push({ id: 'e1', request_id: 'r1' });
  r = await putAs(srv, 'u_qe', withRev(d, 2));
  check('appending events lands', r.status === 200, r.status);
  d = await current(srv);
  d.request_events = [{ id: 'forged' }];
  r = await putAs(srv, 'u_eng', withRev(d, 3));
  check('standalone event rewrite is refused', r.status === 403, r.status);
  d = await current(srv);
  d.request_events = [{ id: 'restored' }];
  d.audit_log.push({ id: 'a8', entity: 'file', action: 'restore' });
  r = await putAs(srv, 'u_admin', withRev(d, 3));
  check('admin wholesale (restore shape) lands', r.status === 200, r.status);
  srv.close();

  // Undo shape: everything back, audit plus one trailing undo entry.
  srv = await setup();
  d = await current(srv);
  d.requests[0].status = 'accepted'; d.request_events = [];
  d.audit_log.push({ id: 'a9', entity: 'undo', action: 'undo' });
  r = await putAs(srv, 'u_qe', withRev(d, 2));
  check('undo-shaped revert lands', r.status === 200, r.status + ' ' + JSON.stringify(r.body));
  d = await current(srv);
  d.requests[0].status = 'in_progress';
  d.audit_log.push({ id: 'a10', entity: 'undo', action: 'undo' });
  r = await putAs(srv, 'u_eng', withRev(d, 3));
  check('...even a jump no action allows (undo of cancel et al)', r.status === 200, r.status);
  srv.close();

  // History and settings (each step builds on the live document).
  srv = await setup();
  d = await current(srv); d.audit_log = [];
  r = await putAs(srv, 'u_eng', withRev(d, 2));
  check('rewriting history is refused', r.status === 403, r.status);
  d = await current(srv); d.audit_log.push({ id: 'a2' });
  r = await putAs(srv, 'u_eng', withRev(d, 2));
  check('appending history lands', r.status === 200, r.status);
  d = await current(srv); d.users.push({ id: 'u_x', name: 'X', roles: ['engineer'], active: true });
  r = await putAs(srv, 'u_eng', withRev(d, 3));
  check('an engineer cannot add users', r.status === 403, r.status);
  r = await putAs(srv, 'u_admin', withRev(d, 3));
  check('an admin can', r.status === 200, r.status);
  d = await current(srv); d.tools[0].status = 'down';
  r = await putAs(srv, 'u_op', withRev(d, 4));
  check('an operator cannot touch tools', r.status === 403, r.status);
  r = await putAs(srv, 'u_qe', withRev(d, 4));
  check("the tool's QE sets its status", r.status === 200, r.status);
  srv.close();

  // Scrap-marking rides on an authorized complete; anything else stays a lot edit.
  srv = await setup((d) => {
    d.lots = [{ id: 'l1', lot_number: '10001', owner_id: 'u_eng', panels: [1, 2], scrapped: [], version: 1 }];
    d.requests = [{ id: 'r1', tool_id: 't1', status: 'in_progress', requester_id: 'u_eng',
      assigned_to: 'u_qe', lot_id: 'l1', panels: [1, 2] }];
  });
  d = await current(srv);
  const rq = d.requests.filter((x) => x.id === 'r1')[0];
  rq.status = 'completed'; rq.panels_outcome = 'scrapped'; rq.results_path = '\\\\srv\\lab\\FIB\\x';
  const lt = d.lots.filter((x) => x.id === 'l1')[0];
  lt.scrapped = [1, 2]; lt.version = 2;
  r = await putAs(srv, 'u_qe', withRev(d, 2));
  check("the QE's complete marks the lot's panels scrapped", r.status === 200, r.status + ' ' + JSON.stringify(r.body));
  srv.close();
  srv = await setup((d) => {
    d.lots = [{ id: 'l1', lot_number: '10001', owner_id: 'u_eng', panels: [1, 2], scrapped: [], version: 1 }];
    d.requests = [{ id: 'r1', tool_id: 't1', status: 'in_progress', requester_id: 'u_eng',
      assigned_to: 'u_qe', lot_id: 'l1', panels: [1, 2] }];
  });
  d = await current(srv);
  d.requests.filter((x) => x.id === 'r1')[0].status = 'completed';
  d.requests.filter((x) => x.id === 'r1')[0].panels_outcome = 'scrapped';
  d.requests.filter((x) => x.id === 'r1')[0].results_path = '\\\\srv\\lab\\FIB\\x';
  d.lots.filter((x) => x.id === 'l1')[0].scrapped = [1, 2, 9];
  d.lots.filter((x) => x.id === 'l1')[0].version = 2;
  r = await putAs(srv, 'u_qe', withRev(d, 2));
  check('...but scrapping a panel the request never had is refused', r.status === 403, r.status);
  d = await current(srv);
  d.requests.filter((x) => x.id === 'r1')[0].status = 'completed';
  d.requests.filter((x) => x.id === 'r1')[0].panels_outcome = 'scrapped';
  d.requests.filter((x) => x.id === 'r1')[0].results_path = '\\\\srv\\lab\\FIB\\x';
  d.lots.filter((x) => x.id === 'l1')[0].scrapped = [1, 2];
  d.lots.filter((x) => x.id === 'l1')[0].version = 2;
  d.lots.filter((x) => x.id === 'l1')[0].lot_number = '99999';
  r = await putAs(srv, 'u_qe', withRev(d, 2));
  check('...and renaming the lot alongside is refused', r.status === 403, r.status);
  d = await current(srv);
  d.lots.filter((x) => x.id === 'l1')[0].lot_number = '99999';
  d.lots.filter((x) => x.id === 'l1')[0].version = 2;
  r = await putAs(srv, 'u_qe', withRev(d, 2));
  check("a QE cannot edit someone else's lot", r.status === 403, r.status);
  srv.close();

  // A wholesale swap signed by a stored admin lands (demo fill / start empty);
  // the same shape from a joiner stays refused.
  srv = await setup();
  d = await current(srv);
  d.users = [{ id: 'u_new_admin', name: 'Prince', roles: ['admin', 'engineer'], active: true, windows_id: 'pk' }];
  d.tools = []; d.requests = []; d.lots = [];
  r = await putAs(srv, 'u_admin', withRev(d, 2));
  check('a swap signed by the stored admin lands', r.status === 200, r.status + ' ' + JSON.stringify(r.body));
  d = await current(srv);
  d.users = [{ id: 'u_forged', name: 'Forged', roles: ['admin'], active: true }];
  r = await putAs(srv, 'u_new_admin', withRev(d, 3));
  check('...and the swapped-in admin keeps working once stored', r.status === 200, r.status);
  srv.close();

  // First setup on an empty database lands wholesale.
  srv = withServer();
  d = base(); d.users = [{ id: 'u_first', name: 'First', roles: ['admin'], active: true }];
  d.settings = [{ key: 'admin_pin_hash', value: 'x' }];
  r = await putAs(srv, 'u_first', withRev(d, 1));
  check('first setup lands', r.status === 200, r.status + ' ' + JSON.stringify(r.body));
  srv.close();

  // Joining, promotion and linking.
  srv = await setup();
  d = await current(srv);
  d.users.push({ id: 'u_new', name: 'New', roles: ['engineer'], active: true, self_added: true });
  r = await putAs(srv, 'u_new', withRev(d, 2));
  check('self-registration as engineer lands', r.status === 200, r.status + ' ' + JSON.stringify(r.body));
  srv.close();
  srv = await setup();
  d = await current(srv);
  d.users.push({ id: 'u_new', name: 'New', roles: ['admin'], active: true });
  r = await putAs(srv, 'u_new', withRev(d, 2));
  check('joining as admin is refused', r.status === 403, r.status);
  d = await current(srv);
  d.users.push({ id: 'u_new', name: 'New', roles: ['engineer', 'quality'], active: true });
  r = await putAs(srv, 'u_new', withRev(d, 2));
  check('joining with extra roles is refused', r.status === 403, r.status);
  d = await current(srv);
  const eng = d.users.filter((u) => u.id === 'u_eng')[0]; eng.windows_id = 'newid'; eng.version = 2;
  r = await putAs(srv, 'u_eng', withRev(d, 2));
  check('linking your own Windows ID lands', r.status === 200, r.status);
  d = await current(srv);
  const eng2 = d.users.filter((u) => u.id === 'u_eng')[0]; eng2.roles = ['engineer', 'admin']; eng2.version = 3;
  r = await putAs(srv, 'u_eng', withRev(d, 3));
  check('promoting yourself is refused', r.status === 403, r.status);
  srv.close();

  console.log(passed + ' passed, ' + failures + ' failed');
  if (failures) process.exitCode = 1;
})().catch(e => { console.log('CRASH', e && e.stack || e); process.exitCode = 1; });
