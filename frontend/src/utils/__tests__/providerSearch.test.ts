import { describe, expect, it } from "vitest";
import { sanitizeProviderSearchQuery } from "../providerSearch";

describe("sanitizeProviderSearchQuery", () => {
  it("keeps the title and year while removing release metadata", () => {
    expect(
      sanitizeProviderSearchQuery(
        "Super.Mario.Galaxy.O.Filme.2026.WEB-DL.1080p.x264.DUAL.5.1"
      )
    ).toBe("Super Mario Galaxy O Filme 2026");
  });

  it("collapses release separators and whitespace", () => {
    expect(sanitizeProviderSearchQuery("The.Matrix.1999.BluRay.2160p.HEVC")).toBe(
      "The Matrix 1999"
    );
  });

  it("does not remove technical-looking text inside a title", () => {
    expect(sanitizeProviderSearchQuery("Web of Lies 2024")).toBe("Web of Lies 2024");
  });

  it("recognizes normalized separators around provider metadata", () => {
    expect(sanitizeProviderSearchQuery("Movie.2024.WEB.1080p.x265")).toBe("Movie 2024");
    expect(sanitizeProviderSearchQuery("Movie.2024.Dual-Audio")).toBe("Movie 2024");
  });

  it("handles a long malformed web prefix without matching release metadata", () => {
    const malformedValue = `web${"-".repeat(50_000)}notmetadata`;

    expect(sanitizeProviderSearchQuery(malformedValue)).toBe("web notmetadata");
  });
});
