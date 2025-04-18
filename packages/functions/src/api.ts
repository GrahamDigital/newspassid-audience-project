import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Resource } from "sst";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { parse } from "csv-parse/sync";
import { getCorsHeaders } from "./utils";

const s3 = new S3Client();
const ID_FOLDER = process.env.ID_FOLDER ?? "newspassid";

interface LogRecord {
  id: string;
  timestamp: number;
  url: string;
  consentString: string;
  previousId?: string;
  publisherSegments?: string[];
}

interface SegmentRecord {
  segments: string;
  expire_timestamp: number;
}

/**
 * Extracts and normalizes the domain from a URL.
 * Removes 'www.' prefix and handles invalid URLs gracefully.
 */
function getDomainFromUrl(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return domain.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

/**
 * Reads and filters segments from a CSV file based on expiration timestamps.
 */
async function getValidSegments(segmentsFile: string): Promise<string[]> {
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
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
    }) as SegmentRecord[];

    const now = Date.now();
    return records
      .filter((record) => record.expire_timestamp > now)
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

function validateId(id: string): boolean {
  return /^gmg-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
}

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      // headers: getCorsHeaders(event),
      body: "",
    };
  }

  try {
    if (!event.body) {
      throw new Error("Missing request body");
    }

    const data = JSON.parse(event.body) as LogRecord;

    // Validate required fields
    if (!data.id || !data.timestamp || !data.url || !data.consentString) {
      return {
        statusCode: 400,
        // headers: getCorsHeaders(event),
        body: JSON.stringify({
          success: false,
          error:
            "Missing required fields. All requests must include id, timestamp, url, and consentString.",
        }),
      };
    }

    // Validate ID format
    if (!validateId(data.id)) {
      return {
        statusCode: 400,
        // headers: getCorsHeaders(event),
        body: JSON.stringify({
          success: false,
          error: "Invalid ID format",
        }),
      };
    }

    // Get domain from URL
    const domain = getDomainFromUrl(data.url);

    // Get valid segments
    const segmentsFile = `${ID_FOLDER}/segments.csv`;
    const validSegments = await getValidSegments(segmentsFile);

    // Prepare CSV content
    const csvContent = [
      "id,timestamp,url,consentString,previousId,segments,publisherSegments",
      `"${data.id}","${data.timestamp}","${data.url}","${
        data.consentString
      }","${data.previousId ?? ""}","${validSegments.join(",")}","${
        data.publisherSegments?.join("|") ?? ""
      }"`,
    ].join("\n");

    // Upload to S3
    await s3.send(
      new PutObjectCommand({
        Bucket: Resource.data.name,
        Key: `${ID_FOLDER}/publisher/${domain}/${data.id}/${data.timestamp}.csv`,
        ContentType: "text/csv",
        Body: csvContent,
      }),
    );

    // If there's a previous ID, create a mapping
    if (data.previousId) {
      const mappingContent = [
        "oldId,newId,timestamp",
        `"${data.previousId}","${data.id}",${data.timestamp}`,
      ].join("\n");

      await s3.send(
        new PutObjectCommand({
          Bucket: Resource.data.name,
          Key: `${ID_FOLDER}/publisher/mappings/${data.previousId}.csv`,
          ContentType: "text/csv",
          Body: mappingContent,
        }),
      );
    }

    return {
      statusCode: 200,
      // headers: getCorsHeaders(event),
      body: JSON.stringify({
        success: true,
        id: data.id,
        segments: validSegments,
      }),
    };
  } catch (error) {
    console.error("Error processing request:", error);
    return {
      statusCode: 500,
      // headers: getCorsHeaders(event),
      body: JSON.stringify({
        success: false,
        error: "Internal server error",
      }),
    };
  }
};
