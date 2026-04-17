# Specialty Kit Finder — Setup Guide

## Prerequisites

1. A Supabase project (create at https://supabase.com)
2. Admin email accounts for Super Admin access
3. Node.js (optional, for local testing)

## Step 1: Create Supabase Table

1. Go to your Supabase project dashboard
2. Open **SQL Editor** → **New Query**
3. Copy and paste the contents of `/sql/001_create_specialty_kits_table.sql`
4. Run the query
5. Verify the `specialty_kits` table appears under **Table Editor**

## Step 2: Configure Authentication

1. In Supabase Dashboard, go to **Authentication** → **Settings**
2. Under **Email**, enable **Email/Password** authentication
3. Copy your project URL and **Anon Key** from **Settings** → **API**

## Step 3: Create Admin Accounts

1. Go to **Authentication** → **Users**
2. Create user accounts for admin emails you want to grant access
3. Note: Super Admin access is controlled via email allowlist in config.runtime.js

## Step 4: Configure the App

1. Copy `config.runtime.example.js` to `config.runtime.js`
2. Fill in:
   - `supabaseUrl` — your Supabase project URL
   - `supabaseAnonKey` — your Anon Key
   - `allowedAdminEmails` — array of admin email addresses

Example:
```javascript
window.SPECIALTY_KITS_CONFIG = {
  supabaseUrl: "https://myproject.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  allowedAdminEmails: ["me@example.com", "admin@example.com"]
};
```

## Step 5: Test the App

### Public Finder (index.html)
```
http://localhost/specialty-kits/index.html
```
- Should load with no kits visible (all pending until approved)
- "Submit a Kit" link should work

### Kit Submission (submit.html)
```
http://localhost/specialty-kits/submit.html
```
- Fill out and submit a test kit
- Should appear in admin pending list (do NOT appear on public page)

### Admin Review (admin.html)
```
http://localhost/specialty-kits/admin.html
```
- Click Sign In
- Use an email from `allowedAdminEmails`
- Should see Pending, Approved, Rejected tabs
- Test approving a kit (should appear on public page)
- Test rejecting a kit (should be hidden from public)

## File Structure

```
/specialty-kits/
  index.html                      → Public kit finder
  submit.html                     → Kit submission form
  admin.html                      → Super Admin review page
  config.runtime.js               → **YOUR CONFIG** (fill this in!)
  config.runtime.example.js       → Example config (reference only)
  README.md                       → Project overview
  SETUP.md                        → This file
  
  /js/
    config.js                     → Config resolver
    supabase-client.js           → Supabase client factory
    auth.js                      → Auth helpers
    constants.js                 → All allowed field values
    kit-schema.js               → Kit normalization & validation
    kit-filters.js              → Filter matching logic
    utils.js                    → Utility helpers
    public-page.js              → Public page logic (index.html)
    submission-page.js          → Submission form logic (submit.html)
    admin-page.js               → Admin page logic (admin.html)
  
  /css/
    specialty-kits.css          → Kit-specific styles
  
  /sql/
    001_create_specialty_kits_table.sql  → Database schema
```

## Data Flow

### User Journey (Public)
1. Firefighter opens `index.html`
2. Browses kits by filter (category, type, location, etc.)
3. Clicks a kit to view details on map
4. Calls the phone number to request kit access

### Submitter Journey
1. Department/trainer opens `submit.html`
2. Fills out comprehensive kit form
3. Submits → creates **pending** record in database
4. Public page does NOT show pending kits
5. Submitter receives no direct notification (check back later)

### Admin Journey
1. Super Admin opens `admin.html`
2. Signs in with admin email
3. Reviews pending kits (Pending tab)
4. Can:
   - **Approve** → kit moves to "Approved" tab, appears on public page
   - **Reject** → kit moves to "Rejected" tab, stays hidden from public
   - **View** → see all kit details
5. Can also manage Approved and Rejected kits later

## Database Structure

### Key Fields

**Contact Info**
- `organization_name` — Department/company name
- `contact_name` — Person of contact
- `phone` — Primary phone (tel link on public)
- `secondary_phone` — Optional backup
- `email` — Optional contact email
- `website` — Optional website URL

**Kit Identity**
- `kit_name` — Display name
- `kit_category` — Single pick (e.g., "Leak Control Kit")
- `kit_types` — Array (e.g., ["Propane", "Chlorine"])
- `hazard_focus` — Array (e.g., ["Flammable Gas", "Toxic Inhalation"])
- `equipment_capabilities` — Array (e.g., ["Leak Control", "Flaring"])
- `deployment_type` — Single pick (e.g., "Trailer-Based")

**Operations**
- `availability_status` — e.g., "Available 24/7"
- `access_type` — e.g., "Mutual Aid"
- `storage_environment` — e.g., "Fire Station"
- `transport_capable` — "Yes" / "No" / "Depends"
- `training_required` — "Yes" / "No" / "Recommended"
- `call_before_use` — "Yes" / "No"

**Moderation**
- `record_status` — "pending" | "approved" | "rejected"
- `visibility` — "public" | "admin-only" (auto-set by status)
- `submitted_at` — Timestamp
- `reviewed_at` — When admin reviewed
- `reviewed_by` — Admin email who reviewed
- `rejection_reason` — If rejected, why

## Filter Logic

**Public Page Filters (index.html)**
- AND across categories
- OR within multi-select fields (kit types, hazards, capabilities)
- Empty filter = ignore that category
- Keyword search on name, org, category, type, hazard, capabilities

Example:
- User selects: Category = "Leak Control Kit" AND State = "CA" AND Kit Type = "Propane" OR "Chlorine"
- Result: All approved kits in CA with category "Leak Control Kit" AND type is either Propane or Chlorine

## Troubleshooting

### "Configuration missing" Error
- Check `config.runtime.js` exists
- Verify `supabaseUrl` and `supabaseAnonKey` are filled in
- Reload page

### Admin can't sign in
- Verify email is in `allowedAdminEmails` in config
- Check Supabase has that user account created in Authentication → Users
- Verify user account is **Confirmed** (not Invited)

### Kits not showing on public page
- Open admin.html and check kit `record_status` is "approved"
- Verify `visibility` is "public"
- Refresh the public page

### Submitted kit appears immediately on public
- This is a bug. Kit should only appear after admin approval.
- Check `record_status` and `visibility` in Supabase Table Editor
- Manually correct if needed

## Hosting

### Local Testing
```bash
# If using Python
python -m http.server 8000

# Then visit: http://localhost:8000/specialty-kits/index.html
```

### Production
- Host files on any static web server (GitHub Pages, Netlify, S3, etc.)
- Supabase handles all data persistence
- No backend server needed

## Security Notes

- `config.runtime.js` contains your Supabase Anon Key (public-safe)
- Do NOT expose Supabase Service Role Key in client code
- Supabase Row Level Security (RLS) should protect data
- Admin access controlled via email allowlist
- Consider adding RLS policies to restrict public access to approved records only

---

For more help, see README.md or check the constants.js file for all available field values.
