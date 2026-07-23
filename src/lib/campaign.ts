import "./polyfills";
import {
  Address,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE, sorobanServer } from "./soroban";
import { stroopsToXlm, xlmToStroops } from "./units";

/**
 * FanFuel kampanya kontratı — bu proje kapsamında yazılıp testnet'e deploy edildi.
 * Kaynak: contracts/campaign/src/lib.rs
 * Deploy tx: 2697de38097b8f2ba5e946c7ed66c938bdefb62ebde8de32dd8a4b4f6bf09bd4
 * Init tx:   1c88f231ed419300f2dda03d82aae267becb095e420fe55eb76d5b2c227eb9cc
 */
export const CAMPAIGN_CONTRACT_ID =
  "CCUMBJRRHPBC6XRGCSK54NPY2IZ4EQGHAOL4B7XT5BUCHUYQKG2CLMUT";

/**
 * Cüzdan bağlı değilken de kampanyaları okuyabilmek için kullanılan,
 * testnet'te var olan salt-okunur simülasyon kaynağı (kontratı deploy eden hesap).
 * Simülasyon imza gerektirmez ve zincirde hiçbir değişiklik yapmaz.
 */
const READ_ONLY_SOURCE = "GBSUXN22UTCUYFKQKDE2HTOMZG4DJUWUBXWC6D6EOW627UB777OGOUWU";

export type TxStatus = "idle" | "building" | "signing" | "pending" | "success" | "failed";

export type CampaignStatus = "active" | "succeeded" | "failed" | "withdrawn";

export interface Campaign {
  id: number;
  creator: string;
  title: string;
  goalXlm: string;
  deadline: Date;
  raisedXlm: string;
  supporters: number;
  withdrawn: boolean;
  status: CampaignStatus;
  progressPercent: number;
}

export interface CampaignEventRecord {
  id: string;
  kind: "created" | "donation" | "withdrawal" | "refund";
  campaignId: number;
  actor: string;
  amountXlm?: string;
  ledger: number;
  txHash: string;
}

interface RawCampaign {
  id: number;
  creator: string;
  title: string;
  goal: bigint;
  deadline: bigint;
  raised: bigint;
  supporters: number;
  withdrawn: boolean;
}

function toCampaign(raw: RawCampaign): Campaign {
  const goal = BigInt(raw.goal);
  const raised = BigInt(raw.raised);
  const deadline = new Date(Number(raw.deadline) * 1000);
  const withdrawn = Boolean(raw.withdrawn);

  let status: CampaignStatus;
  if (withdrawn) status = "withdrawn";
  else if (raised >= goal) status = "succeeded";
  else if (deadline.getTime() <= Date.now()) status = "failed";
  else status = "active";

  const progressPercent =
    goal > 0n ? Math.min(100, Number((raised * 10000n) / goal) / 100) : 0;

  return {
    id: Number(raw.id),
    creator: String(raw.creator),
    title: String(raw.title),
    goalXlm: stroopsToXlm(goal),
    deadline,
    raisedXlm: stroopsToXlm(raised),
    supporters: Number(raw.supporters),
    withdrawn,
    status,
    progressPercent,
  };
}

async function simulate(
  method: string,
  args: xdr.ScVal[] = [],
  sourcePublicKey: string = READ_ONLY_SOURCE
): Promise<unknown> {
  const contract = new Contract(CAMPAIGN_CONTRACT_ID);
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
    throw new Error(`Contract read failed (${method}): ${sim.error}`);
  }
  if (!sim.result?.retval) {
    throw new Error(`Contract read returned no value (${method}).`);
  }
  return scValToNative(sim.result.retval);
}

export async function listCampaigns(limit = 20): Promise<Campaign[]> {
  const raw = (await simulate("list_campaigns", [
    nativeToScVal(limit, { type: "u32" }),
  ])) as RawCampaign[];
  return raw.map(toCampaign);
}

export async function getCampaign(id: number): Promise<Campaign> {
  const raw = (await simulate("get_campaign", [
    nativeToScVal(id, { type: "u32" }),
  ])) as RawCampaign;
  return toCampaign(raw);
}

export async function getContribution(id: number, donor: string): Promise<string> {
  const raw = (await simulate("get_contribution", [
    nativeToScVal(id, { type: "u32" }),
    nativeToScVal(Address.fromString(donor), { type: "address" }),
  ])) as bigint;
  return stroopsToXlm(BigInt(raw));
}

export interface InvokeParams {
  sourcePublicKey: string;
  signTransaction: (xdr: string) => Promise<string>;
  onStatus?: (status: TxStatus) => void;
}

export interface InvokeResult<T> {
  hash: string;
  value: T;
}

