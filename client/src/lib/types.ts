import type {
  User, Customer, Order, EmailThread, EmailMessage, 
  Repair, Todo, InternalNote, Activity
} from "@shared/schema";

export type {
  User, Customer, Order, EmailThread, EmailMessage, 
  Repair, Todo, InternalNote, Activity
};

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
