import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, User, FacialConfig } from '@/services/api';

interface AuthContextType {
  user: (User & { facial_config?: FacialConfig; facial_required?: boolean }) | null;
  loading: boolean;
  registerStudent: (data: { fullName: string; email: string; password: string; age?: number; sex?: string; courseId: number; yearLevel: string; organizationId: number }) => Promise<{ success: boolean; error?: string }>;
  finishRegistration: () => Promise<void>;
  completeProfileSetup: (data: { password?: string; fullName: string; studentId?: string; age?: number; sex?: string; courseId: number; yearLevel: string; organizationId: number }) => Promise<{ success: boolean; error?: string }>;
  loginStudent: (data: { email: string; password: string }) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: (params: { idToken?: string; email?: string; name?: string; googleId?: string }) => Promise<{ success: boolean; isNewUser?: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshFacialConfig: () => Promise<void>;
  updateProfile: (data: { name?: string; student_id?: string; age?: number; sex?: string; course?: string }) => Promise<{ success: boolean; error?: string }>;
  updateProfilePicture: (base64Image: string) => Promise<{ success: boolean; error?: string }>;
  removeProfilePicture: () => Promise<{ success: boolean; error?: string }>;
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

  const registerStudent = async ({ fullName, email, password, age, sex, courseId, yearLevel, organizationId }: { fullName: string; email: string; password: string; age?: number; sex?: string; courseId: number; yearLevel: string; organizationId: number }) => {
    try {
      if (!email.toLowerCase().endsWith('@snsu.edu.ph')) {
        return { success: false, error: 'Please use your SNSU student email (@snsu.edu.ph)' };
      }

      const response = await api.register({ fullName, email, password, age, sex, courseId, yearLevel, organizationId });
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

  const completeProfileSetup = async (data: { password?: string; fullName: string; studentId?: string; age?: number; sex?: string; courseId: number; yearLevel: string; organizationId: number }) => {
    try {
      const response = await api.setupProfile(data);
      if (response.data?.user && !response.error) {
        setUser(response.data.user);
        return { success: true };
      }
      return { success: false, error: response.error || 'Failed to save profile' };
    } catch (error: any) {
      console.error('Setup profile error:', error);
      return { success: false, error: error?.message || 'Failed to save profile. Please try again.' };
    }
  };

  const loginStudent = async ({ email, password }: { email: string; password: string }) => {
    try {
      const response = await api.login(email, password);
      if (response.data?.token && response.data?.user && !response.error) {
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
      if (response.data?.token && response.data?.user && !response.error) {
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

  const updateProfile = async (data: { name?: string; student_id?: string; age?: number; sex?: string; course?: string }) => {
    try {
      const response = await api.updateProfile(data);
      if (response.data?.user && !response.error) {
        setUser((prev) => {
          if (!prev) return response.data!.user;
          return {
            ...prev,
            ...response.data!.user,
          };
        });
        return { success: true };
      }
      return { success: false, error: response.error || 'Failed to update profile' };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Failed to update profile' };
    }
  };

  const updateProfilePicture = async (base64Image: string) => {
    try {
      const response = await api.updateProfilePicture(base64Image);
      if (response.data?.user && !response.error) {
        setUser((prev) => {
          if (!prev) return response.data!.user;
          return {
            ...prev,
            ...response.data!.user,
          };
        });
        return { success: true };
      }
      return { success: false, error: response.error || 'Failed to update profile picture' };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Failed to update profile picture' };
    }
  };

  const removeProfilePicture = async () => {
    try {
      const response = await api.removeProfilePicture();
      if (response.data?.user && !response.error) {
        setUser((prev) => {
          if (!prev) return response.data!.user;
          return {
            ...prev,
            ...response.data!.user,
          };
        });
        return { success: true };
      }
      return { success: false, error: response.error || 'Failed to remove profile picture' };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Failed to remove profile picture' };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, registerStudent, finishRegistration, completeProfileSetup, loginStudent, loginWithGoogle, logout, refreshFacialConfig, updateProfile, updateProfilePicture, removeProfilePicture }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
