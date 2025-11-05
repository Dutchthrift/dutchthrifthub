import { Link, useLocation } from "wouter";
import { Camera, Home, Inbox, ShoppingCart, Package2, Wrench, CheckSquare, BarChart3, Briefcase, Search, Bell, ChevronDown, Settings, Users, Menu, X } from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
          {/* Mobile Menu Button */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden mr-2"
                data-testid="mobile-menu-button"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:w-[400px]">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="mt-6 flex flex-col space-y-1">
                {navigationItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center space-x-3 text-sm font-medium px-4 py-3 rounded-md transition-colors",
                      location === item.href
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                    data-testid={`mobile-nav-link-${item.label.toLowerCase().replace(/[''\s]/g, '-')}`}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                    {item.badge && (
                      <Badge variant="default" className="ml-auto h-5 w-5 justify-center p-0 text-xs">
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                ))}
                
                {/* Admin Links in Mobile Menu */}
                {user?.role === "ADMIN" && (
                  <>
                    <div className="my-4 border-t border-border" />
                    <Link
                      href="/users"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center space-x-3 text-sm font-medium px-4 py-3 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      data-testid="mobile-nav-users"
                    >
                      <Users className="h-5 w-5" />
                      <span>User Management</span>
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center space-x-3 text-sm font-medium px-4 py-3 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      data-testid="mobile-nav-settings"
                    >
                      <Settings className="h-5 w-5" />
                      <span>Settings</span>
                    </Link>
                  </>
                )}

                {/* Theme Options in Mobile Menu */}
                <div className="my-4 border-t border-border" />
                <div className="px-4 py-2 text-xs font-semibold text-muted-foreground">
                  Theme
                </div>
                <button
                  onClick={() => {
                    setTheme("light");
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center space-x-3 text-sm font-medium px-4 py-3 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors w-full text-left"
                  data-testid="mobile-theme-light"
                >
                  Light Theme
                </button>
                <button
                  onClick={() => {
                    setTheme("dark");
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center space-x-3 text-sm font-medium px-4 py-3 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors w-full text-left"
                  data-testid="mobile-theme-dark"
                >
                  Dark Theme
                </button>
                <button
                  onClick={() => {
                    setTheme("system");
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center space-x-3 text-sm font-medium px-4 py-3 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors w-full text-left"
                  data-testid="mobile-theme-system"
                >
                  System Theme
                </button>

                {/* Logout in Mobile Menu */}
                <div className="my-4 border-t border-border" />
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center space-x-3 text-sm font-medium px-4 py-3 rounded-md text-destructive hover:bg-destructive/10 transition-colors w-full text-left"
                  data-testid="mobile-logout"
                >
                  Logout
                </button>
              </div>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2" data-testid="logo-link">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Camera className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold text-foreground hidden sm:inline">DutchThrift</span>
            </Link>
          </div>

          {/* Desktop Navigation Items - Hidden on mobile */}
          <div className="ml-8 hidden lg:flex items-center space-x-6">
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
          <div className="ml-auto flex items-center space-x-2 sm:space-x-4">
            {/* Search - Hidden on small mobile */}
            <div className="hidden sm:block">
              <GlobalSearch />
            </div>

            {/* Admin Dropdown - Only visible to ADMIN users on desktop */}
            {user?.role === "ADMIN" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild data-testid="admin-menu-trigger">
                  <Button variant="ghost" size="sm" className="hidden lg:flex items-center space-x-2">
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

            {/* User Menu - Desktop */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild data-testid="user-menu-trigger">
                <Button variant="ghost" className="flex items-center space-x-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{getUserInitials()}</AvatarFallback>
                  </Avatar>
                  <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:block" />
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
