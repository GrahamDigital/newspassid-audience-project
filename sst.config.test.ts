/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "newspassid-backend",
      home: "aws",
    };
  },

  async run() {
    // S3 Bucket for ID data
    const bucket = new sst.aws.Bucket("NewsPassIDBucket", {
      name: "newspassid-data",
      cors: {
        allowMethods: ["GET", "PUT", "POST"],
        allowOrigins: ["*"],
        allowHeaders: ["*"],
        maxAge: "3000 seconds",
      },
      transform: {
        bucket: (args) => {
          args.bucket = "newspassid-data";
          args.serverSideEncryptionConfiguration = {
            rules: [
              {
                applyServerSideEncryptionByDefault: {
                  sseAlgorithm: "AES256",
                },
              },
            ],
          };
        },
      },
    });

    // Lambda function with API Gateway
    const api = new sst.aws.ApiGatewayV1("NewsPassIDApi", {
      cors: {
        allowMethods: ["POST", "OPTIONS"],
        allowOrigins: ["*"],
        allowHeaders: ["Content-Type", "Authorization"],
      },
    });

    // Lambda function
    const lambda = new sst.aws.Function("NewsPassIDLambda", {
      handler: "src/index.handler",
      runtime: "nodejs16.x",
      timeout: "10 seconds",
      memory: "256 MB",
      environment: {
        STORAGE_BUCKET: "newspassid-data",
        ID_FOLDER: "newspassid",
        ALLOWED_ORIGINS: "*",
      },
      link: [bucket],
      permissions: [
        {
          actions: ["s3:PutObject", "s3:GetObject"],
          resources: [`arn:aws:s3:::newspassid-data/*`],
        },
      ],
    });

    // Add route to API Gateway
    api.route("POST /newspassid", {
      function: lambda,
    });

    // Deploy the API
    api.deploy();

    return {
      ApiEndpoint: api.url + "/newspassid",
    };
  },
});
