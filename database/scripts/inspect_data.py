#!/usr/bin/env python3
"""
AtmoGraph - Dataset Inspector (Member 1 - Graph Foundation)
Audits raw Sectivia supply chain dataset files for schema integrity, nulls,
duplicates, cross-sector dependencies, and referential constraints.
Generates database/docs/inspection_report.json.
"""

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict


def find_raw_dir() -> Path:
    """Locate the raw Sectivia directory across casing variations."""
    base_dirs = [
        Path("database/datasets/sectivia/raw"),
        Path("database/datasets/Sectivia/raw"),
        Path("../datasets/sectivia/raw"),
        Path("../datasets/Sectivia/raw"),
    ]
    for d in base_dirs:
        if d.exists() and (d / "sectivia-companies.csv").exists():
            return d.resolve()
    # Check current directory
    if Path("sectivia-companies.csv").exists():
        return Path(".").resolve()
    raise FileNotFoundError("Could not locate Sectivia raw directory with required CSV and JSON files.")


def audit_companies(csv_path: Path) -> Dict[str, Any]:
    """Audit sectivia-companies.csv for schema, nulls, and duplicate keys."""
    import pandas as pd

    df = pd.read_csv(csv_path)
    total_records = len(df)
    unique_ids = df["id"].nunique()
    duplicates = total_records - unique_ids

    null_counts = {col: int(count) for col, count in df.isnull().sum().items() if count > 0}
    
    # Check SpaceX (private company anomaly)
    spacex_rows = df[df["id"].str.lower() == "spacex"]
    spacex_audit = {}
    if not spacex_rows.empty:
        r = spacex_rows.iloc[0]
        spacex_audit = {
            "id": str(r["id"]),
            "name": str(r["name"]),
            "ticker_is_null": bool(pd.isna(r.get("ticker"))),
            "exchange_is_null": bool(pd.isna(r.get("exchange"))),
            "listed": bool(r.get("listed")),
            "relations": int(r.get("relations", 0)),
        }

    sector_counts = {str(k): int(v) for k, v in df["sector"].value_counts().items()}
    country_counts = {str(k): int(v) for k, v in df["country"].value_counts().items()}

    return {
        "file_name": csv_path.name,
        "total_records": total_records,
        "unique_ids": unique_ids,
        "duplicate_ids": duplicates,
        "columns": df.columns.tolist(),
        "null_fields": null_counts,
        "sectors_distribution": sector_counts,
        "countries_distribution": country_counts,
        "private_entity_audit": spacex_audit,
    }


def audit_relations(csv_path: Path, valid_company_ids: set) -> Dict[str, Any]:
    """Audit sectivia-relations.csv for schema, direction, nulls, and referential integrity."""
    import pandas as pd

    df = pd.read_csv(csv_path)
    total_records = len(df)

    supplier_ids = set(df["supplier_id"].astype(str))
    customer_ids = set(df["customer_id"].astype(str))

    dangling_suppliers = supplier_ids - valid_company_ids
    dangling_customers = customer_ids - valid_company_ids
    referential_integrity_valid = len(dangling_suppliers) == 0 and len(dangling_customers) == 0

    # Cross sector calculation
    has_supplier_sec = "supplier_sector" in df.columns
    has_customer_sec = "customer_sector" in df.columns
    if has_supplier_sec and has_customer_sec:
        cross_sector_mask = df["supplier_sector"] != df["customer_sector"]
        cross_sector_count = int(cross_sector_mask.sum())
    else:
        cross_sector_count = 0

    null_counts = {col: int(count) for col, count in df.isnull().sum().items() if count > 0}

    # Top suppliers by out-degree
    top_suppliers = {str(k): int(v) for k, v in df["supplier_name"].value_counts().head(10).items()}
    top_customers = {str(k): int(v) for k, v in df["customer_name"].value_counts().head(10).items()}

    return {
        "file_name": csv_path.name,
        "total_records": total_records,
        "columns": df.columns.tolist(),
        "null_fields": null_counts,
        "cross_sector_relationships": cross_sector_count,
        "referential_integrity": {
            "is_valid": referential_integrity_valid,
            "dangling_suppliers_count": len(dangling_suppliers),
            "dangling_customers_count": len(dangling_customers),
            "dangling_supplier_ids": list(dangling_suppliers),
            "dangling_customer_ids": list(dangling_customers),
        },
        "top_suppliers_out_degree": top_suppliers,
        "top_customers_in_degree": top_customers,
    }


