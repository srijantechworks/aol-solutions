// app/api/engage/route.ts
import { NextResponse } from 'next/server';
import { recordEngagement } from '@/lib/dynamo';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { eventId, courseLabel, messageData, action } = body;

        if (!eventId || !messageData || !action) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // ✨ NEW: Pass courseLabel to dynamo function ✨
        const success = await recordEngagement(eventId, courseLabel || 'AOL Course', messageData, action);

        if (!success) {
            return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Engagement API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}