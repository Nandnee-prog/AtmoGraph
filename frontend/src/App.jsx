
import React from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import "./App.css";

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

const nodeTypes = {
  custom: CustomNode,
};

const initialNodes = [
  {
    id: "1",
    type: "custom",
    position: { x: 50, y: 120 },
    data: {
      label: "Supplier A",
      type: "Raw Material Supplier",
      icon: "🏭",
      risk: "high",
      status: "At Risk",
    },
  },
  {
    id: "2",
    type: "custom",
    position: { x: 340, y: 120 },
    data: {
      label: "Manufacturer A",
      type: "Production Facility",
      icon: "⚙️",
      risk: "medium",
      status: "Monitoring",
    },
  },
  {
    id: "3",
    type: "custom",
    position: { x: 650, y: 120 },
    data: {
      label: "Distributor A",
      type: "Distribution Center",
      icon: "📦",
      risk: "low",
      status: "Operational",
    },
  },
  {
    id: "4",
    type: "custom",
    position: { x: 340, y: 340 },
    data: {
      label: "Supplier B",
      type: "Component Supplier",
      icon: "🏗️",
      risk: "low",
      status: "Operational",
    },
  },
];

const initialEdges = [
  {
    id: "e1-2",
    source: "1",
    target: "2",
    animated: true,
    label: "Materials",
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: "#ef4444", strokeWidth: 2 },
  },
  {
    id: "e2-3",
    source: "2",
    target: "3",
    animated: true,
    label: "Products",
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: "#f97316", strokeWidth: 2 },
  },
  {
    id: "e4-2",
    source: "4",
    target: "2",
    label: "Components",
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: "#22c55e", strokeWidth: 2 },
  },
];

function App() {
  const [nodes, setNodes, onNodesChange] =
    useNodesState(initialNodes);

  const [edges, setEdges, onEdgesChange] =
    useEdgesState(initialEdges);

  return (
    <div className="app">
      <aside className="sidebar">
        <h2 className="logo">
          Atmo<span>Graph</span>
        </h2>

        <p className="side-label">WORKSPACE</p>

        <nav>
          <a className="active" href="#">▦ Dashboard</a>
          <a href="#">◎ Supply Chain Network</a>
          <a href="#">⚠ Risk Analysis</a>
          <a href="#">◷ Predictions</a>
          <a href="#">♧ Disruption Alerts</a>
        </nav>

        <div className="sidebar-bottom">
          <p>SUPPLY CHAIN INTELLIGENCE</p>
          <small>Powered by predictive analytics</small>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <span className="breadcrumb">
              Workspace / Dashboard
            </span>
            <h2>Dashboard Overview</h2>
          </div>

          <div className="status">
            <span className="status-dot"></span>
            System Online
          </div>
        </header>

        <section className="welcome">
          <div>
            <h1>Supply Chain Intelligence</h1>
            <p>
              Monitor networks, identify risks and predict disruptions.
            </p>
          </div>

          <span className="date">
            ATMOGRAPH · LIVE MONITORING
          </span>
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

        <section className="content-grid">
          <div className="panel network-panel">
            <div className="panel-heading">
              <div>
                <h3>Supply Chain Network</h3>
                <p>Interactive supplier and distributor connections</p>
              </div>
              <span className="tag">LIVE NETWORK</span>
            </div>

            <div className="network-canvas">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                nodesDraggable
                nodesConnectable
                elementsSelectable
              >
                <Background color="#334155" gap={20} />
                <Controls />

                <MiniMap
                  nodeColor={(node) => {
                    const risk = node.data?.risk;
                    if (risk === "high") return "#ef4444";
                    if (risk === "medium") return "#f97316";
                    return "#22c55e";
                  }}
                  maskColor="rgba(10, 15, 30, 0.7)"
                />
              </ReactFlow>
            </div>

            <div className="network-legend">
              <span><i className="legend-high"></i> High Risk</span>
              <span><i className="legend-medium"></i> Medium Risk</span>
              <span><i className="legend-low"></i> Low Risk</span>
            </div>
          </div>

          <div className="panel alerts-panel">
            <h3>Recent Alerts</h3>
            <p className="panel-subtitle">
              Latest network notifications
            </p>

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
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
