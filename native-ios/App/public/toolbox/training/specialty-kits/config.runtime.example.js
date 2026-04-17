// EXAMPLE Runtime Configuration for Specialty Kit Finder
// Copy this file to config.runtime.js and fill in your values

window.SPECIALTY_KITS_CONFIG = {
  // Supabase project URL (from Supabase dashboard)
  supabaseUrl: "https://your-project.supabase.co",
  
  // Supabase public anon key (from Supabase dashboard, Auth > Settings)
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  
  // Email addresses that have Super Admin access
  // Users must sign in with Supabase auth to access admin page
  // Their email must be in this list OR have super_admin role in auth metadata
  allowedAdminEmails: [
    "admin1@example.com",
    "admin2@example.com"
  ]
};
