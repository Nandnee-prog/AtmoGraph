# AtmoGraph Data Dictionary: Sectivia U.S. Supply-Chain Graph

## 1. Overview & Dataset Profile

The primary dataset ingested into AtmoGraph is the **Sectivia U.S. Supply-Chain Graph** (assembled by Sectivia, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)). The dataset comprises manually audited commercial relationships between major corporations operating in the United States, compiled directly from public regulatory disclosures:
- SEC EDGAR annual 10-K filings (Supplier lists, major customer concentration disclosures)
- SEC EDGAR 8-K statements (Material commercial agreements and partnership announcements)
- Official corporate supplier lists (e.g., Apple Supplier List)
- Verified trade press and corporate press releases

### Dataset Summary Metrics
* **Total Companies**: 382
* **Publicly Listed Companies**: 381
* **Private Companies**: 1 (SpaceX / `id: spacex`)
* **Total Relationships**: 556
* **Intra-Sector Relationships**: 394
* **Cross-Sector Relationships**: 162
* **Sectors**: 8 distinct industries
* **Sub-Industry Segments**: 61 granular classifications

---

## 2. Sector Taxonomy Dictionary

Sectivia's underlying database uses Danish identifier codes for sector taxonomy. The AtmoGraph schema preserves the original code in `sector` while augmenting each node and relationship with normalized, human-readable English names in `sector_name`:

| Sector Code (`sector`) | English Name (`sector_name`) | Meaning / Description | Company Count | Sample Companies |
| :--- | :--- | :--- | :---: | :--- |
| `ai` | AI & digital infrastructure | Hyperscalers, cloud platforms, semiconductor design, foundry equipment, optical networking. | 114 | Apple, Microsoft, NVIDIA, Amazon, Qualcomm, Broadcom |
| `energi` | Energy, grid & critical infrastructure | Utilities, power generation, grid transmission, nuclear, renewable power. | 39 | NextEra Energy, Ameren, AES, GE Vernova, Constellation Energy |
| `forsvar` | Defense, security & space | Defense prime contractors, avionics, aerospace components, launch systems. | 38 | Lockheed Martin, RTX, Northrop Grumman, SpaceX, AeroVironment |
| `medicin` | Life science | Pharmaceuticals, biotechnology, active pharmaceutical ingredients (API), distribution. | 47 | Pfizer, AbbVie, McKesson, Eli Lilly, Alnylam Pharmaceuticals |
| `finans` | Banks, payments & capital markets | Custodians, payment networks, investment banks, asset managers. | 34 | JPMorgan Chase, Visa, Mastercard, Goldman Sachs, Apollo Global |
| `industri` | Industrials & reshoring | Capital goods, heavy equipment, automation, commercial vehicle manufacturing. | 52 | Caterpillar, PACCAR, Honeywell, Cummins, Rockwell Automation |
| `elbil` | EVs & batteries | Electric vehicle OEMs, battery chemistry, cells, charging networks. | 27 | Tesla, Rivian, Albemarle (lithium), Amprius Technologies |
| `raavarer` | Materials & critical minerals | Rare earths, industrial gases, specialty chemicals, mining, steel. | 31 | Air Products, Linde, Freeport-McMoRan, Nucor |

---

## 3. Entity Dictionary: Company Nodes

### `id`
- **Definition**: Stable primary key within AtmoGraph Neo4j database.
- **Format**: `sectivia:<raw_id>` (e.g. `sectivia:aapl`, `sectivia:msft`, `sectivia:spacex`).
- **Data Type**: `STRING`
- **Validation**: Unique, non-null, lowercase alphanumeric characters.

### `raw_id`
- **Definition**: Raw identifier from the source CSV.
- **Format**: Lowercase alphanumeric string matching company ticker or common brand abbreviation.
- **Data Type**: `STRING`

### `ticker`
- **Definition**: Official public stock ticker symbol.
- **Data Type**: `STRING` or `null`
- **Special Case**: For private firms (e.g., SpaceX), this value is `null`. Do not write `"N/A"` or empty strings.

