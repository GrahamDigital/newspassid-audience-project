import { createHash } from "crypto";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import type { APIGatewayProxyHandler } from "aws-lambda";
import { Resource } from "sst";

const sqsClient = new SQSClient({});

interface SendMessageRequest {
  userId: string;
  attributes: {
    email?: string;
    first_name?: string;
    last_name?: string;
    custom_attributes?: Record<string, unknown>;
  };
}

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // const queueUrl = process.env.QUEUE_URL!;
    const queueUrl = Resource["braze-queue"].url;
    const body = JSON.parse(event.body ?? "{}") as SendMessageRequest;

    if (!body.userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "userId is required" }),
      };
    }

    const command = new SendMessageCommand({
      MessageGroupId: "newspassid",
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({
        userId: body.userId,
        attributes: body.attributes,
      }),
      MessageAttributes: {
        userId: {
          DataType: "String",
          StringValue: body.userId,
        },
      },
      MessageDeduplicationId: createHash("sha256")
        .update(`${body.userId}-${Date.now()}`)
        .digest("hex"),
    });

    const result = await sqsClient.send(command);

    return {
      statusCode: 200,
      body: JSON.stringify({
        messageId: result.MessageId,
        message: "Successfully queued user profile update",
      }),
    };
  } catch (error) {
    console.error("Error sending message to queue:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to queue message",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
