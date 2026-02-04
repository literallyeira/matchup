import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const { firstName, lastName, age, weight, gender, sexualPreference, phone, facebrowser, description, photoUrl } = body;

        // Validate required fields
        if (!firstName || !lastName || !age || !weight || !gender || !sexualPreference || !phone || !facebrowser || !description || !photoUrl) {
            return NextResponse.json(
                { error: 'Tüm alanlar doldurulmalıdır!' },
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

        // Insert into database
        const { error: insertError } = await supabase
            .from('applications')
            .insert({
                first_name: firstName,
                last_name: lastName,
                age: parseInt(age),
                weight: parseInt(weight),
                gender,
                sexual_preference: sexualPreference,
                phone,
                facebrowser,
                description,
                photo_url: photoUrl
            });

        if (insertError) {
            console.error('Insert error:', insertError);
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
