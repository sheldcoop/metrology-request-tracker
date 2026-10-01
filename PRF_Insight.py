r"""
PRF Insight
===========
One tool for Zeta/PRF measurement folders: it finds the log folders, sorts the
files into roughness and top-to-bottom (via), labels them by unit, calculates
the results and writes one checked Excel report with charts.

Everything that is in the folder path is read automatically:
    ...\<Project>\<Part number>\<Lot number>\...\BU-01\...\Panel 3\Front\...\log
You only type: units, lot name and process.

Run (Anaconda Prompt):
    python PRF_Insight.py                    -> uses settings_Insight.yaml next to this file
    python PRF_Insight.py my_settings.yaml   -> uses another settings file
    python PRF_Insight.py --preview          -> show the plan only, write nothing

Output sheets: Summary, Charts, T2B, Roughness, T2B_raw, Roughness_raw, Log
Units: T2B in um, roughness in nm.
If root / output_folder are empty in settings, a folder picker pops up.
"""

import json
import math
import os
import re
import shutil
import tempfile
import sys
from datetime import date, datetime

import numpy as np
import pandas as pd
import yaml

VERSION = '8.0 Insight'

# -----------------------------------------------------------------------------
# Log: every message goes to the terminal AND to the Log sheet
# -----------------------------------------------------------------------------
LOG = []
PREVIEW = [False]
CURRENT_BU = ['']          # buildup being processed, shown in the Log sheet
CURRENT_LOT = ['']         # lot being processed, shown in the Log sheet


def log(level, msg, panel='', side=''):
    LOG.append({'Level': level, 'Lot': CURRENT_LOT[0] if panel != '' else '',
                'Buildup': CURRENT_BU[0] if panel != '' else '',
                'Panel': panel, 'Side': side, 'Message': msg})
    prefix = '' if level == 'INFO' else f'{level}: '
    print(f'  {prefix}{msg}')


# =============================================================================
# 1. SETTINGS
# =============================================================================
REQUIRED = ['lot_name', 'process']

DEFAULTS = {'roughness_positions': ['BKM roughness position', 'Next to via'],
            'filter_outliers': False,
            'nr_sigma': 2,
            'flag_factor': 1.5,
            'spec_limits': {},
            'panel_units': {},
            'decimals': 3,
            'panels': 'all',
            'front_roughness_positions': [], 'back_roughness_positions': [],
            'vias_per_unit': None, 'vias_per_coupon': None,
            'front_vias_per_unit': None, 'front_vias_per_coupon': None,
            'back_vias_per_unit': None, 'back_vias_per_coupon': None,
            'charts': True, 'preview': False,
            'project_name': 'auto', 'part_number': 'auto', 'lot_number': 'auto',
            'buildup': 'auto',
            'front_roughness_units': [], 'back_roughness_units': [],
            'front_via_units': [], 'back_via_units': [],
            'file_ending': '.txt'}


def load_settings(path):
    with open(path, 'r', encoding='utf-8') as f:
        cfg = yaml.safe_load(f)
    missing = [k for k in REQUIRED if k not in cfg or cfg[k] in (None, '')]
    cfg['root'] = (cfg.get('root') or '').strip()
    cfg['output_folder'] = (cfg.get('output_folder') or '').strip()
    if missing:
        sys.exit(f'ERROR: missing in settings: {missing}')
    for k, v in DEFAULTS.items():
        if cfg.get(k) is None:
            cfg[k] = v
    cfg['decimals'] = int(cfg['decimals'])
    cfg['buildup'] = str(cfg['buildup']).strip()
    cfg['bu_auto'] = cfg['buildup'].lower() == 'auto'
    cfg['bu_filter'] = None if cfg['bu_auto'] else bu_number(cfg['buildup'])
    # panels: 'all' (or empty) = every panel found in the folders
    pv = cfg['panels']
    if pv in ('', [], None) or (isinstance(pv, str) and pv.strip().lower() == 'all'):
        cfg['panels'] = None
    else:
        cfg['panels'] = [int(p) for p in (pv if isinstance(pv, list) else [pv])]
    # project / part / lot: 'auto' = read from path, anything else = forced value
    for k in ('project_name', 'part_number', 'lot_number'):
        v = str(cfg[k]).strip()
        cfg[k] = v
        cfg[f'{k}_auto'] = v.lower() == 'auto'
    # via units: if empty, use the roughness units (and the other way round)
    for side in ('front', 'back'):
        if not cfg[f'{side}_via_units']:
            cfg[f'{side}_via_units'] = cfg[f'{side}_roughness_units']
        if not cfg[f'{side}_roughness_units']:
            cfg[f'{side}_roughness_units'] = cfg[f'{side}_via_units']
        if not cfg[f'{side}_via_units'] and not cfg.get(f'{side}_via_sequence'):
            print(f'NOTE: no units set for {side} side.')
    cfg['panel_units'] = {int(k): (v or {}) for k, v in (cfg.get('panel_units') or {}).items()}
    for k in ('vias_per_unit', 'vias_per_coupon',
              'front_vias_per_unit', 'front_vias_per_coupon',
              'back_vias_per_unit', 'back_vias_per_coupon'):
        cfg[k] = int(cfg[k]) if cfg[k] not in (None, '', 0) else None
    return cfg


def check_settings(cfg):
    """Report every settings problem at once, before any folder is read."""
    bad = []
    for side in ('front', 'back'):
        pos = cfg[f'{side}_roughness_positions'] or cfg['roughness_positions']
        if not pos:
            bad.append(f'{side}: no roughness positions set')
        units = cfg[f'{side}_roughness_units']
        if units and len(set(map(str, units))) != len(units):
            bad.append(f'{side}_roughness_units has the same unit twice: {units}')
    if cfg['decimals'] < 0 or cfg['decimals'] > 6:
        bad.append(f"decimals must be between 0 and 6, not {cfg['decimals']}")
    for key in (cfg.get('spec_limits') or {}):
        if key not in SPEC_KEYS:
            bad.append(f'unknown spec limit "{key}" (allowed: {", ".join(SPEC_KEYS)})')
    for pre in ('', 'front_', 'back_'):
        if cfg[f'{pre}vias_per_coupon'] and not (cfg[f'{pre}vias_per_unit'] or cfg['vias_per_unit']):
            bad.append(f'{pre}vias_per_coupon is set but {pre}vias_per_unit is not')
    if bad:
        print('\nSettings problems:')
        for b in bad:
            print(f'  - {b}')
        print()
    return bad


def get_positions(cfg, panel, side):
    """Roughness position names for this side (panel override -> side -> general)."""
    side = side.lower()
    over = cfg['panel_units'].get(panel, {})
    for val, src in ((over.get(f'{side}_roughness_positions'), 'panel'),
                     (cfg[f'{side}_roughness_positions'], side),
                     (cfg['roughness_positions'], 'general')):
        if val:
            return list(val), src
    return [], 'none'


def get_sequence(cfg, panel, side):
    """Optional via sequence for uneven panels. None if not set.

    Two ways to write it in the settings:
        front_via_sequence: '3x3, 2x4, C1x5'
        front_via_sequence:
          - [3, 3]
          - [C1, 5]
    """
    side = side.lower()
    seq = cfg['panel_units'].get(panel, {}).get(f'{side}_via_sequence') or \
        cfg.get(f'{side}_via_sequence')
    if not seq:
        return None

    if isinstance(seq, str):                       # '3x3, 2x4, C1x5'
        items = []
        for part in re.split(r'[,;]', seq):
            part = part.strip()
            if not part:
                continue
            m = re.fullmatch(r'([A-Za-z]*\d+)\s*[xX*]\s*(\d+)', part)
            if not m:
                log('WARNING', f'Bad via sequence part "{part}". Expected e.g. 3x4. '
                    f'Sequence ignored.', panel, side)
                return None
            items.append((m.group(1), m.group(2)))
    else:                                          # [[3, 3], [C1, 5]]
        items = []
        for item in seq:
            if not isinstance(item, (list, tuple)) or len(item) != 2:
                log('WARNING', f'Bad via sequence entry {item}. Sequence ignored.', panel, side)
                return None
            items.append(item)

    out = []
    for label, count in items:
        try:
            count = int(count)
        except (TypeError, ValueError):
            log('WARNING', f'Bad via count "{count}". Sequence ignored.', panel, side)
            return None
        if count < 1:
            log('WARNING', f'Via count must be 1 or more ({label}). Sequence ignored.', panel, side)
            return None
        out.append((str(label).strip(), count))
    return out


