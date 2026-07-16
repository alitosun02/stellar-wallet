import { describe, expect, it } from "vitest";
import { mapStellarError } from "./errors";

describe("mapStellarError", () => {
  it("classifies missing Freighter extension as WALLET_NOT_FOUND", () => {
    const result = mapStellarError(
      new Error("Freighter eklentisi bulunamadı. https://freighter.app adresinden kurabilirsiniz.")
    );
    expect(result.type).toBe("WALLET_NOT_FOUND");
  });

  it("classifies declined signing as USER_REJECTED", () => {
    expect(mapStellarError(new Error("User declined access")).type).toBe("USER_REJECTED");
    expect(mapStellarError(new Error("Freighter erişimi reddedildi: denied")).type).toBe(
      "USER_REJECTED"
    );
  });

  it("classifies tx_insufficient_balance from Horizon as INSUFFICIENT_BALANCE", () => {
    const horizonError = Object.assign(new Error("Request failed with status code 400"), {
      response: {
        status: 400,
        data: { extras: { result_codes: { transaction: "tx_insufficient_balance" } } },
      },
    });
    expect(mapStellarError(horizonError).type).toBe("INSUFFICIENT_BALANCE");
  });

  it("classifies op_underfunded as INSUFFICIENT_BALANCE", () => {
    const horizonError = Object.assign(new Error("Request failed with status code 400"), {
      response: {
        status: 400,
        data: {
          extras: { result_codes: { transaction: "tx_failed", operations: ["op_underfunded"] } },
        },
      },
    });
    expect(mapStellarError(horizonError).type).toBe("INSUFFICIENT_BALANCE");
  });

  it("classifies unfunded destination as DESTINATION_NOT_FOUND", () => {
    const preCheck = mapStellarError(
      new Error(
        "Alıcı hesap testnet üzerinde henüz mevcut değil. Ödeme alabilmesi için önce (örn. Friendbot ile) fonlanması gerekir."
      )
    );
    expect(preCheck.type).toBe("DESTINATION_NOT_FOUND");

    const horizonError = Object.assign(new Error("Request failed with status code 400"), {
      response: {
        status: 400,
        data: {
          extras: { result_codes: { transaction: "tx_failed", operations: ["op_no_destination"] } },
        },
      },
    });
    expect(mapStellarError(horizonError).type).toBe("DESTINATION_NOT_FOUND");
  });

  it("classifies missing source account as SOURCE_NOT_FOUND", () => {
    expect(mapStellarError(new Error("Account not found on ledger")).type).toBe(
      "SOURCE_NOT_FOUND"
    );
  });

  it("falls back to UNKNOWN with the original message", () => {
    const result = mapStellarError(new Error("something unexpected"));
    expect(result.type).toBe("UNKNOWN");
    expect(result.message).toBe("something unexpected");
  });
});
