export const APP_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  openCageApiKey: "",
  allowedAdminEmails: [],
  appName: "Specialty Kit Finder"
};

export function resolveConfig() {
  const runtime = window.SPECIALTY_KITS_CONFIG || {};
  return {
    ...APP_CONFIG,
    ...runtime,
    supabaseUrl: String(runtime.supabaseUrl || APP_CONFIG.supabaseUrl || "").replace(/\/$/, ""),
    supabaseAnonKey: String(runtime.supabaseAnonKey || APP_CONFIG.supabaseAnonKey || ""),
    openCageApiKey: String(runtime.openCageApiKey || APP_CONFIG.openCageApiKey || "").trim(),
    allowedAdminEmails: Array.isArray(runtime.allowedAdminEmails)
      ? runtime.allowedAdminEmails.map((email) => String(email).toLowerCase().trim()).filter(Boolean)
      : APP_CONFIG.allowedAdminEmails
  };
}
