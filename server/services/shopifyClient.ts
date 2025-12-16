export interface ShopifyOrder {
  id: number;
  order_number: string;
  name: string;
  email: string;
  total_price: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  created_at: string;
  updated_at: string;
  customer: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
  } | null;
  line_items: Array<{
    id: number;
    title: string;
    quantity: number;
    price: string;
  }>;
}

class ShopifyClient {
  private accessToken: string;
  private shopDomain: string;
  private baseUrl: string;

  constructor() {
    // Support both old and new credential formats
    this.accessToken = process.env.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_PASSWORD || '';
    this.shopDomain = process.env.SHOPIFY_SHOP_DOMAIN || '';

    console.log('Shopify Client initialized with:', {
      hasAccessToken: !!this.accessToken,
      shopDomain: this.shopDomain,
      tokenLength: this.accessToken.length
    });

    // Ensure proper domain format
    let domain = this.shopDomain;
    if (!domain.includes('.myshopify.com')) {
      domain = `${domain}.myshopify.com`;
    }

    this.baseUrl = `https://${domain}/admin/api/2024-10`;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    if (!this.accessToken || !this.shopDomain) {
      throw new Error('Shopify credentials not configured. Please set SHOPIFY_ACCESS_TOKEN and SHOPIFY_SHOP_DOMAIN environment variables.');
    }

    console.log('Making Shopify API request:', {
      url,
      hasToken: !!this.accessToken,
      tokenPrefix: this.accessToken.substring(0, 8) + '...',
    });

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.accessToken,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shopify API Error:', {
        status: response.status,
        statusText: response.statusText,
        url,
        errorText
      });
      throw new Error(`Shopify API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Shopify API response received for:', endpoint);
    return result;
  }

  public async makeGraphQLRequest(query: string, variables: any = {}) {
    const url = `${this.baseUrl}/graphql.json`;

    if (!this.accessToken || !this.shopDomain) {
      throw new Error('Shopify credentials not configured');
    }

    console.log('Making Shopify GraphQL request');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shopify GraphQL Error:', {
        status: response.status,
        errorText
      });
      throw new Error(`Shopify GraphQL error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    if (result.errors) {
      console.error('GraphQL Errors:', result.errors);
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    console.log('Shopify GraphQL response received');
    return result.data;
  }

  async getOrders(params: {
    limit?: number;
    since_id?: string;
    created_at_min?: string;
    updated_at_min?: string;
    status?: string;
    order?: string;
  } = {}) {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        searchParams.append(key, value.toString());
      }
    });

    const endpoint = `/orders.json${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const response = await this.makeRequest(endpoint);

    return response.orders as ShopifyOrder[];
  }

  async getAllOrders(onProgress?: (processed: number, total?: number) => void) {
    const allOrders: ShopifyOrder[] = [];
    let sinceId: string | undefined = undefined;
    const batchSize = 250; // Shopify's max limit per request
    let hasMore = true;
    let batchCount = 0;

    console.log('Starting to fetch all orders from Shopify...');

    while (hasMore) {
      batchCount++;
      console.log(`Fetching batch ${batchCount} (limit: ${batchSize}${sinceId ? `, since_id: ${sinceId}` : ''})`);

      const params: any = {
        limit: batchSize,
        status: 'any' // Include all order statuses
      };

      if (sinceId) {
        params.since_id = sinceId;
      }

      const batchOrders = await this.getOrders(params);

      if (batchOrders.length === 0) {
        hasMore = false;
        break;
      }

      allOrders.push(...batchOrders);

      // Update progress callback
      if (onProgress) {
        onProgress(allOrders.length);
      }

      console.log(`Batch ${batchCount}: Retrieved ${batchOrders.length} orders (total: ${allOrders.length})`);

      // If we got fewer orders than the limit, we've reached the end
      if (batchOrders.length < batchSize) {
        hasMore = false;
      } else {
        // Set since_id to the last order's ID for pagination
        sinceId = batchOrders[batchOrders.length - 1].id.toString();
      }

      // Add a small delay to be respectful to Shopify's API
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    console.log(`✅ Completed fetching all orders: ${allOrders.length} total orders retrieved`);
    return allOrders;
  }

  async getOrdersSinceDate(sinceDate: Date, onProgress?: (processed: number) => void) {
    const allOrders: ShopifyOrder[] = [];
    const batchSize = 250;
    let hasMore = true;
    let batchCount = 0;
    let sinceId: string | undefined = undefined;

    const createdAtMin = sinceDate.toISOString();
    console.log(`📅 Starting to fetch orders created since: ${createdAtMin}`);

    while (hasMore) {
      batchCount++;
      console.log(`Fetching batch ${batchCount} (limit: ${batchSize}, created_at_min: ${createdAtMin}${sinceId ? `, since_id: ${sinceId}` : ''})`);

      const params: any = {
        limit: batchSize,
        status: 'any',
        created_at_min: createdAtMin
      };

      // Use since_id for pagination within the date range
      if (sinceId) {
        params.since_id = sinceId;
      }

      const batchOrders = await this.getOrders(params);

      if (batchOrders.length === 0) {
        hasMore = false;
        break;
      }

      allOrders.push(...batchOrders);

      if (onProgress) {
        onProgress(allOrders.length);
      }

      console.log(`Batch ${batchCount}: Retrieved ${batchOrders.length} orders (total: ${allOrders.length})`);

      if (batchOrders.length < batchSize) {
        hasMore = false;
      } else {
        sinceId = batchOrders[batchOrders.length - 1].id.toString();
      }

      await new Promise(resolve => setTimeout(resolve, 250));
    }

    console.log(`✅ Completed date-based sync: ${allOrders.length} orders retrieved since ${createdAtMin}`);
    return allOrders;
  }

  async getAllCustomers(onProgress?: (processed: number, total?: number) => void) {
    const allCustomers: any[] = [];
    let sinceId: string | undefined = undefined;
    const batchSize = 250;
    let hasMore = true;
    let batchCount = 0;

    console.log('Starting to fetch all customers from Shopify...');

    while (hasMore) {
      batchCount++;
      console.log(`Fetching customer batch ${batchCount} (limit: ${batchSize}${sinceId ? `, since_id: ${sinceId}` : ''})`);

      const params: any = {
        limit: batchSize
      };

      if (sinceId) {
        params.since_id = sinceId;
      }

      const batchCustomers = await this.getCustomers(params);

      if (batchCustomers.length === 0) {
        hasMore = false;
        break;
      }

      allCustomers.push(...batchCustomers);

      if (onProgress) {
        onProgress(allCustomers.length);
      }

      console.log(`Customer batch ${batchCount}: Retrieved ${batchCustomers.length} customers (total: ${allCustomers.length})`);

      if (batchCustomers.length < batchSize) {
        hasMore = false;
      } else {
        sinceId = batchCustomers[batchCustomers.length - 1].id.toString();
      }

      await new Promise(resolve => setTimeout(resolve, 250));
    }

    console.log(`✅ Completed fetching all customers: ${allCustomers.length} total customers retrieved`);
    return allCustomers;
  }

  async getOrder(orderId: string) {
    const response = await this.makeRequest(`/orders/${orderId}.json`);
    return response.order as ShopifyOrder;
  }

  async getCustomers(params: {
    limit?: number;
    since_id?: string;
  } = {}) {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        searchParams.append(key, value.toString());
      }
    });

    const endpoint = `/customers.json${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const response = await this.makeRequest(endpoint);

    return response.customers;
  }

  async updateOrderStatus(orderId: string, status: string) {
    const response = await this.makeRequest(`/orders/${orderId}.json`, {
      method: 'PUT',
      body: JSON.stringify({
        order: {
          id: orderId,
          financial_status: status
        }
      })
    });

    return response.order;
  }

  // Returns methods using GraphQL
  async getReturns(params: {
    first?: number;
    after?: string;
    query?: string;
  } = {}) {
    const { first = 50, after, query: searchQuery } = params;

    // Query orders to get returns, as there is no root returns query for listing
    // Based on Shopify documentation example
    const query = `
      query getReturns($first: Int!, $after: String, $query: String) {
        orders(first: $first, after: $after, query: $query) {
          edges {
            node {
              id
              name
              createdAt
              returns(first: 20) {
                edges {
                  node {
                    id
                    name
                    status
                    createdAt
                    order {
                      id
                      name
                    }
                    returnLineItems(first: 50) {
                      edges {
                        node {
                          id
                          quantity
                          returnReason
                          returnReasonNote
                          customerNote
                          refundableQuantity
                          refundedQuantity
                          fulfillmentLineItem {
                            lineItem {
                              id
                              title
                              sku
                              price
                            }
                          }
                        }
                      }
                    }
                    totalQuantity
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const variables = {
      first,
      after,
      query: searchQuery
    };

    const data = await this.makeGraphQLRequest(query, variables);

    // Flatten returns from all orders
    const returns = data.orders.edges.flatMap((edge: any) =>
      edge.node.returns.edges.map((returnEdge: any) => returnEdge.node)
    );

    return {
      returns,
      pageInfo: data.orders.pageInfo
    };
  }

  async getReturnsSinceDate(sinceDate: Date, onProgress?: (processed: number) => void) {
    const createdAtMin = sinceDate.toISOString();
    // Use updated_at for orders query, as creating/updating a return updates the order
    // AND filter by return_status to only get active returns (REQUESTED or IN_PROGRESS)
    // This avoids fetching old completed/cancelled returns
    // NOTE: We REMOVED updated_at filter to ensure we get ALL active returns regardless of when they were last updated
    const searchQuery = `return_status:RETURN_REQUESTED OR return_status:IN_PROGRESS`;

    console.log(`📦 Starting to fetch return IDs via orders updated since: ${createdAtMin}`);

    // Step 1: Fetch all return IDs using lightweight query
    const returnIds: string[] = [];
    let hasMore = true;
    let cursor: string | undefined = undefined;
    let batchCount = 0;

    while (hasMore) {
      batchCount++;
      console.log(`Fetching return IDs batch ${batchCount}${cursor ? ` (after cursor)` : ''}`);

      // Lightweight query - only fetch IDs
      const query = `
        query getReturnIds($first: Int!, $after: String, $query: String) {
          orders(first: $first, after: $after, query: $query) {
            edges {
              node {
                id
                returns(first: 20) {
                  edges {
                    node {
                      id
                      name
                    }
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `;

      const variables = {
        first: 50,
        after: cursor,
        query: searchQuery
      };

      const data = await this.makeGraphQLRequest(query, variables);

      // Extract return IDs
      const batchIds = data.orders.edges.flatMap((edge: any) =>
        edge.node.returns.edges.map((returnEdge: any) => returnEdge.node.id)
      );

      returnIds.push(...batchIds);
      console.log(`Batch ${batchCount}: Found ${batchIds.length} return IDs (total: ${returnIds.length})`);

      if (!data.orders.pageInfo.hasNextPage) {
        hasMore = false;
      } else {
        cursor = data.orders.pageInfo.endCursor;
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    console.log(`✅ Found ${returnIds.length} return IDs, now fetching full data...`);

    // Step 2: Fetch complete data for each return using getReturnById
    const allReturns: any[] = [];

    for (let i = 0; i < returnIds.length; i++) {
      const returnId = returnIds[i];

      try {
        const fullReturn = await this.getReturnById(returnId);
        allReturns.push(fullReturn);

        if (onProgress) {
          onProgress(allReturns.length);
        }

        console.log(`[${i + 1}/${returnIds.length}] Fetched: ${fullReturn.name}`);

        // Rate limiting - be conservative with individual return queries
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Failed to fetch return ${returnId}:`, error);
        // Continue with next return
      }
    }

    console.log(`✅ Completed returns sync: ${allReturns.length}/${returnIds.length} returns retrieved`);
    return allReturns;
  }

  /**
   * Fetch a single return by ID with complete data
   * This uses the return(id:) query which provides full return details
   * unlike the limited data from orders.returns
   */
  async getReturnById(returnId: string): Promise<ShopifyReturn> {
    console.log(`📦 Fetching return by ID: ${returnId}`);

    // Ultra-minimal query - only fields that actually exist in the API
    const query = `
      query getReturn($id: ID!) {
        return(id: $id) {
          id
          name
          status
          order {
            id
            name
            createdAt
            customer {
              id
              displayName
              email
            }
          }
          returnLineItems(first: 50) {
            nodes {
              ... on ReturnLineItem {
                id
                quantity
                returnReason
                returnReasonNote
                customerNote
                refundableQuantity
                refundedQuantity
                fulfillmentLineItem {
                  lineItem {
                    title
                    sku
                    variantTitle
                    originalUnitPriceSet {
                      shopMoney {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
          }
          totalQuantity
          reverseFulfillmentOrders(first: 5) {
            edges {
              node {
                id
                reverseDeliveries(first: 5) {
                  edges {
                    node {
                      id
                      deliverable {
                        ... on ReverseDeliveryShippingDeliverable {
                          tracking {
                            number
                            carrierName
                            url
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const variables = {
      id: returnId
    };

    const data = await this.makeGraphQLRequest(query, variables);

    if (!data.return) {
      throw new Error(`Return not found: ${returnId}`);
    }

    // Flatten reverseDeliveries from all reverseFulfillmentOrders
    const reverseDeliveriesEdges: any[] = [];
    if (data.return.reverseFulfillmentOrders?.edges) {
      for (const rfoEdge of data.return.reverseFulfillmentOrders.edges) {
        if (rfoEdge.node.reverseDeliveries?.edges) {
          reverseDeliveriesEdges.push(...rfoEdge.node.reverseDeliveries.edges);
        }
      }
    }

    // Transform nodes to edges format to match ShopifyReturn interface
    // Use order createdAt as fallback for return date
    const returnData = {
      ...data.return,
      orderCreatedAt: data.return.order.createdAt, // Enrich with order date
      returnLineItems: {
        edges: data.return.returnLineItems.nodes.map((node: any) => ({ node }))
      },
      reverseDeliveries: {
        edges: reverseDeliveriesEdges
      }
    };

    console.log(`✅ Retrieved return: ${returnData.name}`);
    return returnData;
  }

  /**
   * Fetch a reverse delivery by ID to get tracking information
   */
  async getReverseDeliveryById(reverseDeliveryId: string): Promise<ShopifyReverseDelivery | null> {
    console.log(`📬 Fetching reverse delivery by ID: ${reverseDeliveryId}`);

    const query = `
      query getReverseDelivery($id: ID!) {
        reverseDelivery(id: $id) {
          id
          reverseFulfillmentOrder {
            id
            return {
              id
              name
            }
          }
          deliverables(first: 10) {
            nodes {
              id
              ... on ReverseDeliveryShippingDeliverable {
                tracking {
                  number
                  carrierName
                  url
                }
              }
            }
          }
        }
      }
    `;

    const variables = {
      id: reverseDeliveryId
    };

    try {
      const data = await this.makeGraphQLRequest(query, variables);

      if (!data.reverseDelivery) {
        console.log(`⚠️  Reverse delivery not found: ${reverseDeliveryId}`);
        return null;
      }

      const rd = data.reverseDelivery;

      // Extract tracking info from deliverables
      let trackingInfo: { number?: string; company?: string; url?: string } | null = null;

      if (rd.deliverables?.nodes?.length > 0) {
        // Find first deliverable with tracking
        const deliverable = rd.deliverables.nodes.find((n: any) => n.tracking);
        if (deliverable?.tracking) {
          trackingInfo = {
            number: deliverable.tracking.number,
            company: deliverable.tracking.carrierName,
            url: deliverable.tracking.url
          };
        }
      }

      console.log(`✅ Retrieved reverse delivery with tracking: ${trackingInfo?.number || 'none'}`);

      return {
        id: rd.id,
        returnId: rd.reverseFulfillmentOrder?.return?.id || '',
        returnName: rd.reverseFulfillmentOrder?.return?.name || '',
        trackingInfo
      };
    } catch (error) {
      console.error(`❌ Error fetching reverse delivery:`, error);
      return null;
    }
  }
}

export interface ShopifyReturn {
  id: string; // gid://shopify/Return/...
  name: string; // #1001-R1
  status: 'OPEN' | 'REQUESTED' | 'CLOSED' | 'CANCELLED' | 'COMPLETE' | 'DECLINED';
  order: {
    id: string;
    name: string; // #1001
    customer?: {
      id: string;
      displayName: string;
      email: string;
    };
  };
  orderCreatedAt?: string; // Enriched from order data
  returnLineItems: {
    edges: Array<{
      node: {
        id: string;
        quantity: number;
        returnReason: string | null;
        returnReasonNote: string | null;
        customerNote: string | null;
        refundableQuantity: number;
        refundedQuantity: number;
        fulfillmentLineItem?: {
          lineItem: {
            title: string;
            sku: string | null;
            variantTitle: string | null;
            originalUnitPriceSet?: {
              shopMoney: {
                amount: string;
                currencyCode: string;
              };
            };
          };
        };
      };
    }>;
  };
  totalQuantity: number;
  reverseDeliveries?: {
    edges: Array<{
      node: {
        id: string;
        deliverable?: {
          tracking?: {
            number: string;
            carrierName: string;
            url: string;
          };
        };
      };
    }>;
  };
}

export interface ShopifyReverseDelivery {
  id: string; // gid://shopify/ReverseDelivery/...
  returnId: string; // gid://shopify/Return/...
  returnName: string; // #1001-R1
  trackingInfo: {
    number?: string;
    company?: string;
    url?: string;
  } | null;
}

export const shopifyClient = new ShopifyClient();
