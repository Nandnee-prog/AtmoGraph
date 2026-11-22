#!/usr/bin/env python3
"""
AtmoGraph - Neo4j Database Verifier (Member 1 - Graph Foundation)
Audits live Neo4j database against Sectivia ground-truth invariants:
- 382 Company nodes
- 556 SUPPLIES_TO relationships
- 162 Cross-sector relationships
- 0 Duplicate IDs
- 0 Dangling endpoints
- Constraints & Indexes status
"""

import argparse
import os
import sys
from typing import Any, Dict, Optional

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


def mask_secret(val: Optional[str]) -> str:
    if not val:
        return "<unset>"
    if len(val) <= 2:
        return "**"
    return val[0] + "*" * (len(val) - 2) + val[-1]


def verify_live_database(uri: str, user: str, password: str, database: str) -> Dict[str, Any]:
    if not HAS_NEO4J:
        print("[ERROR] neo4j Python driver not installed.")
        sys.exit(1)

    print("=================================================================")
    print("ATMOGRAPH - NEO4J DATABASE VERIFICATION AUDIT")
    print(f"Target DBMS:     {uri}")
    print(f"Database:        {database}")
    print(f"User:            {user}")
    print("=================================================================")

    driver = GraphDatabase.driver(uri, auth=(user, password))
    results = {}

    try:
        driver.verify_connectivity()
        with driver.session(database=database) as session:
            # 1. Total Companies
            comp_res = session.run("MATCH (c:Company) RETURN count(c) AS count").single()["count"]
            results["total_companies"] = {
                "actual": comp_res,
                "expected": 382,
                "passed": comp_res == 382
            }

            # 2. Total Relationships
            rel_res = session.run("MATCH ()-[r:SUPPLIES_TO]->() RETURN count(r) AS count").single()["count"]
            results["total_relationships"] = {
                "actual": rel_res,
                "expected": 556,
                "passed": rel_res == 556
            }

            # 3. Cross-Sector Flows
            cross_res = session.run("MATCH ()-[r:SUPPLIES_TO {is_cross_sector: true}]->() RETURN count(r) AS count").single()["count"]
            results["cross_sector_relationships"] = {
                "actual": cross_res,
                "expected": 162,
                "passed": cross_res == 162
            }

            # 4. Duplicate IDs
            dup_res = session.run("""
                MATCH (c:Company)
                WITH c.id AS id, count(c) AS cnt
                WHERE cnt > 1
                RETURN count(id) AS dups
            """).single()["dups"]
            results["duplicate_company_ids"] = {
                "actual": dup_res,
                "expected": 0,
                "passed": dup_res == 0
            }

            # 5. Dangling relationships
            dang_res = session.run("""
                MATCH ()-[r:SUPPLIES_TO]->()
                WHERE startNode(r) IS NULL OR endNode(r) IS NULL
                RETURN count(r) AS cnt
            """).single()["cnt"]
            results["dangling_endpoints"] = {
                "actual": dang_res,
                "expected": 0,
                "passed": dang_res == 0
            }

            # 6. Orphan nodes
            orphan_res = session.run("""
                MATCH (c:Company)
                WHERE NOT (c)-[:SUPPLIES_TO]-()
                RETURN count(c) AS cnt
            """).single()["cnt"]
            results["orphan_nodes"] = {
                "actual": orphan_res,
                "expected": 0,
                "passed": orphan_res == 0
            }

            # 7. Check Constraints & Indexes
            constraints = []
            try:
                for row in session.run("SHOW CONSTRAINTS"):
                    constraints.append(dict(row))
            except Exception:
                pass
            
            indexes = []
            try:
                for row in session.run("SHOW INDEXES"):
                    indexes.append(dict(row))
            except Exception:
                pass

            results["constraints_online"] = len(constraints)
            results["indexes_online"] = len(indexes)

    finally:
        driver.close()

    # Print summary table
    print("\nVERIFICATION RESULTS TABLE:")
    print(f"{'Metric':<30} | {'Expected':<10} | {'Actual':<10} | {'Status'}")
    print("-" * 65)
    for metric, data in results.items():
        if isinstance(data, dict) and "passed" in data:
            status = "PASSED [OK]" if data["passed"] else "FAILED [MISMATCH]"
            print(f"{metric:<30} | {str(data['expected']):<10} | {str(data['actual']):<10} | {status}")
    print("-" * 65)
    print(f"Constraints Active: {results.get('constraints_online', 0)}")
    print(f"Indexes Active:     {results.get('indexes_online', 0)}")
    print("=================================================================")

    all_passed = all(d["passed"] for d in results.values() if isinstance(d, dict) and "passed" in d)
    if all_passed:
        print("[SUCCESS] All database verification metrics match Sectivia ground-truth invariants!")
    else:
        print("[WARN] Some database metrics do not match expected figures.")
    return results


def main():
    parser = argparse.ArgumentParser(description="AtmoGraph Neo4j Database Verifier")
    parser.add_argument("--uri", default=None, help="Neo4j Bolt URI")
    parser.add_argument("--user", default=None, help="Neo4j username")
    parser.add_argument("--password", default=None, help="Neo4j password")
    parser.add_argument("--database", default=None, help="Target Neo4j database")
    args = parser.parse_args()

    uri = args.uri or os.environ.get("NEO4J_URI") or "bolt://localhost:7687"
    user = args.user or os.environ.get("NEO4J_USERNAME") or "neo4j"
    password = args.password or os.environ.get("NEO4J_PASSWORD")
    database = args.database or os.environ.get("NEO4J_DATABASE") or "atmograph"

    if not password:
        print("[ERROR] NEO4J_PASSWORD not found. Provide via environment or --password.")
        sys.exit(1)

    verify_live_database(uri, user, password, database)


if __name__ == "__main__":
    main()
