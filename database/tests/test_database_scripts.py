"""
Unit and integration tests for Member 1 Neo4j database scripts and schemas.
Runs via pytest in standard Python environment.
"""

import sys
from pathlib import Path
import pytest

# Add project root and database/scripts to path to support both IDE and direct execution
DB_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = DB_DIR.parent
SCRIPTS_DIR = DB_DIR / "scripts"

for p in (str(PROJECT_ROOT), str(SCRIPTS_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from database.scripts.inspect_data import inspect_sectivia
    from database.scripts.import_data import (
        parse_and_validate_companies,
        parse_and_validate_relations,
    )
except ImportError:
    from inspect_data import inspect_sectivia  # type: ignore
    from import_data import (  # type: ignore
        parse_and_validate_companies,
        parse_and_validate_relations,
    )


@pytest.fixture
def raw_dataset_dir() -> Path:
    raw_dir = DB_DIR / "datasets" / "sectivia" / "raw"
    assert raw_dir.exists(), f"Raw dataset directory missing at {raw_dir}"
    return raw_dir


def test_companies_parsing(raw_dataset_dir):
    comp_file = raw_dataset_dir / "sectivia-companies.csv"
    companies, valid_ids = parse_and_validate_companies(comp_file)

    assert len(companies) == 382, f"Expected 382 companies, got {len(companies)}"
    assert len(valid_ids) == 382, "All company IDs must be unique"

    # Verify ID format
    for c in companies:
        assert c["id"].startswith("sectivia:"), f"Invalid ID namespace: {c['id']}"
        assert c["data_source"] == "sectivia"
        assert isinstance(c["listed"], bool)
        assert isinstance(c["relations_count"], int)

    # Check SpaceX (private company edge case)
    spacex = next((c for c in companies if c["raw_id"] == "spacex"), None)
    assert spacex is not None, "SpaceX must be present in companies"
    assert spacex["ticker"] is None, "SpaceX ticker must be None (not public)"
    assert spacex["exchange"] is None, "SpaceX exchange must be None"
    assert spacex["listed"] is False, "SpaceX must have listed=False"
    assert spacex["sector"] == "forsvar"
    assert spacex["sector_name"] == "Defense, security & space"


def test_relations_parsing_and_referential_integrity(raw_dataset_dir):
    comp_file = raw_dataset_dir / "sectivia-companies.csv"
    rel_file = raw_dataset_dir / "sectivia-relations.csv"

    _, valid_ids = parse_and_validate_companies(comp_file)
    relations = parse_and_validate_relations(rel_file, valid_ids)

    assert len(relations) == 556, f"Expected 556 relations, got {len(relations)}"

    cross_sector = [r for r in relations if r["is_cross_sector"]]
    assert len(cross_sector) == 162, f"Expected 162 cross-sector relations, got {len(cross_sector)}"

    # Check that quoted commas were parsed properly in 'what' and 'source'
    quotes_in_what = [r for r in relations if "," in r["what"]]
    assert len(quotes_in_what) > 0, "Quoted commas in 'what' must be preserved"

    quotes_in_source = [r for r in relations if "," in r["source"]]
    assert len(quotes_in_source) > 0, "Quoted commas in 'source' must be preserved"

    # Verify referential integrity: no missing or ghost endpoints
    for r in relations:
        assert r["supplier_id"] in valid_ids
        assert r["customer_id"] in valid_ids
        assert r["supplier_id"] != r["customer_id"], "Self-loops not allowed"


def test_no_real_disruption_labels(raw_dataset_dir):
    report = inspect_sectivia(raw_dataset_dir)
    disruption_check = report["disruption_labels_check"]

    assert disruption_check["contains_real_disruption_labels"] is False
    assert len(disruption_check["potential_fields_found"]) == 0


def test_cypher_files_exist():
    assert (DB_DIR / "schema.cypher").exists()
    assert (DB_DIR / "constraints.cypher").exists()
    assert (DB_DIR / "import_sectivia.cypher").exists()
    assert (DB_DIR / "queries.cypher").exists()


if __name__ == "__main__":
    sys.exit(pytest.main([str(Path(__file__)), "-v"]))
