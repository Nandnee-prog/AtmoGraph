# AtmoGraph - Data Dictionary

**Dataset:** Sectivia Supply Chain Dataset  
**Baseline Release:** Week 1 Foundation  
**Curation:** SEC EDGAR 10-K & 8-K Regulatory Filings (CC BY 4.0)

---

## 1. Company Entity Dictionary (`:Company`)

| Field Name | Type | Key / Constraint | Required | Nullable Rule | Domain / Allowed Values | Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | String | Primary Key | Yes | False | `sectivia:[a-z0-9_-]+` | Namespaced unique identifier for global graph unification. |
| `raw_id` | String | Secondary | Yes | False | `[a-z0-9_-]+` | Raw source identifier from `sectivia-companies.csv`. |
| `ticker` | String | Index | No | True | Standard exchange ticker (e.g. `AAPL`, `NVDA`, `TSLA`). | Ticker symbol. `null` for non-public entities (SpaceX). |
| `name` | String | Index | Yes | False | Corporate legal entity strings. | Full official company name as reported to SEC. |
| `exchange` | String | Property | No | True | `NASDAQ`, `NYSE`, `AMEX`, `null` | Stock exchange where shares are actively traded. |
| `country` | String | Index | Yes | False | Country name or standard ISO code (e.g. `USA`, `Taiwan`). | Domicile of headquarters. |
| `sector` | String | Index | Yes | False | 8 Sectivia Sectors (see Taxonomy below). | High-level industry sector. |
| `segment` | String | Index | Yes | False | 61 Sectivia Segments (see Taxonomy below). | Granular sub-industry classification. |
| `listed` | Boolean | Property | Yes | False | `true`, `false` | Whether entity is publicly traded (`false` for SpaceX). |
| `relations_count` | Integer | Metric | Yes | False | Positive integers ($\ge 1$). | Total number of relationships reported in raw dataset. |
| `dataset_source` | String | Provenance | Yes | False | `'sectivia'` | Provenance source tag. |

---

## 2. Relationship Entity Dictionary (`[:SUPPLIES_TO]`)

| Field Name | Type | Required | Nullable Rule | Domain / Allowed Values | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `supplier_id` | String | Yes | False | `sectivia:[a-z0-9_-]+` | Foreign key matching supplier `Company.id`. |
| `customer_id` | String | Yes | False | `sectivia:[a-z0-9_-]+` | Foreign key matching customer `Company.id`. |
| `sector` | String | No | True | Sector name or `null` | Common sector classification. `null` in cross-sector relationships. |
| `supplier_sector` | String | Yes | False | 8 Sectivia Sectors | Upstream entity sector. |
| `customer_sector` | String | Yes | False | 8 Sectivia Sectors | Downstream entity sector. |
| `supplier_segment` | String | Yes | False | 61 Sectivia Segments | Upstream entity sub-industry. |
| `customer_segment` | String | Yes | False | 61 Sectivia Segments | Downstream entity sub-industry. |
| `is_cross_sector` | Boolean | Yes | False | `true`, `false` | `true` when `supplier_sector != customer_sector` (162 records). |
| `what` | String | Yes | False | Descriptive text strings. | Goods, components, raw materials, or services supplied. |
| `source` | String | Yes | False | String | Source regulatory disclosure type (e.g. `'SEC EDGAR 10-K'`). |
| `source_url` | String | Yes | False | Valid URL (`https://...`) | Direct link to SEC EDGAR filing evidence. |
| `dataset_source` | String | Yes | False | `'sectivia'` | Provenance source tag. |

---

## 3. Industrial Sector Taxonomy (8 Sectors)

The Sectivia graph organizes corporate activity into 8 primary industrial sectors:

1. **Technology**: Hardware, software, semiconductors, networking equipment, cloud infrastructure.
2. **Healthcare**: Pharmaceuticals, medical devices, biotechnology, clinical equipment.
3. **Industrials**: Aerospace, defense, machinery, industrial automation, logistics.
4. **Consumer Discretionary**: Automobiles, electronics, luxury retail, consumer hardware.
5. **Communication Services**: Telecom carriers, media networks, digital advertising, internet platforms.
6. **Energy**: Oil, natural gas, renewable energy equipment, petrochemical refining.
7. **Materials**: Specialty chemicals, industrial metals, mining, advanced polymers.
8. **Consumer Staples**: Food production, packaging, household goods.

---

## 4. Cross-Sector Dependency Corridors (162 Relationships)

Cross-sector links represent critical inter-industry dependencies where disruption in one domain cascades into others:
- **Technology $\rightarrow$ Consumer Discretionary**: Microcontrollers and sensors supplied to automotive manufacturers.
- **Industrials $\rightarrow$ Technology**: Precision manufacturing tools, cleanroom equipment, and robotics supplied to chip foundries.
- **Materials $\rightarrow$ Technology**: Rare earth elements and specialty substrates supplied to semiconductor fabricators.
