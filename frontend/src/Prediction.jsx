import React, { useState } from "react";
import "./Prediction.css";

const predictionData = {
  "7 Days": [22, 28, 25, 38, 34, 45, 52],
  "14 Days": [18, 25, 22, 32, 29, 42, 48, 45, 55, 51, 63, 59, 70, 76],
  "30 Days": [
    15, 20, 18, 25, 30, 28, 35, 32, 42, 40, 48, 45, 55, 52, 60,
    58, 65, 62, 70, 68, 75, 72, 80, 77, 85, 82, 88, 84, 92, 95,
  ],
};

function Prediction() {
  const [period, setPeriod] = useState("7 Days");
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const values = predictionData[period];
  const chartWidth = 560;
  const startX = 40;
  const endX = 560;
  const usableWidth = endX - startX;

  const points = values
    .map((value, index) => {
      const x = startX + (index * usableWidth) / (values.length - 1);
      const y = 190 - value * 1.6;
      return `${x},${y}`;
    })
    .join(" ");

  const areaPoints = `${startX},190 ${points} ${endX},190`;

  const average = Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length
  );
  const highest = Math.max(...values);

  return (
    <section className="prediction-section" aria-labelledby="prediction-title">
      <div className="prediction-heading">
        <div>
          <h2 id="prediction-title">Disruption Predictions</h2>
          <p>Illustrative supply-chain risk trend forecast</p>
        </div>

        <select
          value={period}
          onChange={(event) => {
            setPeriod(event.target.value);
            setHoveredPoint(null);
          }}
          aria-label="Forecast horizon selection"
        >
          <option value="7 Days">7 Days Horizon</option>
          <option value="14 Days">14 Days Horizon</option>
          <option value="30 Days">30 Days Horizon</option>
        </select>
      </div>

      <div className="prediction-stats">
        <div className="prediction-stat">
          <span>Average Projected Risk</span>
          <strong>{average}%</strong>
        </div>

        <div className="prediction-stat">
          <span>Forecast Horizon</span>
          <strong>{period}</strong>
        </div>

        <div className="prediction-stat">
          <span>Peak Risk Window</span>
          <strong className="prediction-red">{highest}%</strong>
        </div>
      </div>

      <div className="prediction-chart-container">
        <div className="prediction-chart">
          <div className="chart-labels" aria-hidden="true">
            <span>100%</span>
            <span>75%</span>
            <span>50%</span>
            <span>25%</span>
            <span>0%</span>
          </div>

          <div className="chart-svg-wrap">
            <svg
              viewBox="0 0 600 220"
              role="img"
              aria-label={`Illustrative risk trend for ${period}`}
            >
              <defs>
                <linearGradient id="predictionArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {[30, 70, 110, 150, 190].map((y) => (
                <line
                  key={y}
                  x1={startX}
                  y1={y}
                  x2={endX}
                  y2={y}
                  className="chart-grid-line"
                />
              ))}

              <polygon points={areaPoints} fill="url(#predictionArea)" />

              <polyline points={points} className="chart-polyline" />

              {values.map((value, index) => {
                const x = startX + (index * usableWidth) / (values.length - 1);
                const y = 190 - value * 1.6;
                const isHovered = hoveredPoint && hoveredPoint.index === index;

                return (
                  <g key={index}>
                    <circle
                      cx={x}
                      cy={y}
                      r={isHovered ? 6 : 4}
                      className={`chart-point ${isHovered ? "active" : ""}`}
                      onMouseEnter={() =>
                        setHoveredPoint({ index, value, day: index + 1, x, y })
                      }
                      onMouseLeave={() => setHoveredPoint(null)}
                      tabIndex="0"
                      aria-label={`Day ${index + 1}: ${value}% risk`}
                    />
                    {isHovered && (
                      <g>
                        <rect
                          x={Math.min(Math.max(x - 36, 10), 520)}
                          y={y - 32}
                          width="72"
                          height="22"
                          rx="4"
                          fill="var(--surface)"
                          stroke="var(--border)"
                          strokeWidth="1"
                        />
                        <text
                          x={Math.min(Math.max(x - 36, 10), 520) + 36}
                          y={y - 17}
                          textAnchor="middle"
                          fill="var(--text)"
                          fontSize="10"
                          fontWeight="bold"
                        >
                          D+{index + 1}: {value}%
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      <div className="prediction-disclaimer">
        <span>ⓘ Model Context:</span>
        Demonstration data for development and review. Once GNN ripple prediction
        weights are trained by the backend pipeline, this component consumes real-time
        multi-step latency and disruption probabilities.
      </div>
    </section>
  );
}

export default Prediction;
