import 'dotenv/config';

async function checkShopifyReturns() {
    try {
        console.log('🔍 Checking Shopify returns via GraphQL...\n');

        const accessToken = process.env.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_PASSWORD;
        const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;

        if (!accessToken || !shopDomain) {
            throw new Error('Missing Shopify credentials');
        }

        let domain = shopDomain;
        if (!domain.includes('.myshopify.com')) {
            domain = `${domain}.myshopify.com`;
        }

        const baseUrl = `https://${domain}/admin/api/2024-10/graphql.json`;

        // Query for returns on orders updated in the last 3 days
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 3);
        const searchQuery = `updated_at:>=${yesterday.toISOString()}`;

        console.log(`📅 Searching for orders updated since: ${yesterday.toLocaleString('nl-NL')}\n`);

        const query = `
          query getReturns($first: Int!, $query: String) {
            orders(first: $first, query: $query) {
              edges {
                node {
                  id
                  name
                  createdAt
                  updatedAt
                  returns(first: 20) {
                    edges {
                      node {
                        id
                        name
                        status
                      }
                    }
                  }
                }
              }
              pageInfo {
                hasNextPage
              }
            }
          }
        `;

        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken,
            },
            body: JSON.stringify({
                query,
                variables: { first: 50, query: searchQuery }
            }),
        });

        if (!response.ok) {
            throw new Error(`Shopify API error: ${response.status}`);
        }

        const result = await response.json();

        if (result.errors) {
            console.error('GraphQL Errors:', result.errors);
            throw new Error('GraphQL query failed');
        }

        console.log(`📦 Found orders with returns:\n`);

        let returnCount = 0;
        for (const orderEdge of result.data.orders.edges) {
            const order = orderEdge.node;

            if (order.returns.edges.length > 0) {
                console.log(`Order: ${order.name}`);
                console.log(`  Updated: ${new Date(order.updatedAt).toLocaleString('nl-NL')}`);

                for (const returnEdge of order.returns.edges) {
                    const ret = returnEdge.node;
                    console.log(`  └─ Return: ${ret.name} (${ret.status})`);
                    console.log(`     ID: ${ret.id}`);
                    returnCount++;
                }
                console.log('');
            }
        }

        console.log(`\n📊 Total returns found: ${returnCount}`);

        // Check specifically for order #8972
        console.log(`\n🔍 Searching specifically for order #8972...`);

        const orderQuery = `
          query getOrder($query: String!) {
            orders(first: 1, query: $query) {
              edges {
                node {
                  id
                  name
                  createdAt
                  updatedAt
                  returns(first: 20) {
                    edges {
                      node {
                        id
                        name
                        status
                      }
                    }
                  }
                }
              }
            }
          }
        `;

        const orderResponse = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken,
            },
            body: JSON.stringify({
                query: orderQuery,
                variables: { query: 'name:#8972' }
            }),
        });

        const orderResult = await orderResponse.json();

        if (orderResult.data.orders.edges.length > 0) {
            const order = orderResult.data.orders.edges[0].node;
            console.log(`\n✅ Found order ${order.name}:`);
            console.log(`   Created: ${new Date(order.createdAt).toLocaleString('nl-NL')}`);
            console.log(`   Updated: ${new Date(order.updatedAt).toLocaleString('nl-NL')}`);
            console.log(`   Returns: ${order.returns.edges.length}`);

            if (order.returns.edges.length > 0) {
                for (const returnEdge of order.returns.edges) {
                    const ret = returnEdge.node;
                    console.log(`   └─ ${ret.name} (${ret.status})`);
                }
            } else {
                console.log(`   ⚠️  No returns found for this order in Shopify!`);
            }
        } else {
            console.log(`\n❌ Order #8972 not found in Shopify`);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

checkShopifyReturns();
