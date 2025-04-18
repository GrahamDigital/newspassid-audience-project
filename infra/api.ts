import { bucket } from "./storage";

export const api = new sst.aws.Function("api", {
  url: true,
  link: [bucket],
  handler: "packages/functions/src/api.handler",
  environment: {
    ID_FOLDER: "newspassid",
  },
});
