import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { authService } from "@/services/auth";
import type { User } from "@/types/auth";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  register: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

