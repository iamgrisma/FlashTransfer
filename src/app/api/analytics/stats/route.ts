import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/analytics/stats
 * Fetch aggregate transfer statistics from the database
 */
export async function GET() {
    try {
        const supabase = createClient();

        // Get today's stats
        const today = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('transfer_stats')
            .select('*')
            .eq('date', today)
            .single();

        if (error && error.code !== 'PGRST116') {
            // PGRST116 = no rows returned, which is okay
            console.error('Database error fetching stats:', error);
            return NextResponse.json(
                { error: 'Failed to fetch statistics' },
                { status: 500 }
            );
        }

        // If no data for today, return zeros
        if (!data) {
            return NextResponse.json({
                totalFilesTransferred: 0,
                totalBytesTransferred: 0,
                fileTypes: {},
                transferModes: {},
            });
        }

        return NextResponse.json({
            totalFilesTransferred: data.total_files_transferred,
            totalBytesTransferred: data.total_bytes_transferred,
            fileTypes: data.file_types,
            transferModes: data.transfer_modes,
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/analytics/stats?range=week
 * Fetch aggregate statistics for a date range
 */
export async function GET_RANGE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const range = searchParams.get('range') || 'today';

        const supabase = createClient();
        let query = supabase.from('transfer_stats').select('*');

        // Calculate date range
        const today = new Date();
        let startDate: Date;

        switch (range) {
            case 'week':
                startDate = new Date(today);
                startDate.setDate(today.getDate() - 7);
                break;
            case 'month':
                startDate = new Date(today);
                startDate.setMonth(today.getMonth() - 1);
                break;
            case 'year':
                startDate = new Date(today);
                startDate.setFullYear(today.getFullYear() - 1);
                break;
            default:
                startDate = today;
        }

        query = query.gte('date', startDate.toISOString().split('T')[0]);

        const { data, error } = await query.order('date', { ascending: false });

        if (error) {
            console.error('Database error fetching stats range:', error);
            return NextResponse.json(
                { error: 'Failed to fetch statistics' },
                { status: 500 }
            );
        }

        return NextResponse.json(data || []);
    } catch (error) {
        console.error('Error fetching analytics range:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
