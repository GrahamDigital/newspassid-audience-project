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
        },
      }
    : { url: true }),
  environment: {
    ID_FOLDER: "newspassid",
  },
});
