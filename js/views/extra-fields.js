/**
 * Metrology Request Tracker - views/extra-fields.js
 *
 * Admin-defined fields on a form (Q5): lot fields on a lot, a tool's extra
 * fields on a request. Turns field definitions into ui.form specs (key
 * x_<field id>), stored answers into form values and back, and answers into
 * text. Answers are stored by field ID; choices by choice ID.
 */
window.MRT = window.MRT || {};
window.MRT.extraFields = (function () {
  'use strict';

  var D = window.MRT.domain;

  /** An answer as text: choice labels, Yes/No, the value (+ unit) otherwise. */
  function answerText(f, v) {
    if (D.isEmptyAnswer(v)) return '';
    function label(id) { var c = (f.choices || []).filter(function (x) { return x.id === id; })[0]; return c ? c.label : '?'; }
    if (f.type === 'choice') return label(v);
    if (f.type === 'multichoice') return v.map(label).join(', ');
    if (f.type === 'yesno') return v ? 'Yes' : 'No';
    if (f.type === 'number') return String(v) + (f.unit ? ' ' + f.unit : '');
    return String(v);
  }

  /** The fields to show: active ones, plus hidden ones that already have an answer. */
  function shown(fields, answers) {
    var ex = answers || {};
    return fields.filter(function (f) { return f.active !== false || !D.isEmptyAnswer(ex[f.id]); });
  }

  /** ui.form specs for the fields. */
  function specs(fields, answers) {
    var ex = answers || {};
    return shown(fields, ex).map(function (f) {
      var cur = ex[f.id];
      var live = (f.choices || []).filter(function (c) { return c.active !== false || c.id === cur || (Array.isArray(cur) && cur.indexOf(c.id) !== -1); })
        .map(function (c) { return { value: c.id, label: c.label }; });
      var sp = { key: 'x_' + f.id, label: f.label + (f.required ? '' : ' (optional)'), hint: f.help || null,
                 cls: f.type === 'longtext' || f.type === 'multichoice' ? null : 'half' };
      switch (f.type) {
        case 'longtext': sp.kind = 'longtext'; break;
        case 'number': sp.kind = 'number'; sp.unit = f.unit || null; break;
        case 'choice': sp.kind = 'select'; sp.options = [{ value: '', label: '- none -' }].concat(live); break;
        case 'multichoice': sp.kind = 'checks'; sp.options = live; break;
        case 'yesno': sp.kind = 'select'; sp.options = [{ value: '', label: '- none -' }, { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]; break;
        case 'date': sp.kind = 'date'; break;
        case 'path': sp.kind = 'path'; sp.placeholder = '\\\\server\\share\\...'; break;
        default: sp.kind = 'text';
      }
      return sp;
    });
  }

  /** Stored answers -> form values. */
  function values(fields, answers) {
    var ex = answers || {}, out = {};
    fields.forEach(function (f) {
      var v = ex[f.id];
      if (f.type === 'yesno') v = v === true ? 'yes' : v === false ? 'no' : '';
      else if (f.type === 'multichoice') v = v || [];
      else if (v === undefined || v === null) v = f.type === 'number' ? null : '';
      out['x_' + f.id] = v;
    });
    return out;
  }

  /** Form values -> answers {field id: value} (only the fields on the form). */
  function answers(fields, v) {
    var out = {};
    fields.forEach(function (f) {
      if (!(('x_' + f.id) in v)) return;
      var x = v['x_' + f.id];
      if (f.type === 'yesno') x = x === 'yes' ? true : x === 'no' ? false : null;
      out[f.id] = x;
    });
    return out;
  }

  return { answerText: answerText, shown: shown, specs: specs, values: values, answers: answers };
})();
