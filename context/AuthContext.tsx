
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import * as storage from '../services/storage';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (userData: Partial<User>) => Promise<void>;
  resetPassword: (email: string, newPassword: string) => Promise<void>;
  upgradeSubscription: (plan?: string) => Promise<void>;
  activateWithCode: (code: string) => Promise<void>;
  logout: (reason?: 'manual' | 'expiry' | 'conflict') => void;
  logoutReason: 'manual' | 'expiry' | 'conflict' | null;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(storage.getSession());
  const [error, setError] = useState<string | null>(null);
  const [logoutReason, setLogoutReason] = useState<'manual' | 'expiry' | 'conflict' | null>(null);

  // Session handling on refresh
  useEffect(() => {
    const session = storage.getSession();
    if (session) {
      const lastLogin = new Date(session.lastLoginTime).getTime();
      const now = new Date().getTime();
      const hoursDiff = (now - lastLogin) / (1000 * 60 * 60);

      if (hoursDiff > 24) {
        logout('expiry');
      } else {
        // Double check device conflict
        const globalUser = storage.getUserByEmail(session.email);
        if (globalUser && globalUser.deviceId !== session.deviceId) {
          logout('conflict');
        }
      }
    }
  }, []);

  const login = async (email: string, pass: string) => {
    setError(null);
    try {
      const user = await storage.loginBackend(email, pass);
      storage.saveSession(user);
      setCurrentUser(user);
    } catch (e: any) {
      throw new Error(e.message || "Invalid email or password");
    }
  };

  const signup = async (userData: Partial<User>) => {
    setError(null);
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);

    const newUser: User = {
      fullName: userData.fullName!,
      email: userData.email!,
      mobile: userData.mobile!,
      password: userData.password!,
      subscriptionStatus: 'trial',
      subscriptionExpiry: expiry.toISOString(),
      deviceId: Math.random().toString(36).substr(2, 9),
      lastLoginTime: new Date().toISOString()
    };

    try {
      const savedUser = await storage.signupBackend(newUser);
      storage.saveSession(savedUser);
      setCurrentUser(savedUser);
    } catch (e: any) {
      throw new Error(e.message || "Signup failed");
    }
  };

  const resetPassword = async (email: string, newPass: string) => {
    setError(null);
    try {
      await storage.resetPasswordBackend(email, newPass);
      // If resetting for current user (though usually logged out)
      if (currentUser?.email === email) {
        const updatedUser = { ...currentUser, password: newPass };
        storage.saveSession(updatedUser);
        setCurrentUser(updatedUser);
      }
    } catch (e: any) {
      throw new Error(e.message || "Reset failed");
    }
  };

  const upgradeSubscription = async (plan: string = 'Gold Pro') => {
    if (!currentUser) return;

    const expiry = new Date();
    if (plan.includes('year') || plan === 'Gold Pro') {
      expiry.setFullYear(expiry.getFullYear() + 1);
    } else {
      expiry.setMonth(expiry.getMonth() + 1);
    }

    const updatedUser: User = {
      ...currentUser,
      subscriptionStatus: 'active',
      subscriptionExpiry: expiry.toISOString()
    };

    try {
      await storage.updateUserBackend(updatedUser);
      storage.saveSession(updatedUser);
      setCurrentUser(updatedUser);
    } catch (e: any) {
      console.error("Subscription update failed on backend", e);
      // Fallback: save local only if network fails? 
      // Better to maintain consistency: throw error.
    }
  };

  const activateWithCode = async (code: string) => {
    if (!currentUser) return;

    const formattedCode = code.trim().toUpperCase();
    const validCodes = ['VETRI-PRO-2026', 'ADMIN-ACTIVATE', 'OFFICER-PRO'];

    if (validCodes.includes(formattedCode)) {
      await upgradeSubscription('Gold Pro');
    } else {
      throw new Error("Invalid activation code");
    }
  };

  const logout = (reason: 'manual' | 'expiry' | 'conflict' = 'manual') => {
    storage.clearSession();
    setCurrentUser(null);
    setLogoutReason(reason);
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      isAuthenticated: !!currentUser,
      login,
      signup,
      resetPassword,
      upgradeSubscription,
      activateWithCode,
      logout,
      error,
      logoutReason
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
