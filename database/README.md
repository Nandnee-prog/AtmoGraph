# AtmoGraph - Neo4j Graph Database Foundation (Member 1)

This repository directory contains the **Neo4j graph database foundation** for the AtmoGraph supply chain ripple effect predictor. It provides dataset inspection, property graph modeling, Cypher constraints and indexes, idempotent ETL loaders, operational Cypher query libraries, cross-member integration contracts, and automated test suites for Week 1.

---

## 1. Directory Structure

```
database/
├── README.md                           # Architecture overview, setup & execution guide
├── schema.cypher                       # Graph DDL specification (nodes, relationships, types)
├── constraints.cypher                  # Cypher 5.x uniqueness constraints
├── indexes.cypher                      # Performance lookup indexes
├── queries.cypher                      # 15 operational & analytical Cypher queries
│
├── datasets/
│   └── sectivia/
│       ├── raw/                        # Untouched raw baseline files
│       │   ├── sectivia-companies.csv     # 382 companies
│       │   ├── sectivia-relations.csv     # 556 relationships
│       │   └── sectivia-supply-chain.json # Metadata, sectors & segments
│       └── processed/                  # Normalized CSV and JSON graph artifacts
│
├── scripts/
│   ├── inspect_data.py                 # Comprehensive raw dataset auditor & report generator
│   ├── preprocess_data.py              # Data cleaning and canonical ID formatter
│   ├── import_data.py                  # Official Neo4j Python driver importer (dry-run & live)
│   └── verify_database.py              # Automated database invariant auditor
│
├── docs/
│   ├── database_schema.md              # Detailed property graph schema specification
│   ├── data_dictionary.md              # Complete taxonomy and field-level documentation
│   ├── inspection_report.json          # Machine-readable output of raw dataset audit
│   └── integration_contract.md         # API/Cypher contracts for Members 2, 3, and 4
│
└── tests/
    └── test_database.py                # Automated Pytest test suite
```

---

## 2. Core Graph Model

* **Node Label**: `:Company`
* **Canonical Identifier**: `sectivia:<id>` (e.g., `'sectivia:aapl'`, `'sectivia:qcom'`, `'sectivia:spacex'`)
* **Relationship**: `(:Company)-[:SUPPLIES_TO]->(:Company)`
* **Directional Semantics**:
  $$\text{Supplier} \xrightarrow{\text{SUPPLIES\_TO}} \text{Customer}$$
  Upstream component and service deliveries flow along the edge from suppliers to customer manufacturers.
* **Baseline Verified Metrics**:
  * **382 Company Nodes** (381 public, 1 private entity [SpaceX])
  * **556 Commercial Relationships** (100% referential integrity, 0 dangling endpoints)
  * **162 Cross-Sector Linkages** across 8 industrial sectors

---

## 3. Quickstart & Verification (Local / Sandboxed)

### Step 1: Run Raw Dataset Inspection
Audits the raw Sectivia CSV and JSON files for schema validity, nulls, duplicates, and referential integrity, generating `database/docs/inspection_report.json`:
```bash
python database/scripts/inspect_data.py
```

### Step 2: Run Data Preprocessing
Validates and cleans records, adding canonical identifiers and exporting to `database/datasets/sectivia/processed/`:
```bash
python database/scripts/preprocess_data.py
```

### Step 3: Run Safe Dry-Run Import
Validates both CSV files, verifies referential links, tests batching, and reports metrics without mutating any database:
```bash
python database/scripts/import_data.py --dry-run
```

### Step 4: Run Automated Test Suite
Executes the comprehensive Pytest suite:
```bash
pytest database/tests/test_database.py -v
```

---

## 4. Connecting & Importing into Neo4j Desktop (`atmograph` Database)

### 4.1 Ensure DBMS is Running & Database Exists
1. Open **Neo4j Desktop**.
2. Select your Project and start your DBMS.
3. Open **Neo4j Browser** or **cypher-shell**.
4. Verify or create the `atmograph` database:
   ```cypher
   CREATE DATABASE atmograph IF NOT EXISTS;
   :use atmograph;
   ```

### 4.2 Configure Environment Variables
Set your credentials in a `.env` file in the project root (never committed to Git):
```env
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_actual_password
NEO4J_DATABASE=atmograph
```

### 4.3 Execute Live Import
Run the production importer with the `--execute` flag:
```bash
python database/scripts/import_data.py --execute --database atmograph
```

### 4.4 Audit Live Database
Run the verification script to audit live graph metrics against Sectivia ground-truth figures:
```bash
python database/scripts/verify_database.py --database atmograph
```

---

## 5. Security & Credentials Policy

* **Strict Protection of Credentials:** Passwords are never hardcoded. All scripts read credentials dynamically from environment variables or masked CLI parameters.
* **Zero Secret Leakage:** `.env` is explicitly ignored by `.gitignore`.
* **Idempotency Guarantee:** All mutations use Cypher `MERGE` and unique constraints. Running imports repeatedly produces identical node and relationship counts without duplicates.

---

## 6. Disruption Ground-Truth Disclaimer

> [!IMPORTANT]
> The Sectivia dataset contains **real-world commercial relationships and regulatory filing citations (SEC 10-K, 8-K)**.
> However, it contains **zero empirical disruption ground-truth labels** (e.g., failure flags, outage dates, or delay statistics).
> All disruption propagation features, bottleneck risk ratings, and cascade simulation figures developed by Member 3 (GNN) or rendered by Member 4 (Frontend) are **SYNTHETIC / SIMULATED** and must remain clearly labelled as such.
