'use strict';
/**
 * Metrology Request Tracker - server/server.js (Node only, never in the browser).
 *
 * Tiny static + API server on built-in node:http (no dependencies, no framework).
 * Serves the vanilla front end from the repo root - served pages have a real
 * origin, which removes the file:// CORS problem - and answers /api/health.
 * The Stage A document API arrives in Phase 2; unknown /api/* paths are 404.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { journalMode, sqliteVersion } = require('./db');
const { initDoc, getDoc, putDoc } = require('./doc-store');

/** Request bodies are small JSON docs; refuse anything absurd. */
const MAX_BODY = 25 * 1024 * 1024;

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function readJson(req, res) {
  return readBody(req).then((text) => {
    try { return JSON.parse(text); }
    catch (e) { send(res, 400, 'application/json; charset=utf-8', JSON.stringify({ ok: false, code: 'bad_json' })); return null; }
  });
}

/** Keep file paths inside the data dir: relative, no escapes. */
function dataFile(dataDir, p) {
  if (typeof p !== 'string' || !p || p.indexOf('\0') >= 0) return null;
  const file = path.normalize(path.join(dataDir, p));
  if (file !== dataDir && !file.startsWith(dataDir + path.sep)) return null;
  if (path.basename(file).startsWith('.')) return null;
  return file;
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function health(db) {
  return JSON.stringify({ ok: true, journal_mode: journalMode(db), sqlite: sqliteVersion(db) });
}

/** Map a request path to a file under root; null means forbidden or missing. */
async function staticFile(root, urlPath) {
  const rel = urlPath === '/' ? '/index.html' : urlPath.split('?')[0].split('#')[0];
  const file = path.normalize(path.join(root, decodeURIComponent(rel)));
  if (file !== root && !file.startsWith(root + path.sep)) return null;
  try {
    const st = await fs.stat(file);
    if (!st.isFile()) return null;
    return file;
  } catch (e) { return null; }
}

/** File endpoints: everything that is not the live document (backups, prev copies). */
async function handleFiles(dataDir, url, req, res) {
  const fsp = require('node:fs/promises');
  if (url.searchParams.has('dir')) {
    const dir = dataFile(dataDir, url.searchParams.get('dir'));
    if (!dir) return send(res, 400, 'application/json; charset=utf-8', JSON.stringify({ ok: false, code: 'bad_path' }));
    let entries = [];
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch (e) { entries = []; }
    const out = [];
    for (const en of entries) {
      if (!en.isFile() || en.name.startsWith('.')) continue;
      let size = 0;
      try { size = (await fsp.stat(path.join(dir, en.name))).size; } catch (e) { continue; }
      out.push({ name: en.name, size: size });
    }
    return send(res, 200, 'application/json; charset=utf-8', JSON.stringify(out));
  }
  const file = dataFile(dataDir, url.searchParams.get('path'));
  if (!file) return send(res, 400, 'application/json; charset=utf-8', JSON.stringify({ ok: false, code: 'bad_path' }));
  if (req.method === 'GET') {
    try {
      const body = await fsp.readFile(file, 'utf8');
      return send(res, 200, 'text/plain; charset=utf-8', body);
    } catch (e) {
      return send(res, 404, 'application/json; charset=utf-8', JSON.stringify({ ok: false, code: 'not_found' }));
    }
  }
  if (req.method === 'PUT') {
    const parsed = await readJson(req, res);
    if (!parsed) return;
    if (typeof parsed.text !== 'string') {
      return send(res, 400, 'application/json; charset=utf-8', JSON.stringify({ ok: false, code: 'bad_json' }));
    }
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.writeFile(file, parsed.text, 'utf8');
    return send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ ok: true }));
  }
  if (req.method === 'DELETE') {
    try { await fsp.unlink(file); } catch (e) { /* missing is fine */ }
    return send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ ok: true }));
  }
  return send(res, 405, 'text/plain', 'Method not allowed');
}

/** The request handler, exported so tests can drive it without a socket. */
async function handleRequest(root, db, dataDir, req, res) {
  try {
    initDoc(db);
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname === '/api/health' && req.method === 'GET') {
      return send(res, 200, 'application/json; charset=utf-8', health(db));
    }
    if (url.pathname === '/api/doc' && req.method === 'GET') {
      const row = getDoc(db);
      if (!row) return send(res, 404, 'application/json; charset=utf-8', JSON.stringify({ ok: false, code: 'empty' }));
      return send(res, 200, 'application/json; charset=utf-8',
        JSON.stringify({ ok: true, revision: row.revision, saved_by: row.saved_by, saved_ts: row.saved_ts, doc: row.body }));
    }
    if (url.pathname === '/api/doc' && req.method === 'PUT') {
      const parsed = await readJson(req, res);
      if (!parsed) return;
      const r = putDoc(db, parsed.expected_revision, parsed.doc, parsed.saved_by);
      if (r.code) return send(res, 400, 'application/json; charset=utf-8', JSON.stringify({ ok: false, code: r.code }));
      if (r.conflict) {
        return send(res, 409, 'application/json; charset=utf-8', JSON.stringify({ ok: false, code: 'revision_conflict',
          revision: r.current.revision, saved_by: r.current.saved_by, saved_ts: r.current.saved_ts }));
      }
      return send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ ok: true, revision: r.revision }));
    }
    if (url.pathname === '/api/files') return handleFiles(dataDir, url, req, res);
    if (url.pathname.startsWith('/api/')) {
      return send(res, 404, 'application/json; charset=utf-8', JSON.stringify({ ok: false, code: 'not_found' }));
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'text/plain', 'Method not allowed');
    const file = await staticFile(root, url.pathname);
    if (!file) return send(res, 404, 'text/plain', 'Not found');
    const body = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': body.length });
    res.end(req.method === 'HEAD' ? null : body);
  } catch (e) {
    send(res, 500, 'text/plain', 'Server error');
  }
}

function createServer(root, db, dataDir) {
  return http.createServer((req, res) => { handleRequest(root, db, dataDir, req, res); });
}

module.exports = { createServer, handleRequest };
