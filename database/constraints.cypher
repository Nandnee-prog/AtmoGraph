// ==============================================================================
// AtmoGraph - Neo4j Schema Constraints and Indexes
// Component: Member 1 - Graph Database Foundation
// Compatibility: Neo4j 5.x / AuraDB / Neo4j Desktop
// Database: atmograph
// ==============================================================================

// ------------------------------------------------------------------------------
// 1. UNIQUENESS CONSTRAINTS
// ------------------------------------------------------------------------------

// Enforces primary key uniqueness across all Company nodes (e.g. "sectivia:aapl")
CREATE CONSTRAINT constraint_company_unique_id IF NOT EXISTS
FOR (c:Company)
REQUIRE c.id IS UNIQUE;


// ------------------------------------------------------------------------------
// 2. PERFORMANCE INDEXES
// ------------------------------------------------------------------------------

// Fast lookup by stock ticker (e.g., c.ticker = "AAPL")
// Note: Ticker is sparse because private entities (e.g., SpaceX) do not have a public ticker
CREATE INDEX index_company_ticker IF NOT EXISTS
FOR (c:Company)
ON (c.ticker);

// Fast lookup by company name (exact match and prefix lookups)
CREATE INDEX index_company_name IF NOT EXISTS
FOR (c:Company)
ON (c.name);

// Fast lookup / filtering by raw source identifier (e.g., c.raw_id = "aapl")
CREATE INDEX index_company_raw_id IF NOT EXISTS
FOR (c:Company)
ON (c.raw_id);

// Filtering by sector category (e.g., c.sector = "ai")
CREATE INDEX index_company_sector IF NOT EXISTS
FOR (c:Company)
ON (c.sector);

// Filtering by sub-industry segment (e.g., c.segment = "Chips & accelerators")
CREATE INDEX index_company_segment IF NOT EXISTS
FOR (c:Company)
ON (c.segment);

// Filtering by country of operation/incorporation
CREATE INDEX index_company_country IF NOT EXISTS
FOR (c:Company)
ON (c.country);

// Filtering by public vs private status
CREATE INDEX index_company_listed IF NOT EXISTS
FOR (c:Company)
ON (c.listed);

// Index on relationship properties for fast cross-sector impact queries
CREATE INDEX index_supplies_to_cross_sector IF NOT EXISTS
FOR ()-[r:SUPPLIES_TO]-()
ON (r.is_cross_sector);

// Index on relationship data provenance
CREATE INDEX index_supplies_to_datasource IF NOT EXISTS
FOR ()-[r:SUPPLIES_TO]-()
ON (r.data_source);

// Verification query to list all active constraints and indexes
SHOW CONSTRAINTS;
SHOW INDEXES;
