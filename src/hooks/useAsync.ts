"use client";

import { useCallback, useEffect, useState } from "react";

export type AsyncState<T> =
  | { status: "loading"; data?: T; error?: undefined }
  | { status: "ready"; data: T; error?: undefined }
  | { status: "error"; data?: T; error: unknown };

export interface UseAsyncResult<T> {
  state: AsyncState<T>;
  reload: () => void;
}

/**
 * Zincir okumaları için tek tip yükleme/hata durumu yönetimi.
 * `fn` çağıran tarafta `useCallback` ile sabitlenmelidir.
 *
 * Yeniden yükleme sırasında eski veri korunur (titremeyi önler); ilk yüklemede
 * `status === "loading"` ve `data === undefined` olur.
 */
export function useAsync<T>(fn: () => Promise<T>, pollMs?: number): UseAsyncResult<T> {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    const run = () =>
      fn()
        .then((data) => {
          if (!cancelled) setState({ status: "ready", data });
        })
        .catch((error) => {
          if (!cancelled) setState((prev) => ({ status: "error", data: prev.data, error }));
        });

    run();

    if (!pollMs) {
      return () => {
        cancelled = true;
      };
    }

    const interval = setInterval(run, pollMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fn, version, pollMs]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { state, reload };
}
