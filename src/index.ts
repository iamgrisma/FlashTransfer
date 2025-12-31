// Flashare - Single Cloudflare Worker
// Handles BOTH frontend (static files) AND backend (API)

import { useDB, Env } from './db'

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url)

        // CORS headers for API routes
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders })
        }

        // ======================
        // BACKEND: API Routes
        // ======================

        if (url.pathname.startsWith('/api/')) {
            return handleAPI(url, request, env, corsHeaders)
        }

        // ======================
        // FRONTEND: Static Files
        // ======================

        return env.ASSETS.fetch(request)
    }
}

async function handleAPI(url: URL, request: Request, env: Env, corsHeaders: Record<string, string>) {

    // POST /api/create - Create P2P session
    if (url.pathname === '/api/create' && request.method === 'POST') {
        try {
            const { offer, code } = await request.json() as { offer: any, code: string }

            if (!code || code.length !== 5) {
                return jsonResponse({ error: 'Invalid code' }, 400, corsHeaders)
            }

            const supabase = useDB(env)
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

            const { data, error } = await supabase
                .from('fileshare')
                .insert([{
                    short_code: code,
                    p2p_offer: JSON.stringify(offer),
                    transfer_mode: 'bidirectional',
                    expires_at: expiresAt
                }])
                .select('id')
                .single()

            if (error) {
                console.error('Supabase error:', error)
                return jsonResponse({ error: 'Failed to create session' }, 500, corsHeaders)
            }

            return jsonResponse({ success: true, sessionId: data.id }, 200, corsHeaders)

        } catch (error) {
            console.error('Create error:', error)
            return jsonResponse({ error: 'Server error' }, 500, corsHeaders)
        }
    }

    // GET /api/join/:code - Get P2P offer
    if (url.pathname.startsWith('/api/join/') && request.method === 'GET') {
        try {
            const code = url.pathname.split('/').pop()

            if (!code || code.length !== 5) {
                return jsonResponse({ error: 'Invalid code' }, 400, corsHeaders)
            }

            const supabase = useDB(env)

            const { data, error } = await supabase
                .from('fileshare')
                .select('id, p2p_offer, expires_at')
                .eq('short_code', code)
                .single()

            if (error || !data) {
                return jsonResponse({ error: 'Session not found' }, 404, corsHeaders)
            }

            // Check expiry
            if (data.expires_at && new Date(data.expires_at) < new Date()) {
                return jsonResponse({ error: 'Session expired' }, 410, corsHeaders)
            }

            return jsonResponse({
                code,
                offer: JSON.parse(data.p2p_offer)
            }, 200, corsHeaders)

        } catch (error) {
            console.error('Join error:', error)
            return jsonResponse({ error: 'Server error' }, 500, corsHeaders)
        }
    }

    // POST /api/answer - Send P2P answer
    if (url.pathname === '/api/answer' && request.method === 'POST') {
        try {
            const { code, answer } = await request.json() as { code: string, answer: any }

            const supabase = useDB(env)

            const { error } = await supabase
                .from('fileshare')
                .update({ p2p_answer: JSON.stringify(answer) })
                .eq('short_code', code)

            if (error) {
                return jsonResponse({ error: 'Failed to save answer' }, 500, corsHeaders)
            }

            return jsonResponse({ success: true }, 200, corsHeaders)

        } catch (error) {
            console.error('Answer error:', error)
            return jsonResponse({ error: 'Server error' }, 500, corsHeaders)
        }
    }

    return jsonResponse({ error: 'Not Found' }, 404, corsHeaders)
}

function jsonResponse(data: any, status: number, headers: Record<string, string>) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...headers,
            'Content-Type': 'application/json'
        }
    })
}
