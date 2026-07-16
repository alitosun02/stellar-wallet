import "./polyfills";
import {
  Address,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE, sorobanServer, xlmToStroops, stroopsToXlm } from "./soroban";
import type { TxStatus } from "./counter";

/**
 * Bu proje kapsamında yazılıp testnet'e deploy edilen Donation (Tip Jar) kontratı.
 * Kaynak: contracts/donation/src/lib.rs
 * Deploy tx: 95d67e27cdb2c954a65dcf9cf51089f55f61f020d7d8fa5751580a2e1b8bc170
 * Init tx:   ee02ca5634616ce9b6802ddd6b495dfc66c6bed0a52e634939c5c7cc0c00f3e9
 */
export const DONATION_CONTRACT_ID =
  "CBEI7CRINGW5S4VT5MOD4NOVO6ZIJKCVDOHUAPFF6NHVGRLYUQSMLJRJ";

export interface DonationStats {
  totalXlm: string;
  count: number;
  donorTotalXlm: string;
}

export interface DonationEventRecord {
  id: string;
  donor: string;
  amountXlm: string;
  totalXlm: string;
  ledger: number;
}

async function simulateRead(sourcePublicKey: string, method: string, args: import("@stellar/stellar-sdk").xdr.ScVal[] = []) {
  const contract = new Contract(DONATION_CONTRACT_ID);
  const account = await sorobanServer.getAccount(sourcePublicKey);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();

  const sim = await sorobanServer.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Kontrat okuması başarısız: ${sim.error}`);
  }
  if (!sim.result?.retval) {
    throw new Error("Kontrat okuması sonuç döndürmedi.");
  }
  return scValToNative(sim.result.retval);
}

/** Toplam bağış, bağış sayısı ve bağlı cüzdanın kümülatif bağışını okur. */
export async function readDonationStats(sourcePublicKey: string): Promise<DonationStats> {
  const [total, count, donorTotal] = await Promise.all([
    simulateRead(sourcePublicKey, "get_total") as Promise<bigint>,
    simulateRead(sourcePublicKey, "get_count") as Promise<number>,
    simulateRead(sourcePublicKey, "get_donor_total", [
      nativeToScVal(Address.fromString(sourcePublicKey), { type: "address" }),
    ]) as Promise<bigint>,
  ]);

  return {
    totalXlm: stroopsToXlm(BigInt(total)),
    count: Number(count),
    donorTotalXlm: stroopsToXlm(BigInt(donorTotal)),
  };
}

export interface DonateParams {
  sourcePublicKey: string;
  amountXlm: string;
  signTransaction: (xdr: string) => Promise<string>;
  onStatus: (status: TxStatus) => void;
}

export interface DonateResult {
  hash: string;
  newTotalXlm: string;
}

/**
 * `donate` fonksiyonunu invoke eder. Kontrat, tutarı XLM token kontratına
 * (SAC) yaptığı cross-contract transfer çağrısıyla tahsil eder.
 */
export async function donate({
  sourcePublicKey,
  amountXlm,
  signTransaction,
  onStatus,
}: DonateParams): Promise<DonateResult> {
  onStatus("building");
  const stroops = xlmToStroops(amountXlm);
  if (stroops <= 0n) {
    onStatus("failed");
    throw new Error("Bağış tutarı sıfırdan büyük olmalı.");
  }

  const contract = new Contract(DONATION_CONTRACT_ID);
  const account = await sorobanServer.getAccount(sourcePublicKey);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "donate",
        nativeToScVal(Address.fromString(sourcePublicKey), { type: "address" }),
        nativeToScVal(stroops, { type: "i128" })
      )
    )
    .setTimeout(120)
    .build();

  const prepared = await sorobanServer.prepareTransaction(tx);

  onStatus("signing");
  const signedXdr = await signTransaction(prepared.toXDR());
  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  onStatus("pending");
  const sendResult = await sorobanServer.sendTransaction(signedTx);
  if (sendResult.status === "ERROR") {
    onStatus("failed");
    throw new Error(
      `İşlem gönderilemedi: ${sendResult.errorResult?.result().switch().name ?? "bilinmeyen hata"}`
    );
  }

  const confirmed = await sorobanServer.pollTransaction(sendResult.hash, {
    attempts: 15,
    sleepStrategy: () => 1500,
  });

  if (confirmed.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    onStatus("failed");
    throw new Error(`Bağış işlemi onaylanmadı (durum: ${confirmed.status}).`);
  }

  const newTotal =
    "returnValue" in confirmed && confirmed.returnValue
      ? stroopsToXlm(BigInt(scValToNative(confirmed.returnValue) as bigint))
      : "?";

  onStatus("success");
  return { hash: sendResult.hash, newTotalXlm: newTotal };
}

/** Kontratın `Donation` event'lerini çeker (event streaming / real-time updates). */
export async function fetchDonationEvents(limit = 5): Promise<DonationEventRecord[]> {
  const health = await sorobanServer.getHealth();
  const startLedger = Math.max(health.latestLedger - 9_000, health.oldestLedger + 1);

  const response = await sorobanServer.getEvents({
    startLedger,
    filters: [{ type: "contract", contractIds: [DONATION_CONTRACT_ID] }],
    limit: 100,
  });

  return response.events
    .map((event) => {
      try {
        const topics = event.topic.map((t) => scValToNative(t));
        const value = scValToNative(event.value) as Record<string, unknown>;
        // Donation event: topics = ["donation", donor], value = { amount, total }
        if (String(topics[0]) !== "donation") return null;
        return {
          id: event.id,
          donor: String(topics[1] ?? ""),
          amountXlm: stroopsToXlm(BigInt(value.amount as bigint)),
          totalXlm: stroopsToXlm(BigInt(value.total as bigint)),
          ledger: event.ledger,
        };
      } catch {
        return null;
      }
    })
    .filter((e): e is DonationEventRecord => e !== null)
    .slice(-limit)
    .reverse();
}
