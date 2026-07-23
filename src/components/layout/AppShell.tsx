"use client";

import type { ReactNode } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
      <Footer />
      <FeedbackWidget />
    </>
  );
}
