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
    VITE_API_URL: api.url,
    VITE_STAGE: $app.stage,
    VITE_CDN_URL: router.url,
  },
});
