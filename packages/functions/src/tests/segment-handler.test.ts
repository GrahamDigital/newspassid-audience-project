import { promises as fs } from "fs";
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";
import {
  getDefaultSegments,
  getUserSegmentsFromFile,
} from "../lib/segment-handler";

vi.mock("fs", async () => {
  // Return a partial mock of the 'fs' module
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    promises: {
      ...actual.promises,
      readFile: vi.fn(),
    },
  };
});

describe("Segment Handler", () => {
  const mockFs = vi.mocked(fs, true);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUserSegmentsFromFile", () => {
    it("should return segments from file when available", async () => {
      const mockSegments = {
        user123: ["segment1", "segment2"],
      };
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockSegments));

      const segments = await getUserSegmentsFromFile(
        "user123",
        "segments.json",
      );
      expect(segments).toEqual(["segment1", "segment2"]);
    });

    it("should return default segments when file read fails", async () => {
      mockFs.readFile.mockRejectedValueOnce(new Error("File not found"));

      const segments = await getUserSegmentsFromFile(
        "user123",
        "segments.json",
      );
      expect(segments.length).toBeGreaterThan(0);
      expect(segments[0]).toMatch(/^seg_/);
    });

    it("should return default segments when user not found in file", async () => {
      const mockSegments = {
        otherUser: ["segment1", "segment2"],
      };
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockSegments));

      const segments = await getUserSegmentsFromFile(
        "user123",
        "segments.json",
      );
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
