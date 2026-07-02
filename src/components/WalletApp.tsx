"use client";

import { WalletProvider, useWallet } from "@/context/WalletContext";
import { WalletDashboard } from "./WalletDashboard";
import { WalletOnboarding } from "./WalletOnboarding";

function WalletScreen() {
  const { wallet } = useWallet();
  return wallet ? (
    <WalletDashboard publicKey={wallet.publicKey} secretKey={wallet.secretKey} />
  ) : (
    <WalletOnboarding />
  );
}

export default function WalletApp() {
  return (
    <WalletProvider>
      <WalletScreen />
    </WalletProvider>
  );
}
