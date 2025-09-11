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
