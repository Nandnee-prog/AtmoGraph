"""
test_connection.py
==================
Check karta hai ki Python se AuraDB connect ho raha hai ya nahi.
Run:  python backend\scripts\test_connection.py
"""
import os
from pathlib import Path

from dotenv import load_dotenv
from neo4j import GraphDatabase
from neo4j.exceptions import AuthError, ServiceUnavailable

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / "backend" / ".env")        # .env se values padho

uri = os.getenv("NEO4J_URI")
user = os.getenv("NEO4J_USERNAME")
pw = os.getenv("NEO4J_PASSWORD")

if not (uri and user and pw):
    raise SystemExit("backend\\.env mein NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD bharo.")

try:
    # with block khatam hote hi connection apne aap band ho jata hai
    with GraphDatabase.driver(uri, auth=(user, pw)) as driver:
        driver.verify_connectivity()          # server tak pahunch sakte hain?
        with driver.session() as session:
            row = session.run("RETURN 'Connected to AuraDB' AS msg").single()
            nodes = session.run("MATCH (n) RETURN count(n) AS c").single()["c"]
            print("OK:", row["msg"])
            print("Abhi database mein nodes:", nodes)
except AuthError:
    print("FAIL: username/password galat hai. Credentials file se dobara copy karo.")
except ServiceUnavailable:
    print("FAIL: server tak nahi pahunch paye. NEO4J_URI check karo, instance Running hai ya nahi "
          "(AuraDB Free kuch din inactive rehne par pause ho jata hai), aur internet check karo.")