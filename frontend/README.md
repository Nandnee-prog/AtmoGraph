# AtmoGraph Frontend — Supply Chain Ripple Effect Dashboard

> **Member 4 Deliverable**: Interactive Supply Chain Intelligence & Risk Topology Dashboard

AtmoGraph is an intelligent supply chain monitoring platform designed to visualize multi-tier supplier networks, identify critical bottlenecks, simulate failure propagation (ripple effects), and forecast disruption risks across time horizons.

---

## 🚀 Key Features

### 1. System-Adaptive Light & Dark Theme
- **Zero-Flicker Automatic Adaptation**: Reads user OS preferences via `prefers-color-scheme: dark`.
- **Manual Override**: Toggle between **System (Auto)**, **Light Mode**, and **Dark Mode** via the topbar selector.
- **Persistent State**: Theme preference saved in `localStorage`.
- **Theme Variables**: Engineered entirely with CSS variables (`var(--bg)`, `var(--surface)`, `var(--border)`, `var(--text)`, `var(--accent)`, `var(--muted)`), guaranteeing consistent contrast and readability across all panels, charts, and graph nodes.

### 2. Multi-Tier Interactive Topology Graph
- Powered by `@xyflow/react` (React Flow) with customized nodes and edges.
- Conforms to the project data contract (`config/schema.yaml`):
  - **Node Types**: `Supplier`, `Manufacturer`, `Port`, `Warehouse`, `Retailer`.
  - **Risk Tiers**: High (`#ef4444`), Medium (`#f97316`), Low (`#16a34a`).
  - **Route Modes**: Maritime, Air, Rail, Road.
- Interactive features:
  - **MiniMap**: Real-time overview with risk-coded entity markers.
  - **Canvas Controls**: Zoom in/out, fit view, and interactive panning.
  - **Quick Actions Toolbar**: Single-click "Fit View", "Critical Bottlenecks" focus, and "Export JSON" snapshot.

### 3. Multi-Criteria Search & Filtering
- **Faceted Risk Filters**: All, High Risk, Medium Risk, Low Risk with dynamic counts.
- **Facility Type Chips**: Filter by Supplier, Manufacturer, Port, Warehouse, or Retailer.
- **Instant Search Input**: Real-time filtering by facility name, country, or industry.
- **Active Filter Summary**: Displays matching count vs total nodes, with a single-click "Reset All Filters" button.

### 4. Failure Ripple Disruption Simulator
- Select any facility in the network and trigger **"Simulate Failure Ripple"**.
- Uses Breadth-First-Search (BFS) propagation along downstream supply edges.
- Highlights affected downstream nodes with a pulsing ripple alert animation (`@keyframes pulseRipple`) and animated high-risk red edges.
- Calculates and presents cumulative supply chain delay days and downstream impact metrics in an accessible status banner.

### 5. Facility & Route Inspector Panels
- **Node Inspector**: Displays facility type, geographic location/region, industry sector, risk score progress bar, monthly capacity, base lead time, and identified vulnerabilities.
- **Route Inspector**: Clicking any transport route edge surfaces transport mode, transit lead time (days), capacity (TEU/month), cargo description, and flow status.

### 6. Disruption Trend Predictions
- Responsive SVG area chart with gradient fill and interactive hover tooltips.
- Switchable forecast horizons: **7 Days**, **14 Days**, and **30 Days**.
- Displays projected average risk, forecast horizon, and peak risk window.

### 7. Real-Time Alert Notification Feed
- Chronological list of supply chain warnings and logistics advisories.
- Severity dots (High, Medium, Low) and impact horizon estimates.
- **"Inspect Node"** action button: Automatically scrolls to the graph and selects the affected node.

### 8. Accessibility (a11y) & Usability
- **Skip to Content Link**: Top-level link allowing keyboard and screen-reader users to jump straight to `#dashboard`.
- **Keyboard Shortcuts**:
  - `Escape`: Deselects current node/route and resets active ripple simulations.
  - `/` or `Ctrl+K`: Focuses the supply chain search bar.
  - `Enter` / `Space`: Activates and selects focused graph nodes.
