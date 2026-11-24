"""
validate_graph.py
=================
Neo4j mein jo data hai, use CSV se match karke check karta hai.
Run:  python backend\scripts\validate_graph.py
"""
import os
import sys

import pandas as pd
from dotenv import load_dotenv
from neo4j import GraphDatabase

from data_loader import ROOT, read_yaml

load_dotenv(ROOT / "backend" / ".env")
results = []          # (status, check ka naam, detail)


def check(name, ok, detail="", warn_only=False):
    status = "PASS" if ok else ("WARN" if warn_only else "FAIL")
    results.append(status)
    print(f"[{status}] {name}  {detail}")


def one(session, query, **params):
    return session.run(query, **params).single()[0]


nodes_csv = pd.read_csv(ROOT / "data" / "processed" / "nodes_clean.csv")
edges_csv = pd.read_csv(ROOT / "data" / "processed" / "edges_clean.csv")
types = read_yaml("schema.yaml")["nodes"]["node_type"]["allowed"]   # trusted list

uri, user, pw = os.getenv("NEO4J_URI"), os.getenv("NEO4J_USERNAME"), os.getenv("NEO4J_PASSWORD")
if not (uri and user and pw):
    raise SystemExit("backend\\.env bharo.")

with GraphDatabase.driver(uri, auth=(user, pw)) as driver:
    with driver.session() as s:
        # 1) Count match
        n_db = one(s, "MATCH (n:SupplyNode) RETURN count(n)")
        check("Node count CSV vs Neo4j", n_db == len(nodes_csv), f"(CSV={len(nodes_csv)}, Neo4j={n_db})")

        e_db = one(s, "MATCH ()-[r:SHIPS_TO]->() RETURN count(r)")
        check("Edge count CSV vs Neo4j", e_db == len(edges_csv), f"(CSV={len(edges_csv)}, Neo4j={e_db})")

        # 2) Har type ka count
        csv_counts = nodes_csv["node_type"].value_counts().to_dict()
        for t in types:
            db_c = one(s, f"MATCH (n:{t}) RETURN count(n)")
            check(f"{t} count", db_c == csv_counts.get(t, 0), f"(CSV={csv_counts.get(t, 0)}, Neo4j={db_c})")

        # 3) Data quality
        check("Koi node bina node_id ke nahi",
              one(s, "MATCH (n:SupplyNode) WHERE n.node_id IS NULL RETURN count(n)") == 0)
        check("Koi self-loop nahi",
              one(s, "MATCH (n)-[r:SHIPS_TO]->(n) RETURN count(r)") == 0)
        check("Koi isolated node nahi (har node kisi se juda hai)",
              one(s, "MATCH (n:SupplyNode) WHERE NOT (n)--() RETURN count(n)") == 0)

        # 4) Sirf SYNTHETIC rule wale checks: official data par sirf WARN dein
        bad_dir = one(s, """
            MATCH (a:SupplyNode)-[r:SHIPS_TO]->(b:SupplyNode)
            WHERE NOT ( (a:Supplier AND b:Manufacturer) OR (a:Manufacturer AND b:Port)
                     OR (a:Port AND b:Port) OR (a:Port AND b:Warehouse)
                     OR (a:Warehouse AND b:Retailer) )
            RETURN count(r)""")
        check("Edges layer order follow karti hain (synthetic rule)", bad_dir == 0,
              f"(violations={bad_dir})", warn_only=True)

        no_source = one(s, """
            MATCH (r:Retailer)
            WHERE NOT EXISTS { MATCH (:Supplier)-[:SHIPS_TO*1..6]->(r) }
            RETURN count(r)""")
        check("Har Retailer ke upstream mein koi Supplier hai", no_source == 0,
              f"(bina supplier wale retailers={no_source})", warn_only=True)

        srcs = [r["src"] for r in s.run("MATCH (n:SupplyNode) RETURN DISTINCT n.data_source AS src")]
        print(f"[INFO] data_source values: {srcs}")

fails = results.count("FAIL")
print(f"\nSummary: PASS={results.count('PASS')}, WARN={results.count('WARN')}, FAIL={fails}")
sys.exit(1 if fails else 0)