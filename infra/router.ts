export const router =
  $app.stage === "production"
    ? new sst.aws.Router("router", {
        domain: {
          name: "npid.gmg.io",
          dns: false,
          cert: "arn:aws:acm:us-east-1:413788254441:certificate/baad8fb2-dc6c-4390-87fe-0f4998254fae",
        },
      })
    : new sst.aws.Router("router", {
        domain: {
          name: "npid-dev.gmg.io",
          dns: false,
          cert: "arn:aws:acm:us-east-1:413788254441:certificate/baad8fb2-dc6c-4390-87fe-0f4998254fae",
        },
      });
