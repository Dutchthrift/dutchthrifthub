# Component Usage Examples

**DutchThrift Hub Design System - Practical Implementation Guide**

---

## 📋 Table of Contents

1. [Page Structure](#page-structure)
2. [Forms & Inputs](#forms--inputs)
3. [Navigation Patterns](#navigation-patterns)
4. [Modal & Dialog Usage](#modal--dialog-usage)
5. [Card Layouts](#card-layouts)
6. [Mobile-Responsive Patterns](#mobile-responsive-patterns)

---

## 🏗️ Page Structure

### Basic Page Layout

```tsx
import { Navigation } from "@/components/layout/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Plus, Filter, Download } from "lucide-react";

export default function OrdersPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto p-4 md:p-6 lg:p-8">
        <PageHeader
          title="Orders"
          subtitle="Manage and track all customer orders"
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Orders" }
          ]}
          actions={
            <>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="primary">
                <Plus className="h-4 w-4 mr-2" />
                New Order
              </Button>
            </>
          }
        />
        
        {/* Page Content */}
        <div className="space-y-6">
          {/* Your content here */}
        </div>
      </main>
    </div>
  );
}
```

---

## 📝 Forms & Inputs

### Complete Form Example

```tsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function OrderForm() {
  const { register, handleSubmit } = useForm();

  const onSubmit = (data) => {
    console.log(data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Order</CardTitle>
        <CardDescription>
          Fill in the details below to create a new order
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Text Input */}
          <div className="space-y-2">
            <Label htmlFor="customer">Customer Name</Label>
            <Input
              id="customer"
              placeholder="Enter customer name"
              {...register("customer")}
            />
          </div>

          {/* Select Dropdown */}
          <div className="space-y-2">
            <Label htmlFor="status">Order Status</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Textarea */}
          <div className="space-y-2">
            <Label htmlFor="notes">Order Notes</Label>
            <Textarea
              id="notes"
              placeholder="Enter any additional notes..."
              className="min-h-[100px]"
              {...register("notes")}
            />
          </div>

          {/* Multiple Inputs in Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                placeholder="0"
                {...register("quantity")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                type="number"
                placeholder="0.00"
                {...register("price")}
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row gap-2 pt-4">
            <Button type="button" variant="outline" className="sm:order-1">
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="sm:order-2">
              Create Order
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

### Inline Filter Bar

```tsx
import { Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function FilterBar() {
  return (
    <div className="flex flex-col md:flex-row gap-3 p-4 bg-card rounded-lg border border-border">
      {/* Search */}
      <div className="flex-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search orders..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Status Filter */}
      <Select>
        <SelectTrigger className="w-full md:w-[180px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
        </SelectContent>
      </Select>

      {/* Date Filter */}
      <Select>
        <SelectTrigger className="w-full md:w-[180px]">
          <SelectValue placeholder="Date Range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="week">This Week</SelectItem>
          <SelectItem value="month">This Month</SelectItem>
        </SelectContent>
      </Select>

      {/* Filter Button */}
      <Button variant="outline">
        <Filter className="h-4 w-4 mr-2" />
        More Filters
      </Button>
    </div>
  );
}
```

---

## 🧭 Navigation Patterns

### Active State Detection

```tsx
import { Link, useLocation } from "wouter";
import { Home, ShoppingCart, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

const menuItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
  { href: "/repairs", label: "Repairs", icon: Wrench },
];

export function SidebarNav() {
  const [location] = useLocation();

  return (
    <nav className="space-y-1">
      {menuItems.map((item) => {
        const isActive = location === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center space-x-3 px-3 py-2 rounded-lg transition-all",
              isActive
                ? "bg-[#FF6600] text-white shadow-orange"
                : "text-gray-700 dark:text-gray-300 hover:bg-accent"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

---

## 💬 Modal & Dialog Usage

### Confirmation Dialog

```tsx
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function DeleteConfirmation() {
  const [open, setOpen] = useState(false);

  const handleDelete = () => {
    // Perform delete action
    setOpen(false);
  };

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4 mr-2" />
        Delete Order
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the order
              and remove all associated data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

### Form Modal

```tsx
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function NewOrderModal() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Order</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="customer">Customer Name</Label>
            <Input id="customer" placeholder="John Doe" />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="product">Product</Label>
            <Input id="product" placeholder="Product name" />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" placeholder="Additional notes..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary">
            Create Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 📊 Card Layouts

### Stats Grid

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users } from "lucide-react";

export function StatsGrid() {
  const stats = [
    {
      title: "Total Revenue",
      value: "$45,231",
      change: "+20.1%",
      trend: "up",
      icon: DollarSign,
    },
    {
      title: "Orders",
      value: "2,350",
      change: "+12.5%",
      trend: "up",
      icon: ShoppingCart,
    },
    {
      title: "Customers",
      value: "1,254",
      change: "-2.3%",
      trend: "down",
      icon: Users,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {stats.map((stat) => (
        <Card key={stat.title} className="card-interactive">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="flex items-center text-xs mt-1">
              {stat.trend === "up" ? (
                <TrendingUp className="h-3 w-3 text-success mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 text-destructive mr-1" />
              )}
              <span className={stat.trend === "up" ? "text-success" : "text-destructive"}>
                {stat.change}
              </span>
              <span className="text-muted-foreground ml-1">from last month</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### List Card with Actions

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, Eye, Edit, Trash } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function OrdersList() {
  const orders = [
    { id: "1", customer: "John Doe", amount: "$250.00", status: "completed" },
    { id: "2", customer: "Jane Smith", amount: "$180.00", status: "pending" },
    { id: "3", customer: "Bob Johnson", amount: "$420.00", status: "processing" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Orders</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {orders.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
            >
              <div className="flex-1">
                <p className="font-medium">{order.customer}</p>
                <p className="text-sm text-muted-foreground">{order.amount}</p>
              </div>
              
              <Badge
                variant={
                  order.status === "completed" ? "success" :
                  order.status === "pending" ? "warning" : "default"
                }
              >
                {order.status}
              </Badge>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="ml-2">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">
                    <Trash className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## 📱 Mobile-Responsive Patterns

### Responsive Table

```tsx
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ResponsiveOrdersTable() {
  const orders = [
    { id: "ORD-001", customer: "John Doe", amount: "$250.00", status: "completed" },
    { id: "ORD-002", customer: "Jane Smith", amount: "$180.00", status: "pending" },
  ];

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-3 text-left text-sm font-semibold">Order ID</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Customer</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Amount</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-border hover:bg-accent transition-colors">
                    <td className="px-6 py-4 text-sm font-medium">{order.id}</td>
                    <td className="px-6 py-4 text-sm">{order.customer}</td>
                    <td className="px-6 py-4 text-sm">{order.amount}</td>
                    <td className="px-6 py-4">
                      <Badge variant={order.status === "completed" ? "success" : "warning"}>
                        {order.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm">View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {orders.map((order) => (
          <Card key={order.id} className="p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-semibold">{order.id}</p>
                <p className="text-sm text-muted-foreground">{order.customer}</p>
              </div>
              <Badge variant={order.status === "completed" ? "success" : "warning"}>
                {order.status}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-lg font-bold">{order.amount}</p>
              <Button variant="outline" size="sm">View Details</Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
```

### Responsive Grid

```tsx
export function ResponsiveGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {/* Grid items */}
    </div>
  );
}
```

### Mobile Bottom Sheet

```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";

export function MobileFilterSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="md:hidden">
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh]">
        <SheetHeader>
          <SheetTitle>Filter Options</SheetTitle>
        </SheetHeader>
        <div className="py-4 space-y-4">
          {/* Filter options */}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

---

## ✅ Best Practices Checklist

- [ ] Use `PageHeader` for consistent page titles
- [ ] Orange (#FF6600) only for primary actions and active states
- [ ] All inputs have orange focus ring
- [ ] Buttons use correct variants (primary, secondary, outline, ghost, danger)
- [ ] Forms stack vertically on mobile
- [ ] Tables switch to cards on mobile
- [ ] Dialogs are full-screen or bottom sheet on small screens
- [ ] All interactive elements have `data-testid` attributes
- [ ] Text meets WCAG AA contrast standards
- [ ] Animations are smooth (200-300ms)
- [ ] Spacing follows 8px grid

---

**Need Help?** Check `DESIGN_REFINEMENTS.md` for full design system documentation.
