# AtmoGraph - Cross-Member Integration Contract

**Document Version:** 1.0.0 (Week 1 Delivery)  
**Author:** Member 1 (Neo4j Graph Database Development)  
**Consumers:**
* **Member 2:** NLP & News Ingestion Pipeline
* **Member 3:** GNN & Ripple Effect Prediction Engine
* **Member 4:** Frontend Visualization & Interactive Dashboard

---

## 1. Member 2 (NLP) Integration Contract: Entity Resolution & Ingestion

Member 2 ingests raw news feeds and regulatory filings, extracting company mentions and matching them to graph entities.

### 1.1 Resolution by Exact Ticker
```cypher
MATCH (c:Company)
WHERE toUpper(c.ticker) = toUpper($ticker)
RETURN c.id AS entity_id, c.name AS official_name, c.sector AS sector, c.country AS country;
```

### 1.2 Resolution by Fuzzy / Substring Name Match
```cypher
MATCH (c:Company)
WHERE toLower(c.name) CONTAINS toLower($extracted_name)
   OR toLower($extracted_name) CONTAINS toLower(c.name)
RETURN c.id AS entity_id, c.name AS official_name, c.ticker AS ticker, c.sector AS sector
LIMIT 5;
```

### 1.3 Expected Payload Schema for Member 2 Ingestion
When Member 2 discovers a disruption event, it passes the resolved `entity_id` to downstream GNN/API services:
```json
{
  "entity_id": "sectivia:aapl",
  "ticker": "AAPL",
  "disruption_type": "FACTORY_FIRE",
  "severity_score": 0.85,
  "confidence": 0.92,
  "source_headline": "Key assembly plant halts operations following severe industrial fire",
  "timestamp": "2026-11-22T10:00:00Z"
}
```

---

## 2. Member 3 (GNN) Integration Contract: Graph Export for PyG

Member 3 develops the PyTorch Geometric (`torch_geometric`) Graph Neural Network for cascade prediction.

### 2.1 Exporting Node Feature Matrix ($X$)
Extracts indexed nodes with one-hot encoded or categorized features (sector, country, segment, degree):
```cypher
MATCH (c:Company)
OPTIONAL MATCH (c)-[out_r:SUPPLIES_TO]->()
OPTIONAL MATCH ()-[in_r:SUPPLIES_TO]->(c)
WITH c, count(DISTINCT out_r) AS out_degree, count(DISTINCT in_r) AS in_degree
RETURN c.id AS node_id,
       c.name AS name,
       c.sector AS sector,
       c.segment AS segment,
       c.country AS country,
       c.listed AS listed,
       out_degree,
       in_degree
ORDER BY c.id;
```

### 2.2 Exporting Edge Index Tensor ($E \in \mathbb{R}^{2 \times M}$)
Returns directed supplier-to-customer edges formatted for PyG edge_index:
```cypher
MATCH (s:Company)-[r:SUPPLIES_TO]->(c:Company)
RETURN s.id AS source_node_id,
       c.id AS target_node_id,
       r.is_cross_sector AS cross_sector_flag,
       r.supplier_sector AS supplier_sector,
       r.customer_sector AS customer_sector
ORDER BY s.id, c.id;
```

### 2.3 GNN Data Invariants Guaranteed by Member 1:
1. Deterministic Node Ordering: Node IDs are immutable and prefixed (`sectivia:<id>`).
2. Graph Connectivity: 0 orphan nodes. All 382 nodes belong to weakly connected components.
3. Edge Referential Integrity: 100% of edges connect valid node IDs; no index out-of-bounds in PyG tensors.

---

## 3. Member 4 (Frontend) Integration Contract: Graph Visualization

Member 4 renders interactive graphs using Cytoscape.js or React Flow.

### 3.1 Ego-Network Query (1-Hop & 2-Hop Neighborhood)
```cypher
MATCH path = (root:Company {id: $company_id})-[:SUPPLIES_TO*1..2]-(neighbor:Company)
WITH nodes(path) AS ns, relationships(path) AS rels
UNWIND ns AS n
WITH collect(DISTINCT {
  data: {
    id: n.id,
    label: n.name,
    ticker: n.ticker,
    sector: n.sector,
    country: n.country,
    is_root: (n.id = $company_id)
  }
}) AS elements_nodes, rels
UNWIND rels AS r
RETURN elements_nodes AS nodes,
       collect(DISTINCT {
         data: {
           id: id(r),
           source: startNode(r).id,
           target: endNode(r).id,
           label: r.what,
           is_cross_sector: r.is_cross_sector
         }
       }) AS edges;
```

### 3.2 Ripple Propagation Simulation Query
Given an origin node failure, retrieves downstream cascading nodes ranked by propagation hop:
```cypher
MATCH path = (origin:Company {id: $origin_id})-[:SUPPLIES_TO*1..3]->(target:Company)
RETURN length(path) AS hop_depth,
       [node IN nodes(path) | {id: node.id, name: node.name, ticker: node.ticker}] AS path_sequence,
       target.id AS impacted_id,
       target.name AS impacted_name,
       target.sector AS impacted_sector
ORDER BY hop_depth, target.name;
```

---

## 4. Multi-Dataset Extensibility (Week 2+ Roadmap)

* **Prefixing Standard:** All entities use namespaced IDs:
  * `sectivia:<id>` (Week 1)
  * `anonnet:<id>` (Planned Week 2)
  * `synthetic:<id>` (Planned Week 3)
* **Federated Queries:** Future datasets can be filtered or merged using `c.dataset_source` without breaking Member 2, 3, or 4 contracts.
