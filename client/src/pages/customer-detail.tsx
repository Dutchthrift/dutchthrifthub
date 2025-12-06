import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import type { User as UserType } from "@shared/schema";
import { ArrowLeft, Mail, ShoppingCart, Wrench, User, Calendar, Phone, MapPin } from "lucide-react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { NotesPanel } from "@/components/notes/NotesPanel";
import type { Customer, Order, EmailThread, Repair } from "@/lib/types";

interface CustomerWithDetails extends Customer {
  orders: Order[];
  emailThreads: EmailThread[];
  repairs: Repair[];
}

export default function CustomerDetail() {
  const [match, params] = useRoute("/customers/:id");
  const customerId = params?.id;

  const { data: customer, isLoading: customerLoading } = useQuery<Customer>({
    queryKey: [`/api/customers/${customerId}`],
    enabled: !!customerId,
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: [`/api/customers/${customerId}/orders`],
    enabled: !!customerId,
  });

  const { data: emailThreads = [], isLoading: threadsLoading } = useQuery<EmailThread[]>({
    queryKey: [`/api/customers/${customerId}/email-threads`],
    enabled: !!customerId,
  });

  const { data: repairs = [], isLoading: repairsLoading } = useQuery<Repair[]>({
    queryKey: [`/api/customers/${customerId}/repairs`],
    enabled: !!customerId,
  });

  const { data: currentUser } = useQuery<UserType>({
    queryKey: ["/api/auth/session"],
    queryFn: async () => {
      const response = await fetch("/api/auth/session");
      if (!response.ok) throw new Error("Not authenticated");
      const data = await response.json();
      return data.user;
    },
  });

  if (!match) {
    return <div>Customer not found</div>;
  }

  if (customerLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return <div className="p-6">Customer not found</div>;
  }

  const isLoading = ordersLoading || threadsLoading || repairsLoading;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="sm" asChild data-testid="back-button">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-2xl font-semibold" data-testid="customer-name">
                {customer.firstName} {customer.lastName}
              </h1>
            </div>
          </div>

          {/* Customer Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-muted-foreground" data-testid="customer-email">{customer.email}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Phone</p>
                    <p className="text-sm text-muted-foreground" data-testid="customer-phone">
                      {customer.phone || "Not provided"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Customer Since</p>
                    <p className="text-sm text-muted-foreground" data-testid="customer-since">
                      {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : "Unknown"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Total Orders</p>
                    <p className="text-sm text-muted-foreground" data-testid="total-orders">
                      {orders.length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <Tabs defaultValue="orders" className="space-y-4">
          <TabsList>
            <TabsTrigger value="orders" data-testid="tab-orders">
              Orders ({orders.length})
            </TabsTrigger>
            <TabsTrigger value="emails" data-testid="tab-emails">
              Emails ({emailThreads.length})
            </TabsTrigger>
            <TabsTrigger value="repairs" data-testid="tab-repairs">
              Repairs ({repairs.length})
            </TabsTrigger>
            <TabsTrigger value="notes" data-testid="tab-notes">
              Team Notes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Order History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="animate-pulse space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-gray-200 rounded"></div>
                    ))}
                  </div>
                ) : orders.length > 0 ? (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50"
                        data-testid={`order-${order.id}`}
                      >
                        <div>
                          <p className="font-medium">Order {order.orderNumber}</p>
                          <p className="text-sm text-muted-foreground">
                            {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "Unknown"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            €{((order.totalAmount || 0) / 100).toFixed(2)}
                          </p>
                          <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                            {order.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No orders found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="emails" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Communication
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="animate-pulse space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-gray-200 rounded"></div>
                    ))}
                  </div>
                ) : emailThreads.length > 0 ? (
                  <div className="space-y-4">
                    {emailThreads.map((thread) => (
                      <div
                        key={thread.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50"
                        data-testid={`email-thread-${thread.id}`}
                      >
                        <div>
                          <p className="font-medium">{thread.subject}</p>
                          <p className="text-sm text-muted-foreground">
                            {thread.createdAt ? new Date(thread.createdAt).toLocaleDateString() : "Unknown"}
                          </p>
                        </div>
                        <div>
                          <Badge variant={thread.status === 'open' ? 'default' : 'secondary'}>
                            {thread.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No email threads found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="repairs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Repair History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="animate-pulse space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-gray-200 rounded"></div>
                    ))}
                  </div>
                ) : repairs.length > 0 ? (
                  <div className="space-y-4">
                    {repairs.map((repair) => (
                      <div
                        key={repair.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50"
                        data-testid={`repair-${repair.id}`}
                      >
                        <div>
                          <p className="font-medium">{repair.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {repair.createdAt ? new Date(repair.createdAt).toLocaleDateString() : "Unknown"}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant={repair.status === 'closed' ? 'default' : 'secondary'}>
                            {repair.status}
                          </Badge>
                          {repair.priority && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Priority: {repair.priority}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No repairs found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes" className="space-y-4">
            {currentUser && (
              <NotesPanel
                entityType="customer"
                entityId={customerId!}
                currentUser={currentUser}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}