import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/providers/theme-provider";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Inbox from "@/pages/inbox";
import Cases from "@/pages/cases";
import Orders from "@/pages/orders";
import PurchaseOrders from "@/pages/purchase-orders";
import Repairs from "@/pages/repairs";
import Todos from "@/pages/todos";
import Dashboard from "@/pages/dashboard";
import CustomerDetail from "@/pages/customer-detail";
import CaseDetail from "@/pages/case-detail";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/inbox" component={Inbox} />
      <Route path="/cases" component={Cases} />
      <Route path="/cases/:id" component={CaseDetail} />
      <Route path="/orders" component={Orders} />
      <Route path="/purchase-orders" component={PurchaseOrders} />
      <Route path="/repairs" component={Repairs} />
      <Route path="/todos" component={Todos} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/customers/:id" component={CustomerDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="dutchthrift-theme">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
