import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, User, FacialConfig } from '@/services/api';

interface AuthContextType {
  user: (User & { facial_config?: FacialConfig; facial_required?: boolean }) | null;
  loading: boolean;
  registerStudent: (data: { fullName: string; email: string; password: string; age: number; sex: string; course: string; yearLevel: string; organizationId?: number }) => Promise<{ success: boolean; error?: string }>;
  finishRegistration: () => Promise<void>;
  loginStudent: (data: { email: string; password: string }) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: (params: { idToken?: string; email?: string; name?: string; googleId?: string }) => Promise<{ success: boolean; isNewUser?: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshFacialConfig: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        api.setToken(token);
        const response = await api.getCurrentUser();
        if (response.data) {
          setUser(response.data);
        } else {
          await api.clearToken();
          setUser(null);
        }
      } else {
        // No token stored, user not logged in yet
        setUser(null);
      }
    } catch (error) {
      console.error('Error loading user:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  const registerStudent = async ({ fullName, email, password, age, sex, course, yearLevel, organizationId }: { fullName: string; email: string; password: string; age: number; sex: string; course: string; yearLevel: string; organizationId?: number }) => {
    try {
      if (!email.toLowerCase().endsWith('@snsu.edu.ph')) {
        return { success: false, error: 'Please use your SNSU student email (@snsu.edu.ph)' };
      }

      const response = await api.register({ fullName, email, password, age, sex, course, yearLevel, organizationId });
      if (response.data) {
        await api.setToken(response.data.token);
        return { success: true };
      }
      return { success: false, error: response.error || 'Registration failed' };
    } catch {
      return { success: false, error: 'Registration failed. Please try again.' };
    }
  };

  const finishRegistration = async () => {
    const response = await api.getCurrentUser();
    if (!response.data) throw new Error(response.error || 'Could not complete registration');
    setUser(response.data);
  };

  const loginStudent = async ({ email, password }: { email: string; password: string }) => {
    try {
      const response = await api.login(email, password);
      if (response.data) {
        await api.setToken(response.data.token);
        setUser(response.data.user);
        return { success: true };
      }
      return { success: false, error: response.error || 'Invalid email or password' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed. Please try again.' };
    }
  };

  const loginWithGoogle = async (params: { idToken?: string; email?: string; name?: string; googleId?: string }) => {
    try {
      const response = await api.googleLogin(params);
      if (response.data) {
        await api.setToken(response.data.token);
        setUser(response.data.user);
        return { success: true, isNewUser: response.data.user.is_new_user };
      }
      return { success: false, error: response.error || 'Google login failed' };
    } catch (error) {
      console.error('Google login error:', error);
      return { success: false, error: 'Google login failed. Please try again.' };
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await api.clearToken();
      setUser(null);
    }
  };

  const refreshFacialConfig = async () => {
    try {
      const facialResp = await api.getFacialConfig();
      if (facialResp.data) {
        setUser((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            facial_config: facialResp.data!.facial_config,
            facial_required: facialResp.data!.is_required,
          };
        });
      }
    } catch (error) {
      console.error('Refresh facial config error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, registerStudent, finishRegistration, loginStudent, loginWithGoogle, logout, refreshFacialConfig }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
