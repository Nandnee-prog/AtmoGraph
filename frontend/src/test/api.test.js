import { describe, it, expect } from "vitest";
import {
  fetchNetworkGraph,
  fetchAlerts,
  fetchPredictions,
  fetchAllCompanies,
  fetchNodeDetails,
  simulateRippleEffect,
} from "../services/api";

describe("API Service & Sectivia Data Layer", () => {
  it("provides fallback supply chain graph with Sectivia nodes, edges, and verified stats", async () => {
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
  });

  it("fetches all 382 companies in the Sectivia baseline catalog", async () => {
    const companies = await fetchAllCompanies();
    expect(companies).toBeInstanceOf(Array);
    expect(companies).toHaveLength(382);
    expect(companies[0]).toHaveProperty("id");
    expect(companies[0]).toHaveProperty("name");
    expect(companies[0]).toHaveProperty("sector");
  });

  it("fetches company details and upstream/downstream connections for Apple", async () => {
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
    expect(alerts[0]).toHaveProperty("nodeId");
  });

  it("calculates disruption prediction horizons", async () => {
    const res7 = await fetchPredictions("7 Days");
    expect(res7.values).toHaveLength(7);

    const res14 = await fetchPredictions("14 Days");
    expect(res14.values).toHaveLength(14);

    const res30 = await fetchPredictions("30 Days");
    expect(res30.values).toHaveLength(30);
  });

  it("simulates BFS ripple effect accurately downstream along SUPPLIES_TO edges", () => {
    // sectivia:adi (Analog Devices) supplies to sectivia:aapl (Apple), etc.
    const result = simulateRippleEffect("sectivia:adi");
    expect(result.rootNodeId).toBe("sectivia:adi");
    expect(result.affectedCount).toBeGreaterThan(1);
    expect(result.affectedNodeIds).toContain("sectivia:adi");
    expect(result.affectedNodeIds).toContain("sectivia:aapl");
    expect(parseFloat(result.estimatedTotalDelayDays)).toBeGreaterThan(0);
  });
});
