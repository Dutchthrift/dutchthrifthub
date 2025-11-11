import type {
  User, Customer, Order, EmailThread, EmailMessage, 
  Repair, Todo, InternalNote, Activity, Case,
  InsertUser, InsertCustomer, InsertOrder, InsertEmailThread, InsertEmailMessage,
  InsertRepair, InsertTodo, InsertInternalNote, InsertActivity, InsertCase
} from "@shared/schema";

export type {
  User, Customer, Order, EmailThread, EmailMessage, 
  Repair, Todo, InternalNote, Activity, Case,
  InsertUser, InsertCustomer, InsertOrder, InsertEmailThread, InsertEmailMessage,
  InsertRepair, InsertTodo, InsertInternalNote, InsertActivity, InsertCase
};

// Shopify Order Data Structure
export interface ShopifyCustomer {
  id?: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  default_address?: {
    address1?: string;
    address2?: string;
    city?: string;
    province?: string;
    zip?: string;
    country?: string;
  };
}

export interface ShopifyLineItem {
  id?: number;
  title?: string;
  quantity?: number;
  price?: string;
  sku?: string;
  variant_title?: string;
  product_id?: number;
  variant_id?: number;
}

export interface ShopifyFulfillment {
  id?: number;
  status?: string;
  tracking_company?: string;
  tracking_number?: string;
  tracking_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ShopifyOrderData {
  customer?: ShopifyCustomer;
  line_items?: ShopifyLineItem[];
  fulfillments?: ShopifyFulfillment[];
  [key: string]: any; // Allow other Shopify fields
}

// Extended Order type with typed orderData
export interface OrderWithShopifyData extends Omit<Order, 'orderData'> {
  orderData: ShopifyOrderData | null;
}

export interface DashboardStats {
  unreadEmails: number;
  newRepairs: number;
  slaAlerts: number;
  todaysOrders: {
    count: number;
    total: number;
  };
}

export interface SearchResults {
  customers: Customer[];
  orders: Order[];
  emailThreads: EmailThread[];
  repairs: Repair[];
}

export interface RepairWithDetails extends Repair {
  customer?: Customer;
  order?: Order;
  assignedUser?: User;
}

export interface TodoWithDetails extends Todo {
  customer?: Customer;
  order?: Order;
  repair?: Repair;
  assignedUser?: User;
}

export interface ActivityWithUser extends Activity {
  user?: User;
}

export interface CaseWithDetails extends Case {
  customer?: Customer;
  assignedUser?: User;
  notesCount?: number;
}
