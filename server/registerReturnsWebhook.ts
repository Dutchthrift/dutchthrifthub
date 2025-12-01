import { shopifyClient } from './services/shopifyClient';

/**
 * Register Returns webhooks with Shopify
 * Run this script once to set up the webhook subscriptions
 * 
 * Usage: tsx server/registerReturnsWebhook.ts
 */

const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || 'https://your-domain.com';
const WEBHOOK_TOPIC = 'RETURNS_REQUEST'; // Or RETURNS_APPROVE, RETURNS_CLOSE

async function registerWebhook() {
    console.log('🔧 Registering Shopify returns webhook...');
    console.log(`   Base URL: ${WEBHOOK_BASE_URL}`);
    console.log(`   Topic: ${WEBHOOK_TOPIC}`);

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
        topic: WEBHOOK_TOPIC,
        webhookSubscription: {
            format: 'JSON',
            callbackUrl: `${WEBHOOK_BASE_URL}/api/shopify/webhooks/returns`
        }
    };

    try {
        const result = await (shopifyClient as any).makeGraphQLRequest(mutation, variables);

        if (result.webhookSubscriptionCreate.userErrors.length > 0) {
            console.error('❌ Errors creating webhook:');
            result.webhookSubscriptionCreate.userErrors.forEach((error: any) => {
                console.error(`   - ${error.field}: ${error.message}`);
            });
            process.exit(1);
        }

        const subscription = result.webhookSubscriptionCreate.webhookSubscription;
        console.log('✅ Webhook registered successfully!');
        console.log(`   ID: ${subscription.id}`);
        console.log(`   Topic: ${subscription.topic}`);
        console.log(`   URL: ${subscription.endpoint.callbackUrl}`);
        console.log();
        console.log('💡 Next steps:');
        console.log('   1. Test the webhook by creating a return in Shopify');
        console.log('   2. Check your server logs for webhook receipt');
        console.log('   3. Verify the return appears in your database');

    } catch (error) {
        console.error('❌ Failed to register webhook:', error);
        process.exit(1);
    }
}

// List existing webhooks
async function listWebhooks() {
    console.log('📋 Listing existing webhooks...\n');

    const query = `
    query {
      webhookSubscriptions(first: 20) {
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
            webhooks.forEach((edge: any, index: number) => {
                const webhook = edge.node;
                console.log(`${index + 1}. ${webhook.topic}`);
                console.log(`   ID: ${webhook.id}`);
                console.log(`   URL: ${webhook.endpoint.callbackUrl}`);
                console.log();
            });
        }
    } catch (error) {
        console.error('❌ Failed to list webhooks:', error);
    }
}

// Main
const command = process.argv[2];

if (command === 'list') {
    listWebhooks();
} else if (command === 'register') {
    registerWebhook();
} else {
    console.log('Usage:');
    console.log('  tsx server/registerReturnsWebhook.ts list      # List existing webhooks');
    console.log('  tsx server/registerReturnsWebhook.ts register  # Register returns webhook');
    console.log();
    console.log('Environment variables:');
    console.log('  WEBHOOK_BASE_URL  - Your production URL (e.g. https://hub.dutchthrift.nl)');
    console.log('  For local development, use ngrok:');
    console.log('    ngrok http 5000');
    console.log('    then set WEBHOOK_BASE_URL=https://your-ngrok-url.ngrok.io');
}
