import { router } from "./router";

export const cdn = new sst.aws.StaticSite("sdk", {
  path: "packages/sdk",
  build: {
    command: "pnpm run build",
    output: "dist",
  },
  router: {
    instance: router,
    path: "/dist",
  },
});
