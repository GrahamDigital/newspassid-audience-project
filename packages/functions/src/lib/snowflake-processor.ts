import type { APIGatewayProxyResult } from "aws-lambda";
import AWS from "aws-sdk";
import { parse } from "csv-parse/sync";
import * as snowflake from "snowflake-sdk";

type GppSignalMap = Record<string, string>;

interface GppSignals {
  has_gdpr_consent: boolean;
  has_ccpa_consent: boolean;
  has_us_virginia_consent: boolean;
  has_us_colorado_consent: boolean;
  has_us_connecticut_consent: boolean;
  has_us_utah_consent: boolean;
}

interface PublisherData {
  subscription_status?: string;
  registration_date?: Date;
  last_login_date?: Date;
  user_segment?: string;
}

interface LogRecord {
  id: string;
  timestamp: string;
  url: string;
  domain: string;
  publisher: string;
  consent_string: string;
  segments?: string;
}

interface EnhancedRecord extends LogRecord, GppSignals, PublisherData {
  newspass_id: string;
  raw_segments: string;
  processed_at: string;
}

type SnowflakeRow = Record<number, string | Date | null>;

class SnowflakeProcessor {
  private s3: AWS.S3;
  private bucket: string;
  protected connection: snowflake.Connection;
  private gppSignalMap: GppSignalMap;

  constructor() {
    this.s3 = new AWS.S3();
    this.bucket = process.env.STORAGE_BUCKET || "";

    this.connection = snowflake.createConnection({
      account: process.env.SNOWFLAKE_ACCOUNT || "",
      username: process.env.SNOWFLAKE_USER || "",
      password: process.env.SNOWFLAKE_PASSWORD || "",
      warehouse: process.env.SNOWFLAKE_WAREHOUSE || "",
      database: process.env.SNOWFLAKE_DATABASE || "",
      schema: process.env.SNOWFLAKE_SCHEMA || "",
    });

    this.gppSignalMap = {
      "1": "GDPR",
      "2": "CCPA",
      "3": "US_VIRGINIA",
      "4": "US_COLORADO",
      "5": "US_CONNECTICUT",
      "6": "US_UTAH",
    };
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.connection.connect((err: snowflake.SnowflakeError | undefined) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private processGppSignals(consentString: string): GppSignals {
    const signals: GppSignals = {
      has_gdpr_consent: false,
      has_ccpa_consent: false,
      has_us_virginia_consent: false,
      has_us_colorado_consent: false,
      has_us_connecticut_consent: false,
      has_us_utah_consent: false,
    };

    try {
      for (const [signalId, signalName] of Object.entries(this.gppSignalMap)) {
        const key =
          `has_${signalName.toLowerCase()}_consent` as keyof GppSignals;
        signals[key] = consentString.includes(signalId);
      }
    } catch (error) {
      console.error("Error processing GPP signals:", error);
    }
    return signals;
  }

  private async getPublisherData(userId: string): Promise<PublisherData> {
    try {
      const statement = await this.connection.execute({
        sqlText: `
                    SELECT 
                        user_id,
                        subscription_status,
                        registration_date,
                        last_login_date,
                        user_segment
                    FROM publisher.user_data
                    WHERE user_id = ?
                `,
        binds: [userId],
      });

      const rows = await statement.fetchRows();
      if (rows) {
        const result = await new Promise<SnowflakeRow[]>((resolve) => {
          const data: SnowflakeRow[] = [];
          rows.on("data", (row) => data.push(row));
          rows.on("end", () => {
            resolve(data);
          });
        });

        if (result.length > 0) {
          const row = result[0];
          return {
            subscription_status: row[1] as string,
            registration_date: row[2] as Date,
            last_login_date: row[3] as Date,
            user_segment: row[4] as string,
          };
        }
      }
    } catch (error) {
      console.error("Error fetching publisher data:", error);
    }
    return {};
  }

  private async processLogFile(key: string): Promise<EnhancedRecord[]> {
    try {
      const response = await this.s3
        .getObject({
          Bucket: this.bucket,
          Key: key,
        })
        .promise();

      const content = response.Body?.toString("utf-8") || "";
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
      }) as LogRecord[];

      const enhancedRecords: EnhancedRecord[] = [];

      for (const record of records) {
        const gppSignals = this.processGppSignals(record.consent_string);
        const publisherData = await this.getPublisherData(record.id);

        const enhancedRecord: EnhancedRecord = {
          ...record,
          ...gppSignals,
          ...publisherData,
          newspass_id: record.id,
          raw_segments: JSON.stringify(
            record.segments ? record.segments.split(",") : [],
          ),
          processed_at: new Date().toISOString(),
        };

        enhancedRecords.push(enhancedRecord);
      }

      return enhancedRecords;
    } catch (error) {
      console.error(`Error processing log file ${key}:`, error);
      return [];
    }
  }

