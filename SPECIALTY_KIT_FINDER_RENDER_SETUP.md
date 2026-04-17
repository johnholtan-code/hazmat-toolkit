# Specialty Kit Finder - Complete Render Deployment Setup

This guide walks you through deploying the Specialty Kit Finder to Render.

**Note:** The Specialty Kit Finder is served from the existing `ics-collaborative-map` Render service, which also hosts the Trainer Finder and other toolbox apps.

## Prerequisites

- GitHub account with access to `LightsOn-Safety-Solutions/hazmat-toolkit` repository
- Render account (create at [render.com](https://render.com))
- Supabase project with the specialty_kits table created
- Admin email address for access control
- Access to update the existing `ics-collaborative-map` Render service

## Step 1: Verify GitHub Repository

Your code is already pushed to: https://github.com/LightsOn-Safety-Solutions/hazmat-toolkit

The `ics-collaborative-map` service in `render.yaml` now serves all toolbox apps from `native-ios/App/public/`.

## Step 2: Create Render Account

1. Go to [https://render.com](https://render.com)
2. Click **Sign Up**
3. Choose **Sign up with GitHub** (easier for connecting repositories)
4. Authorize Render to access your GitHub account
5. Complete your profile

## Step 3: Update the Existing Render Service

You should already have an `ics-collaborative-map` service running. Update it to include the Specialty Kit Finder:

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Find your **`ics-collaborative-map`** service
3. Click **Settings**
4. Update:
   - **Build Command:** `cd native-ios/App/public/toolbox/training/specialty-kits && npm ci && npm run build`
   - **Publish Directory:** `native-ios/App/public` (should already be set)
5. Click **Save Changes**

The build command will generate `config.runtime.js` for the Specialty Kit Finder while preserving all other toolbox content.

## Step 4: Configure Environment Variables

After the service is created:

1. Go to your `specialty-kit-finder` service in Render Dashboard
2. Click **Environment**
3. Add the following variables:

### Public Variables (Add as Environment Variables)

| Key | Value | Description |
|-----|-------|-------------|
| `SPECIALTY_KITS_SUPABASE_URL` | `https://domebvsyhexhgvsducbm.supabase.co` | Your Supabase project URL |
| `SPECIALTY_KITS_ADMIN_EMAILS` | `john.holtan@lightsonss.com` | Comma-separated admin emails |

### Secret Variables (Add as Secrets)

1. Click **Add Secret** (not "Add Environment Variable")
2. Add these securely:

| Key | Value | Notes |
|-----|-------|-------|
| `SPECIALTY_KITS_SUPABASE_ANON_KEY` | [See below] | Don't log this |
| `SPECIALTY_KITS_OPENCAGE_API_KEY` | [Optional] | Leave blank if not using geocoding |

### Getting Your Supabase Keys

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project (domebvsyhexhgvsducbm)
3. Click **Settings** → **API**
4. Copy:
   - **Project URL** → Use for `SPECIALTY_KITS_SUPABASE_URL`
   - **Anon public key** → Use for `SPECIALTY_KITS_SUPABASE_ANON_KEY`

### Updating Admin Emails

If you want to add more admins, update `SPECIALTY_KITS_ADMIN_EMAILS`:

```
john.holtan@lightsonss.com,other-admin@example.com,another-admin@example.com
```

5. Click **Save Changes**

## Step 5: Deploy

### Automatic Deployment

Render will auto-deploy whenever you push to the `main` branch:

```bash
git add .
git commit -m "Update specialty kit finder"
git push origin main
```

You'll see the deployment status in the Render Dashboard.

### Manual Deployment

Click **Deploy** in the Render Dashboard if you want to redeploy without code changes.

## Step 6: Access Your App

Once deployed, the Specialty Kit Finder is available at:

```
https://ics-collaborative-map-75ct.onrender.com/toolbox/training/specialty-kits/
```

Other toolbox apps remain accessible:
- **Trainer Finder:** `https://ics-collaborative-map-75ct.onrender.com/toolbox/training/trainers.html`
- **Response Kits Map:** `https://ics-collaborative-map-75ct.onrender.com/toolbox/training/response-kits-map.html`

## Step 7: Verify Deployment

### Check the Specialty Kit Finder Loads

```bash
curl https://ics-collaborative-map-75ct.onrender.com/toolbox/training/specialty-kits/index.html
```

You should see HTML content (not an error).

### Test Admin Page

1. Go to `https://ics-collaborative-map-75ct.onrender.com/toolbox/training/specialty-kits/admin.html`
2. You should be redirected to login
3. Sign in with one of the admin emails
4. If login works, Supabase is connected correctly

### Check Browser Console

Open your browser's Developer Tools (F12) and check the Console tab:

- You should NOT see errors about missing config
- You should see logs like: "Supabase initialized"
- No red error messages

## Step 8: Update URLs (if needed)

The Specialty Kit Finder is now accessible at a path under the existing Render domain. Update any external links:

- Old local URL: `http://localhost:9000/specialty-kits/index.html`
- New production URL: `https://ics-collaborative-map-75ct.onrender.com/toolbox/training/specialty-kits/index.html`

Update any hardcoded links in:
- Documentation
- User communications
- QR codes or deep links
- API references

## Troubleshooting

### Build Fails

Check the build logs in Render:
1. Go to your service
2. Click **Logs** → **Build logs**
3. Look for errors like `SPECIALTY_KITS_SUPABASE_ANON_KEY is not set`

**Solution:** Add the missing environment variable.

### App Loads but Shows Blank Page

Check the browser console (F12):

- **"Cannot read property 'supabaseUrl' of undefined"** → Config wasn't generated
  - Verify environment variables are set
  - Check build logs for errors
  - Trigger a manual redeploy

- **"Failed to connect to Supabase"** → Connection issue
  - Verify `SPECIALTY_KITS_SUPABASE_URL` is correct
  - Check Supabase project is active
  - Verify anon key is valid

### Admin Page Won't Load

- Sign out and sign back in
- Check your email is in `SPECIALTY_KITS_ADMIN_EMAILS`
- Check Supabase Auth is enabled
- Look for auth errors in browser console

### Static Files (CSS, JS) Not Loading

This usually means the `staticPublishPath` is wrong. Check:
1. Your render.yaml has correct path
2. The files exist at that path
3. Trigger a redeploy

## Custom Domain Setup

The entire toolbox (including Specialty Kit Finder) can be served from a custom domain like `toolbox.example.com`:

1. In Render Dashboard, go to your `ics-collaborative-map` service
2. Click **Settings**
3. Scroll to **Custom Domain**
4. Click **Add Custom Domain**
5. Enter your domain: `toolbox.example.com`
6. Follow DNS configuration steps
7. Update your DNS provider (GoDaddy, Route53, etc.)

Then the Specialty Kit Finder will be at: `https://toolbox.example.com/toolbox/training/specialty-kits/`

## SSL/TLS Certificate

Render automatically provides free SSL certificates (HTTPS). Your site will be:
- `https://specialty-kit-finder-XXXXX.onrender.com` (auto)
- `https://specialty-kits.example.com` (if you add custom domain)

## Monitoring & Logs

### View Logs

1. Go to your service in Render Dashboard
2. Click **Logs**
3. See real-time logs as requests come in
4. Look for errors or warnings

### Check Health

Static sites don't have health checks like API services, but you can:
1. Manually visit the URL
2. Check HTTP status code (should be 200)
3. Use monitoring tools to ping the URL

## Updates & Redeployments

### Standard Deploy

```bash
git add .
git commit -m "Your message"
git push origin main
```

Render auto-deploys.

### Force Redeploy

In Render Dashboard:
1. Go to your service
2. Click **Deploy**
3. Select "Clear build cache and deploy"

### Rollback to Previous Deployment

1. Go to **Deployments** tab
2. Find the previous successful deployment
3. Click **Re-deploy**

## Environment Variables Quick Reference

```bash
# Public
SPECIALTY_KITS_SUPABASE_URL=https://domebvsyhexhgvsducbm.supabase.co
SPECIALTY_KITS_ADMIN_EMAILS=john.holtan@lightsonss.com

# Secrets
SPECIALTY_KITS_SUPABASE_ANON_KEY=your-key-here
SPECIALTY_KITS_OPENCAGE_API_KEY=optional-geocoding-key
```

## Support & Resources

- **Render Docs:** https://render.com/docs
- **Supabase Docs:** https://supabase.com/docs
- **GitHub Issues:** https://github.com/LightsOn-Safety-Solutions/hazmat-toolkit/issues

## Next Steps

Once deployed:

1. ✅ Visit your live URL
2. ✅ Test the finder interface
3. ✅ Test the submission form
4. ✅ Test the admin dashboard
5. ✅ Share the URL with users
6. ✅ Monitor logs for errors

---

**Your Specialty Kit Finder is now in production!** 🎉
