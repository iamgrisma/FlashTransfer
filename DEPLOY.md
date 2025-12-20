## Deployment to Cloudflare Workers

The applications is configured to deploy as a standard Cloudflare Worker with Assets.

### 1. Prerequisites

```bash
# Install dependencies
npm install
npm install --save-dev @cloudflare/next-on-pages
```

### 2. Deploy

One command to build and deploy:

```bash
npm run deploy
```

This will:
1. Build the Next.js app using `@cloudflare/next-on-pages`
2. Output to `.vercel/output/static`
3. Deploy to Cloudflare Workers using `wrangler deploy`

### 3. Verify Deployment

Your app will be available at standard worker URL (e.g., `https://flashtransfer.your-subdomain.workers.dev`) unless you configure a custom domain.

**Note:** Cloudflare Workers with Assets is the modern way to host full-stack apps on Workers infrastructure.

Everything runs on the Workers runtime - no separate frontend/backend deployment needed!

### Environment Variables

**Local Development:**
```bash
# Copy example file
cp .env.example .env.local

# Edit .env.local with your actual values
```

**Production (Cloudflare):**
```bash
# Set via CLI
npx wrangler pages secret put NEXT_PUBLIC_SUPABASE_URL
npx wrangler pages secret put NEXT_PUBLIC_SUPABASE_ANON_KEY
npx wrangler pages secret put NEXT_PUBLIC_APP_URL
npx wrangler pages secret put ANALYTICS_API_KEY

# Or via Dashboard:
# Workers & Pages → Your project → Settings → Environment variables
```

### Local Development

```bash
# Standard Next.js dev server
npm run dev

# Or test Workers build locally
npx @cloudflare/next-on-pages
npx wrangler pages dev .vercel/output/static
```

### Why This Works

- `@cloudflare/next-on-pages` converts Next.js into Workers-compatible format
- API routes become Workers functions
- SSR works on Workers runtime
- Single deployment for everything
- Fast global edge network

### Deploy Command Summary

```bash
# One-line deploy
npx @cloudflare/next-on-pages && npx wrangler pages deploy .vercel/output/static

# Or add to package.json:
# "scripts": {
#   "deploy": "@cloudflare/next-on-pages && wrangler pages deploy .vercel/output/static"
# }
```

### Continuous Deployment

Connect your GitHub repo to Cloudflare Pages:
- Dashboard → Pages → Create project → Connect to Git
- Framework: Next.js
- Build command: `npx @cloudflare/next-on-pages`
- Build output: `.vercel/output/static`

Every git push auto-deploys to Workers!

---

## Notes

- ✅ Everything runs on Cloudflare Workers
- ✅ No separate Pages vs Workers deployment
- ✅ Global edge distribution
- ✅ Automatic HTTPS
- ✅ DDoS protection included
- ✅ No cold starts (Workers are fast!)

You were right - Workers can absolutely handle everything! 🚀
