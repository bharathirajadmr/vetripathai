import { AppState, User } from "../types";
import { API_URL } from "../constants";

const APP_VERSION = "v1";
const STORAGE_KEY_PREFIX = `tnpsc_planner_${APP_VERSION}`;
const USERS_KEY = `tnpsc_users_${APP_VERSION}`;
const AUTH_SESSION_KEY = `tnpsc_auth_session_${APP_VERSION}`;

export function getStorageKey(email: string) {
  return `${STORAGE_KEY_PREFIX}_${email}`;
}

export async function saveState(state: AppState, email?: string, user?: User) {
  if (!state) return;

  if (!email) {
    localStorage.setItem(STORAGE_KEY_PREFIX, JSON.stringify(state));
    return;
  }

  const key = getStorageKey(email);
  localStorage.setItem(key, JSON.stringify(state));

  // Sync to backend
  try {
    await fetch(`${API_URL}/api/user/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, state, user })
    });
  } catch (e) {
    console.error("Backend sync failed", e);
  }

  // Also update the global user list with this data
  const users = getAllUsers();
  const index = users.findIndex(u => u.email === email);
  if (index > -1) {
    users[index].appData = state;
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
}

export async function syncStateFromBackend(email: string): Promise<AppState | null> {
  try {
    const res = await fetch(`${API_URL}/api/user/state?email=${encodeURIComponent(email)}`);
    const json = await res.json();
    if (json.success && json.data) {
      // Use local storage to cache the result
      localStorage.setItem(getStorageKey(email), JSON.stringify(json.data));
      return json.data;
    }
  } catch (e) {
    console.error("Backend fetch failed", e);
  }
  return null;
}

export function loadState(email?: string): AppState {
  const defaultState: AppState = {
    user: null,
    syllabus: null,
    schedule: null,
    logs: {},
    streak: 0,
    longestStreak: 0,
    level: 1,
    xp: 0,
    badges: [],
    hardTopics: [],
    lastUpdateDate: null,
    questionPapersContent: "",
    streakHistory: []
  };

  const key = email ? getStorageKey(email) : STORAGE_KEY_PREFIX;
  const saved = localStorage.getItem(key);

  if (saved) {
    return { ...defaultState, ...JSON.parse(saved) };
  }

  // If not found in specific key, try looking in user object
  if (email) {
    const user = getUserByEmail(email);
    if (user?.appData) {
      return { ...defaultState, ...user.appData };
    }
  }

  return defaultState;
}

// Global user list management
export function getAllUsers(): User[] {
  const saved = localStorage.getItem(USERS_KEY);
  let users: User[] = saved ? JSON.parse(saved) : [];

  // Seed default admin user if not exists
  if (!users.find(u => u.email === 'admin@vetripathai.pro')) {
    const adminExpiry = new Date();
    adminExpiry.setFullYear(adminExpiry.getFullYear() + 10);

    users.push({
      fullName: 'VetriPathai Admin',
      email: 'admin@vetripathai.pro',
      mobile: '9999999999',
      password: 'admin',
      subscriptionStatus: 'active',
      subscriptionExpiry: adminExpiry.toISOString(),
      deviceId: 'ADMIN_DEVICE',
      lastLoginTime: new Date().toISOString()
    });
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  return users;
}

export function saveUser(user: User) {
  const users = getAllUsers();
  const index = users.findIndex(u => u.email === user.email);
  if (index > -1) {
    users[index] = { ...users[index], ...user };
  } else {
    users.push(user);
  }
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getUserByEmail(email: string): User | undefined {
  return getAllUsers().find(u => u.email === email);
}

// Current session management
export function saveSession(user: User) {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
}

export function getSession(): User | null {
  const saved = localStorage.getItem(AUTH_SESSION_KEY);
  return saved ? JSON.parse(saved) : null;
}

export function clearSession() {
  localStorage.removeItem(AUTH_SESSION_KEY);
}
