export function DisclaimerBanner() {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
      <strong className="font-semibold">Yalnızca Stellar Testnet.</strong>{" "}
      Bu uygulama eğitim/demo amaçlıdır. Gerçek (mainnet) bir gizli anahtarı
      asla buraya girmeyin. Cüzdan bilgileri yalnızca bu sekmenin oturum
      belleğinde (sessionStorage) tutulur ve sekme kapatıldığında silinir.
    </div>
  );
}
