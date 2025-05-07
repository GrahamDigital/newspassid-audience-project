/**
 * Tests for NewsPassID
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getGppConsentString } from "./gpp-api";
import { createNewsPassID } from "./newspassid";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      // Use type assertion to avoid ESLint error about deleting computed properties
      (store as Record<string, string | undefined>)[key] = undefined;
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

// Mock document
const mockMetaElement = {
  setAttribute: vi.fn(),
  remove: vi.fn(),
};

const mockBodyElement = {
  dataset: {},
  getAttribute: vi.fn(),
  setAttribute: vi.fn(),
};

const mockBody = document.createElement("body");
const mockDocument = {
  createElement: vi.fn().mockReturnValue(mockMetaElement),
  head: {
    appendChild: vi.fn(),
    querySelectorAll: vi.fn().mockReturnValue([]),
  },
  body: mockBody,
  querySelector: vi.fn().mockReturnValue(mockBodyElement),
  querySelectorAll: vi.fn().mockReturnValue([]),
  cookie: "",
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

// Mock window
const mockWindow = {
  localStorage: localStorageMock,
  location: { href: "https://example.com" },
  dispatchEvent: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  googletag: {
    pubads: vi.fn().mockReturnValue({
      setTargeting: vi.fn(),
      refresh: vi.fn(),
    }),
  },
  pbjs: {
    setTargetingForGPTAsync: vi.fn(),
  },
  newspass_segments: [] as string[],
};

// Setup global mocks
Object.defineProperty(global, "window", { value: mockWindow });
Object.defineProperty(global, "document", { value: mockDocument });
Object.defineProperty(global, "localStorage", { value: localStorageMock });

// Mock fetch
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: vi.fn().mockResolvedValue({
    id: "test-id",
    segments: ["segment1", "segment2"],
    success: true,
  }),
});

// Mock CustomEvent constructor
class MockCustomEvent<T = unknown> {
  readonly type: string;
  readonly detail: T;

  constructor(type: string, eventInitDict?: CustomEventInit<T>) {
    this.type = type;
    this.detail = eventInitDict?.detail as T;
  }
}

Object.defineProperty(global, "CustomEvent", {
  value: MockCustomEvent as unknown as typeof CustomEvent,
  writable: true,
  configurable: true,
});

// Mock the GPP API
vi.mock("./gpp-api", () => ({
  getGppConsentString: vi.fn().mockResolvedValue("mock-consent-string"),
}));

describe("NewsPassID", () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  test("should create a new ID when not provided", async () => {
    const newspassId = createNewsPassID({
      namespace: "test",
      lambdaEndpoint: "https://api.example.com/newspassid",
    });

    const id = newspassId.getID();
    expect(id).toBeNull();

    const newId = await newspassId.setID();
    expect(newId).toBeDefined();
    expect(newId).toContain("test-");
    expect(localStorageMock.setItem).toHaveBeenCalledWith("newspassid", newId);
  });

  test("should use provided ID", async () => {
    const newspassId = createNewsPassID({
      namespace: "test",
      lambdaEndpoint: "https://api.example.com/newspassid",
    });

    const customId = "test-custom123";
    const id = await newspassId.setID(customId);

    expect(id).toBe(customId);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "newspassid",
      customId,
    );
  });

  test("should generate a new ID if none is provided", async () => {
    const newspassId = createNewsPassID({
      namespace: "test",
      lambdaEndpoint: "https://api.example.com/newspassid",
    });

    const id = await newspassId.setID();
    expect(id).toBeDefined();
    expect(id).toContain("test-");
    expect(localStorageMock.setItem).toHaveBeenCalledWith("newspassid", id);
  });

  test("should generate a new ID if none is provided and generateNewId is true", async () => {
    const newspassId = createNewsPassID({
      namespace: "test",
      lambdaEndpoint: "https://api.example.com/newspassid",
    });

    const id = await newspassId.setID(undefined, undefined, true);
    expect(id).toBeDefined();
    expect(id).toContain("test-");
    expect(localStorageMock.setItem).toHaveBeenCalledWith("newspassid", id);
  });

  test("should generate a new ID if one is provided and generateNewId is true", async () => {
    const newspassId = createNewsPassID({
      namespace: "test",
      lambdaEndpoint: "https://api.example.com/newspassid",
    });

    const id = await newspassId.setID("test-id", undefined, true);
    expect(id).toBeDefined();
    expect(id).toContain("test-");
    expect(localStorageMock.setItem).toHaveBeenCalledWith("newspassid", id);
  });

  test("should return segments", async () => {
    const newspassId = createNewsPassID({
      namespace: "test",
      lambdaEndpoint: "https://api.example.com/newspassid",
    });

    await newspassId.setID("test-id");
    const segments = newspassId.getSegments();

    expect(segments).toEqual(["segment1", "segment2"]);
  });

  test("should clear ID", () => {
    const newspassId = createNewsPassID({
      namespace: "test",
      lambdaEndpoint: "https://api.example.com/newspassid",
    });

    newspassId.clearID();

    expect(localStorageMock.removeItem).toHaveBeenCalledWith("newspassid");
  });
});

describe("NewsPassID Advanced Features", () => {
  let newspassId: ReturnType<typeof createNewsPassID>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    localStorageMock.clear();

    // Create a new instance for each test
    newspassId = createNewsPassID({
      namespace: "test",
      lambdaEndpoint: "https://api.example.com/newspassid",
    });
  });

  test("should handle custom publisher segments", async () => {
    const customSegments = ["publisher-segment-1", "publisher-segment-2"];

    // Mock successful backend response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ segments: customSegments, success: true }),
    });

    const id = await newspassId.setID("test-id", customSegments);

    expect(id).toBe("test-id");
    expect(newspassId.getSegments()).toEqual(customSegments);
  });

  test("should handle empty custom segments", async () => {
    // Mock successful backend response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ segments: [], success: true }),
    });

    const id = await newspassId.setID("test-id", []);

    expect(id).toBe("test-id");
    expect(newspassId.getSegments()).toEqual([]);
  });

  test("should inject segment meta tags when enabled", async () => {
    const segments = ["segment1", "segment2"];

    // Mock successful backend response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ segments, success: true }),
    });

    await newspassId.setID("test-id", segments);

    // Verify meta tag creation and attributes
    expect(mockDocument.createElement).toHaveBeenCalledWith("meta");
    expect(mockMetaElement.setAttribute).toHaveBeenCalledWith(
      "name",
      expect.stringMatching(/^newspass_segment_/),
    );
    expect(mockMetaElement.setAttribute).toHaveBeenCalledWith(
      "content",
      expect.any(String),
    );
    expect(mockDocument.head.appendChild).toHaveBeenCalledWith(mockMetaElement);
  });

  test("should handle segment meta tag injection errors", async () => {
    mockDocument.createElement.mockImplementationOnce(() => {
      throw new Error("Failed to create element");
    });

    // Mock successful backend response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ segments: ["segment1"], success: true }),
    });

    const segments = ["segment1"];
    await newspassId.setID("test-id", segments);

    // Should not throw, just log error
    newspassId.getSegments();
  });

  test("should dispatch events for ID changes", async () => {
    // Mock successful backend response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ segments: [], success: true }),
    });

    await newspassId.setID("test-id");

    // Verify event dispatch
    expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "newspassid:change",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        detail: expect.objectContaining({
          id: "test-id",
        }),
      }),
    );
  });

  test("should handle network timeouts", async () => {
    // Mock a network timeout
    global.fetch = vi.fn().mockImplementationOnce(() => {
      return new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("timeout"));
        }, 100);
      });
    });

    const id = await newspassId.setID();
    expect(id).toBeDefined();
  });

  test("should handle network errors gracefully", async () => {
    // Mock a network error
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));

    const id = await newspassId.setID();
    expect(id).toBeDefined();
  });

  test("should handle GPP consent errors", async () => {
    // Mock GPP consent error
    vi.mocked(getGppConsentString).mockRejectedValueOnce(
      new Error("GPP Error"),
    );

    // Mock successful backend response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ segments: [], success: true }),
    });

    const id = await newspassId.setID();
    expect(id).toBeDefined();
    expect(getGppConsentString).toHaveBeenCalled();
  });
});
