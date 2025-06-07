interface SendMessageRequest {
  userId: string;
  attributes: {
    email?: string;
    first_name?: string;
    last_name?: string;
    custom_attributes?: Record<string, unknown>;
  };
}

interface TestResponse {
  messageId?: string;
  message?: string;
  error?: string;
  details?: string;
}

const LAMBDA_URL =
  "https://iurctgkecd66ixbevgm6vhppxy0ptojn.lambda-url.us-east-1.on.aws";

async function sendTestMessage(payload: SendMessageRequest): Promise<void> {
  try {
    console.info(`Sending test message for user: ${payload.userId}`);

    const response = await fetch(LAMBDA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const result = (await response.json()) as TestResponse;
      console.info(`✅ Success: ${result.message}`);
      console.info(`   Message ID: ${result.messageId}`);
    } else {
      const result = (await response.text()) as TestResponse;
      console.error(`❌ Error ${response.status}: ${result.error}`);
      if (result.details) {
        console.error(`   Details: ${result.details}`);
      }
    }
  } catch (error) {
    console.error(`❌ Network error:`, error);
  }
}

async function runTests(): Promise<void> {
  console.info("🚀 Starting SQS Queue Load Tests\n");

  const testUsers = Array.from({ length: 100 }, (_, i) => ({
    userId: `test-user-${i}`,
    attributes: {
      email: `test-user-${i}@example.com`,
    },
  }));

  console.info(`Sending ${testUsers.length} test messages to the queue...\n`);

  // Send all messages with staggered timing to test queue handling
  const promises = testUsers.map((user, index) => {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        sendTestMessage(user)
          .then(() => {
            resolve();
          })
          .catch(() => {
            resolve();
          });
      }, index * 50); // Stagger requests by 500ms
    });
  });
  await Promise.all(promises);
  // send all the messages at once
  // const doubledTestUsers = [...testUsers, ...testUsers];
  // const promises = doubledTestUsers.map((user) => sendTestMessage(user));

  // await Promise.all(promises);

  // console.info("\n" + "=".repeat(50));
  // console.info("Testing error handling...\n");

  // // Test invalid request (missing userId) - should fail
  // try {
  //   console.info("Testing invalid request (missing userId):");
  //   const response = await fetch(LAMBDA_URL, {
  //     method: "POST",
  //     headers: {
  //       "Content-Type": "application/json",
  //     },
  //     body: JSON.stringify({
  //       attributes: {
  //         email: "invalid@example.com",
  //       },
  //     }),
  //   });

  //   const result = (await response.json()) as TestResponse;

  //   if (!response.ok) {
  //     console.info(`✅ Expected error: ${result.error}`);
  //   } else {
  //     console.error(`❌ Unexpected success - should have failed`);
  //   }
  // } catch (error) {
  //   console.error(`❌ Network error:`, error);
  // }

  console.info("\n🏁 Load tests completed");
  console.info(`📊 Total messages sent: ${testUsers.length}`);
}

// Run the tests
runTests().catch((error) => {
  console.error("Failed to run tests:", error);
  process.exit(1);
});
