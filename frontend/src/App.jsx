
import React from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import "./App.css";

const initialNodes = [
  {
    id: "1",
    position: { x: 50, y: 130 },
    data: { label: "Supplier A\nHIGH RISK" },
    style: {
      background: "#451a1a",
      color: "#fca5a5",
      border: "1px solid #ef4444",
      borderRadius: 10,
      padding: 15,
      width: 150,
    },
  },
  {
    id: "2",
    position: { x: 320, y: 130 },
    data: { label: "Manufacturer A\nMEDIUM RISK" },
    style: {
      background: "#422006",
      color: "#fdba74",
      border: "1px solid #f97316",
      borderRadius: 10,
      padding: 15,
      width: 170,
    },
  },
  {
    id: "3",
    position: { x: 620, y: 130 },
    data: { label: "Distributor A\nLOW RISK" },
    style: {
      background: "#052e16",
      color: "#86efac",
      border: "1px solid #22c55e",
      borderRadius: 10,
      padding: 15,
      width: 150,
    },
  },
  {
    id: "4",
    position: { x: 320, y: 320 },
    data: { label: "Supplier B\nLOW RISK" },
    style: {
      background: "#052e16",
      color: "#86efac",
      border: "1px solid #22c55e",
      borderRadius: 10,
      padding: 15,
      width: 150,
    },
  },
];

const initialEdges = [
  {
    id: "e1-2",
    source: "1",
    target: "2",
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: "#ef4444", strokeWidth: 2 },
  },
  {
    id: "e2-3",
    source: "2",
    target: "3",
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: "#f97316", strokeWidth: 2 },
  },
  {
    id: "e4-2",
    source: "4",
    target: "2",
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
                <p>
                  Interactive supplier and distributor connections
                </p>
              </div>

              <span className="tag">LIVE NETWORK</span>
            </div>

            <div className="network-canvas">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                nodesDraggable
                nodesConnectable
                elementsSelectable
                defaultEdgeOptions={{
                  type: "smoothstep",
                }}
              >
                <Background
                  color="#334155"
                  gap={20}
                  size={1}
                />

                <Controls />

                <MiniMap
                  nodeColor={(node) => {
                    if (node.id === "1") return "#ef4444";
                    if (node.id === "2") return "#f97316";
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
