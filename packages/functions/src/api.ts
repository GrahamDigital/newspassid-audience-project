import { PutObjectCommand } from "@aws-sdk/client-s3";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { LambdaContext, LambdaEvent } from "hono/aws-lambda";
import { handle } from "hono/aws-lambda";
import { setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { Resource } from "sst";
import { s3 } from "@/lib/s3";
import { logRecordSchema } from "@/lib/schema/npid";
import {
  getDomainFromUrl,
  getValidSegments,
  isValidId,
  shouldLoadSDK,
} from "@/lib/utils";

interface Bindings {
  event: LambdaEvent;
  lambdaContext: LambdaContext;
}

const ID_FOLDER = process.env.ID_FOLDER ?? "newspassid";

const app = new Hono<{ Bindings: Bindings }>()
  .use(
    cors({
      origin: [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://*.gmg.io",
        "http://www.gmg-local.com",
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

      console.info("[api.handler] domain", domain);

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

      // Create properties JSON file in separate directory for analytics
      const propertiesData = {
        id: data.id,
        timestamp: data.timestamp,
        url: data.url,
        domain,
        consentString: data.consentString,
        previousId: data.previousId,
        segments: validSegments,
        publisherSegments: data.publisherSegments,
        processedAt: new Date().toISOString(),
      };

      await s3.send(
        new PutObjectCommand({
          Bucket: Resource.data.name,
          Key: `${ID_FOLDER}/properties/${domain}/${data.id}/${data.timestamp}.json`,
          ContentType: "application/json",
          Body: JSON.stringify(propertiesData),
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
            Key: `${ID_FOLDER}/publisher/${domain}/mappings/${data.previousId}.csv`,
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

      const loadSdk = await shouldLoadSDK({
        id: data.id,
        url: data.url,
      });

      return c.json({
        success: true,
        id: data.id,
        loadSdk,
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
