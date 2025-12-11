import { shopifyClient } from './services/shopifyClient';

/**
 * Register Returns webhooks with Shopify
 * Run this script to set up all return-related webhook subscriptions
 * 
 * Usage: tsx server/registerReturnsWebhook.ts <command>
 */

const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || 'https://your-domain.com';

// All return-related webhook topics we need
const RETURN_WEBHOOK_TOPICS = [
  { topic: 'RETURNS_REQUEST', endpoint: '/api/shopify/webhooks/returns' },
  { topic: 'RETURNS_APPROVE', endpoint: '/api/shopify/webhooks/returns' },
  { topic: 'RETURNS_DECLINE', endpoint: '/api/shopify/webhooks/returns' },
  { topic: 'RETURNS_CLOSE', endpoint: '/api/shopify/webhooks/returns' },
  { topic: 'RETURNS_CANCEL', endpoint: '/api/shopify/webhooks/returns' },
  { topic: 'REVERSE_DELIVERIES_CREATE', endpoint: '/api/shopify/webhooks/reverse-deliveries' },
];

async function registerSingleWebhook(topic: string, callbackUrl: string) {
  const mutation = `
    mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
        webhookSubscription {
          id
          topic
          format
          endpoint {
            __typename
            ... on WebhookHttpEndpoint {
              callbackUrl
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    topic,
    webhookSubscription: {
      format: 'JSON',
      callbackUrl
    }
  };

  const result = await (shopifyClient as any).makeGraphQLRequest(mutation, variables);

  if (result.webhookSubscriptionCreate.userErrors.length > 0) {
    const errors = result.webhookSubscriptionCreate.userErrors;
    // Check if it's just a duplicate error (webhook already exists)
    const isDuplicate = errors.some((e: any) => e.message?.includes('already exists'));
    if (isDuplicate) {
      console.log(`   ⏭️  ${topic} - already registered`);
      return { success: true, skipped: true };
    }
    console.error(`   ❌ ${topic} - failed:`);
    errors.forEach((error: any) => {
      console.error(`      - ${error.field}: ${error.message}`);
    });
    return { success: false, errors };
  }

  const subscription = result.webhookSubscriptionCreate.webhookSubscription;
  console.log(`   ✅ ${topic} - registered`);
  return { success: true, subscription };
}

async function registerAllWebhooks() {
  console.log('🔧 Registering all Shopify return webhooks...');
  console.log(`   Base URL: ${WEBHOOK_BASE_URL}`);
  console.log();

  let successCount = 0;
  let failCount = 0;

  for (const { topic, endpoint } of RETURN_WEBHOOK_TOPICS) {
    try {
      const callbackUrl = `${WEBHOOK_BASE_URL}${endpoint}`;
      const result = await registerSingleWebhook(topic, callbackUrl);
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (error: any) {
      console.error(`   ❌ ${topic} - error: ${error.message}`);
      failCount++;
    }
  }

  console.log();
  console.log(`📊 Results: ${successCount} succeeded, ${failCount} failed`);

  if (successCount > 0) {
    console.log();
    console.log('💡 Webhooks registered! Status changes in Shopify will now sync automatically.');
    console.log('   - RETURNS_REQUEST → Hub status: nieuw');
    console.log('   - RETURNS_APPROVE → Hub status: onderweg');
    console.log('   - RETURNS_DECLINE → Hub status: niet_ontvangen');
    console.log('   - RETURNS_CLOSE → Hub status: klaar');
    console.log('   - REVERSE_DELIVERIES_CREATE → Tracking info synced');
  }
}

// List existing webhooks
async function listWebhooks() {
  console.log('📋 Listing existing webhooks...\n');

  const query = `
    query {
      webhookSubscriptions(first: 50) {
        edges {
          node {
            id
            topic
            format
            endpoint {
              __typename
              ... on WebhookHttpEndpoint {
                callbackUrl
              }
            }
          }
        }
      }
    }
  `;

  try {
    const result = await (shopifyClient as any).makeGraphQLRequest(query, {});
    const webhooks = result.webhookSubscriptions.edges;

    if (webhooks.length === 0) {
      console.log('No webhooks found.');
    } else {
      // Group by relevance
      const returnWebhooks = webhooks.filter((e: any) =>
        e.node.topic.includes('RETURN') || e.node.topic.includes('REVERSE')
      );
      const otherWebhooks = webhooks.filter((e: any) =>
        !e.node.topic.includes('RETURN') && !e.node.topic.includes('REVERSE')
      );

      if (returnWebhooks.length > 0) {
        console.log('🔄 Return-related webhooks:');
        returnWebhooks.forEach((edge: any) => {
          const webhook = edge.node;
          console.log(`   ${webhook.topic}`);
          console.log(`      URL: ${webhook.endpoint?.callbackUrl || 'N/A'}`);
        });
        console.log();
      }

      if (otherWebhooks.length > 0) {
        console.log(`📦 Other webhooks: ${otherWebhooks.length} registered`);
      }
    }
  } catch (error) {
    console.error('❌ Failed to list webhooks:', error);
  }
}

// Delete all return-related webhooks
async function deleteReturnWebhooks() {
  console.log('🗑️  Deleting return-related webhooks...\n');

  const query = `
    query {
      webhookSubscriptions(first: 50) {
        edges {
          node {
            id
            topic
          }
        }
      }
    }
  `;

  const deleteMutation = `
    mutation webhookSubscriptionDelete($id: ID!) {
      webhookSubscriptionDelete(id: $id) {
        deletedWebhookSubscriptionId
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    const result = await (shopifyClient as any).makeGraphQLRequest(query, {});
    const webhooks = result.webhookSubscriptions.edges;

    const returnWebhooks = webhooks.filter((e: any) =>
      e.node.topic.includes('RETURN') || e.node.topic.includes('REVERSE')
    );

    if (returnWebhooks.length === 0) {
      console.log('No return-related webhooks to delete.');
      return;
    }

    for (const edge of returnWebhooks) {
      const webhook = edge.node;
      try {
        await (shopifyClient as any).makeGraphQLRequest(deleteMutation, { id: webhook.id });
        console.log(`   ✅ Deleted: ${webhook.topic}`);
      } catch (error: any) {
        console.error(`   ❌ Failed to delete ${webhook.topic}: ${error.message}`);
      }
    }

    console.log('\n✅ Cleanup complete. Run "register" to re-register webhooks.');
  } catch (error) {
    console.error('❌ Failed to list/delete webhooks:', error);
  }
}

// Main
const command = process.argv[2];

if (command === 'list') {
  listWebhooks();
} else if (command === 'register') {
  registerAllWebhooks();
} else if (command === 'delete') {
  deleteReturnWebhooks();
} else {
  console.log('Shopify Returns Webhook Manager');
  console.log('================================\n');
  console.log('Usage:');
  console.log('  tsx server/registerReturnsWebhook.ts list      # List existing webhooks');
  console.log('  tsx server/registerReturnsWebhook.ts register  # Register all return webhooks');
  console.log('  tsx server/registerReturnsWebhook.ts delete    # Delete return webhooks');
  console.log();
  console.log('Environment variables:');
  console.log('  WEBHOOK_BASE_URL  - Your production URL (e.g. https://hub.dutchthrift.nl)');
  console.log();
  console.log('Webhooks that will be registered:');
  RETURN_WEBHOOK_TOPICS.forEach(({ topic }) => {
    console.log(`  - ${topic}`);
  });
}
