export interface AppUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role: 'TRADER' | 'ADMIN';
  loginAt: string;
}

const AUTH_STORAGE_KEY = 'ALGO_APP_AUTH_SESSION_V1';

// Primary authorized user profile
export const PRIMARY_USER: AppUser = {
  id: 'usr_taufik_01',
  username: 'taufik',
  name: 'Taufik Patel',
  email: 'tufikpatel23@gmail.com',
  role: 'ADMIN',
  loginAt: '',
};

// In-memory fallback for SSR and testing environments
const memoryStore = new Map<string, string>();

const getStorageItem = (key: string): string | null => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return memoryStore.get(key) || null;
  } catch {
    return memoryStore.get(key) || null;
  }
};

const setStorageItem = (key: string, value: string, remember: boolean = true): void => {
  try {
    if (typeof window !== 'undefined') {
      if (remember && window.localStorage) {
        window.localStorage.setItem(key, value);
      } else if (window.sessionStorage) {
        window.sessionStorage.setItem(key, value);
      }
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
    memoryStore.set(key, value);
  } catch {
    memoryStore.set(key, value);
  }
};

const removeStorageItem = (key: string): void => {
  try {
    if (typeof window !== 'undefined') {
      if (window.localStorage) window.localStorage.removeItem(key);
      if (window.sessionStorage) window.sessionStorage.removeItem(key);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
    memoryStore.delete(key);
  } catch {
    memoryStore.delete(key);
  }
};

export class AppAuthService {
  /**
   * Check if user is currently authenticated
   */
  public static isAuthenticated(): boolean {
    try {
      const stored = getStorageItem(AUTH_STORAGE_KEY);
      if (!stored) return false;
      const session = JSON.parse(stored);
      return Boolean(session && session.user && session.token);
    } catch {
      return false;
    }
  }

  /**
   * Get current logged-in user
   */
  public static getCurrentUser(): AppUser | null {
    try {
      const stored = getStorageItem(AUTH_STORAGE_KEY);
      if (!stored) return null;
      const session = JSON.parse(stored);
      return session.user || null;
    } catch {
      return null;
    }
  }

  /**
   * Login with PIN (e.g. 9096 or custom pin)
   */
  public static loginWithPin(pin: string, remember: boolean = true): { success: boolean; error?: string; user?: AppUser } {
    const cleanPin = pin.trim();
    // Authorized PINs: 9096 or 4+ digits
    if (cleanPin === '9096' || cleanPin === '1234' || cleanPin.length >= 4) {
      const user: AppUser = {
        ...PRIMARY_USER,
        loginAt: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
      };

      const session = {
        token: `tok_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        user,
        savedAt: Date.now(),
      };

      setStorageItem(AUTH_STORAGE_KEY, JSON.stringify(session), remember);
      return { success: true, user };
    }

    return { success: false, error: 'चुकीचा PIN. कृपया 4 अंकी PIN प्रविष्ट करा (डिफॉल्ट: 9096).' };
  }

  /**
   * Login with Username/Email & Password
   * Configured for: tufikpatel23@gmail.com / Taufik@786
   */
  public static loginWithCredentials(
    identifier: string,
    pass: string,
    remember: boolean = true
  ): { success: boolean; error?: string; user?: AppUser } {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (!cleanId || !cleanPass) {
      return { success: false, error: 'कृपया ईमेल/युझरनेम आणि पासवर्ड भरा.' };
    }

    // Exact match for Taufik Patel credentials
    const isTaufikMatch =
      (cleanId === 'tufikpatel23@gmail.com' || cleanId === 'taufik' || cleanId === 'taufikpatel') &&
      cleanPass === 'Taufik@786';

    // Also support fallback PIN or admin credentials
    const isAlternativeMatch =
      (cleanId === 'tufikpatel23@gmail.com' && (cleanPass === '9096' || cleanPass === 'Taufik@786')) ||
      (cleanId === 'admin' && cleanPass === 'admin123') ||
      (cleanId === 'trader' && (cleanPass === '9096' || cleanPass === 'Taufik@786')) ||
      (cleanPass === 'Taufik@786');

    if (isTaufikMatch || isAlternativeMatch) {
      const user: AppUser = {
        ...PRIMARY_USER,
        name: cleanId === 'admin' ? 'Administrator' : 'Taufik Patel',
        email: cleanId.includes('@') ? cleanId : 'tufikpatel23@gmail.com',
        loginAt: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
      };

      const session = {
        token: `tok_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        user,
        savedAt: Date.now(),
      };

      setStorageItem(AUTH_STORAGE_KEY, JSON.stringify(session), remember);
      return { success: true, user };
    }

    return { success: false, error: 'अवैध ईमेल किंवा पासवर्ड. कृपया योग्य क्रेडेंशियल्स टाका.' };
  }

  /**
   * Instant Quick Access
   */
  public static instantAccess(): AppUser {
    const user: AppUser = {
      ...PRIMARY_USER,
      loginAt: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
    };

    setStorageItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: `tok_instant_${Date.now()}`,
        user,
        savedAt: Date.now(),
      }),
      true
    );

    return user;
  }

  /**
   * Logout current user
   */
  public static logout(): void {
    removeStorageItem(AUTH_STORAGE_KEY);
  }
}
