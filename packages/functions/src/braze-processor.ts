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

export const handler: SQSHandler = async (event: SQSEvent) => {
  const brazeApiKey = Resource.BRAZE_API_KEY.value;
  const brazeEndpoint = process.env.BRAZE_REST_ENDPOINT!;

  console.log(`Processing ${event.Records.length} messages`);

  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body) as QueueMessage;

      await updateBrazeUserProfile({
        external_id: message.userId,
        ...message.attributes,
      });

      console.log(`Successfully processed user: ${message.userId}`);
    } catch (error) {
      console.error("Error processing message:", error);
      console.error("Message body:", record.body);

      // In a production environment, you might want to send failed
      // messages to a dead letter queue
      throw error; // This will cause the message to be retried
    }
  }
};

async function updateBrazeUserProfile(
  attributes: BrazeUserAttributes,
): Promise<void> {
  const brazeApiKey = process.env.BRAZE_API_KEY!;
  const brazeEndpoint = process.env.BRAZE_REST_ENDPOINT!;

  const response = await fetch(`${brazeEndpoint}/users/track`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${brazeApiKey}`,
    },
    body: JSON.stringify({
      attributes: [attributes],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Braze API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log("Braze API response:", result);
}
