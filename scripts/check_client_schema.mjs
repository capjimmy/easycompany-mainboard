import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
const { data, error } = await sb.from('client_companies').select('*').limit(1);
console.log('error:', error?.message);
console.log('샘플:', JSON.stringify(data?.[0] || {}, null, 2));

// tax_invoices 스키마 확인
const { data: ti, error: tiErr } = await sb.from('tax_invoices').select('*').limit(1);
console.log('\ntax_invoices error:', tiErr?.message);
console.log('tax_invoices 샘플:', JSON.stringify(ti?.[0] || {}, null, 2));
