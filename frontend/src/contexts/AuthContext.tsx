import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { authService } from "@/services/auth";
import type { User } from "@/types/auth";
import { AuthContext } from "./auth-context";

// Re-export AuthContext for backward compatibility
export { AuthContext };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const { user: currentUser, error } = await authService.getCurrentUser();
      if (currentUser && !error) {
        setUser(currentUser);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Authentication check failed:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const { user: loggedInUser, error } = await authService.login({ email, password });
    
    if (error) {
      return { error };
    }
    
    if (loggedInUser) {
      setUser(loggedInUser);
    }
    
    return {};
  };

  const register = async (email: string, password: string) => {
    const { user: registeredUser, error } = await authService.register({ email, password });
    
    if (error) {
      return { error };
    }
    
    if (registeredUser) {
      setUser(registeredUser);
    }
    
    return {};
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}


