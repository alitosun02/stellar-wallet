/**
 * Stellar/cüzdan hatalarını kullanıcı dostu, sınıflandırılmış mesajlara çevirir.
 *
 * Level 2 gereksinimi olan "3+ hata türü" burada merkezi olarak ele alınır:
 *  1. WALLET_NOT_FOUND      — Freighter eklentisi kurulu değil
 *  2. USER_REJECTED         — kullanıcı imza isteğini reddetti
 *  3. INSUFFICIENT_BALANCE  — yetersiz bakiye (ücret veya tutar karşılanamıyor)
 *  4. DESTINATION_NOT_FOUND — alıcı hesap testnet'te mevcut/fonlanmış değil
 *  5. SOURCE_NOT_FOUND      — gönderen hesap henüz fonlanmamış
 */
export type StellarErrorType =
  | "WALLET_NOT_FOUND"
  | "USER_REJECTED"
  | "INSUFFICIENT_BALANCE"
  | "DESTINATION_NOT_FOUND"
  | "SOURCE_NOT_FOUND"
  | "CONTRACT_REJECTED"
  | "VALIDATION"
  | "UNKNOWN";

export interface MappedError {
  type: StellarErrorType;
  message: string;
}

interface HorizonErrorShape {
  response?: {
    status?: number;
    data?: {
      extras?: {
        result_codes?: {
          transaction?: string;
          operations?: string[];
        };
      };
    };
  };
}

/**
 * Kampanya kontratının `#[contracterror]` kodları (contracts/campaign/src/lib.rs).
 * Soroban hataları `Error(Contract, #N)` biçiminde geldiği için burada
 * kullanıcı diline çevrilir.
 */
const CAMPAIGN_CONTRACT_ERRORS: Record<number, string> = {
  1: "This contract is already initialized.",
  2: "The contract is not initialized yet.",
  3: "Amount must be greater than zero.",
  4: "Funding goal must be greater than zero.",
  5: "The deadline must be in the future.",
  6: "Campaign not found.",
  7: "This campaign has ended and no longer accepts support.",
  8: "The funding goal has not been reached yet, so funds cannot be withdrawn.",
  9: "The funds for this campaign were already withdrawn.",
  10: "The campaign is still running — refunds are only available after it ends.",
  11: "This campaign reached its goal, so refunds are not available.",
  12: "There is nothing to refund for this wallet.",
};

export function mapStellarError(error: unknown): MappedError {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  // Soroban kontrat hatası: Error(Contract, #7)
  const contractCode = raw.match(/Error\(Contract,\s*#(\d+)\)/);
  if (contractCode) {
    const code = Number(contractCode[1]);
    return {
      type: "CONTRACT_REJECTED",
      message: CAMPAIGN_CONTRACT_ERRORS[code] ?? `The contract rejected this call (code ${code}).`,
    };
  }

  // 1) Cüzdan bulunamadı (Freighter eklentisi yok)
  if (lower.includes("freighter eklentisi bulunamadı") || lower.includes("wallet not found")) {
    return {
      type: "WALLET_NOT_FOUND",
      message:
        "Cüzdan bulunamadı: Freighter eklentisi kurulu değil. freighter.app adresinden kurup tekrar deneyin.",
    };
  }

  // 2) Kullanıcı imzayı reddetti (Freighter "User declined access", Albedo "intent_rejected")
  if (
    lower.includes("declined") ||
    lower.includes("rejected") ||
    lower.includes("denied") ||
    lower.includes("reddedildi")
  ) {
    return {
      type: "USER_REJECTED",
      message: "İşlem reddedildi: imza isteği cüzdanda onaylanmadı.",
    };
  }

  // Horizon result_codes analizi (3, 4, 5)
  const codes = extractResultCodes(error);
  if (codes) {
    if (
      codes.transaction === "tx_insufficient_balance" ||
      codes.operations?.includes("op_underfunded")
    ) {
      return {
        type: "INSUFFICIENT_BALANCE",
        message:
          "Yetersiz bakiye: bu tutarı (ve işlem ücretini) karşılayacak XLM yok. Friendbot ile fonlayıp tekrar deneyin.",
      };
    }
    if (codes.operations?.includes("op_no_destination")) {
      return {
        type: "DESTINATION_NOT_FOUND",
        message:
          "Alıcı hesap bulunamadı: adres testnet üzerinde henüz aktive edilmemiş (önce fonlanması gerekir).",
      };
    }
  }

  if (lower.includes("alıcı hesap testnet üzerinde henüz mevcut değil")) {
    return {
      type: "DESTINATION_NOT_FOUND",
      message: raw,
    };
  }

  // 5) Kaynak hesap fonlanmamış (Horizon/RPC 404 — hesap ledger'da yok)
  if (lower.includes("not found") && lower.includes("account")) {
    return {
      type: "SOURCE_NOT_FOUND",
      message:
        "Hesap bulunamadı: cüzdanınız testnet üzerinde henüz aktive edilmemiş. Önce Friendbot ile fonlayın.",
    };
  }

  return { type: "UNKNOWN", message: raw };
}

function extractResultCodes(
  error: unknown
): { transaction?: string; operations?: string[] } | null {
  if (typeof error !== "object" || error === null) return null;
  const shaped = error as HorizonErrorShape;
  return shaped.response?.data?.extras?.result_codes ?? null;
}
