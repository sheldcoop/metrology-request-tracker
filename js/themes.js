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
 * Add a theme: add an entry with a unique key, run node tests/contrast.js
 * (every text colour must reach WCAG AA 4.5:1 on its backgrounds). The
 * palettes of the theme-factory set (Ocean Depths, Midnight Galaxy, Forest
 * Canopy, Tech Innovation, Arctic Frost, Modern Minimalist, Golden Hour,
 * Desert Rose) are the inspiration, tuned to an instrument screen: dark
 * wells, clear lines, one action colour, and the status colours (green OK,
 * amber warning, orange critical, red late/expired) meaning the same in
 * every theme.
 *
 * Loaded in <head>, before anything is drawn: install() writes the tokens
 * as a <style> and puts the last used theme on <html> (no flash of the
 * wrong theme). Themes marked candidate: true are a proposal: ui-kit.html
 * shows them (Proposal), the app's gallery does not yet. Fonts stay the system stacks (Segoe UI, Cascadia Mono) in
 * every theme - no downloads from file://.
 */
window.MRT = window.MRT || {};
window.MRT.themes = (function () {
  'use strict';

  var DEFAULT = 'dark';
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
    { key: 'dark', name: 'Mission Control', scheme: 'dark', group: 'Dark', grid: true,
      mood: 'The default: a dark console, sky-blue lines, glowing status lamps.',
      swatches: ['#0A0E14', '#111822', '#38BDF8', '#E6EDF3'],
      p: { bg: '#0A0E14', surface: '#111822', 'surface-2': '#161F2C', 'surface-3': '#1E2938', inset: '#070B11',
           fg: '#E6EDF3', 'fg-muted': '#8B98A9', 'fg-faint': '#7F8C9E', accent: '#38BDF8', 'accent-fg': '#04121C' } },
    { key: 'ocean', name: 'Ocean Depths', scheme: 'dark', group: 'Dark', grid: true,
      mood: 'Deep navy and teal, calm like a sonar screen.',
      swatches: ['#1A2332', '#2D8B8B', '#A8DADC', '#F1FAEE'],
      p: { bg: '#0F1620', surface: '#1A2332', 'surface-2': '#1F2A3B', 'surface-3': '#283548', inset: '#0B1119',
           fg: '#F1FAEE', 'fg-muted': '#A8BFC3', 'fg-faint': '#98B0B5', accent: '#5CC8C8', 'accent-fg': '#062222' } },
    { key: 'galaxy', name: 'Midnight Galaxy', scheme: 'dark', group: 'Dark', grid: false,
      mood: 'Deep purple and lavender, quiet for long evening shifts.',
      swatches: ['#2B1E3E', '#4A4E8F', '#A490C2', '#E6E6FA'],
      p: { bg: '#150F20', surface: '#221833', 'surface-2': '#2A1F3E', 'surface-3': '#35284D', inset: '#100B19',
           fg: '#E6E6FA', 'fg-muted': '#B2A8C8', 'fg-faint': '#A499BD', accent: '#B9A6E0', 'accent-fg': '#1A1128' } },
    { key: 'forest', name: 'Forest Canopy', scheme: 'dark', group: 'Dark', grid: false,
      mood: 'Forest green, sage and ivory - soft on the eyes.',
      swatches: ['#2D4A2B', '#7D8471', '#A4AC86', '#FAF9F6'],
      p: { bg: '#0E150D', surface: '#172416', 'surface-2': '#1C2C1B', 'surface-3': '#263924', inset: '#0A1009',
           fg: '#FAF9F6', 'fg-muted': '#B7BDA4', 'fg-faint': '#A9B093', accent: '#C3CB98', 'accent-fg': '#172114' } },
    { key: 'tech', name: 'Tech Innovation', scheme: 'dark', group: 'Dark', grid: true,
      mood: 'Graphite with electric blue and a cyan trace.',
      swatches: ['#1E1E1E', '#0066FF', '#00FFFF', '#FFFFFF'],
      p: { bg: '#121212', surface: '#1C1C1E', 'surface-2': '#232326', 'surface-3': '#2E2E32', inset: '#0B0B0C',
           fg: '#FFFFFF', 'fg-muted': '#A9ADB5', 'fg-faint': '#9CA0A8', accent: '#4D94FF', 'accent-fg': '#00122E', ink: '#00E5FF' } },

    { key: 'light', name: 'Instrument', scheme: 'light', group: 'Light',
      mood: 'Calm neutral greys like lab instrument software, one engineering blue.',
      swatches: ['#ECEEF1', '#FFFFFF', '#0B5CAD', '#15191E'],
      p: { bg: '#ECEEF1', surface: '#FFFFFF', 'surface-2': '#F6F7F9', 'surface-3': '#E4E7EB', inset: '#F2F4F6',
           fg: '#15191E', 'fg-muted': '#474F5A', 'fg-faint': '#5A636E', line: '#D5DAE0', 'line-strong': '#B4BCC6', bracket: '#8C96A3',
           accent: '#0B5CAD', 'accent-fg': '#FFFFFF' } },
    { key: 'arctic', name: 'Arctic Frost', scheme: 'light', group: 'Light',
      mood: 'Ice blue and steel - crisp and clean like a clean room.',
      swatches: ['#D4E4F7', '#4A6FA5', '#C0C0C0', '#FAFAFA'],
      p: { bg: '#DDE8F5', surface: '#FAFCFE', 'surface-2': '#F0F5FB', 'surface-3': '#D4E4F7', inset: '#F3F7FC',
           fg: '#132033', 'fg-muted': '#3C4B61', 'fg-faint': '#4A596E', line: '#C8D6E7', 'line-strong': '#A3B5CC', bracket: '#9AA9BB',
           accent: '#3F6397', 'accent-fg': '#FFFFFF' } },
    { key: 'minimal', name: 'Modern Minimalist', scheme: 'light', group: 'Light',
      mood: 'Charcoal and greys only - colour is left to the status.',
      swatches: ['#36454F', '#708090', '#D3D3D3', '#FFFFFF'],
      p: { bg: '#EBEDEF', surface: '#FFFFFF', 'surface-2': '#F6F7F8', 'surface-3': '#DEE1E4', inset: '#F4F5F6',
           fg: '#1B2329', 'fg-muted': '#46525C', 'fg-faint': '#55616B', line: '#D3D7DB', 'line-strong': '#A9B1B8', bracket: '#708090',
           accent: '#36454F', 'accent-fg': '#FFFFFF' } },
    { key: 'golden', name: 'Golden Hour', scheme: 'light', group: 'Light',
      mood: 'Warm beige, mustard and chocolate - a friendly, warm light.',
      swatches: ['#F4A900', '#C1666B', '#D4B896', '#4A403A'],
      p: { bg: '#EFE5D6', surface: '#FFFBF5', 'surface-2': '#F8F0E4', 'surface-3': '#E9DAC3', inset: '#FBF5EC',
           fg: '#2B231E', 'fg-muted': '#4A403A', 'fg-faint': '#5A4E46', line: '#E2D2BA', 'line-strong': '#C8B090', bracket: '#D4B896',
           accent: '#7A4E10', 'accent-fg': '#FFFFFF', 'accent-soft': 'rgba(244, 169, 0, .16)', 'line-hi': '#C98C00' } },
    { key: 'rose', name: 'Desert Rose', scheme: 'light', group: 'Light',
      mood: 'Sand and dusty rose with deep burgundy - soft and elegant.',
      swatches: ['#D4A5A5', '#B87D6D', '#E8D5C4', '#5D2E46'],
      p: { bg: '#F1E6DC', surface: '#FFFAF7', 'surface-2': '#F9F0EA', 'surface-3': '#E8D5C4', inset: '#FBF4F0',
           fg: '#2A1520', 'fg-muted': '#553846', 'fg-faint': '#634755', line: '#E6D1C3', 'line-strong': '#CFAE9E', bracket: '#B87D6D',
           accent: '#5D2E46', 'accent-fg': '#FFFFFF', 'accent-soft': 'rgba(212, 165, 165, .22)', 'line-hi': '#B87D6D' } },

    /* --- PROPOSAL (2026-09-25, Prince): three themes from full app design systems, values checked
       against the official token sources - IBM Carbon (@carbon/themes: themes.json + colors.json,
       themes g100 and white) and GitHub Primer (primer/primitives, dark-high-contrast). Marked
       candidate: shown side by side in ui-kit.html (Proposal), not yet in the app's gallery.
       Carbon's own font (IBM Plex) is not installed on office PCs - the system fonts stay. */
    { key: 'carbon-g100', name: 'Carbon Gray 100', scheme: 'dark', group: 'Candidates', candidate: true, grid: false,
      mood: 'IBM Carbon g100: industrial, calm greys for data-heavy tools; lamps keep their glow.',
      swatches: ['#161616', '#262626', '#78A9FF', '#F4F4F4'],
      p: { bg: '#161616', surface: '#262626', 'surface-2': '#393939', 'surface-3': '#474747', inset: '#161616',     // background, layer-01, layer-02, layer-hover-02
           fg: '#F4F4F4', 'fg-muted': '#C6C6C6', 'fg-faint': '#A8A8A8',                                         // text-primary, -secondary, -helper
           line: '#393939', 'line-strong': '#6F6F6F', 'line-hi': '#4589FF', bracket: '#6F6F6F',                    // border-subtle-00, border-strong-01, border-interactive
           accent: '#78A9FF', 'accent-fill': '#0F62FE', 'accent-fg': '#FFFFFF', 'accent-soft': '#001D6C',           // link-primary, button-primary, highlight
           'accent-glow': '0 0 0 1px #4589FF', 'glow-ring': '100%', 'glow-blur': '0%',                           // crisp: glow only on the status lamps
           ok: '#42BE65', 'ok-fg': '#42BE65', 'ok-bg': '#022D0D',                                                // support-success, green 90
           warning: '#F1C21B', 'warning-fg': '#F1C21B', 'warning-bg': '#302400',                                 // support-warning, yellow 90
           critical: '#FF832B', 'critical-fg': '#FF832B', 'critical-bg': '#3E1A00',                              // support-caution-major, orange 90
           expired: '#FA4D56', 'expired-fg': '#FF8389', 'expired-bg': '#520408',                                 // support-error, text-error, red 90
           danger: '#DA1E28', 'danger-fg': '#FF8389', 'danger-bg': '#520408', 'on-danger': '#FFFFFF',            // button-danger (red 60)
           blocked: '#6F6F6F', 'blocked-fg': '#C6C6C6', 'blocked-bg': '#393939',
           'c-blue': '#78A9FF', 'c-teal': '#08BDBA', 'c-pink': '#FF7EB6',                                        // blue 40, teal 40, magenta 40
           radius: '0px', 'radius-panel': '0px',                                                                 // Carbon is square
           shadow: '0 2px 6px rgba(0, 0, 0, .3)', 'shadow-pop': '0 2px 6px rgba(0, 0, 0, .3)', scrim: 'rgba(0, 0, 0, .6)' } },
    { key: 'carbon-white', name: 'Carbon White', scheme: 'light', group: 'Candidates', candidate: true,
      mood: 'IBM Carbon White: the same tool in daylight - white, cool greys, Carbon blue.',
      swatches: ['#FFFFFF', '#F4F4F4', '#0F62FE', '#161616'],
      p: { bg: '#FFFFFF', surface: '#F4F4F4', 'surface-2': '#FFFFFF', 'surface-3': '#E8E8E8', inset: '#FFFFFF',     // background, layer-01, layer-02, layer-hover-01, field-02
           fg: '#161616', 'fg-muted': '#525252', 'fg-faint': '#5E5E5E',                                          // text-primary, -secondary, gray 60 hover (helper #6F6F6F is under AA on layer-01)
           line: '#C6C6C6', 'line-strong': '#8D8D8D', 'line-hi': '#0F62FE', bracket: '#8D8D8D',                  // border-subtle-01, border-strong-01, border-interactive
           accent: '#0F62FE', 'accent-fill': '#0F62FE', 'accent-fg': '#FFFFFF', 'accent-soft': '#D0E2FF',          // interactive, button-primary, highlight
           'accent-glow': '0 0 0 1px #0F62FE',
           ok: '#24A148', 'ok-fg': '#0E6027', 'ok-bg': '#DEFBE6',                                                // support-success; text green 70 on green 10
           warning: '#F1C21B', 'warning-fg': '#684E00', 'warning-bg': '#FCF4D6',                                 // yellow fill with dark text, as Carbon does
           critical: '#FF832B', 'critical-fg': '#BA4E00', 'critical-bg': '#FFF2E8',                              // text orange 60 (70 was too close to the red)
           expired: '#DA1E28', 'expired-fg': '#A2191F', 'expired-bg': '#FFF1F1',
           danger: '#DA1E28', 'danger-fg': '#A2191F', 'danger-bg': '#FFF1F1', 'on-danger': '#FFFFFF',
           blocked: '#8D8D8D', 'blocked-fg': '#525252', 'blocked-bg': '#E0E0E0',
           'c-blue': '#0043CE', 'c-teal': '#007D79', 'c-pink': '#D02670',                                        // blue 70, teal 60, magenta 60
           radius: '0px', 'radius-panel': '0px',
           shadow: '0 2px 6px rgba(0, 0, 0, .1)', 'shadow-pop': '0 2px 6px rgba(0, 0, 0, .3)', scrim: 'rgba(22, 22, 22, .5)' } },
    { key: 'primer-hc', name: 'Primer High Contrast', scheme: 'dark', group: 'Candidates', candidate: true, contrast: 'high',
      mood: 'GitHub Primer dark high contrast: built with accessibility experts - strong borders, no transparency, no glow.',
      swatches: ['#010409', '#FFFFFF', '#74B9FF', '#2BD853'],
      p: { bg: '#010409', surface: '#151B23', 'surface-2': '#262C36', 'surface-3': '#3D444D', inset: '#010409',     // bgColor default, muted, control, emphasis, inset
           fg: '#FFFFFF', 'fg-muted': '#B7BDC8', 'fg-faint': '#B7BDC8',                                          // fgColor default, muted
           line: '#B7BDC8', 'line-strong': '#B7BDC8', 'line-hi': '#409EFF', bracket: '#B7BDC8',                   // borderColor default / emphasis, accent emphasis
           accent: '#74B9FF', 'accent-fill': '#194FB1', 'accent-fg': '#FFFFFF', 'accent-soft': '#1C2A39',          // fgColor accent, bgColor accent emphasis; muted accent made solid over bgColor muted
           'accent-glow': '0 0 0 2px #409EFF', 'glow-ring': '100%', 'glow-blur': '0%',
           ok: '#09B43A', 'ok-fg': '#2BD853', 'ok-bg': '#133527',                                                // borderColor success emphasis, fgColor success; 15% muted made solid
           warning: '#F7C843', 'warning-fg': '#F7C843', 'warning-bg': '#353024',                                 // Primer yellow 2 (attention #e09b13 / #f0b72f was too close to severe)
           critical: '#FE9A2D', 'critical-fg': '#FE9A2D', 'critical-bg': '#2B2623',                              // severe
           expired: '#FF6A69', 'expired-fg': '#FF9492', 'expired-bg': '#2C252C',                                 // danger
           danger: '#FF6A69', 'danger-fg': '#FF9492', 'danger-bg': '#2C252C', 'on-danger': '#010409',
           blocked: '#9198A1', 'blocked-fg': '#B7BDC8', 'blocked-bg': '#262C36',
           'c-blue': '#4DA0FF', 'c-teal': '#1CB0AB', 'c-pink': '#E57BB2',                                        // Primer display blue / teal / pink 6
           shadow: 'none', 'shadow-pop': '0 0 0 1px #B7BDC8', scrim: 'rgba(1, 4, 9, .8)' } },

    /* Personal themes (Prince, 2026-09-25: "as personal themes, not office default"). Official palettes:
       Catppuccin (github.com/catppuccin/palette, palette.json, flavour mocha) and Gruvbox
       (github.com/morhetz/gruvbox, colors/gruvbox.vim, light: bg light0..4, fg dark1..4, faded accents).
       Only status tokens may leave the palette - to stay distinct (tests/contrast.js) and readable. */
    { key: 'catppuccin-mocha', name: 'Catppuccin Mocha', scheme: 'dark', group: 'Candidates', candidate: true, personal: true, grid: false,
      mood: 'Soft pastels on deep blue-violet - the most-loved editor theme, friendly for long shifts.',
      swatches: ['#1E1E2E', '#89B4FA', '#CBA6F7', '#CDD6F4'],
      p: { bg: '#181825', surface: '#1E1E2E', 'surface-2': '#313244', 'surface-3': '#45475A', inset: '#11111B',   // mantle, base, surface0, surface1, crust
           fg: '#CDD6F4', 'fg-muted': '#BAC2DE', 'fg-faint': '#A6ADC8',                                         // text, subtext1, subtext0
           line: '#313244', 'line-strong': '#45475A', 'line-hi': '#89B4FA', bracket: '#585B70',                   // surface0, surface1, blue, surface2
           accent: '#89B4FA', 'accent-fill': '#89B4FA', 'accent-fg': '#1E1E2E', 'accent-soft': 'rgba(137, 180, 250, .14)',   // blue; dark text on pastel, as Catppuccin does
           'accent-glow': '0 0 0 1px rgba(137, 180, 250, .6), 0 0 16px rgba(137, 180, 250, .22)',
           ok: '#A6E3A1', 'ok-fg': '#A6E3A1', 'ok-bg': 'rgba(166, 227, 161, .12)',                              // green
           warning: '#F9E2AF', 'warning-fg': '#F9E2AF', 'warning-bg': 'rgba(249, 226, 175, .12)',               // yellow
           critical: '#FAB387', 'critical-fg': '#FAB387', 'critical-bg': 'rgba(250, 179, 135, .13)',            // peach
           expired: '#F38BA8', 'expired-fg': '#F38BA8', 'expired-bg': 'rgba(243, 139, 168, .13)',              // red
           danger: '#F38BA8', 'danger-fg': '#F38BA8', 'danger-bg': 'rgba(243, 139, 168, .13)', 'on-danger': '#1E1E2E',
           blocked: '#7F849C', 'blocked-fg': '#A6ADC8', 'blocked-bg': 'rgba(127, 132, 156, .18)',              // overlay1, subtext0
           'c-blue': '#74C7EC', 'c-teal': '#94E2D5', 'c-pink': '#CBA6F7',                                        // sapphire, teal, mauve (not pink: never taken for red)
           radius: '8px', 'radius-panel': '12px' } },
    { key: 'gruvbox-light', name: 'Gruvbox Light', scheme: 'light', group: 'Candidates', candidate: true, personal: true,
      mood: 'Warm cream paper, dark brown ink, earthy colours - easy on the eyes in a bright room.',
      swatches: ['#FBF1C7', '#3C3836', '#076678', '#AF3A03'],
      p: { bg: '#F2E5BC', surface: '#FBF1C7', 'surface-2': '#F9F5D7', 'surface-3': '#EBDBB2', inset: '#F9F5D7',   // light0_soft, light0, light0_hard, light1
           fg: '#3C3836', 'fg-muted': '#504945', 'fg-faint': '#665C54',                                         // dark1, dark2, dark3
           line: '#D5C4A1', 'line-strong': '#BDAE93', 'line-hi': '#076678', bracket: '#A89984',                   // light2, light3, faded blue, light4
           accent: '#076678', 'accent-fill': '#076678', 'accent-fg': '#FBF1C7', 'accent-soft': '#E3E6CF',          // faded blue; soft = blue 8% on light0
           ok: '#98971A', 'ok-fg': '#66620B', 'ok-bg': '#EFEBC1',                                                // neutral green; text faded green darkened for AA
           warning: '#D79921', 'warning-fg': '#8B5E04', 'warning-bg': '#F8E7BC',                                 // neutral yellow; text faded yellow darkened for AA
           critical: '#D65D0E', 'critical-fg': '#A0480D', 'critical-bg': '#F8E0C2',                              // neutral orange; text between faded orange and red, AA on its tint
           expired: '#CC241D', 'expired-fg': '#9D0006', 'expired-bg': '#F6DCC4',                                 // neutral / faded red
           danger: '#CC241D', 'danger-fg': '#9D0006', 'danger-bg': '#F6DCC4', 'on-danger': '#FBF1C7',
           blocked: '#928374', 'blocked-fg': '#504945', 'blocked-bg': '#EBDBB2',                                 // gray, dark2, light1
           'c-blue': '#076678', 'c-teal': '#376A4B', 'c-pink': '#8F3F71' } },                                  // faded blue, aqua (darkened for AA), purple

    { key: 'hc', name: 'High contrast', scheme: 'dark', group: 'Accessibility', contrast: 'high',
      mood: 'Black, white and signal yellow - the strongest contrast, big focus ring.',
      swatches: ['#000000', '#FFFFFF', '#FFD400', '#3DDC84'],
      p: { bg: '#000000', surface: '#000000', 'surface-2': '#0A0A0A', 'surface-3': '#262626', inset: '#000000',
           fg: '#FFFFFF', 'fg-muted': '#FFFFFF', 'fg-faint': '#E6E6E6', accent: '#FFD400', 'accent-fg': '#000000',
           line: '#FFFFFF', 'line-strong': '#FFFFFF', 'line-hi': '#FFD400', bracket: '#FFFFFF', 'accent-soft': 'rgba(255, 212, 0, .18)',
           'accent-glow': '0 0 0 2px #FFD400',
           ok: '#3DDC84', 'ok-fg': '#3DDC84', 'ok-bg': '#000000', warning: '#FFB000', 'warning-fg': '#FFB000', 'warning-bg': '#000000',
           critical: '#FF8C1A', 'critical-fg': '#FF8C1A', 'critical-bg': '#000000', expired: '#FF6B6B', 'expired-fg': '#FF6B6B', 'expired-bg': '#000000',
           danger: '#FF6B6B', 'danger-fg': '#FF6B6B', 'danger-bg': '#000000', blocked: '#C8C8C8', 'blocked-fg': '#C8C8C8', 'blocked-bg': '#000000',
           'on-danger': '#000000', 'c-blue': '#7CC4FF', 'c-teal': '#3EE6D0', 'c-pink': '#FF85CC',
           'glow-ring': '100%', 'glow-blur': '0%', shadow: 'none', 'shadow-pop': '0 0 0 2px #FFFFFF', scrim: 'rgba(0, 0, 0, .75)' } }
  ];

  function rgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [n >> 16, n >> 8 & 255, n & 255].join(', ');
  }

  /** Every token of a theme, as {name: value} (names without the leading --). */
  function tokens(t) {
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
    Object.keys(p).forEach(function (k) { if (k !== 'ink') o[k] = p[k]; });    // the theme's own values win
    return o;
  }

  /** The CSS of all themes: one [data-theme="key"] block each (the default also on :root). */
  function css() {
    return THEMES.map(function (t) {
      var o = tokens(t);
      var sel = (t.key === DEFAULT ? ':root, ' : '') + '[data-theme="' + t.key + '"]';
      return sel + ' {\n  color-scheme: ' + t.scheme + ';\n' + Object.keys(o).map(function (k) { return '  --' + k + ': ' + o[k] + ';'; }).join('\n') + '\n}';
    }).join('\n');
  }

  function byKey(key) { return THEMES.filter(function (t) { return t.key === key; })[0] || null; }

  /** The attributes that put a theme on an element (the page, or a ui-kit sample). */
  function attrs(key) {
    var t = byKey(key) || byKey(DEFAULT);
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
