/**
 * Metrology Request Tracker - seed.js
 *
 * THE STARTING DATA. A brand-new data file (first run on an empty data\
 * folder) is built from this file - nothing else. It is reference data the
 * office needs, so it lives in the repo; live data never does
 * (CLAUDE.md "Data in the repo").
 *
 * FAKE ENTRIES are marked  sample: true  - made up so the app can be tried
 * before the real lists exist (DECISIONS M1-8). When the real values come:
 *   - replace them here (and drop  sample: true ), so every NEW data file
 *     starts right, and
 *   - fix an EXISTING data file in Settings (Health lists what is still sample).
 * Checklist: OFFICE_SETUP.md.
 *
 * Changing this file never changes an existing data\mrt_data.json.
 * People are never listed here: they add themselves (no personal data on GitHub).
 *
 * Shapes (all optional unless noted):
 *   tools[]:  code (required, 1-6 capitals), name (required), glyph
 *             (hrm | aoi | prf | qvm | fib | generic), results_root ('\\server\share\...'),
 *             destructive (true = measuring destroys the panels; requests must confirm, M2-11),
 *             types[]:  { name, sample }
 *             bkms[]:   { name, type (a type name of this tool, or null), path, doc_version, sample }
 *             fields[]: { label, type (text | longtext | number | choice | multichoice |
 *                         yesno | date | path), required, help, unit, min, max,
 *                         choices: ['A', 'B'], only_for: [type names] }
 *   part_numbers[]: { code (capitals, digits, - . _ /), description, projects: [project codes] }
 *             (DECISIONS M1-13: one part number may belong to several projects)
 *   closing_days[]: { date: 'YYYY-MM-DD', name }  - company closing days (not public holidays)
 *   public_holidays: Austrian public holidays are added for this year and next, by rule.
 */
