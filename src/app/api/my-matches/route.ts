import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// GET - Get matches for current user's character
export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.gtawId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const characterId = searchParams.get('characterId');

    if (!characterId) {
        return NextResponse.json({ error: 'Character ID required' }, { status: 400 });
    }

    try {
        // First, find the user's application for this character
        const { data: myApplication, error: appError } = await supabase
            .from('applications')
            .select('id')
            .eq('gtaw_user_id', session.user.gtawId)
            .eq('character_id', parseInt(characterId))
            .single();

        if (appError || !myApplication) {
            return NextResponse.json({ matches: [], hasApplication: false });
        }

        // Find all matches where this application is involved
        const { data: matches, error: matchError } = await supabase
            .from('matches')
            .select(`
        id,
        created_at,
        application_1_id,
        application_2_id,
        application_1:applications!matches_application_1_id_fkey(
          id, first_name, last_name, age, weight, gender, sexual_preference,
          phone, facebrowser, description, photo_url, character_name
        ),
        application_2:applications!matches_application_2_id_fkey(
          id, first_name, last_name, age, weight, gender, sexual_preference,
          phone, facebrowser, description, photo_url, character_name
        )
      `)
            .or(`application_1_id.eq.${myApplication.id},application_2_id.eq.${myApplication.id}`);

        if (matchError) {
            console.error('Match fetch error:', matchError);
            return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 });
        }

        // Transform matches to show the OTHER person's info
        const transformedMatches = matches?.map(match => {
            const isApp1 = match.application_1_id === myApplication.id;
            const matchedWith = isApp1 ? match.application_2 : match.application_1;
            return {
                id: match.id,
                created_at: match.created_at,
                matchedWith,
                myApplicationId: myApplication.id
            };
        }) || [];

        return NextResponse.json({
            matches: transformedMatches,
            hasApplication: true,
            applicationId: myApplication.id
        });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
