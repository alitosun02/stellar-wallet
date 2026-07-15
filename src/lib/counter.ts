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
import { NETWORK_PASSPHRASE, sorobanServer } from "./soroban";

/**
 * Bu proje kapsamında yazılıp testnet'e deploy edilen Counter kontratı.
 * Kaynak kodu: contracts/counter/src/lib.rs
 * Deploy tx: a74729e3fb34146a9ec9b22bc320d993fd761181f7df7e04c8469e6ebe7719e7
 */
export const COUNTER_CONTRACT_ID =
  "CCHEGI3ARKF6LGGLKQDBIPXSPD76DXHGOXO7SADH6ZUB3LUJ7YFGP437";

export type TxStatus = "idle" | "building" | "signing" | "pending" | "success" | "failed";

export interface IncrementEventRecord {
  id: string;
  caller: string;
  count: number;
  ledger: number;
}

/** Kontratın `get_count` fonksiyonunu simulate ile (salt-okunur) çağırır. */
export async function readCount(sourcePublicKey: string): Promise<number> {
  const contract = new Contract(COUNTER_CONTRACT_ID);
  const account = await sorobanServer.getAccount(sourcePublicKey);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("get_count"))
    .setTimeout(60)
    .build();

  const sim = await sorobanServer.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Kontrat okuması başarısız: ${sim.error}`);
  }
  if (!sim.result?.retval) {
    throw new Error("Kontrat okuması sonuç döndürmedi.");
  }
  return Number(scValToNative(sim.result.retval));
}

export interface IncrementParams {
  sourcePublicKey: string;
  signTransaction: (xdr: string) => Promise<string>;
  /** İşlem yaşam döngüsü durum bildirimi (UI'da pending/success/fail göstermek için). */
  onStatus: (status: TxStatus) => void;
}

export interface IncrementResult {
  hash: string;
  newCount: number;
}

/**
 * Kontratın `increment` fonksiyonunu gerçek bir InvokeHostFunction işlemi
 * olarak çağırır: build → prepare → sign (cüzdan) → send → poll.
 */
export async function incrementCounter({
  sourcePublicKey,
  signTransaction,
  onStatus,
}: IncrementParams): Promise<IncrementResult> {
  onStatus("building");
  const contract = new Contract(COUNTER_CONTRACT_ID);
  const account = await sorobanServer.getAccount(sourcePublicKey);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "increment",
        nativeToScVal(Address.fromString(sourcePublicKey), { type: "address" })
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
    throw new Error(`Kontrat işlemi onaylanmadı (durum: ${confirmed.status}).`);
  }

  const newCount =
    "returnValue" in confirmed && confirmed.returnValue
      ? Number(scValToNative(confirmed.returnValue))
      : NaN;

  onStatus("success");
  return { hash: sendResult.hash, newCount };
}

/**
 * Kontratın yayınladığı `Increment` olaylarını Soroban RPC getEvents ile çeker
 * (event listening / state synchronization).
 */
export async function fetchIncrementEvents(limit = 5): Promise<IncrementEventRecord[]> {
  // RPC, getEvents taramasını sınırlı bir ledger penceresinde yapar; geniş
  // pencerelerde (ör. 50k+ ledger) ilk sayfada eşleşme dönmeyebilir. Son ~12
  // saatlik pencere (≈9k ledger) demo için yeterlidir; alt sınırı yine de
  // retention'ın başlangıcına (oldestLedger) kelepçele.
  const health = await sorobanServer.getHealth();
  const startLedger = Math.max(health.latestLedger - 9_000, health.oldestLedger + 1);

  const response = await sorobanServer.getEvents({
    startLedger,
    filters: [{ type: "contract", contractIds: [COUNTER_CONTRACT_ID] }],
    limit: 100,
  });

  return response.events
    .map((event) => {
      try {
        const topics = event.topic.map((t) => scValToNative(t));
        const value = scValToNative(event.value);
        // #[contractevent] Increment: topics = ["increment", caller], value = { count } | count
        const caller = String(topics[1] ?? "");
        const count =
          typeof value === "object" && value !== null && "count" in value
            ? Number((value as { count: unknown }).count)
            : Number(value);
        return {
          id: event.id,
          caller,
          count,
          ledger: event.ledger,
        };
      } catch {
        return null;
      }
    })
    .filter((e): e is IncrementEventRecord => e !== null && !Number.isNaN(e.count))
    .slice(-limit)
    .reverse();
}

export function explorerContractUrl(contractId: string): string {
  return `https://stellar.expert/explorer/testnet/contract/${contractId}`;
}
