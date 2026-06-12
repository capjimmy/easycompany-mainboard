import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
const tables = ['users','companies','departments','client_companies','client_contacts','contracts','tax_invoices','payment_receipts','quotes'];
console.log('=== 최종 DB 현황 ===');
for (const t of tables) {
  const { count } = await sb.from(t).select('*', { count: 'exact', head: true });
  console.log(`  ${t}: ${count}건`);
}

// 회사별 계약/세금계산서
const { data: cos } = await sb.from('companies').select('id, name');
console.log('\n=== 회사별 ===');
for (const c of cos) {
  const { count: cc } = await sb.from('contracts').select('*', { count: 'exact', head: true }).eq('company_id', c.id);
  const { count: tc } = await sb.from('tax_invoices').select('*', { count: 'exact', head: true }).eq('company_id', c.id);
  if (cc + tc > 0) console.log(`  ${c.name}: 계약 ${cc}, 세금계산서 ${tc}`);
}

// 매칭률
const { count: tiTotal } = await sb.from('tax_invoices').select('*', { count: 'exact', head: true });
const { count: tiLinked } = await sb.from('tax_invoices').select('*', { count: 'exact', head: true }).not('contract_id', 'is', null);
console.log(`\n세금계산서 → 계약 매칭: ${tiLinked}/${tiTotal} (${Math.round(tiLinked/tiTotal*100)}%)`);
