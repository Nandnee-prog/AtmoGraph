// ==============================================================================
// ATMOGRAPH - NEO4J DATABASE CONSTRAINTS
// Database: atmograph
// Target: Neo4j 5.x / 2025+
// Description: Uniqueness constraints ensuring entity integrity.
// ==============================================================================

// 1. Unique Company Identity Constraint
// Ensures each company node has a unique canonical identifier (e.g., 'sectivia:aapl', 'sectivia:spacex')
CREATE CONSTRAINT company_id_unique IF NOT EXISTS
FOR (c:Company)
REQUIRE c.id IS UNIQUE;
