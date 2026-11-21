// ==============================================================================
// AtmoGraph - Sectivia Dataset Import Script (Pure Cypher / LOAD CSV)
// Component: Member 1 - Graph Database Foundation
// Compatibility: Neo4j 5.x / Neo4j Desktop / cypher-shell
// Database: atmograph
//
// PREREQUISITES FOR NEO4J DESKTOP:
// 1. Copy `sectivia-companies.csv` and `sectivia-relations.csv` into your DBMS `import` directory:
//    Windows path: %USERPROFILE%\.Neo4jDesktop\relate-data\dbmss\<dbms-id>\import\
// 2. Select database `atmograph` (or active database).
// 3. Execute this script in Neo4j Browser or via cypher-shell:
//    cypher-shell -u <username> -p <password> -d atmograph -f database/import_sectivia.cypher
// ==============================================================================

// ------------------------------------------------------------------------------
// STEP 1: CREATE CONSTRAINTS AND INDEXES
// ------------------------------------------------------------------------------

CREATE CONSTRAINT constraint_company_unique_id IF NOT EXISTS
FOR (c:Company) REQUIRE c.id IS UNIQUE;

CREATE INDEX index_company_ticker IF NOT EXISTS
FOR (c:Company) ON (c.ticker);

CREATE INDEX index_company_name IF NOT EXISTS
FOR (c:Company) ON (c.name);

CREATE INDEX index_company_raw_id IF NOT EXISTS
FOR (c:Company) ON (c.raw_id);

CREATE INDEX index_company_sector IF NOT EXISTS
FOR (c:Company) ON (c.sector);

CREATE INDEX index_company_segment IF NOT EXISTS
FOR (c:Company) ON (c.segment);

CREATE INDEX index_company_country IF NOT EXISTS
FOR (c:Company) ON (c.country);

CREATE INDEX index_company_listed IF NOT EXISTS
FOR (c:Company) ON (c.listed);

CREATE INDEX index_supplies_to_cross_sector IF NOT EXISTS
FOR ()-[r:SUPPLIES_TO]-() ON (r.is_cross_sector);

CREATE INDEX index_supplies_to_datasource IF NOT EXISTS
FOR ()-[r:SUPPLIES_TO]-() ON (r.data_source);

// ------------------------------------------------------------------------------
// STEP 2: LOAD COMPANIES
// ------------------------------------------------------------------------------
// Source: sectivia-companies.csv (382 rows)
// Uses MERGE on namespaced identifier `sectivia:<id>` to guarantee idempotency.
// ------------------------------------------------------------------------------

LOAD CSV WITH HEADERS FROM 'file:///sectivia-companies.csv' AS row
WITH row,
  CASE row.sector
    WHEN 'ai'       THEN 'AI & digital infrastructure'
    WHEN 'energi'   THEN 'Energy, grid & critical infrastructure'
    WHEN 'forsvar'  THEN 'Defense, security & space'
    WHEN 'medicin'  THEN 'Life science'
    WHEN 'finans'   THEN 'Banks, payments & capital markets'
    WHEN 'industri' THEN 'Industrials & reshoring'
    WHEN 'elbil'    THEN 'EVs & batteries'
    WHEN 'raavarer' THEN 'Materials & critical minerals'
    ELSE trim(row.sector)
  END AS sector_name_mapped
WHERE row.id IS NOT NULL AND trim(row.id) <> ''
MERGE (c:Company { id: 'sectivia:' + trim(row.id) })
SET
  c.raw_id          = trim(row.id),
  c.ticker          = CASE WHEN row.ticker IS NOT NULL AND trim(row.ticker) <> '' THEN trim(row.ticker) ELSE null END,
  c.name            = trim(row.name),
  c.exchange        = CASE WHEN row.exchange IS NOT NULL AND trim(row.exchange) <> '' THEN trim(row.exchange) ELSE null END,
  c.country         = trim(row.country),
  c.sector          = trim(row.sector),
  c.sector_name     = sector_name_mapped,
  c.segment         = trim(row.segment),
  c.listed          = toBoolean(trim(row.listed)),
  c.relations_count = toInteger(trim(row.relations)),
  c.data_source     = 'sectivia',
  c.updated_at      = datetime();

// ------------------------------------------------------------------------------
// STEP 3: LOAD RELATIONSHIPS
// ------------------------------------------------------------------------------
// Source: sectivia-relations.csv (556 rows)
// Semantics: (Supplier)-[:SUPPLIES_TO]->(Customer)
// ------------------------------------------------------------------------------

LOAD CSV WITH HEADERS FROM 'file:///sectivia-relations.csv' AS row
WHERE row.supplier_id IS NOT NULL AND trim(row.supplier_id) <> ''
  AND row.customer_id IS NOT NULL AND trim(row.customer_id) <> ''
MATCH (supplier:Company { id: 'sectivia:' + trim(row.supplier_id) })
MATCH (customer:Company { id: 'sectivia:' + trim(row.customer_id) })
MERGE (supplier)-[r:SUPPLIES_TO]->(customer)
SET
  r.what             = trim(row.what),
  r.source           = trim(row.source),
  r.url              = trim(row.url),
  r.sector           = CASE WHEN row.sector IS NOT NULL AND trim(row.sector) <> '' THEN trim(row.sector) ELSE null END,
  r.supplier_sector  = trim(row.supplier_sector),
  r.customer_sector  = trim(row.customer_sector),
  r.supplier_segment = trim(row.supplier_segment),
  r.customer_segment = trim(row.customer_segment),
  r.is_cross_sector  = (trim(row.supplier_sector) <> trim(row.customer_sector)),
  r.data_source      = 'sectivia',
  r.updated_at       = datetime();

// ------------------------------------------------------------------------------
// STEP 4: VERIFICATION & AUDIT
// ------------------------------------------------------------------------------

// Verification 1: Node count (Expected: 382)
MATCH (c:Company)
RETURN 'Companies Imported' AS Metric, count(c) AS ActualCount, 382 AS ExpectedCount;

// Verification 2: Relationship count (Expected: 556)
MATCH ()-[r:SUPPLIES_TO]->()
RETURN 'Relationships Imported' AS Metric, count(r) AS ActualCount, 556 AS ExpectedCount;

// Verification 3: Cross-sector relationship count (Expected: 162)
MATCH ()-[r:SUPPLIES_TO {is_cross_sector: true}]->()
RETURN 'Cross-Sector Relationships' AS Metric, count(r) AS ActualCount, 162 AS ExpectedCount;

// Verification 4: Listed vs Private breakdown
MATCH (c:Company)
RETURN c.listed AS IsPubliclyListed, count(c) AS CompanyCount
ORDER BY IsPubliclyListed DESC;
