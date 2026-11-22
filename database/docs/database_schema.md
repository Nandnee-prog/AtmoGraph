# AtmoGraph - Neo4j Database Schema Specification

**Role:** Member 1 – Graph Database Development  
**Target DBMS:** Neo4j 5.x / AuraDB  
**Database Name:** `atmograph`  
**Dataset Scope:** Sectivia (Week 1 Baseline)

---

## 1. Graph Model Overview

AtmoGraph models global supply networks as a directed property graph. The Week 1 foundation establishes the physical and commercial flow of goods, specialized components, and services between corporate entities.

```
(:Company {id: 'sectivia:supplier'}) -[:SUPPLIES_TO]-> (:Company {id: 'sectivia:customer'})
```

### Directional Semantics
$$\text{Supplier} \xrightarrow{\text{SUPPLIES\_TO}} \text{Customer}$$
* **Outgoing Edges (`outE`)**: Downstream commercial sales to buyers and manufacturers.
* **Incoming Edges (`inE`)**: Upstream component/service dependencies and tier-1 supplier vulnerabilities.
* **Propagation Direction**: Operational outages, factory shutdowns, and natural disruptions propagate **downstream** along the edge direction:
  $$\text{Disruption at Supplier } A \implies \text{Production Delay at Customer } B$$

---

## 2. Node Schema: `(:Company)`

Represents corporate commercial entities documented in SEC regulatory disclosures.

| Property | Cypher Type | Nullable | Description / Examples |
| :--- | :--- | :--- | :--- |
| `id` | `STRING` | **No** (Unique Key) | Canonical identifier with dataset prefix: `sectivia:<id>` (e.g., `'sectivia:aapl'`, `'sectivia:spacex'`). |
| `raw_id` | `STRING` | **No** | Original lowercase identifier from source dataset (e.g., `'aapl'`, `'spacex'`). |
| `ticker` | `STRING` | Yes | Stock exchange ticker symbol (e.g., `'AAPL'`, `'NVDA'`). `null` for private companies (e.g. SpaceX). |
| `name` | `STRING` | **No** | Full legal corporate entity name (e.g., `'Apple Inc.'`, `'Space Exploration Technologies Corp.'`). |
| `exchange` | `STRING` | Yes | Primary listing exchange (e.g., `'NASDAQ'`, `'NYSE'`). `null` for private companies. |
| `country` | `STRING` | **No** | Country of corporate headquarters / registration (e.g., `'USA'`, `'Taiwan'`, `'Japan'`). |
| `sector` | `STRING` | **No** | Primary industrial sector classification across 8 sectors (e.g., `'Technology'`, `'Healthcare'`). |
| `segment` | `STRING` | **No** | Sub-industry classification across 61 segments (e.g., `'Semiconductors'`, `'Consumer Electronics'`). |
| `listed` | `BOOLEAN` | **No** | `true` if publicly traded on a stock exchange; `false` for private enterprises (SpaceX). |
| `relations_count` | `INTEGER` | **No** | Total verified supply chain commercial relationships reported in regulatory filings. |
| `dataset_source` | `STRING` | **No** | Provenance identifier (`'sectivia'`). Enables multi-dataset federation in later phases. |

---

## 3. Relationship Schema: `[:SUPPLIES_TO]`

Represents documented commercial contracts, supplier agreements, and component delivery flows.

| Property | Cypher Type | Nullable | Description / Examples |
| :--- | :--- | :--- | :--- |
| `supplier_id` | `STRING` | **No** | Canonical identifier of upstream supplier (`'sectivia:<id>'`). |
| `customer_id` | `STRING` | **No** | Canonical identifier of downstream customer (`'sectivia:<id>'`). |
| `sector` | `STRING` | Yes | Relationship sector classification from source. `null` in cross-sector relationships. |
| `supplier_sector` | `STRING` | **No** | Primary sector of supplier company (e.g., `'Technology'`). |
| `customer_sector` | `STRING` | **No** | Primary sector of customer company (e.g., `'Automotive'`). |
| `supplier_segment` | `STRING` | **No** | Specific segment of supplier (e.g., `'Semiconductors'`). |
| `customer_segment` | `STRING` | **No** | Specific segment of customer (e.g., `'Automobile Manufacturers'`). |
| `is_cross_sector` | `BOOLEAN` | **No** | `true` if `supplier_sector != customer_sector` (162 connections). |
| `what` | `STRING` | **No** | Textual description of components, raw materials, software, or services supplied. |
| `source` | `STRING` | **No** | Regulatory filing citation (e.g., `'SEC EDGAR 10-K'`, `'SEC 8-K'`). |
| `source_url` | `STRING` | **No** | Direct URL link to the official SEC EDGAR disclosure filing. |
| `dataset_source` | `STRING` | **No** | Provenance identifier (`'sectivia'`). |

---

## 4. Constraints & Indexes

### Uniqueness Constraints
```cypher
CREATE CONSTRAINT company_id_unique IF NOT EXISTS
FOR (c:Company)
REQUIRE c.id IS UNIQUE;
```

### Lookup & Aggregation Indexes
```cypher
CREATE INDEX company_name_idx IF NOT EXISTS FOR (c:Company) ON (c.name);
CREATE INDEX company_ticker_idx IF NOT EXISTS FOR (c:Company) ON (c.ticker);
CREATE INDEX company_sector_idx IF NOT EXISTS FOR (c:Company) ON (c.sector);
CREATE INDEX company_country_idx IF NOT EXISTS FOR (c:Company) ON (c.country);
CREATE INDEX company_segment_idx IF NOT EXISTS FOR (c:Company) ON (c.segment);
CREATE INDEX supplies_to_cross_sector_idx IF NOT EXISTS FOR ()-[r:SUPPLIES_TO]-() ON (r.is_cross_sector);
CREATE INDEX supplies_to_sector_idx IF NOT EXISTS FOR ()-[r:SUPPLIES_TO]-() ON (r.sector);
```

---

## 5. Invariants & Ground-Truth Baseline

* **Company Nodes:** Exactly `382`
* **Commercial Relationships:** Exactly `556`
* **Cross-Sector Dependency Flows:** Exactly `162`
* **Referential Integrity:** 100% valid. Zero dangling endpoints.
* **Orphan Nodes:** 0. Every company participates in at least one commercial relationship.
