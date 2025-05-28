// import AWS from "aws-sdk";
import type { ListObjectsV2CommandInput } from "@aws-sdk/client-s3";
import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import type { APIGatewayProxyResult } from "aws-lambda";
import { parse } from "csv-parse/sync";
import * as snowflake from "snowflake-sdk";
import { Resource } from "sst";

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
  consentString: string;
  segments?: string;
}

interface EnhancedRecord extends LogRecord, GppSignals, PublisherData {
  newspass_id: string;
  raw_segments: string;
  processed_at: string;
}

type SnowflakeRow = Record<number, string | Date | null>;

class SnowflakeProcessor {
  private s3: S3Client;
  private bucket: string;
  protected connection: snowflake.Connection;
  private gppSignalMap: GppSignalMap;

  constructor() {
    this.s3 = new S3Client();
    this.bucket = Resource.data.name;

    this.connection = snowflake.createConnection({
      account: Resource.SNOWFLAKE_ACCOUNT.value,
      username: Resource.SNOWFLAKE_USER.value,
      password: Resource.SNOWFLAKE_PASSWORD.value,
      warehouse: Resource.SNOWFLAKE_WAREHOUSE.value,
      database: Resource.SNOWFLAKE_DATABASE.value,
      schema: Resource.SNOWFLAKE_SCHEMA.value,
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
      this.connection.connect((err) => {
        if (err) reject(err);
        else {
          // Set session parameters for database and warehouse
          this.connection.execute({
            sqlText: `
              USE DATABASE ${Resource.SNOWFLAKE_DATABASE.value};
            `,
            complete: (err, stmt, rows) => {
              if (err) {
                console.error("Failed to set session parameters:", err);
                reject(err);
              } else {
                console.log("Session parameters set successfully");
                resolve();
              }
            },
          });
        }
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

    console.log("consentString", consentString);

    try {
      for (const [signalId, signalName] of Object.entries(this.gppSignalMap)) {
        console.log("signalId", signalId);
        console.log("signalName", signalName);
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
      console.log("[getPublisherData] userId", userId);
      const statement = this.connection.execute({
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
        complete: (err, stmt, rows) => {
          if (err) {
            console.error("Failed to execute getPublisherData statement:", err);
          } else {
            console.log("Number of rows produced: " + rows?.length);
          }
        },
      });

      const rows = statement.fetchRows({ start: 0, end: 10 });
      console.log("[getPublisherData] rows", rows);
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
      const response = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );

      if (!response.Body) {
        return [];
      }

      const content = await response.Body.transformToString();
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
      }) as LogRecord[];

      const enhancedRecords: EnhancedRecord[] = [];

      for (const record of records) {
        console.log("record", record);
        const gppSignals = this.processGppSignals(record.consentString);
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
      this.connection.execute({
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
        complete: (err, stmt, rows) => {
          if (err) {
            console.error("Failed to execute create table statement:", err);
          } else {
            console.log("create table statement executed successfully");
          }
        },
      });

      for (const record of records) {
        console.log("[writeToSnowflake] record", record);
        this.connection.execute({
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
            record.domain ?? null,
            record.publisher ?? null,
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
          complete: (err, stmt, rows) => {
            if (err) {
              console.error("Failed to execute insert statement:", err);
            } else {
              console.log("insert statement executed successfully");
            }
          },
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

      const params: ListObjectsV2CommandInput = {
        Bucket: this.bucket,
      };

      do {
        const data = await this.s3.send(new ListObjectsV2Command(params));

        for (const obj of data.Contents || []) {
          if (obj.LastModified && obj.LastModified >= cutoffTime) {
            const records = await this.processLogFile(obj.Key || "");
            console.log("[processRecentLogs] records", records);
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
