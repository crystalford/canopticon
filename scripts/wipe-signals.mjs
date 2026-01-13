import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('🔥 WIPING SIGNALS TABLE...')

const { error, count } = await supabase
    .from('signals')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')

if (error) {
    console.error('❌ Error:', error)
    process.exit(1)
} else {
    console.log('✅ All signals deleted successfully')
    process.exit(0)
}
