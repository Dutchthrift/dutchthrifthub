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
}
