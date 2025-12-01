import 'dotenv/config';

async function checkOrder1018Status() {
    try {
        const accessToken = process.env.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_PASSWORD;
        const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;

        let domain = shopDomain;
        if (!domain.includes('.myshopify.com')) {
            domain = `${domain}.myshopify.com`;
        }

        const baseUrl = `https://${domain}/admin/api/2024-10/graphql.json`;

        const query = `
          query getOrder($query: String!) {
            orders(first: 1, query: $query) {
              edges {
                node {
                  id
                  name
                  returnStatus
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
                variables: { query: 'name:#1018' }
            }),
        });

        const result = await response.json();
        const order = result.data.orders.edges[0]?.node;

        if (order) {
            console.log(`Order #1018 Return Status: ${order.returnStatus}`);
        } else {
            console.log('Order #1018 not found');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkOrder1018Status();
