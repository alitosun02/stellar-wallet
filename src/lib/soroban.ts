import "./polyfills";
import {
  Address,
  Asset,
  BASE_FEE,
  Contract,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  TimeoutInfinite,
} from "@stellar/stellar-sdk";
import { server as horizonServer } from "./stellar";

export const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
export const NETWORK_PASSPHRASE = Networks.TESTNET;

export const sorobanServer = new rpc.Server(SOROBAN_RPC_URL);

/**
 * Native XLM'in Soroban tarafındaki Stellar Asset Contract (SAC) kimliği.
 * Testnet için deterministik olarak türetilir.
 */
export const NATIVE_SAC_CONTRACT_ID = Asset.native().contractId(NETWORK_PASSPHRASE);

const STROOPS_PER_XLM = 10_000_000n;

export function xlmToStroops(xlm: string): bigint {
  const [whole = "0", frac = ""] = xlm.trim().split(".");
  const fracPadded = (frac + "0000000").slice(0, 7);
  return BigInt(whole) * STROOPS_PER_XLM + BigInt(fracPadded || "0");
}

export function stroopsToXlm(stroops: bigint): string {
  const whole = stroops / STROOPS_PER_XLM;
  const frac = (stroops % STROOPS_PER_XLM).toString().padStart(7, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

/**
 * SAC `balance` fonksiyonunu simulateTransaction ile (imza gerektirmeden,
 * salt-okunur) çağırarak hesabın XLM bakiyesini kontrat üzerinden okur.
 */
export async function readBalanceViaContract(publicKey: string): Promise<string> {
  const contract = new Contract(NATIVE_SAC_CONTRACT_ID);
  const account = await sorobanServer.getAccount(publicKey);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call("balance", nativeToScVal(Address.fromString(publicKey), { type: "address" }))
    )
    .setTimeout(TimeoutInfinite)
    .build();

  const sim = await sorobanServer.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Kontrat simülasyonu başarısız: ${sim.error}`);
  }
  if (!sim.result?.retval) {
    throw new Error("Kontrat simülasyonu sonuç döndürmedi.");
  }

  const raw = scValToNative(sim.result.retval) as bigint;
  return stroopsToXlm(raw);
}

export interface ContractTransferParams {
  sourcePublicKey: string;
  destination: string;
  amountXlm: string;
  /** İmzalayıcı: XDR alır, imzalı XDR döndürür (yerel keypair veya harici cüzdan). */
  signTransaction: (xdr: string) => Promise<string>;
}

export interface ContractTransferResult {
  hash: string;
}

/**
 * XLM'i klasik payment operasyonu yerine Soroban SAC kontratının `transfer`
 * fonksiyonunu invoke ederek gönderir. Gerçek bir smart contract çağrısıdır
 * ve zincir üzerinde InvokeHostFunction işlemi olarak görünür.
 */
export async function transferViaContract({
  sourcePublicKey,
  destination,
  amountXlm,
  signTransaction,
}: ContractTransferParams): Promise<ContractTransferResult> {
  const contract = new Contract(NATIVE_SAC_CONTRACT_ID);
  const account = await sorobanServer.getAccount(sourcePublicKey);
  const stroops = xlmToStroops(amountXlm);

  if (stroops <= 0n) {
    throw new Error("Miktar sıfırdan büyük olmalı.");
  }

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "transfer",
        nativeToScVal(Address.fromString(sourcePublicKey), { type: "address" }),
        nativeToScVal(Address.fromString(destination.trim()), { type: "address" }),
        nativeToScVal(stroops, { type: "i128" })
      )
    )
    .setTimeout(120)
    .build();

  const prepared = await sorobanServer.prepareTransaction(tx);
  const signedXdr = await signTransaction(prepared.toXDR());
  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  const sendResult = await sorobanServer.sendTransaction(signedTx);
  if (sendResult.status === "ERROR") {
    throw new Error(
      `İşlem gönderilemedi: ${sendResult.errorResult?.result().switch().name ?? "bilinmeyen hata"}`
    );
  }

  const hash = sendResult.hash;
  const confirmed = await sorobanServer.pollTransaction(hash, {
    attempts: 15,
    sleepStrategy: () => 1500,
  });

  if (confirmed.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`Kontrat işlemi onaylanmadı (durum: ${confirmed.status}).`);
  }

  return { hash };
}

/** Horizon'ı da dışa aç — dashboard tek noktadan import edebilsin. */
export { horizonServer };
