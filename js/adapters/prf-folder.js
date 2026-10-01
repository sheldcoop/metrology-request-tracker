/**
 * Metrology Request Tracker - adapters/prf-folder.js
 *
 * File access for the PRF data tool (DECISIONS PRF-1..PRF-7), the same
 * pattern as adapters/storage-folder.js: File System Access API, a handle
 * remembered in IndexedDB, one click to reconnect. Two SEPARATE handles -
 * "PRF root" (read, where the log folders live) and "PRF output" (write,
 * where the Excel is saved) - in their own IndexedDB database
 * (config.prf.idb_name), never the app's data folder.
 *
 * Interface (both root and output share the read/connect shape; root is
 * read-only, output is read/write so an existing report can be checked):
 *   isSupported()                    true when this browser can use it
 *   unsupportedMessage()
 *   hasSavedRoot() / hasSavedOutput()        -> bool, a connection is remembered
 *   connectRoot() / connectOutput()          -> void (asks the person)
 *   reconnectRoot({silent}) / reconnectOutput({silent})  -> bool
 *   savedRootLabel() / savedOutputLabel()    -> remembered folder name, or null
 *   rootLabel() / outputLabel()              -> name to show this session
 *   scanRoot(logFolderName)        -> {entries: [{rel, ref, dir}], problems: []}
 *                                      one entry per 'log' folder found, dir =
 *                                      its FileSystemDirectoryHandle (not opened
 *                                      further here - js/prf.js reads prf
 *                                      data purely from {rel, ref}; the view
 *                                      reads files from dir).
 *   listFiles(dir, ending)          -> [{name, handle}] sorted by name
 *   readFile(handle)                -> text (utf-8, bad bytes dropped happens
 *                                      in prf.textToLines, not here)
 *   writeOutput(name, blobOrText)   -> void, written to the output folder
 *   outputExists(name)              -> bool
 *
 * Only js/views/prf.js calls this module.
 */
