# AtmoGraph Multi-Member Integration Contract

This contract defines the operational interface between the **Member 1 Graph Database Foundation** and downstream project components:
- **Member 2**: NLP & News Ingestion (Entity Resolution & Event Linkage)
- **Member 3**: GNN Machine Learning (Graph Extraction & Propagation Modeling)
- **Member 4**: Frontend Dashboard (Graph Visualization & Ripple Inspection)

---

## 1. Core Graph Constants & Invariants

1. **Canonical Node Label**: `:Company`
2. **Canonical Primary Key**: `id` with standard prefix `sectivia:<id>` (e.g., `sectivia:aapl`, `sectivia:qcom`, `sectivia:spacex`).
3. **Primary Relationship**: `(:Company)-[:SUPPLIES_TO]->(:Company)`
   - Direction: `(Supplier)-[:SUPPLIES_TO]->(Customer)` (Physical product & service flow).
4. **Data Provenance**: Every baseline node and edge carries `data_source: 'sectivia'`. Any future data source (e.g. AnonNet, news extracts) will carry distinct source tags (e.g. `data_source: 'anonnet'`, `data_source: 'news_nlp'`).
5. **No Ground-Truth Disruption Labels**: Baseline graph topology is empirical (SEC EDGAR filings); all risk scores, delays, and ripple simulations are **synthetic**.

---

## 2. Contract for Member 2: NLP & News Ingestion

Member 2 extracts supply chain entities and disruption events from unstructured text (RSS feeds, news articles, SEC filings) and links them to graph entities.

### 2.1 Entity Resolution Query
To resolve an extracted company mention from news text to a canonical `:Company` node:

```cypher
// 1. Exact Ticker Match (Fastest)
MATCH (c:Company)
WHERE toUpper(c.ticker) = toUpper($extracted_ticker)
RETURN c.id AS company_id, c.ticker AS ticker, c.name AS name, c.sector AS sector;

// 2. Exact or Normalized Name Match
MATCH (c:Company)
WHERE toLower(c.name) = toLower($extracted_name)
RETURN c.id AS company_id, c.ticker AS ticker, c.name AS name, c.sector AS sector;

// 3. Substring / Token Match (Fallback)
MATCH (c:Company)
WHERE toLower(c.name) CONTAINS toLower($extracted_token)
RETURN c.id AS company_id, c.ticker AS ticker, c.name AS name, c.sector AS sector
LIMIT 5;
```

### 2.2 Writing Extracted Disruption Events
When Member 2 discovers a real-world news event mentioning a company, write it as an `:Event` or `:NewsArticle` node to avoid polluting the core `:Company` properties:

```cypher
MERGE (e:NewsEvent { id: $event_id })
SET
  e.headline     = $headline,
  e.summary      = $summary,
  e.url          = $url,
  e.published_at = datetime($published_at),
  e.sentiment    = $sentiment,
  e.data_source  = 'nlp_pipeline';

WITH e
MATCH (c:Company { id: $resolved_company_id })
MERGE (e)-[r:AFFECTS]->(c)
SET
  r.severity_score = $severity_score,
  r.detected_at    = datetime();
```

---

## 3. Contract for Member 3: GNN Machine Learning Pipeline

Member 3 extracts network topology into PyTorch Geometric (`torch_geometric.data.Data` / `HeteroData`) tensors, performs message-passing simulation, and outputs predicted ripple scores.

### 3.1 Graph Extraction Queries (PyG Data Loader)

#### Query 1: Extract Node Index Mapping & Features
```cypher
MATCH (c:Company)
RETURN
  c.id AS node_id,
  c.raw_id AS raw_id,
  c.ticker AS ticker,
  c.sector AS sector,
  c.segment AS segment,
  c.country AS country,
  c.listed AS is_listed,
  c.relations_count AS catalog_degree
ORDER BY c.id ASC;
```

#### Query 2: Extract Edge Index Tensor
```cypher
MATCH (s:Company)-[r:SUPPLIES_TO]->(t:Company)
RETURN
  s.id AS source_id,
  t.id AS target_id,
  r.is_cross_sector AS is_cross_sector,
  r.supplier_sector AS supplier_sector,
  r.customer_sector AS customer_sector
ORDER BY s.id, t.id;
```

### 3.2 Machine Learning Ground-Truth Invariant
> [!CAUTION]
> Member 3 must **never** treat Sectivia as having historical failure labels. When training GNN models (e.g. GAT / GraphSAGE) or evaluating ripple effects:
> - Initial shock seeds are synthetic (e.g. simulated port strike, wafer fab power outage).
> - Delay labels must be generated via a reproducible stochastic propagation script (e.g., Cascade / SIR simulation).
> - The GNN task is to predict **synthetic propagation depth or delay tier**, not real-world stock performance.

### 3.3 Writing Predicted Simulation Results Back to Neo4j
If Member 3 persists prediction results into Neo4j for visualization by Member 4:

```cypher
MATCH (c:Company { id: $company_id })
SET
  c.synthetic_risk_score  = $predicted_score,
  c.predicted_delay_days  = $predicted_delay,
  c.simulation_run_id     = $run_id,
  c.simulation_timestamp  = datetime();
```

---

## 4. Contract for Member 4: Frontend Dashboard

Member 4 renders interactive network visualizations (Cytoscape / React Flow), bottleneck leaderboards, and ripple impact trees via FastAPI backend endpoints.

### 4.1 Subgraph Retrieval Query (Ego Network)
Used by the frontend to render the local supply neighborhood for a selected company:

```cypher
MATCH (center:Company)
WHERE center.ticker = $ticker OR center.id = $id
OPTIONAL MATCH (supplier:Company)-[r1:SUPPLIES_TO]->(center)
OPTIONAL MATCH (center)-[r2:SUPPLIES_TO]->(customer:Company)
RETURN
  center,
  collect(DISTINCT {
    supplier: supplier,
    edge: r1
  }) AS upstream,
  collect(DISTINCT {
    customer: customer,
    edge: r2
  }) AS downstream;
```

### 4.2 Standard API JSON Payload Format for Frontend
When FastAPI serializes Neo4j query results to the frontend dashboard:

```json
{
  "nodes": [
    {
      "id": "sectivia:aapl",
      "label": "Apple",
      "ticker": "AAPL",
      "sector": "ai",
      "sector_name": "AI & digital infrastructure",
      "segment": "Devices & electronics manufacturing",
      "country": "USA",
      "is_listed": true,
      "risk_score": 0.15,
      "is_synthetic_risk": true
    }
  ],
  "edges": [
    {
      "id": "sectivia:qcom->sectivia:aapl",
      "source": "sectivia:qcom",
      "target": "sectivia:aapl",
      "type": "SUPPLIES_TO",
      "what": "Modem chips and licences",
      "source_citation": "Qualcomm 10-K, November 2026",
      "is_cross_sector": false
    }
  ]
}
```

### 4.3 Multi-Hop Ripple Propagation Query (Simulation View)
Used when a user clicks "Simulate Disruption" on a supplier node:

```cypher
MATCH path = (origin:Company {ticker: $origin_ticker})-[:SUPPLIES_TO*1..3]->(downstream:Company)
RETURN
  origin.ticker AS origin,
  [node in nodes(path) | {id: node.id, ticker: node.ticker, name: node.name}] AS ripple_chain,
  length(path) AS ripple_depth,
  [rel in relationships(path) | rel.what] AS contracts;
```
