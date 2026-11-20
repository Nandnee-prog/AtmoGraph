import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Prediction from "../Prediction";

describe("Prediction Component", () => {
  it("renders heading and forecast period selection", () => {
    render(<Prediction />);
    expect(screen.getByText("Disruption Predictions")).toBeInTheDocument();
    expect(screen.getByText("Illustrative supply-chain risk trend forecast")).toBeInTheDocument();

    const select = screen.getByLabelText("Forecast horizon selection");
    expect(select).toBeInTheDocument();
    expect(select.value).toBe("7 Days");
  });

  it("updates projected horizon stats when selection changes", () => {
    render(<Prediction />);
    const select = screen.getByLabelText("Forecast horizon selection");

    fireEvent.change(select, { target: { value: "30 Days" } });
    expect(select.value).toBe("30 Days");
    expect(screen.getByText("30 Days")).toBeInTheDocument();
  });

  it("displays model context disclaimer", () => {
    render(<Prediction />);
    expect(screen.getByText(/Model Context:/i)).toBeInTheDocument();
  });
});
