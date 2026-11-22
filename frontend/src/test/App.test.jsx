import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "../App";

describe("App Dashboard", () => {
  it("renders main dashboard branding and title", () => {
    render(<App />);
    const logoElements = screen.getAllByText(/Atmo/i);
    expect(logoElements.length).toBeGreaterThan(0);
    expect(screen.getByText("Supply Chain Intelligence")).toBeInTheDocument();
    expect(
      screen.getByText("Supply Chain Intelligence Platform")
    ).toBeInTheDocument();
  });

  it("renders verified Sectivia statistics after loading", async () => {
    render(<App />);
    expect(await screen.findByText("Total Companies")).toBeInTheDocument();
    expect(screen.getByText("382")).toBeInTheDocument();
    expect(
      screen.getByText("Supplier-Customer Relationships")
    ).toBeInTheDocument();
    expect(screen.getByText("556")).toBeInTheDocument();
    expect(
      screen.getByText("Cross-Sector Relationships")
    ).toBeInTheDocument();
    expect(screen.getByText("162")).toBeInTheDocument();
    expect(screen.getByText("Total Sectors")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("renders sidebar navigation and allows switching views", () => {
    render(<App />);
    const overviewBtn = screen.getByRole("button", { name: /overview/i });
    const networkBtn = screen.getByRole("button", {
      name: /supply chain network/i,
    });
    const companiesBtn = screen.getByRole("button", { name: /companies/i });
    const analyticsBtn = screen.getByRole("button", { name: /analytics/i });
    const aboutBtn = screen.getByRole("button", { name: /about/i });

    expect(overviewBtn).toBeInTheDocument();
    expect(networkBtn).toBeInTheDocument();
    expect(companiesBtn).toBeInTheDocument();
    expect(analyticsBtn).toBeInTheDocument();
    expect(aboutBtn).toBeInTheDocument();

    // Switch to Companies tab
    fireEvent.click(companiesBtn);
    expect(
      screen.getByRole("heading", { name: /sectivia company directory/i })
    ).toBeInTheDocument();

    // Switch to About tab
    fireEvent.click(aboutBtn);
    expect(
      screen.getByRole("heading", {
        name: /about atmograph & integration architecture/i,
      })
    ).toBeInTheDocument();

    // Switch back to Overview
    fireEvent.click(overviewBtn);
    expect(
      screen.getByRole("heading", { name: /executive dashboard overview/i })
    ).toBeInTheDocument();
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

    fireEvent.change(searchInput, { target: { value: "Apple" } });
    expect(searchInput.value).toBe("Apple");
  });

  it("renders skip link for screen readers", () => {
    render(<App />);
    const skipLink = screen.getByText("Skip to main dashboard content");
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute("href", "#dashboard");
  });
});
