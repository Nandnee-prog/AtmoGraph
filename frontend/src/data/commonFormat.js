/**
 * AtmoGraph Multi-Dataset Common Data Contract Specification
 *
 * Version: 2.0.0 (Week 2 Multi-Dataset Generalization)
 * Standardized across Members 1, 2, 3, and 4
 *
 * Supported Datasets & Topologies:
 * 1. Sectivia: Real-company commercial relationships (SEC EDGAR disclosures)
 * 2. Synthetic: Infrastructure and disruption simulation
 * 3. AnonNet: Anonymized scalability benchmark
 *
 * Invariants & Architectural Rules:
 * - Deterministic dataset namespaces: 'sectivia:', 'synthetic:', 'anonnet:'
 * - Universal node fields guaranteed across all datasets
 * - Dataset-specific optional extensions preserved
 * - 100% backwards compatibility with Week 1 Sectivia contracts
 */

// ============================================================================
// 1. DATASET SOURCES & NAMESPACES
// ============================================================================

export const DATASET_SOURCES = {
  SECTIVIA: "sectivia",
  SYNTHETIC: "synthetic",
  ANONNET: "anonnet",
};

export const DATASET_ID_PREFIXES = {
  [DATASET_SOURCES.SECTIVIA]: "sectivia:",
  [DATASET_SOURCES.SYNTHETIC]: "synthetic:",
  [DATASET_SOURCES.ANONNET]: "anonnet:",
};

// ============================================================================
// 2. UNIVERSAL COMMON CONTRACTS
// ============================================================================

/**
 * Universal Node Schema Definition
 */
export const UNIVERSAL_NODE_SCHEMA = {
  version: "2.0.0",
  requiredFields: [
    "id",
    "raw_id",
    "name",
    "dataset_source",
    "primary_group",
    "risk_score",
  ],
  datasetSources: Object.values(DATASET_SOURCES),
  datasetPrefixes: DATASET_ID_PREFIXES,
};

/**
 * Universal Relationship Schema Definition
 */
export const UNIVERSAL_RELATIONSHIP_SCHEMA = {
  version: "2.0.0",
  requiredFields: [
    "id",
    "source",
    "target",
    "type",
    "dataset_source",
  ],
  datasetSources: Object.values(DATASET_SOURCES),
};

// ============================================================================
// 3. BACKWARD-COMPATIBLE SECTIVIA SCHEMAS (Week 1 Baseline)
// ============================================================================

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
    "raavarer",
  ],
  allowedCountries: ["USA", "Ireland", "United Kingdom"],
  totalBaselineCompanies: 382,
};

export const RELATIONSHIP_SCHEMA_DEFINITION = {
  version: "1.0.0",
  type: "SUPPLIES_TO",
  directionalSemantics: "supplier_to_customer",
  totalBaselineRelationships: 556,
  totalCrossSectorRelationships: 162,
};

// ============================================================================
// 4. NORMALIZATION FUNCTIONS (Safe, Non-Mutating)
// ============================================================================

/**
 * Normalizes a raw node from any supported dataset into the universal format.
 * Guarantees immutability: returns a new object without mutating input.
 * Explicitly handles missing risk_score (returns null; NEVER invents scores).
 *
 * @param {Object} rawNode - Raw node object from API or dataset
 * @param {string} [defaultSource="sectivia"] - Fallback dataset source
 * @returns {Object|null} Normalized universal node or null if invalid input
 */
