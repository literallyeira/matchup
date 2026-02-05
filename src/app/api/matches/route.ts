import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - Get all matches (admin only)
export async function GET(request: Request) {
    const authHeader = request.headers.get('Authorization');

    if (authHeader !== process.env.ADMIN_PASSWORD) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { data, error } = await supabase
            .from('matches')
            .select(`
        id,
        created_at,
        created_by,
        application_1:applications!matches_application_1_id_fkey(
          id, first_name, last_name, photo_url, character_name
        ),
        application_2:applications!matches_application_2_id_fkey(
          id, first_name, last_name, photo_url, character_name
        )
      `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// POST - Create a new match (admin only)
export async function POST(request: Request) {
    const authHeader = request.headers.get('Authorization');

    if (authHeader !== process.env.ADMIN_PASSWORD) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { application1Id, application2Id } = await request.json();

        if (!application1Id || !application2Id) {
            return NextResponse.json({ error: 'Both application IDs required' }, { status: 400 });
        }

        if (application1Id === application2Id) {
            return NextResponse.json({ error: 'Cannot match application with itself' }, { status: 400 });
        }

        // Check if match already exists (in either direction)
        const { data: existingMatch } = await supabase
            .from('matches')
            .select('id')
            .or(`and(application_1_id.eq.${application1Id},application_2_id.eq.${application2Id}),and(application_1_id.eq.${application2Id},application_2_id.eq.${application1Id})`)
            .single();

        if (existingMatch) {
            return NextResponse.json({ error: 'Match already exists' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('matches')
            .insert({
                application_1_id: application1Id,
                application_2_id: application2Id,
                created_by: 'admin'
            })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// DELETE - Delete a match (admin only)
export async function DELETE(request: Request) {
    const authHeader = request.headers.get('Authorization');

    if (authHeader !== process.env.ADMIN_PASSWORD) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const matchId = searchParams.get('id');

        if (!matchId) {
            return NextResponse.json({ error: 'Match ID required' }, { status: 400 });
        }

        const { error } = await supabase
            .from('matches')
            .delete()
            .eq('id', matchId);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
