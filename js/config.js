/**
 * Metrology Request Tracker - config.js
 *
 * Program settings: the things that are fixed per installation, not per
 * person. Everything a person edits lives in Settings (the data file).
 *
 * NEVER put passwords, API keys or tokens here. This file sits on the
 * shared drive where everyone can read it. Secrets belong on a server
 * later (CLAUDE.md "Architecture").
 */
window.MRT = window.MRT || {};
window.MRT.config = Object.freeze({
  app_name: 'Metrology Request Tracker',

  // The data folder is the one the person picks (data\ next to index.html).
  data_file: 'mrt_data.json',
  backup_dir: 'backups',
  backup_prefix: 'mrt_data_',        // daily backups: mrt_data_YYYY-MM-DD.json
  backup_keep: 30,                    // daily backups kept; safety copies are never pruned

  time_zone: 'Europe/Vienna',
  undo_ms: 10000,                     // Undo / Ctrl+Z window after a change
  revision_poll_ms: 30000,            // "someone else saved" check

  // Which adapter does the talking. Change here, never in a screen.
  adapters: Object.freeze({
    storage: 'folder',                // 'folder' today; 'api' after the server move
    mail: 'outlook-draft',            // 'outlook-draft' today; 'smtp' via the server later
    ai: 'off'                         // 'off' today; 'local-llm' later (IT approval first)
  }),

  // Browser storage names (the remembered folder, per-PC preferences).
  idb_name: 'metrology-request-tracker',
  local_prefix: 'mrt.'
});
