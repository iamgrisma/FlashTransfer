
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { shortCode } = await request.json();

    if (!shortCode || typeof shortCode !== 'string' || shortCode.length !== 5) {
      return NextResponse.json({ message: 'Invalid share code format.' }, { status: 400 });
    }

    // Use admin client to securely query the database from the server-side
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

    const { data, error } = await supabase
      .from('fileshare')
      .select('obfuscated_code, expires_at')
      .eq('short_code', shortCode)
      .single();

    if (error || !data) {
      return NextResponse.json({ message: 'Share code not found or has expired.' }, { status: 404 });
    }
    
    // Optional: Check for expiration
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return NextResponse.json({ message: 'This share link has expired.' }, { status: 410 });
    }

    return NextResponse.json({ obfuscatedCode: data.obfuscated_code });

  } catch (e) {
    console.error('API Error:', e);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}
