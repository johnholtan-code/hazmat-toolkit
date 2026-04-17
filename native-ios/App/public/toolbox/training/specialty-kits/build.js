#!/usr/bin/env node

/**
 * Build script for Specialty Kit Finder
 * Generates config.runtime.js from environment variables
 * Runs during Render deployment
 */

const fs = require('fs');
const path = require('path');

// Get environment variables, fallback to defaults for development
const config = {
  supabaseUrl: process.env.SPECIALTY_KITS_SUPABASE_URL || 'https://domebvsyhexhgvsducbm.supabase.co',
  supabaseAnonKey: process.env.SPECIALTY_KITS_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
  openCageApiKey: process.env.SPECIALTY_KITS_OPENCAGE_API_KEY || '',
  allowedAdminEmails: (process.env.SPECIALTY_KITS_ADMIN_EMAILS || 'john.holtan@lightsonss.com')
    .split(',')
    .map(email => email.trim())
    .filter(email => email.length > 0)
};

// Validate required configuration
if (!config.supabaseAnonKey) {
  console.error('ERROR: SPECIALTY_KITS_SUPABASE_ANON_KEY environment variable is not set');
  process.exit(1);
}

if (config.allowedAdminEmails.length === 0) {
  console.warn('WARNING: No admin emails configured');
}

// Generate the config file
const configContent = `// Runtime configuration for Specialty Kit Finder
// Generated at build time from environment variables
// DO NOT EDIT - this file is auto-generated

window.SPECIALTY_KITS_CONFIG = {
  supabaseUrl: "${config.supabaseUrl}",
  supabaseAnonKey: "${config.supabaseAnonKey}",
  openCageApiKey: "${config.openCageApiKey}",
  allowedAdminEmails: [
    ${config.allowedAdminEmails.map(email => `"${email}"`).join(',\n    ')}
  ]
};
`;

try {
  const configPath = path.join(__dirname, 'config.runtime.js');
  fs.writeFileSync(configPath, configContent, 'utf8');
  console.log(`✓ Generated config.runtime.js`);
  console.log(`✓ Supabase URL: ${config.supabaseUrl}`);
  console.log(`✓ Admin emails: ${config.allowedAdminEmails.join(', ')}`);
} catch (error) {
  console.error('ERROR: Failed to generate config.runtime.js', error);
  process.exit(1);
}
