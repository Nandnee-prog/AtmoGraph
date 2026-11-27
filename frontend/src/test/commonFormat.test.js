import { describe, it, expect } from "vitest";
import {
  DATASET_SOURCES,
  DATASET_ID_PREFIXES,
  UNIVERSAL_NODE_SCHEMA,
  UNIVERSAL_RELATIONSHIP_SCHEMA,
  COMPANY_SCHEMA_DEFINITION,
  RELATIONSHIP_SCHEMA_DEFINITION,
  normalizeNode,
  normalizeRelationship,
  isValidNode,
  isValidUniversalRelationship,
  isValidCompany,
  isValidRelationship,
} from "../data/commonFormat";
import {
  SECTIVIA_COMPANIES,
  SECTIVIA_RELATIONSHIPS,
} from "../data/sectiviaData";

describe("Common Data Contract & Multi-Dataset Schema Generalization", () => {
  describe("Dataset Namespaces & Schema Definitions", () => {
    it("defines the three supported dataset sources and their namespaces", () => {
      expect(DATASET_SOURCES.SECTIVIA).toBe("sectivia");
      expect(DATASET_SOURCES.SYNTHETIC).toBe("synthetic");
      expect(DATASET_SOURCES.ANONNET).toBe("anonnet");

      expect(DATASET_ID_PREFIXES.sectivia).toBe("sectivia:");
      expect(DATASET_ID_PREFIXES.synthetic).toBe("synthetic:");
      expect(DATASET_ID_PREFIXES.anonnet).toBe("anonnet:");
    });

    it("maintains backward-compatible Week 1 baseline schema constants", () => {
      expect(COMPANY_SCHEMA_DEFINITION.idPrefix).toBe("sectivia:");
      expect(COMPANY_SCHEMA_DEFINITION.totalBaselineCompanies).toBe(382);
      expect(COMPANY_SCHEMA_DEFINITION.allowedSectors).toHaveLength(8);
      expect(RELATIONSHIP_SCHEMA_DEFINITION.type).toBe("SUPPLIES_TO");
      expect(RELATIONSHIP_SCHEMA_DEFINITION.totalBaselineRelationships).toBe(556);
      expect(RELATIONSHIP_SCHEMA_DEFINITION.totalCrossSectorRelationships).toBe(162);
    });
  });

  describe("Sectivia Node Normalization & Backward Compatibility", () => {
    it("normalizes Sectivia company records and passes both universal and legacy validation", () => {
      const sample = SECTIVIA_COMPANIES[0]; // e.g. sectivia:a (Agilent)
      const normalized = normalizeNode(sample, DATASET_SOURCES.SECTIVIA);

      expect(normalized).toBeDefined();
      expect(normalized.id).toBe(sample.id);
      expect(normalized.dataset_source).toBe("sectivia");
      expect(normalized.primary_group).toBe(sample.sector);
      expect(normalized.ticker).toBe(sample.ticker);
      expect(normalized.exchange).toBe(sample.exchange);
      expect(normalized.listed).toBe(true);
      expect(normalized.relations_count).toBe(sample.relations_count);

      // Passes universal validation
      expect(isValidNode(normalized)).toBe(true);
      // Passes legacy Sectivia validation
      expect(isValidCompany(sample)).toBe(true);
      expect(isValidCompany(normalized)).toBe(true);
    });

    it("automatically applies sectivia: namespace prefix if raw id is provided", () => {
      const raw = {
        raw_id: "msft",
        name: "Microsoft Corporation",
        sector: "ai",
        country: "USA",
        listed: true,
        relations_count: 12,
        dataset_source: "sectivia",
      };

      const normalized = normalizeNode(raw);
      expect(normalized.id).toBe("sectivia:msft");
      expect(isValidNode(normalized)).toBe(true);
      expect(isValidCompany(normalized)).toBe(true);
    });
  });

  describe("Synthetic Node Normalization & Missing Risk Score Safeguards", () => {
    it("normalizes Synthetic facility nodes and maps facility_type and region", () => {
      const rawSynthetic = {
        node_id: "S0001",
        name: "Toronto Metals S0001",
        node_type: "Supplier",
        facility_type: "Smelting Facility",
        country: "Canada",
        region: "North America",
        industry: "Raw Materials",
        risk_score: "0.85",
        data_source: "synthetic",
      };

      const normalized = normalizeNode(rawSynthetic, DATASET_SOURCES.SYNTHETIC);

      expect(normalized.id).toBe("synthetic:S0001");
      expect(normalized.dataset_source).toBe("synthetic");
      expect(normalized.primary_group).toBe("Smelting Facility");
      expect(normalized.facility_type).toBe("Smelting Facility");
      expect(normalized.region).toBe("North America");
      expect(normalized.risk_score).toBe(0.85);
      expect(isValidNode(normalized)).toBe(true);
    });

    it("explicitly preserves null for missing risk scores without inventing values", () => {
      const rawWithoutRisk = {
        node_id: "M0042",
        name: "Munich Assembly Plant",
        facility_type: "Assembly",
        dataset_source: "synthetic",
      };

      const normalized = normalizeNode(rawWithoutRisk);

      expect(normalized.risk_score).toBeNull();
      expect(isValidNode(normalized)).toBe(true);
    });

    it("safely clamps out-of-range risk scores to [0.0, 1.0]", () => {
      const highRisk = normalizeNode({
        id: "synthetic:N1",
        name: "Facility 1",
        risk_score: 1.5,
        dataset_source: "synthetic",
      });
      expect(highRisk.risk_score).toBe(1.0);

      const negativeRisk = normalizeNode({
        id: "synthetic:N2",
        name: "Facility 2",
        risk_score: -0.4,
        dataset_source: "synthetic",
      });
      expect(negativeRisk.risk_score).toBe(0.0);
    });
  });

  describe("AnonNet Schema-Only Fixture Normalization", () => {
    it("normalizes AnonNet benchmark fixtures conforming to cluster_id and degree", () => {
      // Schema-only test fixture; does not invent or claim real AnonNet dataset records
      const anonFixture = {
        raw_id: "1024",
        name: "AnonNet-1024",
        cluster_id: 12,
        degree: 48,
        dataset_source: "anonnet",
      };

      const normalized = normalizeNode(anonFixture, DATASET_SOURCES.ANONNET);

      expect(normalized.id).toBe("anonnet:1024");
      expect(normalized.dataset_source).toBe("anonnet");
      expect(normalized.primary_group).toBe("cluster-12");
      expect(normalized.cluster_id).toBe(12);
      expect(normalized.degree).toBe(48);
      expect(normalized.risk_score).toBeNull();
      expect(isValidNode(normalized)).toBe(true);
    });
  });

  describe("Universal Relationship Normalization & Validation", () => {
    it("normalizes Sectivia commercial relationships and passes both universal and legacy validation", () => {
      const sampleRel = SECTIVIA_RELATIONSHIPS[0];
      const normalized = normalizeRelationship(sampleRel, DATASET_SOURCES.SECTIVIA);

      expect(normalized.source).toBe(sampleRel.source);
      expect(normalized.target).toBe(sampleRel.target);
      expect(normalized.type).toBe("SUPPLIES_TO");
      expect(normalized.dataset_source).toBe("sectivia");
      expect(normalized.what).toBe(sampleRel.what);
      expect(normalized.is_cross_sector).toBe(sampleRel.is_cross_sector);

      expect(isValidUniversalRelationship(normalized)).toBe(true);
      expect(isValidRelationship(sampleRel)).toBe(true);
      expect(isValidRelationship(normalized)).toBe(true);
    });

    it("normalizes Synthetic logistical relationships with route_type, lead_time_days and capacity", () => {
      const rawSyntheticEdge = {
        source: "synthetic:S0001",
        target: "synthetic:M0035",
        route_type: "Maritime",
        lead_time_days: "24.5",
        capacity: "15000",
        data_source: "synthetic",
      };

      const normalized = normalizeRelationship(rawSyntheticEdge, DATASET_SOURCES.SYNTHETIC);

      expect(normalized.source).toBe("synthetic:S0001");
      expect(normalized.target).toBe("synthetic:M0035");
      expect(normalized.dataset_source).toBe("synthetic");
      expect(normalized.route_type).toBe("Maritime");
      expect(normalized.lead_time_days).toBe(24.5);
      expect(normalized.capacity).toBe(15000);
      expect(isValidUniversalRelationship(normalized)).toBe(true);
    });

    it("normalizes AnonNet benchmark edge fixtures with weight", () => {
      const rawAnonEdge = {
        source: "anonnet:101",
        target: "anonnet:202",
        weight: "0.92",
        dataset_source: "anonnet",
      };

      const normalized = normalizeRelationship(rawAnonEdge, DATASET_SOURCES.ANONNET);

      expect(normalized.source).toBe("anonnet:101");
      expect(normalized.target).toBe("anonnet:202");
      expect(normalized.dataset_source).toBe("anonnet");
      expect(normalized.weight).toBe(0.92);
      expect(isValidUniversalRelationship(normalized)).toBe(true);
    });
  });

  describe("Immutability & Non-Mutation Safeguards", () => {
    it("does not mutate original raw input node objects", () => {
      const original = Object.freeze({
        raw_id: "sample-99",
        name: "Immutable Node",
        dataset_source: "synthetic",
      });

      expect(() => normalizeNode(original)).not.toThrow();
      const normalized = normalizeNode(original);
      expect(normalized).not.toBe(original);
      expect(normalized.id).toBe("synthetic:sample-99");
    });

    it("does not mutate original raw relationship objects", () => {
      const originalRel = Object.freeze({
        source: "synthetic:A",
        target: "synthetic:B",
        dataset_source: "synthetic",
      });

      expect(() => normalizeRelationship(originalRel)).not.toThrow();
      const normalized = normalizeRelationship(originalRel);
      expect(normalized).not.toBe(originalRel);
      expect(normalized.source).toBe("synthetic:A");
    });
  });
});