- **Screen Reader Support**: Hidden `sr-only` `aria-live="polite"` region announcing live filter results.
- **Reduced Motion Support**: Respects `@media (prefers-reduced-motion: reduce)`.

---

## 🛠 Tech Stack

- **Runtime & UI Library**: React 18.3.1
- **Build Tool**: Vite 5.4.0
- **Graph Visualization**: `@xyflow/react` 12.0.0
- **Data Visualization**: D3 7.9.0 & Responsive SVG
- **HTTP Client**: Axios 1.7.0
- **Testing Framework**: Vitest 2.1.9, `@testing-library/react` 16.3.3, `@testing-library/jest-dom` 8.0.0, `jsdom` 31.0.1

---

## 📁 Project Structure

```
frontend/
├── index.html                   # HTML entry point with Inter font & viewport meta
├── package.json                 # Dependencies and npm scripts
├── vite.config.js               # Vite build and Vitest configuration
├── src/
│   ├── main.jsx                 # React root mount
│   ├── App.jsx                  # Main dashboard layout, state & orchestration
│   ├── App.css                  # Adaptive theme, layout & component styling
│   ├── index.css                # Global resets & typography
│   ├── Prediction.jsx           # SVG risk forecast trend component
│   ├── Prediction.css          # Theme-adaptive prediction styling
│   ├── components/
│   │   ├── LoadingSkeleton.jsx  # Shimmer skeleton loaders for async state
│   │   ├── ErrorBanner.jsx      # Accessible connection error banner with retry
│   │   ├── EmptyState.jsx       # Reusable empty state view
│   │   └── Components.css       # Shared component animations & styles
│   ├── data/
│   │   └── mockData.js          # Multi-tier mock supply chain dataset (schema-compliant)
│   ├── services/
│   │   └── api.js               # API service abstraction with mock fallback
│   └── test/
│       ├── setup.js             # Vitest test setup (matchMedia & ResizeObserver mocks)
│       ├── App.test.jsx         # App integration tests (theming, stats, search, a11y)
│       ├── Prediction.test.jsx  # Prediction component unit tests
│       └── api.test.js          # API service and BFS simulation unit tests
```

---

## 🔌 API Service Layer & Backend Contract

The frontend includes a decoupled API service layer in `src/services/api.js`.

### Environment Configuration
Configure the backend endpoint in `.env`:
```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

### Endpoints Specification
| Method | Endpoint | Description | Frontend Fallback |
|---|---|---|---|
| `GET` | `/health` | Backend status check | Reports offline mode |
| `GET` | `/network/graph` | Returns `{ nodes, edges, summary }` | Uses `mockData.js` |
| `GET` | `/nodes/:id` | Returns full facility details | Finds node in mock dataset |
| `GET` | `/predictions?horizon=7+Days` | Returns prediction array for horizon | Returns sample forecast |
| `GET` | `/alerts` | Returns recent disruption alerts list | Returns initial alerts |

If the backend server is offline or not yet initialized, the API layer gracefully falls back to the internal mock dataset with a clear status indicator: `"Online · Simulated Demo"`.

---

## 🧪 Running Tests & Build

All commands should be executed from the `frontend` directory:

```powershell
cd D:\AtmoGraph\frontend

# Install dependencies
npm install

# Run Vitest test suite
npm run test

# Run tests in watch mode
npm run test:watch

# Build production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 🤝 Coordination with Team Members
- **Member 1 (GNN Modeling)**: The mock dataset and node schema match `config/schema.yaml` (`[Supplier, Manufacturer, Port, Warehouse, Retailer]`, `risk_score` float [0.0 - 1.0]).
- **Member 2 (NLP & Alerts)**: The `fetchAlerts()` interface accepts structured news/disruption alerts with timestamps, severity flags, and node references.
- **Member 3 (Neo4j Graph Database)**: Node coordinates, edge connectivity (`source` / `target`), and route types (`Maritime`, `Air`, `Rail`, `Road`) mirror graph relationships.
