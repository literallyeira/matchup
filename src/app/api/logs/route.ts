import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
    const authHeader = request.headers.get('Authorization');

    if (authHeader !== process.env.ADMIN_PASSWORD) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const logsRes = await supabase.from('logs').select('*').order('created_at', { ascending: false });
        if (logsRes.error) throw logsRes.error;
        const allLogs = logsRes.data || [];
        const logs = allLogs.filter((l: { action: string }) => l.action !== 'admin_login');

        let loginCounts: { admin_name: string; login_count: number; last_login_at: string }[] = [];
        try {
            const loginCountsRes = await supabase.from('admin_login_counts').select('admin_name, login_count, last_login_at').order('login_count', { ascending: false });
            loginCounts = loginCountsRes.data || [];
        } catch { /* admin_login_counts tablosu yoksa bos */ }

        return NextResponse.json({ logs, loginCounts });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
