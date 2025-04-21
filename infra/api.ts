import { router } from "./router";
import { bucket } from "./storage";

export const api = new sst.aws.Function("api", {
  link: [bucket],
  handler: "packages/functions/src/api.handler",
  url: {
    router: {
      instance: router,
      path: "/newspassid",
    },
  },
  environment: {
    ID_FOLDER: "newspassid",
  },
});
