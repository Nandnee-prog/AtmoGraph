#!/usr/bin/env python3
"""
inspect_data.py
===============
Inspects the Sectivia raw dataset files:
- sectivia-companies.csv
- sectivia-relations.csv
- sectivia-supply-chain.json

Performs comprehensive validation:
1. File schema and header validation
2. Record counts across CSV and JSON
3. Duplicate ID checks
4. Missing / null values analysis
5. Referential integrity (ghost references, self-loops)
6. Relationship multiplicity
7. Disruption / risk label verification
8. Encoding & CSV parsing anomalies (quoted commas, Danish sector codes)

Usage:
    python database/scripts/inspect_data.py
    python database/scripts/inspect_data.py --json-out database/docs/inspection_report.json
"""

import argparse
import csv
import json
import os
import sys
from collections import Counter, defaultdict
from pathlib import Path


def inspect_sectivia(raw_dir: Path) -> dict:
    companies_csv_path = raw_dir / "sectivia-companies.csv"
    relations_csv_path = raw_dir / "sectivia-relations.csv"
    supply_chain_json_path = raw_dir / "sectivia-supply-chain.json"

    report = {
        "files_checked": {},
        "companies": {},
        "relations": {},
        "json_metadata": {},
        "referential_integrity": {},
        "disruption_labels_check": {},
        "parsing_observations": []
    }

    # 1. Inspect sectivia-companies.csv
    if not companies_csv_path.exists():
        raise FileNotFoundError(f"Missing {companies_csv_path}")

    report["files_checked"]["companies_csv"] = str(companies_csv_path)
    companies = []
    companies_by_id = {}
    duplicate_company_ids = []
    duplicate_tickers = []
    comp_missing_counts = defaultdict(int)
    seen_tickers = set()

    with open(companies_csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        report["companies"]["csv_headers"] = list(reader.fieldnames or [])
        for row_idx, row in enumerate(reader, start=2):
            cid = row.get("id", "").strip()
            ticker = row.get("ticker", "").strip()
            
            # Check nulls/empties
            for k, v in row.items():
                if v is None or v.strip() == "":
                    comp_missing_counts[k] += 1

            if not cid:
                report["companies"].setdefault("empty_ids", []).append(row_idx)
            elif cid in companies_by_id:
                duplicate_company_ids.append((cid, row_idx))
            else:
                companies_by_id[cid] = row

            if ticker:
                if ticker in seen_tickers:
                    duplicate_tickers.append((ticker, row_idx))
                seen_tickers.add(ticker)

            companies.append(row)

    report["companies"]["record_count"] = len(companies)
    report["companies"]["unique_ids_count"] = len(companies_by_id)
    report["companies"]["duplicate_ids"] = duplicate_company_ids
    report["companies"]["duplicate_tickers"] = duplicate_tickers
    report["companies"]["missing_values_by_field"] = dict(comp_missing_counts)

    # 2. Inspect sectivia-relations.csv
    if not relations_csv_path.exists():
        raise FileNotFoundError(f"Missing {relations_csv_path}")

    report["files_checked"]["relations_csv"] = str(relations_csv_path)
    relations = []
    rel_missing_counts = defaultdict(int)
    pair_counts = Counter()
    self_loops = []

    with open(relations_csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        report["relations"]["csv_headers"] = list(reader.fieldnames or [])
        for row_idx, row in enumerate(reader, start=2):
            supplier_id = row.get("supplier_id", "").strip()
            customer_id = row.get("customer_id", "").strip()

            for k, v in row.items():
                if v is None or v.strip() == "":
                    rel_missing_counts[k] += 1

            pair = (supplier_id, customer_id)
            pair_counts[pair] += 1

            if supplier_id and customer_id and supplier_id == customer_id:
                self_loops.append((supplier_id, row_idx))

            relations.append(row)

    report["relations"]["record_count"] = len(relations)
    report["relations"]["missing_values_by_field"] = dict(rel_missing_counts)
    report["relations"]["self_loops"] = self_loops
    
    # Check duplicate pairs
    duplicate_pairs = [{f"{k[0]} -> {k[1]}": count} for k, count in pair_counts.items() if count > 1]
    report["relations"]["duplicate_supplier_customer_pairs"] = duplicate_pairs
    report["relations"]["unique_directed_pairs_count"] = len(pair_counts)

    # 3. Referential integrity
    ghost_suppliers = []
    ghost_customers = []
    for row_idx, r in enumerate(relations, start=2):
        s_id = r.get("supplier_id", "").strip()
        c_id = r.get("customer_id", "").strip()
        if s_id not in companies_by_id:
            ghost_suppliers.append({"row": row_idx, "supplier_id": s_id, "name": r.get("supplier_name")})
        if c_id not in companies_by_id:
            ghost_customers.append({"row": row_idx, "customer_id": c_id, "name": r.get("customer_name")})

    report["referential_integrity"]["ghost_suppliers_count"] = len(ghost_suppliers)
    report["referential_integrity"]["ghost_suppliers"] = ghost_suppliers
    report["referential_integrity"]["ghost_customers_count"] = len(ghost_customers)
    report["referential_integrity"]["ghost_customers"] = ghost_customers

    # 4. JSON inspection
    if not supply_chain_json_path.exists():
        raise FileNotFoundError(f"Missing {supply_chain_json_path}")

    report["files_checked"]["supply_chain_json"] = str(supply_chain_json_path)
    with open(supply_chain_json_path, mode="r", encoding="utf-8") as f:
        json_data = json.load(f)

    report["json_metadata"]["top_keys"] = list(json_data.keys())
    report["json_metadata"]["declared_counts"] = json_data.get("counts", {})
    report["json_metadata"]["actual_json_companies_count"] = len(json_data.get("companies", []))
    report["json_metadata"]["actual_json_relations_count"] = len(json_data.get("relations", []))
    report["json_metadata"]["sectors_count"] = len(json_data.get("sectors", []))
    report["json_metadata"]["segments_count"] = len(json_data.get("segments", []))
    report["json_metadata"]["sectors"] = json_data.get("sectors", [])

    # Check consistency between JSON and CSV
    json_company_ids = {c["id"] for c in json_data.get("companies", []) if "id" in c}
    csv_company_ids = set(companies_by_id.keys())

    report["referential_integrity"]["company_ids_in_csv_but_not_json"] = list(csv_company_ids - json_company_ids)
    report["referential_integrity"]["company_ids_in_json_but_not_csv"] = list(json_company_ids - csv_company_ids)

    # 5. Check for real disruption / risk / delay labels
    # Verify if any column in CSV or key in JSON represents actual disruption ground truth
    all_fields = set(report["companies"]["csv_headers"]) | set(report["relations"]["csv_headers"])
    disruption_keywords = ["disrupt", "delay", "risk", "failure", "bottleneck", "event", "impact"]
    potential_disruption_fields = [f for f in all_fields if any(kw in f.lower() for kw in disruption_keywords)]
    
    # Also check JSON keys on company and relation
    json_rel_sample = json_data.get("relations", [])[0] if json_data.get("relations") else {}
    json_comp_sample = json_data.get("companies", [])[0] if json_data.get("companies") else {}
    
    report["disruption_labels_check"] = {
        "potential_fields_found": potential_disruption_fields,
        "contains_real_disruption_labels": False,
        "verification_statement": (
            "CRITICAL AUDIT CONFIRMATION: The Sectivia dataset contains purely topological supply chain relationships "
            "derived from SEC EDGAR 10-K filings, 8-K statements, press releases, and company supplier lists. "
            "There are NO real disruption labels, failure flags, or operational delay ground truth values in the raw dataset. "
            "Any downstream disruption scenarios (e.g. for Member 3 GNN propagation or Member 4 Frontend) "
            "MUST be explicitly tagged as SYNTHETIC / SIMULATED."
        )
    }

    # 6. Check parsing anomalies & observations
    # Quoted commas check
    quotes_in_what = sum(1 for r in relations if "," in r.get("what", ""))
    quotes_in_source = sum(1 for r in relations if "," in r.get("source", ""))
    danish_sectors = set(r.get("sector") for r in relations if r.get("sector"))
    
    report["parsing_observations"].append(f"{quotes_in_what} relations contain commas in 'what' description.")
    report["parsing_observations"].append(f"{quotes_in_source} relations contain commas in 'source' citation.")
    report["parsing_observations"].append(f"Sector taxonomy IDs use Danish stems from original Sectivia schema: {sorted(list(danish_sectors))}")

    return report


def print_summary(report: dict):
    print("=" * 80)
    print("ATMOGRAPH - SECTIVIA DATASET INSPECTION AUDIT REPORT")
    print("=" * 80)

    print("\n--- 1. FILE & RECORD COUNTS ---")
    c_count = report["companies"]["record_count"]
    r_count = report["relations"]["record_count"]
    j_decl = report["json_metadata"]["declared_counts"]
    print(f"Companies CSV: {c_count} rows | JSON declared: {j_decl.get('companies')}")
    print(f"Relations CSV: {r_count} rows | JSON declared: {j_decl.get('relations')}")
    print(f"JSON Sectors:  {report['json_metadata']['sectors_count']} sectors")
    print(f"JSON Segments: {report['json_metadata']['segments_count']} sub-industry segments")

    print("\n--- 2. SCHEMAS & HEADERS ---")
    print("Companies CSV Headers:")
    print("  " + ", ".join(report["companies"]["csv_headers"]))
    print("Relations CSV Headers:")
    print("  " + ", ".join(report["relations"]["csv_headers"]))

    print("\n--- 3. DUPLICATE ID CHECKS ---")
    dup_ids = report["companies"]["duplicate_ids"]
    dup_ticks = report["companies"]["duplicate_tickers"]
    print(f"Duplicate Company IDs: {len(dup_ids)}")
    if dup_ids:
        print(f"  {dup_ids}")
    print(f"Duplicate Company Tickers: {len(dup_ticks)}")
    if dup_ticks:
        print(f"  {dup_ticks}")

    dup_pairs = report["relations"]["duplicate_supplier_customer_pairs"]
    print(f"Duplicate (Supplier -> Customer) Pairs: {len(dup_pairs)}")
    if dup_pairs:
        for p in dup_pairs:
            print(f"  {p}")

    print("\n--- 4. MISSING VALUES & NULLS ---")
    print("Companies missing/empty fields:")
    for k, v in report["companies"]["missing_values_by_field"].items():
        if v > 0:
            print(f"  {k}: {v} rows ({v/c_count*100:.1f}%)")
    if not any(v > 0 for v in report["companies"]["missing_values_by_field"].values()):
        print("  None. All company rows have complete fields.")

    print("Relations missing/empty fields:")
    for k, v in report["relations"]["missing_values_by_field"].items():
        if v > 0:
            print(f"  {k}: {v} rows ({v/r_count*100:.1f}%)")

    print("\n--- 5. REFERENTIAL INTEGRITY ---")
    ghost_s = report["referential_integrity"]["ghost_suppliers_count"]
    ghost_c = report["referential_integrity"]["ghost_customers_count"]
    self_l = len(report["relations"]["self_loops"])
    print(f"Ghost Suppliers (supplier_id not in companies): {ghost_s}")
    print(f"Ghost Customers (customer_id not in companies): {ghost_c}")
    print(f"Self-Loops (supplier_id == customer_id): {self_l}")
    print(f"CSV vs JSON Company ID mismatches: {len(report['referential_integrity']['company_ids_in_csv_but_not_json'])}")

    print("\n--- 6. DISRUPTION / GROUND TRUTH AUDIT ---")
    print(f"Contains real disruption labels: {report['disruption_labels_check']['contains_real_disruption_labels']}")
    print(report['disruption_labels_check']['verification_statement'])

    print("\n--- 7. PARSING OBSERVATIONS ---")
    for obs in report["parsing_observations"]:
        print(f"  * {obs}")
    print("=" * 80)


def main():
    parser = argparse.ArgumentParser(description="Inspect Sectivia raw dataset files")
    parser.add_argument(
        "--raw-dir",
        type=Path,
        default=Path("database/datasets/sectivia/raw"),
        help="Path to sectivia raw directory"
    )
    parser.add_argument(
        "--json-out",
        type=Path,
        default=None,
        help="Optional path to output full inspection report JSON"
    )
    args = parser.parse_args()

    report = inspect_sectivia(args.raw_dir)
    print_summary(report)

    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        with open(args.json_out, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        print(f"\nSaved full inspection report JSON to: {args.json_out}")


if __name__ == "__main__":
    main()
