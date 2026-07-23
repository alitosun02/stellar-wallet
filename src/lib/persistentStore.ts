/**
 * `useSyncExternalStore` ile kullanılmak üzere tasarlanmış, tarayıcı depolamasına
 * yazan küçük bir store fabrikası.
 *
 * Neden context + useState değil: uygulama çok sayfalı ve statik olarak
 * prerender ediliyor. Sunucu anlık görüntüsü daima `fallback` döner, istemci
 * hidrasyondan sonra depodaki gerçek değere geçer — böylece hidrasyon uyuşmazlığı
 * yaşanmadan kalıcı durum korunur.
 */
export interface PersistentStore<T> {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  set: (value: T) => void;
  clear: () => void;
}

export interface PersistentStoreOptions<T> {
  key: string;
  fallback: T;
  storage?: "local" | "session";
  /** Depodaki ham metni değere çevirir; geçersizse `null` döndürün. */
  parse: (raw: string) => T | null;
  serialize: (value: T) => string;
  /** Depoda kayıt yokken çalışır (örn. tarayıcı dilinden tahmin). */
  detect?: () => T;
}

export function createPersistentStore<T>({
  key,
  fallback,
  storage = "local",
  parse,
  serialize,
  detect,
}: PersistentStoreOptions<T>): PersistentStore<T> {
  let value: T = fallback;
  let hydrated = false;
  const listeners = new Set<() => void>();

  const area = (): Storage | null => {
    if (typeof window === "undefined") return null;
    try {
      return storage === "session" ? window.sessionStorage : window.localStorage;
    } catch {
      // Gizli sekme / depolama devre dışı — bellekte çalışmaya devam et
      return null;
    }
  };

  const hydrate = () => {
    if (hydrated || typeof window === "undefined") return;
    hydrated = true;
    const store = area();
    const raw = store?.getItem(key) ?? null;
    if (raw !== null) {
      const parsed = parse(raw);
      if (parsed !== null) {
        value = parsed;
        return;
      }
      store?.removeItem(key);
    }
    if (detect) value = detect();
  };

  const emit = () => listeners.forEach((listener) => listener());

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      hydrate();
      return value;
    },
    getServerSnapshot() {
      return fallback;
    },
    set(next) {
      hydrated = true;
      value = next;
      area()?.setItem(key, serialize(next));
      emit();
    },
    clear() {
      hydrated = true;
      value = fallback;
      area()?.removeItem(key);
      emit();
    },
  };
}
