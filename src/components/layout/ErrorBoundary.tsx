"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportError } from "@/lib/analytics";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Uygulama genelinde render hatalarını yakalar, izleme uç noktasına raporlar ve
 * beyaz ekran yerine kurtarılabilir bir arayüz gösterir.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, {
      where: "ErrorBoundary",
      componentStack: info.componentStack?.slice(0, 500),
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="mx-auto mt-16 max-w-md rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 text-center">
        <h2 className="text-lg font-semibold text-rose-200">Something went wrong</h2>
        <p className="mt-2 text-sm text-slate-400">
          The error was reported automatically. You can try reloading the page.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg bg-cyan-500 px-4 py-2 font-medium text-slate-950 transition hover:bg-cyan-400"
        >
          Reload page
        </button>
      </div>
    );
  }
}
