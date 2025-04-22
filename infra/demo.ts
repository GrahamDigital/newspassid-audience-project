import { api } from "./api";
import { router } from "./router";

export const demo = new sst.aws.StaticSite("demo", {
  path: "packages/sdk/examples/basic",
  build: {
    command: "pnpm run build",
    output: "../../dist",
  },
  router: {
    instance: router,
    path: "/examples",
  },
  environment: {
    VITE_API_URL: api.url,
    VITE_STAGE: $app.stage,
  },
  vite: {
    types: "../../src/sst-env.d.ts",
  },
});
