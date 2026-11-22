#!/usr/bin/env python3
"""
AtmoGraph - Data Preprocessor (Member 1 - Graph Foundation)
Cleans, normalizes, and validates Sectivia raw data.
Produces canonical data representations in database/datasets/sectivia/processed/.
"""

import json
from pathlib import Path
from typing import Dict, Any
import pandas as pd


def get_paths():
    base_raw = Path("database/datasets/sectivia/raw")
    if not base_raw.exists():
        base_raw = Path("database/datasets/Sectivia/raw")
    
    out_dir = Path("database/datasets/sectivia/processed")
    out_dir.mkdir(parents=True, exist_ok=True)
    return base_raw, out_dir


def preprocess_sectivia() -> Dict[str, Any]:
    raw_dir, out_dir = get_paths()
    comp_file = raw_dir / "sectivia-companies.csv"
    rel_file = raw_dir / "sectivia-relations.csv"
    json_file = raw_dir / "sectivia-supply-chain.json"

    print(f"[INFO] Reading raw datasets from: {raw_dir}")
    df_comp = pd.read_csv(comp_file)
    df_rel = pd.read_csv(rel_file)

    # 1. Clean Companies
    # Standardize canonical ID: 'sectivia:<id>'
    df_comp["raw_id"] = df_comp["id"].astype(str)
    df_comp["canonical_id"] = "sectivia:" + df_comp["raw_id"]
    df_comp["dataset_source"] = "sectivia"
    
    # Handle nullable fields cleanly
    df_comp["ticker"] = df_comp["ticker"].fillna("").astype(str)
    df_comp["exchange"] = df_comp["exchange"].fillna("").astype(str)
    df_comp["listed"] = df_comp["listed"].astype(bool)
    df_comp["relations_count"] = df_comp["relations"].astype(int)

    # 2. Clean Relationships
    df_rel["raw_supplier_id"] = df_rel["supplier_id"].astype(str)
    df_rel["raw_customer_id"] = df_rel["customer_id"].astype(str)
    df_rel["canonical_supplier_id"] = "sectivia:" + df_rel["raw_supplier_id"]
    df_rel["canonical_customer_id"] = "sectivia:" + df_rel["raw_customer_id"]
    df_rel["dataset_source"] = "sectivia"

    # Cross-sector boolean flag
    df_rel["is_cross_sector"] = df_rel["supplier_sector"] != df_rel["customer_sector"]
    df_rel["sector"] = df_rel["sector"].fillna("")
    df_rel["supplier_ticker"] = df_rel["supplier_ticker"].fillna("")
    df_rel["customer_ticker"] = df_rel["customer_ticker"].fillna("")
    df_rel["what"] = df_rel["what"].fillna("")
    df_rel["source"] = df_rel["source"].fillna("SEC EDGAR")
    df_rel["source_url"] = df_rel["url"].fillna("")

    # Verify referential consistency
    valid_ids = set(df_comp["raw_id"])
    supp_valid = df_rel["raw_supplier_id"].isin(valid_ids).all()
    cust_valid = df_rel["raw_customer_id"].isin(valid_ids).all()
    assert supp_valid, "Preprocess Error: Invalid supplier_id references found!"
    assert cust_valid, "Preprocess Error: Invalid customer_id references found!"

    # Export processed CSVs
    comp_out = out_dir / "companies_processed.csv"
    rel_out = out_dir / "relations_processed.csv"
    summary_out = out_dir / "graph_summary.json"

    df_comp.to_csv(comp_out, index=False)
    df_rel.to_csv(rel_out, index=False)

    summary = {
        "total_companies": len(df_comp),
        "total_relationships": len(df_rel),
        "cross_sector_relationships": int(df_rel["is_cross_sector"].sum()),
        "sectors": sorted(df_comp["sector"].unique().tolist()),
        "countries": sorted(df_comp["country"].unique().tolist()),
        "referential_integrity_verified": True,
    }

    with open(summary_out, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print(f"[SUCCESS] Processed companies: {len(df_comp)} -> {comp_out}")
    print(f"[SUCCESS] Processed relationships: {len(df_rel)} -> {rel_out}")
    print(f"[SUCCESS] Summary exported -> {summary_out}")
    return summary


if __name__ == "__main__":
    preprocess_sectivia()
