
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseServiceKey) {
    console.warn('Missing SUPABASE_SERVICE_ROLE_KEY - Admin operations may fail.');
}

// this client should ONLY be used in Server Actions or API routes
// NEVER import this in a Client Component
export const supabaseAdmin = (() => {
    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("FATAL: Missing SUPABASE_SERVICE_ROLE_KEY or URL. Admin actions will fail.");
        // We return a proxy that throws on any access to alert the developer immediately
        return new Proxy({} as any, {
            get: () => { throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY. Please verify your .env.local or deployment variables."); }
        });
    }

    console.log(`[Supabase Admin] Initializing with URL: ${supabaseUrl}`);

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
})();
