# Specialty Kit Finder

A moderated public directory for hazmat response and firefighting specialty kits. Allows departments, trainers, and organizations to submit kits for review, and provides firefighters with a quick way to locate approved kits by type, hazard, and region.

## Structure

```
/specialty-kits/
  index.html              → Public kit finder
  submit.html             → Kit submission form
  admin.html              → Super Admin review page
  config.runtime.js       → Runtime configuration (Supabase, admin emails)
  /css/
    specialty-kits.css
    admin.css
  /js/
    config.js
    supabase-client.js
    auth.js
    constants.js
    utils.js
    kit-schema.js
    kit-filters.js
    public-page.js
    submission-page.js
    admin-page.js
  /sql/
    001_create_specialty_kits_table.sql
  /assets/
    (branding assets, logos)
```

## Setup

### 1. Configure Supabase

Set `window.SPECIALTY_KITS_CONFIG` in `config.runtime.js` with:
- `supabaseUrl` — your Supabase project URL
- `supabaseAnonKey` — public anon key
- `allowedAdminEmails` — array of emails with super admin access

### 2. Create Database Table

Run the SQL migration in Supabase SQL Editor:
```
sql/001_create_specialty_kits_table.sql
```

### 3. Enable Supabase Auth

- Enable email/password auth in Supabase dashboard
- Create admin accounts for super admin emails in config

## Pages

- **index.html** — Public finder, shows approved kits only
- **submit.html** — Submission form, creates pending records
- **admin.html** — Admin review, locked behind auth

## Data Flow

1. User submits kit → saved as `pending` record
2. Super Admin reviews → approves/rejects
3. Approved kits → appear on public map and list
4. Rejected kits → retained for audit, hidden from public

## Filter Logic

- AND across filter categories
- OR within multi-select groups
- Empty filter value = ignore that category
- Case-insensitive keyword search

## Modules

- `constants.js` — Allowed values (categories, types, etc.)
- `kit-schema.js` — Normalization and validation
- `kit-filters.js` — Filter matching logic
- `auth.js` — Authentication and role checks
- `supabase-client.js` — Supabase client initialization
- `utils.js` — Shared utilities (uid, escapeHtml, etc.)