window.MRT = window.MRT || {};
window.MRT.seed = {

  // Lab calendar, Europe/Vienna (DECISIONS M1-9). Days: 1 = Monday ... 7 = Sunday.
  calendar: { days: [1, 2, 3, 4, 5], start: '07:00', end: '18:00' },   // days Mon-Fri: not yet confirmed

  // Company closing days, e.g. { date: '2026-12-24', name: 'Christmas Eve' }. None known yet.
  closing_days: [],

  // Q26 - real. Word shown big, code small; renamable in Settings.
  priorities: [
    { code: 'P1', name: 'Line stop', level: 1, needs_reason: true,  is_default: false },
    { code: 'P2', name: 'Hot',       level: 2, needs_reason: true,  is_default: false },
    { code: 'P3', name: 'Normal',    level: 3, needs_reason: false, is_default: true  },
    { code: 'P4', name: 'Low',       level: 4, needs_reason: false, is_default: false }
  ],

  // Copied from ABF Tracker's first-run defaults - please confirm.
  projects: [
    { code: 'C4F', name: 'Chiplet4Future' },
    { code: 'SHIFT', name: '' },
    { code: 'HORUS', name: '' }
  ],
  // Part numbers per project (DECISIONS M1-13). None known yet - admins add them in
  // Settings > Lists; real ones go here too so a new data file starts with them.
  part_numbers: [],

  // Process steps ("the panels are after ..."), in line order (DECISIONS M2-7). None known yet -
  // e.g. ['After desmear', 'After Cu plating'] once Prince gives the real list.
  process_steps: [],

  buildups: ['BU-01', 'BU-02', 'BU-03', 'BU-04', 'BU-05', 'TEST', 'DOE', 'OPT'],

  // Q24 - the five tools are real. Their types and BKMs are SAMPLE (fake) for now;
  // operators are set in Settings (they are people); results roots and fields: none known yet.
  tools: [
    {
      code: 'HRM', name: 'HRM (roughness)', glyph: 'hrm', results_root: '',
      types: [
        { name: 'Cu roughness after treatment', sample: true },
        { name: 'Dielectric roughness after desmear', sample: true },
        { name: 'Solder resist roughness', sample: true },
        { name: 'Line roughness Ra/Rz', sample: true },
        { name: 'Areal roughness Sa/Sz', sample: true }
      ],
      bkms: [
        { name: 'HRM Cu roughness after treatment (sample)', type: 'Cu roughness after treatment', path: '\\\\SAMPLE-SHARE\\BKM\\HRM\\HRM_Cu_roughness_after_treatment.pdf', doc_version: 'v0 (sample)', sample: true },
        { name: 'HRM Dielectric roughness after desmear (sample)', type: 'Dielectric roughness after desmear', path: '\\\\SAMPLE-SHARE\\BKM\\HRM\\HRM_Dielectric_roughness_after_desmear.pdf', doc_version: 'v0 (sample)', sample: true },
        { name: 'HRM Solder resist roughness (sample)', type: 'Solder resist roughness', path: '\\\\SAMPLE-SHARE\\BKM\\HRM\\HRM_Solder_resist_roughness.pdf', doc_version: 'v0 (sample)', sample: true },
        { name: 'HRM Line roughness Ra/Rz (sample)', type: 'Line roughness Ra/Rz', path: '\\\\SAMPLE-SHARE\\BKM\\HRM\\HRM_Line_roughness_Ra_Rz.pdf', doc_version: 'v0 (sample)', sample: true },
        { name: 'HRM Areal roughness Sa/Sz (sample)', type: 'Areal roughness Sa/Sz', path: '\\\\SAMPLE-SHARE\\BKM\\HRM\\HRM_Areal_roughness_Sa_Sz.pdf', doc_version: 'v0 (sample)', sample: true }
      ],
      fields: []
    },
    {
      code: 'AOI', name: 'AOI', glyph: 'aoi', results_root: '',
      types: [
        { name: 'Full panel inspection', sample: true },
        { name: 'Defect review', sample: true },
        { name: 'Line/space check', sample: true },
        { name: 'Via inspection', sample: true },
        { name: 'Registration check', sample: true }
      ],
      bkms: [
        { name: 'AOI Full panel inspection (sample)', type: 'Full panel inspection', path: '\\\\SAMPLE-SHARE\\BKM\\AOI\\AOI_Full_panel_inspection.pdf', doc_version: 'v0 (sample)', sample: true },
        { name: 'AOI Defect review (sample)', type: 'Defect review', path: '\\\\SAMPLE-SHARE\\BKM\\AOI\\AOI_Defect_review.pdf', doc_version: 'v0 (sample)', sample: true },
        { name: 'AOI Line/space check (sample)', type: 'Line/space check', path: '\\\\SAMPLE-SHARE\\BKM\\AOI\\AOI_Line_space_check.pdf', doc_version: 'v0 (sample)', sample: true },
        { name: 'AOI Via inspection (sample)', type: 'Via inspection', path: '\\\\SAMPLE-SHARE\\BKM\\AOI\\AOI_Via_inspection.pdf', doc_version: 'v0 (sample)', sample: true },
        { name: 'AOI Registration check (sample)', type: 'Registration check', path: '\\\\SAMPLE-SHARE\\BKM\\AOI\\AOI_Registration_check.pdf', doc_version: 'v0 (sample)', sample: true }
      ],
      fields: []
    },
    {
      code: 'PRF', name: 'PRF (profilometer)', glyph: 'prf', results_root: '',
      types: [
        { name: '2D profile', sample: true },
        { name: '3D scan', sample: true },
        { name: 'Step height', sample: true },
        { name: 'Bow / warpage', sample: true },
        { name: 'Plating thickness profile', sample: true }
      ],
      bkms: [
        { name: 'PRF 2D profile (sample)', type: '2D profile', path: '\\\\SAMPLE-SHARE\\BKM\\PRF\\PRF_2D_profile.pdf', doc_version: 'v0 (sample)', sample: true },
        { name: 'PRF 3D scan (sample)', type: '3D scan', path: '\\\\SAMPLE-SHARE\\BKM\\PRF\\PRF_3D_scan.pdf', doc_version: 'v0 (sample)', sample: true },
        { name: 'PRF Step height (sample)', type: 'Step height', path: '\\\\SAMPLE-SHARE\\BKM\\PRF\\PRF_Step_height.pdf', doc_version: 'v0 (sample)', sample: true },
        { name: 'PRF Bow / warpage (sample)', type: 'Bow / warpage', path: '\\\\SAMPLE-SHARE\\BKM\\PRF\\PRF_Bow_warpage.pdf', doc_version: 'v0 (sample)', sample: true },
        { name: 'PRF Plating thickness profile (sample)', type: 'Plating thickness profile', path: '\\\\SAMPLE-SHARE\\BKM\\PRF\\PRF_Plating_thickness_profile.pdf', doc_version: 'v0 (sample)', sample: true }
      ],
      fields: []
    },
    {
      code: 'QVM', name: 'QVM (vision measuring)', glyph: 'qvm', results_root: '',
      types: [
        { name: 'Via diameter', sample: true },
        { name: 'Line width / space', sample: true },
        { name: 'Pad size', sample: true },
        { name: 'Position / registration', sample: true },
        { name: 'Solder mask opening', sample: true }
      ],
      bkms: [
        { name: 'QVM Via diameter (sample)', type: 'Via diameter', path: '\\\\SAMPLE-SHARE\\BKM\\QVM\\QVM_Via_diameter.pdf', doc_version: 'v0 (sample)', sample: true },
        { name: 'QVM Line width / space (sample)', type: 'Line width / space', path: '\\\\SAMPLE-SHARE\\BKM\\QVM\\QVM_Line_width_space.pdf', doc_version: 'v0 (sample)', sample: true },
        { name: 'QVM Pad size (sample)', type: 'Pad size', path: '\\\\SAMPLE-SHARE\\BKM\\QVM\\QVM_Pad_size.pdf', doc_version: 'v0 (sample)', sample: true },
        { name: 'QVM Position / registration (sample)', type: 'Position / registration', path: '\\\\SAMPLE-SHARE\\BKM\\QVM\\QVM_Position_registration.pdf', doc_version: 'v0 (sample)', sample: true },
        { name: 'QVM Solder mask opening (sample)', type: 'Solder mask opening', path: '\\\\SAMPLE-SHARE\\BKM\\QVM\\QVM_Solder_mask_opening.pdf', doc_version: 'v0 (sample)', sample: true }
      ],
      fields: []
    },
    {
      code: 'FIB', name: 'FIB', glyph: 'fib', results_root: '', destructive: true,
      types: [
        { name: 'Via cross-section', sample: true },
        { name: 'Line cross-section', sample: true },
        { name: 'Interface / void check', sample: true },
        { name: 'Layer thickness', sample: true },
        { name: 'TEM lamella prep', sample: true }
      ],
      bkms: [
        { name: 'FIB Via cross-section (sample)', type: 'Via cross-section', path: '\\\\SAMPLE-SHARE\\BKM\\FIB\\FIB_Via_cross_section.pdf', doc_version: 'v0 (sample)', sample: true },
        { name: 'FIB Line cross-section (sample)', type: 'Line cross-section', path: '\\\\SAMPLE-SHARE\\BKM\\FIB\\FIB_Line_cross_section.pdf', doc_version: 'v0 (sample)', sample: true },
        { name: 'FIB Interface / void check (sample)', type: 'Interface / void check', path: '\\\\SAMPLE-SHARE\\BKM\\FIB\\FIB_Interface_void_check.pdf', doc_version: 'v0 (sample)', sample: true },
        { name: 'FIB Layer thickness (sample)', type: 'Layer thickness', path: '\\\\SAMPLE-SHARE\\BKM\\FIB\\FIB_Layer_thickness.pdf', doc_version: 'v0 (sample)', sample: true },
        { name: 'FIB TEM lamella prep (sample)', type: 'TEM lamella prep', path: '\\\\SAMPLE-SHARE\\BKM\\FIB\\FIB_TEM_lamella_prep.pdf', doc_version: 'v0 (sample)', sample: true }
      ],
      fields: []
    }
  ]
};
