
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import * as storage from '../services/storage';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (userData: Partial<User>) => Promise<void>;
  upgradeSubscription: () => Promise<void>;
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
    const user = storage.getUserByEmail(email);

    if (!user || user.password !== pass) {
      throw new Error("Invalid email or password");
    }

    const updatedUser: User = {
      ...user,
      lastLoginTime: new Date().toISOString(),
      // In a real app, this deviceId would come from fingerprinting or browser ID
      deviceId: Math.random().toString(36).substr(2, 9)
    };

    storage.saveUser(updatedUser);
    storage.saveSession(updatedUser);
    setCurrentUser(updatedUser);
  };

  const signup = async (userData: Partial<User>) => {
    setError(null);
    const existing = storage.getUserByEmail(userData.email!);
    if (existing) {
      throw new Error("Email already registered");
    }

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

    storage.saveUser(newUser);
    storage.saveSession(newUser);
    setCurrentUser(newUser);
  };

  const upgradeSubscription = async () => {
    if (!currentUser) return;

    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 1); // 1 year extension

    const updatedUser: User = {
      ...currentUser,
      subscriptionStatus: 'active',
      subscriptionExpiry: expiry.toISOString()
    };

    storage.saveUser(updatedUser);
    storage.saveSession(updatedUser);
    setCurrentUser(updatedUser);
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
      upgradeSubscription,
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
