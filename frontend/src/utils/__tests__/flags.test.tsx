import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CountryFlag } from "../flags";

describe("CountryFlag", () => {
  it("renders the matching flag SVG for a known country code", () => {
    const { container } = render(<CountryFlag countryCode="BR" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("is case-insensitive", () => {
    const { container } = render(<CountryFlag countryCode="br" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders nothing when countryCode is empty", () => {
    const { container } = render(<CountryFlag countryCode="" />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders nothing for an unresolved/unknown country code", () => {
    const { container } = render(<CountryFlag countryCode="XX" />);
    expect(container.querySelector("svg")).toBeNull();
  });
});
