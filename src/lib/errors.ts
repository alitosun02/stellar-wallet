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

export function mapStellarError(error: unknown): MappedError {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

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
