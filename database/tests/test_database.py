#!/usr/bin/env python3
"""
AtmoGraph - Automated Test Suite (Member 1 - Graph Foundation)
Tests dataset parsing, referential integrity, SpaceX private company anomaly,
cross-sector metrics, Cypher file syntax, and importer dry-run execution.
Run with: pytest database/tests/test_database.py -v
"""

import json
from pathlib import Path
import pytest
import pandas as pd

from database.scripts.inspect_data import find_raw_dir, audit_companies, audit_relations, audit_json
from database.scripts.preprocess_data import preprocess_sectivia
from database.scripts.import_data import (
    get_raw_files,
    prepare_company_records,
    prepare_relation_records,
    run_dry_run,
)


@pytest.fixture(scope="module")
def raw_paths():
    comp_file, rel_file = get_raw_files()
    raw_dir = comp_file.parent
    json_file = raw_dir / "sectivia-supply-chain.json"
    return comp_file, rel_file, json_file


def test_raw_files_exist(raw_paths):
    comp_file, rel_file, json_file = raw_paths
    assert comp_file.exists(), "sectivia-companies.csv is missing"
    assert rel_file.exists(), "sectivia-relations.csv is missing"
    assert json_file.exists(), "sectivia-supply-chain.json is missing"


def test_companies_count_and_columns(raw_paths):
    comp_file, _, _ = raw_paths
    df = pd.read_csv(comp_file)
    assert len(df) == 382, f"Expected 382 companies, found {len(df)}"
    assert df["id"].nunique() == 382, "Company IDs must be strictly unique"
    
    expected_cols = ["id", "ticker", "name", "exchange", "country", "sector", "segment", "listed", "relations"]
    for col in expected_cols:
        assert col in df.columns, f"Missing expected column in companies: {col}"


def test_spacex_private_entity_handling(raw_paths):
    comp_file, _, _ = raw_paths
    df = pd.read_csv(comp_file)
    spacex = df[df["id"].str.lower() == "spacex"]
    assert not spacex.empty, "SpaceX record missing from companies"
    row = spacex.iloc[0]
    
    # Private entity invariants
    assert pd.isna(row["ticker"]) or str(row["ticker"]).strip() == "", "SpaceX ticker must be null"
    assert pd.isna(row["exchange"]) or str(row["exchange"]).strip() == "", "SpaceX exchange must be null"
    assert bool(row["listed"]) is False, "SpaceX must have listed = False"
    assert int(row["relations"]) == 5, f"SpaceX relations count expected 5, found {row['relations']}"


def test_relations_count_and_columns(raw_paths):
    _, rel_file, _ = raw_paths
    df = pd.read_csv(rel_file)
    assert len(df) == 556, f"Expected 556 relationships, found {len(df)}"
    
    expected_cols = [
        "supplier_id", "supplier_ticker", "supplier_name",
        "customer_id", "customer_ticker", "customer_name",
        "sector", "supplier_segment", "customer_segment",
        "supplier_sector", "customer_sector", "what", "source", "url"
    ]
    for col in expected_cols:
        assert col in df.columns, f"Missing expected column in relations: {col}"


def test_referential_integrity(raw_paths):
    comp_file, rel_file, _ = raw_paths
    df_comp = pd.read_csv(comp_file)
    df_rel = pd.read_csv(rel_file)
    
    valid_ids = set(df_comp["id"].astype(str))
    supplier_ids = set(df_rel["supplier_id"].astype(str))
    customer_ids = set(df_rel["customer_id"].astype(str))
    
    dangling_suppliers = supplier_ids - valid_ids
    dangling_customers = customer_ids - valid_ids
    
    assert len(dangling_suppliers) == 0, f"Found dangling suppliers: {dangling_suppliers}"
    assert len(dangling_customers) == 0, f"Found dangling customers: {dangling_customers}"


def test_cross_sector_relationships_count(raw_paths):
    _, rel_file, _ = raw_paths
    df = pd.read_csv(rel_file)
    cross_sector_mask = df["supplier_sector"] != df["customer_sector"]
    cross_count = int(cross_sector_mask.sum())
    assert cross_count == 162, f"Expected exactly 162 cross-sector relationships, found {cross_count}"


def test_supply_chain_json_structure(raw_paths):
    _, _, json_file = raw_paths
    with open(json_file, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    assert "sectors" in data and len(data["sectors"]) == 8, "Expected 8 sectors in JSON"
    assert "segments" in data and len(data["segments"]) == 61, "Expected 61 segments in JSON"
    assert "companies" in data and len(data["companies"]) == 382, "Expected 382 companies in JSON"
    assert "relations" in data and len(data["relations"]) == 556, "Expected 556 relations in JSON"
    assert "license" in data, "License metadata missing in JSON"


def test_preprocessor_execution():
    summary = preprocess_sectivia()
    assert summary["total_companies"] == 382
    assert summary["total_relationships"] == 556
    assert summary["cross_sector_relationships"] == 162
    assert summary["referential_integrity_verified"] is True


def test_importer_records_preparation(raw_paths):
    comp_file, rel_file, _ = raw_paths
    comp_records = prepare_company_records(comp_file)
    rel_records = prepare_relation_records(rel_file)
    
    assert len(comp_records) == 382
    assert len(rel_records) == 556
    
    # Check ID prefixing
    assert all(r["id"].startswith("sectivia:") for r in comp_records)
    assert all(r["supplier_id"].startswith("sectivia:") for r in rel_records)
    assert all(r["customer_id"].startswith("sectivia:") for r in rel_records)
    
    # Check SpaceX in prepared records
    spacex_rec = next(r for r in comp_records if r["raw_id"] == "spacex")
    assert spacex_rec["ticker"] is None
    assert spacex_rec["exchange"] is None
    assert spacex_rec["listed"] is False


def test_importer_dry_run():
    result = run_dry_run()
    assert result["status"] == "dry_run_success"
    assert result["companies_validated"] == 382
    assert result["relationships_validated"] == 556
    assert result["cross_sector_validated"] == 162


def test_cypher_files_content():
    files = [
        Path("database/constraints.cypher"),
        Path("database/indexes.cypher"),
        Path("database/schema.cypher"),
        Path("database/queries.cypher"),
    ]
    for p in files:
        assert p.exists(), f"Cypher file missing: {p}"
        content = p.read_text(encoding="utf-8")
        assert len(content.strip()) > 50, f"Cypher file empty or too small: {p}"
        assert "Company" in content, f"Expected 'Company' entity in {p}"
