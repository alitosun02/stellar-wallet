"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { StellarWallet } from "@/lib/stellar";

const STORAGE_KEY = "stellar-wallet-session";

interface WalletContextValue {
  wallet: StellarWallet | null;
  setWallet: (wallet: StellarWallet) => void;
  clearWallet: () => void;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

function readStoredWallet(): StellarWallet | null {
  const stored = window.sessionStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as StellarWallet;
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

// This provider is only ever mounted client-side (see WalletApp's ssr: false
// dynamic import), so it's safe to read sessionStorage synchronously here.
export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWalletState] = useState<StellarWallet | null>(readStoredWallet);

  const setWallet = useCallback((next: StellarWallet) => {
    setWalletState(next);
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const clearWallet = useCallback(() => {
    setWalletState(null);
    window.sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({ wallet, setWallet, clearWallet }),
    [wallet, setWallet, clearWallet]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}
