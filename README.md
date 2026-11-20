# AtmoGraph: Supply Chain Ripple Effect Predictor

> ⚠️ **SYNTHETIC / SIMULATED DATA.** Poora supply chain graph mock hai aur
> GNN ke delay labels ek propagation simulation se bane hain.
> Real-world supply chain data public nahi hota. Ye ek prototype /
> learning project hai, real logistics decisions ke liye nahi.

Detailed README Stage 14 mein complete hoga.

---

## 🖥 Frontend Dashboard (Member 4)

The AtmoGraph frontend dashboard is located in [`frontend/`](./frontend) and delivers an interactive supply chain intelligence and failure ripple visualization system.

### Key Capabilities
- **System-Adaptive Theme**: Automatically adapts between dark and light appearance modes with instant manual toggle.
- **Topology Graph**: Built with `@xyflow/react` and custom node types (`Supplier`, `Manufacturer`, `Port`, `Warehouse`, `Retailer`) matching `config/schema.yaml`.
- **Multi-Criteria Search & Filtering**: Instant search across facilities, countries, industries, risk categories, and facility types.
- **Ripple Effect Simulation**: BFS propagation simulator illustrating downstream disruption delays.
- **Trend Predictions**: Horizon forecast visualizations for 7, 14, and 30 days.
- **API Service Layer**: Resilient HTTP client (`frontend/src/services/api.js`) with automatic offline simulated fallback.
- **Full Test Suite**: Tested with Vitest and React Testing Library (`npm run test`).

For full technical documentation, architecture details, and API contracts, see [frontend/README.md](./frontend/README.md).
