import axios from "axios";
import {
  SECTIVIA_STATS,
  SECTIVIA_SECTORS,
  SECTIVIA_COMPANIES,
  SECTIVIA_RELATIONSHIPS,
  initialSupplyChainNodes,
  initialSupplyChainEdges,
  initialAlerts,
  initialSummary,
} from "../data/sectiviaData";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 4000,
  headers: {
    "Content-Type": "application/json",
  },
});

let mockModeActive = true;

/**
 * Check if the backend API is live or if we are using the fallback Sectivia reference data
 */
export async function checkBackendHealth() {
  try {
    const res = await apiClient.get("/health");
    mockModeActive = false;
    return { live: true, data: res.data };
  } catch (error) {
    mockModeActive = true;
    return {
      live: false,
      mode: "Sectivia Baseline Reference (Backend offline)",
      error: error.message,
    };
  }
}

/**
 * Fetch the full supply chain graph with nodes, edges, summary, and dataset stats
 */
export async function fetchNetworkGraph() {
  try {
    const response = await apiClient.get("/network/graph");
    mockModeActive = false;
    return response.data;
  } catch (err) {
    mockModeActive = true;
    return {
      nodes: initialSupplyChainNodes,
      edges: initialSupplyChainEdges,
      summary: initialSummary,
      stats: SECTIVIA_STATS,
      sectors: SECTIVIA_SECTORS,
      isSimulated: true,
      datasetSource: "sectivia",
    };
  }
}

/**
 * Fetch all 382 companies in the Sectivia baseline catalog
 */
export async function fetchAllCompanies() {
  try {
    const response = await apiClient.get("/companies");
    return response.data;
  } catch (err) {
    return SECTIVIA_COMPANIES;
  }
}

/**
 * Fetch specific details and supplier/customer connections for a given company
 */
export async function fetchNodeDetails(nodeId) {
  try {
    const response = await apiClient.get(`/nodes/${nodeId}`);
    return response.data;
  } catch (err) {
    const company = SECTIVIA_COMPANIES.find(
      (c) => c.id === nodeId || c.raw_id === nodeId || c.ticker === nodeId
    );
    if (!company) {
      const activeNode = initialSupplyChainNodes.find((n) => n.id === nodeId);
      if (activeNode) return { ...activeNode.data, isSimulated: true };
      throw new Error(`Company node ${nodeId} not found in Sectivia dataset`);
    }

    // Identify direct suppliers (incoming edges) and customers (outgoing edges)
    const suppliers = SECTIVIA_RELATIONSHIPS.filter(
      (r) => r.target === company.id
    );
    const customers = SECTIVIA_RELATIONSHIPS.filter(
      (r) => r.source === company.id
    );

    return {
      node_id: company.id,
      raw_id: company.raw_id,
      label: company.ticker || company.name,
      name: company.name,
      ticker: company.ticker,
      exchange: company.exchange,
      country: company.country,
      sector: company.sector,
      sectorName: company.sectorName,
      sectorColor: company.sectorColor,
      sectorIcon: company.sectorIcon,
      segment: company.segment,
      listed: company.listed,
      relations_count: company.relations_count,
      suppliers,
      customers,
      isSimulated: true,
      dataset_source: "sectivia",
    };
  }
}

/**
 * Fetch 1-hop or 2-hop Ego Network for a given company
 * Corresponds to database/docs/integration_contract.md § 3.1
 */