def unit_type(label):
    """'3' -> Unit, 'C1' -> Coupon"""
    return 'Unit' if str(label).strip().lstrip('-').isdigit() else 'Coupon'


def as_label(label):
    """Keep numbers as numbers, coupons as text."""
    t = str(label).strip()
    return int(t) if t.lstrip('-').isdigit() else t


def get_units(cfg, panel, side, kind):
    """Unit list for panel/side/kind ('roughness' or 'via').
    Order: panel override -> (via only) panel roughness override -> global setting."""
    side = side.lower()
    over = cfg['panel_units'].get(panel, {})
    val = over.get(f'{side}_{kind}_units')
    if val:
        return list(val), 'panel'
    if kind == 'via' and over.get(f'{side}_roughness_units'):
        return list(over[f'{side}_roughness_units']), 'panel'
    return list(cfg[f'{side}_{kind}_units']), 'global'


# =============================================================================
# 2. FOLDERS
# =============================================================================
MEMORY_FILE = '.prf_insight_folders.json'


def pick_folder(title, start, here):
    """Windows folder picker. Returns '' on cancel."""
    try:
        import tkinter as tk
        from tkinter import filedialog
    except ImportError:
        sys.exit('ERROR: folder picker not available. Fill root/output_folder in settings.')
    win = tk.Tk()
    win.withdraw()
    win.attributes('-topmost', True)
    path = filedialog.askdirectory(title=title, initialdir=start or here, parent=win)
    win.destroy()
    return os.path.normpath(path) if path else ''


def resolve_folders(cfg, here):
    """Ask for root/output_folder with a popup if they are empty in settings."""
    mem_path = os.path.join(here, MEMORY_FILE)
    try:
        with open(mem_path, 'r', encoding='utf-8') as f:
            mem = json.load(f)
    except Exception:
        mem = {}

    if not cfg['root']:
        cfg['root'] = pick_folder('Select ROOT folder (contains the panels)', mem.get('root'), here)
        if not cfg['root']:
            sys.exit('Cancelled. No root folder selected.')
    if not cfg['output_folder']:
        cfg['output_folder'] = pick_folder('Select OUTPUT folder for the Excel file',
                                           mem.get('output_folder') or cfg['root'], here)
        if not cfg['output_folder']:
            sys.exit('Cancelled. No output folder selected.')

    try:
        with open(mem_path, 'w', encoding='utf-8') as f:
            json.dump({'root': cfg['root'], 'output_folder': cfg['output_folder']}, f, indent=2)
    except Exception:
        pass


BU_RE = re.compile(r'(?<![a-z])bu[\s_\-]*0*(\d+)(?!\d)', re.IGNORECASE)


def bu_number(text):
    """'BU-01' / 'BU01' / 'bu 1' -> 1, else None"""
    m = BU_RE.search(str(text))
    return int(m.group(1)) if m else None


def bu_label(n):
    return f'BU{n:02d}' if n is not None else ''


PANEL_RE = re.compile(r'^\s*panel[\s_\-]*0*(\d+)(?!\d)', re.IGNORECASE)
SIDE_RE = re.compile(r'(?<![a-z])(front|back)(?![a-z])', re.IGNORECASE)


def panel_side_from_path(parts):
    """Return (panels found, sides found) from a list of folder names."""
    panels = {int(m.group(1)) for p in parts for m in [PANEL_RE.match(p)] if m}
    sides = {m.group(1).capitalize() for p in parts for m in SIDE_RE.finditer(p)}
    return panels, sides


LOT_RE = re.compile(r'^\d{5}(?:\.\d+)?$')


ANCHOR_RE = re.compile(r'^(prf|bu[\s_\-]*0*\d+)$', re.IGNORECASE)


def lot_from_path(parts):
    """Find <Project>\\<Part>\\<Lot> in a list of folder names.
    Returns (project, part, lot) or None, or 'several' if 2+ lot folders."""
    hits = [i for i, p in enumerate(parts) if LOT_RE.match(p.strip())]
    if not hits:
        # no 5-digit folder: the lot is the folder just above PRF / BU-xx
        anchors = [i for i, p in enumerate(parts) if ANCHOR_RE.match(p.strip())]
        if not anchors or anchors[0] < 1:
            return None
        hits = [anchors[0] - 1]
    if len({parts[i].strip() for i in hits}) > 1:
        return 'several'
    i = hits[-1]
    part = parts[i - 1].strip() if i >= 1 else ''
    project = parts[i - 2].strip() if i >= 2 else ''
    return project, part, parts[i].strip()


def index_log_folders(root):
    """
    Walk root, find every 'log' folder, read Lot/Buildup/Panel/Side from its path.
    Returns ({(lot, bu, panel, side): [log folders]}, {lot: (project, part)}, [problems]).
    lot is None when the path has no lot folder; bu is None when it has no BU folder.
    """
    index, lots, problems = {}, {}, []
    root = os.path.normpath(root)
    root_parts = root.split(os.sep)
    for dirpath, dirnames, _ in os.walk(root):
        logs = [d for d in dirnames if d.strip().lower() == 'log']
        dirnames[:] = [d for d in dirnames if d.strip().lower() != 'log']   # do not go inside log
        for d in logs:
            full = os.path.join(dirpath, d)
            rel_parts = os.path.relpath(dirpath, root).split(os.sep)
            rel_parts = [x for x in rel_parts if x not in ('.', '')]
            panels, sides = panel_side_from_path(rel_parts)
            # nothing below root? fall back to the root path itself (root = a panel/side folder)
            if not panels:
                panels = panel_side_from_path(root_parts)[0]
            if not sides:
                sides = panel_side_from_path(root_parts)[1]

            if len(panels) != 1:
                problems.append(f'{"No" if not panels else "Several"} panel number in path, skipped: {full}')
                continue
            if len(sides) != 1:
                problems.append(f'{"No" if not sides else "Both"} Front/Back in path, skipped: {full}')
                continue
            bus = {bu_number(x) for x in rel_parts} - {None}
            if not bus:
                bus = {bu_number(x) for x in root_parts} - {None}
            if len(bus) > 1:
                problems.append(f'Several buildups in path, skipped: {full}')
                continue
            bu = bus.pop() if bus else None

            found = lot_from_path(os.path.normpath(dirpath).split(os.sep))
            if found == 'several':
                problems.append(f'Several lot folders in path, skipped: {full}')
                continue
            if found is None:
                lot = None
            else:
                project, part, lot = found
                lots.setdefault(lot, (project, part))
            index.setdefault((lot, bu, panels.pop(), sides.pop()), []).append(full)
    return index, lots, problems


def site_number(path):
    nums = re.findall(r'\d+', os.path.splitext(os.path.basename(path))[0])
    return int(nums[-1]) if nums else -1


# =============================================================================
# 3. CLASSIFY + PARSE
# =============================================================================
def read_lines(path):
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        return f.read().splitlines()


def split(line):
    sep = '\t' if '\t' in line else ','
    return [c.strip() for c in line.split(sep)]


