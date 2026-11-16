"""Inspect every downloaded SIPSA file and write docs/data_exploration.md (Spanish) plus charts in docs/figures.

Parsed tables are cached in data/interim so re-runs are fast. Delete data/interim/*.pkl to force a re-parse.

Usage: python scripts/explore_sipsa.py [--sample N]   (N = parse only N weekly files per year, for testing)
"""

import argparse
import csv
import difflib
import json
import re
import unicodedata
import warnings
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import openpyxl  # noqa: E402
import pandas as pd  # noqa: E402

warnings.filterwarnings("ignore")

ROOT_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT_DIR / "data" / "raw"
INTERIM_DIR = ROOT_DIR / "data" / "interim"
DOCS_DIR = ROOT_DIR / "docs"
FIGURES_DIR = DOCS_DIR / "figures"

MONTHS_ES = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6, "julio": 7,
    "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12,
    "ene": 1, "feb": 2, "mar": 3, "abr": 4, "may": 5, "jun": 6, "jul": 7, "ago": 8, "sept": 9, "sep": 9,
    "oct": 10, "nov": 11, "dic": 12,
}
MONTH_ABBR_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
# Categorical palette, fixed order (dataviz skill reference palette, light mode).
SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"]
TEXT_PRIMARY, TEXT_SECONDARY, GRID_COLOR, SURFACE = "#0b0b0b", "#52514e", "#e4e3df", "#fcfcfb"
BASIC_GROUPS = {"VERDURAS Y HORTALIZAS", "TUBERCULOS, RAICES Y PLATANOS", "FRUTAS", "GRANOS Y CEREALES"}
BOYACA_HINTS = ("boyaca", "tunja", "duitama", "sogamoso", "chiquinquira")


# ----------------------------------------------------------------------------- helpers

def strip_accents(text):
    return "".join(c for c in unicodedata.normalize("NFKD", str(text)) if not unicodedata.combining(c))


def name_key(text):
    text = strip_accents(text).lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def clean_text(value):
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def to_number(value):
    if isinstance(value, (int, float, np.integer, np.floating)) and not isinstance(value, bool):
        return float(value) if not np.isnan(value) else np.nan
    text = clean_text(value).replace(",", "")
    try:
        return float(text)
    except ValueError:
        return np.nan


def parse_week_label(label):
    """'20 al 26 de diciembre de 2014' or '20 de diciembre de 2025 - 26 de diciembre de 2025' -> (start, end)."""
    text = strip_accents(label).lower()
    month_re = "(?<![a-z])(?:" + "|".join(MONTHS_ES) + ")(?![a-z])"
    parts = re.findall(rf"(\d{{1,2}})\s*(?:de\s+)?({month_re})?\s*(?:de\s+|del\s+)?(\d{{4}})?", text)
    parts = [p for p in parts if 1 <= int(p[0]) <= 31]
    if not parts:
        return None, None
    years = re.findall(r"(20\d{2})", text)
    months = [m for m in re.findall(rf"({month_re})", text)]
    if not years or not months:
        return None, None
    end_day, end_month, end_year = parts[-1]
    end_month = MONTHS_ES[end_month or months[-1]]
    end_year = int(end_year or years[-1])
    try:
        end = date(end_year, end_month, int(end_day))
    except ValueError:
        return None, None
    start_day, start_month, start_year = parts[0]
    try:
        start_month_num = MONTHS_ES[start_month] if start_month else end_month
        start_year_num = int(start_year) if start_year else (end_year - 1 if start_month_num > end_month else end_year)
        start = date(start_year_num, start_month_num, int(start_day))
    except ValueError:
        start = end - timedelta(days=6)
    if start > end or (end - start).days > 10:
        start = end - timedelta(days=6)
    return start, end


