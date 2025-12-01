import 'dotenv/config';

async function testReturnQuery() {
    try {
        const accessToken = process.env.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_PASSWORD;
        const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;

        let domain = shopDomain;
        if (!domain.includes('.myshopify.com')) {
            domain = `${domain}.myshopify.com`;
        }

        const baseUrl = `https://${domain}/admin/api/2024-10/graphql.json`;

        // Test query with OR logic
        const searchQuery = `return_status:RETURN_REQUESTED OR return_status:IN_PROGRESS`;

        console.log(`🔍 Testing query: ${searchQuery}\n`);

        const query = `
          query getOrders($first: Int!, $query: String) {
            orders(first: $first, query: $query) {
              edges {
                node {
                  id
                  name
                  returnStatus
                  returns(first: 5) {
                    edges {
                      node {
                        id
                        status
                      }
                    }
                  }
                }
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
                variables: { first: 10, query: searchQuery }
            }),
        });

        const result = await response.json();

        if (result.errors) {
            console.error('❌ Query failed:', JSON.stringify(result.errors, null, 2));
        } else {
            console.log(`✅ Found ${result.data.orders.edges.length} orders matching query`);
            for (const edge of result.data.orders.edges) {
                console.log(`   Order ${edge.node.name} - Return Status: ${edge.node.returnStatus}`);
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testReturnQuery();
