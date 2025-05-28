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
import { setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { Resource } from "sst";
import { z } from "zod";
import { isValidId } from "./lib/utils";

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

const app = new Hono<{ Bindings: Bindings }>()
  .use(
    cors({
      origin: [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://*.gmg.io",
        "https://www.clickondetroit.com",
        "https://www.ksat.com",
        "https://www.click2houston.com",
        "https://www.wsls.com",
        "https://www.news4jax.com",
        "https://www.clickorlando.com",
      ],
      allowMethods: ["POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  )
  .use(logger())
  .post("/newspassid", zValidator("json", logRecordSchema), async (c) => {
    try {
      const data = c.req.valid("json");

      console.info("[api.handler] body", data);

      // Validate ID format
      if (!isValidId(data.id)) {
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

      // set cookie
      setCookie(c, "newspassid", data.id, {
        path: "/",
        secure: true,
        httpOnly: false,
        sameSite: "none",
        expires: new Date(Date.now() + 400 * 24 * 60 * 60 * 1000),
      });

      // query braze for user, set last visited date and user alias
      // check if the user is in a braze segment that will allow for the sdk to load

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
export { app };
