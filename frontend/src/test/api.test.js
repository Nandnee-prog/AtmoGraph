import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  apiClient,
  checkBackendHealth,
  fetchNetworkGraph,
  fetchAlerts,
  fetchPredictions,
  fetchAllCompanies,
  fetchNodeDetails,
  fetchGnnPrediction,
  simulateBackendRipple,
  simulateRippleEffect,
  mapBackendGraphToFrontend,
  isMockMode,
} from "../services/api";

describe("API Service & FastAPI Integration Layer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Backend Health Check & Timeout Handling", () => {
    it("reports offline mode gracefully when backend is unreachable", async () => {
      vi.spyOn(apiClient, "get").mockRejectedValueOnce(new Error("Network Error"));
      const health = await checkBackendHealth();

      expect(health.live).toBe(false);
      expect(health.mode).toContain("Sectivia Baseline");
      expect(health.error).toBeDefined();
      expect(isMockMode()).toBe(true);
    });

    it("reports online mode when FastAPI /health endpoint responds", async () => {
      vi.spyOn(apiClient, "get").mockResolvedValueOnce({
        data: {
          status: "ok",
          data_label: "SYNTHETIC / SIMULATED",
          n_nodes: 300,
          n_edges: 528,
          mode: "precomputed",
          predictions_loaded: true,
        },
      });

      const health = await checkBackendHealth();
      expect(health.live).toBe(true);
      expect(health.status).toBe("ok");
      expect(health.nNodes).toBe(300);
      expect(health.nEdges).toBe(528);
      expect(health.predictionsLoaded).toBe(true);
      expect(isMockMode()).toBe(false);
    });
  });

  describe("Graph Ingestion & Response Mapping", () => {
    it("falls back to verified Sectivia dataset when backend is offline", async () => {
      vi.spyOn(apiClient, "get").mockRejectedValue(new Error("Offline"));
      const data = await fetchNetworkGraph();

      expect(data).toBeDefined();
      expect(data.nodes).toBeInstanceOf(Array);
      expect(data.nodes.length).toBeGreaterThan(0);
      expect(data.edges).toBeInstanceOf(Array);
      expect(data.stats).toBeDefined();
      expect(data.stats.totalCompanies).toBe(382);
      expect(data.stats.totalRelationships).toBe(556);
      expect(data.stats.crossSectorRelationships).toBe(162);
      expect(data.stats.totalSectors).toBe(8);
      expect(data.isSimulated).toBe(true);
    });

    it("correctly maps raw backend /nodes and /edges into common React Flow format", () => {
      const rawNodes = [
        {
          node_id: "S0001",
          name: "Toronto Metals S0001",
          node_type: "Supplier",
          country: "Canada",
          region: "North America",
          industry: "Industrial Machinery",
          risk_score: "0.85",
          data_source: "SYNTHETIC",
        },
        {
          node_id: "M0035",
          name: "Bavaria Motoren M0035",
          node_type: "Manufacturer",
          country: "Germany",
          region: "Europe",
          industry: "Automotive",
          risk_score: "0.2",
          data_source: "SYNTHETIC",
        },
      ];

      const rawEdges = [
        {
          source: "S0001",
          target: "M0035",
          route_type: "sea",
          lead_time_days: "31.2",
          capacity: "705",
          is_cross_sector: true,
        },
      ];

      const mapped = mapBackendGraphToFrontend(rawNodes, rawEdges);

      expect(mapped.nodes).toHaveLength(2);
      expect(mapped.nodes[0].id).toBe("S0001");
      expect(mapped.nodes[0].data.name).toBe("Toronto Metals S0001");
      expect(mapped.nodes[0].data.risk).toBe("high"); // 0.85 >= 0.7
      expect(mapped.nodes[0].position).toHaveProperty("x");
      expect(mapped.nodes[0].position).toHaveProperty("y");

      expect(mapped.edges).toHaveLength(1);
      expect(mapped.edges[0].source).toBe("S0001");
      expect(mapped.edges[0].target).toBe("M0035");
      expect(mapped.edges[0].data.lead_time_days).toBe(31.2);
      expect(mapped.edges[0].data.is_cross_sector).toBe(true);
    });

    it("fetches live /nodes and /edges when backend endpoints succeed", async () => {
      vi.spyOn(apiClient, "get").mockImplementation((url) => {
        if (url === "/nodes") {
          return Promise.resolve({
            data: [
              {
                node_id: "N1",
                name: "Node 1",
                node_type: "Supplier",
                industry: "ai",
                risk_score: 0.1,
              },
              {
                node_id: "N2",
                name: "Node 2",
                node_type: "Manufacturer",
                industry: "ai",
                risk_score: 0.8,
              },
            ],
          });
        }
        if (url === "/edges") {
          return Promise.resolve({
            data: [
              {
                source: "N1",
                target: "N2",
                route_type: "Air",
                lead_time_days: 5,
              },
            ],
          });
        }
        return Promise.reject(new Error("404"));
      });

      const res = await fetchNetworkGraph();
      expect(res.isSimulated).toBe(false);
      expect(res.nodes).toHaveLength(2);
      expect(res.edges).toHaveLength(1);
      expect(res.stats.totalCompanies).toBe(2);
    });
  });

  describe("Member 3 GNN Prediction Integration (/predict)", () => {
    it("fetches live GNN predictions with 30, 60, and 90-day horizons", async () => {
      vi.spyOn(apiClient, "get").mockResolvedValueOnce({
        data: {
          type: "prediction",
          data_label: "SYNTHETIC / SIMULATED",
          source: "pre-computed GNN predictions",
          model: "GCN-DelayPredictor-v1",
          event: {
            origin: "S0001",
            origin_name: "Toronto Metals S0001",
            severity: 0.7,
            headline: "Factory strike halts assembly",
            time: "2026-11-27T16:00:00Z",
          },
          horizons_days: [30, 60, 90],
          nodes: [
            {
              node_id: "M0035",
              name: "Bavaria Motoren M0035",
              node_type: "Manufacturer",
              delay_30d: 5.2,
              delay_60d: 11.4,
              delay_90d: 18.6,
              at_risk: true,
            },
          ],
        },
      });

      const pred = await fetchGnnPrediction("S0001", 0.7, 0.5);
      expect(pred.type).toBe("prediction");
      expect(pred.isSimulated).toBe(false);
      expect(pred.horizons_days).toEqual([30, 60, 90]);
      expect(pred.nodes).toHaveLength(1);
      expect(pred.nodes[0].delay_90d).toBe(18.6);
      expect(pred.nodes[0].at_risk).toBe(true);
    });

    it("falls back to structured topological prediction when /predict is offline", async () => {
      vi.spyOn(apiClient, "get").mockRejectedValueOnce(new Error("Connection refused"));

      const pred = await fetchGnnPrediction("sectivia:adi", 0.8);
      expect(pred.type).toBe("prediction");
      expect(pred.isSimulated).toBe(true);
      expect(pred.horizons_days).toEqual([30, 60, 90]);
      expect(pred.event.origin).toBe("sectivia:adi");
      expect(pred.event.severity).toBe(0.8);
      expect(Array.isArray(pred.nodes)).toBe(true);
      expect(pred.error).toBeDefined();
    });
  });

  describe("Member 3 Rule-Based Ripple Simulation (/simulate-ripple)", () => {
    it("calls POST /simulate-ripple and parses the response when live", async () => {
      vi.spyOn(apiClient, "post").mockResolvedValueOnce({
        data: {
          type: "ripple",
          data_label: "SYNTHETIC / SIMULATED",
          source: "rule-based ripple simulation (GNN nahi)",
          event: { origins: [{ node_id: "S0001", severity: 0.7 }] },
          horizons_days: [30, 60, 90],
          nodes: [
            {
              node_id: "M0035",
              name: "Bavaria Motoren M0035",
              node_type: "Manufacturer",
              delay_30d: 4.2,
              delay_60d: 8.4,
              delay_90d: 12.6,
              at_risk: true,
            },
          ],
        },
      });

      const res = await simulateBackendRipple([{ node_id: "S0001", severity: 0.7 }]);
      expect(res.type).toBe("ripple");
      expect(res.isSimulated).toBe(false);
      expect(res.horizons_days).toEqual([30, 60, 90]);
      expect(res.nodes[0].node_id).toBe("M0035");
    });

    it("falls back to local BFS ripple simulation when /simulate-ripple is offline", async () => {
      vi.spyOn(apiClient, "post").mockRejectedValueOnce(new Error("Offline"));

      const res = await simulateBackendRipple("sectivia:adi");
      expect(res.type).toBe("ripple");
      expect(res.isSimulated).toBe(true);
      expect(res.horizons_days).toEqual([30, 60, 90]);
      expect(res.bfsSummary).toBeDefined();
      expect(res.bfsSummary.rootNodeId).toBe("sectivia:adi");
    });
  });

  describe("Catalog and Node Details Fallback", () => {
    it("fetches all 382 companies in the Sectivia baseline catalog when offline", async () => {
      vi.spyOn(apiClient, "get").mockRejectedValueOnce(new Error("Offline"));
      const companies = await fetchAllCompanies();
      expect(companies).toBeInstanceOf(Array);
      expect(companies).toHaveLength(382);
    });

    it("fetches company details and upstream/downstream connections for Apple", async () => {
      vi.spyOn(apiClient, "get").mockRejectedValueOnce(new Error("Offline"));
      const details = await fetchNodeDetails("sectivia:aapl");
      expect(details).toBeDefined();
      expect(details.name).toBe("Apple");
      expect(details.ticker).toBe("AAPL");
      expect(details.sector).toBe("ai");
      expect(details.suppliers).toBeInstanceOf(Array);
      expect(details.customers).toBeInstanceOf(Array);
      expect(details.relations_count).toBe(14);
    });

    it("returns active Sectivia disruption alerts", async () => {
      const alerts = await fetchAlerts();
      expect(alerts).toBeInstanceOf(Array);
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0]).toHaveProperty("severity");
      expect(alerts[0]).toHaveProperty("title");
    });

    it("calculates disruption prediction horizons", async () => {
      const res7 = await fetchPredictions("7 Days");
      expect(res7.values).toHaveLength(7);
    });

    it("simulates BFS ripple effect accurately downstream along SUPPLIES_TO edges", () => {
      const result = simulateRippleEffect("sectivia:adi");
      expect(result.rootNodeId).toBe("sectivia:adi");
      expect(result.affectedCount).toBeGreaterThan(1);
      expect(result.affectedNodeIds).toContain("sectivia:adi");
      expect(result.affectedNodeIds).toContain("sectivia:aapl");
      expect(parseFloat(result.estimatedTotalDelayDays)).toBeGreaterThan(0);
    });
  });
});
