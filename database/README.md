# AtmoGraph: Neo4j Graph Database Foundation (Member 1)

This directory contains the production-grade **Neo4j graph database foundation** for the AtmoGraph supply chain ripple effect predictor. It implements all Week 1 deliverables for Member 1: dataset inspection, graph modeling, Cypher constraints and indexes, idempotent ETL scripts, operational Cypher query libraries, cross-member integration contracts, and multi-source future planning.

---

## 1. Directory Structure

```
database/
├── README.md                           # This document: architecture, guide & manual setup
├── schema.cypher                       # Formal Graph DDL specification
├── constraints.cypher                  # Cypher 5.x constraints and performance indexes
├── import_sectivia.cypher              # Pure Cypher LOAD CSV idempotent import script
├── queries.cypher                      # 20+ operational, ripple trace & bottleneck queries
│
├── scripts/
│   ├── inspect_data.py                 # Comprehensive raw dataset audit & schema inspector
│   └── import_data.py                  # Production-grade Python CLI importer (dry-run & live)
│
├── docs/
│   ├── database_schema.md              # Detailed property graph schema & types
│   ├── data_dictionary.md              # Complete taxonomy & field-level documentation
│   ├── integration_contract.md         # API/Cypher contract for Members 2, 3, and 4
│   └── inspection_report.json          # Machine-readable output of raw dataset audit
│
├── datasets/
│   ├── sectivia/
│   │   ├── raw/                        # Untouched raw baseline files
│   │   │   ├── sectivia-companies.csv     # 382 companies
│   │   │   ├── sectivia-relations.csv     # 556 relationships
│   │   │   └── sectivia-supply-chain.json # Metadata, sectors & segments
│   │   └── source_info.md              # Provenance, license (CC BY 4.0), audit findings
│   │
│   └── anonnet/
│       └── import_plan.md              # Cambridge SCAIL dataset inspection & future plan
│
└── tests/
    └── test_database_scripts.py        # Automated test suite for parsers & integrity
```

---

## 2. Core Graph Model

* **Node Label**: `:Company`
* **Node Identifier**: `sectivia:<id>` (e.g. `sectivia:aapl`, `sectivia:qcom`, `sectivia:spacex`)
* **Relationship**: `(:Company)-[:SUPPLIES_TO]->(:Company)`
* **Directional Semantics**:
  $$\text{Supplier} \xrightarrow{\text{SUPPLIES\_TO}} \text{Customer}$$
  Directed flow of components, raw materials, energy, and services from upstream suppliers to downstream buyers.
* **Baseline Scale**: 382 companies (381 public, 1 private [SpaceX]), 556 verified commercial contracts, 162 cross-sector connections across 8 industrial sectors.

---

## 3. Quickstart & Verification (Sandboxed / Local)

### Step 1: Run Raw Dataset Inspection
Audits the raw Sectivia CSV and JSON files for schema validity, nulls, duplicates, and referential integrity:
```bash
python database/scripts/inspect_data.py
```

### Step 2: Run Import in Safe Dry-Run Mode
Validates both CSV files, verifies referential links, tests type conversions, and reports batch metrics without touching any database:
```bash
python database/scripts/import_data.py --dry-run
```

### Step 3: Run Automated Test Suite
Executes unit tests verifying CSV parsing, quoted comma handling, private entity parsing, and schema invariant assertions:
```bash
pytest database/tests/ -v
```

---

## 4. How to Run Against Neo4j Desktop (`atmograph` Database)

Follow these manual steps to connect and import into your existing **Neo4j Desktop** instance:

### Step 4.1: Ensure DBMS is Running & Create Database
1. Open **Neo4j Desktop**.
2. Select your Project and start your active DBMS (Neo4j 5.x recommended).
3. Open the **Neo4j Browser** or click **Terminal** (cypher-shell).
4. If the `atmograph` database does not yet exist, create and switch to it:
   ```cypher
   CREATE DATABASE atmograph IF NOT EXISTS;
   :use atmograph;
   ```

### Step 4.2: Option A — Live Import via Python CLI (Recommended)
The Python importer supports batching, connection testing, and automated credential discovery:

1. Ensure requirements are installed:
   ```bash
   pip install neo4j python-dotenv
   ```
2. Configure credentials in your root `.env` file (never commit actual passwords):
   ```env
   NEO4J_URI=bolt://localhost:7687
   NEO4J_USERNAME=neo4j
   NEO4J_PASSWORD=your_actual_password
   NEO4J_DATABASE=atmograph
   ```
