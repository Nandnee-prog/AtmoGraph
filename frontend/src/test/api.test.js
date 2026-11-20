import { describe, it, expect } from "vitest";
import {
  fetchNetworkGraph,
  fetchAlerts,
  fetchPredictions,
  simulateRippleEffect,
} from "../services/api";

describe("API Service & Resilience Layer", () => {
  it("provides fallback supply chain graph with valid nodes and edges", async () => {
    const data = await fetchNetworkGraph();
    expect(data).toBeDefined();
    expect(data.nodes).toBeInstanceOf(Array);
    expect(data.nodes.length).toBeGreaterThan(0);
    expect(data.edges).toBeInstanceOf(Array);
    expect(data.summary).toBeDefined();
    expect(data.summary.totalSuppliers).toBe(248);
  });

  it("returns active disruption alerts", async () => {
    const alerts = await fetchAlerts();
    expect(alerts).toBeInstanceOf(Array);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0]).toHaveProperty("severity");
    expect(alerts[0]).toHaveProperty("title");
  });

  it("calculates disruption prediction horizons", async () => {
    const res7 = await fetchPredictions("7 Days");
    expect(res7.values).toHaveLength(7);

    const res14 = await fetchPredictions("14 Days");
    expect(res14.values).toHaveLength(14);

    const res30 = await fetchPredictions("30 Days");
    expect(res30.values).toHaveLength(30);
  });

  it("simulates BFS ripple effect accurately through downstream nodes", () => {
    // node-1 connects to node-3, node-3 to node-5, node-5 to node-6 & node-7, etc.
    const result = simulateRippleEffect("node-1");
    expect(result.rootNodeId).toBe("node-1");
    expect(result.affectedCount).toBeGreaterThan(1);
    expect(result.affectedNodeIds).toContain("node-1");
    expect(result.affectedNodeIds).toContain("node-3");
    expect(result.affectedNodeIds).toContain("node-5");
    expect(parseFloat(result.estimatedTotalDelayDays)).toBeGreaterThan(0);
  });
});
