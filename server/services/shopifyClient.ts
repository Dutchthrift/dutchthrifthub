export interface ShopifyOrder {
  id: number;
  order_number: string;
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
    
    this.baseUrl = `https://${domain}/admin/api/2024-01`;
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

  async getOrders(params: {
    limit?: number;
    since_id?: string;
    created_at_min?: string;
    status?: string;
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
}

export const shopifyClient = new ShopifyClient();