export function buildEgoNetwork(companyId, hops = 1) {
  const rootComp = SECTIVIA_COMPANIES.find(
    (c) => c.id === companyId || c.raw_id === companyId
  );
  if (!rootComp) return null;

  const includedNodeIds = new Set([rootComp.id]);
  const frontier = [rootComp.id];

  for (let h = 0; h < hops; h++) {
    const nextFrontier = [];
    for (const currId of frontier) {
      const directRels = SECTIVIA_RELATIONSHIPS.filter(
        (r) => r.source === currId || r.target === currId
      );
      for (const rel of directRels) {
        const neighborId = rel.source === currId ? rel.target : rel.source;
        if (!includedNodeIds.has(neighborId)) {
          includedNodeIds.add(neighborId);
          nextFrontier.push(neighborId);
        }
      }
    }
    frontier.length = 0;
    frontier.push(...nextFrontier);
  }

  // Filter edges where both ends are in includedNodeIds
  const egoEdges = SECTIVIA_RELATIONSHIPS.filter(
    (r) => includedNodeIds.has(r.source) && includedNodeIds.has(r.target)
  ).map((r) => ({
    id: r.id,
    source: r.source,
    target: r.target,
    label: r.what.slice(0, 26) + (r.what.length > 26 ? "..." : ""),
    animated: r.is_cross_sector,
    style: {
      stroke: r.is_cross_sector ? "#38bdf8" : "#64748b",
      strokeWidth: r.is_cross_sector ? 2.5 : 1.5,
    },
    data: { ...r },
  }));

  // Position nodes in an ego radial / hierarchical layout
  const egoNodes = Array.from(includedNodeIds).map((id, index) => {
    const comp = SECTIVIA_COMPANIES.find((c) => c.id === id);
    const isRoot = id === rootComp.id;
    let x = 400;
    let y = 300;

    if (!isRoot) {
      const angle = ((index - 1) / (includedNodeIds.size - 1)) * 2 * Math.PI;
      const radius = hops === 1 ? 280 : 340;
      x = 400 + Math.cos(angle) * radius;
      y = 300 + Math.sin(angle) * radius;
    }

    return {
      id: comp.id,
      type: "custom",
      position: { x, y },
      data: {
        node_id: comp.id,
        raw_id: comp.raw_id,
        label: comp.ticker || comp.name,
        name: comp.name,
        ticker: comp.ticker,
        exchange: comp.exchange,
        country: comp.country,
        sector: comp.sector,
        sectorName: comp.sectorName,
        sectorColor: comp.sectorColor,
        sectorIcon: comp.sectorIcon,
        segment: comp.segment,
        listed: comp.listed,
        relations_count: comp.relations_count,
        isRoot,
        risk: isRoot ? "high" : comp.relations_count > 10 ? "medium" : "low",
        status: isRoot ? "Focus Node" : "Connected Partner",
      },
    };
  });

  return { nodes: egoNodes, edges: egoEdges, root: rootComp };
}

/**
 * Fetch disruption predictions across horizons
 */
export async function fetchPredictions(horizon = "7 Days") {
  try {
    const response = await apiClient.get("/predictions", {
      params: { horizon },
    });
    return response.data;
  } catch (err) {
    const defaultData = {
      "7 Days": [22, 28, 25, 38, 34, 45, 52],
      "14 Days": [18, 25, 22, 32, 29, 42, 48, 45, 55, 51, 63, 59, 70, 76],
      "30 Days": [
        15, 20, 18, 25, 30, 28, 35, 32, 42, 40, 48, 45, 55, 52, 60,
        58, 65, 62, 70, 68, 75, 72, 80, 77, 85, 82, 88, 84, 92, 95,
      ],
    };
    return {
      horizon,
      values: defaultData[horizon] || defaultData["7 Days"],
      isSimulated: true,
      note: "Illustrative disruption trend forecast",
    };
  }
}

/**
 * Fetch disruption alerts
 */
export async function fetchAlerts() {
  try {
    const response = await apiClient.get("/alerts");
    return response.data;
  } catch (err) {
    return initialAlerts;
  }
}

/**
 * Simulate ripple effect propagation starting from a disrupted Sectivia node
 * Follows directed SUPPLIES_TO edges downstream (Supplier -> Customer)
 * Corresponds to database/docs/integration_contract.md § 3.2
 */
export function simulateRippleEffect(rootNodeId, severityMultiplier = 1.3) {
  const affectedNodeIds = new Set([rootNodeId]);
  const queue = [rootNodeId];
  const rippleEdges = [];

  // Match edges from both initialSupplyChainEdges and full SECTIVIA_RELATIONSHIPS
  while (queue.length > 0) {
    const current = queue.shift();
    const downstreamRels = SECTIVIA_RELATIONSHIPS.filter(
      (r) => r.source === current
    );

    for (const rel of downstreamRels) {
      if (!affectedNodeIds.has(rel.target)) {
        affectedNodeIds.add(rel.target);
        rippleEdges.push(rel.id);
        // Limit depth to avoid infinite loop
        if (affectedNodeIds.size < 25) {
          queue.push(rel.target);
        }
      }
    }
  }

  const affectedArray = Array.from(affectedNodeIds);
  const rootComp = SECTIVIA_COMPANIES.find((c) => c.id === rootNodeId);

  return {
    rootNodeId,
    rootName: rootComp ? rootComp.name : rootNodeId,
    affectedCount: affectedArray.length,
    affectedNodeIds: affectedArray,
    rippleEdgeIds: rippleEdges,
    estimatedTotalDelayDays: (
      affectedArray.length *
      2.8 *
      severityMultiplier
    ).toFixed(1),
  };
}

export function isMockMode() {
  return mockModeActive;
}
