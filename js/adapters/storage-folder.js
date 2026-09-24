/**
 * Metrology Request Tracker - adapters/storage-folder.js
 *
 * Storage adapter for today: a folder the person picks (data\ next to
 * index.html), through the File System Access API (Edge/Chrome). The folder
 * handle is kept in IndexedDB so later visits need one click.
 *
 * Every storage adapter has the same interface, all Promise-based, so the
 * store can swap this one for a server API later without other changes:
 *
 *   id                      'folder'
 *   isSupported()           true when this browser can use it
 *   unsupportedMessage()    what to tell the person otherwise
 *   hasSaved()              -> bool   a connection is remembered
 *   connect()               -> void   first use (asks the person)
 *   reconnect({silent})     -> bool   later visits (false = ask again). silent:
 *                                     never prompt - a browser prompt needs a click
 *   savedLabel()            -> name of the remembered connection, or null
 *   label()                 name to show (the folder name)
 *   read(path)              -> text | null (null = no such file)
 *   write(path, text)       -> void
 *   list(dir)               -> [{name, size}]  files in a sub-folder
 *   remove(path)            -> void
 *
 * Paths are relative, '/'-separated: 'mrt_data.json', 'backups/x.json'.
 * Only the store calls this module.
 */
window.MRT = window.MRT || {};
window.MRT.adapters = window.MRT.adapters || {};
window.MRT.adapters.storageFolder = (function () {
  'use strict';

  var cfg = window.MRT.config;
  var IDB_STORE = 'handles';
  var IDB_KEY = 'data-folder';
  var dir = null;   // FileSystemDirectoryHandle once connected

  function isSupported() { return typeof window.showDirectoryPicker === 'function'; }

  function unsupportedMessage() {
    return 'This app needs the File System Access API. Please open it in Microsoft Edge or Google Chrome.';
  }

  /* --- IndexedDB: remember the folder handle ------------------------ */

  function idb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(cfg.idb_name, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(IDB_STORE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function idbPut(value) {
    return idb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(value, IDB_KEY);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function idbGet() {
    return idb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, 'readonly');
        var req = tx.objectStore(IDB_STORE).get(IDB_KEY);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  /* --- Connecting --------------------------------------------------- */

  function hasSaved() {
    return idbGet().then(function (h) { return !!h; }).catch(function () { return false; });
  }

  function connect() {
    return window.showDirectoryPicker({ id: 'mrt-data', mode: 'readwrite' }).then(function (handle) {
      dir = handle;
      return idbPut(handle).catch(function () { /* still usable this session */ });
    });
  }

  function reconnect(o) {
    var silent = !!(o && o.silent);
    return idbGet().then(function (handle) {
      if (!handle) return false;
      return handle.queryPermission({ mode: 'readwrite' }).then(function (perm) {
        if (perm === 'granted' || silent) return perm;
        return handle.requestPermission({ mode: 'readwrite' });   // needs a click
      }).then(function (perm) {
        if (perm !== 'granted') return false;
        dir = handle;
        return true;
      });
    });
  }

  function savedLabel() {
    return idbGet().then(function (h) { return h && h.name ? h.name : null; }).catch(function () { return null; });
  }

  function label() { return dir && dir.name ? dir.name : null; }

  /* --- Files -------------------------------------------------------- */

  function need() {
    if (!dir) throw new Error('No data folder is connected');
    return dir;
  }

  /** Resolve 'a/b/file.json' to [folder handle, 'file.json']. */
  function locate(path, create) {
    var parts = String(path).split('/').filter(Boolean);
    var name = parts.pop();
    var p = Promise.resolve(need());
    parts.forEach(function (sub) {
      p = p.then(function (d) { return d.getDirectoryHandle(sub, { create: !!create }); });
    });
    return p.then(function (d) { return [d, name]; });
  }

  function read(path) {
    return locate(path, false)
      .then(function (loc) { return loc[0].getFileHandle(loc[1]); })
      .then(function (fh) { return fh.getFile(); })
      .then(function (file) { return file.text(); })
      .catch(function (e) {
        if (e && (e.name === 'NotFoundError' || e.name === 'TypeMismatchError')) return null;
        throw e;
      });
  }

  function write(path, text) {
    return locate(path, true)
      .then(function (loc) { return loc[0].getFileHandle(loc[1], { create: true }); })
      .then(function (fh) { return fh.createWritable(); })
      .then(function (w) { return w.write(text).then(function () { return w.close(); }); });
  }

  function list(sub) {
    return need().getDirectoryHandle(sub, { create: true }).then(function (d) {
      return (async function () {
        var out = [];
        for await (var entry of d.values()) {
          if (entry.kind !== 'file') continue;
          var file = await entry.getFile();
          out.push({ name: entry.name, size: file.size });
        }
        return out;
      })();
    });
  }

  function remove(path) {
    return locate(path, false).then(function (loc) { return loc[0].removeEntry(loc[1]); });
  }

  return {
    id: 'folder',
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
