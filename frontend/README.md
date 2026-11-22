# AtmoGraph Frontend — Supply Chain Intelligence Platform

> **Member 4 Deliverable**: Interactive Supply Chain Visualization & Dashboard Foundation
> **Primary Dataset**: Sectivia (SEC EDGAR Regulatory Disclosures)
> **Target Graph Database**: Neo4j (Member 1 Integration Contract)

AtmoGraph is an intelligent supply chain monitoring platform designed to visualize multi-tier corporate networks, map inter-industry cross-sector dependencies, simulate disruption propagation (ripple effects), and forecast disruption risks across time horizons.

---

## 📊 Sectivia Primary Dataset Baseline

The frontend foundation strictly conforms to the verified **Sectivia** dataset implemented in Member 1's Neo4j database:

| Metric | Verified Sectivia Count | Description |
| :--- | :---:| :--- |
| **Total Companies** | **382** | 381 U.S.-listed corporations, 1 private (SpaceX) |
| **SUPPLIES_TO Relationships** | **556** | Directed commercial supply contracts documented in SEC filings |
| **Cross-Sector Relationships** | **162** | Inter-industry commercial flows linking different sectors |
| **Total Sectors** | **8** | AI, Energy, Finance, Health, Defense, Industrials, EV, Materials |
| **Sub-Industry Segments** | **61** | Detailed sub-industry classifications |
| **Corporate Headquarter Countries** | **3** | USA (377), Ireland (4), United Kingdom (1) |
| **Referential Integrity** | **100%** | 0 orphan nodes; all nodes belong to weakly connected components |

### 8 Industrial Sectors:
1. `ai` — **AI & Digital Infrastructure** (89 companies)
2. `energi` — **Energy, Grid & Critical Infrastructure** (63 companies)
3. `finans` — **Banks, Payments & Capital Markets** (56 companies)
4. `medicin` — **Life Science & Healthcare** (55 companies)
5. `forsvar` — **Defense, Security & Space** (53 companies)
6. `industri` — **Industrials & Reshoring** (31 companies)
7. `raavarer` — **Materials & Critical Minerals** (18 companies)
8. `elbil` — **EVs & Batteries** (17 companies)

---

## 🚀 Key Features

### 1. Modern Commercial SaaS Interface
- **Dark Navy / Charcoal Theme**: Designed with custom CSS variables (`--bg: #0b1120`, `--surface: #111c2e`, `--border: #263244`, `--accent: #38bdf8`) with cyan and purple accents.
- **System-Adaptive Mode**: Automatic OS preference detection (`prefers-color-scheme: dark`) with manual toggle (System, Light, Dark).
- **Executive KPI Cards**: Real-time display of Sectivia verified ground truth (382 Companies, 556 Relationships, 162 Cross-Sector Relationships, 8 Sectors).

### 2. Five-Section Functional Navigation
1. **Overview (`▦`)**: Executive statistics, curated multi-sector topology canvas preview, active disruption notices, and status indicators.
2. **Supply Chain Network (`◎`)**: Full-height interactive React Flow canvas with sector filtering, cross-sector dependency filters, ego-network inspection, and detailed node/edge inspector panels.
3. **Companies (`🏛️`)**: Searchable directory of all 382 Sectivia corporations with tickers, exchanges, segments, countries, and direct *"Inspect in Graph"* one-click routing.
4. **Analytics (`📊`)**: Sector breakdown distribution bar chart, cross-sector dependency analysis, and the interactive SVG risk prediction trend component.
5. **About (`ℹ️`)**: Architectural integration blueprint, data provenance, and cross-module roadmap for Members 1, 2, 3, and 4.

### 3. Interactive Supply Chain Graph (`@xyflow/react`)
- **Directed Edges**: Graph edges strictly represent directed flows:
  $$\text{Upstream Supplier} \xrightarrow{\text{SUPPLIES\_TO}} \text{Downstream Customer}$$
- **Arrowheads**: Distinct closed arrowheads indicating commercial flow direction.
- **Cross-Sector Dependency Filtering**: One-click filter isolating the 162 inter-industry supply links with animated indicators.
- **1-Hop Ego Network Explorer**: Selecting any company allows expanding into its dedicated 1-hop supply chain neighborhood (`database/docs/integration_contract.md § 3.1`).
- **Canvas Controls**: Full zoom, pan, MiniMap with sector color coding, and viewport auto-fit.
- **Export Topology**: One-click JSON export of visible subgraphs with active filters and metadata.

### 4. Company & Relationship Inspector Panels
- **Company Inspector**: Displays legal corporate name, stock ticker, exchange, country, sector badge, sub-industry segment, listing status, and verified SEC EDGAR filing citations. Lists direct upstream suppliers and downstream customers with links to official SEC EDGAR disclosure filings.
- **Relationship Inspector**: Surfaces supplied materials/services (`what`), cross-sector classification, and SEC filing citations.

