import { describe, expect, it } from "vitest";
import { stroopsToXlm, xlmToStroops } from "./units";

describe("xlmToStroops", () => {
  it("converts whole XLM amounts", () => {
    expect(xlmToStroops("1")).toBe(10_000_000n);
    expect(xlmToStroops("25")).toBe(250_000_000n);
    expect(xlmToStroops("0")).toBe(0n);
  });

  it("converts fractional amounts down to 7 decimals", () => {
    expect(xlmToStroops("0.0000001")).toBe(1n);
    expect(xlmToStroops("1.5")).toBe(15_000_000n);
    expect(xlmToStroops("3.1415926")).toBe(31_415_926n);
  });

  it("truncates extra decimal precision beyond 7 digits", () => {
    expect(xlmToStroops("0.00000019")).toBe(1n);
  });
});

describe("stroopsToXlm", () => {
  it("converts stroops back to XLM strings", () => {
    expect(stroopsToXlm(10_000_000n)).toBe("1");
    expect(stroopsToXlm(15_000_000n)).toBe("1.5");
    expect(stroopsToXlm(1n)).toBe("0.0000001");
    expect(stroopsToXlm(0n)).toBe("0");
  });

  it("round-trips with xlmToStroops", () => {
    for (const value of ["1", "0.5", "123.4567891", "10000"]) {
      expect(stroopsToXlm(xlmToStroops(value))).toBe(value);
    }
  });
});
