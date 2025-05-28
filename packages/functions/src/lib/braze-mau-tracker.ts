import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { APIGatewayProxyResult } from "aws-lambda";
import { Resource } from "sst";

interface BrazeMauDataPoint {
  time: string; // YYYY-MM-DD format
  mau: number;
}

interface BrazeMauResponse {
  data: BrazeMauDataPoint[];
  message: string;
}

interface PacingProjection {
  currentMau: number;
  currentDate: string;
  monthlyLimit: number;
  daysInMonth: number;
  daysElapsed: number;
  daysRemaining: number;
  projectedEndOfMonthMau: number;
  projectedOverage: number;
  pacingPercentage: number;
  isOnPace: boolean;
  dailyAverageGrowth: number;
  lastUpdated: string;
  rawData: BrazeMauDataPoint[];
}

class BrazeMauTracker {
  private s3: S3Client;
  private bucket: string;
  private brazeApiKey: string;
  private brazeEndpoint: string;
  private monthlyLimit: number;

  constructor() {
    this.s3 = new S3Client();
    this.bucket = Resource.data.name;
    // These will be defined in the infrastructure
    // this.brazeApiKey = process.env.BRAZE_API_KEY ?? "";
    this.brazeApiKey = Resource.BRAZE_API_KEY.value;
    this.brazeEndpoint = process.env.BRAZE_ENDPOINT ?? "";
    this.monthlyLimit = 6000000; // 6 million MAU limit
  }

  /**
   * Fetch MAU data from Braze API
   */
  private async fetchMauData(days = 30): Promise<BrazeMauResponse> {
    const url = `${this.brazeEndpoint}/kpi/mau/data_series?length=${days}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.brazeApiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Braze API request failed: ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as BrazeMauResponse;
  }

  /**
   * Calculate pacing projection based on MAU data
   */
  private calculatePacing(mauData: BrazeMauDataPoint[]): PacingProjection {
    if (mauData.length === 0) {
      throw new Error("No MAU data available for calculation");
    }

    // Sort data by date to ensure chronological order
    const sortedData = mauData.sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
    );

    const latestData = sortedData[sortedData.length - 1];
    const currentDate = new Date(latestData.time);
    const currentMau = latestData.mau;

    // Calculate days in current month
    const lastDayOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
    );
    const daysInMonth = lastDayOfMonth.getDate();

    // Calculate elapsed and remaining days
    const daysElapsed = currentDate.getDate();
    const daysRemaining = daysInMonth - daysElapsed;

    // Calculate daily growth rate from available data
    const currentMonthData = sortedData.filter((point) => {
      const pointDate = new Date(point.time);
      return (
        pointDate.getMonth() === currentDate.getMonth() &&
        pointDate.getFullYear() === currentDate.getFullYear()
      );
    });

    let dailyAverageGrowth = 0;
    if (currentMonthData.length > 1) {
      const growthRates = [];
      for (let i = 1; i < currentMonthData.length; i++) {
        const growth = currentMonthData[i].mau - currentMonthData[i - 1].mau;
        growthRates.push(growth);
      }
      dailyAverageGrowth =
        growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;
    }

    // Project end of month MAU
    const projectedEndOfMonthMau =
      currentMau + dailyAverageGrowth * daysRemaining;

    // Calculate overage
    const projectedOverage = Math.max(
      0,
      projectedEndOfMonthMau - this.monthlyLimit,
    );

    // Calculate pacing percentage (how much of the limit we're using)
    const pacingPercentage = (projectedEndOfMonthMau / this.monthlyLimit) * 100;

    // Determine if we're on pace (under the limit)
    const isOnPace = projectedEndOfMonthMau <= this.monthlyLimit;

    return {
      currentMau,
      currentDate: latestData.time,
      monthlyLimit: this.monthlyLimit,
      daysInMonth,
      daysElapsed,
      daysRemaining,
      projectedEndOfMonthMau: Math.round(projectedEndOfMonthMau),
      projectedOverage: Math.round(projectedOverage),
      pacingPercentage: Math.round(pacingPercentage * 100) / 100,
      isOnPace,
      dailyAverageGrowth: Math.round(dailyAverageGrowth),
      lastUpdated: new Date().toISOString(),
      rawData: sortedData,
    };
  }

  /**
   * Store pacing data to S3
   */
  private async storePacingData(projection: PacingProjection): Promise<void> {
    const key = "pacing/braze-mau-projection.json";

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: "application/json",
        Body: JSON.stringify(projection, null, 2),
      }),
    );

    console.info(`Pacing data stored to S3: ${key}`);
  }

  /**
   * Main processing function
   */
  async processMauPacing(): Promise<PacingProjection> {
    try {
      console.info("Fetching MAU data from Braze...");
      const mauResponse = await this.fetchMauData(30);

      if (mauResponse.message !== "success") {
        throw new Error(`Braze API returned error: ${mauResponse.message}`);
      }

      console.info(`Received ${mauResponse.data.length} MAU data points`);

      const projection = this.calculatePacing(mauResponse.data);

      console.info("Pacing calculation completed:", {
        currentMau: projection.currentMau,
        projectedEndOfMonthMau: projection.projectedEndOfMonthMau,
        isOnPace: projection.isOnPace,
        pacingPercentage: projection.pacingPercentage,
      });

      await this.storePacingData(projection);

      return projection;
    } catch (error) {
      console.error("Error processing MAU pacing:", error);
      throw error;
    }
  }
}

export const handler = async (): Promise<APIGatewayProxyResult> => {
  const tracker = new BrazeMauTracker();

  try {
    const projection = await tracker.processMauPacing();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        message: "MAU pacing data updated successfully",
        projection: {
          currentMau: projection.currentMau,
          projectedEndOfMonthMau: projection.projectedEndOfMonthMau,
          isOnPace: projection.isOnPace,
          pacingPercentage: projection.pacingPercentage,
          lastUpdated: projection.lastUpdated,
        },
      }),
    };
  } catch (error) {
    console.error("Error in MAU tracker handler:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: false,
        error: "Failed to process MAU pacing data",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
