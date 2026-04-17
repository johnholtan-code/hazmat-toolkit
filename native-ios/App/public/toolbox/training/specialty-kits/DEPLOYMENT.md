# Specialty Kit Finder - Render Deployment Guide

This document describes how the Specialty Kit Finder is deployed to Render.

## Architecture

The Specialty Kit Finder is deployed as part of the **Toolbox** static web service on Render:
- **Service Name:** `ics-collaborative-map` (serves all toolbox apps including Trainer Finder)
- **Runtime:** Static
- **Root Directory:** `native-ios/App/public/`
- **Build Command:** Runs `build.js` to generate config from environment variables
- **Accessible at:** `https://ics-collaborative-map-75ct.onrender.com/toolbox/training/specialty-kits/`

All toolbox apps (Trainer Finder, Specialty Kit Finder, etc.) are served from the same Render service under `/toolbox/training/`.

## Build Process

The `build.js` script runs during deployment and generates `config.runtime.js` from environment variables:

```bash
npm run build  # Generates config.runtime.js
```

This allows us to keep API keys and configuration out of the Git repository while still deploying the application.

## Environment Variables

These must be set in the Render dashboard under service environment variables:

| Variable | Required | Sync | Description |
|----------|----------|------|-------------|
| `SPECIALTY_KITS_SUPABASE_URL` | Yes | Public | Supabase project URL |
| `SPECIALTY_KITS_SUPABASE_ANON_KEY` | Yes | Private | Supabase public anon key |
| `SPECIALTY_KITS_ADMIN_EMAILS` | No | Public | Comma-separated admin emails |
| `SPECIALTY_KITS_OPENCAGE_API_KEY` | No | Private | OpenCage geocoding API key |

### Setting "Sync" to False

For sensitive values (`SPECIALTY_KITS_SUPABASE_ANON_KEY`, `SPECIALTY_KITS_OPENCAGE_API_KEY`):
1. Click "Add Secret" instead of "Add Environment Variable"
2. These won't appear in deployment logs
3. They're only available at runtime

## Getting Supabase Credentials

To find your Supabase keys:

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project
3. Settings → API
4. Copy:
   - **Project URL** → `SPECIALTY_KITS_SUPABASE_URL`
   - **Anon public key** → `SPECIALTY_KITS_SUPABASE_ANON_KEY`

## Deployment Steps

### 1. First-Time Setup

1. Go to [https://render.com](https://render.com)
2. Sign in or create account
3. Create a new **Static Site**
4. Connect your GitHub repository: `LightsOn-Safety-Solutions/hazmat-toolkit`
5. Set:
   - **Name:** `specialty-kit-finder`
   - **Branch:** `main`
   - **Build Command:** `cd native-ios/App/public/toolbox/training/specialty-kits && npm ci && npm run build`
   - **Publish Directory:** `native-ios/App/public/toolbox/training/specialty-kits`

### 2. Add Environment Variables

In the Render dashboard for this service:

1. Go to **Environment**
2. Add the variables listed above
3. For private variables, click **Add Secret** instead of **Add Environment Variable**
4. Click **Save Changes**

### 3. Deploy

- **Automatic:** Render auto-deploys whenever you push to `main`
- **Manual:** Click **Deploy** in the Render dashboard

## Verify Deployment

Once deployed, test these endpoints:

```bash
# Health check
curl https://specialty-kit-finder-{random}.onrender.com/

# Check config loaded
curl https://specialty-kit-finder-{random}.onrender.com/index.html
```

Look for:
- Page loads without errors
- Browser console shows config loaded
- Supabase connection works (check browser DevTools → Network)

## Local Development

For local testing without generating `config.runtime.js`:

1. Copy `config.runtime.example.js` to `config.runtime.js`
2. Fill in your Supabase credentials
3. Run a local HTTP server: `python3 -m http.server 9000`
4. Visit `http://localhost:9000/index.html`

**Note:** `config.runtime.js` is Git-ignored, so it won't be committed.

## Rollback

To rollback to a previous deployment:

1. Go to **Deployments** in Render dashboard
2. Find the previous successful deployment
3. Click **Re-deploy**

## Troubleshooting

### Build fails with "SPECIALTY_KITS_SUPABASE_ANON_KEY is not set"

- Check that `SPECIALTY_KITS_SUPABASE_ANON_KEY` is set in environment variables
- Verify it's not empty
- Redeploy

### config.runtime.js not generated

- Check build logs in Render dashboard
- Ensure `build.js` is executable: `chmod +x build.js`
- Verify `package.json` exists with `"build"` script

### App loads but Supabase connection fails

- Check browser DevTools → Console for errors
- Verify `SPECIALTY_KITS_SUPABASE_URL` matches your Supabase project
- Check that the anon key has permissions in Supabase RLS policies

### Admin page shows "Unauthorized"

- Verify your email is in `SPECIALTY_KITS_ADMIN_EMAILS`
- Sign out and sign back in
- Check that Supabase Auth is enabled in your project

## Monitoring

Monitor your deployment:

1. **Render Dashboard** → Logs
2. Check for errors in browser console (F12)
3. Check Supabase dashboard for database errors

## Custom Domain

To use a custom domain:

1. In Render dashboard, go to **Settings**
2. Click **Add Custom Domain**
3. Follow DNS configuration steps
4. Update any client-side URLs to use new domain

## Updates

To update the deployment:

1. Make changes locally
2. Commit: `git add . && git commit -m "Update specialty kit finder"`
3. Push: `git push origin main`
4. Render auto-deploys (or click **Deploy** manually)

## Support

For issues:
- Check Render logs: Dashboard → Logs
- Check Supabase status: [supabase.com/status](https://supabase.com/status)
- Review browser console (F12) for client-side errors
