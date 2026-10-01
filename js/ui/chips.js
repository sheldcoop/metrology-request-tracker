/**
 * Metrology Request Tracker - ui/chips.js
 *
 * Reorder chips: small boxes a person can drag (or move with buttons) to set
 * an ORDER that is kept, never sorted - PRF data (DECISIONS PRF-1): unit
 * numbers typed in measurement order. Each chip is one unit (or coupon).
 * Keyboard and touch both work: every chip has move-left/move-right buttons
 * as well as drag, so the page works without a mouse.
 *
 * ui.reorderChips({ value: [5,4,2,3,6], coupon: fn(label)->bool, onChange })
 *   -> { node, value(), set(list), add(label), focus() }
 * value() returns the list in its current order, items unchanged (numbers
 * stay numbers, coupon labels stay strings - js/prf.js asLabel()).
 *
 * Typing + Enter/comma/space adds a chip; pasting "5,4,2,3,6" adds all five
 * in order. A bad token is rejected and shown, not guessed.
 */
(function (ui) {
  'use strict';

  var el = ui.el;
  var icon = ui.icon;
  var uid = ui.uid;

  var TOKEN_RE = /^[A-Za-z]*\d+$/;

  function isCoupon(label) { return !/^-?\d+$/.test(String(label).trim()); }

  function reorderChips(o) {
    o = o || {};
    var items = (o.value || []).slice();
    var name = o.id || uid('chips');
    var dragFrom = null;

    var list = el('div', { class: 'chips-list', role: 'list', 'aria-label': o.label || 'Units' });
    var input = el('input', { type: 'text', class: 'chips-input mono', placeholder: o.placeholder || 'Type a number, Enter to add',
      'aria-label': (o.label || 'Units') + ': add' });
    var msg = el('div', { class: 'ifield-msg', 'aria-live': 'polite' });
    var node = el('div', { class: 'chips' + (o.cls ? ' ' + o.cls : '') }, [
      o.label ? el('div', { class: 'ifield-label', text: o.label }) : null,
      list, input, msg
    ]);

    function fire() { if (o.onChange) o.onChange(items.slice()); }

    function say(text) { msg.textContent = text || ''; }

    function render() {
      list.textContent = '';
      items.forEach(function (label, i) {
        var coupon = isCoupon(label);
        var chip = el('div', {
          class: 'chip-box' + (coupon ? ' is-coupon' : ''), role: 'listitem',
          draggable: 'true', tabindex: '0', dataset: { index: String(i) },
          'aria-label': (coupon ? 'Coupon ' : 'Unit ') + label + ', position ' + (i + 1) + ' of ' + items.length
        }, [
          el('span', { class: 'chip-box-label mono', text: String(label) }),
          el('button', { type: 'button', class: 'chip-box-move', title: 'Move left', 'aria-label': 'Move ' + label + ' left',
            disabled: i === 0, onclick: function () { move(i, i - 1); } }, icon('chevron_left', 13)),
          el('button', { type: 'button', class: 'chip-box-move', title: 'Move right', 'aria-label': 'Move ' + label + ' right',
            disabled: i === items.length - 1, onclick: function () { move(i, i + 1); } }, icon('chevron_right', 13)),
          el('button', { type: 'button', class: 'chip-box-remove', title: 'Remove', 'aria-label': 'Remove ' + label,
            onclick: function () { items.splice(i, 1); render(); fire(); } }, icon('close', 12))
        ]);
        chip.addEventListener('dragstart', function (e) { dragFrom = i; e.dataTransfer.effectAllowed = 'move'; chip.classList.add('is-dragging'); });
        chip.addEventListener('dragend', function () { chip.classList.remove('is-dragging'); dragFrom = null; });
        chip.addEventListener('dragover', function (e) { e.preventDefault(); });
        chip.addEventListener('drop', function (e) {
          e.preventDefault();
          if (dragFrom === null || dragFrom === i) return;
          move(dragFrom, i);
        });
        chip.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); move(i, i - 1, true); }
          else if (e.key === 'ArrowRight' && i < items.length - 1) { e.preventDefault(); move(i, i + 1, true); }
          else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); items.splice(i, 1); render(); fire(); }
        });
        list.appendChild(chip);
      });
      if (!items.length) list.appendChild(el('div', { class: 'chips-empty', text: o.emptyText || 'None yet.' }));
    }

    function move(from, to, focusAfter) {
      var x = items.splice(from, 1)[0];
      items.splice(to, 0, x);
      render();
      fire();
      if (focusAfter) {
        var chip = list.children[to];
        if (chip) chip.focus();
      }
    }

    /** One token ('3', 'C1') -> added, or rejected with a message. */
    function addToken(tok) {
      tok = tok.trim();
      if (!tok) return true;
      if (!TOKEN_RE.test(tok)) { say('Not a unit: "' + tok + '". Use a number, or a letter then a number for a coupon (C1).'); return false; }
      var label = /^-?\d+$/.test(tok) ? parseInt(tok, 10) : tok;
      if (items.some(function (x) { return String(x) === String(label); })) { say('"' + label + '" is already in the list.'); return false; }
      items.push(label);
      return true;
    }

    function addText(text) {
      var tokens = String(text).split(/[\s,;]+/).filter(Boolean);
      var ok = true;
      tokens.forEach(function (t) { if (!addToken(t)) ok = false; });
      render();
      fire();
      return ok;
    }

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        if (addText(input.value)) { input.value = ''; say(''); }
      }
    });
    input.addEventListener('paste', function (e) {
      var text = (e.clipboardData || window.clipboardData).getData('text');
      if (/[\s,;]/.test(text)) { e.preventDefault(); addText(text); input.value = ''; say(''); }
    });
    input.addEventListener('blur', function () {
      if (input.value.trim() && addText(input.value)) { input.value = ''; say(''); }
    });

    render();

    return {
      node: node,
      value: function () { return items.slice(); },
      set: function (list2) { items = (list2 || []).slice(); render(); },
      add: function (label) { addText(String(label)); },
      focus: function () { input.focus(); }
    };
  }

  ui.reorderChips = reorderChips;
  ui.isCouponLabel = isCoupon;
})(window.MRT.ui);
