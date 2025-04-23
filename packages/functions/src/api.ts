import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { zValidator } from "@hono/zod-validator";
import { parse } from "csv-parse/sync";
import { Hono } from "hono";
import type { LambdaContext, LambdaEvent } from "hono/aws-lambda";
import { handle } from "hono/aws-lambda";
import { Resource } from "sst";
import { z } from "zod";

interface Bindings {
  event: LambdaEvent;
  lambdaContext: LambdaContext;
}

const s3 = new S3Client();
const ID_FOLDER = process.env.ID_FOLDER ?? "newspassid";

const logRecordSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  url: z.string(),
  consentString: z.string(),
  previousId: z.string().optional(),
  publisherSegments: z.array(z.string()).optional(),
});

// type LogRecord = z.infer<typeof logRecordSchema>;

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
  console.info("[getValidSegments] segmentsFile", segmentsFile);
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

    console.info("[getValidSegments] records", records);

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

const app = new Hono<{ Bindings: Bindings }>();

app.post("/newspassid", zValidator("json", logRecordSchema), async (c) => {
  try {
    const data = c.req.valid("json");
    // const data = await c.req.json();

    console.info("[handler] data", data);

    // Validate ID format
    if (!validateId(data.id)) {
      return c.json(
        {
          success: false,
          error: "Invalid ID format",
        },
        400,
      );
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

    return c.json({
      success: true,
      id: data.id,
      segments: validSegments,
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return c.json(
      {
        success: false,
        error: "Internal server error",
      },
      500,
    );
  }
});

export const handler = handle(app);
