import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/analytics/update
 * Update aggregate transfer statistics in the database
 */
export async function POST(request: Request) {
    try {
        const { filesTransferred, bytesTransferred, fileTypes, transferMode } = await request.json();

        // Validate input
        if (
            typeof filesTransferred !== 'number' ||
            typeof bytesTransferred !== 'number' ||
            typeof fileTypes !== 'object' ||
            typeof transferMode !== 'string'
        ) {
            return NextResponse.json(
                { error: 'Invalid input parameters' },
                { status: 400 }
            );
        }

        const supabase = createClient();

        // Call the database function to update stats
        const { error } = await supabase.rpc('update_transfer_stats', {
            p_files_transferred: filesTransferred,
            p_bytes_transferred: bytesTransferred,
            p_file_types: fileTypes,
            p_transfer_mode: transferMode,
        });

        if (error) {
            console.error('Database error updating stats:', error);
            return NextResponse.json(
                { error: 'Failed to update statistics' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating analytics:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
