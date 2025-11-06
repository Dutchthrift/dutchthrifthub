import { Link, useLocation } from "wouter";
import { Camera, Home, Inbox, ShoppingCart, Package2, Wrench, CheckSquare, BarChart3, Briefcase, Search, Bell, ChevronDown, Settings, Users, Menu, X, Sun, Moon, Monitor } from "lucide-react";
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
  SheetClose,
} from "@/components/ui/sheet";
import { useTheme } from "@/hooks/use-theme";
import { GlobalSearch } from "@/components/search/global-search";
import { CommandPalette } from "@/components/search/command-palette";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

const navigationItems = [
  { href: "/", label: "Home", icon: Home, roles: ["ADMIN", "SUPPORT"] },
  { href: "/inbox", label: "Inbox", icon: Inbox, badge: 3, roles: ["ADMIN", "SUPPORT"] },
  { href: "/cases", label: "Cases", icon: Briefcase, roles: ["ADMIN", "SUPPORT"] },
  { href: "/orders", label: "Orders", icon: ShoppingCart, roles: ["ADMIN", "SUPPORT"] },
  { href: "/purchase-orders", label: "Inkoop Orders", icon: Package2, roles: ["ADMIN", "SUPPORT"] },
  { href: "/repairs", label: "Repairs", icon: Wrench, roles: ["ADMIN", "SUPPORT", "TECHNICUS"] },
  { href: "/todos", label: "To-do's", icon: CheckSquare, roles: ["ADMIN", "SUPPORT"] },
];

