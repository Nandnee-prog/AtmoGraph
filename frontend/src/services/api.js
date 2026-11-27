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

// Configurable base URL: defaults to http://localhost:8000 for FastAPI backend
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 3000, // 3-second timeout requirement
  headers: {
    "Content-Type": "application/json",
  },
});

let mockModeActive = true;
let backendMetadata = null;

/**
 * 1. Health connection check with 3-second timeout
 * Probes GET /health on the FastAPI backend
 */
export async function checkBackendHealth() {
  try {
    const res = await apiClient.get("/health", { timeout: 3000 });
    const data = res.data || {};
    mockModeActive = false;
    backendMetadata = data;

    return {
      live: true,
      data,
      status: data.status || "ok",
      mode: data.mode || "live",
      dataLabel: data.data_label || "LIVE",
      nNodes: data.n_nodes ?? null,
      nEdges: data.n_edges ?? null,
      predictionsLoaded: Boolean(data.predictions_loaded),
    };
  } catch (error) {
    mockModeActive = true;
    backendMetadata = null;
    return {
      live: false,
      mode: "Sectivia Baseline Reference (Backend offline)",
      error: error.message || "Connection timeout or unreachable",
    };
  }
}

/**
 * Maps raw backend /nodes and /edges arrays into the common frontend graph format
 * Conforms to React Flow node/edge structure and Sectivia/Common data contract
 */
export function mapBackendGraphToFrontend(rawNodes = [], rawEdges = []) {
  if (!Array.isArray(rawNodes) || rawNodes.length === 0) {
    return {
      nodes: initialSupplyChainNodes,
      edges: initialSupplyChainEdges,
      summary: initialSummary,
      stats: SECTIVIA_STATS,
      sectors: SECTIVIA_SECTORS,
    };
  }

  // Group nodes by node_type / sector for clean multi-column canvas layout
  const typeColMap = {
    Supplier: 0,
    Manufacturer: 1,
    Port: 2,
    Warehouse: 3,
    Retailer: 4,
  };

  const colYCounters = [0, 0, 0, 0, 0];

  const mappedNodes = rawNodes.map((n, idx) => {
    const nodeId = String(n.node_id || `node-${idx}`);
    const nodeType = n.node_type || "Company";
    const col = typeColMap[nodeType] ?? (idx % 5);
    const yIdx = colYCounters[col]++;

    const x = 40 + col * 320;
    const y = 60 + yIdx * 130;

    const riskScore = parseFloat(n.risk_score || 0);
    const riskLevel =
      riskScore >= 0.7 ? "high" : riskScore >= 0.4 ? "medium" : "low";

    const sectorKey = (n.industry || n.sector || "industri").toLowerCase();
    const sectorInfo = SECTIVIA_SECTORS[sectorKey] || {
      name: n.industry || "General Industry",
      color: "#38bdf8",
      icon: "🏢",
    };

    return {
      id: nodeId,
      type: "custom",
      position: { x, y },
      data: {
        node_id: nodeId,
        raw_id: nodeId,
        label: n.name || nodeId,
        name: n.name || nodeId,
        ticker: n.ticker || null,
        exchange: n.exchange || null,
        country: n.country || "Global",
        region: n.region || null,
        node_type: nodeType,
        sector: sectorKey,
        sectorName: sectorInfo.name,
        sectorColor: sectorInfo.color,
        sectorIcon: sectorInfo.icon,
        segment: n.segment || nodeType,
        listed: Boolean(n.listed),
        risk_score: riskScore,
        risk: riskLevel,
        status: riskLevel === "high" ? "At Risk" : "Operational",
        data_source: n.data_source || "Backend API",
      },
    };
  });

  const validNodeIds = new Set(mappedNodes.map((n) => n.id));

  const mappedEdges = (Array.isArray(rawEdges) ? rawEdges : [])
    .filter((e) => validNodeIds.has(String(e.source)) && validNodeIds.has(String(e.target)))
    .map((e, idx) => {
      const edgeId = e.id || `edge-${e.source}->${e.target}-${idx}`;
      const leadTime = parseFloat(e.lead_time_days || 0);
      const isHighDelay = leadTime > 15;

      return {
        id: edgeId,
        source: String(e.source),
        target: String(e.target),
        label: e.route_type
          ? `${e.route_type} (${leadTime}d)`
          : (e.what ? e.what.slice(0, 24) : "SUPPLIES_TO"),
        animated: isHighDelay,
        style: {
          stroke: isHighDelay ? "#ef4444" : "#38bdf8",
          strokeWidth: isHighDelay ? 2.5 : 1.5,
        },
        data: {
          id: edgeId,
          type: "SUPPLIES_TO",
          route_type: e.route_type || "Intermodal",
          lead_time_days: leadTime,
          capacity: e.capacity ? parseFloat(e.capacity) : 10000,
          what: e.what || "Supply Flow",
          source_citation: e.source_citation || "FastAPI Pipeline",
          source_url: e.source_url || null,
          is_cross_sector: Boolean(e.is_cross_sector),
        },
      };
    });

  const totalCompanies = mappedNodes.length;
  const totalRelationships = mappedEdges.length;
  const crossSectorRelationships = mappedEdges.filter(
    (e) => e.data?.is_cross_sector
  ).length;

  return {
    nodes: mappedNodes,
    edges: mappedEdges,
    summary: {
      totalSuppliers: totalCompanies,
      totalRelationships,
      crossSectorRelationships,
      totalSectors: Object.keys(SECTIVIA_SECTORS).length,
      networkHealth: "98.2%",
    },
    stats: {
      totalCompanies,
      totalRelationships,
      crossSectorRelationships,
      totalSectors: Object.keys(SECTIVIA_SECTORS).length,
      verified: true,
      source: "FastAPI Backend Data Pipeline",
    },
    sectors: SECTIVIA_SECTORS,
  };
}

