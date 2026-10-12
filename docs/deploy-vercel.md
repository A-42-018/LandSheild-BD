# Deploy the frontend on Vercel

The backend stays on Render (see `deploy-netlify.md`, section 1). Vercel hosts only the Next.js frontend.

## One-time setup (dashboard)
1. Vercel > Add New > Project > import the GitHub repo.
2. **Root Directory: `frontend`** (it holds `vercel.json`). Framework preset: Next.js (auto-detected).
3. Environment variables (Production; they are baked in at build time, so set them BEFORE the first deploy):
   - `NEXT_PUBLIC_API_URL` = `https://<service>.onrender.com/api/v1`
   - `NEXT_PUBLIC_SITE_URL` = `https://<your-project>.vercel.app` (or your custom domain)
4. Deploy. Every push to `main` then redeploys automatically.
5. In the Render dashboard set `CORS_ORIGINS` to the Vercel URL (no trailing slash). Several origins can be
   comma-separated, e.g. `https://<your-project>.vercel.app,https://land-sheild-bd.netlify.app`.
   Cookies already use `SameSite=None; Secure`, which is what a Vercel site talking to a Render API needs.

## From the terminal instead
From `frontend/`:
```
npm i -g vercel
vercel login                      # opens the browser; do this yourself
vercel link                       # pick or create the project
vercel env add NEXT_PUBLIC_API_URL production
vercel env add NEXT_PUBLIC_SITE_URL production
vercel deploy --prod
```

## After the deploy
Run the smoke list in `deploy-netlify.md` section 3 against the Vercel URL. Check specifically that a page reload keeps
you signed in (that is the cross-domain cookie) and that `/en/officer-signup` lists Division names in English and Bangla.
