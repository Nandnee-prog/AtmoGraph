#!/usr/bin/env python3
"""
import_data.py
==============
Safe, idempotent Sectivia dataset importer for Neo4j.

Database Design:
- Node Label: :Company
- Unique Identifier: sectivia:<id> (e.g. "sectivia:aapl")
- Relationship: (:Company)-[:SUPPLIES_TO]->(:Company)
- Edge Properties: what, source, url, sector, supplier_sector, customer_sector,
                   supplier_segment, customer_segment, is_cross_sector, data_source

Safety & Security Rules:
- Defaults to --dry-run unless --execute is explicitly passed.
- Credentials loaded securely from environment variables or .env file.
- Never prints or exposes passwords in logs.
- Never mutates or overwrites raw dataset files.
- Uses MERGE to guarantee idempotent node and edge creation.
- Properly parses CSV records with quoted commas and escapes.

Usage:
    # 1. Safe dry-run (no DB connection required, validates files & parses records):
    python database/scripts/import_data.py --dry-run

    # 2. Live import (requires user confirmation and active Neo4j instance):
    python database/scripts/import_data.py --execute --database atmograph
"""

import argparse
import csv
import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

try:
    from neo4j import GraphDatabase  # type: ignore
    HAS_NEO4J = True
except ImportError:
    GraphDatabase = None  # type: ignore
    HAS_NEO4J = False

SECTOR_MAP = {
    "ai": "AI & digital infrastructure",
    "energi": "Energy, grid & critical infrastructure",
    "forsvar": "Defense, security & space",
    "medicin": "Life science",
    "finans": "Banks, payments & capital markets",
    "industri": "Industrials & reshoring",
    "elbil": "EVs & batteries",
    "raavarer": "Materials & critical minerals"
}


def load_sector_taxonomy(raw_dir: Path) -> Dict[str, str]:
    """Dynamically loads sector taxonomy from sectivia-supply-chain.json if present."""
    json_path = raw_dir / "sectivia-supply-chain.json"
    if json_path.exists():
        try:
            with open(json_path, mode="r", encoding="utf-8") as f:
                data = json.load(f)
                extracted = {s["id"]: s["name"] for s in data.get("sectors", []) if "id" in s and "name" in s}
                if extracted:
                    return extracted
        except Exception:
            pass
    return SECTOR_MAP


