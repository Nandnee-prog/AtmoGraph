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
  fetchAllCompanies,
  fetchNodeDetails,
  buildEgoNetwork,
  simulateRippleEffect,
} from "./services/api";
import {
  SECTIVIA_STATS,
  SECTIVIA_SECTORS,
  SECTIVIA_COMPANIES,
  SECTIVIA_RELATIONSHIPS,
  initialSupplyChainNodes,
  initialSupplyChainEdges,
  initialAlerts,
  initialSummary,
} from "./data/sectiviaData";

/**
 * Custom Node component styled for Sectivia corporate entities
 * Shows company ticker/name, sector color bar, sector icon, and risk/hub status
 */
function CustomNode({ data, selected }) {
  const isRipple = data.isRippleAffected;
  const sectorColor = data.sectorColor || "#38bdf8";

  return (
    <div
      className={`custom-node ${data.risk || "low"} ${selected ? "selected" : ""} ${
        isRipple ? "ripple-affected" : ""
      } ${data.isRoot ? "root-node" : ""}`}
      style={{
        borderLeft: `4px solid ${sectorColor}`,
      }}
      role="button"
      tabIndex={0}
      aria-label={`${data.name || data.label}, Sector: ${data.sectorName || data.sector}, Ticker: ${data.ticker || "Private"}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (data.onSelect) data.onSelect();
        }
      }}
    >
      {/* Incoming edge handle: Upstream Supplier */}
      <Handle
        type="target"
        position={Position.Left}
        aria-label="Supplied By (Upstream)"
      />

      <div className="node-header">
        <span className="node-icon" aria-hidden="true">
          {data.sectorIcon || "🏢"}
        </span>
        <span
          className="sector-pill"
          style={{
            backgroundColor: `${sectorColor}22`,
            color: sectorColor,
            borderColor: `${sectorColor}55`,
          }}
        >
          {data.ticker || (data.sector || "CORP").toUpperCase()}
        </span>
      </div>

      <div className="node-name" title={data.name}>
        {data.label || data.name}
      </div>

      <div className="node-meta">
        <span className="node-type" style={{ color: sectorColor }}>
          {data.sectorName || data.sector}
        </span>
        {data.country && (
          <span className="node-country"> · {data.country}</span>
        )}
      </div>

      <div className="node-footer">
        <span
          className="node-indicator"
          style={{ backgroundColor: sectorColor }}
        ></span>
        <span>
          {data.relations_count ? `${data.relations_count} links` : data.status || "Operational"}
        </span>
        {isRipple && <span className="ripple-badge">⚡ RIPPLE</span>}
        {data.isRoot && <span className="root-badge">🎯 FOCUS</span>}
      </div>

      {/* Outgoing edge handle: Downstream Customer */}
      <Handle
        type="source"
        position={Position.Right}
        aria-label="Supplies To (Downstream)"
      />
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

function App() {
  // Navigation tabs: 'overview' | 'network' | 'companies' | 'analytics' | 'about'
  const [activeTab, setActiveTab] = useState("overview");

  // Graph state
  const [nodes, setNodes, onNodesChange] = useNodesState(initialSupplyChainNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialSupplyChainEdges);
  const [alerts, setAlerts] = useState(initialAlerts);
  const [summary, setSummary] = useState(initialSummary);
  const [stats, setStats] = useState(SECTIVIA_STATS);

  // Filters & exploration
  const [selectedSector, setSelectedSector] = useState("all");
  const [crossSectorOnly, setCrossSectorOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedNodeDetails, setSelectedNodeDetails] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [egoNetworkActive, setEgoNetworkActive] = useState(null);
  const [rfInstance, setRfInstance] = useState(null);

  // Loading & status
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const searchInputRef = useRef(null);

  // Theme preference
  const [theme, setTheme] = useState(
    () => localStorage.getItem("atmograph-theme") || "system"
  );

  // Sync theme attribute to HTML root
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    localStorage.setItem("atmograph-theme", theme);
  }, [theme]);

  // Keyboard shortcuts (Escape to clear, / or Ctrl+K to search)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setSelectedNode(null);
        setSelectedNodeDetails(null);
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

  // Load data via API service
  const loadData = useCallback(() => {
    setIsLoading(true);
    setError(null);

    Promise.all([fetchNetworkGraph(), fetchAlerts()])
      .then(([graphData, alertsData]) => {
        if (graphData && graphData.nodes) {
          setNodes(graphData.nodes);
          setEdges(graphData.edges);
          if (graphData.summary) setSummary(graphData.summary);
          if (graphData.stats) setStats(graphData.stats);
        }
        if (alertsData) setAlerts(alertsData);
      })
      .catch((err) => {
        console.warn("API Service running in fallback Sectivia mode:", err);
        setError("Operating in Sectivia Baseline mode (backend server offline).");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [setNodes, setEdges]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Fetch full details whenever a node is selected
  useEffect(() => {
    if (selectedNode) {
      fetchNodeDetails(selectedNode.id)
        .then((details) => setSelectedNodeDetails(details))
        .catch(() => setSelectedNodeDetails(selectedNode.data));
    } else {
      setSelectedNodeDetails(null);
    }
  }, [selectedNode]);

  // Apply filters: Sector + Cross-Sector + Search Query
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      const data = n.data || {};
      const matchesSector =
        selectedSector === "all" || data.sector === selectedSector;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        (data.label && data.label.toLowerCase().includes(query)) ||
        (data.name && data.name.toLowerCase().includes(query)) ||
        (data.ticker && data.ticker.toLowerCase().includes(query)) ||
        (data.country && data.country.toLowerCase().includes(query)) ||
        (data.sectorName && data.sectorName.toLowerCase().includes(query)) ||
        (data.segment && data.segment.toLowerCase().includes(query));

      return matchesSector && matchesSearch;
    });
  }, [nodes, selectedSector, searchQuery]);

  const visibleIds = useMemo(
    () => new Set(filteredNodes.map((n) => n.id)),
    [filteredNodes]
  );

  // Filter edges to only connect visible nodes
  const filteredEdges = useMemo(() => {
    return edges
      .filter((e) => {
        const connected = visibleIds.has(e.source) && visibleIds.has(e.target);
        if (!connected) return false;
        if (crossSectorOnly) return e.data?.is_cross_sector;
        return true;
      })
      .map((e) => {
        const isRipple = simulation && simulation.rippleEdgeIds.includes(e.id);
        const isSelected = selectedEdge && selectedEdge.id === e.id;
        const isCross = e.data?.is_cross_sector;

        if (isRipple) {
          return {
            ...e,
            animated: true,
            style: { ...e.style, stroke: "#ef4444", strokeWidth: 3.5 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#ef4444",
            },
          };
        }
        if (isSelected) {
          return {
            ...e,
            style: { ...e.style, stroke: "var(--accent)", strokeWidth: 3 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "var(--accent)",
            },
          };
        }

        return {
          ...e,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isCross ? "#38bdf8" : "#64748b",
            width: 14,
            height: 14,
          },
        };
      });
  }, [edges, visibleIds, simulation, selectedEdge, crossSectorOnly]);

  const handleFitView = useCallback(() => {
    if (rfInstance) {
      rfInstance.fitView({ padding: 0.2, duration: 400 });
    }
  }, [rfInstance]);

  const handleExportJson = useCallback(() => {
    const exportData = {
      nodes: filteredNodes,
      edges: filteredEdges,
      filter: { sector: selectedSector, crossSectorOnly, search: searchQuery },
      exportedAt: new Date().toISOString(),
      datasetSource: "Sectivia",
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sectivia-supply-chain-${selectedSector}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [filteredNodes, filteredEdges, selectedSector, crossSectorOnly, searchQuery]);

  const handleResetFilters = () => {
    setSelectedSector("all");
    setCrossSectorOnly(false);
    setSearchQuery("");
    setSelectedNode(null);
    setSelectedNodeDetails(null);
    setSelectedEdge(null);
    if (egoNetworkActive) handleResetToBackbone();
  };

  const handleNodeClick = useCallback((_, node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  }, []);

  const handleEdgeClick = useCallback((_, edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
    setSelectedNodeDetails(null);
  }, []);

  // Run Ripple Effect Simulation
  const handleTriggerSimulation = (nodeId) => {
    const result = simulateRippleEffect(nodeId);
    setSimulation(result);

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

  // Switch to Ego-Network mode for a specific company
  const handleExploreEgoNetwork = (companyId) => {
    const ego = buildEgoNetwork(companyId, 1);
    if (ego) {
      setEgoNetworkActive(ego.root.name);
      setNodes(ego.nodes);
      setEdges(ego.edges);
      setSelectedSector("all");
      const rootNode = ego.nodes.find((n) => n.id === ego.root.id);
      if (rootNode) setSelectedNode(rootNode);
      setTimeout(() => {
        if (rfInstance) rfInstance.fitView({ padding: 0.2, duration: 400 });
      }, 50);
    }
  };

  // Reset from Ego-Network back to the curated multi-sector backbone
  const handleResetToBackbone = () => {
    setEgoNetworkActive(null);
    setNodes(initialSupplyChainNodes);
    setEdges(initialSupplyChainEdges);
    setTimeout(() => {
      if (rfInstance) rfInstance.fitView({ padding: 0.2, duration: 400 });
    }, 50);
  };

  // Quick action from Companies Directory: Select company and switch to Network tab
  const handleInspectCompanyFromDirectory = (company) => {
    handleExploreEgoNetwork(company.id);
    setActiveTab("network");
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

      {/* Screen Reader Live Region for Announcements */}
      <div className="sr-only" role="status" aria-live="polite">
        Showing {filteredNodes.length} supply chain nodes from Sectivia dataset.
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
          <div>
            <h2 className="logo">
              Atmo<span>Graph</span>
            </h2>
            <p className="logo-subtitle">Supply Chain Intelligence Platform</p>
          </div>
          <button
            className="mobile-close-btn"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
          >
            ✕
          </button>
        </div>

        <p className="side-label">PLATFORM NAVIGATION</p>

        <nav aria-label="Main Navigation">
          <button
            className={`nav-btn ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("overview");
              setMobileMenuOpen(false);
            }}
          >
            <span className="nav-icon" aria-hidden="true">▦</span>
            Overview
          </button>

          <button
            className={`nav-btn ${activeTab === "network" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("network");
              setMobileMenuOpen(false);
            }}
          >
            <span className="nav-icon" aria-hidden="true">◎</span>
            Supply Chain Network
          </button>

          <button
            className={`nav-btn ${activeTab === "companies" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("companies");
              setMobileMenuOpen(false);
            }}
          >
            <span className="nav-icon" aria-hidden="true">🏛️</span>
            Companies
          </button>

          <button
            className={`nav-btn ${activeTab === "analytics" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("analytics");
              setMobileMenuOpen(false);
            }}
          >
            <span className="nav-icon" aria-hidden="true">📊</span>
            Analytics
          </button>

          <button
            className={`nav-btn ${activeTab === "about" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("about");
              setMobileMenuOpen(false);
            }}
          >
            <span className="nav-icon" aria-hidden="true">ℹ️</span>
            About
          </button>
        </nav>

        <div className="sidebar-dataset-box">
          <span className="dataset-label">PRIMARY DATASET</span>
          <strong>Sectivia Ground Truth</strong>
          <p>382 Companies · 556 Relationships · SEC EDGAR Filings</p>
        </div>

        <div className="sidebar-bottom">
          <p>ATMOGRAPH PLATFORM</p>
          <small>Member 4: Frontend & Dashboard</small>
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
              <span className="breadcrumb">
                AtmoGraph / {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </span>
              <h2>
                {activeTab === "overview" && "Executive Dashboard Overview"}
                {activeTab === "network" && "Interactive Supply Chain Topology"}
                {activeTab === "companies" && "Sectivia Companies Directory"}
                {activeTab === "analytics" && "Supply Chain Risk Analytics"}
                {activeTab === "about" && "About AtmoGraph & Data Architecture"}
              </h2>
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

            <div
              className="status"
              title="Verified Sectivia dataset loaded from database integration contract"
            >
              <span className="status-dot"></span>
              <span>Sectivia Baseline · Verified</span>
            </div>
          </div>
        </header>

        {/* Welcome Banner */}
        <section className="welcome" aria-labelledby="welcome-heading">
          <div>
            <h1 id="welcome-heading">Supply Chain Intelligence</h1>
            <p>
              Interactive supply chain monitoring powered by the verified Sectivia
              dataset: 382 corporations, 556 supplier-to-customer flows, and 162 cross-sector links.
            </p>
          </div>
          <span className="date">SECTIVIA · VERIFIED BASELINE</span>
        </section>

        {/* Error / Offline Banner */}
        {error && <ErrorBanner message={error} onRetry={loadData} />}

        {/* Sectivia Key Statistics Cards */}
        {isLoading ? (
          <LoadingSkeleton count={4} />
        ) : (
          <section className="stats" aria-label="Key Performance Metrics">
            <div className="stat-card" tabIndex={0}>
              <div className="stat-card-header">
                <p>Total Companies</p>
                <span className="stat-icon" aria-hidden="true">🏢</span>
              </div>
              <h2>{stats.totalCompanies}</h2>
              <small>381 U.S.-listed corporations, 1 private (SpaceX)</small>
              <div className="stat-card-badge">Total Suppliers: 382</div>
            </div>

            <div className="stat-card" tabIndex={0}>
              <div className="stat-card-header">
                <p>Supplier-Customer Relationships</p>
                <span className="stat-icon" aria-hidden="true">🔄</span>
              </div>
              <h2 className="cyan">{stats.totalRelationships}</h2>
              <small>Verified directed SUPPLIES_TO contracts</small>
              <div className="stat-card-badge">High Risk Nodes: 18</div>
            </div>

            <div className="stat-card" tabIndex={0}>
              <div className="stat-card-header">
                <p>Cross-Sector Relationships</p>
                <span className="stat-icon" aria-hidden="true">⚡</span>
              </div>
              <h2 className="orange">{stats.crossSectorRelationships}</h2>
              <small>Critical inter-industry dependencies</small>
              <div className="stat-card-badge">Active Alerts: {alerts.length}</div>
            </div>

            <div className="stat-card" tabIndex={0}>
              <div className="stat-card-header">
                <p>Total Sectors</p>
                <span className="stat-icon" aria-hidden="true">🌐</span>
              </div>
              <h2 className="green">{stats.totalSectors}</h2>
              <small>Across 61 specialized sub-segments</small>
              <div className="stat-card-badge">Network Health: {summary.networkHealth}</div>
            </div>
          </section>
        )}

        {/* Simulation Notification Banner */}
        {simulation && (
          <div className="simulation-banner" role="status" aria-live="polite">
            <div className="simulation-banner-info">
              <span className="simulation-badge">⚡ RIPPLE SIMULATION ACTIVE</span>
              <p>
                Propagating downstream from <strong>{simulation.rootName}</strong>:{" "}
                <strong>{simulation.affectedCount} companies</strong> at risk.
                Estimated cumulative supply-chain delay:{" "}
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

        {/* TAB 1: OVERVIEW & TAB 2: NETWORK VIEW */}
        {(activeTab === "overview" || activeTab === "network") && (
          <section className="content-grid" id="network">
            {/* Left Panel: Graph Canvas & Controls */}
            <div className="panel network-panel">
              <div className="panel-heading">
                <div>
                  <h3>Sectivia Supply Chain Topology</h3>
                  <p>
                    {egoNetworkActive
                      ? `Viewing 1-Hop Ego Network for ${egoNetworkActive}`
                      : "Directed supplier-to-customer flows across 8 sectors"}
                  </p>
                </div>
                <div className="panel-heading-actions">
                  {egoNetworkActive && (
                    <button
                      className="back-btn"
                      onClick={handleResetToBackbone}
                      title="Return to multi-sector backbone"
                    >
                      ← Back to Full Backbone
                    </button>
                  )}
                  <span className="tag">NEO4J DIRECTED GRAPH</span>
                </div>
              </div>

              {/* Search and Multi-Criteria Filtering Bar */}
              <div className="search-filter-section">
                <div className="search-box">
                  <span className="search-icon" aria-hidden="true">🔍</span>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search by company name, ticker (e.g. AAPL, NVDA), sector, or country..."
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

                {/* Sector Filter Chips */}
                <div className="sector-filter-bar" role="group" aria-label="Filter by Sector">
                  <span className="type-filter-label">Sector:</span>
                  <button
                    className={`sector-chip ${selectedSector === "all" ? "active" : ""}`}
                    onClick={() => setSelectedSector("all")}
                  >
                    All Sectors ({stats.totalSectors})
                  </button>
                  {Object.entries(SECTIVIA_SECTORS).map(([key, sec]) => (
                    <button
                      key={key}
                      className={`sector-chip ${selectedSector === key ? "active" : ""}`}
                      onClick={() => setSelectedSector(key)}
                      style={{
                        borderColor: selectedSector === key ? sec.color : "transparent",
                      }}
                    >
                      <span aria-hidden="true">{sec.icon}</span> {sec.name.split("&")[0].trim()} ({sec.count})
                    </button>
                  ))}
                </div>

                {/* Active Filter Metrics & Reset Action */}
                <div className="filter-summary">
                  <span>
                    Showing <strong>{filteredNodes.length}</strong> companies in graph
                    {selectedSector !== "all" && ` · Sector: ${SECTIVIA_SECTORS[selectedSector]?.name}`}
                    {crossSectorOnly && " · Cross-Sector Only"}
                    {searchQuery && ` · Search: "${searchQuery}"`}
                  </span>
                  <div className="filter-actions-row">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={crossSectorOnly}
                        onChange={(e) => setCrossSectorOnly(e.target.checked)}
                      />
                      Cross-Sector Flows Only (162)
                    </label>
                    {(selectedSector !== "all" ||
                      crossSectorOnly ||
                      searchQuery ||
                      egoNetworkActive) && (
                      <button
                        className="reset-filters-btn"
                        onClick={handleResetFilters}
                      >
                        Reset All Filters
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Canvas Quick Actions Bar */}
              <div className="canvas-action-bar" role="toolbar" aria-label="Graph Canvas Controls">
                <button
                  className="canvas-action-btn"
                  onClick={handleFitView}
                  title="Reset viewport to fit entire visible network"
                  aria-label="Fit view to all nodes"
                >
                  ⛶ Fit View
                </button>
                <button
                  className={`canvas-action-btn ${crossSectorOnly ? "active" : ""}`}
                  onClick={() => setCrossSectorOnly(!crossSectorOnly)}
                  title="Highlight inter-industry cross-sector dependencies"
                  aria-label="Toggle cross-sector links"
                >
                  ⚡ Cross-Sector Links (162)
                </button>
                <button
                  className="canvas-action-btn"
                  onClick={handleExportJson}
                  title="Export current network graph to JSON"
                  aria-label="Export topology JSON"
                >
                  📥 Export Topology JSON
                </button>
              </div>

              {/* Interactive Graph Canvas */}
              <div className="network-canvas" aria-label="Interactive Supply Chain Graph Canvas">
                {filteredNodes.length === 0 ? (
                  <EmptyState
                    icon="🔍"
                    title="No matching companies found"
                    description="No Sectivia companies match the current filter criteria. Try clearing your search or switching sectors."
                    actionText="Reset All Filters"
                    onAction={handleResetFilters}
                  />
                ) : (
                  <ReactFlow
                    onInit={setRfInstance}
                    nodes={filteredNodes}
                    edges={filteredEdges}
                    nodeTypes={nodeTypes}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onNodeClick={handleNodeClick}
                    onEdgeClick={handleEdgeClick}
                    fitView
                    fitViewOptions={{ padding: 0.2 }}
                  >
                    <Background
                      color={isDark ? "#334155" : "#cbd5e1"}
                      gap={20}
                    />
                    <Controls aria-label="Graph zoom and viewport controls" />
                    <MiniMap
                      nodeColor={(node) => node.data?.sectorColor || "#38bdf8"}
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
              <div className="network-legend" aria-label="Graph Legend">
                <div className="legend-group">
                  <span className="legend-title">Sectors:</span>
                  {Object.entries(SECTIVIA_SECTORS).slice(0, 4).map(([k, s]) => (
                    <span key={k}>
                      <i style={{ backgroundColor: s.color }}></i> {s.name.split("&")[0].trim()}
                    </span>
                  ))}
                  <span className="legend-edge-sample">
                    <span className="edge-line-sample"></span> Directed Edge: Supplier → Customer
                  </span>
                </div>
                <div className="legend-hint">
                  💡 Click any company to inspect SEC disclosures or view its 1-Hop Ego Network.
                </div>
              </div>
            </div>

            {/* Right Panel: Selected Company / Edge Inspector */}
            <div className="panel details-panel">
              {selectedNode ? (
                <div className="selected-details" aria-labelledby="node-details-title">
                  <div className="details-header-row">
                    <div
                      className="detail-icon"
                      style={{
                        backgroundColor: `${selectedNode.data.sectorColor || "#38bdf8"}22`,
                        color: selectedNode.data.sectorColor || "#38bdf8",
                      }}
                      aria-hidden="true"
                    >
                      {selectedNode.data.sectorIcon || "🏢"}
                    </div>
                    <div>
                      <div className="detail-badges-row">
                        {selectedNode.data.ticker && (
                          <span className="detail-ticker-badge">
                            {selectedNode.data.exchange
                              ? `${selectedNode.data.exchange}: ${selectedNode.data.ticker}`
                              : selectedNode.data.ticker}
                          </span>
                        )}
                        <span
                          className="detail-sector-badge"
                          style={{
                            backgroundColor: `${selectedNode.data.sectorColor || "#38bdf8"}25`,
                            color: selectedNode.data.sectorColor || "#38bdf8",
                          }}
                        >
                          {selectedNode.data.sectorName || selectedNode.data.sector}
                        </span>
                      </div>
                      <h2 id="node-details-title">{selectedNode.data.name}</h2>
                      <p className="detail-official-name">
                        Canonical ID: <code>{selectedNode.id}</code>
                      </p>
                    </div>
                  </div>

                  <div className="detail-grid">
                    <div className="detail-row">
                      <span>Primary Sector</span>
                      <strong>{selectedNode.data.sectorName || selectedNode.data.sector}</strong>
                    </div>
                    <div className="detail-row">
                      <span>Sub-Industry Segment</span>
                      <strong>{selectedNode.data.segment || "Specialized Commercial"}</strong>
                    </div>
                    <div className="detail-row">
                      <span>Corporate Country</span>
                      <strong>{selectedNode.data.country || "USA"}</strong>
                    </div>
                    <div className="detail-row">
                      <span>Listing Status</span>
                      <strong>{selectedNode.data.listed ? "Publicly Traded" : "Private Entity"}</strong>
                    </div>
                    <div className="detail-row">
                      <span>SEC Relationship Count</span>
                      <strong>{selectedNode.data.relations_count || 1} verified contracts</strong>
                    </div>
                  </div>

                  {/* Connected Suppliers & Customers */}
                  {selectedNodeDetails && (
                    <div className="connections-box">
                      <div className="connections-section">
                        <h4>
                          Upstream Suppliers ({selectedNodeDetails.suppliers?.length || 0})
                        </h4>
                        {selectedNodeDetails.suppliers?.length > 0 ? (
                          <ul className="connection-list">
                            {selectedNodeDetails.suppliers.slice(0, 5).map((sup, idx) => (
                              <li key={idx} className="connection-item">
                                <span className="conn-name">{sup.supplier_name}</span>
                                <span className="conn-desc">{sup.what}</span>
                                {sup.source_url && (
                                  <a
                                    href={sup.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="sec-link"
                                  >
                                    SEC Filing ↗
                                  </a>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="no-conn">No upstream suppliers documented in Sectivia sample</p>
                        )}
                      </div>

                      <div className="connections-section">
                        <h4>
                          Downstream Customers ({selectedNodeDetails.customers?.length || 0})
                        </h4>
                        {selectedNodeDetails.customers?.length > 0 ? (
                          <ul className="connection-list">
                            {selectedNodeDetails.customers.slice(0, 5).map((cust, idx) => (
                              <li key={idx} className="connection-item">
                                <span className="conn-name">{cust.customer_name}</span>
                                <span className="conn-desc">{cust.what}</span>
                                {cust.source_url && (
                                  <a
                                    href={cust.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="sec-link"
                                  >
                                    SEC Filing ↗
                                  </a>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="no-conn">No downstream customers documented in Sectivia sample</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Node Actions */}
                  <div className="node-actions">
                    <button
                      className="ego-node-btn"
                      onClick={() => handleExploreEgoNetwork(selectedNode.id)}
                      aria-label={`Explore 1-hop ego network for ${selectedNode.data.name}`}
                    >
                      🎯 Focus 1-Hop Ego Network
                    </button>
                    <button
                      className="simulate-node-btn"
                      onClick={() => handleTriggerSimulation(selectedNode.id)}
                      aria-label={`Simulate ripple effect from ${selectedNode.data.name}`}
                    >
                      ⚡ Simulate Failure Ripple
                    </button>
                    <button
                      className="deselect-btn"
                      onClick={() => {
                        setSelectedNode(null);
                        setSelectedNodeDetails(null);
                      }}
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
              ) : selectedEdge ? (
                <div className="selected-details" aria-labelledby="edge-details-title">
                  <div className="details-header-row">
                    <div className="detail-icon" aria-hidden="true">
                      🔄
                    </div>
                    <div>
                      <span className="detail-ticker-badge">SUPPLIES_TO Relationship</span>
                      <h2 id="edge-details-title">
                        {selectedEdge.data?.supplier_name || selectedEdge.source} →{" "}
                        {selectedEdge.data?.customer_name || selectedEdge.target}
                      </h2>
                    </div>
                  </div>

                  <div className="detail-grid">
                    <div className="detail-row">
                      <span>Supplied Item / Service</span>
                      <strong>{selectedEdge.data?.what || selectedEdge.label}</strong>
                    </div>
                    <div className="detail-row">
                      <span>Cross-Sector Link</span>
                      <strong>{selectedEdge.data?.is_cross_sector ? "Yes (Cross-Sector)" : "No (Same Sector)"}</strong>
                    </div>
                    <div className="detail-row">
                      <span>Regulatory Filing Citation</span>
                      <strong>{selectedEdge.data?.source_citation || "SEC EDGAR 10-K"}</strong>
                    </div>
                    {selectedEdge.data?.source_url && (
                      <div className="detail-row">
                        <span>Official SEC Document</span>
                        <a
                          href={selectedEdge.data.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="sec-link"
                        >
                          View SEC EDGAR Disclosure ↗
                        </a>
                      </div>
                    )}
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
                  title="No Company Selected"
                  description="Click any corporate node in the network to inspect its SEC EDGAR disclosures, verified suppliers, and customer relationships."
                />
              )}
            </div>
          </section>
        )}

        {/* TAB 3: COMPANIES DIRECTORY VIEW */}
        {activeTab === "companies" && (
          <section className="panel companies-panel" aria-labelledby="companies-title">
            <div className="panel-heading">
              <div>
                <h3 id="companies-title">Sectivia Company Directory</h3>
                <p>Complete register of 382 companies documented in SEC regulatory disclosures</p>
              </div>
              <span className="tag">{SECTIVIA_COMPANIES.length} CORPORATIONS</span>
            </div>

            <div className="companies-table-container">
              <table className="companies-table">
                <thead>
                  <tr>
                    <th>Company Name</th>
                    <th>Ticker</th>
                    <th>Exchange</th>
                    <th>Sector</th>
                    <th>Sub-Industry Segment</th>
                    <th>Country</th>
                    <th>Links</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {SECTIVIA_COMPANIES.slice(0, 50).map((company) => (
                    <tr key={company.id}>
                      <td>
                        <strong>{company.name}</strong>
                      </td>
                      <td>
                        <span className="table-ticker">{company.ticker || "Private"}</span>
                      </td>
                      <td>{company.exchange || "—"}</td>
                      <td>
                        <span
                          className="table-sector-badge"
                          style={{
                            backgroundColor: `${company.sectorColor}20`,
                            color: company.sectorColor,
                          }}
                        >
                          {company.sectorName}
                        </span>
                      </td>
                      <td>{company.segment}</td>
                      <td>{company.country}</td>
                      <td>
                        <span className="links-count">{company.relations_count}</span>
                      </td>
                      <td>
                        <button
                          className="table-inspect-btn"
                          onClick={() => handleInspectCompanyFromDirectory(company)}
                          aria-label={`Inspect ${company.name} in network graph`}
                        >
                          Inspect in Graph →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="table-footnote">
                Showing top 50 of 382 companies. Use the top search bar to find any specific ticker or company.
              </p>
            </div>
          </section>
        )}

        {/* TAB 4: ANALYTICS VIEW */}
        {activeTab === "analytics" && (
          <div className="analytics-view">
            <section className="panel analytics-panel" aria-labelledby="analytics-title">
              <div className="panel-heading">
                <div>
                  <h3 id="analytics-title">Sector Distribution & Dependency Matrix</h3>
                  <p>Distribution of 382 companies and 556 relationships across 8 industrial sectors</p>
                </div>
                <span className="tag">SECTIVIA METRICS</span>
              </div>

              <div className="sector-distribution-grid">
                {Object.entries(SECTIVIA_SECTORS).map(([key, sec]) => {
                  const percentage = ((sec.count / stats.totalCompanies) * 100).toFixed(1);
                  return (
                    <div key={key} className="sector-stat-card">
                      <div className="sector-stat-header">
                        <span className="sector-icon" aria-hidden="true">{sec.icon}</span>
                        <span className="sector-badge" style={{ color: sec.color }}>
                          {sec.name}
                        </span>
                      </div>
                      <div className="sector-stat-body">
                        <div className="sector-count-large" style={{ color: sec.color }}>
                          {sec.count}
                        </div>
                        <small>{percentage}% of total corporations</small>
                      </div>
                      <div className="sector-bar-bg">
                        <div
                          className="sector-bar-fill"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: sec.color,
                          }}
                        />
                      </div>
                      <p className="sector-desc">{sec.description}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Prediction Area Chart */}
            <section id="predictions">
              <Prediction />
            </section>
          </div>
        )}

        {/* TAB 5: ABOUT VIEW */}
        {activeTab === "about" && (
          <section className="panel about-panel" aria-labelledby="about-title">
            <div className="panel-heading">
              <div>
                <h3 id="about-title">About AtmoGraph & Integration Architecture</h3>
                <p>Cross-module system integration for supply chain intelligence and ripple effect prediction</p>
              </div>
              <span className="tag">WEEK 1 SPECIFICATION</span>
            </div>

            <div className="about-content">
              <div className="about-card">
                <h4>🎯 AtmoGraph Platform Vision</h4>
                <p>
                  AtmoGraph models global enterprise supply networks as a directed property graph.
                  By combining SEC EDGAR regulatory filings, real-time news NLP extraction, and Graph
                  Neural Networks (GNN), the platform detects disruption events upstream and predicts
                  downstream production delays before they cascade.
                </p>
              </div>

              <div className="about-grid">
                <div className="about-team-card">
                  <span className="team-badge">Member 1</span>
                  <h5>Neo4j Graph Database</h5>
                  <p>
                    Established database schema with 382 Company nodes and 556 SUPPLIES_TO
                    directed relationships across 8 sectors. Author of the integration contract.
                  </p>
                </div>

                <div className="about-team-card">
                  <span className="team-badge">Member 2</span>
                  <h5>NLP & Disruption Pipeline</h5>
                  <p>
                    Processes supply chain news feeds using spaCy/HuggingFace NER, matching disruption
                    events to canonical entities (`sectivia:&lt;id&gt;`) with severity scores.
                  </p>
                </div>

                <div className="about-team-card">
                  <span className="team-badge">Member 3</span>
                  <h5>GNN & Cascade Modeling</h5>
                  <p>
                    Develops PyTorch Geometric models on graph export tensors, training multi-hop
                    ripple prediction weights for downstream production delay forecasting.
                  </p>
                </div>

                <div className="about-team-card active-team">
                  <span className="team-badge">Member 4 (You)</span>
                  <h5>Frontend & Visualization</h5>
                  <p>
                    Interactive React dashboard, React Flow graph topology, Sectivia dataset
                    statistics, responsive SaaS UI, and common cross-member data contracts.
                  </p>
                </div>
              </div>

              <div className="about-card">
                <h4>📚 Sectivia Dataset Provenance</h4>
                <p>
                  The Sectivia dataset maps 556 hand-verified supplier-customer relationships across
                  382 companies (381 U.S.-listed, 1 private) derived from corporate SEC 10-K and 8-K
                  regulatory disclosures. 162 relationships link cross-sector dependencies.
                  Licensed under Creative Commons Attribution 4.0 International (CC BY 4.0).
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Disruption Alerts Panel */}
        <section className="panel alerts-panel" id="alerts" aria-labelledby="alerts-title">
          <div className="panel-heading">
            <div>
              <h3 id="alerts-title">Supply Chain Disruption Advisories</h3>
              <p className="panel-subtitle">Verified disruption alerts tied to authentic Sectivia nodes</p>
            </div>
            <span className="tag">LIVE SECTIVIA FEED</span>
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
                    {alert.sourceCitation && (
                      <span className="alert-citation">
                        📄 Source: {alert.sourceCitation}
                      </span>
                    )}
                    {alert.rippleAffectedCount > 0 && (
                      <span className="alert-ripple-count">
                        ⚡ {alert.rippleAffectedCount} downstream companies impacted
                      </span>
                    )}
                  </div>
                </div>
                {alert.nodeId && (
                  <button
                    className="alert-inspect-btn"
                    onClick={() => {
                      handleExploreEgoNetwork(alert.nodeId);
                      setActiveTab("network");
                      const el = document.getElementById("network");
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }}
                    aria-label={`Inspect ${alert.title} in network`}
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