/**
 * 2. Fetch the full supply chain graph with nodes, edges, summary, and dataset stats
 * Attempts to fetch from live /nodes and /edges endpoints first;
 * falls back to Sectivia offline reference when unavailable.
 */
export async function fetchNetworkGraph() {
  try {
    const [nodesRes, edgesRes] = await Promise.all([
      apiClient.get("/nodes", { timeout: 3000 }),
      apiClient.get("/edges", { timeout: 3000 }),
    ]);

    mockModeActive = false;
    const rawNodes = Array.isArray(nodesRes.data) ? nodesRes.data : [];
    const rawEdges = Array.isArray(edgesRes.data) ? edgesRes.data : [];

    const mapped = mapBackendGraphToFrontend(rawNodes, rawEdges);
    return {
      nodes: mapped.nodes,
      edges: mapped.edges,
      summary: mapped.summary,
      stats: mapped.stats,
      sectors: mapped.sectors,
      isSimulated: false,
      datasetSource: rawNodes[0]?.data_source || "FastAPI Backend",
    };
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
      error: err.message || "Failed to reach backend endpoints",
    };
  }
}

/**
 * 3. Fetch all companies in catalog
 */
export async function fetchAllCompanies() {
  try {
    const res = await apiClient.get("/nodes", { timeout: 3000 });
    if (Array.isArray(res.data) && res.data.length > 0) {
      return res.data.map((n) => ({
        id: String(n.node_id),
        raw_id: String(n.node_id),
        name: n.name || String(n.node_id),
        ticker: n.ticker || null,
        exchange: n.exchange || null,
        country: n.country || "Global",
        sector: (n.industry || n.sector || "industri").toLowerCase(),
        sectorName: n.industry || "General",
        segment: n.segment || n.node_type || "Commercial",
        listed: Boolean(n.listed),
        relations_count: 1,
        dataset_source: n.data_source || "FastAPI",
      }));
    }
  } catch (err) {
    // Fall back to offline catalog
  }
  return SECTIVIA_COMPANIES;
}

/**
 * 4. Fetch specific details and connections for a given company/node
 */