export function normalizeNode(rawNode, defaultSource = DATASET_SOURCES.SECTIVIA) {
  if (!rawNode || typeof rawNode !== "object") return null;

  const dataset_source = (
    rawNode.dataset_source ||
    rawNode.data_source ||
    defaultSource
  ).toLowerCase();

  const raw_id =
    rawNode.raw_id !== undefined && rawNode.raw_id !== null
      ? String(rawNode.raw_id)
      : rawNode.node_id !== undefined && rawNode.node_id !== null
        ? String(rawNode.node_id)
        : rawNode.id !== undefined && rawNode.id !== null
          ? String(rawNode.id).replace(/^(sectivia|synthetic|anonnet):/, "")
          : "unknown";

  // Ensure canonical namespaced ID
  const expectedPrefix =
    DATASET_ID_PREFIXES[dataset_source] || `${dataset_source}:`;
  let id = rawNode.id ? String(rawNode.id) : null;
  if (!id || !id.startsWith(expectedPrefix)) {
    id = `${expectedPrefix}${raw_id}`;
  }

  const name = String(rawNode.name || rawNode.label || raw_id);

  // Dynamic primary grouping based on dataset classification dimension
  let primary_group = "general";
  if (rawNode.primary_group) {
    primary_group = String(rawNode.primary_group);
  } else if (dataset_source === DATASET_SOURCES.SECTIVIA) {
    primary_group = String(rawNode.sector || rawNode.segment || "general");
  } else if (dataset_source === DATASET_SOURCES.SYNTHETIC) {
    primary_group = String(
      rawNode.facility_type || rawNode.node_type || rawNode.industry || "facility"
    );
  } else if (dataset_source === DATASET_SOURCES.ANONNET) {
    primary_group =
      rawNode.cluster_id !== undefined && rawNode.cluster_id !== null
        ? `cluster-${rawNode.cluster_id}`
        : "cluster-0";
  } else {
    primary_group = String(
      rawNode.sector || rawNode.industry || rawNode.node_type || "general"
    );
  }

  // Risk score handling: DO NOT INVENT! Handle missing risk scores explicitly.
  let risk_score = null;
  if (
    rawNode.risk_score !== undefined &&
    rawNode.risk_score !== null &&
    rawNode.risk_score !== ""
  ) {
    const parsed = parseFloat(rawNode.risk_score);
    risk_score = Number.isFinite(parsed)
      ? Math.min(Math.max(parsed, 0.0), 1.0)
      : null;
  }

  // Construct non-mutating copy with universal fields
  const normalized = {
    ...rawNode,
    id,
    raw_id,
    name,
    dataset_source,
    primary_group,
    risk_score,
  };

  // Support dataset-specific optional attributes
  if (dataset_source === DATASET_SOURCES.SECTIVIA) {
    normalized.ticker = rawNode.ticker ?? null;
    normalized.exchange = rawNode.exchange ?? null;
    normalized.listed =
      rawNode.listed !== undefined ? Boolean(rawNode.listed) : true;
    normalized.segment = rawNode.segment ?? primary_group;
    normalized.relations_count =
      typeof rawNode.relations_count === "number" ? rawNode.relations_count : 0;
    normalized.sector = rawNode.sector ?? primary_group;
  } else if (dataset_source === DATASET_SOURCES.SYNTHETIC) {
    normalized.facility_type =
      rawNode.facility_type ?? rawNode.node_type ?? null;
    normalized.region = rawNode.region ?? null;
  } else if (dataset_source === DATASET_SOURCES.ANONNET) {
    normalized.cluster_id = rawNode.cluster_id ?? null;
    normalized.degree =
      typeof rawNode.degree === "number" ? rawNode.degree : null;
  }

  return normalized;
}

/**
 * Normalizes a raw relationship from any supported dataset into the universal format.
 * Guarantees immutability: returns a new object without mutating input.
 *
 * @param {Object} rawRel - Raw relationship object
 * @param {string} [defaultSource="sectivia"] - Fallback dataset source
 * @returns {Object|null} Normalized universal relationship or null if invalid
 */
