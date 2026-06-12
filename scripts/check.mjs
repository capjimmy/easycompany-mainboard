import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
const { data: cos } = await sb.from('companies').select('id, name');
console.log('companies:', cos);
const { data: kee } = await sb.from('client_companies').select('id, name').eq('company_id', cos.find(c=>c.name==='건설경제연구원')?.id).ilike('name', '%한강%');
console.log('한강 거래처:', kee);
const { data: ti } = await sb.from('tax_invoices').select('*').limit(1);
console.log('tax_invoices 컬럼:', Object.keys(ti?.[0] || {}));
