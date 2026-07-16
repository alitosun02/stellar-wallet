import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DisclaimerBanner } from "./DisclaimerBanner";

describe("DisclaimerBanner", () => {
  it("warns that the app is testnet-only", () => {
    render(<DisclaimerBanner />);
    expect(screen.getByText(/Yalnızca Stellar Testnet/)).toBeInTheDocument();
    expect(screen.getByText(/sessionStorage/)).toBeInTheDocument();
  });
});