def load_manifest():
    with open(RAW_DIR / "manifest.csv", newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


# ----------------------------------------------------------------------------- weekly prices

def is_min(key):
    return "minimo" in key or bool(re.match(r"^min( \d)?$", key))


def is_max(key):
    return "maximo" in key or bool(re.match(r"^max( \d)?$", key))


def is_mean(key):
    return "medio" in key or "promedio" in key or bool(re.match(r"^p( \d)?$", key))


def parse_weekly_file(path):
    """Return (rows, meta). Supports the flat layout (Producto | Mercado | min | max | medio) and
    the nested layout (product row followed by market rows) used in older files."""
    sheets = pd.read_excel(path, sheet_name=None, header=None)
    rows, layouts, header_rows, header_cells, footnotes = [], set(), [], [], set()
    for sheet_name, frame in sheets.items():
        values = frame.values.tolist()
        price_rows = []
        for i, row in enumerate(values):
            keys = [name_key(c) for c in row]
            if any(is_min(k) for k in keys) and any(is_max(k) for k in keys):
                price_rows.append(i)
        if not price_rows:
            continue
        for block_index, header_i in enumerate(price_rows):
            header = [name_key(c) for c in values[header_i]]
            col_min = next(j for j, k in enumerate(header) if is_min(k))
            col_max = next(j for j, k in enumerate(header) if is_max(k))
            col_mean = next((j for j, k in enumerate(header) if is_mean(k)), None)
            if col_mean is None:
                continue
            above = [name_key(c) for c in values[header_i - 1]] if header_i > 0 else []
            product_col = market_col = None
            for candidate in (header, above):
                if "producto" in candidate and any("mercado" in k for k in candidate):
                    product_col = candidate.index("producto")
                    market_col = next(j for j, k in enumerate(candidate) if "mercado" in k)
                    break
            layout = "flat" if product_col is not None else "nested"
            layouts.add(layout)
            if block_index == 0:
                header_rows.append(f"{sheet_name}:{header_i}-{header_i + 1}" if layout == "flat" else f"{sheet_name}:{header_i + 1}")
                cells = [clean_text(c) for c in (values[header_i - 1] if layout == "flat" and header_i > 0 else [])]
                cells += [clean_text(c) for c in values[header_i]]
                header_cells.append(" | ".join(c for c in cells if c))
            end_i = price_rows[block_index + 1] if block_index + 1 < len(price_rows) else len(values)
            current_product = None
            for row in values[header_i + 1:end_i]:
                label = clean_text(row[0]) if len(row) else ""
                mean = to_number(row[col_mean])
                if label.startswith("*") or label.lower().startswith("fuente"):
                    footnotes.add(label[:160])
                    continue
                if layout == "flat":
                    product, market = clean_text(row[product_col]), clean_text(row[market_col])
                    if not product or not market:
                        continue
                else:
                    if np.isnan(mean) and np.isnan(to_number(row[col_min])):
                        if label and not label.lower().startswith("cuadro") and len(label) < 80:
                            current_product = label
                        continue
                    product, market = current_product, label
                    if not product or not market:
                        continue
                rows.append((product, market, to_number(row[col_min]), to_number(row[col_max]), mean))
    meta = {
        "sheets": list(sheets),
        "layout": "/".join(sorted(layouts)) or "unknown",
        "header_rows": header_rows,
        "header": header_cells[0] if header_cells else "",
        "footnotes": sorted(footnotes),
        "rows": len(rows),
    }
    return rows, meta


def build_weekly(manifest, sample=None):
    cache = INTERIM_DIR / ("prices_weekly.pkl" if not sample else "prices_weekly_sample.pkl")
    meta_cache = cache.with_suffix(".meta.json")
    if cache.exists() and meta_cache.exists():
        return pd.read_pickle(cache), json.loads(meta_cache.read_text(encoding="utf-8"))
    entries = [m for m in manifest if m["source"] == "prices_weekly" and (ROOT_DIR / m["file"]).exists()]
    if sample:
        by_year = defaultdict(list)
        for m in entries:
            by_year[(parse_week_label(m["label"])[1] or date(1900, 1, 1)).year].append(m)
        entries = [m for items in by_year.values() for m in items[:sample]]
    frames, metas = [], []
    for i, entry in enumerate(entries, 1):
        path = ROOT_DIR / entry["file"]
        label = entry["label"]
        if not re.search(r"20\d{2}", label):  # some 2012/2014 labels omit or truncate the year
            label = re.sub(r"\s+(de\s+)?\d{1,3}$", "", label)
            file_year = re.search(r"(20\d{2})", path.name)
            if file_year:
                label = f"{label} de {file_year.group(1)}"
        start, end = parse_week_label(label)
        meta = {"file": path.name, "label": entry["label"], "week_start": str(start), "week_end": str(end)}
        try:
            rows, file_meta = parse_weekly_file(path)
            meta.update(file_meta)
        except Exception as exc:  # keep going, report it
            rows = []
            meta.update({"error": f"{type(exc).__name__}: {exc}", "rows": 0})
        metas.append(meta)
        if rows and end:
            frame = pd.DataFrame(rows, columns=["product", "market", "price_min", "price_max", "price_mean"])
            frame["week_start"], frame["week_end"], frame["file"] = pd.Timestamp(start), pd.Timestamp(end), path.name
            frames.append(frame)
        if i % 50 == 0:
            print(f"  weekly parsed {i}/{len(entries)}")
    data = pd.concat(frames, ignore_index=True)
    INTERIM_DIR.mkdir(parents=True, exist_ok=True)
    data.to_pickle(cache)
    meta_cache.write_text(json.dumps(metas, ensure_ascii=False, indent=1), encoding="utf-8")
    return data, metas


# ----------------------------------------------------------------------------- monthly prices

def build_monthly(manifest):
    cache = INTERIM_DIR / "prices_monthly.pkl"
    meta_cache = cache.with_suffix(".meta.json")
    if cache.exists() and meta_cache.exists():
        return pd.read_pickle(cache), json.loads(meta_cache.read_text(encoding="utf-8"))
    frames, metas = [], []
    for entry in [m for m in manifest if m["source"] == "prices_monthly"]:
        path = ROOT_DIR / entry["file"]
        sheets = pd.read_excel(path, sheet_name=None, header=None)
        meta = {"file": path.name, "sheets": list(sheets), "header_rows": [], "columns": [], "footnotes": set()}
        for sheet_name, frame in sheets.items():
            values = frame.values.tolist()
            header_i = next((i for i, r in enumerate(values[:20])
                             if "fecha" in [name_key(c) for c in r] and "producto" in [name_key(c) for c in r]), None)
            if header_i is None:
                continue
            header = [clean_text(c) for c in values[header_i]]
            keys = [name_key(c) for c in header]
            meta["header_rows"].append(f"{sheet_name}:{header_i + 1}")
            cols = [c for c in header if c]
            if cols not in meta["columns"]:
                meta["columns"].append(cols)
            idx = {
                "date": keys.index("fecha"),
                "group": keys.index("grupo") if "grupo" in keys else None,
                "product": keys.index("producto"),
                "market": next(j for j, k in enumerate(keys) if k in ("mercado", "fuente")),
                "price": next(j for j, k in enumerate(keys) if k.startswith("precio")),
            }
            body = pd.DataFrame(values[header_i + 1:])
            for _, row in body.iterrows():
                first = clean_text(row[0])
                if first.startswith("*"):
                    meta["footnotes"].add(first[:200])
            out = pd.DataFrame({
                "date": pd.to_datetime(body[idx["date"]], errors="coerce"),
                "group": body[idx["group"]] if idx["group"] is not None else None,
                "product": body[idx["product"]].map(clean_text),
                "market": body[idx["market"]].map(clean_text),
                "price": pd.to_numeric(body[idx["price"]], errors="coerce"),
            })
            out = out.dropna(subset=["date"])
            out["file"] = path.name
            frames.append(out)
        meta["footnotes"] = sorted(meta["footnotes"])
        metas.append(meta)
    data = pd.concat(frames, ignore_index=True)
    data.to_pickle(cache)
    meta_cache.write_text(json.dumps(metas, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    return data, metas


# ----------------------------------------------------------------------------- supply

SUPPLY_FIELDS = {
    "market": lambda k: "mercado" in k,
    "date": lambda k: k == "fecha",
    "dept_code": lambda k: ("codigo" in k or "divipola" in k) and "dep" in k,
    "muni_code": lambda k: ("codigo" in k or "divipola" in k) and "munic" in k,
    "dept": lambda k: k.startswith("departamento"),
    "muni": lambda k: k.startswith("municipio"),
    "group": lambda k: k == "grupo",
    "cpc": lambda k: "cpc" in k,
    "product": lambda k: k == "alimento",
    "qty": lambda k: k.startswith("cant"),
}


def parse_text_date(text):
    for fmt in ("%d/%m/%y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text.strip(), fmt)
        except ValueError:
            continue
    return None


def parse_supply_microdata(path):
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    totals = defaultdict(float)
    meta = {"file": path.name, "sheets": workbook.sheetnames, "data_sheets": [], "header_rows": [], "columns": [],
            "rows": 0, "date_min": None, "date_max": None, "null_qty": 0, "non_positive_qty": 0,
            "products": Counter(), "markets": Counter(), "foreign_origin_rows": 0, "text_date_rows": 0,
            "bad_date_rows": 0}
    for sheet in workbook.worksheets:
        iterator = sheet.iter_rows(values_only=True)
        header, header_i = None, None
        for i, row in enumerate(iterator):
            keys = [name_key(c) for c in row]
            if "fecha" in keys and "alimento" in keys:
                header, header_i = keys, i
                break
            if i > 15:
                break
        if header is None:
            continue
        idx = {}
        for field, test in SUPPLY_FIELDS.items():
            idx[field] = next((j for j, k in enumerate(header) if test(k)), None)
        meta["data_sheets"].append(sheet.title)
        meta["header_rows"].append(f"{sheet.title}:{header_i + 1}")
        raw_cols = [c for c in header if c]
        if raw_cols not in meta["columns"]:
            meta["columns"].append(raw_cols)
        for row in iterator:
            if row is None or len(row) <= idx["qty"]:
                continue
            when = row[idx["date"]]
            if isinstance(when, str):  # 2020 stores dates as text, e.g. '02/01/20'
                when = parse_text_date(when)
                if when is not None:
                    meta["text_date_rows"] += 1
            if not isinstance(when, datetime):
                if when is not None:
                    meta["bad_date_rows"] += 1
                continue
            qty = row[idx["qty"]]
            if not isinstance(qty, (int, float)):
                meta["null_qty"] += 1
                continue
            if qty <= 0:
                meta["non_positive_qty"] += 1
            market = clean_text(row[idx["market"]])
            product = clean_text(row[idx["product"]])
            dept = clean_text(row[idx["dept"]]) if idx["dept"] is not None else ""
            muni = clean_text(row[idx["muni"]]) if idx["muni"] is not None else ""
            dept_code = clean_text(row[idx["dept_code"]]).lstrip("'") if idx["dept_code"] is not None else ""
            muni_code = clean_text(row[idx["muni_code"]]).lstrip("'") if idx["muni_code"] is not None else ""
            group = clean_text(row[idx["group"]]) if idx["group"] is not None else ""
            if muni_code and not muni_code.isdigit():
                meta["foreign_origin_rows"] += 1
            totals[(market, when.year, when.month, dept_code, dept, muni_code, muni, group, product)] += qty
            meta["rows"] += 1
            meta["products"][product] += 1
            meta["markets"][market] += 1
            meta["date_min"] = min(meta["date_min"] or when, when)
            meta["date_max"] = max(meta["date_max"] or when, when)
    workbook.close()
    frame = pd.DataFrame([(*k, v) for k, v in totals.items()],
                         columns=["market", "year", "month", "dept_code", "dept", "muni_code", "muni", "group",
                                  "product", "kg"])
    return frame, meta


def describe_supply_series(path):
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    sheets = []
    for sheet in workbook.worksheets:
        rows = list(sheet.iter_rows(values_only=True, max_row=12))
        header_i = next((i for i, r in enumerate(rows) if r and name_key(r[0]) in ("fecha", "ciudad")), None)
        info = {"sheet": sheet.title, "max_row": sheet.max_row, "max_col": sheet.max_column,
                "title": clean_text(rows[1][0]) if len(rows) > 1 and rows[1] else ""}
        if header_i is not None:
            header = [clean_text(c) for c in rows[header_i] if clean_text(c)]
            info.update({"header_row": header_i + 1, "n_columns": len(header), "first_columns": header[:8],
                         "last_columns": header[-3:]})
            all_rows = list(sheet.iter_rows(values_only=True, min_row=header_i + 2))
            if name_key(rows[header_i][0]) == "fecha":
                dates = [r[0] for r in all_rows if r and isinstance(r[0], datetime)]
                info["date_min"], info["date_max"], info["n_periods"] = str(min(dates).date()), str(max(dates).date()), len(dates)
                formula_or_empty = sum(1 for r in all_rows if r and isinstance(r[0], datetime) and r[1] is None)
                info["total_column_without_cached_value"] = formula_or_empty
            else:
                info["week_labels_first_last"] = [header[2], header[-1]] if len(header) > 2 else []
                info["n_periods"] = max(len(header) - 2, 0)
                info["cities"] = sorted({clean_text(r[0]) for r in all_rows if r and clean_text(r[0])})
        sheets.append(info)
    workbook.close()
    return {"file": path.name, "sheets": sheets}


def build_supply(manifest):
    cache = INTERIM_DIR / "supply_monthly.pkl"
    meta_cache = cache.with_suffix(".meta.json")
    if cache.exists() and meta_cache.exists():
        return pd.read_pickle(cache), json.loads(meta_cache.read_text(encoding="utf-8"))
    frames, metas, series_meta = [], [], []
    for entry in [m for m in manifest if m["source"] == "supply"]:
        path = ROOT_DIR / entry["file"]
        print(f"  supply: {path.name}")
        if "series-historicas" in path.name.lower():
            series_meta.append(describe_supply_series(path))
            continue
        frame, meta = parse_supply_microdata(path)
        meta["products"] = dict(meta["products"])
        meta["markets"] = dict(meta["markets"])
        meta["date_min"], meta["date_max"] = str(meta["date_min"]), str(meta["date_max"])
        frame["file"] = path.name
        frames.append(frame)
        metas.append(meta)
    data = pd.concat(frames, ignore_index=True)
    data.to_pickle(cache)
    all_meta = {"microdata": metas, "series": series_meta}
    meta_cache.write_text(json.dumps(all_meta, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    return data, all_meta


# ----------------------------------------------------------------------------- analysis

def canonical_names(series):
    """Map raw names to the most frequent raw spelling among those sharing the same normalized key."""
    counts = series.value_counts()
    by_key = defaultdict(list)
    for name, count in counts.items():
        by_key[name_key(name)].append((count, name))
    mapping, variants = {}, []
    for key, items in by_key.items():
        items.sort(reverse=True)
        for _, name in items:
            mapping[name] = items[0][1]
        if len(items) > 1:
            variants.append([n for _, n in items])
    return mapping, variants


def near_duplicates(names, cutoff=0.88):
    names = sorted(set(names))
    pairs = []
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            ratio = difflib.SequenceMatcher(None, name_key(a), name_key(b)).ratio()
            if ratio >= cutoff:
                pairs.append((a, b, round(ratio, 2)))
    return pairs


def week_of(end):
    """Saturday-to-Friday week of a bulletin, anchored on its closing date."""
    if end.weekday() == 5:  # a label closing on Saturday overlaps the next bulletin
        end = end - pd.Timedelta(days=1)
    return end.to_period("W-FRI")


def coverage_matrix(weekly, start, end):
    total_weeks = len(pd.period_range(start, end, freq="W-FRI"))
    window = weekly[(weekly["week"] >= pd.Period(start, "W-FRI")) & (weekly["week"] <= pd.Period(end, "W-FRI"))]
    counts = window.groupby(["product", "market"])["week"].nunique()
    return (counts / total_weeks).unstack(fill_value=0.0), total_weeks


STAPLE_FAMILIES = (("papa", None), ("cebolla", None), ("tomate", "arbol"))


def family_varieties(names, family, exclude):
    return [p for p in names if name_key(p).split(" ")[0] == family and not (exclude and exclude in name_key(p))]


def pick_shortlist(weekly, product_groups, start, end, min_staple_coverage=0.8):
    """Staple varieties (potato, onion, tomato) are fixed first: the variety well covered in the most markets.
    Markets must carry all of them; then Corabastos, the best Boyaca market and the best-scored markets."""
    cov, _ = coverage_matrix(weekly, start, end)
    basic = [p for p in cov.index if product_groups.get(p) in BASIC_GROUPS] or list(cov.index)
    cov_basic = cov.loc[basic]
    top_products = cov_basic.mean(axis=1).sort_values(ascending=False).head(30).index
    market_score = cov_basic.loc[top_products].mean().sort_values(ascending=False)
    boyaca = [m for m in market_score.index if any(h in name_key(m) for h in BOYACA_HINTS)]
    best_boyaca = boyaca[0] if boyaca else None
    anchors = [m for m in market_score.index if "corabastos" in name_key(m)][:1] + ([best_boyaca] if best_boyaca else [])
    staples = []
    for family, exclude in STAPLE_FAMILIES:
        varieties = family_varieties(cov_basic.index, family, exclude)
        if varieties:  # must be present in the anchor markets, then in as many markets as possible
            staples.append(max(varieties, key=lambda v: (cov_basic.loc[v, anchors].min() >= min_staple_coverage,
                                                         (cov_basic.loc[v] >= min_staple_coverage).sum(),
                                                         cov_basic.loc[v].mean())))
    eligible = cov_basic.columns[(cov_basic.loc[staples] >= min_staple_coverage).all()] if staples else cov_basic.columns
    eligible_score = market_score[market_score.index.isin(eligible)]
    markets = [m for m in anchors if m != best_boyaca]
    for market in eligible_score.index:
        if len(markets) >= (5 if best_boyaca else 6):
            break
        if market not in markets and market != best_boyaca:
            markets.append(market)
    if best_boyaca:
        markets.append(best_boyaca)
    product_score = cov_basic[markets].mean(axis=1).sort_values(ascending=False)
    products = list(staples)
    families = Counter(name_key(p).split(" ")[0] for p in products)
    for product in product_score.index:
        if len(products) >= 8:
            break
        family = name_key(product).split(" ")[0]
        if product in products or families[family] >= 1 or cov_basic.loc[product, markets].min() < 0.5:
            continue
        products.append(product)
        families[family] += 1
    excluded = [m for m in market_score.index[:10] if m not in eligible]
    return products, markets, cov, market_score, boyaca, excluded


def detect_outliers(weekly):
    """Week-over-week jumps: |log change| > log(2) on the canonical weekly mean price of each pair."""
    series = weekly.groupby(["product", "market", "week"])["price_mean"].mean().sort_index()
    log_price = np.log(series.where(series > 0))
    change = log_price.groupby(level=[0, 1]).diff()
    jumps = change[change.abs() > np.log(2)]
    return jumps, series


# ----------------------------------------------------------------------------- charts

def style_axes(ax, title, xlabel, ylabel):
    ax.set_facecolor(SURFACE)
    ax.set_title(title, loc="left", fontsize=12, color=TEXT_PRIMARY, pad=10)
    ax.set_xlabel(xlabel, color=TEXT_SECONDARY)
    ax.set_ylabel(ylabel, color=TEXT_SECONDARY)
    ax.grid(axis="y", color=GRID_COLOR, linewidth=0.8)
    ax.set_axisbelow(True)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        ax.spines[side].set_color(GRID_COLOR)
    ax.tick_params(colors=TEXT_SECONDARY, labelsize=9)


def chart_potato(series, product, markets, path):
    fig, ax = plt.subplots(figsize=(11, 5.2), facecolor=SURFACE)
    for color, market in zip(SERIES_COLORS, markets):
        try:
            s = series.loc[(product, market)]
        except KeyError:
            continue
        s.index = s.index.to_timestamp()
        s = s.asfreq("W-SAT") if s.index.is_unique else s
        ax.plot(s.index, s.values, color=color, linewidth=1.6, label=market)
    style_axes(ax, f"Precio mayorista semanal de {product.lower()} por mercado", "Semana", "Precio medio ($/kg)")
    ax.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: f"${v:,.0f}".replace(",", ".")))
    ax.legend(frameon=False, fontsize=9, ncol=3, loc="upper left")
    fig.text(0.01, 0.01, "Fuente: DANE-SIPSA, boletines semanales de precios mayoristas. Huecos = semanas sin dato.",
             fontsize=8, color=TEXT_SECONDARY)
    fig.tight_layout(rect=(0, 0.03, 1, 1))
    fig.savefig(path, dpi=150)
    plt.close(fig)


def chart_heatmap(cov, products, markets, shortlist_products, shortlist_markets, period_text, path):
    data = cov.loc[products, markets].values * 100
    fig, ax = plt.subplots(figsize=(max(9, len(markets) * 0.55 + 4), max(6, len(products) * 0.32 + 2)), facecolor=SURFACE)
    cmap = matplotlib.colors.LinearSegmentedColormap.from_list(
        "blues", ["#f3f2ee", "#cde2fb", "#86b6ef", "#3987e5", "#256abf", "#104281"])
    image = ax.imshow(data, aspect="auto", cmap=cmap, vmin=0, vmax=100)
    ax.set_xticks(range(len(markets)))
    ax.set_xticklabels(markets, rotation=60, ha="right", fontsize=8)
    ax.set_yticks(range(len(products)))
    ax.set_yticklabels(products, fontsize=8)
    for label in ax.get_xticklabels():
        if label.get_text() in shortlist_markets:
            label.set_fontweight("bold")
    for label in ax.get_yticklabels():
        if label.get_text() in shortlist_products:
            label.set_fontweight("bold")
    ax.set_xticks(np.arange(-0.5, len(markets)), minor=True)
    ax.set_yticks(np.arange(-0.5, len(products)), minor=True)
    ax.grid(which="minor", color=SURFACE, linewidth=1.5)
    ax.tick_params(which="minor", length=0)
    ax.tick_params(colors=TEXT_SECONDARY)
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.set_title(f"Cobertura de semanas con precio por producto y mercado ({period_text})", loc="left",
                 fontsize=12, color=TEXT_PRIMARY, pad=10)
    bar = fig.colorbar(image, ax=ax, fraction=0.03, pad=0.02)
    bar.set_label("% de semanas con dato", color=TEXT_SECONDARY)
    bar.outline.set_visible(False)
    fig.text(0.01, 0.01, "En negrita: productos y mercados recomendados. Fuente: DANE-SIPSA.", fontsize=8,
             color=TEXT_SECONDARY)
    fig.tight_layout(rect=(0, 0.02, 1, 1))
    fig.savefig(path, dpi=150)
    plt.close(fig)


def seasonal_index(series, product, market):
    s = series.loc[(product, market)].copy()
    s.index = s.index.to_timestamp()
    trend = s.rolling(52, center=True, min_periods=26).mean()
    ratio = (s / trend).dropna()
    return ratio.groupby(ratio.index.month).mean() * 100, ratio.index.year.nunique()


def chart_seasonality(series, products, market, path):
    cols = 4
    rows = int(np.ceil(len(products) / cols))
    fig, axes = plt.subplots(rows, cols, figsize=(13, 3.1 * rows), facecolor=SURFACE, sharey=True)
    axes = np.atleast_1d(axes).ravel()
    for ax, product in zip(axes, products):
        try:
            index, years = seasonal_index(series, product, market)
        except KeyError:
            ax.set_visible(False)
            continue
        index = index.reindex(range(1, 13))
        bars = ax.bar(range(1, 13), index.values - 100, bottom=100, color=SERIES_COLORS[0], width=0.7)
        ax.axhline(100, color=TEXT_SECONDARY, linewidth=0.8)
        style_axes(ax, f"{product} ({years} años)", "", "")
        ax.title.set_fontsize(10)
        ax.set_xticks(range(1, 13))
        ax.set_xticklabels([m[0] for m in MONTH_ABBR_ES], fontsize=8)
        del bars
    for ax in axes[len(products):]:
        ax.set_visible(False)
    axes[0].set_ylabel("Índice (100 = tendencia)", color=TEXT_SECONDARY)
    fig.suptitle(f"Estacionalidad mensual del precio en {market}: precio / media móvil de 52 semanas",
                 x=0.01, ha="left", fontsize=12, color=TEXT_PRIMARY)
    fig.text(0.01, 0.005, "Barras sobre 100 = meses más caros que la tendencia; bajo 100 = más baratos. Fuente: DANE-SIPSA.",
             fontsize=8, color=TEXT_SECONDARY)
    fig.tight_layout(rect=(0, 0.02, 1, 0.96))
    fig.savefig(path, dpi=150)
    plt.close(fig)


def chart_supply_origin(supply, product_key, market, path):
    subset = supply[(supply["market"] == market) & (supply["product"].map(name_key).str.match(rf"^{product_key}( |$)"))]
    if subset.empty:
        return None
    # Group by DIVIPOLA code: the department name is spelled differently across years (e.g. "BOGOTÁ, D. C.").
    dept_names = subset.groupby("dept_code")["dept"].agg(lambda n: n.value_counts().index[0])
    subset = subset.assign(dept_label=subset["dept_code"].map(dept_names))
    by_year = subset.groupby(["year", "dept_label"])["kg"].sum().unstack(fill_value=0).astype(float) / 1000
    top = by_year.sum().sort_values(ascending=False).head(4).index.tolist()
    other = by_year.drop(columns=top).sum(axis=1)
    plot = by_year[top].copy()
    plot["Otros"] = other
    fig, ax = plt.subplots(figsize=(11, 5), facecolor=SURFACE)
    bottom = np.zeros(len(plot))
    colors = SERIES_COLORS[:len(top)] + ["#b9b8b2"]
    for color, column in zip(colors, plot.columns):
        ax.bar(plot.index, plot[column].values, bottom=bottom, color=color, width=0.75, label=column.title(),
               edgecolor=SURFACE, linewidth=1)
        bottom += plot[column].values
    style_axes(ax, f"Ingreso de papa a {market} por departamento de procedencia",
               "Año", "Toneladas")
    ax.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: f"{v:,.0f}".replace(",", ".")))
    ax.set_xticks(plot.index)
    ax.legend(frameon=False, fontsize=9, ncol=5, loc="upper left", bbox_to_anchor=(0, -0.1))
    fig.text(0.01, 0.01, f"Incluye todos los alimentos cuyo nombre empieza por 'papa'. Fuente: DANE-SIPSA abastecimiento (microdatos). "
             f"Último año parcial.", fontsize=8, color=TEXT_SECONDARY)
    fig.tight_layout(rect=(0, 0.03, 1, 1))
    fig.savefig(path, dpi=150)
    plt.close(fig)
    return plot


# ----------------------------------------------------------------------------- report

def md_table(headers, rows):
    lines = ["| " + " | ".join(headers) + " |", "|" + "|".join("---" for _ in headers) + "|"]
    for row in rows:
        lines.append("| " + " | ".join(str(c).replace("|", "/") for c in row) + " |")
    return "\n".join(lines)


def pct(x):
    return f"{x * 100:.1f}%"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sample", type=int, default=None)
    args = parser.parse_args()
    INTERIM_DIR.mkdir(parents=True, exist_ok=True)
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest()

    print("Parsing weekly price annexes...")
    weekly_raw, weekly_meta = build_weekly(manifest, args.sample)
    print("Parsing monthly price series...")
    monthly, monthly_meta = build_monthly(manifest)
    print("Parsing supply files...")
    supply, supply_meta = build_supply(manifest)

    # --- names
    product_map, product_variants = canonical_names(pd.concat([weekly_raw["product"], monthly["product"]]))
    market_map, market_variants = canonical_names(pd.concat([weekly_raw["market"], monthly["market"]]))
    weekly = weekly_raw.copy()
    weekly["product"] = weekly["product"].map(product_map)
    weekly["market"] = weekly["market"].map(market_map)
    weekly["week"] = weekly["week_end"].map(week_of)
    monthly["product"] = monthly["product"].map(product_map)
    monthly["market"] = monthly["market"].map(market_map)
    product_groups = (monthly.dropna(subset=["group"]).assign(group=lambda d: d["group"].map(lambda g: strip_accents(clean_text(g)).upper()))
                      .groupby("product")["group"].agg(lambda g: g.mode().iat[0]).to_dict())

    first_week, last_week = weekly["week"].min(), weekly["week"].max()
    all_weeks = pd.period_range(first_week, last_week, freq="W-FRI")
    weeks_present = set(weekly["week"].unique())
    missing_weeks = [w for w in all_weeks if w not in weeks_present]
    file_weeks = Counter(str(week_of(pd.Timestamp(m["week_end"]))) for m in weekly_meta if m.get("week_end") not in (None, "None"))
    end_weekdays = Counter(pd.Timestamp(m["week_end"]).day_name() for m in weekly_meta if m.get("week_end") not in (None, "None"))
    irregular_labels = [m for m in weekly_meta if m.get("week_end") not in (None, "None")
                        and (pd.Timestamp(m["week_end"]) - pd.Timestamp(m["week_start"])).days != 6]
    duplicated_file_weeks = {k: v for k, v in file_weeks.items() if v > 1}
    unparsed = [m for m in weekly_meta if not m.get("rows")]
    no_date = [m for m in weekly_meta if m.get("week_end") in (None, "None")]

    duplicated_rows = weekly.duplicated(subset=["week", "product", "market"], keep=False)
    dup_conflicts = weekly[duplicated_rows].groupby(["week", "product", "market"])["price_mean"].nunique()
    bad_range = weekly[(weekly["price_min"] > weekly["price_max"]) |
                       (weekly["price_mean"] < weekly["price_min"] - 1) | (weekly["price_mean"] > weekly["price_max"] + 1)]
    non_positive = weekly[~(weekly["price_mean"] > 0)]
    jumps, pair_series = detect_outliers(weekly)

    # --- shortlist (full period and recent window)
    full_start, full_end = first_week.start_time, last_week.end_time
    recent_start = pd.Timestamp("2018-01-01")
    products, markets, cov_full, market_score, boyaca_markets, excluded_markets = pick_shortlist(
        weekly, product_groups, full_start, full_end)
    cov_recent, recent_weeks = coverage_matrix(weekly, recent_start, full_end)

    pair_stats = []
    for product in products:
        for market in markets:
            try:
                s = pair_series.loc[(product, market)]
            except KeyError:
                pair_stats.append((product, market, 0, "-", "-", "100%"))
                continue
            span = pd.period_range(s.index.min(), s.index.max(), freq="W-FRI")
            pair_stats.append((product, market, len(s), str(s.index.min().end_time.date()),
                               str(s.index.max().end_time.date()), pct(1 - len(s) / len(span))))

    # --- figures
    figures = []
    potato = products[0]
    chart_potato(pair_series, potato, markets, FIGURES_DIR / "potato_weekly_prices.png")
    figures.append(("potato_weekly_prices.png", f"Precio semanal de {potato} en los mercados recomendados"))
    heat_products = cov_full.loc[[p for p in cov_full.index if product_groups.get(p) in BASIC_GROUPS]].mean(axis=1) \
        .sort_values(ascending=False).head(25).index.tolist()
    for p in products:
        if p not in heat_products:
            heat_products.append(p)
    heat_markets = market_score.head(20).index.tolist()
    for m in markets:
        if m not in heat_markets:
            heat_markets.append(m)
    period_text = f"{full_start.year}–{full_end.year}"
    chart_heatmap(cov_full, heat_products, heat_markets, products, markets, period_text, FIGURES_DIR / "coverage_heatmap.png")
    figures.append(("coverage_heatmap.png", "Mapa de calor de cobertura (porcentaje de semanas con dato)"))
    season_market = markets[0]
    chart_seasonality(pair_series, products, season_market, FIGURES_DIR / "seasonality_by_month.png")
    figures.append(("seasonality_by_month.png", f"Índice estacional mensual en {season_market}"))
    supply_market = next((m for m in supply["market"].unique() if "corabastos" in name_key(m)), None)
    supply_plot = chart_supply_origin(supply, "papa", supply_market, FIGURES_DIR / "potato_supply_by_origin.png") \
        if supply_market else None
    if supply_plot is not None:
        figures.append(("potato_supply_by_origin.png", f"Toneladas de papa que ingresan a {supply_market} por departamento de origen"))

    # --- supply summaries
    micro = supply_meta["microdata"]
    supply_markets = sorted(supply["market"].unique())
    supply_products_by_file = {m["file"]: len(m["products"]) for m in micro}
    supply_market_map, supply_market_variants = canonical_names(supply["market"])
    price_market_keys = {name_key(m) for m in weekly["market"].unique()}
    supply_only = [m for m in supply_markets if name_key(m) not in price_market_keys]
    potato_supply = supply[supply["product"].map(name_key).str.match(r"^papa( |$)")]
    potato_names_by_year = potato_supply.groupby("year")["product"].agg(lambda s: sorted(set(s))).to_dict()

    # ------------------------------------------------------------------ write report
    out = []
    w = out.append
    w("# Exploración de datos SIPSA (DANE)\n")
    w(f"_Generado automáticamente por `scripts/explore_sipsa.py` el {date.today().isoformat()}. "
      "Todas las cifras salen de los archivos descargados en `data/raw`; lo que no se pudo determinar se marca como **desconocido**._\n")

    w("## 1. Fuentes descargadas\n")
    counts = Counter(m["source"] for m in manifest)
    w(md_table(["Fuente", "Descripción", "Archivos"], [
        ("prices_weekly", "Anexos de los boletines semanales de precios mayoristas (mín., máx. y medio por producto y mercado)", counts["prices_weekly"]),
        ("prices_monthly", "Series históricas de precios mayoristas (precio promedio mensual por producto y mercado)", counts["prices_monthly"]),
        ("supply", "Abastecimiento: serie histórica agregada + microdatos anuales por mercado, origen y alimento", counts["supply"]),
    ]))
    w("\nLa página del componente de precios mayoristas solo publica, en «Información histórica», páginas mensuales con los "
      "**boletines diarios**. La serie semanal se reconstruyó con los anexos de los boletines semanales (2012–2026), "
      "que tienen precio mínimo, máximo y medio por producto y mercado. También se descargaron las series históricas "
      "mensuales oficiales (2013–2026) como referencia. No se descargaron los anexos diarios porque existe la serie semanal.\n")

    # weekly
    w("## 2. Precios mayoristas semanales\n")
    w(f"- Archivos procesados: **{len(weekly_meta)}**; con datos: **{len(weekly_meta) - len(unparsed)}**; "
      f"sin datos legibles: **{len(unparsed)}**; sin fecha interpretable: **{len(no_date)}**.")
    w(f"- Rango de fechas: semana que termina el **{first_week.end_time.date()}** a la que termina el **{last_week.end_time.date()}** "
      f"(frecuencia semanal, sábado a viernes según las etiquetas de DANE).")
    w(f"- Filas (producto × mercado × semana): **{len(weekly):,}**".replace(",", "."))
    w(f"- Semanas calendario en el rango: {len(all_weeks)}; semanas sin ningún archivo: **{len(missing_weeks)}**.")
    if missing_weeks:
        sample = ", ".join(str(w_.end_time.date()) for w_ in missing_weeks[:25])
        w(f"  - Semanas faltantes (fecha de cierre, primeras 25): {sample}{' …' if len(missing_weeks) > 25 else ''}")
    if duplicated_file_weeks:
        w(f"- Semanas publicadas en más de un archivo: {len(duplicated_file_weeks)} ({', '.join(list(duplicated_file_weeks)[:10])}).")
    weekday_es = {"Friday": "viernes", "Thursday": "jueves", "Wednesday": "miércoles", "Saturday": "sábado"}
    w("- Día de cierre de la semana según la etiqueta: " + ", ".join(f"{weekday_es.get(k, k)} ({v})" for k, v in end_weekdays.most_common())
      + ". Las semanas cortas o largas coinciden con festivos (Semana Santa, fin de año); cada archivo se asigna a la semana sábado–viernes de su fecha de cierre "
      "(si la etiqueta cierra en sábado se toma el viernes anterior).")
    odd = [m for m in irregular_labels if (pd.Timestamp(m["week_end"]) - pd.Timestamp(m["week_start"])).days > 6]
    if odd:
        w("- Etiquetas con más de 7 días (probable error de DANE): " + "; ".join(f"`{m['file']}` → «{m['label']}»" for m in odd))
    if no_date:
        w("- Archivos sin fecha interpretable (excluidos): " + "; ".join(f"`{m['file']}` («{m['label']}»)" for m in no_date))
    w("- La fecha de cada archivo se toma del texto que acompaña el enlace en la página de DANE (los nombres de archivo "
      "no siguen un patrón: p. ej. `Anexo_Bol_Semanal_abr19_2014.xls`, `Anex_12mar_al_18mar_2022.xlsx`).\n")

    w("### 2.1 Formatos por año\n")
    by_year = defaultdict(list)
    for m in weekly_meta:
        year = m["week_end"][:4] if m.get("week_end") not in (None, "None") else "desconocido"
        by_year[year].append(m)
    rows = []
    for year in sorted(by_year):
        items = by_year[year]
        exts = Counter(Path(m["file"]).suffix.lower() for m in items)
        layouts = Counter(m.get("layout", "error") for m in items)
        sheets = Counter(len(m.get("sheets", [])) for m in items)
        headers = Counter(m.get("header", "") for m in items).most_common(1)[0][0]
        header_rows = Counter(m["header_rows"][0].split(":")[1] for m in items if m.get("header_rows")).most_common(1)
        rows.append((year, len(items), ", ".join(f"{k} ({v})" for k, v in exts.items()),
                     ", ".join(f"{k} ({v})" for k, v in layouts.items()),
                     ", ".join(f"{k} hojas ({v})" for k, v in sorted(sheets.items())),
                     header_rows[0][0] if header_rows else "-", headers[:110],
                     f"{int(np.median([m.get('rows', 0) for m in items])):,}".replace(",", ".")))
    w(md_table(["Año", "Archivos", "Extensión", "Estructura", "Hojas", "Fila encabezado (más común)", "Encabezado", "Filas mediana"], rows))
    w("\n- **flat**: columnas `Producto | Mercado mayorista | Precio mínimo | Precio máximo | Precio medio | Tendencia`, una hoja por grupo de alimentos.")
    w("- **nested**: una sola columna «Productos y mercados»; una fila con el nombre del producto seguida de las filas de cada mercado; "
      "varios «Cuadros» (uno por grupo) en la misma hoja.")
    w("- Tipos: nombres de producto y mercado = texto; precios = enteros en pesos colombianos por kilogramo; «Tendencia» = texto (`+`, `-`, `=`, `n.d.`).")
    footnotes = Counter(f for m in weekly_meta for f in m.get("footnotes", []))
    unit_notes = [f for f in footnotes if "unidad" in f.lower() or "litro" in f.lower() or "kilogramo" in f.lower()]
    if unit_notes:
        w("- Notas de unidades encontradas en los anexos (no todo es $/kg):")
        for note in unit_notes[:6]:
            w(f"  - «{note}»")
    if unparsed:
        w(f"\nArchivos sin datos legibles ({len(unparsed)}):\n")
        w(md_table(["Archivo", "Etiqueta", "Error / estructura"], [(m["file"], m["label"], m.get("error", m.get("layout"))) for m in unparsed[:40]]))
    w("")

    w("### 2.2 Productos y mercados\n")
    w(f"- Productos distintos (tras unificar mayúsculas/tildes): **{weekly['product'].nunique()}**; mercados: **{weekly['market'].nunique()}**.")
    per_year = weekly.groupby(weekly["week_end"].dt.year).agg(products=("product", "nunique"), markets=("market", "nunique"))
    w("\n" + md_table(["Año", "Productos", "Mercados"], [(y, r.products, r.markets) for y, r in per_year.iterrows()]))
    market_first_last = weekly.groupby("market")["week_end"].agg(["min", "max", "count"]).sort_values("count", ascending=False)
    w("\nMercados cubiertos (primera y última semana con dato, número de registros):\n")
    w(md_table(["Mercado", "Desde", "Hasta", "Registros"],
               [(m, r["min"].date(), r["max"].date(), r["count"]) for m, r in market_first_last.iterrows()]))
    w(f"\nMercados en Boyacá: {', '.join(boyaca_markets) if boyaca_markets else 'ninguno'}.\n")
    w("<details><summary>Lista completa de productos</summary>\n")
    w(", ".join(sorted(weekly["product"].unique())))
    w("\n</details>\n")

    w("### 2.3 Semanas con dato por par producto–mercado\n")
    pair_counts = weekly.groupby(["product", "market"])["week"].nunique()
    w(f"- Pares producto–mercado: **{len(pair_counts):,}**".replace(",", "."))
    w(f"- Semanas con dato por par: mediana {int(pair_counts.median())}, p25 {int(pair_counts.quantile(.25))}, "
      f"p75 {int(pair_counts.quantile(.75))}, máximo {int(pair_counts.max())} (de {len(all_weeks)} semanas posibles).")
    span_missing = []
    for (p, m), s in pair_series.groupby(level=[0, 1]):
        weeks = s.index.get_level_values(2)
        span = (weeks.max() - weeks.min()).n + 1
        span_missing.append(1 - len(weeks) / span)
    span_missing = pd.Series(span_missing)
    w(f"- Proporción de semanas faltantes dentro de la vida de cada par (entre su primera y última semana): "
      f"mediana {pct(span_missing.median())}, p75 {pct(span_missing.quantile(.75))}.")
    w(f"- Pares con ≥ 90 % de cobertura sobre todo el periodo: **{int((cov_full.values >= 0.9).sum())}**; "
      f"desde 2018: **{int((cov_recent.values >= 0.9).sum())}**.")
    w("- La tabla completa por par se puede regenerar desde `data/interim/prices_weekly.pkl`.\n")

    # monthly
    w("## 3. Series históricas mensuales de precios\n")
    rows = []
    for meta in monthly_meta:
        sub = monthly[monthly["file"] == meta["file"]]
        rows.append((meta["file"], len(meta["sheets"]), ", ".join(meta["header_rows"][:3]) + (" …" if len(meta["header_rows"]) > 3 else ""),
                     " / ".join(" · ".join(c) for c in meta["columns"]), f"{sub['date'].min().date()} a {sub['date'].max().date()}",
                     sub["date"].nunique(), f"{len(sub):,}".replace(",", ".")))
    w(md_table(["Archivo", "Hojas", "Fila encabezado", "Columnas", "Rango", "Meses", "Filas"], rows))
    w("\n- Frecuencia **mensual** (una fecha por mes: día 1). Es un promedio mensual por producto y mercado, sin mínimo ni máximo.")
    w("- Cambios entre años: la columna de mercado se llama «Fuente» (2013–2018) o «Mercado» (2019 en adelante); la de precio "
      "«Precio» o «Precio promedio por kilogramo*»; desde 2024 aparece «Código CPC»; 2013–2017 vienen en un solo archivo con una hoja por año "
      "y 2023 con una hoja por mes.")
    for note in sorted({f for m in monthly_meta for f in m["footnotes"]})[:4]:
        w(f"- Nota en el archivo: «{note}»")
    monthly_products, weekly_products = set(monthly["product"]), set(weekly["product"])
    w(f"- Productos solo en mensual: {len(monthly_products - weekly_products)}; solo en semanal: {len(weekly_products - monthly_products)}.\n")

    # supply
    w("## 4. Abastecimiento\n")
    w("### 4.1 Serie histórica agregada\n")
    for meta in supply_meta["series"]:
        w(f"Archivo `{meta['file']}`:\n")
        rows = []
        for sh in meta["sheets"]:
            detail = ""
            if "date_min" in sh:
                detail = f"{sh['date_min']} a {sh['date_max']} ({sh['n_periods']} periodos); columnas: {', '.join(sh['first_columns'][:7])} … {', '.join(sh['last_columns'])}"
            elif "week_labels_first_last" in sh:
                detail = (f"semanas «{sh['week_labels_first_last'][0].strip()}» a «{sh['week_labels_first_last'][1].strip()}» "
                          f"({sh['n_periods']} columnas); filas = ciudad × grupo de alimentos")
            rows.append((sh["sheet"], sh.get("header_row", "-"), sh["max_row"], sh["max_col"], sh["title"][:90], detail))
        w(md_table(["Hoja", "Fila encabezado", "Filas", "Columnas", "Título", "Detalle"], rows))
    w("\n- Reporta **toneladas** por mercado (mensual) y por ciudad y grupo de alimentos (semanal). **No** incluye origen.")
    w("- Varias celdas de totales son fórmulas de Excel; se leen solo los valores numéricos de las columnas por mercado.\n")

    w("### 4.2 Microdatos anuales\n")
    rows = []
    for meta in micro:
        rows.append((meta["file"], ", ".join(meta["data_sheets"]), ", ".join(meta["header_rows"][:1]),
                     " · ".join(c for c in meta["columns"][0] if c != "none") if meta["columns"] else "-",
                     f"{meta['date_min'][:10]} a {meta['date_max'][:10]}", f"{meta['rows']:,}".replace(",", "."),
                     len(meta["products"]), len(meta["markets"])))
    w(md_table(["Archivo", "Hojas de datos", "Encabezado", "Columnas", "Rango", "Filas", "Alimentos", "Mercados"], rows))
    w("\n- **Sí** reporta cantidad por mercado **y** por origen: código y nombre de departamento y municipio de procedencia (DIVIPOLA).")
    w("- Unidad: **kilogramos** (`Cant Kg`). Frecuencia: registros diarios (fecha de ingreso al mercado).")
    foreign = sum(m["foreign_origin_rows"] for m in micro)
    w(f"- Desde 2024 el municipio puede ser un país (código ISO 3166-1) para alimentos importados: {foreign:,} filas con código no numérico.".replace(",", "."))
    w(f"- Las hojas de datos se dividen por semestre (2013–2023) o cuatrimestre (2024–2026); los nombres de columnas cambian "
      f"(«Código Departamento» → «Divipola Depto Proc.», «Municipio Proc.» → «Municipio de Colombia / País Proc.») y en 2024 se agrega «Código CPC».")
    w(f"- Número de alimentos distintos por archivo: {', '.join(f'{k[-9:-5]}: {v}' for k, v in supply_products_by_file.items())}. "
      "El catálogo cambia entre años (en los primeros años hay categorías agregadas como «Hortalizas de hoja» o «Verduras y hortalizas otras»).")
    w("- Nombres de papa en abastecimiento por año:")
    for year, names in sorted(potato_names_by_year.items()):
        w(f"  - {year}: {', '.join(names)}")
    w(f"- Mercados en abastecimiento: {len(supply_markets)}. Sin equivalente exacto (por nombre normalizado) en precios: "
      f"{', '.join(supply_only) if supply_only else 'ninguno'}.")
    w(f"- Filas sin cantidad numérica: {sum(m['null_qty'] for m in micro)}; cantidades ≤ 0: {sum(m['non_positive_qty'] for m in micro)}.")
    text_dates = sum(m.get("text_date_rows", 0) for m in micro)
    if text_dates:
        w(f"- {text_dates:,} filas (archivo 2020) traen la fecha como texto `dd/mm/aa` en vez de fecha de Excel; se convirtieron.".replace(",", "."))
    dept_spellings = supply.groupby("dept_code")["dept"].nunique()
    multi = dept_spellings[dept_spellings > 1]
    if len(multi):
        examples = [" / ".join(sorted(supply.loc[supply["dept_code"] == code, "dept"].unique())) for code in multi.index[:4]]
        w(f"- {len(multi)} códigos de departamento aparecen con más de un nombre (p. ej. {'; '.join(examples)}): agrupar por código DIVIPOLA, no por nombre.")
    yearly = supply.groupby("year")["kg"].sum() / 1e6
    markets_per_year = supply.groupby("year")["market"].nunique()
    w("- Toneladas totales registradas por año (miles) y número de mercados: "
      + ", ".join(f"{y}: {v:,.0f} ({markets_per_year[y]})".replace(",", ".") for y, v in yearly.items())
      + ". Los saltos entre años coinciden con la entrada de mercados nuevos al sistema; comparar volúmenes entre años solo con el mismo conjunto de mercados.\n")

    # normalization
    w("## 5. Cambios de formato y normalización necesaria\n")
    w("- Unificar dos estructuras de anexos semanales (flat y nested) y dos extensiones (`.xls` antiguo y `.xlsx`).")
    w("- Fecha de la semana: tomarla de la etiqueta publicada por DANE, no del nombre del archivo.")
    w("- Encabezados en filas distintas según el año (ver tabla 2.1); encabezados combinados («Pesos por kilogramo» sobre mín./máx./medio).")
    w("- Nombres: normalizar tildes, mayúsculas y espacios; mapear manualmente las variantes que no se resuelven solas.")
    if market_variants:
        w(f"- Variantes de mercado unificadas automáticamente (mismo nombre salvo tildes/mayúsculas): {len(market_variants)}. Ejemplos: "
          + "; ".join(" = ".join(v) for v in market_variants[:6]))
    if product_variants:
        w(f"- Variantes de producto unificadas automáticamente: {len(product_variants)}. Ejemplos: "
          + "; ".join(" = ".join(v) for v in product_variants[:6]))
    market_near = near_duplicates(weekly["market"].unique(), 0.9)
    if market_near:
        w("- Mercados con nombres casi iguales que requieren revisión manual:")
        for a, b, r in market_near[:15]:
            w(f"  - «{a}» vs «{b}» (similitud {r})")
    product_near = near_duplicates(weekly["product"].unique(), 0.92)
    if product_near:
        w("- Productos con nombres casi iguales (revisar si son el mismo o variedades distintas):")
        for a, b, r in product_near[:20]:
            w(f"  - «{a}» vs «{b}» (similitud {r})")
    w("- Unidades: casi todo en $/kg, pero huevos y algunos procesados van por unidad o litro (ver notas). Excluirlos o tratarlos aparte.")
    w("- Abastecimiento: los nombres de alimentos y mercados no coinciden 1:1 con los de precios; se necesita una tabla de equivalencias "
      "(el código CPC, disponible desde 2024 en ambas fuentes, ayuda).\n")

    # shortlist
    w("## 6. Recomendación: productos y mercados\n")
    w(f"Criterio: cobertura semanal entre {full_start.date()} y {full_end.date()} ({len(all_weeks)} semanas). "
      "Se priorizan alimentos básicos (verduras, tubérculos, frutas, granos), se incluye la papa y Corabastos, el mejor mercado de Boyacá, "
      "y como máximo un producto por familia (p. ej. una sola papa, una sola cebolla). Primero se fija la variedad de papa, cebolla y tomate "
      "presente en más mercados y solo se aceptan mercados que reporten las tres en al menos 80 % de las semanas.\n")
    w(f"**Productos ({len(products)})**: {', '.join(products)}\n")
    w(f"**Mercados ({len(markets)})**: {', '.join(markets)}\n")
    w("Cobertura (% de semanas con dato) en todo el periodo / desde 2018:\n")
    rows = []
    for product in products:
        row = [product]
        for market in markets:
            full = cov_full.loc[product, market] if market in cov_full.columns else 0
            recent = cov_recent.loc[product, market] if product in cov_recent.index and market in cov_recent.columns else 0
            row.append(f"{full * 100:.0f} / {recent * 100:.0f}")
        rows.append(row)
    w(md_table(["Producto"] + markets, rows))
    w("\nDetalle por par (semanas con dato, primera y última semana, % de semanas faltantes dentro de su vida):\n")
    w(md_table(["Producto", "Mercado", "Semanas", "Desde", "Hasta", "Faltantes"], pair_stats))
    w("\n### 6.1 Variedades regionales\n")
    w("Papa, cebolla y tomate se reportan con variedades distintas según la región, así que no todos los mercados son comparables "
      "con el mismo producto. Variedad con más semanas de dato en cada mercado (semanas):\n")
    variety_rows = []
    weeks_by_pair = weekly.groupby(["product", "market"])["week"].nunique()
    all_products = weekly["product"].unique()
    for market in list(dict.fromkeys(markets + list(market_score.index[:10]))):
        row = [market]
        for family, exclude in STAPLE_FAMILIES:
            options = [(weeks_by_pair.get((v, market), 0), v) for v in family_varieties(all_products, family, exclude)]
            best = max(options) if options else (0, "-")
            row.append(f"{best[1]} ({best[0]})" if best[0] else "sin dato")
        variety_rows.append(row)
    w(md_table(["Mercado", "Papa", "Cebolla", "Tomate"], variety_rows))
    if excluded_markets:
        w("\nMercados del top 10 por cobertura que se excluyeron porque no reportan alguna de las variedades elegidas "
          f"({', '.join(products[:3])}) en al menos 80 % de las semanas: {', '.join(excluded_markets)}.")
    w("\nOtros mercados con buena cobertura (puntaje = cobertura media en los 30 productos básicos más completos):\n")
    w(md_table(["Mercado", "Puntaje"], [(m, pct(v)) for m, v in market_score.head(12).items()]))
    w("")

    # quality
    w("## 7. Calidad de datos y riesgos\n")
    w(f"- **Huecos**: {len(missing_weeks)} semanas sin archivo en el rango; además cada par tiene semanas sin dato (sección 2.3).")
    w(f"- **Duplicados**: {int(duplicated_rows.sum())} filas repiten semana–producto–mercado; {int((dup_conflicts > 1).sum())} combinaciones con precios distintos.")
    w(f"- **Rangos incoherentes** (mín > máx o medio fuera de [mín, máx]): {len(bad_range)} filas.")
    w(f"- **Precios no positivos o faltantes** en precio medio: {len(non_positive)} filas.")
    w(f"- **Saltos extremos** (el precio medio se duplica o cae a la mitad de una semana a la siguiente): {len(jumps)} casos "
      f"en {jumps.reset_index().groupby(['product', 'market']).ngroups if len(jumps) else 0} pares.")
    if len(jumps):
        top = jumps.abs().sort_values(ascending=False).head(8)
        w("  Ejemplos más extremos:")
        for (p, m, wk), v in top.items():
            factor = float(np.exp(jumps.loc[(p, m, wk)]))
            change = f"×{factor:,.1f}" if factor >= 1 else f"÷{1 / factor:,.1f}"
            w(f"  - {p} en {m}, semana al {wk.end_time.date()}: cambio {change}")
    w("- **Cambios de mercados**: algunos mercados entran o salen del sistema durante el periodo (tabla 2.2), lo que corta series.")
    w("- **Riesgos para el pronóstico**:")
    w("  - Series con huecos requieren imputación o modelos que toleren faltantes; las semanas con festivos tienen etiquetas de 4 a 9 días (sección 2), lo que distorsiona la comparación semana a semana.")
    w("  - Choques no estacionales (paro nacional 2021, pandemia 2020, fenómenos de El Niño/La Niña) generan picos que un modelo con solo rezagos no anticipa.")
    w("  - Precio en pesos corrientes: la inflación (≈ 2013–2026) introduce tendencia; conviene deflactar o modelar variaciones.")
    w("  - Volatilidad alta en hortalizas de ciclo corto (tomate, cebolla); horizontes de 3–4 semanas tendrán errores grandes.")
    w("  - Abastecimiento y precios no comparten catálogo; unirlos exige equivalencias manuales.")
    boyaca_pick = markets[-1]
    boyaca_weeks = weekly[weekly["market"] == boyaca_pick]["week"]
    w(f"  - Boyacá: {boyaca_pick} tiene datos del {boyaca_weeks.min().end_time.date()} al {boyaca_weeks.max().end_time.date()}; "
      "los demás mercados de Boyacá tienen series más cortas o con más huecos (tabla 2.2).")
    stale = [(p, m, hasta) for p, m, n, desde, hasta, _ in pair_stats
             if n and pd.Timestamp(hasta) < last_week.end_time - pd.Timedelta(weeks=8)]
    for p, m, hasta in stale:
        w(f"  - {p} en {m} dejó de reportarse: último dato la semana al {hasta}.")
    big = jumps[jumps.abs() > np.log(20)]
    if len(big):
        w(f"  - {len(big)} saltos son de más de ×20 (sobre todo productos de molino como arroz granza o harina de arroz): "
          "casi seguro un cambio de unidad o un error de digitación, no un movimiento real de precio. Hay que filtrarlos antes de entrenar.")
    w("")

    w("## 8. Figuras\n")
    for name, caption in figures:
        w(f"![{caption}](figures/{name})\n\n_{caption}._\n")

    w("## 9. Lo que no se pudo determinar\n")
    w("- Metodología exacta de cálculo del precio medio semanal (si es promedio simple de días o ponderado): **desconocido** a partir de los archivos.")
    w("- Si las semanas faltantes son semanas no publicadas o enlaces ausentes en la web: **desconocido**.")
    w("- Calidad del producto (primera, extra) cuando el nombre no lo indica: **desconocido**.")

    (DOCS_DIR / "data_exploration.md").write_text("\n".join(out) + "\n", encoding="utf-8")

    summary = {
        "weekly_files": len(weekly_meta), "weekly_unparsed": len(unparsed), "weekly_range": [str(first_week.end_time.date()), str(last_week.end_time.date())],
        "products": products, "markets": markets, "boyaca_markets": boyaca_markets,
        "missing_weeks": len(missing_weeks), "jumps": int(len(jumps)), "duplicates": int(duplicated_rows.sum()),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
