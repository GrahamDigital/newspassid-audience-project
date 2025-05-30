import { api } from "./api";
import { router } from "./router";

export const sdk = new sst.aws.StaticSite("sdk", {
  path: "packages/sdk",
  build: {
    command: "pnpm run build",
    output: "dist",
  },
  router: {
    instance: router,
    path: "/dist",
  },
  environment: {
    VITE_STAGE: $app.stage,
    VITE_API_URL: ["production", "dev"].includes($app.stage)
      ? api.url
      : api.url.apply((url) => `${url}newspassid`),
    VITE_CDN_URL: ["production", "dev"].includes($app.stage)
      ? router.url.apply((url) => `${url}/dist`)
      : "http://localhost:3000",
  },
});