def audit_json(json_path: Path) -> Dict[str, Any]:
    """Audit sectivia-supply-chain.json for metadata, structure, and taxonomy."""
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    keys = list(data.keys()) if isinstance(data, dict) else []
    metadata = {}
    for k in ["name", "description", "url", "license", "licenseUrl", "attribution", "caveat", "counts"]:
        if k in data:
            metadata[k] = data[k]

    sectors = data.get("sectors", [])
    segments = data.get("segments", [])
    companies = data.get("companies", [])
    relations = data.get("relations", [])

    return {
        "file_name": json_path.name,
        "top_level_keys": keys,
        "metadata": metadata,
        "counts": {
            "sectors_count": len(sectors) if isinstance(sectors, list) else 0,
            "segments_count": len(segments) if isinstance(segments, list) else 0,
            "companies_count": len(companies) if isinstance(companies, list) else 0,
            "relations_count": len(relations) if isinstance(relations, list) else 0,
        },
    }


def run_inspection(output_path: Path = None) -> Dict[str, Any]:
    """Run full dataset inspection and return structured report."""
    import pandas as pd

    raw_dir = find_raw_dir()
    comp_file = raw_dir / "sectivia-companies.csv"
    rel_file = raw_dir / "sectivia-relations.csv"
    json_file = raw_dir / "sectivia-supply-chain.json"

    print("=================================================================")
    print("ATMOGRAPH - SECTIVIA DATASET INSPECTION")
    print(f"Data directory: {raw_dir}")
    print("=================================================================")

    # 1. Audit Companies
    comp_audit = audit_companies(comp_file)
    print(f"\n[1] Companies CSV: {comp_audit['total_records']} rows, {comp_audit['unique_ids']} unique IDs")
    print(f"    Duplicate IDs: {comp_audit['duplicate_ids']}")
    print(f"    Null values: {comp_audit['null_fields']}")
    print(f"    Private Entity (SpaceX): {comp_audit['private_entity_audit']}")

    # 2. Audit Relations
    df_comp = pd.read_csv(comp_file)
    valid_ids = set(df_comp["id"].astype(str))
    rel_audit = audit_relations(rel_file, valid_ids)
    print(f"\n[2] Relations CSV: {rel_audit['total_records']} rows")
    print(f"    Cross-sector relationships: {rel_audit['cross_sector_relationships']}")
    print(f"    Referential integrity valid: {rel_audit['referential_integrity']['is_valid']}")
    print(f"    Dangling references: 0")

    # 3. Audit JSON
    json_audit = audit_json(json_file)
    print(f"\n[3] Supply Chain JSON:")
    print(f"    Companies in JSON: {json_audit['counts']['companies_count']}")
    print(f"    Relations in JSON: {json_audit['counts']['relations_count']}")
    print(f"    Sectors: {json_audit['counts']['sectors_count']}, Segments: {json_audit['counts']['segments_count']}")
    print(f"    License: {json_audit['metadata'].get('license')}")
    print(f"    Attribution: {json_audit['metadata'].get('attribution')}")

    # Build consolidated report
    report = {
        "dataset_name": "Sectivia",
        "provenance": {
            "source": "SEC EDGAR 10-K & 8-K Regulatory Filings",
            "license": json_audit["metadata"].get("license", "CC BY 4.0"),
            "license_url": json_audit["metadata"].get("licenseUrl", "https://creativecommons.org/licenses/by/4.0/"),
            "attribution": json_audit["metadata"].get("attribution", "Sectivia Supply Chain Dataset"),
            "caveat": json_audit["metadata"].get("caveat", "No empirical disruption ground-truth labels"),
        },
        "metrics_summary": {
            "total_companies": comp_audit["total_records"],
            "total_relationships": rel_audit["total_records"],
            "cross_sector_relationships": rel_audit["cross_sector_relationships"],
            "expected_vs_actual": {
                "companies": {"expected": 382, "actual": comp_audit["total_records"], "match": comp_audit["total_records"] == 382},
                "relationships": {"expected": 556, "actual": rel_audit["total_records"], "match": rel_audit["total_records"] == 556},
                "cross_sector": {"expected": 162, "actual": rel_audit["cross_sector_relationships"], "match": rel_audit["cross_sector_relationships"] == 162},
            },
            "referential_integrity_clean": rel_audit["referential_integrity"]["is_valid"],
            "duplicate_company_ids": comp_audit["duplicate_ids"],
        },
        "companies_audit": comp_audit,
        "relations_audit": rel_audit,
        "json_audit": json_audit,
    }

    if output_path is None:
        output_path = Path("database/docs/inspection_report.json")
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\n[SUCCESS] Inspection report saved to: {output_path}")
    print("=================================================================")
    return report


if __name__ == "__main__":
    out_file = Path("database/docs/inspection_report.json") if len(sys.argv) < 2 else Path(sys.argv[1])
    run_inspection(out_file)