  private async writeToSnowflake(records: EnhancedRecord[]): Promise<void> {
    try {
      await this.connection.execute({
        sqlText: `
                    CREATE TABLE IF NOT EXISTS enhanced_user_data (
                        newspass_id STRING,
                        timestamp TIMESTAMP_NTZ,
                        url STRING,
                        domain STRING,
                        publisher STRING,
                        has_gdpr_consent BOOLEAN,
                        has_ccpa_consent BOOLEAN,
                        has_us_virginia_consent BOOLEAN,
                        has_us_colorado_consent BOOLEAN,
                        has_us_connecticut_consent BOOLEAN,
                        has_us_utah_consent BOOLEAN,
                        subscription_status STRING,
                        registration_date DATE,
                        last_login_date TIMESTAMP_NTZ,
                        user_segment STRING,
                        raw_segments VARIANT,
                        processed_at TIMESTAMP_NTZ
                    )
                `,
      });

      for (const record of records) {
        await this.connection.execute({
          sqlText: `
                        INSERT INTO enhanced_user_data (
                            newspass_id, timestamp, url, domain, publisher,
                            has_gdpr_consent, has_ccpa_consent, has_us_virginia_consent,
                            has_us_colorado_consent, has_us_connecticut_consent, has_us_utah_consent,
                            subscription_status, registration_date, last_login_date,
                            user_segment, raw_segments, processed_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, PARSE_JSON(?), ?)
                    `,
          binds: [
            record.newspass_id,
            record.timestamp,
            record.url,
            record.domain,
            record.publisher,
            record.has_gdpr_consent,
            record.has_ccpa_consent,
            record.has_us_virginia_consent,
            record.has_us_colorado_consent,
            record.has_us_connecticut_consent,
            record.has_us_utah_consent,
            record.subscription_status || null,
            record.registration_date || null,
            record.last_login_date || null,
            record.user_segment || null,
            record.raw_segments,
            record.processed_at,
          ] as snowflake.Bind[],
        });
      }
    } catch (error) {
      console.error("Error writing to Snowflake:", error);
      throw error;
    }
  }

  async processRecentLogs(hours = 24): Promise<void> {
    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - hours);

      const params: AWS.S3.ListObjectsV2Request = {
        Bucket: this.bucket,
      };

      do {
        const data = await this.s3.listObjectsV2(params).promise();

        for (const obj of data.Contents || []) {
          if (obj.LastModified && obj.LastModified >= cutoffTime) {
            const records = await this.processLogFile(obj.Key || "");
            if (records.length > 0) {
              await this.writeToSnowflake(records);
            }
          }
        }

        params.ContinuationToken = data.NextContinuationToken;
      } while (params.ContinuationToken);
    } catch (error) {
      console.error("Error processing recent logs:", error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    return new Promise((resolve) => {
      this.connection.destroy(() => {
        resolve();
      });
    });
  }
}

export const handler = async (): Promise<APIGatewayProxyResult> => {
  const processor = new SnowflakeProcessor();
  await processor.connect();
  try {
    await processor.processRecentLogs();
    return {
      statusCode: 200,
      body: "Processing completed successfully",
    };
  } catch (error) {
    console.error("Error in handler:", error);
    return {
      statusCode: 500,
      body: "Error processing logs",
    };
  } finally {
    await processor.destroy();
  }
};
