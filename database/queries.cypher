// ==============================================================================
// AtmoGraph - Cypher Operational & Inspection Queries
// Component: Member 1 - Graph Database Foundation
// Compatibility: Neo4j 5.x / AuraDB / Neo4j Desktop
// Database: atmograph
// ==============================================================================

// ==============================================================================
// 1. DATABASE HEALTH & INTEGRITY CHECKS
// ==============================================================================

// 1.1 Total graph topology metrics
MATCH (c:Company)
WITH count(c) AS totalCompanies
OPTIONAL MATCH ()-[r:SUPPLIES_TO]->()
RETURN
  totalCompanies,
  count(r) AS totalRelationships,
  round(toFloat(count(r)) / toFloat(totalCompanies), 2) AS avgRelationshipsPerCompany;

// 1.2 Orphan node detection (Companies with 0 incoming and 0 outgoing edges)
MATCH (c:Company)
WHERE NOT (c)-[:SUPPLIES_TO]-()
RETURN c.id AS OrphanID, c.ticker AS Ticker, c.name AS Name, c.sector AS Sector;

// 1.3 Self-loop verification (Should return 0 rows)
MATCH (c:Company)-[r:SUPPLIES_TO]->(c)
RETURN c.id, c.name, r.what;

// 1.4 Private company inspection (SpaceX audit)
MATCH (c:Company)
WHERE c.listed = false OR c.ticker IS NULL
RETURN c.id, c.name, c.exchange, c.country, c.sector, c.segment, c.listed;


// ==============================================================================
// 2. COMPANY LOOKUP QUERIES
// ==============================================================================

// 2.1 Lookup company by Ticker (case-insensitive)
MATCH (c:Company)
WHERE toUpper(c.ticker) = 'NVDA'
RETURN c;

// 2.2 Lookup company by exact or fuzzy Name
MATCH (c:Company)
WHERE toLower(c.name) CONTAINS toLower('Apple')
RETURN c.id, c.ticker, c.name, c.sector_name, c.segment, c.relations_count;

// 2.3 List all companies in a specific sector
MATCH (c:Company {sector: 'ai'})
RETURN c.ticker, c.name, c.segment, c.relations_count
ORDER BY c.relations_count DESC;


// ==============================================================================
// 3. DIRECT (1-HOP) SUPPLY CHAIN INSPECTION
// ==============================================================================

// 3.1 Who supplies to Apple (AAPL)? (Immediate Tier-1 Suppliers)
MATCH (supplier:Company)-[r:SUPPLIES_TO]->(apple:Company {ticker: 'AAPL'})
RETURN
  supplier.ticker AS SupplierTicker,
  supplier.name AS SupplierName,
  supplier.segment AS SupplierSegment,
  r.what AS SuppliedProduct,
  r.source AS SourceCitation
ORDER BY supplier.name ASC;

// 3.2 Who does NVIDIA (NVDA) supply to? (Immediate Tier-1 Customers)
MATCH (nvda:Company {ticker: 'NVDA'})-[r:SUPPLIES_TO]->(customer:Company)
RETURN
  customer.ticker AS CustomerTicker,
  customer.name AS CustomerName,
  customer.segment AS CustomerSegment,
  r.what AS SuppliedProduct,
  r.source AS SourceCitation
ORDER BY customer.name ASC;


// ==============================================================================
// 4. MULTI-TIER SUPPLY CHAIN & RIPPLE PATH TRACES
// ==============================================================================

// 4.1 Upstream 2-Tier Dependency Tree (Suppliers of Suppliers)
// Trace what Tier-2 suppliers feed into Apple through its direct Tier-1 suppliers
MATCH path = (tier2:Company)-[:SUPPLIES_TO]->(tier1:Company)-[:SUPPLIES_TO]->(target:Company {ticker: 'AAPL'})
WHERE tier2 <> target
RETURN
  tier2.ticker AS Tier2Supplier,
  tier2.name AS Tier2Name,
  tier1.ticker AS Tier1Supplier,
  target.ticker AS TargetCustomer,
  [rel in relationships(path) | rel.what] AS SupplyChainContracts
LIMIT 25;

// 4.2 Downstream 2-Tier Disruption Ripple Path
// If Nvidia (NVDA) has an operational delay, which direct customers and second-tier customers are affected?
MATCH path = (origin:Company {ticker: 'NVDA'})-[:SUPPLIES_TO]->(directCustomer:Company)-[:SUPPLIES_TO]->(tier2Customer:Company)
WHERE origin <> tier2Customer
RETURN
  origin.ticker AS DisruptedOrigin,
  directCustomer.ticker AS ImpactedDirectCustomer,
  tier2Customer.ticker AS ImpactedSecondDegreeCustomer,
  [rel in relationships(path) | rel.what] AS AffectedFlows
