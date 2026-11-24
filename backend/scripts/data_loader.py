r"""
data_loader.py
==============
load_data()  : CSV padho -> column_map lagao -> clean_data() -> validate -> save
Official dataset aaye to is file ko NAHI badalna, sirf config/*.yaml badalni hai.

Run test:  python backend\scripts\data_loader.py
"""
import argparse
import json
from pathlib import Path

import pandas as pd
import yaml

ROOT = Path(__file__).resolve().parents[2]      # D:\AtmoGraph
CONFIG_DIR = ROOT / "config"


def read_yaml(name):
    with open(CONFIG_DIR / name, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def _drop(df, mask, label, rep):
    """mask True wali rows hata do aur report mein count likho."""
    n = int(mask.sum())
    if n:
        rep.setdefault("dropped_rows", {})[label] = n
    return df[~mask]


def clean_table(df, spec, table):
    """Ek table (nodes ya edges) ko schema ke rules se saaf karta hai."""
    df = df.copy()
    rep = {"rows_in": int(len(df))}

    # 1) Columns check: required na mile to ruk jao, optional ho to khaali bana do
    for col, rule in spec.items():
        if col not in df.columns:
            if rule.get("required"):
                raise ValueError(
                    f"[{table}] required column '{col}' nahi mila. "
                    f"column_map.yaml mein mapping likho."
                )
            df[col] = pd.NA
            rep.setdefault("columns_created_empty", []).append(col)

    # 2) Types: float columns numeric banao, baaki strings (spaces hatao, "" ko null maano)
    for col, rule in spec.items():
        if rule["dtype"] == "float":
            df[col] = pd.to_numeric(df[col], errors="coerce")
        else:
            df[col] = df[col].astype("string").str.strip().replace("", pd.NA)

    # 3) Cleaning se pehle kitne nulls the (report ke liye)
    rep["nulls_before"] = {c: int(df[c].isna().sum()) for c in spec if df[c].isna().any()}

    # 4) Required null wali rows aur allowed se bahar ki values drop
    for col, rule in spec.items():
        if rule.get("required"):
            df = _drop(df, df[col].isna(), f"{col}_is_null", rep)
        if "allowed" in rule:
            df = _drop(df, ~df[col].isin(rule["allowed"]), f"{col}_not_allowed", rep)
    df = df.copy()

    # 5) Nulls bharo (median / fixed value), flag banao, range clip karo
    for col, rule in spec.items():
        if "fill" not in rule:
            continue
        miss = df[col].isna()
        if rule.get("add_missing_flag"):
            df[col + "_was_missing"] = miss          # bataata hai kaun-si value bharwai gayi
        if miss.any():
            fill = df[col].median() if rule["fill"] == "median" else rule["fill"]
            if pd.isna(fill):                        # poora column hi khaali tha
                fill = 0.0
            df[col] = df[col].fillna(fill)
            rep.setdefault("filled", {})[col] = {"count": int(miss.sum()), "value": str(fill)}
        if "min" in rule or "max" in rule:
            df[col] = df[col].clip(lower=rule.get("min"), upper=rule.get("max"))

    # 6) String columns ko normal Python str bana do (Neo4j driver ke liye safe)
    for col, rule in spec.items():
        if rule["dtype"] == "str":
            df[col] = df[col].astype(str)

    return df, rep


def load_data(in_dir=None, out_dir=None, save=True):
    """Return: (nodes_df, edges_df, report). Poora project isi function se data lega."""
    in_dir = Path(in_dir) if in_dir else ROOT / "data" / "raw"
    out_dir = Path(out_dir) if out_dir else ROOT / "data" / "processed"

    schema = read_yaml("schema.yaml")
    colmap = read_yaml("column_map.yaml")

    # dtype=str: sab kuch text padho, type conversion schema khud karega
    nodes = pd.read_csv(in_dir / "nodes.csv", dtype=str)
    edges = pd.read_csv(in_dir / "edges.csv", dtype=str)

    # Official column naam -> hamare naam
    nodes = nodes.rename(columns=colmap.get("nodes") or {})
    edges = edges.rename(columns=colmap.get("edges") or {})

    report = {}
    nodes, report["nodes"] = clean_table(nodes, schema["nodes"], "nodes")
    edges, report["edges"] = clean_table(edges, schema["edges"], "edges")

    # Duplicate node_id hatao
    nodes = _drop(nodes, nodes.duplicated(subset="node_id"), "duplicate_node_id", report["nodes"])

    # Edges validation: nodes mein na milne wale ids, self-loops, duplicate pairs
    ids = set(nodes["node_id"])
    ghost = ~(edges["source"].isin(ids) & edges["target"].isin(ids))
    edges = _drop(edges, ghost, "ghost_node_reference", report["edges"])
    edges = _drop(edges, edges["source"] == edges["target"], "self_loop", report["edges"])
    edges = _drop(edges, edges.duplicated(subset=["source", "target"]), "duplicate_pair", report["edges"])

    report["nodes"]["rows_out"] = int(len(nodes))
    report["edges"]["rows_out"] = int(len(edges))

    if save:
        out_dir.mkdir(parents=True, exist_ok=True)
        nodes.to_csv(out_dir / "nodes_clean.csv", index=False)
        edges.to_csv(out_dir / "edges_clean.csv", index=False)
        with open(out_dir / "cleaning_report.json", "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)

    return nodes, edges, report


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--in-dir", default=None, help="default: data/raw")
    ap.add_argument("--out-dir", default=None, help="default: data/processed")
    a = ap.parse_args()

    n, e, rep = load_data(a.in_dir, a.out_dir)
    print("Cleaning report:")
    print(json.dumps(rep, indent=2))
    print(f"\nFinal: {len(n)} nodes, {len(e)} edges")