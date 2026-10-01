"""
HRM AutoLot
-----------
Reads HRM *_Summary.xlsx files from one lot folder
(Lot / BUxx / HRM / post XXX_HRM-... / Panel nn / front|back|Coupon front)
and writes one clean Excel: Summary, Pad, Trace, Via, Roughness, Unmapped, Log.

Run:  python HRM-AutoLot_v2.py [HRM-settings_v2.yaml]
"""

import fnmatch
import json
import os
import re
import sys
from datetime import datetime

import openpyxl
import pandas as pd
import yaml
from openpyxl.utils import get_column_letter

UM, NM = "(µm)", "(nm)"

# header text (normalised) -> output column
HEADER_MAP = {
    "max stepheight": f"Max_Stepheight {UM}",
    "min stepheight": f"Min_Stepheight {UM}",
    "mean stepheight": f"Mean_Stepheight {UM}",
    "radius": f"Radius {UM}",
    "diameter": f"Diameter {UM}",
    "outer radius": f"Outer_Radius {UM}",
    "inner radius": f"Inner_Radius {UM}",
    "dimple": f"Dimple {UM}",
    "bump": f"Bump {UM}",
    "width": f"Width {UM}",
    "line": f"Width {UM}",
    "space": f"Space {UM}",
}

ROUGH_STD = ["rz mean", "rz std dev", "rz min", "rz max",
             "ra mean", "ra std dev", "ra min", "ra max"]
ROUGH_COLS = [f"Rz_Mean {NM}", f"Rz_Std_dev {NM}", f"Rz_Min {NM}", f"Rz_Max {NM}",
              f"Ra_Mean {NM}", f"Ra_Std_dev {NM}", f"Ra_Min {NM}", f"Ra_Max {NM}"]

META = ["Project_Name", "Part_Number", "Lot_Number", "Lot_Name", "Buildup",
        "Process", "Panel", "Side", "Location", "Unit"]
TAIL = ["Comment", "QC_Flag", "Meas_Order", "Measured_At", "Source_Path"]

SHEET_COLS = {
    "Pad": META + ["Pad_Category", "Pad", "Pad_Type",
                   f"Max_Stepheight {UM}", f"Min_Stepheight {UM}", f"Mean_Stepheight {UM}",
                   f"Radius {UM}", f"Diameter {UM}", f"Outer_Radius {UM}", f"Inner_Radius {UM}",
                   f"Dimple {UM}", f"Bump {UM}"] + TAIL,
    "Trace": META + ["Trace", f"Max_Stepheight {UM}", f"Min_Stepheight {UM}",
                     f"Mean_Stepheight {UM}", f"Width {UM}", f"Space {UM}"] + TAIL,
    "Via": META + ["Via", f"Dimple {UM}", f"Bump {UM}"] + TAIL,
    "Roughness": META + ["Roughness"] + ROUGH_COLS + TAIL,
    "Unmapped": META + ["Block", "Parameter", "Value", "Comment",
                        "Meas_Order", "Measured_At", "Source_Path"],
}
ALLOWED = {s: set(c) for s, c in SHEET_COLS.items()}

DATA_EXT = {".xlsx", ".xlsm", ".xls", ".csv", ".txt"}

LOG_COLS = ["Level", "Buildup", "Process", "Panel", "Side", "Location",
            "File", "Block", "Unit", "Message"]


# ----------------------------------------------------------------- helpers
def norm(s):
    """lower case, single spaces, stripped."""
    return re.sub(r"\s+", " ", str(s)).strip().lower()


LAST_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                         "HRM-AutoLot-last.json")


