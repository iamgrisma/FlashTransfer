
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use Service Role key to bypass RLS for updates
// Must be initialized inside handler to avoid build-time errors with missing env vars

export const runtime = 'edge';

export async function POST(request: Request) {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { id, p2p_offer } = await request.json();

        if (!id || !p2p_offer) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { error } = await supabase
            .from('fileshare')
            .update({
                p2p_offer: JSON.stringify(p2p_offer),
                last_activity_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) {
            console.error('Signaling update error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
