import { useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { authService } from "@/services/auth";
import type { User } from "@/types/auth";
import { AuthContext } from "./auth-context";
import { api } from "@/lib/api";
import { preferencesService, type UserPreferences } from "@/services/preferences";

// Re-export AuthContext for backward compatibility
export { AuthContext };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPreferences = useCallback(async () => {
    try {
      const response = await api.get<UserPreferences>("/profile/preferences");
      if (response.data) {
        preferencesService.save(response.data);
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const { user: currentUser, error } = await authService.getCurrentUser();
      if (currentUser && !error) {
        setUser(currentUser);
        // Load preferences after successful auth check
        await loadPreferences();
      } else {
        setUser(null);
        preferencesService.clear();
      }
    } catch (error) {
      console.error('Authentication check failed:', error);
      setUser(null);
      preferencesService.clear();
    } finally {
      setLoading(false);
    }
  }, [loadPreferences]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email: string, password: string) => {
    const { user: loggedInUser, error } = await authService.login({ email, password });
    
    if (error) {
      return { error };
    }
    
    if (loggedInUser) {
      setUser(loggedInUser);
      // Load preferences after successful login
      await loadPreferences();
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
      // Load preferences after successful registration
      await loadPreferences();
    }
    
    return {};
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    // Clear preferences from localStorage on logout
    preferencesService.clear();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}


