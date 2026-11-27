import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "../App";
import { apiClient } from "../services/api";

describe("App Dashboard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

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

  describe("Dataset & Backend State Integration Scenarios", () => {
    it("Scenario 1: Offline Sectivia mode displays verified 382/556/162/8 statistics and Sectivia provenance label", async () => {
      vi.spyOn(apiClient, "get").mockRejectedValue(new Error("FastAPI server offline"));
      render(<App />);

      // Connection status indicator
      const statusPill = await screen.findByText("Sectivia Baseline (Offline Reference)");
      expect(statusPill).toBeInTheDocument();
      expect(statusPill.closest(".status")).toHaveClass("offline");

      // Verified Sectivia provenance label
      expect(screen.getByText("SECTIVIA · VERIFIED BASELINE")).toBeInTheDocument();

      // Verified statistics
      expect(screen.getByText("Total Companies")).toBeInTheDocument();
      expect(screen.getByText("382")).toBeInTheDocument();

      expect(screen.getByText("Supplier-Customer Relationships")).toBeInTheDocument();
      expect(screen.getByText("556")).toBeInTheDocument();

      expect(screen.getByText("Cross-Sector Relationships")).toBeInTheDocument();
      expect(screen.getByText("162")).toBeInTheDocument();

      expect(screen.getByText("Total Sectors")).toBeInTheDocument();
      expect(screen.getByText("8")).toBeInTheDocument();
    });

    it("Scenario 2: Live Synthetic mode displays dynamic node/edge counts and SYNTHETIC · SIMULATED DATA without verified Sectivia label", async () => {
      vi.spyOn(apiClient, "get").mockImplementation((url) => {
        if (url === "/health") {
          return Promise.resolve({
            data: {
              status: "ok",
              mode: "live",
              data_label: "SYNTHETIC / SIMULATED",
              n_nodes: 2,
              n_edges: 1,
            },
          });
        }
        if (url === "/nodes") {
          return Promise.resolve({
            data: [
              {
                node_id: "S0001",
                name: "Toronto Metals S0001",
                node_type: "Supplier",
                industry: "raw materials",
                risk_score: 0.85,
                data_source: "SYNTHETIC",
              },
              {
                node_id: "M0035",
                name: "Bavaria Motoren M0035",
                node_type: "Manufacturer",
                industry: "automotive",
                risk_score: 0.2,
                data_source: "SYNTHETIC",
              },
            ],
          });
        }
        if (url === "/edges") {
          return Promise.resolve({
            data: [
              {
                id: "e-syn-1",
                source: "S0001",
                target: "M0035",
                route_type: "Maritime",
                lead_time_days: 15,
                capacity: 5000,
                is_cross_sector: true,
              },
            ],
          });
        }
        if (url === "/alerts") {
          return Promise.resolve({ data: [] });
        }
        return Promise.reject(new Error("Not found"));
      });

      render(<App />);

      // Backend status is live
      const statusPill = await screen.findByText("Backend Live (FastAPI)");
      expect(statusPill).toBeInTheDocument();
      expect(statusPill.closest(".status")).toHaveClass("live");

      // Dynamic Synthetic provenance badge
      expect(screen.getByText("SYNTHETIC · SIMULATED DATA")).toBeInTheDocument();

      // Does not display verified Sectivia provenance badge
      expect(screen.queryByText("SECTIVIA · VERIFIED BASELINE")).not.toBeInTheDocument();

      // Displays dynamic counts: 2 nodes, 1 relationship
      const headingsWith2 = screen.getAllByRole("heading", { name: "2" });
      expect(headingsWith2.length).toBeGreaterThanOrEqual(1);
      const headingsWith1 = screen.getAllByRole("heading", { name: "1" });
      expect(headingsWith1.length).toBeGreaterThanOrEqual(1);

      // Does not display baseline counts
      expect(screen.queryByText("382")).not.toBeInTheDocument();
      expect(screen.queryByText("556")).not.toBeInTheDocument();
    });

    it("Scenario 3: Live Sectivia mode shows Sectivia verified provenance only when backend metadata confirms Sectivia", async () => {
      vi.spyOn(apiClient, "get").mockImplementation((url) => {
        if (url === "/health") {
          return Promise.resolve({
            data: {
              status: "ok",
              mode: "live",
              data_label: "SECTIVIA",
              n_nodes: 382,
              n_edges: 556,
            },
          });
        }
        if (url === "/nodes") {
          return Promise.resolve({
            data: [
              {
                node_id: "sectivia:aapl",
                name: "Apple Inc.",
                node_type: "Company",
                industry: "ai",
                data_source: "sectivia",
              },
            ],
          });
        }
        if (url === "/edges") {
          return Promise.resolve({ data: [] });
        }
        if (url === "/alerts") {
          return Promise.resolve({ data: [] });
        }
        return Promise.reject(new Error("Not found"));
      });

      render(<App />);

      // Connection is live
      const statusPill = await screen.findByText("Backend Live (FastAPI)");
      expect(statusPill).toBeInTheDocument();
      expect(statusPill.closest(".status")).toHaveClass("live");

      // Shows Sectivia verified provenance since metadata confirmed Sectivia
      expect(screen.getByText("SECTIVIA · VERIFIED BASELINE")).toBeInTheDocument();
      expect(screen.queryByText("SYNTHETIC · SIMULATED DATA")).not.toBeInTheDocument();
    });

    it("Scenario 4: AnonNet schema scenario does not show AnonNet label without actual AnonNet metadata", async () => {
      // Step A: When backend metadata is absent or generic, AnonNet labels must not appear
      vi.spyOn(apiClient, "get").mockImplementation((url) => {
        if (url === "/health") {
          return Promise.resolve({
            data: { status: "ok", mode: "live", data_label: "SYNTHETIC / SIMULATED" },
          });
        }
        return Promise.resolve({ data: [] });
      });

      const { unmount } = render(<App />);
      await screen.findByText("Backend Live (FastAPI)");
      expect(screen.queryByText("ANONNET · ANONYMIZED BENCHMARK")).not.toBeInTheDocument();
      unmount();

      // Step B: When backend metadata explicitly confirms AnonNet benchmark
      vi.spyOn(apiClient, "get").mockImplementation((url) => {
        if (url === "/health") {
          return Promise.resolve({
            data: {
              status: "ok",
              mode: "live",
              data_label: "ANONNET BENCHMARK",
              n_nodes: 1000,
              n_edges: 5000,
            },
          });
        }
        return Promise.resolve({ data: [] });
      });

      render(<App />);
      expect(await screen.findByText("ANONNET · ANONYMIZED BENCHMARK")).toBeInTheDocument();
      expect(screen.queryByText("SYNTHETIC · SIMULATED DATA")).not.toBeInTheDocument();
      expect(screen.queryByText("SECTIVIA · VERIFIED BASELINE")).not.toBeInTheDocument();
    });

    it("Scenario 5: Backend status indicators reflect correct live and offline status and handle network drops gracefully", async () => {
      // Test failed API responses / network timeouts
      vi.spyOn(apiClient, "get").mockImplementation(() => {
        return Promise.reject(new Error("Gateway Timeout 504"));
      });

      render(<App />);

      // Shows offline indicator with amber/offline styling class
      const statusPill = await screen.findByText("Sectivia Baseline (Offline Reference)");
      expect(statusPill).toBeInTheDocument();
      expect(statusPill.closest(".status")).toHaveClass("offline");

      // Verified fallback data remains available
      expect(screen.getByText("Total Companies")).toBeInTheDocument();
      expect(screen.getByText("382")).toBeInTheDocument();
    });
  });
});
