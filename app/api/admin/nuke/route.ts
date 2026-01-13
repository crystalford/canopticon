
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        console.log("NUKING SIGNALS TABLE...");
        // Delete all signals (cascade will handle child tables if foreign keys are set up correctly, 
        // otherwise we might need to delete children first. Assuming cascade for now based on typical setup).
        // Safest to just delete all signals.

        const { error } = await supabaseAdmin
            .from('signals')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete everything (hack for 'ALL')

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Signals table wiped." });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