3. Run the import with the `--execute` flag:
   ```bash
   python database/scripts/import_data.py --execute --database atmograph
   ```

### Step 4.3: Option B — Pure Cypher Native Import (`LOAD CSV`)
If you prefer running purely inside Neo4j Desktop or `cypher-shell`:

1. Copy the raw CSV files into your DBMS `import` directory:
   - In Neo4j Desktop, click the three dots (`...`) next to your DBMS $\to$ **Open folder** $\to$ **Import**.
   - Copy `database/datasets/sectivia/raw/sectivia-companies.csv` and `sectivia-relations.csv` into this folder.
2. In Neo4j Browser, ensure you are on database `atmograph` (`:use atmograph`).
3. Run the queries from [database/import_sectivia.cypher](file:///d:/AtmoGraph/database/import_sectivia.cypher).

---

## 5. Live Database Verification & Import Status

> [!NOTE]
> **Week 1 Milestone Completed**: The Sectivia baseline graph has been imported and verified against the live Neo4j Desktop DBMS instance **Atmograph** on database **`atmograph`**.

### Verified Live Metrics
* **Total Company Nodes**: `382` (381 publicly listed on NASDAQ/NYSE, 1 private entity [SpaceX])
* **Total SUPPLIES_TO Relationships**: `556` (100% referential integrity, 0 ghosts)
* **Cross-Sector Dependency Flows**: `162` (inter-industry linkages)
* **Orphan Nodes**: `0` (all companies participate in supply chain paths)
* **Database Name**: `atmograph`

### Live Cypher Verification Queries
Run these verification queries in Neo4j Browser to audit the imported graph:

```cypher
// 1. Verify Company Node Count (Expected: 382)
MATCH (c:Company)
RETURN 'Companies' AS Metric, count(c) AS ActualCount, 382 AS ExpectedCount;

// 2. Verify SUPPLIES_TO Relationship Count (Expected: 556)
MATCH ()-[r:SUPPLIES_TO]->()
RETURN 'Relationships' AS Metric, count(r) AS ActualCount, 556 AS ExpectedCount;

// 3. Verify Cross-Sector Relationships (Expected: 162)
MATCH ()-[r:SUPPLIES_TO {is_cross_sector: true}]->()
RETURN 'Cross-Sector Flows' AS Metric, count(r) AS ActualCount, 162 AS ExpectedCount;

// 4. Verify Private Company SpaceX Attributes
MATCH (c:Company {id: 'sectivia:spacex'})
RETURN c.id, c.name, c.ticker, c.exchange, c.listed, c.relations_count;
// Expected: ticker: null, exchange: null, listed: false, relations_count: 5

// 5. Verify Zero Orphan Nodes
MATCH (c:Company)
WHERE NOT (c)-[:SUPPLIES_TO]-()
RETURN count(c) AS OrphanNodeCount;
// Expected: 0
```

---

## 6. Security & Credentials Policy

* **No Hardcoded Passwords**: All scripts read credentials dynamically via environment variables or CLI flags (`--password`).
* **Masked Logs**: The importer automatically masks passwords in terminal outputs (e.g. `p***d`).
* **Destructive Change Protection**: Destructive database operations (`DROP`, `DETACH DELETE`) are never executed automatically. Live mutations require the explicit `--execute` flag.

---

## 7. Disruption Ground-Truth Disclaimer

> [!IMPORTANT]
> The Sectivia dataset contains **real-world commercial relationships and regulatory filing citations (SEC 10-K, 8-K)**.
> 
> However, it contains **ZERO empirical disruption ground-truth labels** (e.g., failure flags, outage dates, or delay statistics).
> 
> All disruption propagation features, bottleneck risk ratings, and cascade simulation figures developed by Member 3 (GNN) or rendered by Member 4 (Frontend) are **SYNTHETIC / SIMULATED** and must remain clearly labelled as such.

---

## 8. Multi-Member Integration

For complete API contracts, query interfaces, and expected data schemas, see [docs/integration_contract.md](file:///d:/AtmoGraph/database/docs/integration_contract.md):
- **Member 2 (NLP)**: Cypher queries for ticker, name, and alias entity resolution from unstructured news feeds.
- **Member 3 (GNN)**: Deterministic node feature and edge-index extraction queries for PyTorch Geometric (`torch_geometric.data.Data`).
- **Member 4 (Frontend)**: Ego-network subgraphs, multi-hop ripple propagation paths, and bottleneck analytics payloads for Cytoscape.js / React Flow visualizations.
