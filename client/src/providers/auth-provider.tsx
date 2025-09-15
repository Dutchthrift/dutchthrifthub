import { useState, useEffect, ReactNode } from "react";
import { AuthContext, AuthUser, authApi } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
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
        title: "Sign in failed",
        description: error,
        variant: "destructive",
      });
      return { error };
    }

    if (user) {
      setUser(user);
      toast({
        title: "Welcome back!",
        description: `Signed in as ${user.firstName || user.email}`,
      });
    }

    return {};
  };

  const signOut = async () => {
    const { error } = await authApi.signOut();
    
    if (error) {
      toast({
        title: "Sign out failed",
        description: error,
        variant: "destructive",
      });
    } else {
      setUser(null);
      toast({
        title: "Signed out",
        description: "You have been signed out successfully",
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