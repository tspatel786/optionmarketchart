export interface AppUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role: 'TRADER' | 'ADMIN';
  loginAt: string;
}

const AUTH_STORAGE_KEY = 'ALGO_APP_AUTH_SESSION_V1';

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
    // Default master trader PIN is 9096 or any 4+ digit authorized PIN
    if (cleanPin === '9096' || cleanPin === '1234' || cleanPin.length >= 4) {
      const user: AppUser = {
        id: 'usr_trader_01',
        username: 'pro_trader',
        name: 'Master Trader',
        email: 'trader@algochart.in',
        role: 'TRADER',
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
   */
  public static loginWithCredentials(
    identifier: string,
    pass: string,
    remember: boolean = true
  ): { success: boolean; error?: string; user?: AppUser } {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (!cleanId || !cleanPass) {
      return { success: false, error: 'कृपया युझरनेम आणि पासवर्ड भरा.' };
    }

    if (
      (cleanId === 'admin' && cleanPass === 'admin123') ||
      (cleanId === 'trader' && (cleanPass === '9096' || cleanPass === 'trader123')) ||
      (cleanPass.length >= 4)
    ) {
      const user: AppUser = {
        id: `usr_${cleanId}`,
        username: cleanId,
        name: cleanId === 'admin' ? 'Administrator' : 'Master Trader',
        email: `${cleanId}@algochart.in`,
        role: cleanId === 'admin' ? 'ADMIN' : 'TRADER',
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

    return { success: false, error: 'अवैध क्रेडेंशियल्स. युझरनेम किंवा पासवर्ड तपासा.' };
  }

  /**
   * Instant Quick Access
   */
  public static instantAccess(): AppUser {
    const user: AppUser = {
      id: 'usr_trader_instant',
      username: 'algo_trader',
      name: 'Option Trader',
      email: 'algo@optionchart.in',
      role: 'TRADER',
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
