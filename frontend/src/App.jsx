
import "./App.css";

function App() {
  return (
    <div className="app">
      <aside className="sidebar">
        <h2 className="logo">Atmo<span>Graph</span></h2>
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
            <span className="breadcrumb">Workspace / Dashboard</span>
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
            <p>Monitor networks, identify risks and predict disruptions.</p>
          </div>
          <span className="date">ATMO GRAPH · LIVE MONITORING</span>
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
                <p>Network visualization will appear here</p>
              </div>
              <span className="tag">NETWORK</span>
            </div>
            <div className="network-placeholder">
              <div className="network-icon">◎</div>
              <h3>Network Visualization</h3>
              <p>Interactive supplier connections coming soon.</p>
            </div>
          </div>

          <div className="panel alerts-panel">
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
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