def last_paths():
    """Folders used in the previous run (used as the popup's start folder)."""
    try:
        with open(LAST_FILE, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:  # noqa: BLE001 - missing or broken file is fine
        return {}


def save_last(root, outdir):
    try:
        with open(LAST_FILE, "w", encoding="utf-8") as fh:
            json.dump({"root_folder": root, "output_folder": outdir,
                       "saved": datetime.now().strftime("%Y-%m-%d %H:%M")}, fh, indent=2)
    except Exception:  # noqa: BLE001 - never stop the run over this
        pass


def pick_folder(title, start=None):
    import tkinter as tk
    from tkinter import filedialog
    root = tk.Tk()
    root.withdraw()
    kw = {"initialdir": start} if start and os.path.isdir(start) else {}
    path = filedialog.askdirectory(title=title, **kw)
    root.destroy()
    if not path:
        sys.exit(f"No folder selected ({title}). Stopped.")
    return path


def norm_bu(s):
    m = re.match(r"^bu[\s\-_]*0*(\d+)$", norm(s))
    return f"BU-{int(m.group(1)):02d}" if m else None


def norm_process(s):
    m = re.match(r"^post[\s\-_]*([a-z0-9]+)", norm(s))
    return f"Post {m.group(1).upper()}" if m else None


def norm_panel(s):
    m = re.match(r"^panel[\s\-_]*0*(\d+)$", norm(s))
    return int(m.group(1)) if m else None


def norm_side(s):
    """-> (Side, Location) or None"""
    n = norm(s)
    loc = "Unit"
    if n.startswith("coupon"):
        loc = "Coupon"
        n = n[len("coupon"):].strip(" -_")
    if n in ("front", "back"):
        return n.capitalize(), loc
    return None


def file_timestamp(name):
    m = re.search(r"(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})", name)
    if m:
        try:
            return datetime.strptime(f"{m.group(1)} {m.group(2)}:{m.group(3)}:{m.group(4)}",
                                     "%Y-%m-%d %H:%M:%S")
        except ValueError:
            return None
    return None


def as_list(v):
    if v is None or (isinstance(v, str) and norm(v) == "all"):
        return None
    return v if isinstance(v, list) else [v]


def compact(items, sep="-"):
    items = [str(i) for i in items]
    if len(items) > 3:
        return f"{items[0]}{sep}{items[-1]}"
    return sep.join(items)


def unit_sort_key(u):
    s = str(u)
    if s.upper().startswith("C"):
        return (1, int(re.sub(r"\D", "", s) or 0))
    try:
        return (0, int(s))
    except ValueError:
        return (2, 0)


def is_num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


# ----------------------------------------------------------------- logger
class Log:
    def __init__(self):
        self.rows = []

    def add(self, level, msg, ctx=None, block="", unit=""):
        ctx = ctx or {}
        self.rows.append({
            "Level": level, "Buildup": ctx.get("Buildup", ""), "Process": ctx.get("Process", ""),
            "Panel": ctx.get("Panel", ""), "Side": ctx.get("Side", ""),
            "Location": ctx.get("Location", ""),
            "File": ctx.get("Full_Path", ctx.get("Source_File", "")),
            "Block": block, "Unit": unit, "Message": msg})
        if level != "INFO":
            print(f"  [{level}] {ctx.get('Source_File', '')} {block} {unit} {msg}".rstrip())


# ----------------------------------------------------------------- parsing
def read_blocks(path):
    """Yield blocks: {label, header, rows:[(unit_label, comment, values, excel_row)]}"""
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    sheet_name = ws.title
    blocks, header, cur = [], None, None
    stray = []
    for i, row in enumerate(ws.iter_rows(values_only=True), start=1):
        row = list(row) + [None, None]
        a, b, rest = row[0], row[1], row[2:]
        if a is None or (isinstance(a, str) and not a.strip()):
            if any(isinstance(v, str) and v.strip() for v in rest):
                header = rest
                cur = None
            elif b is not None or any(v is not None for v in rest):
                stray.append(i)
            continue
        if not (isinstance(a, str) and norm(a).startswith("unit")):
            stray.append(i)
            continue
        if cur is None:
            cur = {"label": b, "header": header or [], "rows": [], "start": i}
            blocks.append(cur)
            comment = None
        else:
            comment = str(b).strip() if b is not None else None
        cur["rows"].append((a, comment, rest, i))
    wb.close()
    return sheet_name, blocks, stray


def split_label(label):
    """'Pad Pos 3' -> ('pad pos', 3); 'roughness' -> ('roughness', None)"""
    n = norm(label)
    m = re.match(r"^(.*?)[\s\-_]*(\d+)$", n)
    if m and m.group(1):
        return m.group(1).strip(), int(m.group(2))
    return n, None


def unit_value(unit_label, location):
    m = re.search(r"(\d+)", str(unit_label))
    if not m:
        return None
    n = int(m.group(1))
    return f"C{n}" if location == "Coupon" else n


def parse_file(path, ctx, cfg, log, out):
    fname = ctx["Source_File"]
    try:
        sheet_name, blocks, stray = read_blocks(path)
    except Exception as e:  # noqa: BLE001
        log.add("ERROR", f"File can't be opened: {e}", ctx)
        return None
    counts = {"Pad": 0, "Trace": 0, "Via": 0, "Roughness": 0, "Unmapped": 0}
    units = set()
    if not blocks:
        log.add("ERROR", f"No measurement blocks found in sheet '{sheet_name}'", ctx)
        return counts, units
    for r in stray:
        log.add("WARNING", f"Row {r}: not a header or unit row, ignored", ctx)

    label_map = {norm(k): v for k, v in (cfg.get("label_map") or {}).items()}

    for blk in blocks:
        label = blk["label"]
        if label is None:
            log.add("WARNING", f"Block at row {blk['start']} has no label; sent to Unmapped", ctx)
            label = f"(no label, row {blk['start']})"
        label_txt = str(label).strip()
        base, num = split_label(label_txt)
        target = label_map.get(base)
        header = [norm(h) if isinstance(h, str) and h.strip() else None for h in blk["header"]]

        # fully empty block?
        all_vals = [v for (_, _, vals, _) in blk["rows"] for v in vals if v is not None]
        if not all_vals:
            log.add("INFO", f"Block present but empty ({len(blk['rows'])} units), skipped",
                    ctx, block=label_txt)
            continue

        sheet = target["sheet"] if target else "Unmapped"
        if not target:
            log.add("WARNING", f"Unknown block label '{label_txt}' -> Unmapped sheet "
                               f"(add it to label_map in settings)", ctx, block=label_txt)

        # column mapping
        colmap = {}          # index in rest -> output column
        extra_warned = False
        if sheet == "Roughness":
            got = header[:8]
            if got != ROUGH_STD:
                log.add("WARNING", f"Roughness header {got} differs from standard order; "
                                   f"standard order used", ctx, block=label_txt)
            colmap = {i: ROUGH_COLS[i] for i in range(8)}
        else:
            used = set()
            for i, h in enumerate(header):
                if h is None:
                    continue
                col = HEADER_MAP.get(h)
                if sheet == "Unmapped" or col is None or col not in ALLOWED[sheet]:
                    colmap[i] = ("RAW", h)
                    if sheet != "Unmapped":
                        log.add("WARNING", f"Unknown column '{h}' -> Unmapped sheet",
                                ctx, block=label_txt)
                    continue
                if col in used:
                    log.add("WARNING", f"Duplicate column '{h}', first one used",
                            ctx, block=label_txt)
                    continue
                used.add(col)
                colmap[i] = col

        hdr_set = set(h for h in header if h)
        pad_type = None
        if sheet == "Pad":
            has_o, has_i = "outer radius" in hdr_set, "inner radius" in hdr_set
            if has_o and has_i:
                pad_type = "Annular"
            elif not has_o and not has_i:
                pad_type = "Single"
            else:
                log.add("WARNING", "Only one of Outer/Inner Radius present; Pad_Type left blank",
                        ctx, block=label_txt)
            if "diameter" not in hdr_set and cfg.get("derive_diameter", True):
                log.add("INFO", "No Diameter column; Diameter = 2 x Radius", ctx, block=label_txt)

        for order, (ulabel, comment, vals, excel_row) in enumerate(blk["rows"], start=1):
            unit = unit_value(ulabel, ctx["Location"])
            if unit is None:
                log.add("WARNING", f"Row {excel_row}: unit '{ulabel}' not understood, skipped",
                        ctx, block=label_txt)
                continue
            units.add(unit)
            # unlabelled values
            extra = [v for i, v in enumerate(vals)
                     if v is not None and i not in colmap and not (sheet == "Roughness" and i < 8)]
            if extra and not extra_warned:
                log.add("WARNING", f"Values without header ignored: {extra}",
                        ctx, block=label_txt, unit=unit)
                extra_warned = True
            if comment:
                log.add("INFO", f"Unit note: '{comment}' (values left empty)",
                        ctx, block=label_txt, unit=unit)

            base_row = {k: ctx[k] for k in META if k in ctx}
            base_row.update({"Unit": unit, "Comment": comment, "Meas_Order": order,
                             "Measured_At": ctx["Measured_At"],
                             "Source_Path": ctx.get("Source_Path", fname)})

            if sheet == "Unmapped":
                for i, col in colmap.items():
                    v = vals[i] if i < len(vals) else None
                    if v is None:
                        continue
                    r = dict(base_row, Block=label_txt, Parameter=col[1] if isinstance(col, tuple) else col,
                             Value=v)
                    out["Unmapped"].append(r)
                    counts["Unmapped"] += 1
                continue

            row = dict(base_row)
            raw_unknown = []
            for i, col in colmap.items():
                v = vals[i] if i < len(vals) else None
                if isinstance(col, tuple):
                    if v is not None:
                        raw_unknown.append((col[1], v))
                    continue
                if v is not None and not is_num(v):
                    try:
                        v = float(str(v).replace(",", "."))
                    except ValueError:
                        log.add("WARNING", f"'{col}' is not a number ('{v}'), left empty",
                                ctx, block=label_txt, unit=unit)
                        v = None
                if sheet == "Roughness" and v is not None:
                    v = v * 1000.0
                row[col] = v
            for p, v in raw_unknown:
                out["Unmapped"].append(dict(base_row, Block=label_txt, Parameter=p, Value=v))
                counts["Unmapped"] += 1

            if sheet == "Pad":
                row["Pad_Category"] = target.get("category", "Pad")
                row["Pad"] = num
                row["Pad_Type"] = pad_type
                if pad_type == "Annular":
                    row[f"Radius {UM}"] = row.get(f"Inner_Radius {UM}")
                row["_diam_measured"] = row.get(f"Diameter {UM}") is not None
                if (row.get(f"Diameter {UM}") is None and row.get(f"Radius {UM}") is not None
                        and cfg.get("derive_diameter", True)):
                    row[f"Diameter {UM}"] = 2 * row[f"Radius {UM}"]
            elif sheet == "Trace":
                row["Trace"] = num
            elif sheet == "Via":
                row["Via"] = num
            elif sheet == "Roughness":
                row["Roughness"] = num if num is not None else 1

            row["QC_Flag"] = qc_row(row, sheet, cfg, log, ctx, label_txt)
            row.pop("_diam_measured", None)
            out[sheet].append(row)
            counts[sheet] += 1
    return counts, units


# ----------------------------------------------------------------- QC
def qc_row(row, sheet, cfg, log, ctx, block):
    q = cfg.get("qc") or {}
    flags = []

    def g(c):
        v = row.get(c)
        return v if is_num(v) else None

    if q.get("order_check", True):
        triples = []
        if sheet in ("Pad", "Trace"):
            triples.append(("Stepheight", f"Min_Stepheight {UM}", f"Mean_Stepheight {UM}",
                            f"Max_Stepheight {UM}"))
        if sheet == "Roughness":
            triples += [("Rz", f"Rz_Min {NM}", f"Rz_Mean {NM}", f"Rz_Max {NM}"),
                        ("Ra", f"Ra_Min {NM}", f"Ra_Mean {NM}", f"Ra_Max {NM}")]
        for name, lo, mid, hi in triples:
            a, b, c = g(lo), g(mid), g(hi)
            eps = 1e-9
            if a is not None and b is not None and b < a - eps:
                flags.append(f"{name} Mean<Min")
            if b is not None and c is not None and b > c + eps:
                flags.append(f"{name} Mean>Max")
            if a is not None and c is not None and a > c + eps:
                flags.append(f"{name} Min>Max")

    if q.get("negative_check", True):
        neg = [c for c in row if ("(µm)" in c or "(nm)" in c) and g(c) is not None and g(c) < 0]
        if neg:
            flags.append("Negative: " + ", ".join(c.split(" (")[0] for c in neg))

    tol = q.get("diameter_tolerance_pct")
    if sheet == "Pad" and tol is not None and row.get("_diam_measured"):
        d, r = g(f"Diameter {UM}"), g(f"Radius {UM}")
        if d is not None and r:
            dev = abs(d - 2 * r) / (2 * r) * 100
            if dev > tol:
                flags.append(f"Diameter vs 2xRadius off {dev:.1f}%")

    for col, lim in (q.get("plausible_range") or {}).items():
        if not lim or col not in row:
            continue
        v = g(col)
        if v is None:
            continue
        lo, hi = lim.get("min"), lim.get("max")
        if lo is not None and v < lo:
            flags.append(f"{col.split(' (')[0]}<{lo}")
        if hi is not None and v > hi:
            flags.append(f"{col.split(' (')[0]}>{hi}")

    txt = "; ".join(flags) if flags else None
    if txt:
        log.add("WARNING", f"QC: {txt}", ctx, block=block, unit=row.get("Unit", ""))
    return txt


# ----------------------------------------------------------------- scanning
def scan(root, cfg, log):
    pattern = norm(cfg.get("file_pattern", "*_Summary.xlsx"))
    f_bu = as_list(cfg.get("buildup"))
    f_bu = {norm_bu(b) or str(b) for b in f_bu} if f_bu else None
    f_pr = as_list(cfg.get("process"))
    f_pr = {norm_process(p) or str(p) for p in f_pr} if f_pr else None
    f_pn = as_list(cfg.get("panels"))
    f_pn = {int(p) for p in f_pn} if f_pn else None

    found = {}          # folder key -> list of (ts, path, ctx)
    seen_panels = set()
    all_bu, all_pr = set(), set()

    for dirpath, _, files in os.walk(root):
        rel_parts = os.path.relpath(dirpath, root).split(os.sep)
        if not any(norm(p) == "hrm" for p in rel_parts):
            continue
        bu = next((norm_bu(p) for p in rel_parts if norm_bu(p)), None)
        pr = next((norm_process(p) for p in rel_parts if norm_process(p)), None)
        pn = next((norm_panel(p) for p in rel_parts if norm_panel(p) is not None), None)
        sd = norm_side(rel_parts[-1])
        ctx = {"Buildup": bu or "", "Process": pr or "", "Panel": pn if pn is not None else "",
               "Side": sd[0] if sd else "", "Location": sd[1] if sd else ""}
        if bu:
            all_bu.add(bu)
        if pr:
            all_pr.add(pr)
        if bu and pr and pn is not None:
            seen_panels.add((bu, pr, pn))
        other, notpat, filtered = [], [], []
        for f in files:
            fctx = dict(ctx, Source_File=f)
            if f.startswith("~$"):
                other.append(f)
                continue
            if not fnmatch.fnmatch(norm(f), pattern):
                # only mention files that could have been data
                if os.path.splitext(norm(f))[1] in DATA_EXT:
                    notpat.append(f)
                else:
                    other.append(f)
                continue
            missing = [n for n, v in (("buildup", bu), ("process", pr),
                                      ("panel", pn), ("side", sd)) if v is None]
            if missing:
                log.add("ERROR", f"Could not read {', '.join(missing)} from path "
                                 f"'{os.path.relpath(dirpath, root)}'; file skipped", fctx)
                continue
            if (f_bu and bu not in f_bu) or (f_pr and pr not in f_pr) or (f_pn and pn not in f_pn):
                filtered.append(f)
                continue
            full = os.path.join(dirpath, f)
            ts = file_timestamp(f)
            if ts is None:
                ts = datetime.fromtimestamp(os.path.getmtime(full))
                log.add("WARNING", "No timestamp in file name; file date used for Measured_At", fctx)
            key = (bu, pr, pn, sd[0], sd[1])
            rel = os.path.join(os.path.relpath(dirpath, root), f)
            found.setdefault(key, []).append(
                (ts, full, dict(fctx, Measured_At=ts, Source_Path=rel, Full_Path=full)))
        if notpat:
            log.add("INFO", f"{len(notpat)} file(s) not matching "
                            f"'{cfg.get('file_pattern')}': {', '.join(notpat[:5])}"
                            + (" ..." if len(notpat) > 5 else ""), ctx)
        if filtered:
            log.add("INFO", f"{len(filtered)} file(s) filtered out by settings", ctx)
        if other:
            ex = sorted({os.path.splitext(f)[1].lstrip('.').lower() or '?' for f in other})
            log.add("INFO", f"{len(other)} other file(s) ignored ({', '.join(ex)})", ctx)

    if f_bu:
        for b in f_bu - all_bu:
            log.add("WARNING", f"Buildup '{b}' from settings not found. Found: {sorted(all_bu)}")
    if f_pr:
        for p in f_pr - all_pr:
            log.add("WARNING", f"Process '{p}' from settings not found. Found: {sorted(all_pr)}")

    # duplicates
    jobs = {}
    for key, lst in found.items():
        lst.sort(key=lambda x: x[0], reverse=True)
        if len(lst) > 1 and norm(cfg.get("duplicates", "newest")) == "newest":
            for ts, p, c in lst[1:]:
                log.add("INFO", f"Older duplicate skipped (newest used: {lst[0][2]['Source_File']})", c)
            lst = lst[:1]
        elif len(lst) > 1:
            log.add("INFO", f"{len(lst)} files in one folder, all kept (duplicates: all)", lst[0][2])
        jobs[key] = lst
    return jobs, seen_panels


# ----------------------------------------------------------------- output
def colour_summary(ws, df):
    """red row = errors, orange row = warnings."""
    from openpyxl.styles import PatternFill
    red = PatternFill("solid", fgColor="FFC7CE")
    orange = PatternFill("solid", fgColor="FFE5B4")
    if "Errors" not in df.columns:
        return
    for i, (_, r) in enumerate(df.iterrows(), start=2):
        fill = red if (r.get("Errors") or 0) > 0 or r.get("File found") == "\u2717" else (
            orange if (r.get("Warnings") or 0) > 0 else None)
        if fill:
            for c in ws[i]:
                c.fill = fill


def write_excel(path, sheets, decimals):
    fmt = "0." + "0" * decimals if decimals > 0 else "0"
    with pd.ExcelWriter(path, engine="openpyxl") as xw:
        for name, df in sheets.items():
            df.to_excel(xw, sheet_name=name, index=False)
            ws = xw.sheets[name]
            ws.freeze_panes = "A2"
            if ws.max_row > 1:
                ws.auto_filter.ref = ws.dimensions
            for ci, col in enumerate(df.columns, start=1):
                letter = get_column_letter(ci)
                width = max([len(str(col))] + [len(str(v)) for v in df[col].head(200)
                                                if v is not None]) + 2
                ws.column_dimensions[letter].width = min(max(width, 8), 60)
                if pd.api.types.is_float_dtype(df[col]) or col in ("Value",):
                    for cell in ws[letter][1:]:
                        if isinstance(cell.value, float):
                            cell.number_format = fmt
                if name == "Summary" and ci == 1:
                    colour_summary(ws, df)
                if col == "Measured_At":
                    for cell in ws[letter][1:]:
                        cell.number_format = "yyyy-mm-dd hh:mm"


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    spath = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, "HRM-settings_v2.yaml")
    with open(spath, encoding="utf-8") as fh:
        cfg = yaml.safe_load(fh) or {}

    last = last_paths()
    root = cfg.get("root_folder") or pick_folder(
        "Select the LOT folder (e.g. ...\\FHR0020\\19197)", last.get("root_folder"))
    outdir = cfg.get("output_folder") or pick_folder(
        "Select the OUTPUT folder", last.get("output_folder") or root)
    root = os.path.normpath(root)
    if not os.path.isdir(root):
        sys.exit(f"Root folder not found: {root}")
    os.makedirs(outdir, exist_ok=True)
    save_last(root, outdir)

    parts = root.split(os.sep)
    auto = {"lot": parts[-1] if len(parts) >= 1 else "",
            "part": parts[-2] if len(parts) >= 2 else "",
            "project": parts[-3] if len(parts) >= 3 else ""}

    def pick(key, auto_val):
        v = cfg.get(key, "auto")
        return auto_val if v is None or norm(v) == "auto" else str(v)

    lot_meta = {"Project_Name": pick("project_name", auto["project"]),
                "Part_Number": pick("part_number", auto["part"]),
                "Lot_Number": pick("lot_number", auto["lot"]),
                "Lot_Name": cfg.get("lot_name") or ""}

    log = Log()
    log.add("INFO", f"Root: {root} | Project={lot_meta['Project_Name']} "
                    f"Part={lot_meta['Part_Number']} Lot={lot_meta['Lot_Number']}")
    print(f"Lot {lot_meta['Lot_Number']}  ({lot_meta['Project_Name']} / {lot_meta['Part_Number']})")

    jobs, seen_panels = scan(root, cfg, log)
    out = {k: [] for k in ("Pad", "Trace", "Via", "Roughness", "Unmapped")}
    summary = []

    for key in sorted(jobs, key=lambda k: (k[0], k[1], k[2], k[3], k[4] != "Unit")):
        for ts, full, ctx in jobs[key]:
            ctx.update(lot_meta)
            print(f"{ctx['Buildup']} | {ctx['Process']} | Panel {ctx['Panel']} | "
                  f"{ctx['Side']} {ctx['Location']} | {ctx['Source_File']}")
            n_warn0 = sum(1 for r in log.rows if r["Level"] == "WARNING")
            n_err0 = sum(1 for r in log.rows if r["Level"] == "ERROR")
            try:
                res = parse_file(full, ctx, cfg, log, out)
            except Exception as e:  # noqa: BLE001  - never stop the whole run
                log.add("ERROR", f"Unexpected problem, file skipped: {type(e).__name__}: {e}", ctx)
                res = None
            counts, units = res if res else ({}, set())
            summary.append({
                "Buildup": key[0], "Process": key[1], "Panel": key[2], "Side": key[3],
                "Location": key[4], "File found": "✓",
                "Source_Path": ctx.get("Source_Path", ""),
                "Full_Path": ctx.get("Full_Path", ""),
                "Units": len(units), "Pad rows": counts.get("Pad", 0),
                "Trace rows": counts.get("Trace", 0), "Via rows": counts.get("Via", 0),
                "Roughness rows": counts.get("Roughness", 0),
                "Unmapped rows": counts.get("Unmapped", 0),
                "Warnings": sum(1 for r in log.rows if r["Level"] == "WARNING") - n_warn0,
                "Errors": sum(1 for r in log.rows if r["Level"] == "ERROR") - n_err0})

    # expected sides
    exp = [s.capitalize() for s in (cfg.get("expected_sides") or [])]
    have = {(k[0], k[1], k[2], k[3]) for k in jobs if k[4] == "Unit"}
    f_pn = as_list(cfg.get("panels"))
    for bu, pr, pn in sorted(seen_panels):
        if not any(k[0] == bu and k[1] == pr and k[2] == pn for k in jobs):
            continue  # whole panel filtered out / empty
        for s in exp:
            if (bu, pr, pn, s) not in have:
                ctx = {"Buildup": bu, "Process": pr, "Panel": pn, "Side": s, "Location": "Unit"}
                log.add("WARNING", f"Expected side '{s}' not found", ctx)
                summary.append({"Buildup": bu, "Process": pr, "Panel": pn, "Side": s,
                                "Location": "Unit", "File found": "✗", "Source_Path": "",
                                "Full_Path": "",
                                "Units": 0, "Pad rows": 0, "Trace rows": 0, "Via rows": 0,
                                "Roughness rows": 0, "Unmapped rows": 0, "Warnings": 1,
                                "Errors": 0})

    # frames
    sheets = {}
    sm = pd.DataFrame(summary)
    if not sm.empty:
        sm["_l"] = (sm["Location"] != "Unit").astype(int)
        sm = sm.sort_values(["Buildup", "Process", "Panel", "Side", "_l"]).drop(columns="_l")
    sheets["Summary"] = sm
    feat = {"Pad": ["Pad_Category", "Pad"], "Trace": ["Trace"], "Via": ["Via"],
            "Roughness": ["Roughness"], "Unmapped": ["Block", "Parameter"]}
    for name in ("Pad", "Trace", "Via", "Roughness", "Unmapped"):
        df = pd.DataFrame(out[name], columns=SHEET_COLS[name])
        if not df.empty:
            df["_l"] = (df["Location"] != "Unit").astype(int)
            df["_u"] = df["Unit"].map(unit_sort_key)
            df = df.sort_values(["Buildup", "Process", "Panel", "Side", "_l"] + feat[name]
                                + ["_u"], kind="stable").drop(columns=["_l", "_u"])
        sheets[name] = df
    logdf = pd.DataFrame(log.rows, columns=LOG_COLS).astype(object)
    if not logdf.empty:
        logdf["Panel"] = logdf["Panel"].map(lambda v: int(v) if is_num(v) else v)
    lvl = {"ERROR": 0, "WARNING": 1, "INFO": 2}
    issues = logdf[logdf["Level"].isin(("ERROR", "WARNING"))] if not logdf.empty else logdf
    if not issues.empty:
        issues = issues.sort_values("Level", key=lambda c: c.map(lvl), kind="stable")
    sheets["Issues"] = issues.reset_index(drop=True)
    if norm(cfg.get("log_level", "normal")) == "full":
        sheets["Log"] = logdf

    # file name
    bus = sorted({k[0] for k in jobs})
    prs = sorted({k[1] for k in jobs})
    pns = sorted({k[2] for k in jobs})
    bu_txt = "BU" + compact([b.replace("BU-", "") for b in bus]) if bus else "BU"
    pr_txt = ("Post" + compact([p.replace("Post ", "") for p in prs])) if prs else "Post"
    pn_txt = "P" + compact(pns) if pns else "P"
    stamp = datetime.now().strftime("%Y-%m-%d_%H%M")
    safe = lambda s: re.sub(r"[^\w.\-]", "", s)
    base = safe(f"HRM_{lot_meta['Part_Number']}_{lot_meta['Lot_Number']}_{bu_txt}_"
                f"{pr_txt}_{pn_txt}_{stamp}")
    xlsx = os.path.join(outdir, base + ".xlsx")
    write_excel(xlsx, sheets, int(cfg.get("decimals", 3)))

    with open(os.path.join(outdir, base + "_log.txt"), "w", encoding="utf-8") as fh:
        for r in sorted(log.rows, key=lambda r: lvl.get(r["Level"], 3)):
            loc = " | ".join(str(r[c]) for c in LOG_COLS[1:9] if r[c] not in ("", None))
            fh.write(f"[{r['Level']}] {loc} | {r['Message']}\n")

    n_err = sum(1 for r in log.rows if r["Level"] == "ERROR")
    n_warn = sum(1 for r in log.rows if r["Level"] == "WARNING")
    print(f"\nFiles: {sum(len(v) for v in jobs.values())} | Pad {len(sheets['Pad'])} | "
          f"Trace {len(sheets['Trace'])} | Via {len(sheets['Via'])} | "
          f"Roughness {len(sheets['Roughness'])} | Unmapped {len(sheets['Unmapped'])}")
    print(f"Errors {n_err} | Warnings {n_warn}")
    print(f"Saved: {xlsx}")


if __name__ == "__main__":
    main()