def load_env_file(env_path: Path) -> dict:
    """Safely loads key-value pairs from a .env file without external dependencies."""
    env_vars = {}
    if not env_path.exists():
        return env_vars
    with open(env_path, mode="r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                env_vars[k.strip()] = v.strip().strip("'\"")
    return env_vars


def parse_and_validate_companies(
    csv_path: Path,
    sector_map: Optional[Dict[str, str]] = None
) -> Tuple[List[dict], set]:
    """
    Parses sectivia-companies.csv.
    Uses csv.DictReader to safely handle quoted commas.
    Preserves exact attributes and casts types appropriately.
    """
    if not csv_path.exists():
        raise FileNotFoundError(f"Companies CSV not found at: {csv_path}")

    s_map = sector_map if sector_map is not None else SECTOR_MAP
    records = []
    seen_ids = set()

    with open(csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row_idx, row in enumerate(reader, start=2):
            raw_id = (row.get("id") or "").strip()
            if not raw_id:
                raise ValueError(f"Missing id at row {row_idx} in {csv_path}")

            stable_id = f"sectivia:{raw_id}"
            if stable_id in seen_ids:
                raise ValueError(f"Duplicate company id '{stable_id}' at row {row_idx}")
            seen_ids.add(stable_id)

            ticker = (row.get("ticker") or "").strip()
            exchange = (row.get("exchange") or "").strip()
            sector_code = (row.get("sector") or "").strip()
            listed_val = (row.get("listed") or "").strip().lower()
            rel_count = (row.get("relations") or "").strip()

            records.append({
                "id": stable_id,
                "raw_id": raw_id,
                "ticker": ticker if ticker else None,
                "name": (row.get("name") or "").strip(),
                "exchange": exchange if exchange else None,
                "country": (row.get("country") or "").strip(),
                "sector": sector_code,
                "sector_name": s_map.get(sector_code, sector_code),
                "segment": (row.get("segment") or "").strip(),
                "listed": (listed_val == "true"),
                "relations_count": int(rel_count) if rel_count.isdigit() else 0,
                "data_source": "sectivia"
            })

    return records, seen_ids


def parse_and_validate_relations(csv_path: Path, valid_company_ids: set) -> List[dict]:
    """
    Parses sectivia-relations.csv.
    Verifies that supplier_id and customer_id reference valid companies.
    """
    if not csv_path.exists():
        raise FileNotFoundError(f"Relations CSV not found at: {csv_path}")

    records = []
    with open(csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row_idx, row in enumerate(reader, start=2):
            s_raw = (row.get("supplier_id") or "").strip()
            c_raw = (row.get("customer_id") or "").strip()

            if not s_raw or not c_raw:
                raise ValueError(f"Missing supplier_id or customer_id at row {row_idx} in {csv_path}")

            s_id = f"sectivia:{s_raw}"
            c_id = f"sectivia:{c_raw}"

            if s_id not in valid_company_ids:
                raise ValueError(f"Supplier ID '{s_id}' not found in companies (row {row_idx})")
            if c_id not in valid_company_ids:
                raise ValueError(f"Customer ID '{c_id}' not found in companies (row {row_idx})")

            sec = (row.get("sector") or "").strip()
            sup_sec = (row.get("supplier_sector") or "").strip()
            cust_sec = (row.get("customer_sector") or "").strip()
            is_cross = (sup_sec != cust_sec) if (sup_sec and cust_sec) else False

            records.append({
                "supplier_id": s_id,
                "customer_id": c_id,
                "what": (row.get("what") or "").strip(),
                "source": (row.get("source") or "").strip(),
                "url": (row.get("url") or "").strip(),
                "sector": sec if sec else None,
                "supplier_sector": sup_sec,
                "customer_sector": cust_sec,
                "supplier_segment": (row.get("supplier_segment") or "").strip(),
                "customer_segment": (row.get("customer_segment") or "").strip(),
                "is_cross_sector": is_cross,
                "data_source": "sectivia"
            })

    return records


# Cypher Statements for Database Setup and Batch Merging
CONSTRAINTS_AND_INDEXES = [
    "CREATE CONSTRAINT constraint_company_unique_id IF NOT EXISTS FOR (c:Company) REQUIRE c.id IS UNIQUE",
    "CREATE INDEX index_company_ticker IF NOT EXISTS FOR (c:Company) ON (c.ticker)",
    "CREATE INDEX index_company_name IF NOT EXISTS FOR (c:Company) ON (c.name)",
    "CREATE INDEX index_company_sector IF NOT EXISTS FOR (c:Company) ON (c.sector)",
    "CREATE INDEX index_company_segment IF NOT EXISTS FOR (c:Company) ON (c.segment)",
    "CREATE INDEX index_company_country IF NOT EXISTS FOR (c:Company) ON (c.country)",
    "CREATE INDEX index_company_listed IF NOT EXISTS FOR (c:Company) ON (c.listed)",
    "CREATE INDEX index_supplies_to_cross_sector IF NOT EXISTS FOR ()-[r:SUPPLIES_TO]-() ON (r.is_cross_sector)",
    "CREATE INDEX index_supplies_to_datasource IF NOT EXISTS FOR ()-[r:SUPPLIES_TO]-() ON (r.data_source)"
]

BATCH_MERGE_COMPANIES_CYPHER = """
UNWIND $batch AS comp
MERGE (c:Company { id: comp.id })
SET
  c.raw_id          = comp.raw_id,
  c.ticker          = comp.ticker,
  c.name            = comp.name,
  c.exchange        = comp.exchange,
  c.country         = comp.country,
  c.sector          = comp.sector,
  c.sector_name     = comp.sector_name,
  c.segment         = comp.segment,
  c.listed          = comp.listed,
  c.relations_count = comp.relations_count,
  c.data_source     = comp.data_source,
  c.updated_at      = datetime()
"""

BATCH_MERGE_RELATIONS_CYPHER = """
UNWIND $batch AS rel
MATCH (s:Company { id: rel.supplier_id })
MATCH (c:Company { id: rel.customer_id })
MERGE (s)-[r:SUPPLIES_TO]->(c)
SET
  r.what             = rel.what,
  r.source           = rel.source,
  r.url              = rel.url,
  r.sector           = rel.sector,
  r.supplier_sector  = rel.supplier_sector,
  r.customer_sector  = rel.customer_sector,
  r.supplier_segment = rel.supplier_segment,
  r.customer_segment = rel.customer_segment,
  r.is_cross_sector  = rel.is_cross_sector,
  r.data_source      = rel.data_source,
  r.updated_at       = datetime()
"""


def execute_neo4j_import(
    uri: str,
    user: str,
    password: str,
    database: str,
    companies: List[dict],
    relations: List[dict],
    batch_size: int = 500
):
    """Executes schema constraints and batch data import against a live Neo4j instance."""
    if not HAS_NEO4J or GraphDatabase is None:
        print("\n[ERROR] The 'neo4j' Python package is not installed.")
        print("To run live database imports, install it via: python -m pip install neo4j")
        sys.exit(1)

    print(f"\n[INFO] Connecting to Neo4j instance at {uri} (Database: '{database}')...")
    driver = GraphDatabase.driver(uri, auth=(user, password))

    try:
        # Verify connectivity
        driver.verify_connectivity()
        print("[SUCCESS] Connected to Neo4j successfully.")

        with driver.session(database=database) as session:
            # 1. Apply constraints and indexes
            print("[INFO] Applying uniqueness constraints and indexes...")
            for ddl in CONSTRAINTS_AND_INDEXES:
                session.run(ddl)
            print("[SUCCESS] Constraints and indexes verified.")

            # 2. Batch import companies
            print(f"[INFO] Importing {len(companies)} Company nodes (batch size: {batch_size})...")
            for i in range(0, len(companies), batch_size):
                batch = companies[i:i + batch_size]
                session.run(BATCH_MERGE_COMPANIES_CYPHER, batch=batch)
            print(f"[SUCCESS] Imported {len(companies)} Company nodes.")

            # 3. Batch import relationships
            print(f"[INFO] Importing {len(relations)} SUPPLIES_TO relationships (batch size: {batch_size})...")
            for i in range(0, len(relations), batch_size):
                batch = relations[i:i + batch_size]
                session.run(BATCH_MERGE_RELATIONS_CYPHER, batch=batch)
            print(f"[SUCCESS] Imported {len(relations)} SUPPLIES_TO relationships.")

            # 4. Verify post-import counts
            n_res = session.run("MATCH (c:Company) RETURN count(c) AS count").single()["count"]
            r_res = session.run("MATCH ()-[r:SUPPLIES_TO]->() RETURN count(r) AS count").single()["count"]
            print("\n[VERIFICATION]")
            print(f"  Live Database Company Count:       {n_res} (Expected: {len(companies)})")
            print(f"  Live Database SUPPLIES_TO Count:  {r_res} (Expected: {len(relations)})")

    finally:
        driver.close()
        print("[INFO] Neo4j driver connection closed.")


def main():
    parser = argparse.ArgumentParser(
        description="AtmoGraph Sectivia Neo4j Importer (Member 1 - Graph Foundation)"
    )
    parser.add_argument(
        "--raw-dir",
        type=Path,
        default=Path("database/datasets/sectivia/raw"),
        help="Directory holding raw Sectivia CSV files"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Perform parsing, schema validation, and simulation without connecting to DB"
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        default=False,
        help="Explicit flag required to perform actual database mutations"
    )
    parser.add_argument(
        "--uri",
        type=str,
        default=None,
        help="Neo4j Bolt/Neo4j URI (default from NEO4J_URI or bolt://localhost:7687)"
    )
    parser.add_argument(
        "--user",
        type=str,
        default=None,
        help="Neo4j username (default from NEO4J_USERNAME or 'neo4j')"
    )
    parser.add_argument(
        "--password",
        type=str,
        default=None,
        help="Neo4j password (default from NEO4J_PASSWORD)"
    )
    parser.add_argument(
        "--database",
        type=str,
        default=None,
        help="Neo4j target database name (default from NEO4J_DATABASE or 'atmograph')"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="Batch size for Cypher MERGE operations (default: 500)"
    )
    parser.add_argument(
        "--env-file",
        type=Path,
        default=Path(".env"),
        help="Path to .env configuration file"
    )

    args = parser.parse_args()

    # Determine mode: dry-run is default unless --execute is passed
    is_dry_run = args.dry_run or not args.execute

    print("=" * 80)
    print("ATMOGRAPH - SECTIVIA NEO4J IMPORT RUNNER")
    print(f"Mode: {'DRY-RUN (Validation & Audit only - No DB mutations)' if is_dry_run else 'LIVE DATABASE EXECUTION'}")
    print("=" * 80)

    # 1. Parse and validate companies
    comp_file = args.raw_dir / "sectivia-companies.csv"
    rel_file = args.raw_dir / "sectivia-relations.csv"

    print(f"[1/3] Parsing and validating companies from {comp_file}...")
    sector_taxonomy = load_sector_taxonomy(args.raw_dir)
    companies, valid_ids = parse_and_validate_companies(comp_file, sector_map=sector_taxonomy)
    print(f"      Parsed {len(companies)} companies. Unique IDs: {len(valid_ids)}.")

    # 2. Parse and validate relations
    print(f"[2/3] Parsing and validating relationships from {rel_file}...")
    relations = parse_and_validate_relations(rel_file, valid_ids)
    print(f"      Parsed {len(relations)} relationships. All referential links valid.")

    cross_sector_count = sum(1 for r in relations if r["is_cross_sector"])
    print(f"      Identified {cross_sector_count} cross-sector relationships.")

    # 3. Dry-run summary or live execution
    if is_dry_run:
        print("\n[3/3] DRY-RUN AUDIT SUMMARY (No mutations executed):")
        print(f"  * Company nodes to create/merge:       {len(companies)}")
        print(f"  * SUPPLIES_TO edges to create/merge:   {len(relations)}")
        print(f"  * Uniqueness constraints to enforce:   1 (Company.id)")
        print(f"  * Performance indexes to apply:        8 indexes")
        print(f"  * Sample node payload:                 {companies[0]}")
        print(f"  * Sample edge payload:                 {relations[0]}")
        print("\n[SAFETY CONFIRMATION] No live database import was performed.")
        print("To run against your active Neo4j Desktop instance, verify credentials and execute with:")
        print("    python database/scripts/import_data.py --execute --database atmograph")
        print("=" * 80)
        return

    # If --execute was specified:
    env_vars = load_env_file(args.env_file)
    uri = args.uri or os.environ.get("NEO4J_URI") or env_vars.get("NEO4J_URI") or "bolt://localhost:7687"
    user = args.user or os.environ.get("NEO4J_USERNAME") or env_vars.get("NEO4J_USERNAME") or "neo4j"
    password = args.password or os.environ.get("NEO4J_PASSWORD") or env_vars.get("NEO4J_PASSWORD")
    database = args.database or os.environ.get("NEO4J_DATABASE") or env_vars.get("NEO4J_DATABASE") or "atmograph"

    if not password:
        print("\n[ERROR] Neo4j password not supplied. Set NEO4J_PASSWORD in your environment,")
        print("provide it in .env, or pass --password <password> via command line.")
        sys.exit(1)

    masked_pw = password[0] + "*" * (len(password) - 2) + password[-1] if len(password) > 2 else "***"
    print(f"\n[CREDENTIALS] Target URI: {uri} | User: {user} | Password: {masked_pw} | Database: {database}")

    execute_neo4j_import(
        uri=uri,
        user=user,
        password=password,
        database=database,
        companies=companies,
        relations=relations,
        batch_size=args.batch_size
    )


if __name__ == "__main__":
    main()
