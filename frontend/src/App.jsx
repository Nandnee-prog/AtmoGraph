
import React, { useMemo, useState, useEffect } from "react";
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

function CustomNode({ data, selected }) {
  return (
    <div className={`custom-node ${data.risk} ${selected ? "selected" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <div className="node-header">
        <span className="node-icon">{data.icon}</span>
        <span className={`risk-badge ${data.risk}`}>
          {data.risk.toUpperCase()}
        </span>
      </div>
      <div className="node-name">{data.label}</div>
      <div className="node-type">{data.type}</div>
      <div className="node-footer">
        <span className="node-indicator"></span>
        {data.status}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

const initialNodes = [
  {
    id: "1", type: "custom", position: { x: 50, y: 100 },
    data: {
      label: "Supplier A", type: "Raw Material Supplier",
      icon: "🏭", risk: "high", status: "At Risk",
      location: "India", score: 89,
    },
  },
  {
    id: "2", type: "custom", position: { x: 340, y: 100 },
    data: {
      label: "Manufacturer A", type: "Production Facility",
      icon: "⚙️", risk: "medium", status: "Monitoring",
      location: "Germany", score: 56,
    },
  },
  {
    id: "3", type: "custom", position: { x: 650, y: 100 },
    data: {
      label: "Distributor A", type: "Distribution Center",
      icon: "📦", risk: "low", status: "Operational",
      location: "Singapore", score: 18,
    },
  },
  {
    id: "4", type: "custom", position: { x: 340, y: 320 },
    data: {
      label: "Supplier B", type: "Component Supplier",
      icon: "🚚", risk: "low", status: "Operational",
      location: "Japan", score: 22,
    },
  },
];

const initialEdges = [
  {
    id: "e1-2", source: "1", target: "2",
    animated: true, label: "Materials",
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: "#ef4444", strokeWidth: 2 },
  },
  {
    id: "e2-3", source: "2", target: "3",
    animated: true, label: "Products",
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: "#f97316", strokeWidth: 2 },
  },
  {
    id: "e4-2", source: "4", target: "2",
    label: "Components",
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: "#22c55e", strokeWidth: 2 },
  },
];

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [riskFilter, setRiskFilter] = useState("all");
  const [selectedNode, setSelectedNode] = useState(null);

  const [theme, setTheme] = useState(
    () => localStorage.getItem("atmograph-theme") || "system"
  );

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    localStorage.setItem("atmograph-theme", theme);
  }, [theme]);

  const riskCounts = useMemo(() => ({
    high: nodes.filter(n => n.data.risk === "high").length,
    medium: nodes.filter(n => n.data.risk === "medium").length,
    low: nodes.filter(n => n.data.risk === "low").length,
  }), [nodes]);

  const filteredNodes = useMemo(() =>
    riskFilter === "all"
      ? nodes
      : nodes.filter(n => n.data.risk === riskFilter),
    [nodes, riskFilter]
  );

  const visibleIds = new Set(filteredNodes.map(n => n.id));
  const filteredEdges = edges.filter(
    e => visibleIds.has(e.source) && visibleIds.has(e.target)
  );

  const handleFilter = filter => {
    setRiskFilter(filter);
    setSelectedNode(null);
  };

  const handleNodeClick = (_, node) => setSelectedNode(node);

  const isDark = theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <div className="app">
      <aside className="sidebar">
        <h2 className="logo">Atmo<span>Graph</span></h2>
        <p className="side-label">WORKSPACE</p>

        <nav>
          <a className="active" href="#dashboard">▦ Dashboard</a>
          <a href="#network">◎ Supply Chain Network</a>
          <a href="#risk">⚠ Risk Analysis</a>
          <a href="#predictions">◷ Predictions</a>
          <a href="#alerts">♧ Disruption Alerts</a>
        </nav>

        <div className="sidebar-bottom">
          <p>SUPPLY CHAIN INTELLIGENCE</p>
          <small>Powered by predictive analytics</small>
        </div>
      </aside>

      <main className="main" id="dashboard">
        <header className="topbar">
          <div>
            <span className="breadcrumb">Workspace / Dashboard</span>
            <h2>Dashboard Overview</h2>
          </div>

          <div className="topbar-actions">
            <label className="theme-label" htmlFor="theme-select">
              Appearance
            </label>
            <select
              id="theme-select"
              className="theme-select"
              value={theme}
              onChange={e => setTheme(e.target.value)}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>

            <div className="status">
              <span className="status-dot"></span>
              System Online
            </div>
          </div>
        </header>

        <section className="welcome">
          <div>
            <h1>Supply Chain Intelligence</h1>
            <p>Monitor networks, identify risks and predict disruptions.</p>
          </div>
          <span className="date">ATMOGRAPH · LIVE MONITORING</span>
        </section>

        <section className="stats">
          <div className="stat-card">
            <p>Total Suppliers</p>
            <h2>248</h2>
            <small>Across monitored networks</small>
          </div>
          <div className="stat-card">
            <p>High Risk Nodes</p>
            <h2 className="red">18</h2>
            <small>Require immediate attention</small>
          </div>
          <div className="stat-card">
            <p>Active Alerts</p>
            <h2 className="orange">07</h2>
            <small>Potential disruptions detected</small>
          </div>
          <div className="stat-card">
            <p>Network Health</p>
            <h2 className="green">94.2%</h2>
            <small>Overall network stability</small>
          </div>
        </section>

        <section className="risk-overview" id="risk">
          <div className="section-title">
            <h2>Risk Analysis</h2>
            <p>Monitor and filter supply-chain risk levels</p>
          </div>

          <div className="risk-cards">
            {[
              ["high", "HIGH RISK", riskCounts.high, "Critical attention"],
              ["medium", "MEDIUM RISK", riskCounts.medium, "Needs monitoring"],
              ["low", "LOW RISK", riskCounts.low, "Stable suppliers"],
              ["all", "ALL NODES", nodes.length, "Complete network"],
            ].map(([level, label, count, description]) => (
              <button
                key={level}
                className={`risk-card ${level}-card ${riskFilter === level ? "active-risk" : ""}`}
                onClick={() => handleFilter(level)}
              >
                <span>{label}</span>
                <strong>{count}</strong>
                <small>{description}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="content-grid" id="network">
          <div className="panel network-panel">
            <div className="panel-heading">
              <div>
                <h3>Supply Chain Network</h3>
                <p>Filter nodes by their risk classification</p>
              </div>
              <span className="tag">NETWORK ANALYSIS</span>
            </div>

            <div className="filter-toolbar">
              {["all", "high", "medium", "low"].map(filter => (
                <button
                  key={filter}
                  className={riskFilter === filter ? "filter-active" : ""}
                  onClick={() => handleFilter(filter)}
                >
                  {filter === "all" ? "All" : `${filter[0].toUpperCase()}${filter.slice(1)} Risk`}
                </button>
              ))}
            </div>

            <div className="network-canvas">
              <ReactFlow
                nodes={filteredNodes}
                edges={filteredEdges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={handleNodeClick}
                fitView
                fitViewOptions={{ padding: 0.2 }}
              >
                <Background color={isDark ? "#334155" : "#cbd5e1"} gap={20} />
                <Controls />
                <MiniMap
                  nodeColor={node => {
                    const risk = node.data?.risk;
                    if (risk === "high") return "#ef4444";
                    if (risk === "medium") return "#f97316";
                    return "#22c55e";
                  }}
                  maskColor={isDark
                    ? "rgba(10,15,30,0.7)"
                    : "rgba(220,230,240,0.5)"}
                />
              </ReactFlow>
            </div>

            <div className="network-legend">
              <span><i className="legend-high"></i> High Risk</span>
              <span><i className="legend-medium"></i> Medium Risk</span>
              <span><i className="legend-low"></i> Low Risk</span>
            </div>
          </div>

          <div className="panel details-panel">
            <h3>Node Risk Details</h3>
            <p className="panel-subtitle">
              Select a network node to inspect its risk information
            </p>

            {selectedNode ? (
              <div className="selected-details">
                <div className="detail-icon">{selectedNode.data.icon}</div>
                <h2>{selectedNode.data.label}</h2>
                <p>{selectedNode.data.type}</p>
                <div className={`detail-risk ${selectedNode.data.risk}`}>
                  {selectedNode.data.risk.toUpperCase()} RISK
                </div>
                <div className="detail-row">
                  <span>Location</span>
                  <strong>{selectedNode.data.location}</strong>
                </div>
                <div className="detail-row">
                  <span>Risk Score</span>
                  <strong>{selectedNode.data.score}/100</strong>
                </div>
                <div className="detail-row">
                  <span>Status</span>
                  <strong>{selectedNode.data.status}</strong>
                </div>
                <div className="score-track">
                  <div
                    className={`score-fill ${selectedNode.data.risk}`}
                    style={{ width: `${selectedNode.data.score}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="empty-details">
                <span>◎</span>
                <h3>No Node Selected</h3>
                <p>
                  Click any supplier, manufacturer or distributor
                  in the network to view its risk details.
                </p>
              </div>
            )}
          </div>
        </section>

        <section id="predictions">
          <Prediction />
        </section>

        <section className="panel alerts-panel" id="alerts">
          <h3>Recent Alerts</h3>
          <p className="panel-subtitle">Latest network notifications</p>

          <div className="alert-item">
            <span className="alert-dot high"></span>
            <div>
              <strong>Supplier Risk Detected</strong>
              <p>High-risk supplier identified</p>
            </div>
          </div>
          <div className="alert-item">
            <span className="alert-dot medium"></span>
            <div>
              <strong>Delivery Delay Warning</strong>
              <p>Potential logistics disruption</p>
            </div>
          </div>
          <div className="alert-item">
            <span className="alert-dot low"></span>
            <div>
              <strong>Network Status Updated</strong>
              <p>Monitoring data refreshed</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
