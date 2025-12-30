
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use Service Role key to bypass RLS for updates
// Must be initialized inside handler to avoid build-time errors with missing env vars

export const runtime = 'edge';

export async function POST(request: Request) {
    try {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
            return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { id, p2p_offer } = await request.json();

        if (!id || !p2p_offer) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Extend expiry by 24h instead of using potential missing column last_activity_at
        const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const { error } = await supabase
            .from('fileshare')
            .update({
                p2p_offer: JSON.stringify(p2p_offer),
                expires_at: newExpiry
            })
            .eq('id', id);

        if (error) {
            console.error('Signaling update error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Signaling Handler Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
