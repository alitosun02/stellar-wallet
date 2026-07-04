"use client";

import { WalletProvider, useWallet } from "@/context/WalletContext";
import { WalletDashboard } from "./WalletDashboard";
import { WalletOnboarding } from "./WalletOnboarding";

function WalletScreen() {
  const { connection } = useWallet();
  return connection ? <WalletDashboard connection={connection} /> : <WalletOnboarding />;
}

export default function WalletApp() {
  return (
    <WalletProvider>
      <WalletScreen />
    </WalletProvider>
  );
}
