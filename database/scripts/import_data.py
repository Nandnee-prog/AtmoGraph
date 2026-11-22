#!/usr/bin/env python3
"""
AtmoGraph - Neo4j Importer (Member 1 - Graph Foundation)
Production-grade idempotent loader for Sectivia supply chain graph.
Uses the official Neo4j Python driver with parameterized batching (UNWIND)
and MERGE operations to guarantee zero duplication on repeat runs.
"""

import argparse
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
import pandas as pd

# Load environment variables from .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    from neo4j import GraphDatabase, Driver
    HAS_NEO4J = True
except ImportError:
    HAS_NEO4J = False
    GraphDatabase = None
    Driver = None


def mask_secret(val: Optional[str]) -> str:
    """Mask credentials for safe console logging."""
    if not val:
        return "<unset>"
    if len(val) <= 2:
        return "**"
    return val[0] + "*" * (len(val) - 2) + val[-1]


def get_raw_files() -> tuple[Path, Path]:
    """Find companies and relations CSV files."""
    candidates = [
        Path("database/datasets/sectivia/raw"),
        Path("database/datasets/Sectivia/raw"),
        Path("datasets/sectivia/raw"),
    ]
    for c in candidates:
        comp = c / "sectivia-companies.csv"
        rel = c / "sectivia-relations.csv"
        if comp.exists() and rel.exists():
            return comp.resolve(), rel.resolve()
    raise FileNotFoundError("Could not find Sectivia CSV raw data files.")


def prepare_company_records(csv_path: Path) -> List[Dict[str, Any]]:
    """Transform companies CSV into clean Cypher parameter dictionaries."""
    df = pd.read_csv(csv_path)
    records = []
    for _, row in df.iterrows():
        raw_id = str(row["id"]).strip()
        ticker = str(row["ticker"]).strip() if pd.notna(row["ticker"]) and str(row["ticker"]).strip() else None
        exchange = str(row["exchange"]).strip() if pd.notna(row["exchange"]) and str(row["exchange"]).strip() else None
        
        record = {
            "id": f"sectivia:{raw_id}",
            "raw_id": raw_id,
            "ticker": ticker,
            "name": str(row["name"]).strip(),
            "exchange": exchange,
            "country": str(row["country"]).strip(),
            "sector": str(row["sector"]).strip(),
            "segment": str(row["segment"]).strip(),
            "listed": bool(row["listed"]),
            "relations_count": int(row["relations"]),
            "dataset_source": "sectivia",
        }
        records.append(record)
    return records


def prepare_relation_records(csv_path: Path) -> List[Dict[str, Any]]:
    """Transform relations CSV into clean Cypher parameter dictionaries."""
    df = pd.read_csv(csv_path)
    records = []
    for _, row in df.iterrows():
        supp_raw = str(row["supplier_id"]).strip()
        cust_raw = str(row["customer_id"]).strip()
        
        supp_sec = str(row["supplier_sector"]).strip()
        cust_sec = str(row["customer_sector"]).strip()
        is_cross = supp_sec != cust_sec
        
        sector_val = str(row["sector"]).strip() if pd.notna(row["sector"]) and str(row["sector"]).strip() else None
        what_val = str(row["what"]).strip() if pd.notna(row["what"]) and str(row["what"]).strip() else ""
        source_val = str(row["source"]).strip() if pd.notna(row["source"]) and str(row["source"]).strip() else "SEC EDGAR"
        url_val = str(row["url"]).strip() if pd.notna(row["url"]) and str(row["url"]).strip() else ""
        
        record = {
            "supplier_id": f"sectivia:{supp_raw}",
            "customer_id": f"sectivia:{cust_raw}",
            "sector": sector_val,
            "supplier_sector": supp_sec,
            "customer_sector": cust_sec,
            "supplier_segment": str(row["supplier_segment"]).strip(),
            "customer_segment": str(row["customer_segment"]).strip(),
            "is_cross_sector": is_cross,
            "what": what_val,
            "source": source_val,
            "source_url": url_val,
            "dataset_source": "sectivia",
        }
        records.append(record)
    return records


