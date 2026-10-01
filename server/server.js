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

/** The request handler, exported so tests can drive it without a socket. */
async function handleRequest(root, db, req, res) {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname === '/api/health' && req.method === 'GET') {
      return send(res, 200, 'application/json; charset=utf-8', health(db));
    }
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

function createServer(root, db) {
  return http.createServer((req, res) => { handleRequest(root, db, req, res); });
}

module.exports = { createServer, handleRequest };
