import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPersistentStore } from "./persistentStore";

const makeStore = (overrides: Partial<Parameters<typeof createPersistentStore<string>>[0]> = {}) =>
  createPersistentStore<string>({
    key: "test-key",
    fallback: "fallback",
    parse: (raw) => (raw.startsWith("bad") ? null : raw),
    serialize: (value) => value,
    ...overrides,
  });

describe("createPersistentStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns the fallback on the server snapshot even when storage has a value", () => {
    window.localStorage.setItem("test-key", "stored");
    const store = makeStore();
    expect(store.getServerSnapshot()).toBe("fallback");
    expect(store.getSnapshot()).toBe("stored");
  });

  it("hydrates from storage on the first client snapshot", () => {
    window.localStorage.setItem("test-key", "stored");
    expect(makeStore().getSnapshot()).toBe("stored");
  });

  it("drops and clears unparseable stored values", () => {
    window.localStorage.setItem("test-key", "bad-value");
    const store = makeStore();
    expect(store.getSnapshot()).toBe("fallback");
    expect(window.localStorage.getItem("test-key")).toBeNull();
  });

  it("uses detect() only when nothing is stored", () => {
    const detect = vi.fn(() => "detected");
    expect(makeStore({ detect }).getSnapshot()).toBe("detected");

    window.localStorage.setItem("test-key", "stored");
    const detect2 = vi.fn(() => "detected");
    expect(makeStore({ detect: detect2 }).getSnapshot()).toBe("stored");
    expect(detect2).not.toHaveBeenCalled();
  });

  it("persists writes and notifies subscribers", () => {
    const store = makeStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.set("next");

    expect(store.getSnapshot()).toBe("next");
    expect(window.localStorage.getItem("test-key")).toBe("next");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("clears back to the fallback and removes the stored key", () => {
    const store = makeStore();
    store.set("next");
    store.clear();

    expect(store.getSnapshot()).toBe("fallback");
    expect(window.localStorage.getItem("test-key")).toBeNull();
  });

  it("stops notifying after unsubscribe", () => {
    const store = makeStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();

    store.set("next");
    expect(listener).not.toHaveBeenCalled();
  });
});
