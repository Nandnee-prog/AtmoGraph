import axios from "axios";
import {
  initialSupplyChainNodes,
  initialSupplyChainEdges,
  initialAlerts,
  initialSummary,
} from "../data/mockData";

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
 * Check if the backend API is live or if we are using the fallback mock adapter
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
      mode: "Simulated Data (Backend not connected)",
      error: error.message,
    };
  }
}

/**
 * Fetch the full supply chain graph with nodes, edges, and summary metrics
 */
export async function fetchNetworkGraph() {
  try {
    const response = await apiClient.get("/network/graph");
    mockModeActive = false;
    return response.data;
  } catch (err) {
    // Graceful offline fallback
    mockModeActive = true;
    return {
      nodes: initialSupplyChainNodes,
      edges: initialSupplyChainEdges,
      summary: initialSummary,
      isSimulated: true,
    };
  }
}

/**
 * Fetch specific details and historical telemetry for a given node
 */
export async function fetchNodeDetails(nodeId) {
  try {
    const response = await apiClient.get(`/nodes/${nodeId}`);
    return response.data;
  } catch (err) {
    const node = initialSupplyChainNodes.find((n) => n.id === nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);
    return {
      ...node.data,
      isSimulated: true,
    };
  }
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
 * Simulate ripple effect propagation starting from a disrupted node
 * Uses Breadth-First-Search along supply chain edges to find downstream nodes
 */
export function simulateRippleEffect(rootNodeId, severityMultiplier = 1.3) {
  const affectedNodeIds = new Set([rootNodeId]);
  const queue = [rootNodeId];
  const rippleEdges = [];

  while (queue.length > 0) {
    const current = queue.shift();
    const downstreamEdges = initialSupplyChainEdges.filter(
      (e) => e.source === current
    );

    for (const edge of downstreamEdges) {
      if (!affectedNodeIds.has(edge.target)) {
        affectedNodeIds.add(edge.target);
        rippleEdges.push(edge.id);
        queue.push(edge.target);
      }
    }
  }

  return {
    rootNodeId,
    affectedCount: affectedNodeIds.size,
    affectedNodeIds: Array.from(affectedNodeIds),
    rippleEdgeIds: rippleEdges,
    estimatedTotalDelayDays: (affectedNodeIds.size * 2.8 * severityMultiplier).toFixed(1),
  };
}

export function isMockMode() {
  return mockModeActive;
}
