import { create } from 'zustand';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'EDITOR' | 'CLIENT';
  avatar?: string | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  updateUser: (user: Partial<User>) => void;
}

// Helper to safely fetch from localStorage in Next.js SSR
const getLocalStorageItem = (key: string): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(key);
  }
  return null;
};

const getInitialUser = (): User | null => {
  const userStr = getLocalStorageItem('mattwork_user');
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
  return null;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: getInitialUser(),
  accessToken: getLocalStorageItem('mattwork_access_token'),
  refreshToken: getLocalStorageItem('mattwork_refresh_token'),
  isAuthenticated: !!getLocalStorageItem('mattwork_access_token'),
  
  login: (user, accessToken, refreshToken) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mattwork_user', JSON.stringify(user));
      localStorage.setItem('mattwork_access_token', accessToken);
      localStorage.setItem('mattwork_refresh_token', refreshToken);
    }
    set({ user, accessToken, refreshToken, isAuthenticated: true });
  },
  
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('mattwork_user');
      localStorage.removeItem('mattwork_access_token');
      localStorage.removeItem('mattwork_refresh_token');
    }
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },
  
  setTokens: (accessToken, refreshToken) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mattwork_access_token', accessToken);
      localStorage.setItem('mattwork_refresh_token', refreshToken);
    }
    set({ accessToken, refreshToken });
  },

  updateUser: (updatedUser) => {
    set((state) => {
      if (!state.user) return state;
      const newUser = { ...state.user, ...updatedUser };
      if (typeof window !== 'undefined') {
        localStorage.setItem('mattwork_user', JSON.stringify(newUser));
      }
      return { user: newUser };
    });
  },
}));
