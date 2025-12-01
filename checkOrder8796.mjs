import 'dotenv/config';

async function checkOrder8796() {
    try {
        const accessToken = process.env.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_PASSWORD;
        const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;

        let domain = shopDomain;
        if (!domain.includes('.myshopify.com')) {
            domain = `${domain}.myshopify.com`;
        }

        const baseUrl = `https://${domain}/admin/api/2024-10/graphql.json`;

        console.log('🔍 Searching for order #8796...\n');

        const query = `
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

        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken,
            },
            body: JSON.stringify({
                query,
                variables: { query: 'name:#8796' }
            }),
        });

        const result = await response.json();

        if (result.data.orders.edges.length > 0) {
            const order = result.data.orders.edges[0].node;
            console.log(`✅ Found order ${order.name}:`);
            console.log(`   Created: ${new Date(order.createdAt).toLocaleString('nl-NL')}`);
            console.log(`   Updated: ${new Date(order.updatedAt).toLocaleString('nl-NL')}`);
            console.log(`   Returns: ${order.returns.edges.length}`);

            if (order.returns.edges.length > 0) {
                for (const returnEdge of order.returns.edges) {
                    const ret = returnEdge.node;
                    console.log(`   └─ ${ret.name} (${ret.status})`);
                    console.log(`      ID: ${ret.id}`);
                }
            } else {
                console.log(`   ⚠️  No returns found for this order`);
            }
        } else {
            console.log(`❌ Order #8796 not found in Shopify`);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkOrder8796();
