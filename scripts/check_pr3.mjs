import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
const test = { id: randomUUID(), company_id: 'a0000000-0000-0000-0000-000000000001', amount: 100, payment_date: '2024-01-01' };
const { data, error } = await sb.from('payment_receipts').insert(test).select().single();
console.log('error:', error?.message);
if (data) { console.log('컬럼:', Object.keys(data)); await sb.from('payment_receipts').delete().eq('id', test.id); }
