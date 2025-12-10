
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { reverseObfuscateCode } from '@/lib/code';

export async function POST(request: Request) {
  try {
    const { obfuscatedCode } = await request.json();

    if (!obfuscatedCode || typeof obfuscatedCode !== 'string' || obfuscatedCode.length !== 5) {
      return NextResponse.json({ message: 'Invalid share code format.' }, { status: 400 });
    }

    // Use a service role key to securely query the database from the server-side
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
      }
    );
    
    // Reverse the obfuscation to find the original short_code
    const shortCode = reverseObfuscateCode(obfuscatedCode);

    const { data, error } = await supabase
      .from('fileshare')
      .select('id, p2p_offer, expires_at')
      .eq('short_code', shortCode)
      .single();

    if (error || !data) {
      return NextResponse.json({ message: 'Share code not found or has expired.' }, { status: 404 });
    }
    
    // Check for expiration
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return NextResponse.json({ message: 'This share link has expired.' }, { status: 410 });
    }

    return NextResponse.json({ p2pOffer: data.p2p_offer, shareId: data.id });

  } catch (e: any) {
    console.error('API Error:', e);
    // Provide a more generic error in production but be specific for debugging
    const errorMessage = e instanceof Error ? e.message : 'An internal server error occurred.';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