def apply_schema_constraints(session) -> None:
    """Apply idempotency constraints and performance indexes."""
    statements = [
        # Unique Company constraint
        "CREATE CONSTRAINT company_id_unique IF NOT EXISTS FOR (c:Company) REQUIRE c.id IS UNIQUE",
        # Indexes
        "CREATE INDEX company_name_idx IF NOT EXISTS FOR (c:Company) ON (c.name)",
        "CREATE INDEX company_ticker_idx IF NOT EXISTS FOR (c:Company) ON (c.ticker)",
        "CREATE INDEX company_sector_idx IF NOT EXISTS FOR (c:Company) ON (c.sector)",
        "CREATE INDEX company_country_idx IF NOT EXISTS FOR (c:Company) ON (c.country)",
        "CREATE INDEX company_segment_idx IF NOT EXISTS FOR (c:Company) ON (c.segment)",
        "CREATE INDEX supplies_to_cross_sector_idx IF NOT EXISTS FOR ()-[r:SUPPLIES_TO]-() ON (r.is_cross_sector)",
        "CREATE INDEX supplies_to_sector_idx IF NOT EXISTS FOR ()-[r:SUPPLIES_TO]-() ON (r.sector)",
    ]
    for stmt in statements:
        try:
            session.run(stmt)
        except Exception as e:
            print(f"[WARN] Schema statement note: {e}")


def batch_import_companies(session, records: List[Dict[str, Any]], batch_size: int = 100) -> int:
    """Batch import company nodes using UNWIND and MERGE."""
    query = """
    UNWIND $batch AS row
    MERGE (c:Company {id: row.id})
    SET c.raw_id = row.raw_id,
        c.ticker = row.ticker,
        c.name = row.name,
        c.exchange = row.exchange,
        c.country = row.country,
        c.sector = row.sector,
        c.segment = row.segment,
        c.listed = row.listed,
        c.relations_count = row.relations_count,
        c.dataset_source = row.dataset_source
    RETURN count(c) AS loaded
    """
    total = len(records)
    for i in range(0, total, batch_size):
        batch = records[i:i + batch_size]
        session.run(query, batch=batch)
        print(f"  -> Imported {min(i + batch_size, total)}/{total} company nodes")
    return total


def batch_import_relations(session, records: List[Dict[str, Any]], batch_size: int = 100) -> int:
    """Batch import SUPPLIES_TO relationships using UNWIND and MERGE."""
    query = """
    UNWIND $batch AS row
    MATCH (s:Company {id: row.supplier_id})
    MATCH (c:Company {id: row.customer_id})
    MERGE (s)-[r:SUPPLIES_TO]->(c)
    SET r.sector = row.sector,
        r.supplier_sector = row.supplier_sector,
        r.customer_sector = row.customer_sector,
        r.supplier_segment = row.supplier_segment,
        r.customer_segment = row.customer_segment,
        r.is_cross_sector = row.is_cross_sector,
        r.what = row.what,
        r.source = row.source,
        r.source_url = row.source_url,
        r.dataset_source = row.dataset_source
    RETURN count(r) AS loaded
    """
    total = len(records)
    for i in range(0, total, batch_size):
        batch = records[i:i + batch_size]
        session.run(query, batch=batch)
        print(f"  -> Imported {min(i + batch_size, total)}/{total} SUPPLIES_TO relationships")
    return total


def run_live_import(uri: str, user: str, password: str, database: str, batch_size: int = 100) -> Dict[str, Any]:
    """Execute live import against target Neo4j instance."""
    if not HAS_NEO4J:
        raise RuntimeError("neo4j Python package is not installed. Run: pip install neo4j")

    comp_file, rel_file = get_raw_files()
    comp_records = prepare_company_records(comp_file)
    rel_records = prepare_relation_records(rel_file)

    print(f"\n[INFO] Connecting to Neo4j DBMS at: {uri} (Database: '{database}')...")
    driver: Driver = GraphDatabase.driver(uri, auth=(user, password))
    
    try:
        # Verify connectivity
        driver.verify_connectivity()
        print("[SUCCESS] Connected to Neo4j successfully.")

        with driver.session(database=database) as session:
            # 1. Apply Schema Constraints & Indexes
            print("\n[STEP 1/3] Applying schema constraints and indexes...")
            apply_schema_constraints(session)
            print("[SUCCESS] Constraints and indexes declared.")

            # 2. Batch Load Companies
            print(f"\n[STEP 2/3] Importing {len(comp_records)} Company nodes...")
            loaded_comp = batch_import_companies(session, comp_records, batch_size)

            # 3. Batch Load Relationships
            print(f"\n[STEP 3/3] Importing {len(rel_records)} SUPPLIES_TO relationships...")
            loaded_rel = batch_import_relations(session, rel_records, batch_size)

            # 4. Immediate Validation
            comp_count = session.run("MATCH (c:Company) RETURN count(c) AS count").single()["count"]
            rel_count = session.run("MATCH ()-[r:SUPPLIES_TO]->() RETURN count(r) AS count").single()["count"]
            cross_count = session.run("MATCH ()-[r:SUPPLIES_TO {is_cross_sector: true}]->() RETURN count(r) AS count").single()["count"]

            print("\n=======================================================")
            print("POST-IMPORT AUDIT METRICS:")
            print(f"  Company Nodes:          {comp_count} (Expected: 382)")
            print(f"  SUPPLIES_TO Relations:  {rel_count} (Expected: 556)")
            print(f"  Cross-Sector Flows:     {cross_count} (Expected: 162)")
            print("=======================================================")

            return {
                "status": "success",
                "database": database,
                "companies": comp_count,
                "relationships": rel_count,
                "cross_sector": cross_count,
                "all_matched": comp_count == 382 and rel_count == 556 and cross_count == 162,
            }
    finally:
        driver.close()
        print("[INFO] Neo4j driver connection closed cleanly.")


