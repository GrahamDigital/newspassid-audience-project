import { PutObjectCommand } from "@aws-sdk/client-s3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "../lib/braze-mau-tracker";

// Create a mock S3 client using vi.hoisted to ensure it's defined before the mock factory runs
const mockS3Client = vi.hoisted(() => ({
  send: vi.fn(),
}));

// Mock the S3Client constructor
vi.mock("@aws-sdk/client-s3", () => {
  return {
    S3Client: vi.fn(() => mockS3Client),
    PutObjectCommand: vi.fn(),
  };
});

// Mock the Resource from SST
vi.mock("sst", () => {
  return {
    Resource: {
      data: {
        name: "test-bucket",
      },
    },
  };
});

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as typeof fetch;

interface TestResponseBody {
  success: boolean;
  message?: string;
  error?: string;
  projection?: {
    currentMau: number;
    projectedEndOfMonthMau: number;
    isOnPace: boolean;
    pacingPercentage: number;
    lastUpdated: string;
  };
}

describe("Braze MAU Tracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BRAZE_API_KEY = "test-api-key";
    process.env.BRAZE_ENDPOINT = "https://rest.iad-05.braze.com";
  });

  it("should successfully process MAU data and store projection", async () => {
    // Mock successful Braze API response
    const mockMauData = {
      data: [
        { time: "2025-01-01", mau: 1000000 },
        { time: "2025-01-02", mau: 1010000 },
        { time: "2025-01-03", mau: 1020000 },
        { time: "2025-01-04", mau: 1030000 },
        { time: "2025-01-05", mau: 1040000 },
      ],
      message: "success",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockMauData),
    } as Response);

    // Mock S3 put operation
    mockS3Client.send.mockResolvedValueOnce({});

    const response = await handler();

    expect(response.statusCode).toBe(200);
    const responseBody = JSON.parse(response.body) as TestResponseBody;
    expect(responseBody.success).toBe(true);
    expect(responseBody.message).toBe("MAU pacing data updated successfully");
    expect(responseBody.projection).toHaveProperty("currentMau");
    expect(responseBody.projection).toHaveProperty("projectedEndOfMonthMau");
    expect(responseBody.projection).toHaveProperty("isOnPace");
    expect(responseBody.projection).toHaveProperty("pacingPercentage");

    // Verify fetch was called with correct parameters
    expect(mockFetch).toHaveBeenCalledWith(
      "https://rest.iad-05.braze.com/kpi/mau/data_series?length=30",
      {
        method: "GET",
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        },
      },
    );

    // Verify S3 put was called
    expect(mockS3Client.send).toHaveBeenCalledWith(
      expect.any(PutObjectCommand),
    );
    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: "test-bucket",
      Key: "pacing/braze-mau-projection.json",
      ContentType: "application/json",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      Body: expect.stringContaining('"currentMau"'),
    });
  });

  it("should handle Braze API errors gracefully", async () => {
    // Mock failed Braze API response
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    } as Response);

    const response = await handler();

    expect(response.statusCode).toBe(500);
    const responseBody = JSON.parse(response.body) as TestResponseBody;
    expect(responseBody.success).toBe(false);
    expect(responseBody.error).toBe("Failed to process MAU pacing data");
    expect(responseBody.message).toContain("Braze API request failed");
  });

  it("should handle Braze API returning error message", async () => {
    // Mock Braze API response with error message
    const mockErrorResponse = {
      data: [],
      message: "error",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockErrorResponse),
    } as Response);

    const response = await handler();

    expect(response.statusCode).toBe(500);
    const responseBody = JSON.parse(response.body) as TestResponseBody;
    expect(responseBody.success).toBe(false);
    expect(responseBody.message).toContain("Braze API returned error");
  });

  it("should handle empty MAU data", async () => {
    // Mock Braze API response with empty data
    const mockEmptyResponse = {
      data: [],
      message: "success",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockEmptyResponse),
    } as Response);

    const response = await handler();

    expect(response.statusCode).toBe(500);
    const responseBody = JSON.parse(response.body) as TestResponseBody;
    expect(responseBody.success).toBe(false);
    expect(responseBody.message).toContain("No MAU data available");
  });

  it("should handle S3 upload errors", async () => {
    // Mock successful Braze API response
    const mockMauData = {
      data: [
        { time: "2025-01-01", mau: 1000000 },
        { time: "2025-01-02", mau: 1010000 },
      ],
      message: "success",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockMauData),
    } as Response);

    // Mock S3 error
    mockS3Client.send.mockRejectedValueOnce(new Error("S3 upload failed"));

    const response = await handler();

    expect(response.statusCode).toBe(500);
    const responseBody = JSON.parse(response.body) as TestResponseBody;
    expect(responseBody.success).toBe(false);
    expect(responseBody.error).toBe("Failed to process MAU pacing data");
  });

  it("should calculate correct pacing projections", async () => {
    // Mock MAU data that shows growth pattern
    const mockMauData = {
      data: [
        { time: "2025-01-01", mau: 5000000 },
        { time: "2025-01-02", mau: 5010000 },
        { time: "2025-01-03", mau: 5020000 },
        { time: "2025-01-04", mau: 5030000 },
        { time: "2025-01-05", mau: 5040000 }, // 10k daily growth
      ],
      message: "success",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockMauData),
    } as Response);

    mockS3Client.send.mockResolvedValueOnce({});

    const response = await handler();

    expect(response.statusCode).toBe(200);
    const responseBody = JSON.parse(response.body) as TestResponseBody;

    // Verify the calculation is working
    expect(responseBody.projection?.currentMau).toBe(5040000);
    expect(responseBody.projection?.projectedEndOfMonthMau).toBeGreaterThan(
      5040000,
    );
    expect(responseBody.projection?.pacingPercentage).toBeGreaterThan(80);
  });

  it("should handle missing environment variables", async () => {
    // Clear environment variables
    delete process.env.BRAZE_API_KEY;
    delete process.env.BRAZE_ENDPOINT;

    const response = await handler();

    expect(response.statusCode).toBe(500);
    const responseBody = JSON.parse(response.body) as TestResponseBody;
    expect(responseBody.success).toBe(false);
  });
});
