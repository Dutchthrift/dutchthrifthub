import { createContext, useContext } from "react";
import { User } from "@shared/schema";

export interface AuthUser {
  id: string;
  email: string;
  role: "ADMIN" | "SUPPORT" | "TECHNICUS";
  firstName?: string;
  lastName?: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Auth service functions
export const authApi = {
  async signIn(email: string, password: string): Promise<{ user?: AuthUser; error?: string }> {
    try {
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || "Sign in failed" };
      }

      return { user: data.user };
    } catch (error) {
      return { error: "Network error. Please try again." };
    }
  },

  async signOut(): Promise<{ error?: string }> {
    try {
      const response = await fetch("/api/auth/signout", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        return { error: data.error || "Sign out failed" };
      }

      return {};
    } catch (error) {
      return { error: "Network error. Please try again." };
    }
  },

  async getSession(): Promise<{ user?: AuthUser; error?: string }> {
    try {
      const response = await fetch("/api/auth/session");

      if (!response.ok) {
        if (response.status === 401) {
          return {}; // No session
        }
        const data = await response.json();
        return { error: data.error || "Session check failed" };
      }

      const data = await response.json();
      return { user: data.user };
    } catch (error) {
      return { error: "Network error. Please try again." };
    }
  },
};

// Role-based access control utilities
export const rbac = {
  hasRole(user: AuthUser | null, roles: string[]): boolean {
    if (!user) return false;
    return roles.includes(user.role);
  },

  isAdmin(user: AuthUser | null): boolean {
    return user?.role === "ADMIN";
  },

  canAccessUsers(user: AuthUser | null): boolean {
    return this.hasRole(user, ["ADMIN"]);
  },

  canAccessReparaties(user: AuthUser | null): boolean {
    return this.hasRole(user, ["ADMIN", "TECHNICUS"]);
  },

  canAccessCases(user: AuthUser | null): boolean {
    return this.hasRole(user, ["ADMIN", "SUPPORT"]);
  },

  canAccessInbox(user: AuthUser | null): boolean {
    return this.hasRole(user, ["ADMIN", "SUPPORT"]);
  },

  getRoleDisplayName(role: string): string {
    const roleMap = {
      ADMIN: "Beheerder",
      SUPPORT: "Support",
      TECHNICUS: "Technicus",
    };
    return roleMap[role as keyof typeof roleMap] || role;
  },
};