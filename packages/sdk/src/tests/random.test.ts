import { describe, expect, test } from "vitest";
import { generateId } from "../utils/random";

describe("Random ID Generation", () => {
  test("should generate unique IDs with sufficient entropy", () => {
    const namespace = "test";
    const iterations = 1000;
    const generatedIds = new Set<string>();

    // Generate multiple IDs and check for uniqueness
    for (let i = 0; i < iterations; i++) {
      const id = generateId(namespace);
      expect(id).toMatch(
        /^test-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(generatedIds.has(id)).toBe(false);
      generatedIds.add(id);
    }

    // Verify we got the expected number of unique IDs
    expect(generatedIds.size).toBe(iterations);
  });
});
