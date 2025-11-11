import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/providers/theme-provider";
import { AuthProvider } from "@/providers/auth-provider";
import ProtectedRoute from "@/components/auth/protected-route";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Inbox from "@/pages/inbox";
import Cases from "@/pages/cases";
import Orders from "@/pages/orders";
import PurchaseOrders from "@/pages/purchase-orders";
import Repairs from "@/pages/repairs";
import Todos from "@/pages/todos";
import Returns from "@/pages/returns";
import CustomerDetail from "@/pages/customer-detail";
import CaseDetail from "@/pages/case-detail";
import UserManagement from "@/pages/user-management";
import Settings from "@/pages/settings";

function Router() {
  return (
    <Switch>
      {/* Dashboard - accessible by ADMIN and SUPPORT only */}
      <Route 
        path="/" 
        component={(props: any) => (
          <ProtectedRoute 
            component={Dashboard}
            roles={["ADMIN", "SUPPORT"]}
            {...props} 
          />
        )} 
      />

      {/* User Management - ADMIN only */}
      <Route 
        path="/users" 
        component={(props: any) => (
          <ProtectedRoute 
            component={UserManagement}
            roles={["ADMIN"]}
            {...props} 
          />
        )}
      />

      {/* Settings - ADMIN only */}
      <Route 
        path="/settings" 
        component={(props: any) => (
          <ProtectedRoute 
            component={Settings}
            roles={["ADMIN"]}
            {...props} 
          />
        )}
      />

      {/* Repairs - ADMIN and TECHNICUS only */}
      <Route 
        path="/repairs" 
        component={(props: any) => (
          <ProtectedRoute 
            component={Repairs}
            roles={["ADMIN", "TECHNICUS"]}
            {...props} 
          />
        )} 
      />

      {/* Cases - ADMIN and SUPPORT only */}
      <Route 
        path="/cases" 
        component={(props: any) => (
          <ProtectedRoute 
            component={Cases}
            roles={["ADMIN", "SUPPORT"]}
            {...props} 
          />
        )} 
      />

      <Route 
        path="/cases/:id" 
        component={(props: any) => (
          <ProtectedRoute 
            component={CaseDetail}
            roles={["ADMIN", "SUPPORT"]}
            {...props} 
          />
        )} 
      />

      {/* Inbox - ADMIN and SUPPORT only */}
      <Route 
        path="/inbox" 
        component={(props: any) => (
          <ProtectedRoute 
            component={Inbox}
            roles={["ADMIN", "SUPPORT"]}
            {...props} 
          />
        )} 
      />

      {/* Other protected routes */}
      <Route 
        path="/orders" 
        component={(props: any) => (
          <ProtectedRoute 
            component={Orders}
            roles={["ADMIN", "SUPPORT"]}
            {...props} 
          />
        )} 
      />

      <Route 
        path="/purchase-orders" 
        component={(props: any) => (
          <ProtectedRoute 
            component={PurchaseOrders}
            roles={["ADMIN", "SUPPORT"]}
            {...props} 
          />
        )} 
      />

      <Route 
        path="/todos" 
        component={(props: any) => (
          <ProtectedRoute 
            component={Todos}
            roles={["ADMIN", "SUPPORT"]}
            {...props} 
          />
        )} 
      />

      {/* Returns - ADMIN and SUPPORT only */}
      <Route 
        path="/returns" 
        component={(props: any) => (
          <ProtectedRoute 
            component={Returns}
            roles={["ADMIN", "SUPPORT"]}
            {...props} 
          />
        )} 
      />

      <Route 
        path="/customers/:id" 
        component={(props: any) => (
          <ProtectedRoute 
            component={CustomerDetail}
            roles={["ADMIN", "SUPPORT"]}
            {...props} 
          />
        )} 
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
