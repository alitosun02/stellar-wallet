import "./polyfills";
import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";

export type WalletKind = "local" | "freighter" | "albedo";

export interface WalletConnection {
  kind: WalletKind;
  publicKey: string;
  /** Yalnızca yerel (keypair) cüzdanlarda bulunur. */
  secretKey?: string;
}

export const WALLET_LABELS: Record<WalletKind, string> = {
  local: "Yerel Cüzdan",
  freighter: "Freighter",
  albedo: "Albedo",
};

/**
 * Cüzdan türünden bağımsız imzalama: XDR alır, imzalı XDR döndürür.
 * - local: keypair ile doğrudan imzalar
 * - freighter: tarayıcı eklentisine imza isteği gönderir
 * - albedo: Albedo web intent penceresi açar
 */
export async function signWithWallet(
  connection: WalletConnection,
  xdr: string
): Promise<string> {
  switch (connection.kind) {
    case "local": {
      if (!connection.secretKey) {
        throw new Error("Yerel cüzdanın gizli anahtarı bulunamadı.");
      }
      const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
      tx.sign(Keypair.fromSecret(connection.secretKey));
      return tx.toXDR();
    }
    case "freighter": {
      const freighter = await import("@stellar/freighter-api");
      const result = await freighter.signTransaction(xdr, {
        networkPassphrase: Networks.TESTNET,
        address: connection.publicKey,
      });
      if ("error" in result && result.error) {
        throw new Error(`Freighter imzalama hatası: ${result.error}`);
      }
      return result.signedTxXdr;
    }
    case "albedo": {
      const albedo = (await import("@albedo-link/intent")).default;
      const result = await albedo.tx({ xdr, network: "testnet" });
      return result.signed_envelope_xdr;
    }
  }
}

/** Freighter eklentisine bağlanır ve adresi döndürür. */
export async function connectFreighter(): Promise<WalletConnection> {
  const freighter = await import("@stellar/freighter-api");

  const connected = await freighter.isConnected();
  if ("error" in connected && connected.error) {
    throw new Error(String(connected.error));
  }
  if (!connected.isConnected) {
    throw new Error(
      "Freighter eklentisi bulunamadı. https://freighter.app adresinden kurabilirsiniz."
    );
  }

  const access = await freighter.requestAccess();
  if (access.error) {
    throw new Error(`Freighter erişimi reddedildi: ${access.error}`);
  }

  const network = await freighter.getNetwork();
  if (!network.error && network.network !== "TESTNET") {
    throw new Error(
      `Freighter şu anda ${network.network} ağında. Lütfen eklentiden TESTNET ağına geçin.`
    );
  }

  return { kind: "freighter", publicKey: access.address };
}

/** Albedo web intent'i ile public key ister (eklenti gerektirmez). */
export async function connectAlbedo(): Promise<WalletConnection> {
  const albedo = (await import("@albedo-link/intent")).default;
  const result = await albedo.publicKey({});
  return { kind: "albedo", publicKey: result.pubkey };
}