window.MRT = window.MRT || {};
window.MRT.adapters = window.MRT.adapters || {};
window.MRT.adapters.prfFolder = (function () {
  'use strict';

  var pcfg = window.MRT.config.prf;
  var IDB_STORE = 'handles';
  var ROOT_KEY = 'root', OUTPUT_KEY = 'output';
  var rootDir = null, outputDir = null;

  function isSupported() { return typeof window.showDirectoryPicker === 'function'; }

  function unsupportedMessage() {
    return 'This tool needs the File System Access API. Please open it in Microsoft Edge or Google Chrome.';
  }

  /* --- IndexedDB: remember the two folder handles ---------------------- */

  function idb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(pcfg.idb_name, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(IDB_STORE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function idbPut(key, value) {
    return idb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(value, key);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function idbGet(key) {
    return idb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, 'readonly');
        var req = tx.objectStore(IDB_STORE).get(key);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  /** One of (root, output): the shared connect/reconnect/label shape. */
  function makeSide(key, mode, setDir, getDir) {
    function hasSaved() { return idbGet(key).then(function (h) { return !!h; }).catch(function () { return false; }); }
    function connect() {
      return window.showDirectoryPicker({ id: 'mrt-prf-' + key, mode: mode }).then(function (handle) {
        setDir(handle);
        return idbPut(key, handle).catch(function () { /* still usable this session */ });
      });
    }
    function reconnect(o) {
      var silent = !!(o && o.silent);
      return idbGet(key).then(function (handle) {
        if (!handle) return false;
        return handle.queryPermission({ mode: mode }).then(function (perm) {
          if (perm === 'granted' || silent) return perm;
          return handle.requestPermission({ mode: mode });   // needs a click
        }).then(function (perm) {
          if (perm !== 'granted') return false;
          setDir(handle);
          return true;
        });
      });
    }
    function savedLabel() { return idbGet(key).then(function (h) { return h && h.name ? h.name : null; }).catch(function () { return null; }); }
    function label() { var d = getDir(); return d && d.name ? d.name : null; }
    return { hasSaved: hasSaved, connect: connect, reconnect: reconnect, savedLabel: savedLabel, label: label };
  }

  var root = makeSide(ROOT_KEY, 'read', function (d) { rootDir = d; }, function () { return rootDir; });
  var output = makeSide(OUTPUT_KEY, 'readwrite', function (d) { outputDir = d; }, function () { return outputDir; });

  /* --- scanning the root for log folders -------------------------------- */

  function isLogName(name, logFolderName) { return String(name).trim().toLowerCase() === logFolderName.toLowerCase(); }

  /**
   * Walk the root, find every folder named logFolderName (default 'log'),
   * without entering it (py index_log_folders: "do not go inside log").
   * -> {entries: [{rel: [folder names root..parent], ref: display path, dir: handle}], problems}
   * problems collects nothing here (js/prf.indexLogs does the path checks);
   * this only reports a folder it could not read.
   */
  function scanRoot(logFolderName) {
    if (!rootDir) return Promise.reject(new Error('No PRF root folder is connected'));
    var name = logFolderName || pcfg.log_folder_name;
    var entries = [], problems = [];

    function walk(dir, rel) {
      return (async function () {
        var subs = [];
        for await (var [childName, handle] of dir.entries()) {
          if (handle.kind === 'directory') subs.push({ name: childName, handle: handle });
        }
        var log = subs.filter(function (s) { return isLogName(s.name, name); });
        if (log.length) {
          entries.push({ rel: rel.slice(), ref: (rel.length ? rel.join('/') + '/' : '') + log[0].name, dir: log[0].handle });
        }
        var rest = subs.filter(function (s) { return !isLogName(s.name, name); });
        for (var i = 0; i < rest.length; i++) {
          try {
            await walk(rest[i].handle, rel.concat([rest[i].name]));
          } catch (e) {
            problems.push('Could not read folder, skipped: ' + rel.concat([rest[i].name]).join('/') + ' (' + e.message + ')');
          }
        }
      })();
    }

    return walk(rootDir, []).then(function () { return { entries: entries, problems: problems }; });
  }

  /** Files directly in dir whose name ends with ending (case-insensitive), sorted by name. */
  function listFiles(dir, ending) {
    return (async function () {
      var out = [];
      for await (var [name, handle] of dir.entries()) {
        if (handle.kind === 'file' && name.toLowerCase().endsWith(String(ending).toLowerCase())) out.push({ name: name, handle: handle });
      }
      out.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
      return out;
    })();
  }

  function readFile(handle) {
    return handle.getFile().then(function (file) { return file.text(); });
  }

  /** Resolve 'a/b/file.ext' under the output folder, creating sub-folders. */
  function locateOutput(path, create) {
    if (!outputDir) throw new Error('No PRF output folder is connected');
    var parts = String(path).split('/').filter(Boolean);
    var name = parts.pop();
    var p = Promise.resolve(outputDir);
    parts.forEach(function (sub) {
      p = p.then(function (d) { return d.getDirectoryHandle(sub, { create: !!create }); });
    });
    return p.then(function (d) { return [d, name]; });
  }

  function writeOutput(name, blobOrText) {
    return locateOutput(name, true)
      .then(function (loc) { return loc[0].getFileHandle(loc[1], { create: true }); })
      .then(function (fh) { return fh.createWritable(); })
      .then(function (w) { return w.write(blobOrText).then(function () { return w.close(); }); });
  }

  function outputExists(name) {
    return locateOutput(name, false)
      .then(function (loc) { return loc[0].getFileHandle(loc[1]); })
      .then(function () { return true; })
      .catch(function () { return false; });
  }

  return {
    isSupported: isSupported,
    unsupportedMessage: unsupportedMessage,
    hasSavedRoot: root.hasSaved, connectRoot: root.connect, reconnectRoot: root.reconnect,
    savedRootLabel: root.savedLabel, rootLabel: root.label,
    hasSavedOutput: output.hasSaved, connectOutput: output.connect, reconnectOutput: output.reconnect,
    savedOutputLabel: output.savedLabel, outputLabel: output.label,
    scanRoot: scanRoot, listFiles: listFiles, readFile: readFile,
    writeOutput: writeOutput, outputExists: outputExists
  };
})();