def classify(lines):
    text = '\n'.join(lines)
    if 'Diamond Area' in text or re.search(r'Index\s*[\t,]\s*CenterX', text):
        return 'via'
    for ln in lines:
        cells = [c for c in split(ln) if c]
        if cells[:2] == ['Ra', 'Rq']:
            return 'roughness'
    return 'unknown'


def to_float(s):
    try:
        return float(s)
    except ValueError:
        return None


def parse_roughness(lines):
    """Per-line table with Ra, Rq, Rpv, Rz, Rku (values in um as in file)."""
    header, rows = None, []
    for ln in lines:
        cells = split(ln)
        clean = [c for c in cells if c]
        if header is None:
            if clean[:2] == ['Ra', 'Rq']:
                header = clean
            continue
        if not clean:
            continue
        if clean[0] in ('Min', 'Max', 'Mean', 'SD', 'Var%'):
            break
        vals = [to_float(c) for c in clean]
        if len(vals) >= len(header) and all(v is not None for v in vals[:len(header)]):
            rows.append(vals[:len(header)])
    if header is None:
        raise ValueError('roughness header not found')
    return pd.DataFrame(rows, columns=header)


def parse_via(lines):
    """Circle table: CenterX, CenterY, MajorAxis, MinorAxis, Avg/Min/MaxHeight."""
    header, rows = None, []
    for ln in lines:
        cells = split(ln)
        if header is None:
            if cells and cells[0] == 'Index' and 'CenterX' in cells:
                header = [c for c in cells if c]
            continue
        if not cells or not re.fullmatch(r'\d+', cells[0]):
            continue
        vals = [to_float(c) for c in cells if c]
        if len(vals) >= len(header):
            rows.append(vals[:len(header)])
    if header is None:
        raise ValueError('via header not found')
    return pd.DataFrame(rows, columns=header)


# =============================================================================
# 3b. SITE CHECKS
# =============================================================================
def compress(nums):
    """[1,2,3,7,9,10] -> '1-3, 7, 9-10'"""
    out, nums = [], sorted(nums)
    i = 0
    while i < len(nums):
        j = i
        while j + 1 < len(nums) and nums[j + 1] == nums[j] + 1:
            j += 1
        out.append(str(nums[i]) if i == j else f'{nums[i]}-{nums[j]}')
        i = j + 1
    return ', '.join(out)


def check_sites(typed, r_units, v_units, n_pos, panel, side, sequence=None):
    """typed = [(site, 'R'|'V'|'?'), ...] sorted by site."""
    sites = [t[0] for t in typed]

    # duplicates
    dups = sorted({x for x in sites if sites.count(x) > 1})
    if dups:
        log('WARNING', f'Duplicate site numbers: {compress(dups)}', panel, side)

    # missing sites (gaps from 1 to highest site)
    if sites and max(sites) > 0:
        missing = sorted(set(range(1, max(sites) + 1)) - set(sites))
        if missing:
            log('WARNING', f'Missing sites: {compress(missing)} '
                           f'(found {len(sites)}, highest site {max(sites)})', panel, side)
        else:
            log('INFO', f'Sites complete: 1-{max(sites)}', panel, side)

    # roughness sites should come in consecutive groups (e.g. pairs)
    r_sites = [s for s, t in typed if t == 'R']
    if n_pos > 1 and r_sites and len(r_sites) % n_pos == 0:
        bad = []
        for k in range(0, len(r_sites), n_pos):
            grp = r_sites[k:k + n_pos]
            if grp[-1] - grp[0] != n_pos - 1:
                bad.append('/'.join(map(str, grp)))
        if bad:
            log('WARNING', f'Roughness sites not consecutive: {", ".join(bad)}. '
                           f'Position labels may be wrong.', panel, side)

    # block pattern: every unit block should look the same (e.g. VVVVVRR)
    n = len(r_units)
    if sequence:
        log('INFO', 'Site pattern check skipped (via sequence is uneven by design).', panel, side)
    elif n and n == len(v_units) and typed and len(typed) % n == 0:
        size = len(typed) // n
        pattern = lambda b: ''.join(t for _, t in typed[b * size:(b + 1) * size])
        ref = pattern(0)
        odd = [b for b in range(n) if pattern(b) != ref]
        if odd:
            txt = '; '.join(f'block {b + 1} (sites {typed[b * size][0]}-{typed[(b + 1) * size - 1][0]}) '
                            f'= {pattern(b)}' for b in odd)
            log('WARNING', f'Site pattern differs from block 1 ({ref}): {txt}. '
                           f'Check for missing/extra files.', panel, side)
        else:
            log('INFO', f'Site pattern OK: {n} blocks of {ref} (V=via, R=roughness)', panel, side)
    elif typed:
        log('INFO', 'Site pattern check skipped (unit counts or file count do not match blocks).',
            panel, side)


# =============================================================================
# 4. ROUGHNESS
# =============================================================================
def process_roughness(files, units, cfg, meta, side, positions):
    labels = [(u, p) for u in units for p in positions]
    if not units:
        log('ERROR', f'Roughness: {len(files)} files found but no roughness units set. '
            f'Roughness skipped.', meta['Panel'], side)
        return [], []
    if len(files) != len(labels):
        log('ERROR', f'Roughness: {len(files)} files but {len(units)} units x '
            f'{len(positions)} positions = {len(labels)}. Roughness skipped.', meta['Panel'], side)
        return [], []

    summary, raw = [], []
    for (path, lines), (unit, pos) in zip(files, labels):
        site = site_number(path)
        df = parse_roughness(lines)
        med_rz = df['Rz'].median()
        df['Flag'] = df['Rz'] > cfg['flag_factor'] * med_rz

        used = pd.Series(True, index=df.index)
        if cfg['filter_outliers'] and len(df) > 2:
            sub = df[['Ra', 'Rz']]
            z = (sub - sub.mean()) / sub.std(ddof=0)
            used = (z.abs() < cfg['nr_sigma']).all(axis=1)
        df['Used'] = used
        d = df[used]

        row = {**meta, 'Side': side, 'Type': unit_type(unit), 'Unit': as_label(unit),
               'Measurement_Position': pos, 'Site': site}
        for p in ['Ra', 'Rz']:
            nm = d[p] * 1000
            row[f'{p}_Mean_nm'] = round(nm.mean(), 6)
            row[f'{p}_Std_nm'] = round(nm.std(), 6)
            row[f'{p}_Min_nm'] = round(nm.min(), 6)
            row[f'{p}_Max_nm'] = round(nm.max(), 6)
        row['Lines_Used'] = int(used.sum())
        row['Lines_Flagged'] = int(df['Flag'].sum())
        row['Flag'] = 'CHECK' if row['Lines_Flagged'] else ''
        if row['Flag']:
            log('WARNING', f"Roughness site {site}: {row['Lines_Flagged']} spiky line(s). Row flagged.",
                meta['Panel'], side)
        summary.append(row)

        for i, r in df.iterrows():
            raw.append({'Lot_Number': meta['Lot_Number'], 'Buildup': meta['Buildup'],
                        'Panel': meta['Panel'], 'Side': side, 'Unit': unit,
                        'Measurement_Position': pos, 'Site': site,
                        'File': os.path.basename(path), 'Line': i + 1,
                        'Ra_nm': round(r['Ra'] * 1000, 6),
                        'Rq_nm': round(r['Rq'] * 1000, 6),
                        'Rz_nm': round(r['Rz'] * 1000, 6),
                        'Rpv_nm': round(r['Rpv'] * 1000, 6),
                        'Rku': round(r['Rku'], 6),
                        'Used': bool(r['Used']),
                        'Flag': 'CHECK' if r['Flag'] else ''})
    return summary, raw


# =============================================================================
# 5. TOP TO BOTTOM (VIA)
# =============================================================================
def circle_values(c):
    L, S = c['MajorAxis'], c['MinorAxis']
    D = (L + S) / 2
    R = (1 - (L - S) / D) * 100
    return L, S, D, R


