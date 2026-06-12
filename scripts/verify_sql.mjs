import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
const tables = ['vehicles','vehicle_logs','spaces','contract_members','quote_members'];
for (const t of tables) {
  const { error } = await sb.from(t).select('id', { head: true });
  console.log(`${t}: ${error ? '❌ '+error.message : '✅'}`);
}
// 컬럼 확인
const { data: ti } = await sb.from('tax_invoices').select('buyer_email').limit(1);
console.log(`tax_invoices.buyer_email: ${ti !== null ? '✅' : '❌'}`);
const { data: u } = await sb.from('users').select('annual_leave_override, annual_leave_used_offset').limit(1);
console.log(`users.annual_leave_override: ${u !== null ? '✅' : '❌'}`);
// nullable 확인
import crypto from 'crypto';
const test = { id: crypto.randomUUID(), company_id: null, plate_number: 'TEST', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
const { error: vErr } = await sb.from('vehicles').insert(test);
if (!vErr) { await sb.from('vehicles').delete().eq('id', test.id); console.log('vehicles NULL company_id: ✅'); }
else console.log('vehicles NULL company_id: ❌ ' + vErr.message);
