import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { testClient } from "hono/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../api";

// Create a mock S3 client using vi.hoisted to ensure it's defined before the mock factory runs
const mockS3Client = vi.hoisted(() => ({
  send: vi.fn(),
}));

// Mock the S3Client constructor
vi.mock("@aws-sdk/client-s3", () => {
  return {
    S3Client: vi.fn(() => mockS3Client),
    GetObjectCommand: vi.fn(),
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

// Define the type for the client based on your app's routes
// type AppType = typeof app;
// type ClientType = ReturnType<typeof testClient<AppType>>;

describe("NewsPassID API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ID_FOLDER = "newspassid";
  });

  it("should process valid request and return success", async () => {
    // Mock S3 responses
    mockS3Client.send.mockImplementation((command: unknown) => {
      if (command instanceof GetObjectCommand) {
        return Promise.resolve({
          Body: {
            transformToString: () =>
              Promise.resolve(
                "segments,expire_timestamp\nsegment1,9999999999999",
              ),
          },
        });
      } else if (command instanceof PutObjectCommand) {
        return Promise.resolve({});
      }
      return Promise.reject(new Error("Unknown command"));
    });

    const client = testClient(app);

    const response = await client.newspassid.$post({
      json: {
        id: "gmg-12345678-1234-4123-8123-123456789012",
        timestamp: 1234567890,
        url: "https://example.com",
        consentString: "consent123",
        previousId: "gmg-87654321-4321-1234-1234-210987654321",
        publisherSegments: ["seg1", "seg2"],
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({
      success: true,
      id: "gmg-12345678-1234-4123-8123-123456789012",
      segments: ["segment1"],
    });

    // Verify S3 calls
    expect(mockS3Client.send).toHaveBeenCalledTimes(3); // 1 get + 2 puts
    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: "test-bucket",
        Key: "newspassid/publisher/example.com/gmg-12345678-1234-4123-8123-123456789012/1234567890.csv",
        ContentType: "text/csv",
      }),
    );
  });

  it("should handle missing required fields", async () => {
    const client = testClient(app);

    const response = await client.newspassid.$post({
      // @ts-expect-error - we're omitting the required properties on purpose
      json: {
        id: "gmg-12345678-1234-4123-8123-123456789012",
        timestamp: 1234567890,
        // Missing url and consentString
      },
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toEqual({
      success: false,
      error: expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: "invalid_type",
            path: ["url"],
          }),
          expect.objectContaining({
            code: "invalid_type",
            path: ["consentString"],
          }),
        ]),
      }),
    });
  });

  it("should handle invalid ID format", async () => {
    const client = testClient(app);

    const response = await client.newspassid.$post({
      json: {
        id: "invalid-id-without-gmg-prefix",
        timestamp: 1234567890,
        url: "https://example.com",
        consentString: "consent123",
      },
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toEqual({
      success: false,
      error: "Invalid ID format",
    });
  });

  it("should handle S3 errors gracefully", async () => {
    // Mock S3 error
    mockS3Client.send.mockImplementation((command: unknown) => {
      if (command instanceof GetObjectCommand) {
        return Promise.reject(new Error("S3 Error"));
      }
      return Promise.resolve({});
    });

    const client = testClient(app);

    const response = await client.newspassid.$post({
      json: {
        id: "gmg-12345678-1234-4123-8123-123456789012",
        timestamp: 1234567890,
        url: "https://example.com",
        consentString: "consent123",
      },
    });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toEqual({
      success: false,
      error: "Internal server error",
    });
  });
});
