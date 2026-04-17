import { resolveConfig } from "./config.js";

const config = resolveConfig();

export function hasSupabaseConfig() {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}

export function getConfig() {
  return config;
}

let client;

export function getSupabaseClient() {
  if (client) {
    return client;
  }
  if (!window.supabase || !window.supabase.createClient) {
    throw new Error("Supabase client SDK not loaded.");
  }
  if (!hasSupabaseConfig()) {
    throw new Error("Missing Supabase URL or anon key. Set window.SPECIALTY_KITS_CONFIG first.");
  }
  client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  return client;
}
