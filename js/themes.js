/**
 * Metrology Request Tracker - themes.js  (THE one place for themes)
 *
 * Every theme of the app lives in the THEMES list below: its name, mood,
 * the four swatches the picker shows, and its colour tokens. Nothing else
 * defines colours per theme - css/app.css only USES the tokens (var(--bg)
 * ...), and switches a few structural details on the theme's scheme:
 *   [data-scheme="dark"|"light"]   glows or crisp lines
 *   [data-contrast="high"]         2px ink, bigger focus ring
 * The user menu's theme gallery, Settings > Look (the default theme for
 * everyone), ui-kit.html and tests/contrast.js all read this list.
 *
 * The themes (2026-09-30, Prince, redesign Step 1; 2026-10-01 HOME-19: Quant -> Neutral, + Copper): six - AT&S (the default,
 * company identity; since 2026-10-01 a white room with AT&S blue panels and tiles, white writing), Pure White, Dark Teal, Slate, Neutral and Copper.
 * Dark Teal and Slate match the studio website tokens (studio
 * src/tailwind.config.ts .dark / .slate, HSL converted to hex by
 * script); their AA-tuned text shades stay one step off the raw tokens where
 * tests/contrast.js fails. Signal and Frost are retired; their keys (and every
 * older key) map onto the six (ALIASES), so nobody's saved choice breaks.
 * Status tokens keep OK / Warning / Line stop / Late clearly apart and
 * readable in every theme.
 *
 * Add a theme: add an entry with a unique key and a group (Main / Personal),
 * run node tests/contrast.js (WCAG AA for every text colour, and the status
 * colours clearly apart).
 *
 * Loaded in <head>, before anything is drawn: install() writes the tokens
 * as a <style> and puts the last used theme on <html> (no flash of the
 * wrong theme). Fonts stay the system stacks (Segoe UI, Cascadia Mono) in
 * every theme - no downloads from file://.
 */
