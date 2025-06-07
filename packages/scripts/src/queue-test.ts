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

    const result = (await response.json()) as TestResponse;

    if (response.ok) {
      console.info(`✅ Success: ${result.message}`);
      console.info(`   Message ID: ${result.messageId}`);
    } else {
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

  const testUsers = [
    {
      userId: "test-user-001",
      attributes: {
        email: "alice.smith@example.com",
        first_name: "Alice",
        last_name: "Smith",
        custom_attributes: {
          subscription_tier: "premium",
          source: "web",
          registration_date: "2024-01-15",
        },
      },
    },
    {
      userId: "test-user-002",
      attributes: {
        email: "bob.johnson@example.com",
        first_name: "Bob",
        last_name: "Johnson",
        custom_attributes: {
          subscription_tier: "basic",
          source: "mobile_app",
          last_activity: new Date().toISOString(),
          preferences: {
            newsletter: true,
            push_notifications: false,
          },
        },
      },
    },
    {
      userId: "test-user-003",
      attributes: {
        email: "carol.williams@example.com",
        first_name: "Carol",
        last_name: "Williams",
        custom_attributes: {
          subscription_tier: "enterprise",
          source: "referral",
          campaign_id: "winter2024",
          user_score: 92,
        },
      },
    },
    {
      userId: "test-user-004",
      attributes: {
        email: "david.brown@example.com",
        custom_attributes: {
          subscription_tier: "trial",
          source: "social_media",
          trial_end_date: "2024-02-15",
          features_used: ["analytics", "reporting"],
        },
      },
    },
    {
      userId: "test-user-005",
      attributes: {
        email: "emma.davis@example.com",
        first_name: "Emma",
        last_name: "Davis",
        custom_attributes: {
          subscription_tier: "premium",
          source: "direct",
          account_type: "business",
          team_size: 15,
          billing_cycle: "annual",
        },
      },
    },
    {
      userId: "test-user-006",
      attributes: {
        email: "frank.miller@example.com",
        first_name: "Frank",
        custom_attributes: {
          subscription_tier: "basic",
          source: "partner",
          partner_id: "partner-123",
          onboarding_completed: true,
        },
      },
    },
    {
      userId: "test-user-007",
      attributes: {
        email: "grace.wilson@example.com",
        first_name: "Grace",
        last_name: "Wilson",
        custom_attributes: {
          subscription_tier: "premium",
          source: "organic_search",
          search_keywords: ["analytics", "dashboard"],
          conversion_value: 299.99,
        },
      },
    },
    {
      userId: "test-user-008",
      attributes: {
        email: "henry.taylor@example.com",
        first_name: "Henry",
        last_name: "Taylor",
        custom_attributes: {
          subscription_tier: "basic",
          source: "email_campaign",
          campaign_id: "spring2024",
          click_through_rate: 0.15,
        },
      },
    },
    {
      userId: "test-user-009",
      attributes: {
        email: "isabella.anderson@example.com",
        first_name: "Isabella",
        last_name: "Anderson",
        custom_attributes: {
          subscription_tier: "premium",
          source: "webinar",
          webinar_id: "growth-strategies-101",
          engagement_score: 87,
        },
      },
    },
    {
      userId: "test-user-010",
      attributes: {
        email: "jack.thomas@example.com",
        first_name: "Jack",
        last_name: "Thomas",
        custom_attributes: {
          subscription_tier: "enterprise",
          source: "sales_team",
          sales_rep: "sarah.jones",
          contract_value: 50000,
        },
      },
    },
    {
      userId: "test-user-011",
      attributes: {
        email: "kate.jackson@example.com",
        first_name: "Kate",
        last_name: "Jackson",
        custom_attributes: {
          subscription_tier: "trial",
          source: "content_marketing",
          blog_post_id: "seo-best-practices",
          time_on_site: 420,
        },
      },
    },
    {
      userId: "test-user-012",
      attributes: {
        email: "liam.white@example.com",
        first_name: "Liam",
        last_name: "White",
        custom_attributes: {
          subscription_tier: "basic",
          source: "app_store",
          platform: "ios",
          app_version: "2.1.3",
        },
      },
    },
    {
      userId: "test-user-013",
      attributes: {
        email: "mia.harris@example.com",
        first_name: "Mia",
        last_name: "Harris",
        custom_attributes: {
          subscription_tier: "premium",
          source: "affiliate",
          affiliate_id: "tech-blogger-456",
          commission_rate: 0.2,
        },
      },
    },
    {
      userId: "test-user-014",
      attributes: {
        email: "noah.martin@example.com",
        first_name: "Noah",
        last_name: "Martin",
        custom_attributes: {
          subscription_tier: "enterprise",
          source: "trade_show",
          event_name: "TechCon 2024",
          booth_number: "A-42",
        },
      },
    },
    {
      userId: "test-user-015",
      attributes: {
        email: "olivia.garcia@example.com",
        first_name: "Olivia",
        last_name: "Garcia",
        custom_attributes: {
          subscription_tier: "basic",
          source: "google_ads",
          ad_group: "productivity-tools",
          cost_per_click: 2.45,
        },
      },
    },
    {
      userId: "test-user-016",
      attributes: {
        email: "peter.rodriguez@example.com",
        first_name: "Peter",
        last_name: "Rodriguez",
        custom_attributes: {
          subscription_tier: "premium",
          source: "linkedin",
          linkedin_campaign: "b2b-outreach",
          connection_level: "2nd",
        },
      },
    },
    {
      userId: "test-user-017",
      attributes: {
        email: "quinn.lewis@example.com",
        first_name: "Quinn",
        last_name: "Lewis",
        custom_attributes: {
          subscription_tier: "trial",
          source: "youtube",
          video_id: "product-demo-2024",
          watch_time: 180,
        },
      },
    },
    {
      userId: "test-user-018",
      attributes: {
        email: "ruby.lee@example.com",
        first_name: "Ruby",
        last_name: "Lee",
        custom_attributes: {
          subscription_tier: "enterprise",
          source: "cold_outreach",
          outreach_sequence: "enterprise-nurture",
          response_rate: 0.08,
        },
      },
    },
    {
      userId: "test-user-019",
      attributes: {
        email: "samuel.walker@example.com",
        first_name: "Samuel",
        last_name: "Walker",
        custom_attributes: {
          subscription_tier: "basic",
          source: "podcast",
          podcast_name: "Tech Trends Weekly",
          episode_number: 142,
        },
      },
    },
    {
      userId: "test-user-020",
      attributes: {
        email: "tara.hall@example.com",
        first_name: "Tara",
        last_name: "Hall",
        custom_attributes: {
          subscription_tier: "premium",
          source: "facebook_ads",
          ad_set: "lookalike-audience",
          frequency: 3.2,
        },
      },
    },
    {
      userId: "test-user-021",
      attributes: {
        email: "ulysses.allen@example.com",
        first_name: "Ulysses",
        last_name: "Allen",
        custom_attributes: {
          subscription_tier: "trial",
          source: "twitter",
          tweet_id: "1234567890",
          retweets: 15,
        },
      },
    },
    {
      userId: "test-user-022",
      attributes: {
        email: "violet.young@example.com",
        first_name: "Violet",
        last_name: "Young",
        custom_attributes: {
          subscription_tier: "enterprise",
          source: "customer_referral",
          referrer_id: "test-user-003",
          referral_bonus: 100,
        },
      },
    },
    {
      userId: "test-user-023",
      attributes: {
        email: "william.king@example.com",
        first_name: "William",
        last_name: "King",
        custom_attributes: {
          subscription_tier: "basic",
          source: "newsletter",
          newsletter_issue: "weekly-digest-52",
          open_rate: 0.35,
        },
      },
    },
    {
      userId: "test-user-024",
      attributes: {
        email: "xara.wright@example.com",
        first_name: "Xara",
        last_name: "Wright",
        custom_attributes: {
          subscription_tier: "premium",
          source: "instagram",
          post_id: "instagram-story-456",
          story_completion_rate: 0.78,
        },
      },
    },
    {
      userId: "test-user-025",
      attributes: {
        email: "yuki.lopez@example.com",
        first_name: "Yuki",
        last_name: "Lopez",
        custom_attributes: {
          subscription_tier: "enterprise",
          source: "partnership",
          partner_name: "TechCorp Solutions",
          integration_type: "api",
        },
      },
    },
  ];

  console.info(`Sending ${testUsers.length} test messages to the queue...\n`);

  // Send all messages with staggered timing to test queue handling
  // const promises = testUsers.map((user, index) => {
  //   return new Promise<void>((resolve) => {
  //     setTimeout(() => {
  //       sendTestMessage(user)
  //         .then(() => {
  //           resolve();
  //         })
  //         .catch(() => {
  //           resolve();
  //         });
  //     }, index * 500); // Stagger requests by 500ms
  //   });
  // });
  // send all the messages at once
  const promises = testUsers.map((user) => sendTestMessage(user));

  await Promise.all(promises);

  console.info("\n" + "=".repeat(50));
  console.info("Testing error handling...\n");

  // Test invalid request (missing userId) - should fail
  try {
    console.info("Testing invalid request (missing userId):");
    const response = await fetch(LAMBDA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        attributes: {
          email: "invalid@example.com",
        },
      }),
    });

    const result = (await response.json()) as TestResponse;

    if (!response.ok) {
      console.info(`✅ Expected error: ${result.error}`);
    } else {
      console.error(`❌ Unexpected success - should have failed`);
    }
  } catch (error) {
    console.error(`❌ Network error:`, error);
  }

  console.info("\n🏁 Load tests completed");
  console.info(`📊 Total messages sent: ${testUsers.length}`);
}

// Run the tests
runTests().catch((error) => {
  console.error("Failed to run tests:", error);
  process.exit(1);
});
