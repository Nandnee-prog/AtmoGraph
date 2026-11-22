// ==============================================================================
// ATMOGRAPH - GRAPH DDL & SCHEMA SPECIFICATION
// Database: atmograph
// Domain: Supply Chain Ripple Effect Predictor
// Dataset: Sectivia (SEC EDGAR 10-K Commercial Supply Relationships)
// ==============================================================================

// ------------------------------------------------------------------------------
// 1. GRAPH TOPOLOGY & DIRECTIONAL SEMANTICS
// ------------------------------------------------------------------------------
// Node Label:
//   (:Company)
//
// Relationship:
//   (:Company)-[:SUPPLIES_TO]->(:Company)
//
// Directional Semantics:
//   Supplier -> Customer
//   Physical & economic flow of goods, microchips, raw materials, or specialized services.
//
// Baseline Entities:
//   - 382 Company nodes (381 public, 1 private entity [SpaceX])
//   - 556 Commercial SUPPLIES_TO relationships
//   - 162 Cross-sector dependency relationships across 8 primary industrial sectors
// ------------------------------------------------------------------------------

// ------------------------------------------------------------------------------
// 2. CONSTRAINTS
// ------------------------------------------------------------------------------
CREATE CONSTRAINT company_id_unique IF NOT EXISTS
FOR (c:Company)
REQUIRE c.id IS UNIQUE;

// ------------------------------------------------------------------------------
// 3. INDEXES
// ------------------------------------------------------------------------------
CREATE INDEX company_name_idx IF NOT EXISTS FOR (c:Company) ON (c.name);
CREATE INDEX company_ticker_idx IF NOT EXISTS FOR (c:Company) ON (c.ticker);
CREATE INDEX company_sector_idx IF NOT EXISTS FOR (c:Company) ON (c.sector);
CREATE INDEX company_country_idx IF NOT EXISTS FOR (c:Company) ON (c.country);
CREATE INDEX company_segment_idx IF NOT EXISTS FOR (c:Company) ON (c.segment);
CREATE INDEX supplies_to_cross_sector_idx IF NOT EXISTS FOR ()-[r:SUPPLIES_TO]-() ON (r.is_cross_sector);
CREATE INDEX supplies_to_sector_idx IF NOT EXISTS FOR ()-[r:SUPPLIES_TO]-() ON (r.sector);

// ------------------------------------------------------------------------------
// 4. PROPERTY GRAPH SCHEMA SPECIFICATION
// ------------------------------------------------------------------------------
// (:Company) Properties:
//   - id:               STRING (Unique, e.g. 'sectivia:aapl', 'sectivia:spacex')
//   - raw_id:           STRING (Original source identifier, e.g. 'aapl', 'spacex')
//   - ticker:           STRING | NULL (Stock ticker symbol, e.g. 'AAPL'; NULL for private entities)
//   - name:             STRING (Full official corporate legal name)
//   - exchange:         STRING | NULL (Stock exchange, e.g. 'NASDAQ', 'NYSE'; NULL for private)
//   - country:          STRING (ISO country code or name, e.g. 'USA')
//   - sector:           STRING (Primary industrial sector, e.g. 'Technology', 'Healthcare')
//   - segment:          STRING (Granular sub-industry segment, e.g. 'Semiconductors')
//   - listed:           BOOLEAN (true for publicly traded, false for private entities)
//   - relations_count:  INTEGER (Reported relationships count from source dataset)
//   - dataset_source:   STRING (Provenance tag: 'sectivia')
//
// [:SUPPLIES_TO] Properties:
//   - supplier_id:      STRING (Canonical ID of supplier entity)
//   - customer_id:      STRING (Canonical ID of customer entity)
//   - sector:           STRING | NULL (Relationship sector classification)
//   - supplier_sector:  STRING (Sector of the upstream supplier company)
//   - customer_sector:  STRING (Sector of the downstream customer company)
//   - supplier_segment: STRING (Segment of the upstream supplier)
//   - customer_segment: STRING (Segment of the downstream customer)
//   - is_cross_sector:  BOOLEAN (true if supplier_sector != customer_sector)
//   - what:             STRING (Description of components, goods, or services delivered)
//   - source:           STRING (Regulatory filing reference, e.g. 'SEC EDGAR 10-K')
//   - source_url:       STRING (Direct URL to SEC EDGAR filing evidence)
//   - dataset_source:   STRING (Provenance tag: 'sectivia')
