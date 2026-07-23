import { describe, expect, it } from "vitest";
import { normalizeFeedback } from "./route";

describe("normalizeFeedback", () => {
  it("accepts a valid submission", () => {
    const { value, error } = normalizeFeedback({
      rating: 4,
      message: "  Loved the refund guarantee  ",
      contact: " @creator ",
      locale: "en",
    });

    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      rating: 4,
      message: "Loved the refund guarantee",
      contact: "@creator",
      locale: "en",
    });
  });

  it("rejects ratings outside 1–5", () => {
    expect(normalizeFeedback({ rating: 0, message: "x" }).error).toBe("invalid_rating");
    expect(normalizeFeedback({ rating: 6, message: "x" }).error).toBe("invalid_rating");
    expect(normalizeFeedback({ message: "x" }).error).toBe("invalid_rating");
  });

  it("rejects empty messages", () => {
    expect(normalizeFeedback({ rating: 5, message: "   " }).error).toBe("empty_message");
  });

  it("truncates overly long messages", () => {
    const { value } = normalizeFeedback({ rating: 3, message: "a".repeat(5000) });
    expect(value?.message).toHaveLength(2000);
  });

  it("omits an empty contact instead of storing a blank string", () => {
    const { value } = normalizeFeedback({ rating: 3, message: "ok", contact: "   " });
    expect(value?.contact).toBeUndefined();
  });
});
