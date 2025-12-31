# Flashare

Simple P2P file sharing - one Cloudflare Worker.

## Structure

```
Flashare/
├── src/
│   └── index.ts       # Worker: API + serves frontend
├── public/            # Static files
│   ├── index.html
│   └── js/
├── wrangler.toml      # Config
├── package.json       # Dependencies
└── .env              # Your Supabase credentials
```

## Deploy

```bash
npm install

# Set secrets
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY

# Deploy
wrangler deploy
```

## Local Dev

```bash
npm run dev
```

Open http://localhost:8787

That's it!
