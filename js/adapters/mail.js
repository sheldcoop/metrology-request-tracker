/**
 * Metrology Request Tracker - adapters/mail.js
 *
 * Email, behind one small interface (CLAUDE.md "Adapters"). Today: a ready
 * Outlook draft through a mailto: link - the person reads it and presses
 * Send (Q19). Later: real email through the server's SMTP (OPEN_QUESTIONS
 * #2, #10) - only this file changes. Screens never build mailto: links.
 *
 *   MRT.adapters.mail.draft({to: ['a@corp.com'], cc: [], subject, body}) -> true | false
 *   MRT.adapters.mail.canSend(people) -> the email addresses known
 */
window.MRT = window.MRT || {};
window.MRT.adapters = window.MRT.adapters || {};
window.MRT.adapters.mail = (function () {
  'use strict';

  /** mailto: links get long; Outlook and browsers cut around 2000 characters. */
  var MAX_URL = 1900;

  function emails(list) {
    return (list || []).filter(function (e) { return typeof e === 'string' && /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+$/.test(e); });
  }

  /** The mailto: address for a draft (exposed for tests). */
  function mailtoUrl(m) {
    var to = emails(m.to).join(';');
    var q = [];
    if (emails(m.cc).length) q.push('cc=' + emails(m.cc).join(';'));
    q.push('subject=' + encodeURIComponent(m.subject || ''));
    var body = String(m.body || '');
    var url = 'mailto:' + to + '?' + q.join('&') + '&body=';      // addresses are checked above: plain, no encoding
    while (body.length && (url + encodeURIComponent(body)).length > MAX_URL) body = body.slice(0, Math.floor(body.length * 0.8));
    return url + encodeURIComponent(body);
  }

  /** Open the draft in the mail program. False when nobody has an email address. */
  function draft(m) {
    if (!emails(m.to).length) return false;
    var a = document.createElement('a');
    a.href = mailtoUrl(m);
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  }

  return { draft: draft, mailtoUrl: mailtoUrl, emails: emails };
})();
