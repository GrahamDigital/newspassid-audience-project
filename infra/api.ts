/* eslint-disable @typescript-eslint/no-unused-expressions */

import { router } from "./router";
import {
  SNOWFLAKE_ACCOUNT,
  SNOWFLAKE_DATABASE,
  SNOWFLAKE_PASSWORD,
  SNOWFLAKE_SCHEMA,
  SNOWFLAKE_USER,
  SNOWFLAKE_WAREHOUSE,
} from "./secrets";
import { bucket } from "./storage";

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
