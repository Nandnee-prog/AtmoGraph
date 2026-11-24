"""
ingest_neo4j.py
===============
Cleaned CSV ko Neo4j mein daalta hai.  ⚠️ Data SYNTHETIC / SIMULATED hai.

Pehle test (AuraDB ke bina):   python backend\scripts\ingest_neo4j.py --dry-run
Asli load (Stage 4, .env ke baad):   python backend\scripts\ingest_neo4j.py
Dobara shuru se:   python backend\scripts\ingest_neo4j.py --clear
"""
import argparse
import json
import os

from dotenv import load_dotenv
from neo4j import GraphDatabase

from data_loader import ROOT, load_data, read_yaml

BATCH = 500   # ek baar mein 500 rows bhejte hain


def to_records(df):
    # to_json se pure Python types milte hain (numpy bool Neo4j driver ko pasand nahi)
    return json.loads(df.to_json(orient="records"))


def batches(rows, size=BATCH):
    for i in range(0, len(rows), size):
        yield rows[i:i + size]


# Har node par 2 label: :SupplyNode (common) aur uska type (:Port, :Supplier ...)
CONSTRAINT = ("CREATE CONSTRAINT supplynode_id IF NOT EXISTS "
              "FOR (n:SupplyNode) REQUIRE n.node_id IS UNIQUE")

NODE_QUERY = """
UNWIND $rows AS row
MERGE (n:SupplyNode {{node_id: row.node_id}})
SET n += row
SET n:{label}
"""

EDGE_QUERY = """
UNWIND $rows AS row
MATCH (a:SupplyNode {node_id: row.source})
MATCH (b:SupplyNode {node_id: row.target})
MERGE (a)-[r:SHIPS_TO]->(b)
SET r.route_type = row.route_type,
    r.lead_time_days = row.lead_time_days,
    r.capacity = row.capacity,
    r.data_source = row.data_source
"""

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="Neo4j se connect kiye bina check")
    ap.add_argument("--clear", action="store_true", help="pehle purana SupplyNode data delete")
    a = ap.parse_args()

    nodes, edges, _ = load_data()
    node_rows, edge_rows = to_records(nodes), to_records(edges)
    labels = read_yaml("schema.yaml")["nodes"]["node_type"]["allowed"]   # trusted list
    print(f"Loaded clean data: {len(node_rows)} nodes, {len(edge_rows)} edges")

    if a.dry_run:
        print("Dry run OK. Neo4j se connect nahi kiya.")
        raise SystemExit

    load_dotenv(ROOT / "backend" / ".env")
    uri, user, pw = os.getenv("NEO4J_URI"), os.getenv("NEO4J_USERNAME"), os.getenv("NEO4J_PASSWORD")
    if not (uri and user and pw):
        raise SystemExit("backend\\.env mein NEO4J_URI / USERNAME / PASSWORD bharo (Stage 4).")

    with GraphDatabase.driver(uri, auth=(user, pw)) as driver:
        driver.verify_connectivity()
        with driver.session() as s:
            if a.clear:
                s.run("MATCH (n:SupplyNode) DETACH DELETE n").consume()
            s.run(CONSTRAINT).consume()

            for label in labels:                              # type ke hisaab se nodes
                rows = [r for r in node_rows if r["node_type"] == label]
                for b in batches(rows):
                    s.run(NODE_QUERY.format(label=label), rows=b).consume()
                print(f"  {label}: {len(rows)} nodes")

            for b in batches(edge_rows):
                s.run(EDGE_QUERY, rows=b).consume()

            n_cnt = s.run("MATCH (n:SupplyNode) RETURN count(n) AS c").single()["c"]
            e_cnt = s.run("MATCH ()-[r:SHIPS_TO]->() RETURN count(r) AS c").single()["c"]
            print(f"Neo4j mein ab: {n_cnt} nodes, {e_cnt} relationships")