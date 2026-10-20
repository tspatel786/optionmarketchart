import { createClient } from '@supabase/supabase-js';

// Polyfill WebSocket in Node.js test environments
if (typeof globalThis.WebSocket === 'undefined' && typeof window === 'undefined') {
  globalThis.WebSocket = class {} as any;
}

const getEnvVar = (key: string): string => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.[key]) {
      return (import.meta as any).env[key];
    }
  } catch {
    // fallback to process.env
  }
  try {
    if (typeof process !== 'undefined' && process.env?.[key]) {
      return process.env[key] || '';
    }
  } catch {
    // return empty
  }
  return '';
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL') || getEnvVar('SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY') || getEnvVar('SUPABASE_ANON_KEY') || getEnvVar('SUPABASE_SERVICE_ROLE_KEY');

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: typeof window !== 'undefined',
      },
    })
  : null;
