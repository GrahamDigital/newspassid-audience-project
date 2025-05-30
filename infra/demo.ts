import { api } from "./api";
import { router } from "./router";
import { sdk } from "./sdk";

export const demo = new sst.aws.StaticSite("demo", {
  path: "packages/examples",
  build: {
    command: "pnpm run build",
    output: "dist",
  },
  router: {
    instance: router,
    path: "/examples",
  },
  environment: {
    VITE_STAGE: $app.stage,
    VITE_API_URL: ["production", "dev"].includes($app.stage)
      ? api.url
      : api.url.apply((url) => `${url}newspassid`),
    VITE_CDN_URL: ["production", "dev"].includes($app.stage)
      ? sdk.url.apply((url) => `${url}/dist`)
      : "http://localhost:3000",
  },
});
