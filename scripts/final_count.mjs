import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
const { data: cos } = await sb.from('companies').select('id, name');
console.log('=== 회사별 계약 건수 ===');
let total = 0;
for (const c of cos) {
  const { count } = await sb.from('contracts').select('*', { count: 'exact', head: true }).eq('company_id', c.id);
  console.log(`  ${c.name}: ${count}건`);
  total += count;
}
console.log(`\n총 계약: ${total}건`);

// 부서별
const { data: deps } = await sb.from('departments').select('id, name');
const depMap = new Map(deps.map(d => [d.id, d.name]));
const { count: contractsTotal } = await sb.from('contracts').select('*', { count: 'exact', head: true });
console.log(`전체 contracts 테이블: ${contractsTotal}`);

// 거래처
const { count: clientCount } = await sb.from('client_companies').select('*', { count: 'exact', head: true });
console.log(`\n거래처: ${clientCount}개`);

// 세금계산서 contract_id 연결
const { count: tiTotal } = await sb.from('tax_invoices').select('*', { count: 'exact', head: true });
const { count: tiLinked } = await sb.from('tax_invoices').select('*', { count: 'exact', head: true }).not('contract_id', 'is', null);
console.log(`세금계산서: ${tiTotal}건 (계약 연결: ${tiLinked})`);