def run_dry_run() -> Dict[str, Any]:
    """Execute dry-run parsing and validation without connecting to Neo4j."""
    print("\n=======================================================")
    print("ATMOGRAPH - SECTIVIA IMPORT (DRY-RUN MODE)")
    print("=======================================================")
    comp_file, rel_file = get_raw_files()
    comp_records = prepare_company_records(comp_file)
    rel_records = prepare_relation_records(rel_file)

    # Validate company IDs
    comp_ids = {r["id"] for r in comp_records}
    assert len(comp_ids) == len(comp_records), "Duplicate company IDs detected!"

    # Validate relationship integrity
    dangling = []
    cross_count = 0
    for r in rel_records:
        if r["supplier_id"] not in comp_ids:
            dangling.append(f"Supplier {r['supplier_id']}")
        if r["customer_id"] not in comp_ids:
            dangling.append(f"Customer {r['customer_id']}")
        if r["is_cross_sector"]:
            cross_count += 1

    assert len(dangling) == 0, f"Dangling references detected: {dangling}"

    print(f"Validated Companies:     {len(comp_records)} (Unique IDs: {len(comp_ids)})")
    print(f"Validated Relationships: {len(rel_records)} (Cross-sector: {cross_count})")
    print("Referential Integrity:   100% Valid (0 dangling endpoints)")
    print("Idempotency Readiness:   MERGE logic prepared with unique ID constraint.")
    print("\n[SUCCESS] Dry-run completed with zero errors.")
    return {
        "status": "dry_run_success",
        "companies_validated": len(comp_records),
        "relationships_validated": len(rel_records),
        "cross_sector_validated": cross_count,
    }


def main():
    parser = argparse.ArgumentParser(description="AtmoGraph Sectivia Neo4j Importer")
    parser.add_argument("--dry-run", action="store_true", help="Parse and validate data without connecting to Neo4j")
    parser.add_argument("--execute", action="store_true", help="Execute live import into target Neo4j database")
    parser.add_argument("--uri", default=None, help="Neo4j Bolt URI (default from NEO4J_URI or bolt://localhost:7687)")
    parser.add_argument("--user", default=None, help="Neo4j username (default from NEO4J_USERNAME or 'neo4j')")
    parser.add_argument("--password", default=None, help="Neo4j password (default from NEO4J_PASSWORD)")
    parser.add_argument("--database", default=None, help="Target Neo4j database (default from NEO4J_DATABASE or 'atmograph')")
    parser.add_argument("--batch-size", type=int, default=100, help="Batch transaction size (default: 100)")

    args = parser.parse_args()

    # Default to dry-run if --execute is not explicitly passed
    if not args.execute and args.dry_run:
        run_dry_run()
        return

    if not args.execute:
        print("[INFO] No execution flag specified. Running dry-run validation by default.")
        print("To run live database mutation, pass: --execute")
        run_dry_run()
        return

    # Gather connection parameters
    uri = args.uri or os.environ.get("NEO4J_URI") or "bolt://localhost:7687"
    user = args.user or os.environ.get("NEO4J_USERNAME") or "neo4j"
    password = args.password or os.environ.get("NEO4J_PASSWORD")
    database = args.database or os.environ.get("NEO4J_DATABASE") or "atmograph"

    print("=======================================================")
    print("ATMOGRAPH - SECTIVIA NEO4J LIVE IMPORT")
    print(f"  Target URI:      {uri}")
    print(f"  Target Database: {database}")
    print(f"  User:            {user}")
    print(f"  Password:        {mask_secret(password)}")
    print(f"  Batch Size:      {args.batch_size}")
    print("=======================================================")

    if not password:
        print("\n[ERROR] Neo4j password not supplied.")
        print("Please set NEO4J_PASSWORD in your environment or .env file, or pass --password <pwd>.")
        sys.exit(1)

    run_live_import(uri, user, password, database, args.batch_size)


if __name__ == "__main__":
    main()
