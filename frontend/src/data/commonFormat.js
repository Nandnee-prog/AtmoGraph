/**
 * AtmoGraph Common Data Contract Specification
 *
 * Version: 1.0.0 (Week 1 Baseline)
 * Primary Dataset: Sectivia (SEC EDGAR Regulatory Disclosures)
 * Standardized across Members 1, 2, 3, and 4
 *
 * References:
 * - database/docs/database_schema.md (Member 1 - Neo4j Schema)
 * - database/docs/integration_contract.md (Member 1 - Cross-Member Contracts)
 */

/**
 * 1. Company Node Canonical Schema
 *
 * Guaranteed Invariants from Member 1:
 * - Deterministic immutable ID prefixed with namespace: "sectivia:<raw_id>"
 * - 0 orphan nodes in Sectivia baseline (382 nodes)
 *
 * @typedef {Object} CompanyNode
 * @property {string} id - Canonical unique ID (e.g., 'sectivia:aapl', 'sectivia:nvda')
 * @property {string} raw_id - Original lowercase identifier (e.g., 'aapl', 'nvda')
 * @property {string} name - Official legal corporate name (e.g., 'Apple Inc.')
 * @property {string|null} ticker - Stock exchange ticker symbol (null for private companies like SpaceX)
 * @property {string|null} exchange - Primary exchange (e.g., 'NASDAQ', 'NYSE')
 * @property {string} country - Headquarters / legal registration country ('USA', 'Ireland', 'United Kingdom')
 * @property {string} sector - Primary sector code ('ai', 'energi', 'finans', 'medicin', 'forsvar', 'industri', 'elbil', 'raavarer')
 * @property {string} sectorName - Standardized English sector label
 * @property {string} segment - Sub-industry classification across 61 segments
 * @property {boolean} listed - true for publicly traded companies; false for private
 * @property {number} relations_count - Total verified commercial relationships in SEC filings
 * @property {string} dataset_source - Provenance identifier ('sectivia')
 *
 * Future Extensibility Hooks (Members 2 & 3):
 * @property {number} [risk_score] - Computed vulnerability index [0.0 - 1.0] (Member 3 GNN)
 * @property {string} [risk_tier] - 'low' | 'medium' | 'high'
 * @property {number} [predicted_delay_days] - Downstream delay forecast (Member 3 GNN)
 * @property {Array<Object>} [active_disruptions] - Extracted news disruption events (Member 2 NLP)
 */

export const COMPANY_SCHEMA_DEFINITION = {
  version: "1.0.0",
  primaryKey: "id",
  idPrefix: "sectivia:",
  allowedSectors: [
    "ai",
    "energi",
    "finans",
    "medicin",
    "forsvar",
    "industri",
    "elbil",
    "raavarer"
  ],
  allowedCountries: ["USA", "Ireland", "United Kingdom"],
  totalBaselineCompanies: 382
};

/**
 * 2. Relationship Canonical Schema (:SUPPLIES_TO)
 *
 * Directional Semantics:
 * Supplier (source) ──[SUPPLIES_TO]──> Customer (target)
 * Operational disruptions propagate DOWNSTREAM along the edge direction.
 *
 * @typedef {Object} SuppliesToRelationship
 * @property {string} id - Relationship identifier
 * @property {string} source - Upstream supplier canonical ID ('sectivia:<supplier_id>')
 * @property {string} target - Downstream customer canonical ID ('sectivia:<customer_id>')
 * @property {string} type - 'SUPPLIES_TO'
 * @property {string} supplier_name - Upstream supplier corporate name
 * @property {string} customer_name - Downstream customer corporate name
 * @property {string|null} supplier_ticker - Supplier stock symbol
 * @property {string|null} customer_ticker - Customer stock symbol
 * @property {string} supplier_sector - Sector classification of supplier
 * @property {string} customer_sector - Sector classification of customer
 * @property {string} supplier_segment - Sub-industry of supplier
 * @property {string} customer_segment - Sub-industry of customer
 * @property {boolean} is_cross_sector - true if supplier_sector !== customer_sector (162 connections)
 * @property {string} what - Description of components, raw materials or services supplied
 * @property {string} source - Regulatory citation (e.g., 'Apple 10-K, November 2026')
 * @property {string} source_url - Direct URL link to official SEC EDGAR disclosure filing
 *
 * Future Extensibility Hooks:
 * @property {number} [transit_time_days] - Estimated transit/lead time
 * @property {string} [transport_mode] - 'Maritime' | 'Air' | 'Rail' | 'Road'
 * @property {number} [disruption_propagation_probability] - GNN edge attention weight
 */

