import React from "react";
import "./Components.css";

export function ErrorBanner({ message, onRetry }) {
  return (
    <div className="error-banner" role="alert" aria-live="assertive">
      <div className="error-banner-content">
        <span className="error-icon" aria-hidden="true">⚠️</span>
        <div>
          <strong>Connection Advisory:</strong>{" "}
          <span>{message || "Unable to reach the live telemetry backend."}</span>
        </div>
      </div>
      {onRetry && (
        <button className="retry-btn" onClick={onRetry}>
          Retry Connection
        </button>
      )}
    </div>
  );
}

export default ErrorBanner;
