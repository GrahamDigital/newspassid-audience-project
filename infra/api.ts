import { router } from "./router";
import { bucket } from "./storage";

export const api = new sst.aws.Function("api", {
  link: [bucket],
  handler: "packages/functions/src/api.handler",
  runtime: "nodejs22.x",
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

export const processor = new sst.aws.Function("processor", {
  handler: "packages/functions/src/lib/snowflake-processor.handler",
  runtime: "nodejs22.x",
});
