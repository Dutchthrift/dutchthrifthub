import { useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";
import { AuthContext, AuthUser, authApi } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    setLoading(true);
    try {
      const { user, error } = await authApi.getSession();
      if (error) {
        console.error("Session check error:", error);
        setUser(null);
      } else {
        setUser(user || null);
      }
    } catch (error) {
      console.error("Session check failed:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { user, error } = await authApi.signIn(email, password);

    if (error) {
      toast({
        title: "Inloggen mislukt",
        description: error,
        variant: "destructive",
      });
      return { error };
    }

    if (user) {
      setUser(user);
      toast({
        title: "Welkom terug!",
        description: `Ingelogd als ${user.firstName || user.email}`,
      });

      // Redirect based on role
      if (user.role === "TECHNICUS") {
        setLocation("/repairs");
      } else {
        setLocation("/");
      }
    }

    return {};
  };

  const signOut = async () => {
    const { error } = await authApi.signOut();

    if (error) {
      toast({
        title: "Uitloggen mislukt",
        description: error,
        variant: "destructive",
      });
    } else {
      setUser(null);
      toast({
        title: "Uitgelogd",
        description: "Je bent succesvol uitgelogd",
      });
    }
  };

  const refreshSession = async () => {
    await checkSession();
  };

  const value = {
    user,
    loading,
    signIn,
    signOut,
    refreshSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}