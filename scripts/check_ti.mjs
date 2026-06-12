import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
const { count: total } = await sb.from('tax_invoices').select('*', { count: 'exact', head: true });
console.log('tax_invoices 총:', total);
const { data: companies } = await sb.from('companies').select('id, name');
for (const c of companies) {
  const { count } = await sb.from('tax_invoices').select('*', { count: 'exact', head: true }).eq('company_id', c.id);
  console.log(`  ${c.name}: ${count}건`);
}
const { data: sample } = await sb.from('tax_invoices').select('id, company_id, buyer_name, supplier_name, issue_date, total_amount').limit(3);
console.log('\n샘플:', sample);