window.MRT = window.MRT || {};
window.MRT.themes = (function () {
  'use strict';

  var DEFAULT = 'ats';
  /** Keys of the retired themes (2026-09-28) -> today's, so a saved choice keeps working. */
  var ALIASES = { dark: 'dark-teal', ocean: 'dark-teal', galaxy: 'dark-teal', forest: 'dark-teal', tech: 'dark-teal',
                  'carbon-g100': 'dark-teal', 'catppuccin-mocha': 'dark-teal', 'deep-lab': 'dark-teal',
                  signal: 'dark-teal',
                  light: 'pure-white', arctic: 'pure-white', golden: 'pure-white', rose: 'pure-white',
                  'carbon-white': 'pure-white', 'gruvbox-light': 'pure-white', cleanroom: 'pure-white', minimal: 'pure-white',
                  frost: 'pure-white',
                  hc: 'dark-teal', 'primer-hc': 'dark-teal',
                  quant: 'neutral' };
  var LAST_KEY = 'mrt.theme.last';

  /* Status colours per scheme: the meaning never changes, only the shade that reads well. */
  var STATUS = {
    dark: {
      ok: '#22C55E', 'ok-fg': '#4ADE80', 'ok-bg': 'rgba(34, 197, 94, .12)',
      warning: '#F59E0B', 'warning-fg': '#FBBF24', 'warning-bg': 'rgba(245, 158, 11, .12)',
      critical: '#F97316', 'critical-fg': '#FB9A55', 'critical-bg': 'rgba(249, 115, 22, .13)',
      expired: '#EF4444', 'expired-fg': '#F87171', 'expired-bg': 'rgba(239, 68, 68, .14)',
      blocked: '#64748B', 'blocked-fg': '#A3B1C4', 'blocked-bg': 'rgba(100, 116, 139, .18)',
      danger: '#EF4444', 'danger-fg': '#F87171', 'danger-bg': 'rgba(239, 68, 68, .13)',
      'on-danger': '#1A0606',
      'c-blue': '#93C5FD', 'c-teal': '#2DD4BF', 'c-pink': '#F472B6'
    },
    light: {
      ok: '#15803D', 'ok-fg': '#14612F', 'ok-bg': '#E8F3EC',
      warning: '#C26A00', 'warning-fg': '#8A4A00', 'warning-bg': '#FBF1E2',
      critical: '#D9510C', 'critical-fg': '#9C3706', 'critical-bg': '#FCEDE4',
      expired: '#C81E1E', 'expired-fg': '#991515', 'expired-bg': '#FBE9E9',
      blocked: '#64707E', 'blocked-fg': '#46505C', 'blocked-bg': '#EDEFF2',
      danger: '#C81E1E', 'danger-fg': '#991515', 'danger-bg': '#FBE9E9',
      'on-danger': '#FFFFFF',
      'c-blue': '#1D4ED8', 'c-teal': '#0F766E', 'c-pink': '#BE185D'
    }
  };

  /**
   * The themes. p = the palette: bg, surface, surface-2, surface-3, inset (field well), fg,
   * fg-muted, fg-faint, accent (actions, links, focus), accent-fg (text on accent), and for
   * light themes line / line-strong (solid). Dark themes draw their lines from the accent
   * (or p.ink). Anything else can be set by name in p and wins.
   */
  var THEMES = [

    { key: 'ats', name: 'AT&S', scheme: 'dark', group: 'Main', page: 'pure-white',
      mood: 'Company identity: white room, AT&S blue panels and tiles with white writing; red only where it hurts (late, danger).',
      swatches: ['#FFFFFF', '#0C3D6E', '#FFFFFF', '#B9CBE0'],
      p: { bg: '#FFFFFF', surface: '#0C3D6E', 'surface-2': '#10487F', 'surface-3': '#15538C', inset: '#082B4F',
           fg: '#FFFFFF', 'fg-muted': '#B9CBE0', 'fg-faint': '#A3B8D2',
           line: '#2A5A8C', 'line-strong': '#41719F', 'line-hi': '#8FC1F0', bracket: '#41719F',
           accent: '#FFFFFF', 'accent-fill': '#FFFFFF', 'accent-fg': '#082B4F', 'accent-soft': 'rgba(255, 255, 255, .14)',
           'accent-glow': '0 0 0 1px #FFFFFF',
           ok: '#5CCB8A', 'ok-fg': '#7CE3A6', 'ok-bg': '#0A3520',
           warning: '#F2B84B', 'warning-fg': '#F6C963', 'warning-bg': '#3A2A00',
           critical: '#FF832B', 'critical-fg': '#FFA76B', 'critical-bg': '#3E1A00',
           expired: '#FF7A70', 'expired-fg': '#FF9A92', 'expired-bg': '#4A1210',
           danger: '#FF7A70', 'danger-fg': '#FF9A92', 'danger-bg': '#4A1210', 'on-danger': '#260606',
           blocked: '#6F6F6F', 'blocked-fg': '#C6C6C6', 'blocked-bg': '#2A3F58',
           'c-blue': '#8FC1F0', 'c-teal': '#5CC8C8', 'c-pink': '#F49AC2',
           shadow: '0 8px 24px rgba(8, 43, 79, .22)', 'shadow-pop': '0 18px 50px rgba(8, 43, 79, .35)', scrim: 'rgba(4, 10, 20, .55)' } },
    { key: 'dark-teal', name: 'Dark Teal', scheme: 'dark', group: 'Main',
      mood: 'Studio .dark tokens: near-black room, teal actions.',
      swatches: ['#020A1D', '#061027', '#02E8CD', '#F8FAFC'],
      p: { bg: '#020A1D', surface: '#061027', 'surface-2': '#1D283A', 'surface-3': '#26344B', inset: '#020A1D',
           fg: '#F8FAFC', 'fg-muted': '#94A3B8', 'fg-faint': '#7F91AA',
           line: '#1D283A', 'line-strong': '#2B3B55', 'line-hi': '#02E8CD', bracket: '#2B3B55',
           accent: '#02E8CD', 'accent-fill': '#02E8CD', 'accent-fg': '#00332D', 'accent-soft': 'rgba(2, 232, 205, .12)',
           'accent-glow': '0 0 0 1px #02E8CD',
           ok: '#42BE65', 'ok-fg': '#42BE65', 'ok-bg': '#022D0D',
           warning: '#F1C21B', 'warning-fg': '#F1C21B', 'warning-bg': '#302400',
           critical: '#FF832B', 'critical-fg': '#FF832B', 'critical-bg': '#3E1A00',
           expired: '#FA4D56', 'expired-fg': '#FF8389', 'expired-bg': '#520408',
           danger: '#DA1E28', 'danger-fg': '#FF8389', 'danger-bg': '#520408', 'on-danger': '#FFFFFF',
           blocked: '#6F6F6F', 'blocked-fg': '#C6C6C6', 'blocked-bg': '#393939',
           'c-blue': '#78A9FF', 'c-teal': '#08BDBA', 'c-pink': '#FF7EB6',
           shadow: '0 12px 32px rgba(0, 0, 0, .5)', 'shadow-pop': '0 18px 50px rgba(0, 0, 0, .6)', scrim: 'rgba(4, 8, 18, .66)' } },
    { key: 'pure-white', name: 'Pure White', scheme: 'light', group: 'Main',
      mood: 'White room, hairlines, brand navy ink.',
      swatches: ['#FFFFFF', '#FFFFFF', '#0C3D6E', '#0F1F33'],
      p: { bg: '#FFFFFF', surface: '#FFFFFF', 'surface-2': '#FFFFFF', 'surface-3': '#EEF3F9', inset: '#FFFFFF',
           fg: '#0F1F33', 'fg-muted': '#5B6B7F', 'fg-faint': '#43536A',
           line: '#E3E8EF', 'line-strong': '#C7D3E2', 'line-hi': '#0C3D6E', bracket: '#C7D3E2',
           accent: '#0C3D6E', 'accent-fill': '#0C3D6E', 'accent-fg': '#FFFFFF', 'accent-soft': 'rgba(12, 61, 110, .08)',
           'accent-glow': '0 0 0 1px #0C3D6E',
           ok: '#1F7A4D', 'ok-fg': '#14532F', 'ok-bg': '#E2F2E8',
           warning: '#F1C21B', 'warning-fg': '#7A5410', 'warning-bg': '#FCF4D6',
           critical: '#FF832B', 'critical-fg': '#BA4E00', 'critical-bg': '#FFF2E8',
           expired: '#B42318', 'expired-fg': '#7A1A12', 'expired-bg': '#FBE7E5',
           danger: '#B42318', 'danger-fg': '#7A1A12', 'danger-bg': '#FBE7E5', 'on-danger': '#FFFFFF',
           blocked: '#8D8D8D', 'blocked-fg': '#525252', 'blocked-bg': '#E0E0E0',
           'c-blue': '#0043CE', 'c-teal': '#007D79', 'c-pink': '#D02670',
           shadow: '0 1px 2px rgba(16, 24, 40, .06), 0 8px 24px rgba(16, 24, 40, .08)',
           'shadow-pop': '0 4px 8px rgba(16, 24, 40, .08), 0 16px 40px rgba(16, 24, 40, .16)', scrim: 'rgba(16, 24, 40, .45)' } },
    { key: 'slate', name: 'Slate', scheme: 'dark', group: 'Main',
      mood: 'Studio .slate tokens: warm gray room, amber actions.',
      swatches: ['#131720', '#131720', '#F59F0A', '#E5E7EB'],
      p: { bg: '#131720', surface: '#131720', 'surface-2': '#1F2433', 'surface-3': '#292F43', inset: '#131720',
           fg: '#E5E7EB', 'fg-muted': '#878CA0', 'fg-faint': '#888FA2',
           line: '#272C3F', 'line-strong': '#373E58', 'line-hi': '#F59F0A', bracket: '#373E58',
           accent: '#F59F0A', 'accent-fill': '#F59F0A', 'accent-fg': '#332000', 'accent-soft': 'rgba(245, 159, 10, .12)',
           'accent-glow': '0 0 0 1px #F59F0A',
           ok: '#42BE65', 'ok-fg': '#42BE65', 'ok-bg': '#022D0D',
           warning: '#F1C21B', 'warning-fg': '#F1C21B', 'warning-bg': '#302400',
           critical: '#FF832B', 'critical-fg': '#FF832B', 'critical-bg': '#3E1A00',
           expired: '#FA4D56', 'expired-fg': '#FF8389', 'expired-bg': '#520408',
           danger: '#DA1E28', 'danger-fg': '#FF8389', 'danger-bg': '#520408', 'on-danger': '#FFFFFF',
           blocked: '#6F6F6F', 'blocked-fg': '#C6C6C6', 'blocked-bg': '#393939',
           'c-blue': '#78A9FF', 'c-teal': '#08BDBA', 'c-pink': '#FF7EB6',
           shadow: '0 12px 32px rgba(0, 0, 0, .5)', 'shadow-pop': '0 18px 50px rgba(0, 0, 0, .6)', scrim: 'rgba(4, 8, 18, .66)' } },
    { key: 'neutral', name: 'Neutral', scheme: 'light', group: 'Main',
      mood: 'Calm light grey room, #262626 ink, graphite Home tiles with white writing.',
      swatches: ['#F3F3F1', '#FFFFFF', '#262626', '#5C5C5C'],
      p: { bg: '#F3F3F1', surface: '#FFFFFF', 'surface-2': '#F7F7F5', 'surface-3': '#ECECE9', inset: '#FFFFFF',
           fg: '#262626', 'fg-muted': '#5A5A5A', 'fg-faint': '#525252',
           line: '#E0E0DC', 'line-strong': '#C6C6C2', 'line-hi': '#262626', bracket: '#C6C6C2',
           accent: '#262626', 'accent-fill': '#262626', 'accent-fg': '#FFFFFF', 'accent-soft': 'rgba(38, 38, 38, .08)',
           'accent-glow': '0 0 0 1px #262626',
           ok: '#1F7A4D', 'ok-fg': '#14532F', 'ok-bg': '#E2F2E8',
           warning: '#F1C21B', 'warning-fg': '#7A5410', 'warning-bg': '#FCF4D6',
           critical: '#FF832B', 'critical-fg': '#BA4E00', 'critical-bg': '#FFF2E8',
           expired: '#B42318', 'expired-fg': '#7A1A12', 'expired-bg': '#FBE7E5',
           danger: '#B42318', 'danger-fg': '#7A1A12', 'danger-bg': '#FBE7E5', 'on-danger': '#FFFFFF',
           blocked: '#8D8D8D', 'blocked-fg': '#525252', 'blocked-bg': '#E0E0E0',
           tile: '#262626', 'tile-fg': '#FFFFFF', 'tile-fg-muted': '#C6C6C6', 'tile-accent': '#FFFFFF',
           'tile-line': '#262626', 'scene-ink': '#FFFFFF', 'scene-line': '#6F6F6F' } },
    { key: 'copper', name: 'Copper', scheme: 'dark', group: 'Main',
      mood: 'The PCB panel: dark laminate room, copper-clad tiles, bright copper for actions and the scenes.',
      swatches: ['#15100C', '#3B2414', '#E0915A', '#F6EEE7'],
      p: { bg: '#15100C', surface: '#1F1712', 'surface-2': '#2A1F18', 'surface-3': '#35271E', inset: '#15100C',
           fg: '#F6EEE7', 'fg-muted': '#C2AC9A', 'fg-faint': '#B39C89',
           accent: '#E0915A', 'accent-fill': '#E0915A', 'accent-fg': '#1F0F05',
           tile: '#3B2414', 'tile-fg': '#FBF3EC', 'tile-fg-muted': '#E3C9B4', 'tile-accent': '#F2B58A',
           'tile-line': '#6D3620', 'scene-ink': '#F2A66E', 'scene-line': '#8A5A3C',
           shadow: '0 12px 32px rgba(0, 0, 0, .5)', 'shadow-pop': '0 18px 50px rgba(0, 0, 0, .6)', scrim: 'rgba(10, 6, 3, .66)' } },
  ];

  function rgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [n >> 16, n >> 8 & 255, n & 255].join(', ');
  }

  /* Two zones (HOME-11): a theme may paint its page (the room around the panels)
     with another theme's palette - AT&S: white page (pure-white) around blue
     panels. Every theme emits --pg-* (page) and --pn-* (panel) copies of these
     keys; css/app.css swaps them in on .main and back on the panel-like boxes.
     Without `page` both copies are the theme's own tokens, so nothing changes. */
  var ZONE = ['fg', 'fg-muted', 'fg-faint', 'accent', 'accent-fill', 'accent-fg', 'accent-soft', 'accent-glow',
              'surface', 'surface-2', 'surface-3', 'inset', 'line', 'line-strong', 'line-hi', 'bracket',
              'ok', 'ok-fg', 'ok-bg', 'warning', 'warning-fg', 'warning-bg', 'critical', 'critical-fg', 'critical-bg',
              'expired', 'expired-fg', 'expired-bg', 'blocked', 'blocked-fg', 'blocked-bg',
              'danger', 'danger-fg', 'danger-bg', 'on-danger', 'c-blue', 'c-teal', 'c-pink'];

  /** Every token of a theme, as {name: value} (names without the leading --). */
  function tokens(t) {
    var o = own(t), pg = t.page ? own(byKey(t.page)) : o;
    ZONE.forEach(function (k) { o['pn-' + k] = o[k]; o['pg-' + k] = pg[k]; });
    return o;
  }

  function own(t) {
    var p = t.p, dark = t.scheme === 'dark', o = {};
    var s = STATUS[t.scheme];
    Object.keys(s).forEach(function (k) { o[k] = s[k]; });
    ['bg', 'surface', 'surface-2', 'surface-3', 'inset', 'fg', 'fg-muted', 'fg-faint', 'accent', 'accent-fg'].forEach(function (k) { o[k] = p[k]; });
    var a = rgb(p.accent), ink = rgb(p.ink || p.accent);
    if (dark) {
      o['grid-line'] = t.grid ? 'rgba(' + ink + ', .045)' : 'transparent';
      o.line = 'rgba(' + ink + ', .15)';
      o['line-strong'] = 'rgba(' + ink + ', .28)';
      o['line-hi'] = 'rgba(' + ink + ', .5)';
      o.bracket = 'rgba(' + ink + ', .55)';
      o['accent-soft'] = 'rgba(' + a + ', .12)';
      o['accent-glow'] = '0 0 0 1px rgba(' + a + ', .5), 0 0 18px rgba(' + a + ', .28)';
      o['glow-ring'] = '40%'; o['glow-blur'] = '32%';
      o.shadow = '0 1px 0 rgba(255, 255, 255, .03) inset, 0 10px 28px rgba(0, 0, 0, .38)';
      o['shadow-pop'] = '0 18px 48px rgba(0, 0, 0, .55)';
      o.scrim = 'rgba(3, 6, 10, .6)';
    } else {
      o['grid-line'] = 'transparent';
      o['line-hi'] = p.accent;
      o.bracket = p['line-strong'];
      o['accent-soft'] = 'rgba(' + a + ', .08)';
      o['accent-glow'] = '0 0 0 1px ' + p.accent;
      o['glow-ring'] = '100%'; o['glow-blur'] = '0%';
      var f = rgb(p.fg);
      o.shadow = '0 1px 0 rgba(' + f + ', .05)';
      o['shadow-pop'] = '0 12px 32px rgba(' + f + ', .18)';
      o.scrim = 'rgba(' + f + ', .35)';
    }
    o['accent-fill'] = p.accent;           // buttons and other filled accents; a theme can set its own (Carbon dark)
    /* Home tiles and their scenes (HOME-10): a tile is a surface unless the theme
       says otherwise (AT&S: dark tiles on a white room). Scene ink is the living
       element - the accent in dark schemes, near-black in light ones. */
    o.tile = p.surface; o['tile-fg'] = p.fg; o['tile-fg-muted'] = p['fg-muted'];
    o['tile-accent'] = p.accent; o['tile-line'] = dark ? o.line : p.line;
    o['scene-ink'] = dark ? p.accent : '#111111';
    o['scene-line'] = dark ? o['line-strong'] : '#9A9A9A';
    Object.keys(p).forEach(function (k) { if (k !== 'ink') o[k] = p[k]; });    // the theme's own values win
    return o;
  }

  /** The CSS of all themes: one [data-theme="key"] block each, the default's block
      FIRST (it also sits on :root, and :root ties every [data-theme] block on
      specificity - so the default must come first or it would paint over every
      theme the page picks). The rest follow in gallery order. */
  function css() {
    var ordered = THEMES.filter(function (t) { return t.key === DEFAULT; })
      .concat(THEMES.filter(function (t) { return t.key !== DEFAULT; }));
    return ordered.map(function (t) {
      var o = tokens(t);
      var sel = (t.key === DEFAULT ? ':root, ' : '') + '[data-theme="' + t.key + '"]';
      return sel + ' {\n  color-scheme: ' + t.scheme + ';\n' + Object.keys(o).map(function (k) { return '  --' + k + ': ' + o[k] + ';'; }).join('\n') + '\n}';
    }).join('\n');
  }

  function byKey(key) { key = ALIASES[key] || key; return THEMES.filter(function (t) { return t.key === key; })[0] || null; }

  /** The attributes that put a theme on an element (the page, or a ui-kit sample). */
  function attrs(key) {
    var t = byKey(key) || byKey(DEFAULT);   // an old key resolves through ALIASES
    return { 'data-theme': t.key, 'data-scheme': t.scheme, 'data-contrast': t.contrast || 'normal' };
  }

  function setOn(elm, key) {
    var a = attrs(key);
    Object.keys(a).forEach(function (k) { elm.setAttribute(k, a[k]); });
    return a['data-theme'];
  }

  /** Put a theme on the page; remembered as "last used" on this PC for the next start. */
  function apply(key) {
    var k = setOn(document.documentElement, key);
    try { localStorage.setItem(LAST_KEY, k); } catch (e) { /* private mode */ }
    return k;
  }

  /** Write the tokens once and show the last used theme before anything is drawn. */
  function install() {
    if (typeof document === 'undefined' || document.getElementById('mrt-themes')) return;
    var st = document.createElement('style');
    st.id = 'mrt-themes';
    st.textContent = css();
    (document.head || document.documentElement).appendChild(st);
    var last = null;
    try { last = localStorage.getItem(LAST_KEY); } catch (e) { /* private mode */ }
    setOn(document.documentElement, byKey(last) ? last : (document.documentElement.getAttribute('data-theme') || DEFAULT));
  }

  install();

  return { list: THEMES, DEFAULT: DEFAULT, byKey: byKey, tokens: tokens, css: css, attrs: attrs, setOn: setOn, apply: apply, install: install };
})();
