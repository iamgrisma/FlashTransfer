# FlashTransfer

Modern, secure peer-to-peer file sharing application with bidirectional transfer capabilities.

## Features

🔄 **Bidirectional P2P** - Both users can send and receive files simultaneously  
🔒 **End-to-End Encrypted** - WebRTC ensures complete privacy  
⚡ **Blazing Fast** - Direct browser-to-browser transfer  
📊 **Analytics** - Track usage statistics (anonymous)  
👥 **Multi-User Mode** - Broadcast to multiple receivers (coming soon)

## Quick Start

### Local Development

1. **Install dependencies**
```bash
npm install
```

2. **Set up environment variables**
Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. **Run database migrations**
- Open Supabase SQL Editor
- Run `supabase/schema.sql`

4. **Start development server**
```bash
npm run dev
```

5. **Start Cloudflare Worker (optional, for testing)**
```bash
npx wrangler dev
```

App runs at: `http://localhost:9002`

## Deployment

### Cloudflare Workers

```bash
# Deploy worker
npx wrangler deploy

# Update worker URL in code if needed
# Default: http://127.0.0.1:8787 (local)
```

### Cloudflare Pages / Vercel / Other

```bash
npm run build
# Deploy build output
```

## How It Works

1. **Create/Join Connection** - One user creates a 5-character code, other joins
2. **P2P Link Established** - WebRTC creates direct encrypted connection  
3. **Transfer Files** - Both users can drag & drop to send/receive

## Project Structure

```
src/
├── app/
│   ├── page.tsx                      # Bidirectional P2P landing
│   ├── api/analytics/                # Analytics API routes
│   └── s/[code]/page.tsx             # Receiver page
├── components/
│   ├── bidirectional-connection.tsx  # P2P connection UI
│   ├── transfer-panel.tsx            # Send/Receive interface
│   └── ui/                           # shadcn components
├── lib/
│   ├── analytics.ts                  # Analytics utilities
│   ├── code.ts                       # Share code encoding
│   └── supabase/                     # Database clients
└── worker.ts                         # Cloudflare Worker
```

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI**: Tailwind CSS, shadcn/ui
- **P2P**: simple-peer (WebRTC)
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Cloudflare Workers + Pages

## Security

- ✅ End-to-end encryption via WebRTC
- ✅ No server storage of files
- ✅ Anonymous (no user accounts)
- ✅ Temporary share links (24h expiration)

## License

MIT

## Contributing

PRs welcome! Please read CONTRIBUTING.md first.

---

Built with ❤️ for privacy and speed
