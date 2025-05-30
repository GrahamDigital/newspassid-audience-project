import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { parse } from "csv-parse/sync";
import { Resource } from "sst";
import { z } from "zod";
import { s3 } from "@/lib/s3";
import { ConfigSchema, SegmentRecordSchema } from "@/lib/schema/npid";

/**
 * Get CORS headers for the response
 */
export function getCorsHeaders(
  event: APIGatewayProxyEvent,
): Record<string, string> {
  const origin = event.headers.origin ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}

/**
 * Create an error response
 */
export function errorResponse(statusCode: number, message: string) {
  return {
    statusCode,
    headers: getCorsHeaders({} as APIGatewayProxyEvent),
    body: JSON.stringify({
      success: false,
      error: message,
    }),
  };
}

/**
 * Validate ID format: <publisher>-<uuid>
 */
const publisherUuidRegex =
  /^[a-zA-Z0-9]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const publisherUuidSchema = z.string().regex(publisherUuidRegex);

/**
 * Validate ID format
 */
export function isValidId(id: string): boolean {
  return publisherUuidSchema.safeParse(id).success;
}

/**
 * Get namespace from ID
 */
export function getNamespaceFromId(id: string): string {
  return id.split("-")[0];
}

/**
 * Reads and filters segments from a CSV file based on expiration timestamps.
 */
export async function getValidSegments(
  segmentsFile: string,
): Promise<string[]> {
  try {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: Resource.data.name,
        Key: segmentsFile,
      }),
    );

    if (!response.Body) {
      return [];
    }

    const content = await response.Body.transformToString();
    const rawRecords = parse(content, {
      columns: true,
      skip_empty_lines: true,
    }) as unknown;

    // validate the csv parsing with zod
    const parsedRecords = SegmentRecordSchema.safeParse(rawRecords);

    if (!parsedRecords.success) {
      console.error("Error parsing segments:", parsedRecords.error);
      throw new Error("Error parsing segments");
    }

    const records = parsedRecords.data;

    const now = Date.now();
    return records
      .filter((record) => Number(record.expire_timestamp) > now)
      .map((record) => record.segments);
  } catch (error) {
    // If the file doesn't exist yet, return an empty array instead of throwing an error
    if (
      error instanceof Error &&
      "Code" in error &&
      error.Code === "NoSuchKey"
    ) {
      console.info(
        `Segments file ${segmentsFile} does not exist yet. Returning empty array.`,
      );
      return [];
    }

    console.error("Error reading segments:", error);
    throw error; // Re-throw other errors to be handled by the handler
  }
}

/**
 * Extracts and normalizes the domain from a URL.
 * Removes 'www.' prefix and handles invalid URLs gracefully.
 */
export function getDomainFromUrl(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return domain.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

/**
 * Get config
 */
async function getConfig() {
  const response = await s3.send(
    new GetObjectCommand({
      Bucket: Resource.data.name,
      Key: "config.json",
    }),
  );

  if (!response.Body) {
    return undefined;
  }

  const content = await response.Body.transformToString();
  const data = await JSON.parse(content);

  const parsedData = ConfigSchema.safeParse(data);

  if (!parsedData.success) {
    console.error("Error parsing config:", parsedData.error);
    throw new Error("Error parsing config");
  }

  return parsedData.data;
}

/**
 * Get pageviews
 */
async function getPageviews({
  id,
  domain,
  days = 30,
}: {
  id: string;
  domain: string;
  days?: number;
}): Promise<number> {
  const ID_FOLDER = process.env.ID_FOLDER;

  if (!ID_FOLDER) {
    throw new Error("ID_FOLDER is not set");
  }

  try {
    // Calculate the cutoff timestamp for 30 days ago
    const cutoffTimestamp = Date.now() - days * 24 * 60 * 60 * 1000;

    // Use S3 prefix to efficiently filter to the user's directory
    const prefix = `${ID_FOLDER}/publisher/${domain}/${id}/`;

    let pageviewCount = 0;
    let continuationToken: string | undefined;

    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: Resource.data.name,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      const response = await s3.send(listCommand);

      console.info("[api.handler] items found", response.Contents?.length);

      if (response.Contents) {
        for (const object of response.Contents) {
          // Extract timestamp from filename (format: <timestamp>.csv)
          const filename = object.Key?.split("/").pop();
          if (filename?.endsWith(".csv")) {
            const timestampStr = filename.replace(".csv", "");
            const timestamp = parseInt(timestampStr, 10);

            // Only count pageviews from the last 30 days
            if (!isNaN(timestamp) && timestamp >= cutoffTimestamp) {
              pageviewCount++;
            }
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return pageviewCount;
  } catch (error) {
    // If the user directory doesn't exist yet, return 0 instead of throwing an error
    if (
      error instanceof Error &&
      "Code" in error &&
      error.Code === "NoSuchKey"
    ) {
      console.info(
        `User directory ${ID_FOLDER}/publisher/${domain}/${id}/ does not exist yet. Returning 0 pageviews.`,
      );
      return 0;
    }

    console.error("Error counting pageviews:", error);
    throw error;
  }
}

export async function shouldLoadSDK({
  id,
  url,
}: {
  id: string;
  url: string;
}): Promise<boolean> {
  const config = await getConfig();

  if (!config) {
    return false;
  }

  const domain = getDomainFromUrl(url);

  const pageviews = await getPageviews({ id, domain });

  // if the domain is in the always load SDK allow list, return true
  if (config.alwaysLoadSDKAllowList.includes(url)) {
    return true;
  }

  // if the pageviews are less than the pageview threshold, return false
  return pageviews >= config.pageViewThreshold;
}