export function Navigation() {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { signOut, user } = useAuth();
  const smallLogoUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/extra-files/dutchthrift-logo-small.jpg`;

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
      <nav className="sticky top-0 z-50 border-b border-border bg-card shadow-soft" data-testid="main-navigation">
        <div className="flex h-16 items-center px-4 gap-4">
          {/* Mobile Menu Button */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                data-testid="mobile-menu-button"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 sidebar-glass border-r border-border">
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="p-4 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="h-8 w-8 rounded-lg overflow-hidden">
                        <img 
                          src={smallLogoUrl} 
                          alt="DutchThrift" 
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <span className="text-lg font-semibold">DutchThrift</span>
                    </div>
                    <SheetClose asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <X className="h-4 w-4" />
                      </Button>
                    </SheetClose>
                  </div>
                </div>

                {/* Navigation Items */}
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
                  {navigationItems
                    .filter((item) => !user?.role || item.roles.includes(user.role))
                    .map((item) => {
                      const isActive = location === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 font-medium text-sm",
                            isActive
                              ? "bg-[#FF6600] text-white shadow-orange"
                              : "text-gray-700 dark:text-gray-300 hover:bg-accent hover:text-foreground"
                          )}
                          data-testid={`mobile-nav-link-${item.label.toLowerCase().replace(/[''\s]/g, '-')}`}
                        >
                          <item.icon className="h-5 w-5 flex-shrink-0" />
                          <span className="flex-1">{item.label}</span>
                          {item.badge && (
                            <Badge variant={isActive ? "secondary" : "default"} className="h-5 px-2 text-xs">
                              {item.badge}
                            </Badge>
                          )}
                        </Link>
                      );
                    })}
                  
                  {/* Admin Links */}
                  {user?.role === "ADMIN" && (
                    <>
                      <div className="my-3 border-t border-border/50" />
                      <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Admin
                      </p>
                      <Link
                        href="/users"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-accent hover:text-foreground transition-all"
                        data-testid="mobile-nav-users"
                      >
                        <Users className="h-5 w-5" />
                        <span>User Management</span>
                      </Link>
                      <Link
                        href="/settings"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-accent hover:text-foreground transition-all"
                        data-testid="mobile-nav-settings"
                      >
                        <Settings className="h-5 w-5" />
                        <span>Settings</span>
                      </Link>
                    </>
                  )}
                </nav>

                {/* Footer with Theme Selector */}
                <div className="border-t border-border/50 p-3 space-y-2">
                  <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Theme
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant={theme === "light" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTheme("light")}
                      className="flex-1"
                      data-testid="mobile-theme-light"
                    >
                      <Sun className="h-4 w-4 mr-2" />
                      Light
                    </Button>
                    <Button
                      variant={theme === "dark" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTheme("dark")}
                      className="flex-1"
                      data-testid="mobile-theme-dark"
                    >
                      <Moon className="h-4 w-4 mr-2" />
                      Dark
                    </Button>
                  </div>
                  <Button
                    variant={theme === "system" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("system")}
                    className="w-full"
                    data-testid="mobile-theme-system"
                  >
                    <Monitor className="h-4 w-4 mr-2" />
                    System
                  </Button>
                  
                  <div className="pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        handleLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full text-destructive hover:bg-destructive/10"
                      data-testid="mobile-logout"
                    >
                      Logout
                    </Button>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2" data-testid="logo-link">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden">
                <img 
                  src={smallLogoUrl} 
                  alt="DutchThrift" 
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="text-lg font-semibold text-foreground hidden sm:inline">DutchThrift</span>
            </Link>
          </div>

          {/* Desktop Navigation Items */}
          <div className="ml-4 hidden lg:flex items-center gap-1 flex-1">
            {navigationItems
              .filter((item) => !user?.role || item.roles.includes(user.role))
              .map((item) => {
                const isActive = location === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
                      isActive
                        ? "bg-[#FF6600] text-white shadow-orange"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                    data-testid={`nav-link-${item.label.toLowerCase().replace(/[''\s]/g, '-')}`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                    {item.badge && (
                      <Badge variant={isActive ? "secondary" : "default"} className="h-5 px-2 text-xs">
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                );
              })}
          </div>

          {/* Right Section */}
          <div className="ml-auto flex items-center gap-2">
            {/* Search Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowCommandPalette(true)}
              className="hidden sm:inline-flex"
              data-testid="search-button"
            >
              <Search className="h-4 w-4" />
            </Button>

            {/* Notifications */}
            <Button
              variant="ghost"
              size="icon"
              className="relative hidden sm:inline-flex"
              data-testid="notifications-button"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[#FF6600]" />
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center space-x-2 h-10"
                  data-testid="user-menu-button"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs font-semibold">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline text-sm font-medium">{user?.firstName || 'User'}</span>
                  <ChevronDown className="h-4 w-4 hidden md:inline" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {user?.role === "ADMIN" && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/users" className="flex items-center cursor-pointer" data-testid="dropdown-users">
                        <Users className="mr-2 h-4 w-4" />
                        <span>User Management</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className="flex items-center cursor-pointer" data-testid="dropdown-settings">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                
                {/* Theme Selector */}
                <div className="px-2 py-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                    Theme
                  </p>
                  <div className="flex flex-col gap-1">
                    <Button
                      variant={theme === "light" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setTheme("light")}
                      className="w-full justify-start"
                      data-testid="dropdown-theme-light"
                    >
                      <Sun className="h-4 w-4 mr-2" />
                      Light
                    </Button>
                    <Button
                      variant={theme === "dark" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setTheme("dark")}
                      className="w-full justify-start"
                      data-testid="dropdown-theme-dark"
                    >
                      <Moon className="h-4 w-4 mr-2" />
                      Dark
                    </Button>
                    <Button
                      variant={theme === "system" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setTheme("system")}
                      className="w-full justify-start"
                      data-testid="dropdown-theme-system"
                    >
                      <Monitor className="h-4 w-4 mr-2" />
                      System
                    </Button>
                  </div>
                </div>
                
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive cursor-pointer"
                  data-testid="dropdown-logout"
                >
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>

      {/* Command Palette */}
      <CommandPalette open={showCommandPalette} onOpenChange={setShowCommandPalette} />
    </>
  );
}
