import { createClient } from '@supabase/supabase-js';

// Polyfill WebSocket in Node.js test environments
if (typeof globalThis.WebSocket === 'undefined' && typeof window === 'undefined') {
  globalThis.WebSocket = class {} as any;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: typeof window !== 'undefined',
      },
    })
  : null;
