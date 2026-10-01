/**
 * tests/server-harness.js - dev only, required by server tests, never shipped.
 *
 * An in-process server: the real request handler (server/server.js) against
 * a throwaway SQLite file and data dir under the OS temp dir - never the
 * repo. Socket binding is forbidden in some sandboxes, so tests drive the
 * handler directly: call() for raw access, fetch() as a fetch-shaped
 * dispatcher for code (like the API adapter) that only knows fetch.
 */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const ROOT = path.join(__dirname, '..');
const { openDb } = require('../server/db');
const { handleRequest } = require('../server/server');

function fakeRes() {
  return { status: 0, headers: {}, chunks: [],
    writeHead: function (code, headers) { this.status = code; this.headers = headers || {}; },
    end: function (body) { if (body !== null && body !== undefined) this.chunks.push(Buffer.from(body)); },
    body: function () { return Buffer.concat(this.chunks).toString('utf8'); } };
}

function fakeReq(method, url, body, headers) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = headers || {};
  process.nextTick(() => {
    if (body !== undefined) req.emit('data', Buffer.from(String(body)));
    req.emit('end');
  });
  return req;
}

function withServer() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mrt-srv-'));
  const dataDir = path.join(dir, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const db = openDb(path.join(dir, 'test.sqlite3'));

  async function call(method, url, body, headers) {
    const res = fakeRes();
    await handleRequest(ROOT, db, dataDir, fakeReq(method, url, body, headers), res);
    return res;
  }

  /** fetch-shaped: fetch(url, {method, headers, body}) -> {ok, status, json(), text()}. */
  async function fetchShim(url, opts) {
    const o = opts || {};
    const u = new URL(String(url), 'http://localhost');
    const headers = {};
    Object.keys(o.headers || {}).forEach((k) => { headers[String(k).toLowerCase()] = o.headers[k]; });
    const res = await call(o.method || 'GET', u.pathname + u.search, o.body, headers);
    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      headers: { get: (k) => res.headers[k] || res.headers[String(k).toLowerCase()] || null },
      text: async () => res.body(),
      json: async () => JSON.parse(res.body())
    };
  }

  function close() {
    try { db.close(); } catch (e) { /* already closed */ }
    fs.rmSync(dir, { recursive: true, force: true });
  }

  return { dir, dataDir, call, fetch: fetchShim, close };
}

module.exports = { withServer };