export function normalizeRelationship(
  rawRel,
  defaultSource = DATASET_SOURCES.SECTIVIA
) {
  if (!rawRel || typeof rawRel !== "object") return null;

  const dataset_source = (
    rawRel.dataset_source ||
    rawRel.data_source ||
    defaultSource
  ).toLowerCase();

  const expectedPrefix =
    DATASET_ID_PREFIXES[dataset_source] || `${dataset_source}:`;

  let source = rawRel.source ? String(rawRel.source) : "";
  if (source && !source.includes(":") && !source.startsWith(expectedPrefix)) {
    source = `${expectedPrefix}${source}`;
  }

  let target = rawRel.target ? String(rawRel.target) : "";
  if (target && !target.includes(":") && !target.startsWith(expectedPrefix)) {
    target = `${expectedPrefix}${target}`;
  }

  const id = rawRel.id
    ? String(rawRel.id)
    : `rel-${source}->${target}`;

  const type =
    rawRel.type ||
    (dataset_source === DATASET_SOURCES.SECTIVIA
      ? "SUPPLIES_TO"
      : dataset_source === DATASET_SOURCES.SYNTHETIC
        ? "SUPPLIES_FACILITY"
        : "EDGE");

  const normalized = {
    ...rawRel,
    id,
    source,
    target,
    type,
    dataset_source,
  };

  // Support dataset-specific optional relationship attributes
  if (dataset_source === DATASET_SOURCES.SECTIVIA) {
    normalized.what = rawRel.what ?? "";
    normalized.source_citation =
      rawRel.source_citation ?? (typeof rawRel.source === "string" ? rawRel.source : "");
    normalized.source_url = rawRel.source_url ?? null;
    normalized.is_cross_sector = Boolean(rawRel.is_cross_sector);
  } else if (dataset_source === DATASET_SOURCES.SYNTHETIC) {
    normalized.route_type = rawRel.route_type ?? null;
    normalized.lead_time_days =
      rawRel.lead_time_days !== undefined && rawRel.lead_time_days !== null
        ? parseFloat(rawRel.lead_time_days)
        : null;
    normalized.capacity =
      rawRel.capacity !== undefined && rawRel.capacity !== null
        ? parseFloat(rawRel.capacity)
        : null;
  } else if (dataset_source === DATASET_SOURCES.ANONNET) {
    normalized.weight =
      rawRel.weight !== undefined && rawRel.weight !== null
        ? parseFloat(rawRel.weight)
        : null;
  }

  return normalized;
}

// ============================================================================
// 5. UNIVERSAL VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates a node object against the universal common schema
 * @param {Object} node
 * @returns {boolean}
 */
export function isValidNode(node) {
  if (!node || typeof node !== "object") return false;

  const validSource =
    typeof node.dataset_source === "string" &&
    Object.values(DATASET_SOURCES).includes(node.dataset_source);

  if (!validSource) return false;

  const expectedPrefix = DATASET_ID_PREFIXES[node.dataset_source];

  return (
    typeof node.id === "string" &&
    node.id.length > 0 &&
    Boolean(node.id.startsWith(expectedPrefix)) &&
    node.raw_id !== undefined &&
    node.raw_id !== null &&
    typeof node.name === "string" &&
    node.name.length > 0 &&
    typeof node.primary_group === "string" &&
    node.primary_group.length > 0 &&
    (node.risk_score === null ||
      (typeof node.risk_score === "number" &&
        !isNaN(node.risk_score) &&
        node.risk_score >= 0.0 &&
        node.risk_score <= 1.0))
  );
}

/**
 * Validates a relationship object against the universal common schema
 * @param {Object} rel
 * @returns {boolean}
 */
export function isValidUniversalRelationship(rel) {
  if (!rel || typeof rel !== "object") return false;

  const validSource =
    typeof rel.dataset_source === "string" &&
    Object.values(DATASET_SOURCES).includes(rel.dataset_source);

  if (!validSource) return false;

  const expectedPrefix = DATASET_ID_PREFIXES[rel.dataset_source];

  return (
    typeof rel.id === "string" &&
    rel.id.length > 0 &&
    typeof rel.source === "string" &&
    rel.source.length > 0 &&
    Boolean(rel.source.startsWith(expectedPrefix)) &&
    typeof rel.target === "string" &&
    rel.target.length > 0 &&
    Boolean(rel.target.startsWith(expectedPrefix)) &&
    typeof rel.type === "string" &&
    rel.type.length > 0
  );
}

// ============================================================================
// 6. BACKWARD-COMPATIBLE SECTIVIA VALIDATORS (Week 1 Baseline)
// ============================================================================

/**
 * Validates a company object against the AtmoGraph Sectivia common schema
 * Retained for 100% backward compatibility with Week 1 Member 1 contracts.
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
 * Validates a relationship object against the AtmoGraph Sectivia schema
 * Retained for 100% backward compatibility with Week 1 Member 1 contracts.
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
