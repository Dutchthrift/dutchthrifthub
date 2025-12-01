import 'dotenv/config';
import { shopifyClient } from './server/services/shopifyClient';
import fs from 'fs';

async function debugFields() {
  try {
    console.log('🔍 Testing Return Query with inline fragment (API 2024-10)...\n');

    // Use one of the return IDs from the error log
    const returnId = "gid://shopify/Return/48809410895";

    const query = `
          query getReturn($id: ID!) {
            return(id: $id) {
              id
              name
              returnLineItems(first: 5) {
                nodes {
                  ... on ReturnLineItem {
                    id
                    fulfillmentLineItem {
                      lineItem {
                        title
                      }
                    }
                  }
                }
              }
            }
          }
        `;

    const data = await shopifyClient.makeGraphQLRequest(query, { id: returnId });
    const output = JSON.stringify(data, null, 2);
    console.log('✅ Success:', output);
    fs.writeFileSync('debug_output.log', output);

  } catch (error: any) {
    console.error('❌ Error:', error);
    fs.writeFileSync('debug_error.log', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
  }
}

debugFields();
