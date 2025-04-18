/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "newspassid-audience",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
    };
  },
  async run() {
    const storage = await import("./infra/storage");
    await import("./infra/api");
    await import("./infra/demo");

    return {
      dataBucket: storage.bucket.name,
    };
  },
});
