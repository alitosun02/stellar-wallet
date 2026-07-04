"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { WalletConnection } from "@/lib/wallets";

const STORAGE_KEY = "stellar-wallet-session";

interface WalletContextValue {
  connection: WalletConnection | null;
  setConnection: (connection: WalletConnection) => void;
  clearConnection: () => void;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

function readStoredConnection(): WalletConnection | null {
  const stored = window.sessionStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as WalletConnection;
    if (!parsed.kind || !parsed.publicKey) return null;
    return parsed;
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

// This provider is only ever mounted client-side (see WalletApp's ssr: false
// dynamic import), so it's safe to read sessionStorage synchronously here.
export function WalletProvider({ children }: { children: ReactNode }) {
  const [connection, setConnectionState] = useState<WalletConnection | null>(
    readStoredConnection
  );

  const setConnection = useCallback((next: WalletConnection) => {
    setConnectionState(next);
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const clearConnection = useCallback(() => {
    setConnectionState(null);
    window.sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({ connection, setConnection, clearConnection }),
    [connection, setConnection, clearConnection]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}
