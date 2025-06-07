import { router } from "./router";
import { BRAZE_API_KEY } from "./secrets";
import { bucket } from "./storage";

const deadLetterQueue = new sst.aws.Queue("braze-dlq", {
  fifo: true,
});

const brazeQueue = new sst.aws.Queue("braze-queue", {
  visibilityTimeout: "5 minutes",
  fifo: true,
  dlq: deadLetterQueue.arn,
});

brazeQueue.subscribe({
  handler: "packages/functions/src/braze-processor.handler",
  runtime: "nodejs22.x",
  link: [brazeQueue, bucket, BRAZE_API_KEY],
  environment: {
    BRAZE_REST_ENDPOINT: "https://rest.iad-05.braze.com",
  },
});

// function to send messages to the queue
new sst.aws.Function("queue-sender", {
  handler: "packages/functions/src/queue-sender.handler",
  link: [brazeQueue],
  runtime: "nodejs22.x",
  environment: {
    QUEUE_URL: brazeQueue.url,
  },
  ...(["production", "dev"].includes($app.stage)
    ? {
        url: {
          router: {
            instance: router,
            path: "/newspassid/webhook",
          },
          cors: false,
        },
      }
    : {
        url: {
          cors: false,
        },
      }),
});
