import { PutObjectCommand } from "@aws-sdk/client-s3";
import { zValidator } from "@hono/zod-validator";
import { createObjectCsvStringifier } from "csv-writer";
import type { Context } from "hono";
import { Hono } from "hono";
import type { LambdaContext, LambdaEvent } from "hono/aws-lambda";
import { handle } from "hono/aws-lambda";
import { compress } from "hono/compress";
import { getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { Resource } from "sst";
import { UAParser } from "ua-parser-js";
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

interface Variables {
  ip?: string;
  userAgent?: string;
}

const ID_FOLDER = process.env.ID_FOLDER ?? "newspassid";

function getClientIP(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
): string | undefined {
  const event = c.env.event;

  // Check X-Forwarded-For header first (for requests through ALB/CloudFront)
  const forwardedFor = c.req.header("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  // Check X-Real-IP header
  const realIP = c.req.header("x-real-ip");
  if (realIP) {
    return realIP;
  }

  // Fall back to Lambda event sourceIp - handle different context types
  const requestContext = event.requestContext;
  if ("http" in requestContext && requestContext.http.sourceIp) {
    return requestContext.http.sourceIp;
  }
  if ("identity" in requestContext && requestContext.identity.sourceIp) {
    return requestContext.identity.sourceIp;
  }

  return undefined;
}

function getClientUserAgent(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
): string | undefined {
  const event = c.env.event;
  const requestContext = event.requestContext;
  if ("http" in requestContext && requestContext.http.userAgent) {
    const ua = requestContext.http.userAgent;
    const parsedUa = UAParser(ua);
    return parsedUa.ua;
  }

  return undefined;
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()
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
  .use(compress())
  .use(logger())
  .use(async (c, next) => {
    const ip = getClientIP(c);
    c.set("ip", ip);
    const userAgent = getClientUserAgent(c);
    c.set("userAgent", userAgent);
    await next();
  })
  .post("/newspassid", zValidator("json", logRecordSchema), async (c) => {
    try {
      const data = c.req.valid("json");
      console.info("[api.handler] body", data);
      const ip = c.get("ip");
      console.info("[api.handler] ip", ip);
      const userAgent = c.get("userAgent");
      console.info("[api.handler] userAgent", userAgent);
      // get the newspassid cookie
      const newspassid = getCookie(c, "newspassid");
      console.info("[api.handler] newspassid cookie", newspassid);

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

      // set the segments in the cookie
      setCookie(c, "npid_segments", validSegments.join(","), {
        path: "/",
        secure: true,
        httpOnly: false,
        sameSite: "none",
      });

      const csvContent = createObjectCsvStringifier({
        header: [
          { id: "id", title: "id" },
          { id: "timestamp", title: "timestamp" },
          { id: "url", title: "url" },
          { id: "consentString", title: "consentString" },
          { id: "ip", title: "ip" },
          { id: "userAgent", title: "userAgent" },
          { id: "platform", title: "platform" },
          { id: "canonicalUrl", title: "canonicalUrl" },
          { id: "title", title: "title" },
          { id: "description", title: "description" },
          { id: "keywords", title: "keywords" },
        ],
      });

      const csvHeaderString = csvContent.getHeaderString();
      const csvRecords = csvContent.stringifyRecords([
        {
          id: data.id,
          timestamp: data.timestamp,
          url: data.url,
          consentString: data.consentString,
          ip,
          userAgent,
          platform: data.platform,
          canonicalUrl: data.canonicalUrl,
          title: data.title,
          description: data.description,
          keywords: data.keywords,
        },
      ]);

      const csvString = csvHeaderString ? csvHeaderString + csvRecords : null;

      if (!csvString) {
        throw new HTTPException(500, {
          message: "Failed to generate CSV string",
        });
      }

      // Upload to S3
      await s3.send(
        new PutObjectCommand({
          Bucket: Resource.data.name,
          Key: `${ID_FOLDER}/publisher/${domain}/${data.id}/${data.timestamp}.csv`,
          ContentType: "text/csv",
          Body: csvString,
        }),
      );

      // Create properties JSON file in separate directory for analytics
      const propertiesData = {
        canonicalUrl: data.canonicalUrl,
        consentString: data.consentString,
        description: data.description,
        domain,
        id: data.id,
        ip,
        keywords: data.keywords,
        platform: data.platform,
        processedAt: new Date().toISOString(),
        timestamp: data.timestamp,
        title: data.title,
        url: data.url,
        userAgent,
      };

      await s3.send(
        new PutObjectCommand({
          Bucket: Resource.data.name,
          Key: `${ID_FOLDER}/properties/${domain}/${data.id}/${data.timestamp}.json`,
          ContentType: "application/json",
          Body: JSON.stringify(propertiesData),
        }),
      );

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
