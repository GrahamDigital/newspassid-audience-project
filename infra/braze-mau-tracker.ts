import { bucket } from "./storage";

const BRAZE_API_KEY = new sst.Secret("BRAZE_API_KEY");

// Braze MAU tracker - runs every 2 minutes
export const brazeMauTracker =
  $app.stage === "production"
    ? new sst.aws.Cron("braze-mau-tracker", {
        function: {
          handler: "packages/functions/src/lib/braze-mau-tracker.handler",
          runtime: "nodejs22.x",
          timeout: "30 seconds",
          link: [bucket, BRAZE_API_KEY],
          environment: {
            BRAZE_ENDPOINT: "https://rest.iad-05.braze.com",
            MONTHLY_LIMIT: "6000000",
            ALERT_THRESHOLD: "0.8",
          },
        },
        schedule: "rate(2 minutes)",
      })
    : // for local development, expose the function as an API endpoint
      $app.stage !== "dev"
      ? new sst.aws.Function("braze-mau-tracker", {
          handler: "packages/functions/src/lib/braze-mau-tracker.handler",
          runtime: "nodejs22.x",
          timeout: "30 seconds",
          link: [bucket, BRAZE_API_KEY],
          environment: {
            BRAZE_ENDPOINT: "https://rest.iad-05.braze.com",
            MONTHLY_LIMIT: "6000000",
            ALERT_THRESHOLD: "0.8",
          },
          url: true,
        })
      : undefined;
