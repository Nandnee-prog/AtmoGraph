import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "../App";

describe("App Dashboard", () => {
  it("renders main dashboard branding and title", () => {
    render(<App />);
    const logoElements = screen.getAllByText(/Atmo/i);
    expect(logoElements.length).toBeGreaterThan(0);
    expect(screen.getByText("Supply Chain Intelligence")).toBeInTheDocument();
  });

  it("renders key summary statistics after loading", async () => {
    render(<App />);
    expect(await screen.findByText("Total Suppliers")).toBeInTheDocument();
    expect(screen.getByText("High Risk Nodes")).toBeInTheDocument();
    expect(screen.getByText("Active Alerts")).toBeInTheDocument();
    expect(screen.getByText("Network Health")).toBeInTheDocument();
  });

  it("allows switching appearance theme between system, light, and dark", () => {
    render(<App />);
    const themeSelect = screen.getByLabelText("Select appearance theme");
    expect(themeSelect).toBeInTheDocument();

    fireEvent.change(themeSelect, { target: { value: "dark" } });
    expect(themeSelect.value).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    fireEvent.change(themeSelect, { target: { value: "light" } });
    expect(themeSelect.value).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("renders search input and allows filtering query input", () => {
    render(<App />);
    const searchInput = screen.getByLabelText("Search supply chain nodes");
    expect(searchInput).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "Bavaria" } });
    expect(searchInput.value).toBe("Bavaria");
  });

  it("renders skip link for screen readers", () => {
    render(<App />);
    const skipLink = screen.getByText("Skip to main dashboard content");
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute("href", "#dashboard");
  });
});
