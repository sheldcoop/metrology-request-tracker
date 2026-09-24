/**
 * tests/memory-storage.js - dev only.
 *
 * A storage adapter that keeps "files" in an object, with the same
 * interface as js/adapters/storage-folder.js. The tests run the real store
 * against it; tests/preview.html will use it too. No production code
 * loads this file.
 *
 *   var a = MRT.adapters.storageMemory({ 'mrt_data.json': '...' });
 *   a.files        the files, to look at or change behind the store's back
 *   a.failWrites   set true to make every write fail (a read-only share)
 */
window.MRT = window.MRT || {};
window.MRT.adapters = window.MRT.adapters || {};
window.MRT.adapters.storageMemory = function (initial) {
  'use strict';
  var files = initial || {};
  var adapter = {
    id: 'memory',
    files: files,
    failWrites: false,
    isSupported: function () { return true; },
    unsupportedMessage: function () { return ''; },
    hasSaved: function () { return Promise.resolve(true); },
    connect: function () { return Promise.resolve(); },
    reconnect: function () { return Promise.resolve(true); },
    savedLabel: function () { return Promise.resolve('memory'); },
    label: function () { return 'memory'; },
    read: function (path) {
      return Promise.resolve(Object.prototype.hasOwnProperty.call(files, path) ? files[path] : null);
    },
    write: function (path, text) {
      if (adapter.failWrites) return Promise.reject(new Error('The share is read-only (test)'));
      files[path] = String(text);
      return Promise.resolve();
    },
    list: function (dir) {
      var prefix = dir + '/';
      return Promise.resolve(Object.keys(files).filter(function (k) {
        return k.indexOf(prefix) === 0 && k.slice(prefix.length).indexOf('/') === -1;
      }).map(function (k) { return { name: k.slice(prefix.length), size: files[k].length }; }));
    },
    remove: function (path) { delete files[path]; return Promise.resolve(); }
  };
  return adapter;
};