LIMIT 25;

// 4.3 Deepest Ripple Trace: Variable-length upstream path search (1 to 3 hops)
MATCH path = (s:Company)-[:SUPPLIES_TO*1..3]->(target:Company {ticker: 'MSFT'})
WHERE s <> target
RETURN path
LIMIT 50;


// ==============================================================================
// 5. BOTTLENECK & CENTRALITY ANALYSIS
// ==============================================================================

// 5.1 Critical Hubs: Top 10 Suppliers with highest customer count (Out-degree)
MATCH (s:Company)-[r:SUPPLIES_TO]->()
WITH s, count(r) AS OutDegree
RETURN
  s.ticker AS Ticker,
  s.name AS CompanyName,
  s.sector_name AS Sector,
  s.segment AS Segment,
  OutDegree AS TotalCustomersSupplied
ORDER BY TotalCustomersSupplied DESC
LIMIT 10;

// 5.2 Top 10 Customers with highest supplier dependency (In-degree)
MATCH ()-[r:SUPPLIES_TO]->(c:Company)
WITH c, count(r) AS InDegree
RETURN
  c.ticker AS Ticker,
  c.name AS CompanyName,
  c.sector_name AS Sector,
  c.segment AS Segment,
  InDegree AS TotalSuppliersReliedUpon
ORDER BY TotalSuppliersReliedUpon DESC
LIMIT 10;

// 5.3 High-Intermediary Companies (Both heavy supplier and heavy customer)
MATCH (upstream:Company)-[:SUPPLIES_TO]->(hub:Company)-[:SUPPLIES_TO]->(downstream:Company)
WITH hub, count(DISTINCT upstream) AS inCount, count(DISTINCT downstream) AS outCount
RETURN
  hub.ticker AS Ticker,
  hub.name AS HubName,
  hub.segment AS Segment,
  inCount AS DirectSuppliers,
  outCount AS DirectCustomers,
  (inCount * outCount) AS VulnerabilityCrossIndex
ORDER BY VulnerabilityCrossIndex DESC
LIMIT 10;


// ==============================================================================
// 6. CROSS-SECTOR DEPENDENCY MATRIX
// ==============================================================================

// 6.1 Aggregated Cross-Sector Dependency Matrix
// Shows which sectors critically feed into which other sectors
MATCH (s:Company)-[r:SUPPLIES_TO]->(c:Company)
RETURN
  s.sector AS SupplierSectorCode,
  s.sector_name AS SupplierSector,
  c.sector AS CustomerSectorCode,
  c.sector_name AS CustomerSector,
  count(r) AS FlowCount,
  collect(DISTINCT s.ticker + '->' + c.ticker)[..5] AS SamplePairs
ORDER BY FlowCount DESC;

// 6.2 Filter exclusively cross-sector relationships (Inter-industry reliance)
MATCH (s:Company)-[r:SUPPLIES_TO {is_cross_sector: true}]->(c:Company)
RETURN
  s.name + ' (' + s.sector + ')' AS Supplier,
  c.name + ' (' + c.sector + ')' AS Customer,
  r.what AS WhatSupplied,
  r.source AS Evidence
LIMIT 20;


// ==============================================================================
// 7. ALTERNATIVE SUPPLIER / RESILIENCE DISCOVERY
// ==============================================================================

// 7.1 Find potential backup suppliers in the same segment as an existing supplier
// Example: If a supplier to Apple fails, who else operates in that exact segment?
MATCH (s:Company)-[:SUPPLIES_TO]->(cust:Company {ticker: 'AAPL'})
MATCH (alt:Company {segment: s.segment})
WHERE alt <> s AND alt <> cust
RETURN
  s.ticker AS CurrentSupplier,
  s.name AS CurrentSupplierName,
  s.segment AS SharedSegment,
  collect(DISTINCT alt.ticker + ' (' + alt.name + ')') AS AlternativeSuppliersInSegment
LIMIT 10;


// ==============================================================================
// 8. SHORTEST PATH & TOPOLOGY CYCLES
// ==============================================================================

// 8.1 Shortest supply path between any two companies (e.g. Nvidia [NVDA] to Ford [F] via Tesla)
MATCH (origin:Company {ticker: 'NVDA'}), (target:Company {ticker: 'F'})
MATCH path = shortestPath((origin)-[:SUPPLIES_TO*..6]->(target))
RETURN path;

// 8.2 Cycle / Feedback loop detection
// Checks if company A supplies B who supplies ... who supplies A
MATCH path = (a:Company)-[:SUPPLIES_TO*2..5]->(a)
RETURN path
LIMIT 10;
