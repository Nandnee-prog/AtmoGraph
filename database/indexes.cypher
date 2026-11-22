// ==============================================================================
// ATMOGRAPH - NEO4J DATABASE INDEXES
// Database: atmograph
// Target: Neo4j 5.x / 2025+
// Description: Performance indexes supporting fast lookups for NLP entity resolution,
//              GNN feature sampling, and Frontend graph queries.
// ==============================================================================

// 1. Company Name Index (for NLP entity linking and text search)
CREATE INDEX company_name_idx IF NOT EXISTS
FOR (c:Company)
ON (c.name);

// 2. Company Ticker Index (for fast financial ticker lookup e.g. 'AAPL', 'NVDA')
CREATE INDEX company_ticker_idx IF NOT EXISTS
FOR (c:Company)
ON (c.ticker);

// 3. Company Sector Index (for sector-level aggregation and filtering)
CREATE INDEX company_sector_idx IF NOT EXISTS
FOR (c:Company)
ON (c.sector);

// 4. Company Country Index (for geographical risk and jurisdiction filtering)
CREATE INDEX company_country_idx IF NOT EXISTS
FOR (c:Company)
ON (c.country);

// 5. Company Segment Index (for sub-industry and supply chain tier filtering)
CREATE INDEX company_segment_idx IF NOT EXISTS
FOR (c:Company)
ON (c.segment);

// 6. Relationship Cross-Sector Index (for identifying cross-industry vulnerability corridors)
CREATE INDEX supplies_to_cross_sector_idx IF NOT EXISTS
FOR ()-[r:SUPPLIES_TO]-()
ON (r.is_cross_sector);

// 7. Relationship Sector Index (for filtering flows by primary industrial category)
CREATE INDEX supplies_to_sector_idx IF NOT EXISTS
FOR ()-[r:SUPPLIES_TO]-()
ON (r.sector);
