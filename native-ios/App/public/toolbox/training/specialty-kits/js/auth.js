import { getConfig, getSupabaseClient } from "./supabase-client.js";

export async function signIn(email, password) {
  const supabase = getSupabaseClient();
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  const supabase = getSupabaseClient();
  return supabase.auth.signOut();
}

export async function getSessionUser() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw error;
  }
  return data.user;
}

export function userIsSuperAdmin(user) {
  if (!user) {
    return false;
  }

  const cfg = getConfig();
  const email = String(user.email || "").toLowerCase().trim();

  if (cfg.allowedAdminEmails.includes(email)) {
    return true;
  }

  const appRole = user.app_metadata?.role;
  const userRole = user.user_metadata?.role;
  return appRole === "super_admin" || userRole === "super_admin";
}
