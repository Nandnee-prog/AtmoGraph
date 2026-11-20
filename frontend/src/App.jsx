import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import "./App.css";
import Prediction from "./Prediction";
import { LoadingSkeleton } from "./components/LoadingSkeleton";
import { ErrorBanner } from "./components/ErrorBanner";
import { EmptyState } from "./components/EmptyState";
import {
  fetchNetworkGraph,
  fetchAlerts,
  simulateRippleEffect,
} from "./services/api";
import {
  NODE_TYPES,
  initialSupplyChainNodes,
  initialSupplyChainEdges,
  initialAlerts,
  initialSummary,
} from "./data/mockData";

function CustomNode({ data, selected }) {
  const isRipple = data.isRippleAffected;
  return (
    <div
      className={`custom-node ${data.risk} ${selected ? "selected" : ""} ${
        isRipple ? "ripple-affected" : ""
      }`}
      role="button"
      tabIndex={0}
      aria-label={`${data.label}, ${data.node_type || data.type}, Risk: ${data.risk}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (data.onSelect) data.onSelect();
        }
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div className="node-header">
        <span className="node-icon" aria-hidden="true">
          {data.icon || "📦"}
        </span>
        <span className={`risk-badge ${data.risk}`}>
          {(data.risk || "low").toUpperCase()}
        </span>
      </div>
      <div className="node-name">{data.label}</div>
      <div className="node-meta">
        <span className="node-type">{data.node_type || data.type}</span>
        {data.country && (
          <span className="node-country">· {data.country}</span>
        )}
      </div>
      <div className="node-footer">
        <span className="node-indicator"></span>
        <span>{data.status}</span>
        {isRipple && <span className="ripple-badge">⚡ RIPPLE</span>}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialSupplyChainNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialSupplyChainEdges);
  const [alerts, setAlerts] = useState(initialAlerts);
  const [summary, setSummary] = useState(initialSummary);

  const [riskFilter, setRiskFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const searchInputRef = useRef(null);

  const [theme, setTheme] = useState(
    () => localStorage.getItem("atmograph-theme") || "system"
  );

  // Sync theme attribute to HTML root
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    localStorage.setItem("atmograph-theme", theme);
  }, [theme]);

  // Keyboard accessibility shortcuts (Escape to clear, / or Ctrl+K to search)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setSelectedNode(null);
        setSelectedEdge(null);
        if (simulation) handleClearSimulation();
      } else if (
        (e.key === "/" || (e.ctrlKey && e.key.toLowerCase() === "k")) &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "SELECT"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [simulation]);

  // Initial data load via API service
  const loadData = useCallback(() => {
    setIsLoading(true);
    setError(null);

    Promise.all([fetchNetworkGraph(), fetchAlerts()])
      .then(([graphData, alertsData]) => {
        if (graphData && graphData.nodes) {
          setNodes(graphData.nodes);
          setEdges(graphData.edges);
          if (graphData.summary) {
            setSummary(graphData.summary);
          }
        }
        if (alertsData) {
          setAlerts(alertsData);
        }
      })
      .catch((err) => {
        console.warn("API Service running in fallback mode:", err);
        setError("Unable to connect to live telemetry API. Running in simulated fallback mode.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [setNodes, setEdges]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculate live dynamic risk counts
  const riskCounts = useMemo(
    () => ({
      high: nodes.filter((n) => n.data?.risk === "high").length,
      medium: nodes.filter((n) => n.data?.risk === "medium").length,
      low: nodes.filter((n) => n.data?.risk === "low").length,
    }),
    [nodes]
  );

  // Apply multi-criteria filtering: Risk + Node Type + Search Query
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      const data = n.data || {};
      const matchesRisk =
        riskFilter === "all" || data.risk === riskFilter;
      const matchesType =
        typeFilter === "all" ||
        data.node_type === typeFilter ||
        data.type === typeFilter;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        (data.label && data.label.toLowerCase().includes(query)) ||
        (data.name && data.name.toLowerCase().includes(query)) ||
        (data.country && data.country.toLowerCase().includes(query)) ||
        (data.industry && data.industry.toLowerCase().includes(query));

      return matchesRisk && matchesType && matchesSearch;
    });
  }, [nodes, riskFilter, typeFilter, searchQuery]);

  const visibleIds = useMemo(
    () => new Set(filteredNodes.map((n) => n.id)),
    [filteredNodes]
  );

  // Filter edges to only connect visible nodes
  const filteredEdges = useMemo(() => {
    return edges
      .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
      .map((e) => {
        const isRipple = simulation && simulation.rippleEdgeIds.includes(e.id);
        const isSelected = selectedEdge && selectedEdge.id === e.id;
        if (isRipple) {
          return {
            ...e,
            animated: true,
            style: { ...e.style, stroke: "#ef4444", strokeWidth: 3.5 },
          };
        }
        if (isSelected) {
          return {
            ...e,
            style: { ...e.style, stroke: "var(--accent)", strokeWidth: 3 },
          };
        }
        return e;
      });
  }, [edges, visibleIds, simulation, selectedEdge]);

  const handleFilter = (filter) => {
    setRiskFilter(filter);
    setSelectedNode(null);
    setSelectedEdge(null);
  };

  const handleTypeFilter = (type) => {
    setTypeFilter(type);
    setSelectedNode(null);
    setSelectedEdge(null);
  };

  const handleResetFilters = () => {
    setRiskFilter("all");
    setTypeFilter("all");
    setSearchQuery("");
    setSelectedNode(null);
    setSelectedEdge(null);
  };

  const handleNodeClick = useCallback((_, node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  }, []);

  const handleEdgeClick = useCallback((_, edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  }, []);

  const handlePaneClick = useCallback(() => {
    // Keep selection if clicked directly, or deselect if canvas background
  }, []);

  // Run Ripple Effect Simulation
  const handleTriggerSimulation = (nodeId) => {
    const result = simulateRippleEffect(nodeId);
    setSimulation(result);

    // Annotate nodes with ripple state
    setNodes((prevNodes) =>
      prevNodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isRippleAffected: result.affectedNodeIds.includes(n.id),
        },
      }))
    );
  };

  const handleClearSimulation = () => {
    setSimulation(null);
    setNodes((prevNodes) =>
      prevNodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isRippleAffected: false,
        },
      }))
    );
  };

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <div className="app">
      {/* Accessibility Skip Link */}
      <a href="#dashboard" className="skip-link">
        Skip to main dashboard content
      </a>

      {/* Screen Reader Live Region for Filtering Announcements */}
      <div className="sr-only" role="status" aria-live="polite">
        Showing {filteredNodes.length} supply chain nodes. Risk filter: {riskFilter}. Facility filter: {typeFilter}.
      </div>

      {/* Mobile navigation backdrop */}
      {mobileMenuOpen && (
        <div
          className="mobile-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-top">
          <h2 className="logo">
            Atmo<span>Graph</span>
          </h2>
          <button
            className="mobile-close-btn"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
          >
            ✕
          </button>
        </div>

        <p className="side-label">WORKSPACE</p>

        <nav aria-label="Main Navigation">
          <a
            className="active"
            href="#dashboard"
            onClick={() => setMobileMenuOpen(false)}
          >
            ▦ Dashboard
          </a>
          <a
            href="#network"
            onClick={() => setMobileMenuOpen(false)}
          >
            ◎ Supply Chain Network
          </a>
          <a
            href="#risk"
            onClick={() => setMobileMenuOpen(false)}
          >
            ⚠ Risk Analysis
          </a>
          <a
            href="#predictions"
            onClick={() => setMobileMenuOpen(false)}
          >
            ◷ Predictions
          </a>
          <a
            href="#alerts"
            onClick={() => setMobileMenuOpen(false)}
          >
            ♧ Disruption Alerts
          </a>
        </nav>

        <div className="sidebar-bottom">
          <p>SUPPLY CHAIN INTELLIGENCE</p>
          <small>Graph Neural Network & Predictive Modeling</small>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main" id="dashboard">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="menu-toggle-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              ☰
            </button>
            <div>
              <span className="breadcrumb">Workspace / Dashboard</span>
              <h2>Dashboard Overview</h2>
            </div>
          </div>

          <div className="topbar-actions">
            <div className="theme-toggle-group">
              <label className="theme-label" htmlFor="theme-select">
                Theme
              </label>
              <select
                id="theme-select"
                className="theme-select"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                aria-label="Select appearance theme"
              >
                <option value="system">System (Auto)</option>
                <option value="light">Light Mode</option>
                <option value="dark">Dark Mode</option>
              </select>
            </div>

            <div className="status" title="Data layer is active and verified">
              <span className="status-dot"></span>
              <span>Online · Simulated Demo</span>
            </div>
          </div>
        </header>

        {/* Welcome Section */}
        <section className="welcome" aria-labelledby="welcome-heading">
          <div>
            <h1 id="welcome-heading">Supply Chain Intelligence</h1>
            <p>
              Monitor multi-tier networks, isolate single points of failure, and predict ripple disruptions.
            </p>
          </div>
          <span className="date">ATMOGRAPH · LIVE MONITORING</span>
        </section>

        {/* Error Banner if connection fails */}
        {error && <ErrorBanner message={error} onRetry={loadData} />}

        {/* Summary Stat Cards */}
        {isLoading ? (
          <LoadingSkeleton count={4} />
        ) : (
          <section className="stats" aria-label="Key Performance Metrics">
            <div className="stat-card">
              <p>Total Suppliers</p>
              <h2>{summary.totalSuppliers}</h2>
              <small>Across monitored tier-1 to tier-5 networks</small>
            </div>
            <div className="stat-card">
              <p>High Risk Nodes</p>
              <h2 className="red">{riskCounts.high}</h2>
              <small>Require immediate contingency routing</small>
            </div>
            <div className="stat-card">
              <p>Active Alerts</p>
              <h2 className="orange">{alerts.length}</h2>
              <small>Disruption notices under triage</small>
            </div>
            <div className="stat-card">
              <p>Network Health</p>
              <h2 className="green">{summary.networkHealth}</h2>
              <small>Overall topological graph resilience</small>
            </div>
          </section>
        )}

        {/* Risk Overview & Interactive Filter Cards */}
        <section className="risk-overview" id="risk" aria-labelledby="risk-analysis-heading">
          <div className="section-title">
            <h2 id="risk-analysis-heading">Risk Analysis</h2>
            <p>Classify and filter nodes by vulnerability index</p>
          </div>

          <div className="risk-cards" role="radiogroup" aria-label="Filter by Risk Level">
            {[
              ["high", "HIGH RISK", riskCounts.high, "Critical bottleneck vulnerability"],
              ["medium", "MEDIUM RISK", riskCounts.medium, "Elevated transit latency"],
              ["low", "LOW RISK", riskCounts.low, "Resilient and operational"],
              ["all", "ALL NODES", nodes.length, "Total multi-tier network"],
            ].map(([level, label, count, description]) => (
              <button
                key={level}
                role="radio"
                aria-checked={riskFilter === level}
                className={`risk-card ${level}-card ${
                  riskFilter === level ? "active-risk" : ""
                }`}
                onClick={() => handleFilter(level)}
              >
                <span>{label}</span>
                <strong>{count}</strong>
                <small>{description}</small>
              </button>
            ))}
          </div>
        </section>

        {/* Simulation Notification Banner */}
        {simulation && (
          <div className="simulation-banner" role="status" aria-live="polite">
            <div className="simulation-banner-info">
              <span className="simulation-badge">⚡ RIPPLE SIMULATION ACTIVE</span>
              <p>
                Propagating from <strong>Node {simulation.rootNodeId}</strong>:{" "}
                <strong>{simulation.affectedCount} nodes</strong> affected. Estimated
                cumulative supply-chain delay:{" "}
                <strong>+{simulation.estimatedTotalDelayDays} days</strong>.
              </p>
            </div>
            <button
              className="clear-sim-btn"
              onClick={handleClearSimulation}
              aria-label="Clear simulation ripple effect"
            >
              Reset Simulation
            </button>
          </div>
        )}

        {/* Main Content Grid: Interactive Graph & Inspector Panel */}
        <section className="content-grid" id="network">
          {/* Left Panel: Graph Canvas & Search/Filters */}
          <div className="panel network-panel">
            <div className="panel-heading">
              <div>
                <h3>Supply Chain Topology Network</h3>
                <p>Interactive multi-tier graph visualization</p>
              </div>
              <span className="tag">GNN TOPOLOGY</span>
            </div>

            {/* Search and Multi-Criteria Filtering Bar */}
            <div className="search-filter-section">
              <div className="search-box">
                <span className="search-icon" aria-hidden="true">🔍</span>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search by facility name, country, or industry (Press '/' to focus)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                  aria-label="Search supply chain nodes"
                />
                {searchQuery && (
                  <button
                    className="clear-search-btn"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search text"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Node Type Filtering Chips */}
              <div className="type-filter-bar" role="group" aria-label="Filter by Node Type">
                <span className="type-filter-label">Facility Type:</span>
                {["all", ...Object.values(NODE_TYPES)].map((type) => (
                  <button
                    key={type}
                    className={`type-chip ${typeFilter === type ? "active" : ""}`}
                    onClick={() => handleTypeFilter(type)}
                    aria-pressed={typeFilter === type}
                  >
                    {type === "all" ? "All Types" : type}
                  </button>
                ))}
              </div>

              {/* Active Filter Metrics & Reset Action */}
              <div className="filter-summary">
                <span>
                  Showing <strong>{filteredNodes.length}</strong> of{" "}
                  <strong>{nodes.length}</strong> nodes
                  {riskFilter !== "all" && ` · Risk: ${riskFilter}`}
                  {typeFilter !== "all" && ` · Type: ${typeFilter}`}
                  {searchQuery && ` · Search: "${searchQuery}"`}
                </span>
                {(riskFilter !== "all" ||
                  typeFilter !== "all" ||
                  searchQuery) && (
                  <button
                    className="reset-filters-btn"
                    onClick={handleResetFilters}
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>

            {/* Interactive Graph Canvas */}
            <div className="network-canvas" aria-label="Interactive Supply Chain Graph Canvas">
              {filteredNodes.length === 0 ? (
                <EmptyState
                  icon="🔍"
                  title="No matching facilities found"
                  description="No supply chain nodes match the current filter criteria. Try clearing your search or selecting a different risk category."
                  actionText="Reset All Filters"
                  onAction={handleResetFilters}
                />
              ) : (
                <ReactFlow
                  nodes={filteredNodes}
                  edges={filteredEdges}
                  nodeTypes={nodeTypes}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodeClick={handleNodeClick}
                  onEdgeClick={handleEdgeClick}
                  onPaneClick={handlePaneClick}
                  fitView
                  fitViewOptions={{ padding: 0.2 }}
                >
                  <Background
                    color={isDark ? "#334155" : "#cbd5e1"}
                    gap={20}
                  />
                  <Controls aria-label="Graph zoom and viewport controls" />
                  <MiniMap
                    nodeColor={(node) => {
                      const risk = node.data?.risk;
                      if (risk === "high") return "#ef4444";
                      if (risk === "medium") return "#f97316";
                      return "#22c55e";
                    }}
                    maskColor={
                      isDark
                        ? "rgba(11, 17, 32, 0.75)"
                        : "rgba(226, 232, 240, 0.65)"
                    }
                  />
                </ReactFlow>
              )}
            </div>

            {/* Graph Legend */}
            <div className="network-legend" aria-label="Graph Risk and Route Legend">
              <div className="legend-group">
                <span>
                  <i className="legend-high"></i> High Risk (Score &gt; 70)
                </span>
                <span>
                  <i className="legend-medium"></i> Medium Risk (Score 40-70)
                </span>
                <span>
                  <i className="legend-low"></i> Low Risk (Score &lt; 40)
                </span>
              </div>
              <div className="legend-hint">
                💡 Click any node or route edge to inspect detailed telemetry.
              </div>
            </div>
          </div>

          {/* Right Panel: Selected Node / Edge Details */}
          <div className="panel details-panel">
            {selectedNode ? (
              <div className="selected-details" aria-labelledby="node-details-title">
                <div className="details-header-row">
                  <div className="detail-icon" aria-hidden="true">
                    {selectedNode.data.icon || "📦"}
                  </div>
                  <div>
                    <span className="detail-tier-badge">
                      {selectedNode.data.tier || "Tier 1"}
                    </span>
                    <h2 id="node-details-title">{selectedNode.data.label}</h2>
                    <p className="detail-official-name">
                      {selectedNode.data.name}
                    </p>
                  </div>
                </div>

                <div className={`detail-risk ${selectedNode.data.risk}`}>
                  {(selectedNode.data.risk || "LOW").toUpperCase()} RISK
                  {selectedNode.data.isRippleAffected && " · RIPPLE IMPACT"}
                </div>

                {selectedNode.data.description && (
                  <p className="detail-description">
                    {selectedNode.data.description}
                  </p>
                )}

                <div className="detail-grid">
                  <div className="detail-row">
                    <span>Facility Type</span>
                    <strong>{selectedNode.data.node_type || selectedNode.data.type}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Location / Region</span>
                    <strong>
                      {selectedNode.data.country} ({selectedNode.data.region || "Global"})
                    </strong>
                  </div>
                  <div className="detail-row">
                    <span>Industry Sector</span>
                    <strong>{selectedNode.data.industry || "General"}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Risk Score</span>
                    <strong>{selectedNode.data.score || Math.round((selectedNode.data.risk_score || 0) * 100)} / 100</strong>
                  </div>
                  <div className="detail-row">
                    <span>Operational Status</span>
                    <strong>{selectedNode.data.status}</strong>
                  </div>
                  {selectedNode.data.lead_time_days && (
                    <div className="detail-row">
                      <span>Base Lead Time</span>
                      <strong>{selectedNode.data.lead_time_days} days</strong>
                    </div>
                  )}
                  {selectedNode.data.capacity && (
                    <div className="detail-row">
                      <span>Monthly Output Capacity</span>
                      <strong>{selectedNode.data.capacity.toLocaleString()} units</strong>
                    </div>
                  )}
                </div>

                <div className="score-track-container">
                  <div className="score-track-label">
                    <span>Vulnerability Severity</span>
                    <span>{selectedNode.data.score || 50}%</span>
                  </div>
                  <div className="score-track">
                    <div
                      className={`score-fill ${selectedNode.data.risk}`}
                      style={{
                        width: `${selectedNode.data.score || 50}%`,
                      }}
                    />
                  </div>
                </div>

                {selectedNode.data.bottlenecks &&
                  selectedNode.data.bottlenecks.length > 0 && (
                    <div className="bottlenecks-box">
                      <span className="bottlenecks-title">⚠️ Identified Vulnerabilities:</span>
                      <ul>
                        {selectedNode.data.bottlenecks.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                {/* Simulation Action */}
                <div className="node-actions">
                  <button
                    className="simulate-node-btn"
                    onClick={() => handleTriggerSimulation(selectedNode.id)}
                    aria-label={`Simulate ripple effect from ${selectedNode.data.label}`}
                  >
                    ⚡ Simulate Failure Ripple
                  </button>
                  <button
                    className="deselect-btn"
                    onClick={() => setSelectedNode(null)}
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            ) : selectedEdge ? (
              <div className="selected-details" aria-labelledby="edge-details-title">
                <div className="details-header-row">
                  <div className="detail-icon" aria-hidden="true">
                    🚚
                  </div>
                  <div>
                    <span className="detail-tier-badge">Logistics Route</span>
                    <h2 id="edge-details-title">{selectedEdge.label || "Supply Route"}</h2>
                    <p className="detail-official-name">
                      Route ID: {selectedEdge.id}
                    </p>
                  </div>
                </div>

                <div
                  className={`detail-risk ${
                    selectedEdge.data?.risk || "low"
                  }`}
                >
                  {(selectedEdge.data?.risk || "OPTIMAL").toUpperCase()} ROUTE
                </div>

                <div className="detail-grid">
                  <div className="detail-row">
                    <span>Transport Mode</span>
                    <strong>{selectedEdge.data?.route_type || "Intermodal"}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Source Node</span>
                    <strong>{selectedEdge.source}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Destination Node</span>
                    <strong>{selectedEdge.target}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Transit Time</span>
                    <strong>{selectedEdge.data?.lead_time_days || 7} days</strong>
                  </div>
                  <div className="detail-row">
                    <span>Route Capacity</span>
                    <strong>
                      {(selectedEdge.data?.capacity || 10000).toLocaleString()} TEU/mo
                    </strong>
                  </div>
                  <div className="detail-row">
                    <span>Transferred Cargo</span>
                    <strong>{selectedEdge.data?.materials || "Components"}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Flow Status</span>
                    <strong>{selectedEdge.data?.status || "Active Transit"}</strong>
                  </div>
                </div>

                <div className="node-actions">
                  <button
                    className="deselect-btn"
                    onClick={() => setSelectedEdge(null)}
                  >
                    Close Route Inspector
                  </button>
                </div>
              </div>
            ) : (
              <EmptyState
                icon="◎"
                title="No Entity Selected"
                description="Click any supplier, plant, port, warehouse, or transport corridor in the graph to inspect detailed real-time telemetry."
              />
            )}
          </div>
        </section>

        {/* Prediction Section */}
        <section id="predictions">
          <Prediction />
        </section>

        {/* Recent Alerts Panel */}
        <section className="panel alerts-panel" id="alerts" aria-labelledby="alerts-title">
          <div className="panel-heading">
            <div>
              <h3 id="alerts-title">Disruption Alerts & Risk Notifications</h3>
              <p className="panel-subtitle">Real-time alerts identified by pipeline monitoring</p>
            </div>
            <span className="tag">LIVE FEED</span>
          </div>

          <div className="alerts-list">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`alert-item ${alert.severity}`}
                role="article"
              >
                <span
                  className={`alert-dot ${alert.severity}`}
                  aria-hidden="true"
                ></span>
                <div className="alert-content">
                  <div className="alert-header">
                    <strong>{alert.title}</strong>
                    <span className="alert-time">{alert.timestamp}</span>
                  </div>
                  <p>{alert.description}</p>
                  <div className="alert-meta">
                    <span className="alert-horizon">
                      ⏱ Impact Horizon: {alert.impactHorizon}
                    </span>
                    {alert.rippleAffectedCount > 0 && (
                      <span className="alert-ripple-count">
                        ⚡ {alert.rippleAffectedCount} downstream nodes at risk
                      </span>
                    )}
                  </div>
                </div>
                {alert.nodeId && (
                  <button
                    className="alert-inspect-btn"
                    onClick={() => {
                      const target = nodes.find((n) => n.id === alert.nodeId);
                      if (target) {
                        setSelectedNode(target);
                        setSelectedEdge(null);
                        const el = document.getElementById("network");
                        if (el) el.scrollIntoView({ behavior: "smooth" });
                      }
                    }}
                    aria-label={`Inspect ${alert.title}`}
                  >
                    Inspect Node
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
