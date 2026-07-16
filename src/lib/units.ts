/** XLM ↔ stroop dönüşümleri (1 XLM = 10^7 stroop). Saf fonksiyonlar, SDK bağımsız. */

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
