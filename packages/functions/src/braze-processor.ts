import type { SQSEvent, SQSHandler } from "aws-lambda";
import { Resource } from "sst";

interface BrazeUserAttributes {
  external_id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  custom_attributes?: Record<string, unknown>;
}

interface QueueMessage {
  userId: string;
  attributes: Omit<BrazeUserAttributes, "external_id">;
}

const BATCH_SIZE = 50; // Braze API supports up to 50 updates per request

export const handler: SQSHandler = async (event: SQSEvent) => {
  console.info(`Processing ${event.Records.length} messages`);

  // Parse all messages first
  const userAttributes: BrazeUserAttributes[] = [];
  const failedMessages: { record: SQSEvent["Records"][0]; error: Error }[] = [];

  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body) as QueueMessage;
      userAttributes.push({
        external_id: message.userId,
        ...message.attributes,
      });
    } catch (error) {
      console.error("Error parsing message:", error);
      console.error("Message body:", record.body);
      failedMessages.push({
        record,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  // Process in batches
  const batches = chunkArray(userAttributes, BATCH_SIZE);
  console.info(`Processing ${batches.length} batches of user updates`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    try {
      await updateBrazeUserProfiles(batch);
      console.info(
        `Successfully processed batch ${i + 1}/${batches.length} with ${batch.length} users`,
      );
    } catch (error) {
      console.error(`Error processing batch ${i + 1}:`, error);
      // Re-throw to cause SQS to retry the entire batch
      throw error;
    }
  }

  // If there were any failed message parsing, throw an error to retry
  if (failedMessages.length > 0) {
    console.error(`Failed to parse ${failedMessages.length} messages`);
    throw new Error(`Failed to parse ${failedMessages.length} messages`);
  }
};

async function updateBrazeUserProfiles(
  attributesBatch: BrazeUserAttributes[],
): Promise<void> {
  const brazeApiKey = Resource.BRAZE_API_KEY.value;
  const brazeEndpoint = process.env.BRAZE_REST_ENDPOINT;

  console.log(
    "[braze-processor] Updating user profiles",
    attributesBatch.map((attr) => attr.external_id).join(", "),
    "with batch size",
    attributesBatch.length,
  );
  // if (!brazeEndpoint) {
  //   throw new Error("BRAZE_REST_ENDPOINT environment variable is not set");
  // }

  // console.info(
  //   `[braze-processor] Updating ${attributesBatch.length} user profiles`,
  //   attributesBatch.map((attr) => attr.external_id).join(", "),
  // );

  // const response = await fetch(`${brazeEndpoint}/users/track`, {
  //   method: "POST",
  //   headers: {
  //     "Content-Type": "application/json",
  //     Authorization: `Bearer ${brazeApiKey}`,
  //   },
  //   body: JSON.stringify({
  //     attributes: attributesBatch,
  //   }),
  // });

  // if (!response.ok) {
  //   const errorText = await response.text();
  //   throw new Error(`Braze API error: ${response.status} - ${errorText}`);
  // }

  // const result = await response.json();
  // console.info("Braze API response:", result);
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}
