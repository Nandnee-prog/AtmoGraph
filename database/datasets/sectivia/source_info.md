# Sectivia Dataset Source Information & Provenance

## 1. Metadata Overview

* **Dataset Name**: Sectivia U.S. Supply-Chain Graph
* **Source Organization**: Sectivia
* **Official URL**: [https://sectivia.com/dataset/](https://sectivia.com/dataset/)
* **License**: [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)
* **Attribution**: *Sectivia (https://sectivia.com), CC BY 4.0*
* **Ingestion Target**: AtmoGraph Graph Database (`atmograph`)

---

## 2. Collection Methodology & Provenance

Sectivia's supply chain graph is compiled from primary, public regulatory filings and verified corporate disclosures:

1. **SEC EDGAR Annual Filings (10-K)**:
   - Item 1 (Business Overview): Principal suppliers, sole-source dependencies, and component sourcing agreements.
   - Concentration Disclosures: Customers accounting for $\ge 10\%$ of consolidated net sales.
2. **SEC EDGAR Current Reports (8-K)**:
   - Item 1.01: Entry into a material definitive agreement (joint ventures, major multi-year supply contracts, fab allocations).
3. **Official Corporate Disclosures**:
   - Company-published supplier audits (e.g. Apple's Annual Supplier List, April 2024).
4. **Verified Industry Reporting**:
   - Specialized trade press documenting physical power purchase agreements (PPAs), fab expansions, and defense contracts.

Every single relationship record in `sectivia-relations.csv` includes:
- `what`: Specific commercial product, material, or service supplied.
- `source`: Primary evidence citation with publication date.
- `url`: Direct link to the SEC EDGAR filing archive or source announcement.

---

## 3. Dataset Audit & Verification Findings

An exhaustive automated schema audit was executed against the raw files using `database/scripts/inspect_data.py`:

| Check | Result | Interpretation |
| :--- | :---: | :--- |
| **Total Companies** | 382 | Exactly matches declared count in `sectivia-supply-chain.json`. |
| **Total Relationships** | 556 | Exactly matches declared count in `sectivia-supply-chain.json`. |
| **Duplicate Company IDs** | 0 | Perfect primary key uniqueness on `id`. |
| **Duplicate Tickers** | 0 | All public tickers are unique. |
| **Duplicate Relationships** | 0 | No redundant `(Supplier, Customer)` edge pairs. |
| **Ghost References** | 0 | 100% referential integrity; every `supplier_id` and `customer_id` exists in `sectivia-companies.csv`. |
| **Self-Loops** | 0 | No company supplies to itself (`supplier_id == customer_id`). |
| **Cross-Sector Edges** | 162 | Exactly 162 relationships bridge distinct industry sectors. |
| **Private Companies** | 1 (`spacex`) | SpaceX has `listed: false`, `ticker: null`, `exchange: null`. |
| **Ground-Truth Disruption Labels** | 0 | **No real-world failure, delay, or risk labels exist in the dataset.** |

---

## 4. Caveats & Operational Boundaries

1. **Non-Exhaustive Coverage**: Corporate supply chains are commercially confidential. Public filings reveal primarily material partnerships, major customer dependencies, or public regulatory filings. This graph is an empirical baseline of major industrial relationships, not an exhaustive inventory of all tier-n contracts.
2. **Synthetic Disruption Boundary**: Because real-world disruption logs are proprietary, all shock propagation and risk prediction features in AtmoGraph (Member 3 GNN and Member 4 UI) operate on **synthetic simulations** seeded atop this empirical topology.
