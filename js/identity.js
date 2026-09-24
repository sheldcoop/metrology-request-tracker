/**
 * Metrology Request Tracker - identity.js
 *
 * WHO is at the keyboard comes from ONE function: MRT.identity.detect()
 * (CLAUDE.md "Identity"). Nothing else in the app reads ?who=, %USERNAME%
 * or a login token.
 *
 * Today: the launcher "Metrology Tool.cmd" opens
 *   index.html?who=<DOMAIN>%5C<username>
 * detect() reads it, remembers it on this PC and takes it out of the
 * address bar. Opened without the launcher, the remembered ID is used; if
 * there is none, the app asks for the Windows user name once.
 * Later: detect() reads the company SSO (Windows / Entra ID) instead, and
 * returns the same shape. Screens do not change.
 *
 *   detect()  -> {windows_id, domain, email, source} | null
 *                source: 'launcher' | 'remembered' | 'typed' (| 'sso' later)
 *   useTyped(text) -> the same shape, remembered, or null if not a login name
 *   forget()       "Change user": the next detect() finds nobody
 *
 * Soft identity: anyone could type another ?who=. That is accepted for a
 * small team (DECISIONS M1-3); admin actions also need the PIN.
 */
window.MRT = window.MRT || {};
window.MRT.identity = (function () {
  'use strict';

  var D = window.MRT.domain;
  var KEY = window.MRT.config.local_prefix + 'identity';

  function remember(ident) {
    try { localStorage.setItem(KEY, JSON.stringify({ windows_id: ident.windows_id, domain: ident.domain })); }
    catch (e) { /* private mode: works for this visit only */ }
  }

  function remembered() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || 'null');
      return o && D.isWindowsId(o.windows_id) ? o : null;
    } catch (e) { return null; }
  }

  function shape(ident, source) {
    return { windows_id: ident.windows_id, domain: ident.domain || null, email: null, source: source };
  }

  /** Take ?who= out of the address bar, so a copied link never carries it. */
  function stripFromAddress() {
    try {
      var params = new URLSearchParams(location.search);
      if (!params.has('who')) return;
      params.delete('who');
      var q = params.toString();
      history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
    } catch (e) { /* some browsers refuse replaceState on file:// - harmless */ }
  }

  function detect() {
    var who = null;
    try { who = new URLSearchParams(location.search).get('who'); } catch (e) { /* no URL API */ }
    if (who !== null) {
      stripFromAddress();
      var fromLauncher = D.parseWindowsLogin(who);
      if (fromLauncher) { remember(fromLauncher); return shape(fromLauncher, 'launcher'); }
      console.warn('MRT: the launcher passed an unusable user name:', who);
    }
    var r = remembered();
    return r ? shape(r, 'remembered') : null;
  }

  function useTyped(text) {
    var ident = D.parseWindowsLogin(text);
    if (!ident) return null;
    remember(ident);
    return shape(ident, 'typed');
  }

  function forget() {
    try { localStorage.removeItem(KEY); } catch (e) { /* private mode */ }
  }

  return { detect: detect, useTyped: useTyped, forget: forget };
})();
