import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);

        if (!session?.user?.gtawId) {
            return NextResponse.json(
                { error: 'Giriş yapmanız gerekiyor!' },
                { status: 401 }
            );
        }

        const body = await request.json();

        const {
            firstName, lastName, age, weight, gender, sexualPreference,
            phone, facebrowser, description, photoUrl,
            characterId, characterName
        } = body;

        // Validate required fields
        if (!firstName || !lastName || !age || !weight || !gender || !sexualPreference || !phone || !facebrowser || !description || !photoUrl) {
            return NextResponse.json(
                { error: 'Tüm alanlar doldurulmalıdır!' },
                { status: 400 }
            );
        }

        if (!characterId) {
            return NextResponse.json(
                { error: 'Karakter seçimi gerekli!' },
                { status: 400 }
            );
        }

        // Validate age
        if (parseInt(age) < 18) {
            return NextResponse.json(
                { error: '18 yaşından küçükler başvuru yapamaz!' },
                { status: 400 }
            );
        }

        // Create or Update application (upsert based on gtaw_user_id and character_id)
        const { error: upsertError } = await supabase
            .from('applications')
            .upsert({
                first_name: firstName,
                last_name: lastName,
                age: parseInt(age),
                weight: parseInt(weight),
                gender,
                sexual_preference: sexualPreference,
                phone,
                facebrowser,
                description,
                photo_url: photoUrl,
                gtaw_user_id: session.user.gtawId,
                character_id: characterId,
                character_name: characterName,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'gtaw_user_id,character_id'
            });

        if (upsertError) {
            console.error('Upsert error:', upsertError);
            return NextResponse.json(
                { error: 'Başvuru kaydedilirken hata oluştu!' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Submit error:', error);
        return NextResponse.json(
            { error: 'Sunucu hatası!' },
            { status: 500 }
        );
    }
}
