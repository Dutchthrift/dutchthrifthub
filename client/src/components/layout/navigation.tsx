import { Link, useLocation } from "wouter";
import { Camera, Home, Inbox, ShoppingCart, Package2, Wrench, CheckSquare, BarChart3, Briefcase, Search, Bell, ChevronDown, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/use-theme";
import { GlobalSearch } from "@/components/search/global-search";
import { CommandPalette } from "@/components/search/command-palette";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

const navigationItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/inbox", label: "Inbox", icon: Inbox, badge: 3 },
  { href: "/cases", label: "Cases", icon: Briefcase },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
  { href: "/purchase-orders", label: "Inkoop Orders", icon: Package2 },
  { href: "/repairs", label: "Repairs", icon: Wrench },
  { href: "/todos", label: "To-do's", icon: CheckSquare },
];

export function Navigation() {
  const [location] = useLocation();
  const { setTheme } = useTheme();
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const { signOut, user } = useAuth();

  const handleLogout = async () => {
    await signOut();
  };

  const getUserInitials = () => {
    if (!user) return "??";
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user.firstName) {
      return user.firstName[0].toUpperCase();
    }
    if (user.email) {
      return user.email[0].toUpperCase();
    }
    return "??";
  };

  return (
    <>
      <nav className="border-b border-border bg-card" data-testid="main-navigation">
        <div className="flex h-16 items-center px-4">
          {/* Logo */}
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2" data-testid="logo-link">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Camera className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold text-foreground">DutchThrift</span>
            </Link>
          </div>

          {/* Navigation Items */}
          <div className="ml-8 flex items-center space-x-6">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center space-x-2 text-sm font-medium px-3 py-2 rounded-md transition-colors",
                  location === item.href
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
                data-testid={`nav-link-${item.label.toLowerCase().replace(/[''\s]/g, '-')}`}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
                {item.badge && (
                  <Badge variant="default" className="ml-1 h-5 w-5 justify-center p-0 text-xs">
                    {item.badge}
                  </Badge>
                )}
              </Link>
            ))}
          </div>

          {/* Right Side */}
          <div className="ml-auto flex items-center space-x-4">
            {/* Search */}
            <GlobalSearch />

            {/* Admin Dropdown - Only visible to ADMIN users */}
            {user?.role === "ADMIN" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild data-testid="admin-menu-trigger">
                  <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                    <Settings className="h-4 w-4" />
                    <span className="text-sm">Admin</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" data-testid="admin-menu-content">
                  <DropdownMenuItem asChild data-testid="admin-menu-users">
                    <Link href="/users" className="flex items-center cursor-pointer">
                      <Users className="h-4 w-4 mr-2" />
                      User Management
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild data-testid="admin-menu-settings">
                    <Link href="/settings" className="flex items-center cursor-pointer">
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Notifications */}
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              data-testid="notifications-button"
            >
              <Bell className="h-5 w-5" />
              <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 justify-center p-0 text-xs">
                2
              </Badge>
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild data-testid="user-menu-trigger">
                <Button variant="ghost" className="flex items-center space-x-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{getUserInitials()}</AvatarFallback>
                  </Avatar>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" data-testid="user-menu-content">
                <DropdownMenuItem data-testid="user-menu-profile">
                  Profile Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setTheme("light")} data-testid="user-menu-light-theme">
                  Light Theme
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")} data-testid="user-menu-dark-theme">
                  Dark Theme
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")} data-testid="user-menu-system-theme">
                  System Theme
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} data-testid="user-menu-logout">
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>

      <CommandPalette 
        open={showCommandPalette} 
        onOpenChange={setShowCommandPalette}
      />
    </>
  );
}
