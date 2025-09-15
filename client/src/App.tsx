import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/providers/theme-provider";
import { AuthProvider } from "@/providers/auth-provider";
import ProtectedRoute from "@/components/auth/protected-route";
import AdminLayout from "@/components/layout/admin-layout";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Inbox from "@/pages/inbox";
import Cases from "@/pages/cases";
import Orders from "@/pages/orders";
import PurchaseOrders from "@/pages/purchase-orders";
import Repairs from "@/pages/repairs";
import Todos from "@/pages/todos";
import CustomerDetail from "@/pages/customer-detail";
import CaseDetail from "@/pages/case-detail";

// Higher-order component that wraps pages with admin layout and protection
function createProtectedPage(PageComponent, allowedRoles) {
  return function ProtectedPageWrapper(props) {
    return (
      <ProtectedRoute 
        component={(pageProps) => (
          <AdminLayout>
            <PageComponent {...pageProps} />
          </AdminLayout>
        )}
        roles={allowedRoles}
        {...props} 
      />
    );
  };
}

function Router() {
  return (
    <Switch>
      {/* Dashboard - accessible by all authenticated users */}
      <Route 
        path="/" 
        component={createProtectedPage(Dashboard, ["ADMIN", "SUPPORT", "TECHNICUS"])} 
      />

      {/* User Management - ADMIN only */}
      <Route 
        path="/users" 
        component={createProtectedPage(Orders, ["ADMIN"])} // Placeholder - we'll create UserManagement component later
      />

      {/* Repairs - ADMIN and TECHNICUS only */}
      <Route 
        path="/repairs" 
        component={createProtectedPage(Repairs, ["ADMIN", "TECHNICUS"])} 
      />

      {/* Cases - ADMIN and SUPPORT only */}
      <Route 
        path="/cases" 
        component={createProtectedPage(Cases, ["ADMIN", "SUPPORT"])} 
      />

      <Route 
        path="/cases/:id" 
        component={createProtectedPage(CaseDetail, ["ADMIN", "SUPPORT"])} 
      />

      {/* Inbox - ADMIN and SUPPORT only */}
      <Route 
        path="/inbox" 
        component={createProtectedPage(Inbox, ["ADMIN", "SUPPORT"])} 
      />

      {/* Other protected routes */}
      <Route 
        path="/orders" 
        component={createProtectedPage(Orders, ["ADMIN", "SUPPORT", "TECHNICUS"])} 
      />

      <Route 
        path="/purchase-orders" 
        component={createProtectedPage(PurchaseOrders, ["ADMIN", "SUPPORT", "TECHNICUS"])} 
      />

      <Route 
        path="/todos" 
        component={createProtectedPage(Todos, ["ADMIN", "SUPPORT", "TECHNICUS"])} 
      />

      <Route 
        path="/customers/:id" 
        component={createProtectedPage(CustomerDetail, ["ADMIN", "SUPPORT", "TECHNICUS"])} 
      />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="dutchthrift-theme">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
