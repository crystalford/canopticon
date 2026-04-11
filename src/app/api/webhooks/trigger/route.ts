import { NextResponse } from 'next/server';
import { db } from '@/db';
import { investigations } from '@/db/schema';
import { InvestigationPipeline } from '@/lib/pipeline/research';

export async function POST(req: Request) {
    try {
        const payload = await req.json();

        // Expects { title: "Topic Name", seedPrompt: "Specific angle or context to research" }
        const { title, seedPrompt } = payload;

        if (!title || !seedPrompt) {
            return NextResponse.json({ error: 'Missing title or seedPrompt' }, { status: 400 });
        }

        // Validate a shared secret
        const authHeader = req.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
             return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const [inv] = await db.insert(investigations).values({
            title,
            seedPrompt,
            triggerSource: 'webhook'
        }).returning();

        // Fire and forget the pipeline
        InvestigationPipeline.run(inv.id).catch(console.error);

        return NextResponse.json({ success: true, investigationId: inv.id });

    } catch (error) {
        console.error('Trigger webhook error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
