import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

// Check tax_invoices.contract_id column
const { data: ti, error: tiErr } = await sb.from('tax_invoices').select('contract_id').limit(1);
console.log('tax_invoices.contract_id:', tiErr ? `❌ ${tiErr.message}` : '✅ 존재');

// Check contract_meeting_notes table
const { error: mnErr } = await sb.from('contract_meeting_notes').select('id', { head: true, count: 'exact' });
console.log('contract_meeting_notes:', mnErr ? `❌ ${mnErr.message}` : '✅ 존재');

// Check messenger participant_joined_at column
const { data: mc, error: mcErr } = await sb.from('messenger_conversations').select('participant_joined_at').limit(1);
console.log('messenger_conversations.participant_joined_at:', mcErr ? `❌ ${mcErr.message}` : '✅ 존재');
