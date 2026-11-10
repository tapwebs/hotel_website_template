import { create } from 'zustand';
import { UserSession, Role, Permission } from '../types/auth';
import { API_BASE_URL, invalidateApiCache } from '../services/apiServices';

const TOKEN_KEY = 'hms_token';

interface AuthState {
  session: UserSession | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  initializeSession: () => Promise<void>;
  login: (usernameOrEmail: string, password: string) => Promise<boolean>;
  logout: () => void;
  switchProperty: (propertyId: string) => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  token: localStorage.getItem(TOKEN_KEY),
  isAuthenticated: false,
  isInitialized: false,
  isLoading: false,
  error: null,

  initializeSession: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      set({ session: null, token: null, isAuthenticated: false, isInitialized: true, isLoading: false });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE_URL}/auth/session`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        const session: UserSession = await res.json();
        set({
          session,
          token,
          isAuthenticated: true,
          isInitialized: true,
          isLoading: false,
          error: null
        });
      } else {
        localStorage.removeItem(TOKEN_KEY);
        set({
          session: null,
          token: null,
          isAuthenticated: false,
          isInitialized: true,
          isLoading: false,
          error: null
        });
      }
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      set({
        session: null,
        token: null,
        isAuthenticated: false,
        isInitialized: true,
        isLoading: false
      });
    }
  },

  login: async (usernameOrEmail: string, password: string): Promise<boolean> => {
    set({ isLoading: true, error: null });
    try {
      const loginRes = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username_or_email: usernameOrEmail,
          password
        })
      });

      if (!loginRes.ok) {
        const errData = await loginRes.json().catch(() => ({ detail: 'Invalid credentials' }));
        const errorMessage = typeof errData.detail === 'string' ? errData.detail : 'Invalid username or password.';
        set({
          session: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: errorMessage
        });
        return false;
      }

      const tokenData = await loginRes.json();
      const accessToken = tokenData.access_token;
      localStorage.setItem(TOKEN_KEY, accessToken);

      // Fetch user session with backend-authoritative permissions
      const sessionRes = await fetch(`${API_BASE_URL}/auth/session`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!sessionRes.ok) {
        localStorage.removeItem(TOKEN_KEY);
        set({
          session: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: 'Failed to retrieve session after login.'
        });
        return false;
      }

      const session: UserSession = await sessionRes.json();
      set({
        session,
        token: accessToken,
        isAuthenticated: true,
        isInitialized: true,
        isLoading: false,
        error: null
      });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login network failure';
      set({
        session: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: msg
      });
      return false;
    }
  },

  logout: () => {
    invalidateApiCache();
    localStorage.removeItem(TOKEN_KEY);
    set({
      session: null,
      token: null,
      isAuthenticated: false,
      isInitialized: true,
      error: null
    });
  },

  switchProperty: async (propertyId: string) => {
    const current = get().session;
    const token = get().token || localStorage.getItem(TOKEN_KEY);
    if (!current || !token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/auth/switch-property`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ property_id: propertyId })
      });
      if (res.ok) {
        invalidateApiCache();
        const updatedSession: UserSession = await res.json();
        set({ session: updatedSession });
      }
    } catch {
      // In case of error, session remains unchanged
    }
  },

  hasPermission: (permission: Permission) => {
    const session = get().session;
    if (!session) return false;
    // Super Admin / Owner has unrestricted access to all permissions
    if (session.accountType === 'OWNER' || session.accountType === 'PLATFORM_ADMIN' || session.role === 'ROLE_SUPER_ADMIN') {
      return true;
    }
    // Permissions are validated against backend-authoritative session
    return session.permissions?.includes(permission) || false;
  }
}));
