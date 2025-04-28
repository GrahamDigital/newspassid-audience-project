import { describe, expect, it } from "vitest";
import { getNamespaceFromId, isValidId } from "../lib/utils";

describe("Utils", () => {
  describe("isValidId", () => {
    it("should return true for a valid ID", () => {
      expect(isValidId("gmg-8fadad64-1c2f-47fe-a204-4f45e1dad748")).toBe(true);
      expect(isValidId("scripts-e5cca036-88c8-4f14-8958-9d02f7e9a53c")).toBe(
        true,
      );
    });

    it("should return false for an invalid ID", () => {
      expect(isValidId("invalid-id")).toBe(false);
      expect(isValidId("")).toBe(false);
      expect(isValidId("publisher")).toBe(false);
      expect(isValidId("-123")).toBe(false);
      expect(isValidId("publisher-")).toBe(false);
    });
  });

  describe("getNamespaceFromId", () => {
    it("should extract namespace from valid ID", () => {
      expect(
        getNamespaceFromId("gmg-8fadad64-1c2f-47fe-a204-4f45e1dad748"),
      ).toBe("gmg");
      expect(
        getNamespaceFromId("scripts-e5cca036-88c8-4f14-8958-9d02f7e9a53c"),
      ).toBe("scripts");
    });

    it("should handle malformed IDs", () => {
      expect(getNamespaceFromId("publisher")).toBe("publisher");
    });
  });
});