export async function fetchNodeDetails(nodeId) {
  try {
    const response = await apiClient.get(`/nodes/${nodeId}`, { timeout: 3000 });
    if (response.data) {
      return { ...response.data, isSimulated: false };
    }
  } catch (err) {
    // Fall back to Sectivia catalog lookup
  }

  const company = SECTIVIA_COMPANIES.find(
    (c) => c.id === nodeId || c.raw_id === nodeId || c.ticker === nodeId
  );

  if (!company) {
    const activeNode = initialSupplyChainNodes.find((n) => n.id === nodeId);
    if (activeNode) return { ...activeNode.data, isSimulated: true };
    throw new Error(`Company node ${nodeId} not found in Sectivia dataset`);
  }

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

/**
 * 5. Fetch 1-hop or 2-hop Ego Network for a given company
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
 * 6. Member 3 GNN Prediction Client
 * Calls GET /predict?origin={origin}&severity={severity}&min_delay_days={minDelayDays}
 * Connects to Member 3's precomputed GNN prediction pipeline
 */
export async function fetchGnnPrediction(origin, severity = 0.7, minDelayDays = 0.5) {
  try {
    const res = await apiClient.get("/predict", {
      params: {
        origin,
        severity: Math.min(Math.max(Number(severity), 0.0), 1.0),
        min_delay_days: Number(minDelayDays),
      },
      timeout: 3000,
    });
    return {
      ...res.data,
      isSimulated: false,
    };
  } catch (err) {
    // Graceful offline fallback: simulate structured GNN prediction response
    const fallbackComp = SECTIVIA_COMPANIES.find(
      (c) => c.id === origin || c.raw_id === origin || c.ticker === origin
    );
    const originName = fallbackComp ? fallbackComp.name : origin;

    // Use downstream relationships for offline cascade estimate
    const downstreamRels = SECTIVIA_RELATIONSHIPS.filter(
      (r) => r.source === origin || r.supplier_id === origin
    );

    const affectedNodes = downstreamRels.map((rel, idx) => {
      const baseDelay = (idx + 1) * 3.5 * Number(severity);
      return {
        node_id: rel.target,
        name: rel.customer_name,
        node_type: rel.customer_sector || "Enterprise",
        delay_30d: Math.round(baseDelay * 0.5 * 10) / 10,
        delay_60d: Math.round(baseDelay * 0.85 * 10) / 10,
        delay_90d: Math.round(baseDelay * 1.2 * 10) / 10,
        at_risk: baseDelay * 1.2 >= 10.0,
      };
    });

    return {
      type: "prediction",
      data_label: "Sectivia Baseline (Offline Fallback)",
      source: "Offline topological cascade estimate",
      model: "Sectivia-BFS-Baseline",
      event: {
        origin,
        origin_name: originName,
        severity: Number(severity),
        headline: "Offline fallback disruption calculation",
        time: new Date().toISOString(),
      },
      horizons_days: [30, 60, 90],
      nodes: affectedNodes,
      isSimulated: true,
      error: err.message || "FastAPI /predict endpoint unreachable",
    };
  }
}

/**
 * 7. Member 3 Rule-Based Ripple Simulation Client
 * Calls POST /simulate-ripple with origins list
 */
export async function simulateBackendRipple(origins) {
  const formattedOrigins = Array.isArray(origins)
    ? origins.map((o) => (typeof o === "string" ? { node_id: o, severity: 0.7 } : o))
    : [{ node_id: String(origins), severity: 0.7 }];

  try {
    const res = await apiClient.post(
      "/simulate-ripple",
      { origins: formattedOrigins },
      { timeout: 3000 }
    );
    return {
      ...res.data,
      isSimulated: false,
    };
  } catch (err) {
    // Offline fallback using client-side BFS ripple
    const rootId = formattedOrigins[0]?.node_id || "sectivia:adi";
    const bfsResult = simulateRippleEffect(rootId, formattedOrigins[0]?.severity || 0.7);

    return {
      type: "ripple",
      data_label: "Sectivia Baseline (Offline Fallback)",
      source: "rule-based ripple simulation (Offline fallback)",
      event: { origins: formattedOrigins },
      horizons_days: [30, 60, 90],
      nodes: bfsResult.affectedNodeIds.map((id, idx) => ({
        node_id: id,
        name: id,
        node_type: "Company",
        delay_30d: Math.round((idx + 1) * 2.1 * 10) / 10,
        delay_60d: Math.round((idx + 1) * 3.8 * 10) / 10,
        delay_90d: Math.round((idx + 1) * 5.4 * 10) / 10,
        at_risk: (idx + 1) * 5.4 >= 10.0,
      })),
      bfsSummary: bfsResult,
      isSimulated: true,
      error: err.message || "FastAPI /simulate-ripple endpoint unreachable",
    };
  }
}

/**
 * 8. Disruption predictions across timeline horizons (for Prediction area chart)
 */
export async function fetchPredictions(horizon = "7 Days") {
  try {
    const response = await apiClient.get("/predictions", {
      params: { horizon },
      timeout: 3000,
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
 * 9. Fetch disruption alerts
 */
export async function fetchAlerts() {
  try {
    const response = await apiClient.get("/alerts", { timeout: 3000 });
    return response.data;
  } catch (err) {
    return initialAlerts;
  }
}

/**
 * 10. Local BFS ripple simulation along directed SUPPLIES_TO edges
 */
export function simulateRippleEffect(rootNodeId, severityMultiplier = 1.3) {
  const affectedNodeIds = new Set([rootNodeId]);
  const queue = [rootNodeId];
  const rippleEdges = [];

  while (queue.length > 0) {
    const current = queue.shift();
    const downstreamRels = SECTIVIA_RELATIONSHIPS.filter(
      (r) => r.source === current
    );

    for (const rel of downstreamRels) {
      if (!affectedNodeIds.has(rel.target)) {
        affectedNodeIds.add(rel.target);
        rippleEdges.push(rel.id);
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

export function getBackendMetadata() {
  return backendMetadata;
}
