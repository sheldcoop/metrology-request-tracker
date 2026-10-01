/**
 * Metrology Request Tracker - adapters/storage-api.js
 *
 * Storage adapter for the server move: the same 12-method interface as
 * storage-folder.js, over HTTP instead of the File System Access API.
 * The live document (config.data_file) maps to GET/PUT /api/doc with the
 * server refusing stale revisions; every other path (backups/, prev
 * copies) maps to /api/files. Only the store calls this module.
 *
 *   id                      'api'
 *   isSupported()           true when fetch() exists
 *   unsupportedMessage()    what to tell the person otherwise
 *   hasSaved()              -> bool   always true: the server address is fixed
 *   connect()               -> void   first use (checks /api/health)
 *   reconnect({silent})     -> bool   always true (nothing to remember)
 *   savedLabel()            -> name of the connection
 *   label()                 name to show
 *   read(path)              -> text | null (null = no such file)
 *   write(path, text)       -> void (409 on a stale document revision)
 *   list(dir)               -> [{name, size}]  files in a sub-folder
 *   remove(path)            -> void
 */
window.MRT = window.MRT || {};
window.MRT.adapters = window.MRT.adapters || {};
window.MRT.adapters.storageApi = (function () {
  'use strict';

  var cfg = window.MRT.config;

  function base() {
    var b = (cfg.api_base || '').replace(/\/+$/, '');
    return b;
  }

  function isSupported() { return typeof fetch === 'function'; }

  function unsupportedMessage() {
    return 'This app needs a browser with fetch() to reach the server. Please use a current Chrome or Edge.';
  }

  function hasSaved() { return Promise.resolve(true); }

  function connect() {
    return fetch(base() + '/api/health', { headers: { Accept: 'application/json' } }).then(function (r) {
      if (!r.ok) throw new Error('The server did not answer (status ' + r.status + ')');
      return;
    });
  }

  function reconnect() { return Promise.resolve(true); }

  function savedLabel() { return Promise.resolve(base() || 'this server'); }

  function label() { return base() || 'this server'; }

  function isDoc(path) { return String(path) === cfg.data_file; }

  function read(path) {
    if (isDoc(path)) {
      return fetch(base() + '/api/doc', { headers: { Accept: 'application/json' } }).then(function (r) {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error('The server did not answer (status ' + r.status + ')');
        return r.json();
      }).then(function (o) {
        return !o || o.code === 'empty' ? null : o.doc;
      });
    }
    return fetch(base() + '/api/files?path=' + encodeURIComponent(path)).then(function (r) {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('The server did not answer (status ' + r.status + ')');
      return r.text();
    });
  }

  /** A 409 carries the same fields the store's own conflict error has. */
  function conflictError(c) {
    var e = new Error('Someone else saved (revision ' + c.revision + '). Reload?');
    e.code = 'revision_conflict';
    e.detail = { saved_by: c.saved_by || null, saved_ts: c.saved_ts || null, revision: c.revision };
    return e;
  }

  function write(path, text) {
    if (isDoc(path)) {
      var revision = null, doc = null;
      try {
        doc = JSON.parse(String(text));
        if (doc && typeof doc.revision === 'number') revision = doc.revision;
      } catch (e) { return Promise.reject(new Error('Not a data document')); }
      if (revision === null) return Promise.reject(new Error('Not a data document'));
      return fetch(base() + '/api/doc', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ expected_revision: revision - 1, doc: doc, saved_by: doc.saved_by || null })
      }).then(function (r) {
        if (r.status === 409) {
          return r.json().then(function (c) { throw conflictError(c); });
        }
        if (!r.ok) throw new Error('The server did not save (status ' + r.status + ')');
      });
    }
    return fetch(base() + '/api/files?path=' + encodeURIComponent(path), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ text: String(text) })
    }).then(function (r) {
      if (!r.ok) throw new Error('The server did not save (status ' + r.status + ')');
    });
  }

  function list(dir) {
    return fetch(base() + '/api/files?dir=' + encodeURIComponent(dir), { headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('The server did not answer (status ' + r.status + ')');
        return r.json();
      });
  }

  function remove(path) {
    return fetch(base() + '/api/files?path=' + encodeURIComponent(path), { method: 'DELETE' })
      .then(function (r) {
        if (!r.ok) throw new Error('The server did not answer (status ' + r.status + ')');
      });
  }

  return {
    id: 'api',
    isSupported: isSupported,
    unsupportedMessage: unsupportedMessage,
    hasSaved: hasSaved,
    connect: connect,
    reconnect: reconnect,
    savedLabel: savedLabel,
    label: label,
    read: read,
    write: write,
    list: list,
    remove: remove
  };
})();
