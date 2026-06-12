import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

for (const t of ['contracts', 'quotes', 'tax_invoices', 'client_companies', 'payment_receipts']) {
  const { count } = await sb.from(t).select('*', { count: 'exact', head: true });
  console.log(`${t}: ${count}`);
}

// 회사별 contracts
const { data: cos } = await sb.from('companies').select('id, name');
for (const c of cos) {
  const { count: cc } = await sb.from('contracts').select('*', { count: 'exact', head: true }).eq('company_id', c.id);
  const { count: tc } = await sb.from('tax_invoices').select('*', { count: 'exact', head: true }).eq('company_id', c.id);
  if (cc > 0 || tc > 0) console.log(`  ${c.name}: 계약 ${cc}, 세금계산서 ${tc}`);
}

// contracts 샘플
const { data: sample } = await sb.from('contracts').select('contract_number, client_company, service_name, contract_date, total_amount, received_amount').limit(3);
console.log('\n계약 샘플:', sample);
