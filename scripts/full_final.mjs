import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

console.log('=== 최종 DB 현황 ===');
const tables = ['users','companies','departments','client_companies','client_contacts','contracts','contract_subtasks','payment_conditions','contract_payments','outsourcings','tax_invoices','payment_receipts'];
for (const t of tables) {
  const { count } = await sb.from(t).select('*', { count: 'exact', head: true });
  console.log(`  ${t}: ${count}건`);
}

const { data: cos } = await sb.from('companies').select('id, name');
console.log('\n=== 회사별 계약 ===');
let total = 0;
for (const c of cos) {
  const { count } = await sb.from('contracts').select('*', { count: 'exact', head: true }).eq('company_id', c.id);
  if (count > 0) { console.log(`  ${c.name}: ${count}건`); total += count; }
}
console.log(`\n총 계약: ${total}건`);
