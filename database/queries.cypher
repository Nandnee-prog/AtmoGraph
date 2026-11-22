// ==============================================================================
// ATMOGRAPH - VERIFIED CYPHER OPERATIONAL QUERIES
// Database: atmograph
// Deliverables: Week 1 Required Queries + Ripple Tracing & Analytics
// ==============================================================================

// ------------------------------------------------------------------------------
// QUERY 1: Total Company Count (Expected: 382)
// ------------------------------------------------------------------------------
MATCH (c:Company)
RETURN count(c) AS total_companies;

// ------------------------------------------------------------------------------
// QUERY 2: Total SUPPLIES_TO Relationship Count (Expected: 556)
// ------------------------------------------------------------------------------
MATCH ()-[r:SUPPLIES_TO]->()
RETURN count(r) AS total_relationships;

// ------------------------------------------------------------------------------
// QUERY 3: Search Company by Name (Case-Insensitive)
// ------------------------------------------------------------------------------
// Parameter: $name_query (e.g., 'Apple', 'NVIDIA', 'SpaceX')
MATCH (c:Company)
WHERE toLower(c.name) CONTAINS toLower($name_query)
RETURN c.id, c.name, c.ticker, c.sector, c.country, c.listed
ORDER BY c.name
LIMIT 10;

// ------------------------------------------------------------------------------
// QUERY 4: Search Company by Ticker
// ------------------------------------------------------------------------------
// Parameter: $ticker (e.g., 'AAPL', 'NVDA', 'QCOM')
MATCH (c:Company)
WHERE toUpper(c.ticker) = toUpper($ticker)
RETURN c.id, c.name, c.ticker, c.exchange, c.sector, c.country, c.listed;

// ------------------------------------------------------------------------------
// QUERY 5: Find Immediate Suppliers of a Company (Upstream Dependencies)
// ------------------------------------------------------------------------------
// Parameter: $company_id (e.g., 'sectivia:aapl' or $ticker 'AAPL')
MATCH (supplier:Company)-[r:SUPPLIES_TO]->(customer:Company)
WHERE customer.id = $company_id OR customer.ticker = $company_id
RETURN supplier.id AS supplier_id,
       supplier.name AS supplier_name,
       supplier.ticker AS supplier_ticker,
       supplier.sector AS supplier_sector,
       r.what AS supplied_goods,
       r.is_cross_sector AS cross_sector,
       r.source_url AS filing_url
ORDER BY supplier.name;

// ------------------------------------------------------------------------------
// QUERY 6: Find Immediate Customers of a Company (Downstream Revenue Risk)
// ------------------------------------------------------------------------------
// Parameter: $company_id (e.g., 'sectivia:qcom' or $ticker 'QCOM')
MATCH (supplier:Company)-[r:SUPPLIES_TO]->(customer:Company)
WHERE supplier.id = $company_id OR supplier.ticker = $company_id
RETURN customer.id AS customer_id,
       customer.name AS customer_name,
       customer.ticker AS customer_ticker,
       customer.sector AS customer_sector,
       r.what AS supplied_goods,
       r.is_cross_sector AS cross_sector,
       r.source_url AS filing_url
ORDER BY customer.name;

// ------------------------------------------------------------------------------
// QUERY 7: Find Companies by Sector
// ------------------------------------------------------------------------------
// Parameter: $sector (e.g., 'Technology', 'Healthcare', 'Industrials')
MATCH (c:Company)
WHERE toLower(c.sector) = toLower($sector)
RETURN c.id, c.name, c.ticker, c.segment, c.country, c.listed
ORDER BY c.name;

// ------------------------------------------------------------------------------
// QUERY 8: Find Cross-Sector Relationships (Expected Count: 162)
// ------------------------------------------------------------------------------
MATCH (s:Company)-[r:SUPPLIES_TO]->(c:Company)
WHERE r.is_cross_sector = true OR s.sector <> c.sector
RETURN s.name AS supplier_name,
       s.sector AS supplier_sector,
       c.name AS customer_name,
       c.sector AS customer_sector,
       r.what AS products_supplied
ORDER BY s.sector, c.sector
LIMIT 25;

// Count cross-sector flows:
MATCH ()-[r:SUPPLIES_TO {is_cross_sector: true}]->()
RETURN count(r) AS cross_sector_count;

// ------------------------------------------------------------------------------
// QUERY 9: Detect Duplicate Company Identities (Expected: 0 duplicates)
// ------------------------------------------------------------------------------
MATCH (c:Company)
WITH c.id AS id, count(c) AS count_instances
WHERE count_instances > 1
RETURN id, count_instances;

// ------------------------------------------------------------------------------
// QUERY 10: Identify Missing Properties (Audit Nulls / Invariants)
// ------------------------------------------------------------------------------
// Detect companies missing mandatory identifiers or names:
MATCH (c:Company)
WHERE c.id IS NULL OR c.name IS NULL OR c.sector IS NULL
RETURN count(c) AS invalid_mandatory_companies;

// Audit private companies with expected null tickers (e.g. SpaceX):
MATCH (c:Company)
WHERE c.ticker IS NULL
RETURN c.id, c.name, c.listed, c.exchange;

// ------------------------------------------------------------------------------
// QUERY 11: Identify Invalid Relationship Endpoints (Dangling Edges)
// ------------------------------------------------------------------------------
MATCH ()-[r:SUPPLIES_TO]->()
WHERE startNode(r) IS NULL OR endNode(r) IS NULL
RETURN count(r) AS dangling_relationships;

// ------------------------------------------------------------------------------
// QUERY 12: Retrieve Connected Supply-Chain Networks (Ego-Network & Subgraph)
// ------------------------------------------------------------------------------
// Parameter: $company_id (e.g., 'sectivia:aapl'), $hops (1 or 2)
MATCH path = (root:Company {id: $company_id})-[:SUPPLIES_TO*1..2]-(connected:Company)
RETURN path
LIMIT 50;

// ------------------------------------------------------------------------------
// QUERY 13: Top Critical Bottleneck Suppliers (Highest Downstream Out-Degree)
// ------------------------------------------------------------------------------
MATCH (s:Company)-[r:SUPPLIES_TO]->(c:Company)
WITH s, count(r) AS direct_customers, collect(DISTINCT c.sector) AS customer_sectors
RETURN s.id AS supplier_id,
       s.name AS supplier_name,
       s.ticker AS ticker,
       s.sector AS sector,
       direct_customers,
       size(customer_sectors) AS cross_sector_reach
ORDER BY direct_customers DESC
LIMIT 15;

// ------------------------------------------------------------------------------
// QUERY 14: Downstream Ripple Cascade Trace (Multi-Hop Outage Impact)
// ------------------------------------------------------------------------------
// Simulates failure at origin and traces downstream exposure up to 3 hops
// Parameter: $source_company_id (e.g., 'sectivia:aapl')
MATCH path = (origin:Company {id: $source_company_id})-[:SUPPLIES_TO*1..3]->(target:Company)
RETURN [node IN nodes(path) | node.name] AS cascade_chain,
       length(path) AS ripple_depth,
       target.name AS impacted_company,
       target.sector AS impacted_sector
ORDER BY ripple_depth, target.name;

// ------------------------------------------------------------------------------
// QUERY 15: Cross-Sector Exposure Matrix (Sector to Sector Dependency Count)
// ------------------------------------------------------------------------------
MATCH (s:Company)-[r:SUPPLIES_TO]->(c:Company)
RETURN s.sector AS supplier_sector,
       c.sector AS customer_sector,
       count(r) AS flow_count,
       (s.sector <> c.sector) AS is_cross_sector
ORDER BY flow_count DESC;
