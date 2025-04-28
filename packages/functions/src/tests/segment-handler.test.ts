import { fs, vol } from "memfs";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getDefaultSegments,
  getUserSegmentsFromFile,
} from "../lib/segment-handler";

describe("Segment Handler", () => {
  beforeEach(() => {
    // reset the state of in-memory fs
    vol.reset();
  });

  describe("getUserSegmentsFromFile", () => {
    it("should return segments from file when available", async () => {
      const mockSegments = {
        user123: ["segment1", "segment2"],
      };

      const path = "/segments.json";

      fs.writeFileSync(path, JSON.stringify(mockSegments));

      const segments = await getUserSegmentsFromFile("user123", path);

      expect(segments).toEqual(mockSegments.user123);
    });

    it("should return default segments when file read fails", async () => {
      const path = "/segments.json";

      const segments = await getUserSegmentsFromFile("user123", path);
      expect(segments.length).toBeGreaterThan(0);
      expect(segments[0]).toMatch(/^seg_/);
    });

    it("should return default segments when user not found in file", async () => {
      const mockSegments = {
        otherUser: ["segment1", "segment2"],
      };

      const path = "/segments.json";

      fs.writeFileSync(path, JSON.stringify(mockSegments));

      const segments = await getUserSegmentsFromFile("user123", path);

      expect(segments.length).toBeGreaterThan(0);
      expect(segments[0]).toMatch(/^seg_/);
    });
  });

  describe("getDefaultSegments", () => {
    it("should generate random segments", () => {
      const segments = getDefaultSegments();
      expect(segments.length).toBeGreaterThan(0);
      expect(segments.length).toBeLessThanOrEqual(3);
      expect(segments[0]).toMatch(/^seg_/);
    });

    it("should generate different segments on each call", () => {
      const segments1 = getDefaultSegments();
      const segments2 = getDefaultSegments();
      expect(segments1).not.toEqual(segments2);
    });
  });
});
