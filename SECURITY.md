# API Security

## Current Security Measures ✅

### 1. Rate Limiting
All API endpoints now have in-memory rate limiting:
- `/api/share`: 30 requests/minute per IP
  - Failed attempt tracking (blocks after 10 failed attempts)
- `/api/analytics/update`: 10 requests/minute per IP
- `/api/analytics/stats`: No limit (read-only, public)

### 2. API Authentication
**Analytics Update Endpoint** (`/api/analytics/update`):
- ✅ HMAC-based API key verification
- ✅ Timestamp validation (5-minute window)
- ✅ Backward compatible (allows same-origin requests without API key)

**How it works:**
```typescript
// Client sends:
X-API-Key: your_api_key
X-Timestamp: current_timestamp_ms
X-Signature: HMAC-SHA256(api_key + timestamp)
```

### 3. CORS Configuration
- Configured for all endpoints
- Restricts to `NEXT_PUBLIC_APP_URL` (or allows all if not set)
- Proper preflight handling (OPTIONS requests)

### 4. Input Validation
- Type checking on all inputs
- Sanity checks on values:
  - Max 1000 files per request
  - Max 10GB bytes per request
  - Valid transfer mode check ('p2p', 'broadcast', 'bidirectional')

### 5. Database Protection
- Supabase RLS policies active
- ⚠️ Resets on server restart
- ⚠️ Doesn't work across multiple instances
- ⚠️ Not suitable for large scale

**For Production:**
Consider:
1. **Use Cloudflare Rate Limiting** (free tier available)
2. **Redis-based rate limiting** (for multi-instance deployments)
3. **API Keys** for analytics updates (only your app can update)
4. **CAPTCHA** for share code access (prevent brute force)

## Recommended Production Setup

### Option 1: Cloudflare Rate Limiting (Easiest)
Already built into Cloudflare Pages - configure in dashboard:
- 100 requests/minute per IP
- Block on 429 responses

### Option 2: API Key for Analytics
```typescript
// Only accept analytics from your own frontend
const API_KEY = process.env.ANALYTICS_API_KEY;

if (request.headers.get('x-api-key') !== API_KEY) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### Option 3: Disable Public Analytics Updates
Make analytics client-side only or remove the update endpoint entirely.

## Current Trade-offs

**What we have:**
- ✅ Basic protection against spam
- ✅ No external dependencies
- ✅ Works for small-medium traffic

**What's missing:**
- ❌ Persistent rate limiting
- ❌ API authentication
- ❌ Advanced abuse prevention

This is **acceptable for initial launch** but should be improved before scaling.
