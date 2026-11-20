import React from "react";
import "./Components.css";

export function LoadingSkeleton({ count = 4 }) {
  return (
    <div className="stats" aria-label="Loading metrics" aria-busy="true">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="skeleton-card">
          <div className="skeleton skeleton-text" style={{ width: "40%" }} />
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-text" style={{ width: "70%" }} />
        </div>
      ))}
    </div>
  );
}

export function CanvasSkeleton() {
  return (
    <div className="skeleton skeleton-canvas" aria-busy="true">
      <div className="skeleton skeleton-title" style={{ width: "240px" }} />
      <div className="skeleton skeleton-text" style={{ width: "160px" }} />
    </div>
  );
}

export default LoadingSkeleton;
