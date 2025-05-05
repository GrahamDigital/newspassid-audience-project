import { api } from "./api";
import { router } from "./router";
import { cdn } from "./sdk";

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
    VITE_API_URL: api.url,
    VITE_STAGE: $app.stage,
    VITE_CDN_URL: cdn.url,
  },
  // vite: {
  //   types: "../../src/sst-env.d.ts",
  // },
});
