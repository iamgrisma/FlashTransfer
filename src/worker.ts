import { createClient } from '@supabase/supabase-js';
import { reverseObfuscateCode } from './lib/code';

export interface Env {
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                },
            });
        }

        if (request.method === 'GET') {
            return new Response('FlashTransfer Worker is Online', {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                }
            });
        }

        if (request.method !== 'POST') {
            return new Response('Method Not Allowed', { status: 405 });
        }

        try {
            const { obfuscatedCode } = await request.json() as { obfuscatedCode: string };

            if (!obfuscatedCode || typeof obfuscatedCode !== 'string' || obfuscatedCode.length !== 5) {
                return new Response(JSON.stringify({ message: 'Invalid share code format.' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                });
            }

            const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

            // Reverse the d obfuscation to find the original short_code
            // Note: verify if reverseObfuscateCode has dependencies that might fail in worker (it shouldn't)
            const shortCode = reverseObfuscateCode(obfuscatedCode);

            const { data, error } = await supabase
                .from('fileshare')
                .select('id, p2p_offer, expires_at')
                .eq('short_code', shortCode)
                .single();

            if (error || !data) {
                console.error('Share code lookup error:', error);
                return new Response(JSON.stringify({ message: 'Share code not found or has expired.' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                });
            }

            // Check for expiration
            if (data.expires_at && new Date(data.expires_at) < new Date()) {
                return new Response(JSON.stringify({ message: 'This share link has expired.' }), {
                    status: 410,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                });
            }

            return new Response(JSON.stringify({ p2pOffer: data.p2p_offer, shareId: data.id }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });

        } catch (e: any) {
            console.error('Worker Error:', e);
            const errorMessage = e instanceof Error ? e.message : 'An internal server error occurred.';
            return new Response(JSON.stringify({ message: errorMessage }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }
    },
};
