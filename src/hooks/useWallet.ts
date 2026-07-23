"use client";

import { useSyncExternalStore } from "react";
import { createPersistentStore } from "@/lib/persistentStore";
import type { WalletConnection } from "@/lib/wallets";

const walletStore = createPersistentStore<WalletConnection | null>({
  key: "stellar-wallet-session",
  fallback: null,
  storage: "session",
  parse: (raw) => {
    try {
      const parsed = JSON.parse(raw) as WalletConnection;
      return parsed?.kind && parsed?.publicKey ? parsed : null;
    } catch {
      return null;
    }
  },
  serialize: (value) => JSON.stringify(value),
});

export interface UseWalletResult {
  connection: WalletConnection | null;
  setConnection: (connection: WalletConnection) => void;
  clearConnection: () => void;
}

/**
 * Cüzdan bağlantısı — sekme oturumu boyunca kalıcı, tüm sayfalarda paylaşılır.
 * Gizli anahtar yalnızca `sessionStorage`'da tutulur ve sekme kapanınca silinir.
 */
export function useWallet(): UseWalletResult {
  const connection = useSyncExternalStore(
    walletStore.subscribe,
    walletStore.getSnapshot,
    walletStore.getServerSnapshot
  );

  return {
    connection,
    setConnection: walletStore.set,
    clearConnection: walletStore.clear,
  };
}
