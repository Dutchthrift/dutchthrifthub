import { Link, useLocation } from "wouter";
import {
  Home,
  Inbox,
  ShoppingCart,
  Wrench,
  CheckSquare,
  BarChart3,
  Camera,
  Settings,
  LogOut,
  User,
  Bell,
  Search,
  Package
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navigationItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/inbox", label: "Inbox", icon: Inbox, badge: 3 },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
  { href: "/repairs", label: "Reparaties", icon: Wrench },
  { href: "/returns", label: "Retouren", icon: Package },
  { href: "/todos", label: "To-do's", icon: CheckSquare },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const [location] = useLocation();
  // Use local logo or fallback to generated SVG
  const smallLogoUrl = "/logo.svg";

  return (
    <div
      className={cn(
        "flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
      data-testid="sidebar"
    >
      {/* Logo */}
      <div className="p-4">
        <Link href="/" className="flex items-center space-x-2" data-testid="sidebar-logo">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden">
            <img
              src={smallLogoUrl}
              alt="DutchThrift"
              className="h-full w-full object-cover"
            />
          </div>
          {!collapsed && (
            <span className="text-lg font-semibold text-sidebar-foreground">DutchThrift</span>
          )}
        </Link>
      </div>

      <Separator />

      {/* Navigation Items */}
      <nav className="flex-1 p-2">
        <div className="space-y-1">
          {navigationItems.map((item) => {
            const isActive = location === item.href;

            const content = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center space-x-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                data-testid={`sidebar-link-${item.label.toLowerCase().replace(/[''\s]/g, '-')}`}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <Badge
                        variant="default"
                        className="ml-auto h-5 w-5 justify-center p-0 text-xs"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </>
                )}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    {content}
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <div className="flex items-center space-x-2">
                      <span>{item.label}</span>
                      {item.badge && (
                        <Badge variant="default" className="h-4 w-4 justify-center p-0 text-xs">
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return content;
          })}
        </div>
      </nav>

      <Separator />

      {/* User Section */}
      <div className="p-2">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-center p-2"
                data-testid="sidebar-user-collapsed"
              >
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">JD</AvatarFallback>
                </Avatar>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <span>John Doe</span>
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center space-x-3 rounded-md px-3 py-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  John Doe
                </p>
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  Admin
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <Button
                variant="ghost"
                className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
                data-testid="sidebar-settings"
              >
                <Settings className="mr-3 h-4 w-4" />
                Settings
              </Button>

              <Button
                variant="ghost"
                className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
                data-testid="sidebar-logout"
              >
                <LogOut className="mr-3 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
