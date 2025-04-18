import { api } from "./api";

export const demo = new sst.aws.StaticSite("demo", {
  path: "packages/sdk/examples/basic",
  environment: {
    VITE_PUBLIC_API_URL: api.url,
  },
});