/** Ortak invoke akışı: build → prepare → sign → send → poll. */
async function invoke<T>(
  method: string,
  args: xdr.ScVal[],
  { sourcePublicKey, signTransaction, onStatus }: InvokeParams,
  parse: (value: unknown) => T
): Promise<InvokeResult<T>> {
  const setStatus = onStatus ?? (() => {});
  setStatus("building");

  const contract = new Contract(CAMPAIGN_CONTRACT_ID);
  const account = await sorobanServer.getAccount(sourcePublicKey);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(120)
    .build();

  const prepared = await sorobanServer.prepareTransaction(tx);

  setStatus("signing");
  const signedXdr = await signTransaction(prepared.toXDR());
  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  setStatus("pending");
  const sendResult = await sorobanServer.sendTransaction(signedTx);
  if (sendResult.status === "ERROR") {
    setStatus("failed");
    throw new Error(
      `Transaction rejected: ${sendResult.errorResult?.result().switch().name ?? "unknown error"}`
    );
  }

  const confirmed = await sorobanServer.pollTransaction(sendResult.hash, {
    attempts: 15,
    sleepStrategy: () => 1500,
  });

  if (confirmed.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    setStatus("failed");
    throw new Error(`Transaction not confirmed (status: ${confirmed.status}).`);
  }

  const value =
    "returnValue" in confirmed && confirmed.returnValue
      ? scValToNative(confirmed.returnValue)
      : undefined;

  setStatus("success");
  return { hash: sendResult.hash, value: parse(value) };
}

export async function createCampaign(
  params: InvokeParams & { title: string; goalXlm: string; durationDays: number }
): Promise<InvokeResult<number>> {
  const goal = xlmToStroops(params.goalXlm);
  if (goal <= 0n) throw new Error("Goal must be greater than zero.");
  if (!params.title.trim()) throw new Error("Campaign title is required.");

  const deadline = Math.floor(Date.now() / 1000) + params.durationDays * 86_400;

  return invoke<number>(
    "create_campaign",
    [
      nativeToScVal(Address.fromString(params.sourcePublicKey), { type: "address" }),
      nativeToScVal(params.title.trim(), { type: "string" }),
      nativeToScVal(goal, { type: "i128" }),
      nativeToScVal(deadline, { type: "u64" }),
    ],
    params,
    (value) => Number(value)
  );
}

export async function donateToCampaign(
  params: InvokeParams & { campaignId: number; amountXlm: string }
): Promise<InvokeResult<string>> {
  const amount = xlmToStroops(params.amountXlm);
  if (amount <= 0n) throw new Error("Amount must be greater than zero.");

  return invoke<string>(
    "donate",
    [
      nativeToScVal(params.campaignId, { type: "u32" }),
      nativeToScVal(Address.fromString(params.sourcePublicKey), { type: "address" }),
      nativeToScVal(amount, { type: "i128" }),
    ],
    params,
    (value) => stroopsToXlm(BigInt((value as bigint) ?? 0n))
  );
}

export async function withdrawCampaign(
  params: InvokeParams & { campaignId: number }
): Promise<InvokeResult<string>> {
  return invoke<string>(
    "withdraw",
    [nativeToScVal(params.campaignId, { type: "u32" })],
    params,
    (value) => stroopsToXlm(BigInt((value as bigint) ?? 0n))
  );
}

export async function claimRefund(
  params: InvokeParams & { campaignId: number }
): Promise<InvokeResult<string>> {
  return invoke<string>(
    "claim_refund",
    [
      nativeToScVal(params.campaignId, { type: "u32" }),
      nativeToScVal(Address.fromString(params.sourcePublicKey), { type: "address" }),
    ],
    params,
    (value) => stroopsToXlm(BigInt((value as bigint) ?? 0n))
  );
}

/** Kontrat olaylarını çeker — canlı destek akışı ve kullanıcı etkileşim kanıtı için. */
export async function fetchCampaignEvents(
  options: { campaignId?: number; limit?: number } = {}
): Promise<CampaignEventRecord[]> {
  const { campaignId, limit = 20 } = options;
  const health = await sorobanServer.getHealth();
  const startLedger = Math.max(health.latestLedger - 9_000, health.oldestLedger + 1);

  const response = await sorobanServer.getEvents({
    startLedger,
    filters: [{ type: "contract", contractIds: [CAMPAIGN_CONTRACT_ID] }],
    limit: 200,
  });

  const kindByTopic: Record<string, CampaignEventRecord["kind"]> = {
    campaign_created: "created",
    donation: "donation",
    withdrawal: "withdrawal",
    refund: "refund",
  };

  return response.events
    .map((event): CampaignEventRecord | null => {
      try {
        const topics = event.topic.map((t) => scValToNative(t));
        const kind = kindByTopic[String(topics[0])];
        if (!kind) return null;

        const value = scValToNative(event.value) as Record<string, unknown>;
        const amount = value.amount as bigint | undefined;

        return {
          id: event.id,
          kind,
          campaignId: Number(value.id ?? -1),
          actor: String(topics[1] ?? ""),
          amountXlm: amount !== undefined ? stroopsToXlm(BigInt(amount)) : undefined,
          ledger: event.ledger,
          txHash: event.txHash,
        };
      } catch {
        return null;
      }
    })
    .filter((event): event is CampaignEventRecord => event !== null)
    .filter((event) => campaignId === undefined || event.campaignId === campaignId)
    .slice(-limit)
    .reverse();
}

export function explorerContractUrl(contractId = CAMPAIGN_CONTRACT_ID): string {
  return `https://stellar.expert/explorer/testnet/contract/${contractId}`;
}
