import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
const { data, error } = await sb.from('tax_invoices').select('id, status').limit(3);
console.log('error:', error?.message);
console.log('data:', data?.length);
// order('id')가 문제일 수 있음
const { data: d2, error: e2 } = await sb.from('tax_invoices').select('id, status').order('created_at', { ascending: false }).limit(3);
console.log('order created_at error:', e2?.message);
console.log('data2:', d2?.length);