### `name`
- **Definition**: Formal commercial name of the company.
- **Data Type**: `STRING`
- **Example**: `"Apple"`, `"Agilent Technologies"`, `"SpaceX"`.

### `exchange`
- **Definition**: The primary stock exchange where the company's equity is traded.
- **Allowed Values**: `"NASDAQ"`, `"NYSE"`, `"CBOE"`, or `null`.
- **Special Case**: `null` for private companies (SpaceX).

### `country`
- **Definition**: Country where the company is headquartered or incorporated.
- **Data Type**: `STRING` (ISO country name or standard abbreviation, e.g. `"USA"`, `"Ireland"`).

### `sector`
- **Definition**: Sector taxonomy key (see Section 2).
- **Data Type**: `STRING`

### `segment`
- **Definition**: Detailed sub-segment description indicating the company's specific role in the value chain.
- **Data Type**: `STRING`
- **Examples**: `"Chips & accelerators"`, `"Cloud platforms"`, `"Mining & critical minerals"`, `"Big pharma"`.

### `listed`
- **Definition**: Boolean flag denoting whether the entity is publicly traded.
- **Data Type**: `BOOLEAN` (`true` for 381 companies, `false` for SpaceX).

### `relations_count`
- **Definition**: Total degree (supplier + customer links) reported in the Sectivia baseline.
- **Data Type**: `INTEGER`

---

## 4. Relationship Dictionary: `[:SUPPLIES_TO]`

Edges represent directed supply-chain flow: `(Supplier:Company)-[:SUPPLIES_TO]->(Customer:Company)`.

### `what`
- **Definition**: Concrete description of what good, component, or commercial service is provided.
- **Data Type**: `STRING`
- **Examples**:
  - `"Instinct MI350 GPUs and EPYC CPUs for Dell PowerEdge servers"`
  - `"Commercial supply of siRNA active ingredient (API) for Alnylam medicines"`
  - `"Battery-grade lithium hydroxide for about 3 million future Ford EV batteries"`

### `source`
- **Definition**: Regulatory or official document citation establishing evidence for the relationship.
- **Data Type**: `STRING`
- **Examples**: `"Apple 10-K, November 2026"`, `"AMD 8-K, February 2026"`, `"Astera Labs 8-K, February 2026"`.

### `url`
- **Definition**: Direct web link to the official SEC EDGAR filing or corporate announcement.
- **Data Type**: `STRING` (HTTP / HTTPS URL)
- **Provenance Rule**: Every edge in Sectivia must link back to a primary audit source.

### `sector`
- **Definition**: Sector category if both supplier and customer belong to the same sector.
- **Data Type**: `STRING` or `null`
- **Special Handling**: In 162 cross-sector edges, this column is blank in the raw CSV. In Neo4j, store as `null` rather than empty string.

### `supplier_sector` & `customer_sector`
- **Definition**: Sector taxonomy codes of the upstream supplier and downstream customer respectively.
- **Data Type**: `STRING`

### `supplier_segment` & `customer_segment`
- **Definition**: Detailed industry segments of supplier and customer.
- **Data Type**: `STRING`

### `is_cross_sector`
- **Definition**: Computed boolean indicating whether this relationship bridges two distinct industry sectors.
- **Data Type**: `BOOLEAN` (`true` if `supplier_sector != customer_sector`, else `false`).

---

## 5. Audit & Disruption Truth Grounding

> [!IMPORTANT]
> **Absence of Real Disruption Labels**:
> The Sectivia dataset establishes verified, real-world supply chain **topology** and **provenance**. It does **NOT** contain real disruption ground truth (e.g. failure flags, incident dates, or operational outage numbers).
>
> All disruption simulations, ripple effect models, and downstream failure probabilities generated by Member 2 (NLP News Event Extractor) and Member 3 (GNN Disruption Propagation) are **SYNTHETIC / SIMULATED** and must be strictly tagged as such in all database writes and frontend visualizations.