def via_counts(cfg, panel, side):
    """(vias per unit, vias per coupon) - panel override, then side, then general."""
    side = side.lower()
    over = cfg['panel_units'].get(panel, {})
    out = []
    for kind in ('vias_per_unit', 'vias_per_coupon'):
        out.append(over.get(f'{side}_{kind}') or cfg[f'{side}_{kind}'] or cfg[kind])
    return out[0], out[1]


def counts_from_defaults(units, cfg, panel, side):
    """[(unit, number of vias), ...] when vias per unit/coupon are set."""
    per_unit, per_coupon = via_counts(cfg, panel, side)
    if not per_unit or not units:
        return None
    per_coupon = per_coupon or per_unit
    return [(u, per_coupon if unit_type(u) == 'Coupon' else per_unit) for u in units]


def via_labels(files, units, sequence, meta, side, counts=None):
    """One (label, via number) per via file, in site order. [] if it does not fit."""
    if sequence:
        total = sum(c for _, c in sequence)
        if total != len(files):
            log('ERROR', f'Via: sequence covers {total} files but {len(files)} via files found. '
                f'T2B skipped.', meta['Panel'], side)
            return []
        log('INFO', 'Via sequence: ' + ', '.join(f'{lab} x{c}' for lab, c in sequence),
            meta['Panel'], side)
        return [(lab, i + 1) for lab, c in sequence for i in range(c)]

    if counts:
        total = sum(c for _, c in counts)
        if total != len(files):
            log('ERROR', f'Via: vias_per_unit/vias_per_coupon give {total} files but '
                f'{len(files)} via files found. T2B skipped.', meta['Panel'], side)
            return []
        log('INFO', 'Vias per unit: ' + ', '.join(f'{lab} x{c}' for lab, c in counts),
            meta['Panel'], side)
        return [(lab, i + 1) for lab, c in counts for i in range(c)]

    n_units = len(units)
    if not n_units or len(files) % n_units != 0:
        log('ERROR', f'Via: {len(files)} via files cannot be split evenly into '
            f'{n_units} units. Use a via sequence, or correct the unit list. T2B skipped.',
            meta['Panel'], side)
        return []
    per_unit = len(files) // n_units
    log('INFO', f'{len(files)} via files / {n_units} units = {per_unit} vias per unit',
        meta['Panel'], side)
    return [(units[k // per_unit], k % per_unit + 1) for k in range(len(files))]


def process_via(files, units, meta, side, sequence=None, counts=None):
    labels = via_labels(files, units, sequence, meta, side, counts)
    if not labels:
        return [], []

    summary, raw = [], []
    for k, (path, lines) in enumerate(files):
        label, via_no = labels[k]
        unit = as_label(label)
        site = site_number(path)
        df = parse_via(lines)
        df['D'] = (df['MajorAxis'] + df['MinorAxis']) / 2
        df = df.sort_values('D', ascending=False).reset_index(drop=True)

        n = len(df)
        flag = '' if n == 2 else f'{n} circles'
        top = df.iloc[0] if n >= 1 else None
        bot = df.iloc[-1] if n >= 2 else None

        row = {**meta, 'Side': side, 'Type': unit_type(label), 'Unit': unit,
               'Via': via_no, 'Site': site}
        cols = ['Average_Via_Depth_um', 'Bottom_Diameter_um', 'Top_Diameter_um',
                'Bottom_Roundness_pct', 'Top_Roundness_pct', 'Aspect_Ratio',
                'Bottom_Top_Ratio_pct', 'Taper_um', 'Taper_Angle_deg', 'Wall_Angle_deg']
        row.update({c: np.nan for c in cols})

        if top is not None:
            _, _, tD, tR = circle_values(top)
            row['Top_Diameter_um'] = round(tD, 6)
            row['Top_Roundness_pct'] = round(tR, 6)
        if bot is not None:
            _, _, bD, bR = circle_values(bot)
            depth = abs(bot['AvgHeight'])
            row['Average_Via_Depth_um'] = round(depth, 6)
            row['Bottom_Diameter_um'] = round(bD, 6)
            row['Bottom_Roundness_pct'] = round(bR, 6)
            taper = tD - bD
            row['Taper_um'] = round(taper, 6)
            row['Bottom_Top_Ratio_pct'] = round(bD / tD * 100, 6)
            if depth > 0:
                row['Aspect_Ratio'] = round(depth / tD, 6)
                ang = math.degrees(math.atan(taper / (2 * depth)))
                row['Taper_Angle_deg'] = round(ang, 6)
                row['Wall_Angle_deg'] = round(90 - ang, 6)
        row['Flag'] = flag
        if flag:
            log('WARNING', f'Site {site}: {flag} (expected 2). Row flagged.', meta['Panel'], side)
        summary.append(row)

        for i, c in df.iterrows():
            L, S, D, R = circle_values(c)
            ctype = 'Top' if i == 0 else ('Bottom' if i == n - 1 else 'Extra')
            raw.append({'Lot_Number': meta['Lot_Number'], 'Buildup': meta['Buildup'],
                        'Panel': meta['Panel'], 'Side': side, 'Type': unit_type(label),
                        'Unit': unit, 'Via': via_no,
                        'Site': site, 'File': os.path.basename(path), 'Circle_Type': ctype,
                        'CenterX': c['CenterX'], 'CenterY': c['CenterY'],
                        'Long_Axis_um': L, 'Short_Axis_um': S,
                        'Diameter_um': round(D, 6), 'Roundness_pct': round(R, 6),
                        'AvgHeight_um': c['AvgHeight'], 'MinHeight_um': c['MinHeight'],
                        'MaxHeight_um': c['MaxHeight'], 'Flag': flag})
    return summary, raw


# =============================================================================
# 6. SUMMARY + SPEC LIMITS
# =============================================================================
# settings key -> (sheet, internal column)
SPEC_KEYS = {
    'via_depth':        ('T2B', 'Average_Via_Depth_um'),
    'top_diameter':     ('T2B', 'Top_Diameter_um'),
    'bottom_diameter':  ('T2B', 'Bottom_Diameter_um'),
    'top_roundness':    ('T2B', 'Top_Roundness_pct'),
    'bottom_roundness': ('T2B', 'Bottom_Roundness_pct'),
    'aspect_ratio':     ('T2B', 'Aspect_Ratio'),
    'bottom_top_ratio': ('T2B', 'Bottom_Top_Ratio_pct'),
    'taper':            ('T2B', 'Taper_um'),
    'taper_angle':      ('T2B', 'Taper_Angle_deg'),
    'wall_angle':       ('T2B', 'Wall_Angle_deg'),
    'ra_mean':          ('Roughness', 'Ra_Mean_nm'),
    'rz_mean':          ('Roughness', 'Rz_Mean_nm'),
}

SUMMARY_PARAMS = {
    'T2B': ['Average_Via_Depth_um', 'Top_Diameter_um', 'Bottom_Diameter_um',
            'Top_Roundness_pct', 'Bottom_Roundness_pct', 'Aspect_Ratio',
            'Bottom_Top_Ratio_pct', 'Taper_um', 'Taper_Angle_deg', 'Wall_Angle_deg'],
    'Roughness': ['Ra_Mean_nm', 'Rz_Mean_nm'],
}


def get_limits(cfg):
    """{internal column: (LSL, USL)} from settings; unknown keys are logged."""
    limits = {}
    for key, val in (cfg.get('spec_limits') or {}).items():
        if key not in SPEC_KEYS:
            log('WARNING', f'Unknown spec limit "{key}" ignored.')
            continue
        if not isinstance(val, (list, tuple)) or len(val) != 2:
            log('WARNING', f'Spec limit "{key}" must be [min, max]. Ignored.')
            continue
        lo, hi = val
        if lo is None and hi is None:
            continue
        limits[SPEC_KEYS[key][1]] = (lo, hi)
    return limits


def build_summary(t2b, rough, limits):
    rows = []
    for sheet, df, extra in [('T2B', t2b, []), ('Roughness', rough, ['Measurement_Position'])]:
        if df.empty:
            continue
        for keys, g in df.groupby(['Lot_Number', 'Buildup', 'Panel', 'Side'] + extra, sort=False):
            keys = keys if isinstance(keys, tuple) else (keys,)
            for col in SUMMARY_PARAMS[sheet]:
                v = g[col].dropna()
                if v.empty:
                    continue
                lo, hi = limits.get(col, (None, None))
                result = ''
                if col in limits:
                    ok = (lo is None or v.min() >= lo) and (hi is None or v.max() <= hi)
                    result = 'PASS' if ok else 'FAIL'
                rows.append({'Lot_Number': keys[0], 'Buildup': keys[1], 'Panel': keys[2], 'Side': keys[3],
                             'Measurement': 'Via (T2B)' if sheet == 'T2B' else f'Roughness - {keys[4]}',
                             'Parameter': pretty(col), 'N': len(v),
                             'Mean': v.mean(), 'Std': v.std() if len(v) > 1 else 0.0,
                             'Min': v.min(), 'Max': v.max(),
                             'LSL': lo, 'USL': hi, 'Result': result})
    return pd.DataFrame(rows)


def build_comparison(summary):
    """Front vs Back mean per panel / measurement / parameter."""
    if summary.empty or summary['Side'].nunique() < 2:
        return pd.DataFrame()
    piv = summary.pivot_table(index=['Lot_Number', 'Buildup', 'Panel', 'Measurement', 'Parameter'],
                              columns='Side', values='Mean', aggfunc='first', sort=False)
    if not {'Front', 'Back'} <= set(piv.columns):
        return pd.DataFrame()
    piv = piv.dropna(subset=['Front', 'Back']).reset_index()
    out = pd.DataFrame({'Lot_Number': piv['Lot_Number'], 'Buildup': piv['Buildup'], 'Panel': piv['Panel'],
                        'Measurement': piv['Measurement'],
                        'Parameter': piv['Parameter'],
                        'Front Mean': piv['Front'], 'Back Mean': piv['Back']})
    out['Difference (Back - Front)'] = out['Back Mean'] - out['Front Mean']
    out['Difference (%)'] = np.where(out['Front Mean'] != 0,
                                     out['Difference (Back - Front)'] / out['Front Mean'] * 100,
                                     np.nan)
    return out



# =============================================================================
# 7b. CHARTS  (box plot per unit, Front vs Back, minimal style)
# =============================================================================
CHART_PARAMS = [('t2b', 'Average_Via_Depth_um', 'Average via depth (um)'),
                ('t2b', 'Top_Diameter_um', 'Top diameter (um)'),
                ('t2b', 'Bottom_Diameter_um', 'Bottom diameter (um)'),
                ('rough', 'Ra_Mean_nm', 'Ra (nm)'),
                ('rough', 'Rz_Mean_nm', 'Rz (nm)')]
MAX_CHART_GROUPS = 12          # panels x buildups; more than this and charts are skipped


def box_chart(df, col, ylabel, limits, out_png):
    """One box per unit, Front and Back side by side. Returns True if drawn."""
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt

    units = list(dict.fromkeys(df['Unit'].astype(str)))
    data, positions, colors = [], [], []
    lo, hi = limits.get(col, (None, None))
    for k, unit in enumerate(units):
        for side, off in (('Front', -0.18), ('Back', 0.18)):
            v = df[(df['Unit'].astype(str) == unit) & (df['Side'] == side)][col].dropna()
            if v.empty:
                continue
            out = ((lo is not None and v.min() < lo) or (hi is not None and v.max() > hi))
            data.append(v.values)
            positions.append(k + off)
            colors.append(('#F8CBCB' if out else ('#D9D9D9' if side == 'Front' else '#FFFFFF'),
                           side))
    if not data:
        return False

    fig, ax = plt.subplots(figsize=(7.2, 3.4), dpi=110)
    bp = ax.boxplot(data, positions=positions, widths=0.3, patch_artist=True,
                    medianprops=dict(color='black', linewidth=1.2),
                    flierprops=dict(marker='.', markersize=4, markerfacecolor='black',
                                    markeredgecolor='black'))
    for patch, (face, side) in zip(bp['boxes'], colors):
        patch.set_facecolor(face)
        patch.set_edgecolor('black')
        patch.set_linewidth(0.8)
        if side == 'Back':
            patch.set_hatch('//')

    for val, name in ((lo, 'min'), (hi, 'max')):
        if val is not None:
            ax.axhline(val, color='#C00000', linestyle='--', linewidth=0.9)
            ax.text(len(units) - 0.45, val, f' spec {name} {val:g}', color='#C00000',
                    fontsize=7, va='bottom', ha='right')

    ax.set_xticks(range(len(units)))
    ax.set_xticklabels(units, fontsize=8)
    ax.set_xlim(-0.6, len(units) - 0.4)
    ax.set_xlabel('Unit', fontsize=8)
    ax.set_ylabel(ylabel, fontsize=8)
    ax.tick_params(labelsize=8)
    ax.yaxis.grid(True, color='#E6E6E6', linewidth=0.6)
    ax.set_axisbelow(True)
    for spine in ('top', 'right'):
        ax.spines[spine].set_visible(False)

    handles = [plt.Rectangle((0, 0), 1, 1, facecolor='#D9D9D9', edgecolor='black'),
               plt.Rectangle((0, 0), 1, 1, facecolor='white', edgecolor='black', hatch='//')]
    ax.legend(handles, ['Front', 'Back'], fontsize=7, frameon=False, loc='best')
    fig.tight_layout()
    fig.savefig(out_png)
    plt.close(fig)
    return True


def write_charts(ws, data, limits, st, tmpdir):
    """Charts sheet: one block of box plots per lot / buildup / panel."""
    frames = {'t2b': data['t2b'], 'rough': data['rough']}
    keys = [k for k in ('Lot_Number', 'Buildup', 'Panel') if not frames['t2b'].empty
            and k in frames['t2b'].columns]
    groups = []
    for name, df in frames.items():
        if df.empty:
            continue
        for g, sub in df.groupby(keys, sort=False):
            groups.append(((g if isinstance(g, tuple) else (g,)), name, sub))

    seen = list(dict.fromkeys(g for g, _, _ in groups))
    if len(seen) > MAX_CHART_GROUPS:
        ws.write(0, 0, f'Charts skipped: {len(seen)} panel/buildup groups '
                       f'(limit {MAX_CHART_GROUPS}). Filter the run to get charts.', st.text)
        log('INFO', f'Charts skipped: {len(seen)} groups is above the limit of {MAX_CHART_GROUPS}.')
        return

    ws.hide_gridlines(2)
    ws.set_column(0, 0, 3)
    row, n = 1, 0
    for g in seen:
        ws.write(row, 1, 'Lot ' + ' | '.join(f'{k.replace("_", " ")} {v}'
                                             for k, v in zip(keys, g)).replace('Lot Number ', ''),
                 st.section)
        row += 2
        for src, col, ylabel in CHART_PARAMS:
            sub = next((d for gg, nm, d in groups if gg == g and nm == src), None)
            if sub is None or col not in sub.columns or sub[col].dropna().empty:
                continue
            png = os.path.join(tmpdir, f'chart_{n}.png')
            if box_chart(sub, col, ylabel, limits, png):
                ws.insert_image(row, 1, png, {'x_scale': 1, 'y_scale': 1})
                row += 20
                n += 1
        row += 2
    if n == 0:
        ws.write(0, 0, 'No chart data.', st.text)


# =============================================================================
# 7. EXCEL
# =============================================================================
SPECIAL_NAMES = {'Bottom_Top_Ratio_pct': 'Bottom/Top Ratio (%)'}
UNIT_SUFFIX = {'_um': ' (µm)', '_nm': ' (nm)', '_pct': ' (%)', '_deg': ' (°)'}
DECIMALS = [3]
INT_COLS = {'Panel', 'Unit', 'Via', 'Site', 'Line', 'N', 'Lines Used', 'Lines Flagged'}


def pretty(col):
    """Top_Diameter_um -> Top Diameter (µm)"""
    if col in SPECIAL_NAMES:
        return SPECIAL_NAMES[col]
    for suf, txt in UNIT_SUFFIX.items():
        if col.endswith(suf):
            return col[:-len(suf)].replace('_', ' ') + txt
    return col.replace('_', ' ')


def bu_text(bus):
    """['BU01','BU02'] -> 'BU01-02'"""
    bus = sorted(b for b in bus if b)
    if not bus:
        return ''
    if len(bus) == 1:
        return bus[0]
    return bus[0] + '-' + '-'.join(b.replace('BU', '') for b in bus[1:])


def join_short(items, n=3):
    """['a','b'] -> 'a-b'; more than n -> first-last"""
    items = [str(x) for x in items if str(x)]
    if not items:
        return ''
    return '-'.join(items) if len(items) <= n else f'{items[0]}-{items[-1]}'


def output_path(cfg, panels, flagged, bus, parts, lots):
    clean = lambda s: re.sub(r'[^A-Za-z0-9\-\.]', '', str(s))
    panels = sorted(panels)
    ptxt = '-'.join(map(str, panels)) if len(panels) <= 4 else f'{panels[0]}-{panels[-1]}'
    name = (f"PRF_{clean(join_short(parts)) or 'Part'}_{clean(join_short(lots)) or 'Lot'}_"
            f"{clean(bu_text(bus)) or 'BU'}_{clean(cfg['process']).replace('-', '')}_P{ptxt}_"
            f"{date.today():%Y-%m-%d}")
    if flagged:
        name += '__INSPECT__'
    os.makedirs(cfg['output_folder'], exist_ok=True)
    path = os.path.join(cfg['output_folder'], name + '.xlsx')
    i = 2
    while os.path.exists(path):
        path = os.path.join(cfg['output_folder'], f'{name}_{i}.xlsx')
        i += 1
    return path


class Styles:
    def __init__(self, wb):
        base = {'font_name': 'Arial', 'font_size': 10, 'valign': 'vcenter'}
        f = lambda **k: wb.add_format({**base, **k})
        self.header = f(bold=True, font_color='white', bg_color='#1F4E78', border=1,
                        border_color='#BFBFBF', align='center', text_wrap=True)
        self.text = f(border=1, border_color='#D9D9D9')
        self.int = f(border=1, border_color='#D9D9D9', align='center', num_format='0')
        self.num = f(border=1, border_color='#D9D9D9', align='right',
                     num_format='0.' + '0' * DECIMALS[0] if DECIMALS[0] > 0 else '0')
        self.title = f(bold=True, font_size=16, font_color='#1F4E78')
        self.section = f(bold=True, font_size=12, font_color='#1F4E78', bottom=2, bottom_color='#1F4E78')
        self.label = f(bold=True, font_color='#595959')
        self.value = f()
        self.flag_row = wb.add_format({'bg_color': '#FFF2CC'})
        self.fail = wb.add_format({'bg_color': '#FFC7CE', 'font_color': '#9C0006', 'bold': True})
        self.ok = wb.add_format({'bg_color': '#C6EFCE', 'font_color': '#006100'})
        self.status_ok = f(bold=True, font_color='#006100')
        self.status_bad = f(bold=True, font_color='#9C0006')
        self.level = {'ERROR': self.fail, 'WARNING': self.flag_row}


def write_table(ws, df, st, start_row=0, limits=None, freeze=True):
    """Write df as an Excel table with fixed formats. Returns last row index."""
    df = df.copy()
    raw_cols = list(df.columns)
    df.columns = [pretty(c) for c in raw_cols]
    n, m = len(df), len(df.columns)

    ws.write_row(start_row, 0, df.columns, st.header)
    ws.set_row(start_row, 30)
    for j, col in enumerate(df.columns):
        s = df[col]
        if col in INT_COLS:
            fmt = st.int
        elif pd.api.types.is_float_dtype(s):
            fmt = st.num
        else:
            fmt = st.text
        for i, v in enumerate(s):
            r = start_row + 1 + i
            if v is None or (isinstance(v, float) and np.isnan(v)):
                ws.write_blank(r, j, None, fmt)
            elif fmt is st.num:
                ws.write_number(r, j, round(float(v), DECIMALS[0]), fmt)
            elif fmt is st.int:
                try:
                    ws.write_number(r, j, int(v), fmt)
                except (TypeError, ValueError):
                    ws.write(r, j, v, st.text)
            else:
                ws.write(r, j, v if not isinstance(v, (bool, np.bool_)) else ('Yes' if v else 'No'), fmt)
        sample = [len(str(col)) * 0.9] + [len(f'{x:.{DECIMALS[0]}f}') if fmt is st.num and pd.notna(x)
                                         else len(str(x)) for x in s.head(200)]
        ws.set_column(j, j, min(max(sample) + 3, 45))

    if n:
        ws.autofilter(start_row, 0, start_row + n, m - 1)
        # spec limits: colour individual cells
        for j, raw in enumerate(raw_cols):
            if limits and raw in limits:
                lo, hi = limits[raw]
                rng = (start_row + 1, j, start_row + n, j)
                if lo is not None and hi is not None:
                    ws.conditional_format(*rng, {'type': 'cell', 'criteria': 'not between',
                                                 'minimum': lo, 'maximum': hi, 'format': st.fail})
                    ws.conditional_format(*rng, {'type': 'cell', 'criteria': 'between',
                                                 'minimum': lo, 'maximum': hi, 'format': st.ok})
                elif lo is not None:
                    ws.conditional_format(*rng, {'type': 'cell', 'criteria': '<', 'value': lo, 'format': st.fail})
                    ws.conditional_format(*rng, {'type': 'cell', 'criteria': '>=', 'value': lo, 'format': st.ok})
                else:
                    ws.conditional_format(*rng, {'type': 'cell', 'criteria': '>', 'value': hi, 'format': st.fail})
                    ws.conditional_format(*rng, {'type': 'cell', 'criteria': '<=', 'value': hi, 'format': st.ok})
        # flagged rows: light yellow
        if 'Flag' in df.columns:
            for i in np.where(df['Flag'].fillna('').astype(str) != '')[0]:
                r = start_row + 1 + i
                ws.conditional_format(r, 0, r, m - 1, {'type': 'no_errors', 'format': st.flag_row})
        # Result column in summary
        if 'Result' in df.columns:
            j = list(df.columns).index('Result')
            rng = (start_row + 1, j, start_row + n, j)
            ws.conditional_format(*rng, {'type': 'cell', 'criteria': '==', 'value': '"FAIL"', 'format': st.fail})
            ws.conditional_format(*rng, {'type': 'cell', 'criteria': '==', 'value': '"PASS"', 'format': st.ok})
        # Log levels
        if 'Level' in df.columns:
            j = list(df.columns).index('Level')
            for lvl, fmt in st.level.items():
                ws.conditional_format(start_row + 1, 0, start_row + n, m - 1,
                                      {'type': 'formula',
                                       'criteria': f'=${chr(65 + j)}{start_row + 2}="{lvl}"',
                                       'format': fmt})
    if freeze:
        ws.freeze_panes(start_row + 1, 0)
    return start_row + n


def write_excel(path, cfg, data, summary, comparison, limits, status):
    tmpdir = tempfile.mkdtemp(prefix='prf_charts_')
    with pd.ExcelWriter(path, engine='xlsxwriter') as writer:
        wb = writer.book
        st = Styles(wb)

        # ---- Summary sheet with report header ----
        ws = wb.add_worksheet('Summary')
        ws.hide_gridlines(2)
        ws.write(0, 0, 'PRF Measurement Report', st.title)
        info = [('Project', ', '.join(data['projects'])), ('Part number', ', '.join(data['parts'])),
                ('Lot number', ', '.join(data['lots'])), ('Lot name', cfg['lot_name']),
                ('Buildup', ', '.join(data['bus'])), ('Process', cfg['process']),
                ('Panels', ', '.join(map(str, data['panels']))),
                ('Created', f'{datetime.now():%Y-%m-%d %H:%M}'),
                ('Script version', VERSION)]
        for i, (k, v) in enumerate(info):
            ws.write(2 + i, 0, k, st.label)
            ws.write(2 + i, 1, v, st.value)
        r = 2 + len(info)
        ws.write(r, 0, 'Status', st.label)
        ws.write(r, 1, status, st.status_ok if status == 'OK' else st.status_bad)
        ws.write(r + 1, 0, 'Legend', st.label)
        ws.write(r + 1, 1, 'Yellow row = flagged, check raw data', st.flag_row)
        ws.write(r + 2, 1, 'Red cell = out of spec', st.fail)
        ws.write(r + 3, 1, 'Green cell = in spec', st.ok)
        start = r + 5
        ws.write(start, 0, 'Statistics', st.section)
        if summary.empty:
            ws.write(start + 1, 0, 'No data', st.text)
            end = start + 1
        else:
            end = write_table(ws, summary, st, start_row=start + 1, freeze=False)
        if not comparison.empty:
            c0 = end + 3
            ws.write(c0, 0, 'Front vs Back', st.section)
            write_table(ws, comparison, st, start_row=c0 + 1, freeze=False)
        ws.set_column(0, 0, 16)
        ws.set_column(1, 1, 30)
        ws.set_column(2, 2, 34)
        ws.set_column(3, 3, 26)

        # ---- Charts ----
        if cfg['charts']:
            try:
                write_charts(wb.add_worksheet('Charts'), data, limits, st, tmpdir)
            except Exception as e:
                log('WARNING', f'Charts could not be drawn: {e}')

        # ---- Data sheets ----
        for name, df, lim in [('T2B', data['t2b'], limits), ('Roughness', data['rough'], limits),
                              ('T2B_raw', data['t2b_raw'], None),
                              ('Roughness_raw', data['rough_raw'], None),
                              ('Unknown_files', data['unknown'], None),
                              ('Log', data['log'], None)]:
            if name == 'Unknown_files' and df.empty:
                continue
            ws = wb.add_worksheet(name)
            if df.empty:
                ws.write(0, 0, 'No data', st.text)
                continue
            write_table(ws, df, st, limits=lim)
            if name == 'Log':
                ws.set_column(4, 4, 90)
    shutil.rmtree(tmpdir, ignore_errors=True)


# =============================================================================
# 8. MAIN
# =============================================================================
def main():
    here = os.path.dirname(os.path.abspath(__file__))
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if args:
        settings_path = args[0]
    else:
        settings_path = os.path.join(here, 'settings_Insight.yaml')
        if not os.path.exists(settings_path):
            settings_path = os.path.join(here, 'settings.yaml')
    if not os.path.exists(settings_path):
        sys.exit(f'ERROR: settings file not found: {settings_path}')
    cfg = load_settings(settings_path)
    PREVIEW[0] = bool(cfg['preview']) or '--preview' in sys.argv
    if check_settings(cfg) and not PREVIEW[0]:
        sys.exit('Fix the settings above and run again '
                 '(or use --preview to check the plan only).')
    print(f'PRF Insight v{VERSION} | settings: {settings_path}'
          + ('   [PREVIEW - nothing will be written]' if PREVIEW[0] else ''))

    resolve_folders(cfg, here)
    print(f"Root:   {cfg['root']}\nOutput: {cfg['output_folder']}")
    if not os.path.isdir(cfg['root']):
        sys.exit(f"ERROR: root folder not found: {cfg['root']}")

    limits = get_limits(cfg)
    t2b, rough, t2b_raw, rough_raw, unknown = [], [], [], [], []
    ending = cfg['file_ending'].lower()

    print('\nSearching log folders ...')
    index, lot_info, problems = index_log_folders(cfg['root'])
    for msg in problems:
        log('WARNING', msg)
    DECIMALS[0] = cfg['decimals']

    # ---- lots ----
    all_lots = sorted({l for l, _, _, _ in index}, key=lambda x: (x is None, x or ''))
    if cfg['lot_number_auto']:
        if None in all_lots:
            n = sum(len(v) for (l, _, _, _), v in index.items() if l is None)
            log('WARNING', f'{n} log folder(s) have no lot folder (5 digits) in their path. Skipped. '
                           f'Type lot_number in settings to use them.')
        run_lots = [l for l in all_lots if l is not None]
    else:
        # forced lot: keep that lot, plus folders without a lot in the path
        run_lots = [l for l in all_lots if l is None or l == cfg['lot_number']]
        if not run_lots:
            sys.exit(f"ERROR: lot {cfg['lot_number']} not found under root. Found: "
                     f"{[l for l in all_lots if l]}. Use lot_number: 'auto' or fix root.")
        skipped = [l for l in all_lots if l not in run_lots]
        if skipped:
            log('INFO', f"lot_number is set to {cfg['lot_number']}: other lots ignored {skipped}")
    if not run_lots:
        sys.exit('ERROR: no lot folders found. Point root at or above the lot folder, '
                 'or type lot_number in settings.')

    for lot in run_lots:
        project, part = lot_info.get(lot, ('', ''))
        lot_name = cfg['lot_number'] if not cfg['lot_number_auto'] else lot
        project = project if cfg['project_name_auto'] else cfg['project_name']
        part = part if cfg['part_number_auto'] else cfg['part_number']
        CURRENT_LOT[0] = lot_name
        lot_index = {(b, p, sd): v for (l, b, p, sd), v in index.items() if l == lot}
        print(f"\n################ Lot {lot_name} | Part {part} | Project {project} ################")
        log('INFO', f'Lot {lot_name}: project "{project}", part "{part}", '
                    f'{sum(len(v) for v in lot_index.values())} log folder(s)', '', '')

        # ---- buildups in this lot ----
        all_bus = sorted({b for b, _, _ in lot_index}, key=lambda x: (x is None, x or 0))
        if cfg['bu_auto']:
            run_bus = all_bus
            if None in run_bus:
                log('WARNING', f'Lot {lot_name}: some log folders have no BU folder in their path. '
                               'Their Buildup is left blank.')
        else:
            run_bus = [b for b in all_bus if b is None or b == cfg['bu_filter']]
            skipped = [bu_label(b) for b in all_bus if b not in run_bus]
            if not run_bus:
                log('WARNING', f"Lot {lot_name}: buildup {cfg['buildup']} not found "
                               f"(found {[bu_label(b) for b in all_bus]}). Lot skipped.")
                continue
            if skipped:
                log('INFO', f"Lot {lot_name}: buildup set to {cfg['buildup']}, others ignored {skipped}")

        for bu in run_bus:
            bu_name = bu_label(bu) if cfg['bu_auto'] else cfg['buildup']
            CURRENT_BU[0] = bu_name
            found_panels = sorted({p for b, p, _ in lot_index if b == bu})
            if cfg['panels'] is None:
                panels = found_panels
            else:
                panels = [p for p in cfg['panels'] if p in found_panels]
                extra = [p for p in found_panels if p not in cfg['panels']]
                if extra:
                    log('INFO', f'Lot {lot_name} {bu_name}: panels found but not in settings '
                                f'(ignored): {extra}')
            if not panels:
                continue
            print(f"\n##### Buildup {bu_name or '(none)'} | panels {panels} #####")

            for panel in panels:
                print(f'\n=== Panel {panel} ===')
                meta = {'Project_Name': project, 'Part_Number': part,
                        'Lot_Number': lot_name, 'Lot_Name': cfg['lot_name'],
                        'Buildup': bu_name, 'Process': cfg['process'], 'Panel': panel}
                process_panel(cfg, lot_index, bu, panel, meta, ending,
                              t2b, rough, t2b_raw, rough_raw, unknown)
        CURRENT_BU[0] = ''
    CURRENT_LOT[0] = ''

    # panels typed in settings that were found nowhere
    if cfg['panels'] is not None:
        seen = {p for (l, b, p, _) in index if l in run_lots}
        for panel in cfg['panels']:
            if panel not in seen:
                log('WARNING', f'Panel {panel}: no log folder found in any lot/buildup.')

    if PREVIEW[0]:
        print('\nPreview only. No Excel written.')
        return
    if not t2b and not rough:
        sys.exit('\nNothing extracted. No Excel written.')
    finish(cfg, settings_path, limits, t2b, rough, t2b_raw, rough_raw, unknown)


def show_plan(groups, r_units, positions, v_units, sequence, counts, meta, side):
    """Preview: which site becomes which unit, without writing anything."""
    plan = {}
    for (path, _), (unit, pos) in zip(groups['roughness'],
                                      [(u, p) for u in r_units for p in positions]):
        plan[site_number(path)] = ('Roughness', unit, pos)
    for (path, _), (label, via_no) in zip(groups['via'],
                                          via_labels(groups['via'], v_units, sequence,
                                                     meta, side, counts)):
        plan[site_number(path)] = ('Via', label, f'Via {via_no}')

    print(f"\n  Plan for Panel {meta['Panel']} {side}:")
    print(f"    {'Site':>5}  {'Kind':<10}{'Unit':<10}{'Position':<22}")
    for site in sorted(plan):
        kind, unit, detail = plan[site]
        print(f'    {site:>5}  {kind:<10}{str(unit):<10}{detail:<22}')
    missing = [site_number(p) for k in ('roughness', 'via') for p, _ in groups[k]
               if site_number(p) not in plan]
    if missing:
        print(f'    NOT ASSIGNED (counts do not fit): sites {missing}')


def process_panel(cfg, index, bu, panel, meta, ending, t2b, rough, t2b_raw, rough_raw, unknown):
    if True:
        for side in ('Front', 'Back'):
            r_units, r_src = get_units(cfg, panel, side, 'roughness')
            v_units, v_src = get_units(cfg, panel, side, 'via')
            sequence = get_sequence(cfg, panel, side)
            counts = counts_from_defaults(v_units, cfg, panel, side)
            positions, p_src = get_positions(cfg, panel, side)
            logs = index.get((bu, panel, side), [])
            if not logs:
                log('WARNING', 'No log folder found. Side skipped.', panel, side)
                continue
            if len(logs) > 1:
                log('WARNING', f'{len(logs)} log folders found, side skipped: ' + ' | '.join(logs),
                    panel, side)
                continue
            logdir = logs[0]
            log('INFO', f'Folder: {logdir}', panel, side)

            paths = sorted([os.path.join(logdir, f) for f in os.listdir(logdir)
                            if f.lower().endswith(ending)], key=site_number)
            groups = {'roughness': [], 'via': [], 'unknown': []}
            for p in paths:
                try:
                    lines = read_lines(p)
                    groups[classify(lines)].append((p, lines))
                except Exception as e:
                    log('ERROR', f'Cannot read {os.path.basename(p)}: {e}', panel, side)

            log('INFO', f"{len(paths)} files -> roughness {len(groups['roughness'])}, "
                        f"via {len(groups['via'])}, unknown {len(groups['unknown'])}", panel, side)
            via_txt = ('via sequence set' if sequence else
                       'vias per unit set' if counts else f'via units {v_units} ({v_src})')
            log('INFO', f'Roughness units {r_units} ({r_src}), positions {positions} ({p_src}), '
                        f'{via_txt}', panel, side)
            code = {'roughness': 'R', 'via': 'V', 'unknown': '?'}
            typed = sorted((site_number(p), code[k]) for k, lst in groups.items() for p, _ in lst)
            check_sites(typed, r_units, v_units, len(positions), panel, side, sequence)

            for p, _ in groups['unknown']:
                unknown.append({'Lot_Number': meta['Lot_Number'], 'Buildup': meta['Buildup'],
                                'Panel': panel, 'Side': side, 'File': p})
                log('WARNING', f'Unknown file type: {os.path.basename(p)}', panel, side)

            if PREVIEW[0]:
                show_plan(groups, r_units, positions, v_units, sequence, counts, meta, side)
                continue

            try:
                if groups['roughness']:
                    s, r = process_roughness(groups['roughness'], r_units, cfg, meta, side,
                                             positions)
                    rough += s
                    rough_raw += r
                if groups['via']:
                    s, r = process_via(groups['via'], v_units, meta, side, sequence, counts)
                    t2b += s
                    t2b_raw += r
            except Exception as e:
                log('ERROR', f'Processing failed: {e}', panel, side)


def finish(cfg, settings_path, limits, t2b, rough, t2b_raw, rough_raw, unknown):
    df_t2b, df_rough = pd.DataFrame(t2b), pd.DataFrame(rough)
    summary = build_summary(df_t2b, df_rough, limits)
    comparison = build_comparison(summary)

    flagged = any((d['Flag'].astype(str) != '').any() for d in (df_t2b, df_rough) if 'Flag' in d)
    spec_fail = (not summary.empty) and (summary['Result'] == 'FAIL').any()
    errors = any(x['Level'] == 'ERROR' for x in LOG)
    site_warn = any(x['Level'] == 'WARNING' and
                    any(k in x['Message'] for k in ('Missing sites', 'Duplicate site', 'pattern differs',
                                                    'not consecutive'))
                    for x in LOG)
    parts = []
    if errors:
        parts.append('ERRORS - see Log')
    if flagged:
        parts.append('Flagged rows')
    if spec_fail:
        parts.append('Out of spec')
    if site_warn:
        parts.append('Site warnings - see Log')
    status = 'OK' if not parts else ' | '.join(parts)

    done = sorted({r['Panel'] for r in t2b + rough})
    rows = t2b + rough
    bus = sorted({r['Buildup'] for r in rows if r['Buildup']})
    lots = sorted({r['Lot_Number'] for r in rows if r['Lot_Number']})
    parts = sorted({r['Part_Number'] for r in rows if r['Part_Number']})
    projects = sorted({r['Project_Name'] for r in rows if r['Project_Name']})
    out = output_path(cfg, done, flagged or spec_fail or errors or site_warn, bus, parts, lots)
    log('INFO', f'T2B rows: {len(t2b)} | Roughness rows: {len(rough)} | '
                f'Unknown files: {len(unknown)} | Status: {status}')
    log('INFO', f'Saved: {out}')

    data = {'panels': done, 'bus': bus, 'lots': lots, 'parts': parts, 'projects': projects,
            't2b': df_t2b, 'rough': df_rough,
            't2b_raw': pd.DataFrame(t2b_raw), 'rough_raw': pd.DataFrame(rough_raw),
            'unknown': pd.DataFrame(unknown), 'log': pd.DataFrame(LOG)}
    write_excel(out, cfg, data, summary, comparison, limits, status)
    shutil.copy(settings_path, os.path.splitext(out)[0] + '_settings.yaml')
    print('\nDone.')


if __name__ == '__main__':
    main()
