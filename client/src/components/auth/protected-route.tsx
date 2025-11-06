import { useAuth } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { ComponentType, useEffect } from "react";
import { useLocation } from "wouter";

interface ProtectedRouteProps {
  component: ComponentType<any>;
  roles?: string[];
  [key: string]: any;
}

export default function ProtectedRoute({ component: Component, roles = [], ...props }: ProtectedRouteProps) {
  const { user, loading: isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Auto-redirect TECHNICUS users if they try to access unauthorized pages
  useEffect(() => {
    if (!isLoading && user && roles.length > 0 && !roles.includes(user.role)) {
      if (user.role === "TECHNICUS") {
        setLocation("/repairs");
      }
    }
  }, [user, roles, setLocation, isLoading]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground">DutchThrift Admin</h1>
            <p className="text-muted-foreground mt-2">Sign in to continue</p>
          </div>
          <LoginForm />
        </div>
      </div>
    );
  }

  // Show access denied for non-TECHNICUS users without proper roles
  if (roles.length > 0 && !roles.includes(user.role)) {
    // TECHNICUS users get redirected above, so this only affects other unauthorized users
    if (user.role !== "TECHNICUS") {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-4">Access Denied</h2>
            <p className="text-muted-foreground mb-4">
              You don't have permission to access this page.
            </p>
            <p className="text-sm text-muted-foreground">
              Required roles: {roles.join(", ")}
            </p>
          </div>
        </div>
      );
    }
    // For TECHNICUS, show loading while redirect happens
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Render the protected component
  return <Component {...props} />;
}