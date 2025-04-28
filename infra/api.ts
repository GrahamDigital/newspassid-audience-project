/* eslint-disable @typescript-eslint/no-unused-expressions */
import { router } from "./router";
import { bucket } from "./storage";

const SNOWFLAKE_ACCOUNT = new sst.Secret("SNOWFLAKE_ACCOUNT");
const SNOWFLAKE_USER = new sst.Secret("SNOWFLAKE_USER");
const SNOWFLAKE_PASSWORD = new sst.Secret("SNOWFLAKE_PASSWORD");
const SNOWFLAKE_WAREHOUSE = new sst.Secret("SNOWFLAKE_WAREHOUSE");
const SNOWFLAKE_DATABASE = new sst.Secret("SNOWFLAKE_DATABASE");
const SNOWFLAKE_SCHEMA = new sst.Secret("SNOWFLAKE_SCHEMA");

export const api = new sst.aws.Function("api", {
  handler: "packages/functions/src/api.handler",
  runtime: "nodejs22.x",
  link: [bucket],
  ...(["production", "dev"].includes($app.stage)
    ? {
        url: {
          router: {
            instance: router,
            path: "/newspassid",
          },
          cors: false,
        },
      }
    : {
        url: {
          cors: false,
        },
      }),
  environment: {
    ID_FOLDER: "newspassid",
  },
});

$app.stage === "production"
  ? new sst.aws.Cron("snowflake-processor", {
      function: {
        handler: "packages/functions/src/lib/snowflake-processor.handler",
        runtime: "nodejs22.x",
        timeout: "1 minute",
        link: [
          SNOWFLAKE_ACCOUNT,
          SNOWFLAKE_USER,
          SNOWFLAKE_PASSWORD,
          SNOWFLAKE_WAREHOUSE,
          SNOWFLAKE_DATABASE,
          SNOWFLAKE_SCHEMA,
          bucket,
        ],
      },
      schedule: "rate(1 hour)",
    })
  : $app.stage !== "dev"
    ? new sst.aws.Function("snowflake-processor", {
        handler: "packages/functions/src/lib/snowflake-processor.handler",
        runtime: "nodejs22.x",
        timeout: "1 minute",
        link: [
          SNOWFLAKE_ACCOUNT,
          SNOWFLAKE_USER,
          SNOWFLAKE_PASSWORD,
          SNOWFLAKE_WAREHOUSE,
          SNOWFLAKE_DATABASE,
          SNOWFLAKE_SCHEMA,
          bucket,
        ],
        url: true,
      })
    : undefined;
