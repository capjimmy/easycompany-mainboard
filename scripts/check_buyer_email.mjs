import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
// 현재 컬럼 보기
const test = { id: crypto.randomUUID(), company_id: 'a0000000-0000-0000-0000-000000000001', buyer_email: 'test@test.com', supplier_name:'x', buyer_name:'x', invoice_number:'X', issue_date:'2024-01-01' };
const { error } = await sb.from('tax_invoices').insert(test);
if (error) console.log('❌', error.message);
else { console.log('✅ 컬럼 존재'); await sb.from('tax_invoices').delete().eq('id', test.id); }