### 5. Failure Ripple Disruption Simulator
- Implements Breadth-First-Search (BFS) propagation along downstream `SUPPLIES_TO` edges starting from an affected company node (`database/docs/integration_contract.md § 3.2`).
- Highlights affected downstream companies with pulsing ripple badges and animated high-risk red edges.
- Calculates estimated cumulative supply chain delay days based on graph topology.

### 6. Accessibility & Usability (a11y)
- **Skip-to-Content Link**: `#dashboard` jump link for screen readers.
- **Keyboard Navigation**:
  - `Escape`: Deselects active company/route and clears ripple simulations.
  - `/` or `Ctrl+K`: Focuses the supply chain search bar from anywhere.
  - `Enter` / `Space`: Activates focused graph nodes.
- **Screen Reader Support**: `aria-live="polite"` live announcements for filtered node counts.
- **Reduced Motion**: Respects `@media (prefers-reduced-motion: reduce)`.

---

## 📁 Project Structure

```
frontend/
├── index.html                   # HTML entry point with Inter font & viewport meta
├── package.json                 # Dependencies and npm scripts
├── vite.config.js               # Vite build and Vitest configuration
├── src/
│   ├── main.jsx                 # React root mount
│   ├── App.jsx                  # Main dashboard layout, state & tab orchestration
│   ├── App.css                  # Commercial SaaS theme, responsive grid & component styles
│   ├── index.css                # Global resets & typography
│   ├── Prediction.jsx           # SVG risk forecast trend component
│   ├── Prediction.css          # Theme-adaptive prediction styling
│   ├── components/
│   │   ├── LoadingSkeleton.jsx  # Shimmer skeleton loaders for async state
│   │   ├── ErrorBanner.jsx      # Accessible connection error banner with retry
│   │   ├── EmptyState.jsx       # Reusable empty state view
│   │   └── Components.css       # Shared component animations & styles
│   ├── data/
│   │   ├── sectiviaData.js      # Authentic Sectivia dataset (382 companies, 556 relations)
│   │   └── commonFormat.js      # Cross-member schema definitions & validation contracts
│   ├── services/
│   │   └── api.js               # Centralized API service with Sectivia offline fallback
│   └── test/
│       ├── setup.js             # Vitest test setup (matchMedia & ResizeObserver mocks)
│       ├── App.test.jsx         # App integration tests (branding, stats, navigation, a11y)
│       ├── Prediction.test.jsx  # Prediction component unit tests
│       └── api.test.js          # API service and Sectivia data layer unit tests
```

---

## 🤝 Cross-Member Common Data Contract (`src/data/commonFormat.js`)

All four team members work concurrently against this common contract:

### 1. Company Node Format (`CompanyNode`)
```json
{
  "id": "sectivia:aapl",
  "raw_id": "aapl",
  "name": "Apple",
  "ticker": "AAPL",
  "exchange": "NASDAQ",
  "country": "USA",
  "sector": "ai",
  "sectorName": "AI & Digital Infrastructure",
  "segment": "Devices & electronics manufacturing",
  "listed": true,
  "relations_count": 14,
  "dataset_source": "sectivia"
}
```

### 2. Relationship Format (`SuppliesToRelationship`)
```json
{
  "id": "rel_7",
  "source": "sectivia:adi",
  "target": "sectivia:aapl",
  "type": "SUPPLIES_TO",
  "supplier_name": "Analog Devices",
  "customer_name": "Apple",
  "supplier_ticker": "ADI",
  "customer_ticker": "AAPL",
  "supplier_sector": "ai",
  "customer_sector": "ai",
  "supplier_segment": "Chips & accelerators",
  "customer_segment": "Devices & electronics manufacturing",
  "is_cross_sector": false,
  "what": "Chips for Apple products, on Apple's official supplier list",
  "source_citation": "Apple Supplier List (fiscal 2023), April 2024",
  "source_url": "https://s203.q4cdn.com/367071867/files/doc_downloads/2024/04/Apple-Supplier-List.pdf"
}
```

### 3. Future Extensibility Hooks:
- **Member 2 (NLP & Disruption Pipeline):** Accepts `entity_id` (`sectivia:<id>`), `disruption_type`, `severity_score` [0.0 - 1.0], `confidence`, and `source_headline`.
- **Member 3 (GNN Prediction Engine):** Accepts `origin_id`, `hop_depth`, `impacted_id`, `predicted_delay_days`, and `cascade_probability`.

---

## 🧪 Running Tests & Build

All commands should be executed from the `frontend` directory:

```powershell
cd D:\AtmoGraph\frontend

# Install dependencies
npm install

# Run Vitest test suite (15 passed tests)
npm run test

# Run tests in watch mode
npm run test:watch

# Build production bundle
npm run build

# Preview production build locally
npm run preview
```
