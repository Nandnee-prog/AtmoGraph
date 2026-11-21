// ==============================================================================
// AtmoGraph - Neo4j Graph Database Schema (Cypher DDL Specification)
// Component: Member 1 - Graph Database Foundation
// Dataset: Sectivia U.S. Supply-Chain Graph (Primary Baseline)
// Target DBMS: Neo4j 5.x / Neo4j AuraDB / Neo4j Desktop
// Database Name: atmograph
// ==============================================================================

// ------------------------------------------------------------------------------
// 1. NODE DEFINITIONS
// ------------------------------------------------------------------------------

/**
 * Node Label: :Company
 * Represents any corporate entity or organization participating in the supply chain.
 *
 * Properties:
 *   id              : STRING (Primary Key, namespaced e.g. "sectivia:aapl")
 *   raw_id          : STRING (Source ID e.g. "aapl")
 *   ticker          : STRING (Stock symbol e.g. "AAPL"; null for private companies)
 *   name            : STRING (Company legal/trading name e.g. "Apple")
 *   exchange        : STRING (Stock exchange e.g. "NASDAQ", "NYSE"; null for private)
 *   country         : STRING (Country of headquarters e.g. "USA", "Ireland")
 *   sector          : STRING (Sector taxonomy code e.g. "ai", "energi", "forsvar")
 *   sector_name     : STRING (Human-readable English sector name)
 *   segment         : STRING (Industry sub-segment e.g. "Devices & electronics manufacturing")
 *   listed          : BOOLEAN (true if publicly listed, false if private)
 *   relations_count : INTEGER (Total relationships documented in source dataset)
 *   data_source     : STRING ("sectivia")
 *   created_at      : DATETIME (Timestamp when record was ingested)
 */

// ------------------------------------------------------------------------------
// 2. RELATIONSHIP DEFINITIONS
// ------------------------------------------------------------------------------

/**
 * Relationship Type: [:SUPPLIES_TO]
 * Directed edge representing goods, components, energy, or services flowing from
 * an upstream Supplier to a downstream Customer.
 *
 * Syntax: (:Company)-[:SUPPLIES_TO]->(:Company)
 *
 * Directional Semantics:
 *   (Supplier:Company)-[:SUPPLIES_TO]->(Customer:Company)
 *   Upstream -> Downstream
 *   Supply shock ripples downstream from Supplier to Customer.
 *
 * Properties:
 *   what             : STRING (Commercial description of what is supplied)
 *   source           : STRING (Citation e.g. "Apple 10-K, November 2026")
 *   url              : STRING (SEC EDGAR archive URL or official press release URL)
 *   sector           : STRING (Sector code if intra-sector; null if cross-sector)
 *   supplier_sector  : STRING (Upstream supplier sector code)
 *   customer_sector  : STRING (Downstream customer sector code)
 *   supplier_segment : STRING (Upstream supplier segment)
 *   customer_segment : STRING (Downstream customer segment)
 *   is_cross_sector  : BOOLEAN (true if supplier_sector != customer_sector)
 *   data_source      : STRING ("sectivia")
 *   created_at       : DATETIME (Timestamp when relationship was ingested)
 */

// ------------------------------------------------------------------------------
// 3. SCHEMA GOVERNANCE & TAXONOMY REFERENCE
// ------------------------------------------------------------------------------
// Sectivia Sector Codes & English Mappings:
//   'ai'       -> 'AI & digital infrastructure'
//   'energi'   -> 'Energy, grid & critical infrastructure'
//   'forsvar'  -> 'Defense, security & space'
//   'medicin'  -> 'Life science'
//   'finans'   -> 'Banks, payments & capital markets'
//   'industri' -> 'Industrials & reshoring'
//   'elbil'    -> 'EVs & batteries'
//   'raavarer' -> 'Materials & critical minerals'
//
// Special Node Reference:
//   SpaceX ('sectivia:spacex') is private (listed: false), exchange: null, ticker: null.
// ==============================================================================