export const RELATIONSHIP_SCHEMA_DEFINITION = {
  version: "1.0.0",
  type: "SUPPLIES_TO",
  directionalSemantics: "supplier_to_customer",
  totalBaselineRelationships: 556,
  totalCrossSectorRelationships: 162
};

/**
 * 3. Member 2 (NLP) Disruption Ingestion Contract
 * Defined in database/docs/integration_contract.md § 1.3
 *
 * @typedef {Object} NLPDisruptionEvent
 * @property {string} entity_id - Canonical company ID (e.g., 'sectivia:aapl')
 * @property {string} ticker - Matched ticker symbol ('AAPL')
 * @property {string} disruption_type - Categorized event type ('FACTORY_FIRE', 'STRIKE', 'EXPORT_RESTRICTION', 'PORT_CONGESTION', 'SUPPLY_SHORTAGE')
 * @property {number} severity_score - Float [0.0 - 1.0]
 * @property {number} confidence - Named Entity Recognition confidence [0.0 - 1.0]
 * @property {string} source_headline - Extracted news headline or regulatory note
 * @property {string} timestamp - ISO-8601 timestamp ('2026-11-22T10:00:00Z')
 */

/**
 * 4. Member 3 (GNN) Delay & Cascade Prediction Contract
 * Defined in database/docs/integration_contract.md § 3.2
 *
 * @typedef {Object} GNNRipplePrediction
 * @property {string} origin_id - Disrupted root node ('sectivia:<id>')
 * @property {number} hop_depth - Distance from origin node (1..3)
 * @property {string} impacted_id - Downstream impacted company ID
 * @property {string} impacted_name - Downstream company legal name
 * @property {string} impacted_sector - Downstream company sector
 * @property {number} predicted_delay_days - Predicted production delay days
 * @property {number} cascade_probability - Cascade probability [0.0 - 1.0]
 */

/**
 * Validates a company object against the AtmoGraph common schema
 * @param {Object} company
 * @returns {boolean}
 */
export function isValidCompany(company) {
  if (!company || typeof company !== "object") return false;
  return (
    typeof company.id === "string" &&
    company.id.startsWith(COMPANY_SCHEMA_DEFINITION.idPrefix) &&
    typeof company.name === "string" &&
    company.name.length > 0 &&
    typeof company.sector === "string" &&
    COMPANY_SCHEMA_DEFINITION.allowedSectors.includes(company.sector) &&
    typeof company.country === "string" &&
    typeof company.listed === "boolean" &&
    typeof company.relations_count === "number"
  );
}

/**
 * Validates a relationship object against the AtmoGraph common schema
 * @param {Object} rel
 * @returns {boolean}
 */
export function isValidRelationship(rel) {
  if (!rel || typeof rel !== "object") return false;
  return (
    typeof rel.source === "string" &&
    rel.source.startsWith(COMPANY_SCHEMA_DEFINITION.idPrefix) &&
    typeof rel.target === "string" &&
    rel.target.startsWith(COMPANY_SCHEMA_DEFINITION.idPrefix) &&
    rel.type === "SUPPLIES_TO" &&
    typeof rel.what === "string" &&
    typeof rel.is_cross_sector === "boolean"
  );
}
