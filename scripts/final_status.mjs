import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
const tables = ['users', 'companies', 'departments', 'client_companies', 'client_contacts', 'quotes', 'contracts', 'tax_invoices'];
console.log('=== DB 현황 ===');
for (const t of tables) {
  const { count } = await sb.from(t).select('*', { count: 'exact', head: true });
  console.log(`  ${t}: ${count}건`);
}
const { count: linked } = await sb.from('contracts').select('*', { count: 'exact', head: true }).gt('received_amount', 0);
console.log(`\n  수금 있는 계약: ${linked}건`);
const { count: tiLinked } = await sb.from('tax_invoices').select('*', { count: 'exact', head: true }).not('contract_id', 'is', null);
console.log(`  계약 연결된 세금계산서: ${tiLinked}건`);
