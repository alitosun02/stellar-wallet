import "./polyfills";
import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Memo,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

export const HORIZON_URL = "https://horizon-testnet.stellar.org";
export const FRIENDBOT_URL = "https://friendbot.stellar.org";
export const NETWORK_PASSPHRASE = Networks.TESTNET;

export const server = new Horizon.Server(HORIZON_URL);

export interface StellarWallet {
  publicKey: string;
  secretKey: string;
}

export interface WalletBalance {
  asset: string;
  amount: string;
}

export interface PaymentRecord {
  id: string;
  createdAt: string;
  from: string;
  to: string;
  amount: string;
  asset: string;
  successful: boolean;
  transactionHash: string;
}

export function generateWallet(): StellarWallet {
  const keypair = Keypair.random();
  return { publicKey: keypair.publicKey(), secretKey: keypair.secret() };
}

export function walletFromSecret(secretKey: string): StellarWallet {
  const keypair = Keypair.fromSecret(secretKey.trim());
  return { publicKey: keypair.publicKey(), secretKey: keypair.secret() };
}

export function isValidSecretKey(secretKey: string): boolean {
  try {
    Keypair.fromSecret(secretKey.trim());
    return true;
  } catch {
    return false;
  }
}

export function isValidPublicKey(publicKey: string): boolean {
  try {
    return Keypair.fromPublicKey(publicKey.trim()).publicKey() === publicKey.trim();
  } catch {
    return false;
  }
}

export class AccountNotFoundError extends Error {
  constructor(publicKey: string) {
    super(`Account ${publicKey} not found on the testnet ledger. Fund it first.`);
    this.name = "AccountNotFoundError";
  }
}

export async function fetchBalances(publicKey: string): Promise<WalletBalance[]> {
  try {
    const account = await server.loadAccount(publicKey);
    return account.balances.map((balance) => ({
      asset: balance.asset_type === "native" ? "XLM" : ("asset_code" in balance ? balance.asset_code ?? "unknown" : "unknown"),
      amount: balance.balance,
    }));
  } catch (error) {
    if (isNotFoundError(error)) {
      throw new AccountNotFoundError(publicKey);
    }
    throw error;
  }
}

export async function fundWithFriendbot(publicKey: string): Promise<void> {
  const response = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Friendbot funding failed: ${body}`);
  }
}

export async function accountExists(publicKey: string): Promise<boolean> {
  try {
    await server.loadAccount(publicKey);
    return true;
  } catch (error) {
    if (isNotFoundError(error)) return false;
    throw error;
  }
}

export interface SendPaymentParams {
  secretKey: string;
  destination: string;
  amount: string;
  memo?: string;
}

export interface SendPaymentResult {
  hash: string;
  ledger: number;
}

export async function sendPayment({
  secretKey,
  destination,
  amount,
  memo,
}: SendPaymentParams): Promise<SendPaymentResult> {
  const sourceKeypair = Keypair.fromSecret(secretKey.trim());
  const sourcePublicKey = sourceKeypair.publicKey();

  const destinationTrimmed = destination.trim();
  if (!isValidPublicKey(destinationTrimmed)) {
    throw new Error("Destination address is not a valid Stellar public key.");
  }

  const destinationFunded = await accountExists(destinationTrimmed);
  if (!destinationFunded) {
    throw new Error(
      "Destination account does not exist on the testnet yet. It must be funded (e.g. via Friendbot) before it can receive a payment."
    );
  }

  const sourceAccount = await server.loadAccount(sourcePublicKey);

  const builder = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  }).addOperation(
    Operation.payment({
      destination: destinationTrimmed,
      asset: Asset.native(),
      amount,
    })
  );

  if (memo) {
    builder.addMemo(Memo.text(memo.slice(0, 28)));
  }

  const transaction = builder.setTimeout(60).build();
  transaction.sign(sourceKeypair);

  const result = await server.submitTransaction(transaction);
  return { hash: result.hash, ledger: result.ledger };
}

export async function fetchRecentPayments(
  publicKey: string,
  limit = 10
): Promise<PaymentRecord[]> {
  let page;
  try {
    page = await server
      .payments()
      .forAccount(publicKey)
      .order("desc")
      .limit(limit)
      .call();
  } catch (error) {
    if (isNotFoundError(error)) return [];
    throw error;
  }

  return page.records
    .filter(
      (record): record is Horizon.ServerApi.PaymentOperationRecord =>
        record.type === "payment"
    )
    .map((record) => ({
      id: record.id,
      createdAt: record.created_at,
      from: record.from,
      to: record.to,
      amount: record.amount,
      asset: record.asset_type === "native" ? "XLM" : record.asset_code ?? "unknown",
      successful: record.transaction_successful,
      transactionHash: record.transaction_hash,
    }));
}

function isNotFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const maybe = error as { response?: { status?: number }; name?: string };
  return maybe.response?.status === 404 || maybe.name === "NotFoundError";
}

export function explorerAccountUrl(publicKey: string): string {
  return `https://stellar.expert/explorer/testnet/account/${publicKey}`;
}

export function explorerTxUrl(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}
