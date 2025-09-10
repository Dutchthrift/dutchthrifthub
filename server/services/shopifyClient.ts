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
  private apiKey: string;
  private password: string;
  private shopDomain: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.SHOPIFY_API_KEY || '';
    this.password = process.env.SHOPIFY_PASSWORD || '';
    this.shopDomain = process.env.SHOPIFY_SHOP_DOMAIN || '';
    this.baseUrl = `https://${this.apiKey}:${this.password}@${this.shopDomain}.myshopify.com/admin/api/2024-01`;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
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
